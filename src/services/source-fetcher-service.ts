// ============================================
// Source registry and health service
// ============================================
import { getEnabledSources } from '../config/open-sources';
import { worldCup2026TourClient } from '../clients/worldcup2026-tour-client';
import { whenIsKickoffClient } from '../clients/wheniskickoff-client';
import { openFootballClient } from '../clients/openfootball-client';
import { fapiClient } from '../clients/fapi-client';
import { sportDbClient } from '../clients/sportdb-client';
import { serverCache } from './server-cache';
import { hasConfigValue } from '../utils/env';

export interface PublicSourceInfo {
  id: string;
  name: string;
  type: string;
  role: string;
  enabled: boolean;
  requiresKey: boolean;
  categories: string[];
}

class SourceFetcherService {
  getBackendSources(): PublicSourceInfo[] {
    return [
      {
        id: 'fapi',
        name: 'FAPI / TheStatsAPI',
        type: 'sports-data',
        role: 'primary-live',
        enabled: hasConfigValue('FAPI_API_KEY', 'THESTATSAPI_KEY'),
        requiresKey: true,
        categories: ['scores', 'live', 'matchs', 'events', 'stats', 'lineups', 'classements'],
      },
      {
        id: 'worldcup2026-tour',
        name: 'World Cup 2026 Tour Public API',
        type: 'public-api',
        role: 'primary-calendar',
        enabled: true,
        requiresKey: false,
        categories: ['matchs', 'calendrier', 'today', 'upcoming', 'next'],
      },
      {
        id: 'wheniskickoff',
        name: 'When Is Kickoff',
        type: 'public-json',
        role: 'calendar-groups-tv',
        enabled: true,
        requiresKey: false,
        categories: ['matchs', 'groupes', 'classements', 'equipes', 'stades', 'chaines-tv'],
      },
      {
        id: 'openfootball',
        name: 'OpenFootball worldcup.json',
        type: 'open-data',
        role: 'fallback-calendar',
        enabled: true,
        requiresKey: false,
        categories: ['matchs', 'scores', 'fallback'],
      },
      {
        id: 'sportdb',
        name: 'TheSportsDB / SportDB',
        type: 'sports-data',
        role: 'secondary-live-fallback',
        enabled: hasConfigValue('SPORTDB_API_KEY'),
        requiresKey: true,
        categories: ['scores', 'live', 'matchs', 'classements'],
      },
      {
        id: 'gemini',
        name: 'Gemini AI',
        type: 'ai',
        role: 'analysis-agents',
        enabled: hasConfigValue('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'GOOGLE_API_KEY'),
        requiresKey: true,
        categories: ['resume', 'analyse', 'notifications', 'medias'],
      },
    ];
  }

  getAvailableMediaSources() {
    return getEnabledSources();
  }

  async getSourcesHealth() {
    const checkedAt = new Date().toISOString();
    const health = await Promise.all([
      hasConfigValue('FAPI_API_KEY', 'THESTATSAPI_KEY')
        ? this.safeHealth('FAPI / TheStatsAPI', 'api', async () => {
          const data = await fapiClient.getUpcomingMatches(7);
          return data.length;
        })
        : Promise.resolve(this.disabledHealth('FAPI / TheStatsAPI', 'api')),
      this.safeHealth('World Cup 2026 Tour', 'public-api', async () => {
        const result = await worldCup2026TourClient.health();
        return result.itemCount;
      }),
      this.safeHealth('When Is Kickoff', 'public-json', async () => {
        const result = await whenIsKickoffClient.health();
        return result.itemCount;
      }),
      this.safeHealth('OpenFootball', 'open-data', async () => {
        const result = await openFootballClient.health();
        return result.itemCount;
      }),
      hasConfigValue('SPORTDB_API_KEY')
        ? this.safeHealth('SportDB', 'api', async () => {
          const data = await sportDbClient.getUpcomingMatches(7);
          return data.length;
        })
        : Promise.resolve(this.disabledHealth('SportDB', 'api')),
      Promise.resolve({
        name: 'Gemini',
        status: hasConfigValue('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'GOOGLE_API_KEY') ? 'OK' : 'desactive',
        itemCount: 0,
        lastCheck: checkedAt,
        sourceType: 'ai',
      }),
    ]);

    return {
      checkedAt,
      sources: health,
      cache: serverCache.snapshot(),
      mediaSources: {
        count: getEnabledSources().length,
        active: getEnabledSources().length > 0,
      },
    };
  }

  private async safeHealth(name: string, sourceType: string, probe: () => Promise<number>) {
    const lastCheck = new Date().toISOString();
    try {
      const itemCount = await probe();
      return {
        name,
        status: 'OK',
        itemCount,
        lastCheck,
        sourceType,
      };
    } catch (error) {
      return {
        name,
        status: 'erreur',
        itemCount: 0,
        lastCheck,
        sourceType,
        error: this.safeError(error),
      };
    }
  }

  private disabledHealth(name: string, sourceType: string) {
    return {
      name,
      status: 'desactive',
      itemCount: 0,
      lastCheck: new Date().toISOString(),
      sourceType,
    };
  }

  private safeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export const sourceFetcherService = new SourceFetcherService();
export default SourceFetcherService;
