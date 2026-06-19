// ============================================
// CDM 2026 Live - Shared Type Definitions
// ============================================

/** Normalized match status across FAPI + SportDB */
export type MatchStatus =
  | 'scheduled'
  | 'in_progress'
  | 'halftime'
  | 'extra_time'
  | 'penalties'
  | 'finished'
  | 'postponed'
  | 'cancelled'
  | 'unknown';

/** Match period / half */
export type MatchPeriod = '1st_half' | '2nd_half' | 'halftime' | 'extra_time_1' | 'extra_time_2' | 'penalty_shootout' | 'pre_match' | 'full_time';

/** Event type in timeline */
export type TimelineEventType =
  | 'goal'
  | 'own_goal'
  | 'penalty_goal'
  | 'penalty_missed'
  | 'yellow_card'
  | 'red_card'
  | 'second_yellow_card'
  | 'substitution'
  | 'var_decision'
  | 'period_start'
  | 'period_end'
  | 'unknown';

/** Normalized match — the core data structure */
export interface NormalizedMatch {
  id: string;
  source: 'fapi' | 'sportdb' | 'merged';
  competitionId: string;
  competitionName: string;
  seasonName: string;
  stage: string;
  group?: string;
  round?: string;

  homeTeam: TeamInfo;
  awayTeam: TeamInfo;

  status: MatchStatus;
  period?: MatchPeriod;
  minute?: number;
  startDateTimeUtc: string;

  homeScore: number;
  awayScore: number;
  homeScorePenalty?: number;
  awayScorePenalty?: number;

  isFinished: boolean;
  isInProgress: boolean;

  venue?: string;
  referee?: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  threeCharCode: string;
  logoUrl?: string;
  country?: string;
}

/** Timeline event */
export interface MatchEvent {
  id: string;
  matchId: string;
  type: TimelineEventType;
  minute: number;
  period?: string;
  team: 'home' | 'away';
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  description?: string;
  varOutcome?: string;
  relatedEventId?: string;
}

/** Match statistics */
export interface MatchStats {
  matchId: string;
  stats: StatCategory[];
}

export interface StatCategory {
  name: string;
  home: string | number;
  away: string | number;
}

/** Lineup information */
export interface MatchLineups {
  matchId: string;
  homeFormation?: string;
  awayFormation?: string;
  homePlayers: LineupPlayer[];
  awayPlayers: LineupPlayer[];
}

export interface LineupPlayer {
  id: string;
  name: string;
  position: string;
  shirtNumber?: number;
  isStarter: boolean;
  rating?: number;
}

/** Standing entry */
export interface StandingEntry {
  position: number;
  team: TeamInfo;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  group?: string;
  form?: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  source: 'fapi' | 'sportdb' | 'merged' | 'cache';
  cachedAt?: string;
  error?: string;
}

/** Gemini agent types */
export type GeminiAgentType = 'commentator' | 'analyst' | 'predictor' | 'journalist';

export interface GeminiResponse {
  agent: GeminiAgentType;
  content: string;
  matchId?: string;
  timestamp: string;
}

/** Notification payload */
export interface NotificationPayload {
  title: string;
  body: string;
  matchId?: string;
  type: 'goal' | 'card' | 'start' | 'end' | 'lineup' | 'var' | 'general';
  data?: Record<string, string>;
}
