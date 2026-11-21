import { NextResponse } from "next/server";
import { maintenanceEnabled } from "@/lib/maintenance";

export function middleware() {
  if (maintenanceEnabled()) {
    return NextResponse.next({ status: 503 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|fonts/|favicon.ico).*)"],
};
