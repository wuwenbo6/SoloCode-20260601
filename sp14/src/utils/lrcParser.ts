import type { LrcLine } from "../stores/usePlayerStore";

export function parseLrc(content: string): LrcLine[] {
  const lines = content.split("\n");
  const result: LrcLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:[.:])(\d{2,3})\]/g;

  for (const line of lines) {
    const times: number[] = [];
    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      let ms = parseInt(match[3], 10);
      if (match[3].length === 2) {
        ms *= 10;
      }
      times.push(min * 60 + sec + ms / 1000);
    }

    const text = line.replace(/\[\d{2}:\d{2}[.:]\d{2,3}\]/g, "").trim();
    if (times.length > 0 && text) {
      for (const time of times) {
        result.push({ time, text });
      }
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

export function findCurrentLine(lines: LrcLine[], currentTime: number): number {
  if (lines.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}
