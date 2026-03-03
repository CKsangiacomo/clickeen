#!/usr/bin/env node
import { webcrypto } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUTPUT_PATH = join(ROOT_DIR, 'berlin', '.dev.vars');

function toPem(keyData, label) {
  const b64 = Buffer.from(keyData).toString('base64');
  const lines = b64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

async function main() {
  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );

  const privateRaw = await webcrypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const publicRaw = await webcrypto.subtle.exportKey('spki', keyPair.publicKey);

  const privatePem = toPem(privateRaw, 'PRIVATE KEY');
  const publicPem = toPem(publicRaw, 'PUBLIC KEY');

  const refreshSecret = webcrypto.getRandomValues(new Uint8Array(32));
  const refreshSecretHex = Buffer.from(refreshSecret).toString('hex');

  // Wrangler .dev.vars uses dotenv format. Encode newlines as literal \n within quotes.
  const escapedPrivate = privatePem.replace(/\n/g, '\\n');
  const escapedPublic = publicPem.replace(/\n/g, '\\n');

  // Preserve any existing non-key vars from .dev.vars if present.
  let existingLines = [];
  if (existsSync(OUTPUT_PATH)) {
    const existing = readFileSync(OUTPUT_PATH, 'utf8');
    existingLines = existing
      .split('\n')
      .filter(
        (line) =>
          line.trim() &&
          !line.startsWith('#') &&
          !line.startsWith('BERLIN_ACCESS_PRIVATE_KEY_PEM') &&
          !line.startsWith('BERLIN_ACCESS_PUBLIC_KEY_PEM') &&
          !line.startsWith('BERLIN_REFRESH_SECRET'),
      );
  }

  const keyLines = [
    `BERLIN_ACCESS_PRIVATE_KEY_PEM="${escapedPrivate}"`,
    `BERLIN_ACCESS_PUBLIC_KEY_PEM="${escapedPublic}"`,
    `BERLIN_REFRESH_SECRET="${refreshSecretHex}"`,
  ];

  const content = [...existingLines, ...keyLines].join('\n') + '\n';
  writeFileSync(OUTPUT_PATH, content, 'utf8');

  console.log(`[generate-berlin-keys] Wrote RSA-2048 keypair + refresh secret to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(`[generate-berlin-keys] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
