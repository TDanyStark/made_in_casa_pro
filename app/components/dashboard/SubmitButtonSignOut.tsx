"use client";

import { useFormStatus } from "react-dom";
import { Icons } from "../icons";

export function SubmitButtonSignOut() {
  const { pending } = useFormStatus();

  return (
    <button
      className="flex h-[48px] w-full grow items-center justify-center gap-2 rounded-md bg-light-bg-2 dark:bg-dark-bg-2 p-3 text-base hover:bg-red-700 hover:text-dark-subtitle md:flex-none md:justify-between md:p-2 md:px-3 cursor-pointer"
      type="submit"
      disabled={pending}
    >
      <div className="hidden md:block">Sign Out</div>

      {pending ? (
        <Icons.spinner className="animate-spin" />
      ) : (
        <Icons.power strokeWidth={1.2} />
      )}
    </button>
  );
}
