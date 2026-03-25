// ---------------------------------------------------------------------------
// Database client — re-exported through the adapter layer.
//
// Query files import `db` from here. To swap the underlying database,
// edit app/lib/db/index.ts.
// ---------------------------------------------------------------------------

export { db } from "./db/index";
