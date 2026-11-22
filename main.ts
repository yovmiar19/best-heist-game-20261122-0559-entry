// Velvet Vault — a one-room stealth heist game (Node 22, standard library only).
// game/ is plain static files a desktop browser loads offline; this program copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json with the vendored make.fun library.
// Serve locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Verify the output landed and summarise it, so a broken build fails loudly
// instead of silently producing an empty /output.
const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
const shotNames = existsSync(join(out, 'screenshots'))
  ? readdirSync(join(out, 'screenshots'))
  : [];
const gameFiles = readdirSync(join(out, 'game'), { recursive: true });
console.log(
  `Velvet Vault dossier written: ${Object.keys(dossier).length} top-level keys, ` +
  `${shotNames.length} screenshot(s) (${shotNames.join(', ')}), ` +
  `${gameFiles.length} game file(s) copied.`,
);
