export const USER_STATUS = {
  INVITED: 'invited',
  ACTIVE: 'active',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  ORG_ADMIN: 'org-admin',
  SALES_REP: 'sales-rep',
} as const;

export const DEFAULT_BANNED_MESSAGE =
  'This account is banned, contact your admin or support';
