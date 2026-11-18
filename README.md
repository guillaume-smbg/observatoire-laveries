# Observatoire des laveries

Site public gratuit et indépendant de SMBG, déployable avec GitHub Pages.

Reprise fonctionnelle du prototype v0.2 : carte Leaflet, recherche d'adresse, import GeoJSON et simulateur financier à trois scénarios. Ajout d'un chargement OpenStreetMap à la demande.

## Limites

- Aucun inventaire exhaustif ou vérifié des laveries ; le chargement OSM dépend d'Overpass et de la qualité des contributions.
- Le périmètre de collecte est un rectangle approximatif et les filtres départementaux nécessitent un code postal.
- Aucune donnée Insee, isochrone piéton ou score économique n'est encore intégrée.
- Les valeurs initiales du simulateur sont des hypothèses illustratives, non des observations de marché.
- Aucune clé privée ni donnée SMBG n'est intégrée au site.

## Hébergement

GitHub Pages via `.github/workflows/pages.yml`. L'activation de Pages peut nécessiter de choisir « GitHub Actions » dans Settings > Pages.