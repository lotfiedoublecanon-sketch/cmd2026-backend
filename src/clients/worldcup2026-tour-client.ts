// ============================================
// World Cup 2026 Tour Public API client
// ============================================
import axios, { AxiosInstance, AxiosError } from 'axios';
import { readConfigValueOrDefault } from '../utils/env';

const BASE_URL = readConfigValueOrDefault(
  ['WORLDCUP2026_TOUR_BASE_URL'],
  'https://ay-worldcup2026.zeabur.app/api/public/v1'
);
const TIMEOUT = parseInt(process.env.WORLDCUP2026_TOUR_TIMEOUT_MS || '8000', 10);

class WorldCup2026TourClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: TIMEOUT,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CDM2026-Live-Backend/5.0.10',
      },
    });
  }

  async getMetadata(): Promise<any> {
    return this.request('/metadata');
  }

  async getMatches(timezone = 'Europe/Paris'): Promise<any[]> {
    const data = await this.request('/matches', { timezone });
    return this.extractMatches(data);
  }

  async getToday(timezone = 'Europe/Paris'): Promise<any[]> {
    const data = await this.request('/today', { timezone });
    return this.extractMatches(data);
  }

  async getNext(timezone = 'Europe/Paris'): Promise<any | null> {
    const data = await this.request('/next', { timezone });
    return data?.match || data?.next || data?.data || data || null;
  }

  async getMatchById(id: string | number, timezone = 'Europe/Paris'): Promise<any | null> {
    const data = await this.request(`/matches/${id}`, { timezone });
    return data?.match || data?.data || data || null;
  }

  async health(): Promise<{ ok: boolean; itemCount: number; checkedAt: string; error?: string }> {
    const checkedAt = new Date().toISOString();
    try {
      const matches = await this.getMatches();
      return { ok: true, itemCount: matches.length, checkedAt };
    } catch (error) {
      return { ok: false, itemCount: 0, checkedAt, error: this.safeError(error) };
    }
  }

  private async request(path: string, params?: Record<string, string>): Promise<any> {
    try {
      const response = await this.client.get(path, { params });
      return response.data;
    } catch (error) {
      const axiosErr = error as AxiosError;
      console.error('[WorldCupTour] request failed:', path, axiosErr.response?.status, axiosErr.message);
      throw error;
    }
  }

  private extractMatches(data: any): any[] {
    const candidates = [data?.matches, data?.data, data?.items, data?.results];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  private safeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export const worldCup2026TourClient = new WorldCup2026TourClient();
export default WorldCup2026TourClient;
