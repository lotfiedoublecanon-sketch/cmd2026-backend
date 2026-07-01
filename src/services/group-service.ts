import { StandingEntry } from '../types';
import { mergeService } from './merge-service';

const EXPECTED_GROUPS = Array.from({ length: 12 }, (_, index) =>
  `Group ${String.fromCharCode(65 + index)}`
);
const EXPECTED_TEAMS_PER_GROUP = 4;

export interface GroupStandingEntry {
  teamCode: string | null;
  teamName: string;
  points: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;
}

export interface GroupStanding {
  name: string;
  entries: GroupStandingEntry[];
}

export interface GroupStandingsResponse {
  success: boolean;
  groups: GroupStanding[];
  sourceUsed: string;
  updatedAt: string;
  error?: string;
}

export class GroupService {
  async getGroups(): Promise<GroupStandingsResponse> {
    const result = await mergeService.getStandings();
    const sourceUsed = result.sourceUsed || result.source;
    const updatedAt = result.updatedAt
      || result.cache?.updatedAt
      || result.cachedAt
      || new Date().toISOString();
    const groups = this.normalizeGroups(Array.isArray(result.data) ? result.data : []);

    if (groups.length !== EXPECTED_GROUPS.length) {
      return {
        success: false,
        groups: [],
        sourceUsed,
        updatedAt,
        error: result.error || 'A complete set of 12 reliable groups is not available',
      };
    }

    return {
      success: result.success,
      groups,
      sourceUsed,
      updatedAt,
      ...(result.error ? { error: result.error } : {}),
    };
  }

  async getStandings(): Promise<GroupStandingsResponse> {
    return this.getGroups();
  }

  normalizeGroups(entries: StandingEntry[]): GroupStanding[] {
    const grouped = new Map<string, StandingEntry[]>();

    for (const entry of entries) {
      const groupName = this.groupName(entry.group);
      if (!groupName) continue;
      grouped.set(groupName, [...(grouped.get(groupName) || []), entry]);
    }

    const groups: GroupStanding[] = [];
    for (const groupName of EXPECTED_GROUPS) {
      const rows = grouped.get(groupName) || [];
      if (!this.hasReliableTeams(rows)) return [];

      groups.push({
        name: groupName,
        entries: [...rows]
          .sort((a, b) => this.position(a.position) - this.position(b.position))
          .map((entry) => this.normalizeEntry(entry)),
      });
    }

    return groups;
  }

  private normalizeEntry(entry: StandingEntry): GroupStandingEntry {
    return {
      teamCode: this.teamCode(entry.team?.threeCharCode, entry.team?.shortName),
      teamName: entry.team.name.trim(),
      points: this.nullableNumber(entry.points),
      played: this.nullableNumber(entry.played),
      wins: this.nullableNumber(entry.won),
      draws: this.nullableNumber(entry.drawn),
      losses: this.nullableNumber(entry.lost),
      goalsFor: this.nullableNumber(entry.goalsFor),
      goalsAgainst: this.nullableNumber(entry.goalsAgainst),
      goalDifference: this.nullableNumber(entry.goalDifference),
    };
  }

  private hasReliableTeams(entries: StandingEntry[]): boolean {
    if (entries.length !== EXPECTED_TEAMS_PER_GROUP) return false;

    const teamKeys = new Set<string>();
    for (const entry of entries) {
      const name = entry.team?.name?.trim();
      if (!name || /^(unknown|tbd)$/i.test(name)) return false;
      const code = this.teamCode(entry.team.threeCharCode, entry.team.shortName);
      teamKeys.add(code || name.toLocaleLowerCase('en'));
    }

    return teamKeys.size === EXPECTED_TEAMS_PER_GROUP;
  }

  private groupName(value?: string): string | null {
    const match = String(value || '').trim().match(/^(?:group|groupe)?\s*([A-L])$/i);
    return match ? `Group ${match[1].toUpperCase()}` : null;
  }

  private teamCode(primary?: string, fallback?: string): string | null {
    const code = String(primary || fallback || '').trim().toUpperCase();
    return !code || /^(UNKNOWN|UNK|TBD)$/.test(code) ? null : code;
  }

  private nullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private position(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number.MAX_SAFE_INTEGER;
  }
}

export const groupService = new GroupService();

export default GroupService;
