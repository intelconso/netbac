import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, ShoppingEntry, ShoppingItem, Supplier } from '../types';
import { formatDate } from './utils';

// Liste de courses — logique pure (groupement, quantités, HTML du PDF).
//
// Rappel de cadrage : rien ici ne touche aux étiquettes ni à l'inventaire. Les
// produits de courses sont un catalogue à part, leurs quantités ne sont pas du
// stock, et aucun `Article` n'est lu ni écrit. Voir Supplier dans types.ts.

// ─── Graine d'origine ────────────────────────────────────────────────────────
//
// Reprise du tableau papier `course_liste.docx`. Ids FIXES (et `modifiedAt: 0`
// dans le store) : deux appareils qui démarrent l'app chacun de leur côté
// sèment le même catalogue et convergent au lieu de le dupliquer, et toute
// vraie modification — renommage comme suppression — bat la graine à la fusion.

export const DEFAULT_SUPPLIERS: { id: string; name: string; note?: string }[] = [
  { id: 'sup-boucherie', name: 'Boucherie' },
  { id: 'sup-metro', name: 'Metro' },
  { id: 'sup-volaille-du-nord', name: 'Volaille du Nord', note: 'lundi pour mardi ou jeudi pour vendredi' },
  { id: 'sup-spuntini', name: 'Spuntini', note: 'mercredi pour jeudi ou lundi pour mardi' },
  { id: 'sup-vanderdrich', name: 'Boissons Vanderdrich', note: 'lundi/mardi' },
  { id: 'sup-mine', name: 'Mine' },
  { id: 'sup-sirop', name: 'Sirop' },
  { id: 'sup-coulis-ponthier', name: 'Coulis Ponthier' },
  { id: 'sup-fruit', name: 'Fruit' },
  { id: 'sup-oz-market', name: 'Oz Market' },
];

const SEED_ITEMS: Record<string, string[]> = {
  'sup-boucherie': ['Merguez', 'Rumsteak'],
  'sup-metro': [
    'Limonade', 'Pinacolada', 'Paille', 'Ail semoule', 'Sopalin',
    'Crème lavante main', 'Papier toilette', 'Film transparent', 'Rince-doigts',
    'Boîte à dessert', 'Salade', 'Sucette', 'Carottes', 'Sucre en poudre',
  ],
  'sup-volaille-du-nord': ['Pilons de poulet', 'Blanc de poulet'],
  'sup-spuntini': ['Frites', 'Sauce provençale', 'Huile'],
  'sup-vanderdrich': ['Boissons diverses', 'Ananas', 'Kiwi', 'Coco', 'Fraise'],
  'sup-mine': ['Ananas', 'Pomme de terre', 'Menthe', 'Fruit', 'Citron vert', 'Lait entier'],
  'sup-sirop': [
    'Violette', 'Fraise', 'Passion', 'Kiwi', 'Grenadine', 'Sirop de canne',
    'Monin kiwi', 'Monin passion', 'Monin fraise', 'Monin ananas', 'Monin mangue',
  ],
  'sup-coulis-ponthier': [
    'Mangue', 'Framboise', 'Fraise', 'Fruit de la passion', 'Saumon',
    'Glace pilée', 'Sel', 'Persil', 'Jus de citron vert', 'Glace vanille',
    'Chantilly', 'Crème anglaise', 'Charbon', 'Fondant au chocolat', 'Chocolat café',
  ],
  'sup-fruit': ['Framboise', 'Myrtille', 'Groseille', 'Fraise'],
  'sup-oz-market': ['Mayonnaise', 'Sauce vinaigrette', 'Stick mayo', 'Stick ketchup', 'Maïs', 'Sauce chili thaï'],
};

// Id déterministe d'un produit de la graine : « shi- » + fournisseur + rang.
// Le rang plutôt que le nom, parce que le même nom revient chez plusieurs
// fournisseurs (Fraise est à la fois un sirop, un coulis et un fruit) et que
// renommer un produit ne doit pas changer son identité.
const seedItemId = (supplierId: string, index: number): string =>
  `shi-${supplierId.replace(/^sup-/, '')}-${index + 1}`;

export const DEFAULT_SHOPPING_ITEMS: { id: string; name: string; supplierId: string; order: number }[] =
  DEFAULT_SUPPLIERS.flatMap((s) =>
    (SEED_ITEMS[s.id] ?? []).map((name, i) => ({
      id: seedItemId(s.id, i),
      name,
      supplierId: s.id,
      order: i,
    }))
  );

// ─── Lecture ─────────────────────────────────────────────────────────────────

export interface ShoppingLine {
  id: string;            // id de l'entrée = id du produit, ou id propre si ligne libre
  name: string;
  qty: number;
  isExtra: boolean;      // ligne libre, hors catalogue (voir ShoppingEntry.name)
}

export interface ShoppingGroup {
  id: string | null;     // null = « Sans fournisseur »
  name: string;
  note?: string;
  lines: ShoppingLine[];
}

export const UNASSIGNED_SUPPLIER = 'Sans fournisseur';

// Quantité demandée par id d'entrée. Une entrée en tombstone ne compte pas.
export function qtyByEntryId(entries: ShoppingEntry[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries ?? []) {
    if (!e || !e.id || e.deletedAt) continue;
    map.set(e.id, e.qty);
  }
  return map;
}

const byOrder = <T extends { order?: number; name: string }>(a: T, b: T): number => {
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name, 'fr');
};

// Le catalogue groupé par fournisseur, quantités appliquées.
//
// `onlyRequested` ne garde que ce qui a une quantité > 0 et jette les groupes
// devenus vides : c'est exactement ce qu'attend le PDF, où un produit dont on
// n'a pas besoin n'a rien à faire sur la feuille de celui qui fait les courses.
export function shoppingGroups(
  state: Pick<AppState, 'suppliers' | 'shoppingItems' | 'shoppingEntries'>,
  options?: { onlyRequested?: boolean }
): ShoppingGroup[] {
  const onlyRequested = options?.onlyRequested === true;
  const suppliers = (state.suppliers ?? []).filter((s) => !s.deletedAt).slice().sort(byOrder);
  const items = (state.shoppingItems ?? []).filter((i) => !i.deletedAt);
  const entries = (state.shoppingEntries ?? []).filter((e) => !e.deletedAt);
  const qty = qtyByEntryId(entries);

  const known = new Set(suppliers.map((s) => s.id));
  const lines = new Map<string | null, ShoppingLine[]>();
  const push = (supplierId: string | undefined, line: ShoppingLine) => {
    // Un produit rattaché à un fournisseur supprimé retombe dans « Sans
    // fournisseur » plutôt que de disparaître de l'écran.
    const key = supplierId && known.has(supplierId) ? supplierId : null;
    const list = lines.get(key);
    if (list) list.push(line);
    else lines.set(key, [line]);
  };

  for (const item of items.slice().sort(byOrder)) {
    const q = qty.get(item.id) ?? 0;
    if (onlyRequested && q <= 0) continue;
    push(item.supplierId, { id: item.id, name: item.name, qty: q, isExtra: false });
  }
  // Les lignes libres viennent après les produits du catalogue, dans leur
  // groupe — elles ne s'intercalent pas au milieu d'une liste que l'œil connaît.
  for (const e of entries) {
    if (!e.name) continue;
    if (onlyRequested && e.qty <= 0) continue;
    push(e.supplierId, { id: e.id, name: e.name, qty: e.qty, isExtra: true });
  }

  const groups: ShoppingGroup[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    ...(s.note ? { note: s.note } : {}),
    lines: lines.get(s.id) ?? [],
  }));
  const orphans = lines.get(null) ?? [];
  if (orphans.length > 0) groups.push({ id: null, name: UNASSIGNED_SUPPLIER, lines: orphans });

  return onlyRequested ? groups.filter((g) => g.lines.length > 0) : groups;
}

// Nombre de produits à acheter — le compteur de la tuile du tableau de bord.
// Passe par shoppingGroups plutôt que de compter les entrées : une quantité
// laissée sur un produit dont le fournisseur a été supprimé ne compte pas,
// puisqu'elle n'apparaît ni à l'écran ni sur le PDF.
export function requestedCount(
  state: Pick<AppState, 'suppliers' | 'shoppingItems' | 'shoppingEntries'>
): number {
  return shoppingGroups(state, { onlyRequested: true }).reduce((n, g) => n + g.lines.length, 0);
}

// Deux produits du MÊME fournisseur ne doivent pas porter le même nom ; le même
// nom chez deux fournisseurs différents est normal (Fraise en sirop et en fruit).
export function normalizeShoppingName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findShoppingItem(
  items: ShoppingItem[] | undefined,
  name: string,
  supplierId?: string
): ShoppingItem | undefined {
  const n = normalizeShoppingName(name);
  return (items ?? []).find(
    (i) => !i.deletedAt && normalizeShoppingName(i.name) === n && (i.supplierId ?? null) === (supplierId ?? null)
  );
}

export function findSupplier(suppliers: Supplier[] | undefined, name: string): Supplier | undefined {
  const n = normalizeShoppingName(name);
  return (suppliers ?? []).find((s) => !s.deletedAt && normalizeShoppingName(s.name) === n);
}

// 3 → « 3 », 2.5 → « 2,5 ». Les quantités sont libres et sans unité (le tableau
// papier n'en avait pas) : on n'affiche donc jamais de décimale inutile.
export function formatQty(qty: number): string {
  const rounded = Math.round(qty * 100) / 100;
  return String(rounded).replace('.', ',');
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// La feuille tient sur UNE page, quel que soit le remplissage.
//
// C'est une contrainte de terrain, pas une coquetterie : celui qui fait les
// courses tient une feuille, pas une liasse, et une deuxième page s'oublie dans
// la voiture. Deux leviers, appliqués ensemble :
//
//   1. des COLONNES — le tableau papier d'origine en avait déjà, quatre
//      produits par ligne ; dérouler dix fournisseurs l'un sous l'autre
//      gaspillait toute la largeur de la page ;
//   2. une DENSITÉ choisie d'après le nombre de lignes — une liste de six
//      produits reste grande et aérée, une liste de soixante se resserre.
//
// Ce qui rend la garantie tenable, c'est qu'une ligne fait exactement une
// ligne : le nom est tronqué par ellipse plutôt que de passer à la ligne
// (`white-space: nowrap`), donc le nombre de lignes est CONNU d'avance et la
// hauteur se calcule au lieu de se découvrir à l'impression.

export interface ShoppingDensity {
  columns: number;
  font: number;        // px, taille d'une ligne de produit
  rowPadding: number;  // px, haut et bas
  headFont: number;    // px, nom du fournisseur
  gap: number;         // px, air au-dessus d'un fournisseur
}

// Une entête de fournisseur coûte à peu près deux lignes de produit (titre +
// filet + marge). C'est cette unité commune qui sert à choisir la densité.
export function layoutUnits(groups: ShoppingGroup[]): number {
  return groups.reduce((n, g) => n + g.lines.length + (g.note ? 2.6 : 2), 0);
}

// Paliers calés sur la hauteur utile d'une A4 à 9 mm de marge (~1054 px à
// 96 dpi). Ils sont vérifiés par __tests__/shopping.test.ts, qui rejoue le
// calcul de hauteur sur le pire cas de chaque palier — c'est là qu'il faut
// aller si l'un de ces chiffres bouge.
//
// Le calcul suppose le pire : les colonnes ne s'équilibrent pas parfaitement
// parce qu'un fournisseur ne se coupe pas, donc on compte une hauteur de
// colonne PLUS le plus gros fournisseur. Le catalogue entier rempli (68
// produits, 10 fournisseurs ≈ 90 unités) tombe dans le palier à trois colonnes
// et n'occupe que ~68 % de la page.
//
// Limite honnête : au-delà d'environ 250 lignes — quatre fois le catalogue —
// plus aucune densité lisible ne tient sur une page, et une deuxième page
// vaudrait mieux qu'un texte de 5 px.
export function shoppingDensity(units: number): ShoppingDensity {
  if (units <= 24) return { columns: 1, font: 14, rowPadding: 6, headFont: 13, gap: 18 };
  if (units <= 48) return { columns: 2, font: 12, rowPadding: 4, headFont: 11, gap: 12 };
  if (units <= 75) return { columns: 2, font: 10.5, rowPadding: 2.5, headFont: 10, gap: 9 };
  if (units <= 130) return { columns: 3, font: 9.5, rowPadding: 1.5, headFont: 8.5, gap: 7 };
  if (units <= 200) return { columns: 4, font: 8, rowPadding: 0.5, headFont: 7.5, gap: 5 };
  return { columns: 4, font: 7, rowPadding: 0.3, headFont: 6.5, gap: 4 };
}

export function buildShoppingListHtml(state: AppState): string {
  const groups = shoppingGroups(state, { onlyRequested: true });
  const total = groups.reduce((n, g) => n + g.lines.length, 0);
  const title = state.user?.restaurantName || state.user?.name || 'Restaurant';
  const d = shoppingDensity(layoutUnits(groups));

  const body = groups.length === 0
    ? `<p class="empty">Aucun produit à acheter.</p>`
    : groups.map((g) => `
      <section class="group">
        <div class="group-head">
          <h2>${escapeHtml(g.name)}</h2>
          ${g.note ? `<div class="note">${escapeHtml(g.note)}</div>` : ''}
        </div>
        <table>
          <tbody>${g.lines.map((l) => `
            <tr>
              <td class="box"></td>
              <td class="name">${escapeHtml(l.name)}</td>
              <td class="qty">${formatQty(l.qty)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </section>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    @page { size: A4 portrait; margin: 9mm; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: -apple-system, Roboto, 'Helvetica Neue', sans-serif; color: #111827; margin: 0; }
    header { display: flex; align-items: baseline; gap: 10px;
             border-bottom: 2px solid #111827; padding-bottom: 5px; margin-bottom: 8px; }
    h1 { font-size: 15px; margin: 0; letter-spacing: -0.3px; text-transform: uppercase; }
    .meta { color: #6B7280; font-size: 9px; flex: 1; }
    .count { color: #047857; font-size: 9px; font-weight: 800; white-space: nowrap; }

    /* Les colonnes : c'est elles qui font tenir dix fournisseurs sur une page. */
    .sheet { column-count: ${d.columns}; column-gap: 14px; column-fill: balance; }
    ${d.columns > 1 ? '.sheet { column-rule: 1px solid #F3F4F6; }' : ''}

    /* Un fournisseur ne se coupe jamais en deux — ni entre deux colonnes, ni
       entre deux pages : celui qui fait les courses lit un magasin à la fois. */
    .group { break-inside: avoid; page-break-inside: avoid; margin-bottom: ${d.gap}px; }
    .group-head { border-bottom: 1.5px solid #111827; padding-bottom: 2px; margin-bottom: 3px; }
    .group h2 { font-size: ${d.headFont}px; margin: 0; text-transform: uppercase; letter-spacing: 0.6px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .note { font-size: ${Math.max(6, d.headFont - 2)}px; color: #B45309; font-style: italic;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td { padding: ${d.rowPadding}px 2px; border-bottom: 1px solid #F3F4F6;
         font-size: ${d.font}px; vertical-align: middle; }
    /* Case à cocher au stylo : la feuille sert sur place, pendant les courses. */
    td.box { width: ${Math.round(d.font * 1.1)}px; }
    td.box::before { content: ''; display: block; border: 1px solid #9CA3AF; border-radius: 2px;
                     width: ${Math.round(d.font * 0.75)}px; height: ${Math.round(d.font * 0.75)}px; }
    /* Une ligne = UNE ligne. Un nom trop long est tronqué, jamais replié :
       c'est ce qui rend la hauteur de la feuille prévisible. */
    td.name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    td.qty { text-align: right; width: ${Math.round(d.font * 2.6)}px; font-weight: 800;
             font-size: ${Math.round(d.font * 1.15)}px; white-space: nowrap; }

    .empty { color: #9CA3AF; font-size: 12px; margin-top: 20px; }
    footer { position: fixed; bottom: 0; left: 0; right: 0;
             color: #D1D5DB; font-size: 7px; text-align: center; }
  </style></head><body>
    <header>
      <h1>Courses</h1>
      <div class="meta">${escapeHtml(title)} &nbsp;•&nbsp; ${formatDate(Date.now())}</div>
      ${total > 0 ? `<div class="count">${total} produit${total > 1 ? 's' : ''}</div>` : ''}
    </header>
    <div class="sheet">${body}</div>
    <footer>Généré par NETBAC</footer>
  </body></html>`;
}

const pdfFileName = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Courses-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.pdf`;
};

// Export du PDF vers la feuille de partage du système — WhatsApp, mail, Drive…
//
// `Sharing.shareAsync` et non `Print.printAsync` : l'impression n'ouvre que les
// imprimantes et « Enregistrer en PDF », jamais une messagerie. Le fichier est
// d'abord renommé « Courses-2026-08-26.pdf », parce que c'est ce nom que verra
// le destinataire dans WhatsApp — printToFileAsync produit sinon un nom aléatoire.
export async function generateAndShareShoppingList(state: AppState): Promise<{ shared: boolean }> {
  const html = buildShoppingListHtml(state);
  const { uri } = await Print.printToFileAsync({ html });

  let target = uri;
  try {
    const dir = uri.slice(0, uri.lastIndexOf('/') + 1);
    const named = `${dir}${pdfFileName()}`;
    if (named !== uri) {
      await FileSystem.moveAsync({ from: uri, to: named });
      target = named;
    }
  } catch {
    // Renommage cosmétique : s'il échoue, on partage le fichier tel quel.
  }

  if (!(await Sharing.isAvailableAsync())) {
    // Aucune feuille de partage (rare) : au moins proposer l'impression / PDF.
    await Print.printAsync({ html });
    return { shared: false };
  }
  await Sharing.shareAsync(target, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Envoyer la liste de courses',
  });
  return { shared: true };
}
