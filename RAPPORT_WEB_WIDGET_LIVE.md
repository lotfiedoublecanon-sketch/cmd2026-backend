# Rapport Web Widget Live CDM 2026

Date de validation locale : 2026-06-29

## Livraison

- URL finale active : `https://lotfiedoublecanon-sketch.github.io/cmd2026-backend/web-widget/`
- URL Render preparee : `https://cmd2026-backend-1.onrender.com/widget/`
- Branche : `feature/web-live-widget-score`
- Backend modifie : oui, ajout isole des routes et du service widget
- Android V5.0.15 modifie : non
- Render redeploye : non, l'auto-deploiement n'a pas demarre apres le push `main`
- Hebergement actif : GitHub Pages, avec appels au backend Render public

## Fichiers

- `web-widget/index.html`
- `web-widget/style.css`
- `web-widget/app.js`
- `web-widget/logo-cdm2026.png`
- `web-widget/README_WEB_WIDGET.md`
- `src/routes/widget.ts`
- `src/services/widget-service.ts`
- `src/index.ts`
- `src/types.ts`
- `.env.example`
- `.gitignore`
- `RAPPORT_WEB_WIDGET_LIVE.md`

## Endpoints

- `GET /api/widget/live`
- `GET /api/widget/today`
- `GET /api/widget/upcoming?days=60`
- `GET /api/widget/status`
- `GET /api/widget/events/:matchId`

Sur Render, le frontend utilise ces URL relatives. Sur GitHub Pages, il appelle les routes `/matches/*` du backend Render public. Il ne contient aucune cle et ne contacte jamais directement un fournisseur de scores.

## Sources et veracite

- Live principal : FAPI/TheStatsAPI configure dans les variables Render existantes.
- Secours live : TheSportsDB configure dans les variables Render existantes.
- Calendrier : World Cup 2026 Tour, puis When Is Kickoff et OpenFootball selon la logique backend existante.
- Aucune source ne confirme un live : `items: []` et message clair.
- Coup d'envoi passe sans score confirme : `AWAITING_LIVE_DATA`, sans score, minute ou evenement invente.
- `sim-model.json` et `probs.json` ne sont jamais utilises comme resultats officiels.

Les cles restent exclusivement dans Render Environment Variables. `.env` est ignore et `.env.example` ne contient que des valeurs vides ou placeholders.

## Tests backend

- `npm.cmd run build` : OK
- `node --check web-widget/app.js` : OK
- `git diff --check` : OK
- `/health` : HTTP 200, backend 5.0.10
- `/api/widget/live` : HTTP 200, 0 item confirme, source `backend`
- `/api/widget/today` : HTTP 200, 1 item, source `worldcup2026-tour`, etat `AWAITING_LIVE_DATA`
- `/api/widget/upcoming?days=60` : HTTP 200, 31 items, source `worldcup2026-tour`
- `/api/widget/status` : HTTP 200
- `/matches/standings` : HTTP 200, 12 groupes
- `/videos`, `/interviews`, `/injuries`, `/training` : HTTP 200, 30 items chacune

## Tests web et QA

- Desktop 1280 x 720 : OK
- Mobile 360 x 720 : OK, aucun debordement horizontal
- Petit mobile 320 x 640 : OK, aucun debordement horizontal
- Onglets Live, Aujourd'hui, A venir : OK
- Reduire puis agrandir : OK
- Bouton Actualiser : OK
- Serveur indisponible : message generique et bouton Reessayer : OK
- Reessayer apres reprise du serveur : retour a 31 cartes : OK
- Live vide : `Aucun match en direct actuellement`
- Score absent : `Score non disponible`
- Match passe sans donnees : `Match en attente de donnees live`
- Refresh : 15 secondes / 60 secondes / 5 minutes

## Securite

- Aucun secret ajoute au frontend, au code backend ou au rapport.
- Aucun `.env`, keystore ou secret Firebase Admin ajoute.
- Aucune URL locale ni ancien backend dans le widget.
- Aucun fournisseur expire ou interdit n'a ete ajoute.
- Les erreurs techniques backend ne sont pas exposees par l'API widget.

## Limites

Le widget ne peut afficher un score live que lorsqu'une source backend fiable le confirme. Un live absent des fournisseurs reste volontairement vide. Les noms `TBD` fournis par le calendrier officiel restent affiches tant que les equipes ne sont pas encore determinees. L'URL Render `/widget/` restera en 404 jusqu'au prochain deploiement manuel du commit `main`; GitHub Pages fournit l'URL active en attendant.
