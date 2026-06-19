# Deploiement Render - Backend V5

Ce dossier est pret pour le depot prive `cmd2026-backend`.

## Contenu a envoyer dans GitHub

Envoyer tout le contenu de ce dossier dans la racine du depot :

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `src/`
- `render.yaml`
- `.env.example`
- `.gitignore`
- `README_DEPLOY_RENDER.md`

Ne pas envoyer de fichier `.env`, de dossier `node_modules/`, ni de dossier `dist/`. Render generera `dist/` pendant le build.

## Commandes Render

Build command :

```bash
npm install && npm run build
```

Start command :

```bash
npm start
```

Health check path :

```text
/health
```

Le serveur ecoute automatiquement `process.env.PORT || 3000`.

## Variables a mettre dans Render uniquement

Renseigner les vraies valeurs dans le dashboard Render, pas dans GitHub :

- `FAPI_API_KEY` ou `THESTATSAPI_KEY`
- `FAPI_COMPETITION_ID` ou `WORLD_CUP_COMPETITION_ID`
- `SPORTDB_API_KEY`
- `SPORTDB_LEAGUE_ID`
- `GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- variables medias optionnelles si utilisees

Pour Firebase Admin, la methode conseillee est `FIREBASE_SERVICE_ACCOUNT_BASE64` : encoder le JSON service account Firebase en base64, puis coller le resultat dans Render.

## Tests obligatoires apres deploiement

Une fois Render deploye, tester l'URL publique HTTPS :

```bash
curl https://URL_RENDER/health
curl https://URL_RENDER/matches/live
curl https://URL_RENDER/matches/today
curl https://URL_RENDER/matches/upcoming
curl https://URL_RENDER/diagnostic
```

`/health` doit repondre exactement :

```json
{
  "status": "ok",
  "service": "cdm2026-backend-v5"
}
```

Compiler l'APK seulement apres validation de ces routes.
