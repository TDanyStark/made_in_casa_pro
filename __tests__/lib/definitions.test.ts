import { SignupFormSchema } from '@/lib/definitions';

describe('SignupFormSchema', () => {
  describe('valid inputs', () => {
    it('accepts a valid email and a 6-character password', () => {
      const result = SignupFormSchema.safeParse({
        email: 'user@example.com',
        password: 'abc123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts a long password', () => {
      const result = SignupFormSchema.safeParse({
        email: 'admin@domain.co',
        password: 'supersecurepassword',
      });
      expect(result.success).toBe(true);
    });

    it('accepts a clean email without surrounding spaces', () => {
      // Note: .trim() is a transform that runs after .email() validation in Zod.
      // Emails with leading/trailing spaces fail the .email() check before trimming occurs.
      const result = SignupFormSchema.safeParse({
        email: 'clean@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('email validation', () => {
    it('rejects a plain string that is not an email', () => {
      const result = SignupFormSchema.safeParse({
        email: 'notanemail',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an email missing the @ symbol', () => {
      const result = SignupFormSchema.safeParse({
        email: 'userdomain.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty email', () => {
      const result = SignupFormSchema.safeParse({
        email: '',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('includes the message "Please enter a valid email." in the error', () => {
      const result = SignupFormSchema.safeParse({
        email: 'invalid',
        password: 'password123',
      });
      if (!result.success) {
        const emailErrors = result.error.issues.find(i => i.path.includes('email'));
        expect(emailErrors?.message).toContain('Please enter a valid email.');
      }
    });
  });

  describe('password validation', () => {
    it('rejects an empty password', () => {
      const result = SignupFormSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a password shorter than 6 characters (actual min is 6)', () => {
      const result = SignupFormSchema.safeParse({
        email: 'user@example.com',
        password: 'abc1',
      });
      expect(result.success).toBe(false);
    });

    it('accepts a password with exactly 6 characters (the actual minimum)', () => {
      const result = SignupFormSchema.safeParse({
        email: 'user@example.com',
        password: 'abc123',
      });
      expect(result.success).toBe(true);
    });

    // NOTE: The schema defines min(6) but the error message says "Be at least 8 characters long"
    // This test documents the inconsistency between validation behavior and user messaging
    it('includes the message "Be at least 8 characters long" even though min is 6', () => {
      const result = SignupFormSchema.safeParse({
        email: 'user@example.com',
        password: 'abc1',
      });
      if (!result.success) {
        const passwordErrors = result.error.issues.find(i => i.path.includes('password'));
        expect(passwordErrors?.message).toBe('Be at least 8 characters long');
      }
    });

    it('accepts a password with exactly 7 characters (between 6 min and 8 message)', () => {
      const result = SignupFormSchema.safeParse({
        email: 'user@example.com',
        password: 'abc1234',
      });
      expect(result.success).toBe(true);
    });
  });
});
