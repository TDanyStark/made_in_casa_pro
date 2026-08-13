# Roadmap General — Made in Casa Pro

> Documento maestro. Define el **orden de prioridades** de la evolución de la plataforma.
> Detalle de cada bloque en los documentos enlazados.

---

## Orden de prioridades (decisión de dirección)

```
   BLOQUE A ─────────────►  BLOQUE B ─────────────►  BLOQUE C
   MÉTRICAS & RENTABILIDAD   ÁREA FINANCIERA          INDEPENDENCIA DIAN
   (lo primero)              (traer Siigo a casa)     (largo plazo, opcional)
```

**Regla:** primero medir (rentabilidad, productividad, costo, tiempo), **luego**
internalizar finanzas, y al final —si el volumen lo justifica— la habilitación DIAN propia.

**Por qué este orden:**
- Es lo que dirección necesita ver **ya**: cuándo un proyecto es rentable, cuándo está
  al límite de dejar de serlo, cuánto cuesta en tiempo y dinero, y qué tan productivo es
  cada miembro del equipo.
- Los mismos datos que habilitan las métricas (valor de venta, tarifa/hora, tiempos) son
  la **base** sobre la que después se construye la facturación. Se hace una vez y sirve a los dos.
- El área financiera es más compleja y toca a la DIAN → conviene ir después, ya con datos maduros.

---

## BLOQUE A — Métricas, Rentabilidad y Productividad  ⭐ PRIORIDAD 1

> Objetivo: que dirección vea, en un tablero, **rentabilidad por proyecto, costo real,
> tiempo de ejecución y productividad por persona** — con semáforos de alerta.

### A0 · Cerrar el gap de datos (habilita todo lo demás)
Sin estos campos no hay rentabilidad ni costo real. Es rápido y es la base.
- [ ] **Valor de venta / presupuesto del proyecto** + `currency`. *(El dato más importante que falta hoy.)*
- [ ] **Tarifa/hora del colaborador**: derivada de `monthly_salary` ÷ horas estándar del mes.
- [ ] **Estimación de tiempo en tareas internas** (hoy solo las externas la traen vía cotización).
- [ ] **Horas disponibles / jornada** por persona (para calcular % de ocupación).
- [ ] Reforzar la captura de **minutos trabajados** (`progress_minutes`) — recordatorios/validación.

### A1 · Motor de cálculo de rentabilidad y costo
La lógica que convierte los datos sueltos en KPIs.
- [ ] **Costo interno** por proyecto = Σ (minutos por tarea × tarifa/hora del asignado).
- [ ] **Costo externo** por proyecto = Σ (cotizaciones aceptadas + `completion_cost`).
- [ ] **Costo total real** = interno + externo.
- [ ] **Margen / rentabilidad** = valor de venta − costo total real.
- [ ] **Tiempo de ejecución** = ciclo real (creación → completado) y por etapa.

### A2 · Página de Métricas (el tablero que dirección quiere)
Hoy el dashboard es un placeholder. Aquí vive el valor visible.
- [ ] **Rentabilidad por proyecto** con **semáforo**:
      🟢 rentable · 🟡 al límite (margen bajo un umbral) · 🔴 en pérdida.
- [ ] **Costo del proyecto** desglosado: en tiempo (horas) y en dinero (interno vs externo).
- [ ] **Productividad por colaborador**: tareas/periodo, horas trabajadas, eficiencia
      (estimado vs real), reprocesos, % de ocupación.
- [ ] **Salud operativa**: proyectos atrasados (vs `ideal_delivery_at`), tareas bloqueadas,
      cuellos de botella.
- [ ] **Desempeño de proveedores externos**: precio, tiempos, tasa de aceptación.
- [ ] Filtros por periodo, marca, cliente, área. Vista adaptada por rol.

### A3 · Métricas por rol (lo que ya podemos mostrar hoy)
Antes de tener todo A0–A2, ya hay métricas mostrables con los datos actuales:
| Rol | Qué ve |
|---|---|
| **Directivo / Financiero** | Salud global de proyectos, avance promedio, atrasos, costos directos |
| **Comercial** | Sus proyectos, avance, tareas bloqueadas, cotizaciones pendientes |
| **Colaborador** | Sus tareas, tiempos, carga de trabajo |
| **Admin** | Todo lo anterior + operación de notificaciones |

**Detalle completo:** ver `ANALISIS-EJECUTIVO.md` (secciones 4 y 5).

---

## BLOQUE B — Área Financiera (internalizar Siigo)  · PRIORIDAD 2

> Objetivo: traer el trabajo del rol financiero a la app y dejar en Siigo **solo el
> timbrado ante la DIAN**. Se apoya en los datos ya creados en el Bloque A (valor de
> venta, costos), evitando trabajo duplicado.

Fases (de menor a mayor complejidad):
0. Datos fiscales de clientes y colaboradores.
1. Cotización a cliente → orden de compra.
2. Compras: facturas, pagos y anticipos (con cruce).
3. Ventas: cartera, pagos y retenciones recibidas.
4. Contabilidad ligera (gastos bancarios, ajustes).
5. Timbrar factura de venta (vía Siigo).
6. Timbrar cuentas de cobro / documento soporte (vía Siigo).
7. Nómina electrónica (vía Siigo).

**Detalle completo:** ver `ROADMAP-SIIGO.md`.

---

## BLOQUE C — Independencia total de la DIAN  · PRIORIDAD 3 (largo plazo, opcional)

> Objetivo: habilitar nuestro propio software ante la DIAN y **cancelar Siigo por completo**.
> Es un proyecto en sí mismo (meses + asesoría legal). Solo si el volumen lo justifica.

Etapas: diagnóstico legal → requisitos técnicos (firma digital, XML UBL 2.1, CUFE, QR) →
set de pruebas DIAN → producción → corte final.

**Detalle completo:** ver `ROADMAP-SIIGO.md` (sección final).

---

## Dependencia clave entre bloques

```
  A0 (valor de venta + tarifa/hora)
        │
        ├──► A1/A2  Métricas y rentabilidad        (beneficio inmediato)
        │
        └──► B5  Facturación                        (reusa el mismo dato)
```

> **Un cambio, doble beneficio:** el campo *valor de venta del proyecto* desbloquea
> tanto el tablero de rentabilidad (Bloque A) como la facturación (Bloque B).
> Por eso es lo primero de todo el roadmap.

---

## Resumen en una tabla

| Prioridad | Bloque | Qué entrega | Complejidad | Documento |
|---|---|---|---|---|
| **1** | A — Métricas & Rentabilidad | Tablero: rentabilidad, costo, tiempo, productividad | Baja-media | `ANALISIS-EJECUTIVO.md` |
| **2** | B — Área Financiera | Internalizar Siigo, dejar solo timbrado DIAN | Media-alta | `ROADMAP-SIIGO.md` |
| **3** | C — Independencia DIAN | Cancelar Siigo por completo | Muy alta | `ROADMAP-SIIGO.md` |
