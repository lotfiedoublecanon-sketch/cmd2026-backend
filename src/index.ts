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
import { sourceFetcherService } from './services/source-fetcher-service';
import { serverCache } from './services/server-cache';
import { BACKEND_VERSION } from './config/version';
import { hasConfigValue } from './utils/env';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

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

app.get('/articles', (req: Request, res: Response) => {
  res.json({
    success: true,
    items: [],
    articles: [],
    message: 'Aucune donnee source disponible pour le moment',
    timestamp: new Date().toISOString(),
  });
});

app.get('/news', (req: Request, res: Response) => {
  res.json({
    success: true,
    items: [],
    message: 'Aucune donnee source disponible pour le moment',
    timestamp: new Date().toISOString(),
  });
});

app.get('/videos', (req: Request, res: Response) => {
  res.json({
    success: true,
    items: [],
    videos: [],
    message: 'Aucune video disponible pour le moment',
    timestamp: new Date().toISOString(),
  });
});

app.get('/interviews', (req: Request, res: Response) => {
  res.json({ success: true, items: [], message: 'Aucune interview disponible pour le moment', timestamp: new Date().toISOString() });
});

app.get('/injuries', (req: Request, res: Response) => {
  res.json({ success: true, items: [], message: 'Aucune blessure confirmee pour le moment', timestamp: new Date().toISOString() });
});

app.get('/training', (req: Request, res: Response) => {
  res.json({ success: true, items: [], message: 'Aucun entrainement disponible pour le moment', timestamp: new Date().toISOString() });
});

app.use('/ai', aiRoutes);
app.use('/matches', matchesRoutes);
app.use('/notifications', notificationsRoutes);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err?.message || 'Internal server error');
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
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
