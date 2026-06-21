// ============================================
// World Cup 2026 backend fallback data
// ============================================
import worldCupData from '../data/worldcup2026-data.json';
import { MatchStatus, NormalizedMatch, StandingEntry, TeamInfo } from '../types';

interface RawTeam {
  code?: string;
  group?: string;
  iso2?: string;
  flag?: string;
  name?: Record<string, string>;
}

interface RawMatchTeam {
  code: string;
  score?: number | null;
  pen?: number | null;
}

interface RawMatch {
  id: string;
  n?: number;
  stage?: string;
  group?: string;
  date?: string | null;
  venueId?: string;
  status?: string;
  time?: string;
  home: RawMatchTeam;
  away: RawMatchTeam;
}

interface RawStanding {
  code: string;
  p?: number;
  w?: number;
  d?: number;
  l?: number;
  gf?: number;
  ga?: number;
  gd?: number;
  pts?: number;
  rank?: number;
}

interface WorldCupFallbackData {
  teams: Record<string, RawTeam>;
  matches: RawMatch[];
  standings: Record<string, RawStanding[]>;
  africanTeamCodes?: string[];
}

const DATA = worldCupData as WorldCupFallbackData;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function scoreOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function mapStatus(value?: string): MatchStatus {
  switch ((value || '').toLowerCase()) {
    case 'live':
    case 'in_progress':
      return 'in_progress';
    case 'halftime':
    case 'half_time':
      return 'halftime';
    case 'finished':
    case 'full_time':
    case 'ft':
      return 'finished';
    case 'postponed':
      return 'postponed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'stale':
    case 'unknown':
      return 'unknown';
    default:
      return 'scheduled';
  }
}

function teamInfo(code: string): TeamInfo {
  const team = DATA.teams[code];
  const name = team?.name?.fr || team?.name?.en || code;
  return {
    id: code,
    name,
    shortName: code,
    threeCharCode: code,
    logoUrl: team?.flag,
    country: team?.iso2,
  };
}

function normalizeMatch(raw: RawMatch): NormalizedMatch | null {
  if (!raw.home?.code || !raw.away?.code) return null;
  const status = mapStatus(raw.status);
  const minute = raw.time?.replace(/\D/g, '');
  const homeScore = status === 'scheduled' || status === 'unknown' ? null : scoreOrNull(raw.home.score);
  const awayScore = status === 'scheduled' || status === 'unknown' ? null : scoreOrNull(raw.away.score);
  return {
    id: `local-${raw.id}`,
    source: 'cache',
    competitionId: 'fifa-world-cup-2026',
    competitionName: 'FIFA World Cup 2026',
    seasonName: '2026',
    stage: raw.stage || 'group',
    group: raw.group ? `Groupe ${raw.group}` : undefined,
    round: raw.n ? `Match ${raw.n}` : undefined,
    homeTeam: teamInfo(raw.home.code),
    awayTeam: teamInfo(raw.away.code),
    status,
    minute: minute ? Number(minute) : undefined,
    startDateTimeUtc: raw.date || '',
    homeScore,
    awayScore,
    homeScorePenalty: scoreOrNull(raw.home.pen) ?? undefined,
    awayScorePenalty: scoreOrNull(raw.away.pen) ?? undefined,
    isFinished: status === 'finished',
    isInProgress: status === 'in_progress' || status === 'halftime',
    venue: 'Coupe du Monde 2026',
  };
}

class WorldCupFallbackService {
  getAllMatches(): NormalizedMatch[] {
    return DATA.matches
      .map(normalizeMatch)
      .filter((match): match is NormalizedMatch => match !== null)
      .sort((a, b) => (parseDate(a.startDateTimeUtc)?.getTime() || 0) - (parseDate(b.startDateTimeUtc)?.getTime() || 0));
  }

  getLiveMatches(): NormalizedMatch[] {
    return this.getAllMatches().filter((match) => match.isInProgress);
  }

  getTodayMatches(date = new Date()): NormalizedMatch[] {
    const today = startOfUtcDay(date);
    return this.getAllMatches().filter((match) => {
      const kickoff = parseDate(match.startDateTimeUtc);
      return kickoff !== null && startOfUtcDay(kickoff).getTime() === today.getTime();
    });
  }

  getUpcomingMatches(days = 60, date = new Date()): NormalizedMatch[] {
    const today = startOfUtcDay(date);
    const limit = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const upcoming = this.getAllMatches().filter((match) => {
      const kickoff = parseDate(match.startDateTimeUtc);
      return kickoff !== null && kickoff >= today && kickoff <= limit && !match.isFinished;
    });
    return upcoming.length > 0 ? upcoming : this.getAllMatches().filter((match) => !match.isFinished).slice(0, 30);
  }

  getMatchById(matchId: string): NormalizedMatch | null {
    const normalizedId = matchId.replace(/^local-/, '');
    return this.getAllMatches().find((match) => match.id === matchId || match.id.replace(/^local-/, '') === normalizedId) || null;
  }

  getStandings(): StandingEntry[] {
    return Object.entries(DATA.standings).flatMap(([group, rows]) =>
      rows.map((row) => ({
        position: row.rank || 0,
        team: teamInfo(row.code),
        played: row.p || 0,
        won: row.w || 0,
        drawn: row.d || 0,
        lost: row.l || 0,
        goalsFor: row.gf || 0,
        goalsAgainst: row.ga || 0,
        goalDifference: row.gd || 0,
        points: row.pts || 0,
        group: `Groupe ${group}`,
      }))
    );
  }

  getAfricanTeamCodes(): string[] {
    return DATA.africanTeamCodes || [];
  }
}

export const worldCupFallbackService = new WorldCupFallbackService();
export default WorldCupFallbackService;
