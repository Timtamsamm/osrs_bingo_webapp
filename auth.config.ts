import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = nextUrl
      // Always allow auth API routes, login page, and inbound webhooks
      if (pathname.startsWith("/api/auth") || pathname === "/login" || pathname.startsWith("/api/webhook")) return true
      // Admin routes (pages + API) require an authenticated admin
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        return isLoggedIn && (auth?.user as { role?: string })?.role === "ADMIN"
      }
      // Everything else is public
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    },
  },
}
