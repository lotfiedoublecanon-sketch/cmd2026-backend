# Pack accepté par Z.ai — CDM 2026 backend

Z.ai refuse les fichiers `.ts`, `.json` et `.yaml`. J’ai donc renommé tous les fichiers en `.txt`.

## Consigne pour Z.ai

Ces fichiers `.txt` correspondent à des fichiers réels du projet GitHub. Chaque fichier contient en haut une ligne `ORIGINAL_PATH`.

Merci de corriger le code en gardant le chemin original indiqué.
À la fin, renvoyer les fichiers corrigés en `.txt` ou un patch, avec la liste exacte des fichiers à remplacer.

## Fichiers originaux

- `files_txt/render.yaml.txt` → `render.yaml`
- `files_txt/package.json.txt` → `package.json`
- `files_txt/tsconfig.json.txt` → `tsconfig.json`
- `files_txt/src__index.ts.txt` → `src/index.ts`
- `files_txt/src__config__media_sources.json.txt` → `src/config/media_sources.json`
- `files_txt/src__config__open-sources.ts.txt` → `src/config/open-sources.ts`
- `files_txt/src__services__source-fetcher-service.ts.txt` → `src/services/source-fetcher-service.ts`
- `files_txt/README_ZAI_REDHA.md.txt` → `README_ZAI_REDHA.md`

## Objectif technique

Corriger/améliorer le backend Render :
- `src/services/source-fetcher-service.ts`
- `src/index.ts`
- `src/config/media_sources.json`
- `src/config/open-sources.ts`

Les routes à valider :
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

Ne pas demander de mot de passe, token GitHub, `.env` ou clé API.
