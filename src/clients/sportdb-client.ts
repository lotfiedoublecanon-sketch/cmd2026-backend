// ============================================
// SportDB Client (FALLBACK / validation source)
// ============================================
import axios, { AxiosInstance, AxiosError } from 'axios';
import dotenv from 'dotenv';
import {
  NormalizedMatch, MatchEvent, TimelineEventType,
  MatchStats, MatchLineups, LineupPlayer,
  TeamInfo, MatchStatus, StandingEntry
} from '../types';
import { readConfigValue, readConfigValueOrDefault } from '../utils/env';

dotenv.config();

const SPORTDB_BASE_URL = readConfigValueOrDefault(['SPORTDB_BASE_URL'], 'https://www.thesportsdb.com/api/v1/json');
const SPORTDB_API_KEY = readConfigValue('SPORTDB_API_KEY');
const SPORTDB_LEAGUE_ID = readConfigValueOrDefault(['SPORTDB_LEAGUE_ID'], '4636');
const SPORTDB_TIMEOUT = parseInt(process.env.SPORTDB_TIMEOUT_MS || '8000', 10);

class SportDbClient {
  private client: AxiosInstance;
  private cache = new Map<string, { data: any; expires: number }>();

  constructor() {
    this.client = axios.create({
      baseURL: `${SPORTDB_BASE_URL}/${SPORTDB_API_KEY}`,
      timeout: SPORTDB_TIMEOUT,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CDM2026-Live-Backend/5.0',
      },
    });
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) return entry.data;
    if (entry) this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
  }

  private async request<T>(path: string, cacheTtl = 60): Promise<T> {
    const cached = this.getFromCache(path);
    if (cached) return cached as T;

    try {
      const response = await this.client.get<T>(path);
      this.setCache(path, response.data, cacheTtl);
      return response.data;
    } catch (error) {
      const axiosErr = error as AxiosError;
      console.error(`[SportDB] GET ${path} failed:`, axiosErr.response?.status, axiosErr.message);
      throw error;
    }
  }

  // ---- Matches ----

  async getLiveMatches(): Promise<NormalizedMatch[]> {
    try {
      // SportDB: eventsday with l=soccer for today
      const today = new Date().toISOString().split('T')[0];
      const data = await this.request<any>(`/eventsday.php?d=${today}&l=${SPORTDB_LEAGUE_ID}&s=Soccer`, 10);
      const events = data?.events || [];
      if (!Array.isArray(events)) return [];
      return events.filter((e: any) => this.isLive(e)).map((e: any) => this.normalizeMatch(e));
    } catch {
      return [];
    }
  }

  async getTodayMatches(): Promise<NormalizedMatch[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await this.request<any>(`/eventsday.php?d=${today}&l=${SPORTDB_LEAGUE_ID}&s=Soccer`, 30);
      const events = data?.events || [];
      if (!Array.isArray(events)) return [];
      return events.map((e: any) => this.normalizeMatch(e));
    } catch {
      return [];
    }
  }

  async getUpcomingMatches(days = 7): Promise<NormalizedMatch[]> {
    try {
      const data = await this.request<any>(`/eventsnextleague.php?id=${SPORTDB_LEAGUE_ID}`, 120);
      const events = data?.events || [];
      if (!Array.isArray(events)) return [];
      const now = new Date();
      const limit = new Date(now.getTime() + days * 86400000);
      return events
        .filter((e: any) => {
          const d = new Date(e.dateEvent || '');
          return d >= now && d <= limit;
        })
        .map((e: any) => this.normalizeMatch(e));
    } catch {
      return [];
    }
  }

  async getMatchById(matchId: string): Promise<NormalizedMatch | null> {
    try {
      const data = await this.request<any>(`/lookupevent.php?id=${matchId}`, 30);
      const events = data?.events || [];
      if (!Array.isArray(events) || events.length === 0) return null;
      return this.normalizeMatch(events[0]);
    } catch {
      return null;
    }
  }

  // ---- Match Events (timeline) ----

  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    try {
      const data = await this.request<any>(`/lookupevent.php?id=${matchId}`, 15);
      const events = data?.events || [];
      if (!Array.isArray(events) || events.length === 0) return [];
      const match = events[0];
      return this.extractEventsFromMatch(matchId, match);
    } catch {
      return [];
    }
  }

  // ---- Match Statistics ----

  async getMatchStats(matchId: string): Promise<MatchStats | null> {
    try {
      const data = await this.request<any>(`/lookupevent.php?id=${matchId}`, 30);
      const events = data?.events || [];
      if (!Array.isArray(events) || events.length === 0) return null;
      const match = events[0];
      // SportDB doesn't provide detailed stats; return what's available from the event
      const stats: Array<{ name: string; home: number; away: number }> = [];
      if (match.intHomeShots !== null && match.intAwayShots !== null) {
        stats.push({ name: 'Shots', home: parseInt(match.intHomeShots || '0', 10), away: parseInt(match.intAwayShots || '0', 10) });
      }
      if (match.intHomeYellowCards !== null && match.intAwayYellowCards !== null) {
        stats.push({ name: 'Yellow Cards', home: parseInt(match.intHomeYellowCards || '0', 10), away: parseInt(match.intAwayYellowCards || '0', 10) });
      }
      if (match.intHomeRedCards !== null && match.intAwayRedCards !== null) {
        stats.push({ name: 'Red Cards', home: parseInt(match.intHomeRedCards || '0', 10), away: parseInt(match.intAwayRedCards || '0', 10) });
      }
      return { matchId, stats };
    } catch {
      return null;
    }
  }

  // ---- Lineups ----

  async getMatchLineups(matchId: string): Promise<MatchLineups | null> {
    try {
      const data = await this.request<any>(`/lookupevent.php?id=${matchId}`, 30);
      const events = data?.events || [];
      if (!Array.isArray(events) || events.length === 0) return null;
      const match = events[0];
      return this.extractLineupsFromMatch(matchId, match);
    } catch {
      return null;
    }
  }

  // ---- Standings ----

  async getStandings(): Promise<StandingEntry[]> {
    try {
      const data = await this.request<any>(`/lookuptable.php?l=${SPORTDB_LEAGUE_ID}&s=2026-2027`, 120);
      const table = data?.table || [];
      if (!Array.isArray(table)) return [];
      return table.map((e: any, i: number) => this.normalizeStanding(e, i + 1));
    } catch {
      return [];
    }
  }

  // ---- Teams ----

  async getTeamById(teamId: string): Promise<TeamInfo | null> {
    try {
      const data = await this.request<any>(`/lookupteam.php?id=${teamId}`, 300);
      const teams = data?.teams || [];
      if (!Array.isArray(teams) || teams.length === 0) return null;
      const t = teams[0];
      return {
        id: t.idTeam || teamId,
        name: t.strTeam || 'Unknown',
        shortName: t.strTeamShort || t.strAbbreviation || t.strTeam?.substring(0, 3) || 'UNK',
        threeCharCode: t.strTeamShort || t.strAbbreviation || 'UNK',
        logoUrl: t.strBadge || t.strLogo || undefined,
        country: t.strCountry || undefined,
      };
    } catch {
      return null;
    }
  }

  // ========== INTERNALS ==========

  private isLive(event: any): boolean {
    const status = (event.strStatus || event.eventStage || '').toLowerCase();
    // SportDB live indicators
    if (['1', '2', '3', 'ht', 'et', 'p', 'live', 'in_progress', '1h', '2h'].includes(status)) return true;
    if (event.intHomeScore !== null && event.intAwayScore !== null && event.intProgress) return true;
    return false;
  }

  private normalizeMatch(raw: any): NormalizedMatch {
    const status = this.mapSportDbStatus(raw);
    const homeScore = raw.intHomeScore === null || raw.intHomeScore === undefined || raw.intHomeScore === ''
      ? null
      : parseInt(raw.intHomeScore, 10);
    const awayScore = raw.intAwayScore === null || raw.intAwayScore === undefined || raw.intAwayScore === ''
      ? null
      : parseInt(raw.intAwayScore, 10);

    return {
      id: raw.idEvent || raw.idMatch || '',
      source: 'sportdb',
      competitionId: raw.idLeague || SPORTDB_LEAGUE_ID,
      competitionName: raw.strLeague || 'FIFA World Cup 2026',
      seasonName: raw.strSeason || '2026',
      stage: raw.strStage || raw.eventStage || raw.intRound ? `Round ${raw.intRound}` : '',
      group: raw.strGroup || undefined,
      round: raw.intRound || undefined,
      homeTeam: {
        id: raw.idHomeTeam || '',
        name: raw.strHomeTeam || 'Unknown',
        shortName: raw.strHomeTeam?.substring(0, 3) || 'HOM',
        threeCharCode: raw.strHomeTeamBadge ? (raw.strHomeTeamShort || 'HOM') : 'HOM',
        logoUrl: raw.strHomeTeamBadge || raw.strHomeTeamLogo || undefined,
      },
      awayTeam: {
        id: raw.idAwayTeam || '',
        name: raw.strAwayTeam || 'Unknown',
        shortName: raw.strAwayTeam?.substring(0, 3) || 'AWY',
        threeCharCode: raw.strAwayTeamBadge ? (raw.strAwayTeamShort || 'AWY') : 'AWY',
        logoUrl: raw.strAwayTeamBadge || raw.strAwayTeamLogo || undefined,
      },
      status,
      minute: raw.intProgress ? parseInt(raw.intProgress, 10) : undefined,
      startDateTimeUtc: raw.dateEvent && raw.strTime ? `${raw.dateEvent}T${raw.strTime}` : (raw.dateEvent || ''),
      homeScore,
      awayScore,
      isFinished: status === 'finished',
      isInProgress: this.isLive(raw),
      venue: raw.strVenue || undefined,
      referee: raw.strReferee || undefined,
    };
  }

  private mapSportDbStatus(raw: any): MatchStatus {
    const stage = (raw.eventStage || raw.strStatus || '').toLowerCase();
    const progress = raw.intProgress;

    // SportDB status codes: 1=1st half, 2=2nd half, 3=extra, HT=halftime
    if (stage === 'ft' || stage === 'finished' || stage === 'match finished' || stage === '9') return 'finished';
    if (stage === '1' || stage === '1h' || stage === '1st_half') return 'in_progress';
    if (stage === '2' || stage === '2h' || stage === '2nd_half') return 'in_progress';
    if (stage === '3' || stage === 'et' || stage === 'extra_time') return 'extra_time';
    if (stage === 'ht' || stage === 'halftime' || stage === 'half_time') return 'halftime';
    if (stage === 'p' || stage === 'pso' || stage === 'penalties') return 'penalties';
    if (stage === 'postponed') return 'postponed';
    if (stage === 'cancelled') return 'cancelled';
    if (progress && parseInt(progress, 10) > 0) return 'in_progress';
    if (raw.strTimestamp && new Date(raw.strTimestamp) > new Date()) return 'scheduled';
    return 'scheduled';
  }

  private extractEventsFromMatch(matchId: string, match: any): MatchEvent[] {
    const events: MatchEvent[] = [];
    let evtIndex = 0;

    // Goals from SportDB match details
    const homeGoals = parseInt(match.intHomeScore || '0', 10);
    const awayGoals = parseInt(match.intAwayScore || '0', 10);

    // SportDB provides strHomeGoalDetails, strAwayGoalDetails as strings like "15':Player1; 34':Player2"
    const parseGoalString = (str: string | null, side: 'home' | 'away') => {
      if (!str) return;
      const goals = str.split(';').map(g => g.trim()).filter(Boolean);
      for (const g of goals) {
        const match2 = g.match(/^(\d+)'\s*(.+)/);
        if (match2) {
          events.push({
            id: `sdb_${matchId}_g_${evtIndex++}`,
            matchId,
            type: 'goal',
            minute: parseInt(match2[1], 10),
            team: side,
            playerName: match2[2].trim(),
            description: g,
          });
        }
      }
    };

    parseGoalString(match.strHomeGoalDetails, 'home');
    parseGoalString(match.strAwayGoalDetails, 'away');

    // Cards
    const parseCardString = (str: string | null, side: 'home' | 'away', type: TimelineEventType) => {
      if (!str) return;
      const cards = str.split(';').map(c => c.trim()).filter(Boolean);
      for (const c of cards) {
        const match2 = c.match(/^(\d+)'\s*(.+)/);
        if (match2) {
          events.push({
            id: `sdb_${matchId}_c_${evtIndex++}`,
            matchId,
            type,
            minute: parseInt(match2[1], 10),
            team: side,
            playerName: match2[2].trim(),
            description: c,
          });
        }
      }
    };

    parseCardString(match.strHomeYellowCards, 'home', 'yellow_card');
    parseCardString(match.strAwayYellowCards, 'away', 'yellow_card');
    parseCardString(match.strHomeRedCards, 'home', 'red_card');
    parseCardString(match.strAwayRedCards, 'away', 'red_card');

    // Sort by minute
    events.sort((a, b) => a.minute - b.minute);
    return events;
  }

  private extractLineupsFromMatch(matchId: string, match: any): MatchLineups | null {
    const homeLineup = match.strHomeLineup || '';
    const awayLineup = match.strAwayLineup || '';

    const parseLineup = (str: string, isHome: boolean): LineupPlayer[] => {
      if (!str) return [];
      return str.split(';').map((p, i) => {
        const trimmed = p.trim();
        return {
          id: `sdb_p_${isHome ? 'h' : 'a'}_${i}`,
          name: trimmed,
          position: '',
          isStarter: true,
        };
      }).filter(p => p.name.length > 0);
    };

    return {
      matchId,
      homeFormation: match.strHomeFormation || undefined,
      awayFormation: match.strAwayFormation || undefined,
      homePlayers: parseLineup(homeLineup, true),
      awayPlayers: parseLineup(awayLineup, false),
    };
  }

  private normalizeStanding(raw: any, position: number): StandingEntry {
    return {
      position,
      team: {
        id: raw.idTeam || '',
        name: raw.strTeam || 'Unknown',
        shortName: raw.strTeamShort || raw.strTeam?.substring(0, 3) || 'UNK',
        threeCharCode: raw.strTeamShort || 'UNK',
        logoUrl: raw.strTeamBadge || undefined,
      },
      played: parseInt(raw.intPlayed || '0', 10),
      won: parseInt(raw.intWin || '0', 10),
      drawn: parseInt(raw.intDraw || '0', 10),
      lost: parseInt(raw.intLoss || '0', 10),
      goalsFor: parseInt(raw.intGoalsFor || '0', 10),
      goalsAgainst: parseInt(raw.intGoalsAgainst || '0', 10),
      goalDifference: parseInt(raw.intGoalDifference || '0', 10),
      points: parseInt(raw.intPoints || '0', 10),
      group: raw.strGroup || undefined,
      form: raw.strForm || undefined,
    };
  }
}

export const sportDbClient = new SportDbClient();
export default SportDbClient;
