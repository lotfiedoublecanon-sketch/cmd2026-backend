// ============================================
// API Routes - Match endpoints
// ============================================
import { Router, Request, Response } from 'express';
import { mergeService } from '../services/merge-service';
import { geminiService } from '../services/gemini-service';
import { ApiResponse, NormalizedMatch, MatchEvent, MatchStats, MatchLineups } from '../types';

const router = Router();

async function getMatchContext(matchId: string): Promise<string> {
  const result = await mergeService.getMatchById(matchId);
  const match = result.data;
  if (!match) return `Match ${matchId}`;
  return [
    `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    `Score: ${match.homeScore}-${match.awayScore}`,
    `Statut: ${match.status}`,
    match.minute ? `Minute: ${match.minute}` : '',
    match.venue ? `Stade: ${match.venue}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * GET /matches/live
 * Get all currently live matches
 */
router.get('/live', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getLiveMatches();
    const response: ApiResponse<NormalizedMatch[]> = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: [],
      source: 'fapi',
      error: (error as Error).message,
    });
  }
});

/**
 * GET /matches/today
 * Get all matches scheduled for today
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getTodayMatches();
    const response: ApiResponse<NormalizedMatch[]> = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: [],
      source: 'fapi',
      error: (error as Error).message,
    });
  }
});

/**
 * GET /matches/upcoming
 * Get upcoming matches (next N days)
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const result = await mergeService.getUpcomingMatches(days);
    const response: ApiResponse<NormalizedMatch[]> = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: [],
      source: 'fapi',
      error: (error as Error).message,
    });
  }
});

/**
 * GET /matches/standings
 * Get group stage standings
 */
router.get('/standings', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getStandings();
    const response = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: [],
      source: 'fapi',
      error: (error as Error).message,
    });
  }
});

/**
 * GET /matches/:id
 * Get match detail by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getMatchById(req.params.id);
    const response: ApiResponse<NormalizedMatch | null> = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    if (!result.data) {
      res.status(404).json(response);
    } else {
      res.json(response);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      source: 'fapi',
      error: (error as Error).message,
    });
  }
});

/**
 * GET /matches/:id/events
 * Get match timeline events
 */
router.get('/:id/events', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getMatchEvents(req.params.id);
    const response: ApiResponse<MatchEvent[]> = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: [],
      source: 'fapi',
      error: (error as Error).message,
    });
  }
});

/**
 * GET /matches/:id/stats
 * Get match statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getMatchStats(req.params.id);
    const response: ApiResponse<MatchStats | null> = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      source: 'fapi',
      error: (error as Error).message,
    });
  }
});

/**
 * GET /matches/:id/lineups
 * Get match lineups
 */
router.get('/:id/lineups', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getMatchLineups(req.params.id);
    const response: ApiResponse<MatchLineups | null> = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      source: 'fapi',
      error: (error as Error).message,
    });
  }
});

router.get('/:id/commentary', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await geminiService.generateLiveCommentary(matchContext, 'Mise a jour du match', req.params.id);
    res.json({
      matchId: req.params.id,
      items: [{ minute: 0, text: result.content }],
    });
  } catch (error) {
    res.status(500).json({ matchId: req.params.id, items: [], error: (error as Error).message });
  }
});

router.get('/:id/analysis', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await geminiService.generateAnalysis(matchContext, req.params.id);
    res.json({
      matchId: req.params.id,
      content: result.content,
      reliability: 'unconfirmed',
      updatedAt: result.timestamp,
    });
  } catch (error) {
    res.status(500).json({ matchId: req.params.id, content: '', reliability: 'unconfirmed', error: (error as Error).message });
  }
});

router.get('/:id/prediction', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await geminiService.generatePrediction(matchContext, req.params.id);
    res.json({
      matchId: req.params.id,
      prediction: result.content,
      confidence: null,
      reliability: 'unconfirmed',
      updatedAt: result.timestamp,
    });
  } catch (error) {
    res.status(500).json({ matchId: req.params.id, prediction: '', reliability: 'unconfirmed', error: (error as Error).message });
  }
});

router.get('/:id/injuries', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await geminiService.generateInjuryReport('les equipes du match', matchContext);
    res.json({ items: [{ title: 'Blessures', content: result.content, reliability: 'unconfirmed', updatedAt: result.timestamp, source: 'Backend IA' }] });
  } catch {
    res.json({ items: [] });
  }
});

router.get('/:id/interviews', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await geminiService.generateInterview('un joueur cle', 'apres ce match', matchContext, req.params.id);
    res.json({ items: [{ title: 'Interviews', content: result.content, reliability: 'unconfirmed', updatedAt: result.timestamp, source: 'Backend IA' }] });
  } catch {
    res.json({ items: [] });
  }
});

router.get('/:id/training', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await geminiService.generateTrainingReport('les equipes du match', matchContext);
    res.json({ items: [{ title: 'Entrainements', content: result.content, reliability: 'unconfirmed', updatedAt: result.timestamp, source: 'Backend IA' }] });
  } catch {
    res.json({ items: [] });
  }
});

router.get('/:id/media', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await geminiService.generateArticle('medias et actualites du match', matchContext, req.params.id);
    res.json({ items: [{ title: 'Medias', content: result.content, reliability: 'unconfirmed', updatedAt: result.timestamp, source: 'Backend IA' }] });
  } catch {
    res.json({ items: [] });
  }
});

export default router;
