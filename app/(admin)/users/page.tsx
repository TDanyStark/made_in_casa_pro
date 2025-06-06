import ListUsers from "@/components/users/ListUsers";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";

export default function Page() {
  
  return (
    <section className="container">
      <Breadcrumbs customLabels={{ "/users": "Usuarios" }} />
      <h1 className="primaryH1">Todos los usuarios</h1>
      <div className="mt-6">
        <ListUsers />
      </div>
      
    </section>
  );
}
