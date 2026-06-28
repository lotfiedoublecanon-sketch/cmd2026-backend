# Widget web CDM 2026 Live

Widget autonome, compact et responsive, sans dépendance externe.

## Intégration

Servir le dossier `web-widget` depuis la même origine que l'API, puis intégrer `index.html` directement ou dans une iframe :

```html
<iframe
  src="/widget/"
  title="Scores CDM 2026 Live"
  width="440"
  height="560"
  loading="lazy"
></iframe>
```

L'iframe peut recevoir `width="100%"`. Le widget accepte une largeur minimale de 280 px et une largeur maximale de 440 px.

## API attendue

Le widget effectue uniquement des requêtes `GET` relatives vers :

- `/api/widget/live` toutes les 15 secondes ;
- `/api/widget/today` toutes les 60 secondes ;
- `/api/widget/upcoming?days=60` toutes les 5 minutes.

Format d'enveloppe pris en charge :

```json
{
  "success": true,
  "items": [
    {
      "id": "match-id",
      "homeTeamName": "Équipe domicile",
      "awayTeamName": "Équipe extérieure",
      "homeTeamCode": null,
      "awayTeamCode": null,
      "homeScore": null,
      "awayScore": null,
      "status": "SCHEDULED",
      "minute": null,
      "kickoff": "2026-06-29T18:00:00Z",
      "group": null,
      "sourceUsed": "source-api",
      "lastUpdatedAt": "2026-06-29T17:59:50Z",
      "liveDataStatus": "scheduled"
    }
  ],
  "sourceUsed": "source-api",
  "lastUpdatedAt": "2026-06-29T17:59:50Z",
  "liveDataStatus": "scheduled"
}
```

Les enveloppes existantes `data` et `data.matches` restent également acceptées. Les scores `null` affichent « Score non disponible » et ne sont jamais remplacés par zéro. Le statut `AWAITING_LIVE_DATA` ou `liveDataStatus: "waiting"` affiche explicitement une attente de données live. Une source ou une date absente reste non renseignée.

## États et accessibilité

Le widget inclut les états chargement, vide, attente live et erreur avec action « Réessayer ». Les onglets suivent le modèle ARIA `tablist`/`tab`/`tabpanel` et sont navigables avec les flèches, `Début` et `Fin`. Les boutons d'actualisation et de réduction/agrandissement disposent de libellés accessibles.
