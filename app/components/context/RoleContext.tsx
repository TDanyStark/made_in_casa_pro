"use client";
import { createContext, useContext } from "react";

const RoleContext = createContext<number | null>(null);

export function RoleProvider({ role, children }: { role: number; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const role = useContext(RoleContext);
  if (role === null) {
    throw new Error("useRole debe ser usado dentro de un RoleProvider");
  }
  return role;
}
