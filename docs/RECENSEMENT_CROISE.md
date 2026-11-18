# Recensement croisé des laveries — Paris et petite couronne

**Date de la première consolidation : 18 novembre 2026.**  
**Périmètre :** départements 75, 92, 93 et 94 uniquement.

## Résultat et interprétation obligatoire

La consolidation recoupe les établissements étiquetés « laundry » d'OpenStreetMap et les fiches de deux annuaires indépendants. Les résultats sont des **candidats commerciaux à examiner**, et non un inventaire exhaustif des laveries automatiques réellement ouvertes.

| Indicateur | Résultat |
|---|---:|
| OpenStreetMap (OSM / Geofabrik) | 929 fiches |
| Laverie Ouvert — fiches récupérées dans les pages par ville et arrondissement | 1 162 |
| BAUG — fiches effectivement accessibles dans les pages publiques | 755 |
| BAUG — fiches annoncées par le site sur les quatre départements | 1 241 |
| Fiches BAUG annoncées mais non accessibles via les listes publiques consultées | 486 |
| **Candidats uniques après rapprochement prudent** | **1 658** |
| Candidats directement géolocalisés depuis les annuaires / OSM | 1 479 |
| Adresses supplémentaires géocodées strictement par IGN/BAN | 44 |
| Positions estimées utilisées par le classement | 1 523 |
| Candidats restant sans position exploitable après ce géocodage | 135 |
| Candidats sans géolocalisation suffisamment fiable | 179 |
| Candidats présents dans au moins deux sources cartographiques | 858 |
| Candidats présents dans une seule source | 800 |
| Candidats absents des points OSM initiaux | 729 |
| Parmi ces 729 candidats, candidats géolocalisés | 550 |
| Indices de pressing / d'activité non automatique parmi les 1 658 | 82 |
| Pages annuaires interrogées | 250 |
| Pages déclarées en échec | 2 |

La somme brute des trois catalogues est **2 846 références**, mais ces références représentent des entrées de sources avec de nombreux recoupements et doublons. Le nombre de **1 658 candidats** n'est pas le nombre de commerces distincts vérifiés. Il peut rester des doublons, des professionnels non automatiques ou des établissements fermés.

## Détail départemental

| Département | OSM | Laverie Ouvert : références brutes | BAUG : références récupérées | BAUG : références annoncées | Candidats après rapprochements | Géolocalisés |
|---|---:|---:|---:|---:|---:|---:|
| Paris 75 | 526 | 563 | 100 | 578 | 696 | 687 |
| Hauts-de-Seine 92 | 161 | 171 | 189 | 189 | 288 | 247 |
| Seine-Saint-Denis 93 | 121 | 224 | 244 | 248 | 358 | 290 |
| Val-de-Marne 94 | 121 | 204 | 222 | 226 | 316 | 255 |
| **Total** | **929** | **1 162** | **755** | **1 241** | **1 658** | **1 479** |

Les chiffres BAUG « annoncés » correspondent aux compteurs publics de ses pages départementales et non à des établissements récupérés ou certifiés. Sur les 486 fiches annoncées mais non retrouvées, **478 concernent Paris**, dont les fiches sont **tronquées à 100**, même avec un paramètre `?page=2` ; les huit autres écarts sont quatre en Seine-Saint-Denis et quatre dans le Val-de-Marne. Deux pages villes BAUG ont renvoyé HTTP 404 : L'Haÿ-les-Roses et Ormesson-sur-Marne.

## Algorithme de rapprochement

1. Départ des 929 objets OSM identifiés par leur référence `node/…` ou `way/…`.
2. Références Laverie Ouvert dédoublonnées par leur identifiant interne. Les informations de géolocalisation contenues dans les pages d'annuaire ont été reprises sans consulter les pages `/f/` bloquées par robots.txt.
3. Les références BAUG sont dédoublonnées par `data-company-id`.
4. Deux fiches ne sont rapprochées que si elles partagent le numéro, la rue normalisée et le code postal ; ou si leurs coordonnées sont séparées de moins de 12 m ; ou si la distance est inférieure à 45 m **et** le nom est proche. En présence de plusieurs rapprochements aussi plausibles, la correspondance peut être laissée ambiguë.
5. Une fiche BAUG sans coordonnées n'est placée sur la carte qu'après rapprochement d'adresse avec une autre source ou, dans certains cas, un point géocodé de SIRENE à la même adresse. **Une adresse administrative ne prouve pas la présence d'une laverie commerciale.**
6. Les catégories « pressing / potentiellement non automatique » sont **signalées**, pas automatiquement supprimées.
7. Des liens manuels vers Google Maps sont fournis. **Aucune vérification Google Places n'a été automatisée**, et aucune photo, note, avis ou donnée de fermeture provenant de Google n'a été aspirée.

Les correspondances algorithmiques ne sont pas des preuves d'identité juridique ou d'ouverture. Plusieurs commerces peuvent exister à la même adresse ; à l'inverse, des fiches voisines peuvent décrire le même commerce.

## Contrôles manuels

La page [Recensement croisé](../recensement.html) distingue, par fiche :

- **À vérifier**, statut par défaut ;
- **Fiche Google consultée et jugée concordante**, jugement manuel qui ne vaut pas une visite ;
- **Vérifié personnellement sur place** ;
- **À exclure**, par exemple après vérification d'un pressing, d'un doublon ou d'une fermeture.

Ces statuts restent dans le stockage local du navigateur et sont exportables en CSV. Ils ne modifient pas automatiquement les données publiques des autres utilisateurs.

## SIRENE et score commercial

L'observatoire conserve séparément **2 371** candidats administratifs sous l'activité NAF 96.01B (snapshot complet du 18 novembre 2026). Ils comprennent des pressings et des adresses de siège ; il est incorrect d'ajouter leur nombre aux 1 658 candidats cartographiques. Les rapprochements SIRENE à moins de 45 m sont seulement des indices géographiques.

Le classement démographique des opportunités repose toujours sur l'inventaire OSM et les estimations de population à partir d'IRIS. **La liste de 1 658 candidats ne remplace pas automatiquement l'hypothèse de concurrence de ce classement**, puisque les sources supplémentaires n'ont pas été vérifiées.

## Sources et provenance

- [OpenStreetMap](https://www.openstreetmap.org/copyright), extraction Geofabrik Île-de-France du 18/11/2026 ;
- [Laverie Ouvert](https://laverie.ouvert.tel/), répertoire départemental et pages villes ;
- [BAUG](https://baug.fr/), répertoire départemental et pages villes ;
- [Annuaire des entreprises](https://annuaire-entreprises.data.gouv.fr/), informations administratives SIRENE uniquement ;
- Géographie et statistiques INSEE séparément documentées dans [METHODOLOGIE.md](METHODOLOGIE.md).

La routine `scripts/merge_directories.py` vérifie les directives robots.txt des deux annuaires, n'interroge que leurs index autorisés, et génère `data/annuaire-croise.json` ainsi que `data/annuaire-croise-audit.json`. Elle n'enregistre pas les photos, avis, notes, numéros de téléphone ou contenus textuels des commentaires. L'audit garde la liste des éventuels échecs et le nombre de pages parcourues.

**Conclusion :** ces résultats élargissent la base de candidats au-delà des 929 objets OSM, mais ne suffisent pas à déterminer avec certitude le nombre de laveries automatiques en fonctionnement dans les quatre départements.
