/**
 * Feature Flags and App Constants
 * Section 0 & Section 3 of Master Build Spec
 */

export const PRODUCT_NAME = 'Gist';

// Age gate threshold
// TODO(legal): confirm threshold against Nigerian data protection rules before launch
export const AGE_MINIMUM = 16;
export const AGE_MIN = AGE_MINIMUM;

// 5.5: Crisis resources. Taken from the Gist support screen design. TODO(legal): confirm 112 for Nigeria and
// add named national helplines once verified. findahelpline.com lists free, confidential lines by country.
export const CRISIS_RESOURCES: Array<{ name: string; contact: string; country: string }> = [
  { name: 'Emergency services', contact: '112', country: 'NG' },
  { name: 'Find a helpline near you', contact: 'findahelpline.com', country: '*' },
];

export interface FeatureFlags {
  focus_timer: boolean;
  first_win_screen: boolean;
  yesterday_story: boolean;
  web_push: boolean;
  dev_tools: boolean;
  demo_data: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  focus_timer: false,
  first_win_screen: false,
  yesterday_story: false,
  web_push: false,
  dev_tools: process.env.NODE_ENV !== 'production',
  demo_data: false,
};

export const FEATURE_FLAGS = DEFAULT_FLAGS;

export function getFeatureFlag<K extends keyof FeatureFlags>(flag: K): boolean {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`gist_flag_${flag}`);
      if (stored !== null) return stored === 'true';
    } catch {}
  }
  return DEFAULT_FLAGS[flag];
}

export function setFeatureFlag<K extends keyof FeatureFlags>(flag: K, value: boolean): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`gist_flag_${flag}`, String(value));
    } catch {}
  }
}
