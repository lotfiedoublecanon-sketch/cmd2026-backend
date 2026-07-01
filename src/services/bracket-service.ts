import { espnLiveClient } from '../clients/espn-live-client';
import { MatchStatus, NormalizedMatch, WidgetMatchStatus } from '../types';

const SOURCE = 'espn-public';
const PLAYED_STATUSES = new Set<MatchStatus>([
  'in_progress',
  'halftime',
  'extra_time',
  'penalties',
  'finished',
]);

export type BracketRoundId =
  | 'round-of-32'
  | 'round-of-16'
  | 'quarterfinals'
  | 'semifinals'
  | 'third-place'
  | 'final';

export type BracketHealthStatus = 'OK' | 'DEGRADED';

export interface BracketMatch {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  winner: 'home' | 'away' | null;
  winnerTeamName: string | null;
  qualifiedTeamName: string | null;
  qualifiedTeamCode: string | null;
  status: WidgetMatchStatus;
  minute: number | null;
  kickoff: string | null;
  newKickoff: string | null;
  delayReason: string | null;
  restartEtaMinutes: number | null;
  venue: string | null;
  sourceUsed: string;
  lastUpdatedAt: string;
}

export interface BracketRound {
  id: BracketRoundId;
  name: string;
  matches: BracketMatch[];
}

export interface BracketRoundStatus {
  id: BracketRoundId;
  expected: number;
  actual: number;
  complete: boolean;
}

export interface BracketStatusSummary {
  status: BracketHealthStatus;
  complete: boolean;
  sourceFixtureCount: number;
  fixtureCount: number;
  expectedFixtureCount: number;
  invalidFixtureIdCount: number;
  duplicateFixtureIds: string[];
  unmappedFixtureCount: number;
  roundCounts: BracketRoundStatus[];
}

export interface BracketStatusResponse extends BracketStatusSummary {
  sourceUsed: string;
  lastUpdatedAt: string;
}

export interface BracketResponse {
  success: boolean;
  status: BracketHealthStatus;
  rounds: BracketRound[];
  summary: BracketStatusSummary;
  sourceUsed: string;
  lastUpdatedAt: string;
  error?: string;
}

const ROUND_DEFINITIONS: ReadonlyArray<{
  id: BracketRoundId;
  name: string;
  expected: number;
  sourceStages: readonly string[];
}> = [
  { id: 'round-of-32', name: 'Seizièmes de finale', expected: 16, sourceStages: ['round-of-32'] },
  { id: 'round-of-16', name: 'Huitièmes de finale', expected: 8, sourceStages: ['round-of-16'] },
  { id: 'quarterfinals', name: 'Quarts de finale', expected: 4, sourceStages: ['quarterfinals'] },
  { id: 'semifinals', name: 'Demi-finales', expected: 2, sourceStages: ['semifinals'] },
  { id: 'third-place', name: 'Match pour la troisième place', expected: 1, sourceStages: ['3rd-place-match'] },
  { id: 'final', name: 'Finale', expected: 1, sourceStages: ['final'] },
];

const EXPECTED_FIXTURE_COUNT = ROUND_DEFINITIONS.reduce(
  (total, definition) => total + definition.expected,
  0
);

interface TeamDisplay {
  name: string;
  code: string | null;
  placeholder: boolean;
}

interface BuiltBracket {
  rounds: BracketRound[];
  summary: BracketStatusSummary;
}

export class BracketService {
  async getBracket(): Promise<BracketResponse> {
    const result = await espnLiveClient.getKnockoutMatches();
    const lastUpdatedAt = new Date().toISOString();
    const bracket = this.buildBracket(result.matches, lastUpdatedAt);

    if (!result.requestSucceeded) {
      return {
        success: false,
        status: 'DEGRADED',
        rounds: bracket.rounds,
        summary: bracket.summary,
        sourceUsed: SOURCE,
        lastUpdatedAt,
        error: 'Tableau temporairement indisponible depuis la source ESPN publique',
      };
    }

    return {
      success: true,
      status: bracket.summary.status,
      rounds: bracket.rounds,
      summary: bracket.summary,
      sourceUsed: SOURCE,
      lastUpdatedAt,
    };
  }

  async getStatus(): Promise<BracketStatusResponse> {
    const bracket = await this.getBracket();
    return {
      ...bracket.summary,
      status: bracket.status,
      sourceUsed: bracket.sourceUsed,
      lastUpdatedAt: bracket.lastUpdatedAt,
    };
  }

  private buildBracket(matches: NormalizedMatch[], lastUpdatedAt: string): BuiltBracket {
    const seenFixtureIds = new Set<string>();
    const duplicateFixtureIds = new Set<string>();
    let invalidFixtureIdCount = 0;

    const uniqueMatches = matches.filter((match) => {
      const id = this.fixtureId(match.id);
      if (!id) {
        invalidFixtureIdCount += 1;
        return false;
      }
      if (seenFixtureIds.has(id)) {
        duplicateFixtureIds.add(id);
        return false;
      }

      seenFixtureIds.add(id);
      return true;
    });

    const mappedFixtureIds = new Set<string>();
    const rounds = ROUND_DEFINITIONS.map((definition) => {
      const roundMatches = uniqueMatches
        .filter((match) => definition.sourceStages.includes(this.stage(match)))
        .sort((a, b) => this.kickoffTime(a) - this.kickoffTime(b));

      roundMatches.forEach((match) => mappedFixtureIds.add(this.fixtureId(match.id) as string));
      return {
        id: definition.id,
        name: definition.name,
        matches: roundMatches.map((match) => this.bracketMatch(match, lastUpdatedAt)),
      };
    });

    const roundCounts = ROUND_DEFINITIONS.map((definition, index) => {
      const actual = rounds[index].matches.length;
      return {
        id: definition.id,
        expected: definition.expected,
        actual,
        complete: actual === definition.expected,
      };
    });
    const unmappedFixtureCount = uniqueMatches.length - mappedFixtureIds.size;
    const complete = invalidFixtureIdCount === 0
      && duplicateFixtureIds.size === 0
      && unmappedFixtureCount === 0
      && roundCounts.every((round) => round.complete);

    return {
      rounds,
      summary: {
        status: complete ? 'OK' : 'DEGRADED',
        complete,
        sourceFixtureCount: matches.length,
        fixtureCount: mappedFixtureIds.size,
        expectedFixtureCount: EXPECTED_FIXTURE_COUNT,
        invalidFixtureIdCount,
        duplicateFixtureIds: Array.from(duplicateFixtureIds).sort(),
        unmappedFixtureCount,
        roundCounts,
      },
    };
  }

  private bracketMatch(match: NormalizedMatch, lastUpdatedAt: string): BracketMatch {
    const played = PLAYED_STATUSES.has(match.status);
    const homeScore = played ? this.scoreOrNull(match.homeScore) : null;
    const awayScore = played ? this.scoreOrNull(match.awayScore) : null;
    const homePenaltyScore = played ? this.scoreOrNull(match.homeScorePenalty) : null;
    const awayPenaltyScore = played ? this.scoreOrNull(match.awayScorePenalty) : null;
    const homeTeam = this.teamDisplay(
      match.homeTeam.name,
      match.homeTeam.threeCharCode,
      match.homeTeam.shortName
    );
    const awayTeam = this.teamDisplay(
      match.awayTeam.name,
      match.awayTeam.threeCharCode,
      match.awayTeam.shortName
    );
    const winner = this.supportedWinner(
      match,
      homeScore,
      awayScore,
      homePenaltyScore,
      awayPenaltyScore
    );
    const qualifiedTeam = winner === 'home'
      ? homeTeam
      : winner === 'away' ? awayTeam : null;

    return {
      id: this.fixtureId(match.id) as string,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeTeamCode: homeTeam.code,
      awayTeamCode: awayTeam.code,
      homeScore,
      awayScore,
      homePenaltyScore,
      awayPenaltyScore,
      winner,
      winnerTeamName: qualifiedTeam && !qualifiedTeam.placeholder ? qualifiedTeam.name : null,
      qualifiedTeamName: qualifiedTeam && !qualifiedTeam.placeholder ? qualifiedTeam.name : null,
      qualifiedTeamCode: qualifiedTeam && !qualifiedTeam.placeholder ? qualifiedTeam.code : null,
      status: this.status(match.status),
      minute: played ? this.numberOrNull(match.minute) : null,
      kickoff: this.validDate(match.startDateTimeUtc),
      newKickoff: this.validDate(match.newKickoff),
      delayReason: this.textOrNull(match.delayReason),
      restartEtaMinutes: this.numberOrNull(match.restartEtaMinutes),
      venue: match.venue?.trim() || null,
      sourceUsed: match.sourceUsed || match.source || SOURCE,
      lastUpdatedAt,
    };
  }

  private supportedWinner(
    match: NormalizedMatch,
    homeScore: number | null,
    awayScore: number | null,
    homePenaltyScore: number | null,
    awayPenaltyScore: number | null
  ): 'home' | 'away' | null {
    if (match.status !== 'finished' || (match.winner !== 'home' && match.winner !== 'away')) {
      return null;
    }

    let scoreWinner: 'home' | 'away' | null = null;
    if (
      homePenaltyScore !== null
      && awayPenaltyScore !== null
      && homePenaltyScore !== awayPenaltyScore
    ) {
      scoreWinner = homePenaltyScore > awayPenaltyScore ? 'home' : 'away';
    } else if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
      scoreWinner = homeScore > awayScore ? 'home' : 'away';
    }

    return scoreWinner === match.winner ? scoreWinner : null;
  }

  private status(status: MatchStatus): WidgetMatchStatus {
    switch (status) {
      case 'scheduled': return 'SCHEDULED';
      case 'in_progress': return 'LIVE';
      case 'halftime': return 'HALF_TIME';
      case 'extra_time': return 'EXTRA_TIME';
      case 'penalties': return 'PENALTIES';
      case 'finished': return 'FINISHED';
      case 'postponed': return 'POSTPONED';
      case 'cancelled': return 'CANCELLED';
      case 'delayed': return 'DELAYED';
      case 'kickoff_delayed': return 'KICKOFF_DELAYED';
      case 'weather_delay': return 'WEATHER_DELAY';
      case 'suspended': return 'SUSPENDED';
      case 'interrupted': return 'INTERRUPTED';
      case 'awaiting_kickoff': return 'AWAITING_KICKOFF';
      default: return 'UNKNOWN';
    }
  }

  private teamDisplay(nameValue?: string, primaryCode?: string, fallbackCode?: string): TeamDisplay {
    const name = nameValue?.trim();
    const placeholder = !name || this.isPlaceholderTeamName(name);
    return {
      name: placeholder ? 'À déterminer' : name,
      code: placeholder ? null : this.teamCode(primaryCode, fallbackCode),
      placeholder,
    };
  }

  private isPlaceholderTeamName(value: string): boolean {
    const name = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    if (/^(?:TBD|Unknown|To Be Determined)$/i.test(name)) return true;

    return /\b(?:winner|loser)\b/i.test(name)
      && /\b(?:round|quarterfinal|semifinal|final|match)\b/i.test(name);
  }

  private teamCode(primary?: string, fallback?: string): string | null {
    const code = (primary || fallback)?.trim().toUpperCase();
    return !code || /^(?:TBD|UNKNOWN)$/.test(code) ? null : code;
  }

  private scoreOrNull(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
  }

  private numberOrNull(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private textOrNull(value: string | undefined): string | null {
    const text = value?.trim();
    return text || null;
  }

  private validDate(value?: string): string | null {
    return value && Number.isFinite(new Date(value).getTime()) ? value : null;
  }

  private fixtureId(value: unknown): string | null {
    const id = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    return id || null;
  }

  private stage(match: NormalizedMatch): string {
    return typeof match.stage === 'string' ? match.stage.trim().toLowerCase() : '';
  }

  private kickoffTime(match: NormalizedMatch): number {
    const value = new Date(match.startDateTimeUtc).getTime();
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }
}

export const bracketService = new BracketService();
export default BracketService;
