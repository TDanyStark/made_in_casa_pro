import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { TasksCommandCenterClient } from "@/components/tasks/TasksCommandCenterClient";

export default async function Page() {
  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[{ href: "/tasks", label: "Centro de mando de tareas" }]}
      />
      <h1 className="primaryH1">Centro de mando de tareas</h1>
      <div className="mt-6">
        <TasksCommandCenterClient />
      </div>
    </section>
  );
}
