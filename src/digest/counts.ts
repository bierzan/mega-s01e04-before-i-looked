import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

// Count a night's log lines by status. readNight folds lines into per-job rows that keep only the
// last status, so ok/fail can't be recovered from them; count the lines directly instead. A line
// counts only if it is well-formed the way readNight accepts it (bad lines are excluded).
export function countLines(text: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.at !== 'string' || typeof o.job !== 'string') continue;
    if (o.status === 'ok' || o.status === 'retry' || o.status === 'fail') counts[o.status]++;
  }
  return counts;
}

// Zero counts when the night's file can't be read.
export function nightCounts(runsDir: string, night: string): NightCounts {
  try {
    return countLines(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return { ok: 0, retry: 0, fail: 0 };
  }
}
