import axios, { AxiosInstance } from 'axios';
import {
  LiveMatchesResult,
  MatchStatus,
  NormalizedMatch,
  TeamInfo,
} from '../types';

const ESPN_BASE_URL = process.env.ESPN_SOCCER_BASE_URL?.trim()
  || 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_WORLD_CUP_LEAGUE = process.env.ESPN_WORLD_CUP_LEAGUE?.trim()
  || 'fifa.world';
const ESPN_TIMEOUT = Number.parseInt(process.env.ESPN_TIMEOUT_MS || '8000', 10);

export class EspnLiveClient {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ESPN_BASE_URL,
      timeout: Number.isFinite(ESPN_TIMEOUT) ? ESPN_TIMEOUT : 8000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CDM2026-Live-Backend/5.0',
      },
    });
  }

  async getLiveMatches(): Promise<LiveMatchesResult> {
    try {
      const response = await this.client.get(`/${ESPN_WORLD_CUP_LEAGUE}/scoreboard`, {
        params: {
          dates: this.dateWindow(),
          limit: 100,
        },
      });
      const events = Array.isArray(response.data?.events) ? response.data.events : [];
      const matches = events
        .map((event: unknown) => this.normalizeMatch(event))
        .filter((match: NormalizedMatch | null): match is NormalizedMatch => Boolean(match))
        .filter((match: NormalizedMatch) => match.isInProgress);

      return { matches: this.dedupe(matches), requestSucceeded: true };
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      console.warn(`[ESPN public] live request failed${status ? ` (${status})` : ''}`);
      return { matches: [], requestSucceeded: false };
    }
  }

  normalizeMatch(raw: any): NormalizedMatch | null {
    if (!raw?.id || !Array.isArray(raw?.competitions) || raw.competitions.length === 0) {
      return null;
    }

    const competition = raw.competitions[0];
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const homeRaw = competitors.find((item: any) => item?.homeAway === 'home');
    const awayRaw = competitors.find((item: any) => item?.homeAway === 'away');
    if (!homeRaw?.team || !awayRaw?.team) return null;

    const status = this.mapStatus(raw.status?.type || competition?.status?.type);
    const live = ['in_progress', 'halftime', 'extra_time', 'penalties'].includes(status);
    if (!live) return null;

    const homeScore = this.score(homeRaw.score);
    const awayScore = this.score(awayRaw.score);
    if (homeScore === null || awayScore === null) return null;

    return {
      id: `espn-${raw.id}`,
      source: 'espn-public',
      sourceUsed: 'espn-public',
      competitionId: String(raw.league?.id || competition?.league?.id || ESPN_WORLD_CUP_LEAGUE),
      competitionName: String(raw.league?.name || competition?.league?.name || 'FIFA World Cup 2026'),
      seasonName: String(raw.season?.year || '2026'),
      stage: String(competition?.type?.text || raw.season?.type || ''),
      round: competition?.round?.displayName || competition?.round?.number || undefined,
      homeTeam: this.normalizeTeam(homeRaw.team),
      awayTeam: this.normalizeTeam(awayRaw.team),
      status,
      minute: this.minute(raw.status?.displayClock || competition?.status?.displayClock),
      startDateTimeUtc: this.utcDate(raw.date || competition?.date),
      homeScore,
      awayScore,
      isFinished: false,
      isInProgress: true,
      venue: competition?.venue?.fullName || undefined,
    };
  }

  private mapStatus(type: any): MatchStatus {
    const name = String(type?.name || '').trim().toUpperCase();
    const detail = String(type?.shortDetail || type?.detail || type?.description || '')
      .trim()
      .toUpperCase();
    const state = String(type?.state || '').trim().toLowerCase();

    if (name.includes('HALFTIME') || ['HT', 'HALF TIME', 'HALFTIME'].includes(detail)) {
      return 'halftime';
    }
    if (name.includes('PENAL') || detail.includes('PEN')) return 'penalties';
    if (name.includes('EXTRA') || detail.includes('EXTRA TIME')) return 'extra_time';
    if (state === 'in' || name.includes('IN_PROGRESS') || name.includes('LIVE')) {
      return 'in_progress';
    }
    if (state === 'post' || name.includes('FINAL')) return 'finished';
    if (name.includes('POSTPON')) return 'postponed';
    if (name.includes('CANCEL')) return 'cancelled';
    if (state === 'pre') return 'scheduled';
    return 'unknown';
  }

  private normalizeTeam(raw: any): TeamInfo {
    const code = String(raw?.abbreviation || raw?.shortDisplayName || 'TBD').toUpperCase();
    return {
      id: String(raw?.id || ''),
      name: String(raw?.displayName || raw?.name || 'Unknown'),
      shortName: code,
      threeCharCode: code,
      logoUrl: raw?.logo || undefined,
    };
  }

  private score(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private minute(value: unknown): number | undefined {
    const match = String(value || '').match(/\d+/);
    if (!match) return undefined;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private utcDate(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  private dateWindow(): string {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return `${this.dateKey(start)}-${this.dateKey(end)}`;
  }

  private dateKey(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private dedupe(matches: NormalizedMatch[]): NormalizedMatch[] {
    return Array.from(new Map(matches.map((match) => [match.id, match])).values());
  }
}

export const espnLiveClient = new EspnLiveClient();
