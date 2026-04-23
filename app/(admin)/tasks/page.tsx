import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { TasksCommandCenterClient } from "@/components/tasks/TasksCommandCenterClient";
import { getUserRole } from "@/lib/session";

export default async function Page() {
  const userRole = await getUserRole();
  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[{ href: "/tasks", label: "Centro de mando de tareas" }]}
      />
      <h1 className="primaryH1">Centro de mando de tareas</h1>
      <div className="mt-6">
        <TasksCommandCenterClient userRole={userRole} />
      </div>
    </section>
  );
}
