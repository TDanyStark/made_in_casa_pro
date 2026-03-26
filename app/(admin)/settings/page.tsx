import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default function SettingsPage() {
  return (
    <section className="container max-w-2xl">
      <Breadcrumbs customLabels={{ "/settings": "Configuración" }} />
      <h1 className="primaryH1 mb-8">Configuración</h1>
      <SettingsClient />
    </section>
  );
}
