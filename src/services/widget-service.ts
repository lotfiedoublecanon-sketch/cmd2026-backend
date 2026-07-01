import { mergeService } from './merge-service';
import {
  ApiResponse,
  MatchEvent,
  MatchStatus,
  NormalizedMatch,
  StatCategory,
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

const NON_SCORING_STATUSES = new Set<MatchStatus>([
  'scheduled',
  'unknown',
  'cancelled',
  'postponed',
  'delayed',
  'kickoff_delayed',
  'weather_delay',
  'awaiting_kickoff',
]);

const DELAY_STATUSES = new Set<MatchStatus>([
  'delayed',
  'kickoff_delayed',
  'weather_delay',
  'awaiting_kickoff',
]);

const SUSPENDED_STATUSES = new Set<MatchStatus>(['suspended', 'interrupted']);

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
    const status = live.success && today.success && upcoming.success ? 'OK' : 'DEGRADED';
    const lastUpdatedAt = [live.lastUpdatedAt, today.lastUpdatedAt, upcoming.lastUpdatedAt]
      .sort()
      .at(-1) || new Date().toISOString();
    const item: WidgetStatusItem = {
      status,
      sourceUsed: live.sourceUsed,
      lastUpdatedAt,
      liveDataStatus: live.liveDataStatus,
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

  async getStats(matchId: string): Promise<WidgetResponse<StatCategory>> {
    const result = await mergeService.getMatchStats(matchId);
    const lastUpdatedAt = this.lastUpdatedAt(result);
    const items = Array.isArray(result.data?.stats) ? result.data.stats : [];
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
    const scoresHidden = waiting || NON_SCORING_STATUSES.has(match.status);
    const status = waiting ? 'AWAITING_LIVE_DATA' : this.widgetStatus(match.status);
    const winner = this.validatedWinner(match);

    return {
      id: String(match.id),
      homeTeamName: this.teamName(match.homeTeam.name),
      awayTeamName: this.teamName(match.awayTeam.name),
      homeTeamCode: this.teamCode(match.homeTeam.threeCharCode, match.homeTeam.shortName),
      awayTeamCode: this.teamCode(match.awayTeam.threeCharCode, match.awayTeam.shortName),
      homeScore: scoresHidden ? null : this.nullableNumber(match.homeScore),
      awayScore: scoresHidden ? null : this.nullableNumber(match.awayScore),
      homePenaltyScore: scoresHidden ? null : this.nullableNumber(match.homeScorePenalty),
      awayPenaltyScore: scoresHidden ? null : this.nullableNumber(match.awayScorePenalty),
      winnerTeamName: winner === 'home'
        ? this.teamName(match.homeTeam.name)
        : winner === 'away'
          ? this.teamName(match.awayTeam.name)
          : null,
      status,
      minute: scoresHidden ? null : this.nullableNumber(match.minute),
      kickoff: this.validDate(match.startDateTimeUtc),
      newKickoff: this.validDate(match.newKickoff),
      delayReason: this.nullableText(match.delayReason),
      restartEtaMinutes: this.nonNegativeNumber(match.restartEtaMinutes),
      group: match.group ? String(match.group) : null,
      stage: match.stage ? String(match.stage) : null,
      venue: match.venue ? String(match.venue) : null,
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
    if (SUSPENDED_STATUSES.has(status)) return 'suspended';
    if (DELAY_STATUSES.has(status)) return 'delayed';
    if (status === 'finished') return 'final';
    if (status === 'scheduled') return 'scheduled';
    return 'unavailable';
  }

  private widgetStatus(status: MatchStatus): WidgetMatchStatus {
    switch (status) {
      case 'in_progress':
        return 'LIVE';
      case 'extra_time':
        return 'EXTRA_TIME';
      case 'penalties':
        return 'PENALTIES';
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
      case 'delayed':
        return 'DELAYED';
      case 'kickoff_delayed':
        return 'KICKOFF_DELAYED';
      case 'weather_delay':
        return 'WEATHER_DELAY';
      case 'suspended':
        return 'SUSPENDED';
      case 'interrupted':
        return 'INTERRUPTED';
      case 'awaiting_kickoff':
        return 'AWAITING_KICKOFF';
      default:
        return 'UNKNOWN';
    }
  }

  private responseDataStatus(items: WidgetMatch[]): WidgetLiveDataStatus {
    if (items.some((item) => item.liveDataStatus === 'live')) return 'live';
    if (items.some((item) => item.liveDataStatus === 'suspended')) return 'suspended';
    if (items.some((item) => item.liveDataStatus === 'delayed')) return 'delayed';
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

  private nonNegativeNumber(value: number | null | undefined): number | null {
    const number = this.nullableNumber(value);
    return number !== null && number >= 0 ? number : null;
  }

  private nullableText(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private validDate(value: string | null | undefined): string | null {
    if (!value) return null;
    return Number.isFinite(new Date(value).getTime()) ? value : null;
  }

  private validatedWinner(match: NormalizedMatch): 'home' | 'away' | undefined {
    if (match.status !== 'finished' || (match.winner !== 'home' && match.winner !== 'away')) {
      return undefined;
    }

    const homePenaltyScore = this.nullableNumber(match.homeScorePenalty);
    const awayPenaltyScore = this.nullableNumber(match.awayScorePenalty);
    if (
      homePenaltyScore !== null
      && awayPenaltyScore !== null
      && homePenaltyScore !== awayPenaltyScore
    ) {
      const penaltyWinner = homePenaltyScore > awayPenaltyScore ? 'home' : 'away';
      return match.winner === penaltyWinner ? match.winner : undefined;
    }

    const homeScore = this.nullableNumber(match.homeScore);
    const awayScore = this.nullableNumber(match.awayScore);
    if (homeScore === null || awayScore === null || homeScore === awayScore) return undefined;
    const regulationWinner = homeScore > awayScore ? 'home' : 'away';
    return match.winner === regulationWinner ? match.winner : undefined;
  }

  private teamCode(primary?: string, fallback?: string): string | null {
    const code = primary || fallback;
    if (!code || code.toUpperCase() === 'TBD') return null;
    return code.toUpperCase();
  }

  private teamName(value?: string): string {
    const name = value?.trim();
    return !name || /^(TBD|Unknown)$/i.test(name) ? 'À déterminer' : name;
  }
}

export const widgetService = new WidgetService();
