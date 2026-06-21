// ORIGINAL_PATH: src/config/open-sources.ts
// IMPORTANT: This file was renamed to .txt because Z.ai upload does not accept .ts/.json/.yaml.
// If Z.ai modifies it, copy the corrected content back to the original path/name shown above.

import axios from 'axios';
import mediaSourcesConfig from './media_sources.json';

export type SourceHealthStatus = 'OK' | 'erreur' | 'désactivée';

export interface PublicMediaSource {
  id: string;
  name: string;
  enabled: boolean;
  type: string;
  homepage: string;
  healthUrl?: string;
  rss?: string;
  backendOnly?: boolean;
  note?: string;
  categories: string[];
}

export interface MediaSourcesConfig {
  version: string;
  backendOnly: boolean;
  sources: PublicMediaSource[];
}

export interface SourceHealthResult {
  id: string;
  name: string;
  status: SourceHealthStatus;
  httpCode?: number;
  itemCount: number;
  lastCheck: string;
  categories: string[];
  error?: string;
}

export const mediaSources = mediaSourcesConfig as MediaSourcesConfig;

export function getEnabledSources(): PublicMediaSource[] {
  return mediaSources.sources.filter((source) => source.enabled);
}

export function getAllSources(): PublicMediaSource[] {
  return mediaSources.sources;
}

function countItems(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;

  if (typeof payload === 'string') {
    const itemMatches = payload.match(/<(item|entry)\b/gi);
    return itemMatches?.length ?? (payload.length > 0 ? 1 : 0);
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidate = ['items', 'articles', 'results', 'data', 'events', 'matches']
      .map((key) => record[key])
      .find((value) => Array.isArray(value));
    if (Array.isArray(candidate)) return candidate.length;
    return Object.keys(record).length > 0 ? 1 : 0;
  }

  return 0;
}

export async function checkSourceHealth(source: PublicMediaSource): Promise<SourceHealthResult> {
  const lastCheck = new Date().toISOString();

  if (!source.enabled) {
    return {
      id: source.id,
      name: source.name,
      status: 'désactivée',
      itemCount: 0,
      lastCheck,
      categories: source.categories,
    };
  }

  try {
    const response = await axios.get(source.healthUrl || source.homepage, {
      timeout: 4000, // Reduced timeout for Render health checks
      maxRedirects: 3,
      headers: {
        'User-Agent': 'CDM2026LiveByRedha/5.0 source-health',
        Accept: 'application/json, application/rss+xml, application/xml, text/xml, text/html, text/plain',
      },
      validateStatus: (status) => status >= 200 && status < 500,
    });

    const itemCount = countItems(response.data);
    const ok = response.status >= 200 && response.status < 400;

    return {
      id: source.id,
      name: source.name,
      status: ok ? 'OK' : 'erreur',
      httpCode: response.status,
      itemCount,
      lastCheck,
      categories: source.categories,
      error: ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const httpCode = axios.isAxiosError(error) ? error.response?.status : undefined;
    const message = error instanceof Error ? error.message : 'Source inaccessible';
    return {
      id: source.id,
      name: source.name,
      status: 'erreur',
      httpCode,
      itemCount: 0,
      lastCheck,
      categories: source.categories,
      error: message,
    };
  }
}

export async function checkSourcesHealth(): Promise<SourceHealthResult[]> {
  const results = await Promise.allSettled(getAllSources().map((source) => checkSourceHealth(source)));
  return results.map(r => r.status === 'fulfilled' ? r.value : {
    id: 'unknown',
    name: 'unknown',
    status: 'erreur' as SourceHealthStatus,
    itemCount: 0,
    lastCheck: new Date().toISOString(),
    categories: [],
    error: 'Promise rejected unexpectedly'
  } as SourceHealthResult);
}
