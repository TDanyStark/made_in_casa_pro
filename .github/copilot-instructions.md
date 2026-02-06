# Copilot instructions

## Project overview
- Next.js 15 App Router app. UI pages live under app/(admin)/* and the login page is app/page.tsx.
- API routes are under app/api/** and use NextRequest/NextResponse.
- Data layer uses Turso (libsql) in app/lib/db.ts with query helpers in app/lib/queries/**; mutations often call revalidatePath.
- Path alias @/* maps to app/* (see tsconfig.json), so imports like "@/lib/queries/clients" point into app/.

## Auth and permissions
- Session is a JWT stored in an httpOnly cookie; see app/lib/session.ts.
- middleware.ts gates public vs protected routes and defers API auth to the endpoints.
- Route permissions come from app/lib/LinksData.ts and are resolved by app/lib/permissions.ts, including dynamic routes like /clients/[id].
- API handlers should call validateHttpMethod and validateApiRole from app/lib/services/api-auth.ts before processing.

## API patterns
- Validate request bodies with Zod in the route handler (examples: app/api/clients/route.ts, app/api/brands/route.ts).
- Pagination responses return { data, pageCount, currentPage, total } and use ITEMS_PER_PAGE from app/config/constants.
- Errors are JSON with { error } and appropriate 4xx/5xx status codes.

## Frontend patterns
- Use the centralized API client in app/lib/services/apiService.ts (get/post/patch/del) instead of ad-hoc fetch.
- React Query provider is wired in app/components/QueryProvider.tsx and mounted in app/layout.tsx.
- Theme switching uses app/components/theme-provider.tsx (next-themes). Global styles are in app/globals.css and app/styles/tiptap.css.

## Local dev and env
- Scripts: npm run dev (turbopack), npm run build, npm run start, npm run lint.
- Required env vars: SESSION_SECRET, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN (used in app/lib/session.ts and app/lib/db.ts).
