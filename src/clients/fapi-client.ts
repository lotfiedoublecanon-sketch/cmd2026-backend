// ============================================
// FAPI / TheStatsAPI Client (PRIMARY source)
// ============================================
import axios, { AxiosInstance, AxiosError } from 'axios';
import dotenv from 'dotenv';
import {
  NormalizedMatch, MatchEvent, TimelineEventType,
  MatchStats, StatCategory, MatchLineups, LineupPlayer,
  TeamInfo, MatchStatus, MatchPeriod, StandingEntry
} from '../types';
import { readConfigValue, readConfigValueOrDefault } from '../utils/env';

dotenv.config();

const FAPI_BASE_URL = readConfigValueOrDefault(['FAPI_BASE_URL', 'THESTATSAPI_BASE_URL'], 'https://api.thestatsapi.com/v2');
const FAPI_API_KEY = readConfigValue('FAPI_API_KEY', 'THESTATSAPI_KEY');
const FAPI_COMPETITION_ID = readConfigValueOrDefault(['FAPI_COMPETITION_ID', 'WORLD_CUP_COMPETITION_ID'], 'comp_6107');
const FAPI_COMPETITION_IDS = readConfigValueOrDefault(
  ['FAPI_COMPETITION_IDS', 'THESTATSAPI_COMPETITION_IDS'],
  FAPI_COMPETITION_ID
)
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const FAPI_TIMEOUT = parseInt(process.env.FAPI_TIMEOUT_MS || '8000', 10);

class FapiClient {
  private client: AxiosInstance;
  private cache = new Map<string, { data: any; expires: number }>();

  constructor() {
    this.client = axios.create({
      baseURL: FAPI_BASE_URL,
      timeout: FAPI_TIMEOUT,
      headers: {
        'x-api-key': FAPI_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'CDM2026-Live-Backend/5.0',
      },
    });
  }

  private getCacheKey(method: string, path: string, params?: any): string {
    return `${method}:${path}:${JSON.stringify(params || {})}`;
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }
    if (entry) this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
  }

  private async request<T>(method: string, path: string, params?: any, cacheTtl = 30): Promise<T> {
    const cacheKey = this.getCacheKey(method, path, params);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as T;

    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        params,
      });
      this.setCache(cacheKey, response.data, cacheTtl);
      return response.data;
    } catch (error) {
      const axiosErr = error as AxiosError;
      console.error(`[FAPI] ${method} ${path} failed:`, axiosErr.response?.status, axiosErr.message);
      throw error;
    }
  }

  // ---- Competition & Matches ----

  async getLiveMatches(): Promise<NormalizedMatch[]> {
    const confirmedLive: NormalizedMatch[] = [];

    for (const competitionId of this.getCompetitionIds()) {
      try {
        const data = await this.request<any>('GET', `/competitions/${competitionId}/matches`, { live: true }, 10);
        confirmedLive.push(...this.extractMatches(data).filter(m => this.isReliableLiveMatch(m)));
      } catch {
        // Try the next configured World Cup competition id.
      }
    }

    if (confirmedLive.length > 0) return this.dedupeMatches(confirmedLive);

    const genericAttempts = [
      { path: '/matches/live', params: undefined },
      { path: '/matches', params: { live: true } },
    ];

    for (const attempt of genericAttempts) {
      try {
        const data = await this.request<any>('GET', attempt.path, attempt.params, 10);
        confirmedLive.push(
          ...this.extractMatches(data)
            .filter(m => this.isWorldCupMatch(m))
            .filter(m => this.isReliableLiveMatch(m))
        );
      } catch {
        // SportDB remains the fallback if generic FAPI live endpoints are unavailable.
      }
    }

    if (confirmedLive.length > 0) return this.dedupeMatches(confirmedLive);

    return this.getTodayMatches().then(m => this.dedupeMatches(m.filter(m2 => this.isReliableLiveMatch(m2))));
  }

  async getTodayMatches(): Promise<NormalizedMatch[]> {
    const today = new Date().toISOString().split('T')[0];
    const data = await this.request<any>('GET', `/competitions/${FAPI_COMPETITION_ID}/matches`, { date: today }, 15);
    return this.extractMatches(data);
  }

  async getUpcomingMatches(days = 7): Promise<NormalizedMatch[]> {
    const data = await this.request<any>('GET', `/competitions/${FAPI_COMPETITION_ID}/matches`, { upcoming: true, days }, 60);
    return this.extractMatches(data);
  }

  async getMatchById(matchId: string): Promise<NormalizedMatch | null> {
    try {
      const data = await this.request<any>('GET', `/matches/${matchId}`, undefined, 15);
      return this.normalizeMatch(data);
    } catch {
      return null;
    }
  }

  // ---- Match Events / Timeline ----

  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    try {
      const data = await this.request<any>('GET', `/matches/${matchId}/events`, undefined, 10);
      return this.normalizeEvents(matchId, data);
    } catch {
      return [];
    }
  }

  // ---- Match Statistics ----

  async getMatchStats(matchId: string): Promise<MatchStats | null> {
    try {
      const data = await this.request<any>('GET', `/matches/${matchId}/stats`, undefined, 15);
      return this.normalizeStats(matchId, data);
    } catch {
      return null;
    }
  }

  // ---- Lineups ----

  async getMatchLineups(matchId: string): Promise<MatchLineups | null> {
    try {
      const data = await this.request<any>('GET', `/matches/${matchId}/lineups`, undefined, 30);
      return this.normalizeLineups(matchId, data);
    } catch {
      return null;
    }
  }

  // ---- Standings ----

  async getStandings(): Promise<StandingEntry[]> {
    try {
      const data = await this.request<any>('GET', `/competitions/${FAPI_COMPETITION_ID}/standings`, undefined, 120);
      return this.normalizeStandings(data);
    } catch {
      return [];
    }
  }

  // ---- Teams ----

  async getTeamById(teamId: string): Promise<any> {
    try {
      return await this.request<any>('GET', `/teams/${teamId}`, undefined, 300);
    } catch {
      return null;
    }
  }

  // ---- Player Stats ----

  async getPlayerStats(playerId: string): Promise<any> {
    try {
      return await this.request<any>('GET', `/players/${playerId}/stats`, undefined, 120);
    } catch {
      return null;
    }
  }

  // ========== NORMALIZATION ==========

  private extractMatches(response: any): NormalizedMatch[] {
    const items = response?.data || response?.matches || response?.results || response?.items || [];
    if (!Array.isArray(items)) return [];
    return items.map(m => this.normalizeMatch(m)).filter(Boolean) as NormalizedMatch[];
  }

  private getCompetitionIds(): string[] {
    return Array.from(new Set(FAPI_COMPETITION_IDS.length > 0 ? FAPI_COMPETITION_IDS : [FAPI_COMPETITION_ID]));
  }

  private isReliableLiveMatch(match: NormalizedMatch): boolean {
    return match.isInProgress && ['in_progress', 'halftime', 'extra_time', 'penalties'].includes(match.status);
  }

  private isWorldCupMatch(match: NormalizedMatch): boolean {
    const text = [
      match.competitionId,
      match.competitionName,
      match.seasonName,
      match.stage,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (text.includes('club world cup') || text.includes('women')) return false;

    return this.getCompetitionIds().includes(match.competitionId) || [
      'fifa world cup',
      'world cup 2026',
      'coupe du monde',
      'coupe du monde 2026',
      'canada mexico usa 2026',
    ].some((term) => text.includes(term));
  }

  private dedupeMatches(matches: NormalizedMatch[]): NormalizedMatch[] {
    const byKey = new Map<string, NormalizedMatch>();

    for (const match of matches) {
      const key = [
        match.id,
        match.homeTeam.name.toLowerCase(),
        match.awayTeam.name.toLowerCase(),
        match.startDateTimeUtc,
      ].filter(Boolean).join('|');

      if (!byKey.has(key)) byKey.set(key, match);
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const aTime = new Date(a.startDateTimeUtc).getTime();
      const bTime = new Date(b.startDateTimeUtc).getTime();
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    });
  }

  private normalizeMatch(raw: any): NormalizedMatch | null {
    if (!raw) return null;

    const homeTeam = this.normalizeTeam(raw.home_team || raw.homeTeam || raw.home);
    const awayTeam = this.normalizeTeam(raw.away_team || raw.awayTeam || raw.away);

    // Status mapping from FAPI
    const status = this.mapStatus(raw);
    const period = this.mapPeriod(raw);

    const homeScore = raw.home_score ?? raw.homeScore ?? raw.score_home ?? 0;
    const awayScore = raw.away_score ?? raw.awayScore ?? raw.score_away ?? 0;

    return {
      id: raw.id || raw.match_id || raw.matchId,
      source: 'fapi',
      competitionId: raw.competition_id || raw.competitionId || FAPI_COMPETITION_ID,
      competitionName: raw.competition_name || raw.competitionName || 'FIFA World Cup 2026',
      seasonName: raw.season_name || raw.seasonName || '2026',
      stage: raw.stage || raw.event_stage || raw.round || '',
      group: raw.group || raw.standing_group || raw.group_name || undefined,
      round: raw.round || raw.match_day || undefined,
      homeTeam,
      awayTeam,
      status,
      period,
      minute: raw.minute || raw.match_minute || undefined,
      startDateTimeUtc: raw.start_datetime_utc || raw.startDateTimeUtc || raw.kickoff || raw.date || '',
      homeScore,
      awayScore,
      homeScorePenalty: raw.home_score_penalty ?? raw.homePenScore ?? undefined,
      awayScorePenalty: raw.away_score_penalty ?? raw.awayPenScore ?? undefined,
      isFinished: raw.is_finished ?? raw.isFinished ?? (status === 'finished'),
      isInProgress: raw.is_in_progress ?? raw.isInProgress ?? (status === 'in_progress' || status === 'halftime' || status === 'extra_time' || status === 'penalties'),
      venue: raw.venue || raw.stadium || undefined,
      referee: raw.referee || undefined,
    };
  }

  private normalizeTeam(raw: any): TeamInfo {
    if (!raw) return { id: '', name: 'Unknown', shortName: 'UNK', threeCharCode: 'UNK' };
    return {
      id: raw.id || raw.team_id || raw.teamId || '',
      name: raw.name || raw.team_name || raw.teamName || 'Unknown',
      shortName: raw.short_name || raw.shortName || raw.abbreviation || raw.name?.substring(0, 3) || 'UNK',
      threeCharCode: raw.three_char_name || raw.threeCharCode || raw.fifa_code || raw.iso_code || raw.short_name?.substring(0, 3) || 'UNK',
      logoUrl: raw.logo_url || raw.logoUrl || raw.logo || raw.crest || undefined,
      country: raw.country || raw.nationality || undefined,
    };
  }

  private mapStatus(raw: any): MatchStatus {
    // FAPI uses is_finished and is_in_progress booleans + status string
    if (raw.is_finished || raw.isFinished) return 'finished';
    if (raw.is_in_progress || raw.isInProgress) {
      const minute = raw.minute || raw.match_minute || 0;
      if (minute <= 0) return 'in_progress';
      // Detect halftime via period
      const period = raw.period || raw.match_period || '';
      if (period === 'halftime' || period === 'HT' || period === 'half_time') return 'halftime';
      if (period === 'extra_time' || period === 'ET') return 'extra_time';
      if (period === 'penalties' || period === 'PSO' || period === 'penalty_shootout') return 'penalties';
      return 'in_progress';
    }
    if (raw.status) {
      const s = String(raw.status).toLowerCase();
      if (s === 'finished' || s === 'ft' || s === 'full_time' || s === 'completed') return 'finished';
      if (s === 'in_progress' || s === 'live' || s === 'inprogress' || s === '2nd_half' || s === '1st_half') return 'in_progress';
      if (s === 'halftime' || s === 'ht' || s === 'half_time') return 'halftime';
      if (s === 'extra_time' || s === 'et' || s === 'extra_time_1' || s === 'extra_time_2') return 'extra_time';
      if (s === 'penalties' || s === 'pso' || s === 'penalty_shootout') return 'penalties';
      if (s === 'postponed') return 'postponed';
      if (s === 'cancelled' || s === 'canceled') return 'cancelled';
      if (s === 'scheduled' || s === 'not_started' || s === 'upcoming' || s === 'pre_match') return 'scheduled';
    }
    // If we have a start date in the future, it's scheduled
    if (raw.start_datetime_utc || raw.startDateTimeUtc || raw.date) {
      const startDate = new Date(raw.start_datetime_utc || raw.startDateTimeUtc || raw.date);
      if (startDate > new Date()) return 'scheduled';
    }
    return 'unknown';
  }

  private mapPeriod(raw: any): MatchPeriod | undefined {
    const p = raw.period || raw.match_period || '';
    const pl = String(p).toLowerCase();
    if (pl === '1st_half' || pl === 'first_half' || pl === '1h') return '1st_half';
    if (pl === '2nd_half' || pl === 'second_half' || pl === '2h') return '2nd_half';
    if (pl === 'halftime' || pl === 'ht' || pl === 'half_time') return 'halftime';
    if (pl === 'extra_time_1' || pl === 'et1' || pl === 'extra_first') return 'extra_time_1';
    if (pl === 'extra_time_2' || pl === 'et2' || pl === 'extra_second') return 'extra_time_2';
    if (pl === 'penalty_shootout' || pl === 'pso' || pl === 'penalties') return 'penalty_shootout';
    if (pl === 'full_time' || pl === 'ft') return 'full_time';
    return undefined;
  }

  private normalizeEvents(matchId: string, raw: any): MatchEvent[] {
    const items = raw?.data || raw?.events || raw?.results || [];
    if (!Array.isArray(items)) return [];
    return items.map((e: any) => this.normalizeEvent(matchId, e)).filter(Boolean) as MatchEvent[];
  }

  private normalizeEvent(matchId: string, raw: any): MatchEvent | null {
    if (!raw) return null;
    return {
      id: raw.id || raw.event_id || `evt_${matchId}_${raw.minute}_${raw.type}`,
      matchId,
      type: this.mapEventType(raw.type || raw.event_type || ''),
      minute: raw.minute || raw.event_minute || 0,
      period: raw.period || raw.event_period || undefined,
      team: this.mapTeamSide(raw),
      playerId: raw.player_id || raw.playerId || undefined,
      playerName: raw.player_name || raw.playerName || raw.player || undefined,
      assistPlayerId: raw.assist_player_id || raw.assistPlayerId || undefined,
      assistPlayerName: raw.assist_player_name || raw.assistPlayerName || raw.assist || undefined,
      description: raw.description || raw.detail || undefined,
      varOutcome: raw.var_outcome || raw.varOutcome || undefined,
      relatedEventId: raw.related_event_id || raw.relatedEventId || undefined,
    };
  }

  private mapEventType(type: string): TimelineEventType {
    const t = String(type).toLowerCase();
    if (t === 'goal' || t === 'regular') return 'goal';
    if (t === 'own_goal' || t === 'owngoal') return 'own_goal';
    if (t === 'penalty' || t === 'penalty_goal') return 'penalty_goal';
    if (t === 'penalty_missed' || t === 'missed_penalty') return 'penalty_missed';
    if (t === 'yellow_card' || t === 'yellowcard') return 'yellow_card';
    if (t === 'red_card' || t === 'redcard') return 'red_card';
    if (t === 'second_yellow' || t === 'second_yellow_card') return 'second_yellow_card';
    if (t === 'substitution') return 'substitution';
    if (t === 'var' || t === 'var_decision') return 'var_decision';
    if (t === 'period_start' || t === 'period_start') return 'period_start';
    if (t === 'period_end') return 'period_end';
    return 'unknown';
  }

  private mapTeamSide(raw: any): 'home' | 'away' {
    const side = raw.team_side || raw.side || raw.team_type || '';
    if (side === 'home') return 'home';
    if (side === 'away') return 'away';
    // Try by team ID match
    return raw.is_home ? 'home' : 'away';
  }

  private normalizeStats(matchId: string, raw: any): MatchStats | null {
    if (!raw) return null;
    const items = raw?.data || raw?.stats || raw?.results || [];
    if (!Array.isArray(items)) return { matchId, stats: [] };

    const stats: StatCategory[] = items.map((s: any) => ({
      name: s.name || s.stat_name || s.type || '',
      home: s.home ?? s.home_value ?? s.value_home ?? 0,
      away: s.away ?? s.away_value ?? s.value_away ?? 0,
    }));

    return { matchId, stats };
  }

  private normalizeLineups(matchId: string, raw: any): MatchLineups | null {
    if (!raw) return null;

    const homePlayers = this.normalizeLineupPlayers(raw.home_players || raw.homePlayers || raw.home?.players || [], true);
    const awayPlayers = this.normalizeLineupPlayers(raw.away_players || raw.awayPlayers || raw.away?.players || [], false);

    return {
      matchId,
      homeFormation: raw.home_formation || raw.homeFormation || raw.home?.formation || undefined,
      awayFormation: raw.away_formation || raw.awayFormation || raw.away?.formation || undefined,
      homePlayers,
      awayPlayers,
    };
  }

  private normalizeLineupPlayers(players: any[], isHome: boolean): LineupPlayer[] {
    if (!Array.isArray(players)) return [];
    return players.map((p: any) => ({
      id: p.id || p.player_id || p.playerId || `p_${isHome ? 'h' : 'a'}_${p.shirt_number || p.shirtNumber || Math.random()}`,
      name: p.name || p.player_name || p.playerName || 'Unknown',
      position: p.position || p.position_name || p.role || '',
      shirtNumber: p.shirt_number || p.shirtNumber || p.number || undefined,
      isStarter: p.is_starter ?? p.isStarter ?? p.starting ?? true,
      rating: p.rating ?? p.match_rating ?? undefined,
    }));
  }

  private normalizeStandings(raw: any): StandingEntry[] {
    const items = this.extractStandingItems(raw);
    return items.map((entry, index) => this.normalizeStandingEntry(entry, index + 1));
  }

  private extractStandingItems(raw: any): any[] {
    const candidates = [
      raw?.data,
      raw?.standings,
      raw?.table,
      raw?.results,
      raw?.data?.standings,
      raw?.data?.table,
      raw?.data?.results,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return this.flattenStandingGroups(candidate);
    }

    return [];
  }

  private flattenStandingGroups(items: any[]): any[] {
    return items.flatMap((item) => {
      const groupRows = item?.standings || item?.table || item?.teams || item?.rows;
      if (Array.isArray(groupRows)) {
        return groupRows.map((row: any) => ({
          ...row,
          group: row.group || row.group_name || item.group || item.group_name || item.name,
        }));
      }
      return item;
    });
  }

  private normalizeStandingEntry(raw: any, position: number): StandingEntry {
    const team = this.normalizeTeam(raw.team || raw.team_info || raw);
    return {
      position: this.toNumber(raw.position ?? raw.rank ?? raw.pos, position),
      team,
      played: this.toNumber(raw.played ?? raw.matches_played ?? raw.games ?? raw.p, 0),
      won: this.toNumber(raw.won ?? raw.wins ?? raw.w, 0),
      drawn: this.toNumber(raw.drawn ?? raw.draws ?? raw.d, 0),
      lost: this.toNumber(raw.lost ?? raw.losses ?? raw.l, 0),
      goalsFor: this.toNumber(raw.goals_for ?? raw.goalsFor ?? raw.gf, 0),
      goalsAgainst: this.toNumber(raw.goals_against ?? raw.goalsAgainst ?? raw.ga, 0),
      goalDifference: this.toNumber(raw.goal_difference ?? raw.goalDifference ?? raw.gd, 0),
      points: this.toNumber(raw.points ?? raw.pts, 0),
      group: raw.group || raw.group_name || raw.standing_group || undefined,
      form: raw.form || undefined,
    };
  }

  private toNumber(value: any, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}

export const fapiClient = new FapiClient();
export default FapiClient;
