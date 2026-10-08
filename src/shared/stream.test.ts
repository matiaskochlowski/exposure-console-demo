import { describe, expect, it } from 'vitest';
import { createSseParser, encodeSse, type StreamEvent } from './stream.js';

const events: StreamEvent[] = [
  { type: 'start', requestId: 'req-00001', mode: 'live' },
  { type: 'text', requestId: 'req-00001', delta: 'Prioritise this — it’s KEV-listed. 🔥\n\nNext.' },
  {
    type: 'tool_proposal',
    requestId: 'req-00001',
    proposalId: 'prop-1',
    call: {
      name: 'open_ticket',
      args: { findingId: 'DEMO-2026-00001', title: 'Patch httpd', assignee: 'platform' },
    },
  },
  { type: 'done', requestId: 'req-00001', reason: 'end_turn' },
];

function collect(chunks: string[]) {
  const got: StreamEvent[] = [];
  const invalid: string[] = [];
  const parser = createSseParser(
    (e) => got.push(e),
    (raw) => invalid.push(raw),
  );
  for (const c of chunks) parser.feed(c);
  return { got, invalid, rest: parser.end() };
}

describe('SSE framing', () => {
  const wire = events.map(encodeSse).join('');

  it('round-trips when delivered whole', () => {
    expect(collect([wire]).got).toEqual(events);
  });

  it('round-trips at every possible split point', () => {
    for (let i = 1; i < wire.length; i++) {
      const { got, invalid } = collect([wire.slice(0, i), wire.slice(i)]);
      expect(got).toEqual(events);
      expect(invalid).toEqual([]);
    }
  });

  it('round-trips one character at a time and with CRLF line endings', () => {
    expect(collect([...wire]).got).toEqual(events);
    expect(collect([wire.replaceAll('\n', '\r\n')]).got).toEqual(events);
  });

  it('reports malformed JSON and schema violations without throwing', () => {
    const { got, invalid } = collect([
      'data: {not json}\n\n',
      'data: {"type":"tool_proposal","requestId":"req-00001","proposalId":"p1","call":{"name":"delete_everything","args":{}}}\n\n',
      ': keep-alive\n\n',
      encodeSse(events[0]!),
    ]);
    expect(got).toEqual([events[0]]);
    expect(invalid).toHaveLength(2);
  });

  it('exposes a truncated trailing frame', () => {
    const { rest } = collect([wire, 'data: {"type":"text"']);
    expect(rest).toBe('data: {"type":"text"');
  });
});
