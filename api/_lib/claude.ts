import Anthropic from '@anthropic-ai/sdk';
import { validateActionCall, type ActionCall } from '../../src/shared/actions.js';
import type { AssistRequest, FindingContext } from '../../src/shared/assist.js';
import type { StreamEvent } from '../../src/shared/stream.js';
import { buildMessages, SYSTEM_PROMPT, toolDefinitions } from './prompt.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

/** The slice of the SDK stream this module needs; lets tests substitute a fake. */
export interface ModelStream extends AsyncIterable<Anthropic.Beta.Messages.BetaRawMessageStreamEvent> {
  finalMessage(): Promise<Anthropic.Beta.Messages.BetaMessage>;
}

export type StreamFactory = (
  params: Anthropic.Beta.Messages.MessageCreateParamsStreaming,
  signal: AbortSignal,
) => ModelStream;

export function sdkStreamFactory(client: Anthropic): StreamFactory {
  return (params, signal) => client.beta.messages.stream(params, { signal });
}

/**
 * One analyst turn: forward text deltas, then emit tool proposals only from the complete final
 * message after validating them against the shared schemas. Nothing is executed here.
 */
export async function* runAnalyst(
  request: AssistRequest,
  context: FindingContext,
  factory: StreamFactory,
  signal: AbortSignal,
  model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
): AsyncGenerator<StreamEvent> {
  const { requestId } = request;
  yield { type: 'start', requestId, mode: 'live' };

  const stream = factory(
    {
      model,
      max_tokens: 4000,
      stream: true,
      // Short, chat-length answers: low effort keeps latency and cost down.
      output_config: { effort: 'low' },
      // On a safety-classifier decline, let the API retry on its default fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      tools: toolDefinitions(),
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      messages: buildMessages(context, request.question, request.history),
    },
    signal,
  );

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta' &&
      event.delta.text
    ) {
      yield { type: 'text', requestId, delta: event.delta.text };
    }
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    yield {
      type: 'error',
      requestId,
      code: 'provider_error',
      message: 'The model declined to answer this request.',
      retryable: false,
    };
    return;
  }

  let proposals = 0;
  for (const block of message.content) {
    if (block.type !== 'tool_use') continue;
    const validation = validateActionCall(block.name, block.input);
    const boundToFinding = validation.ok && validation.call.args.findingId === request.findingId;
    const allowed = validation.ok && policyAllows(validation.call, context);
    if (!validation.ok || !boundToFinding || !allowed || proposals >= 1) {
      yield {
        type: 'error',
        requestId,
        code: 'invalid_tool',
        message: 'Dropped a proposal that failed validation.',
        retryable: false,
      };
      continue;
    }
    proposals++;
    yield {
      type: 'tool_proposal',
      requestId,
      proposalId: `prop-${block.id}`.slice(0, 64),
      call: validation.call,
    };
  }

  yield {
    type: 'done',
    requestId,
    reason: message.stop_reason === 'max_tokens' ? 'max_tokens' : 'end_turn',
  };
}

const PRIORITY_RANK = { P1: 1, P2: 2, P3: 3, P4: 4 } as const;

/**
 * Hard policy, independent of what the prompt says: the proposals an injection would aim for are
 * dropped here and refused again by the client executor.
 */
export function policyAllows(call: ActionCall, context: FindingContext): boolean {
  const f = context.finding;
  const tampered = context.injection.suspicious;
  if (call.name === 'accept_risk') return !f.kev && !f.exploitValidated && !tampered;
  if (call.name === 'set_priority' && tampered) {
    const current = (f.priorityOverride ?? f.computedPriority) as keyof typeof PRIORITY_RANK;
    return PRIORITY_RANK[call.args.priority] <= PRIORITY_RANK[current];
  }
  return true;
}

/** Map SDK errors to protocol error codes; never leak provider messages or bodies to the client. */
export function toErrorEvent(requestId: string, error: unknown): StreamEvent {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return {
      type: 'error',
      requestId,
      code: 'unauthorized',
      message: 'The analyst service is misconfigured.',
      retryable: false,
    };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      type: 'error',
      requestId,
      code: 'rate_limited',
      message: 'The analyst is busy. Try again shortly.',
      retryable: true,
    };
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      type: 'error',
      requestId,
      code: 'timeout',
      message: 'The analyst did not respond in time.',
      retryable: true,
    };
  }
  return {
    type: 'error',
    requestId,
    code: 'provider_error',
    message: 'The analyst failed to respond.',
    retryable: true,
  };
}
