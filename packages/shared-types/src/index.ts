export interface SecretFinding {
  key: string;
  valueRedacted: string;
  source: string;
  category: string;
  confidence: 'High' | 'Medium' | 'Low';
  isSecret: boolean;
  entropyScore?: number;
  provider?: string;
  valueFingerprint?: string;
  isLikelyPublic?: boolean;
  length?: number;
  prefix?: string;
  suffix?: string;
  signals?: string[];
}
export type Status =
  | 'protection_observed'
  | 'potential_weakness'
  | 'informational'
  | 'not_applicable'
  | 'unable_to_assess';
export type Severity = 'informational' | 'low' | 'medium' | 'high' | 'critical';
export type Confidence = 'low' | 'medium' | 'high';
export type Lifecycle =
  | 'new'
  | 'acknowledged'
  | 'investigating'
  | 'accepted risk'
  | 'fixed'
  | 'needs verification'
  | 'verified'
  | 'false positive';
export type EvidenceType =
  | 'document'
  | 'header'
  | 'cookie'
  | 'resource'
  | 'form'
  | 'frame'
  | 'storage'
  | 'technology'
  | 'redirect';
export interface Evidence {
  id: string;
  type: EvidenceType;
  label: string;
  source: string;
  data: unknown;
  redacted: boolean;
  collectedAt: string;
  provenanceSource?: 'page-response' | 'dom' | 'browser-api' | 'extension-request' | 'inference';
  secrets?: SecretFinding[];
  activeProbes?: ActiveProbe[];
  sinks?: SinkFinding[];
  performance?: PerformanceMetrics;
  sourceMapUrls?: string[];
  postMessageHandlers?: number;
}
export interface Resource {
  url: string;
  type: string;
  integrity: string | null;
  crossorigin: string | null;
  thirdParty?: boolean;
  loadedBy?: string;
  observedBy?: string;
}
export interface Form {
  action: string;
  method: string;
  password: boolean;
}
export interface Frame {
  url: string;
  sandbox: string | null;
}
export interface Technology {
  name: string;
  layer: string;
  confidence: Confidence;
  observation: string;
  version: string;
}
export interface CookieMetadata {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  hostOnly: boolean;
  session: boolean;
  expirationDate?: number;
  partitioned: boolean;
  value: '[REDACTED]';
}
export interface ActiveProbe {
  url: string;
  status: number;
  error?: string;
}
export interface SinkFinding {
  type: string;
  node: string;
  attribute: string;
  snippet: string;
}
export interface PerformanceMetrics {
  fcp: number;
  domInteractive: number;
  domComplete: number;
  loadEvent: number;
}
export interface PageSnapshot {
  url: string;
  timeOrigin: number;
  resources: Resource[];
  forms: Form[];
  frames: Frame[];
  indicators: Technology[];
  metaCsp: string[];
  metaReferrer: string | null;
  blankLinks: number;
  storage: { local: number | null; session: number | null; keys?: string[] };
  limits: string[];
  windowKeys?: string[];
  collectedAt: string;
  secrets?: SecretFinding[];
  activeProbes?: ActiveProbe[];
  sinks?: SinkFinding[];
  performance?: PerformanceMetrics;
  sourceMapUrls?: string[];
  postMessageHandlers?: number;
}
export interface ResponseSnapshot {
  url: string;
  headers: Record<string, string[]>;
  statusCode: number;
  collectedAt: string;
  documentId?: string;
  requestId: string;
  startedAt: number;
  urlHash: string;
  redirects: { url: string; destination: string; statusCode: number; collectedAt: string }[];
}
export interface CookieCollection {
  available: boolean;
  cookies: CookieMetadata[];
  limitation: string;
}
export interface AssessmentInput {
  page: PageSnapshot;
  response: ResponseSnapshot | null;
  cookies: CookieCollection;
  browser: string;
  targetKey: string;
}
export interface Finding {
  id: string;
  checkId: string;
  title: string;
  category: string;
  status: Status;
  severity: Severity;
  confidence: Confidence;
  affectedUrl: string;
  observation: string;
  impact: string;
  limitation: string;
  recommendation: string;
  validation: string;
  evidenceIds: string[];
  references: string[];
  lifecycle: Lifecycle;
  firstObserved: string;
  createdAt: string;
}
export interface Coverage {
  area: string;
  status:
    | 'assessed'
    | 'partial'
    | 'not assessed'
    | 'not assessable'
    | 'skipped'
    | 'unsupported'
    | 'blocked by permissions'
    | 'impossible from browser';
  detail: string;
}
export interface Assessment {
  id: string;
  schemaVersion: 2;
  version: string;
  url: string;
  origin: string;
  targetKey: string;
  createdAt: string;
  durationMs: number;
  browser: string;
  kind: 'full' | 'verification';
  selectedCheckId?: string;
  baselineId?: string;
  findings: Finding[];
  evidence: Evidence[];
  resources: Resource[];
  forms: Form[];
  frames: Frame[];
  cookies: CookieMetadata[];
  technologies: Technology[];
  coverage: Coverage[];
  checksCompleted: number;
  checksTotal: number;
  limits: string[];
  windowKeys?: string[];
}
export interface Outcome {
  status: Status;
  observation: string;
  evidenceKeys: string[];
  severity?: Severity;
  confidence?: Confidence;
}
export interface Check {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  method: string;
  impact: string;
  limitation: string;
  recommendation: string;
  learning: string;
  references: string[];
  run: (input: AssessmentInput) => Outcome;
}
export interface LifecycleEvent {
  id: string;
  targetKey: string;
  checkId: string;
  assessmentId: string;
  state: Lifecycle;
  note: string;
  at: string;
}
export interface Settings {
  learningMode: boolean;
  retention: number;
  observedOrigins: string[];
  customHeaders?: { name: string; value: string; domain: string }[];
}

export type ProvenanceSource =
  | 'original-page-response'
  | 'dom'
  | 'browser-api'
  | 'intercepted-request'
  | 'extension-request'
  | 'cli-request'
  | 'inference';
export interface Provenance {
  source: ProvenanceSource;
  collector: string;
  documentId?: string;
  requestId?: string;
  statusCode?: number;
  parentEvidenceIds?: string[];
  limitation?: string;
}
export interface Evidence {
  provenance?: Provenance;
}
export interface Scope {
  origins: string[];
  domains: string[];
  includeSubdomains: boolean;
  pathPrefixes: string[];
  excludedPaths: string[];
  includeThirdParty: boolean;
  authorized: boolean;
  mode: 'passive' | 'supplemental';
  requestBudget: number;
  requestsPerSecond: number;
  maxBytes: number;
  timeoutMs: number;
}
export interface Suppression {
  id: string;
  origin: string;
  checkId: string;
  ruleVersion: string;
  rationale: string;
  actor: string;
  createdAt: string;
  expiresAt: string;
}
export interface Project {
  id: string;
  name: string;
  environments: { name: string; origins: string[] }[];
}
export interface RequestObservation {
  url: string;
  method: string;
  type: string;
  statusCode?: number;
  contentType?: string;
  headers: Record<string, string[]>;
  initiator: string;
  authentication: 'unknown' | 'authorization header present' | 'cookie header present';
  firstObserved: string;
  provenance: Provenance;
}
export interface ApiEndpoint extends RequestObservation {
  category: 'REST' | 'GraphQL' | 'WebSocket' | 'Authentication' | 'Fetch / XHR';
  relationship: 'same-origin' | 'third-party';
}
export interface ScriptAnalysis {
  apis: { name: string; scriptId: string; line: number }[];
  sources: { name: string; scriptId: string; line: number }[];
  flows: {
    source: string;
    sink: string;
    scriptId: string;
    line: number;
    confidence: Confidence;
    method: string;
  }[];
  handlers: {
    scriptId: string;
    line: number;
    originCheck: boolean;
    sourceCheck: boolean;
    validation: 'pattern observed' | 'not resolved';
  }[];
  parsed: number;
  failed: number;
  limitation: string;
}
export interface SourceMapObservation {
  url: string;
  provenance: Provenance;
  status: 'referenced' | 'inspected' | 'blocked' | 'failed';
  sources: string[];
  secrets: SecretFinding[];
  limitation: string;
}
export interface Advisory {
  id: string;
  component: string;
  affectedRange: string;
  fixedVersion: string;
  publishedAt: string;
  updatedAt: string;
  source: string;
}
export interface AdvisoryMatch extends Advisory {
  detectedVersion: string;
  versionConfidence: Confidence;
  versionMatch: boolean;
  runtimeApplicability: 'unknown';
}
export interface PageSnapshot {
  inlineScripts?: { id: string; code: string }[];
  technologyMeta?: { name: string; content: string }[];
  analysis?: ScriptAnalysis;
  sourceMaps?: SourceMapObservation[];
  serviceWorkers?: { scope: string; scriptUrl: string; state: string }[];
  manifestUrl?: string | null;
  crossOriginIsolated?: boolean;
  nonceFingerprints?: string[];
}
export interface Technology {
  versionConfidence?: Confidence;
  signals?: {
    type:
      | 'dom'
      | 'meta'
      | 'resource'
      | 'header'
      | 'cookie'
      | 'inference'
      | 'runtime'
      | 'stylesheet'
      | 'bundle';
    source: string;
    observation: string;
    confidence: Confidence;
  }[];
  detection?: 'observed' | 'inferred';
  fingerprintVersion?: string;
  variant?: string;
  versionSource?: string;
}
export interface Finding {
  ruleVersion?: string;
  suppression?: { active: boolean; reason: string; exception?: Suppression };
  owner?: string;
  reviewState?: string;
}
export interface Check {
  version?: string;
}
export interface ResponseSnapshot {
  provenance?: Provenance;
}
export interface AssessmentInput {
  scope?: Scope;
  permissions?: string[];
  profile?: 'extension-passive' | 'cli-browser';
  enabledChecks?: string[];
  suppressions?: Suppression[];
  requests?: RequestObservation[];
  projectId?: string;
  environment?: string;
  requestedUrl?: string;
}
export interface Assessment {
  ruleSetVersion?: string;
  engineVersion?: string;
  requestedUrl?: string;
  effectiveUrl?: string;
  permissionsGranted?: string[];
  profile?: string;
  enabledChecks?: string[];
  disabledChecks?: string[];
  scope?: Scope;
  timeouts?: string[];
  projectId?: string;
  environment?: string;
  apiEndpoints?: ApiEndpoint[];
  requests?: RequestObservation[];
  advisoryMatches?: AdvisoryMatch[];
  ruleVersions?: Record<string, string>;
  reproducibility?: { reevaluatedFrom?: string; evaluatedAt: string };
}
export interface Settings {
  scopes?: Record<string, Scope>;
  suppressions?: Suppression[];
  projects?: Project[];
  projectId?: string;
  environment?: string;
  analyst?: string;
}
export interface LifecycleEvent {
  actor?: string;
  owner?: string;
  expiresAt?: string;
  reviewRequired?: boolean;
}

export interface Settings {
  cookieInspection?: boolean;
}
export interface SecretFinding {
  location?: {
    scriptId: string;
    url: string;
    line: number;
    column: number;
    propertyPath: string;
    method: string;
  };
}
export interface Assessment {
  supplemental?: { sourceAssessmentId: string; collectedAt: string; urls: string[] };
  importedAt?: string;
  originalId?: string;
}
export interface ReportOptions {
  assessor?: string;
  organization?: string;
  project?: string;
  audience?: 'complete' | 'executive' | 'developer';
  selectedCheckIds?: string[];
  logo?: 'sitelens' | 'none';
}
export interface Settings {
  reportOptions?: ReportOptions;
}
export interface ReportOptions {
  customLogo?: string;
}
