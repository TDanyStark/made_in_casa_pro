# Instrucciones de Copilot

## Descripción general del proyecto
- Aplicación Next.js 15 con App Router. Las páginas de UI viven en `app/(admin)/*` y la página de login es `app/page.tsx`.
- Las rutas de la API están en `app/api/**` y usan `NextRequest/NextResponse`.
- La capa de datos usa Turso (libsql) en `app/lib/db.ts` con helpers de consultas en `app/lib/queries/**`; las mutaciones suelen llamar a `revalidatePath`.
- El alias de rutas `@/*` mapea a `app/*` (ver `tsconfig.json`), por lo que imports como `"@/lib/queries/clients"` apuntan a `app/`.

## Autenticación y permisos
- La sesión es un JWT almacenado en una cookie `httpOnly`; ver `app/lib/session.ts`.
- `middleware.ts` separa rutas públicas vs protegidas y delega la autenticación de la API a los endpoints.
- Los permisos de rutas provienen de `app/lib/LinksData.ts` y se resuelven en `app/lib/permissions.ts`, incluyendo rutas dinámicas como `/clients/[id]`.
- Los handlers de la API deben llamar a `validateHttpMethod` y `validateApiRole` desde `app/lib/services/api-auth.ts` antes de procesar.

## Patrones de la API
- Validar los cuerpos de las requests con Zod en el handler de la ruta (ejemplos: `app/api/clients/route.ts`, `app/api/brands/route.ts`).
- Las respuestas paginadas devuelven `{ data, pageCount, currentPage, total }` y usan `ITEMS_PER_PAGE` desde `app/config/constants`.
- Los errores son JSON con `{ error }` y códigos de estado 4xx/5xx apropiados.

## Patrones de frontend
- Usar el cliente de API centralizado en `app/lib/services/apiService.ts` (`get/post/patch/del`) en lugar de `fetch` ad-hoc.
- El provider de React Query está en `app/components/QueryProvider.tsx` y se monta en `app/layout.tsx`.
- El cambio de tema usa `app/components/theme-provider.tsx` (next-themes). Los estilos globales están en `app/globals.css` y `app/styles/tiptap.css`.
- Los componentes UI reutilizables están en `app/components/ui/` y siguen el diseño de Tailwind CSS. Las páginas específicas de la aplicación viven en `app/(admin)/*`.
- siempre que sea posible, reutiliza componentes existentes para mantener la consistencia visual y de código. Antes de crear un nuevo componente, revisa `app/components/ui/` para ver si ya existe algo similar que puedas extender o adaptar.
- Usa shadcn components para elementos comunes como botones, inputs, modales, etc., y sigue su guía de estilos para mantener una apariencia coherente en toda la aplicación.

## Desarrollo local y entorno
- Scripts: `npm run dev` (turbopack), `npm run build`, `npm run start`, `npm run lint`.
- Variables de entorno requeridas: `SESSION_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (usadas en `app/lib/session.ts` y `app/lib/db.ts`).


## Test
- Para los tests, se usan Jest y React Testing Library. Las funciones de Turso se mockean para simular resultados de la base de datos. revisar el estilo de los test que ya existen en `__tests__/queries` y `__tests__/hooks` para mantener consistencia.

## Siempre que se agregue un nuevo feature o endpoint
- asegúrate de agregar tests unitarios y de integración correspondientes.
- Actualiza el archivo `README-RESUME.md` que es donde esta la documentación pública del proyecto, para reflejar los cambios y nuevas funcionalidades, si es un feature pequeño como cambios a cosas que ya existen no hagas cambios en el README, pero si es algo nuevo o un cambio grande, actualízalo para que la documentación esté al día.

## Antes de hacer un nuevo feature o endpoint
- Siempre revisa los archivos como `/lib/`, `/components`, `app\lib\services\apiService.ts` etc, para no repetir codigo que ya existe, y para mantener la consistencia del proyecto. Si encuentras algo similar, intenta reutilizarlo o extenderlo en lugar de crear algo completamente nuevo.
- si ya uso librerias que estan en el package.json para lo que quieres hacer, úsalas en lugar de agregar nuevas dependencias, esto ayuda a mantener el proyecto ligero y con menos dependencias externas, y si tengo ya una libreria que hace por ejemplo selects, no hagas ese componente de 0, implementa la libreria que ya tengo para eso, y si quieres hacer algo personalizado, hazlo extendiendo el componente de la libreria, pero no hagas algo completamente nuevo sin revisar lo que ya existe.

