// ============================================
// CDM 2026 Live Backend - Main Server Entry
// ============================================
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import aiRoutes from './routes/ai';
import matchesRoutes from './routes/matches';
import notificationsRoutes from './routes/notifications';
import { agentOrchestrator } from './services/agent-orchestrator-service';
import { sourceFetcherService } from './services/source-fetcher-service';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

type PublicMediaCategory = 'news' | 'articles' | 'videos' | 'interviews' | 'injuries' | 'training';

interface PublicMediaRoute {
  category: PublicMediaCategory;
  title: string;
  agent: string;
  input: Record<string, unknown>;
}

const EMPTY_SOURCE_MESSAGE = 'Aucune donnée source disponible pour le moment';

const FALLBACK_MEDIA_URLS: Record<PublicMediaCategory, string> = {
  news: 'https://news.google.com/search?q=Coupe%20du%20Monde%202026%20football&hl=fr&gl=FR&ceid=FR:fr',
  articles: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026',
  videos: 'https://www.youtube.com/results?search_query=Coupe+du+Monde+2026+football',
  interviews: 'https://news.google.com/search?q=Coupe%20du%20Monde%202026%20interview%20football&hl=fr&gl=FR&ceid=FR:fr',
  injuries: 'https://news.google.com/search?q=Coupe%20du%20Monde%202026%20blessures%20football&hl=fr&gl=FR&ceid=FR:fr',
  training: 'https://news.google.com/search?q=Coupe%20du%20Monde%202026%20entrainement%20football&hl=fr&gl=FR&ceid=FR:fr',
};

function timestamp(): string {
  return new Date().toISOString();
}

function mediaEnvelope(items: unknown[], fallback = false, message?: string) {
  return {
    success: true,
    items,
    updatedAt: timestamp(),
    source: 'backend',
    fallback,
    ...(message ? { message } : {}),
  };
}

async function sendAgentMedia(res: Response, route: PublicMediaRoute): Promise<void> {
  try {
    const result = await agentOrchestrator.runAgent(route.agent, route.input);
    const fallbackUrl = FALLBACK_MEDIA_URLS[route.category];
    res.json(mediaEnvelope([
      {
        id: `${route.category}-${Date.now()}`,
        title: route.title,
        summary: result.content,
        content: result.content,
        url: fallbackUrl,
        link: fallbackUrl,
        sourceUrl: fallbackUrl,
        source_url: fallbackUrl,
        canonicalUrl: fallbackUrl,
        source: result.geminiAvailable ? `${result.agent} + Gemini` : 'Backend fallback',
        sourceType: 'agent',
        publishedAt: result.timestamp,
        category: route.category,
        team: null,
        confidence: result.reliability === 'source-backed' ? 0.82 : 0.55,
        reliability: result.reliability,
        language: 'fr',
      },
    ]));
  } catch {
    res.json(mediaEnvelope([], true, EMPTY_SOURCE_MESSAGE));
  }
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CDM 2026 Live Backend',
    version: '5.0.0',
  });
});

// Diagnostic endpoint
app.get('/diagnostic', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'CDM 2026 Live Backend',
    version: '5.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    endpoints: {
      health: '/health',
      diagnostic: '/diagnostic',
      sources: '/sources',
      sourcesHealth: '/sources/health',
      articles: '/articles',
      news: '/news (POST & GET)',
      videos: '/videos',
      interviews: '/interviews (POST & GET)',
      injuries: '/injuries (POST & GET)',
      training: '/training (POST & GET)',
      ai: '/ai/*',
      matches: '/matches/*',
      notifications: '/notifications/*',
    },
  });
});

// Sources endpoint
app.get('/sources', (req: Request, res: Response) => {
  const sources = sourceFetcherService.getAvailableMediaSources();
  res.json({
    success: true,
    items: sources,
    sources,
    updatedAt: timestamp(),
    source: 'backend',
    fallback: false,
  });
});

// Sources health endpoint
app.get('/sources/health', async (req: Request, res: Response) => {
  const checkedAt = timestamp();
  const health = await sourceFetcherService.getSourcesHealth();
  const mediaSources = sourceFetcherService.getAvailableMediaSources();
  res.json({
    success: true,
    items: [
      {
        name: 'FAPI/TheStatsAPI',
        status: health.fapi.status === 'operational' ? 'OK' : 'erreur',
        itemCount: 0,
        lastCheck: health.fapi.lastCheck,
        sourceType: 'api',
      },
      {
        name: 'SportDB/Flashscore',
        status: health.sportdb.status === 'operational' ? 'OK' : 'erreur',
        itemCount: 0,
        lastCheck: health.sportdb.lastCheck,
        sourceType: 'api',
      },
      ...mediaSources.map((source) => ({
        name: source.name,
        status: source.active ? 'OK' : 'erreur',
        itemCount: 0,
        lastCheck: checkedAt,
        sourceType: source.type,
      })),
    ],
    updatedAt: checkedAt,
    source: 'backend',
    fallback: false,
  });
});

// Articles endpoint
app.get('/articles', (req: Request, res: Response) => {
  void sendAgentMedia(res, {
    category: 'articles',
    title: 'Actualités CDM 2026',
    agent: 'Journaliste',
    input: { topic: 'actualites Coupe du Monde 2026' },
  });
});

// News endpoint
app.get('/news', (req: Request, res: Response) => {
  void sendAgentMedia(res, {
    category: 'news',
    title: 'News CDM 2026',
    agent: 'MediaAgent',
    input: { topic: 'news Coupe du Monde 2026' },
  });
});

// Videos endpoint
app.get('/videos', (req: Request, res: Response) => {
  void sendAgentMedia(res, {
    category: 'videos',
    title: 'Vidéos CDM 2026',
    agent: 'MediaAgent',
    input: { topic: 'videos et highlights Coupe du Monde 2026' },
  });
});

app.get('/interviews', (req: Request, res: Response) => {
  void sendAgentMedia(res, {
    category: 'interviews',
    title: 'Interviews CDM 2026',
    agent: 'InterviewAgent',
    input: { playerName: 'un joueur important', occasion: 'autour de la Coupe du Monde 2026' },
  });
});

app.get('/injuries', (req: Request, res: Response) => {
  void sendAgentMedia(res, {
    category: 'injuries',
    title: 'Blessures CDM 2026',
    agent: 'InjuryAgent',
    input: { teamName: 'les équipes africaines' },
  });
});

app.get('/training', (req: Request, res: Response) => {
  void sendAgentMedia(res, {
    category: 'training',
    title: 'Entraînements CDM 2026',
    agent: 'TrainingAgent',
    input: { teamName: 'les équipes africaines' },
  });
});

// Mount route modules
app.use('/ai', aiRoutes);
app.use('/matches', matchesRoutes);
app.use('/notifications', notificationsRoutes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ CDM 2026 Backend running on port ${PORT}`);
  console.log('Health check route: /health');
  console.log('Diagnostic route: /diagnostic');
});

export default app;
