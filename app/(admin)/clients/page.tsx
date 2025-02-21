import CreateClientModal from "@/components/clients/CreateClientModal";

export default async function Page() {
  return (
    <section>
      <h1 className="primaryH1">Clientes</h1>
      <div className="mt-6">
        <CreateClientModal />
      </div>
    </section>
  );
}
