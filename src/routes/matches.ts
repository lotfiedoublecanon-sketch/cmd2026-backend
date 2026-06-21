// ============================================
// API Routes - Match endpoints
// ============================================
import { Router, Request, Response } from 'express';
import { mergeService } from '../services/merge-service';
import { agentOrchestrator } from '../services/agent-orchestrator-service';
import { ApiResponse, NormalizedMatch, MatchEvent, MatchStats, MatchLineups, StandingEntry } from '../types';

const router = Router();

function standingsAsGroups(entries: StandingEntry[] = []) {
  const groups = new Map<string, StandingEntry[]>();
  for (const entry of entries) {
    const groupName = entry.group || 'Groupes';
    groups.set(groupName, [...(groups.get(groupName) || []), entry]);
  }

  return Array.from(groups.entries()).map(([name, rows]) => ({
    name,
    entries: rows.map((entry) => ({
      teamId: entry.team.id,
      teamName: entry.team.name,
      teamCode: entry.team.threeCharCode || entry.team.shortName || null,
      teamFlag: entry.team.logoUrl || null,
      played: entry.played,
      won: entry.won,
      drawn: entry.drawn,
      lost: entry.lost,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      goalDifference: entry.goalDifference,
      points: entry.points,
    })),
  }));
}

function nowIso(): string {
  return new Date().toISOString();
}

function listResponse<T>(result: ApiResponse<T[]>) {
  const updatedAt = nowIso();
  return {
    ...result,
    items: result.data,
    cachedAt: updatedAt,
    updatedAt,
    fallback: result.source === 'cache',
  };
}

function emptyListResponse(error?: string) {
  const updatedAt = nowIso();
  return {
    success: false,
    data: [],
    items: [],
    source: 'backend',
    cachedAt: updatedAt,
    updatedAt,
    fallback: true,
    ...(error ? { error } : {}),
  };
}

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
    res.json(listResponse(result));
  } catch (error) {
    res.json(emptyListResponse((error as Error).message));
  }
});

/**
 * GET /matches/today
 * Get all matches scheduled for today
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getTodayMatches();
    res.json(listResponse(result));
  } catch (error) {
    res.json(emptyListResponse((error as Error).message));
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
    res.json(listResponse(result));
  } catch (error) {
    res.json(emptyListResponse((error as Error).message));
  }
});

/**
 * GET /matches/standings
 * Get group stage standings
 */
router.get('/standings', async (req: Request, res: Response) => {
  try {
    const result = await mergeService.getStandings();
    const groups = standingsAsGroups(result.data);
    const response = {
      ...result,
      data: { groups },
      groups,
      cachedAt: nowIso(),
      updatedAt: nowIso(),
      fallback: result.source === 'cache',
    };
    res.json(response);
  } catch (error) {
    res.json({
      success: false,
      data: { groups: [] },
      groups: [],
      source: 'backend',
      cachedAt: nowIso(),
      updatedAt: nowIso(),
      fallback: true,
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
    res.json(listResponse(result));
  } catch (error) {
    res.json(emptyListResponse((error as Error).message));
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
      cachedAt: nowIso(),
      updatedAt: nowIso(),
    };
    res.json(response);
  } catch (error) {
    res.json({
      success: false,
      data: null,
      source: 'backend',
      cachedAt: nowIso(),
      updatedAt: nowIso(),
      fallback: true,
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
      cachedAt: nowIso(),
      updatedAt: nowIso(),
    };
    res.json(response);
  } catch (error) {
    res.json({
      success: false,
      data: null,
      source: 'backend',
      cachedAt: nowIso(),
      updatedAt: nowIso(),
      fallback: true,
      error: (error as Error).message,
    });
  }
});

router.get('/:id/commentary', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await agentOrchestrator.runAgent('Commentateur', {
      event: 'Mise a jour du match',
      matchContext,
      matchId: req.params.id,
    });
    res.json({
      matchId: req.params.id,
      items: [{ minute: 0, text: result.content }],
      agent: result.agent,
      geminiAvailable: result.geminiAvailable,
      sources: result.sources,
    });
  } catch (error) {
    res.status(500).json({ matchId: req.params.id, items: [], error: (error as Error).message });
  }
});

router.get('/:id/analysis', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await agentOrchestrator.runAgent('Analyste', { matchContext, matchId: req.params.id });
    res.json({
      matchId: req.params.id,
      content: result.content,
      reliability: result.reliability,
      updatedAt: result.timestamp,
      agent: result.agent,
      geminiAvailable: result.geminiAvailable,
      sources: result.sources,
    });
  } catch (error) {
    res.status(500).json({ matchId: req.params.id, content: '', reliability: 'unconfirmed', error: (error as Error).message });
  }
});

router.get('/:id/prediction', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await agentOrchestrator.runAgent('Pronostiqueur', { matchContext, matchId: req.params.id });
    res.json({
      matchId: req.params.id,
      prediction: result.content,
      confidence: null,
      reliability: result.reliability,
      updatedAt: result.timestamp,
      agent: result.agent,
      geminiAvailable: result.geminiAvailable,
      sources: result.sources,
    });
  } catch (error) {
    res.status(500).json({ matchId: req.params.id, prediction: '', reliability: 'unconfirmed', error: (error as Error).message });
  }
});

router.get('/:id/injuries', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await agentOrchestrator.runAgent('InjuryAgent', {
      teamName: 'les equipes du match',
      matchContext,
      matchId: req.params.id,
    });
    res.json({ items: [{ title: 'Blessures', content: result.content, reliability: result.reliability, updatedAt: result.timestamp, source: 'InjuryAgent + Gemini' }] });
  } catch {
    res.json({ items: [] });
  }
});

router.get('/:id/interviews', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await agentOrchestrator.runAgent('InterviewAgent', {
      playerName: 'un joueur cle',
      occasion: 'apres ce match',
      matchContext,
      matchId: req.params.id,
    });
    res.json({ items: [{ title: 'Interviews', content: result.content, reliability: result.reliability, updatedAt: result.timestamp, source: 'InterviewAgent + Gemini' }] });
  } catch {
    res.json({ items: [] });
  }
});

router.get('/:id/training', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await agentOrchestrator.runAgent('TrainingAgent', {
      teamName: 'les equipes du match',
      matchContext,
      matchId: req.params.id,
    });
    res.json({ items: [{ title: 'Entrainements', content: result.content, reliability: result.reliability, updatedAt: result.timestamp, source: 'TrainingAgent + Gemini' }] });
  } catch {
    res.json({ items: [] });
  }
});

router.get('/:id/media', async (req: Request, res: Response) => {
  try {
    const matchContext = await getMatchContext(req.params.id);
    const result = await agentOrchestrator.runAgent('MediaAgent', {
      topic: 'medias et actualites du match',
      matchContext,
      matchId: req.params.id,
    });
    res.json({ items: [{ title: 'Medias', content: result.content, reliability: result.reliability, updatedAt: result.timestamp, source: 'MediaAgent + Gemini' }] });
  } catch {
    res.json({ items: [] });
  }
});

export default router;
