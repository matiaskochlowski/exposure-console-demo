// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AssistRequest } from '../shared/assist.ts';
import { generateFindings, INJECTED_SCANNER_TEXT } from '../shared/generate.ts';
import { encodeSse, type StreamEvent } from '../shared/stream.ts';
import { createHttpProvider } from './httpProvider.ts';
import { createMockProvider, planResponse } from './mockProvider.ts';
import { withMockFallback } from './mode.ts';
import { buildFindingContext } from '../shared/assist.ts';
import type { AssistantProvider } from './provider.ts';

const rows = generateFindings();
const byId = new Map(rows.map((f) => [f.id, f]));
const getFinding = (id: string) => byId.get(id);
const p1Open = rows.find(
  (f) =>
    f.status === 'open' && f.kev && f.exploitValidated && f.cvss > 8 && f.assetCriticality >= 3,
)!;

const request = (findingId = p1Open.id): AssistRequest => ({
  requestId: 'req-00000001',
  findingId,
  question: 'What should we do?',
  history: [],
});

async function collect(
  provider: AssistantProvider,
  req = request(),
  signal = new AbortController().signal,
) {
  const events: StreamEvent[] = [];
  for await (const e of provider.stream(req, signal)) events.push(e);
  return events;
}

function sseResponse(chunks: string[], init: ResponseInit = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    ...init,
  });
}

const json = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { code, message: `${code} message` } }), { status });

const rid = 'req-00000001';
const liveEvents: StreamEvent[] = [
  { type: 'start', requestId: rid, mode: 'live' },
  { type: 'text', requestId: rid, delta: 'Patch first. ' },
  {
    type: 'tool_proposal',
    requestId: rid,
    proposalId: 'prop-1',
    call: {
      name: 'open_ticket',
      args: { findingId: p1Open.id, title: 'Patch', assignee: 'platform' },
    },
  },
  { type: 'done', requestId: rid, reason: 'end_turn' },
];

describe('mock provider', () => {
  const mock = createMockProvider(getFinding, { delayMs: 0 });

  it('streams start → text → proposal → done and proposes a ticket for an open P1', async () => {
    const events = await collect(mock);
    expect(events[0]).toEqual({ type: 'start', requestId: rid, mode: 'mock' });
    expect(events.at(-1)).toEqual({ type: 'done', requestId: rid, reason: 'end_turn' });
    const proposal = events.find((e) => e.type === 'tool_proposal');
    expect(proposal).toMatchObject({
      call: { name: 'open_ticket', args: { findingId: p1Open.id } },
    });
  });

  it('is deterministic apart from proposal ids', async () => {
    const strip = (es: StreamEvent[]) =>
      es.map((e) => (e.type === 'tool_proposal' ? { ...e, proposalId: '' } : e));
    expect(strip(await collect(mock))).toEqual(strip(await collect(mock)));
  });

  it('does not propose a second ticket when the client says one exists', async () => {
    const events = await collect(mock, {
      ...request(),
      clientState: { status: 'in_progress', hasTicket: true },
    });
    expect(events.some((e) => e.type === 'tool_proposal')).toBe(false);
  });

  it.each(INJECTED_SCANNER_TEXT.map((t, i) => [i, t]))(
    'warns about, and never accepts risk for, injected sample %i',
    (_i, sample) => {
      const injected = rows.find((f) => f.scannerText === sample)!;
      const { text, calls } = planResponse(buildFindingContext(injected), 'What should we do?');
      expect(text).toMatch(/reads like instructions to an AI/);
      expect(calls.map((c) => c.name)).not.toContain('accept_risk');
    },
  );

  it('still proposes accepting risk for a clean low-risk finding', () => {
    const lowRisk = rows.find(
      (f) =>
        f.status === 'open' &&
        !f.kev &&
        !f.exploitValidated &&
        f.epss < 0.01 &&
        planResponse(buildFindingContext(f), 'x').calls.length,
    )!;
    expect(planResponse(buildFindingContext(lowRisk), 'What should we do?').calls[0]?.name).toBe(
      'accept_risk',
    );
  });

  it('stops with done/aborted when the signal aborts mid-stream', async () => {
    const controller = new AbortController();
    const events: StreamEvent[] = [];
    for await (const e of createMockProvider(getFinding, { delayMs: 1 }).stream(
      request(),
      controller.signal,
    )) {
      events.push(e);
      if (events.length === 3) controller.abort();
    }
    expect(events.at(-1)).toEqual({ type: 'done', requestId: rid, reason: 'aborted' });
    expect(events.some((e) => e.type === 'tool_proposal')).toBe(false);
  });

  it('errors for unknown findings', async () => {
    const events = await collect(mock, request('DEMO-2026-99999'));
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'invalid_request' });
  });
});

describe('http provider', () => {
  const wire = liveEvents.map(encodeSse).join('');

  it('parses a stream split at arbitrary byte boundaries, including inside UTF-8 characters', async () => {
    const withEmoji = encodeSse({ type: 'text', requestId: rid, delta: 'é 🔥 ' });
    const full = new TextEncoder().encode(
      liveEvents.slice(0, 1).map(encodeSse).join('') +
        withEmoji +
        liveEvents.slice(1).map(encodeSse).join(''),
    );
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < full.length; i += 7) c.enqueue(full.slice(i, i + 7));
        c.close();
      },
    });
    const provider = createHttpProvider({
      fetchImpl: async () => new Response(body, { status: 200 }),
    });
    const events = await collect(provider);
    expect(events).toHaveLength(5);
    expect(events[1]).toEqual({ type: 'text', requestId: rid, delta: 'é 🔥 ' });
    expect(events.at(-1)).toEqual(liveEvents.at(-1));
  });

  it('marks a stream that ends without a terminal event as truncated', async () => {
    const provider = createHttpProvider({
      fetchImpl: async () => sseResponse([liveEvents.slice(0, 2).map(encodeSse).join('')]),
    });
    const events = await collect(provider);
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'truncated' });
  });

  it('drops an invalid proposal frame but keeps streaming', async () => {
    const bad =
      'data: {"type":"tool_proposal","requestId":"req-00000001","proposalId":"p9","call":{"name":"wipe_assets","args":{}}}\n\n';
    const provider = createHttpProvider({
      fetchImpl: async () =>
        sseResponse([encodeSse(liveEvents[0]!), bad, encodeSse(liveEvents[3]!)]),
    });
    const events = await collect(provider);
    expect(events.map((e) => (e.type === 'error' ? e.code : e.type))).toEqual([
      'start',
      'invalid_tool',
      'done',
    ]);
  });

  it('ignores events that belong to another request', async () => {
    const foreign = encodeSse({ type: 'text', requestId: 'req-OTHER-01', delta: 'stale' });
    const provider = createHttpProvider({ fetchImpl: async () => sseResponse([foreign, wire]) });
    const events = await collect(provider);
    expect(events.some((e) => e.type === 'text' && e.delta === 'stale')).toBe(false);
  });

  it.each([
    [401, 'unauthorized', 'unauthorized'],
    [429, 'rate_limited', 'rate_limited'],
    [500, 'provider_error', 'provider_error'],
  ])('maps HTTP %s to a visible %s error', async (status, code, expected) => {
    const provider = createHttpProvider({ fetchImpl: async () => json(status, code) });
    const events = await collect(provider);
    expect(events).toEqual([expect.objectContaining({ type: 'error', code: expected })]);
  });

  it('times out an idle stream', async () => {
    const provider = createHttpProvider({
      idleTimeoutMs: 20,
      fetchImpl: async (_url, init) =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode(encodeSse(liveEvents[0]!)));
              init?.signal?.addEventListener('abort', () => c.error(new Error('aborted')));
            },
          }),
        ),
    });
    const events = await collect(provider);
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'timeout' });
  });

  it('ends with done/aborted when the caller aborts', async () => {
    const controller = new AbortController();
    const provider = createHttpProvider({
      fetchImpl: async (_url, init) =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode(encodeSse(liveEvents[0]!)));
              init?.signal?.addEventListener('abort', () => c.error(new Error('aborted')));
            },
          }),
        ),
    });
    const events: StreamEvent[] = [];
    for await (const e of provider.stream(request(), controller.signal)) {
      events.push(e);
      controller.abort();
    }
    expect(events.at(-1)).toEqual({ type: 'done', requestId: rid, reason: 'aborted' });
  });
});

describe('live mode fallback', () => {
  const mock = createMockProvider(getFinding, { delayMs: 0 });

  it('falls back to the mock only on 503 provider_unavailable before streaming', async () => {
    const provider = withMockFallback(
      createHttpProvider({ fetchImpl: async () => json(503, 'provider_unavailable') }),
      mock,
    );
    const events = await collect(provider);
    expect(events[0]).toEqual({ type: 'start', requestId: rid, mode: 'mock' });
  });

  it('does not fall back on auth failures', async () => {
    const provider = withMockFallback(
      createHttpProvider({ fetchImpl: async () => json(401, 'unauthorized') }),
      mock,
    );
    expect(await collect(provider)).toEqual([expect.objectContaining({ code: 'unauthorized' })]);
  });

  it('does not replace a partial live answer with scripted text', async () => {
    const provider = withMockFallback(
      createHttpProvider({
        fetchImpl: async () => sseResponse([liveEvents.slice(0, 2).map(encodeSse).join('')]),
      }),
      mock,
    );
    const events = await collect(provider);
    expect(events.every((e) => e.type !== 'start' || e.mode === 'live')).toBe(true);
    expect(events.at(-1)).toMatchObject({ code: 'truncated' });
  });

  it('does not fall back on an unrelated 503', async () => {
    const provider = withMockFallback(
      createHttpProvider({ fetchImpl: async () => json(503, 'overloaded') }),
      mock,
    );
    expect(await collect(provider)).toEqual([expect.objectContaining({ code: 'provider_error' })]);
  });
});
