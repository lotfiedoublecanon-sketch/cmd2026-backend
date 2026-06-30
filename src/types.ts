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

export type SourceName =
  | 'fapi'
  | 'sportdb'
  | 'sportmonks'
  | 'espn-public'
  | 'merged'
  | 'cache'
  | 'backend'
  | 'worldcup2026-tour'
  | 'wheniskickoff'
  | 'openfootball';

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  threeCharCode: string;
  logoUrl?: string;
  country?: string;
  flag?: string;
}

// ---- Normalized Match ----

export interface NormalizedMatch {
  id: string;
  source: SourceName;
  sourceUsed?: SourceName | string;
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
  winner?: 'home' | 'away' | 'draw';
  isFinished: boolean;
  isInProgress: boolean;
  venue?: string;
  referee?: string;
}

export interface LiveMatchesResult {
  matches: NormalizedMatch[];
  requestSucceeded: boolean;
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
  source: SourceName;
  sourceUsed?: string;
  cachedAt?: string;
  updatedAt?: string;
  error?: string;
  cache?: {
    status: 'hit' | 'miss' | 'stale' | 'bypass';
    key?: string;
    updatedAt?: string;
    expiresAt?: string;
  };
}

// ---- Web live widget ----

export type WidgetMatchStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'HALF_TIME'
  | 'EXTRA_TIME'
  | 'PENALTIES'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'UNKNOWN'
  | 'AWAITING_LIVE_DATA';

export type WidgetLiveDataStatus =
  | 'live'
  | 'waiting'
  | 'scheduled'
  | 'final'
  | 'available'
  | 'unavailable';

export interface WidgetMatch {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  winnerTeamName: string | null;
  status: WidgetMatchStatus;
  minute: number | null;
  kickoff: string | null;
  group: string | null;
  stage: string | null;
  venue: string | null;
  sourceUsed: string;
  lastUpdatedAt: string;
  liveDataStatus: WidgetLiveDataStatus;
}

export interface WidgetStatusItem {
  status: 'OK' | 'DEGRADED';
  sourceUsed: string;
  lastUpdatedAt: string;
  liveDataStatus: WidgetLiveDataStatus;
  counts: {
    live: number;
    today: number;
    upcoming: number;
  };
}

export interface WidgetResponse<T> {
  success: boolean;
  items: T[];
  sourceUsed: string;
  lastUpdatedAt: string;
  liveDataStatus: WidgetLiveDataStatus;
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
