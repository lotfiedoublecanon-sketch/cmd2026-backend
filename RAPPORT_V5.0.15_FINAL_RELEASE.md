# RAPPORT V5.0.15 FINAL RELEASE

## Version

- Application: CDM 2026 Live by Redha
- Package Android: `com.cdmafrique.live`
- versionName: `5.0.15`
- versionCode: `515`
- Backend public: `https://cmd2026-backend-1.onrender.com/`
- Branche de travail: `release/v5-0-15-final-live-score`
- Branche backup V5.0.14: `backup/v5-0-14-phone-validated`

## Changements V5.0.15

- Live vide traite comme etat normal: `EMPTY_SERVER`, sans erreur rouge et sans fallback local live.
- Source Direct affichee dans l'ecran Direct: Render, Cache backend ou Serveur vide.
- Foreground Service live corrige:
  - erreur reseau differenciee de "plus de live";
  - pas d'arret du suivi live sur simple erreur reseau;
  - pas de notification d'anciens buts au premier chargement;
  - anti-doublon sur eventKey stable;
  - aucun score invente.
- Cache live corrige: si `/matches/live` repond 200 avec liste vide, le cache live est vide.
- Parsing JSON liste corrige: une erreur de parsing n'est plus transformee en serveur vide normal.
- Notifications FCM: anti-doublon via `messageId`, `eventKey`, `eventId` ou `dedupeKey`.

## Fichiers modifies

- `AndroidSource/app/build.gradle.kts`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/LiveTrackingForegroundService.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/MainActivity.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/CdmFirebaseMessagingService.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/data/api/BackendApiClient.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/data/local/AppCacheStore.kt`
- `AndroidSource/app/src/main/java/com/cdmafrique/live/data/repository/MatchRepository.kt`

## Backend

- Backend modifie: non
- Build backend local: OK (`npm run build`)
- Render redeploy necessaire pour Android V5.0.15: non
- Version backend actuelle: `5.0.10`

## Routes Render testees

- `/health`: HTTP 200, version backend 5.0.10
- `/diagnostic`: HTTP 200
- `/matches/live`: HTTP 200, 0 element, `sourceUsed=backend`
- `/matches/today`: HTTP 200, 6 elements, `sourceUsed=worldcup2026-tour`
- `/matches/upcoming?days=60`: HTTP 200, 56 elements, `sourceUsed=worldcup2026-tour`
- `/matches/standings`: HTTP 200, 12 groupes, `sourceUsed=wheniskickoff`
- `/matches/wctour-51/events`: HTTP 200, 0 element, `sourceUsed=sportdb`
- `/matches/wctour-51/stats`: HTTP 200, 0 element, `sourceUsed=backend`
- `/matches/wctour-51/lineups`: HTTP 200, 0 element, `sourceUsed=backend`
- `/videos`: HTTP 200, 30 elements
- `/interviews`: HTTP 200, 30 elements
- `/injuries`: HTTP 200, 30 elements
- `/training`: HTTP 200, 30 elements

## Builds

- Android debug: OK
- Android release: OK
- APK debug generee:
  `outputs/V5.0.15-final-live-score/CDM2026LiveByRedha-V5.0.15-final-live-score-debug.apk`
- APK release generee non signee:
  `outputs/V5.0.15-final-live-score/CDM2026LiveByRedha-V5.0.15-final-live-score-release-unsigned.apk`

## Signature

- Debug APK: signee avec certificat debug Android, installable pour test.
- Release APK: non signee, car aucun keystore prive release n'est disponible dans le repo.
- Aucun keystore n'a ete cree ou commite.
- Pour publier une release installable comme mise a jour officielle, fournir un keystore release prive conserve hors GitHub.

## SHA-256

- Debug APK:
  `4F76DDE59E971D44C2E3D9FB322C16BAF490B31C937E872160250ABF588B628B`
- Release unsigned APK:
  `8C516D05DB90564572697A6781F7F05CA5510BE34E32131CB5D5DB5AB768EABC`

## Securite

- Scan source: OK
- Scan APK debug/release: OK
- Aucun `localhost`, `127.0.0.1`, `10.0.2.2`, `192.168`.
- Aucune API-Football/API-Sports active.
- Aucune cle Gemini, FAPI/TheStatsAPI, SportDB, Flashscore, Render ou JWT dans Android/APK.
- `google-services.json` reste la configuration client Firebase requise pour `com.cdmafrique.live`; aucune cle serveur Firebase Admin n'est ajoutee.

## Agents

- Agent Android: a identifie les risques live critiques; corrections integrees.
- Agent Backend: aucune modification backend necessaire; routes et medias V5.0.14 conserves.
- Agent QA: build Android debug/release OK et live vide valide comme etat normal.
- Agent Security/Release: scans source/APK effectues; aucun secret sensible detecte.
- Agent Git/Release: backup V5.0.14 cree, branche release V5.0.15 preparee.

## Limites restantes

- Pas de vrai match live confirme au moment du test: `/matches/live` retourne proprement `data: []`.
- La release signee finale depend du keystore prive du proprietaire.
- GitHub Release automatique non creee si l'outil `gh` authentifie n'est pas disponible.

