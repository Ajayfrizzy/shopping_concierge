import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reserveYouCamRender } from '../apps/api/src/youcam/budget.js';
const dirs: string[] = [];
function ledger() {
  const dir = mkdtempSync(join(tmpdir(), 'youcam-budget-'));
  dirs.push(dir);
  const path = join(dir, 'ledger.jsonl');
  writeFileSync(path, '');
  return path;
}
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
it('persists uncertain submissions and blocks the ninth without changing history', () => {
  const path = ledger();
  for (let i = 0; i < 8; i++) reserveYouCamRender(path, 'earrings');
  const before = readFileSync(path, 'utf8');
  expect(before.trim().split('\n')).toHaveLength(8);
  expect(() => reserveYouCamRender(path, 'watches')).toThrow('budget');
  expect(readFileSync(path, 'utf8')).toBe(before);
});
it('fails closed on missing, corrupt or locked ledgers', () => {
  const path = ledger();
  expect(() => reserveYouCamRender(path + '.missing', 'rings')).toThrow('budget');
  writeFileSync(path, '{bad');
  expect(() => reserveYouCamRender(path, 'rings')).toThrow('budget');
  writeFileSync(path, '');
  writeFileSync(path + '.lock', '');
  expect(() => reserveYouCamRender(path, 'rings')).toThrow('budget');
  expect(readFileSync(path, 'utf8')).toBe('');
});
