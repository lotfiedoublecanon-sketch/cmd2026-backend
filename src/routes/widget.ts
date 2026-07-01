import { Request, Response, Router } from 'express';
import { bracketService } from '../services/bracket-service';
import { featuredService } from '../services/featured-service';
import { groupService } from '../services/group-service';
import { widgetService } from '../services/widget-service';
import { WidgetLiveDataStatus, WidgetResponse } from '../types';

const router = Router();

type WidgetHandler = () => Promise<unknown>;

function send(handler: WidgetHandler) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json(await handler());
    } catch (error) {
      console.error('[Widget API]', safeError(error));
      res.status(500).json(errorResponse(error));
    }
  };
}

router.get('/live', send(() => widgetService.getLive()));
router.get('/today', send(() => widgetService.getToday()));
router.get('/featured', send(() => featuredService.getFeatured()));
router.get('/bracket', send(() => bracketService.getBracket()));
router.get('/knockout', send(() => bracketService.getBracket()));
router.get('/bracket/status', send(() => bracketService.getStatus()));
router.get('/groups', send(() => groupService.getGroups()));

router.get('/upcoming', async (req: Request, res: Response): Promise<void> => {
  try {
    const days = positiveInteger(req.query.days, 7, 365);
    res.json(await widgetService.getUpcoming(days));
  } catch (error) {
    console.error('[Widget API]', safeError(error));
    res.status(500).json(errorResponse(error));
  }
});

router.get('/status', send(() => widgetService.getStatus()));

router.get('/events/:matchId', async (req: Request, res: Response): Promise<void> => {
  if (!isValidMatchId(req.params.matchId)) {
    res.status(400).json({
      success: false,
      items: [],
      sourceUsed: 'backend',
      lastUpdatedAt: new Date().toISOString(),
      liveDataStatus: 'unavailable',
      error: 'Identifiant de match invalide',
    } satisfies WidgetResponse<never>);
    return;
  }

  try {
    res.json(await widgetService.getEvents(req.params.matchId));
  } catch (error) {
    console.error('[Widget API]', safeError(error));
    res.status(500).json(errorResponse(error));
  }
});

router.get('/stats/:matchId', async (req: Request, res: Response): Promise<void> => {
  if (!isValidMatchId(req.params.matchId)) {
    res.status(400).json({
      success: false,
      items: [],
      sourceUsed: 'backend',
      lastUpdatedAt: new Date().toISOString(),
      liveDataStatus: 'unavailable',
      error: 'Identifiant de match invalide',
    } satisfies WidgetResponse<never>);
    return;
  }

  try {
    res.json(await widgetService.getStats(req.params.matchId));
  } catch (error) {
    console.error('[Widget API]', safeError(error));
    res.status(500).json(errorResponse(error));
  }
});

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function isValidMatchId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function errorResponse(error: unknown): WidgetResponse<never> {
  const liveDataStatus: WidgetLiveDataStatus = 'unavailable';
  return {
    success: false,
    items: [],
    sourceUsed: 'backend',
    lastUpdatedAt: new Date().toISOString(),
    liveDataStatus,
    error: 'Service widget temporairement indisponible',
  };
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

export default router;
