# Rapport Web Widget Live CDM 2026

Date de validation finale : 2026-06-29

## Livraison

- URL finale : `https://cmd2026-backend-1.onrender.com/widget`
- URL canonique avec slash : `https://cmd2026-backend-1.onrender.com/widget/`
- Branche : `feature/web-live-widget-score`
- Code fonctionnel valide : `c0502f5c9bd3b464100638c011e9c7a7909cd090`
- Backend modifie : oui, routes, normalisation live et securite
- Render redeploye : oui, par API sur le service `cmd2026-backend-1`
- Deploiement Render : `dep-d91bbdnlk1mc739u77ag`, statut `live`
- Android V5.0.15 modifie : non

## Fichiers

- `web-widget/index.html`
- `web-widget/style.css`
- `web-widget/app.js`
- `web-widget/logo-cdm2026.png`
- `web-widget/README_WEB_WIDGET.md`
- `src/routes/widget.ts`
- `src/services/widget-service.ts`
- `src/clients/sportmonks-client.ts`
- `src/clients/espn-live-client.ts`
- `src/clients/fapi-client.ts`
- `src/clients/sportdb-client.ts`
- `src/services/merge-service.ts`
- `src/middleware/security.ts`
- `src/routes/notifications.ts`
- `src/index.ts`
- `src/types.ts`
- `.env.example`
- `.gitignore`
- `RAPPORT_WEB_WIDGET_LIVE.md`

## Endpoints

- `GET /widget`
- `GET /widget/`
- `GET /widget/index.html`
- `GET /widget/style.css`
- `GET /widget/app.js`
- `GET /api/widget/live`
- `GET /api/widget/today`
- `GET /api/widget/upcoming?days=60`
- `GET /api/widget/status`
- `GET /api/widget/events/:matchId`

Le frontend appelle exclusivement le flux normalise `/api/widget/*`. Il ne contient aucune cle et ne contacte jamais directement un fournisseur de scores.

## Sources et veracite

- Live principal configure : Sportmonks, filtre officiel World Cup league `732`.
- Secours live reel : endpoint JSON public ESPN `fifa.world`, sans cle et sans scraping HTML.
- Secours additionnels : FAPI/TheStatsAPI puis TheSportsDB.
- Calendrier : World Cup 2026 Tour, puis When Is Kickoff et OpenFootball.
- Sportmonks est joignable mais l'abonnement configure ne couvre pas la competition World Cup 2026.
- Le fallback ESPN a confirme Brésil - Japon en cours le 29 juin 2026 avec un score et un statut reels.
- Aucune source ne confirme un live : `items: []`, source confirmee et message propre.
- Coup d'envoi passe sans statut live confirme : `AWAITING_LIVE_DATA`.
- Un `0-0` fourni sur un match encore programme n'est pas publie comme score live.
- Les valeurs texte `"false"` des fournisseurs ne sont jamais interpretees comme vraies.
- Aucun score, but, carton, evenement ou minute n'est invente.
- `sim-model.json` et `probs.json` ne sont jamais utilises comme resultats officiels.

La cle Sportmonks est stockee uniquement dans Render Environment Variables sous `LIVE_SCORE_API_KEY`. Elle n'est presente ni dans GitHub, ni dans le frontend, ni dans ce rapport.

## Tests backend en ligne

- `npm.cmd run build` : OK
- `node --check web-widget/app.js` : OK
- `git diff --check` : OK
- `/health` : HTTP 200, backend 5.0.10
- `/diagnostic` : HTTP 200, `sportMonksConfigured: true`
- `/api/widget/live` : HTTP 200, success true, 1 item, source `espn-public`
- Brésil - Japon : `0-1`, `LIVE`, minute `52` lors du dernier test, identifiant fournisseur `760487`
- `/matches/live` : HTTP 200, success true, 1 item, source `espn-public`
- `/api/widget/today` : HTTP 200, 2 items, source `merged`; le live remplace le creneau `TBD-TBD` correspondant
- `/api/widget/upcoming?days=60` : HTTP 200, 30 items, source `worldcup2026-tour`
- `/api/widget/status` : HTTP 200, success true
- `/matches/standings` : HTTP 200, 12 groupes
- `/videos` : HTTP 200, 30 items
- `/interviews` : HTTP 200, 30 items
- `/injuries` : HTTP 200, 30 items
- `/training` : HTTP 200, 30 items

## Tests web et QA en ligne

- Desktop 1280 x 720 : OK
- Mobile 360 x 720 : OK
- Petit mobile 320 x 640 : OK, aucun debordement horizontal
- Logo charge : OK, image optimisee a 14 Ko
- Onglets Live, Aujourd'hui, A venir : OK
- Reduire puis agrandir : OK
- Bouton Actualiser : OK
- Console navigateur : aucune erreur ni alerte
- Carte live : Brésil `0 : 1` Japon, actualisee de `Mi-temps` a `En direct`, source `espn-public`
- Score absent : `Score non disponible`
- Match passe sans donnees : `Match en attente de donnees live`
- Refresh : 15 secondes / 60 secondes / 5 minutes

## Securite

- Aucun secret dans le frontend, le code, GitHub ou le rapport.
- Aucun `.env`, keystore ou secret Firebase Admin ajoute.
- `.env` est ignore; `.env.example` contient uniquement des champs vides/placeholders.
- CORS limite a Render, GitHub Pages et origines configurees; requetes Android sans Origin autorisees.
- Rate limiting : `/ai` 20, `/notifications` 30, `/matches` 120 et `/api/widget` 120 requetes/minute/IP.
- Routes admin notifications protegees par `ADMIN_API_TOKEN`; elles restent indisponibles si la variable est absente.
- Erreurs serveur generiques en production.
- `/sources/health` limite a 30 requetes/minute/IP et erreurs fournisseur generiques.
- `/diagnostic` n'expose aucun message d'erreur interne du cache.
- Aucune URL locale ni fournisseur interdit actif dans `src` ou `web-widget`.
- Android est reste identique a `origin/main` avant cette mission.

## Limites

- Le widget n'affiche un score live que lorsqu'un fournisseur fiable le confirme.
- ESPN est un endpoint JSON public non authentifie et non une API contractuelle; Sportmonks, FAPI et TheSportsDB restent les autres voies de secours configurees.
- Les noms `TBD` du calendrier restent affiches tant que les equipes ne sont pas determinees.
- `npm audit` signale des vulnerabilites moderees transitives dans `uuid` via Firebase Admin et node-cron. Leur correction automatique exige des mises a niveau majeures; aucune exploitation par les routes widget n'a ete identifiee pendant cette validation.
