"use client";

import {
  AtSymbolIcon,
  KeyIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { ArrowRightIcon } from "@heroicons/react/20/solid";
import { useActionState } from "react";
import { authenticate } from "@/app/lib/actions";

export default function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined
  );
  return (
    <form action={formAction} className="space-y-3 w-full max-w-96">
      <div className="flex-1 rounded-lg">
        <div>
          <div>
            <label
              className="mb-2 block text-base font-medium"
              htmlFor="email"
            >
              Email
            </label>
            <div className="relative">
              <input
                className="peer pl-10 py-3 bg-light-input border border-light-border text-light-title rounded-lg block w-full dark:bg-dark-input dark:border-dark-border dark:placeholder-dark-text dark:text-dark-title"
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
              />
              <AtSymbolIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 dark:text-dark-text peer-focus:text-gray-900 dark:peer-focus:text-dark-title" />
            </div>
          </div>
          <div className="mt-4">
            <label
              className="mb-2 block text-base font-medium"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative">
              <input
                className="peer pl-10 py-3 bg-light-input border border-light-border text-light-title rounded-lg block w-full dark:bg-dark-input dark:border-dark-border dark:placeholder-dark-text dark:text-dark-title"
                id="password"
                type="password"
                name="password"
                placeholder="Enter password"
                required
                minLength={6}
              />
              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 dark:text-dark-text peer-focus:text-gray-900 dark:peer-focus:text-dark-title" />
            </div>
          </div>
          <button
            className="btn-primary w-full mt-8 flex items-center gap-5 rounded-lg px-6 py-3 text-base font-medium text-white transition-colors"
            aria-disabled={isPending}
          >
            Log in <ArrowRightIcon className="ml-auto h-5 w-5 text-gray-50" />
          </button>
        </div>
        <div className="flex h-8 items-end space-x-1">
          {/* Add form errors here */}
          {errorMessage && (
            <>
              <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-500">{errorMessage}</p>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
