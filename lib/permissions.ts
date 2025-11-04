import { UserRole, Permission, RolePermissions } from '@/types';

export const rolePermissionsMap: RolePermissions[] = [
  {
    role: 'super-admin',
    permissions: [
      'view:dashboard',
      'view:crm',
      'edit:crm',
      'view:estimates',
      'create:estimates',
      'view:projects',
      'edit:projects',
      'view:reports',
      'view:contracts',
      'view:schedule',
      'edit:schedule',
      'view:chat',
      'send:chat',
      'view:photos',
      'add:photos',
      'delete:photos',
      'add:expenses',
      'delete:expenses',
      'clock:in-out',
      'chatbot:unrestricted',
    ],
  },
  {
    role: 'admin',
    permissions: [
      'view:dashboard',
      'view:crm',
      'edit:crm',
      'view:estimates',
      'create:estimates',
      'view:projects',
      'edit:projects',
      'view:reports',
      'view:contracts',
      'view:schedule',
      'edit:schedule',
      'view:chat',
      'send:chat',
      'view:photos',
      'add:photos',
      'delete:photos',
      'add:expenses',
      'delete:expenses',
      'clock:in-out',
      'chatbot:unrestricted',
    ],
  },
  {
    role: 'salesperson',
    permissions: [
      'view:crm',
      'edit:crm',
      'view:estimates',
      'create:estimates',
      'view:schedule',
      'edit:schedule',
      'view:chat',
      'send:chat',
      'view:photos',
      'add:photos',
      'chatbot:no-financials',
    ],
  },
  {
    role: 'field-employee',
    permissions: [
      'view:photos',
      'add:photos',
      'add:expenses',
      'clock:in-out',
      'view:chat',
      'send:chat',
      'chatbot:basic-only',
    ],
  },
];

export const getPermissionsForRole = (role: UserRole): Permission[] => {
  const roleData = rolePermissionsMap.find(r => r.role === role);
  return roleData?.permissions || [];
};

export const hasPermission = (userRole: UserRole, permission: Permission): boolean => {
  const permissions = getPermissionsForRole(userRole);
  return permissions.includes(permission);
};

export const hasAnyPermission = (userRole: UserRole, permissions: Permission[]): boolean => {
  return permissions.some(permission => hasPermission(userRole, permission));
};

export const hasAllPermissions = (userRole: UserRole, permissions: Permission[]): boolean => {
  return permissions.every(permission => hasPermission(userRole, permission));
};

export const getChatbotRestrictionLevel = (userRole: UserRole): 'unrestricted' | 'no-financials' | 'basic-only' => {
  if (hasPermission(userRole, 'chatbot:unrestricted')) {
    return 'unrestricted';
  }
  if (hasPermission(userRole, 'chatbot:no-financials')) {
    return 'no-financials';
  }
  return 'basic-only';
};

const financialKeywords = [
  'price', 'pricing', 'cost', 'costs', 'estimate total', 'markup', 'profit', 'revenue',
  'payment', 'invoice', 'budget', 'financial', 'contract', 'legal', 'terms',
  'how much', 'expense', 'paid', 'charge', 'fee', 'dollar', '$', 'money',
  'analytics', 'report', 'balance', 'income', 'wage', 'salary', 'breakdown'
];

const estimateKeywords = [
  'estimate', 'estimates', 'pricing', 'cost breakdown', 'quote', 'bid', 'proposal'
];

export const shouldBlockChatbotQuery = (userRole: UserRole, query: string): { shouldBlock: boolean; reason?: string } => {
  const restrictionLevel = getChatbotRestrictionLevel(userRole);
  const lowerQuery = query.toLowerCase();

  if (restrictionLevel === 'unrestricted') {
    return { shouldBlock: false };
  }

  const hasFinancialKeyword = financialKeywords.some(keyword => lowerQuery.includes(keyword));

  if (restrictionLevel === 'no-financials' && hasFinancialKeyword) {
    return {
      shouldBlock: true,
      reason: "I'm sorry, I can't provide details about prices, contracts, or financials. Please contact your admin.",
    };
  }

  if (restrictionLevel === 'basic-only') {
    const hasEstimateKeyword = estimateKeywords.some(keyword => lowerQuery.includes(keyword));
    if (hasFinancialKeyword || hasEstimateKeyword) {
      return {
        shouldBlock: true,
        reason: "I'm sorry, I can't provide details about prices, contracts, or financials. Please contact your admin.",
      };
    }
  }

  return { shouldBlock: false };
};

export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    'super-admin': 'Super Admin',
    'admin': 'Admin',
    'salesperson': 'Salesperson',
    'field-employee': 'Field Employee',
  };
  return roleNames[role];
};

export const getAvailableRolesForManagement = (userRole: UserRole): UserRole[] => {
  if (userRole === 'super-admin') {
    return ['admin', 'salesperson', 'field-employee'];
  }
  if (userRole === 'admin') {
    return ['salesperson', 'field-employee'];
  }
  return [];
};
