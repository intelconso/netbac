// Pure validation logic mirroring app/add-product.tsx isValid computation.
// Regression: previously the AJOUTER button silently no-op'd when name or
// quantity was empty, with no visual feedback. The button now disables and
// shows what's missing.

function computeMissingFields(name: string, quantity: string, bacId: string): string[] {
  const missing: string[] = [];
  if (!name.trim()) missing.push('Nom');
  if (!quantity.trim() || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) missing.push('Quantité');
  if (!bacId) missing.push('Emplacement');
  return missing;
}

describe('add-product form validation', () => {
  it('reports Nom missing when name is empty', () => {
    expect(computeMissingFields('', '1', 'bac-1')).toEqual(['Nom']);
  });

  it('reports Nom missing when name is whitespace only', () => {
    expect(computeMissingFields('   ', '1', 'bac-1')).toEqual(['Nom']);
  });

  it('reports Quantité missing when quantity is empty', () => {
    expect(computeMissingFields('Poulet', '', 'bac-1')).toEqual(['Quantité']);
  });

  it('reports Quantité missing when quantity is non-numeric', () => {
    expect(computeMissingFields('Poulet', 'abc', 'bac-1')).toEqual(['Quantité']);
  });

  it('reports Quantité missing when quantity is zero', () => {
    expect(computeMissingFields('Poulet', '0', 'bac-1')).toEqual(['Quantité']);
  });

  it('reports Quantité missing when quantity is negative', () => {
    expect(computeMissingFields('Poulet', '-1', 'bac-1')).toEqual(['Quantité']);
  });

  it('reports Emplacement missing when bacId is empty', () => {
    expect(computeMissingFields('Poulet', '1', '')).toEqual(['Emplacement']);
  });

  it('reports multiple missing fields at once', () => {
    expect(computeMissingFields('', '', '')).toEqual(['Nom', 'Quantité', 'Emplacement']);
  });

  it('returns empty array when all fields valid', () => {
    expect(computeMissingFields('Poulet', '1.5', 'bac-1')).toEqual([]);
  });

  it('accepts decimal quantities', () => {
    expect(computeMissingFields('Poulet', '0.250', 'bac-1')).toEqual([]);
  });
});
