"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";

interface ItemManagerProps {
  name: string;
  link: string;
}

const ItemManager = ({ name, link }: ItemManagerProps) => {
  return (
    <div className="flex justify-between group bg-gray-100/80 dark:bg-gray-800/50 p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors gap-2">
      <div className="flex items-start gap-3 w-full">
        <div className="bg-accent dark:bg-gray-800 p-2 rounded-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-market-green"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div className="w-full">
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerente</p>
          <div className="font-medium">
            <p className="h-[24px] border-b border-transparent text-gray-900 dark:text-white text-nowrap">
              {name}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          asChild
        >
          <Link href={link}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default ItemManager;
