import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { TrafficClient } from "@/components/traffic/TrafficClient";
import { getUserRole } from "@/lib/session";

export default async function TrafficPage() {
  const role = await getUserRole();

  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[{ href: "/traffic", label: "Tráfico" }]}
      />
      <h1 className="primaryH1">Tráfico</h1>
      <div className="mt-6">
        <TrafficClient />
      </div>
    </section>
  );
}
