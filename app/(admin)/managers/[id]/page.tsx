import { getManagerById } from "@/lib/queries/managers";

type Props = {
  params: Promise<{ id: string }>
};

export default async function ManagerPage({ params }: Props) {
  const { id } = await params;
  // obtener la  información del gerente usando el id getManagerById
  const manager = await getManagerById(id);

  return (
    <section>
      <h1 className="primaryH1">Gerente</h1>
      <div className="mt-6">
        <p className="text-lg">Aquí puedes ver los detalles del gerente.</p>
        <p className="text-lg">ID: {id}</p>
        <p className="text-lg">Detalles: {JSON.stringify(manager)}</p>
      </div>
    </section>
  );
}
