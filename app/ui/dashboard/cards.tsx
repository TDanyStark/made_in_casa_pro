import {
  BanknotesIcon,
  ClockIcon,
  UserGroupIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';

const iconMap = {
  collected: BanknotesIcon,
  customers: UserGroupIcon,
  pending: ClockIcon,
  invoices: InboxIcon,
};

export default async function CardWrapper() {

  return (
    <>
      {/* NOTE: Uncomment this code in Chapter 9 */}
      <Card title="Collected" value={2000} type="collected" />
      <Card title="Pending" value={1000} type="pending" />
      <Card title="Total Invoices" value={20} type="invoices" />
      <Card
        title="Total Customers"
        value={30}
        type="customers"
      />
    </>
  );
}

export function Card({
  title,
  value,
  type,
}: {
  title: string;
  value: number | string;
  type: 'invoices' | 'customers' | 'pending' | 'collected';
}) {
  const Icon = iconMap[type];

  return (
    <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 p-2 shadow-sm">
      <div className="flex p-4">
        {Icon ? <Icon className="h-5 w-5" /> : null}
        <h3 className="ml-2 text-base font-medium dark:text-dark-subtitle">{title}</h3>
      </div>
      <p
        className={`${lusitana.className}
          truncate rounded-xl bg-light-bg dark:bg-dark-bg dark:text-dark-subtitle px-4 py-8 text-center text-3xl`}
      >
        {value}
      </p>
    </div>
  );
}
