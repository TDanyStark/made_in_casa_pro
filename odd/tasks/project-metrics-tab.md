# Project metrics tab, sale price at creation, tab order and dark tabs
Leadership (admin, directivo, financiero) gets a "Métricas" tab with the detailed investment view; the summary stays but prettier and hidden from commercials.
The sale price can be entered when creating a project and shows in red in the project's main area until it is filled.

## Specs
S1. "una pestaña que vea el directivo, el admin y el directivo no comerciales y no colaboradores que sea metricas" — tab "Métricas" visible to admin, directivo and financiero only; comercial and colaborador never see it, and the financials API (GET) rejects them (supersedes project-financials S10: "commercial keeps seeing the cards").
S2. "mejorar las metrica de proyecto, crear un apartado para verlo en detaller el resumen manetnerlo" — the Métricas tab shows detail: hours internal vs external, cost per collaborator (hours, cost, share), cost vs sale price, version filter.
S3. "el resumen actual manenerlo pero hacerlo mas bonito y quitarlo del comercial" — the summary panel above the tabs stays for leadership with a nicer layout; commercials no longer see it.
S4. "la parte del precio aparecer como en rojo para que el comercial lo llene" / "cuando se cree un proyecto debe decirse en cuanto se vendio, no es obligatorio pero deberia aparecer en rojo para llenar ahi en la parte priuncipal del proyecto y que lo vea el comercial que lo creo y pues el directivo y los admins y el financiero" — optional "Precio de venta" field in project creation; in the project's main area the sale price shows in red while empty; visible to the creator commercial, directivo, admin and financiero; editable by admin, directivo and the creator commercial (unchanged edit roles).
S5. "Primero tareas, luego notas, luego metricas, luego cotizaciones, luego informacion, lo de co-respondables metelo dentro de informacion" — tab order Tareas, Notas, Métricas, Cotizaciones, Información (+ Notificaciones last, unchanged); Co-responsables moves inside Información.
S6. "los colaboradores deben ver tareas, y notas" — collaborators see only Tareas and Notas.
S7. "en dark no se ve la pestaña activa - esto revisalo en todas las partes donde se usen pestañas en light si se ve en dark no" — the active tab is visible in dark mode everywhere tabs are used.

## Tasks
T1 | S7 | inline: tabs.tsx dark active style | done | 0b57f00
T2 | S1,S4 | inline: roles, GET financials leadership-only, PATCH returns only sale_price, GET project returns sale_price for allowed viewers, POST accepts sale_price + tests | done | de20580
T3 | S4 | inline: wizard step 1 field + confirm payload + main-area sale price (red when empty) + tests | done | 078f0a0
T4 | S1,S2,S3,S5,S6 | inline: summary panel restyle, Métricas tab, tab order, co-managers in Información, collaborator tabs + tests + README | done | 2f2d5a1

Slice boundary: T1-T3 (0b57f00..078f0a0) form slice 1 (~560 lines); T4 is slice 2, reviewable on its own.

## Log
L1. hagamos el siguiente feature en los proyectos una pestaña que vea el directivo, el admin y el directivo no comerciales y no colaboradores que sea metricas / mejorar las metrica de proyecto, crear un apartado para verlo en detaller el resumen manetnerlo y la parte del precio aparecer como en rojo para que el comercial lo llene / el resumen actual manenerlo [Image#1] pero hacerlo mas bonito y quitarlo del comercial / ahora cuando se cree un proyecto debe decirse en cuanto se vendio, no es obligatorio pero deberia aparecer en rojo para llenar ahi en la parte priuncipal del proyecto y que lo vea el comercial que lo creo y pues el directivo y los admins y el financiero [Image#2] oganiza esta parte, 1. Primero tareas, luego notas, luego metricas, luego cotizaciones, luego informacion, lo de co-respondables metelo dentro de informacion, 2. los colaboradores deben ver tareas, y notas 3. en dark no se ve la pestaña activa - esto revisalo en todas las partes donde se usen pestañas en light si se ve en dark no
L2. Assumption: "el directivo no comerciales" read as the financiero role (DIRECTIVO_SCOPE_ROLES = directivo + financiero).
