"use server";

// Placeholder server action for user creation
// This is not used in the main application flow — users are managed through /users admin panel
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createUser(prevState: { message: string }, formData: FormData): Promise<{ message: string }> {
  void prevState;
  void formData;
  return { message: "Not implemented" };
}
