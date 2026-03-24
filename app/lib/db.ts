// ---------------------------------------------------------------------------
// Database client — re-exported through the adapter layer.
//
// All existing query files import `turso` from here and continue to work
// unchanged. To swap the underlying database, edit app/lib/db/index.ts.
// ---------------------------------------------------------------------------

export { db } from "./db/index";

// Backwards-compatible alias: `import { turso } from '../db'` still works.
export { db as turso } from "./db/index";
