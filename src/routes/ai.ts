// ============================================
// API Routes - Hidden AI Agent endpoints
// ============================================
import { Router, Request, Response } from 'express';
import { agentOrchestrator } from '../services/agent-orchestrator-service';

const router = Router();

function topicFallback(title: string, content: string, source = 'Backend IA'): { items: Array<{ title: string; content: string; reliability: string; updatedAt: string; source: string }> } {
  return {
    items: [
      {
        title,
        content,
        reliability: 'unconfirmed',
        updatedAt: new Date().toISOString(),
        source,
      },
    ],
  };
}

function validAgentNames(): string {
  return agentOrchestrator.listAgents().map((agent) => agent.name).join(', ');
}

router.get('/agents', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: agentOrchestrator.listAgents(),
  });
});

router.post('/agents/:agent', async (req: Request, res: Response) => {
  try {
    const agentName = req.params.agent;
    if (!agentOrchestrator.resolveAgent(agentName)) {
      res.status(400).json({ success: false, error: `Invalid agent type. Must be one of: ${validAgentNames()}` });
      return;
    }

    const result = await agentOrchestrator.runAgent(agentName, req.body || {});
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/orchestrate', async (req: Request, res: Response) => {
  try {
    const results = await agentOrchestrator.runAll(req.body || {});
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /ai/chat
 * Body: { agent: string, message: string, matchContext?: string, matchId?: string }
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

    if (!agentOrchestrator.resolveAgent(agent)) {
      res.status(400).json({
        success: false,
        error: `Invalid agent type. Must be one of: ${validAgentNames()}`,
      });
      return;
    }

    const result = await agentOrchestrator.runAgent(agent, { message, matchContext, matchId });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

router.post('/commentary', async (req: Request, res: Response) => {
  try {
    const { matchContext, event, matchId } = req.body;
    if (!event || !matchId) {
      res.status(400).json({ success: false, error: 'Missing: event, matchId' });
      return;
    }

    const result = await agentOrchestrator.runAgent('Commentateur', {
      message: `Commente cette action: ${event}`,
      matchContext,
      event,
      matchId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/analysis', async (req: Request, res: Response) => {
  try {
    const { matchContext, matchId } = req.body;
    if (!matchId) {
      res.status(400).json({ success: false, error: 'Missing: matchId' });
      return;
    }

    const result = await agentOrchestrator.runAgent('Analyste', { matchContext, matchId });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/prediction', async (req: Request, res: Response) => {
  try {
    const { matchContext, matchId } = req.body;
    if (!matchId) {
      res.status(400).json({ success: false, error: 'Missing: matchId' });
      return;
    }

    const result = await agentOrchestrator.runAgent('Pronostiqueur', { matchContext, matchId });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/article', async (req: Request, res: Response) => {
  try {
    const { topic, matchContext, matchId } = req.body;
    if (!topic) {
      res.status(400).json({ success: false, error: 'Missing: topic' });
      return;
    }

    const result = await agentOrchestrator.runAgent('Journaliste', { topic, matchContext, matchId });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/summary', async (req: Request, res: Response) => {
  try {
    const { matchContext, matchId } = req.body;
    const result = await agentOrchestrator.runAgent('Journaliste', {
      message: 'Resume court du match.',
      topic: 'resume court du match',
      matchContext,
      matchId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/news', async (req: Request, res: Response) => {
  try {
    const { topic, matchContext, matchId } = req.body;
    const result = await agentOrchestrator.runAgent('MediaAgent', {
      topic: topic || 'actualites Coupe du Monde 2026',
      matchContext,
      matchId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/injury-report', async (req: Request, res: Response) => {
  try {
    const { teamName, matchContext } = req.body;
    if (!teamName) {
      res.status(400).json({ success: false, error: 'Missing: teamName' });
      return;
    }

    const result = await agentOrchestrator.runAgent('InjuryAgent', { teamName, matchContext });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/injuries', async (req: Request, res: Response) => {
  try {
    const { teamName, matchContext } = req.body;
    const result = await agentOrchestrator.runAgent('InjuryAgent', {
      teamName: teamName || 'les equipes africaines',
      matchContext,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/interview', async (req: Request, res: Response) => {
  try {
    const { playerName, occasion, matchContext, matchId } = req.body;
    if (!playerName || !occasion) {
      res.status(400).json({ success: false, error: 'Missing: playerName, occasion' });
      return;
    }

    const result = await agentOrchestrator.runAgent('InterviewAgent', { playerName, occasion, matchContext, matchId });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/interviews', async (req: Request, res: Response) => {
  try {
    const { playerName, occasion, matchContext, matchId } = req.body;
    const result = await agentOrchestrator.runAgent('InterviewAgent', {
      playerName: playerName || 'un joueur important',
      occasion: occasion || 'autour de la Coupe du Monde 2026',
      matchContext,
      matchId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/training-report', async (req: Request, res: Response) => {
  try {
    const { teamName, matchContext } = req.body;
    if (!teamName) {
      res.status(400).json({ success: false, error: 'Missing: teamName' });
      return;
    }

    const result = await agentOrchestrator.runAgent('TrainingAgent', { teamName, matchContext });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/training', async (req: Request, res: Response) => {
  try {
    const { teamName, matchContext } = req.body;
    const result = await agentOrchestrator.runAgent('TrainingAgent', {
      teamName: teamName || 'les equipes africaines',
      matchContext,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/news', async (_req: Request, res: Response) => {
  try {
    const result = await agentOrchestrator.runAgent('MediaAgent', { topic: 'actualites Coupe du Monde 2026' });
    res.json(topicFallback('Actualites CDM 2026', result.content, 'MediaAgent + Gemini'));
  } catch {
    res.json(topicFallback(
      'Actualites CDM 2026',
      'Les flux publics ne sont pas encore disponibles. Les sources serveur restent pretes: FAPI/TheStatsAPI, SportDB/Flashscore et Gemini.'
    ));
  }
});

router.get('/injuries', async (_req: Request, res: Response) => {
  try {
    const result = await agentOrchestrator.runAgent('InjuryAgent', { teamName: 'les equipes africaines' });
    res.json(topicFallback('Blessures', result.content, 'InjuryAgent + Gemini'));
  } catch {
    res.json(topicFallback('Blessures', 'Aucune blessure confirmee pour le moment.', 'Backend IA'));
  }
});

router.get('/interviews', async (_req: Request, res: Response) => {
  try {
    const result = await agentOrchestrator.runAgent('InterviewAgent', {
      playerName: 'un joueur important',
      occasion: 'autour de la Coupe du Monde 2026',
    });
    res.json(topicFallback('Interviews', result.content, 'InterviewAgent + Gemini'));
  } catch {
    res.json(topicFallback('Interviews', 'Aucune interview officielle disponible pour le moment.', 'Backend IA'));
  }
});

router.get('/training', async (_req: Request, res: Response) => {
  try {
    const result = await agentOrchestrator.runAgent('TrainingAgent', { teamName: 'les equipes africaines' });
    res.json(topicFallback('Entrainements', result.content, 'TrainingAgent + Gemini'));
  } catch {
    res.json(topicFallback('Entrainements', 'Aucune information entrainement confirmee pour le moment.', 'Backend IA'));
  }
});

export default router;
