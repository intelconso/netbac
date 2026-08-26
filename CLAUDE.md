# NETBAC — Project Instructions

> Last updated: 2026-04-25.
> This file loads automatically every Claude Code session. Keep it current as the project evolves.

## What this is

NETBAC Mobile — HACCP traceability app for restaurants. React Native / Expo. Backend on Firebase (Auth + Firestore). Production-bound mobile app, not a web product.

## Stack

- **Frontend:** React Native via Expo (managed workflow + native modules where needed)
- **Auth:** Firebase Authentication (Google sign-in via `@react-native-google-signin`)
- **DB:** Cloud Firestore (`@react-native-firebase/firestore`)
- **Native modules:** Expo dev client, expo-camera, expo-notifications
- **Styling:** NativeWind (Tailwind for RN)
- **Tests:** Jest

## Common commands

```bash
npm start          # expo dev server
npm run android    # run on connected android device / emulator
npm run ios        # run on iOS simulator (mac only)
npm run lint
npm test
```

## Files / dirs to know

- `app/` — Expo Router screens
- `__mocks__/` + `jest.setup.js` — test scaffolding
- `google-services.json`, `GoogleService-Info.plist` — Firebase config (gitignored, per-machine)
- `claude.sh` — local convenience launcher

## Style preferences

- Terse, direct, no trailing summaries
- Clickable path format: `[file.tsx](app/file.tsx)` or `[file.tsx:42](app/file.tsx#L42)`
- French UI labels where applicable
- No emojis unless asked

## Safety rules

- **Never push Firebase config files.** They're per-environment and ignored.
- **Confirm before** running migrations / changing Firestore security rules / touching production data.
- Auto-memory at `~/.claude/projects/-home-fares-projects-netbac/memory/` — feedback rules persist across sessions.

## Open status

- **Courses (2026-08-26)** — liste de ce qu'il faut acheter, **totalement
  séparée des étiquettes et de l'inventaire** : catalogue à part, quantités à
  part, aucun `Article` ni `StockMovement` n'est lu ou écrit. Décision de
  cadrage, pas un oubli — un « Poulet » de courses et un « Poulet » du stock
  sont deux enregistrements sans lien.
  Trois entités dans [shopping.ts](src/lib/shopping.ts) : `Supplier` (le
  groupe — repris du tableau papier `course_liste.docx`, où la colonne de
  gauche est un FOURNISSEUR, avec sa note de jour de commande « lundi pour
  mardi »), `ShoppingItem` (ce qu'on PEUT commander) et `ShoppingEntry` (ce
  qu'on commande cette fois). Séparer catalogue et quantités est ce qui permet
  de vider la liste sans toucher au catalogue.
  **Une entrée PAR produit**, jamais un objet `{ [itemId]: qty }` global :
  `applyCloudState` fusionne en dernier-écrit-gagne PAR ENREGISTREMENT, donc
  deux personnes qui remplissent la liste en même temps garderaient chacune
  leurs lignes au lieu d'écraser toute la liste de l'autre. L'id de l'entrée
  EST l'id du produit (déterministe) — deux appareils hors ligne convergent sur
  une ligne au lieu d'additionner. Une quantité remise à 0 **garde** son
  enregistrement : le supprimer le ferait ressusciter à la fusion suivante.
  Cycle : **liste unique remise à zéro** (`clearShoppingList`), pas d'historique
  de tournées. Les lignes libres (`ShoppingEntry.name` présent = produit hors
  catalogue tapé pour cette tournée) disparaissent au vidage ; si le nom
  correspond à un produit du catalogue du même fournisseur, on renseigne CE
  produit — sinon le PDF montrerait deux fois la même chose.
  Suppression d'un fournisseur **en cascade** sur ses produits, contrairement aux
  catégories d'inventaire : un produit de courses sans magasin n'a nulle part
  d'utile où retomber.
  Export PDF par `printToFileAsync` + `expo-sharing` et **non** `Print.printAsync`
  (celui des rapports HACCP, qui n'ouvre que les imprimantes) : c'est ce qui fait
  apparaître WhatsApp dans la feuille de partage. Le PDF ne porte **que** les
  produits de quantité > 0 et jette les fournisseurs devenus vides.
  **Le PDF tient sur UNE page, toujours** — celui qui fait les courses tient une
  feuille, pas une liasse. Deux leviers dans `shoppingDensity()` : des COLONNES
  (le tableau papier en avait déjà) et une densité choisie d'après le nombre de
  lignes, par paliers, de « 1 colonne en 14 px » à « 4 colonnes en 7 px ». Ce
  qui rend la garantie tenable, c'est que le nom d'un produit est tronqué par
  ellipse et jamais replié : une ligne fait exactement une ligne, donc la
  hauteur se CALCULE au lieu de se découvrir à l'impression. Les paliers sont
  verrouillés par `__tests__/shopping.test.ts` (« tenue sur une page »), qui
  rejoue ce calcul — c'est là qu'il faut aller avant de grossir une police.
  Catalogue entier rempli : ~68 % de la page. Au-delà d'environ 250 lignes
  (quatre fois le catalogue), plus aucune densité lisible ne tient.
  Écrans : [courses.tsx](app/courses.tsx) pour remplir,
  [courses-catalog.tsx](app/courses-catalog.tsx) +
  [ShoppingCatalogManager](src/components/ShoppingCatalogManager.tsx) pour régler
  (accessible des deux côtés : Paramètres, et l'engrenage de l'écran Courses).
  Ranger un produit ailleurs passe par un bouton **Déplacer** qui ouvre la liste
  des destinations — pas par un glisser-déposer : les fournisseurs sont des
  sections repliables, et la cible est le plus souvent repliée ou à plusieurs
  écrans de distance. Le produit DÉMÉNAGE (même id), donc sa quantité en cours
  le suit ; un « supprimer puis recréer » l'aurait perdue. Le déplacement est
  refusé si la destination porte déjà ce nom.

- **Pas-à-pas des tâches (2026-08-26)** — deuxième vue de l'écran Tâches, calquée
  sur la saisie des températures ([FridgeTempSection](src/components/controls/FridgeTempSection.tsx)) :
  fil de points, « Tâche N / M », une carte à l'écran, Précédent / Passer.
  L'idée n'est pas la navigation mais l'inversion de la question : la vue liste
  demande « qui a fait ça ? » à chaque cochage, le pas-à-pas demande « qui
  êtes-vous ? » **une fois** puis déroule la tournée de cette personne. Le
  regroupement par employé en découle — `queueForEmployee()` met ses tâches
  attribuées d'abord, puis les non attribuées, et laisse dehors celles d'un
  autre (l'attribution n'étant qu'une indication, la vue liste garde tout
  accessible). **La liste reste le défaut** : ouvrir l'écran pour cocher une
  case ne doit pas imposer de traverser un assistant.
  Les deux vues partagent la capture photo via
  [useTaskPhotoDrafts](src/lib/useTaskPhotoDrafts.ts) + [TaskPhotoPicker](src/components/TaskPhotoPicker.tsx),
  sans quoi les règles (compression, brouillon jetable, définitif après
  validation) divergeraient entre les deux.

- **Tâches « chaque service » (2026-08-26)** — récurrence `perService` : un
  passage PAR SERVICE, le planning décidant du nombre (`servicesFor()` — deux un
  jour ouvert, un seul un jour à service unique, aucun un jour fermé). Vocabulaire
  repris de `FridgeTempCheck` : `ServiceSlot = 'debut' | 'fin'`.
  Conséquence structurante : l'unité manipulée par les écrans n'est plus la tâche
  mais le **passage** — `dueTasksFor()` rend des `TaskInstance` (`{ task, service?,
  key }`) et non plus des `Task`. `taskCompletionId()` ne suffixe l'id du service
  que pour une tâche `perService`, donc **aucun cochage déjà enregistré ne change
  d'identité**. `completeTask` ignore un `service` passé sur une autre récurrence,
  sans quoi un seul passage se scinderait en deux enregistrements.
  La pastille Début/Fin n'apparaît qu'un jour à deux services : « Début » seul
  n'aurait pas de « fin » en face.

- **Photos de tâches (2026-08-26)** — le cochage d'une tâche peut porter des
  photos, la preuve que le travail a été fait. Elles sont une entité de premier
  niveau (`AppState.taskPhotos`, voir `TaskPhoto`) et **pas** un tableau sur
  `TaskCompletion` : `applyCloudState` fusionne en dernier-écrit-gagne PAR
  ENREGISTREMENT, donc deux appareils photographiant la même tâche le même jour
  se seraient écrasés. Le lien passe par `completionId` déterministe, d'où la
  survie au décochage/recochage. Elles empruntent la file offline des photos
  produit ([photoQueue.ts](src/lib/photoQueue.ts), même preset Cloudinary
  `netbac_products`) : `PendingPhoto.kind` distingue les deux, et son absence
  vaut `'product'` pour ne pas orpheliner une photo mise en file avant la
  fonctionnalité. Règles arrêtées : **toujours facultatives** (rien ne bloque
  jamais un cochage), **nombre illimité**, et **jamais supprimables** — pas de
  `deletedAt` sur `TaskPhoto`, l'effacement n'existe que sur le brouillon local
  tant que la feuille n'est pas validée. Relecture dans
  [tasks.tsx](app/tasks.tsx) et [controls-history.tsx](app/controls-history.tsx),
  aperçu plein écran via [TaskPhotoStrip](src/components/TaskPhotoStrip.tsx).
  **Point de vigilance :** tout l'état part dans UN document Firestore (limite
  1 Mio) ; « illimité » + conservation définitive fait grossir `taskPhotos` sans
  borne — c'est là que la limite tombera en premier.

- **Inventaire v1 (2026-08-24)** — suivi de stock par article, alimenté **uniquement**
  par les étiquettes. Le stock n'est jamais stocké : il est dérivé d'un registre
  append-only (`AppState.stockMovements`) parce qu'un compteur se corromprait sous
  l'union-merge de `sync.ts`. Toute la logique pure est dans
  [inventory.ts](src/lib/inventory.ts) ; les écritures passent par
  `reconcileProductMovements` dans [store.ts](src/lib/store.ts) — y compris les
  suppressions en cascade d'un emplacement (`tombProductsWhere`), sans quoi une
  étiquette supprimée laissait son entrée au registre.
  Règle en place : **toute création d'étiquette fait entrer du stock** — voir
  `createsStockIn()`, seul endroit à changer pour ne compter que les livraisons.
  **Aucune saisie manuelle de quantité** : une quantité tapée à la main n'apprend
  rien (il a fallu regarder l'étagère) et s'ajoutait à celle des étiquettes, donc
  comptait deux fois le même stock. `addStockMovement` / `setStockCount` restent
  dans le store, sans écran — c'est le point de reprise quand un vrai inventaire
  physique sera nécessaire. Corollaire : les écrans d'inventaire sont en lecture
  seule, et aucune étiquette n'est modifiable nulle part dans l'app.
  Un article ne se crée **que** depuis une étiquette (« Créer « … » » à
  l'étiquetage, ou `importArticlesFromProducts`) : son unité est celle de
  l'étiquette, il n'y a donc rien à deviner. Le catalogue ne sert qu'à RÉGLER —
  catégorie, seuil, renommage, suppression. L'unité y est librement modifiable,
  même vers une autre famille : `stockByArticle` ignore alors les mouvements
  devenus inconvertibles (rien n'est effacé, revenir à l'unité d'origine
  retrouve le stock) et l'écran prévient au lieu de refuser.
  Le catalogue est groupé par **catégorie** (`articleCategories`, liste plate,
  6 familles par défaut à ids fixes) et non plus par emplacement : une catégorie
  est intrinsèque à l'ingrédient, un emplacement est contingent — et un article
  rangé dans une zone sans bac ne pouvait jamais recevoir d'étiquette. Les champs
  `zoneId`/`unitId`/`shelfId`/`bacId` de `Article` restent lisibles mais dormants.
