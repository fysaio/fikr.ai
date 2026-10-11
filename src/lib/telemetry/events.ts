/**
 * Content-Free Telemetry & Instrumentation for Entry and Auth Screens
 * Section 7 of Build Spec
 * Payloads carry event name, timestamp and an anonymous session id only.
 * No emails, names, ages or passwords, and no raw age on under_age_blocked.
 */

export type AuthTelemetryEvent =
  | 'welcome_viewed'
  | 'you_submitted'
  | 'under_age_blocked'
  | 'signup_succeeded'
  | 'signup_failed'
  | 'login_succeeded'
  | 'login_failed'
  | 'forgot_requested'
  | 'reset_succeeded'
  | 'reset_link_expired';

export type OnboardingTelemetryEvent =
  | 'onboarding_started'
  | 'turn_submitted'
  | 'facts_extracted'
  | 'fact_edited'
  | 'fact_forgotten'
  | 'vent_branch_chosen'
  | 'enough_for_now'
  | 'onboarding_ready'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'model_error';

export interface TelemetryPayload {
  event: AuthTelemetryEvent | OnboardingTelemetryEvent;
  timestamp: string;
  sessionId: string;
  errorType?: string;
  uiType?: string;
  slotTarget?: string;
  latencyMs?: number;
  modelUsed?: string;
  fallbackUsed?: boolean;
  factsCount?: number;
  turnCount?: number;
  categories?: string[];
  chosenOption?: string;
  tokenCost?: number;
}

function getAnonymousSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  try {
    let id = sessionStorage.getItem('gist_anon_session_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now().toString(36);
      sessionStorage.setItem('gist_anon_session_id', id);
    }
    return id;
  } catch {
    return 'fallback_session';
  }
}

// In-memory log of recent events for inspection and audit
const recentTelemetryEvents: TelemetryPayload[] = [];

export function trackAuthEvent(event: AuthTelemetryEvent, extra?: { errorType?: string }) {
  const payload: TelemetryPayload = {
    event,
    timestamp: new Date().toISOString(),
    sessionId: getAnonymousSessionId(),
    ...(extra?.errorType ? { errorType: extra.errorType } : {}),
  };

  recentTelemetryEvents.push(payload);
  if (recentTelemetryEvents.length > 50) {
    recentTelemetryEvents.shift();
  }

  // Debug log in dev mode (never logs PII or credentials)
  if (process.env.NODE_ENV !== 'production') {
    // console.info('[Telemetry]', payload.event, { sessionId: payload.sessionId, timestamp: payload.timestamp });
  }

  // Dispatch custom window event if available
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('gist_telemetry_event', { detail: payload }));
    } catch {}
  }
}

export function trackOnboardingEvent(
  event: OnboardingTelemetryEvent,
  extra?: Omit<TelemetryPayload, 'event' | 'timestamp' | 'sessionId'>
) {
  const payload: TelemetryPayload = {
    event,
    timestamp: new Date().toISOString(),
    sessionId: getAnonymousSessionId(),
    ...(extra || {}),
  };

  recentTelemetryEvents.push(payload);
  if (recentTelemetryEvents.length > 50) {
    recentTelemetryEvents.shift();
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('gist_telemetry_event', { detail: payload }));
    } catch {}
  }
}

export function getRecentTelemetryEvents(): TelemetryPayload[] {
  return [...recentTelemetryEvents];
}
