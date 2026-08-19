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
const mockToastWarning = jest.fn();

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
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

const baseState = {
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
};

describe('WizardStep6Confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('empty Drive URL field: runs the automatic creation flow byte-for-byte identical to before', async () => {
    mockPost
      .mockResolvedValueOnce({ ok: true, data: { projectFolderId: 'drive-1', projectFolderUrl: 'https://drive.test/folder' } })
      .mockResolvedValueOnce({ ok: true, data: { id: 44 } })
      .mockResolvedValueOnce({ ok: true, data: {} });

    const user = userEvent.setup();

    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('projects', expect.objectContaining({
        ideal_delivery_at: normalizeProjectDateTime('2026-04-07T09:30'),
        oc: 'OC-123',
        billing_closed_at: normalizeProjectDateTime('2026-04-08T18:45'),
        drive_folder_id: 'drive-1',
        drive_folder_url: 'https://drive.test/folder',
      }));
    });

    // Byte-for-byte identical: create-folder is called with the exact same args as before.
    expect(mockPost).toHaveBeenNthCalledWith(1, 'drive/create-folder', {
      clientName: 'Cliente Uno',
      brandName: 'Marca Uno',
      projectTitle: 'Proyecto metadata',
      shareEmails: ['carlos@test.com'],
    });

    // No automatic lookup is ever performed anymore.
    expect(mockGet).not.toHaveBeenCalled();

    expect(mockPush).toHaveBeenCalledWith('/projects/44');
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('regression: a driveWarning from create-folder (partial sharing failure) does NOT block project creation, just warns', async () => {
    // Regression guard: create-folder used to return a 500 whenever some
    // recipients failed to sync, even though the folder itself was created
    // successfully — this aborted project creation entirely. Now the API
    // returns 201 with the folder data plus a driveWarning, and the wizard
    // must continue creating the project and only show a warning toast.
    mockPost
      .mockResolvedValueOnce({
        ok: true,
        data: {
          projectFolderId: 'drive-1',
          projectFolderUrl: 'https://drive.test/folder',
          driveWarning: {
            code: 'DRIVE_ACCESS_SYNC_FAILED',
            message: 'No se pudieron sincronizar todos los accesos de Google Drive.',
          },
        },
      })
      .mockResolvedValueOnce({ ok: true, data: { id: 44 } })
      .mockResolvedValueOnce({ ok: true, data: {} });

    const user = userEvent.setup();

    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects/44'));

    // Folder+project creation both proceeded — no abort, no misleading error.
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastWarning).toHaveBeenCalledWith(
      expect.stringContaining('No se pudieron sincronizar todos los accesos de Google Drive.')
    );
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith('projects', expect.objectContaining({
      drive_folder_id: 'drive-1',
      drive_folder_url: 'https://drive.test/folder',
    }));
  });

  it('valid Drive URL provided: skips creation entirely and persists the pasted folder', async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: { id: 44 } });

    const user = userEvent.setup();
    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);

    const urlInput = screen.getByPlaceholderText(/drive.google.com/i);
    await user.type(urlInput, 'https://drive.google.com/drive/folders/existing-id');

    await user.click(screen.getByRole('button', { name: /crear proyecto/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('projects', expect.objectContaining({
        drive_folder_id: 'existing-id',
        drive_folder_url: 'https://drive.google.com/drive/folders/existing-id',
      }));
    });

    // drive/create-folder must NOT be called — creation skipped entirely.
    expect(mockPost).not.toHaveBeenCalledWith('drive/create-folder', expect.anything());
    expect(mockPush).toHaveBeenCalledWith('/projects/44');
  });

  it('invalid Drive URL blocks submission until fixed or cleared', async () => {
    const user = userEvent.setup();
    render(<WizardStep6Confirm state={baseState} onBack={jest.fn()} />);

    const urlInput = screen.getByPlaceholderText(/drive.google.com/i);
    const confirmButton = screen.getByRole('button', { name: /crear proyecto/i });

    await user.type(urlInput, 'https://example.com/not-a-drive-link');

    expect(await screen.findByText(/la url debe pertenecer a drive\.google\.com/i)).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
    expect(mockPost).not.toHaveBeenCalled();

    // Clearing the field un-blocks submission and runs the automatic flow.
    await user.clear(urlInput);
    await waitFor(() => expect(confirmButton).not.toBeDisabled());

    mockPost
      .mockResolvedValueOnce({ ok: true, data: { projectFolderId: 'drive-1', projectFolderUrl: 'https://drive.test/folder' } })
      .mockResolvedValueOnce({ ok: true, data: { id: 44 } });

    await user.click(confirmButton);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects/44'));
    expect(mockPost).toHaveBeenNthCalledWith(1, 'drive/create-folder', expect.anything());
  });
});
