import { mergeService } from './merge-service';
import {
  ApiResponse,
  MatchEvent,
  MatchStatus,
  NormalizedMatch,
  WidgetLiveDataStatus,
  WidgetMatch,
  WidgetMatchStatus,
  WidgetResponse,
  WidgetStatusItem,
} from '../types';

const LIVE_STATUSES = new Set<MatchStatus>([
  'in_progress',
  'halftime',
  'extra_time',
  'penalties',
]);

const UNCONFIRMED_STATUSES = new Set<MatchStatus>(['scheduled', 'unknown']);

interface MatchNormalizationOptions {
  markPassedKickoffAsWaiting?: boolean;
  now?: Date;
}

export class WidgetService {
  async getLive(): Promise<WidgetResponse<WidgetMatch>> {
    const result = await mergeService.getLiveMatches();
    return this.matchResponse(result);
  }

  async getToday(): Promise<WidgetResponse<WidgetMatch>> {
    const result = await mergeService.getTodayMatches();
    return this.matchResponse(result, { markPassedKickoffAsWaiting: true });
  }

  async getUpcoming(days = 7): Promise<WidgetResponse<WidgetMatch>> {
    const result = await mergeService.getUpcomingMatches(days);
    return this.matchResponse(result);
  }

  async getStatus(): Promise<WidgetResponse<WidgetStatusItem>> {
    const [live, today, upcoming] = await Promise.all([
      this.getLive(),
      this.getToday(),
      this.getUpcoming(60),
    ]);
    const usableSource = [live, today, upcoming].find(
      (response) => response.sourceUsed !== 'backend' || response.items.length > 0
    );
    const status = usableSource ? 'OK' : 'DEGRADED';
    const lastUpdatedAt = [live.lastUpdatedAt, today.lastUpdatedAt, upcoming.lastUpdatedAt]
      .sort()
      .at(-1) || new Date().toISOString();
    const item: WidgetStatusItem = {
      status,
      sourceUsed: usableSource?.sourceUsed || 'backend',
      lastUpdatedAt,
      liveDataStatus: live.liveDataStatus === 'live'
        ? 'live'
        : today.liveDataStatus === 'waiting'
          ? 'waiting'
          : usableSource?.liveDataStatus || 'unavailable',
      counts: {
        live: live.items.length,
        today: today.items.length,
        upcoming: upcoming.items.length,
      },
    };

    return {
      success: live.success && today.success && upcoming.success,
      items: [item],
      sourceUsed: item.sourceUsed,
      lastUpdatedAt,
      liveDataStatus: item.liveDataStatus,
    };
  }

  async getEvents(matchId: string): Promise<WidgetResponse<MatchEvent>> {
    const result = await mergeService.getMatchEvents(matchId);
    const lastUpdatedAt = this.lastUpdatedAt(result);
    const items = Array.isArray(result.data) ? result.data : [];
    return {
      success: result.success,
      items,
      sourceUsed: this.sourceUsed(result),
      lastUpdatedAt,
      liveDataStatus: items.length > 0 ? 'available' : 'unavailable',
      ...(result.error ? { error: result.error } : {}),
    };
  }

  normalizeMatch(
    match: NormalizedMatch,
    sourceUsed: string,
    lastUpdatedAt: string,
    options: MatchNormalizationOptions = {}
  ): WidgetMatch {
    const waiting = this.isAwaitingLiveData(match, options);
    const status = waiting ? 'AWAITING_LIVE_DATA' : this.widgetStatus(match.status);

    return {
      id: String(match.id),
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      homeTeamCode: this.teamCode(match.homeTeam.threeCharCode, match.homeTeam.shortName),
      awayTeamCode: this.teamCode(match.awayTeam.threeCharCode, match.awayTeam.shortName),
      homeScore: waiting ? null : this.nullableNumber(match.homeScore),
      awayScore: waiting ? null : this.nullableNumber(match.awayScore),
      status,
      minute: waiting ? null : this.nullableNumber(match.minute),
      kickoff: this.validDate(match.startDateTimeUtc),
      group: match.group ? String(match.group) : null,
      sourceUsed: match.sourceUsed || match.source || sourceUsed,
      lastUpdatedAt,
      liveDataStatus: waiting ? 'waiting' : this.matchDataStatus(match.status),
    };
  }

  private matchResponse(
    result: ApiResponse<NormalizedMatch[]>,
    options: MatchNormalizationOptions = {}
  ): WidgetResponse<WidgetMatch> {
    const sourceUsed = this.sourceUsed(result);
    const lastUpdatedAt = this.lastUpdatedAt(result);
    const items = (Array.isArray(result.data) ? result.data : []).map((match) =>
      this.normalizeMatch(match, sourceUsed, lastUpdatedAt, options)
    );

    return {
      success: result.success,
      items,
      sourceUsed,
      lastUpdatedAt,
      liveDataStatus: this.responseDataStatus(items),
      ...(result.error ? { error: result.error } : {}),
    };
  }

  private isAwaitingLiveData(
    match: NormalizedMatch,
    options: MatchNormalizationOptions
  ): boolean {
    if (!options.markPassedKickoffAsWaiting) return false;
    if (!UNCONFIRMED_STATUSES.has(match.status)) return false;

    const kickoff = new Date(match.startDateTimeUtc);
    if (!Number.isFinite(kickoff.getTime())) return false;
    return kickoff.getTime() <= (options.now || new Date()).getTime();
  }

  private matchDataStatus(status: MatchStatus): WidgetLiveDataStatus {
    if (LIVE_STATUSES.has(status)) return 'live';
    if (status === 'finished') return 'final';
    if (status === 'scheduled') return 'scheduled';
    return 'unavailable';
  }

  private widgetStatus(status: MatchStatus): WidgetMatchStatus {
    switch (status) {
      case 'in_progress':
      case 'extra_time':
      case 'penalties':
        return 'LIVE';
      case 'halftime':
        return 'HALF_TIME';
      case 'scheduled':
        return 'SCHEDULED';
      case 'finished':
        return 'FINISHED';
      case 'postponed':
        return 'POSTPONED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return 'UNKNOWN';
    }
  }

  private responseDataStatus(items: WidgetMatch[]): WidgetLiveDataStatus {
    if (items.some((item) => item.liveDataStatus === 'live')) return 'live';
    if (items.some((item) => item.liveDataStatus === 'waiting')) return 'waiting';
    if (items.some((item) => item.liveDataStatus === 'scheduled')) return 'scheduled';
    if (items.length > 0 && items.every((item) => item.liveDataStatus === 'final')) return 'final';
    return 'unavailable';
  }

  private sourceUsed<T>(result: ApiResponse<T>): string {
    return result.sourceUsed || result.source;
  }

  private lastUpdatedAt<T>(result: ApiResponse<T>): string {
    return result.updatedAt || result.cache?.updatedAt || result.cachedAt || new Date().toISOString();
  }

  private nullableNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private validDate(value: string): string | null {
    if (!value) return null;
    return Number.isFinite(new Date(value).getTime()) ? value : null;
  }

  private teamCode(primary?: string, fallback?: string): string | null {
    const code = primary || fallback;
    if (!code || code.toUpperCase() === 'TBD') return null;
    return code.toUpperCase();
  }
}

export const widgetService = new WidgetService();
