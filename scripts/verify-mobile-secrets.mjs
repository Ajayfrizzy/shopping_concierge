import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
const keys = [
  'DATABASE_URL',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'SMTP_URL',
  'YOUCAM_API_KEY',
  'LLM_API_KEY',
  'OPENAI_API_KEY',
];
const sentinels = Object.fromEntries(
  keys.map((key) => [key, `M5_PRIVATE_SENTINEL_${key}_DO_NOT_BUNDLE`]),
);
const exported = spawnSync('npm', ['run', 'export:android'], {
  env: { ...process.env, ...sentinels },
  stdio: 'inherit',
});
if (exported.status !== 0) process.exit(exported.status ?? 1);
let count = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) inspect(path);
    else {
      const contents = readFileSync(path);
      count++;
      for (const value of Object.values(sentinels))
        if (contents.includes(Buffer.from(value)))
          throw new Error(`Server-only sentinel leaked into ${path}`);
    }
  }
}
inspect('apps/mobile/dist');
process.stdout.write(
  `PASS: ${count} Android export files contain none of the ${keys.length} server-only credential sentinels.\n`,
);
