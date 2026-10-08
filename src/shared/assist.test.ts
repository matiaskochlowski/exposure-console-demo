import { describe, expect, it } from 'vitest';
import { assistRequestSchema, boundHistory, buildFindingContext } from './assist.js';
import { generateFindings } from './generate.js';

const [finding] = generateFindings(1);

describe('buildFindingContext', () => {
  const ctx = buildFindingContext(finding!);

  it('never includes excluded asset identifiers anywhere in the payload', () => {
    const json = JSON.stringify(ctx);
    expect(json).not.toContain(finding!.hostname);
    expect(json).not.toContain(finding!.ip);
    expect(json).not.toContain(finding!.owner);
    expect(ctx.excludedFields).toEqual(['hostname', 'ip', 'owner', 'assetId']);
  });

  it('keeps the finding id because approved actions need it', () => {
    expect(ctx.finding.id).toBe(finding!.id);
  });
});

describe('assistRequestSchema', () => {
  const valid = {
    requestId: 'req-12345678',
    findingId: 'DEMO-2026-00001',
    question: 'Why P1?',
    history: [],
  };

  it('accepts a minimal request', () => {
    expect(assistRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects client-supplied finding records and oversized input', () => {
    expect(assistRequestSchema.safeParse({ ...valid, finding: { cvss: 0 } }).success).toBe(false);
    expect(assistRequestSchema.safeParse({ ...valid, question: 'x'.repeat(501) }).success).toBe(
      false,
    );
    const turns = Array.from({ length: 7 }, () => ({ role: 'user' as const, content: 'hi' }));
    expect(assistRequestSchema.safeParse({ ...valid, history: turns }).success).toBe(false);
  });
});

describe('boundHistory', () => {
  it('keeps the newest turns within the character budget', () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `${i}`.repeat(1500),
    }));
    const bounded = boundHistory(turns);
    expect(bounded.length).toBeLessThanOrEqual(6);
    expect(bounded.at(-1)?.content.startsWith('9')).toBe(true);
    expect(JSON.stringify(bounded).length).toBeLessThanOrEqual(6000);
  });
});
