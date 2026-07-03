import { ColumnType, Generated, GeneratedAlways, Selectable } from 'kysely';
import { USER_ROLES, USER_STATUS } from '../constants';

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

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
  banExpires: Timestamp | null;
  isDeleted: Generated<boolean>;
  isTopRep: Generated<boolean>;
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

export interface CallType {
  id: GeneratedAlways<string>;
  name: string;
}

export interface Call {
  id: GeneratedAlways<string>;
  userId: Selectable<User>['id'];
  callTypeId: Selectable<CallType>['id'];
  durationInSeconds: number;
  totalSegments: number;
  totalAnalyses: number;
  finalPhase: number | null;
  transcript: Generated<Record<string, any>[]>;
  buyingSignals: Generated<Record<string, any>[]>;
  patternExecutions: Generated<Record<string, any>[]>;
  isNextMeetingBooked: Generated<boolean>;
  endedAt: Timestamp;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface CallBehaviour {
  id: GeneratedAlways<string>;
  callId: Selectable<Call>['id'];
  type: string;
  behaviour: string;
  turnPosition: number;
  embedding: string | null;
  precededSignal: Generated<boolean>;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface Playbook {
  id: GeneratedAlways<string>;
  organizationId: Selectable<Organization>['id'];
  callTypeId: Selectable<CallType>['id'];
  version: number;
  versionChange: string;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface PlaybookPhase {
  id: GeneratedAlways<string>;
  playbookId: Selectable<Playbook>['id'];
  name: string;
  order: number;
  confidence: Generated<number>;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface PlaybookPattern {
  id: GeneratedAlways<string>;
  playbookPhaseId: Selectable<PlaybookPhase>['id'];
  name: string;
  guideline: string;
  signalType: string;
  order: number;
  confidence: Generated<number>;
  topRepFrequency: Generated<number>;
  otherRepFrequency: Generated<number>;
  pValue: number | null;
  oddsRatio: number | null;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface Insight {
  id: GeneratedAlways<string>;
  pattern: string;
  signalType: string;
  createdAt: GeneratedAlways<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface Database {
  user: User;
  session: Session;
  account: Account;
  verification: Verification;
  organization: Organization;
  call_type: CallType;
  call: Call;
  call_behaviour: CallBehaviour;
  playbook: Playbook;
  playbook_phase: PlaybookPhase;
  playbook_pattern: PlaybookPattern;
  insight: Insight;
}
