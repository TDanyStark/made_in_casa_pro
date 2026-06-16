import Link from "next/link";
import NavLinks from "@/components/dashboard/nav-links";
import MICLogo from "../icons/MICLogo";
import { logout } from "@/lib/actions/auth";
import { SubmitButtonSignOut } from "./SubmitButtonSignOut";
import { getCurrentSession } from "@/lib/services/api-session";
import { getUserEmailConnection } from "@/lib/queries/userEmailConnections";
import { MailWarning } from "lucide-react";

export default async function SideNav() {
  const session = await getCurrentSession();
  const connection = session?.id ? await getUserEmailConnection(session.id) : null;
  const gmailInvalid = connection?.status === "invalid";

  return (
    <aside className="flex h-full flex-col px-3 py-4 md:px-2 bg-primary-foreground">
      <Link
        className="mb-2 flex items-end justify-center rounded-md bg-mic-gradient p-4"
        href="/dashboard"
      >
        <MICLogo onlyIcon={true} colorWhite={true} />
      </Link>
      <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2 max-w-full overflow-auto pb-4 md:pb-0">
        <NavLinks />
        <div className="hidden h-auto w-full grow rounded-md bg-muted md:block"></div>
        {gmailInvalid && (
          <Link
            href="/connect-email?reconnect=true"
            className="hidden md:flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/20 transition-colors"
          >
            <MailWarning className="h-4 w-4 shrink-0" />
            <span>Reconectar Gmail</span>
          </Link>
        )}
        <form action={logout}>
          <SubmitButtonSignOut />
        </form>
      </div>
    </aside>
  );
}
