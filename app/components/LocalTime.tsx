"use client";

/**
 * Renders a date in the viewer's own timezone. Server components render in
 * the server's timezone (UTC on Vercel), which is wrong for anyone else —
 * suppressHydrationWarning covers the server/client text mismatch.
 */
export default function LocalTime({
  date,
  dateStyle = "medium",
  timeStyle = "short",
}: {
  date: Date | string;
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
}) {
  return (
    <span suppressHydrationWarning>
      {new Date(date).toLocaleString(undefined, { dateStyle, timeStyle })}
    </span>
  );
}
