import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { SIGNAL_TYPES } from '../constants';
import type { ClusterForSynthesis } from './insight.clustering';

// One constant for the default model — not repeated per call.
const INSIGHT_LLM_MODEL = process.env.INSIGHT_LLM_MODEL ?? 'gpt-4o-mini';

type SignalType = (typeof SIGNAL_TYPES)[keyof typeof SIGNAL_TYPES];
const SIGNAL_TYPE_VALUES = Object.values(SIGNAL_TYPES) as [
  SignalType,
  ...SignalType[],
];

const InsightsSchema = z.object({
  insights: z.array(
    z.object({
      ref: z.string(), // the cluster id we passed in — copied back verbatim
      pattern: z.string(),
      signalType: z.enum(SIGNAL_TYPE_VALUES), // constrained — LLM can't free-text
    }),
  ),
});

export interface GeneratedInsight {
  ref: string;
  pattern: string;
  signalType: SignalType;
}

const SYSTEM_PROMPT = `You are a sales-call analyst. You receive clusters of similar rep behaviours observed across an organization's calls of a single call type. Each cluster has a "ref", a representative behaviour, its type, how many times it occurred, and how often it preceded a buying signal.

For each cluster that is a clear, repeatable pattern, output one insight:
- "ref": copy the cluster's ref EXACTLY.
- "pattern": a concise, actionable description of what reps do.
- "signalType": exactly one of commitment, intent, strong, medium, neutral (use neutral when there is no clear buying-signal correlation).

Skip weak or noisy clusters. Return strictly the requested JSON shape.`;

function buildClusterPrompt(clusters: ClusterForSynthesis[]): string {
  const payload = clusters.map((c) => ({
    ref: c.id,
    behaviour: c.label,
    type: c.type,
    occurrences: c.memberCount,
    signalCorrelation: `${c.signalPrecedingCount}/${c.memberCount} instances preceded a buying signal`,
  }));
  return `Behaviour clusters (most frequent first):\n\n${JSON.stringify(
    payload,
    null,
    2,
  )}`;
}

/**
 * Turn changed clusters into insights via a single batched LLM call. Each returned
 * insight carries the cluster `ref` so the caller can upsert by clusterId.
 */
export async function synthesizeInsights(
  clusters: ClusterForSynthesis[],
): Promise<GeneratedInsight[]> {
  if (!clusters.length) return [];

  const { output } = await generateText({
    model: openai(INSIGHT_LLM_MODEL),
    output: Output.object({ schema: InsightsSchema }),
    system: SYSTEM_PROMPT,
    prompt: buildClusterPrompt(clusters),
  });

  return output.insights;
}
