"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";
import { login } from "@/lib/actions/auth";

export function UserLoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  console.log(state);

  return (
    <div className="grid gap-6">
      <form action={action}>
        <div className="grid gap-4">
          <div className="grid gap-4">
            <div>
              <Label className="sr-only" htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                placeholder="name@example.com"
                type="email"
                name="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                required
              />
              {state?.errors && "email" in state.errors && (
                <p className="text-xs text-red-500">{state.errors.email}</p>
              )}
            </div>
            <div>
              <Label className="sr-only" htmlFor="email">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                placeholder="Password"
                type="password"
                autoComplete="current-password"
                required
              />
              {state?.errors && "password" in state.errors && (
                <p className="text-xs text-red-500">{state.errors.password}</p>
              )}
            </div>
            
          </div>
          <Button disabled={pending} type="submit">
            {
              pending && (
                <Icons.spinner className="animate-spin" />
              )
            }
            Sign In with Email
          </Button>
          {state?.errors && "general" in state.errors && (
                <p className="text-xs text-red-500">{state.errors.general}</p>
              )}
        </div>
      </form>
    </div>
  );
}
