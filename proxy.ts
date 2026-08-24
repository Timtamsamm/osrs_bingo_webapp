import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

const { auth } = NextAuth(authConfig)

export { auth as proxy }

export const config = {
  // Run auth proxy on every route EXCEPT Next.js internals and static assets.
  // Without the asset exclusions, unauthenticated requests to images/fonts would
  // be redirected to /login, breaking the background image on the login page itself.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|ttf|woff|woff2|webp)).*)"],
}
