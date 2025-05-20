import Link from "next/link";
import NavLinks from "@/components/dashboard/nav-links";
import MICLogo from "../icons/MICLogo";
import { logout } from "@/lib/actions/auth";
import { useFormStatus } from "react-dom";
import { SubmitButton } from "./SubmitButton";

export default function SideNav() {
  const { pending } = useFormStatus();
  console.log("pending", pending);
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
        <div className="hidden h-auto w-full grow rounded-md bg-light-bg-2 dark:bg-dark-bg-2 md:block"></div>
        <form action={logout}>
          <SubmitButton />
        </form>
      </div>
    </aside>
  );
}
