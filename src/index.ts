// ============================================
// CDM 2026 Live Backend - Main Entry Point
// ============================================
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import matchesRouter from './routes/matches';
import aiRouter from './routes/ai';
import notificationsRouter from './routes/notifications';
import { agentOrchestrator } from './services/agent-orchestrator-service';
import { hasConfigValue } from './utils/env';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ========== Middleware ==========

app.use(helmet());
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN) === '*'
    ? '*'
    : (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '').split(','),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// Simple rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10);

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    next();
    return;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ success: false, error: 'Rate limit exceeded' });
    return;
  }
  next();
});

// ========== Health Check ==========

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cdm2026-backend-v5',
  });
});

// ========== API Routes ==========

app.use('/matches', matchesRouter);
app.use('/ai', aiRouter);
app.use('/notifications', notificationsRouter);

app.get('/diagnostic', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cdm2026-backend-v5',
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    checks: {
      fapiConfigured: hasConfigValue('FAPI_API_KEY', 'THESTATSAPI_KEY'),
      sportDbConfigured: hasConfigValue('SPORTDB_API_KEY'),
      geminiConfigured: hasConfigValue('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'GOOGLE_API_KEY'),
      firebaseConfigured: hasConfigValue(
        'FIREBASE_PROJECT_ID',
        'FIREBASE_SERVICE_ACCOUNT_BASE64',
        'FIREBASE_SERVICE_ACCOUNT_JSON',
        'GOOGLE_APPLICATION_CREDENTIALS'
      ),
      agentsConfigured: agentOrchestrator.listAgents().map((agent) => agent.name),
    },
    routes: [
      'GET /health',
      'GET /',
      'GET /matches/live',
      'GET /matches/today',
      'GET /matches/upcoming',
      'GET /matches/standings',
      'GET /articles',
      'GET /videos',
      'GET /interviews',
      'GET /injuries',
      'GET /training',
      'GET /diagnostic',
    ],
  });
});

app.get('/articles', async (req, res) => {
  try {
    const result = await agentOrchestrator.runAgent('MediaAgent', {
      topic: 'actualites Coupe du Monde 2026',
      message: 'Prepare 3 breves actualites utiles pour l application. Si les sources sont vides, explique clairement ce qui manque.',
    });
    res.json({
      items: [
        {
          id: `media-agent-${Date.now()}`,
          title: 'Actualites CDM 2026',
          summary: result.geminiAvailable ? 'Synthese IA basee sur les sources serveur.' : 'IA temporairement indisponible.',
          content: result.content,
          source: 'MediaAgent + Gemini',
          publishedAt: result.timestamp,
          reliability: result.reliability,
          sources: result.sources,
        },
      ],
    });
  } catch {
    res.json({
      items: [
        {
          id: 'backend-ready',
          title: 'CDM 2026 Live V5 connecte',
          summary: 'Le backend Render est en ligne. Les sources live officielles sont interrogees cote serveur.',
          content: 'FAPI/TheStatsAPI est la source principale, SportDB/Flashscore sert de secours, Gemini reste cote backend.',
          source: 'Backend V5',
          publishedAt: new Date().toISOString(),
        },
      ],
    });
  }
});

app.get('/news', async (req, res) => {
  try {
    const result = await agentOrchestrator.runAgent('MediaAgent', {
      topic: 'news Coupe du Monde 2026',
      message: 'Resume les news disponibles pour la Coupe du Monde 2026 avec prudence.',
    });
    res.json({
      items: [
        {
          id: `news-agent-${Date.now()}`,
          title: 'Actualites CDM 2026',
          summary: result.geminiAvailable ? 'News generees cote backend.' : 'IA temporairement indisponible.',
          content: result.content,
          source: 'MediaAgent + Gemini',
          publishedAt: result.timestamp,
          reliability: result.reliability,
          sources: result.sources,
        },
      ],
    });
  } catch {
    res.json({
      items: [
        {
          id: 'news-fallback',
          title: 'Actualites CDM 2026',
          summary: 'Flux actualites en attente de donnees officielles. Le fallback empeche toute page blanche.',
          content: 'Les futures actualites pourront etre servies par RSS, sources officielles et Gemini cote backend.',
          source: 'Backend V5',
          publishedAt: new Date().toISOString(),
        },
      ],
    });
  }
});

app.get('/videos', async (req, res) => {
  try {
    const result = await agentOrchestrator.runAgent('MediaAgent', {
      topic: 'videos et medias Coupe du Monde 2026',
      message: 'Prepare un point videos et medias. N invente pas de lien video si aucune source ne le donne.',
    });
    res.json({
      items: [
        {
          title: 'Videos CDM 2026',
          content: result.content,
          reliability: result.reliability,
          updatedAt: result.timestamp,
          source: 'MediaAgent + Gemini',
          sources: result.sources,
        },
      ],
    });
  } catch {
    res.json({
      items: [
        {
          title: 'Videos CDM 2026',
          content: 'Aucune video officielle disponible pour le moment. Les flux YouTube restent cote backend.',
          reliability: 'unconfirmed',
          updatedAt: new Date().toISOString(),
          source: 'Backend V5',
        },
      ],
    });
  }
});

app.get('/interviews', async (req, res) => {
  try {
    const result = await agentOrchestrator.runAgent('InterviewAgent', {
      playerName: 'un joueur africain a suivre',
      occasion: 'avant la Coupe du Monde 2026',
      message: 'Prepare un court point interviews sans inventer de citation directe.',
    });
    res.json({
      items: [
        {
          title: 'Interviews CDM 2026',
          content: result.content,
          reliability: result.reliability,
          updatedAt: result.timestamp,
          source: 'InterviewAgent + Gemini',
          sources: result.sources,
        },
      ],
    });
  } catch {
    res.json({
      items: [
        {
          title: 'Interviews',
          content: 'Aucune interview officielle disponible pour le moment. Les donnees locales restent affichees dans Android.',
          reliability: 'unconfirmed',
          updatedAt: new Date().toISOString(),
          source: 'Backend V5',
        },
      ],
    });
  }
});

app.get('/injuries', async (req, res) => {
  try {
    const result = await agentOrchestrator.runAgent('InjuryAgent', {
      teamName: 'equipes africaines et favoris CDM 2026',
      message: 'Prepare un etat blessures prudent sans affirmer de blessure non confirmee.',
    });
    res.json({
      items: [
        {
          title: 'Blessures CDM 2026',
          content: result.content,
          reliability: result.reliability,
          updatedAt: result.timestamp,
          source: 'InjuryAgent + Gemini',
          sources: result.sources,
        },
      ],
    });
  } catch {
    res.json({
      items: [
        {
          title: 'Blessures',
          content: 'Aucune blessure confirmee par les sources serveur pour le moment.',
          reliability: 'unconfirmed',
          updatedAt: new Date().toISOString(),
          source: 'Backend V5',
        },
      ],
    });
  }
});

app.get('/training', async (req, res) => {
  try {
    const result = await agentOrchestrator.runAgent('TrainingAgent', {
      teamName: 'equipes africaines CDM 2026',
      message: 'Prepare un point entrainement prudent et utile.',
    });
    res.json({
      items: [
        {
          title: 'Entrainements CDM 2026',
          content: result.content,
          reliability: result.reliability,
          updatedAt: result.timestamp,
          source: 'TrainingAgent + Gemini',
          sources: result.sources,
        },
      ],
    });
  } catch {
    res.json({
      items: [
        {
          title: 'Entrainements',
          content: 'Aucun rapport entrainement serveur disponible pour le moment. Les donnees locales restent affichees dans Android.',
          reliability: 'unconfirmed',
          updatedAt: new Date().toISOString(),
          source: 'Backend V5',
        },
      ],
    });
  }
});

app.get('/trust', (req, res) => {
  res.json({
    primary: 'FAPI/TheStatsAPI',
    fallback: 'SportDB/Flashscore',
    ai: 'Gemini',
    agents: agentOrchestrator.listAgents().map((agent) => agent.name),
    secrets: 'hidden',
  });
});

// ========== API Documentation ==========

app.get('/', (req, res) => {
  res.json({
    name: 'CDM 2026 Live by Redha - Backend API',
    version: '5.0.0',
    endpoints: {
      matches: {
        'GET /matches/live': 'Get all currently live matches',
        'GET /matches/today': 'Get all matches scheduled for today',
        'GET /matches/upcoming?days=7': 'Get upcoming matches',
        'GET /matches/standings': 'Get group stage standings',
        'GET /matches/:id': 'Get match detail by ID',
        'GET /matches/:id/events': 'Get match timeline events',
        'GET /matches/:id/stats': 'Get match statistics',
        'GET /matches/:id/lineups': 'Get match lineups',
      },
      ai: {
        'POST /ai/chat': 'General AI chat (agent, message, matchContext?, matchId?)',
        'POST /ai/commentary': 'Live commentary (matchContext, event, matchId)',
        'POST /ai/analysis': 'Tactical analysis (matchContext, matchId)',
        'POST /ai/prediction': 'Match prediction (matchContext, matchId)',
        'POST /ai/article': 'News article (topic, matchContext?, matchId?)',
        'POST /ai/injury-report': 'Injury report (teamName, matchContext?)',
        'POST /ai/interview': 'Fictional interview (playerName, occasion, matchContext?, matchId?)',
        'POST /ai/training-report': 'Training report (teamName, matchContext?)',
        'GET /ai/agents': 'List internal hidden agents',
        'POST /ai/agents/:agent': 'Run an internal hidden agent with server-side source context',
        'POST /ai/orchestrate': 'Run all internal hidden agents',
      },
      notifications: {
        'POST /notifications/register': 'Register FCM token (token)',
        'POST /notifications/unregister': 'Unregister FCM token (token)',
        'GET /notifications/tokens': 'List registered tokens',
        'POST /notifications/test': 'Send test notification (title?, body?)',
      },
      diagnostic: {
        'GET /health': 'Minimal health check',
        'GET /diagnostic': 'Safe deployment diagnostic without secrets',
        'GET /articles': 'Global articles feed',
        'GET /videos': 'Global videos/media feed',
        'GET /interviews': 'Global interviews feed',
        'GET /injuries': 'Global injuries feed',
        'GET /training': 'Global training feed',
      },
    },
    sources: {
      primary: 'FAPI/TheStatsAPI',
      fallback: 'SportDB',
      ai: 'Google Gemini',
    },
  });
});

// ========== 404 Handler ==========

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    hint: 'Visit / for API documentation',
  });
});

// ========== Error Handler ==========

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ========== Start Server ==========

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   CDM 2026 Live by Redha - Backend v5.0.0   ║
  ╠══════════════════════════════════════════════╣
  ║  Port:     ${PORT}                               ║
  ║  Sources:  FAPI (primary) + SportDB (fallback)║
  ║  AI:       Google Gemini                     ║
  ║  Env:      ${process.env.NODE_ENV || 'development'}                          ║
  ╚══════════════════════════════════════════════╝
  `);
});

export default app;
