#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function printHelp() {
  console.log(`Usage: ensure-queues --queue <name> [--queue <name> ...]
       ensure-queues --queues <name,name,...>

Ensures Cloudflare Queues exist by creating missing queues.
`);
}

const args = process.argv.slice(2);
const queues = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--queue') {
    const value = args[i + 1];
    if (!value) {
      console.error('[ensure-queues] Missing value for --queue');
      process.exit(1);
    }
    queues.push(value);
    i += 1;
    continue;
  }
  if (arg === '--queues') {
    const value = args[i + 1];
    if (!value) {
      console.error('[ensure-queues] Missing value for --queues');
      process.exit(1);
    }
    queues.push(...value.split(',').map((q) => q.trim()).filter(Boolean));
    i += 1;
    continue;
  }
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
  console.error(`[ensure-queues] Unknown argument: ${arg}`);
  printHelp();
  process.exit(1);
}

const uniqueQueues = Array.from(new Set(queues)).filter(Boolean);
if (uniqueQueues.length === 0) {
  console.error('[ensure-queues] No queues provided.');
  printHelp();
  process.exit(1);
}

function runWranglerCreate(queueName) {
  const res = spawnSync('wrangler', ['queues', 'create', queueName], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (res.status === 0) {
    console.log(`[ensure-queues] Created ${queueName}`);
    return;
  }
  const output = `${res.stdout || ''}\n${res.stderr || ''}`.toLowerCase();
  const existsMarkers = [
    'already exists',
    'queue already exists',
    'already taken',
    'code: 11009',
  ];
  if (existsMarkers.some((marker) => output.includes(marker))) {
    console.log(`[ensure-queues] Exists ${queueName}`);
    return;
  }
  console.error(`[ensure-queues] Failed to create ${queueName}`);
  if (res.stdout) process.stderr.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  process.exit(res.status ?? 1);
}

uniqueQueues.forEach((queueName) => runWranglerCreate(queueName));
