import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectInfoTab } from '@/components/projects/ProjectInfoTab';
import {
  formatProjectDateTimeForDisplay,
  normalizeProjectDateTime,
} from '@/lib/utils/project-date-time';

const mockPatch = jest.fn();
const mockPost = jest.fn();
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

jest.mock('@/components/projects/ProjectDriveAccessManager', () => ({
  ProjectDriveAccessManager: () => <div data-testid="drive-access-manager" />,
}));

jest.mock('@/lib/services/apiService', () => ({
  patch: (...args: unknown[]) => mockPatch(...args),
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
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

  const baseDriveProject = {
    id: 20,
    title: 'Proyecto Drive',
    brand_id: 1,
    brand_name: 'Marca Drive',
    manager_id: 2,
    manager_name: 'Ana',
    client_id: 3,
    client_name: 'Cliente Drive',
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
    status: 'active' as const,
    progress: 0,
    created_by: null,
    created_by_name: null,
    created_at: '2026-04-01T10:00:00.000Z',
    updated_at: '2026-04-02T12:00:00.000Z',
    co_managers: [],
  };

  it('recreates the Drive folder and persists the returned id/url', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({
      ok: true,
      data: {
        projectFolderId: 'new-folder-1',
        projectFolderUrl: 'https://drive.google.com/drive/folders/new-folder-1',
      },
    });

    render(<ProjectInfoTab canEdit={true} project={baseDriveProject} />);

    const recreateButtons = screen.getAllByRole('button', { name: /recrear carpeta/i });
    // [0] = AlertDialogTrigger button, [1] = AlertDialogAction (confirm) button.
    await user.click(recreateButtons[0]);
    await user.click(recreateButtons[1]);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('projects/20/drive/recreate', {});
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['project', 20] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] });
    expect(mockToastSuccess).toHaveBeenCalledWith('Carpeta de Drive recreada');
  });

  it('saves a custom Drive URL', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({ ok: true, data: { id: 20 } });

    render(<ProjectInfoTab canEdit={true} project={baseDriveProject} />);

    const urlInput = screen.getByLabelText(/url personalizada/i);
    await user.type(urlInput, 'https://drive.google.com/drive/folders/manual-1');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('projects/20', {
        drive_folder_url: 'https://drive.google.com/drive/folders/manual-1',
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Carpeta de Drive actualizada');
  });

  it('unlinks the Drive folder by clearing the URL field and saving', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({ ok: true, data: { id: 21 } });

    render(
      <ProjectInfoTab
        canEdit={true}
        project={{
          ...baseDriveProject,
          id: 21,
          drive_folder_id: 'existing-1',
          drive_folder_url: 'https://drive.google.com/drive/folders/existing-1',
        }}
      />
    );

    expect(screen.getByRole('link', { name: /abrir carpeta/i })).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/existing-1'
    );

    const urlInput = screen.getByLabelText(/url personalizada/i);
    await user.clear(urlInput);
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('projects/21', { drive_folder_url: '' });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Carpeta de Drive desvinculada');
  });
});
