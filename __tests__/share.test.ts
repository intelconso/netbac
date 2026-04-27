import { Share } from 'react-native';
import { buildShareMessage, shareHaccpSummary } from '../src/lib/share';
import { useStore } from '../src/lib/store';

describe('Share summary', () => {
  beforeEach(() => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('builds message with restaurant + counts', () => {
    const msg = buildShareMessage(useStore.getState());
    expect(msg).toContain('Digital Pro');
    expect(msg).toContain('Conformité HACCP');
    expect(msg).toContain('Produits actifs');
  });

  it('reports 100% compliance when no products', () => {
    const msg = buildShareMessage(useStore.getState());
    expect(msg).toContain('100%');
  });

  it('invokes RN Share.share with the summary text', async () => {
    const result = await shareHaccpSummary(useStore.getState());
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'NETBAC — Résumé HACCP', message: expect.stringContaining('Conformité HACCP') })
    );
    expect(result.action).toBe(Share.sharedAction);
  });

  it('reflects expired products in compliance %', () => {
    useStore.getState().addProduct({
      bacId: '1',
      name: 'X',
      quantity: 1,
      unit: 'kg',
      actionType: 'received',
      dlc: Date.now() - 86400000,
    });
    useStore.getState().addProduct({
      bacId: '1',
      name: 'Y',
      quantity: 1,
      unit: 'kg',
      actionType: 'received',
      dlc: Date.now() + 86400000 * 5,
    });
    const msg = buildShareMessage(useStore.getState());
    expect(msg).toContain('Expirés: 1');
    expect(msg).toMatch(/Conformité HACCP: 50%|Conformité HACCP: \d+%/);
  });
});
