import { OnboardingFact, ExtractorRawFact } from './types';
import { parseDueText } from './date-parser';
import { sanitizeText } from '@/config/onboarding-prompts';

export function normalizeEntity(entity: string | null): string {
  if (!entity) return '';
  return entity
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeValue(val: string): string {
  return val
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function areValuesSimilar(v1: string, v2: string): boolean {
  const n1 = normalizeValue(v1);
  const n2 = normalizeValue(v2);

  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  // Substring check if substantial
  if (n1.includes(n2) && n2.length / n1.length > 0.6) return true;
  if (n2.includes(n1) && n1.length / n2.length > 0.6) return true;

  // Token Jaccard similarity
  const tokens1 = new Set(n1.split(' ').filter(Boolean));
  const tokens2 = new Set(n2.split(' ').filter(Boolean));

  let intersection = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) intersection++;
  });

  const union = new Set([...tokens1, ...tokens2]).size;
  if (union === 0) return false;

  const jaccard = intersection / union;
  return jaccard >= 0.65;
}

/**
 * Checks if a candidate raw fact is valid (not just a name, not empty)
 */
export function isValidFact(raw: ExtractorRawFact): boolean {
  if (!raw.value || typeof raw.value !== 'string') return false;
  const cleanVal = raw.value.trim();
  if (cleanVal.length < 3) return false;

  // Rule: Do not create a fact that is only a name
  if (raw.category === 'people') {
    const normEnt = normalizeEntity(raw.entity);
    const normVal = normalizeValue(raw.value);
    if (!normEnt && normVal.split(' ').length <= 2) {
      // Vague name without relationship
      return false;
    }
    if (normEnt && normVal === normEnt) {
      // Value is ONLY the person's name
      return false;
    }
  }

  return true;
}

/**
 * Deduplicates and attaches new raw facts against existing facts.
 * Handles supersedes and people consolidation.
 */
export function processNewFacts(
  rawFacts: ExtractorRawFact[],
  existingFacts: OnboardingFact[],
  currentTurn: number,
  nowIso: string
): { updatedExisting: OnboardingFact[]; newlyAdded: OnboardingFact[]; supersededCount: number } {
  let factsPool = [...existingFacts];
  const newlyAdded: OnboardingFact[] = [];
  let supersededCount = 0;

  for (const raw of rawFacts) {
    if (!isValidFact(raw)) continue;

    const rawCategory = raw.category;
    const rawEntityNorm = normalizeEntity(raw.entity);
    const cleanValue = sanitizeText(raw.value);

    // 1. Explicit supersedes from model
    if (raw.supersedes) {
      const targetOld = factsPool.find(f => f.id === raw.supersedes && f.status === 'active');
      if (targetOld) {
        targetOld.status = 'superseded';
        supersededCount++;
      }
    }

    // 2. Special handling for category 'people':
    // "People are stored once per person. Facts about a person attach to that person record."
    if (rawCategory === 'people' && rawEntityNorm) {
      const existingPerson = factsPool.find(
        f => f.category === 'people' && normalizeEntity(f.entity) === rawEntityNorm && f.status === 'active'
      );

      if (existingPerson) {
        // If the new fact mentions the same person, check if it's already recorded
        if (areValuesSimilar(existingPerson.value, cleanValue)) {
          // Exact duplicate, skip
          continue;
        }

        // Attach / update to that person record by superseding old record with combined info
        existingPerson.status = 'superseded';
        supersededCount++;

        const updatedPersonFact: OnboardingFact = {
          id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          user_id: existingPerson.user_id,
          category: 'people',
          entity: existingPerson.entity || raw.entity,
          value: sanitizeText(`${existingPerson.value}; ${cleanValue}`),
          evidence: sanitizeText(raw.evidence || existingPerson.evidence),
          epistemic_state: raw.epistemic_state || 'stated',
          state: null,
          due_text: null,
          due_at: null,
          supersedes_id: existingPerson.id,
          status: 'active',
          created_at: nowIso,
          source_turn: currentTurn,
        };

        factsPool.push(updatedPersonFact);
        newlyAdded.push(updatedPersonFact);
        continue;
      }
    }

    // 3. Dedupe in code: same category + normalised entity + similar value is skipped
    const isDuplicate = factsPool.some(f => {
      if (f.status !== 'active') return false;
      if (f.category !== rawCategory) return false;
      const sameEntity = normalizeEntity(f.entity) === rawEntityNorm;
      if (sameEntity && areValuesSimilar(f.value, cleanValue)) {
        return true;
      }
      return false;
    });

    if (isDuplicate) {
      continue;
    }

    // 4. Check if an active fact should be superseded automatically (e.g., waiting/unfinished commitment)
    if (rawCategory === 'commitments' && rawEntityNorm) {
      const prevCommitment = factsPool.find(
        f => f.category === 'commitments' &&
             f.status === 'active' &&
             normalizeEntity(f.entity) === rawEntityNorm
      );
      if (prevCommitment && raw.state === 'done') {
        prevCommitment.status = 'superseded';
        supersededCount++;
      }
    }

    // 5. Build new fact record
    const dueAt = parseDueText(raw.due_text, nowIso);
    const newFact: OnboardingFact = {
      id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: null,
      category: rawCategory,
      entity: raw.entity ? sanitizeText(raw.entity) : null,
      value: cleanValue,
      evidence: sanitizeText(raw.evidence || ''),
      epistemic_state: raw.epistemic_state === 'hypothesized' ? 'hypothesized' : 'stated',
      state: raw.state || null,
      due_text: raw.due_text ? sanitizeText(raw.due_text) : null,
      due_at: dueAt,
      supersedes_id: raw.supersedes || null,
      status: 'active',
      created_at: nowIso,
      source_turn: currentTurn,
    };

    factsPool.push(newFact);
    newlyAdded.push(newFact);
  }

  return {
    updatedExisting: factsPool,
    newlyAdded,
    supersededCount,
  };
}
