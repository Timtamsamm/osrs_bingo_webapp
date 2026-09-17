import Link from "next/link";
import { getSettings } from "@/lib/settings";
import GeneralRulesForm from "./GeneralRulesForm";

export default async function AdminRulesPage() {
  const settings = await getSettings();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold mb-2 text-purple-100 heading-glow">
        Rules
      </h1>
      <p className="text-sm text-purple-500/70 mb-8 max-w-2xl">
        General rules shown on the public Rules page. Per-tile board rules aren&apos;t edited here — they come
        straight from each tile&apos;s Description field in{" "}
        <Link href="/bingo/admin/board" className="text-purple-400 hover:text-purple-200 underline">
          Board &amp; Tiles
        </Link>
        .
      </p>
      <GeneralRulesForm initialRules={settings?.generalRules ?? ""} />
    </div>
  );
}
