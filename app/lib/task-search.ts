/** Lowercases and strips accents so "Diseño" matches "diseno". */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type SearchableTask = {
  title: string;
  assigned_user_name?: string | null;
};

/** True when the task title or its collaborator's name contains the query. Empty query matches all. */
export function taskMatchesSearch(task: SearchableTask, query: string): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  return (
    normalizeSearchText(task.title).includes(needle) ||
    normalizeSearchText(task.assigned_user_name).includes(needle)
  );
}
