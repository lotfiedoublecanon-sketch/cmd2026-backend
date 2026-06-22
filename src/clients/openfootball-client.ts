// ============================================
// OpenFootball worldcup.json fallback client
// ============================================
import axios, { AxiosInstance, AxiosError } from 'axios';
import { readConfigValueOrDefault } from '../utils/env';

const BASE_URL = readConfigValueOrDefault(
  ['OPENFOOTBALL_WORLDCUP_2026_URL'],
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
);
const TIMEOUT = parseInt(process.env.OPENFOOTBALL_TIMEOUT_MS || '8000', 10);

class OpenFootballClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: TIMEOUT,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CDM2026-Live-Backend/5.0.10',
      },
    });
  }

  async getMatches(): Promise<any[]> {
    try {
      const response = await this.client.get(BASE_URL);
      const matches = response.data?.matches || response.data?.data || [];
      return Array.isArray(matches) ? matches : [];
    } catch (error) {
      const axiosErr = error as AxiosError;
      console.error('[OpenFootball] request failed:', axiosErr.response?.status, axiosErr.message);
      throw error;
    }
  }

  async health(): Promise<{ ok: boolean; itemCount: number; checkedAt: string; error?: string }> {
    const checkedAt = new Date().toISOString();
    try {
      const matches = await this.getMatches();
      return { ok: true, itemCount: matches.length, checkedAt };
    } catch (error) {
      return { ok: false, itemCount: 0, checkedAt, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export const openFootballClient = new OpenFootballClient();
export default OpenFootballClient;
