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
  // Incremental-clustering watermark: NULL = not yet assigned to a cluster.
  clusterId: Selectable<BehaviourCluster>['id'] | null;
  createdAt: GeneratedAlways<Timestamp>;
}

export interface BehaviourCluster {
  id: GeneratedAlways<string>;
  organizationId: Selectable<Organization>['id'];
  callType: Selectable<CallType>['id'];
  type: string; // behaviour type shared by all members
  centroid: string | null; // pgvector average of member embeddings (filled by the per-run stats pass)
  label: string; // most common behaviour text
  memberCount: Generated<number>;
  signalPrecedingCount: Generated<number>;
  // Mean turn position of members — used later to bucket clusters into playbook phases.
  avgTurnPosition: Generated<number>;
  // Member count at the last insight synthesis — drives the refresh-delta check.
  lastInsightMemberCount: Generated<number>;
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
  organizationId: Selectable<Organization>['id'];
  callType: Selectable<CallType>['id'];
  // One insight per cluster — upsert target + stable identity across runs.
  clusterId: Selectable<BehaviourCluster>['id'];
  pattern: string;
  signalType: string;
  // Share-of-cluster by distinct users (sum to 1). Refreshed every run.
  topRepFrequency: Generated<number>;
  otherRepFrequency: Generated<number>;
  createdAt: GeneratedAlways<Timestamp>;
  // Bumped only on material content change — drives the "New" pill + future playbook gate.
  updatedAt: Generated<Timestamp>;
}

export interface InsightGeneration {
  id: GeneratedAlways<string>;
  organizationId: Selectable<Organization>['id'];
  callType: Selectable<CallType>['id'];
  // Boundary for counting new calls (call.createdAt > lastGeneratedAt) AND last-run time.
  lastGeneratedAt: Generated<Timestamp>;
  isLocked: Generated<boolean>;
  createdAt: GeneratedAlways<Timestamp>;
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
  behaviour_cluster: BehaviourCluster;
  playbook: Playbook;
  playbook_phase: PlaybookPhase;
  playbook_pattern: PlaybookPattern;
  insight: Insight;
  insight_generation: InsightGeneration;
}
