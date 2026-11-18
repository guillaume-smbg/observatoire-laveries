# Recette technique — Observatoire des laveries

**Date de recette : 18 novembre 2026**  
**Dépôt** : https://github.com/guillaume-smbg/observatoire-laveries  
**Site** : https://guillaume-smbg.github.io/observatoire-laveries/  
**Comparateur** : https://guillaume-smbg.github.io/observatoire-laveries/opportunites.html

## Données réellement publiées

| Jeu / source | État | Constat |
|---|---|---|
| OSM / Geofabrik, département 75, 92, 93, 94 | Publié | 929 points OSM, 752 avec balise libre-service ; **non vérifiés** |
| Doublons OSM | Audit publié | 2 paires proches à vérifier |
| SIRENE, code historique 96.01B | Publié | 2 370 établissements administrativement actifs, pas nécessairement des laveries |
| SIRENE sans OSM proche (nom commercial évocateur) | Liste publiée | 85 pistes, liens vers recherche Google Maps |
| INSEE RP 2022 / géographie IRIS 2024 | Publié | 2 695 IRIS |
| Analyse géographique par rayon 300 / 500 / 1 000 m | Générée | 2 695 IRIS analysés, **2 589 avec indice calculable**, 106 exclus pour qualité insuffisante |
| Sélection non redondante | Générée | 50 secteurs espacés d'au moins 650 m, sous réserve de filtres |

## Contrôles automatiques

- Le test d'intégrité des données vérifie provenance, codes administratifs et cohérence des comptages.
- Le test de génération des opportunités exige trois rayons cohérents et plus de 1 000 IRIS analysables.
- La syntaxe et le câblage des éléments JavaScript/HTML ainsi que les scripts Python sont contrôlés dans GitHub Actions.
- Le test navigateur Chromium du **18/11/2026** est **réussi** : chargement des 2 695 IRIS, sélection de 50 quartiers, calcul financier réactif, changement des catégories OSM, export CSV, commande d'impression PDF et affichage mobile sans débordement. GitHub Actions : https://github.com/guillaume-smbg/observatoire-laveries/actions/runs/44289780623 .
- Le test navigateur de la carte principale est aussi **réussi**, avec la carte, les données SIRENE et les filtres OSM.
- Le workflow de déploiement GitHub Pages du dernier commit documentaire est marqué **success** : https://github.com/guillaume-smbg/observatoire-laveries/actions/runs/44290110631 . Ce contrôle ne constitue pas une inspection visuelle sur l'appareil final de l'utilisateur.

## Fonctionnalités livrées

1. Carte de découverte et filtrage OSM / SIRENE / INSEE.
2. Inventaire et rapports d'écarts : sources indépendantes, détection de doublons possibles, catégories et niveaux d'indices.
3. Zones de proximité à 300/500/1 000 m par intersection pondérée de géométries IRIS ; carte et 50 secteurs distincts.
4. Classement recalculable selon rayon, catégorie OSM et filtre géographique.
5. Fiche de zone et concurrents OSM proches, liens manuels Google Maps.
6. Comparaison de six secteurs avec sauvegarde locale, loyer et cycles/jour par secteur, trois scénarios de cash-flow.
7. Exports CSV et fonction navigateur « Imprimer / Enregistrer en PDF ».
8. Actions GitHub programmées pour actualiser sources officielles et résultat géographique, sans service payant.

## Limites non levées — exigences de validation commerciale

| Besoin | Pourquoi ce n'est pas certifié |
|---|---|
| Inventaire exhaustif des laveries automatiques ouvertes | OSM et SIRENE ne prouvent ni le libre-service, ni l'ouverture ; un contrôle Google manuel et/ou terrain est indispensable |
| Doublons / établissements fermés | Les indices techniques ne peuvent pas certifier un établissement fermé ou doublonné |
| Isochrones piétons réels | Les distances actuellement exploitées sont des **cercles géométriques** ; aucun routage piéton exhaustif n'est intégré |
| Population exacte dans un cercle | Estimation par **uniformité d'occupation des IRIS**, non comptage par adresse |
| Score de succès commercial prouvé | Indice heuristique non calibré sur les performances de laveries réelles |
| Loyer, coût d'installation et chiffre d'affaires prévisionnel validés | À compléter avec offres de locaux, relevés de prix, devis et observations terrain |
| Synchronisation des fiches entre appareils | Comparaisons et contrôles stockés localement dans le navigateur, sans serveur |

**Conclusion : la version logicielle est exploitable pour explorer, prioriser et comparer. Elle n'est pas une étude de marché exhaustive certifiée, et ne remplace pas la vérification terrain avant décision d'investissement.**
