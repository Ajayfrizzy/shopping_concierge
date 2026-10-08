import { build } from 'esbuild';
import { fileURLToPath, URL } from 'node:url';

// Keep the bundle at the same directory depth as src/llm/config.ts and
// src/persistence/postgres.ts: their import.meta.url-relative ledger and SQL
// paths must still address the existing repository files, never new copies.
await build({
  absWorkingDir: fileURLToPath(new URL('.', import.meta.url)),
  entryPoints: ['src/server.ts'],
  outfile: 'dist/runtime/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  plugins: [
    {
      name: 'bundle-workspaces-only',
      setup(builder) {
        builder.onResolve({ filter: /^[^./]/ }, ({ path, kind }) => {
          // Resolve workspace source exports into JavaScript; leave installed
          // npm packages (including native sharp) and Node builtins external.
          if (kind !== 'entry-point' && !path.startsWith('@youcam/'))
            return { path, external: true };
        });
      },
    },
  ],
});
