// La liste de courses.
//
// La promesse de la fonctionnalité : n'importe qui note ce qu'il faut acheter,
// et le PDF envoyé à celui qui fait les courses ne montre QUE ce qu'il faut
// acheter. Ces tests tiennent les trois choses qui la feraient mentir : le zéro
// qui traverse jusqu'au PDF, le vidage qui emporterait le catalogue avec lui,
// et la fusion multi-appareils qui écraserait la saisie d'un collègue.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';
import {
  DEFAULT_SHOPPING_ITEMS,
  DEFAULT_SUPPLIERS,
  ShoppingGroup,
  buildShoppingListHtml,
  layoutUnits,
  requestedCount,
  shoppingDensity,
  shoppingGroups,
} from '../src/lib/shopping';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

const state = () => useStore.getState();
const itemNamed = (name: string) => state().shoppingItems.find((i) => i.name === name)!;

describe('graine du catalogue', () => {
  it('sème les fournisseurs et produits du tableau papier', () => {
    expect(state().suppliers).toHaveLength(DEFAULT_SUPPLIERS.length);
    expect(state().shoppingItems).toHaveLength(DEFAULT_SHOPPING_ITEMS.length);
    expect(state().shoppingEntries).toHaveLength(0);
  });

  it('donne la note de commande au fournisseur qui en porte une', () => {
    const volaille = state().suppliers.find((s) => s.id === 'sup-volaille-du-nord')!;
    expect(volaille.note).toBe('lundi pour mardi ou jeudi pour vendredi');
  });

  // `modifiedAt: 0` est ce qui fait perdre la graine contre toute vraie
  // modification venue du cloud, suppression comprise.
  it('date la graine à zéro pour qu elle perde toute fusion', () => {
    expect(state().suppliers.every((s) => s.modifiedAt === 0)).toBe(true);
    expect(state().shoppingItems.every((i) => i.modifiedAt === 0)).toBe(true);
  });

  it("n'a aucun lien avec le catalogue d'inventaire", () => {
    state().setShoppingQty(itemNamed('Merguez').id, 3);
    expect(state().articles).toHaveLength(0);
    expect(state().stockMovements).toHaveLength(0);
  });
});

describe('saisie des quantités', () => {
  it("écrit l'entrée sous l'id du produit, pour converger entre appareils", () => {
    const id = itemNamed('Merguez').id;
    state().setShoppingQty(id, 3);
    expect(state().shoppingEntries).toHaveLength(1);
    expect(state().shoppingEntries[0]).toMatchObject({ id, qty: 3 });
  });

  it('remplace la quantité au lieu de créer un doublon', () => {
    const id = itemNamed('Merguez').id;
    state().setShoppingQty(id, 3);
    state().setShoppingQty(id, 7);
    expect(state().shoppingEntries).toHaveLength(1);
    expect(state().shoppingEntries[0].qty).toBe(7);
  });

  // Une ligne physiquement retirée ressusciterait à la fusion suivante : le
  // cloud a encore la sienne, et applyCloudState fait une union.
  it('garde un enregistrement à 0 plutôt que de le supprimer', () => {
    const id = itemNamed('Merguez').id;
    state().setShoppingQty(id, 3);
    state().setShoppingQty(id, 0);
    expect(state().shoppingEntries).toHaveLength(1);
    expect(state().shoppingEntries[0].qty).toBe(0);
  });

  it('refuse une quantité négative', () => {
    const id = itemNamed('Merguez').id;
    state().setShoppingQty(id, -5);
    expect(state().shoppingEntries[0].qty).toBe(0);
  });
});

describe('lignes libres', () => {
  it('ajoute un produit hors catalogue sans polluer le catalogue', () => {
    const before = state().shoppingItems.length;
    const res = state().addShoppingExtra({ name: 'Nappes en papier', supplierId: 'sup-metro', qty: 2 });
    expect(res.ok).toBe(true);
    expect(state().shoppingItems).toHaveLength(before);
    expect(state().shoppingEntries[0]).toMatchObject({ name: 'Nappes en papier', qty: 2 });
  });

  // Sinon le PDF montrerait deux fois la même chose au même magasin.
  it('renseigne le produit du catalogue si le nom lui correspond', () => {
    const merguez = itemNamed('Merguez');
    const res = state().addShoppingExtra({ name: '  merguez ', supplierId: 'sup-boucherie', qty: 4 });
    expect(res.id).toBe(merguez.id);
    expect(state().shoppingEntries).toHaveLength(1);
    expect(state().shoppingEntries[0].name).toBeUndefined();
  });

  it('laisse le même nom coexister chez deux fournisseurs différents', () => {
    const res = state().addShoppingExtra({ name: 'Merguez', supplierId: 'sup-metro', qty: 1 });
    expect(res.ok).toBe(true);
    expect(res.id).not.toBe(itemNamed('Merguez').id);
  });
});

describe('groupement', () => {
  it('rend tous les fournisseurs, quantités appliquées', () => {
    state().setShoppingQty(itemNamed('Rumsteak').id, 2);
    const groups = shoppingGroups(state());
    expect(groups).toHaveLength(DEFAULT_SUPPLIERS.length);
    const boucherie = groups.find((g) => g.id === 'sup-boucherie')!;
    expect(boucherie.lines.find((l) => l.name === 'Rumsteak')!.qty).toBe(2);
  });

  // Le contrat du PDF : ce dont on n'a pas besoin n'y figure pas.
  it('ne garde que ce qui a une quantité en mode onlyRequested', () => {
    state().setShoppingQty(itemNamed('Rumsteak').id, 2);
    const groups = shoppingGroups(state(), { onlyRequested: true });
    expect(groups).toHaveLength(1);
    expect(groups[0].lines).toHaveLength(1);
    expect(groups[0].lines[0].name).toBe('Rumsteak');
  });

  it('classe un produit sans fournisseur à part, sans jamais le masquer', () => {
    const res = state().addShoppingItem({ name: 'Bougies' });
    expect(res.ok).toBe(true);
    const orphans = shoppingGroups(state()).find((g) => g.id === null)!;
    expect(orphans.lines.map((l) => l.name)).toContain('Bougies');
  });

  it('compte les produits à acheter pour la tuile du tableau de bord', () => {
    state().setShoppingQty(itemNamed('Rumsteak').id, 2);
    state().addShoppingExtra({ name: 'Nappes en papier', supplierId: 'sup-metro', qty: 1 });
    expect(requestedCount(state())).toBe(2);
  });
});

describe('catalogue (réglages)', () => {
  it('refuse deux fois le même nom chez un même fournisseur', () => {
    const res = state().addShoppingItem({ name: 'merguez', supplierId: 'sup-boucherie' });
    expect(res.ok).toBe(false);
  });

  it('déménage un produit sans lui faire perdre sa quantité', () => {
    const id = itemNamed('Merguez').id;
    state().setShoppingQty(id, 3);
    expect(state().updateShoppingItem(id, { supplierId: 'sup-metro' }).ok).toBe(true);
    const metro = shoppingGroups(state()).find((g) => g.id === 'sup-metro')!;
    expect(metro.lines.find((l) => l.name === 'Merguez')!.qty).toBe(3);
  });

  // Le déplacement est refusé si la destination a déjà ce nom — Fraise existe
  // en sirop, en coulis ET en fruit. Mieux vaut le dire que d'écraser.
  it('refuse un déplacement vers un fournisseur qui a déjà ce nom', () => {
    const siropFraise = state().shoppingItems.find((i) => i.id === 'shi-sirop-2')!;
    expect(siropFraise.name).toBe('Fraise');
    const res = state().updateShoppingItem(siropFraise.id, { supplierId: 'sup-fruit' });
    expect(res.ok).toBe(false);
    expect(state().shoppingItems.find((i) => i.id === siropFraise.id)!.supplierId).toBe('sup-sirop');
  });

  it('range un produit dans « Sans fournisseur » quand la destination est vide', () => {
    const id = itemNamed('Merguez').id;
    expect(state().updateShoppingItem(id, { supplierId: null }).ok).toBe(true);
    const orphans = shoppingGroups(state()).find((g) => g.id === null)!;
    expect(orphans.lines.map((l) => l.name)).toContain('Merguez');
  });

  // Un produit sans magasin n'a nulle part d'utile où retomber : la suppression
  // du fournisseur emporte ses produits, et donc leurs quantités.
  it('supprime un fournisseur avec ses produits et leurs quantités', () => {
    state().setShoppingQty(itemNamed('Merguez').id, 3);
    state().deleteSupplier('sup-boucherie');
    expect(shoppingGroups(state()).some((g) => g.id === 'sup-boucherie')).toBe(false);
    expect(requestedCount(state())).toBe(0);
  });

  it('efface la quantité du produit supprimé', () => {
    const id = itemNamed('Merguez').id;
    state().setShoppingQty(id, 3);
    state().deleteShoppingItem(id);
    expect(requestedCount(state())).toBe(0);
  });

  it("restaure le catalogue d'origine sur ses ids fixes, sans doublon", () => {
    state().deleteSupplier('sup-boucherie');
    const restored = state().restoreDefaultShoppingCatalog();
    expect(restored).toBe(1 + 2); // le fournisseur + ses deux produits
    expect(state().suppliers.filter((s) => s.id === 'sup-boucherie')).toHaveLength(1);
    expect(state().suppliers.find((s) => s.id === 'sup-boucherie')!.deletedAt).toBeUndefined();
  });
});

describe('vidage de fin de tournée', () => {
  it('remet les quantités à zéro sans toucher au catalogue', () => {
    state().setShoppingQty(itemNamed('Merguez').id, 3);
    state().setShoppingQty(itemNamed('Rumsteak').id, 1);
    expect(state().clearShoppingList()).toBe(2);
    expect(requestedCount(state())).toBe(0);
    expect(state().shoppingItems.filter((i) => !i.deletedAt)).toHaveLength(DEFAULT_SHOPPING_ITEMS.length);
    expect(state().suppliers.filter((s) => !s.deletedAt)).toHaveLength(DEFAULT_SUPPLIERS.length);
  });

  it('fait disparaître les lignes libres, qui n appartiennent qu à la tournée', () => {
    state().addShoppingExtra({ name: 'Nappes en papier', supplierId: 'sup-metro', qty: 2 });
    state().clearShoppingList();
    const metro = shoppingGroups(state()).find((g) => g.id === 'sup-metro')!;
    expect(metro.lines.some((l) => l.name === 'Nappes en papier')).toBe(false);
  });

  it('ne fait rien sur une liste déjà vide', () => {
    expect(state().clearShoppingList()).toBe(0);
  });
});

describe('fusion multi-appareils', () => {
  // Le cœur du choix « un enregistrement par produit » : deux téléphones qui
  // remplissent la liste en même temps gardent chacun leurs lignes.
  it('garde les saisies des deux appareils', () => {
    const merguez = itemNamed('Merguez').id;
    const rumsteak = itemNamed('Rumsteak').id;
    state().setShoppingQty(merguez, 3);
    state().applyCloudState({
      shoppingEntries: [{ id: rumsteak, qty: 5, modifiedAt: Date.now() }],
    } as any);
    expect(requestedCount(state())).toBe(2);
  });

  it('laisse la saisie la plus récente décider sur un même produit', () => {
    const merguez = itemNamed('Merguez').id;
    state().setShoppingQty(merguez, 3);
    state().applyCloudState({
      shoppingEntries: [{ id: merguez, qty: 9, modifiedAt: Date.now() + 1000 }],
    } as any);
    expect(state().shoppingEntries.find((e) => e.id === merguez)!.qty).toBe(9);
  });

  // La graine est datée à 0 : elle ne peut pas faire revenir un fournisseur
  // qu'un autre appareil a supprimé.
  it('ne ressuscite pas un fournisseur supprimé ailleurs', () => {
    state().applyCloudState({
      suppliers: [{ id: 'sup-metro', name: 'Metro', modifiedAt: Date.now(), deletedAt: Date.now() }],
    } as any);
    expect(shoppingGroups(state()).some((g) => g.id === 'sup-metro')).toBe(false);
  });
});

describe('PDF', () => {
  const html = () => buildShoppingListHtml(state() as any);

  it("n'imprime que les produits demandés", () => {
    state().setShoppingQty(itemNamed('Merguez').id, 3);
    const out = html();
    expect(out).toContain('Merguez');
    expect(out).not.toContain('Rumsteak');
    expect(out).not.toContain('Sopalin');
  });

  it('jette les fournisseurs sans rien à acheter', () => {
    state().setShoppingQty(itemNamed('Merguez').id, 3);
    const out = html();
    expect(out).toContain('Boucherie');
    expect(out).not.toContain('Oz Market');
  });

  it('rappelle le jour de commande du fournisseur', () => {
    state().setShoppingQty(itemNamed('Blanc de poulet').id, 2);
    expect(html()).toContain('lundi pour mardi ou jeudi pour vendredi');
  });

  it('porte les lignes libres comme les autres', () => {
    state().addShoppingExtra({ name: 'Nappes en papier', supplierId: 'sup-metro', qty: 2 });
    expect(html()).toContain('Nappes en papier');
  });

  it('le dit quand il n y a rien à acheter', () => {
    expect(html()).toContain('Aucun produit à acheter');
  });

  it('échappe le HTML des noms saisis', () => {
    state().addShoppingExtra({ name: '<script>x</script>', supplierId: 'sup-metro', qty: 1 });
    expect(html()).not.toContain('<script>');
  });
});

// ─── Tenue sur une page ──────────────────────────────────────────────────────
//
// La feuille doit tenir sur UNE page même catalogue entier rempli : celui qui
// fait les courses tient une feuille, pas une liasse, et la deuxième page
// s'oublie dans la voiture.
//
// Faute de moteur de rendu ici, on rejoue le calcul de hauteur que les paliers
// de `shoppingDensity` supposent. Ce n'est pas une capture d'écran du PDF —
// c'est le garde-fou qui fera échouer la prochaine personne qui grossit une
// police d'un palier sans se demander si ça rentre encore.

// A4 à 9 mm de marge, en px CSS (96 dpi) : 297 mm − 18 mm = 279 mm.
const PAGE_PX = 279 * 3.7795;
const HEADER_PX = 30;          // titre + filet + marge
const LINE_HEIGHT = 1.2;       // interligne par défaut d'une cellule

const rowPx = (d: ReturnType<typeof shoppingDensity>) => d.font * LINE_HEIGHT + d.rowPadding * 2 + 1;
const headPx = (d: ReturnType<typeof shoppingDensity>, note: boolean) =>
  d.headFont * LINE_HEIGHT + (note ? Math.max(6, d.headFont - 2) * LINE_HEIGHT : 0) + 2 + 1.5 + 3;

// Hauteur au pire : les colonnes ne s'équilibrent pas parfaitement, puisqu'un
// fournisseur ne se coupe jamais en deux. D'où « une colonne + le plus gros
// fournisseur », et non une simple division.
const estimateHeightPx = (groups: ShoppingGroup[]): number => {
  const d = shoppingDensity(layoutUnits(groups));
  const heights = groups.map((g) => g.lines.length * rowPx(d) + headPx(d, !!g.note) + d.gap);
  const totalPx = heights.reduce((a, b) => a + b, 0);
  const largest = heights.length ? Math.max(...heights) : 0;
  return HEADER_PX + totalPx / d.columns + largest;
};

const fakeGroups = (groupCount: number, linesPerGroup: number): ShoppingGroup[] =>
  Array.from({ length: groupCount }, (_, g) => ({
    id: `s${g}`,
    name: `Fournisseur ${g}`,
    note: g % 3 === 0 ? 'lundi pour mardi ou jeudi pour vendredi' : undefined,
    lines: Array.from({ length: linesPerGroup }, (_, i) => ({
      id: `s${g}-${i}`, name: `Produit ${i}`, qty: 2, isExtra: false,
    })),
  }));

describe('tenue sur une page', () => {
  it('tient sur une page avec TOUT le catalogue rempli', () => {
    for (const item of state().shoppingItems) state().setShoppingQty(item.id, 3);
    const groups = shoppingGroups(state(), { onlyRequested: true });
    expect(groups.reduce((n, g) => n + g.lines.length, 0)).toBe(DEFAULT_SHOPPING_ITEMS.length);
    expect(estimateHeightPx(groups)).toBeLessThan(PAGE_PX);
  });

  it('tient sur une page au pire cas de chaque palier', () => {
    // Un point juste sous chaque frontière, et le gros fournisseur qui déséquilibre.
    const cases: [number, number][] = [[2, 11], [4, 10], [6, 10], [8, 14], [10, 18], [12, 20]];
    for (const [groupCount, linesPerGroup] of cases) {
      const groups = fakeGroups(groupCount, linesPerGroup);
      expect({ groupCount, linesPerGroup, px: Math.round(estimateHeightPx(groups)) })
        .toMatchObject({ px: expect.any(Number) });
      expect(estimateHeightPx(groups)).toBeLessThan(PAGE_PX);
    }
  });

  it('reste aéré quand la liste est courte', () => {
    const d = shoppingDensity(layoutUnits(fakeGroups(2, 8)));
    expect(d.columns).toBe(1);
    expect(d.font).toBeGreaterThanOrEqual(14);
  });

  it('passe en colonnes dès que la liste s allonge', () => {
    expect(shoppingDensity(layoutUnits(fakeGroups(6, 10))).columns).toBeGreaterThanOrEqual(2);
    expect(shoppingDensity(layoutUnits(fakeGroups(10, 18))).columns).toBeGreaterThanOrEqual(3);
  });

  // Ce qui rend la hauteur calculable : une ligne fait exactement une ligne.
  it('tronque un nom trop long au lieu de le replier', () => {
    state().addShoppingExtra({ name: 'A'.repeat(120), supplierId: 'sup-metro', qty: 1 });
    expect(buildShoppingListHtml(state() as any)).toContain('white-space: nowrap');
  });

  it('déclare une page A4 portrait', () => {
    expect(buildShoppingListHtml(state() as any)).toContain('size: A4 portrait');
  });
});
