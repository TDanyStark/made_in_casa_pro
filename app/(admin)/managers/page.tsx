import ManagerTable from "@/components/clients/ManagerTable";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface ManagersPageProps {
  searchParams: {
    page?: string;
    search?: string;
  };
}

export default function ManagersPage({ searchParams }: ManagersPageProps) {
  const { page, search } = searchParams;
  
  return (
    <div className="container py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Todos los Gerentes</CardTitle>
        </CardHeader>
      </Card>
      
      <ManagerTable 
        page={page}
        search={search}
      />
    </div>
  );
}