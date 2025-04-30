"use client";

  import Link from "next/link";
import { usePathname } from "next/navigation";
import { links } from "@/lib/LinksData";
import { useRole } from "../context/RoleContext";
import { cn } from "@/lib/utils";

export default function NavLinks() {
  const pathname = usePathname();
  const role = useRole();

  return (
    <>
      {links
        .filter((link) => link.roles.includes(role)) // Filtrar enlaces según el rol
        .map((link) => {
          const LinkIcon = link.icon;

          return (
            <Link
              key={link.name}
              href={link.route}
              className={cn(
                "flex h-[48px] grow items-center justify-center gap-4 rounded-md bg-light-bg-2 dark:bg-dark-bg-2 p-3 text-base font-normal hover:bg-market-purple hover:text-white dark:hover:bg-secondary dark:hover:text-dark-subtitle md:flex-none md:justify-start md:p-2 md:px-3",
                {
                  "bg-market-pink text-white hover:bg-market-pink dark:hover:bg-market-pink":
                    pathname === link.route
                }
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
