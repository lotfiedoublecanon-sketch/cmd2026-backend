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
      fapiConfigured: Boolean(process.env.FAPI_API_KEY || process.env.THESTATSAPI_KEY),
      sportDbConfigured: Boolean(process.env.SPORTDB_API_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      firebaseConfigured: Boolean(
        process.env.FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS
      ),
    },
    routes: [
      'GET /health',
      'GET /',
      'GET /matches/live',
      'GET /matches/today',
      'GET /matches/upcoming',
      'GET /matches/standings',
      'GET /diagnostic',
    ],
  });
});

app.get('/articles', (req, res) => {
  res.json({ items: [] });
});

app.get('/trust', (req, res) => {
  res.json({
    primary: 'FAPI/TheStatsAPI',
    fallback: 'SportDB/Flashscore',
    ai: 'Gemini',
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
