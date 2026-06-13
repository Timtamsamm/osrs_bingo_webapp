import { prisma } from "@/lib/prisma";
import CreateUserForm from "./CreateUserForm";
import UserActions from "./UserActions";
import UserRowActions from "./UserRowActions";
import TeamMembersEditor from "./TeamMembersEditor";
import { auth } from "@/auth";

export default async function AdminUsersPage() {
  const [session, users, board] = await Promise.all([
    auth(),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, username: true, role: true, createdAt: true, teamMembers: true },
    }),
    prisma.bingoBoard.findFirst({ where: { active: true }, select: { maxTeamSize: true } }),
  ]);

  const maxTeamSize = board?.maxTeamSize ?? 10;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Teams</h1>
        <span className="text-sm text-gray-400">{users.length} total</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Username</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Members</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-800 last:border-0">
                <td className="px-4 py-3 text-white font-medium">{u.username}</td>
                <td className="px-4 py-3">
                  <UserActions id={u.id} role={u.role} isSelf={u.id === session?.user.id} />
                </td>
                <td className="px-4 py-3">
                  <TeamMembersEditor id={u.id} members={u.teamMembers} />
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {u.id !== session?.user.id && <UserRowActions id={u.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-gray-200 mb-4">Create Team</h2>
        <CreateUserForm maxTeamSize={maxTeamSize} />
      </div>
    </div>
  );
}
