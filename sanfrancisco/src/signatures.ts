import { timingSafeEqualString } from '@clickeen/ck-contracts/security';
import { HttpError } from './http';

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return base64UrlEncodeBytes(new Uint8Array(sig));
}

export async function verifyBodySignature(args: {
  signature: string | null;
  secret: string | null;
  message: string;
  missingSecretMessage: string;
}): Promise<void> {
  const provided = typeof args.signature === 'string' ? args.signature.trim() : '';
  if (!provided) {
    throw new HttpError(401, { code: 'CAPABILITY_DENIED', message: 'Missing signature' });
  }
  const secret = typeof args.secret === 'string' ? args.secret.trim() : '';
  if (!secret) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: args.missingSecretMessage });
  }
  const expected = await hmacSha256Base64Url(secret, args.message);
  if (!timingSafeEqualString(provided, expected)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: 'Invalid signature' });
  }
}
