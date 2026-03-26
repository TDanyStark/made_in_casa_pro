import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CreateProjectWizard } from "@/components/projects/CreateProjectWizard";

export default function CreateProjectPage() {
  return (
    <section className="container pb-12">
      <Breadcrumbs
        manualBreadcrumbs={[
          { href: "/projects", label: "Proyectos" },
          { href: "/projects/create", label: "Nuevo proyecto" },
        ]}
      />
      <h1 className="primaryH1 mb-8">Crear nuevo proyecto</h1>
      <CreateProjectWizard />
    </section>
  );
}
