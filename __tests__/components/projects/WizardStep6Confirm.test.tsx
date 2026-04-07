import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardStep6Confirm } from '@/components/projects/wizard/WizardStep6Confirm';
import { normalizeProjectDateTime } from '@/lib/utils/project-date-time';

const mockPush = jest.fn();
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockDel = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('lucide-react', () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/dynamic', () => () => {
  const MockEditor = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Notas del proyecto" value={value} onChange={(event) => onChange(event.target.value)} />
  );

  return MockEditor;
});

jest.mock('@/lib/services/apiService', () => ({
  post: (...args: unknown[]) => mockPost(...args),
  get: (...args: unknown[]) => mockGet(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('WizardStep6Confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost
      .mockResolvedValueOnce({ ok: true, data: { projectFolderId: 'drive-1', projectFolderUrl: 'https://drive.test/folder' } })
      .mockResolvedValueOnce({ ok: true, data: { id: 44 } })
      .mockResolvedValueOnce({ ok: true, data: {} });
  });

  it('includes normalized metadata fields in the create project payload', async () => {
    const user = userEvent.setup();

    render(
      <WizardStep6Confirm
        state={{
          title: 'Proyecto metadata',
          brand_id: 2,
          brand_name: 'Marca Uno',
          ideal_delivery_at: '2026-04-07T09:30',
          oc: '  OC-123  ',
          billing_closed_at: '2026-04-08T18:45',
          client_id: 9,
          client_name: 'Cliente Uno',
          created_by: 4,
          created_by_name: 'Ana',
          manager_id: 7,
          manager_name: 'Carlos',
          manager_email: 'carlos@test.com',
          co_manager_ids: [],
          co_manager_names: [],
          co_manager_emails: [],
          product: { id: 5, name: 'Producto X' } as never,
          task_overrides: [],
          extra_tasks: [],
          removed_template_ids: [],
          campaign_id: null,
          campaign_name: '',
          notes: '',
          drive_folder_id: null,
          drive_folder_url: null,
        }}
        onBack={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('projects', expect.objectContaining({
        ideal_delivery_at: normalizeProjectDateTime('2026-04-07T09:30'),
        oc: 'OC-123',
        billing_closed_at: normalizeProjectDateTime('2026-04-08T18:45'),
      }));
    });

    expect(mockPush).toHaveBeenCalledWith('/projects/44');
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});
