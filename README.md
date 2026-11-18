# Observatoire des laveries

[**Ouvrir la carte publique (GitHub Pages)**](https://guillaume-smbg.github.io/observatoire-laveries/)

Application indépendante, **100 % gratuite**, dans son propre dépôt et son propre hébergement GitHub Pages. Aucune dépendance SMBG ni Cloudflare.

## Fonctionnalités
- Carte Leaflet (OpenStreetMap), recherche d'adresse, import GeoJSON, export CSV et analyse de concurrence à 300 / 500 / 1 000 m.
- Inventaire d'établissements OSM sauvegardé et daté par extraction automatisée, **contributif, non vérifié et non exhaustif** ; revue manuelle locale avec export.
- Tableau des communes et populations officielles (API Géo).
- Statistiques **INSEE RP 2022 à l'échelle IRIS** : population, résidences principales, parts de petits logements de moins de 40 m² et de locataires ; géographie IGN/Insee 2024.
- Carte thématique IRIS et indice **exploratoire** réglable, indisponible si les sources nécessaires ne sont pas chargées.
- Prévisionnel financier à trois scénarios, comparaison brut/ancien commerce et machines neuves/occasion, dette et apport, seuil de couverture, export.
- Tests automatisés JavaScript/HTML, audit de motifs de secrets et validation syntaxique Python.

## Limites indispensables
Ce site n'est **pas** un inventaire vérifié des laveries. OpenStreetMap peut manquer des établissements, comporter des doublons et répertorier des pressings. Les comptages sont à vol d'oiseau ; les données IRIS ne décrivent pas exactement la clientèle à 500 m. L'indice de potentiel est une heuristique non validée et non une prévision de chiffre d'affaires. Les valeurs de départ du simulateur sont fictives et doivent être remplacées par des devis et des hypothèses vérifiées.

Les fichiers INSEE et OSM sont générés par `.github/workflows/refresh-data.yml` (actualisation hebdomadaire ou manuelle) depuis `scripts/refresh_data.py`. L'absence d'une source est affichée plutôt que compensée par des données inventées.

La méthode, les champs officiels, les formules et les limites sont détaillés dans [**docs/METHODOLOGIE.md**](docs/METHODOLOGIE.md).

## Sécurité et déploiement
Hébergement statique GitHub Pages, sans abonnement ; pas de clé privée, mot de passe, données SMBG, Supabase ni Cloudflare dans le site. Les imports CSV/GeoJSON et statuts de contrôle se traitent localement dans le navigateur. Les cartes et API publiques reçoivent néanmoins les requêtes réseau nécessaires à leur affichage.

- Publication : `.github/workflows/pages.yml`
- Rafraîchissement et republication : `.github/workflows/refresh-data.yml`
- Contrôles CI : `.github/workflows/check.yml`

Sources : INSEE recensement 2022 ; IGN/Insee contours IRIS 2024 via Région Île-de-France ; OpenStreetMap © contributeurs sous conditions ODbL ; API Géo.
