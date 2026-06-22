// ============================================
// When Is Kickoff -> backend match/standing mapper
// ============================================
import { MatchStatus, NormalizedMatch, StandingEntry, TeamInfo } from '../types';

export function mapWhenIsKickoffMatch(raw: any): NormalizedMatch | null {
  if (!raw) return null;
  const id = raw.num ?? raw.id ?? raw.slug;
  if (!id || !raw.home || !raw.away) return null;

  const status = mapStatus(raw.status);
  const homeScore = toNullableNumber(raw.score_home);
  const awayScore = toNullableNumber(raw.score_away);

  return {
    id: `wik-${id}`,
    source: 'wheniskickoff',
    sourceUsed: 'wheniskickoff',
    competitionId: 'world-cup-2026',
    competitionName: 'FIFA World Cup 2026',
    seasonName: '2026',
    stage: raw.phase || (raw.group ? `Group ${raw.group}` : 'Group stage'),
    group: raw.group || undefined,
    round: raw.num ? `Match ${raw.num}` : raw.phase || undefined,
    homeTeam: mapTeam(raw.home, raw.home_name, raw.group),
    awayTeam: mapTeam(raw.away, raw.away_name, raw.group),
    status,
    startDateTimeUtc: raw.datetime_utc || `${raw.date}T${raw.time_utc || '00:00'}:00Z`,
    homeScore,
    awayScore,
    isFinished: status === 'finished',
    isInProgress: ['in_progress', 'halftime', 'extra_time', 'penalties'].includes(status),
    venue: raw.venue_name || raw.venue || undefined,
  };
}

export function mapWhenIsKickoffStandings(groups: any[], teams: any[], matches: any[] = []): StandingEntry[] {
  const teamMap = new Map<string, any>();
  for (const team of teams) {
    if (team?.code) teamMap.set(team.code, team);
  }

  const entries = new Map<string, StandingEntry>();
  for (const group of groups) {
    const groupName = group?.group ? `Group ${group.group}` : 'Groupes';
    const codes = Array.isArray(group?.teams) ? group.teams : [];
    for (const code of codes) {
      const normalizedCode = normalizeTeamCode(code);
      const key = `${groupName}:${normalizedCode}`;
      if (!entries.has(key)) {
        entries.set(key, createStandingEntry(normalizedCode, teamMap.get(normalizedCode), groupName));
      }
    }
  }

  for (const rawMatch of matches) {
    const match = mapWhenIsKickoffMatch(rawMatch);
    if (!match || match.status !== 'finished') continue;
    if (match.homeScore === null || match.awayScore === null) continue;
    const groupName = match.group ? `Group ${match.group}` : undefined;
    if (!groupName) continue;
    applyResult(entries, groupName, match.homeTeam.threeCharCode, match.homeScore, match.awayScore);
    applyResult(entries, groupName, match.awayTeam.threeCharCode, match.awayScore, match.homeScore);
  }

  return Array.from(entries.values())
    .sort((a, b) => {
      if ((a.group || '') !== (b.group || '')) return (a.group || '').localeCompare(b.group || '');
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.name.localeCompare(b.team.name);
    })
    .map((entry, index, all) => ({
      ...entry,
      position: all.filter((candidate) => candidate.group === entry.group).indexOf(entry) + 1,
    }));
}

export function filterWhenIsKickoffUpcoming(matches: NormalizedMatch[], days: number): NormalizedMatch[] {
  const now = new Date();
  const limit = new Date(now.getTime() + days * 86400000);
  return matches
    .filter((match) => {
      const kickoff = new Date(match.startDateTimeUtc);
      return Number.isFinite(kickoff.getTime()) && kickoff >= now && kickoff <= limit;
    })
    .sort((a, b) => new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime());
}

export function filterWhenIsKickoffToday(matches: NormalizedMatch[], timezone = 'Europe/Paris'): NormalizedMatch[] {
  const today = dateKeyInTimeZone(new Date(), timezone);
  return matches
    .filter((match) => dateKeyInTimeZone(new Date(match.startDateTimeUtc), timezone) === today)
    .sort((a, b) => new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime());
}

function mapTeam(code: string, name?: string, group?: string): TeamInfo {
  const normalizedCode = normalizeTeamCode(code);
  return {
    id: normalizedCode,
    name: name || normalizedCode,
    shortName: normalizedCode,
    threeCharCode: normalizedCode,
    country: group ? `Group ${group}` : undefined,
  };
}

function createStandingEntry(code: string, rawTeam: any, group: string): StandingEntry {
  return {
    position: 0,
    team: {
      id: code,
      name: rawTeam?.name || code,
      shortName: code,
      threeCharCode: code,
      flag: rawTeam?.flag || undefined,
      logoUrl: rawTeam?.flag || undefined,
      country: rawTeam?.confederation || undefined,
    },
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    group,
  };
}

function applyResult(entries: Map<string, StandingEntry>, group: string, code: string, goalsFor: number, goalsAgainst: number) {
  const key = `${group}:${normalizeTeamCode(code)}`;
  const entry = entries.get(key);
  if (!entry) return;
  entry.played += 1;
  entry.goalsFor += goalsFor;
  entry.goalsAgainst += goalsAgainst;
  entry.goalDifference = entry.goalsFor - entry.goalsAgainst;
  if (goalsFor > goalsAgainst) {
    entry.won += 1;
    entry.points += 3;
  } else if (goalsFor === goalsAgainst) {
    entry.drawn += 1;
    entry.points += 1;
  } else {
    entry.lost += 1;
  }
}

function mapStatus(status: string): MatchStatus {
  const value = String(status || '').toLowerCase();
  if (['finished', 'ft', 'full_time'].includes(value)) return 'finished';
  if (['live', 'in_progress', '1h', '2h'].includes(value)) return 'in_progress';
  if (['postponed'].includes(value)) return 'postponed';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  return 'scheduled';
}

function toNullableNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTeamCode(code: string): string {
  if (code === 'URY') return 'URU';
  return String(code || 'TBD').toUpperCase();
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
