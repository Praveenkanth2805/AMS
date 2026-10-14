"use client";

import { createContext, useContext } from "react";
import type { Role, User } from "@/lib/types";

const Ctx = createContext<User | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useUser(): User {
  const u = useContext(Ctx);
  if (!u) throw new Error("useUser must be used within <UserProvider>");
  return u;
}

/** Permission helper. V1: only admin has write access. */
export function useCanWrite(): boolean {
  return useUser().role === "admin";
}

export function useRole(): Role {
  return useUser().role;
}