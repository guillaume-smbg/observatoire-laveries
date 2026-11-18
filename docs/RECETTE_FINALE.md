# Recette technique — Observatoire des laveries

**Date de recette : 18 novembre 2026 — audit et rafraîchissement complémentaires**
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
| SIRENE, code historique 96.01B | Snapshot publié | **2 370** candidats administrativement actifs (snapshot courant). Le balayage complet relancé pendant cette recette en a trouvé 2 371 ; écart d'une ligne à réconcilier au prochain rafraîchissement. Aucun des deux nombres ne confirme une laverie |
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
- Recette locale du 18 novembre 2026 : `tests/smoke.mjs`, `tests/data-integrity.mjs`, `tests/directories.mjs`, `tests/census-static.mjs`, `tests/geocoded.mjs`, `tests/opportunities.mjs`, `python3 -m py_compile scripts/*.py` réussis. Le test navigateur Playwright n'a pas pu être exécuté dans l'environnement local : téléchargement du navigateur tronqué et Chromium système bloqué par l'interdiction de sockets. Les tests navigateur restent à confirmer sur GitHub Actions.

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

## Rafraîchissement complémentaire du 18 novembre 2026

- Le balayage SIRENE a lu toutes les pages annoncées : 45/45 pour Paris, 20/20 pour le 92, 19/19 pour le 93 et 16/16 pour le 94, sans erreur ni plafond de pagination. Une nouvelle garde empêche un balayage partiel de remplacer l'instantané complet ou d'alimenter les rapprochements d'adresses.
- Le recroisement a examiné 135 pages Laverie Ouvert et 115 pages BAUG, dans le respect de robots.txt et de la temporisation du collecteur. Il retrouve 1 658 candidats distincts. Deux URLs BAUG renvoient 404. L'index BAUG annonce 578 fiches à Paris, mais seules 100 fiches du département sont accessibles ; 478 ne sont pas récupérées par les pages publiques accessibles. Aucun résultat n'a été fabriqué pour combler cet écart.
- Le géocodeur IGN/BAN a ajouté 44 positions d'adresse strictes parmi 179 demandes ; le calcul géographique utilise donc 1 523 pistes positionnées et laisse 135 non localisées. Les adresses restent des indices d'adresse, pas des preuves de commerce. Le service a renvoyé plusieurs HTTP 504 avant la fin ; le seuil n'a pas été assoupli.
- Le calcul de proximité a été régénéré : 2 695 IRIS, 2 589 indices calculables, 106 non calculables et 50 zones distinctes. Le classement reste une heuristique non calibrée et la concurrence inclut des candidats non vérifiés.
- Vérification HTTP le 18 novembre : pages principales, recensement, opportunités et fichiers publics de recensement/INSEE/OSM répondent 200 sur GitHub Pages. Ce contrôle ne valide pas l'interaction navigateur.

