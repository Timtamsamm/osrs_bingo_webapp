// Shared validation for the create (POST) and update (PUT) event routes.
export type EventInput = {
  name: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  joinPhrase: string;
  bossFilter: string | null;
  minDropValue: number;
  clanOnly: boolean;
};

export function parseEventInput(body: Record<string, unknown>): EventInput | { error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Name is required" };

  const startsAt = new Date(body.startsAt as string);
  const endsAt = new Date(body.endsAt as string);
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) return { error: "Start and end times are required" };
  if (endsAt <= startsAt) return { error: "End time must be after start time" };

  const joinPhrase = typeof body.joinPhrase === "string" && body.joinPhrase.trim() ? body.joinPhrase.trim() : "!join";
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const bossFilter = typeof body.bossFilter === "string" && body.bossFilter.trim() ? body.bossFilter.trim() : null;

  const rawMin = body.minDropValue == null || body.minDropValue === "" ? 0 : Number(body.minDropValue);
  if (!Number.isFinite(rawMin) || rawMin < 0) return { error: "Minimum drop value must be 0 or more" };
  const minDropValue = Math.min(Math.round(rawMin), 2_147_483_647);

  // Missing = on, matching the column default.
  const clanOnly = body.clanOnly !== false;

  return { name, description, startsAt, endsAt, joinPhrase, bossFilter, minDropValue, clanOnly };
}
