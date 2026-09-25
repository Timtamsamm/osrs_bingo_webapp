import Link from "next/link";

const linkClass =
  "inline-flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-surface/60 px-3.5 py-2 text-sm text-purple-300 hover:text-white hover:border-purple-600/60 hover:bg-raised/60 transition-colors font-medium";

function HomeLink() {
  return (
    <Link href="/" className={linkClass}>
      ← Home
    </Link>
  );
}

function AdminLink() {
  return (
    <Link href="/bingo/admin" className={linkClass}>
      Admin →
    </Link>
  );
}

/**
 * Wraps a page's title block with the Home/Admin corner links. Below `sm`
 * the links sit above the title in normal flow instead of pinned absolute
 * over it — a long or wrapping title had nowhere else to go and rendered
 * underneath them at narrow widths. From `sm` up they pin to the corners
 * alongside the centered title as before.
 */
export default function PageHeaderNav({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex sm:hidden items-center justify-between mb-4">
        <HomeLink />
        <AdminLink />
      </div>
      <div className="relative">
        <div className="hidden sm:block absolute left-0 top-0">
          <HomeLink />
        </div>
        <div className="hidden sm:block absolute right-0 top-0">
          <AdminLink />
        </div>
        {children}
      </div>
    </>
  );
}
