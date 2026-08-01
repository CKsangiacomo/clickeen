const CK_GRANT_PREFIX = 'ckgrant';
const RS256_ALGORITHM = 'RSASSA-PKCS1-v1_5';

export type RomaAiGrantEnvelope = {
  payloadB64: string;
  signatureB64: string;
  payload: unknown;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] || 0);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function readPemBytes(pem: string, label: 'PRIVATE KEY' | 'PUBLIC KEY'): Uint8Array {
  const normalized = String(pem || '').trim();
  const begin = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  if (!normalized.startsWith(begin) || !normalized.endsWith(end)) {
    throw new Error(`[ck-policy] Invalid Roma AI grant ${label.toLowerCase()} PEM`);
  }
  const encoded = normalized.slice(begin.length, -end.length).replace(/\s+/g, '');
  if (!encoded) throw new Error(`[ck-policy] Empty Roma AI grant ${label.toLowerCase()} PEM`);
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error(`[ck-policy] Invalid Roma AI grant ${label.toLowerCase()} PEM`);
  }
}

async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(readPemBytes(privateKeyPem, 'PRIVATE KEY')),
    { name: RS256_ALGORITHM, hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function importPublicKey(publicKeyPem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'spki',
    toArrayBuffer(readPemBytes(publicKeyPem, 'PUBLIC KEY')),
    { name: RS256_ALGORITHM, hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

export function readRomaAiGrantEnvelope(grant: string): RomaAiGrantEnvelope | null {
  const parts = String(grant || '').split('.');
  if (parts.length !== 3 || parts[0] !== CK_GRANT_PREFIX || !parts[1] || !parts[2]) return null;
  const payloadBytes = fromBase64Url(parts[1]);
  if (!payloadBytes) return null;
  try {
    return {
      payloadB64: parts[1],
      signatureB64: parts[2],
      payload: JSON.parse(new TextDecoder().decode(payloadBytes)) as unknown,
    };
  } catch {
    return null;
  }
}

export async function mintRomaAiGrant(payload: object, privateKeyPem: string): Promise<string> {
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const message = `${CK_GRANT_PREFIX}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    RS256_ALGORITHM,
    await importPrivateKey(privateKeyPem),
    new TextEncoder().encode(message),
  );
  return `${message}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyRomaAiGrantSignature(
  envelope: Pick<RomaAiGrantEnvelope, 'payloadB64' | 'signatureB64'>,
  publicKeyPem: string,
): Promise<boolean> {
  const signature = fromBase64Url(envelope.signatureB64);
  if (!signature) return false;
  return await crypto.subtle.verify(
    RS256_ALGORITHM,
    await importPublicKey(publicKeyPem),
    toArrayBuffer(signature),
    new TextEncoder().encode(`${CK_GRANT_PREFIX}.${envelope.payloadB64}`),
  );
}
