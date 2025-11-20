import fs from 'node:fs';
import path from 'node:path';

interface EnvRecord {
  [key: string]: string;
}

function parseEnv(source: string): EnvRecord {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<EnvRecord>((acc, line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return acc;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

export function ensureSupabaseEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_JWT_SECRET) {
    return;
  }

  const candidateFiles = [
    // Repo root supabase/.env when running from project root
    path.resolve(process.cwd(), 'supabase', '.env'),
    // Repo root supabase/.env when cwd is /paris
    path.resolve(process.cwd(), '..', 'supabase', '.env'),
    // Repo root supabase/.env when cwd is /.next/server or similar
    path.resolve(process.cwd(), '../..', 'supabase', '.env'),
  ];

  let content: string | null = null;

  for (const file of candidateFiles) {
    try {
      content = fs.readFileSync(file, 'utf-8');
      break;
    } catch {
      // Try next candidate
    }
  }

  if (!content) return;

  const env = parseEnv(content);
  if (env.SUPABASE_URL && !process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = env.SUPABASE_URL;
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (env.SUPABASE_JWT_SECRET && !process.env.SUPABASE_JWT_SECRET) {
    process.env.SUPABASE_JWT_SECRET = env.SUPABASE_JWT_SECRET;
  }
}
