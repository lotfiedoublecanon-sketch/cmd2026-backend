// ============================================
// OpenFootball worldcup.json -> backend match mapper
// ============================================
import { MatchStatus, NormalizedMatch, TeamInfo } from '../types';

export function mapOpenFootballMatch(raw: any, index: number): NormalizedMatch | null {
  if (!raw?.team1 || !raw?.team2) return null;
  const homeScore = Array.isArray(raw.score?.ft) ? toNullableNumber(raw.score.ft[0]) : null;
  const awayScore = Array.isArray(raw.score?.ft) ? toNullableNumber(raw.score.ft[1]) : null;
  const status: MatchStatus = homeScore !== null && awayScore !== null ? 'finished' : 'scheduled';

  return {
    id: `openfootball-${index + 1}`,
    source: 'openfootball',
    sourceUsed: 'openfootball',
    competitionId: 'world-cup-2026',
    competitionName: 'FIFA World Cup 2026',
    seasonName: '2026',
    stage: raw.round || raw.group || 'World Cup 2026',
    group: parseGroup(raw.group),
    round: raw.round || `Match ${index + 1}`,
    homeTeam: mapTeam(raw.team1),
    awayTeam: mapTeam(raw.team2),
    status,
    startDateTimeUtc: normalizeDate(raw.date, raw.time),
    homeScore,
    awayScore,
    isFinished: status === 'finished',
    isInProgress: false,
    venue: raw.ground || undefined,
  };
}

function mapTeam(name: string): TeamInfo {
  const code = String(name || 'TBD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TBD';
  return {
    id: code,
    name,
    shortName: code,
    threeCharCode: code,
  };
}

function normalizeDate(date?: string, time?: string): string {
  if (!date) return '';
  if (!time) return `${date}T00:00:00Z`;
  const cleanTime = String(time).replace(/\s*UTC.*$/i, '').trim();
  return `${date}T${cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime}Z`;
}

function parseGroup(value?: string): string | undefined {
  if (!value) return undefined;
  const match = String(value).match(/group\s+([A-L])/i);
  return match?.[1]?.toUpperCase();
}

function toNullableNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
