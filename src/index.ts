// ============================================
// CDM 2026 Live Backend - Main Server Entry
// ============================================
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import aiRoutes from './routes/ai';
import matchesRoutes from './routes/matches';
import notificationsRoutes from './routes/notifications';
import widgetRoutes from './routes/widget';
import { sourceFetcherService } from './services/source-fetcher-service';
import { serverCache } from './services/server-cache';
import { BACKEND_VERSION } from './config/version';
import { hasConfigValue } from './utils/env';
import { createRateLimiter, isAllowedOrigin } from './middleware/security';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '100kb' }));

const widgetDirectory = path.join(__dirname, '..', 'web-widget');
app.use('/widget', express.static(widgetDirectory, { index: 'index.html' }));

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CDM 2026 Live Backend',
    version: BACKEND_VERSION,
  });
});

app.get('/diagnostic', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'CDM 2026 Live Backend',
    version: BACKEND_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    checks: {
      fapiConfigured: hasConfigValue('FAPI_API_KEY', 'THESTATSAPI_KEY'),
      sportDbConfigured: hasConfigValue('SPORTDB_API_KEY'),
      sportMonksConfigured: process.env.LIVE_SCORE_PROVIDER?.trim().toLowerCase() === 'sportmonks'
        && hasConfigValue('LIVE_SCORE_API_KEY'),
      geminiConfigured: hasConfigValue('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'GOOGLE_API_KEY'),
      worldCupTourConfigured: true,
      whenIsKickoffConfigured: true,
      openFootballConfigured: true,
    },
    cache: serverCache.snapshot(),
    endpoints: {
      health: '/health',
      diagnostic: '/diagnostic',
      sources: '/sources',
      sourcesHealth: '/sources/health',
      articles: '/articles',
      news: '/news',
      videos: '/videos',
      interviews: '/interviews',
      injuries: '/injuries',
      training: '/training',
      ai: '/ai/*',
      matches: '/matches/*',
      notifications: '/notifications/*',
      widget: '/widget',
      widgetApi: '/api/widget/*',
    },
  });
});

app.get('/sources', (req: Request, res: Response) => {
  res.json({
    success: true,
    sources: sourceFetcherService.getBackendSources(),
    mediaSources: sourceFetcherService.getAvailableMediaSources(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/sources/health', async (req: Request, res: Response) => {
  const health = await sourceFetcherService.getSourcesHealth();
  res.json({
    success: true,
    ...health,
    timestamp: new Date().toISOString(),
  });
});

app.get('/articles', async (req: Request, res: Response) => {
  res.json(await sourceFetcherService.fetchArticles());
});

app.get('/news', async (req: Request, res: Response) => {
  res.json(await sourceFetcherService.fetchNews());
});

app.get('/videos', async (req: Request, res: Response) => {
  res.json(await sourceFetcherService.fetchVideos());
});

app.get('/interviews', async (req: Request, res: Response) => {
  res.json(await sourceFetcherService.fetchInterviews());
});

app.get('/injuries', async (req: Request, res: Response) => {
  res.json(await sourceFetcherService.fetchInjuries());
});

app.get('/training', async (req: Request, res: Response) => {
  res.json(await sourceFetcherService.fetchTraining());
});

app.use('/ai', createRateLimiter({ windowMs: 60_000, maxRequests: 20 }), aiRoutes);
app.use('/matches', matchesRoutes);
app.use('/notifications', createRateLimiter({ windowMs: 60_000, maxRequests: 30 }), notificationsRoutes);
app.use('/api/widget', widgetRoutes);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599
    ? err.status
    : 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction
    ? (status >= 500 ? 'Internal server error' : 'Request failed')
    : (err?.message || 'Internal server error');

  console.error(`Request failed (${status}) on ${req.method} ${req.path}`);
  res.status(status).json({
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`CDM 2026 Backend ${BACKEND_VERSION} running on port ${PORT}`);
  console.log('Health check route: /health');
  console.log('Diagnostic route: /diagnostic');
});

export default app;
