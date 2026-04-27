import React from 'react';
import { render } from '@testing-library/react-native';
import ProductLabel from '../src/components/ProductLabel';
import { useStore } from '../src/lib/store';
import { Product } from '../src/types';

const sampleProduct: Product = {
  id: 'abcd1234xyz',
  bacId: '1',
  name: 'SAUMON',
  quantity: 2,
  unit: 'kg',
  actionType: 'received',
  addedAt: Date.now(),
  modifiedAt: Date.now(),
  dlc: Date.now() + 3 * 86400000,
  status: 'active',
  syncStatus: 'synced',
};

describe('QR code in ProductLabel', () => {
  it('renders a QR with NETBAC:<id> payload', () => {
    // seed the store with the product so lookups work
    useStore.setState({ products: [sampleProduct] });
    const { getByTestId } = render(<ProductLabel product={sampleProduct} />);
    const qr = getByTestId('qr-svg');
    expect(qr.props['data-value']).toBe(`NETBAC:${sampleProduct.id}`);
  });

  it('still shows the product code text next to QR', () => {
    const { getByText } = render(<ProductLabel product={sampleProduct} />);
    expect(getByText(/NB-ABCD1234/i)).toBeTruthy();
  });
});
