import { PencilIcon, PlusIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
// import { deleteInvoice } from "@/app/lib/actions";

export function CreateProject() {
  return (
    <Link
      href="/dashboard/projects/create"
      className="flex h-10 items-center rounded-lg btn-primary px-4 text-sm font-medium text-dark-title transition-colors "
    >
      <span className="hidden md:block">Create Invoice</span>{" "}
      <PlusIcon className="h-5 md:ml-4" />
    </Link>
  );
}

export function UpdateInvoice({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/invoices/${id}/edit`}
      className="rounded-md border p-2 hover:bg-gray-100"
    >
      <PencilIcon className="w-5" />
    </Link>
  );
}

// export function DeleteInvoice({ id }: { id: string }) {
//   const deleteInvoiceWithId = deleteInvoice.bind(null, id);
//   return (
//     <>
//       <form action={deleteInvoiceWithId}>
//         <button
//           type="submit"
//           className="rounded-md border p-2 hover:bg-gray-100"
//         >
//           <span className="sr-only">Delete</span>
//           <TrashIcon className="w-4" />
//         </button>
//       </form>
//     </>
//   );
// }
