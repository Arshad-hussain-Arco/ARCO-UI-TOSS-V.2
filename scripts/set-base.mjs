// Rewrites the public base path inside an existing build, so the app can be moved
// (e.g. /tossv2/ -> /toss/) without rebuilding.
//
// Standalone: needs only Node (no npm install). Run it from the folder that contains
// dist-template/; it writes dist/ next to it.
//
// `npm run build` emits dist-template/ (base placeholder intact) and then generates the
// deployable dist/ from it using VITE_APP_BASE_URL. Re-run this any time to regenerate dist/
// with a different base:
//
//   node scripts/set-base.mjs /toss/   explicit value (use this on the prod server)
//   node scripts/set-base.mjs          falls back to $VITE_APP_BASE_URL, then .env, then "/"
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_PLACEHOLDER = '/__TOSS_BASE__/';
const TEXT_EXT = /\.(html|js|mjs|css|json|webmanifest|svg|txt)$/i;

const normalize = (value) => {
  const trimmed = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
};

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const readDotEnv = () => {
  if (!existsSync('.env')) return undefined;
  const line = readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('VITE_APP_BASE_URL='));
  return line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
};

const [, , argBase] = process.argv;
const base = normalize(argBase ?? process.env.VITE_APP_BASE_URL ?? readDotEnv() ?? '/');
const SOURCE_DIR = 'dist-template';
const dir = 'dist';

if (!existsSync(SOURCE_DIR)) {
  console.error(`set-base: ${SOURCE_DIR}/ not found in ${process.cwd()}. Run from the folder that contains it.`);
  process.exit(1);
}

rmSync(dir, { recursive: true, force: true });
cpSync(SOURCE_DIR, dir, { recursive: true });

let touched = 0;
for (const file of walk(dir).filter((f) => TEXT_EXT.test(f))) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes(BASE_PLACEHOLDER)) continue;
  writeFileSync(file, content.split(BASE_PLACEHOLDER).join(base));
  touched += 1;
}

if (touched === 0) {
  console.error(
    `set-base: no "${BASE_PLACEHOLDER}" placeholder found in ${dir}/. ` +
      'Run "npm run build" first.',
  );
  process.exit(1);
}
console.log(`set-base: base path set to "${base}" in ${touched} file(s) under ${dir}/`);
