"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { links, navSubLinks } from "@/lib/LinksData";
import { useRole } from "../context/RoleContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function NavLinks() {
  const pathname = usePathname();
  const role = useRole();
  const clientsSubLinks = navSubLinks.Clientes ?? [];
  const isClientsGroupActive = ["/clients", ...clientsSubLinks.map((item) => item.route)].some((route) =>
    pathname.startsWith(route),
  );

  return (
    <>
      {links
        .filter((link) => link.roles.includes(role)) // Filtrar enlaces según el rol
        .map((link) => {
          const LinkIcon = link.icon as React.FC<React.SVGProps<SVGSVGElement>>;

          if (link.name === "Clientes") {
            return (
              <div key={link.name} className="flex h-[48px] w-full grow md:flex-none">
                <Link
                  href={link.route}
                  className={cn(
                    "flex h-full min-w-0 flex-1 items-center justify-center gap-4 rounded-l-md bg-muted p-3 text-base font-normal hover:bg-market-purple hover:text-white dark:hover:bg-secondary dark:hover:text-dark-subtitle md:justify-start md:p-2 md:px-3",
                    {
                      "bg-market-pink text-white hover:bg-market-pink dark:hover:bg-market-pink":
                        isClientsGroupActive,
                    },
                  )}
                >
                  <LinkIcon strokeWidth={1.2} />
                  <p className="hidden md:block">{link.name}</p>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Abrir menú de clientes"
                      className={cn(
                        "flex h-full items-center justify-center rounded-r-md bg-muted px-2 hover:bg-market-purple hover:text-white dark:hover:bg-secondary dark:hover:text-dark-subtitle",
                        {
                          "bg-market-pink/70 text-white hover:bg-market-pink/80 dark:hover:bg-market-pink/80":
                            isClientsGroupActive,
                        },
                      )}
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {clientsSubLinks.map((item) => (
                      <DropdownMenuItem asChild key={item.route}>
                        <Link
                          href={item.route}
                          className={cn("w-full", {
                            "font-semibold bg-market-pink": pathname.startsWith(item.route),
                          })}
                        >
                          {item.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }

          return (
            <Link
              key={link.name}
              href={link.route}
              className={cn(
                "flex h-[48px] grow items-center justify-center gap-4 rounded-md bg-muted p-3 text-base font-normal hover:bg-market-purple hover:text-white dark:hover:bg-secondary dark:hover:text-dark-subtitle md:flex-none md:justify-start md:p-2 md:px-3",
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
