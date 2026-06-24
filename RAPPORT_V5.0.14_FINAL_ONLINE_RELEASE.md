# RAPPORT V5.0.14 FINAL ONLINE RELEASE

## Branche

`release/v5-0-14-live-online`

## Version Android

- Package : `com.cdmafrique.live`
- VersionCode : `514`
- VersionName : `5.0.14`
- Backend URL : `https://cmd2026-backend-1.onrender.com/`

## APK

- Debug test : `CDM2026LiveByRedha-V5.0.14-live-online-debug.apk`
- Release generee : `CDM2026LiveByRedha-V5.0.14-stable-release-unsigned.apk`

Important : la release Gradle est non signee, car aucun keystore prive / signingConfig n'est configure dans le repo. Elle ne doit pas etre publiee comme APK finale signee.

## SHA-256

- Debug : `61E3A302E49C2AC8F7E428126E68AB8294E7D2DA7212DB45BE67856BBB9B8F97`
- Release unsigned : `9D56CF772EA2235656328F37DF3A12E1108C80805830D6FCBD85A7EE8E173750`

## Backend / Render

Backend modifie : oui, uniquement `src/config/media_sources.json` pour retirer totalement l'entree API-Football des sources publiques.

Render deploye : non pendant cette passe. Le backend public existant reste utilise.

Build backend local :

```bash
npm run build
```

Resultat : OK.

## Routes production verifiees

- `/health` : HTTP 200
- `/diagnostic` : HTTP 200
- `/matches/live` : HTTP 200, 0 item, source `backend`
- `/matches/today` : HTTP 200, 4 items, source `worldcup2026-tour`
- `/matches/upcoming?days=60` : HTTP 200, 57 items, source `worldcup2026-tour`
- `/matches/standings` : HTTP 200, 12 groupes, source `wheniskickoff`
- `/videos` : HTTP 200, 30 items, source `public-media`
- `/interviews` : HTTP 200, 30 items, source `public-media`
- `/injuries` : HTTP 200, 30 items, source `public-media`
- `/training` : HTTP 200, 30 items, source `public-media`

## Corrections V5.0.14

- Conservation des corrections V5.0.13 media Render.
- Version Android montee en `5.0.14` / `514`.
- `outputs/` ajoute au `.gitignore` pour eviter de pousser APK/ZIP/scans.
- `success:false` backend n'est plus interprete comme serveur vide.
- `/matches/{id}/events` distingue erreur technique et liste vide.
- Le detail match n'injecte plus d'events/stats/compos/commentaires locaux sur les matchs Render.
- Le Foreground Service live ajoute un anti-doublon d'evenements de but confirmes par backend.
- EventKey stable : `matchId + type + minute + teamName + playerName + scoreHomeAfter + scoreAwayAfter`.
- Notifications live sans invention de score, minute, buteur ou evenement.
- Arret automatique du suivi live apres disparition d'un live deja observe.
- API-Football retire de `media_sources.json`.

## Fichiers modifies

- `.gitignore`
- `AndroidSource/app/build.gradle.kts`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/LiveTrackingForegroundService.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/MainActivity.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/data/api/BackendApiClient.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/data/api/Dtos.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/data/local/AppCacheStore.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/data/model/Models.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/data/repository/MatchRepository.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/ui/MainViewModel.kt`
- `src/config/media_sources.json`
- `RAPPORT_V5.0.14_FINAL_ONLINE_RELEASE.md`

## Builds

Debug :

```bash
./gradlew.bat clean assembleDebug -PBACKEND_URL=https://cmd2026-backend-1.onrender.com/
```

Resultat : OK.

Release :

```bash
./gradlew.bat clean assembleRelease -PBACKEND_URL=https://cmd2026-backend-1.onrender.com/
```

Resultat : OK, mais APK non signee.

## Securite

Scan APK debug : OK.

Scan APK release unsigned : OK.

Aucun motif interdit detecte dans les APK :

- aucun `localhost`
- aucun `127.0.0.1`
- aucun `10.0.2.2`
- aucune API-Football / API-Sports
- aucune cle Gemini / FAPI / SportDB / Render

Scan source :

- aucun `api-football`, `api-sports` ou `football.api-sports`.
- les noms de variables backend (`FAPI_API_KEY`, `GEMINI_API_KEY`, etc.) restent presents comme placeholders/config serveur, sans valeur secrete.

## Tests telephone

V5.0.13 validee par test telephone reel pour les medias Render.

V5.0.14 n'a pas encore ete testee sur telephone reel dans cette passe. A valider avant merge main, tag stable et GitHub Release finale.

## Limites restantes

- APK release signee non disponible : il faut configurer un keystore prive hors repo.
- Pas de tag cree.
- Pas de GitHub Release creee.
- Pas de merge main effectue.
- Render non redeploye car la modification backend est limitee au retrait API-Football de la config source; deployer main/branche apres validation si necessaire.

## Prochaine version recommandee

V5.1 :

- signature release privee propre ;
- tests telephone release ;
- GitHub Release avec APK signee/AAB ;
- notifications FCM serveur plus avancees si besoin ;
- ecran de suivi match individuel.
