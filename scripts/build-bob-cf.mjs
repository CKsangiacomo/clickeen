import { spawnSync } from 'node:child_process';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bobRoot = path.join(repoRoot, 'bob');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status && result.status !== 0) process.exit(result.status);
  if (result.error) {
    // eslint-disable-next-line no-console
    console.error(result.error);
    process.exit(1);
  }
}

async function main() {
  const vercelBin = path.join(bobRoot, 'node_modules', '.bin', 'vercel');
  const nextOnPagesBin = path.join(bobRoot, 'node_modules', '.bin', 'next-on-pages');
  const vercelDir = path.join(repoRoot, '.vercel');
  const vercelProjectJsonPath = path.join(vercelDir, 'project.json');
  const outdir = path.join(bobRoot, '.cloudflare', 'output', 'static');
  const vercelOutputDir = path.join(bobRoot, '.vercel', 'output');

  await mkdir(vercelDir, { recursive: true });
  await writeFile(
    vercelProjectJsonPath,
    JSON.stringify(
      {
        projectId: '_',
        orgId: '_',
        settings: { framework: 'nextjs', rootDirectory: 'bob' },
      },
      null,
      0,
    ),
  );

  await rm(vercelOutputDir, { recursive: true, force: true });
  await rm(outdir, { recursive: true, force: true });

  run(vercelBin, ['build', '--output', vercelOutputDir], { cwd: repoRoot });
  run(nextOnPagesBin, ['--skip-build', '--outdir', '.cloudflare/output/static'], { cwd: bobRoot });
}

await main();
