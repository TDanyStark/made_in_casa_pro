import { render, screen } from '@testing-library/react';

let mockActionState: unknown;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useActionState: () => [mockActionState, jest.fn(), false],
}));
jest.mock('@/lib/actions/auth', () => ({ login: jest.fn() }));
jest.mock('@/components/icons', () => ({ Icons: { spinner: () => null } }));

import { UserLoginForm } from '@/components/login/UserLoginForm';

describe('UserLoginForm after a failed login', () => {
  it('keeps the email prefill and starts the password empty even if a password were in the state', () => {
    mockActionState = {
      errors: { general: 'Datos incorrectos' },
      submittedData: { email: 'ana@example.com', password: 'secreto' },
    };
    render(<UserLoginForm />);
    expect(screen.getByPlaceholderText('name@example.com')).toHaveValue('ana@example.com');
    expect(screen.getByPlaceholderText('Password')).toHaveValue('');
    expect(screen.getByText('Datos incorrectos')).toBeInTheDocument();
  });
});
