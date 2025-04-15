import { fetchFilteredClientsAction } from "@/lib/actions/clientsActions";
import ListClients from "./ListClients";

// Componente para manejar la búsqueda de clientes
const ListClientsInput = async () => {
  const response = await fetchFilteredClientsAction();
  const clients = JSON.parse(JSON.stringify(response));

  return (
    <ListClients clients={clients} />
  );
};

export default ListClientsInput;