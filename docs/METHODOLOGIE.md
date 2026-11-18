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

## 8. Vérification complémentaire sur Google Maps — facultative et manuelle
Chaque fiche OSM de la carte et de l'inventaire dispose d'un lien « Rechercher sur Google Maps ». Ce lien transmet une requête de recherche construite à partir du nom et de l'adresse OSM, ou de coordonnées OSM si le nom est absent. Il ne prouve pas l'identité de l'établissement retrouvé, et aucun détail Google (nom, avis, note, statut) n'est collecté ou conservé automatiquement.

**Statuts distincts :** « À vérifier » ; « Fiche Google concordante (non vérifié sur place) » ; « Contrôlé sur place » ; « À exclure ». Le deuxième statut atteste seulement du jugement manuel de l'utilisateur à la date indiquée, et non d'une validation de Google ou d'une visite sur site. Les statuts sont enregistrés localement et exportables en CSV.

**Pourquoi ne pas importer automatiquement Google Places dans cette carte gratuite ?** L'API officielle Google Places est soumise à une tarification à l'usage, à des conditions de stockage et aux restrictions d'affichage sur fond de carte non Google. L'utilisation du lien vers Google Maps reste gratuite, conserve l'architecture GitHub Pages + Leaflet/OpenStreetMap et évite d'enregistrer un secret API dans le site. Ne pas aspirer ou republier les avis, photos, notes ou données Places.

Pour constituer une seconde source réutilisable en open data, compléter avec **SIRENE** (INSEE) : enregistrer seulement des données d'établissements diffusibles, l'activité et l'état administratif, en rappelant que la sous-classe 96.01B (blanchisserie-teinturerie de détail, NAF Rév.2) comprend aussi le pressing et ne certifie ni un point de vente réellement ouvert ni un service automatique.

## 9. Classement des zones IRIS et estimations en 300 / 500 / 1 000 m

Le module public `opportunites.html` exploite les données produites par `scripts/build_opportunities.py` et `.github/workflows/opportunities.yml`. Il traite les zones IRIS pour lesquelles les statistiques et les polygones officiels sont disponibles. Il utilise un **point représentatif à l'intérieur de chaque zone**, qui n'est ni une adresse de commerce ni une surface disponible.

### Population et logements dans les cercles

Pour chaque zone IRIS recoupant un cercle de 300, 500 ou 1 000 mètres, les habitants et résidences principales contributifs sont multipliés par la **fraction surfacique** de l'IRIS contenue dans le cercle, puis additionnés. Les proportions de logements de moins de 40 m² et de locataires utilisent des nombres de résidences principales ainsi estimés comme poids. Hypothèse forte : **distribution uniforme des habitants et logements à l'intérieur de chaque IRIS**, souvent incorrecte à l'échelle de la rue. Les distances proviennent d'une approximation métrique plane locale sur coordonnées longitude/latitude ; elles **ne sont pas des itinéraires piétons ni des isochrones**.

Les rayons débordant de la région d'étude peuvent manquer de logements et de concurrents externes. La surface territoriale réellement couverte est mesurée. Un indice de potentiel **n'est pas proposé si cette couverture est inférieure à 80 %** ou si les principales statistiques sont absentes.

### Indice non calibré

Pour le rayon choisi, le score exploratoire affiché sur la page Opportunités utilise :

- 38 % : résidences principales estimées dans le rayon, normalisées par le 90e percentile régional (plafond de 100 points) ;
- 25 % : part estimée des logements de moins de 40 m² ;
- 22 % : part estimée des logements occupés par des locataires ;
- 15 % : facteur de concurrence indicatif `max(0,100 - 16 × nombre_de_points_OSM)`.

Le visiteur choisit le périmètre (300/500/1 000 m) et le niveau de preuves OSM à inclure (tous les points, libre-service renseigné, ou libre-service plus noms évocateurs). Le classement recalculé peut donc varier selon les hypothèses. Le score n'est **pas** un modèle de conversion des habitants en visites et ne constitue pas une prédiction du CA.

La sélection par défaut retient au maximum **50 zones distinctes**, avec un espacement géographique d'au moins 650 m entre leurs points représentatifs, afin d'éviter d'afficher plusieurs fois le même bassin approximatif.

### Modèle économique par emplacement

Chaque zone sauvegardée a un loyer et un nombre de cycles/jour saisis **manuellement**. Les autres variables (prix HT du lavage, coûts variables, charges fixes, investissement, emprunt, intérêt et durée) sont paramétrées par le visiteur. La formule de flux mensuel est :
`cycles/jour × 30,4375 × (prix HT - coûts variables HT) + marge services - loyer HT - charges fixes HT - mensualité du prêt`.

L'application présente trois variantes d'activité : **65 %, 100 % et 135 %** des cycles journaliers saisis. La valeur initiale est une simple hypothèse, jamais une conséquence du score de potentiel. Elle est éditable séparément pour chaque zone. La comparaison est sauvegardée dans le navigateur, exportable en CSV et imprimable vers PDF à l'aide de la fonction d'impression du navigateur.

Ce module ne remplace pas la validation terrain des laveries, une étude piétonne, un relevé de loyers, un prévisionnel fiscal ni une décision d'investissement.
