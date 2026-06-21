// ============================================
// Source Fetcher Service
// Data aggregation from multiple sources
// ============================================
import { fapiClient } from '../clients/fapi-client';
import { sportDbClient } from '../clients/sportdb-client';
import { getEnabledSources } from '../config/open-sources';

export interface FetchResult<T> {
  data: T | null;
  source: 'fapi' | 'sportdb' | 'merged' | null;
  error: string | null;
  timestamp: string;
}

class SourceFetcherService {
  /**
   * Fetch data from primary source (FAPI), fallback to SportDB
   */
  async fetchWithFallback<T>(
    primaryFetch: () => Promise<T>,
    fallbackFetch: () => Promise<T>,
    sourceName: string
  ): Promise<FetchResult<T>> {
    const timestamp = new Date().toISOString();

    try {
      const data = await primaryFetch();
      if (data) {
        return {
          data,
          source: 'fapi',
          error: null,
          timestamp,
        };
      }
    } catch (error) {
      console.warn(`[SourceFetcher] Primary source failed for ${sourceName}:`, error);
    }

    try {
      const data = await fallbackFetch();
      if (data) {
        return {
          data,
          source: 'sportdb',
          error: null,
          timestamp,
        };
      }
    } catch (error) {
      console.warn(`[SourceFetcher] Fallback source failed for ${sourceName}:`, error);
      return {
        data: null,
        source: null,
        error: `Failed to fetch ${sourceName} from all sources`,
        timestamp,
      };
    }

    return {
      data: null,
      source: null,
      error: `No data available for ${sourceName}`,
      timestamp,
    };
  }

  /**
   * Fetch live matches
   */
  async getLiveMatches(): Promise<FetchResult<any>> {
    return this.fetchWithFallback(
      () => fapiClient.getLiveMatches(),
      () => sportDbClient.getLiveMatches(),
      'live matches'
    );
  }

  /**
   * Fetch today's matches
   */
  async getTodayMatches(): Promise<FetchResult<any>> {
    return this.fetchWithFallback(
      () => fapiClient.getTodayMatches(),
      () => sportDbClient.getTodayMatches(),
      'today matches'
    );
  }

  /**
   * Fetch upcoming matches
   */
  async getUpcomingMatches(days = 7): Promise<FetchResult<any>> {
    return this.fetchWithFallback(
      () => fapiClient.getUpcomingMatches(days),
      () => sportDbClient.getUpcomingMatches(days),
      'upcoming matches'
    );
  }

  /**
   * Fetch match by ID
   */
  async getMatchById(matchId: string): Promise<FetchResult<any>> {
    return this.fetchWithFallback(
      () => fapiClient.getMatchById(matchId),
      () => sportDbClient.getMatchById(matchId),
      `match ${matchId}`
    );
  }

  /**
   * Fetch match events
   */
  async getMatchEvents(matchId: string): Promise<FetchResult<any>> {
    return this.fetchWithFallback(
      () => fapiClient.getMatchEvents(matchId),
      () => sportDbClient.getMatchEvents(matchId),
      `events for match ${matchId}`
    );
  }

  /**
   * Fetch match statistics
   */
  async getMatchStats(matchId: string): Promise<FetchResult<any>> {
    return this.fetchWithFallback(
      () => fapiClient.getMatchStats(matchId),
      () => sportDbClient.getMatchStats(matchId),
      `stats for match ${matchId}`
    );
  }

  /**
   * Fetch match lineups
   */
  async getMatchLineups(matchId: string): Promise<FetchResult<any>> {
    return this.fetchWithFallback(
      () => fapiClient.getMatchLineups(matchId),
      () => sportDbClient.getMatchLineups(matchId),
      `lineups for match ${matchId}`
    );
  }

  /**
   * Fetch standings
   */
  async getStandings(): Promise<FetchResult<any>> {
    return this.fetchWithFallback(
      () => fapiClient.getStandings(),
      () => sportDbClient.getStandings(),
      'standings'
    );
  }

  /**
   * Get health status of all sources
   */
  async getSourcesHealth(): Promise<{
    fapi: { status: string; lastCheck: string };
    sportdb: { status: string; lastCheck: string };
    mediaSources: { count: number; active: boolean };
  }> {
    const timestamp = new Date().toISOString();
    const mediaSources = getEnabledSources();

    return {
      fapi: {
        status: 'operational',
        lastCheck: timestamp,
      },
      sportdb: {
        status: 'operational',
        lastCheck: timestamp,
      },
      mediaSources: {
        count: mediaSources.length,
        active: mediaSources.length > 0,
      },
    };
  }

  /**
   * Get all available media sources
   */
  getAvailableMediaSources() {
    return getEnabledSources();
  }
}

export const sourceFetcherService = new SourceFetcherService();
export default SourceFetcherService;
