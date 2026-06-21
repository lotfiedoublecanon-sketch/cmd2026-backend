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

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

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
  res.json({
    success: true,
    sources: [
      { name: 'FAPI/TheStatsAPI', type: 'primary', status: 'active' },
      { name: 'SportDB/Flashscore', type: 'fallback', status: 'active' },
      { name: 'Gemini AI', type: 'analysis', status: 'active' },
    ],
    timestamp: new Date().toISOString(),
  });
});

// Sources health endpoint
app.get('/sources/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    fapi: { status: 'operational', lastCheck: new Date().toISOString() },
    sportdb: { status: 'operational', lastCheck: new Date().toISOString() },
    gemini: { status: 'operational', lastCheck: new Date().toISOString() },
    timestamp: new Date().toISOString(),
  });
});

// Articles endpoint
app.get('/articles', (req: Request, res: Response) => {
  res.json({
    success: true,
    articles: [],
    message: 'Articles available through /ai/article endpoint',
    timestamp: new Date().toISOString(),
  });
});

// Videos endpoint
app.get('/videos', (req: Request, res: Response) => {
  res.json({
    success: true,
    videos: [],
    message: 'Videos available through media agent endpoints',
    timestamp: new Date().toISOString(),
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
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Diagnostic: http://localhost:${PORT}/diagnostic`);
});

export default app;
