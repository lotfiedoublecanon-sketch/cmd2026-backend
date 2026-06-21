# Patch backend CDM 2026 Live — source fetcher

À déposer dans le dépôt GitHub `lotfiedoublecanon-sketch/cmd2026-backend`, branche `main`.

Fichiers inclus :

- `src/services/source-fetcher-service.ts` : nouveau service qui récupère RSS / Google News RSS / GDELT / XML YouTube / HTML fallback, normalise les résultats et dédoublonne.
- `src/index.ts` : routes `/articles`, `/news`, `/videos`, `/interviews`, `/injuries`, `/training` branchées sur `sourceFetcherService` au lieu de dépendre seulement de Gemini.

Aucune APK à générer maintenant. Il faut d’abord vérifier que Render build correctement.

Commandes à lancer si possible :

```bash
npm install
npm run build
```

Commit conseillé :

```text
Add source fetcher service for RSS GDELT Google News
```
