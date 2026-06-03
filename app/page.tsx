import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">OSRS Bingo</h1>
        <p className="text-gray-400">Welcome, {session.user.name}</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/board"
          className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-xl py-4 text-center text-lg transition-colors"
        >
          View Bingo Board
        </Link>
        <Link
          href="/submit"
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold rounded-xl py-4 text-center text-lg transition-colors"
        >
          Upload Submission
        </Link>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
