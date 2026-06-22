// ============================================
// World Cup 2026 Tour -> backend match mapper
// ============================================
import { NormalizedMatch, TeamInfo } from '../types';

export function mapWorldCupTourMatch(raw: any): NormalizedMatch | null {
  if (!raw) return null;
  const home = raw.home || raw.homeTeam || {};
  const away = raw.away || raw.awayTeam || {};
  const id = raw.id ?? raw.matchId ?? raw.num;
  if (!id || !home?.name || !away?.name) return null;

  const kickoff = raw.kickoff?.utc || raw.kickoffUtc || raw.datetime_utc || raw.dateTimeUtc || '';
  const group = raw.group || parseGroup(raw.stage || raw.stageName);
  const stage = raw.stageName || raw.stage || (group ? `Group ${group}` : 'Group stage');

  return {
    id: `wctour-${id}`,
    source: 'worldcup2026-tour',
    sourceUsed: 'worldcup2026-tour',
    competitionId: 'world-cup-2026',
    competitionName: 'FIFA World Cup 2026',
    seasonName: '2026',
    stage,
    group,
    round: raw.title || stage || `Match ${id}`,
    homeTeam: mapTeam(home),
    awayTeam: mapTeam(away),
    status: 'scheduled',
    startDateTimeUtc: kickoff,
    homeScore: null,
    awayScore: null,
    isFinished: false,
    isInProgress: false,
    venue: raw.venue || raw.venueName || undefined,
  };
}

export function filterUpcoming(matches: NormalizedMatch[], days: number, timezone = 'Europe/Paris'): NormalizedMatch[] {
  const now = new Date();
  const limit = new Date(now.getTime() + days * 86400000);
  return matches
    .filter((match) => {
      const kickoff = new Date(match.startDateTimeUtc);
      return Number.isFinite(kickoff.getTime()) && kickoff >= now && kickoff <= limit;
    })
    .sort(sortByKickoff);
}

export function filterToday(matches: NormalizedMatch[], timezone = 'Europe/Paris'): NormalizedMatch[] {
  const today = dateKeyInTimeZone(new Date(), timezone);
  return matches
    .filter((match) => dateKeyInTimeZone(new Date(match.startDateTimeUtc), timezone) === today)
    .sort(sortByKickoff);
}

function mapTeam(raw: any): TeamInfo {
  const code = raw.code || raw.shortName || raw.threeCharCode || raw.id || 'TBD';
  const name = raw.name || code;
  return {
    id: code,
    name,
    shortName: code,
    threeCharCode: code,
    flag: raw.flag || undefined,
    logoUrl: raw.flag || undefined,
  };
}

function parseGroup(value?: string): string | undefined {
  if (!value) return undefined;
  const match = String(value).match(/group\s+([A-L])/i);
  return match?.[1]?.toUpperCase();
}

function sortByKickoff(a: NormalizedMatch, b: NormalizedMatch): number {
  return new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime();
}

function dateKeyInTimeZone(date: Date, timeZone: string): string {
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
