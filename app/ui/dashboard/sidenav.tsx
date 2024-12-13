import Link from 'next/link';
import NavLinks from '@/app/ui/dashboard/nav-links';
import { PowerIcon } from '@heroicons/react/24/outline';
import { signOut } from '@/auth';
import MICLogo from '../MICLogo';

export default function SideNav() {
  return (
    <div className="flex h-full flex-col px-3 py-4 md:px-2">
      <Link
        className="mb-2 flex items-end justify-center rounded-md bg-mic-gradient p-4"
        href="/dashboard"
      >
        <div className="w-32 md:w-40">
          <MICLogo onlyIcon={true} colorWhite={true} />
        </div>
      </Link>
      <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2 max-w-full overflow-auto pb-4 md:pb-0">
        <NavLinks />
        <div className="hidden h-auto w-full grow rounded-md bg-light-bg-2 dark:bg-dark-bg-2 md:block"></div>
        <form action={async () => {
            'use server';
            await signOut();
          }}>
          <button className="flex h-[48px] w-full grow items-center justify-center gap-2 rounded-md bg-light-bg-2 dark:bg-dark-bg-2 p-3 text-base font-medium  hover:bg-red-700 hover:text-dark-subtitle md:flex-none md:justify-between md:p-2 md:px-3">
            <div className="hidden md:block">Sign Out</div>
            <PowerIcon className="w-6" />
          </button>
        </form>
      </div>
    </div>
  );
}
