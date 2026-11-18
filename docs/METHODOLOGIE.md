# Méthodologie et limites — Observatoire des laveries

Dernière conception : 18 novembre 2026. Projet public exploratoire, gratuit et indépendant.

## 1. Sources réellement utilisées
- **INSEE, recensement de la population 2022, base IRIS Logement** : https://www.insee.fr/fr/statistiques/8647012 . Variables : `P22_RP` (résidences principales), `P22_RP_M30M2`, `P22_RP_3040M2`, `P22_RP_LOC`. Part de petits logements : (moins de 30 m² + 30 à moins de 40 m²) / résidences principales. Part locataire : résidences principales occupées par des locataires / résidences principales.
- **INSEE, RP 2022, base IRIS Population** : https://www.insee.fr/fr/statistiques/8647014 . Variable `P22_POP`.
- **IGN / INSEE, contours IRIS géographie 2024**, relais open data Région Île-de-France : https://data.iledefrance.fr/explore/dataset/iris/information/ . Les contours sont simplifiés pour le web. Les codes IRIS doivent correspondre lors de la jointure ; les zones sans jointure ne sont pas inventées.
- **OpenStreetMap**, requêtes Overpass sur départements administratifs 75, 92, 93, 94 : https://wiki.openstreetmap.org/wiki/Overpass_API . Les balises `shop=laundry` et `amenity=laundry` ne constituent **pas** un inventaire certifié de laveries automatiques. Elles peuvent inclure pressings et blanchisseries.
- **API Géo** : https://geo.api.gouv.fr/ pour la population communale et les centres communaux. Population communale et population d'un IRIS sont deux notions distinctes.

## 2. Chaîne de données reproductible
Le script `scripts/refresh_data.py` télécharge les sources publiques officielles, vérifie la présence des variables et le nombre minimal de lignes, joint les données par code IRIS, calcule un point représentatif dans chaque polygone et produit :
- `data/iris-2022.json` (statistiques originales regroupées par IRIS, année et géographie indiquées) ;
- `data/iris-2022-contours.geojson` (formes simplifiées et sourcées) ;
- `data/laveries-osm.json` (objets OSM, identifiants, sources, date d'extraction et départements éventuellement manquants) ;
- `data/refresh-status.json` (échecs et nombres de lignes).

Une source indisponible ne doit pas être remplacée par un tableau inventé. Le navigateur signale la donnée manquante et retire les classements impossibles. La mise à jour est planifiée chaque lundi, avec déclenchement manuel possible dans GitHub Actions. La fréquence ne garantit pas le bon fonctionnement des API externes ; consultez les rapports de workflow.

## 3. Analyse de concurrence
- Nombre de points OSM à 300, 500 et 1 000 mètres, distance à vol d'oiseau (formule de Haversine).
- Les établissements de part et d'autre des frontières départementales sont inclus dans le calcul si les quatre collectes ont abouti.
- Le décompte est **non exhaustif et non vérifié** ; une absence sur OSM ne signifie pas absence de laverie.
- L'analyse par IRIS utilise un point représentatif de sa géométrie, **pas** la totalité de sa zone ni un temps de marche piéton.
- Les valeurs marquées « ND » ne doivent pas être remplacées par zéro.

## 4. Indice d'exploration géographique
Si et uniquement si les statistiques IRIS et la collecte OSM des quatre départements sont présentes, l'application calcule un indice de comparaison à partir de :
1. Volume des résidences principales rapporté au maximum observé dans la base ;
2. Part de résidences principales de moins de 40 m² ;
3. Part de résidences principales occupées par des locataires ;
4. Pénalité de concurrence indicative : 100 moins 20 points par objet OSM dans le rayon sélectionné, plancher zéro.

Les pondérations utilisateur sont modifiables. L'indice est une **heuristique non validée statistiquement**, non un score de rentabilité, de chiffre d'affaires ou de demande prouvée. La fiabilité d'un projet suppose la vérification de la concurrence, les comptages terrain, la clientèle potentielle, le loyer, les travaux et la réalité du marché.

## 5. Prévisionnel financier
Les valeurs initiales sont des illustrations, **pas des devis**. Les prix et postes sont entrés en HT. Le calcul compare travaux « brut » et « ancien commerce », équipements « neufs » et « occasion », apport et financement. Les scénarios prudent/central/dynamique modifient le nombre de cycles/jour (65 %, 100 %, 135 %).

**Flux mensuel d'exploitation indicatif** = CA lavages HT + marge annexe - charges fixes - coûts variables par lavage. Le flux après financement soustrait la mensualité du prêt. Le seuil de couverture du modèle comprend la mensualité du prêt et tient compte de la marge annexe.

Le modèle n'inclut pas la fiscalité, les remboursements et récupérations de TVA, les amortissements, les variations d'encaissement, l'impôt sur les sociétés, la CFE réelle si non saisie, la valeur résiduelle, la saisonnalité ni d'éventuelles garanties bancaires. Les valeurs ne constituent pas une décision d'investissement.

## 6. Vérification terrain, sécurité et confidentialité
Chaque établissement OSM demeure « non vérifié » par défaut. Un visiteur peut affecter un statut local depuis son navigateur : cela ne modifie pas la base globale. Ces annotations sont stockées uniquement dans le navigateur (`localStorage`) et peuvent être exportées ; elles peuvent disparaître si le stockage local est effacé.

Le site est statique sur GitHub Pages, sans service payant, sans mot de passe ni données SMBG/Supabase, et ne reçoit pas les fichiers CSV et GeoJSON importés localement. Le navigateur interroge toutefois des services externes (tuiles OSM, Géo API, CDN Leaflet, éventuellement Overpass), qui reçoivent les requêtes correspondantes.

## 7. Limites restantes et validation métier
Aucun recensement exhaustif de laveries automatiques ne peut être certifié sans vérifications complémentaires sur place. Le score heuristique n'est pas calibré sur des performances réelles de magasins. Il faudra obtenir des prix effectivement pratiqués, établir la localisation exacte des installations, valider les coûts d'eau/énergie, contraintes techniques et accessibilité, puis confronter les résultats aux exploitants.
