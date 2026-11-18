# Recette technique — Observatoire des laveries

**Date de recette : 18 novembre 2026**  
**Dépôt** : https://github.com/guillaume-smbg/observatoire-laveries  
**Site** : https://guillaume-smbg.github.io/observatoire-laveries/  
**Comparateur** : https://guillaume-smbg.github.io/observatoire-laveries/opportunites.html
**Recensement croisé** : https://guillaume-smbg.github.io/observatoire-laveries/recensement.html

## Données réellement publiées

| Jeu / source | État | Constat |
|---|---|---|
| OSM / Geofabrik, département 75, 92, 93, 94 | Publié | 929 points OSM, 752 avec balise libre-service ; **non vérifiés** |
| Doublons OSM | Audit publié | 2 paires proches à vérifier |
| Croisement OSM / BAUG / Laverie Ouvert | Publié | **1 658 candidats non vérifiés**, dont 1 479 directement géolocalisés |
| Géocodage officiel IGN/BAN | Publié | **44 adresses supplémentaires** localisées avec numéro, code postal et score vérifiés ; **135 pistes encore non localisées** |
| Fichier de vérification exhaustive | Publié | **1 658 lignes : A 384 / B 641 / C 633**, ordonnées par priorité de contrôle, sans prétendre que les commerces existent |
| SIRENE, code historique 96.01B | Publié | 2 370 établissements administrativement actifs, pas nécessairement des laveries |
| SIRENE sans OSM proche (nom commercial évocateur) | Liste publiée | 85 pistes, liens vers recherche Google Maps |
| INSEE RP 2022 / géographie IRIS 2024 | Publié | 2 695 IRIS |
| Analyse géographique par rayon 300 / 500 / 1 000 m | Générée | 2 695 IRIS analysés, **2 589 avec indice calculable**, 106 exclus pour qualité insuffisante |
| Sélection non redondante | Générée | 50 secteurs espacés d'au moins 650 m, sous réserve de filtres |

## Contrôles automatiques

- Le test d'intégrité des données vérifie provenance, codes administratifs et cohérence des comptages.
- Le test de génération des opportunités exige trois rayons cohérents, des catégories d’annuaires distinctes et plus de 1 000 IRIS analysables. Le fichier JSON de priorisation est validé avant sa publication.
- La syntaxe et le câblage des éléments JavaScript/HTML ainsi que les scripts Python sont contrôlés dans GitHub Actions.
- Les tests navigateur Chromium contrôlent le chargement des 2 695 IRIS, les cinquante premières zones distinctes, les scénarios de concurrence OSM/annuaires, le calcul financier réactif, la demande d’isochrones piétons (service simulé pour éviter une dépendance réseau durant le test), les exports CSV, l’impression PDF et l’affichage mobile. Les derniers résultats sont consultables sur https://github.com/guillaume-smbg/observatoire-laveries/actions.
- Le test navigateur de la carte principale est aussi **réussi**, avec la carte, les données SIRENE et les filtres OSM.
- Les workflows de validation, de génération de données et de déploiement GitHub Pages doivent tous être contrôlés à chaque évolution : https://github.com/guillaume-smbg/observatoire-laveries/actions. Une réussite CI n’est pas une vérification terrain des laveries.

## Fonctionnalités livrées

1. Carte de découverte et filtrage OSM / SIRENE / INSEE.
2. Inventaire et rapports d'écarts : sources indépendantes, détection de doublons possibles, catégories et niveaux d'indices.
3. Zones de proximité à 300/500/1 000 m par intersection pondérée de géométries IRIS ; carte et 50 secteurs distincts.
4. Classement recalculable selon rayon, niveau de recoupement des trois annuaires et filtre géographique. Écart de résultats selon les sources affiché pour chaque zone.
5. Fiche de zone et candidats concurrentiels proches issus des sources sélectionnées, liens manuels Google Maps, et isochrones piétons à 5 / 10 / 15 minutes sur demande via le démonstrateur Valhalla (sans effet sur le score).
6. Comparaison de six secteurs avec sauvegarde locale, loyer et cycles/jour par secteur, trois scénarios de cash-flow.
7. Exports CSV et fonction navigateur « Imprimer / Enregistrer en PDF ».
8. Actions GitHub programmées pour actualiser les annuaires, les adresses IGN/BAN, les sources officielles, les 2 695 zones IRIS et la liste de vérification, sans service payant.
9. Contrôles terrain personnels avec notes, activité constatée, lien de référence, export CSV et sauvegarde/restauration JSON dans le navigateur.

## Limites non levées — exigences de validation commerciale

| Besoin | Pourquoi ce n'est pas certifié |
|---|---|
| Inventaire exhaustif des laveries automatiques ouvertes | Les 1 658 candidats sont issus de trois annuaires non exhaustifs ; les fermetures, pressings et doublons ne peuvent être éliminés sans contrôles Google manuels et/ou terrain. BAUG annonce encore 486 fiches non accessibles dans ses index publics |
| Doublons / établissements fermés | Les indices techniques ne peuvent pas certifier un établissement fermé ou doublonné |
| Isochrones piétons réels | Contours piétons proposés à la demande via le démonstrateur Valhalla, sous réserve de disponibilité ; ils ne servent pas au score ni aux estimations de population, toujours fondés sur des cercles géométriques |
| Population exacte dans un cercle | Estimation par **uniformité d'occupation des IRIS**, non comptage par adresse |
| Score de succès commercial prouvé | Indice heuristique non calibré sur les performances de laveries réelles |
| Loyer, coût d'installation et chiffre d'affaires prévisionnel validés | À compléter avec offres de locaux, relevés de prix, devis et observations terrain |
| Synchronisation des fiches entre appareils | Comparaisons et contrôles stockés localement dans le navigateur, sans serveur |

**Conclusion : la version logicielle est exploitable pour explorer, prioriser et comparer. Elle n'est pas une étude de marché exhaustive certifiée, et ne remplace pas la vérification terrain avant décision d'investissement.**
