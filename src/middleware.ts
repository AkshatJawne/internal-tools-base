import { NextResponse, type NextRequest } from "next/server";

// Gives every request an id so all audit events from one action can be correlated.
// Always server-generated: the id is hashed into the audit chain, so a caller must not be able to pick it.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-request-id", crypto.randomUUID());
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
