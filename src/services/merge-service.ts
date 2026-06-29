// ============================================
// Merge Service - FAPI live + public schedule sources + cache
// ============================================
import { fapiClient } from '../clients/fapi-client';
import { sportDbClient } from '../clients/sportdb-client';
import { worldCup2026TourClient } from '../clients/worldcup2026-tour-client';
import { whenIsKickoffClient } from '../clients/wheniskickoff-client';
import { openFootballClient } from '../clients/openfootball-client';
import { serverCache, CacheInfo } from './server-cache';
import {
  NormalizedMatch, MatchEvent, MatchStats,
  MatchLineups, ApiResponse, StandingEntry, SourceName
} from '../types';
import {
  filterToday as filterTourToday,
  filterUpcoming as filterTourUpcoming,
  mapWorldCupTourMatch,
} from '../mappers/worldcup2026-tour-mapper';
import {
  filterWhenIsKickoffToday,
  filterWhenIsKickoffUpcoming,
  mapWhenIsKickoffMatch,
  mapWhenIsKickoffStandings,
} from '../mappers/wheniskickoff-mapper';
import { mapOpenFootballMatch } from '../mappers/openfootball-mapper';
import { hasConfigValue } from '../utils/env';

const TTL = {
  live: 30_000,
  today: 10 * 60_000,
  upcoming: 6 * 60 * 60_000,
  standings: 30 * 60_000,
};

class MergeService {
  async getLiveMatches(): Promise<ApiResponse<NormalizedMatch[]>> {
    return this.withCache('matches:live', TTL.live, () => this.fetchLiveMatches());
  }

  async getTodayMatches(): Promise<ApiResponse<NormalizedMatch[]>> {
    const cacheKey = `matches:today:${this.dateKey(new Date())}`;
    return this.withCache(cacheKey, TTL.today, () => this.fetchTodayMatches());
  }

  async getUpcomingMatches(days = 7): Promise<ApiResponse<NormalizedMatch[]>> {
    return this.withCache(`matches:upcoming:${days}`, TTL.upcoming, () => this.fetchUpcomingMatches(days));
  }

  async getMatchById(matchId: string): Promise<ApiResponse<NormalizedMatch | null>> {
    if (matchId.startsWith('wctour-')) {
      const id = matchId.replace('wctour-', '');
      const match = mapWorldCupTourMatch(await worldCup2026TourClient.getMatchById(id));
      if (match) return this.response(match, 'worldcup2026-tour');
    }

    if (matchId.startsWith('wik-')) {
      const matches = (await whenIsKickoffClient.getMatches())
        .map(mapWhenIsKickoffMatch)
        .filter(Boolean) as NormalizedMatch[];
      const match = matches.find((candidate) => candidate.id === matchId) || null;
      if (match) return this.response(match, 'wheniskickoff');
    }

    if (matchId.startsWith('openfootball-')) {
      const index = Number(matchId.replace('openfootball-', '')) - 1;
      const rawMatches = await openFootballClient.getMatches();
      const match = Number.isFinite(index) ? mapOpenFootballMatch(rawMatches[index], index) : null;
      if (match) return this.response(match, 'openfootball');
    }

    if (this.fapiAvailable()) try {
      const match = await fapiClient.getMatchById(matchId);
      if (match) return this.response(match, 'fapi');
    } catch (e) {
      console.warn('[Merge] FAPI match detail failed:', this.safeError(e));
    }

    if (this.sportDbAvailable()) try {
      const match = await sportDbClient.getMatchById(matchId);
      if (match) return this.response(match, 'sportdb');
    } catch (e) {
      console.warn('[Merge] SportDB match detail failed:', this.safeError(e));
    }

    return { success: false, data: null, source: 'backend', sourceUsed: 'backend', error: 'Match not found in any source' };
  }

  async getMatchEvents(matchId: string): Promise<ApiResponse<MatchEvent[]>> {
    if (this.fapiAvailable()) try {
      const events = await fapiClient.getMatchEvents(matchId);
      if (events.length > 0) return this.response(events, 'fapi');
    } catch (e) {
      console.warn('[Merge] FAPI events failed:', this.safeError(e));
    }

    if (this.sportDbAvailable()) try {
      const events = await sportDbClient.getMatchEvents(matchId);
      return this.response(events, 'sportdb');
    } catch (e) {
      console.warn('[Merge] SportDB events failed:', this.safeError(e));
    }

    return this.response([], 'backend');
  }

  async getMatchStats(matchId: string): Promise<ApiResponse<MatchStats | null>> {
    if (this.fapiAvailable()) try {
      const stats = await fapiClient.getMatchStats(matchId);
      if (stats) return this.response(stats, 'fapi');
    } catch (e) {
      console.warn('[Merge] FAPI stats failed:', this.safeError(e));
    }

    if (this.sportDbAvailable()) try {
      const stats = await sportDbClient.getMatchStats(matchId);
      if (stats) return this.response(stats, 'sportdb');
    } catch (e) {
      console.warn('[Merge] SportDB stats failed:', this.safeError(e));
    }

    return { success: true, data: null, source: 'backend', sourceUsed: 'backend', error: 'Stats not available' };
  }

  async getMatchLineups(matchId: string): Promise<ApiResponse<MatchLineups | null>> {
    if (this.fapiAvailable()) try {
      const lineups = await fapiClient.getMatchLineups(matchId);
      if (lineups && (lineups.homePlayers.length > 0 || lineups.awayPlayers.length > 0)) {
        return this.response(lineups, 'fapi');
      }
    } catch (e) {
      console.warn('[Merge] FAPI lineups failed:', this.safeError(e));
    }

    if (this.sportDbAvailable()) try {
      const lineups = await sportDbClient.getMatchLineups(matchId);
      if (lineups) return this.response(lineups, 'sportdb');
    } catch (e) {
      console.warn('[Merge] SportDB lineups failed:', this.safeError(e));
    }

    return { success: true, data: null, source: 'backend', sourceUsed: 'backend', error: 'Lineups not available' };
  }

  async getStandings(): Promise<ApiResponse<StandingEntry[]>> {
    return this.withCache('matches:standings', TTL.standings, () => this.fetchStandings());
  }

  private async fetchLiveMatches(): Promise<ApiResponse<NormalizedMatch[]>> {
    let confirmedEmptySource: SourceName | null = null;
    let hasConfiguredSource = false;

    if (this.fapiAvailable()) try {
      hasConfiguredSource = true;
      const result = await fapiClient.getLiveMatches();
      if (result.matches.length > 0) return this.response(result.matches, 'fapi');
      if (result.requestSucceeded) confirmedEmptySource = 'fapi';
    } catch (e) {
      console.warn('[Merge] FAPI live failed:', this.safeError(e));
    }

    if (this.sportDbAvailable()) try {
      hasConfiguredSource = true;
      const result = await sportDbClient.getLiveMatches();
      if (result.matches.length > 0) return this.response(result.matches, 'sportdb');
      if (result.requestSucceeded && !confirmedEmptySource) confirmedEmptySource = 'sportdb';
    } catch (e) {
      console.warn('[Merge] SportDB live failed:', this.safeError(e));
    }

    if (confirmedEmptySource) return this.response([], confirmedEmptySource);

    return {
      success: false,
      data: [],
      source: 'backend',
      sourceUsed: 'backend',
      error: hasConfiguredSource ? 'No live source request succeeded' : 'No live source configured',
    };
  }

  private async fetchTodayMatches(): Promise<ApiResponse<NormalizedMatch[]>> {
    if (this.fapiAvailable()) try {
      const fapiMatches = await fapiClient.getTodayMatches();
      if (fapiMatches.length > 0) return this.response(fapiMatches, 'fapi');
    } catch (e) {
      console.warn('[Merge] FAPI today failed:', this.safeError(e));
    }

    try {
      const tourToday = (await worldCup2026TourClient.getToday())
        .map(mapWorldCupTourMatch)
        .filter(Boolean) as NormalizedMatch[];
      if (tourToday.length > 0) return this.response(tourToday, 'worldcup2026-tour');
    } catch (e) {
      console.warn('[Merge] World Cup Tour today failed:', this.safeError(e));
    }

    try {
      const tourMatches = (await worldCup2026TourClient.getMatches())
        .map(mapWorldCupTourMatch)
        .filter(Boolean) as NormalizedMatch[];
      const today = filterTourToday(tourMatches);
      if (today.length > 0) return this.response(today, 'worldcup2026-tour');
    } catch (e) {
      console.warn('[Merge] World Cup Tour matches filter failed:', this.safeError(e));
    }

    try {
      const wikMatches = (await whenIsKickoffClient.getMatches())
        .map(mapWhenIsKickoffMatch)
        .filter(Boolean) as NormalizedMatch[];
      const today = filterWhenIsKickoffToday(wikMatches);
      if (today.length > 0) return this.response(today, 'wheniskickoff');
    } catch (e) {
      console.warn('[Merge] When Is Kickoff today failed:', this.safeError(e));
    }

    if (this.sportDbAvailable()) try {
      const sportDbMatches = await sportDbClient.getTodayMatches();
      if (sportDbMatches.length > 0) return this.response(sportDbMatches, 'sportdb');
    } catch (e) {
      console.warn('[Merge] SportDB today failed:', this.safeError(e));
    }

    return this.response([], 'backend');
  }

  private async fetchUpcomingMatches(days: number): Promise<ApiResponse<NormalizedMatch[]>> {
    if (this.fapiAvailable()) try {
      const fapiMatches = await fapiClient.getUpcomingMatches(days);
      if (fapiMatches.length > 0) return this.response(fapiMatches, 'fapi');
    } catch (e) {
      console.warn('[Merge] FAPI upcoming failed:', this.safeError(e));
    }

    try {
      const tourMatches = (await worldCup2026TourClient.getMatches())
        .map(mapWorldCupTourMatch)
        .filter(Boolean) as NormalizedMatch[];
      const upcoming = filterTourUpcoming(tourMatches, days);
      if (upcoming.length > 0) return this.response(upcoming, 'worldcup2026-tour');
    } catch (e) {
      console.warn('[Merge] World Cup Tour upcoming failed:', this.safeError(e));
    }

    try {
      const wikMatches = (await whenIsKickoffClient.getMatches())
        .map(mapWhenIsKickoffMatch)
        .filter(Boolean) as NormalizedMatch[];
      const upcoming = filterWhenIsKickoffUpcoming(wikMatches, days);
      if (upcoming.length > 0) return this.response(upcoming, 'wheniskickoff');
    } catch (e) {
      console.warn('[Merge] When Is Kickoff upcoming failed:', this.safeError(e));
    }

    try {
      const rawMatches = await openFootballClient.getMatches();
      const openFootballMatches = rawMatches
        .map(mapOpenFootballMatch)
        .filter(Boolean) as NormalizedMatch[];
      const upcoming = filterWhenIsKickoffUpcoming(openFootballMatches, days);
      if (upcoming.length > 0) return this.response(upcoming, 'openfootball');
    } catch (e) {
      console.warn('[Merge] OpenFootball upcoming failed:', this.safeError(e));
    }

    if (this.sportDbAvailable()) try {
      const sportDbMatches = await sportDbClient.getUpcomingMatches(days);
      if (sportDbMatches.length > 0) return this.response(sportDbMatches, 'sportdb');
    } catch (e) {
      console.warn('[Merge] SportDB upcoming failed:', this.safeError(e));
    }

    return this.response([], 'backend');
  }

  private async fetchStandings(): Promise<ApiResponse<StandingEntry[]>> {
    if (this.fapiAvailable()) try {
      const data = await fapiClient.getStandings();
      if (data.length > 0) return this.response(data, 'fapi');
    } catch (e) {
      console.warn('[Merge] FAPI standings failed:', this.safeError(e));
    }

    try {
      const [groups, teams, matches] = await Promise.all([
        whenIsKickoffClient.getGroups(),
        whenIsKickoffClient.getTeams(),
        whenIsKickoffClient.getMatches(),
      ]);
      const standings = mapWhenIsKickoffStandings(groups, teams, matches);
      const groupCount = new Set(standings.map((entry) => entry.group)).size;
      if (standings.length > 0 && groupCount >= 12) return this.response(standings, 'wheniskickoff');
    } catch (e) {
      console.warn('[Merge] When Is Kickoff standings failed:', this.safeError(e));
    }

    if (this.sportDbAvailable()) try {
      const standings = await sportDbClient.getStandings();
      if (standings.length > 0) return this.response(standings, 'sportdb');
    } catch (e) {
      console.warn('[Merge] SportDB standings failed:', this.safeError(e));
    }

    return this.response([], 'backend');
  }

  private async withCache<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<ApiResponse<T>>
  ): Promise<ApiResponse<T>> {
    const cached = await serverCache.getOrFetch<ApiResponse<T>>(key, ttlMs, fetcher);
    return {
      ...cached.value,
      cache: cached.info,
      cachedAt: cached.info.updatedAt,
      updatedAt: cached.info.updatedAt || cached.value.updatedAt || new Date().toISOString(),
    };
  }

  private response<T>(data: T, source: SourceName, cache?: CacheInfo): ApiResponse<T> {
    return {
      success: true,
      data,
      source,
      sourceUsed: source,
      ...(cache ? { cache, cachedAt: cache.updatedAt } : {}),
    };
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private fapiAvailable(): boolean {
    return hasConfigValue('FAPI_API_KEY', 'THESTATSAPI_KEY');
  }

  private sportDbAvailable(): boolean {
    return hasConfigValue('SPORTDB_API_KEY');
  }

  private safeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export const mergeService = new MergeService();
export default MergeService;
