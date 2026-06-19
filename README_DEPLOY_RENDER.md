# Render deployment

Deploy this folder as the Render service root:

`work/extracted/backend_v5/cdm2025-backend`

Build command:

`npm install && npm run build`

Start command:

`npm start`

The server listens on:

`process.env.PORT || 3000`

Required public checks before rebuilding the Android APK:

- `GET https://URL_RENDER_PUBLIQUE_FONCTIONNELLE/health`
- `GET https://URL_RENDER_PUBLIQUE_FONCTIONNELLE/matches/live`
- `GET https://URL_RENDER_PUBLIQUE_FONCTIONNELLE/matches/today`
- `GET https://URL_RENDER_PUBLIQUE_FONCTIONNELLE/ai/agents`
- `POST https://URL_RENDER_PUBLIQUE_FONCTIONNELLE/ai/agents/ScoreAgent`

Do not put `.env` or API key values in Android. Configure secrets only as Render environment variables.

Gemini:

- Set `GEMINI_API_KEY` only in Render environment variables.
- Use `GEMINI_MODEL=gemini-2.5-flash` or leave it absent so the backend fallback can select a supported model.
- Hidden agents available server-side: `GeminiOrchestrator`, `Commentateur`, `Analyste`, `Pronostiqueur`, `Journaliste`, `ScoreAgent`, `CardAgent`, `InjuryAgent`, `InterviewAgent`, `TrainingAgent`, `MediaAgent`, `TrustAgent`, `NotificationAgent`.
