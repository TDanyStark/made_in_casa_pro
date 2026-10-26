# Project additional brands
A project keeps its principal brand (`projects.brand_id`) and can be linked to additional brands of the same client.
Branch: feat/project-additional-brands. Migration 023. No live database run, push or PR by the implementation.

## Specs
S1. "es posible Crear la forma de que un proyecto pueda estar asignado a muchas marcas?"
S2. "mejor sigamos mantieniendo una maarca principal, y poder adjuntarle marcas adicionales, el proyecto queda asingnado a una marca como siempre, pero se puede limkear a mas" — `projects.brand_id` stays the principal brand and keeps every current use (client, manager, Drive folder, email "Marca", manager transfer); additional brands live in a new `project_brands` link table.
S3. All brands of a project belong to the same client (user choice "Sí, mismo cliente"). Linking a brand of another client is rejected (`BRAND_CLIENT_MISMATCH`, 400); an unknown brand is rejected (`BRAND_NOT_FOUND`); the principal brand cannot be repeated as additional (`ADDITIONAL_BRAND_IS_PRINCIPAL`, 400). Rejected input leaves the stored links unchanged.
S4. Drive folder: "Bajo la primera marca (Recomendado)" — the folder stays Client/Principal brand/Project; unchanged.
S5. Manager transfer: "las marcas no se migran de cliente, lo que puede cambiar es un gerente" — transfer logic is not changed by this feature and does not touch `project_brands`.
S6. Editing: "Sí, agregar o quitar (mínimo 1)" — additional brands can be added/removed after creation (PATCH `additional_brand_ids` replaces the set); the principal brand always remains, so a project always has at least one brand.
S7. Creation: the wizard step 1 lets the user pick additional brands of the principal brand's client; POST `/api/projects` accepts optional `additional_brand_ids`.
S8. Reads: project responses include `additional_brands: {id, name}[]`; the project header shows them; filtering projects or my-tasks by `brand_id` also matches projects linked to that brand as additional.

## Tasks
T1 | S2,S3,S6,S8 | migration 023 `project_brands`; queries: select `additional_brands`, validate + insert on create, replace on update, brand filters match links; query tests | inline | done (RED 10 failed -> GREEN; queries 428 passed; tsc 0) | commit pending
T2 | S3,S6,S7 | API: POST/PATCH zod `additional_brand_ids`, domain error codes/status; route tests | inline | pending
T3 | S6,S7,S8 | UI: AdditionalBrandsSelect (react-select multi, client-filtered), wizard step 1 + confirm, ProjectHeader display, ProjectBrandsCard edit in detail; component tests; README | inline | pending

## Log
L1. User request: "es posible Crear la forma de que un proyecto pueda estar asignado a muchas marcas?"
L2. First answers: model B (pure N:M), same client, implement. Then corrected (L3).
L3. Decisions: principal + additional brands (S2); Drive under principal (S4); transfer: "las marcas no se migran de cliente, lo que puede cambiar es un gerente" (S5); editable, minimum 1 (S6).
L4. Exploration: 21 app files use `projects.brand_id`; keeping it as principal leaves them untouched. `ClientComponent.tsx` is pre-existing dead code (not in scope). Engram mirror unavailable in this session (no memory tools).
L5. User confirmation: "Ven recuerda que se colocara una marca principal y las demas seran asociadas, para no cambiar toda la estructura actual" — matches S2; no structure change to projects.brand_id.
L6. T1: my-tasks brandId test updated on purpose (S8 changes the filter to principal-or-additional).
