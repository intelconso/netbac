import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore, switchStoreToUser } from '../src/lib/store';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

describe('product CRUD', () => {
  it('adds a product with active status and returns its id', () => {
    const id = useStore.getState().addProduct({
      bacId: '1', name: 'Poulet', quantity: 1, unit: 'pce',
      dlc: Date.now() + 86400000, actionType: 'received',
    });
    const product = useStore.getState().products.find((p) => p.id === id);
    expect(product).toBeDefined();
    expect(product?.status).toBe('active');
    expect(product?.name).toBe('Poulet');
  });

  it('soft-deletes via updateProductStatus instead of hard delete', () => {
    const id = useStore.getState().addProduct({
      bacId: '1', name: 'Poulet', quantity: 1, unit: 'pce',
      dlc: Date.now() + 86400000, actionType: 'received',
    });
    useStore.getState().updateProductStatus(id, 'used');
    const product = useStore.getState().products.find((p) => p.id === id);
    expect(product?.status).toBe('used');
    expect(useStore.getState().products).toHaveLength(1);
  });

  it('logs an activity entry when a product is marked used', () => {
    const id = useStore.getState().addProduct({
      bacId: '1', name: 'Poulet', quantity: 1, unit: 'pce',
      dlc: Date.now() + 86400000, actionType: 'received',
    });
    const logsBefore = useStore.getState().logs.length;
    useStore.getState().updateProductStatus(id, 'used');
    const logsAfter = useStore.getState().logs;
    expect(logsAfter.length).toBeGreaterThan(logsBefore);
    expect(logsAfter[0].action).toBe('use_product');
  });
});

describe('zone CRUD', () => {
  it('cascades unit deletion when a zone is deleted', () => {
    const { addZone, addStorageUnit, deleteZone } = useStore.getState();
    addZone({ name: 'Test Zone', type: 'autre' });
    const zoneId = useStore.getState().zones.find((z) => z.name === 'Test Zone')!.id;
    addStorageUnit({ zoneId, name: 'Frigo Test', type: 'frigo', icon: '❄️' });
    expect(useStore.getState().storageUnits.some((u) => u.zoneId === zoneId)).toBe(true);

    deleteZone(zoneId);

    expect(useStore.getState().zones.some((z) => z.id === zoneId)).toBe(false);
    expect(useStore.getState().storageUnits.some((u) => u.zoneId === zoneId)).toBe(false);
  });
});

describe('switchStoreToUser', () => {
  it('preserves a user\'s data across logout/login (regression: deleted-zone-reappearing bug)', async () => {
    // 1. Sign in as user A — creates user-specific storage key
    await switchStoreToUser('userA');

    // 2. User A deletes a default zone
    const initialZones = useStore.getState().zones;
    expect(initialZones.length).toBeGreaterThan(0);
    const zoneToDelete = initialZones[0];
    useStore.getState().deleteZone(zoneToDelete.id);
    expect(useStore.getState().zones.some((z) => z.id === zoneToDelete.id)).toBe(false);

    // give the persist middleware a tick to flush the deletion
    await new Promise((r) => setTimeout(r, 50));

    // 3. Logout (anon) — must NOT stomp user A's stored data
    await switchStoreToUser(null);
    await new Promise((r) => setTimeout(r, 50));

    // 4. Login as user A again
    await switchStoreToUser('userA');

    // 5. Deleted zone must STILL be deleted
    expect(useStore.getState().zones.some((z) => z.id === zoneToDelete.id)).toBe(false);
  });

  it('seeds INITIAL_STATE for a brand-new user with no stored data', async () => {
    await switchStoreToUser('brandNewUser');
    expect(useStore.getState().zones.length).toBeGreaterThan(0);
    expect(useStore.getState().storageUnits.length).toBeGreaterThan(0);
  });

  it('isolates data between two different users', async () => {
    await switchStoreToUser('userA');
    useStore.getState().addZone({ name: 'A-only Zone', type: 'autre' });
    await new Promise((r) => setTimeout(r, 50));

    await switchStoreToUser('userB');
    expect(useStore.getState().zones.some((z) => z.name === 'A-only Zone')).toBe(false);

    await switchStoreToUser('userA');
    expect(useStore.getState().zones.some((z) => z.name === 'A-only Zone')).toBe(true);
  });
});

describe('duplicate-product detection (used by express-add)', () => {
  it('finds an existing active product on the same bac', () => {
    useStore.getState().addProduct({
      bacId: 'bac-X', name: 'Poulet', quantity: 1, unit: 'pce',
      dlc: Date.now() + 86400000, actionType: 'received',
    });
    const existing = useStore.getState().products.find(
      (p) => p.bacId === 'bac-X' && p.status === 'active',
    );
    expect(existing).toBeDefined();
  });

  it('does not flag a previously-used product as a duplicate', () => {
    const id = useStore.getState().addProduct({
      bacId: 'bac-Y', name: 'Poulet', quantity: 1, unit: 'pce',
      dlc: Date.now() + 86400000, actionType: 'received',
    });
    useStore.getState().updateProductStatus(id, 'used');
    const existing = useStore.getState().products.find(
      (p) => p.bacId === 'bac-Y' && p.status === 'active',
    );
    expect(existing).toBeUndefined();
  });
});
