import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';

const statement = { ...defaultStatements } as const;

export const ac = createAccessControl(statement);

// Full admin — every default admin permission (incl. impersonate)
export const admin = ac.newRole({ ...adminAc.statements });

// Org-admin — only the better-auth API surface they actually hit.
// All other org-admin routes are plain Kysely queries (this.db), which are
// NOT permission-gated. Their auth.api calls are: createUser (invite-sales-rep)
// + banUser/unbanUser. unban reuses the 'ban' permission.
export const orgAdmin = ac.newRole({
  user: ['create', 'ban'],
  session: ['revoke'],
});
