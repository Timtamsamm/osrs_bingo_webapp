/**
 * Shared "itemId item name" per-line text format used by both the tile
 * editor's Dink item boxes and the boss item database editor.
 */
export interface SimpleItem {
  id: number;
  name: string;
}

export function parseItemLines(text: string): SimpleItem[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) return [];
      const id = parseInt(line.slice(0, spaceIdx), 10);
      const name = line.slice(spaceIdx + 1).trim();
      if (isNaN(id) || !name) return [];
      return [{ id, name }];
    });
}

export function itemLinesToText(items: SimpleItem[] | null | undefined): string {
  return (items ?? []).map((i) => `${i.id} ${i.name}`).join("\n");
}
