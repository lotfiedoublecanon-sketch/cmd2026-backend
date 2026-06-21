// ============================================
// Shared Types — CDM2026 Backend
// ============================================

// ---- Match Status ----

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

// ---- Match Period ----

export type MatchPeriod =
  | '1st_half'
  | '2nd_half'
  | 'halftime'
  | 'extra_time_1'
  | 'extra_time_2'
  | 'penalty_shootout'
  | 'full_time';

// ---- Timeline Event Type ----

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

// ---- Team Info ----

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  threeCharCode: string;
  logoUrl?: string;
  country?: string;
}

// ---- Normalized Match ----

export interface NormalizedMatch {
  id: string;
  source: 'fapi' | 'sportdb' | 'merged' | 'cache';
  competitionId: string;
  competitionName: string;
  seasonName: string;
  stage: string;
  group?: string;
  round?: string | number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  status: MatchStatus;
  period?: MatchPeriod;
  minute?: number;
  startDateTimeUtc: string;
  homeScore: number | null;
  awayScore: number | null;
  homeScorePenalty?: number;
  awayScorePenalty?: number;
  isFinished: boolean;
  isInProgress: boolean;
  venue?: string;
  referee?: string;
}

// ---- Match Event ----

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

// ---- Match Stats ----

export interface StatCategory {
  name: string;
  home: number | string;
  away: number | string;
}

export interface MatchStats {
  matchId: string;
  stats: StatCategory[];
}

// ---- Lineup ----

export interface LineupPlayer {
  id: string;
  name: string;
  position: string;
  shirtNumber?: number;
  isStarter: boolean;
  rating?: number;
}

export interface MatchLineups {
  matchId: string;
  homeFormation?: string;
  awayFormation?: string;
  homePlayers: LineupPlayer[];
  awayPlayers: LineupPlayer[];
}

// ---- Standings ----

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

// ---- API Response Envelope ----

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  source: 'fapi' | 'sportdb' | 'merged' | 'cache' | 'backend';
  cachedAt?: string;
  updatedAt?: string;
  error?: string;
}

// ---- Gemini / Agents ----

export type GeminiAgentType = 'commentator' | 'analyst' | 'predictor' | 'journalist';

export interface GeminiResponse {
  agent: GeminiAgentType;
  content: string;
  matchId?: string;
  timestamp: string;
}

// ---- Notifications ----

export interface NotificationPayload {
  title: string;
  body: string;
  type: string;
  matchId?: string;
  data?: Record<string, string>;
}
