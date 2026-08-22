import { spawnSync } from 'node:child_process';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const romaRoot = path.join(repoRoot, 'roma');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status && result.status !== 0) process.exit(result.status);
  if (result.error) {
    // eslint-disable-next-line no-console
    console.error(result.error);
    process.exit(1);
  }
}

async function readWranglerVars(filePath) {
  const source = await readFile(filePath, 'utf8').catch(() => '');
  const vars = {};
  let inVars = false;

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!inVars) {
      if (trimmed === '[vars]') inVars = true;
      continue;
    }
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[')) break;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"$/u);
    if (!match) continue;
    vars[match[1]] = match[2];
  }

  return vars;
}

async function main() {
  const vercelBin = path.join(romaRoot, 'node_modules', '.bin', 'vercel');
  const nextOnPagesBin = path.join(romaRoot, 'node_modules', '.bin', 'next-on-pages');
  const wranglerTomlPath = path.join(romaRoot, 'wrangler.toml');
  const vercelDir = path.join(repoRoot, '.vercel');
  const vercelProjectJsonPath = path.join(vercelDir, 'project.json');
  const nextBuildDir = path.join(romaRoot, '.next');
  const nextDevBuildDir = path.join(romaRoot, '.next-dev');
  const vercelOutputDir = path.join(romaRoot, '.vercel', 'output');
  const wranglerVars = await readWranglerVars(wranglerTomlPath);
  const buildEnv = { ...process.env, ...wranglerVars };
  let previousProjectJson = null;

  // Roma's Pages artifact contract is app-local, but Vercel's monorepo Next.js
  // builder still requires repo-root project metadata to resolve `rootDirectory`.
  try {
    previousProjectJson = await readFile(vercelProjectJsonPath, 'utf8');
  } catch {
    previousProjectJson = null;
  }

  await mkdir(vercelDir, { recursive: true });
  await writeFile(
    vercelProjectJsonPath,
    JSON.stringify(
      {
        projectId: '_',
        orgId: '_',
        settings: { framework: 'nextjs', rootDirectory: 'roma' },
      },
      null,
      0,
    ),
  );

  try {
    await rm(nextBuildDir, { recursive: true, force: true });
    await rm(nextDevBuildDir, { recursive: true, force: true });
    await rm(vercelOutputDir, { recursive: true, force: true });

    run(vercelBin, ['build', '--output', vercelOutputDir], { cwd: repoRoot, env: buildEnv });
    run(nextOnPagesBin, ['--skip-build'], { cwd: romaRoot, env: buildEnv });
  } finally {
    if (previousProjectJson === null) {
      await rm(vercelProjectJsonPath, { force: true });
    } else {
      await writeFile(vercelProjectJsonPath, previousProjectJson);
    }
  }
}

await main();
