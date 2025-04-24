"use client";

import {
  Copy,
  Mail,
  Phone,
  User,
  Building,
  Calendar,
  MapPin,
  Globe,
  LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";

// Tipo para las claves de icono disponibles
export type IconKey =
  | "mail"
  | "phone"
  | "user"
  | "building"
  | "calendar"
  | "location"
  | "globe";

const IconMap: Record<IconKey, LucideIcon> = {
  mail: Mail,
  phone: Phone,
  user: User,
  building: Building,
  calendar: Calendar,
  location: MapPin,
  globe: Globe,
};

interface Props {
  label: string;
  value: string;
  iconKey: IconKey;
}

const ItemInfo = ({ label, value, iconKey }: Props) => {
  const [copied, setCopied] = useState<string | null>(null);

  // Obtén el componente de icono adecuado
  const Icon = IconMap[iconKey];

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex justify-between group bg-gray-100/80 dark:bg-gray-800/50 p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors gap-6">
      <div className="flex items-start gap-3">
        <div className="bg-accent dark:bg-gray-800 p-2 rounded-full">
          <Icon className="h-6 w-6 text-market-green" strokeWidth={2.4} />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="font-medium text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          onClick={() => copyToClipboard(value, label.toLowerCase())}
        >
          {copied === label.toLowerCase() ? (
            <span className="text-xs text-primary">¡Copiado!</span>
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
export default ItemInfo;
