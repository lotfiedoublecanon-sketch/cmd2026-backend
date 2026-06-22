// ============================================
// When Is Kickoff public JSON client
// ============================================
import axios, { AxiosInstance, AxiosError } from 'axios';
import { readConfigValueOrDefault } from '../utils/env';

const BASE_URL = readConfigValueOrDefault(
  ['WHENISKICKOFF_BASE_URL'],
  'https://wheniskickoff.com/data/v1'
);
const TIMEOUT = parseInt(process.env.WHENISKICKOFF_TIMEOUT_MS || '8000', 10);

class WhenIsKickoffClient {
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

  async getMatches(): Promise<any[]> {
    return this.getDataArray('/matches.json');
  }

  async getTeams(): Promise<any[]> {
    return this.getDataArray('/teams.json');
  }

  async getGroups(): Promise<any[]> {
    return this.getDataArray('/groups.json');
  }

  async getVenues(): Promise<any[]> {
    return this.getDataArray('/venues.json');
  }

  async getTv(): Promise<any[]> {
    return this.getDataArray('/tv.json');
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

  private async getDataArray(path: string): Promise<any[]> {
    try {
      const response = await this.client.get(path);
      const data = response.data?.data || response.data?.items || response.data?.matches || [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      const axiosErr = error as AxiosError;
      console.error('[WhenIsKickoff] request failed:', path, axiosErr.response?.status, axiosErr.message);
      throw error;
    }
  }

  private safeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export const whenIsKickoffClient = new WhenIsKickoffClient();
export default WhenIsKickoffClient;
