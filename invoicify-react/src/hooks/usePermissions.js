import { useData } from '../context/DataContext';
import { ROLE_PERMISSIONS } from '../utils/format';

export function usePermissions() {
  const { currentUser } = useData();
  const role = currentUser?.role || 'admin';
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin;

  const can = (permission) => !!perms[permission];

  return { role, can };
}
