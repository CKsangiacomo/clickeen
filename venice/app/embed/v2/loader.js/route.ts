export { GET } from '../loader';
export const runtime = process.env.NODE_ENV === 'development' ? 'nodejs' : 'edge';
