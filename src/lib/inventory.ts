// Inventaire — le stock est DÉRIVÉ, jamais stocké.
//
// Pourquoi : la synchro fusionne les états par union, dernier `modifiedAt`
// gagnant sur chaque élément (voir sync.ts). Un compteur `stock` posé sur
// l'article se corromprait dès que deux appareils hors ligne décrémentent
// chacun de leur côté — la fusion garderait une seule des deux écritures et le
// stock serait faux, sans que personne ne le voie. Un registre de mouvements
// en append-only, lui, fusionne sans perte : chaque mouvement est un élément
// distinct, et les mouvements nés d'une étiquette portent un id déterministe,
// donc deux appareils qui marquent la même étiquette utilisée convergent sur
// UN seul mouvement au lieu de sortir la quantité deux fois.
//
// Ce fichier ne contient que du calcul pur : les écritures dans le registre
// sont faites par le store, à l'intérieur des actions produit existantes.

import { Article, ArticleCategory, StockMovement, StockMovementKind } from '../types';

// Unités connues et leur famille. Le facteur ramène à l'unité de base de la
// famille (g pour les masses, ml pour les volumes) — c'est ce qui permet
// d'étiqueter en g un article stocké en kg.
//
// Toute unité absente de cette table (pce, broche, bacs, ou une unité ajoutée
// par l'utilisateur dans Paramètres) est sa propre famille : convertible avec
// elle-même uniquement. C'est volontaire — "3 broches" ne vaut rien en kg.
const UNIT_FAMILIES: Record<string, { family: string; factor: number }> = {
  kg: { family: 'masse', factor: 1000 },
  g: { family: 'masse', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  cl: { family: 'volume', factor: 10 },
  ml: { family: 'volume', factor: 1 },
};

const normUnit = (unit: string): string => unit.trim().toLowerCase();

export function unitFamily(unit: string): string {
  const u = normUnit(unit);
  return UNIT_FAMILIES[u]?.family ?? u;
}

export function unitsCompatible(a: string, b: string): boolean {
  return unitFamily(a) === unitFamily(b);
}

// Arrondi de confort : les conversions et les sommes en virgule flottante
// produisent des 0.30000000000000004 qui remonteraient tels quels dans l'UI.
// 3 décimales couvre le gramme près quand on stocke en kg.
export function roundQty(qty: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(qty * f) / f;
}

// Convertit une quantité entre deux unités. `null` quand les unités ne sont pas
// de la même famille — l'appelant décide quoi en faire, on ne devine jamais.
export function convertQty(qty: number, from: string, to: string): number | null {
  const f = normUnit(from);
  const t = normUnit(to);
  if (f === t) return qty;
  const fromDef = UNIT_FAMILIES[f];
  const toDef = UNIT_FAMILIES[t];
  if (!fromDef || !toDef || fromDef.family !== toDef.family) return null;
  return roundQty((qty * fromDef.factor) / toDef.factor);
}

// Id déterministe d'un mouvement né d'une étiquette — voir l'en-tête du fichier.
// Une étiquette ne peut produire qu'un mouvement de chaque sens : la marquer
// utilisée deux fois (ou depuis deux appareils) réécrit le même enregistrement.
export function movementId(productId: string, kind: StockMovementKind): string {
  return `mv-${productId}-${kind}`;
}

// Le sens d'un mouvement. Seul endroit qui sait que `qty` est une magnitude
// pour les entrées/sorties et un écart signé pour les corrections d'inventaire.
export function signedQty(movement: Pick<StockMovement, 'kind' | 'qty'>): number {
  switch (movement.kind) {
    case 'in':
      return Math.abs(movement.qty);
    case 'out_used':
    case 'out_waste':
      return -Math.abs(movement.qty);
    case 'adjust':
      return movement.qty;
    default:
      return 0;
  }
}

const liveMovements = (movements: StockMovement[]): StockMovement[] =>
  movements.filter((m) => !m.deletedAt);

// Stock de chaque article, dans l'unité ACTUELLE de l'article.
//
// Chaque mouvement est reconverti depuis l'unité qu'il a snapshottée : changer
// l'unité de stock d'un article (kg → g) reste donc sans danger, l'historique
// n'a pas à être réécrit. Un mouvement dont l'unité n'est plus convertible
// (l'unité de l'article a changé de famille) est ignoré plutôt que compté de
// travers — le store empêche ce changement, ceci n'est que la ceinture.
export function stockByArticle(
  articles: Article[],
  movements: StockMovement[]
): Map<string, number> {
  const unitOf = new Map(articles.map((a) => [a.id, a.unit]));
  const totals = new Map<string, number>();
  for (const m of liveMovements(movements)) {
    const target = unitOf.get(m.articleId);
    if (target === undefined) continue; // article supprimé définitivement
    const qty = convertQty(signedQty(m), m.unit, target);
    if (qty === null) continue;
    totals.set(m.articleId, (totals.get(m.articleId) ?? 0) + qty);
  }
  for (const [id, total] of totals) totals.set(id, roundQty(total));
  return totals;
}

export function stockOnHand(
  articleId: string,
  articles: Article[],
  movements: StockMovement[]
): number {
  return stockByArticle(articles, movements).get(articleId) ?? 0;
}

// Les mouvements d'un article, du plus récent au plus ancien — l'ordre de
// lecture de la fiche article.
export function movementsForArticle(
  articleId: string,
  movements: StockMovement[]
): StockMovement[] {
  return liveMovements(movements)
    .filter((m) => m.articleId === articleId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// Un article est "sous le seuil" quand il a un seuil réglé et que le stock l'a
// atteint. Au seuil (et non en dessous) : c'est le moment de recommander, pas
// une fois à court. Sans seuil réglé, un article n'alerte jamais.
export function isLowStock(article: Article, onHand: number): boolean {
  if (article.minQty === undefined || article.minQty === null) return false;
  return onHand <= article.minQty;
}

export function lowStockArticles(
  articles: Article[],
  movements: StockMovement[]
): Article[] {
  const totals = stockByArticle(articles, movements);
  return articles
    .filter((a) => !a.deletedAt && isLowStock(a, totals.get(a.id) ?? 0))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Total des pertes par article sur une fenêtre — les étiquettes jetées.
// `from` / `to` sont inclusifs-exclusifs ([from, to[), comme partout ailleurs.
export function wasteByArticle(
  movements: StockMovement[],
  from = 0,
  to = Number.MAX_SAFE_INTEGER
): Map<string, { qty: number; unit: string; name: string }> {
  const out = new Map<string, { qty: number; unit: string; name: string }>();
  for (const m of liveMovements(movements)) {
    if (m.kind !== 'out_waste') continue;
    if (m.timestamp < from || m.timestamp >= to) continue;
    const prev = out.get(m.articleId);
    if (!prev) {
      out.set(m.articleId, { qty: Math.abs(m.qty), unit: m.unit, name: m.articleName });
      continue;
    }
    // Fenêtre mixte en unités : on ramène sur l'unité déjà retenue quand c'est
    // possible, sinon on laisse la ligne telle quelle plutôt que d'additionner
    // des choux et des carottes.
    const converted = convertQty(Math.abs(m.qty), m.unit, prev.unit);
    if (converted === null) continue;
    prev.qty = roundQty(prev.qty + converted);
  }
  return out;
}

// --- Regroupement par emplacement -----------------------------------------
//
// Un article a UNE quantité — celle du registre — et un emplacement de
// rangement dans la structure. Pas de quantité par emplacement : le stock d'un
// ingrédient est un seul chiffre, que l'utilisateur peut corriger à la main
// (ce qui enregistre un écart d'inventaire, voir setStockCount dans store.ts).
//
// L'emplacement est porté par l'article, pas déduit de ses étiquettes : deux
// étiquettes du même poulet peuvent être posées dans deux frigos sans que
// « combien de poulet ai-je » ait deux réponses.
//
// On range aussi profond qu'on veut — zone seule, ou jusqu'au bac — et
// l'arborescence n'affiche que les niveaux réellement utilisés : personne ne
// déroule trois sous-sections vides parce qu'il range au frigo près.

export const NO_LOCATION_LABEL = 'Sans emplacement';

export type LocationLevel = 'zone' | 'unit' | 'shelf' | 'bac';

export interface LocationStructure {
  zones: { id: string; name: string; deletedAt?: number }[];
  storageUnits: { id: string; zoneId: string; name: string; deletedAt?: number }[];
  shelves: { id: string; unitId: string; name: string; deletedAt?: number }[];
  bacs: { id: string; shelfId: string; name: string; deletedAt?: number }[];
}

export interface StockNode {
  key: string;              // 'zone:xxx' … 'none' — sert de clé de repli dans l'UI
  id: string | null;
  level: LocationLevel | 'none';
  name: string;
  articles: Article[];      // rangés exactement ici
  children: StockNode[];
  total: number;            // articles d'ici ET de tout ce qui est en dessous
}

const nodeKey = (level: LocationLevel | 'none', id: string | null) =>
  id ? `${level}:${id}` : 'none';

// Où l'article est rangé, au plus profond qui existe encore. Un bac supprimé
// fait retomber sur l'étagère, puis l'enceinte, puis la zone — plutôt que de
// faire disparaître l'article de l'écran.
export function articleLocationKey(article: Article, structure: LocationStructure): string {
  const alive = <T extends { id: string; deletedAt?: number }>(list: T[], id?: string) =>
    id ? list.find((x) => x.id === id && !x.deletedAt) : undefined;

  if (alive(structure.bacs, article.bacId)) return nodeKey('bac', article.bacId!);
  if (alive(structure.shelves, article.shelfId)) return nodeKey('shelf', article.shelfId!);
  if (alive(structure.storageUnits, article.unitId)) return nodeKey('unit', article.unitId!);
  if (alive(structure.zones, article.zoneId)) return nodeKey('zone', article.zoneId!);
  return 'none';
}

// La chaîne de nœuds qui mène à un article, du plus haut au plus profond.
// Sert à ouvrir l'arborescence pile où il se trouve — par exemple pour montrer
// un article existant à quelqu'un qui essayait d'en créer un homonyme.
export function articleLocationKeys(article: Article, structure: LocationStructure): string[] {
  const deepest = articleLocationKey(article, structure);
  if (deepest === 'none') return ['none'];
  const chain: string[] = [];
  for (const [level, id] of [
    ['zone', article.zoneId],
    ['unit', article.unitId],
    ['shelf', article.shelfId],
    ['bac', article.bacId],
  ] as const) {
    if (!id) break;
    const key = `${level}:${id}`;
    chain.push(key);
    if (key === deepest) break;
  }
  return chain;
}

// L'arborescence de rangement, élaguée : une branche sans aucun article, à
// aucun de ses niveaux, n'est pas rendue.
export function articleLocationTree(
  articles: Article[],
  structure: LocationStructure
): StockNode[] {
  const live = articles.filter((a) => !a.deletedAt);
  const buckets = new Map<string, Article[]>();
  for (const a of live) {
    const key = articleLocationKey(a, structure);
    buckets.set(key, [...(buckets.get(key) ?? []), a]);
  }

  const byName = (a: Article, b: Article) => a.name.localeCompare(b.name);
  const at = (level: LocationLevel, id: string) => [...(buckets.get(nodeKey(level, id)) ?? [])].sort(byName);

  const build = (level: LocationLevel, id: string, name: string, children: StockNode[]): StockNode | null => {
    const own = at(level, id);
    const total = own.length + children.reduce((n, c) => n + c.total, 0);
    if (total === 0) return null;
    return { key: nodeKey(level, id), id, level, name, articles: own, children, total };
  };

  const liveOf = <T extends { deletedAt?: number }>(list: T[]) => list.filter((x) => !x.deletedAt);

  const nodes = liveOf(structure.zones)
    .map((zone) => {
      const units = liveOf(structure.storageUnits)
        .filter((u) => u.zoneId === zone.id)
        .map((unit) => {
          const shelves = liveOf(structure.shelves)
            .filter((sh) => sh.unitId === unit.id)
            .map((shelf) => {
              const bacs = liveOf(structure.bacs)
                .filter((b) => b.shelfId === shelf.id)
                .map((bac) => build('bac', bac.id, bac.name, []))
                .filter((n): n is StockNode => n !== null);
              return build('shelf', shelf.id, shelf.name, bacs);
            })
            .filter((n): n is StockNode => n !== null);
          return build('unit', unit.id, unit.name, shelves);
        })
        .filter((n): n is StockNode => n !== null);
      return build('zone', zone.id, zone.name, units);
    })
    .filter((n): n is StockNode => n !== null);

  const unplaced = [...(buckets.get('none') ?? [])].sort(byName);
  if (unplaced.length) {
    nodes.push({
      key: 'none',
      id: null,
      level: 'none',
      name: NO_LOCATION_LABEL,
      articles: unplaced,
      children: [],
      total: unplaced.length,
    });
  }
  return nodes;
}

// Le chemin lisible d'un article — "Chambre froide › CF1 › Étagère 2".
export function articleLocationPath(article: Article, structure: LocationStructure): string {
  const parts: string[] = [];
  const zone = structure.zones.find((z) => z.id === article.zoneId && !z.deletedAt);
  const unit = structure.storageUnits.find((u) => u.id === article.unitId && !u.deletedAt);
  const shelf = structure.shelves.find((sh) => sh.id === article.shelfId && !sh.deletedAt);
  const bac = structure.bacs.find((b) => b.id === article.bacId && !b.deletedAt);
  if (zone) parts.push(zone.name);
  if (unit) parts.push(unit.name);
  if (shelf) parts.push(shelf.name);
  if (bac) parts.push(bac.name);
  return parts.length ? parts.join(' › ') : NO_LOCATION_LABEL;
}

// --- Rangement automatique -------------------------------------------------
//
// L'emplacement d'un article est posé à la main. Mais quand le catalogue a été
// amorcé depuis des étiquettes existantes, l'information est déjà là sans
// personne pour l'avoir saisie : chaque étiquette est dans un bac, donc sur une
// étagère, dans une enceinte, dans une zone. On s'en sert pour ranger d'un tap
// ce qui traîne dans « Sans emplacement ».
//
// C'est un coup de pouce ponctuel, pas une règle : une fois la zone posée, elle
// ne bouge plus, même si les étiquettes déménagent.

// Les seuls champs de la structure dont le rangement a besoin. Une forme
// minimale plutôt que les types complets, pour rester testable sans fabriquer
// une structure entière.
export interface StructureIndex {
  bacs: { id: string; shelfId: string; deletedAt?: number }[];
  shelves: { id: string; unitId: string; deletedAt?: number }[];
  storageUnits: { id: string; zoneId: string; deletedAt?: number }[];
}

// Le chemin complet d'un bac, remonté à travers étagère et enceinte.
// `undefined` quand un maillon manque — un bac supprimé ne localise plus rien.
export function pathOfBac(
  bacId: string | undefined,
  structure: StructureIndex
): ArticleLocationPath | undefined {
  if (!bacId) return undefined;
  const bac = structure.bacs.find((b) => b.id === bacId && !b.deletedAt);
  if (!bac) return undefined;
  const shelf = structure.shelves.find((sh) => sh.id === bac.shelfId && !sh.deletedAt);
  if (!shelf) return undefined;
  const unit = structure.storageUnits.find((u) => u.id === shelf.unitId && !u.deletedAt);
  if (!unit) return undefined;
  return { zoneId: unit.zoneId, unitId: unit.id, shelfId: shelf.id, bacId: bac.id };
}

export interface ArticleLocationPath {
  zoneId?: string;
  unitId?: string;
  shelfId?: string;
  bacId?: string;
}

export interface PlaceableProduct {
  bacId: string;
  articleId?: string;
  status: 'active' | 'used' | 'discarded';
  deletedAt?: number;
}

// L'emplacement déduit des étiquettes d'un article : aussi PROFOND que les
// étiquettes sont d'accord, et pas plus.
//
// Toutes dans le même bac → le bac. Réparties sur l'étagère mais dans le même
// frigo → le frigo. Éparpillées dans la cuisine → la cuisine. C'est précis là
// où la donnée est précise, et prudent là où elle ne l'est pas : on ne range
// jamais un article dans un bac qui ne le contient qu'à moitié.
//
// La zone, elle, est prise à la majorité — un article un peu partout doit
// quand même atterrir quelque part.
export function deducedLocationOf(
  articleId: string,
  products: PlaceableProduct[],
  structure: StructureIndex
): ArticleLocationPath | undefined {
  const paths = products
    .filter((p) => !p.deletedAt && p.status === 'active' && p.articleId === articleId)
    .map((p) => pathOfBac(p.bacId, structure))
    .filter((path): path is ArticleLocationPath => !!path);
  if (paths.length === 0) return undefined;

  const counts = new Map<string, number>();
  for (const path of paths) counts.set(path.zoneId!, (counts.get(path.zoneId!) ?? 0) + 1);
  let zoneId = paths[0].zoneId!;
  let best = 0;
  for (const [id, n] of counts) if (n > best) { zoneId = id; best = n; }

  const inZone = paths.filter((p) => p.zoneId === zoneId);
  const agreedOn = (key: keyof ArticleLocationPath): string | undefined => {
    const first = inZone[0][key];
    return first && inZone.every((p) => p[key] === first) ? first : undefined;
  };

  const unitId = agreedOn('unitId');
  const shelfId = unitId ? agreedOn('shelfId') : undefined;
  const bacId = shelfId ? agreedOn('bacId') : undefined;
  return { zoneId, ...(unitId ? { unitId } : {}), ...(shelfId ? { shelfId } : {}), ...(bacId ? { bacId } : {}) };
}

// Comparaison de noms d'articles : c'est ce qui évite d'avoir "Poulet blanc",
// "poulet blanc" et "Poulet  Blanc" comme trois articles. Sert à la création
// inline depuis l'étiquette et à l'import depuis les étiquettes existantes.
export function normalizeArticleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export function findArticleByName(articles: Article[], name: string): Article | undefined {
  const target = normalizeArticleName(name);
  if (!target) return undefined;
  return articles.find((a) => !a.deletedAt && normalizeArticleName(a.name) === target);
}

// Affichage d'une quantité : pas de décimales inutiles (2 kg, pas 2.000 kg).
export function formatQty(qty: number, unit?: string): string {
  const rounded = roundQty(qty);
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  return unit ? `${text} ${unit}` : text;
}

export const MOVEMENT_LABELS: Record<StockMovementKind, string> = {
  in: 'Entrée',
  out_used: 'Utilisé',
  out_waste: 'Jeté',
  adjust: 'Modification',
};

// Quels types d'action font ENTRER du stock à la création de l'étiquette.
//
// Tous — et c'est volontaire. Un article est défini à la granularité où on
// l'étiquette ("Poulet cru" et "Poulet rôti" sont deux articles distincts),
// donc créer une étiquette EST l'arrivée de cet article-là dans le restaurant,
// qu'il vienne d'une livraison ou de la cuisine. Il n'y a pas de double
// comptage, puisque le cru et le rôti ne sont pas le même article.
//
// Restreindre ce test à 'received' (les seules livraisons) rendrait le stock
// des articles PRODUITS sur place systématiquement négatif : le rôti sortirait
// à chaque étiquette utilisée sans jamais être entré. Tout le code passe par
// cette fonction, donc c'est ici — et seulement ici — que ça se change.
export function createsStockIn(_actionType: string): boolean {
  return true;
}

// --- Regroupement par catégorie --------------------------------------------
//
// L'axe de classement de l'inventaire. Voir ArticleCategory dans types.ts pour
// le pourquoi : une catégorie est intrinsèque à l'ingrédient, un emplacement ne
// l'est pas.
//
// Plat, et c'est le point : une catégorie n'a pas de sous-structure, donc elle
// ne peut pas être vide « à cause » d'un niveau manquant. Le cul-de-sac de
// l'ancien classement par zone (un article rangé dans une zone sans bac, donc
// incapable de recevoir une étiquette) n'existe pas ici.

export const NO_CATEGORY_LABEL = 'Sans catégorie';

// Catégories proposées d'origine. Les ids sont FIXES, pas tirés au hasard : deux
// appareils qui démarrent chacun sur ces défauts convergent sur une seule liste
// à la fusion, et supprimer « Sauces » sur l'un le supprime vraiment partout au
// lieu de le voir revenir depuis l'autre.
export const DEFAULT_ARTICLE_CATEGORIES: { id: string; name: string; color: string }[] = [
  { id: 'cat-viandes', name: 'Viandes', color: '#EF4444' },
  { id: 'cat-poissons', name: 'Poissons', color: '#0EA5E9' },
  { id: 'cat-legumes', name: 'Fruits et légumes', color: '#10B981' },
  { id: 'cat-sauces', name: 'Sauces', color: '#8B5CF6' },
  { id: 'cat-boissons', name: 'Boissons', color: '#EC4899' },
  { id: 'cat-desserts', name: 'Desserts', color: '#F59E0B' },
];

export const DEFAULT_CATEGORY_COLOR = '#9CA3AF';

export interface CategoryGroup {
  id: string | null;      // null = « Sans catégorie »
  name: string;
  color: string;
  articles: Article[];
  total: number;
}

// Les articles groupés par catégorie, dans l'ordre des catégories.
//
// Une catégorie vide n'est PAS rendue — sauf « Sans catégorie », qui n'apparaît
// que s'il y a effectivement des articles non classés. Personne ne déroule une
// section vide, et un article sans catégorie ne doit jamais disparaître de l'écran.
export function articleCategoryGroups(
  articles: Article[],
  categories: ArticleCategory[]
): CategoryGroup[] {
  const live = articles.filter((a) => !a.deletedAt);
  const liveCategories = categories.filter((c) => !c.deletedAt);
  const known = new Set(liveCategories.map((c) => c.id));

  const byName = (a: Article, b: Article) => a.name.localeCompare(b.name);
  const buckets = new Map<string, Article[]>();
  for (const a of live) {
    // Une catégorie supprimée fait retomber l'article dans « Sans catégorie »
    // plutôt que de l'effacer de l'inventaire.
    const key = a.categoryId && known.has(a.categoryId) ? a.categoryId : 'none';
    buckets.set(key, [...(buckets.get(key) ?? []), a]);
  }

  const groups: CategoryGroup[] = [];
  for (const c of liveCategories) {
    const own = buckets.get(c.id);
    if (!own?.length) continue;
    groups.push({
      id: c.id,
      name: c.name,
      color: c.color ?? DEFAULT_CATEGORY_COLOR,
      articles: [...own].sort(byName),
      total: own.length,
    });
  }

  const unclassified = buckets.get('none');
  if (unclassified?.length) {
    groups.push({
      id: null,
      name: NO_CATEGORY_LABEL,
      color: DEFAULT_CATEGORY_COLOR,
      articles: [...unclassified].sort(byName),
      total: unclassified.length,
    });
  }
  return groups;
}

// Le nom lisible de la catégorie d'un article — pour la fiche article.
export function articleCategoryName(article: Article, categories: ArticleCategory[]): string {
  const c = categories.find((x) => x.id === article.categoryId && !x.deletedAt);
  return c?.name ?? NO_CATEGORY_LABEL;
}

// Comparaison de noms de catégories, même normalisation que les articles :
// « Sauces » et « sauces » sont la même catégorie.
export function findCategoryByName(
  categories: ArticleCategory[],
  name: string
): ArticleCategory | undefined {
  const target = normalizeArticleName(name);
  if (!target) return undefined;
  return categories.find((c) => !c.deletedAt && normalizeArticleName(c.name) === target);
}
