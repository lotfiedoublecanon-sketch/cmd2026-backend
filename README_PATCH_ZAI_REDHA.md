# Patch Z.ai corrigé — CDM 2026 backend

Fichiers à remplacer sur GitHub :

- `src/services/source-fetcher-service.ts`
- `src/config/open-sources.ts`
- `src/index.ts`

Ne pas modifier :

- `package.json`
- `tsconfig.json`
- `render.yaml`
- `src/config/media_sources.json`

Message de commit conseillé :

```text
Fix source fetcher service and backend routes
```

Après commit sur `main`, Render doit redéployer automatiquement. Tester ensuite :

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
