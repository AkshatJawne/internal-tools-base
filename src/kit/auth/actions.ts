"use server";

import { redirect } from "next/navigation";
import { db } from "@/kit/db";
import { audit, SYSTEM } from "@/kit/audit";
import { createSession, destroySession } from "./session";
import { getCurrentUser } from "./index";
import { verifyPassword } from "./password";

// DEV ONLY credential sign-in. Production replaces this action with the OIDC callback; the session, RBAC and audit code stay.
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findFirst({ where: { email, active: true } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await audit({ actor: SYSTEM("auth"), action: "auth.sign_in_failed", entityType: "User", entityId: email || "(empty)" });
    redirect("/sign-in?error=1");
  }
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
