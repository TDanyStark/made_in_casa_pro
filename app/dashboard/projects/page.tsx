import { Metadata } from "next";
import { lusitana } from "@/app/ui/fonts";

export const metadata: Metadata = {
  title: "Proyectos",
};
export default async function Page() {
  return (
    <section className="w-full">
      <div className="flex w-full items-center justify-between">
        <h1 className={`${lusitana.className} titleh1`}>Proyectos</h1>
      </div>
    </section>
  );
}
