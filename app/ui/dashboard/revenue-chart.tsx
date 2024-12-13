import { CalendarIcon } from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';

// This component is representational only.
// For data visualization UI, check out:
// https://www.tremor.so/
// https://www.chartjs.org/
// https://airbnb.io/visx/

export default async function RevenueChart() {
  const chartHeight = 350;
  // NOTE: Uncomment this code in Chapter 7


  return (
    <div className="w-full md:col-span-4">
      <h2 className={`${lusitana.className} mb-4 subtitleh2`}>
        Recent Revenue
      </h2>
      {/* NOTE: Uncomment this code in Chapter 7 */}

      <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 p-4">
        <div className="sm:grid-cols-13 mt-0 grid grid-cols-12 items-end gap-2 rounded-md bg-light-bg-2  dark:bg-dark-bg-3 p-4 md:gap-4">
          <div
            className="mb-6 hidden flex-col justify-between text-sm sm:flex"
            style={{ height: `${chartHeight}px` }}
          >
            
          </div>

        </div>
        <div className="flex items-center pb-2 pt-6">
          <CalendarIcon className="h-5 w-5" />
          <h3 className="ml-2 text-sm">Last 12 months</h3>
        </div>
      </div>
    </div>
  );
}
