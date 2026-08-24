// L'inventaire branché sur les étiquettes.
//
// La promesse de la fonctionnalité : marquer une étiquette utilisée ou jetée
// fait descendre le stock de l'article, sans qu'aucun écran n'ait à s'en
// occuper. Ces tests vérifient le branchement — toutes les mutations
// d'étiquette rejouent le registre — et les garde-fous du catalogue.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';
import {
  DEFAULT_ARTICLE_CATEGORIES,
  articleCategoryGroups,
  movementId,
  stockOnHand,
} from '../src/lib/inventory';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

const DAY = 86_400_000;

// Un article + une étiquette rattachée, le décor de la plupart des tests.
const setup = (opts: { unit?: string; qty?: number; labelUnit?: string } = {}) => {
  const s = useStore.getState();
  const articleId = s.addArticle({ name: 'Poulet cru', unit: opts.unit ?? 'kg' });
  const productId = useStore.getState().addProduct({
    bacId: 'b1',
    name: 'Poulet cru',
    articleId,
    quantity: opts.qty ?? 2,
    unit: opts.labelUnit ?? opts.unit ?? 'kg',
    dlc: Date.now() + 3 * DAY,
    actionType: 'received',
  });
  return { articleId, productId };
};

const onHand = (articleId: string) => {
  const s = useStore.getState();
  return stockOnHand(articleId, s.articles, s.stockMovements);
};

const liveMovements = (productId?: string) =>
  useStore.getState().stockMovements.filter((m) => !m.deletedAt && (!productId || m.productId === productId));

describe('une étiquette fait bouger le stock', () => {
  it('créer une étiquette fait entrer sa quantité', () => {
    const { articleId } = setup({ qty: 2 });
    expect(onHand(articleId)).toBe(2);
  });

  it('marquer utilisé fait sortir la quantité — le cycle complet revient à zéro', () => {
    const { articleId, productId } = setup({ qty: 2 });
    useStore.getState().updateProductStatus(productId, 'used');
    expect(onHand(articleId)).toBe(0);
    expect(liveMovements(productId).map((m) => m.kind).sort()).toEqual(['in', 'out_used']);
  });

  it('marquer jeté sort la quantité et la classe en perte', () => {
    const { articleId, productId } = setup({ qty: 2 });
    useStore.getState().updateProductStatus(productId, 'discarded');
    expect(onHand(articleId)).toBe(0);
    expect(liveMovements(productId).some((m) => m.kind === 'out_waste')).toBe(true);
  });

  it('marquer utilisé deux fois ne sort qu’une fois', () => {
    const { articleId, productId } = setup({ qty: 2 });
    useStore.getState().updateProductStatus(productId, 'used');
    useStore.getState().updateProductStatus(productId, 'used');
    expect(onHand(articleId)).toBe(0);
    expect(liveMovements(productId).filter((m) => m.kind === 'out_used')).toHaveLength(1);
  });

  it('une étiquette sans article rattaché ne bouge aucun stock', () => {
    const id = useStore.getState().addProduct({
      bacId: 'b1', name: 'Truc', quantity: 5, unit: 'kg',
      dlc: Date.now() + DAY, actionType: 'received',
    });
    useStore.getState().updateProductStatus(id, 'used');
    expect(liveMovements()).toHaveLength(0);
  });

  it('étiqueter en grammes ce qui est stocké en kilos', () => {
    const { articleId, productId } = setup({ unit: 'kg', labelUnit: 'g', qty: 500 });
    expect(onHand(articleId)).toBe(0.5);
    useStore.getState().updateProductStatus(productId, 'used');
    expect(onHand(articleId)).toBe(0);
  });
});

describe('l’étiquette et le stock ne peuvent pas diverger', () => {
  it('corriger la quantité corrige le mouvement, sans le dupliquer', () => {
    const { articleId, productId } = setup({ qty: 2 });
    useStore.getState().updateProduct(productId, { quantity: 5 });
    expect(onHand(articleId)).toBe(5);
    expect(liveMovements(productId)).toHaveLength(1);
  });

  it('changer d’article déplace le stock', () => {
    const { articleId, productId } = setup({ qty: 2 });
    const autre = useStore.getState().addArticle({ name: 'Poulet rôti', unit: 'kg' });
    useStore.getState().updateProduct(productId, { articleId: autre });
    expect(onHand(articleId)).toBe(0);
    expect(onHand(autre)).toBe(2);
  });

  it('supprimer l’étiquette retire ses mouvements — en tombstone, pas en effaçant', () => {
    const { articleId, productId } = setup({ qty: 2 });
    useStore.getState().updateProductStatus(productId, 'used');
    useStore.getState().deleteProduct(productId);
    expect(onHand(articleId)).toBe(0);
    expect(liveMovements(productId)).toHaveLength(0);
    expect(useStore.getState().stockMovements.every((m) => m.deletedAt)).toBe(true);
  });

  it('éditer une étiquette déjà utilisée ne déplace pas la sortie dans le temps', () => {
    const { productId } = setup({ qty: 2 });
    useStore.getState().updateProductStatus(productId, 'used');
    const before = liveMovements(productId).find((m) => m.kind === 'out_used')!.timestamp;
    useStore.getState().updateProduct(productId, { notes: 'une note' });
    const after = liveMovements(productId).find((m) => m.kind === 'out_used')!.timestamp;
    expect(after).toBe(before);
  });

  it('une date d’usage rétroactive date la sortie, elle', () => {
    const { productId } = setup({ qty: 2 });
    const usedAt = Date.now() - 2 * DAY;
    useStore.getState().updateProductStatus(productId, 'used', { usedAt });
    expect(liveMovements(productId).find((m) => m.kind === 'out_used')!.timestamp).toBe(usedAt);
  });

  it('l’entrée est datée de la création de l’étiquette', () => {
    const { productId } = setup();
    const product = useStore.getState().products.find((p) => p.id === productId)!;
    expect(liveMovements(productId).find((m) => m.kind === 'in')!.timestamp).toBe(product.addedAt);
  });

  it('le mouvement porte un id déterministe et pointe vers son étiquette', () => {
    const { productId } = setup();
    const move = liveMovements(productId).find((m) => m.kind === 'in')!;
    expect(move.id).toBe(movementId(productId, 'in'));
    expect(move.productId).toBe(productId);
  });

  it('snapshotte le nom de l’article — le renommer n’efface pas l’historique', () => {
    const { articleId, productId } = setup();
    useStore.getState().updateArticle(articleId, { name: 'Volaille' });
    expect(liveMovements(productId)[0].articleName).toBe('Poulet cru');
  });
});

describe('jeté en masse depuis les alertes', () => {
  it('sort chaque étiquette une fois', () => {
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    const ids = [1, 2, 3].map(() =>
      useStore.getState().addProduct({
        bacId: 'b1', name: 'Poulet cru', articleId, quantity: 1, unit: 'kg',
        dlc: Date.now() - DAY, actionType: 'received',
      })
    );
    expect(onHand(articleId)).toBe(3);
    ids.forEach((id) => useStore.getState().updateProductStatus(id, 'discarded'));
    expect(onHand(articleId)).toBe(0);
    expect(liveMovements().filter((m) => m.kind === 'out_waste')).toHaveLength(3);
  });
});

describe('catalogue d’articles', () => {
  it('la création est idempotente sur le nom', () => {
    const a = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    const b = useStore.getState().addArticle({ name: '  POULET  CRU ', unit: 'g' });
    expect(b).toBe(a);
    expect(useStore.getState().articles).toHaveLength(1);
  });

  it('refuse de renommer sur un nom déjà pris', () => {
    const a = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    useStore.getState().addArticle({ name: 'Riz', unit: 'kg' });
    expect(useStore.getState().updateArticle(a, { name: 'riz' }).ok).toBe(false);
  });

  it('autorise un changement d’unité dans la même famille', () => {
    const { articleId } = setup();
    expect(useStore.getState().updateArticle(articleId, { unit: 'g' }).ok).toBe(true);
    expect(onHand(articleId)).toBe(2000);
  });

  // L'unité est libre, même vers une autre famille : c'est un choix assumé,
  // l'écran prévient. Rien ne convertit des kilos en pièces, donc les mouvements
  // déjà au registre cessent simplement d'être comptés — ils ne sont ni
  // supprimés ni comptés de travers.
  it('autorise un changement d’unité vers une autre famille', () => {
    const { articleId } = setup();
    expect(onHand(articleId)).toBe(2);

    const res = useStore.getState().updateArticle(articleId, { unit: 'pce' });
    expect(res.ok).toBe(true);
    expect(useStore.getState().articles.find((a) => a.id === articleId)?.unit).toBe('pce');

    // Les kilos ne sont plus comptables en pièces : le stock repart de zéro.
    expect(onHand(articleId)).toBe(0);
    // Mais l'historique est intact — rien n'a été effacé.
    expect(liveMovements().filter((m) => m.articleId === articleId)).toHaveLength(1);
  });

  it('revenir à l’unité d’origine retrouve le stock', () => {
    const { articleId } = setup();
    useStore.getState().updateArticle(articleId, { unit: 'pce' });
    expect(onHand(articleId)).toBe(0);
    useStore.getState().updateArticle(articleId, { unit: 'kg' });
    expect(onHand(articleId)).toBe(2);
  });

  it('autorise le changement d’unité tant qu’il n’y a pas d’historique', () => {
    const articleId = useStore.getState().addArticle({ name: 'Oeufs', unit: 'kg' });
    expect(useStore.getState().updateArticle(articleId, { unit: 'pce' }).ok).toBe(true);
  });

  it('supprimer un article garde ses mouvements en base', () => {
    const { articleId } = setup();
    useStore.getState().deleteArticle(articleId);
    expect(useStore.getState().articles[0].deletedAt).toBeTruthy();
    expect(useStore.getState().stockMovements).toHaveLength(1);
  });
});

describe('saisies manuelles', () => {
  it('une entrée manuelle monte le stock', () => {
    const articleId = useStore.getState().addArticle({ name: 'Riz', unit: 'kg' });
    useStore.getState().addStockMovement({ articleId, kind: 'in', qty: 10 });
    expect(onHand(articleId)).toBe(10);
  });

  it('deux saisies manuelles identiques comptent deux fois — ce sont deux événements', () => {
    const articleId = useStore.getState().addArticle({ name: 'Riz', unit: 'kg' });
    useStore.getState().addStockMovement({ articleId, kind: 'in', qty: 10 });
    useStore.getState().addStockMovement({ articleId, kind: 'in', qty: 10 });
    expect(onHand(articleId)).toBe(20);
  });

  it('l’inventaire physique enregistre l’écart, dans les deux sens', () => {
    const { articleId } = setup({ qty: 2 });
    useStore.getState().setStockCount(articleId, 1.5, { operatorName: 'Fares' });
    expect(onHand(articleId)).toBe(1.5);
    const adjust = liveMovements().find((m) => m.kind === 'adjust')!;
    expect(adjust.qty).toBe(-0.5);
    expect(adjust.operatorName).toBe('Fares');

    useStore.getState().setStockCount(articleId, 4);
    expect(onHand(articleId)).toBe(4);
  });

  it('un inventaire conforme est enregistré aussi — il prouve le comptage', () => {
    const { articleId } = setup({ qty: 2 });
    useStore.getState().setStockCount(articleId, 2);
    expect(liveMovements().filter((m) => m.kind === 'adjust')).toHaveLength(1);
  });

  it('une saisie manuelle se supprime, un mouvement d’étiquette non', () => {
    const { articleId, productId } = setup();
    useStore.getState().addStockMovement({ articleId, kind: 'in', qty: 10 });
    const manual = liveMovements().find((m) => !m.productId)!;
    expect(useStore.getState().deleteStockMovement(manual.id).ok).toBe(true);
    expect(onHand(articleId)).toBe(2);

    const fromLabel = movementId(productId, 'in');
    const res = useStore.getState().deleteStockMovement(fromLabel);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/étiquette/);
  });
});

describe('amorçage depuis les étiquettes existantes', () => {
  const legacy = (name: string, unit: string, status: 'active' | 'used' = 'active') => {
    const id = useStore.getState().addProduct({
      bacId: 'b1', name, quantity: 1, unit, dlc: Date.now() + DAY, actionType: 'received',
    });
    if (status === 'used') useStore.getState().updateProductStatus(id, 'used');
    return id;
  };

  it('crée un article par nom distinct, dans l’unité dominante', () => {
    legacy('Poulet', 'kg');
    legacy('Poulet', 'kg');
    legacy('poulet', 'g');
    legacy('Riz', 'kg');

    const res = useStore.getState().importArticlesFromProducts();
    expect(res.created).toBe(2);
    const poulet = useStore.getState().articles.find((a) => a.name.toLowerCase() === 'poulet')!;
    expect(poulet.unit).toBe('kg');
  });

  it('rattache les étiquettes actives et les fait entrer en stock', () => {
    legacy('Poulet', 'kg');
    legacy('Poulet', 'kg');
    const res = useStore.getState().importArticlesFromProducts();
    expect(res.linked).toBe(2);
    const poulet = useStore.getState().articles[0];
    expect(onHand(poulet.id)).toBe(2);
  });

  it('ne rattache pas l’historique — pas de sorties sans entrée, pas de stock négatif', () => {
    legacy('Poulet', 'kg', 'used');
    legacy('Poulet', 'kg');
    const res = useStore.getState().importArticlesFromProducts();
    expect(res.linked).toBe(1);
    expect(onHand(useStore.getState().articles[0].id)).toBe(1);
  });

  it('est rejouable sans rien dupliquer', () => {
    legacy('Poulet', 'kg');
    useStore.getState().importArticlesFromProducts();
    const second = useStore.getState().importArticlesFromProducts();
    expect(second).toEqual({ created: 0, linked: 0 });
    expect(useStore.getState().articles).toHaveLength(1);
    expect(liveMovements()).toHaveLength(1);
  });
});

describe('quantité de référence, corrigée à la main', () => {
  it('poser la quantité comptée devient la nouvelle vérité', () => {
    const { articleId } = setup({ qty: 2 });
    useStore.getState().setStockCount(articleId, 7);
    expect(onHand(articleId)).toBe(7);
  });

  it('la correction n’écrase rien — elle s’ajoute au registre comme un écart', () => {
    const { articleId, productId } = setup({ qty: 2 });
    useStore.getState().setStockCount(articleId, 7);
    // L'entrée de l'étiquette est intacte, l'écart est une ligne de plus.
    expect(liveMovements(productId).find((m) => m.kind === 'in')!.qty).toBe(2);
    expect(liveMovements().find((m) => m.kind === 'adjust')!.qty).toBe(5);
  });

  it('les étiquettes continuent de bouger la quantité après une correction', () => {
    const { articleId, productId } = setup({ qty: 2 });
    useStore.getState().setStockCount(articleId, 7);
    useStore.getState().updateProductStatus(productId, 'used');
    expect(onHand(articleId)).toBe(5);
  });

  it('la zone de rangement se pose et se retire', () => {
    const articleId = useStore.getState().addArticle({ name: 'Riz', unit: 'kg', zoneId: 'zCuisine' });
    expect(useStore.getState().articles[0].zoneId).toBe('zCuisine');
    useStore.getState().updateArticle(articleId, { zoneId: undefined });
    expect(useStore.getState().articles[0].zoneId).toBeUndefined();
  });
});

describe('rangement automatique des articles sans emplacement', () => {
  // Structure minimale : deux zones, une enceinte et une étagère chacune.
  const buildStructure = () => {
    const s = useStore.getState();
    s.addZone({ name: 'Cuisine', type: 'cuisine' });
    s.addZone({ name: 'Chambre froide', type: 'chambre_froide' });
    const [cuisine, froid] = useStore.getState().zones;
    useStore.getState().addStorageUnit({ zoneId: cuisine.id, name: 'Frigo 1', type: 'frigo' });
    useStore.getState().addStorageUnit({ zoneId: froid.id, name: 'CF', type: 'frigo' });
    const [u1, u2] = useStore.getState().storageUnits;
    useStore.getState().addShelf({ unitId: u1.id, level: 1, name: 'É1' });
    useStore.getState().addShelf({ unitId: u2.id, level: 1, name: 'É1' });
    const [s1, s2] = useStore.getState().shelves;
    useStore.getState().addShelf({ unitId: u1.id, level: 2, name: 'É2' });
    const s1b = useStore.getState().shelves[2];
    useStore.getState().addBac({ shelfId: s1.id, name: 'Bac cuisine', type: 'bac' });
    useStore.getState().addBac({ shelfId: s2.id, name: 'Bac froid', type: 'bac' });
    useStore.getState().addBac({ shelfId: s1.id, name: 'Bac cuisine 2', type: 'bac' });
    useStore.getState().addBac({ shelfId: s1b.id, name: 'Bac étagère 2', type: 'bac' });
    const [bCuisine, bFroid, bCuisine2, bEtagere2] = useStore.getState().bacs;
    return { cuisine, froid, u1, s1, bCuisine, bFroid, bCuisine2, bEtagere2 };
  };

  const label = (bacId: string, articleId: string) =>
    useStore.getState().addProduct({
      bacId, name: 'Poulet cru', articleId, quantity: 1, unit: 'kg',
      dlc: Date.now() + DAY, actionType: 'received',
    });

  it('descend jusqu’au bac quand toutes les étiquettes y sont', () => {
    const { froid, bFroid } = buildStructure();
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    label(bFroid.id, articleId);
    label(bFroid.id, articleId);

    expect(useStore.getState().autoAssignArticleLocations()).toEqual({ placed: 1, remaining: 0 });
    const a = useStore.getState().articles[0];
    expect(a.zoneId).toBe(froid.id);
    expect(a.bacId).toBe(bFroid.id);
  });

  it('s’arrête à l’étagère quand les bacs divergent', () => {
    const { s1, bCuisine, bCuisine2 } = buildStructure();
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    label(bCuisine.id, articleId);
    label(bCuisine2.id, articleId);

    useStore.getState().autoAssignArticleLocations();
    const a = useStore.getState().articles[0];
    expect(a.shelfId).toBe(s1.id);
    expect(a.bacId).toBeUndefined();
  });

  it('s’arrête à l’enceinte quand les étagères divergent', () => {
    const { u1, bCuisine, bEtagere2 } = buildStructure();
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    label(bCuisine.id, articleId);
    label(bEtagere2.id, articleId);

    useStore.getState().autoAssignArticleLocations();
    const a = useStore.getState().articles[0];
    expect(a.unitId).toBe(u1.id);
    expect(a.shelfId).toBeUndefined();
  });

  it('prend la zone majoritaire quand les étiquettes sont dispersées', () => {
    const { cuisine, bCuisine, bFroid } = buildStructure();
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    label(bCuisine.id, articleId);
    label(bCuisine.id, articleId);
    label(bFroid.id, articleId);

    useStore.getState().autoAssignArticleLocations();
    expect(useStore.getState().articles[0].zoneId).toBe(cuisine.id);
  });

  it('n’écrase jamais un emplacement déjà choisi', () => {
    const { cuisine, bFroid } = buildStructure();
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg', zoneId: cuisine.id });
    label(bFroid.id, articleId);

    expect(useStore.getState().autoAssignArticleLocations()).toEqual({ placed: 0, remaining: 0 });
    expect(useStore.getState().articles[0].zoneId).toBe(cuisine.id);
  });

  it('laisse à ranger l’article qu’aucune étiquette active ne localise', () => {
    buildStructure();
    useStore.getState().addArticle({ name: 'Riz', unit: 'kg' });
    expect(useStore.getState().autoAssignArticleLocations()).toEqual({ placed: 0, remaining: 1 });
    expect(useStore.getState().articles[0].zoneId).toBeUndefined();
  });

  it('ignore les étiquettes utilisées — elles ont quitté l’étagère', () => {
    const { bFroid } = buildStructure();
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    const pid = label(bFroid.id, articleId);
    useStore.getState().updateProductStatus(pid, 'used');

    expect(useStore.getState().autoAssignArticleLocations()).toEqual({ placed: 0, remaining: 1 });
  });

  it('est rejouable : le second passage n’a plus rien à faire', () => {
    const { bFroid } = buildStructure();
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    label(bFroid.id, articleId);
    useStore.getState().autoAssignArticleLocations();
    expect(useStore.getState().autoAssignArticleLocations()).toEqual({ placed: 0, remaining: 0 });
  });
});

describe('emplacement hiérarchique', () => {
  it('enregistre les quatre niveaux', () => {
    const id = useStore.getState().addArticle({
      name: 'Poulet cru', unit: 'kg',
      zoneId: 'z1', unitId: 'u1', shelfId: 's1', bacId: 'b1',
    });
    const a = useStore.getState().articles.find((x) => x.id === id)!;
    expect([a.zoneId, a.unitId, a.shelfId, a.bacId]).toEqual(['z1', 'u1', 's1', 'b1']);
  });

  it('remonter d’un niveau efface les niveaux plus profonds', () => {
    const id = useStore.getState().addArticle({
      name: 'Poulet cru', unit: 'kg',
      zoneId: 'z1', unitId: 'u1', shelfId: 's1', bacId: 'b1',
    });
    useStore.getState().updateArticle(id, { zoneId: 'z1' });
    const a = useStore.getState().articles.find((x) => x.id === id)!;
    expect(a.zoneId).toBe('z1');
    expect(a.unitId).toBeUndefined();
    expect(a.shelfId).toBeUndefined();
    expect(a.bacId).toBeUndefined();
  });

  it('modifier autre chose que l’emplacement laisse l’emplacement intact', () => {
    const id = useStore.getState().addArticle({
      name: 'Poulet cru', unit: 'kg', zoneId: 'z1', unitId: 'u1',
    });
    useStore.getState().updateArticle(id, { minQty: 5 });
    const a = useStore.getState().articles.find((x) => x.id === id)!;
    expect([a.zoneId, a.unitId]).toEqual(['z1', 'u1']);
    expect(a.minQty).toBe(5);
  });

  it('vider l’emplacement le retire entièrement', () => {
    const id = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg', zoneId: 'z1', unitId: 'u1' });
    useStore.getState().updateArticle(id, { zoneId: undefined });
    const a = useStore.getState().articles.find((x) => x.id === id)!;
    expect(a.zoneId).toBeUndefined();
    expect(a.unitId).toBeUndefined();
  });
});

describe('rattrapage des articles rangés à la zone seule', () => {
  it('redescend un article resté à la zone', () => {
    const { froid, bFroid } = (() => {
      const s = useStore.getState();
      s.addZone({ name: 'Chambre froide', type: 'chambre_froide' });
      const froid = useStore.getState().zones[0];
      useStore.getState().addStorageUnit({ zoneId: froid.id, name: 'CF', type: 'frigo' });
      const u = useStore.getState().storageUnits[0];
      useStore.getState().addShelf({ unitId: u.id, level: 1, name: 'É1' });
      const sh = useStore.getState().shelves[0];
      useStore.getState().addBac({ shelfId: sh.id, name: 'Bac', type: 'bac' });
      return { froid, bFroid: useStore.getState().bacs[0] };
    })();

    // Ce que produisait la première version : la zone, et rien de plus.
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg', zoneId: froid.id });
    useStore.getState().addProduct({
      bacId: bFroid.id, name: 'Poulet cru', articleId, quantity: 1, unit: 'kg',
      dlc: Date.now() + DAY, actionType: 'received',
    });

    // Le bouton ne touche pas ce qui a déjà une zone.
    expect(useStore.getState().autoAssignArticleLocations()).toEqual({ placed: 0, remaining: 0 });
    expect(useStore.getState().articles[0].bacId).toBeUndefined();

    // Le rattrapage, si.
    expect(useStore.getState().autoAssignArticleLocations({ includeZoneOnly: true })).toEqual({ placed: 1, remaining: 0 });
    expect(useStore.getState().articles[0].bacId).toBe(bFroid.id);
  });

  it('laisse tel quel l’article que ses étiquettes ne précisent pas davantage', () => {
    const s = useStore.getState();
    s.addZone({ name: 'Cuisine', type: 'cuisine' });
    const cuisine = useStore.getState().zones[0];
    const articleId = useStore.getState().addArticle({ name: 'Riz', unit: 'kg', zoneId: cuisine.id });

    expect(useStore.getState().autoAssignArticleLocations({ includeZoneOnly: true })).toEqual({ placed: 0, remaining: 1 });
    const a = useStore.getState().articles.find((x) => x.id === articleId)!;
    expect(a.zoneId).toBe(cuisine.id);
    expect(a.unitId).toBeUndefined();
  });
});

// Supprimer un emplacement supprime les étiquettes dedans. Le stock doit
// suivre : sinon l'article garde une quantité que plus aucune étiquette ne
// justifie, et qu'aucun écran ne permet de retrouver pour la corriger.
describe('supprimer un emplacement retire le stock des étiquettes qu’il contenait', () => {
  // Une zone > enceinte > étagère > bac, avec une étiquette active dedans.
  const structure = () => {
    const s = useStore.getState();
    s.addZone({ name: 'Cuisine', type: 'cuisine' });
    const zone = useStore.getState().zones[0];
    useStore.getState().addStorageUnit({ zoneId: zone.id, name: 'Frigo 1', type: 'frigo' });
    const unit = useStore.getState().storageUnits[0];
    useStore.getState().addShelf({ unitId: unit.id, level: 1, name: 'É1' });
    const shelf = useStore.getState().shelves[0];
    useStore.getState().addBac({ shelfId: shelf.id, name: 'Bac 1', type: 'bac' });
    const bac = useStore.getState().bacs[0];

    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg' });
    const productId = useStore.getState().addProduct({
      bacId: bac.id, name: 'Poulet cru', articleId, quantity: 2, unit: 'kg',
      dlc: Date.now() + 3 * DAY, actionType: 'received',
    });
    expect(onHand(articleId)).toBe(2);
    return { zone, unit, shelf, bac, articleId, productId };
  };

  it('le bac', () => {
    const { bac, articleId, productId } = structure();
    useStore.getState().deleteBac(bac.id);
    expect(useStore.getState().products.find((p) => p.id === productId)!.deletedAt).toBeTruthy();
    expect(onHand(articleId)).toBe(0);
    expect(liveMovements(productId)).toHaveLength(0);
  });

  it('l’étagère', () => {
    const { shelf, articleId } = structure();
    useStore.getState().deleteShelf(shelf.id);
    expect(onHand(articleId)).toBe(0);
  });

  it('l’enceinte', () => {
    const { unit, articleId } = structure();
    useStore.getState().deleteStorageUnit(unit.id);
    expect(onHand(articleId)).toBe(0);
  });

  it('la zone', () => {
    const { zone, articleId } = structure();
    useStore.getState().deleteZone(zone.id);
    expect(onHand(articleId)).toBe(0);
  });

  it('réduire le nombre d’étagères d’une enceinte', () => {
    const { unit, articleId } = structure();
    useStore.getState().setUnitShelves(unit.id, 0);
    expect(onHand(articleId)).toBe(0);
  });

  // Une étiquette déjà utilisée est à zéro net : la supprimer ne doit pas
  // faire remonter le stock en retirant la seule sortie.
  it('une étiquette déjà utilisée reste à zéro', () => {
    const { bac, articleId, productId } = structure();
    useStore.getState().updateProductStatus(productId, 'used');
    expect(onHand(articleId)).toBe(0);
    useStore.getState().deleteBac(bac.id);
    expect(onHand(articleId)).toBe(0);
  });

  // Les corrections manuelles ne viennent d'aucune étiquette : elles survivent.
  it('laisse les mouvements manuels intacts', () => {
    const { bac, articleId } = structure();
    useStore.getState().addStockMovement({ articleId, kind: 'in', qty: 5 });
    expect(onHand(articleId)).toBe(7);
    useStore.getState().deleteBac(bac.id);
    expect(onHand(articleId)).toBe(5);
  });

  // Retomber sur des étiquettes déjà supprimées ne doit rien réécrire —
  // sinon chaque suppression de zone les ferait ressortir à la fusion.
  it('ne réécrit pas les étiquettes déjà supprimées', () => {
    const { zone, bac, productId } = structure();
    useStore.getState().deleteBac(bac.id);
    const before = useStore.getState().products.find((p) => p.id === productId)!.modifiedAt;
    useStore.getState().deleteZone(zone.id);
    expect(useStore.getState().products.find((p) => p.id === productId)!.modifiedAt).toBe(before);
  });
});

// Les catégories d'articles — l'axe de classement de l'inventaire.
describe('catégories d’articles', () => {
  const categories = () => useStore.getState().articleCategories.filter((c) => !c.deletedAt);

  it('démarre sur les catégories d’origine', () => {
    expect(categories().map((c) => c.name)).toContain('Viandes');
    expect(categories()).toHaveLength(DEFAULT_ARTICLE_CATEGORIES.length);
  });

  it('ajoute une catégorie', () => {
    const res = useStore.getState().addArticleCategory({ name: '  Épices  ', color: '#123456' });
    expect(res.ok).toBe(true);
    const added = categories().find((c) => c.id === res.id)!;
    expect(added.name).toBe('Épices'); // trimé
    expect(added.color).toBe('#123456');
  });

  it('refuse un doublon, casse et accents ignorés', () => {
    const res = useStore.getState().addArticleCategory({ name: 'viandes' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/existe déjà/);
    expect(categories()).toHaveLength(DEFAULT_ARTICLE_CATEGORIES.length);
  });

  it('refuse un nom vide', () => {
    expect(useStore.getState().addArticleCategory({ name: '   ' }).ok).toBe(false);
  });

  it('renomme et recolore', () => {
    const res = useStore.getState().updateArticleCategory('cat-viandes', { name: 'Viandes rouges', color: '#000000' });
    expect(res.ok).toBe(true);
    const c = categories().find((x) => x.id === 'cat-viandes')!;
    expect(c.name).toBe('Viandes rouges');
    expect(c.color).toBe('#000000');
  });

  it('refuse de renommer sur une catégorie existante, mais se renomme elle-même', () => {
    expect(useStore.getState().updateArticleCategory('cat-viandes', { name: 'Boissons' }).ok).toBe(false);
    expect(useStore.getState().updateArticleCategory('cat-viandes', { name: 'Viandes' }).ok).toBe(true);
  });

  // Le point important : supprimer une catégorie ne touche AUCUN article.
  it('supprimer une catégorie ne supprime pas ses articles', () => {
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg', categoryId: 'cat-viandes' });
    useStore.getState().deleteArticleCategory('cat-viandes');

    const article = useStore.getState().articles.find((a) => a.id === articleId)!;
    expect(article.deletedAt).toBeUndefined();
    // L'article garde son categoryId — c'est ce qui permet de le retrouver
    // classé si la catégorie revient.
    expect(article.categoryId).toBe('cat-viandes');
    expect(articleCategoryGroups(useStore.getState().articles, categories())[0].id).toBeNull();
  });

  it('restaurer une catégorie d’origine y ramène ses articles', () => {
    useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg', categoryId: 'cat-viandes' });
    useStore.getState().deleteArticleCategory('cat-viandes');
    expect(useStore.getState().restoreDefaultArticleCategories()).toBe(1);

    const groups = articleCategoryGroups(useStore.getState().articles, categories());
    expect(groups[0].name).toBe('Viandes');
    expect(groups[0].articles.map((a) => a.name)).toEqual(['Poulet cru']);
  });

  it('la restauration ne fait rien quand rien ne manque, et garde les catégories ajoutées', () => {
    useStore.getState().addArticleCategory({ name: 'Épices' });
    expect(useStore.getState().restoreDefaultArticleCategories()).toBe(0);
    expect(categories().map((c) => c.name)).toContain('Épices');
  });

  // Les ids d'origine sont fixes : restaurer ressuscite le tombstone au lieu
  // de créer une deuxième « Viandes ».
  it('restaurer ne crée pas de doublon', () => {
    useStore.getState().deleteArticleCategory('cat-viandes');
    useStore.getState().restoreDefaultArticleCategories();
    expect(categories().filter((c) => c.name === 'Viandes')).toHaveLength(1);
  });

  it('classe un article à la création et le reclasse ensuite', () => {
    const id = useStore.getState().addArticle({ name: 'Ketchup', unit: 'L', categoryId: 'cat-sauces' });
    expect(useStore.getState().articles.find((a) => a.id === id)!.categoryId).toBe('cat-sauces');

    expect(useStore.getState().updateArticle(id, { categoryId: 'cat-boissons' }).ok).toBe(true);
    expect(useStore.getState().articles.find((a) => a.id === id)!.categoryId).toBe('cat-boissons');

    // Déclasser est un choix explicite, pas une valeur perdue.
    expect(useStore.getState().updateArticle(id, { categoryId: undefined }).ok).toBe(true);
    expect(useStore.getState().articles.find((a) => a.id === id)!.categoryId).toBeUndefined();
  });

  // La catégorie ne rentre pas dans la comparaison des noms : un ingrédient a un
  // seul total, quelle que soit la façon dont on le classe.
  it('ne permet pas deux articles du même nom dans deux catégories', () => {
    const first = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg', categoryId: 'cat-viandes' });
    const second = useStore.getState().addArticle({ name: 'poulet cru', unit: 'kg', categoryId: 'cat-sauces' });
    expect(second).toBe(first);
    expect(useStore.getState().articles.filter((a) => !a.deletedAt)).toHaveLength(1);
  });

  it('le stock ne dépend pas de la catégorie', () => {
    const articleId = useStore.getState().addArticle({ name: 'Poulet cru', unit: 'kg', categoryId: 'cat-viandes' });
    useStore.getState().addProduct({
      bacId: 'b1', name: 'Poulet cru', articleId, quantity: 2, unit: 'kg',
      dlc: Date.now() + DAY, actionType: 'received',
    });
    expect(onHand(articleId)).toBe(2);

    useStore.getState().updateArticle(articleId, { categoryId: 'cat-sauces' });
    expect(onHand(articleId)).toBe(2);
    useStore.getState().deleteArticleCategory('cat-sauces');
    expect(onHand(articleId)).toBe(2);
  });
});
