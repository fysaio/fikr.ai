import { clean } from '@/lib/sanitizer';
import { parseDateExpression } from '@/lib/date/handler';
import { Fact, Entity, FactCategory, EpistemicLevel, FactState, FactSource } from '@/lib/models/schema';

export interface RawExtractedFact {
  category: FactCategory;
  entity?: string | null;
  relationship?: string | null;
  text: string;
  evidence?: string | null;
  epistemic?: EpistemicLevel;
  state?: FactState;
  due_text?: string | null;
  since_text?: string | null;
  supersedes?: string | null;
}

export function computeTextHash(text: string): string {
  const norm = clean(text).toLowerCase().replace(/[^\w]/g, '');
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash));
}

export function normalizeEntityName(name: string | null | undefined): string {
  if (!name) return '';
  return clean(name).toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Calculates dice coefficient for fuzzy text similarity (0.0 to 1.0)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const n1 = clean(s1).toLowerCase().replace(/[^\w\s]/g, '').trim();
  const n2 = clean(s2).toLowerCase().replace(/[^\w\s]/g, '').trim();

  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0.0;
  if (n1.length < 2 || n2.length < 2) return n1 === n2 ? 1.0 : 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const b1 = getBigrams(n1);
  const b2 = getBigrams(n2);

  let intersection = 0;
  for (const [bigram, count] of b1.entries()) {
    if (b2.has(bigram)) {
      intersection += Math.min(count, b2.get(bigram)!);
    }
  }

  const total = (n1.length - 1) + (n2.length - 1);
  return (2.0 * intersection) / total;
}

export interface PipelineResult {
  activeFacts: Fact[];
  newlyWrittenFacts: Fact[];
  supersededFactsCount: number;
  skippedDuplicatesCount: number;
  entities: Entity[];
}

/**
 * Processes new raw extractions against existing stored facts and suppressions.
 * Enforces deduplication in code, supersession, entity binding, and date parsing.
 */
export function processExtractionPipeline(
  rawExtractions: RawExtractedFact[],
  existingFacts: Fact[],
  existingEntities: Entity[],
  suppressionHashes: Set<string> = new Set(),
  source: FactSource = 'onboarding',
  sourceRef = 'conversation',
  referenceDate: Date = new Date(),
  userId = 'user_local_active'
): PipelineResult {
  const factsPool = [...existingFacts];
  const entitiesPool = [...existingEntities];
  const newlyWrittenFacts: Fact[] = [];
  let supersededFactsCount = 0;
  let skippedDuplicatesCount = 0;

  for (const raw of rawExtractions) {
    if (!raw.text || typeof raw.text !== 'string') continue;

    const cleanedText = clean(raw.text);
    if (cleanedText.length < 4) continue;

    // 1. Check suppression hashes (tapped "That's wrong" earlier)
    const textHash = computeTextHash(cleanedText);
    if (suppressionHashes.has(textHash)) {
      skippedDuplicatesCount++;
      continue;
    }

    // 2. Entity resolution (match by normalized name)
    const entityName = raw.entity ? clean(raw.entity) : null;
    const normEntity = normalizeEntityName(entityName);
    let entityId: string | null = null;

    if (normEntity) {
      let matchedEntity = entitiesPool.find(
        (e) => normalizeEntityName(e.name) === normEntity
      );
      if (!matchedEntity) {
        matchedEntity = {
          id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          user_id: userId,
          type: raw.category === 'people' ? 'person' : 'project',
          name: entityName!,
          relationship: raw.relationship ? clean(raw.relationship) : null,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        entitiesPool.push(matchedEntity);
      }
      entityId = matchedEntity.id;
    }

    // 3. Handle explicit model supersedes request
    if (raw.supersedes) {
      const oldFact = factsPool.find((f) => f.id === raw.supersedes && f.status === 'active');
      if (oldFact) {
        oldFact.status = 'superseded';
        oldFact.updated_at = new Date().toISOString();
        supersededFactsCount++;
      }
    }

    // 4. Dedupe in code: same category + same entity + fuzzy similarity >= 0.85
    const duplicateFact = factsPool.find((f) => {
      if (f.status !== 'active') return false;
      if (f.category !== raw.category) return false;
      const sameEntity = (f.entity_id === entityId) || (!f.entity_id && !entityId);
      if (sameEntity) {
        const sim = calculateSimilarity(f.text, cleanedText);
        if (sim >= 0.85) return true;
      }
      return false;
    });

    if (duplicateFact) {
      skippedDuplicatesCount++;
      continue;
    }

    // 5. Date parsing
    const dateParsed = parseDateExpression(raw.due_text, referenceDate);
    const sinceText = raw.since_text ? clean(raw.since_text) : dateParsed.since_text || null;

    // 6. Assemble new fact
    const nowIso = new Date().toISOString();
    const newFact: Fact = {
      id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      entity_id: entityId,
      category: raw.category,
      text: cleanedText,
      epistemic: raw.epistemic === 'hypothesized' ? 'hypothesized' : 'stated',
      state: raw.state || (raw.category === 'commitments' ? 'open' : null),
      due_text: raw.due_text ? clean(raw.due_text) : null,
      due_at: dateParsed.due_at,
      due_precision: dateParsed.due_precision,
      since_text: sinceText,
      evidence: raw.evidence ? [{ quote: clean(raw.evidence), at: nowIso }] : [],
      source,
      source_ref: sourceRef,
      supersedes_id: raw.supersedes || null,
      status: 'active',
      observation_count: 1,
      created_at: nowIso,
      updated_at: nowIso,
    };

    factsPool.push(newFact);
    newlyWrittenFacts.push(newFact);
  }

  return {
    activeFacts: factsPool,
    newlyWrittenFacts,
    supersededFactsCount,
    skippedDuplicatesCount,
    entities: entitiesPool,
  };
}
