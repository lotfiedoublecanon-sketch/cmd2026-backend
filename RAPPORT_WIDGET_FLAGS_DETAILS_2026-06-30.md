# Rapport correction widget - drapeaux, equipes et live

Date : 2026-06-30

## Livraison

- Commit fonctionnel : `91eaaf6a7a65fd7d953e24e7f8f5da83d1d811a2`
- Branche : `feature/web-live-widget-score`
- Branche `main` mise a jour : oui
- Deploiement Render : `dep-d91jp2i8qa3s73aoiqug`, statut `live`
- URL : `https://cmd2026-backend-1.onrender.com/widget`
- Android modifie : non

## Corrections

- Drapeau emoji ou badge code sur Live, Aujourd'hui et A venir.
- Noms et codes equipes toujours presents quand le fournisseur les connait.
- `TBD` remplace par `A determiner` uniquement pour les futurs tours non resolus.
- Calendrier prioritaire ESPN pour les affiches deja connues, cache cinq minutes.
- Minute centree au-dessus du score.
- Statuts distincts : Live, Mi-temps, Prolongation, Tirs au but et Termine.
- Scores des tirs au but et vainqueur affiches uniquement quand la source les fournit.
- Panneau Voir details avec statistiques et timeline reelles.
- Nouvelle route `GET /api/widget/stats/:matchId`.
- Route `GET /api/widget/events/:matchId` branchee sur les resumes ESPN pour les IDs `espn-*`.
- Fond sombre inspire d'un terrain, realise uniquement en CSS.

## Verification des matchs

- Allemagne - Paraguay : `FINISHED`, score `1-1`, tirs au but `3-4`, vainqueur Paraguay.
- Allemagne - Paraguay absent de `/api/widget/live`.
- Pays-Bas - Maroc : encore confirme en seance de tirs au but lors du dernier test public.
- Aucun score ou statut n'est calcule depuis l'heure de coup d'envoi.
- Aucun buteur, carton, faute ou remplacement n'est invente.

## Routes publiques

- `/widget` : HTTP 200.
- `/api/widget/live` : HTTP 200, source `espn-public`.
- `/api/widget/today` : HTTP 200, quatre matchs lors du test.
- `/api/widget/upcoming?days=60` : HTTP 200, 28 matchs.
- `/api/widget/events/espn-760489` : HTTP 200, 18 evenements confirmes.
- `/api/widget/stats/espn-760489` : HTTP 200, 6 statistiques confirmees.
- `/videos`, `/interviews`, `/injuries`, `/training` : HTTP 200, 30 items chacune.

## Affiches futures confirmees

- Ivory Coast - Norway
- France - Sweden
- Mexico - Ecuador
- England - DR Congo
- Belgium - Senegal
- United States - Bosnia-Herzegovina
- Spain - Austria
- Portugal - Croatia
- Switzerland - Algeria
- Australia - Egypt
- Argentina - Cape Verde
- Colombia - Ghana

Les equipes des tours suivants restent `A determiner` tant que le fournisseur ne confirme pas leur identite.

## Web et securite

- Desktop : OK.
- Mobile 360 px : OK, aucun debordement horizontal.
- Console navigateur : aucune erreur ni alerte.
- Drapeaux/badges : 2 par carte, avec repli propre vers le code equipe.
- Aucun secret ni cle ajoute au frontend ou au backend.
- Aucun scraping HTML.
- Aucun fichier de simulation utilise comme source live.
