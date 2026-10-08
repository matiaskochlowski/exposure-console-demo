import { describe, expect, it } from 'vitest';
import { validateActionCall } from './actions.ts';

describe('validateActionCall', () => {
  it('accepts a well-formed proposal', () => {
    const result = validateActionCall('accept_risk', {
      findingId: 'DEMO-2026-00010',
      justification: 'Internal-only host, compensating WAF rule in place',
      expiresInDays: 90,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects unknown tools', () => {
    expect(validateActionCall('delete_asset', {})).toMatchObject({
      ok: false,
      error: 'Unknown action "delete_asset"',
    });
  });

  it('rejects extra properties and out-of-range values with field messages', () => {
    const result = validateActionCall('accept_risk', {
      findingId: 'DEMO-2026-00010',
      justification: 'short',
      expiresInDays: 365,
      approvedBy: 'model',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.justification).toMatch(/at least 10/);
      expect(result.issues.expiresInDays).toBeDefined();
    }
  });

  it('rejects malformed finding ids', () => {
    const result = validateActionCall('open_ticket', {
      findingId: '../etc',
      title: 'x y z',
      assignee: 'platform',
    });
    expect(result).toMatchObject({ ok: false, issues: { findingId: 'Unknown finding id' } });
  });
});
