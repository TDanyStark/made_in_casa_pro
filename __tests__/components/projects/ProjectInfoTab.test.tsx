import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectInfoTab } from '@/components/projects/ProjectInfoTab';
import {
  formatProjectDateTimeForDisplay,
  normalizeProjectDateTime,
} from '@/lib/utils/project-date-time';

const mockPatch = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('lucide-react', () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock('@/components/projects/CampaignSelect', () => ({
  CampaignSelect: ({ initialLabel }: { initialLabel?: string | null }) => (
    <div data-testid="campaign-select">{initialLabel ?? 'Sin campaña'}</div>
  ),
}));

jest.mock('@/lib/services/apiService', () => ({
  patch: (...args: unknown[]) => mockPatch(...args),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('ProjectInfoTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('edits and persists project metadata fields', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({ ok: true, data: { id: 12 } });

    render(
      <ProjectInfoTab
        canEdit={true}
        project={{
          id: 12,
          title: 'Proyecto Uno',
          brand_id: 1,
          brand_name: 'Marca Uno',
          manager_id: 2,
          manager_name: 'Ana',
          client_id: 3,
          client_name: 'Cliente Uno',
          campaign_id: null,
          campaign_name: null,
          product_id: 4,
          product_name: 'Producto Uno',
          product_category_name: null,
          drive_folder_id: null,
          drive_folder_url: null,
          notes: null,
          ideal_delivery_at: '2026-04-07T14:30:00.000Z',
          oc: 'OC-001',
          billing_closed_at: null,
          status: 'active',
          progress: 50,
          created_by: 6,
          created_by_name: 'Laura',
          created_at: '2026-04-01T10:00:00.000Z',
          updated_at: '2026-04-02T12:00:00.000Z',
          co_managers: [],
        }}
      />
    );

    const idealDelivery = screen.getByLabelText(/fecha ideal de entrega/i);
    const oc = screen.getByLabelText(/^oc$/i);
    const billingClosure = screen.getByLabelText(/cierre de facturación/i);

    expect(idealDelivery).toHaveValue('2026-04-07T09:30');
    expect(oc).toHaveValue('OC-001');

    await user.clear(idealDelivery);
    await user.type(idealDelivery, '2026-05-03T08:15');
    await user.clear(oc);
    await user.type(oc, '  OC-900  ');
    await user.type(billingClosure, '2026-05-04T17:45');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('projects/12', {
        ideal_delivery_at: normalizeProjectDateTime('2026-05-03T08:15'),
        oc: 'OC-900',
        billing_closed_at: normalizeProjectDateTime('2026-05-04T17:45'),
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['project', 12] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('shows fallback values in read-only mode', () => {
    render(
      <ProjectInfoTab
        canEdit={false}
        project={{
          id: 13,
          title: 'Proyecto Dos',
          brand_id: 1,
          brand_name: 'Marca Dos',
          manager_id: 2,
          manager_name: 'Ana',
          client_id: 3,
          client_name: 'Cliente Dos',
          campaign_id: null,
          campaign_name: null,
          product_id: null,
          product_name: null,
          product_category_name: null,
          drive_folder_id: null,
          drive_folder_url: null,
          notes: null,
          ideal_delivery_at: null,
          oc: null,
          billing_closed_at: null,
          status: 'active',
          progress: 0,
          created_by: null,
          created_by_name: null,
          created_at: '2026-04-01T10:00:00.000Z',
          updated_at: '2026-04-02T12:00:00.000Z',
          co_managers: [],
        }}
      />
    );

    expect(screen.getByText('Sin definir')).toBeInTheDocument();
    expect(screen.getByText('Sin OC')).toBeInTheDocument();
    expect(screen.getByText('Sin cierre de facturación')).toBeInTheDocument();
  });

  it('shows project metadata in detail view with billing closure helper text', () => {
    const expectedIdealDelivery = formatProjectDateTimeForDisplay('2026-04-07T14:30:00.000Z');
    const expectedBillingClosure = formatProjectDateTimeForDisplay('2026-04-20T17:00:00.000Z');

    render(
      <ProjectInfoTab
        canEdit={false}
        project={{
          id: 14,
          title: 'Proyecto Tres',
          brand_id: 1,
          brand_name: 'Marca Tres',
          manager_id: 2,
          manager_name: 'Ana',
          client_id: 3,
          client_name: 'Cliente Tres',
          campaign_id: null,
          campaign_name: null,
          product_id: 4,
          product_name: 'Producto Tres',
          product_category_name: null,
          drive_folder_id: null,
          drive_folder_url: null,
          notes: null,
          ideal_delivery_at: '2026-04-07T14:30:00.000Z',
          oc: 'OC-777',
          billing_closed_at: '2026-04-20T17:00:00.000Z',
          status: 'active',
          progress: 0,
          created_by: null,
          created_by_name: null,
          created_at: '2026-04-01T10:00:00.000Z',
          updated_at: '2026-04-02T12:00:00.000Z',
          co_managers: [],
        }}
      />
    );

    expect(
      screen.getByText((content) => content.replace(/\s/g, ' ') === expectedIdealDelivery?.replace(/\s/g, ' '))
    ).toBeInTheDocument();
    expect(screen.getByText('OC-777')).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.replace(/\s/g, ' ') === expectedBillingClosure?.replace(/\s/g, ' '))
    ).toBeInTheDocument();
    expect(
      screen.getByText(/corresponde al cierre administrativo\/facturación, no a/i)
    ).toBeInTheDocument();
    expect(screen.getByText('completed_at')).toBeInTheDocument();
  });
});
