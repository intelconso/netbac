// Clôture automatique des étiquettes oubliées : 24 h après la DLC, une
// étiquette encore active passe en « Utilisé », marquée `autoUsed`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';
import { AUTO_USE_GRACE_MS, staleLabelIds } from '../src/lib/usedAt';
import { Product } from '../src/types';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

const HOUR = 3_600_000;

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  bacId: 'b1',
  name: 'Poulet',
  quantity: 1,
  unit: 'kg',
  dlc: Date.now(),
  addedAt: Date.now() - 72 * HOUR,
  modifiedAt: Date.now() - 72 * HOUR,
  actionType: 'reception' as any,
  status: 'active',
  syncStatus: 'synced',
  ...over,
});

describe('staleLabelIds', () => {
  it('frontière exacte : DLC + 24 h', () => {
    const dlc = 1_700_000_000_000;
    const p = [product({ dlc })];
    expect(staleLabelIds(p, dlc + AUTO_USE_GRACE_MS - 1)).toEqual([]);
    expect(staleLabelIds(p, dlc + AUTO_USE_GRACE_MS)).toEqual(['p1']);
  });

  it('ignore les étiquettes déjà sorties ou supprimées', () => {
    const dlc = 1_700_000_000_000;
    const now = dlc + 10 * AUTO_USE_GRACE_MS;
    expect(staleLabelIds([
      product({ id: 'u', dlc, status: 'used' }),
      product({ id: 'd', dlc, status: 'discarded' }),
      product({ id: 'x', dlc, deletedAt: dlc }),
    ], now)).toEqual([]);
  });
});

describe('autoUseStaleLabels', () => {
  it('passe en Utilisé avec usedAt = DLC et le marqueur auto', () => {
    const dlc = Date.now() - 25 * HOUR;
    useStore.setState({ products: [product({ id: 'vieux', dlc }), product({ id: 'frais', dlc: Date.now() - HOUR })] });

    expect(useStore.getState().autoUseStaleLabels()).toBe(1);

    const vieux = useStore.getState().products.find((p) => p.id === 'vieux')!;
    expect(vieux.status).toBe('used');
    expect(vieux.usedAt).toBe(dlc);
    expect(vieux.autoUsed).toBe(true);
    expect(useStore.getState().products.find((p) => p.id === 'frais')!.status).toBe('active');
  });

  it('ne touche à rien quand il n\'y a rien à clôturer', () => {
    useStore.setState({ products: [product({ dlc: Date.now() })] });
    const before = useStore.getState().products;
    expect(useStore.getState().autoUseStaleLabels()).toBe(0);
    expect(useStore.getState().products).toBe(before);
  });
});
