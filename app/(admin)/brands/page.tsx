import ListBrandsClient from "@/components/clients/ListBrandsClient";


export default function Page() {
  
  return (
    <section className="container py-8">
      <h1 className="primaryH1">Todos las marcas</h1>
      
      <div className="mt-6">
        <ListBrandsClient />
      </div>
      
    </section>
  );
}