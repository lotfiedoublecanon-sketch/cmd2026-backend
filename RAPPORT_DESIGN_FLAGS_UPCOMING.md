# Rapport design, drapeaux et matchs a venir

Date de validation : 2026-06-30

## Livraison

- URL : `https://cmd2026-backend-1.onrender.com/widget`
- Commit fonctionnel : `cf78303949a3fbd91f8c1f6e0de6aeeca436d1d0`
- Branche : `feature/web-live-widget-score`
- Branche `main` mise a jour : oui
- Render redeploye : oui
- Deploiement Render : `dep-d91k47laeets73flg1qg`, statut `live`
- Android modifie : non

## Fond Coupe du Monde

- Fond noir plat corrige : oui.
- Nouveau fond : degrade vert terrain et bleu nuit.
- Bandes de pelouse realisees en CSS.
- Lumieres de stade en haut et halo discret derriere le widget.
- Lignes de terrain en transparence dans le widget.
- Cartes semi-transparentes avec bordure douce, ombre et flou leger.
- Aucune image FIFA officielle ou image copyright ajoutee.

## Bande Equipes a suivre

- Bande de drapeaux ajoutee : oui.
- Donnees : equipes presentes dans Live, Aujourd'hui et A venir uniquement.
- Nombre lors du test : 30 equipes confirmees.
- Les equipes inconnues ne sont pas ajoutees.
- Emoji drapeau utilise quand disponible, code FIFA affiche en repli.
- Nom complet disponible dans le tooltip de chaque badge.
- Defilement horizontal mobile : oui.

## Matchs a venir

- Matchs a venir ameliores : oui.
- Nombre retourne : 28.
- Heure centree et mise en valeur.
- Date, phase et stade affiches lorsque disponibles.
- Drapeaux/badges avant ou apres les noms selon le cote.
- Aucun texte `TBD` affiche.
- `A determiner` reserve aux tours dont l'equipe n'est pas encore connue.

Premieres affiches validees :

- Ivory Coast - Norway, 19:00, AT&T Stadium.
- France - Sweden, 23:00, MetLife Stadium.
- Mexico - Ecuador, 03:00, Estadio Banorte.
- England - DR Congo.
- Belgium - Senegal.
- United States - Bosnia-Herzegovina.

## Tests routes

- `/widget` : HTTP 200.
- `/api/widget/live` : HTTP 200; zero item accepte quand aucune source ne confirme un live.
- `/api/widget/today` : HTTP 200, 4 matchs lors du test.
- `/api/widget/upcoming?days=60` : HTTP 200, 28 matchs.
- `/api/widget/events/espn-760489` : HTTP 200, 18 evenements confirmes.
- `/api/widget/stats/espn-760489` : HTTP 200, 6 statistiques confirmees.
- `/videos` : HTTP 200, 30 items.
- `/interviews` : HTTP 200, 30 items.
- `/injuries` : HTTP 200, 30 items.
- `/training` : HTTP 200, 30 items.

## Tests affichage

- Drapeaux/badges Live : OK quand un live est present.
- Drapeaux/badges Aujourd'hui : OK.
- Drapeaux/badges A venir : OK.
- Noms equipes connus : OK.
- Heures A venir : OK.
- Desktop : OK, 28 cartes et bande scrollable.
- Mobile 360 px : OK, aucun debordement horizontal.
- Console navigateur : aucune erreur critique.

## Securite et veracite

- Aucun secret ou cle ajoute au frontend ou a GitHub.
- Aucune image copyright non autorisee.
- Aucun scraping HTML.
- Aucun faux score, faux match, faux buteur, faux carton ou fausse minute.
- Les simulations locales ne sont jamais utilisees comme source live.

## Limites restantes

- Certains environnements n'affichent pas les emojis drapeaux en couleur; le code FIFA reste alors visible proprement.
- Les equipes des tours a elimination directe restent `A determiner` jusqu'a confirmation du fournisseur.
- Le contenu de la bande evolue automatiquement avec les equipes renvoyees par les flux publics.
