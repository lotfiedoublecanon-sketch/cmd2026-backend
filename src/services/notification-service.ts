// ============================================
// Firebase Cloud Messaging Service
// ============================================
import dotenv from 'dotenv';
import { NotificationPayload } from '../types';

dotenv.config();

// Firebase Admin SDK - initialized lazily
let firebaseApp: any = null;
let messaging: any = null;

function initializeFirebase(): boolean {
  if (firebaseApp) return true;

  try {
    const admin = require('firebase-admin');
    const fs = require('fs');
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let credentialConfig: any = null;

    if (serviceAccountBase64) {
      const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      credentialConfig = JSON.parse(serviceAccountJson);
    } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      credentialConfig = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } else if (projectId && privateKey && clientEmail) {
      credentialConfig = {
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      };
    }

    if (!credentialConfig) {
      console.warn('[FCM] Firebase credentials not configured. Notifications will be logged only.');
      return false;
    }

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(credentialConfig),
    });

    messaging = admin.messaging();
    console.log('[FCM] Firebase Admin initialized successfully');
    return true;
  } catch (error) {
    console.warn('[FCM] Firebase initialization failed:', (error as Error).message);
    return false;
  }
}

class NotificationService {
  private tokens = new Set<string>();
  private initialized = false;

  constructor() {
    this.initialized = initializeFirebase();
  }

  /**
   * Register a device token for push notifications
   */
  registerToken(token: string): void {
    this.tokens.add(token);
    console.log(`[FCM] Token registered: ${token.substring(0, 20)}... (${this.tokens.size} total)`);
  }

  /**
   * Unregister a device token
   */
  unregisterToken(token: string): void {
    this.tokens.delete(token);
    console.log(`[FCM] Token unregistered: ${token.substring(0, 20)}... (${this.tokens.size} total)`);
  }

  /**
   * Get all registered tokens
   */
  getRegisteredTokens(): string[] {
    return Array.from(this.tokens);
  }

  /**
   * Send a notification to all registered devices
   */
  async sendToAll(payload: NotificationPayload): Promise<void> {
    const tokens = Array.from(this.tokens);
    if (tokens.length === 0) {
      console.log(`[FCM] No tokens registered. Logging notification: ${payload.title} - ${payload.body}`);
      return;
    }

    if (!this.initialized || !messaging) {
      console.log(`[FCM] Not initialized. Logging: [${payload.type}] ${payload.title}: ${payload.body}`);
      return;
    }

    try {
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: payload.type,
          matchId: payload.matchId || '',
          ...payload.data,
        },
        tokens,
      };

      const response = await messaging.sendMulticast(message);
      console.log(`[FCM] Sent to ${response.successCount} devices, ${response.failureCount} failures`);

      // Remove invalid tokens
      if (response.responses) {
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
            this.tokens.delete(tokens[idx]);
          }
        });
      }
    } catch (error) {
      console.error('[FCM] Send failed:', (error as Error).message);
    }
  }

  /**
   * Send notification to a specific token
   */
  async sendToToken(token: string, payload: NotificationPayload): Promise<boolean> {
    if (!this.initialized || !messaging) {
      console.log(`[FCM] Not initialized. Logging: [${payload.type}] ${payload.title}: ${payload.body}`);
      return false;
    }

    try {
      await messaging.send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: payload.type,
          matchId: payload.matchId || '',
          ...payload.data,
        },
      });
      return true;
    } catch (error) {
      console.error('[FCM] Send to token failed:', (error as Error).message);
      return false;
    }
  }

  // ========== Match event notifications ==========

  async notifyGoal(matchId: string, teamName: string, playerName: string, minute: number, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number): Promise<void> {
    await this.sendToAll({
      title: `⚽ BUT! ${teamName}`,
      body: `${playerName} (${minute}') — ${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
      matchId,
      type: 'goal',
      data: { team: teamName, player: playerName, minute: String(minute) },
    });
  }

  async notifyCard(matchId: string, teamName: string, playerName: string, cardType: 'yellow' | 'red', minute: number): Promise<void> {
    const emoji = cardType === 'red' ? '🟥' : '🟨';
    await this.sendToAll({
      title: `${emoji} Carton ${cardType === 'red' ? 'rouge' : 'jaune'} - ${teamName}`,
      body: `${playerName} (${minute}')`,
      matchId,
      type: 'card',
      data: { team: teamName, player: playerName, cardType, minute: String(minute) },
    });
  }

  async notifyMatchStart(matchId: string, homeTeam: string, awayTeam: string): Promise<void> {
    await this.sendToAll({
      title: '🏟️ Coup d\'envoi!',
      body: `${homeTeam} vs ${awayTeam} — Le match commence!`,
      matchId,
      type: 'start',
    });
  }

  async notifyMatchEnd(matchId: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number): Promise<void> {
    await this.sendToAll({
      title: '🏁 Fin du match',
      body: `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
      matchId,
      type: 'end',
    });
  }

  async notifyLineup(matchId: string, homeTeam: string, awayTeam: string): Promise<void> {
    await this.sendToAll({
      title: '📋 Compositions officielles',
      body: `${homeTeam} vs ${awayTeam} — Les compositions sont tombées!`,
      matchId,
      type: 'lineup',
    });
  }

  async notifyVAR(matchId: string, description: string): Promise<void> {
    await this.sendToAll({
      title: '📺 VAR - Révision en cours',
      body: description,
      matchId,
      type: 'var',
    });
  }
}

export const notificationService = new NotificationService();
export default NotificationService;
