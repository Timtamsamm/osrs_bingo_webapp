import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

/**
 * Call at the top of any protected server page to enforce the event passcode gate.
 * Admins always bypass. If no passcode is set on the active board, the gate is skipped.
 * Redirects to /verify if the user hasn't entered the correct passcode yet.
 */
export async function checkEventPasscode(userRole?: string) {
  if (userRole === "ADMIN") return;

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: { passcode: true },
  });

  if (!board?.passcode) return;

  const cookieStore = await cookies();
  const verified = cookieStore.get("event_verified")?.value;

  if (verified !== board.passcode) redirect("/verify");
}
