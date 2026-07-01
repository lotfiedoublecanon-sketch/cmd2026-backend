# Rapport final - Hero, tableau et retards CDM 2026

## Livraison

- Site : https://cmd2026-backend-1.onrender.com/widget/
- Dépôt : https://github.com/lotfiedoublecanon-sketch/cmd2026-backend
- Branche de travail : `feature/web-live-widget-score`
- Commit d'implémentation : `d70fe59a793d83b4bda27dcaaee7ecb3a13b4b3b`
- Render redéployé : oui
- Déploiement Render : `dep-d92c2ga8qa3s73d5grfg`
- Commit servi par Render : `d70fe59a793d83b4bda27dcaaee7ecb3a13b4b3b`
- Backend : `5.0.10`
- Android/APK modifié : non

## Routes ajoutées

- `GET /api/widget/featured`
- `GET /api/widget/bracket`
- `GET /api/widget/knockout`
- `GET /api/widget/bracket/status`
- `GET /api/widget/groups`

Les routes existantes Live, Aujourd'hui, À venir, événements, statistiques et médias sont conservées.

## Tableau phase finale

- Onglet Tableau ajouté : oui
- Composant dynamique, pas une image : oui
- Tours affichés : seizièmes, huitièmes, quarts, demi-finales, finale et troisième place
- Matchs récupérés : 32/32
- Source : `espn-public`
- Drapeaux ou code équipe de secours : oui
- Scores et tirs au but : affichés uniquement quand la source les fournit
- Qualifié : affiché uniquement sur statut final avec vainqueur cohérent avec le score ou les tirs au but
- Équipe non encore connue : `À déterminer`

Exemples vérifiés le 1er juillet 2026 :

- Allemagne 1-1 Paraguay, TAB 3-4 : Paraguay qualifié
- Pays-Bas 1-1 Maroc, TAB 2-3 : Maroc qualifié
- Mexique 2-0 Équateur : Mexique qualifié et déjà présent au tour suivant dans les données ESPN

## Mise à jour automatique des qualifiés

Le tableau ne calcule pas un vainqueur par supposition. À chaque actualisation :

1. `/api/widget/bracket` relit les matchs à élimination directe de la source ESPN publique.
2. Le backend valide le statut final, les scores et le vainqueur déclaré.
3. Le frontend recharge le tableau toutes les 5 minutes et au clic sur Actualiser.
4. Les tours futurs utilisent uniquement les participants publiés par la source.
5. Un emplacement non confirmé reste `À déterminer`.

Ainsi, une équipe apparaît au tour suivant seulement lorsque le fournisseur a mis à jour ce match futur. Aucun avancement manuel, IA ou simulation n'est utilisé.

## Hero dynamique

- Route `/api/widget/featured` : oui
- Priorité : live confirmé, retard/suspension confirmé, prochain match du jour, prochain match, dernier résultat important, fond générique
- Persistance pendant un live/prolongation/TAB : oui
- Tolérance à une coupure temporaire de source : conservation du dernier hero actif pendant une fenêtre maximale de 6 heures
- Changement après fin confirmée : oui, le prochain match programmé devient prioritaire
- Test contrôlé : le hero `espn-sticky` reste sélectionné pendant une absence temporaire de source puis bascule vers `next` après statut final confirmé

Le fond `web-widget/hero/world-cup-poster-base.png` est une création originale générée pour le projet. Il montre deux athlètes anonymes vus de dos, un stade et une ville fictifs. Il ne reprend pas l'image FRA-SUE, aucun joueur réel, aucun logo, aucun stade réel et aucun texte protégé. La provenance est documentée dans `web-widget/hero/ASSET_PROVENANCE.md`.

Images réelles de joueurs ajoutées : non. Aucune photo de joueur avec autorisation et provenance vérifiables n'était disponible dans le dépôt. Le site affiche donc `Joueur à suivre : à confirmer` et n'invente aucun nom.

## Retards, reports et suspensions

Statuts explicitement gérés :

- `DELAYED`
- `KICKOFF_DELAYED`
- `WEATHER_DELAY`
- `SUSPENDED`
- `INTERRUPTED`
- `POSTPONED`
- `CANCELLED`
- `AWAITING_KICKOFF`

Le panneau `Suivi retards` est visible dans le hero. En l'absence d'incident confirmé, il affiche :

`Aucun retard ou suspension confirmé`

Lorsqu'un statut fournisseur confirme un incident, le panneau passe en alerte dorée et affiche :

- `Reprise estimée dans X min` si `restartEtaMinutes` est fourni ;
- `Nouvelle heure : HH:mm` si `newKickoff` est fourni ;
- sinon `Reprise à confirmer`.

Le backend ne déduit pas un retard à partir d'une heure modifiée et ne fabrique ni cause ni estimation. Test contrôlé validé : `WEATHER_DELAY`, ETA 18 minutes, scores masqués. Aucun retard réel n'était actif dans la source au moment du déploiement ; l'état neutre est donc volontairement affiché en production.

## Groupes

- Onglet Groupes ajouté : oui
- Groupes : 12
- Équipes : 48
- Source : `wheniskickoff`
- Statistiques affichées : joués, victoires, nuls, défaites, différence et points
- Aucun qualifié n'est déduit du classement de groupes par le widget.

## Tests publics après déploiement

| Route | HTTP | Résultat |
|---|---:|---|
| `/health` | 200 | OK |
| `/api/widget/featured` | 200 | England - DR Congo, source `espn-public` |
| `/api/widget/bracket` | 200 | 32 matchs, statut `OK` |
| `/api/widget/bracket/status` | 200 | 6 tours complets |
| `/api/widget/groups` | 200 | 12 groupes |
| `/api/widget/live` | 200 | 0 live confirmé, tableau vide propre |
| `/api/widget/today` | 200 | 3 matchs |
| `/api/widget/upcoming?days=60` | 200 | 25 matchs |
| `/api/widget/events/espn-760489` | 200 | 18 événements |
| `/api/widget/stats/espn-760489` | 200 | 6 statistiques |
| `/videos` | 200 | 30 éléments |
| `/interviews` | 200 | 30 éléments |
| `/injuries` | 200 | 30 éléments |
| `/training` | 200 | 30 éléments |

## QA visuelle

- PC 1265 x 720 : hero, panneau, cinq onglets, tableau et groupes lisibles
- Mobile 360 x 800 : aucune largeur de page dépassée ; tableau horizontal de 32 cartes dans son propre scroller
- Console navigateur : aucune erreur ni avertissement
- Fond généré réellement chargé depuis `/widget/hero/world-cup-poster-base.png`
- Panneau retards visible et état source cohérent
- Tableau public : 6 tours, 32 matchs, 2 scores TAB visibles au moment du test

## Sécurité et vérité des données

- Aucun secret ajouté au frontend ou au commit
- Scan du diff indexé : propre
- Aucune clé Gemini, FAPI, SportDB ou Render ajoutée
- Aucun `.env` ajouté
- Aucune donnée de `sim-model.json` ou `probs.json` utilisée par les routes widget
- Aucun score, match, qualifié, retard, ETA, joueur, buteur ou statistique inventé
- L'image FRA-SUE fournie comme référence n'est pas incluse dans le projet

## Limites restantes

- ESPN public est un fournisseur de données, pas une confirmation officielle FIFA.
- Aucun retard réel actif n'était disponible pendant le test ; la branche active du panneau a été validée avec un objet contrôlé et la production affiche honnêtement l'état neutre.
- Les vraies photos de joueurs nécessitent des fichiers fournis avec une autorisation et une provenance vérifiables. Elles ne sont pas ajoutées par supposition ou récupération non autorisée.
