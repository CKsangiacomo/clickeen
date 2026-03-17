#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function normalizeHeaders(rawHeaders) {
  if (!rawHeaders) return [];
  if (rawHeaders instanceof Headers) {
    return Array.from(rawHeaders.entries());
  }
  return Object.entries(rawHeaders);
}

export function requestLoopback(url, options = {}) {
  const {
    method = 'GET',
    headers = null,
    body = null,
    discardBody = false,
    maxTimeSeconds = 10,
  } = options;

  const args = ['--silent', '--show-error', '--location', '--request', method];
  if (Number.isFinite(maxTimeSeconds) && maxTimeSeconds > 0) {
    args.push('--max-time', String(Math.max(1, Math.floor(maxTimeSeconds))));
  }
  for (const [key, value] of normalizeHeaders(headers)) {
    args.push('--header', `${key}: ${value}`);
  }

  if (body != null) {
    args.push('--data-binary', '@-');
  }

  if (discardBody) {
    args.push('--output', '/dev/null', '--write-out', '%{http_code}');
  } else {
    args.push('--output', '-', '--write-out', '\n%{http_code}');
  }

  args.push(url);

  const result = spawnSync('curl', args, {
    encoding: 'utf8',
    input: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

  if (result.error) throw result.error;

  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '').trim();
  if (result.status !== 0 && !stdout) {
    throw new Error(stderr || `curl failed for ${url}`);
  }

  if (discardBody) {
    const status = Number.parseInt(stdout.trim(), 10);
    if (!Number.isFinite(status)) {
      throw new Error(`invalid curl status for ${url}`);
    }
    return { status, ok: status >= 200 && status < 300, text: '' };
  }

  const boundary = stdout.lastIndexOf('\n');
  const text = boundary >= 0 ? stdout.slice(0, boundary) : '';
  const statusText = boundary >= 0 ? stdout.slice(boundary + 1).trim() : stdout.trim();
  const status = Number.parseInt(statusText, 10);
  if (!Number.isFinite(status)) {
    throw new Error(`invalid curl status for ${url}`);
  }
  return { status, ok: status >= 200 && status < 300, text };
}

export function requestLoopbackJson(url, options = {}) {
  const response = requestLoopback(url, options);
  return {
    ...response,
    json: response.text ? JSON.parse(response.text) : null,
  };
}
