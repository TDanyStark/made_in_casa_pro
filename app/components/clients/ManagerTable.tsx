import ManagerTableClient from "./ListManagersClient";

interface ManagerTableProps {
  clientId?: string;
  page?: string;
  search?: string;
}

export default function ManagerTable({
  clientId,
}: ManagerTableProps) {
  return <ManagerTableClient clientId={clientId} />;
}
