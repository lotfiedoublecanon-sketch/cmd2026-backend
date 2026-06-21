// ORIGINAL_PATH: README_ZAI_REDHA.md
// IMPORTANT: This file was renamed to .txt because Z.ai upload does not accept .ts/.json/.yaml.
// If Z.ai modifies it, copy the corrected content back to the original path/name shown above.

# Pack backend à envoyer à Z.ai — CDM 2026 Live by Redha

Ce ZIP contient les fichiers importants du backend pour que Z.ai puisse corriger Render et le service de sources publiques.

## Fichiers inclus

- `render.yaml`
- `package.json`
- `tsconfig.json`
- `src/index.ts`
- `src/config/media_sources.json`
- `src/config/open-sources.ts`
- `src/services/source-fetcher-service.ts`

## Important sécurité

Aucun fichier `.env`, aucune clé API, aucun token GitHub, aucun Firebase Admin JSON n'est inclus.

## Mission pour Z.ai

1. Vérifier que `npm install` puis `npm run build` passent sans erreur.
2. Corriger les erreurs TypeScript et runtime éventuelles.
3. Vérifier que Render démarre avec `npm start`.
4. Vérifier les routes :
   - `/health`
   - `/diagnostic`
   - `/sources`
   - `/sources/health`
   - `/articles`
   - `/news`
   - `/videos`
   - `/interviews`
   - `/injuries`
   - `/training`
5. Optimiser `source-fetcher-service.ts` pour éviter que les sources lentes bloquent Render.
6. Ajouter des timeouts courts et des `try/catch` solides source par source.
7. Ne pas toucher à l'APK Android maintenant.
8. Pousser les corrections sur GitHub `main`.

## Commit conseillé

```text
Fix source fetcher service and Render routes
```
