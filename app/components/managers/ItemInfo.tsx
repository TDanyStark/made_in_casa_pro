import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface Props {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  href?: string; // Nueva propiedad opcional para el enlace
}

const ItemInfo = ({ icon: Icon, label, value, href }: Props) => {
  const content = (
    <>
      <div className="flex items-start gap-3 w-full">
        <div className="bg-accent dark:bg-gray-800 p-2 rounded-full">
          <Icon className="h-6 w-6 text-market-green" strokeWidth={2.4} />
        </div>
        <div className="w-full">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <div className="font-medium border-b border-transparent text-gray-900 dark:text-white">
            {value}
          </div>
        </div>
      </div>
    </>
  );

  const containerClasses = "flex justify-between group bg-gray-100/80 dark:bg-gray-800/50 p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors gap-2";

  // Si hay un href, renderiza como enlace, de lo contrario como div
  if (href) {
    return (
      <Link href={href} className={`${containerClasses} cursor-pointer`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={containerClasses}>
      {content}
    </div>
  );
};

export default ItemInfo;