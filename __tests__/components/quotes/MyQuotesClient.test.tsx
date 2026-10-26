import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { get } from '@/lib/services/apiService';
import { MyQuotesClient } from '@/components/quotes/MyQuotesClient';

jest.mock('@/lib/services/apiService', () => ({ get: jest.fn() }));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/quotes/SubmitQuoteModal', () => ({ SubmitQuoteModal: () => null }));
jest.mock('@/components/ui/tabs', () => {
  const Pass = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Tabs: Pass, TabsList: Pass, TabsTrigger: Pass, TabsContent: Pass };
});
const mockGet = get as jest.Mock;

describe('MyQuotesClient', () => {
  it('renders quote notes sanitized', async () => {
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        invitations: [],
        quotes: [{
          id: 1, task_title: 'Logo', status: 'pending', created_at: '2026-01-01', price: 1000,
          delivery_minutes: 60, notes: '<p><em>propuesta</em></p><img src=x onerror="alert(1)"><script>alert(2)</script>',
        }],
      },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}><MyQuotesClient /></QueryClientProvider>
    );
    const em = await screen.findByText('propuesta');
    expect(em.tagName).toBe('EM');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
