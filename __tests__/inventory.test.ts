// Inventaire — le stock est dérivé d'un registre de mouvements, jamais stocké.
//
// L'enjeu est la synchro : deux appareils hors ligne qui marquent la même
// étiquette utilisée doivent aboutir à UNE sortie, pas deux. C'est ce que
// garantit l'id déterministe des mouvements nés d'une étiquette — les tests
// ci-dessous vérifient cette convergence, la conversion d'unités (on étiquette
// en g ce qu'on stocke en kg) et le fait que renommer / re-unitiser un article
// ne réécrit jamais l'historique.

import {
  convertQty,
  findArticleByName,
  formatQty,
  isLowStock,
  lowStockArticles,
  movementId,
  movementsForArticle,
  normalizeArticleName,
  roundQty,
  DEFAULT_ARTICLE_CATEGORIES,
  NO_CATEGORY_LABEL,
  articleCategoryGroups,
  articleCategoryName,
  findCategoryByName,
  signedQty,
  articleLocationKey,
  articleLocationKeys,
  articleLocationPath,
  articleLocationTree,
  NO_LOCATION_LABEL,
  stockByArticle,
  stockOnHand,
  unitsCompatible,
  wasteByArticle,
} from '../src/lib/inventory';
import { Article, ArticleCategory, StockMovement, StockMovementKind } from '../src/types';

const mkArticle = (over: Partial<Article> = {}): Article => ({
  id: 'a1',
  name: 'Poulet cru',
  unit: 'kg',
  modifiedAt: 1,
  ...over,
});

let seq = 0;
const mkMove = (over: Partial<StockMovement> = {}): StockMovement => ({
  id: `m${++seq}`,
  articleId: 'a1',
  articleName: 'Poulet cru',
  unit: 'kg',
  kind: 'in' as StockMovementKind,
  qty: 1,
  timestamp: 1_000,
  modifiedAt: 1,
  ...over,
});

describe('unités', () => {
  it('convertit dans une même famille', () => {
    expect(convertQty(1, 'kg', 'g')).toBe(1000);
    expect(convertQty(500, 'g', 'kg')).toBe(0.5);
    expect(convertQty(1, 'L', 'ml')).toBe(1000);
    expect(convertQty(50, 'cl', 'ml')).toBe(500);
  });

  it('est insensible à la casse et aux espaces', () => {
    expect(convertQty(1, 'KG', ' g ')).toBe(1000);
    expect(unitsCompatible('L', 'ml')).toBe(true);
  });

  it("refuse de convertir entre familles — 3 broches ne valent rien en kg", () => {
    expect(convertQty(3, 'broche', 'kg')).toBeNull();
    expect(convertQty(1, 'kg', 'ml')).toBeNull();
    expect(unitsCompatible('pce', 'kg')).toBe(false);
  });

  it('laisse passer une unité inconnue vers elle-même', () => {
    expect(convertQty(3, 'broche', 'broche')).toBe(3);
    expect(unitsCompatible('bacs', 'bacs')).toBe(true);
  });

  it('arrondit pour ne pas remonter du 0.30000000000000004 dans l’UI', () => {
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });
});

describe('sens des mouvements', () => {
  it('une entrée ajoute, une sortie et une perte retirent', () => {
    expect(signedQty({ kind: 'in', qty: 5 })).toBe(5);
    expect(signedQty({ kind: 'out_used', qty: 5 })).toBe(-5);
    expect(signedQty({ kind: 'out_waste', qty: 5 })).toBe(-5);
  });

  it('une correction d’inventaire est signée dans les deux sens', () => {
    expect(signedQty({ kind: 'adjust', qty: 2 })).toBe(2);
    expect(signedQty({ kind: 'adjust', qty: -2 })).toBe(-2);
  });

  it('ignore le signe saisi sur une entrée / sortie — c’est `kind` qui décide', () => {
    expect(signedQty({ kind: 'in', qty: -5 })).toBe(5);
    expect(signedQty({ kind: 'out_used', qty: -5 })).toBe(-5);
  });
});

describe('stock dérivé', () => {
  const article = mkArticle();

  it('somme les mouvements', () => {
    const moves = [
      mkMove({ kind: 'in', qty: 10 }),
      mkMove({ kind: 'out_used', qty: 3 }),
      mkMove({ kind: 'out_waste', qty: 2 }),
    ];
    expect(stockOnHand('a1', [article], moves)).toBe(5);
  });

  it('convertit chaque mouvement vers l’unité actuelle de l’article', () => {
    // On étiquette en grammes ce qu'on stocke en kilos.
    const moves = [mkMove({ kind: 'in', qty: 2 }), mkMove({ kind: 'out_used', qty: 500, unit: 'g' })];
    expect(stockOnHand('a1', [article], moves)).toBe(1.5);
  });

  it('changer l’unité de stock ne réécrit pas l’historique', () => {
    const moves = [mkMove({ kind: 'in', qty: 2 }), mkMove({ kind: 'out_used', qty: 500, unit: 'g' })];
    const inGrams = mkArticle({ unit: 'g' });
    expect(stockOnHand('a1', [inGrams], moves)).toBe(1500);
  });

  it('ignore les mouvements supprimés', () => {
    const moves = [
      mkMove({ kind: 'in', qty: 10 }),
      mkMove({ kind: 'out_used', qty: 4, deletedAt: 2 }),
    ];
    expect(stockOnHand('a1', [article], moves)).toBe(10);
  });

  it('ignore un mouvement devenu inconvertible plutôt que de le compter de travers', () => {
    const moves = [mkMove({ kind: 'in', qty: 10 }), mkMove({ kind: 'in', qty: 3, unit: 'broche' })];
    expect(stockOnHand('a1', [article], moves)).toBe(10);
  });

  it('ignore un mouvement dont l’article n’existe plus', () => {
    const moves = [mkMove({ kind: 'in', qty: 10, articleId: 'disparu' })];
    expect(stockByArticle([article], moves).size).toBe(0);
  });

  it('rend 0 pour un article sans mouvement', () => {
    expect(stockOnHand('a1', [article], [])).toBe(0);
  });

  it('accepte un stock négatif — on ne masque pas une erreur de saisie', () => {
    expect(stockOnHand('a1', [article], [mkMove({ kind: 'out_used', qty: 3 })])).toBe(-3);
  });

  it('sépare les articles', () => {
    const b = mkArticle({ id: 'a2', name: 'Riz', unit: 'kg' });
    const moves = [
      mkMove({ kind: 'in', qty: 10 }),
      mkMove({ kind: 'in', qty: 4, articleId: 'a2', articleName: 'Riz' }),
    ];
    const totals = stockByArticle([article, b], moves);
    expect(totals.get('a1')).toBe(10);
    expect(totals.get('a2')).toBe(4);
  });
});

describe('id déterministe — convergence entre appareils', () => {
  it('la même étiquette marquée utilisée deux fois ne sort qu’une fois', () => {
    const id = movementId('p1', 'out_used');
    const fromPhoneA = mkMove({ id, kind: 'out_used', qty: 2, productId: 'p1' });
    const fromPhoneB = mkMove({ id, kind: 'out_used', qty: 2, productId: 'p1' });
    // Ce que fait la fusion de sync.ts : un seul enregistrement par id.
    const merged = [...new Map([fromPhoneA, fromPhoneB].map((m) => [m.id, m])).values()];
    expect(merged).toHaveLength(1);
    expect(stockOnHand('a1', [mkArticle()], merged)).toBe(-2);
  });

  it('distingue les sens sur une même étiquette', () => {
    expect(movementId('p1', 'in')).not.toBe(movementId('p1', 'out_used'));
    expect(movementId('p1', 'out_used')).not.toBe(movementId('p1', 'out_waste'));
  });

  it('est stable', () => {
    expect(movementId('p1', 'out_used')).toBe(movementId('p1', 'out_used'));
  });
});

describe('seuil d’alerte', () => {
  it('alerte au seuil, pas seulement en dessous', () => {
    const a = mkArticle({ minQty: 5 });
    expect(isLowStock(a, 6)).toBe(false);
    expect(isLowStock(a, 5)).toBe(true);
    expect(isLowStock(a, 4)).toBe(true);
  });

  it('un article sans seuil n’alerte jamais', () => {
    expect(isLowStock(mkArticle(), 0)).toBe(false);
  });

  it('liste les articles sous le seuil, sans les supprimés', () => {
    const a = mkArticle({ id: 'a1', name: 'Poulet cru', minQty: 5 });
    const b = mkArticle({ id: 'a2', name: 'Riz', minQty: 2 });
    const gone = mkArticle({ id: 'a3', name: 'Beurre', minQty: 99, deletedAt: 3 });
    const moves = [
      mkMove({ kind: 'in', qty: 1 }),
      mkMove({ kind: 'in', qty: 10, articleId: 'a2' }),
    ];
    expect(lowStockArticles([a, b, gone], moves).map((x) => x.id)).toEqual(['a1']);
  });
});

describe('pertes', () => {
  it('ne totalise que les étiquettes jetées', () => {
    const moves = [
      mkMove({ kind: 'out_waste', qty: 2 }),
      mkMove({ kind: 'out_used', qty: 8 }),
      mkMove({ kind: 'out_waste', qty: 500, unit: 'g' }),
    ];
    expect(wasteByArticle(moves).get('a1')).toEqual({ qty: 2.5, unit: 'kg', name: 'Poulet cru' });
  });

  it('respecte la fenêtre [from, to[', () => {
    const moves = [
      mkMove({ kind: 'out_waste', qty: 1, timestamp: 100 }),
      mkMove({ kind: 'out_waste', qty: 1, timestamp: 200 }),
      mkMove({ kind: 'out_waste', qty: 1, timestamp: 300 }),
    ];
    expect(wasteByArticle(moves, 200, 300).get('a1')?.qty).toBe(1);
  });

  it('ignore les mouvements supprimés', () => {
    const moves = [mkMove({ kind: 'out_waste', qty: 2, deletedAt: 5 })];
    expect(wasteByArticle(moves).size).toBe(0);
  });
});

describe('historique d’un article', () => {
  it('rend les mouvements du plus récent au plus ancien', () => {
    const moves = [
      mkMove({ id: 'old', timestamp: 100 }),
      mkMove({ id: 'new', timestamp: 300 }),
      mkMove({ id: 'mid', timestamp: 200 }),
      mkMove({ id: 'autre', timestamp: 999, articleId: 'a2' }),
    ];
    expect(movementsForArticle('a1', moves).map((m) => m.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('noms d’articles', () => {
  it('rapproche casse, espaces et accents', () => {
    expect(normalizeArticleName('  Poulet   Blanc ')).toBe('poulet blanc');
    expect(normalizeArticleName('Crème')).toBe(normalizeArticleName('CREME'));
  });

  it('retrouve un article existant, en ignorant les supprimés', () => {
    const a = mkArticle({ id: 'a1', name: 'Poulet blanc' });
    const gone = mkArticle({ id: 'a2', name: 'Riz', deletedAt: 2 });
    expect(findArticleByName([a, gone], 'POULET  BLANC')?.id).toBe('a1');
    expect(findArticleByName([a, gone], 'riz')).toBeUndefined();
    expect(findArticleByName([a], '   ')).toBeUndefined();
  });
});

describe('affichage', () => {
  it('n’affiche pas de décimales inutiles', () => {
    expect(formatQty(2, 'kg')).toBe('2 kg');
    expect(formatQty(2.5, 'kg')).toBe('2,5 kg');
    expect(formatQty(2)).toBe('2');
  });
});

describe('rangement dans la structure', () => {
  // Cuisine ▸ Frigo 1 ▸ Étagère 1 ▸ Bac A   |   Chambre froide (vide en dessous)
  const structure = {
    zones: [
      { id: 'zCuisine', name: 'Cuisine' },
      { id: 'zFroid', name: 'Chambre froide' },
    ],
    storageUnits: [{ id: 'u1', zoneId: 'zCuisine', name: 'Frigo 1' }],
    shelves: [{ id: 's1', unitId: 'u1', name: 'Étagère 1' }],
    bacs: [{ id: 'b1', shelfId: 's1', name: 'Bac A' }],
  };

  it('range l’article au niveau le plus profond qu’il porte', () => {
    expect(articleLocationKeyOf({ zoneId: 'zCuisine' })).toBe('zone:zCuisine');
    expect(articleLocationKeyOf({ zoneId: 'zCuisine', unitId: 'u1' })).toBe('unit:u1');
    expect(articleLocationKeyOf({ zoneId: 'zCuisine', unitId: 'u1', shelfId: 's1' })).toBe('shelf:s1');
    expect(articleLocationKeyOf({ zoneId: 'zCuisine', unitId: 'u1', shelfId: 's1', bacId: 'b1' })).toBe('bac:b1');
    expect(articleLocationKeyOf({})).toBe('none');
  });

  function articleLocationKeyOf(loc: Partial<Article>): string {
    return articleLocationKey(mkArticle({ ...loc }), structure);
  }

  it('retombe d’un cran quand le niveau profond a été supprimé', () => {
    const orphelin = mkArticle({ zoneId: 'zCuisine', unitId: 'u1', shelfId: 'disparue' });
    expect(articleLocationKey(orphelin, structure)).toBe('unit:u1');
  });

  it('n’imbrique que les niveaux réellement utilisés', () => {
    // Rangé à la zone : aucune sous-section, même si la structure descend plus bas.
    const tree = articleLocationTree([mkArticle({ id: 'a1', zoneId: 'zCuisine' })], structure);
    expect(tree.map((n) => n.name)).toEqual(['Cuisine']);
    expect(tree[0].children).toEqual([]);
    expect(tree[0].articles.map((a) => a.id)).toEqual(['a1']);
  });

  it('imbrique jusqu’au bac quand l’article y est rangé', () => {
    const deep = mkArticle({ id: 'a1', zoneId: 'zCuisine', unitId: 'u1', shelfId: 's1', bacId: 'b1' });
    const [cuisine] = articleLocationTree([deep], structure);
    expect(cuisine.name).toBe('Cuisine');
    expect(cuisine.children[0].name).toBe('Frigo 1');
    expect(cuisine.children[0].children[0].name).toBe('Étagère 1');
    expect(cuisine.children[0].children[0].children[0].name).toBe('Bac A');
    expect(cuisine.children[0].children[0].children[0].articles.map((a) => a.id)).toEqual(['a1']);
  });

  it('compte les articles de la branche entière sur chaque nœud', () => {
    const surZone = mkArticle({ id: 'a1', zoneId: 'zCuisine' });
    const dansBac = mkArticle({ id: 'a2', zoneId: 'zCuisine', unitId: 'u1', shelfId: 's1', bacId: 'b1' });
    const [cuisine] = articleLocationTree([surZone, dansBac], structure);
    expect(cuisine.total).toBe(2);
    expect(cuisine.articles.map((a) => a.id)).toEqual(['a1']);
    expect(cuisine.children[0].total).toBe(1);
  });

  it('élague les branches vides', () => {
    const tree = articleLocationTree([mkArticle({ id: 'a1', zoneId: 'zCuisine' })], structure);
    expect(tree.map((n) => n.name)).not.toContain('Chambre froide');
  });

  it('groupe les articles pas encore rangés en dernier', () => {
    const range = mkArticle({ id: 'a1', name: 'Sel', zoneId: 'zCuisine' });
    const neuf = mkArticle({ id: 'a2', name: 'Riz' });
    const tree = articleLocationTree([range, neuf], structure);
    expect(tree.map((n) => n.name)).toEqual(['Cuisine', NO_LOCATION_LABEL]);
    expect(tree[1].articles.map((a) => a.name)).toEqual(['Riz']);
  });

  it('un article rangé dans une zone supprimée reste visible avec les non-rangés', () => {
    const orphelin = mkArticle({ id: 'a5', name: 'Huile', zoneId: 'zDisparue' });
    const tree = articleLocationTree([orphelin], structure);
    expect(tree.map((n) => n.name)).toEqual([NO_LOCATION_LABEL]);
  });

  it('trie les articles par nom dans chaque nœud', () => {
    const b = mkArticle({ id: 'a1', name: 'Beurre', zoneId: 'zCuisine' });
    const a = mkArticle({ id: 'a2', name: 'Ail', zoneId: 'zCuisine' });
    expect(articleLocationTree([b, a], structure)[0].articles.map((x) => x.name)).toEqual(['Ail', 'Beurre']);
  });

  it('ignore les articles supprimés', () => {
    const gone = mkArticle({ id: 'a6', name: 'Lait', zoneId: 'zCuisine', deletedAt: 9 });
    expect(articleLocationTree([gone], structure)).toEqual([]);
  });

  it('écrit le chemin complet, lisible', () => {
    const deep = mkArticle({ zoneId: 'zCuisine', unitId: 'u1', shelfId: 's1' });
    expect(articleLocationPath(deep, structure)).toBe('Cuisine › Frigo 1 › Étagère 1');
    expect(articleLocationPath(mkArticle({}), structure)).toBe(NO_LOCATION_LABEL);
  });
});

describe('chaîne d’ouverture vers un article', () => {
  const structure = {
    zones: [{ id: 'z1', name: 'Cuisine' }],
    storageUnits: [{ id: 'u1', zoneId: 'z1', name: 'Frigo 1' }],
    shelves: [{ id: 's1', unitId: 'u1', name: 'Étagère 1' }],
    bacs: [{ id: 'b1', shelfId: 's1', name: 'Bac A' }],
  };

  it('remonte toute la chaîne jusqu’au niveau où l’article est rangé', () => {
    const deep = mkArticle({ zoneId: 'z1', unitId: 'u1', shelfId: 's1', bacId: 'b1' });
    expect(articleLocationKeys(deep, structure)).toEqual(['zone:z1', 'unit:u1', 'shelf:s1', 'bac:b1']);
  });

  it('s’arrête au niveau réellement utilisé', () => {
    expect(articleLocationKeys(mkArticle({ zoneId: 'z1', unitId: 'u1' }), structure)).toEqual(['zone:z1', 'unit:u1']);
    expect(articleLocationKeys(mkArticle({ zoneId: 'z1' }), structure)).toEqual(['zone:z1']);
  });

  it('mène au bloc des non-rangés quand l’article n’a pas d’emplacement', () => {
    expect(articleLocationKeys(mkArticle({}), structure)).toEqual(['none']);
  });

  it('s’arrête au dernier niveau encore vivant', () => {
    const orphan = mkArticle({ zoneId: 'z1', unitId: 'u1', shelfId: 'disparue' });
    expect(articleLocationKeys(orphan, structure)).toEqual(['zone:z1', 'unit:u1']);
  });
});

// --- Regroupement par catégorie --------------------------------------------
//
// L'axe de classement de l'inventaire. Ce que ces tests protègent avant tout :
// un article ne peut pas disparaître de l'écran, quelle que soit sa catégorie.
describe('articleCategoryGroups', () => {
  const cat = (id: string, name: string, deletedAt?: number): ArticleCategory => ({
    id, name, color: '#000', modifiedAt: 1, ...(deletedAt ? { deletedAt } : {}),
  });
  const art = (id: string, name: string, categoryId?: string, deletedAt?: number): Article => ({
    id, name, unit: 'kg', modifiedAt: 1,
    ...(categoryId ? { categoryId } : {}),
    ...(deletedAt ? { deletedAt } : {}),
  });

  it('groupe les articles dans leur catégorie, dans l’ordre des catégories', () => {
    const cats = [cat('c1', 'Viandes'), cat('c2', 'Sauces')];
    const groups = articleCategoryGroups(
      [art('a1', 'Ketchup', 'c2'), art('a2', 'Poulet', 'c1')],
      cats
    );
    expect(groups.map((g) => g.name)).toEqual(['Viandes', 'Sauces']);
    expect(groups[0].articles.map((a) => a.name)).toEqual(['Poulet']);
    expect(groups[0].total).toBe(1);
  });

  it('trie les articles par nom à l’intérieur d’une catégorie', () => {
    const groups = articleCategoryGroups(
      [art('a1', 'Veau', 'c1'), art('a2', 'Agneau', 'c1'), art('a3', 'Bœuf', 'c1')],
      [cat('c1', 'Viandes')]
    );
    expect(groups[0].articles.map((a) => a.name)).toEqual(['Agneau', 'Bœuf', 'Veau']);
  });

  it('ne rend pas une catégorie vide', () => {
    const groups = articleCategoryGroups([art('a1', 'Poulet', 'c1')], [cat('c1', 'Viandes'), cat('c2', 'Sauces')]);
    expect(groups.map((g) => g.name)).toEqual(['Viandes']);
  });

  it('range les articles sans catégorie dans « Sans catégorie », en dernier', () => {
    const groups = articleCategoryGroups(
      [art('a1', 'Sel'), art('a2', 'Poulet', 'c1')],
      [cat('c1', 'Viandes')]
    );
    expect(groups.map((g) => g.name)).toEqual(['Viandes', NO_CATEGORY_LABEL]);
    expect(groups[1].id).toBeNull();
  });

  it('n’affiche « Sans catégorie » que s’il y a des articles non classés', () => {
    const groups = articleCategoryGroups([art('a1', 'Poulet', 'c1')], [cat('c1', 'Viandes')]);
    expect(groups.some((g) => g.id === null)).toBe(false);
  });

  // Le filet de sécurité : quoi qu'il arrive à la catégorie, l'article reste visible.
  it('fait retomber dans « Sans catégorie » un article dont la catégorie est supprimée', () => {
    const groups = articleCategoryGroups(
      [art('a1', 'Poulet', 'c1')],
      [cat('c1', 'Viandes', 999)]
    );
    expect(groups.map((g) => g.name)).toEqual([NO_CATEGORY_LABEL]);
    expect(groups[0].articles.map((a) => a.name)).toEqual(['Poulet']);
  });

  it('fait retomber dans « Sans catégorie » un article dont la catégorie n’existe pas', () => {
    const groups = articleCategoryGroups([art('a1', 'Poulet', 'fantome')], []);
    expect(groups[0].id).toBeNull();
    expect(groups[0].articles).toHaveLength(1);
  });

  it('ignore les articles supprimés', () => {
    const groups = articleCategoryGroups(
      [art('a1', 'Poulet', 'c1'), art('a2', 'Bœuf', 'c1', 999)],
      [cat('c1', 'Viandes')]
    );
    expect(groups[0].articles.map((a) => a.name)).toEqual(['Poulet']);
    expect(groups[0].total).toBe(1);
  });

  it('ne rend rien du tout sans article', () => {
    expect(articleCategoryGroups([], [cat('c1', 'Viandes')])).toEqual([]);
  });

  // Une catégorie est plate : aucune ne peut être vide « à cause » d'un niveau
  // manquant, donc l'impasse de l'ancien classement par zone n'existe pas ici.
  it('n’a jamais de sous-niveau à déplier', () => {
    const groups = articleCategoryGroups([art('a1', 'Poulet', 'c1')], [cat('c1', 'Viandes')]);
    expect(Object.keys(groups[0])).not.toContain('children');
  });
});

describe('articleCategoryName', () => {
  const cats: ArticleCategory[] = [{ id: 'c1', name: 'Viandes', modifiedAt: 1 }];
  const base: Article = { id: 'a1', name: 'Poulet', unit: 'kg', modifiedAt: 1 };

  it('donne le nom de la catégorie', () => {
    expect(articleCategoryName({ ...base, categoryId: 'c1' }, cats)).toBe('Viandes');
  });

  it('donne « Sans catégorie » sans catégorie, ou si elle a disparu', () => {
    expect(articleCategoryName(base, cats)).toBe(NO_CATEGORY_LABEL);
    expect(articleCategoryName({ ...base, categoryId: 'parti' }, cats)).toBe(NO_CATEGORY_LABEL);
  });
});

describe('findCategoryByName', () => {
  const cats: ArticleCategory[] = [{ id: 'c1', name: 'Sauces & condiments', modifiedAt: 1 }];

  it('ignore casse, accents et espaces en trop', () => {
    expect(findCategoryByName(cats, '  SAUCES &  CONDIMENTS ')?.id).toBe('c1');
  });

  it('ne trouve rien sur un nom vide ou inconnu', () => {
    expect(findCategoryByName(cats, '   ')).toBeUndefined();
    expect(findCategoryByName(cats, 'Viandes')).toBeUndefined();
  });

  it('ignore une catégorie supprimée', () => {
    expect(findCategoryByName([{ ...cats[0], deletedAt: 9 }], 'Sauces & condiments')).toBeUndefined();
  });
});

// Les ids des catégories d'origine sont fixes exprès : c'est ce qui fait que deux
// appareils convergent sur une seule liste et qu'une suppression tient.
describe('DEFAULT_ARTICLE_CATEGORIES', () => {
  it('a des ids fixes et uniques', () => {
    const ids = DEFAULT_ARTICLE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('cat-'))).toBe(true);
  });

  it('n’a pas deux fois le même nom', () => {
    const names = DEFAULT_ARTICLE_CATEGORIES.map((c) => normalizeArticleName(c.name));
    expect(new Set(names).size).toBe(names.length);
  });
});
