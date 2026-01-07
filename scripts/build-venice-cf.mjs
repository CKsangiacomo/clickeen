import { spawnSync } from 'node:child_process';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const veniceRoot = path.join(repoRoot, 'venice');

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
  const vercelBin = path.join(veniceRoot, 'node_modules', '.bin', 'vercel');
  const nextOnPagesBin = path.join(veniceRoot, 'node_modules', '.bin', 'next-on-pages');
  const vercelDir = path.join(repoRoot, '.vercel');
  const vercelProjectJsonPath = path.join(vercelDir, 'project.json');
  const vercelOutputDir = path.join(veniceRoot, '.vercel', 'output');

  await mkdir(vercelDir, { recursive: true });
  await writeFile(
    vercelProjectJsonPath,
    JSON.stringify(
      {
        projectId: '_',
        orgId: '_',
        settings: { framework: 'nextjs', rootDirectory: 'venice' },
      },
      null,
      0,
    ),
  );

  await rm(vercelOutputDir, { recursive: true, force: true });

  // Build Vercel output first, then convert to Cloudflare Pages output.
  run(vercelBin, ['build', '--output', vercelOutputDir], { cwd: repoRoot });
  run(nextOnPagesBin, ['--skip-build'], { cwd: veniceRoot });
}

await main();

