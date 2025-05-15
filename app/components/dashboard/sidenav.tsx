import Link from "next/link";
import NavLinks from "@/components/dashboard/nav-links";
import MICLogo from "../icons/MICLogo";
import { Icons } from "@/components/icons";
import { logout } from "@/lib/actions/auth";

export default function SideNav() {
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
          <button
            className="flex h-[48px] w-full grow items-center justify-center gap-2 rounded-md bg-light-bg-2 dark:bg-dark-bg-2 p-3 text-base hover:bg-red-700 hover:text-dark-subtitle md:flex-none md:justify-between md:p-2 md:px-3 cursor-pointer"
            type="submit"
          >
            <div className="hidden md:block">Sign Out</div>
            <Icons.power strokeWidth={1.2} />
          </button>
        </form>
      </div>
    </aside>
  );
}
