// ============================================
// Merge Service - Intelligent FAPI + SportDB fusion
// ============================================
import { fapiClient } from '../clients/fapi-client';
import { sportDbClient } from '../clients/sportdb-client';
import {
  NormalizedMatch, MatchEvent, MatchStats,
  MatchLineups, ApiResponse, StandingEntry
} from '../types';

class MergeService {

  /**
   * Get live matches: FAPI primary, SportDB fallback
   */
  async getLiveMatches(): Promise<ApiResponse<NormalizedMatch[]>> {
    try {
      const fapiMatches = await fapiClient.getLiveMatches();
      if (fapiMatches.length > 0) {
        return { success: true, data: fapiMatches, source: 'fapi' };
      }
    } catch (e) {
      console.warn('[Merge] FAPI live failed, falling back to SportDB:', (e as Error).message);
    }

    try {
      const sportDbMatches = await sportDbClient.getLiveMatches();
      if (sportDbMatches.length > 0) {
        return { success: true, data: sportDbMatches, source: 'sportdb' };
      }
    } catch (e) {
      console.warn('[Merge] SportDB live also failed:', (e as Error).message);
    }

    return { success: true, data: [], source: 'fapi' };
  }

  /**
   * Get today's matches: FAPI primary, SportDB fallback, optionally merged
   */
  async getTodayMatches(): Promise<ApiResponse<NormalizedMatch[]>> {
    let fapiMatches: NormalizedMatch[] = [];
    let sportDbMatches: NormalizedMatch[] = [];
    let source: 'fapi' | 'sportdb' | 'merged' = 'fapi';

    try {
      fapiMatches = await fapiClient.getTodayMatches();
    } catch (e) {
      console.warn('[Merge] FAPI today failed:', (e as Error).message);
    }

    try {
      sportDbMatches = await sportDbClient.getTodayMatches();
    } catch (e) {
      console.warn('[Merge] SportDB today failed:', (e as Error).message);
    }

    if (fapiMatches.length > 0 && sportDbMatches.length > 0) {
      const merged = this.mergeMatchLists(fapiMatches, sportDbMatches);
      return { success: true, data: merged, source: 'merged' };
    }

    if (fapiMatches.length > 0) {
      return { success: true, data: fapiMatches, source: 'fapi' };
    }

    if (sportDbMatches.length > 0) {
      return { success: true, data: sportDbMatches, source: 'sportdb' };
    }

    return { success: true, data: [], source: 'fapi' };
  }

  /**
   * Get upcoming matches
   */
  async getUpcomingMatches(days = 7): Promise<ApiResponse<NormalizedMatch[]>> {
    try {
      const fapiMatches = await fapiClient.getUpcomingMatches(days);
      if (fapiMatches.length > 0) {
        return { success: true, data: fapiMatches, source: 'fapi' };
      }
    } catch (e) {
      console.warn('[Merge] FAPI upcoming failed:', (e as Error).message);
    }

    try {
      const sportDbMatches = await sportDbClient.getUpcomingMatches(days);
      return { success: true, data: sportDbMatches, source: 'sportdb' };
    } catch (e) {
      console.warn('[Merge] SportDB upcoming also failed:', (e as Error).message);
    }

    return { success: true, data: [], source: 'fapi' };
  }

  /**
   * Get match detail by ID
   */
  async getMatchById(matchId: string): Promise<ApiResponse<NormalizedMatch | null>> {
    // Try FAPI first
    try {
      const match = await fapiClient.getMatchById(matchId);
      if (match) return { success: true, data: match, source: 'fapi' };
    } catch (e) {
      console.warn('[Merge] FAPI match detail failed:', (e as Error).message);
    }

    // Fall back to SportDB
    try {
      const match = await sportDbClient.getMatchById(matchId);
      if (match) return { success: true, data: match, source: 'sportdb' };
    } catch (e) {
      console.warn('[Merge] SportDB match detail failed:', (e as Error).message);
    }

    return { success: false, data: null, source: 'fapi', error: 'Match not found in any source' };
  }

  /**
   * Get match events (timeline)
   */
  async getMatchEvents(matchId: string): Promise<ApiResponse<MatchEvent[]>> {
    try {
      const events = await fapiClient.getMatchEvents(matchId);
      if (events.length > 0) {
        return { success: true, data: events, source: 'fapi' };
      }
    } catch (e) {
      console.warn('[Merge] FAPI events failed:', (e as Error).message);
    }

    try {
      const events = await sportDbClient.getMatchEvents(matchId);
      return { success: true, data: events, source: 'sportdb' };
    } catch (e) {
      console.warn('[Merge] SportDB events failed:', (e as Error).message);
    }

    return { success: true, data: [], source: 'fapi' };
  }

  /**
   * Get match statistics
   */
  async getMatchStats(matchId: string): Promise<ApiResponse<MatchStats | null>> {
    try {
      const stats = await fapiClient.getMatchStats(matchId);
      if (stats) return { success: true, data: stats, source: 'fapi' };
    } catch (e) {
      console.warn('[Merge] FAPI stats failed:', (e as Error).message);
    }

    return { success: true, data: null, source: 'fapi', error: 'Stats not available' };
  }

  /**
   * Get match lineups
   */
  async getMatchLineups(matchId: string): Promise<ApiResponse<MatchLineups | null>> {
    try {
      const lineups = await fapiClient.getMatchLineups(matchId);
      if (lineups && (lineups.homePlayers.length > 0 || lineups.awayPlayers.length > 0)) {
        return { success: true, data: lineups, source: 'fapi' };
      }
    } catch (e) {
      console.warn('[Merge] FAPI lineups failed:', (e as Error).message);
    }

    try {
      const lineups = await sportDbClient.getMatchLineups(matchId);
      if (lineups) return { success: true, data: lineups, source: 'sportdb' };
    } catch (e) {
      console.warn('[Merge] SportDB lineups failed:', (e as Error).message);
    }

    return { success: true, data: null, source: 'fapi', error: 'Lineups not available' };
  }

  /**
   * Get standings
   */
  async getStandings(): Promise<ApiResponse<StandingEntry[]>> {
    try {
      const data = await fapiClient.getStandings();
      if (data) return { success: true, data: data as any, source: 'fapi' };
    } catch (e) {
      console.warn('[Merge] FAPI standings failed:', (e as Error).message);
    }

    try {
      const standings = await sportDbClient.getStandings();
      return { success: true, data: standings, source: 'sportdb' };
    } catch (e) {
      console.warn('[Merge] SportDB standings failed:', (e as Error).message);
    }

    return { success: true, data: [], source: 'fapi' };
  }

  /**
   * Merge two match lists: FAPI matches take priority,
   * SportDB fills in matches that FAPI doesn't have
   */
  private mergeMatchLists(fapiMatches: NormalizedMatch[], sportDbMatches: NormalizedMatch[]): NormalizedMatch[] {
    const merged = new Map<string, NormalizedMatch>();

    // Add all FAPI matches
    for (const m of fapiMatches) {
      merged.set(m.id, { ...m, source: 'merged' });
    }

    // Add SportDB matches not already present (by team name matching)
    for (const sdb of sportDbMatches) {
      if (merged.has(sdb.id)) continue;

      // Try to find by team names
      const existing = fapiMatches.find(fm =>
        this.teamsMatch(fm.homeTeam.name, sdb.homeTeam.name) &&
        this.teamsMatch(fm.awayTeam.name, sdb.awayTeam.name)
      );

      if (!existing) {
        merged.set(sdb.id, { ...sdb, source: 'merged' });
      } else {
        // Merge: FAPI data wins, but enrich with SportDB data
        const enriched = { ...existing, source: 'merged' as const };
        // Use SportDB data for fields FAPI doesn't have
        if (!enriched.venue && sdb.venue) enriched.venue = sdb.venue;
        if (!enriched.referee && sdb.referee) enriched.referee = sdb.referee;
        if (!enriched.homeTeam.logoUrl && sdb.homeTeam.logoUrl) enriched.homeTeam.logoUrl = sdb.homeTeam.logoUrl;
        if (!enriched.awayTeam.logoUrl && sdb.awayTeam.logoUrl) enriched.awayTeam.logoUrl = sdb.awayTeam.logoUrl;
        merged.set(existing.id, enriched);
      }
    }

    return Array.from(merged.values()).sort((a, b) => {
      // Sort: in_progress first, then by start time
      if (a.isInProgress && !b.isInProgress) return -1;
      if (!a.isInProgress && b.isInProgress) return 1;
      return new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime();
    });
  }

  private teamsMatch(name1: string, name2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    return normalize(name1).includes(normalize(name2)) || normalize(name2).includes(normalize(name1));
  }
}

export const mergeService = new MergeService();
export default MergeService;
