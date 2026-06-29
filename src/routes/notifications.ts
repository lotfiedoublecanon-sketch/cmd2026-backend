// ============================================
// API Routes - Notifications (FCM)
// ============================================
import { Router, Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification-service';
import { requireAdminToken } from '../middleware/security';

const router = Router();

/**
 * POST /notifications/register
 * Register a device token for push notifications
 * Body: { token: string }
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: 'Missing: token' });
      return;
    }
    notificationService.registerToken(token);
    res.json({ success: true, message: 'Token registered' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /notifications/unregister
 * Unregister a device token
 * Body: { token: string }
 */
router.post('/unregister', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: 'Missing: token' });
      return;
    }
    notificationService.unregisterToken(token);
    res.json({ success: true, message: 'Token unregistered' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /notifications/tokens
 * Get the registered token count (admin only)
 */
router.get('/tokens', requireAdminToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = notificationService.getRegisteredTokens();
    res.json({ success: true, count: tokens.length });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /notifications/test
 * Send a test notification to all registered devices
 * Body: { title: string, body: string }
 */
router.post('/test', requireAdminToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, body } = req.body;
    await notificationService.sendToAll({
      title: title || 'Test CDM 2026',
      body: body || 'Ceci est une notification test de CDM 2026 Live!',
      type: 'general',
    });
    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    next(error);
  }
});

export default router;
