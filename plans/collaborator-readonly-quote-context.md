# Plan de implementación: contexto de cotización para colaboradores

## Objetivo
Permitir que un colaborador cotice con todo el contexto necesario del proyecto al que fue invitado, incluyendo notas del proyecto y el historial de tareas previas, y agregar un campo opcional de notas con rich editor para justificar su cotización.

## Alcance
- El colaborador verá una vista read-only del proyecto específico para el que fue invitado a cotizar.
- Dentro de esa vista podrá revisar el contexto completo del proyecto.
- Las tareas completadas mostrarán el detalle visible mediante el acceso tipo “ojito”.
- La tab de cotización seguirá siendo visible solo para quien crea el proyecto.
- El colaborador no verá la tab de cotización interna.

## Reglas de acceso
- El acceso al contexto solo aplica al proyecto asociado a la invitación de cotización.
- El colaborador podrá ver el proyecto en modo lectura.
- Solo las tareas completadas expondrán su detalle ampliado.
- Las notas del proyecto son de información general, por lo que pueden mostrarse al colaborador.
- La información de cotización interna queda restringida al creador del proyecto.

## Cambios de backend
- Crear o reutilizar un endpoint que entregue el contexto del proyecto para la cotización del colaborador.
- Incluir en la respuesta:
  - datos del proyecto
  - notas del proyecto
  - lista de tareas del proyecto
  - estado de cada tarea
  - detalle ampliado solo para tareas completadas
- Validar que el colaborador solo acceda al proyecto invitado.
- Mantener fuera de la respuesta cualquier dato interno de cotización que no corresponda al colaborador.

## Cambios de frontend
- Agregar una vista read-only del proyecto desde el flujo de cotización.
- Mostrar el contexto del proyecto con una navegación clara entre:
  - notas del proyecto
  - tareas del proyecto
  - detalles de tareas completadas
- Reemplazar el campo de notas de cotización por un rich editor reutilizable.
- El nuevo campo `notas` debe ser opcional.
- Guardar el contenido como rich text/HTML siguiendo el patrón existente del proyecto.

## Permisos
- El colaborador puede ver el proyecto invitado en modo lectura.
- El colaborador no puede ver la tab de cotización interna.
- El creador del proyecto conserva el acceso a la tab de cotización.
- Revisar que los permisos actuales ya estén alineados con esta regla o corregirlos si no lo están.

## UX
- Mostrar el proyecto en una vista clara y solo lectura.
- Resaltar la tarea que se está cotizando.
- Permitir explorar tareas anteriores completadas con su detalle ampliado.
- Mantener el flujo de cotización simple, sin obligar a salir de la pantalla principal.
- Hacer que el campo de notas explique el motivo de la cotización sin ser obligatorio.

## Validaciones
- `notas` debe ser opcional.
- Si el editor está vacío, no debe guardarse contenido basura.
- Validar que el colaborador solo accede al proyecto invitado.
- Validar que las tareas completadas y sus detalles solo se expongan donde corresponde.

## Pruebas
- Probar acceso autorizado al proyecto invitado.
- Probar denegación de acceso a proyectos no asignados.
- Probar que solo las tareas completadas muestran el detalle ampliado.
- Probar envío de cotización con `notas` vacías y con contenido rich text.
- Probar que la tab de cotización interna no aparece para el colaborador.

## Riesgos
- Exponer información de más si el endpoint no limita bien el acceso por invitación.
- Romper vistas existentes si las notas de cotización pasan a rich text sin ajustar renderizados.
- Guardar contenido vacío del editor como si fuera texto real.

## Rollout
- Primero ajustar permisos y acceso al contexto.
- Luego habilitar la vista read-only del proyecto.
- Después incorporar el rich editor en el formulario de cotización.
- Verificar en staging con un colaborador invitado y con un usuario creador del proyecto.

## Preguntas resueltas
- El colaborador sí verá el proyecto completo, pero en modo lectura.
- Solo las tareas completadas tendrán detalle ampliado visible.
- Las notas del proyecto son generales y pueden mostrarse.
- La tab de cotización seguirá siendo exclusiva del creador del proyecto.
