# Observatoire des laveries

[**Ouvrir la carte publique**](https://guillaume-smbg.github.io/observatoire-laveries/) · [**Comparer les quartiers / opportunités**](https://guillaume-smbg.github.io/observatoire-laveries/opportunites.html) · [Méthodologie](docs/METHODOLOGIE.md)

Application publique **100 % gratuite**, indépendante de SMBG, hébergée dans son propre dépôt GitHub Pages, sans Cloudflare.

## Fonctionnalités disponibles

- Carte Leaflet/OpenStreetMap, recherche par adresse, filtres, distances de concurrence de 300, 500 et 1 000 m, exports GeoJSON/CSV et liens de recherche Google Maps.
- **Recensement indépendant OSM** à partir d'un téléchargement intégral de l'extrait Île-de-France de Geofabrik, découpage aux limites administratives des quatre départements, distinction des indications de libre-service et audit des ajouts, suppressions et doublons potentiels.
- **Deuxième source officielle SIRENE** : balayage paginé des établissements actifs et diffusibles sous le code 96.01B, rapprochements géographiques avec OSM à 45 m (indice seulement) et liste de candidats à examiner.
- **INSEE RP 2022 / géographie IRIS 2024** : habitants, résidences principales, proportions de petits logements et de locataires ; carte thématique et classement exploratoire pondéré.
- Contrôles locaux manuels (Google Maps, contrôle terrain, exclusions), enregistrés uniquement dans le navigateur et exportables.
- **Page distincte Opportunités** : estimation des habitants, logements et concurrence à 300 / 500 / 1 000 m par intersection surfacique des IRIS ; 50 secteurs espacés et filtrables, carte, fiche détaillée et concurrence locale. Les estimations reposent sur une hypothèse de distribution uniforme dans chaque IRIS et ne sont pas des comptages piétons.
- **Comparaison de six zones** : sélection sauvegardée localement, loyer et fréquentation modifiables par zone, prévisionnels prudent/central/dynamique (65/100/135 %), export CSV et fiche imprimable / enregistrable en PDF depuis le navigateur.
- Simulateur d'investissement et de trésorerie à trois scénarios, comparaisons des travaux et de l'équipement, financement, analyses de sensibilité.
- Tests automatisés JavaScript, navigateur Chromium et GitHub Actions.

## Audit du recensement — 18 novembre 2026

| Indicateur | Résultat | Interprétation |
|---|---:|---|
| Points géolocalisés dans OSM, 75 + 92 + 93 + 94 | **929** | Tous restent NON vérifiés en activité |
| Balise OSM indiquant le libre-service | 752 | Une déclaration communautaire, pas une visite |
| Nom OSM évoquant une laverie, sans balise explicite | 92 | Indice faible |
| OSM évoquant plutôt un pressing / non automatique | 61 | À exclure seulement après vérification |
| Points OSM non classés | 24 | Nature à déterminer |
| Paires de doublons OSM potentiels | 2 | Non fusionnés automatiquement |
| Nouveaux / retirés depuis la précédente extraction | 0 / 0 | Comparaison des identifiants OSM |
| Candidats administratifs SIRENE actifs 96.01B | **2 370** | Comprend pressings, sièges et adresses non commerciales |
| Candidats SIRENE à moins de 45 m d'un point OSM | 897 | Proximité, pas identité confirmée |
| Points OSM distincts avec candidat SIRENE proche | 744 | Proximité, pas identité confirmée |
| Candidats SIRENE sans OSM proche, avec nom commercial évocateur | **85** | Pistes prioritaires de vérification manuelle |
| Quartiers INSEE IRIS | 2 695 | Statistiques officielles RP 2022 |

**Attention :** les nombres de sources indépendantes ne s'additionnent pas. Le code NAF 96.01B recouvre aussi des pressings et des adresses administratives. Aucun résultat Google Places n'est aspiré ou stocké : les liens Google Maps servent à un contrôle humain. L'indice économique reste expérimental et ne constitue pas un prévisionnel de CA observé.

## Flux de données et publication

- `.github/workflows/refresh-geofabrik.yml` : extraction OSM hebdomadaire depuis un nouvel extrait PBF, source, audit de doublons et variations.
- `.github/workflows/refresh-sirene.yml` : nouvelle recherche SIRENE, contrôle de diffusion, recoupement spatial et rapport de couverture.
- `.github/workflows/refresh-data.yml` : statistiques officielles INSEE IRIS.
- `.github/workflows/opportunities.yml` : recalcul reproductible hebdomadaire des cercles démographiques et des 50 zones IRIS à explorer, depuis les données à jour.
- `.github/workflows/pages.yml` : hébergement GitHub Pages et déploiement automatiquement déclenché par les nouveaux commits.
- `.github/workflows/check.yml`, `.github/workflows/browser.yml` : qualité de code et navigation.

Toutes les sources sont datées et référencées. Les fichiers défaillants ne doivent pas être remplacés par des données inventées.

## Limites restantes

Un inventaire **exhaustif et confirmé** nécessite des recherches Google manuelles, des appels aux exploitants ou des visites, en particulier pour les 85 pistes SIRENE à nom évocateur absentes d'OSM. Les indices IRIS utilisent des points représentatifs et des distances à vol d'oiseau, pas des parcours piétons. La simulation n'inclut pas de devis vérifiés, de modèle de CA calibré ou de fiscalité exhaustive. Les vérifications locales du navigateur ne sont pas une base partagée. Les zones étudiées sont des points représentatifs d'IRIS, pas des locaux disponibles ; les chiffres dans les cercles sont des estimations surfaciques et non des données d'adresse. Les isochrones piétons et le recensement terrain exhaustif ne sont pas réalisés.

Sources : © contributeurs OpenStreetMap (ODbL), INSEE recensement et SIRENE, contours IRIS IGN/Insee via Région Île-de-France, API Géo. Voir la [documentation méthodologique](docs/METHODOLOGIE.md).
