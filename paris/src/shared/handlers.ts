import { json } from './http';

export async function handleHealthz(): Promise<Response> {
  return json({ up: true });
}
