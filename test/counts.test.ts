import { describe, expect, it } from 'vitest';
import { countLines, nightCounts } from '../src/digest/counts.js';

describe('night counts', () => {
  it('counts lines by status and skips bad lines', () => {
    const text = [
      '{"at":"a","job":"x","status":"ok","owner":null}',
      '{"at":"b","job":"x","status":"retry","owner":null}',
      '{"at":"c","job":"x","status":"fail","owner":null}',
      '{"at":"d","job":"y","status":"ok","owner":null}',
      'not json',
      '{"at":"e","job":"y","status":"weird"}',
      '',
    ].join('\n');
    expect(countLines(text)).toEqual({ ok: 2, retry: 1, fail: 1 });
  });

  it('is zero for a missing night', () => {
    expect(nightCounts('runs', '1999-01-01')).toEqual({ ok: 0, retry: 0, fail: 0 });
  });
});
