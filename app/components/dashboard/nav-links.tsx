import clsx from "clsx";
import Link from "next/link";
import { links } from "@/lib/LinksData";
import { getUserRole } from "@/lib/session";

export default async function NavLinks() {
  // Obtener la cookie "session"
    const role = await getUserRole();

  return (
    <>
      {links
        .filter((link) => link.roles.includes(role)) // Filtrar por rol
        .map((link) => {
          const LinkIcon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={clsx(
                "flex h-[48px] grow items-center justify-center gap-4 rounded-md bg-light-bg-2 dark:bg-dark-bg-2 p-3 text-base font-normal hover:bg-market-purple hover:text-white dark:hover:bg-secondary dark:hover:text-dark-subtitle md:flex-none md:justify-start md:p-2 md:px-3"
              )}
            >
              <LinkIcon strokeWidth={1.2} />
              <p className="hidden md:block">{link.name}</p>
            </Link>
          );
        })}
    </>
  );
}
