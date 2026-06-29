import axios, { AxiosInstance, AxiosError } from 'axios';
import dotenv from 'dotenv';
import { LiveMatchesResult, MatchStatus, NormalizedMatch, TeamInfo } from '../types';

dotenv.config();

const DEFAULT_BASE_URL = 'https://api.sportmonks.com/v3/football';
const DEFAULT_WORLD_CUP_LEAGUE_ID = '732';

export class SportMonksClient {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.SPORTMONKS_BASE_URL?.trim() || DEFAULT_BASE_URL,
      timeout: Number.parseInt(process.env.SPORTMONKS_TIMEOUT_MS || '10000', 10),
      headers: {
        Accept: 'application/json',
        Authorization: process.env.LIVE_SCORE_API_KEY?.trim() || '',
        'User-Agent': 'CDM2026-Live-Backend/5.0',
      },
    });
  }

  isConfigured(): boolean {
    return process.env.LIVE_SCORE_PROVIDER?.trim().toLowerCase() === 'sportmonks'
      && Boolean(process.env.LIVE_SCORE_API_KEY?.trim());
  }

  async getLiveMatches(): Promise<LiveMatchesResult> {
    if (!this.isConfigured()) {
      return { matches: [], requestSucceeded: false };
    }

    try {
      const leagueId = process.env.SPORTMONKS_WORLD_CUP_LEAGUE_ID?.trim()
        || DEFAULT_WORLD_CUP_LEAGUE_ID;
      const response = await this.client.get('/livescores/inplay', {
        params: {
          filters: `fixtureLeagues:${leagueId}`,
          include: 'participants;scores;state;periods',
        },
      });
      const fixtures = Array.isArray(response.data?.data) ? response.data.data : [];
      const matches = fixtures
        .map((fixture: unknown) => this.normalizeMatch(fixture))
        .filter((match: NormalizedMatch | null): match is NormalizedMatch => Boolean(match))
        .filter((match: NormalizedMatch) => match.isInProgress);

      return { matches: this.dedupe(matches), requestSucceeded: true };
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      console.warn(`[Sportmonks] live request failed${status ? ` (${status})` : ''}`);
      return { matches: [], requestSucceeded: false };
    }
  }

  normalizeMatch(raw: any): NormalizedMatch | null {
    if (!raw || raw.id === null || raw.id === undefined) return null;

    const participants = Array.isArray(raw.participants) ? raw.participants : [];
    const homeRaw = participants.find((item: any) => item?.meta?.location === 'home');
    const awayRaw = participants.find((item: any) => item?.meta?.location === 'away');
    if (!homeRaw || !awayRaw) return null;

    const status = this.mapStatus(raw.state);
    const live = ['in_progress', 'halftime', 'extra_time', 'penalties'].includes(status);
    const currentScores = this.currentScores(raw.scores);

    return {
      id: `sportmonks-${raw.id}`,
      source: 'sportmonks',
      sourceUsed: 'sportmonks',
      competitionId: String(raw.league_id || DEFAULT_WORLD_CUP_LEAGUE_ID),
      competitionName: 'FIFA World Cup 2026',
      seasonName: '2026',
      stage: raw.stage?.name || '',
      group: raw.group?.name || undefined,
      round: raw.round?.name || raw.round_id || undefined,
      homeTeam: this.normalizeTeam(homeRaw),
      awayTeam: this.normalizeTeam(awayRaw),
      status,
      minute: live ? this.explicitMinute(raw) : undefined,
      startDateTimeUtc: this.utcDate(raw.starting_at),
      homeScore: currentScores.get(String(homeRaw.id)) ?? null,
      awayScore: currentScores.get(String(awayRaw.id)) ?? null,
      isFinished: status === 'finished',
      isInProgress: live,
      venue: raw.venue?.name || undefined,
    };
  }

  private normalizeTeam(raw: any): TeamInfo {
    const code = String(raw.short_code || raw.code || 'TBD').toUpperCase();
    return {
      id: String(raw.id || ''),
      name: String(raw.name || 'Unknown'),
      shortName: code,
      threeCharCode: code,
      logoUrl: raw.image_path || undefined,
      country: raw.country?.name || undefined,
    };
  }

  private mapStatus(state: any): MatchStatus {
    const value = String(state?.short_name || state?.developer_name || state?.name || '')
      .trim()
      .toUpperCase()
      .replace(/[ -]+/g, '_');

    if (['INPLAY', 'LIVE', '1ST', '2ND', '1ST_HALF', '2ND_HALF'].includes(value)) {
      return 'in_progress';
    }
    if (['HT', 'HALF_TIME', 'BREAK'].includes(value)) return 'halftime';
    if (['ET', 'EXTRA_TIME'].includes(value)) return 'extra_time';
    if (['PEN_LIVE', 'PENALTIES'].includes(value)) return 'penalties';
    if (['FT', 'AET', 'FT_PEN', 'FINISHED'].includes(value)) return 'finished';
    if (['POSTP', 'POSTPONED'].includes(value)) return 'postponed';
    if (['CANC', 'CANCL', 'CANCELLED', 'CANCELED'].includes(value)) return 'cancelled';
    if (['NS', 'NOT_STARTED', 'SCHEDULED'].includes(value)) return 'scheduled';
    return 'unknown';
  }

  private currentScores(scores: unknown): Map<string, number> {
    const result = new Map<string, number>();
    if (!Array.isArray(scores)) return result;

    for (const item of scores) {
      if (String(item?.description || '').toUpperCase() !== 'CURRENT') continue;
      const participantId = item?.participant_id;
      const rawGoals = item?.score?.goals;
      if (rawGoals === null || rawGoals === undefined || rawGoals === '') continue;
      const goals = Number(rawGoals);
      if (participantId !== null && participantId !== undefined && Number.isFinite(goals)) {
        result.set(String(participantId), goals);
      }
    }
    return result;
  }

  private explicitMinute(raw: any): number | undefined {
    const candidates = [raw?.minute, raw?.state?.minute, raw?.time?.minute];
    for (const value of candidates) {
      if (value === null || value === undefined || value === '') continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return undefined;
  }

  private utcDate(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    const date = value.trim().replace(' ', 'T');
    return /Z$|[+-]\d{2}:?\d{2}$/.test(date) ? date : `${date}Z`;
  }

  private dedupe(matches: NormalizedMatch[]): NormalizedMatch[] {
    return Array.from(new Map(matches.map((match) => [match.id, match])).values());
  }
}

export const sportMonksClient = new SportMonksClient();
