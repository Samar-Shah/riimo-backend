import { ColumnType, Generated, GeneratedAlways, Selectable } from 'kysely';

export type Role = 'admin' | 'org-admin' | 'sales-rep';

type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface User {
  id: GeneratedAlways<string>;
  name: string;
  email: string;
  role: Role;
  image: string | null;
  emailVerified: Generated<boolean>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Session {
  id: GeneratedAlways<string>;
  token: string;
  expiresAt: Timestamp;
  ipAddress: string | null;
  userAgent: string | null;
  userId: Selectable<User>['id'];
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Verification {
  id: GeneratedAlways<string>;
  identifier: string;
  value: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Database {
  user: User;
  session: Session;
  account: Account;
  verification: Verification;
}
