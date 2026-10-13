import { auth } from "@/auth";

/**
 * The signed-in session if it belongs to an admin, otherwise null. Admin API
 * routes call this first and answer 403 on null — the proxy already blocks
 * /api/admin for non-admins, this is the in-route belt-and-braces check.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}
