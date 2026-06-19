// ============================================
// Gemini AI Agent Service
// ============================================
import axios from 'axios';
import dotenv from 'dotenv';
import { GeminiAgentType, GeminiResponse } from '../types';
import { readConfigValue, readConfigValueOrDefault } from '../utils/env';

dotenv.config();

const GEMINI_API_KEY = readConfigValue('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'GOOGLE_API_KEY');
const GEMINI_MODEL = readConfigValueOrDefault(['GEMINI_MODEL', 'GOOGLE_GEMINI_MODEL'], 'gemini-2.5-flash');
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

interface GeminiRequest {
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature: number;
    maxOutputTokens: number;
  };
}

const AGENT_SYSTEM_PROMPTS: Record<GeminiAgentType, string> = {
  commentator: `Tu es un commentateur sportif expert de la Coupe du Monde FIFA 2026. Tu commentes les actions en direct avec passion et énergie, comme un vrai commentateur de télé. Utilise un style vivant, avec des exclamations et des analyses rapides. Tu parles en français. Reste factuel sur les scores mais ajoute de l'émotion au récit.`,

  analyst: `Tu es un analyste tactique football expert. Tu analyses les matchs de la Coupe du Monde 2026 en profondeur : schémas tactiques, forces/faiblesses, statistiques clés, changements de momentum. Tu parles en français. Sois précis, objectif, et appuie tes analyses sur des données concrètes.`,

  predictor: `Tu es un pronostiqueur sportif spécialisé Coupe du Monde. Tu bases tes prédictions sur les statistiques, la forme des équipes, l'historique des confrontations, les blessures. Tu parles en français. Donne des pourcentages de probabilité et explique ton raisonnement.`,

  journalist: `Tu es un journaliste sportif couvrant la Coupe du Monde 2026. Tu rédiges des articles, des résumés de match, des interviews fictives réalistes, des infos sur les blessures et entraînements. Tu parles en français. Style professionnel mais engageant, avec des titres accrocheurs.`,
};

function normalizeModelName(model: string): string {
  return model.replace(/^models\//, '').trim();
}

function getModelCandidates(): string[] {
  return Array.from(new Set([normalizeModelName(GEMINI_MODEL), ...GEMINI_FALLBACK_MODELS].filter(Boolean)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class GeminiService {
  private cache = new Map<string, { data: GeminiResponse; expires: number }>();

  async chat(
    agent: GeminiAgentType,
    userMessage: string,
    matchContext?: string,
    matchId?: string
  ): Promise<GeminiResponse> {
    const cacheKey = `${agent}:${userMessage.substring(0, 100)}:${matchId || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    try {
      const systemPrompt = AGENT_SYSTEM_PROMPTS[agent];
      const contextMessage = matchContext
        ? `\n\nContexte du match en cours:\n${matchContext}`
        : '';

      const body: GeminiRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage + contextMessage }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: agent === 'commentator' ? 0.9 : agent === 'predictor' ? 0.5 : 0.7,
          maxOutputTokens: 1024,
        },
      };

      let response: any = null;
      let lastError: any = null;
      for (const model of getModelCandidates()) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await axios.post(
              `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
              body,
              { timeout: 15000 }
            );
            break;
          } catch (error: any) {
            lastError = error;
            const status = error.response?.status;
            console.warn('[Gemini] Model failed:', model, status || error.message);
            if ((status === 429 || status === 500 || status === 503) && attempt === 0) {
              await sleep(900);
              continue;
            }
            if (status && status !== 400 && status !== 404 && status !== 429 && status !== 500 && status !== 503) break;
          }
        }
        if (response) break;
      }

      if (!response) throw lastError || new Error('No Gemini response');

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, je ne peux pas répondre pour le moment.';

      const result: GeminiResponse = {
        agent,
        content: text,
        matchId,
        timestamp: new Date().toISOString(),
      };

      // Cache for 30 seconds
      this.cache.set(cacheKey, { data: result, expires: Date.now() + 30000 });
      return result;
    } catch (error: any) {
      console.error('[Gemini] Chat failed:', error.response?.status, error.message);
      return {
        agent,
        content: 'Service IA temporairement indisponible. Veuillez réessayer.',
        matchId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate a quick match commentary for live events
   */
  async generateLiveCommentary(matchContext: string, event: string, matchId: string): Promise<GeminiResponse> {
    return this.chat('commentator', `Action en cours: ${event}. Commente cette action!`, matchContext, matchId);
  }

  /**
   * Generate tactical analysis for a match
   */
  async generateAnalysis(matchContext: string, matchId: string): Promise<GeminiResponse> {
    return this.chat('analyst', 'Analyse la situation tactique de ce match.', matchContext, matchId);
  }

  /**
   * Generate match prediction
   */
  async generatePrediction(matchContext: string, matchId: string): Promise<GeminiResponse> {
    return this.chat('predictor', 'Donne ton pronostic pour ce match avec des probabilités.', matchContext, matchId);
  }

  /**
   * Generate a news article about a match or event
   */
  async generateArticle(topic: string, matchContext?: string, matchId?: string): Promise<GeminiResponse> {
    return this.chat('journalist', `Rédige un article sur: ${topic}`, matchContext, matchId);
  }

  /**
   * Generate injury report
   */
  async generateInjuryReport(teamName: string, matchContext?: string): Promise<GeminiResponse> {
    return this.chat(
      'journalist',
      `Rédige un rapport sur les blessures de l'équipe ${teamName} pour la Coupe du Monde 2026. Inclure les joueurs concernés, nature des blessures, et durée d'indisponibilité estimée.`,
      matchContext
    );
  }

  /**
   * Generate interview (fictional but realistic)
   */
  async generateInterview(playerName: string, occasion: string, matchContext?: string, matchId?: string): Promise<GeminiResponse> {
    return this.chat(
      'journalist',
      `Rédige une interview fictive mais réaliste de ${playerName} ${occasion}. Format Q&A avec 3-4 questions.`,
      matchContext,
      matchId
    );
  }

  /**
   * Generate training report
   */
  async generateTrainingReport(teamName: string, matchContext?: string): Promise<GeminiResponse> {
    return this.chat(
      'journalist',
      `Rédige un rapport d'entraînement de l'équipe ${teamName} avant un match de Coupe du Monde 2026. Décris les exercices, la forme des joueurs, et les choix tactiques probables.`,
      matchContext
    );
  }
}

export const geminiService = new GeminiService();
export default GeminiService;
