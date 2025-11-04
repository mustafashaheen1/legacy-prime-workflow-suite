import { useApp } from '@/contexts/AppContext';
import { Permission } from '@/types';
import { hasPermission, hasAnyPermission, hasAllPermissions, getChatbotRestrictionLevel, shouldBlockChatbotQuery } from '@/lib/permissions';

export const usePermissions = () => {
  const { user } = useApp();

  const checkPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  };

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    if (!user) return false;
    return hasAnyPermission(user.role, permissions);
  };

  const checkAllPermissions = (permissions: Permission[]): boolean => {
    if (!user) return false;
    return hasAllPermissions(user.role, permissions);
  };

  const getChatbotLevel = () => {
    if (!user) return 'basic-only' as const;
    return getChatbotRestrictionLevel(user.role);
  };

  const checkChatbotQuery = (query: string) => {
    if (!user) return { shouldBlock: true, reason: 'User not authenticated' };
    return shouldBlockChatbotQuery(user.role, query);
  };

  return {
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    getChatbotRestrictionLevel: getChatbotLevel,
    shouldBlockChatbotQuery: checkChatbotQuery,
    userRole: user?.role,
    isAdmin: user?.role === 'admin' || user?.role === 'super-admin',
    isSuperAdmin: user?.role === 'super-admin',
    isSalesperson: user?.role === 'salesperson',
    isFieldEmployee: user?.role === 'field-employee',
  };
};
