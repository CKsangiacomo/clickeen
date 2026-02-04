export { GET } from '../../v2/loader';
export const runtime = process.env.NODE_ENV === 'development' ? 'nodejs' : 'edge';
