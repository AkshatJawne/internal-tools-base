import { redirect } from "next/navigation";
import { getCurrentUser } from "@/kit/auth";
import { Shell } from "@/kit/ui/Shell";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return <Shell user={user}>{children}</Shell>;
}
