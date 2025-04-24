import ListManagersClient from "@/components/clients/ListManagersClient";


export default function ManagersPage() {
  
  return (
    <section className="container py-8">
      <h1 className="primaryH1">Todos los Gerentes</h1>
      
      <div className="mt-6">
        <ListManagersClient />
      </div>
      
    </section>
  );
}