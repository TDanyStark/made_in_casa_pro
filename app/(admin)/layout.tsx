import { RoleProvider } from "@/components/context/RoleContext";
import SideNav from "@/components/dashboard/sidenav";
import { ModeToggle } from "@/components/ModeToggle";
import { getUserRole } from "@/lib/session";
import { getCurrentSession } from "@/lib/services/api-session";
import { getUserConnectedEmailStatus } from "@/lib/queries/userEmailConnections";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = (await headers()).get("x-current-path") ?? "";
  const canConfigureEmail = path.startsWith("/settings");
  const session = await getCurrentSession();
  if (session?.id && !canConfigureEmail) {
    const hasConnectedGmail = await getUserConnectedEmailStatus(session.id);
    if (!hasConnectedGmail) {
      redirect("/connect-email");
    }
  }

  const role = await getUserRole();

  return (
      <RoleProvider role={role}>
        <main className="relative flex min-h-screen flex-col md:h-screen md:max-h-screen md:flex-row md:overflow-hidden">
          <div className="absolute right-4 top-4 md:right-8 md:top-8 z-10">
            <ModeToggle />
          </div>
          <div className="w-full flex-none md:h-screen md:w-64">
            <SideNav />
          </div>
          <div className="flex-grow overflow-y-auto p-6 md:p-16">
            {children}
          </div>
        </main>
      </RoleProvider>
  );
}
