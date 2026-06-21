// ============================================
// Open Sources & Media Sources Configuration
// ============================================

export interface MediaSource {
  id: string;
  name: string;
  type: 'news' | 'video' | 'sports' | 'social' | 'official';
  homepage: string;
  categories: string[];
  active: boolean;
}

const MEDIA_SOURCES: MediaSource[] = [
  {
    id: 'bbc_sport',
    name: 'BBC Sport',
    type: 'news',
    homepage: 'https://www.bbc.com/sport/football/world_cup',
    categories: ['news', 'matches', 'analysis'],
    active: true,
  },
  {
    id: 'espn',
    name: 'ESPN',
    type: 'news',
    homepage: 'https://www.espn.com/soccer/worldcup',
    categories: ['news', 'matches', 'stats'],
    active: true,
  },
  {
    id: 'goal',
    name: 'Goal.com',
    type: 'news',
    homepage: 'https://www.goal.com/en/worldcup',
    categories: ['news', 'rumors', 'analysis'],
    active: true,
  },
  {
    id: 'fifa_official',
    name: 'FIFA Official',
    type: 'official',
    homepage: 'https://www.fifa.com',
    categories: ['official', 'matches', 'standings'],
    active: true,
  },
  {
    id: 'youtube_fifa',
    name: 'YouTube - FIFA Official',
    type: 'video',
    homepage: 'https://www.youtube.com/fifa',
    categories: ['video', 'highlights', 'interviews'],
    active: true,
  },
  {
    id: 'skysports',
    name: 'Sky Sports',
    type: 'news',
    homepage: 'https://www.skysports.com/football/world-cup',
    categories: ['news', 'analysis', 'transfers'],
    active: true,
  },
  {
    id: 'onefoot',
    name: 'OneFootball',
    type: 'news',
    homepage: 'https://onefootball.com',
    categories: ['news', 'videos', 'matches'],
    active: true,
  },
];

/**
 * Get all enabled media sources
 */
export function getEnabledSources(): MediaSource[] {
  return MEDIA_SOURCES.filter((source) => source.active);
}

/**
 * Get media sources by type
 */
export function getSourcesByType(type: string): MediaSource[] {
  return MEDIA_SOURCES.filter((source) => source.type === type && source.active);
}

/**
 * Get media source by ID
 */
export function getSourceById(id: string): MediaSource | undefined {
  return MEDIA_SOURCES.find((source) => source.id === id);
}

/**
 * Get all available types
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
