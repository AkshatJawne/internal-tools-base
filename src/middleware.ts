import { NextResponse, type NextRequest } from "next/server";

// Gives every request an id so all audit events from one action can be correlated.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  if (!headers.get("x-request-id")) headers.set("x-request-id", crypto.randomUUID());
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
