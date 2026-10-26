import React from 'react';
import { screen } from '@testing-library/react';
import { get } from '@/lib/services/apiService';
import ListProductsClient from '@/components/products/ListProductsClient';
import { renderWithQueryClient } from '../queryTestUtils';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/products/TableProducts', () => () => null);
jest.mock('@/components/products/CreateProductModal', () => () => null);
jest.mock('@/components/pagination/Pagination', () => () => null);
jest.mock('@/components/search/search', () => () => null);
jest.mock('@/components/ui/select', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Select: Pass, SelectContent: Pass, SelectTrigger: Pass, SelectValue: () => null,
    SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

const mockGet = get as jest.Mock;

describe('ListProductsClient category filter', () => {
  it('shows a category load error instead of an empty filter when categories fail', async () => {
    mockGet.mockImplementation(async (url: string) =>
      url.startsWith('product-categories')
        ? { ok: false, status: 401, error: 'No autorizado' }
        : { ok: true, status: 200, data: { data: [], pageCount: 1, currentPage: 1, total: 0 } }
    );
    renderWithQueryClient(<ListProductsClient />);
    expect(await screen.findByText('Error al cargar las categorías')).toBeInTheDocument();
  });
});
