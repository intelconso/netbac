import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildHaccpHtml, generateAndShareHaccpPdf } from '../src/lib/pdf';
import { useStore } from '../src/lib/store';

const freshState = () => useStore.getState();

describe('PDF export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds HTML containing restaurant + active products', () => {
    const state = freshState();
    useStore.getState().addProduct({
      bacId: '1',
      name: 'SAUMON',
      quantity: 2,
      unit: 'kg',
      actionType: 'received',
      dlc: Date.now() + 3 * 86400000,
    });
    const html = buildHaccpHtml(useStore.getState(), { includeTraceability: true });
    expect(html).toContain('Rapport HACCP');
    expect(html).toContain('SAUMON');
    expect(html).toContain('Digital Pro');
  });

  it('omits traceability section when flag disabled', () => {
    const html = buildHaccpHtml(freshState(), { includeTraceability: false });
    expect(html).not.toContain('Traçabilité des produits actifs');
  });

  it('includes expired section when flag enabled', () => {
    useStore.getState().addProduct({
      bacId: '1',
      name: 'LAIT',
      quantity: 1,
      unit: 'L',
      actionType: 'received',
      dlc: Date.now() - 2 * 86400000,
    });
    const html = buildHaccpHtml(useStore.getState(), { includeExpired: true });
    expect(html).toContain('Produits expirés');
    expect(html).toContain('LAIT');
  });

  it('calls expo-print and expo-sharing end-to-end', async () => {
    const uri = await generateAndShareHaccpPdf(freshState(), { includeTraceability: true });
    expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
    expect((Print.printToFileAsync as jest.Mock).mock.calls[0][0].html).toContain('Rapport HACCP');
    expect(Sharing.isAvailableAsync).toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: 'application/pdf' }));
    expect(uri).toBe('file:///tmp/mock.pdf');
  });

  it('skips share when Sharing unavailable', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    const uri = await generateAndShareHaccpPdf(freshState());
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(uri).toBe('file:///tmp/mock.pdf');
  });
});
