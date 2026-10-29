import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// A temp runs dir: the real runs/ is read-only fixtures and is never written.
let runsDir: string;

const app = () =>
  createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  // Two jobs, written out of job order on purpose, plus one line that is not JSON.
  writeFileSync(
    join(runsDir, '2026-01-01.jsonl'),
    [
      '{"at":"2026-01-01T02:00:00+01:00","job":"sync-invoices","status":"ok","owner":"ana"}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"backup-db","status":"retry","owner":"ben","error":"timeout"}',
      'this line is not json',
      '',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('renders a night with both jobs and the bad-line note', async () => {
    const res = await app().request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('backup-db');
    expect(html).toContain('sync-invoices');
    expect(html).toContain('1 line didn');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app().request('/digest/2026-01-03');
    expect(res.status).toBe(404);
  });

  it('renders the empty night as "nothing ran"', async () => {
    const res = await app().request('/digest/2026-01-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the rows in job order and the bad-line count', async () => {
    const res = await app().request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['backup-db', 'sync-invoices']);
    expect(body.rows[0]).toMatchObject({ job: 'backup-db', owner: 'ben', runs: 1, retries: 1, lastStatus: 'retry', lastError: 'timeout' });
    expect(body.rows[1]).toMatchObject({ job: 'sync-invoices', owner: 'ana', runs: 1, retries: 0, lastStatus: 'ok', lastError: null });  });

  it('answers 404 for a night with no file', async () => {
    const res = await app().request('/api/digest/2026-01-03');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns an empty rows list for the empty night', async () => {
    const res = await app().request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });
});

describe('digest page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const page = await (await app().request('/digest/2026-01-01')).text();
    const json = (await (await app().request('/api/digest/2026-01-01')).json()) as Night;
    const positions = json.rows.map((r) => page.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
