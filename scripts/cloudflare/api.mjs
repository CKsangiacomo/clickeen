#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const envPath = path.join(repoRoot, '.env.local');
const devstudioWranglerPath = path.join(repoRoot, 'admin', 'wrangler.toml');
const API_BASE = 'https://api.cloudflare.com/client/v4';
const DEVSTUDIO_PROJECT_NAME = 'devstudio';
const DEVSTUDIO_REQUIRED_SECRET_KEYS = ['DEVSTUDIO_GITHUB_TOKEN'];
const DEVSTUDIO_PROJECT_CONFIG = {
  production_branch: 'main',
  build_config: {
    build_command: 'pnpm build',
    destination_dir: 'dist',
    root_dir: 'admin',
  },
};

function loadLocalEnv() {
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local or export it before running this command.`);
  return value;
}

function getConfig() {
  loadLocalEnv();
  return {
    accountId: requireEnv('CLOUDFLARE_ACCOUNT_ID'),
    token: requireEnv('CLOUDFLARE_REST_API_TOKEN'),
  };
}

function formatErrors(body) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  return errors.map((entry) => entry.message || JSON.stringify(entry)).join('; ');
}

async function cf(config, pathname, init = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { success: false, errors: [{ message: text || response.statusText }] };
  }
  if (!response.ok || body.success === false) {
    const detail = formatErrors(body) || response.statusText;
    const error = new Error(`Cloudflare API failed ${response.status}: ${detail}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function parseSimpleTomlValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readWranglerVars(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  let inVars = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^\[[^\]]+\]$/.test(trimmed)) {
      inVars = trimmed === '[vars]';
      continue;
    }
    if (!inVars) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(trimmed);
    if (!match) continue;
    vars[match[1]] = parseSimpleTomlValue(match[2]);
  }
  return vars;
}

async function verifyToken(config) {
  const body = await cf(config, '/user/tokens/verify');
  return body.result ?? {};
}

async function getAccount(config) {
  const body = await cf(config, `/accounts/${config.accountId}`);
  return body.result ?? {};
}

async function listPagesProjects(config) {
  const body = await cf(config, `/accounts/${config.accountId}/pages/projects`);
  return Array.isArray(body.result) ? body.result : [];
}

async function getPagesProject(config, projectName) {
  const body = await cf(config, `/accounts/${config.accountId}/pages/projects/${encodeURIComponent(projectName)}`);
  return body.result ?? {};
}

async function patchPagesProject(config, projectName, payload) {
  const body = await cf(config, `/accounts/${config.accountId}/pages/projects/${encodeURIComponent(projectName)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return body.result ?? {};
}

async function listPagesDomains(config, projectName) {
  const body = await cf(config, `/accounts/${config.accountId}/pages/projects/${encodeURIComponent(projectName)}/domains`);
  return Array.isArray(body.result) ? body.result : [];
}

async function findZone(config, zoneName) {
  const body = await cf(config, `/zones?name=${encodeURIComponent(zoneName)}`);
  const zones = Array.isArray(body.result) ? body.result : [];
  return zones[0] ?? null;
}

async function listDnsRecords(config, zoneId, name = '') {
  const suffix = name ? `?name=${encodeURIComponent(name)}` : '';
  const body = await cf(config, `/zones/${zoneId}/dns_records${suffix}`);
  return Array.isArray(body.result) ? body.result : [];
}

async function upsertCname(config, zoneId, name, target) {
  const existing = await listDnsRecords(config, zoneId, name);
  const payload = {
    type: 'CNAME',
    name,
    content: target,
    proxied: true,
    ttl: 1,
  };
  const current = existing.find((record) => record.type === 'CNAME');
  if (current) {
    const body = await cf(config, `/zones/${zoneId}/dns_records/${current.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return { action: 'updated', record: body.result };
  }
  const body = await cf(config, `/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { action: 'created', record: body.result };
}

function summarizeProject(project) {
  return {
    name: project.name,
    subdomain: project.subdomain,
    production_branch: project.production_branch,
    domains: project.domains,
  };
}

function summarizeDomain(domain) {
  return {
    name: domain.name,
    status: domain.status,
    zone_tag: domain.zone_tag,
  };
}

function summarizeRecord(record) {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    content: record.content,
    proxied: record.proxied,
    ttl: record.ttl,
  };
}

function summarizeEnvVars(envVars = {}) {
  return Object.fromEntries(
    Object.entries(envVars).map(([name, variable]) => [
      name,
      {
        type: variable?.type ?? 'unknown',
        present: Boolean(variable),
      },
    ]),
  );
}

function summarizeRequiredEnv(envVars = {}) {
  const required = [
    'BERLIN_BASE_URL',
    'DEVSTUDIO_CANONICAL_ORIGIN',
    'DEVSTUDIO_GITHUB_BRANCH',
    'DEVSTUDIO_GITHUB_REPOSITORY',
    'DEVSTUDIO_GITHUB_TOKEN',
    'ENV_STAGE',
  ];
  return Object.fromEntries(
    required.map((name) => [
      name,
      {
        present: Boolean(envVars[name]),
        type: envVars[name]?.type ?? null,
      },
    ]),
  );
}

function summarizeLatestDeployment(deployment) {
  if (!deployment) return null;
  const metadata = deployment.deployment_trigger?.metadata ?? {};
  return {
    id: deployment.id,
    environment: deployment.environment,
    url: deployment.url,
    created_on: deployment.created_on,
    latest_stage: deployment.latest_stage?.name,
    branch: metadata.branch,
    commit_hash: metadata.commit_hash,
    commit_message: metadata.commit_message,
  };
}

function summarizeProjectDetails(project) {
  const production = project.deployment_configs?.production ?? {};
  const preview = project.deployment_configs?.preview ?? {};
  const productionEnv = production.env_vars ?? {};
  return {
    name: project.name,
    subdomain: project.subdomain,
    production_branch: project.production_branch,
    domains: project.domains,
    build_config: {
      build_command: project.build_config?.build_command,
      destination_dir: project.build_config?.destination_dir,
      root_dir: project.build_config?.root_dir,
    },
    source: {
      type: project.source?.type,
      owner: project.source?.config?.owner,
      repo_name: project.source?.config?.repo_name,
      production_branch: project.source?.config?.production_branch,
    },
    latest_deployment: summarizeLatestDeployment(project.latest_deployment),
    env_vars: {
      production: summarizeEnvVars(productionEnv),
      preview: summarizeEnvVars(preview.env_vars ?? {}),
    },
    ...(project.name === DEVSTUDIO_PROJECT_NAME
      ? { required_devstudio_env: summarizeRequiredEnv(productionEnv) }
      : {}),
  };
}

function summarizeProjectConfigDiff(project) {
  const current = {
    production_branch: project.production_branch,
    build_config: {
      build_command: project.build_config?.build_command,
      destination_dir: project.build_config?.destination_dir,
      root_dir: project.build_config?.root_dir ?? '',
    },
  };
  return {
    current,
    desired: DEVSTUDIO_PROJECT_CONFIG,
    matches:
      current.production_branch === DEVSTUDIO_PROJECT_CONFIG.production_branch &&
      current.build_config.build_command === DEVSTUDIO_PROJECT_CONFIG.build_config.build_command &&
      current.build_config.destination_dir === DEVSTUDIO_PROJECT_CONFIG.build_config.destination_dir &&
      current.build_config.root_dir === DEVSTUDIO_PROJECT_CONFIG.build_config.root_dir,
  };
}

function summarizeDevstudioEnv(project) {
  const productionEnv = project.deployment_configs?.production?.env_vars ?? {};
  const desiredPlain = readWranglerVars(devstudioWranglerPath);
  const desiredPlainSummary = Object.fromEntries(
    Object.entries(desiredPlain).map(([name, value]) => [
      name,
      {
        desired_type: 'plain_text',
        desired_value: value,
        current_present: Boolean(productionEnv[name]),
        current_type: productionEnv[name]?.type ?? null,
        matches:
          productionEnv[name]?.type === 'plain_text' &&
          typeof productionEnv[name]?.value === 'string' &&
          productionEnv[name].value === value,
      },
    ]),
  );
  const requiredSecrets = Object.fromEntries(
    DEVSTUDIO_REQUIRED_SECRET_KEYS.map((name) => [
      name,
      {
        desired_type: 'secret_text',
        current_present: Boolean(productionEnv[name]),
        current_type: productionEnv[name]?.type ?? null,
        matches: productionEnv[name]?.type === 'secret_text',
      },
    ]),
  );
  return {
    project: DEVSTUDIO_PROJECT_NAME,
    source_of_truth: 'admin/wrangler.toml',
    non_secret_vars: desiredPlainSummary,
    required_secrets: requiredSecrets,
    matches:
      Object.values(desiredPlainSummary).every((entry) => entry.matches) &&
      Object.values(requiredSecrets).every((entry) => entry.matches),
    note:
      'Non-secret vars are deployed from admin/wrangler.toml once the Pages project root is admin. Required secrets remain live-only Cloudflare Pages secrets.',
  };
}

function devstudioEnvPatchPayload() {
  const desiredPlain = readWranglerVars(devstudioWranglerPath);
  const envVars = Object.fromEntries(
    Object.entries(desiredPlain).map(([name, value]) => [name, { type: 'plain_text', value }]),
  );
  for (const name of DEVSTUDIO_REQUIRED_SECRET_KEYS) {
    envVars[name] = { type: 'secret_text', value: requireEnv(name) };
  }
  return {
    deployment_configs: {
      production: {
        env_vars: envVars,
      },
    },
  };
}

function summarizeDevstudioEnvPatchPayload(payload) {
  const envVars = payload.deployment_configs?.production?.env_vars ?? {};
  return Object.fromEntries(
    Object.entries(envVars).map(([name, variable]) => [
      name,
      {
        type: variable.type,
        value: variable.type === 'secret_text' ? '[redacted]' : variable.value,
      },
    ]),
  );
}

function omitNullish(record = {}) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && typeof value !== 'undefined'),
  );
}

function devstudioProjectPatchPayload(project) {
  return {
    production_branch: DEVSTUDIO_PROJECT_CONFIG.production_branch,
    build_config: {
      ...omitNullish(project.build_config || {}),
      ...DEVSTUDIO_PROJECT_CONFIG.build_config,
    },
  };
}

async function syncDevstudioProject(config, args) {
  const apply = args.includes('--apply');
  const before = await getPagesProject(config, DEVSTUDIO_PROJECT_NAME);
  const payload = devstudioProjectPatchPayload(before);
  const beforeDiff = summarizeProjectConfigDiff(before);
  if (!apply) {
    return {
      apply: false,
      project: DEVSTUDIO_PROJECT_NAME,
      ...beforeDiff,
      payload,
      note: 'Dry run only. Re-run with --apply to patch the Cloudflare Pages project.',
    };
  }
  const after = await patchPagesProject(config, DEVSTUDIO_PROJECT_NAME, payload);
  return {
    apply: true,
    project: DEVSTUDIO_PROJECT_NAME,
    before: beforeDiff.current,
    after: summarizeProjectConfigDiff(after).current,
    matches: summarizeProjectConfigDiff(after).matches,
  };
}

async function inspectDevstudioEnv(config) {
  const project = await getPagesProject(config, DEVSTUDIO_PROJECT_NAME);
  return summarizeDevstudioEnv(project);
}

async function syncDevstudioEnv(config, args) {
  const apply = args.includes('--apply');
  const before = await getPagesProject(config, DEVSTUDIO_PROJECT_NAME);
  const beforeSummary = summarizeDevstudioEnv(before);
  const payload = devstudioEnvPatchPayload();
  if (!apply) {
    return {
      apply: false,
      project: DEVSTUDIO_PROJECT_NAME,
      before: beforeSummary,
      payload: summarizeDevstudioEnvPatchPayload(payload),
      note: 'Dry run only. Re-run with --apply to patch the DevStudio Pages production environment.',
    };
  }
  await patchPagesProject(config, DEVSTUDIO_PROJECT_NAME, payload);
  const after = await getPagesProject(config, DEVSTUDIO_PROJECT_NAME);
  return {
    apply: true,
    project: DEVSTUDIO_PROJECT_NAME,
    before: beforeSummary,
    after: summarizeDevstudioEnv(after),
  };
}

async function preflight(config) {
  const result = {
    token: null,
    account: null,
    pagesProjects: [],
    devstudioDomains: [],
    clickeenZone: null,
    devstudioDns: [],
  };
  result.token = await verifyToken(config);
  result.account = await getAccount(config);
  result.pagesProjects = (await listPagesProjects(config)).map(summarizeProject);
  for (const projectName of ['devstudio']) {
    const project = result.pagesProjects.find((entry) => entry.name === projectName);
    if (!project) continue;
    result.devstudioDomains.push({
      project: projectName,
      domains: (await listPagesDomains(config, projectName)).map(summarizeDomain),
    });
  }
  const zone = await findZone(config, 'clickeen.com');
  if (zone) {
    result.clickeenZone = { id: zone.id, name: zone.name, status: zone.status };
    result.devstudioDns = (await listDnsRecords(config, zone.id, 'devstudio.clickeen.com')).map(summarizeRecord);
  }
  return result;
}

function usage() {
  console.error(`Usage:
  pnpm cf:api:preflight
  pnpm cf:pages:list
  pnpm cf:pages:project <project-name>
  pnpm cf:pages:devstudio-env
  pnpm cf:pages:sync-devstudio-env [--apply]
  pnpm cf:pages:sync-devstudio-project [--apply]
  pnpm cf:pages:domains <project-name>
  pnpm cf:dns:records <zone-name> [record-name]
  pnpm cf:dns:upsert-cname <zone-name> <record-name> <target>

Required env in root .env.local:
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_REST_API_TOKEN

Required token permissions for Pages/DNS:
  Account: Cloudflare Pages Read/Edit as needed
  Account: Account Settings Read
  Zone: Zone Read
  Zone: DNS Read/Edit as needed`);
}

async function main() {
  const config = getConfig();
  const [command, ...args] = process.argv.slice(2);

  if (command === 'preflight') {
    printJson(await preflight(config));
    return;
  }

  if (command === 'pages:list') {
    printJson((await listPagesProjects(config)).map(summarizeProject));
    return;
  }

  if (command === 'pages:project') {
    const projectName = args[0];
    if (!projectName) throw new Error('Missing project name.');
    printJson(summarizeProjectDetails(await getPagesProject(config, projectName)));
    return;
  }

  if (command === 'pages:devstudio-env') {
    printJson(await inspectDevstudioEnv(config));
    return;
  }

  if (command === 'pages:sync-devstudio-env') {
    printJson(await syncDevstudioEnv(config, args));
    return;
  }

  if (command === 'pages:sync-devstudio-project') {
    printJson(await syncDevstudioProject(config, args));
    return;
  }

  if (command === 'pages:domains') {
    const projectName = args[0];
    if (!projectName) throw new Error('Missing project name.');
    printJson((await listPagesDomains(config, projectName)).map(summarizeDomain));
    return;
  }

  if (command === 'dns:records') {
    const [zoneName, recordName] = args;
    if (!zoneName) throw new Error('Missing zone name.');
    const zone = await findZone(config, zoneName);
    if (!zone) throw new Error(`Cloudflare zone not found: ${zoneName}`);
    printJson((await listDnsRecords(config, zone.id, recordName)).map(summarizeRecord));
    return;
  }

  if (command === 'dns:upsert-cname') {
    const [zoneName, recordName, target] = args;
    if (!zoneName || !recordName || !target) throw new Error('Missing zone name, record name, or target.');
    const zone = await findZone(config, zoneName);
    if (!zone) throw new Error(`Cloudflare zone not found: ${zoneName}`);
    const result = await upsertCname(config, zone.id, recordName, target);
    printJson({ action: result.action, record: summarizeRecord(result.record) });
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
