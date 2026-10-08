// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as preview } from '../assist-preview.ts';
import { POST as assist, liveEnabled } from '../assist.ts';
import { findFindingById } from '../../src/shared/generate.ts';

function post(
  body: unknown,
  headers: Record<string, string> = { 'Content-Type': 'application/json' },
) {
  return new Request('https://demo.example.com/api/assist', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

afterEach(() => vi.unstubAllEnvs());

const enableLive = () => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('LIVE_ANALYST_ENABLED', '1');
};

describe('POST /api/assist', () => {
  it('answers 503 provider_unavailable unless live mode is explicitly enabled', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key'); // a key alone is not enough
    vi.stubEnv('LIVE_ANALYST_ENABLED', '');
    expect(liveEnabled()).toBe(false);
    const res = await assist(post({}));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: { code: 'provider_unavailable', message: expect.any(String) },
    });
  });

  it('rejects malformed, oversized and client-supplied records before calling the model', async () => {
    enableLive();
    expect((await assist(post('{nope'))).status).toBe(400);
    expect((await assist(post({ x: 'y'.repeat(9000) }))).status).toBe(413);
    const valid = {
      requestId: 'req-00000001',
      findingId: 'DEMO-2026-00001',
      question: 'q',
      history: [],
    };
    expect((await assist(post({ ...valid, finding: { cvss: 0 } }))).status).toBe(400);
    expect((await assist(post({ ...valid, findingId: 'DEMO-2026-99999' }))).status).toBe(404);
  });

  it('refuses cross-site simple requests and foreign origins', async () => {
    enableLive();
    const valid = {
      requestId: 'req-00000001',
      findingId: 'DEMO-2026-00001',
      question: 'q',
      history: [],
    };
    expect((await assist(post(valid, { 'Content-Type': 'text/plain' }))).status).toBe(415);
    expect(
      (
        await assist(
          post(valid, { 'Content-Type': 'application/json', Origin: 'https://evil.example.net' }),
        )
      ).status,
    ).toBe(403);
  });

  it('counts bytes, not characters', async () => {
    enableLive();
    const multibyte = {
      requestId: 'req-00000001',
      findingId: 'DEMO-2026-00001',
      question: '🔥'.repeat(2100),
      history: [],
    };
    expect((await assist(post(multibyte))).status).toBe(413);
  });
});

describe('POST /api/assist-preview', () => {
  it('returns the redacted context without asset identifiers', async () => {
    const f = findFindingById('DEMO-2026-00016')!;
    const res = await preview(
      post({ findingId: f.id, clientState: { status: 'open', hasTicket: false } }),
    );
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain(f.hostname);
    expect(JSON.parse(text).finding.id).toBe(f.id);
  });

  it('rejects unknown fields', async () => {
    expect((await preview(post({ findingId: 'DEMO-2026-00016', hostname: 'x' }))).status).toBe(400);
  });
});
