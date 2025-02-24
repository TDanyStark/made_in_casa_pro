import CreateClientModal from "@/components/clients/CreateClientModal";
import ListClients from "@/components/clients/ListClients";

export default async function Page() {
  return (
    <section>
      <h1 className="primaryH1">Clientes</h1>
      <div className="mt-6">
        <CreateClientModal />
        <ListClients 
          query=""
          currentPage={1}
        />
      </div>
    </section>
  );
}
