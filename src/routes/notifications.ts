// ============================================
// API Routes - Notifications (FCM)
// ============================================
import { Router, Request, Response } from 'express';
import { notificationService } from '../services/notification-service';

const router = Router();

/**
 * POST /notifications/register
 * Register a device token for push notifications
 * Body: { token: string }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: 'Missing: token' });
      return;
    }
    notificationService.registerToken(token);
    res.json({ success: true, message: 'Token registered' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /notifications/unregister
 * Unregister a device token
 * Body: { token: string }
 */
router.post('/unregister', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: 'Missing: token' });
      return;
    }
    notificationService.unregisterToken(token);
    res.json({ success: true, message: 'Token unregistered' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /notifications/tokens
 * Get all registered tokens (admin only - should be protected in production)
 */
router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const tokens = notificationService.getRegisteredTokens();
    res.json({ success: true, count: tokens.length, tokens: tokens.map(t => t.substring(0, 20) + '...') });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /notifications/test
 * Send a test notification to all registered devices
 * Body: { title: string, body: string }
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { title, body } = req.body;
    await notificationService.sendToAll({
      title: title || 'Test CDM 2026',
      body: body || 'Ceci est une notification test de CDM 2026 Live!',
      type: 'general',
    });
    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
