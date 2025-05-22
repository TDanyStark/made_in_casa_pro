/**
 * Este es un ejemplo para demostrar cómo los datos almacenados en memoria
 * persisten entre diferentes peticiones en Next.js
 * 
 * IMPORTANTE: Este enfoque es solo para demostración y no es recomendado para producción
 * ya que los datos se perderán cuando se reinicie el servidor o si hay múltiples instancias.
 */

// Interfaz para las tareas
interface Task {
  id: string;
  title: string;
  createdAt: Date;
}

// Almacén de tareas en memoria - persistirá entre peticiones mientras el servidor esté en ejecución
const tasksStore: Task[] = [];

/**
 * POST /api/tasks
 * Crea una nueva tarea y la almacena en memoria
 */
export async function POST(request: Request) {
  try {
    // Parsear el cuerpo de la petición
    const body = await request.json();
    
    // Validar que tenga los campos requeridos
    if (!body.title) {
      return Response.json(
        { error: "Se requieren los campos title y description" },
        { status: 400 }
      );
    }
    
    // Crear una nueva tarea con ID único
    const newTask: Task = {
      id: crypto.randomUUID(), // Genera un ID único
      title: body.title,
      createdAt: new Date()
    };
    
    // Añadir la tarea al almacén en memoria
    tasksStore.push(newTask);
    
    // Devolver la tarea creada
    return Response.json(
      { 
        message: "Tarea creada correctamente",
        task: newTask,
        totalTasks: tasksStore.length
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al crear tarea:", error);
    return Response.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks
 * Recupera todas las tareas almacenadas en memoria
 */
export async function GET() {
  try {
    return Response.json({
      tasks: tasksStore,
      count: tasksStore.length,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error al obtener tareas:", error);
    return Response.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks
 * Elimina todas las tareas (útil para reiniciar el estado)
 */
export async function DELETE() {
  try {
    const previousCount = tasksStore.length;
    tasksStore.length = 0; // Vaciar el array
    
    return Response.json({
      message: `Se han eliminado ${previousCount} tareas`,
      tasksRemaining: tasksStore.length
    });
  } catch (error) {
    console.error("Error al eliminar tareas:", error);
    return Response.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
