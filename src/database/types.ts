import { ColumnType, Generated, GeneratedAlways, Selectable } from 'kysely';
import { USER_ROLES, USER_STATUS } from '../constants';

type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Role = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];
export interface User {
  id: GeneratedAlways<string>;
  name: string;
  email: string;
  role: Role;
  image: string | null;
  status: Generated<UserStatus>;
  emailVerified: Generated<boolean>;
  banned: Generated<boolean>;
  banReason: string | null;
  banExpires: number | null;
  isDeleted: Generated<boolean>;
  organizationId: Selectable<Organization>['id'] | null;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface Session {
  id: GeneratedAlways<string>;
  token: string;
  expiresAt: Timestamp;
  ipAddress: string | null;
  userAgent: string | null;
  userId: Selectable<User>['id'];
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface Account {
  id: GeneratedAlways<string>;
  accountId: string;
  providerId: string;
  userId: Selectable<User>['id'];
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Timestamp | null;
  refreshTokenExpiresAt: Timestamp | null;
  scope: string | null;
  password: string | null;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface Verification {
  id: GeneratedAlways<string>;
  identifier: string;
  value: string;
  expiresAt: Timestamp;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface Organization {
  id: GeneratedAlways<string>;
  name: string;
  isBanned: Generated<boolean>;
  isDeleted: Generated<boolean>;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface Database {
  user: User;
  session: Session;
  account: Account;
  verification: Verification;
  organization: Organization;
}
