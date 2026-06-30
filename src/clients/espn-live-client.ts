import axios, { AxiosInstance } from 'axios';
import {
  LiveMatchesResult,
  MatchEvent,
  MatchStats,
  MatchStatus,
  NormalizedMatch,
  StatCategory,
  TeamInfo,
  TimelineEventType,
} from '../types';

const ESPN_BASE_URL = process.env.ESPN_SOCCER_BASE_URL?.trim()
  || 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_WORLD_CUP_LEAGUE = process.env.ESPN_WORLD_CUP_LEAGUE?.trim()
  || 'fifa.world';
const ESPN_TIMEOUT = Number.parseInt(process.env.ESPN_TIMEOUT_MS || '8000', 10);

export class EspnLiveClient {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ESPN_BASE_URL,
      timeout: Number.isFinite(ESPN_TIMEOUT) ? ESPN_TIMEOUT : 8000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CDM2026-Live-Backend/5.0',
      },
    });
  }

  async getLiveMatches(): Promise<LiveMatchesResult> {
    try {
      const now = new Date();
      const events = await this.getScoreboard(
        new Date(now.getTime() - 24 * 60 * 60 * 1000),
        new Date(now.getTime() + 24 * 60 * 60 * 1000)
      );
      const matches = events
        .map((event: unknown) => this.normalizeMatch(event))
        .filter((match: NormalizedMatch | null): match is NormalizedMatch => Boolean(match))
        .filter((match) => match.isInProgress);

      return { matches: this.dedupe(matches), requestSucceeded: true };
    } catch (error) {
      this.warn('live', error);
      return { matches: [], requestSucceeded: false };
    }
  }

  async getTodayMatches(): Promise<NormalizedMatch[]> {
    try {
      const now = new Date();
      const events = await this.getScoreboard(
        new Date(now.getTime() - 24 * 60 * 60 * 1000),
        new Date(now.getTime() + 24 * 60 * 60 * 1000)
      );
      const today = this.parisDateKey(now);
      return events
        .map((event: any) => ({ event, match: this.normalizeMatch(event) }))
        .filter((item): item is { event: any; match: NormalizedMatch } => Boolean(item.match))
        .filter(({ event, match }) => this.belongsToParisDay(event, match, today))
        .map(({ match }) => match)
        .sort((a, b) => new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime());
    } catch (error) {
      this.warn('today', error);
      return [];
    }
  }

  async getUpcomingMatches(days: number): Promise<NormalizedMatch[]> {
    try {
      const now = new Date();
      const events = await this.getScoreboard(
        now,
        new Date(now.getTime() + Math.max(1, days) * 24 * 60 * 60 * 1000)
      );
      return events
        .map((event: unknown) => this.normalizeMatch(event))
        .filter((match: NormalizedMatch | null): match is NormalizedMatch => Boolean(match))
        .filter((match) => match.status === 'scheduled')
        .filter((match) => new Date(match.startDateTimeUtc).getTime() > now.getTime())
        .sort((a, b) => new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime());
    } catch (error) {
      this.warn('upcoming', error);
      return [];
    }
  }

  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    try {
      const summary = await this.getSummary(matchId);
      const plays = Array.isArray(summary?.keyEvents)
        ? summary.keyEvents
        : Array.isArray(summary?.plays) ? summary.plays : [];
      const competitors = summary?.header?.competitions?.[0]?.competitors || [];
      const homeId = String(competitors.find((team: any) => team?.homeAway === 'home')?.team?.id || '');

      return plays
        .map((play: any) => this.normalizeEvent(matchId, play, homeId))
        .filter((event: MatchEvent | null): event is MatchEvent => Boolean(event));
    } catch (error) {
      this.warn('events', error);
      return [];
    }
  }

  async getMatchStats(matchId: string): Promise<MatchStats | null> {
    try {
      const summary = await this.getSummary(matchId);
      const competitors = summary?.boxscore?.teams;
      if (!Array.isArray(competitors)) return null;

      const home = competitors.find((team: any) => team?.homeAway === 'home');
      const away = competitors.find((team: any) => team?.homeAway === 'away');
      if (!home || !away) return null;

      const categories: Array<[string, string]> = [
        ['totalShots', 'Tirs'],
        ['shotsOnTarget', 'Tirs cadrés'],
        ['possessionPct', 'Possession (%)'],
        ['wonCorners', 'Corners'],
        ['foulsCommitted', 'Fautes'],
        ['offsides', 'Hors-jeu'],
      ];
      const stats = categories
        .map(([key, label]) => this.statCategory(label, key, home.statistics, away.statistics))
        .filter((item: StatCategory | null): item is StatCategory => Boolean(item));

      return { matchId, stats };
    } catch (error) {
      this.warn('stats', error);
      return null;
    }
  }

  normalizeMatch(raw: any): NormalizedMatch | null {
    if (!raw?.id || !Array.isArray(raw?.competitions) || raw.competitions.length === 0) {
      return null;
    }

    const competition = raw.competitions[0];
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const homeRaw = competitors.find((item: any) => item?.homeAway === 'home');
    const awayRaw = competitors.find((item: any) => item?.homeAway === 'away');
    if (!homeRaw?.team || !awayRaw?.team) return null;

    const statusBlock = raw.status || competition?.status || {};
    const status = this.mapStatus(statusBlock.type, statusBlock.period);
    const live = ['in_progress', 'halftime', 'extra_time', 'penalties'].includes(status);
    const homeScore = this.score(homeRaw.score);
    const awayScore = this.score(awayRaw.score);
    if (live && (homeScore === null || awayScore === null)) return null;

    const homePenaltyScore = this.score(homeRaw.shootoutScore);
    const awayPenaltyScore = this.score(awayRaw.shootoutScore);

    return {
      id: `espn-${raw.id}`,
      source: 'espn-public',
      sourceUsed: 'espn-public',
      competitionId: String(raw.league?.id || competition?.league?.id || ESPN_WORLD_CUP_LEAGUE),
      competitionName: String(raw.league?.name || competition?.league?.name || 'FIFA World Cup 2026'),
      seasonName: String(raw.season?.year || '2026'),
      stage: String(competition?.type?.text || raw.season?.slug || ''),
      round: competition?.round?.displayName || competition?.round?.number || undefined,
      homeTeam: this.normalizeTeam(homeRaw.team),
      awayTeam: this.normalizeTeam(awayRaw.team),
      status,
      period: this.period(status, statusBlock.period),
      minute: live ? this.minute(statusBlock.displayClock) : undefined,
      startDateTimeUtc: this.utcDate(raw.date || competition?.date),
      homeScore,
      awayScore,
      homeScorePenalty: homePenaltyScore ?? undefined,
      awayScorePenalty: awayPenaltyScore ?? undefined,
      winner: homeRaw.winner === true ? 'home' : awayRaw.winner === true ? 'away' : undefined,
      isFinished: status === 'finished',
      isInProgress: live,
      venue: competition?.venue?.fullName || undefined,
    };
  }

  private mapStatus(type: any, period?: unknown): MatchStatus {
    const name = String(type?.name || '').trim().toUpperCase();
    const detail = String(type?.shortDetail || type?.detail || type?.description || '')
      .trim()
      .toUpperCase();
    const state = String(type?.state || '').trim().toLowerCase();

    if (state === 'post' || type?.completed === true || name.includes('FINAL')) return 'finished';
    if (name.includes('POSTPON')) return 'postponed';
    if (name.includes('CANCEL')) return 'cancelled';
    if (name.includes('HALFTIME') || ['HT', 'HALF TIME', 'HALFTIME'].includes(detail)) {
      return 'halftime';
    }
    if (name.includes('PENAL') || detail.includes('PEN') || Number(period) === 5) return 'penalties';
    if (name.includes('EXTRA') || detail.includes('EXTRA TIME') || [3, 4].includes(Number(period))) {
      return 'extra_time';
    }
    if (state === 'in' || name.includes('IN_PROGRESS') || name.includes('LIVE')) {
      return 'in_progress';
    }
    if (state === 'pre') return 'scheduled';
    return 'unknown';
  }

  private period(status: MatchStatus, value: unknown) {
    if (status === 'halftime') return 'halftime' as const;
    if (status === 'extra_time') return Number(value) >= 4 ? 'extra_time_2' as const : 'extra_time_1' as const;
    if (status === 'penalties') return 'penalty_shootout' as const;
    if (status === 'finished') return 'full_time' as const;
    return undefined;
  }

  private normalizeTeam(raw: any): TeamInfo {
    const code = String(raw?.abbreviation || raw?.shortDisplayName || 'TBD').toUpperCase();
    const rawName = String(raw?.displayName || raw?.name || '');
    const displayName = rawName === 'Congo DR' ? 'DR Congo' : rawName;
    const unresolved = code === 'TBD' || /\b(TBD|winner|loser|place)\b/i.test(rawName);
    return {
      id: String(raw?.id || ''),
      name: unresolved ? 'À déterminer' : (displayName || 'À déterminer'),
      shortName: unresolved ? 'TBD' : code,
      threeCharCode: unresolved ? 'TBD' : code,
      logoUrl: unresolved ? undefined : raw?.logo || undefined,
    };
  }

  private normalizeEvent(matchId: string, raw: any, homeTeamId: string): MatchEvent | null {
    if (!raw?.id || !raw?.type) return null;
    const type = this.eventType(raw);
    if (type === 'unknown') return null;
    const teamId = String(raw?.team?.id || '');
    const participants = Array.isArray(raw?.participants) ? raw.participants : [];

    return {
      id: String(raw.id),
      matchId,
      type,
      minute: this.minute(raw?.clock?.displayValue) || 0,
      period: raw?.period?.number ? String(raw.period.number) : undefined,
      team: teamId && teamId === homeTeamId ? 'home' : 'away',
      playerId: participants[0]?.athlete?.id ? String(participants[0].athlete.id) : undefined,
      playerName: participants[0]?.athlete?.displayName || undefined,
      assistPlayerId: raw.scoringPlay && participants[1]?.athlete?.id
        ? String(participants[1].athlete.id)
        : undefined,
      assistPlayerName: raw.scoringPlay ? participants[1]?.athlete?.displayName || undefined : undefined,
      description: raw.text || raw.shortText || undefined,
    };
  }

  private eventType(raw: any): TimelineEventType {
    const value = String(raw?.type?.type || raw?.type?.text || '').toLowerCase();
    if (raw?.shootout === true) return raw?.scoringPlay === true ? 'penalty_goal' : 'penalty_missed';
    if (raw?.scoringPlay === true || value.includes('goal')) return 'goal';
    if (value.includes('second-yellow')) return 'second_yellow_card';
    if (value.includes('yellow')) return 'yellow_card';
    if (value.includes('red')) return 'red_card';
    if (value.includes('substitution')) return 'substitution';
    return 'unknown';
  }

  private statCategory(
    label: string,
    key: string,
    homeStats: unknown,
    awayStats: unknown
  ): StatCategory | null {
    const home = this.statValue(homeStats, key);
    const away = this.statValue(awayStats, key);
    return home !== null && away !== null ? { name: label, home, away } : null;
  }

  private statValue(stats: unknown, key: string): string | null {
    if (!Array.isArray(stats)) return null;
    const item = stats.find((stat: any) => stat?.name === key);
    const value = item?.displayValue;
    return value === null || value === undefined || value === '' ? null : String(value);
  }

  private score(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private minute(value: unknown): number | undefined {
    const match = String(value || '').match(/\d+/);
    if (!match) return undefined;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private utcDate(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  private async getScoreboard(start: Date, end: Date): Promise<any[]> {
    const response = await this.client.get(`/${ESPN_WORLD_CUP_LEAGUE}/scoreboard`, {
      params: {
        dates: `${this.dateKey(start)}-${this.dateKey(end)}`,
        limit: 200,
      },
    });
    return Array.isArray(response.data?.events) ? response.data.events : [];
  }

  private async getSummary(matchId: string): Promise<any> {
    const eventId = matchId.replace(/^espn-/, '');
    if (!/^\d+$/.test(eventId)) throw new Error('Invalid ESPN match id');
    const response = await this.client.get(`/${ESPN_WORLD_CUP_LEAGUE}/summary`, {
      params: { event: eventId },
    });
    return response.data;
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private parisDateKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private belongsToParisDay(raw: any, match: NormalizedMatch, today: string): boolean {
    const kickoff = new Date(match.startDateTimeUtc);
    if (!Number.isFinite(kickoff.getTime())) return false;
    if (this.parisDateKey(kickoff) === today) return true;

    const period = Number(raw?.status?.period || raw?.competitions?.[0]?.status?.period);
    if (match.status !== 'finished' || period < 4) return false;

    const minimumExtraTimeEnd = new Date(kickoff.getTime() + 120 * 60_000);
    return this.parisDateKey(minimumExtraTimeEnd) === today;
  }

  private warn(context: string, error: unknown): void {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    console.warn(`[ESPN public] ${context} request failed${status ? ` (${status})` : ''}`);
  }

  private dedupe(matches: NormalizedMatch[]): NormalizedMatch[] {
    return Array.from(new Map(matches.map((match) => [match.id, match])).values());
  }
}

export const espnLiveClient = new EspnLiveClient();
