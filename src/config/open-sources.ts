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
  enabled?: boolean;
  backendOnly?: boolean;
}

interface MediaSourcesFile {
  sources: Array<Omit<MediaSource, 'active'> & { enabled?: boolean }>;
}

const MEDIA_SOURCES: MediaSource[] = (mediaSourcesConfig as MediaSourcesFile).sources.map((source) => ({
  ...source,
  active: source.enabled !== false,
}));

/**
 * Get all enabled media sources.
 */
export function getEnabledSources(): MediaSource[] {
  return MEDIA_SOURCES.filter((source) => source.active);
}

/**
 * Get media sources by type.
 */
export function getSourcesByType(type: string): MediaSource[] {
  return MEDIA_SOURCES.filter((source) => source.type === type && source.active);
}

/**
 * Get media source by ID.
 */
export function getSourceById(id: string): MediaSource | undefined {
  return MEDIA_SOURCES.find((source) => source.id === id);
}

/**
 * Get all available types.
 */
export function getAvailableTypes(): string[] {
  const types = new Set(MEDIA_SOURCES.map((source) => source.type));
  return Array.from(types);
}

export default {
  MEDIA_SOURCES,
  getEnabledSources,
  getSourcesByType,
  getSourceById,
  getAvailableTypes,
};
