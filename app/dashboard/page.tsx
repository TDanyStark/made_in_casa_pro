import { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function Page() {
  return (
    <main>
      <h1 className="primaryH1">
        Dashboard
      </h1>
    </main>
  );
}