// server/src/services/briefingService.ts
import logger from '@/utils/logger.js';
import type { FrontierEdge } from './localization.js';

const AI_TIMEOUT_MS = 4000;
const MODEL = 'llama-3.3-70b-versatile';

export interface BriefingContext {
  dtId: string;
  frontier: FrontierEdge;
  pincode: string | null;
  householdsServed: number | null;
}

export interface BriefingResult {
  text: string;
  source: 'ai' | 'template';
}

/**
 * The fallback is a first-class implementation, not a stub. It must
 * produce a genuinely usable ticket header on its own, using only the
 * structured facts the localization engine already computed --
 * no network call, cannot fail.
 */
function buildTemplateBriefing(ctx: BriefingContext): string {
  const { frontier, dtId, pincode, householdsServed } = ctx;
  const scope =
    frontier.affectedPoleIds.length === 1 ? '1 pole' : `${frontier.affectedPoleIds.length} poles`;
  const confidenceNote =
    frontier.confidenceHint === 'high'
      ? ''
      : frontier.confidenceHint === 'inferred'
        ? ' (location estimated from geometry, not verified wiring)'
        : ' (approximate range -- boundary pole has no telemetry device)';
  const householdsNote = householdsServed ? `, ~${householdsServed} households` : '';
  const pincodeNote = pincode ? ` in ${pincode}` : '';

  return `Fault detected on DT ${dtId}${pincodeNote} affecting ${scope}${householdsNote}${confidenceNote}.`;
}

async function callAi(ctx: BriefingContext): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const prompt = [
    'Write ONE short, plain sentence for a control-room ticket header,',
    'describing this power fault using ONLY the facts given below.',
    'Do not invent any detail not listed. Do not add caveats beyond what',
    'is given. No preamble, no markdown -- just the sentence.',
    '',
    `DT: ${ctx.dtId}`,
    `Affected poles: ${ctx.frontier.affectedPoleIds.length}`,
    `Confidence: ${ctx.frontier.confidenceHint}`,
    `Reasoning: ${ctx.frontier.reasoning}`,
    ctx.pincode ? `Pincode: ${ctx.pincode}` : '',
    ctx.householdsServed ? `Households served by this DT: ${ctx.householdsServed}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI API returned ${response.status}`);
    }

    interface GroqResponse {
      content?: { type: string; text?: string }[];
    }
    const data = (await response.json()) as GroqResponse;
    const text = data.content?.find((b) => b.type === 'text')?.text;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('AI API returned no usable text');
    }
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Never throws. Always returns something usable -- that's the entire
 * point of Phase 6: the AI is allowed to fail, the ticket header is not.
 */
export async function generateBriefing(ctx: BriefingContext): Promise<BriefingResult> {
  try {
    const text = await callAi(ctx);
    return { text, source: 'ai' };
  } catch (err) {
    logger.info(`AI briefing unavailable, using template fallback: ${err}`);
    return { text: buildTemplateBriefing(ctx), source: 'template' };
  }
}
