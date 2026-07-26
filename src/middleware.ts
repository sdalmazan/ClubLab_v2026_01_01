import { proxy } from "./proxy";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    "/",
    "/(es|en|pt|fr|it|de|nl)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
