"use server";

import { redirect } from "next/navigation";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { createSession, destroySession } from "./session";
import { getCurrentUser } from "./index";

export async function signInAs(formData: FormData) {
  const user = await db.user.findFirst({ where: { id: String(formData.get("userId")), active: true } });
  if (!user) redirect("/sign-in");
  await createSession(user.id);
  await audit({ actor: user, action: "auth.sign_in", entityType: "User", entityId: user.id });
  redirect("/");
}

export async function signOut() {
  const user = await getCurrentUser();
  if (user) await audit({ actor: user, action: "auth.sign_out", entityType: "User", entityId: user.id });
  await destroySession();
  redirect("/sign-in");
}
