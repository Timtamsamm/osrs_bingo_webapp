export type BossKCs = Record<string, number>;

// 89 activity slots from index_lite.ws (lines 26–114 of the CSV).
// null = non-boss slot to skip. Index = activity number - 1 (0-based).
// Index 45 = Giant Mole confirmed from live CSV.
const ACTIVITIES: (string | null)[] = [
  null, null, null, null, null, null, null, null, // 0–7
  "Beginner Clues",           // 8
  "Easy Clues",               // 9
  "Medium Clues",             // 10
  "Hard Clues",               // 11
  "Elite Clues",              // 12
  "Master Clues",             // 13
  null, null, null,           // 14–16
  "Guardians of the Rift",    // 17
  null, null,                 // 18–19
  "Abyssal Sire",             // 20
  "Alchemical Hydra",         // 21
  "Amoxliatl",                // 22
  "Araxxor",                  // 23
  "Artio",                    // 24
  "Barrows Chests",           // 25
  "Brutus",                   // 26
  "Bryophyta",                // 27
  "Callisto",                 // 28
  "Cal'varion",               // 29
  "Cerberus",                 // 30
  "Chambers of Xeric",        // 31
  "Chambers of Xeric: CM",    // 32
  "Chaos Elemental",          // 33
  "Chaos Fanatic",            // 34
  "Commander Zilyana",        // 35
  "Corporeal Beast",          // 36
  "Crazy Archaeologist",      // 37
  "Dagannoth Prime",          // 38
  "Dagannoth Rex",            // 39
  "Dagannoth Supreme",        // 40
  "Deranged Archaeologist",   // 41
  "Doom",                     // 42
  "Duke Sucellus",            // 43
  "General Graardor",         // 44
  "Giant Mole",               // 45
  "Grotesque Guardians",      // 46
  "Hespori",                  // 47
  "Kalphite Queen",           // 48
  "King Black Dragon",        // 49
  "Kraken",                   // 50
  "Kree'Arra",                // 51
  "K'ril Tsutsaroth",         // 52
  "Moons of Peril",           // 53
  "Phosani's Nightmare",      // 54
  "Nex",                      // 55
  "Nightmare",                // 56
  "Nightmare (Phosani's)",    // 57
  "Obor",                     // 58
  "Phantom Muspah",           // 59
  "Sarachnis",                // 60
  "Scorpia",                  // 61
  "Scurrius",                 // 62
  "Shellbane Gryphon",        // 63
  "Skotizo",                  // 64
  "Sol Heredit",              // 65
  "Spindel",                  // 66
  "Tempoross",                // 67
  "The Gauntlet",             // 68
  "The Corrupted Gauntlet",   // 69
  "Huey",                     // 70
  "The Leviathan",            // 71
  "Royal Titans",             // 72
  "The Whisperer",            // 73
  "Theatre of Blood",         // 74
  "Theatre of Blood: HM",     // 75
  "Thermonuclear Smoke Devil",// 76
  "Tombs of Amascut",         // 77
  "Tombs of Amascut: Expert", // 78
  "TzKal-Zuk",                // 79
  "TzTok-Jad",                // 80
  "Vardorvis",                // 81
  "Venenatis",                // 82
  "Vet'ion",                  // 83
  "Vorkath",                  // 84
  "Wintertodt",               // 85
  "Yama",                     // 86
  "Zalcano",                  // 87
  "Zulrah",                   // 88
];

export async function fetchBossKCs(playerName: string): Promise<BossKCs> {
  const url = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encodeURIComponent(playerName)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "OSRS-Bingo-App/1.0" },
    cache: "no-store",
  });

  if (res.status === 404) throw new Error(`Player "${playerName}" not found on hiscores`);
  if (!res.ok) throw new Error(`Hiscores returned ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n");
  const activityLines = lines.slice(25); // skip 25 skill lines

  const bosses: BossKCs = {};
  for (let i = 0; i < ACTIVITIES.length && i < activityLines.length; i++) {
    const name = ACTIVITIES[i];
    if (!name) continue;
    const parts = activityLines[i].trim().split(",");
    const score = parseInt(parts[1] ?? "-1", 10);
    if (score > 0) bosses[name] = score;
  }

  return bosses;
}

export function diffKCs(current: BossKCs, snapshot: BossKCs): BossKCs {
  const result: BossKCs = {};
  for (const [boss, currentKC] of Object.entries(current)) {
    const gained = currentKC - (snapshot[boss] ?? 0);
    if (gained > 0) result[boss] = gained;
  }
  return result;
}
