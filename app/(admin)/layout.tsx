import { RoleProvider } from "@/components/context/RoleContext";
import SideNav from "@/components/dashboard/sidenav";
import { ModeToggle } from "@/components/ModeToggle";
import { getUserRole } from "@/lib/session";

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getUserRole();

  return (
      <RoleProvider role={role}>
        <main className="relative flex min-h-screen flex-col md:flex-row md:overflow-hidden">
          <div className="absolute right-4 top-4 md:right-8 md:top-8">
            <ModeToggle />
          </div>
          <div className="w-full flex-none md:w-64">
            <SideNav />
          </div>
          <div className="flex-grow p-6 md:overflow-y-auto md:p-16">
            {children}
          </div>
        </main>
      </RoleProvider>
  );
}
