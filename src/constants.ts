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

export const CALL_TYPES = {
  DISCOVERY: 'discovery',
} as const;

export const INSIGHT_CONFIG = {
  CALLS_PER_GENERATION: 10, // TRIGGER: generate every N NEW calls (per org, per call type) since last watermark
  SIMILARITY_THRESHOLD: 0.82, // cosine similarity cutoff for assignment + the behaviour graph (desktop default)
  MIN_CLUSTER_SIZE: 2, // drop singletons — a lone behaviour is not a repeatable pattern
  KNN_K: 10, // neighbours per row when mini-clustering unmatched behaviours
  MAX_CLUSTERS_TO_LLM: 30, // cap how many changed clusters go to the LLM per run
  INSIGHT_REFRESH_DELTA: 3, // re-synthesize a cluster's insight once it gains >= this many members since its last insight
  GENERATION_LOCK_TTL_MINUTES: 15, // stale-lock guard: reclaim if a run crashed while isLocked=true
};

// signalType is LLM-assigned but constrained to these (Zod enum). Mirrors desktop SignalLevel + a no-signal value.
export const SIGNAL_TYPES = {
  COMMITMENT: 'commitment',
  INTENT: 'intent',
  STRONG: 'strong',
  MEDIUM: 'medium',
  NEUTRAL: 'neutral',
} as const;
