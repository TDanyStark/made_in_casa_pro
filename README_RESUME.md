# README RESUME - Made in Casa Pro

## 📋 ¿Qué es Made in Casa Pro?

**Made in Casa Pro** es una aplicación empresarial SaaS de gestión integral desarrollada con Next.js 15, que permite administrar clientes, gerentes, marcas, usuarios y proyectos con un sistema completo de roles y permisos.

---

## 🛠️ Tecnologías Principales

- **Frontend**: Next.js 15.3.2, React 19, TypeScript, TailwindCSS 4
- **Backend**: Next.js API Routes
- **Base de Datos**: Turso (SQLite serverless)
- **Autenticación**: JWT con encriptación (jose) + bcrypt
- **Validación**: Zod + React Hook Form
- **UI Components**: Radix UI + Framer Motion
- **Query Client**: TanStack React Query
- **Editor de Texto**: TipTap

---

## 🎯 Alcance Actual - Funcionalidades Disponibles

### 1️⃣ Gestión de PAÍSES (Countries)

**¿Qué se puede hacer?**
- ✅ Crear países con nombre y bandera (emoji)
- ✅ Listar todos los países disponibles
- ✅ Usar países en la creación de clientes

**Permisos:**
- Crear: Solo ADMIN
- Listar: Todos los usuarios autenticados

---

### 2️⃣ Gestión de CLIENTES (Clients)

**¿Qué se puede hacer?**
- ✅ Crear nuevos clientes con:
  - Nombre del cliente
  - País asociado
  - Opción de aceptar unidades de negocio
- ✅ Listar todos los clientes con paginación y búsqueda
- ✅ Ver detalles de cada cliente (managers y marcas asociados)
- ✅ Editar información del cliente (nombre, país, configuración de unidades de negocio)
- ✅ Buscar clientes por nombre

**Permisos:**
- Crear/Editar: ADMIN, COMERCIAL, DIRECTIVO
- Listar/Ver: Todos los usuarios autenticados

**Endpoint API:**
- `GET /api/clients` - Listar con paginación
- `POST /api/clients` - Crear cliente
- `PATCH /api/clients/[id]` - Actualizar cliente

---

### 3️⃣ Gestión de GERENTES/MANAGERS (Managers)

**¿Qué se puede hacer?**
- ✅ Crear gerentes/managers asociados a clientes con:
  - Nombre completo
  - Email de contacto
  - Teléfono
  - Biografía (editor de texto enriquecido)
  - Cliente asociado
- ✅ Listar todos los gerentes con paginación
- ✅ Filtrar gerentes por cliente específico
- ✅ Ver detalles completos del gerente
- ✅ Editar información del gerente (email, teléfono, nombre, biografía)

**Permisos:**
- Crear: ADMIN, COMERCIAL, DIRECTIVO
- Listar/Ver: Todos los usuarios autenticados

**Endpoint API:**
- `GET /api/managers` - Listar (con filtro por cliente)
- `POST /api/managers` - Crear manager
- `PATCH /api/managers/[id]` - Actualizar manager

---

### 4️⃣ Gestión de MARCAS (Brands)

**¿Qué se puede hacer?**
- ✅ Crear marcas asociadas a managers con:
  - Nombre de la marca
  - Manager responsable
  - Unidad de negocio (opcional)
- ✅ Listar todas las marcas con filtros por:
  - Manager
  - Cliente
  - Búsqueda por nombre
- ✅ Ver detalles de cada marca
- ✅ Cambiar el manager de una marca (se registra en historial)
- ✅ Ver historial completo de cambios de manager
- ✅ Actualizar información de la marca

**Características Especiales:**
- 📊 **Historial de Auditoría**: Cada cambio de manager queda registrado con fecha y hora
- 🔄 **Trazabilidad**: Se puede ver quién era el manager anterior y quién es el nuevo

**Permisos:**
- Crear/Editar: ADMIN, COMERCIAL, DIRECTIVO
- Listar/Ver: Todos los usuarios autenticados

**Endpoint API:**
- `GET /api/brands` - Listar con filtros múltiples
- `POST /api/brands` - Crear marca
- `PATCH /api/brands/[id]` - Actualizar marca
- `GET /api/brands/history?brandId=X` - Ver historial de cambios

---

### 5️⃣ Gestión de USUARIOS (Users)

**¿Qué se puede hacer?**
- ✅ Crear nuevos usuarios del sistema con:
  - Nombre completo
  - Email (único)
  - Contraseña (hasheada con bcrypt)
  - Rol asignado (COMERCIAL, DIRECTIVO, COLABORADOR, ADMIN)
  - Área de trabajo
  - Salario mensual
  - Estado activo/inactivo
  - Indicador de empleado interno
- ✅ Listar todos los usuarios con paginación
- ✅ Ver detalles completos del usuario
- ✅ Editar información del usuario (nombre, email, rol, área, salario)
- ✅ Cambiar estado activo/inactivo
- ✅ Forzar cambio de contraseña en próximo login

**Permisos:**
- Todas las operaciones: Solo ADMIN

**Endpoint API:**
- `GET /api/users` - Listar con paginación
- `POST /api/users` - Crear usuario
- `GET /api/users/[id]` - Obtener usuario específico
- `PATCH /api/users/[id]` - Actualizar usuario

---

### 6️⃣ Gestión de HABILIDADES (Skills)

**¿Qué se puede hacer?**
- ✅ Crear nuevas habilidades/competencias
- ✅ Listar todas las habilidades disponibles
- ✅ Asignar múltiples habilidades a usuarios
- ✅ Ver habilidades asignadas a cada usuario
- ✅ Remover habilidades de usuarios
- ✅ Indicador visual de habilidades ya asignadas

**Permisos:**
- Crear habilidades: ADMIN, DIRECTIVO
- Asignar/Remover: ADMIN, DIRECTIVO, COLABORADOR (a sí mismo)
- Listar: Todos los usuarios autenticados

**Endpoint API:**
- `GET /api/skills` - Listar habilidades
- `POST /api/skills` - Crear habilidad
- `GET /api/users/[id]/skills` - Ver habilidades del usuario
- `POST /api/users/[id]/skills` - Asignar habilidad a usuario
- `DELETE /api/users/[id]/skills?skill_id=X` - Remover habilidad

---

### 7️⃣ Gestión de ÁREAS (Areas)

**¿Qué se puede hacer?**
- ✅ Crear áreas de trabajo
- ✅ Listar todas las áreas
- ✅ Actualizar información de áreas
- ✅ Asignar usuarios a áreas específicas

**Endpoint API:**
- `GET /api/areas` - Listar áreas
- `POST /api/areas` - Crear área
- `PATCH /api/areas/[id]` - Actualizar área

---

### 8️⃣ Gestión de UNIDADES DE NEGOCIO (Business Units)

**¿Qué se puede hacer?**
- ✅ Crear unidades de negocio
- ✅ Listar todas las unidades
- ✅ Actualizar información de unidades
- ✅ Eliminar unidades de negocio
- ✅ Asociar marcas a unidades de negocio

**Endpoint API:**
- `GET /api/business_units` - Listar unidades
- `POST /api/business_units` - Crear unidad
- `PATCH /api/business_units/[id]` - Actualizar unidad
- `DELETE /api/business_units/[id]` - Eliminar unidad

---

### 9️⃣ Sistema de ROLES y PERMISOS

**Roles Disponibles:**

| Rol | ID | Permisos Generales |
|-----|----|--------------------|
| **ADMIN** | 4 | Acceso completo a todas las funcionalidades, gestión de usuarios |
| **DIRECTIVO** | 2 | Gestión de clientes, managers, marcas, habilidades, visualización de datos |
| **COMERCIAL** | 1 | Gestión de clientes, managers, marcas, visualización de datos |
| **COLABORADOR** | 3 | Visualización de datos, gestión de habilidades propias |

**Endpoint API:**
- `GET /api/roles` - Obtener lista de roles disponibles

---

### 🔟 Integraciones Externas

#### Integración con SIIGO
**¿Qué se puede hacer?**
- ✅ Buscar clientes en el sistema SIIGO por:
  - Nombre del cliente
  - Número de identificación
- ✅ Sincronizar datos de clientes desde SIIGO

**Endpoint API:**
- `GET /api/siigo/customers` - Búsqueda de clientes en Siigo

---

## 🔒 Seguridad Implementada

- ✅ **Autenticación JWT** con encriptación usando jose
- ✅ **Hash de contraseñas** con bcrypt (salt rounds: 10)
- ✅ **Cookies HTTP-only** para tokens de sesión
- ✅ **Validación de rol** en cada endpoint API
- ✅ **Middleware de sesión** para rutas protegidas
- ✅ **Prepared statements** para prevenir SQL injection
- ✅ **Validación de datos** con Zod en servidor
- ✅ **Emails únicos** en usuarios

---

## 📊 Características Especiales

### Historial y Auditoría
- 📝 Registro completo de cambios de manager en marcas
- 🕐 Timestamps con ajuste de zona horaria (-5 horas)
- 👥 Trazabilidad de quién hizo qué cambio

### UI/UX Avanzada
- 🌓 Tema claro/oscuro
- 🎨 Componentes accesibles con Radix UI
- ✨ Animaciones suaves con Framer Motion
- 🔔 Notificaciones elegantes con Sonner
- 📝 Editor de texto enriquecido con TipTap
- 🔍 Búsqueda en tiempo real
- 📄 Paginación de resultados
- 🍞 Breadcrumbs para navegación

### Performance
- ⚡ Next.js Turbopack en desarrollo
- 💾 Caching con React Query
- 🔄 Revalidación selectiva de rutas
- 📦 Paginación optimizada (10-25 items por página)

### Validación de Datos
- ✅ Zod schemas para todas las entidades
- ✅ Validación en cliente y servidor
- ✅ Mensajes de error específicos
- ✅ Códigos HTTP apropiados (400, 401, 403, 404, 409, 500)

---

## 📱 Páginas Disponibles

### Rutas Principales (según rol)

| Ruta | Descripción | Roles Permitidos |
|------|-------------|------------------|
| `/dashboard` | Panel principal personalizado por rol | Todos |
| `/clients` | Lista de clientes + creación/edición | ADMIN, COMERCIAL, DIRECTIVO |
| `/clients/[id]` | Detalle de cliente (managers, marcas) | ADMIN, COMERCIAL, DIRECTIVO |
| `/managers` | Lista de gerentes + creación/edición | ADMIN, COMERCIAL, DIRECTIVO |
| `/managers/[id]` | Detalle de gerente | ADMIN, COMERCIAL, DIRECTIVO |
| `/brands` | Lista de marcas + creación/edición | ADMIN, COMERCIAL, DIRECTIVO |
| `/brands/[id]` | Detalle de marca + historial | ADMIN, COMERCIAL, DIRECTIVO |
| `/users` | Gestión de usuarios del sistema | Solo ADMIN |
| `/users/[id]` | Editar usuario (datos, rol, habilidades) | Solo ADMIN |
| `/projects` | Gestión de proyectos | ADMIN, COMERCIAL, DIRECTIVO |
| `/tasks` | Gestión de tareas | ADMIN, COMERCIAL, DIRECTIVO |
| `/products` | Gestión de productos | ADMIN, COMERCIAL, DIRECTIVO |

---

## 🗂️ Estructura de Datos

### Relaciones entre Entidades

```
PAÍSES → CLIENTES → MANAGERS → MARCAS
                                  ↓
                         UNIDADES DE NEGOCIO

ROLES → USUARIOS ↔ HABILIDADES
          ↓
        ÁREAS

MARCAS → HISTORIAL DE CAMBIOS
```

### Campos Principales por Entidad

**Clientes:**
- Nombre
- País (relación)
- Acepta unidades de negocio (boolean)

**Managers:**
- Nombre
- Email
- Teléfono
- Biografía (texto enriquecido)
- Cliente asociado

**Marcas:**
- Nombre
- Manager responsable
- Unidad de negocio
- Historial de cambios de manager

**Usuarios:**
- Nombre
- Email (único)
- Contraseña (hasheada)
- Rol (COMERCIAL, DIRECTIVO, COLABORADOR, ADMIN)
- Área de trabajo
- Salario mensual
- Estado activo/inactivo
- Es empleado interno (boolean)
- Habilidades asignadas (relación muchos a muchos)

---

## 📝 Resumen Ejecutivo

**Made in Casa Pro** actualmente permite:

1. ✅ **Crear y gestionar PAÍSES** con sus banderas
2. ✅ **Crear y gestionar CLIENTES** asociados a países
3. ✅ **Crear y gestionar GERENTES/MANAGERS** para cada cliente
4. ✅ **Crear y gestionar MARCAS** asignadas a managers
5. ✅ **Crear y gestionar USUARIOS** del sistema con roles específicos
6. ✅ **Crear y asignar HABILIDADES** a usuarios
7. ✅ **Crear y gestionar ÁREAS** de trabajo
8. ✅ **Crear y gestionar UNIDADES DE NEGOCIO**
9. ✅ **Ver HISTORIAL completo** de cambios en marcas
10. ✅ **Integración con SIIGO** para búsqueda de clientes

### Sistema Completo de:
- 🔐 Autenticación y autorización por roles
- 📊 Auditoría y trazabilidad de cambios
- 🔍 Búsqueda y filtrado en todas las entidades
- 📄 Paginación de resultados
- ✏️ Edición de texto enriquecido
- 🌍 Soporte multi-país
- 💼 Gestión de recursos humanos (usuarios, habilidades, áreas, salarios)

---

## 🚀 Endpoints API Disponibles (Resumen)

Total de endpoints implementados: **18+ rutas API**

**Usuarios (Users):**
- `GET/POST /api/users`
- `GET/PATCH /api/users/[id]`
- `GET/POST/DELETE /api/users/[id]/skills`

**Clientes (Clients):**
- `GET/POST /api/clients`
- `PATCH /api/clients/[id]`

**Managers:**
- `GET/POST /api/managers`
- `PATCH /api/managers/[id]`

**Marcas (Brands):**
- `GET/POST /api/brands`
- `PATCH /api/brands/[id]`
- `GET /api/brands/history`

**Catálogos:**
- `GET/POST /api/skills`
- `GET/POST /api/countries`
- `GET/POST/PATCH /api/areas`
- `GET/POST/PATCH/DELETE /api/business_units`
- `GET /api/roles`

**Integraciones:**
- `GET /api/siigo/customers`

---

## 📌 Notas Técnicas

- Base de datos: **Turso** (SQLite serverless)
- Autenticación: **JWT encriptado** en cookies HTTP-only
- Validación: **Zod** en todas las entradas
- Paginación: LIMIT/OFFSET con búsqueda LIKE
- Zona horaria: **UTC-5** para timestamps
- Hash de contraseñas: **bcrypt** con 10 salt rounds
- Editor de texto: **TipTap** para biografías y contenido enriquecido

---

**Última actualización:** 2026-02-06
**Versión de Next.js:** 15.3.2
**Versión de React:** 19
