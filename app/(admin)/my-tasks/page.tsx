import { MyTasksClient } from "@/components/tasks/MyTasksClient";

export default function MyTasksPage() {
  return (
    <section className="container pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mis Tareas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tareas asignadas a ti que están activas, pendientes o en espera.
        </p>
      </div>
      <MyTasksClient />
    </section>
  );
}
