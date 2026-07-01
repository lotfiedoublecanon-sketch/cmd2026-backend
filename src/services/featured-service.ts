import {
  ApiResponse,
  MatchStatus,
  NormalizedMatch,
  WidgetMatch,
} from '../types';
import { mergeService } from './merge-service';
import { widgetService } from './widget-service';

const LIVE_STATUSES = new Set<MatchStatus>([
  'in_progress',
  'halftime',
  'extra_time',
  'penalties',
]);

const DELAY_OR_SUSPENSION_STATUSES = new Set<MatchStatus>([
  'delayed',
  'kickoff_delayed',
  'weather_delay',
  'suspended',
  'interrupted',
  'awaiting_kickoff',
]);

const IMPORTANT_STAGE_PATTERN = /(?:final|semi|quarter|round of|knockout|play[ -]?off|third place|last 16|last 32|1\/8|1\/4|1\/2)/i;
const PLAYER_TO_CONFIRM = 'à confirmer';
const GENERIC_COLORS: FeaturedTeamColors = { home: '#176b4d', away: '#c8a447' };
const TEAM_COLOR_PALETTE = [
  '#176b4d',
  '#b7353e',
  '#245b9e',
  '#c47720',
  '#6f4c9b',
  '#00838f',
  '#8a5a2b',
  '#455a64',
] as const;

export type FeaturedSelectionReason =
  | 'confirmed-live'
  | 'today-delay-or-suspension'
  | 'today-scheduled'
  | 'next-upcoming'
  | 'last-important-finished'
  | 'generic';

export interface FeaturedTeamColors {
  home: string;
  away: string;
}

export interface FeaturedPlayers {
  home: string;
  away: string;
}

export interface FeaturedMatch {
  success: true;
  reason: 'live' | 'delayed' | 'today' | 'upcoming' | 'finished' | 'generic';
  selectionReason: FeaturedSelectionReason;
  match: WidgetMatch | null;
  teamColors: FeaturedTeamColors;
  featuredPlayers: FeaturedPlayers;
  newKickoff: string | null;
  delayReason: string | null;
  restartEtaMinutes: number | null;
  sourceUsed: string;
  lastUpdatedAt: string;
}

interface MatchSource {
  match: NormalizedMatch;
  sourceUsed: string;
  lastUpdatedAt: string;
}

export interface FeaturedSelectionInput {
  live?: ApiResponse<NormalizedMatch[]>;
  today?: ApiResponse<NormalizedMatch[]>;
  upcoming?: ApiResponse<NormalizedMatch[]>;
  now?: Date;
}

export class FeaturedService {
  private stickyFeatured: FeaturedMatch | null = null;

  async getFeatured(): Promise<FeaturedMatch> {
    const [live, today, upcoming] = await Promise.allSettled([
      mergeService.getLiveMatches(),
      mergeService.getTodayMatches(),
      mergeService.getUpcomingMatches(60),
    ]);

    const input: FeaturedSelectionInput = {
      live: live.status === 'fulfilled' ? live.value : undefined,
      today: today.status === 'fulfilled' ? today.value : undefined,
      upcoming: upcoming.status === 'fulfilled' ? upcoming.value : undefined,
    };
    return this.stabilizeFeatured(this.selectFeatured(input), input);
  }

  async getFeaturedMatch(): Promise<FeaturedMatch> {
    return this.getFeatured();
  }

  selectFeatured(input: FeaturedSelectionInput): FeaturedMatch {
    const now = input.now || new Date();
    const fallbackUpdatedAt = now.toISOString();
    const live = this.matchesFrom(input.live, fallbackUpdatedAt);
    const today = this.matchesFrom(input.today, fallbackUpdatedAt);
    const upcoming = this.matchesFrom(input.upcoming, fallbackUpdatedAt);
    const allMatches = this.uniqueMatches([...live, ...today, ...upcoming]);

    const confirmedLive = this.sortByKickoff(
      allMatches.filter(({ match }) => LIVE_STATUSES.has(match.status))
    )[0];
    if (confirmedLive) return this.toFeatured(confirmedLive, 'confirmed-live');

    const todayDelayOrSuspension = this.sortByKickoff(
      allMatches.filter(
        ({ match }) => DELAY_OR_SUSPENSION_STATUSES.has(match.status)
          && this.isParisToday(match, now)
      )
    )[0];
    if (todayDelayOrSuspension) {
      return this.toFeatured(todayDelayOrSuspension, 'today-delay-or-suspension');
    }

    const todayScheduled = this.sortByKickoff(
      allMatches.filter(
        ({ match }) => this.isFutureScheduled(match, now) && this.isParisToday(match, now)
      )
    )[0];
    if (todayScheduled) return this.toFeatured(todayScheduled, 'today-scheduled');

    const nextUpcoming = this.sortByKickoff(
      upcoming.filter(({ match }) => this.isFutureScheduled(match, now))
    )[0];
    if (nextUpcoming) return this.toFeatured(nextUpcoming, 'next-upcoming');

    const lastImportantFinished = this.sortByKickoff(
      allMatches.filter(({ match }) => match.status === 'finished'),
      true
    )[0];
    if (lastImportantFinished) {
      return this.toFeatured(lastImportantFinished, 'last-important-finished');
    }

    return {
      success: true,
      reason: 'generic',
      selectionReason: 'generic',
      match: null,
      teamColors: GENERIC_COLORS,
      featuredPlayers: this.unconfirmedPlayers(),
      newKickoff: null,
      delayReason: null,
      restartEtaMinutes: null,
      sourceUsed: this.fallbackSource(input),
      lastUpdatedAt: this.latestUpdate(input) || now.toISOString(),
    };
  }

  selectFeaturedMatch(input: FeaturedSelectionInput): FeaturedMatch {
    return this.selectFeatured(input);
  }

  private toFeatured(candidate: MatchSource, selectionReason: FeaturedSelectionReason): FeaturedMatch {
    const match = widgetService.normalizeMatch(
      candidate.match,
      candidate.sourceUsed,
      candidate.lastUpdatedAt
    );
    return {
      success: true,
      reason: this.publicReason(selectionReason),
      selectionReason,
      match,
      teamColors: this.teamColors(candidate.match),
      featuredPlayers: this.unconfirmedPlayers(),
      newKickoff: match.newKickoff,
      delayReason: match.delayReason,
      restartEtaMinutes: match.restartEtaMinutes,
      sourceUsed: candidate.match.sourceUsed || candidate.match.source || candidate.sourceUsed,
      lastUpdatedAt: candidate.lastUpdatedAt,
    };
  }

  private matchesFrom(
    response: ApiResponse<NormalizedMatch[]> | undefined,
    fallbackUpdatedAt: string
  ): MatchSource[] {
    if (!response || !Array.isArray(response.data)) return [];
    const sourceUsed = response.sourceUsed || response.source;
    const lastUpdatedAt = this.responseUpdate(response) || fallbackUpdatedAt;
    return response.data.map((match) => ({ match, sourceUsed, lastUpdatedAt }));
  }

  private isFutureScheduled(match: NormalizedMatch, now: Date): boolean {
    if (match.status !== 'scheduled') return false;
    const kickoff = new Date(match.startDateTimeUtc).getTime();
    return Number.isFinite(kickoff) && kickoff >= now.getTime();
  }

  private isParisToday(match: NormalizedMatch, now: Date): boolean {
    const kickoff = new Date(match.startDateTimeUtc);
    if (!Number.isFinite(kickoff.getTime())) return false;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(kickoff) === formatter.format(now);
  }

  private isImportant(match: NormalizedMatch): boolean {
    const importance = [match.stage, match.round, match.group]
      .filter((value) => value !== undefined && value !== null)
      .join(' ');
    return IMPORTANT_STAGE_PATTERN.test(importance);
  }

  private sortByKickoff(matches: MatchSource[], descending = false): MatchSource[] {
    const direction = descending ? -1 : 1;
    return [...matches].sort((a, b) => {
      const timeDifference = this.kickoffTime(a.match) - this.kickoffTime(b.match);
      if (timeDifference !== 0) return direction * timeDifference;
      return this.stableMatchKey(a.match).localeCompare(this.stableMatchKey(b.match), 'en');
    });
  }

  private uniqueMatches(matches: MatchSource[]): MatchSource[] {
    const seen = new Set<string>();
    return matches.filter(({ match }) => {
      const key = this.stableMatchKey(match);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private stableMatchKey(match: NormalizedMatch): string {
    return [
      match.id,
      match.startDateTimeUtc,
      match.homeTeam.threeCharCode || match.homeTeam.name,
      match.awayTeam.threeCharCode || match.awayTeam.name,
    ].join('|');
  }

  private kickoffTime(match: NormalizedMatch): number {
    const value = new Date(match.startDateTimeUtc).getTime();
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

  private teamColors(match: NormalizedMatch): FeaturedTeamColors {
    const homeIndex = this.colorIndex(
      match.homeTeam.threeCharCode || match.homeTeam.shortName || match.homeTeam.name
    );
    let awayIndex = this.colorIndex(
      match.awayTeam.threeCharCode || match.awayTeam.shortName || match.awayTeam.name
    );
    if (awayIndex === homeIndex) awayIndex = (awayIndex + 1) % TEAM_COLOR_PALETTE.length;
    return { home: TEAM_COLOR_PALETTE[homeIndex], away: TEAM_COLOR_PALETTE[awayIndex] };
  }

  private colorIndex(value: string): number {
    let hash = 0;
    for (const character of value.trim().toUpperCase()) {
      hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    }
    return hash % TEAM_COLOR_PALETTE.length;
  }

  private unconfirmedPlayers(): FeaturedPlayers {
    return { home: PLAYER_TO_CONFIRM, away: PLAYER_TO_CONFIRM };
  }

  private stabilizeFeatured(
    selected: FeaturedMatch,
    input: FeaturedSelectionInput
  ): FeaturedMatch {
    const sticky = this.stickyFeatured;
    if (sticky?.match && sticky.match.id !== selected.match?.id) {
      const current = this.findCurrentMatch(sticky.match.id, input);
      if (current) {
        if (LIVE_STATUSES.has(current.match.status) || DELAY_OR_SUSPENSION_STATUSES.has(current.match.status)) {
          const reason: FeaturedSelectionReason = LIVE_STATUSES.has(current.match.status)
            ? 'confirmed-live'
            : 'today-delay-or-suspension';
          const refreshed = this.toFeatured(current, reason);
          this.stickyFeatured = refreshed;
          return refreshed;
        }
      } else if (this.isRecentSticky(sticky)) {
        return sticky;
      }
    }

    if (
      selected.match
      && (LIVE_STATUSES.has(this.normalizedStatus(selected.match.status))
        || DELAY_OR_SUSPENSION_STATUSES.has(this.normalizedStatus(selected.match.status)))
    ) {
      this.stickyFeatured = selected;
    } else {
      this.stickyFeatured = null;
    }
    return selected;
  }

  private findCurrentMatch(id: string, input: FeaturedSelectionInput): MatchSource | null {
    const fallbackUpdatedAt = new Date().toISOString();
    return this.uniqueMatches([
      ...this.matchesFrom(input.live, fallbackUpdatedAt),
      ...this.matchesFrom(input.today, fallbackUpdatedAt),
      ...this.matchesFrom(input.upcoming, fallbackUpdatedAt),
    ]).find(({ match }) => match.id === id) || null;
  }

  private isRecentSticky(featured: FeaturedMatch): boolean {
    const updatedAt = new Date(featured.lastUpdatedAt).getTime();
    return Number.isFinite(updatedAt) && Date.now() - updatedAt < 6 * 60 * 60 * 1000;
  }

  private normalizedStatus(status: WidgetMatch['status']): MatchStatus {
    const mapping: Partial<Record<WidgetMatch['status'], MatchStatus>> = {
      LIVE: 'in_progress', HALF_TIME: 'halftime', EXTRA_TIME: 'extra_time', PENALTIES: 'penalties',
      DELAYED: 'delayed', KICKOFF_DELAYED: 'kickoff_delayed', WEATHER_DELAY: 'weather_delay',
      SUSPENDED: 'suspended', INTERRUPTED: 'interrupted', AWAITING_KICKOFF: 'awaiting_kickoff',
    };
    return mapping[status] || 'unknown';
  }

  private publicReason(
    reason: FeaturedSelectionReason
  ): FeaturedMatch['reason'] {
    switch (reason) {
      case 'confirmed-live': return 'live';
      case 'today-delay-or-suspension': return 'delayed';
      case 'today-scheduled': return 'today';
      case 'next-upcoming': return 'upcoming';
      case 'last-important-finished': return 'finished';
      default: return 'generic';
    }
  }

  private fallbackSource(input: FeaturedSelectionInput): string {
    return input.live?.sourceUsed
      || input.live?.source
      || input.today?.sourceUsed
      || input.today?.source
      || input.upcoming?.sourceUsed
      || input.upcoming?.source
      || 'backend';
  }

  private latestUpdate(input: FeaturedSelectionInput): string | undefined {
    return [input.live, input.today, input.upcoming]
      .map((response) => response && this.responseUpdate(response))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
  }

  private responseUpdate(response: ApiResponse<unknown>): string | undefined {
    return response.updatedAt || response.cache?.updatedAt || response.cachedAt;
  }
}

export const featuredService = new FeaturedService();
export default FeaturedService;
