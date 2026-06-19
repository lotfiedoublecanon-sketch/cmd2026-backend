// ============================================
// API Routes - AI Agent endpoints
// ============================================
import { Router, Request, Response } from 'express';
import { geminiService } from '../services/gemini-service';
import { GeminiAgentType, GeminiResponse } from '../types';

const router = Router();

/**
 * POST /ai/chat
 * General AI chat with any agent type
 * Body: { agent: GeminiAgentType, message: string, matchContext?: string, matchId?: string }
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { agent, message, matchContext, matchId } = req.body;

    if (!agent || !message) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: agent, message',
      });
      return;
    }

    const validAgents: GeminiAgentType[] = ['commentator', 'analyst', 'predictor', 'journalist'];
    if (!validAgents.includes(agent)) {
      res.status(400).json({
        success: false,
        error: `Invalid agent type. Must be one of: ${validAgents.join(', ')}`,
      });
      return;
    }

    const result = await geminiService.chat(agent, message, matchContext, matchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /ai/commentary
 * Generate live commentary for a match event
 * Body: { matchContext: string, event: string, matchId: string }
 */
router.post('/commentary', async (req: Request, res: Response) => {
  try {
    const { matchContext, event, matchId } = req.body;
    if (!event || !matchId) {
      res.status(400).json({ success: false, error: 'Missing: event, matchId' });
      return;
    }
    const result = await geminiService.generateLiveCommentary(matchContext || '', event, matchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /ai/analysis
 * Generate tactical analysis
 * Body: { matchContext: string, matchId: string }
 */
router.post('/analysis', async (req: Request, res: Response) => {
  try {
    const { matchContext, matchId } = req.body;
    if (!matchId) {
      res.status(400).json({ success: false, error: 'Missing: matchId' });
      return;
    }
    const result = await geminiService.generateAnalysis(matchContext || '', matchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /ai/prediction
 * Generate match prediction
 * Body: { matchContext: string, matchId: string }
 */
router.post('/prediction', async (req: Request, res: Response) => {
  try {
    const { matchContext, matchId } = req.body;
    if (!matchId) {
      res.status(400).json({ success: false, error: 'Missing: matchId' });
      return;
    }
    const result = await geminiService.generatePrediction(matchContext || '', matchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /ai/article
 * Generate a news article
 * Body: { topic: string, matchContext?: string, matchId?: string }
 */
router.post('/article', async (req: Request, res: Response) => {
  try {
    const { topic, matchContext, matchId } = req.body;
    if (!topic) {
      res.status(400).json({ success: false, error: 'Missing: topic' });
      return;
    }
    const result = await geminiService.generateArticle(topic, matchContext, matchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /ai/injury-report
 * Generate injury report for a team
 * Body: { teamName: string, matchContext?: string }
 */
router.post('/injury-report', async (req: Request, res: Response) => {
  try {
    const { teamName, matchContext } = req.body;
    if (!teamName) {
      res.status(400).json({ success: false, error: 'Missing: teamName' });
      return;
    }
    const result = await geminiService.generateInjuryReport(teamName, matchContext);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /ai/interview
 * Generate a fictional but realistic interview
 * Body: { playerName: string, occasion: string, matchContext?: string, matchId?: string }
 */
router.post('/interview', async (req: Request, res: Response) => {
  try {
    const { playerName, occasion, matchContext, matchId } = req.body;
    if (!playerName || !occasion) {
      res.status(400).json({ success: false, error: 'Missing: playerName, occasion' });
      return;
    }
    const result = await geminiService.generateInterview(playerName, occasion, matchContext, matchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /ai/training-report
 * Generate training report
 * Body: { teamName: string, matchContext?: string }
 */
router.post('/training-report', async (req: Request, res: Response) => {
  try {
    const { teamName, matchContext } = req.body;
    if (!teamName) {
      res.status(400).json({ success: false, error: 'Missing: teamName' });
      return;
    }
    const result = await geminiService.generateTrainingReport(teamName, matchContext);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
