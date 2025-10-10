export function isOwnerOrAdmin(role?: string | null) {
  return role === 'owner' || role === 'admin';
}
