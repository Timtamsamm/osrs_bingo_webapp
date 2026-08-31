import Link from "next/link";
import Image from "next/image";

type SectionStatus = "live" | "soon";

const sections: { href: string; title: string; status: SectionStatus }[] = [
  { href: "/bingo", title: "Bingo", status: "live" },
  { href: "/events", title: "Events", status: "live" },
  { href: "/members", title: "Members", status: "live" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080510] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10 flex flex-col items-center">
          <Image
            src="/WONG_TONGS_2026_06_24_00_50_40_UTC.png"
            alt="Wong Tongs"
            width={96}
            height={96}
            className="rounded-full mb-4 ring-2 ring-purple-700/50 purple-glow-sm"
          />
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow mb-2">
            Wong Tongs
          </h1>
          <p className="text-purple-500 text-sm">Pick a section to get started.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-disabled={s.status === "soon"}
              className={`group rounded-2xl border p-6 flex flex-col items-center justify-center gap-1.5 transition-all ${
                s.status === "soon"
                  ? "border-purple-900/30 bg-[#0e0820]/50 pointer-events-none opacity-60"
                  : "border-purple-900/40 bg-[#0e0820] hover:border-purple-500/50 purple-glow-sm hover:purple-glow-sm"
              }`}
            >
              <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-white">
                {s.title}
              </h2>
              {s.status === "soon" && (
                <span className="text-[10px] uppercase tracking-widest text-purple-600 border border-purple-900/50 rounded-full px-2 py-0.5">
                  Soon
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
