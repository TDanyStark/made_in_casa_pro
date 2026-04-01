"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { links, navSubLinks } from "@/lib/LinksData";
import { useRole } from "../context/RoleContext";
import { get } from "@/lib/services/apiService";
import { UserRole } from "@/lib/definitions";
import { cn } from "@/lib/utils";

const MY_QUOTES_ROUTE = "/my-quotes";

export default function NavLinks() {
  const pathname = usePathname();
  const role = useRole();
  const [openAccordionRoute, setOpenAccordionRoute] = useState<string | null>(null);

  // Fetch pending quote invitations count — only for COLABORADOR role
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["my-quotes-count"],
    queryFn: async () => {
      const res = await get<{ count: number }>("my-quotes/count");
      if (!res.ok) return { count: 0 };
      return res.data!;
    },
    enabled: role === UserRole.COLABORADOR,
    refetchInterval: 60_000, // refresh every 60s
    staleTime: 30_000,
  });

  const pendingCount = countData?.count ?? 0;

  useEffect(() => {
    const currentGroup = links
      .filter((link) => link.roles.includes(role))
      .find((link) => {
        const subLinks = navSubLinks[link.route] ?? [];
        return subLinks.some((item) => pathname.startsWith(item.route));
      });

    if (currentGroup) {
      setOpenAccordionRoute(currentGroup.route);
    }
  }, [pathname, role]);

  return (
    <>
      {links
        .filter((link) => link.roles.includes(role)) // Filtrar enlaces según el rol
        .map((link) => {
          const LinkIcon = link.icon as React.FC<React.SVGProps<SVGSVGElement>>;
          const subLinks = navSubLinks[link.route] ?? [];
          const hasSubLinks = subLinks.length > 0;
          const isGroupActive = [link.route, ...subLinks.map((item) => item.route)].some((route) =>
            pathname.startsWith(route),
          );
          const showBadge =
            link.route === MY_QUOTES_ROUTE &&
            role === UserRole.COLABORADOR &&
            pendingCount > 0;

          if (hasSubLinks) {
            return (
              <div key={link.name} className="w-full">
                <div
                  className={cn(
                    "flex h-[48px] w-full",
                    {
                      "text-white": isGroupActive,
                    },
                  )}
                >
                  <Link
                    href={link.route}
                    className={cn(
                      "flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center gap-4 rounded-l-md bg-muted p-3 text-base font-normal transition-colors hover:bg-market-purple hover:text-white dark:hover:bg-market-pink/80 dark:hover:text-white md:justify-start md:p-2 md:px-3",
                      {
                        "bg-market-pink text-white hover:bg-market-pink dark:hover:bg-market-pink":
                          isGroupActive,
                      },
                    )}
                  >
                    <LinkIcon strokeWidth={1.2} />
                    <p className="hidden md:block flex-1 text-left">{link.name}</p>
                  </Link>

                  <button
                    type="button"
                    aria-label={`Expandir ${link.name}`}
                    onClick={() =>
                      setOpenAccordionRoute((current) => (current === link.route ? null : link.route))
                    }
                    className={cn(
                      "flex h-full cursor-pointer items-center justify-center rounded-r-md bg-muted px-2 transition-colors hover:bg-market-purple hover:text-white dark:hover:bg-market-pink/80 dark:hover:text-white",
                      {
                        "bg-market-pink/70 text-white hover:bg-market-pink/80 dark:hover:bg-market-pink/80":
                          isGroupActive,
                      },
                    )}
                  >
                    <ChevronDown
                      className={cn("size-4 transition-transform", {
                        "rotate-180": openAccordionRoute === link.route,
                      })}
                    />
                  </button>
                </div>

                {openAccordionRoute === link.route && (
                  <div className="mt-1 flex flex-col gap-1 pl-5 md:pl-8">
                    {subLinks.map((item) => (
                      <Link
                        key={item.route}
                        href={item.route}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm transition-colors hover:bg-market-purple hover:text-white dark:hover:bg-market-pink/80 dark:hover:text-white",
                          {
                            "bg-market-pink text-white font-semibold hover:bg-market-pink": pathname.startsWith(
                              item.route,
                            ),
                          },
                        )}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={link.name}
              href={link.route}
              className={cn(
                "flex h-[48px] grow cursor-pointer items-center justify-center gap-4 rounded-md bg-muted p-3 text-base font-normal transition-colors hover:bg-market-purple hover:text-white dark:hover:bg-market-pink/80 dark:hover:text-white md:flex-none md:justify-start md:p-2 md:px-3",
                {
                  "bg-market-pink text-white hover:bg-market-pink dark:hover:bg-market-pink":
                    pathname === link.route || pathname.startsWith(`${link.route}/`),
                }
              )}
            >
              <LinkIcon strokeWidth={1.2} />
              <p className="hidden md:block flex-1">{link.name}</p>
              {showBadge && (
                <span className="hidden md:flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-market-pink text-white text-xs font-semibold leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
    </>
  );
}
