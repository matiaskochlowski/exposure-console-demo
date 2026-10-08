import { describe, expect, it } from 'vitest';
import type { ActionCall } from '../shared/actions.js';
import type { Finding } from '../shared/finding.js';
import { generateFindings } from '../shared/generate.js';
import { addProposal, approveProposal, rejectProposal } from './executor.js';
import { EMPTY_STATE, type ActionsState } from './types.js';

const base: Finding = { ...generateFindings(1)[0]!, status: 'open' };
const getBase = (id: string) => (id === base.id ? base : undefined);

function withProposal(call: ActionCall, state: ActionsState = EMPTY_STATE) {
  return addProposal(state, {
    proposalId: 'p-1',
    requestId: 'req-00000001',
    findingId: base.id,
    call,
  });
}

const ticket: ActionCall = {
  name: 'open_ticket',
  args: { findingId: base.id, title: 'Patch it', assignee: 'platform' },
};
const accept: ActionCall = {
  name: 'accept_risk',
  args: {
    findingId: base.id,
    justification: 'Isolated lab host, decommissioned next sprint',
    expiresInDays: 30,
  },
};

describe('action executor', () => {
  it('does not mutate anything when a proposal arrives', () => {
    const state = withProposal(ticket);
    expect(state.overrides).toEqual({});
    expect(state.proposals['p-1']?.state).toBe('pending');
  });

  it('ignores proposals bound to a different finding than the conversation', () => {
    const state = addProposal(EMPTY_STATE, {
      proposalId: 'p-x',
      requestId: 'req-00000001',
      findingId: 'DEMO-2026-00002',
      call: ticket,
    });
    expect(state).toBe(EMPTY_STATE);
  });

  it('rejecting causes no mutation and is recorded', () => {
    const state = rejectProposal(withProposal(ticket), 'p-1');
    expect(state.overrides).toEqual({});
    expect(state.proposals['p-1']?.state).toBe('rejected');
    expect(state.audit.at(-1)?.summary).toMatch(/Rejected/);
  });

  it('approving applies the action and records the audit entry', () => {
    const result = approveProposal(withProposal(ticket), 'p-1', getBase);
    expect(result.kind).toBe('executed');
    expect(result.state.overrides[base.id]).toEqual({
      ticketId: 'SIM-1001',
      status: 'in_progress',
    });
    expect(result.state.proposals['p-1']?.state).toBe('succeeded');
  });

  it('applies edited values instead of the proposed ones', () => {
    const result = approveProposal(withProposal(ticket), 'p-1', getBase, {
      ...ticket.args,
      title: 'Upgrade httpd fleet-wide',
      assignee: 'app-sec',
    });
    expect(result.kind).toBe('executed');
    const p = result.state.proposals['p-1']!;
    expect(p.edited).toBe(true);
    expect(p.current.args).toMatchObject({
      title: 'Upgrade httpd fleet-wide',
      assignee: 'app-sec',
    });
    expect(p.proposed.args).toMatchObject({ title: 'Patch it' });
    expect(result.state.audit.at(-1)?.summary).toMatch(/edited before approval/);
  });

  it('executes exactly once on duplicate approval', () => {
    const first = approveProposal(withProposal(ticket), 'p-1', getBase);
    const second = approveProposal(first.state, 'p-1', getBase);
    expect(second.kind).toBe('noop');
    expect(second.state).toBe(first.state);
    expect(second.state.nextTicket).toBe(1002);
  });

  it('keeps the proposal pending when edited arguments are invalid', () => {
    const state = withProposal(accept);
    const result = approveProposal(state, 'p-1', getBase, { ...accept.args, justification: 'meh' });
    expect(result.kind).toBe('invalid');
    expect(result.state).toBe(state);
    if (result.kind === 'invalid') expect(result.issues.justification).toBeDefined();
  });

  it('refuses edits that retarget another finding', () => {
    const result = approveProposal(withProposal(ticket), 'p-1', getBase, {
      ...ticket.args,
      findingId: 'DEMO-2026-00002',
    });
    expect(result.kind).toBe('failed');
    expect(result.state.overrides).toEqual({});
  });

  it('fails invalid status transitions with a message and no mutation', () => {
    const accepted = approveProposal(withProposal(accept), 'p-1', getBase).state;
    const again = addProposal(accepted, {
      proposalId: 'p-2',
      requestId: 'req-00000002',
      findingId: base.id,
      call: accept,
    });
    const result = approveProposal(again, 'p-2', getBase);
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed')
      expect(result.error).toMatch(/only be accepted for open or in-progress/);
    expect(result.state.overrides[base.id]).toEqual(accepted.overrides[base.id]);
    expect(result.state.proposals['p-2']?.state).toBe('failed');
  });

  it('refuses a second ticket for the same finding', () => {
    const first = approveProposal(withProposal(ticket), 'p-1', getBase).state;
    const again = addProposal(first, {
      proposalId: 'p-2',
      requestId: 'req-00000002',
      findingId: base.id,
      call: ticket,
    });
    expect(approveProposal(again, 'p-2', getBase)).toMatchObject({
      kind: 'failed',
      error: 'Already tracked in SIM-1001.',
    });
  });
});

describe('executor policy (independent of the prompt)', () => {
  const rows = generateFindings();
  const kevFinding: Finding = { ...rows.find((f) => f.kev)!, status: 'open' };
  const tampered: Finding = {
    ...rows.find((f) => f.scannerText.startsWith('TXT record'))!,
    status: 'open',
  };
  const lookup = (id: string) => [kevFinding, tampered].find((f) => f.id === id);
  const propose = (f: Finding, call: ActionCall) =>
    addProposal(EMPTY_STATE, {
      proposalId: 'p-9',
      requestId: 'req-00000009',
      findingId: f.id,
      call,
    });

  it('refuses risk acceptance for known-exploited findings', () => {
    const call: ActionCall = {
      name: 'accept_risk',
      args: { findingId: kevFinding.id, justification: 'Business says fine', expiresInDays: 30 },
    };
    expect(approveProposal(propose(kevFinding, call), 'p-9', lookup)).toMatchObject({
      kind: 'failed',
      error: expect.stringMatching(/Policy/),
    });
  });

  it('refuses priority downgrades when evidence looks tampered with, allows raises', () => {
    const down: ActionCall = {
      name: 'set_priority',
      args: { findingId: tampered.id, priority: 'P4', reason: 'scanner said so' },
    };
    const up: ActionCall = {
      name: 'set_priority',
      args: { findingId: tampered.id, priority: 'P1', reason: 'investigate tampering' },
    };
    expect(approveProposal(propose(tampered, down), 'p-9', lookup).kind).toBe('failed');
    expect(approveProposal(propose(tampered, up), 'p-9', lookup).kind).toBe('executed');
  });
});
