# Made in Casa Pro — Análisis Ejecutivo

> Documento para presentación a dirección.
> Qué hace hoy la plataforma, qué nos ahorra, qué datos genera, qué nos falta capturar
> y hacia dónde debería evolucionar.

---

## 1. Resumen para dirección (la versión de 1 minuto)

**Antes:** los proyectos se llevaban en un Excel. Una persona recibía cada tarea
y la asignaba manualmente a la siguiente parte del equipo. El flujo dependía de
que esa persona estuviera disponible, no se equivocara y comunicara a tiempo.

**Hoy:** Made in Casa Pro es una plataforma web que **automatiza ese coordinador
humano**. Cuando un proyecto arranca, el sistema:

1. Genera automáticamente todas las tareas del proyecto según el tipo de producto.
2. Asigna cada tarea a la persona correcta (por área, por carga de trabajo, o al comercial).
3. Activa la primera tarea y notifica por correo a quien debe ejecutarla.
4. Al completarse una tarea, **activa sola la siguiente** y avisa al responsable.
5. Gestiona la cotización con proveedores externos cuando una tarea lo requiere.
6. Lleva el progreso del proyecto al 100% sin que nadie tenga que "empujar" el Excel.

**El resultado:** se eliminó el cuello de botella de la persona-coordinadora, se
redujo el error humano de asignación, y todo el historial quedó registrado y auditable.

---

## 2. Qué facilita la plataforma (beneficios concretos)

| Antes (Excel + coordinador) | Ahora (Made in Casa Pro) |
|---|---|
| Una persona asignaba cada tarea a mano | Asignación **automática** por área, carga o comercial |
| El proyecto avanzaba cuando el coordinador lo recordaba | La siguiente tarea se **activa sola** al terminar la anterior |
| Avisos por chat/WhatsApp informales | **Correos automáticos** a cada responsable en cada paso |
| No había historial de quién hizo qué y cuándo | **Auditoría completa** de cada cambio de estado |
| Cotizar con proveedores se hacía por fuera | Flujo de **cotización integrado** (invitar, recibir precio, aceptar) |
| Sin control de versiones del proyecto | **Versiones/ajustes** formales (v2, v3) tras la entrega |
| Documentos dispersos | Carpeta de **Google Drive creada automáticamente** por proyecto y versión |
| Visibilidad total para todos | **Permisos por rol** (cada quien ve lo que le corresponde) |

### Automatizaciones clave que ya operan

- **Generación de tareas desde plantillas de producto:** cada producto tiene su
  "receta" de tareas. Al asignar el producto al proyecto, se crean todas las tareas
  en orden, ya asignadas.
- **Pipeline secuencial:** el trabajo "fluye" de una persona a la siguiente sin
  intervención de un coordinador.
- **Balanceo de carga:** cuando una tarea va a un área, el sistema elige al
  colaborador interno **menos cargado** de esa área.
- **Bucle de corrección automático:** si una tarea de validación se rechaza, el
  sistema regenera automáticamente las tareas a corregir, sin borrar el historial.
- **Cotización de externos:** tareas que requieren proveedor se bloquean, se invita
  a cotizar, se reciben precios y tiempos, y se acepta uno — todo trazado.
- **Notificaciones por correo:** 8 tipos de eventos generan emails automáticos
  (tarea asignada, completada, cotización recibida/aceptada, proyecto completado, etc.),
  con reintentos automáticos y panel de fallos para el admin.

---

## 3. Qué datos capturamos hoy

La plataforma ya registra una base de datos rica. Lo relevante para análisis:

### Por proyecto
- Marca, cliente, encargado responsable y co-encargados, producto, campaña.
- Estado (activo, pausado, completado, archivado, en ajustes) y **% de progreso**.
- Quién lo creó.
- Fechas: creación, última actualización, **fecha ideal de entrega (deadline)**,
  fecha de completado, **fecha de cierre de facturación**.
- Orden de compra (OC) y carpeta de Drive.
- Versiones/ajustes (v2, v3...) con su propio set de tareas.

### Por tarea
- Título, descripción, área, **a quién está asignada**.
- Estado (sin iniciar, en espera, en progreso, completada, bloqueada).
- Tipo (ejecución / validación) y bandera (nueva / corrección / ajuste).
- Orden dentro del proyecto.
- **Fecha de asignación** y **fecha de completado**.
- **Minutos trabajados** (`progress_minutes`) y **% de avance**.
- **Costo al completar** (`completion_cost`).
- URL del entregable y notas de entrega.

### Auditoría (historial de transiciones)
- **Cada cambio de estado** queda registrado: qué tarea, de qué estado a qué estado,
  **quién lo movió** y **cuándo**. Esto es oro para análisis de productividad.

### Cotizaciones (proveedores externos)
- Precio cotizado, **tiempo estimado** (días/horas/minutos), estado (pendiente/aceptada/rechazada).
- Quién invitó, quién cotizó.

### Personas
- Usuarios internos y externos, rol, área, skills.
- **Salario mensual** (interno).
- Carga de trabajo (conteo de tareas activas por persona).

---

## 4. Qué informes importantes podemos sacar HOY (con lo que ya tenemos)

Aunque la página de métricas aún no existe, los datos ya permiten construir:

1. **Productividad por colaborador**
   - Tareas completadas por persona y por periodo (desde `task_transitions`).
   - **Minutos trabajados** acumulados por persona (`progress_minutes`).
   - Tiempo promedio entre asignación y completado (`assigned_at` → `completed_at`).
   - Tareas activas vs completadas por persona (carga real).

2. **Estado y salud de proyectos**
   - Proyectos por estado, % de avance promedio.
   - Proyectos atrasados (comparando `ideal_delivery_at` vs hoy).
   - Tiempo total de ciclo de un proyecto (creación → completado).
   - Cuellos de botella: tareas bloqueadas y por qué (sin asignar / esperando cotización).

3. **Costos directos por proyecto**
   - Suma de `completion_cost` de las tareas + precios de cotizaciones aceptadas.
   - Costo de proveedores externos por proyecto.

4. **Desempeño de proveedores externos**
   - Cuánto cotiza cada proveedor, cuántas cotizaciones gana, tiempos prometidos.

5. **Operación / notificaciones**
   - Tasa de entrega de correos, fallos, reintentos (ya hay panel de admin).

---

## 5. Qué datos NOS FALTA capturar (para los KPIs que dirección querrá)

Aquí está el gap real. Lo que tenemos sirve para operar, pero para **costo real,
productividad financiera y rentabilidad** faltan piezas:

### Para medir COSTO DE PROYECTO (en tiempo y en dinero)

| KPI deseado | Qué falta capturar |
|---|---|
| **Costo en tiempo de personal interno** | Hoy tenemos `monthly_salary` pero **no una tarifa/hora derivada** ni horas estándar mensuales. Necesitamos convertir minutos trabajados → costo (salario/horas del mes × minutos de la tarea). |
| **Costo total real de un proyecto** | No hay una **vista que sume**: costo interno (tiempo × tarifa) + costo externo (cotizaciones aceptadas + `completion_cost`). Los datos existen sueltos, falta el cálculo agregado. |
| **Presupuesto vs real** | **No existe campo de presupuesto/valor de venta** del proyecto. Sin eso no se puede medir rentabilidad ni margen. |
| **Moneda** | La moneda (COP) está **hardcodeada en correos**, no hay columna real. Para multi-país habría que formalizarla. |
| **Tiempo estimado vs real por tarea interna** | Para tareas internas no hay estimación (solo las externas la traen vía cotización). No se puede medir desviación de tiempo en trabajo interno. |

### Para medir PRODUCTIVIDAD DE UN MIEMBRO DEL EQUIPO

| KPI deseado | Qué falta / qué mejorar |
|---|---|
| Horas reales trabajadas por día | `progress_minutes` se acumula manualmente; depende de que el colaborador lo registre. Conviene **reforzar/validar la captura de tiempo**. |
| Eficiencia (estimado vs real) | Falta **estimación de tiempo en tareas internas** (ver arriba). |
| Reprocesos por persona | Se puede derivar del flag `correction`, pero conviene **atribuir el reproceso** a quién causó el rechazo. |
| Capacidad / ocupación | Falta una noción de **horas disponibles** por persona (jornada) para calcular % de ocupación. |

### Para FACTURACIÓN y PAGOS (ver roadmap Siigo)

- **Clientes:** no guardamos NIT, tipo de documento ni datos fiscales en la base local
  (viven solo en Siigo).
- **Colaboradores:** no guardamos cédula/NIT, tipo de documento ni **datos bancarios**.
- **No hay registro de pagos efectuados** ni de facturas emitidas localmente.

---

## 6. Recomendación de evolución (qué sigue y en qué orden)

El orden es claro y responde a lo que dirección necesita ver primero:
**PRIMERO métricas y rentabilidad, DESPUÉS el área financiera.**

> Ver el documento maestro `ROADMAP-GENERAL.md` para la vista de los tres bloques.

### PRIORIDAD 1 — Métricas, Rentabilidad y Productividad (va PRIMERO)

Esto es lo que dirección quiere: saber **cuándo un proyecto es rentable, cuándo está
al límite de dejar de serlo, cuánto cuesta en tiempo y dinero, y qué tan productivo
es cada miembro del equipo.**

**Paso 1 — Cerrar el gap de datos (base para todo):**
1. **Campo de valor de venta / presupuesto del proyecto** + moneda formal.
   Sin esto no hay rentabilidad. Es el dato más importante que falta.
2. **Tarifa/hora derivada del salario** (salario mensual ÷ horas estándar del mes)
   para poder costear el tiempo interno.
3. **Estimación de tiempo en tareas internas** (no solo externas).
4. **Horas disponibles / jornada** por persona (para % de ocupación).
5. Reforzar la **captura de minutos trabajados** (recordatorios / validación).

**Paso 2 — Motor de rentabilidad:**
- Costo interno = Σ (minutos × tarifa/hora). Costo externo = Σ (cotizaciones + `completion_cost`).
- Margen = valor de venta − costo total. Tiempo de ejecución = ciclo real.

**Paso 3 — Página de Métricas (el dashboard que dirección quiere ver):**
Hoy el dashboard es un placeholder. Construir vistas con:
- **Rentabilidad por proyecto con semáforo:** 🟢 rentable · 🟡 al límite · 🔴 en pérdida.
- **Costo del proyecto** en tiempo (horas) y dinero (interno vs externo).
- **Productividad por colaborador:** tareas/periodo, horas, eficiencia, reprocesos, ocupación.
- **Salud operativa:** proyectos atrasados, tareas bloqueadas, cuellos de botella.
- **Costo por proveedor externo** y comparativa de cotizaciones.
- Filtros por periodo, marca, cliente, área. **Vista adaptada por rol.**

> Nota: el "Centro de Mando de Tareas" ya existente es la base perfecta para
> empezar — ya tiene filtros por creador, área, asignado, estado y fechas.

### PRIORIDAD 2 — Área Financiera (va DESPUÉS de las métricas)

Solo cuando las métricas estén dando valor se pasa a internalizar el trabajo del rol
financiero (compras, ventas, cartera, contabilidad, nómina), dejando en Siigo únicamente
el timbrado ante la DIAN. **Se apoya en los datos ya creados en la Prioridad 1**
(valor de venta, costos), evitando trabajo duplicado.

- Datos fiscales de clientes y colaboradores.
- Facturación desde la app usando solo el módulo de facturas de Siigo.
- Pagos/cuentas por pagar a colaboradores de forma legal en Colombia.
- **Detalle completo en `ROADMAP-SIIGO.md`.**

### PRIORIDAD 3 — Independencia total de la DIAN (largo plazo, opcional)

Habilitar nuestro propio software ante la DIAN y cancelar Siigo por completo.
Es un proyecto en sí mismo (meses + asesoría legal). Solo si el volumen lo justifica.
**Detalle en `ROADMAP-SIIGO.md` (sección final).**

---

## 7. Conclusión para dirección

Made in Casa Pro **ya cumplió su primer objetivo**: eliminó al coordinador-Excel
y automatizó el flujo de trabajo de punta a punta, con trazabilidad completa.

El siguiente salto de valor **no es operativo, es de inteligencia de negocio**:
con dos o tres campos adicionales (sobre todo **valor de venta** y **tarifa/hora**),
la plataforma puede pasar de "organizar el trabajo" a **"decirnos cuándo un proyecto
es rentable, cuándo está al límite de dejar de serlo, cuánto cuesta en tiempo y dinero,
y qué tan productivo es cada miembro del equipo"**. Ese es el **primer bloque** y la
prioridad número uno.

**Solo después** viene el área financiera: hay una oportunidad clara de **ahorro en
licencias** —hoy Siigo se usa casi solo como directorio de clientes—, migrando todo lo
demás a Made in Casa Pro y dejando únicamente el módulo de facturas de Siigo, manteniendo
el cumplimiento fiscal (ver `ROADMAP-SIIGO.md`).

> **Un cambio, doble beneficio:** el campo *valor de venta del proyecto* es a la vez la
> base de las métricas de rentabilidad (Prioridad 1) y de la facturación (Prioridad 2).
> Por eso es lo primero de todo el roadmap.
