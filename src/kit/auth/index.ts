import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { db } from "@/kit/db";
import { can, ForbiddenError, type Permission } from "@/kit/rbac";
import { audit } from "@/kit/audit";
import { readSessionUserId } from "./session";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const id = await readSessionUserId();
  if (!id) return null;
  return db.user.findFirst({ where: { id, active: true } });
});

/** Every server action and route handler calls this. Denials are audited. */
export async function requirePermission(permission: Permission): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Not signed in");
  if (!can(user, permission)) {
    await audit({
      actor: user,
      action: "access.denied",
      entityType: "Permission",
      entityId: permission,
    });
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return user;
}

/** For pages: redirect instead of throwing. */
export async function requirePagePermission(permission: Permission): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!can(user, permission)) {
    await audit({
      actor: user,
      action: "access.denied",
      entityType: "Permission",
      entityId: permission,
    });
    redirect(`/?denied=${encodeURIComponent(permission)}`);
  }
  return user;
}
