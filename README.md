# Observatoire des laveries

Site public, gratuit, indépendant de SMBG, hébergé sur GitHub Pages.

## Fonctionnalités
- Carte Leaflet / OpenStreetMap, recherche d'adresse, rayon de 500 m et analyse des points recensés à 300, 500 et 1 000 m.
- Chargement à la demande des établissements OSM via Overpass ; import GeoJSON et export CSV.
- Tableau de population **communale** via l'API Géo (geo.api.gouv.fr), avec localisation des centres communaux.
- Fiche d'emplacement, comparaison exploratoire de la concurrence autour d'un point et export.
- Import facultatif de cellules démographiques au format CSV (population, parts de petits logements et locataires, source et année).
- Simulateur financier à trois scénarios fondé sur des hypothèses **illustratives**.

## Avertissements méthodologiques
- Les établissements OSM ne constituent **ni un inventaire exhaustif ni un inventaire vérifié** : activité, adresse, doublons et couverture à contrôler.
- Le chargement Overpass utilise un rectangle approximatif plus large que le périmètre cible. Le filtre département dépend de la disponibilité du code postal dans OSM.
- Les populations communales ne sont **pas** des populations à 500 m ; le comptage des laveries près du centre d'une commune ne mesure pas la concurrence dans l'ensemble de la commune.
- Les distances sont à vol d'oiseau, pas à pied.
- Aucune donnée INSEE IRIS infracommunale vérifiée n'est fournie par défaut. Un indice expérimental n'est calculé qu'après import de données locales avec source et année ; sa formule heuristique n'est pas validée scientifiquement.
- Le simulateur exclut notamment financement, fiscalité, amortissements et rémunération.
- La disponibilité des services externes (Overpass, API Géo, géocodage, tuiles OSM) n'est pas garantie.

## Sécurité et architecture
Site statique : aucune clé privée, aucun identifiant, aucun compte ni connexion SMBG/Supabase. Les fichiers CSV et GeoJSON sont traités localement dans le navigateur. Hébergement GitHub Pages via GitHub Actions.

## Feuille de route qualité
1. Constituer un inventaire OSM dédoublonné, contrôlé et daté.
2. Intégrer les jeux de données INSEE IRIS géoréférencés avec millésime, documentation et contrôle de licence.
3. Définir et tester un modèle de demande locale et de concurrence avec analyse de sensibilité.
4. Améliorer les hypothèses économiques avec des devis, prix locaux et observations terrain.
5. Tester le rendu et les APIs sur plusieurs navigateurs, vérifier les exécutions GitHub Actions et le déploiement public.
