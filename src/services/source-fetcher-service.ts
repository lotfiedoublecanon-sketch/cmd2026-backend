// ============================================
// Source registry and health service
// ============================================
import axios, { AxiosError } from 'axios';
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

export interface MediaItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  link: string;
  sourceUrl: string;
  source_url: string;
  canonicalUrl: string;
  source: string;
  sourceType: string;
  publishedAt: string;
  category: string;
  team: string | null;
  confidence: number;
  language: string;
}

export interface MediaFetchResponse {
  success: true;
  items: MediaItem[];
  source: string;
  sourceUsed: string;
  updatedAt: string;
  message?: string;
  cache?: unknown;
  articles?: MediaItem[];
  videos?: MediaItem[];
}

type MediaCategory = 'articles' | 'news' | 'videos' | 'interviews' | 'injuries' | 'training';

const EMPTY_SOURCE_MESSAGE = 'Aucune donnée source disponible pour le moment';
const MEDIA_TTL_MS = 15 * 60_000;

class SourceFetcherService {
  async fetchArticles(): Promise<MediaFetchResponse> {
    return this.fetchMediaCategory('articles');
  }

  async fetchNews(): Promise<MediaFetchResponse> {
    return this.fetchMediaCategory('news');
  }

  async fetchVideos(): Promise<MediaFetchResponse> {
    return this.fetchMediaCategory('videos');
  }

  async fetchInterviews(): Promise<MediaFetchResponse> {
    return this.fetchMediaCategory('interviews');
  }

  async fetchInjuries(): Promise<MediaFetchResponse> {
    return this.fetchMediaCategory('injuries');
  }

  async fetchTraining(): Promise<MediaFetchResponse> {
    return this.fetchMediaCategory('training');
  }

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

  private async fetchMediaCategory(category: MediaCategory): Promise<MediaFetchResponse> {
    const cacheKey = `media:${category}`;
    const cached = await serverCache.getOrFetch(cacheKey, MEDIA_TTL_MS, async () => {
      const items = await this.fetchFreshMedia(category);
      return this.mediaResponse(category, items, 'public-media');
    });

    return {
      ...cached.value,
      cache: cached.info,
      updatedAt: new Date().toISOString(),
    };
  }

  private async fetchFreshMedia(category: MediaCategory): Promise<MediaItem[]> {
    const queries = this.queriesForCategory(category);
    const batches = await Promise.allSettled([
      this.fetchGoogleNewsRss(queries.googleNews, category),
      this.fetchGdelt(queries.gdelt, category),
      category === 'videos' ? this.fetchYouTubeRss(category) : Promise.resolve([]),
    ]);

    const items = batches.flatMap((batch) => batch.status === 'fulfilled' ? batch.value : []);
    return this.dedupeMedia(items).slice(0, 30);
  }

  private mediaResponse(category: MediaCategory, items: MediaItem[], sourceUsed: string): MediaFetchResponse {
    const response: MediaFetchResponse = {
      success: true,
      items,
      source: sourceUsed,
      sourceUsed,
      updatedAt: new Date().toISOString(),
      ...(items.length === 0 ? { message: EMPTY_SOURCE_MESSAGE } : {}),
    };

    if (category === 'articles') response.articles = items;
    if (category === 'videos') response.videos = items;

    return response;
  }

  private queriesForCategory(category: MediaCategory) {
    const base = 'Coupe du Monde 2026 football';
    const terms: Record<MediaCategory, string> = {
      articles: base,
      news: base,
      videos: `${base} vidéos highlights`,
      interviews: `${base} interview joueur sélection`,
      injuries: `${base} blessures joueurs sélection`,
      training: `${base} entraînement sélection`,
    };
    return {
      googleNews: terms[category],
      gdelt: terms[category],
    };
  }

  private async fetchGoogleNewsRss(query: string, category: MediaCategory): Promise<MediaItem[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`;
    try {
      const response = await axios.get<string>(url, {
        timeout: 8000,
        responseType: 'text',
        headers: { Accept: 'application/rss+xml,text/xml' },
      });
      return this.parseRssItems(response.data, 'Google News RSS', 'rss', category);
    } catch (error) {
      console.warn('[SourceFetcher] Google News RSS failed:', this.safePublicError(error));
      return [];
    }
  }

  private async fetchYouTubeRss(category: MediaCategory): Promise<MediaItem[]> {
    const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCpcTrCXblq78GZrTUTLWeBw';
    try {
      const response = await axios.get<string>(url, {
        timeout: 8000,
        responseType: 'text',
        headers: { Accept: 'application/rss+xml,text/xml' },
      });
      return this.parseRssItems(response.data, 'YouTube', 'video-rss', category);
    } catch (error) {
      console.warn('[SourceFetcher] YouTube RSS failed:', this.safePublicError(error));
      return [];
    }
  }

  private async fetchGdelt(query: string, category: MediaCategory): Promise<MediaItem[]> {
    const url = 'https://api.gdeltproject.org/api/v2/doc/doc';
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        params: {
          query,
          mode: 'artlist',
          format: 'json',
          maxrecords: 20,
          sourcelang: 'fra',
        },
        headers: { Accept: 'application/json' },
      });
      const articles = Array.isArray(response.data?.articles) ? response.data.articles : [];
      return articles.map((item: any, index: number) => this.mediaItem({
        id: `gdelt-${category}-${index}-${this.hash(item.url || item.title || '')}`,
        title: item.title || 'Actualité CDM 2026',
        summary: item.seendate || item.domain || '',
        url: item.url,
        source: item.domain || 'GDELT',
        sourceType: 'gdelt',
        publishedAt: this.parseGdeltDate(item.seendate),
        category,
        confidence: 0.74,
      })).filter(Boolean) as MediaItem[];
    } catch (error) {
      console.warn('[SourceFetcher] GDELT failed:', this.safePublicError(error));
      return [];
    }
  }

  private parseRssItems(xml: string, source: string, sourceType: string, category: MediaCategory): MediaItem[] {
    const entries = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
    return entries.map((entry, index) => {
      const title = this.decodeXml(this.pickXml(entry, 'title'));
      const rawLink = this.pickXml(entry, 'link') || this.pickXml(entry, 'guid');
      const hrefLink = this.pickXmlAttribute(entry, 'link', 'href');
      const url = this.decodeXml(rawLink || hrefLink);
      const summary = this.decodeXml(this.pickXml(entry, 'description') || this.pickXml(entry, 'summary') || '');
      const publishedAt = this.decodeXml(this.pickXml(entry, 'pubDate') || this.pickXml(entry, 'published') || this.pickXml(entry, 'updated') || new Date().toISOString());
      return this.mediaItem({
        id: `${sourceType}-${category}-${index}-${this.hash(url || title)}`,
        title,
        summary: this.stripTags(summary),
        url,
        source,
        sourceType,
        publishedAt: this.toIsoDate(publishedAt),
        category,
        confidence: sourceType === 'video-rss' ? 0.82 : 0.78,
      });
    }).filter(Boolean) as MediaItem[];
  }

  private mediaItem(input: {
    id: string;
    title: string;
    summary: string;
    url: string;
    source: string;
    sourceType: string;
    publishedAt: string;
    category: MediaCategory;
    confidence: number;
  }): MediaItem | null {
    if (!input.title || !this.isHttpUrl(input.url)) return null;
    return {
      id: input.id,
      title: input.title,
      summary: input.summary || input.title,
      url: input.url,
      link: input.url,
      sourceUrl: input.url,
      source_url: input.url,
      canonicalUrl: input.url,
      source: input.source,
      sourceType: input.sourceType,
      publishedAt: input.publishedAt || new Date().toISOString(),
      category: input.category,
      team: null,
      confidence: input.confidence,
      language: 'fr',
    };
  }

  private dedupeMedia(items: MediaItem[]): MediaItem[] {
    const seen = new Set<string>();
    const result: MediaItem[] = [];
    for (const item of items) {
      const key = `${item.url.toLowerCase()}|${item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  private pickXml(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match?.[1]?.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() || '';
  }

  private pickXmlAttribute(xml: string, tag: string, attribute: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attribute}=["']([^"']+)["'][^>]*>`, 'i'));
    return match?.[1]?.trim() || '';
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private stripTags(value: string): string {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private toIsoDate(value: string): string {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
  }

  private parseGdeltDate(value?: string): string {
    if (!value) return new Date().toISOString();
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
  }

  private isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value || '');
  }

  private hash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  private safePublicError(error: unknown): string {
    const message = error instanceof AxiosError
      ? `${error.response?.status || 'network'} ${error.message}`
      : this.safeError(error);
    return message
      .replace(/([?&](?:key|api_key|token|access_token)=)[^&\s]+/gi, '$1[redacted]')
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[redacted]');
  }
}

export const sourceFetcherService = new SourceFetcherService();
export default SourceFetcherService;
