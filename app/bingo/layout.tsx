import { PreStartAdminNotice } from "@/app/components/PreStartGate";

export default function BingoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PreStartAdminNotice />
    </>
  );
}
