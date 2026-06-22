// ============================================
// Open Sources & Media Sources Configuration
// ============================================
import mediaSourcesConfig from './media_sources.json';

export interface MediaSource {
  id: string;
  name: string;
  type: string;
  homepage: string;
  healthUrl?: string;
  categories: string[];
  active: boolean;
  backendOnly?: boolean;
  note?: string;
}

const MEDIA_SOURCES: MediaSource[] = (mediaSourcesConfig.sources || []).map((source: any) => ({
  id: source.id,
  name: source.name,
  type: source.type,
  homepage: source.homepage,
  healthUrl: source.healthUrl,
  categories: Array.isArray(source.categories) ? source.categories : [],
  active: Boolean(source.enabled),
  backendOnly: Boolean(source.backendOnly),
  note: source.note,
}));

export function getEnabledSources(): MediaSource[] {
  return MEDIA_SOURCES.filter((source) => source.active);
}

export function getSourcesByType(type: string): MediaSource[] {
  return MEDIA_SOURCES.filter((source) => source.type === type && source.active);
}

export function getSourceById(id: string): MediaSource | undefined {
  return MEDIA_SOURCES.find((source) => source.id === id);
}

export function getAvailableTypes(): string[] {
  return Array.from(new Set(MEDIA_SOURCES.map((source) => source.type)));
}

export default {
  MEDIA_SOURCES,
  getEnabledSources,
  getSourcesByType,
  getSourceById,
  getAvailableTypes,
};
