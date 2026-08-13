# Roadmap — Internalizar el rol Financiero y reducir Siigo al mínimo (DIAN)

> **Objetivo de dirección:** traer a Made in Casa Pro todo lo que hoy hace el rol
> financiero en Siigo, dejando en Siigo **únicamente lo que exige conexión con la DIAN**
> (facturación electrónica y nómina electrónica), hasta que finalmente obtengamos
> **nuestra propia habilitación DIAN** y podamos independizarnos del todo.

---

## 0. Qué hace hoy el rol financiero en Siigo (inventario real)

Todo lo que hay que reemplazar, agrupado por módulo:

### Módulo Compras
- Registrar **facturas de compra**.
- **Cuentas de cobro** y enviarlas electrónicamente a la DIAN.
- Registrar **pagos de facturas y anticipos**. Un anticipo debe **controlarse hasta
  cruzarse** con las facturas.

### Módulo Ventas
- **Factura de venta** que nace de la **cotización** → el cliente genera una orden de
  compra → con esa se factura.
- Registrar **pagos y retenciones** que nos hacen.
- **Controlar facturas pendientes de pago** (cartera).

### Módulo Contable
- Registrar **gastos bancarios**.
- Registrar **nómina** (hoy automático desde el módulo de nómina).
- Registrar **otros ajustes contables**.

### Módulo Nómina
- **Liquidar nómina** y enviarla electrónicamente a la DIAN.
- Controlar **días de vacaciones** tomadas y pendientes.
- **Liquidar trabajadores** (liquidación definitiva).

---

## 1. Principio de decisión: qué se internaliza y qué se deja en Siigo

La regla es simple:

> **Todo lo que sea registro, control, cartera, anticipos, cruces y reportes → se
> internaliza en Made in Casa Pro (es lógica de negocio, no requiere DIAN).**
>
> **Todo lo que sea "emitir/timbrar un documento electrónico ante la DIAN"
> (factura electrónica, cuenta de cobro/documento soporte, nómina electrónica) → se
> DEJA en Siigo temporalmente, y nuestra app lo dispara vía la API de Siigo.**

Así, Siigo pasa de ser el sistema financiero completo a ser solo el **"timbrador DIAN"**
al que llamamos por API. El ahorro viene de bajar al plan mínimo que habilite esas APIs.

### Clasificación de cada función

| Función (Siigo hoy) | Naturaleza | Decisión |
|---|---|---|
| Registrar facturas de compra | Registro/control | **Internalizar** |
| Cuenta de cobro **electrónica a DIAN** | Timbrado DIAN | **Siigo (API)** → luego propio |
| Pagos de facturas | Registro/control | **Internalizar** |
| Anticipos y su cruce con facturas | Control/cartera | **Internalizar** |
| Factura de venta desde cotización | Genera doc + **timbrado DIAN** | Lógica **interna** + **timbrado Siigo (API)** |
| Registrar pagos y retenciones recibidas | Registro/control | **Internalizar** |
| Cartera (facturas pendientes de pago) | Control | **Internalizar** |
| Gastos bancarios | Registro contable | **Internalizar** |
| Registrar nómina en contabilidad | Asiento contable | **Internalizar** (deriva de nómina) |
| Otros ajustes contables | Registro contable | **Internalizar** |
| Liquidar **nómina electrónica a DIAN** | Timbrado DIAN | **Siigo (API)** → luego propio |
| Vacaciones tomadas/pendientes | Control | **Internalizar** |
| Liquidación de trabajadores | Cálculo | **Internalizar** (cálculo) + timbrado Siigo si aplica |

---

## 2. Roadmap ordenado por complejidad de integración

Ordenado de **más simple a más complejo**. Cada fase entrega valor y es independiente
de las siguientes salvo dependencias marcadas. Las fases 1-4 no tocan la DIAN
(puro control interno) → bajo riesgo. Las fases 5-7 involucran timbrado electrónico.

---

### FASE 0 — Base de datos financiera y datos fiscales
**Complejidad: baja · Riesgo: bajo · No toca DIAN**

Prerrequisito de todo. Sin estos datos no se puede facturar ni pagar.

- [ ] Agregar datos fiscales a `clients`: `document_type`, `identification` (NIT),
      `check_digit`, `fiscal_responsibilities`, `address`, `city`, `phone`, `email`,
      `siigo_id` (nullable).
- [ ] Agregar datos fiscales/bancarios a `users` (colaboradores): `document_type`,
      `identification`, `tax_regime`, `is_obligated_to_invoice`,
      `bank_name`, `account_type`, `account_number`.
- [ ] Agregar **valor de venta / presupuesto** y `currency` al proyecto
      (hoy no existe; es el dato que falta para facturar — ver `ANALISIS-EJECUTIVO.md`).
- [ ] Importar clientes desde Siigo una sola vez (reusar el conector de lectura ya existente)
      y guardar `siigo_id`.

> **Nota:** hoy `projects.oc` es solo texto libre y `projects.billing_closed_at` es un
> timestamp administrativo — no son documentos. Se reaprovechan pero se formalizan.

---

### FASE 1 — Cotización a cliente → Orden de compra (Ventas, parte interna)
**Complejidad: baja-media · Riesgo: bajo · No toca DIAN**

Todo lo que ocurre **antes** de timbrar la factura de venta. Es 100% lógica interna.

- [ ] Tabla `client_quotes` (cotización al cliente): ítems, valor, impuestos, moneda,
      estado (borrador/enviada/aprobada/rechazada), vínculo al proyecto.
- [ ] Flujo: cotización → cliente aprueba → se registra la **orden de compra** del cliente
      (formalizando el actual `projects.oc`).
- [ ] Generar PDF de la cotización desde la app.

> **Resultado:** el origen de la factura de venta ("viene desde la cotización") ya vive
> en nuestra app. Solo faltará el timbrado (Fase 5).

---

### FASE 2 — Compras: facturas, pagos y anticipos (control interno)
**Complejidad: media · Riesgo: bajo · No toca DIAN (excepto cuenta de cobro, Fase 6)**

Reemplaza el módulo de Compras salvo el timbrado electrónico de cuentas de cobro.

- [ ] Tabla `purchase_invoices` (facturas de compra que recibimos): proveedor/colaborador,
      valor, impuestos, fecha, estado, PDF/XML adjunto.
- [ ] Tabla `payments` (pagos de facturas): monto, fecha, método, vínculo a factura.
- [ ] Tabla `advances` (anticipos): monto, fecha, saldo pendiente de cruce.
- [ ] **Motor de cruce anticipo ↔ factura:** un anticipo se aplica a una o varias facturas
      y disminuye su saldo hasta quedar en cero. Estado del anticipo: abierto/parcial/cruzado.
- [ ] Reusar lo que ya existe para saber cuánto se paga a externos:
      `task_quotes.price` (cotizaciones aceptadas) y `project_tasks.completion_cost`.

> **Resultado:** control total de compras, pagos y anticipos sin Siigo. Solo la
> **cuenta de cobro electrónica** (documento soporte a DIAN) queda pendiente para Fase 6.

---

### FASE 3 — Ventas: cartera, pagos y retenciones recibidas (control interno)
**Complejidad: media · Riesgo: bajo · No toca DIAN**

Reemplaza el control de cartera del módulo de Ventas.

- [ ] Tabla `sales_invoices` (registro local de facturas de venta): valor, retenciones,
      estado de pago (pendiente/parcial/pagada), saldo.
- [ ] Registrar **pagos recibidos** y **retenciones** que nos aplican (ReteFuente, ReteICA, IVA).
- [ ] **Cartera:** vista de facturas pendientes de pago, días de mora, saldo por cliente.
- [ ] Alertas de vencimiento.

> **Resultado:** control de cartera completo en la app. El **timbrado** de la factura de
> venta se agrega en Fase 5.

---

### FASE 4 — Contabilidad ligera (gastos bancarios y ajustes)
**Complejidad: media · Riesgo: bajo · No toca DIAN**

Reemplaza el módulo Contable salvo la nómina (que viene en Fase 7).

- [ ] Tabla `bank_expenses` / movimientos: registrar **gastos bancarios**.
- [ ] Registrar **otros ajustes contables** (asientos manuales simples).
- [ ] El **asiento de nómina** se generará automáticamente cuando exista nómina (Fase 7).
- [ ] Reportes básicos: ingresos vs egresos por periodo, por proyecto, por cliente.

> **Resultado:** contabilidad operativa (no un ERP contable completo, sino lo que el rol
> financiero registra día a día).

---

### FASE 5 — Timbrado de FACTURA DE VENTA vía API de Siigo (primer toque DIAN)
**Complejidad: media-alta · Riesgo: medio · Usa Siigo como timbrador DIAN**

Aquí conectamos lo interno con la DIAN, **sin construir el timbrado nosotros** todavía.

- [ ] Módulo `app/lib/services/siigo/invoice.ts`: `POST /v1/invoices` (crear/timbrar),
      obtener CUFE, PDF, XML, notas crédito.
- [ ] Al aprobar cartera/orden de compra → botón "Timbrar factura" que llama a Siigo y
      guarda `cufe`, `pdf_url`, `xml_url` en `sales_invoices`.
- [ ] Activar las funciones ya escritas y sin exponer de Siigo (`createCustomer`,
      `updateCustomer`) para sincronizar el cliente al facturar.
- [ ] Manejo de errores de timbrado y reintentos.

> **Dependencia:** Fases 0, 1 y 3. **Deja en Siigo:** solo el timbrado.

---

### FASE 6 — Timbrado de CUENTA DE COBRO / DOCUMENTO SOPORTE vía API de Siigo
**Complejidad: media-alta · Riesgo: medio · Usa Siigo como timbrador DIAN**

Cierra el módulo de Compras: pagos a colaboradores no obligados a facturar.

- [ ] Módulo Siigo para **documento soporte en adquisiciones** / cuenta de cobro electrónica.
- [ ] Para el colaborador que **no factura**: la app genera la cuenta de cobro y la timbra
      vía Siigo ante la DIAN.
- [ ] Para el colaborador que **sí factura**: solo registramos su factura recibida (Fase 2).
- [ ] Tabla `collaborator_payments`: `user_id`, `amount`, `concept`, `legal_doc_type`
      (factura recibida / documento soporte), `siigo_doc_id`, `status`, `paid_at`.

> **Dependencia:** Fases 0 y 2. Validar con el contador retenciones aplicables.

---

### FASE 7 — Nómina electrónica (la más compleja)
**Complejidad: alta · Riesgo: alto · Cálculo interno + timbrado Siigo**

El módulo más delicado por cálculo legal y timbrado obligatorio ante la DIAN.

- [ ] **Cálculo de nómina interno**: devengados, deducciones, seguridad social,
      prestaciones. (Reusar `users.monthly_salary` como base.)
- [ ] **Control de vacaciones**: tabla `vacations` con días causados, tomados y pendientes
      por trabajador.
- [ ] **Liquidación de trabajadores**: cálculo de liquidación definitiva.
- [ ] **Timbrado de nómina electrónica** vía API de Siigo (documento soporte de nómina a DIAN).
- [ ] Generar automáticamente el **asiento contable de nómina** en el módulo de Fase 4.

> **Dependencia:** Fases 0 y 4. **Deja en Siigo:** solo el timbrado de nómina electrónica.
> **Recomendación:** dejar esta fase para el final. Es donde más conviene mantener Siigo
> por el riesgo legal.

---

## 3. Qué queda en Siigo al terminar las fases 1-7

Tras completar todo lo anterior, Siigo se usa **exclusivamente como timbrador DIAN** para:

1. Factura de venta electrónica (Fase 5).
2. Cuenta de cobro / documento soporte electrónico (Fase 6).
3. Nómina electrónica (Fase 7).

Todo el **control, registro, cartera, anticipos, cruces, gastos, ajustes y cálculos**
ya vive en Made in Casa Pro. → Se baja al **plan mínimo de facturación/nómina electrónica**.

---

## 4. FASE FINAL — Habilitación DIAN propia (independencia total de Siigo)

**Complejidad: muy alta · Riesgo: alto · Requiere proceso legal con la DIAN**

Solo tiene sentido después de que todo el control ya esté internalizado (Fases 1-7) y
Siigo sea únicamente el timbrador. El objetivo es dejar de pagar Siigo por completo.

### Roadmap para obtener el permiso ante la DIAN

**Etapa A — Diagnóstico y decisión (legal/contable)**
- [ ] Decidir la modalidad: **software propio** habilitado como facturador electrónico, o
      **proveedor tecnológico autorizado** propio. (Para una sola empresa, lo usual es
      habilitar el software propio como facturador, no ser proveedor de terceros.)
- [ ] Confirmar con el contador/asesor DIAN los documentos electrónicos requeridos:
      factura electrónica de venta, documento soporte, nómina electrónica.

**Etapa B — Requisitos técnicos DIAN**
- [ ] Obtener **certificado de firma digital** (entidad certificadora autorizada).
- [ ] Registrarse en el **portal de habilitación** de la DIAN.
- [ ] Implementar la generación del **XML UBL 2.1** según el anexo técnico DIAN
      (factura, documento soporte, nómina — cada uno tiene su esquema).
- [ ] Implementar **firma digital** del XML y cálculo del **CUFE/CUDE**.
- [ ] Implementar el **código QR** y la representación gráfica (PDF).

**Etapa C — Set de pruebas de habilitación (obligatorio)**
- [ ] Ejecutar el **set de pruebas** que exige la DIAN en ambiente de **habilitación**
      (enviar N documentos válidos de cada tipo y que la DIAN los apruebe).
- [ ] Corregir rechazos hasta pasar el 100% del set.

**Etapa D — Paso a producción**
- [ ] Solicitar el paso a **ambiente de producción** una vez aprobado el set de pruebas.
- [ ] Emitir en paralelo (Siigo + propio) un periodo de marcha blanca para conciliar.
- [ ] Validar contingencia (qué pasa si la DIAN está caída).

**Etapa E — Corte final**
- [ ] Migrar 100% del timbrado (ventas, documento soporte, nómina) a nuestro motor propio.
- [ ] **Cancelar Siigo por completo.**
- [ ] Monitoreo y auditoría de cumplimiento continuo.

> **Advertencia realista:** esta fase final es un proyecto en sí mismo (meses de trabajo
> + asesoría legal). Por eso el roadmap la deja al final: primero se captura el ahorro
> grande (bajar a plan mínimo con fases 1-7), y solo si el volumen lo justifica se invierte
> en la habilitación propia para eliminar Siigo del todo.

---

## 5. Tabla resumen — orden, complejidad y toque DIAN

| Orden | Fase | Complejidad | ¿Toca DIAN? | Se deja en Siigo |
|---|---|---|---|---|
| 1 | 0 — Datos fiscales y valor de venta | Baja | No | — |
| 2 | 1 — Cotización cliente → OC | Baja-media | No | — |
| 3 | 2 — Compras: facturas/pagos/anticipos | Media | No | Cuenta de cobro (Fase 6) |
| 4 | 3 — Ventas: cartera/pagos/retenciones | Media | No | Timbrado (Fase 5) |
| 5 | 4 — Contabilidad ligera | Media | No | Nómina (Fase 7) |
| 6 | 5 — Timbrar factura de venta | Media-alta | Sí (vía Siigo) | Timbrado factura |
| 7 | 6 — Timbrar cuenta de cobro | Media-alta | Sí (vía Siigo) | Timbrado doc. soporte |
| 8 | 7 — Nómina electrónica | Alta | Sí (vía Siigo) | Timbrado nómina |
| 9 | FINAL — Habilitación DIAN propia | Muy alta | Sí (propio) | **Nada — se cancela Siigo** |

---

## 6. Riesgos y notas

- **No construir el timbrado DIAN de entrada.** Las fases 5-7 usan Siigo como timbrador;
  esto captura el ahorro (plan mínimo) sin el riesgo de la habilitación propia.
- **Validación contable obligatoria.** Retenciones (ReteFuente, ReteICA, IVA), documento
  soporte y nómina deben validarse con el contador. La app soporta el flujo; el criterio
  fiscal lo pone el contador.
- **Nómina es lo más riesgoso.** Se deja para el final por complejidad de cálculo y
  cumplimiento. Conviene mantener Siigo aquí el mayor tiempo posible.
- **Cruce de anticipos** (Fase 2) es la lógica de negocio más delicada de Compras:
  modelar bien el saldo y los estados para evitar descuadres.
- **Migración de clientes** (Fase 0): conciliar duplicados usando `identification` como clave.
- **Base técnica existente:** el conector Siigo ya tiene token/renovación robustos y las
  funciones `createCustomer`/`updateCustomer` listas para reusar. Unificar antes el default
  inconsistente de `SIIGO_API_URL` entre `auth.ts` (`/v1`) y `client.ts` (sin `/v1`).
- **Dependencia con métricas:** el campo "valor de venta del proyecto" (Fase 0) también
  desbloquea la rentabilidad en `ANALISIS-EJECUTIVO.md`. Un solo cambio, doble beneficio.
