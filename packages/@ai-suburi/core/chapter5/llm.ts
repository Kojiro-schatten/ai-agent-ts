import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { AutoParseableTextFormat } from 'openai/lib/parser';

import type { LLMResponse } from './models.js';

// https://openai.com/api/pricing/ を参照されたい
const COST: Record<string, { input: number; output: number }> = {
  'o3-mini-2025-01-31': {
    input: 1.1 / 1_000_000,
    output: 4.4 / 1_000_000,
  },
  'gpt-4o-2024-11-20': {
    input: 2.5 / 1_000_000,
    output: 1.25 / 1_000_000,
  },
  'gpt-4o-mini-2024-07-18': {
    input: 0.15 / 1_000_000,
    output: 0.6 / 1_000_000,
  },
};

/**
 * OpenAI Responses API を呼び出してLLMレスポンスを生成する。
 * responseFormat を指定しない場合はテキスト応答を、指定した場合は構造化データ応答を返す。
 * @param messages - LLMに送信するメッセージ配列
 * @param model - 使用するOpenAIモデル名（デフォルト: 'gpt-4o-2024-11-20'）
 * @returns トークン使用量・コスト情報を含むLLMレスポンス
 */
export async function generateResponse(
  messages: OpenAI.Responses.ResponseInputItem[],
  model?: string,
): Promise<LLMResponse>;
export async function generateResponse<T>(
  messages: OpenAI.Responses.ResponseInputItem[],
  model: string,
  responseFormat: AutoParseableTextFormat<T>,
): Promise<LLMResponse<T | null>>;
export async function generateResponse(
  messages: OpenAI.Responses.ResponseInputItem[],
  model: string = 'gpt-4o-2024-11-20',
  responseFormat?: AutoParseableTextFormat<unknown>,
): Promise<LLMResponse<unknown>> {
  const modelCost = COST[model];
  if (!modelCost) {
    throw new Error(`Invalid model name: ${model}`);
  }

  const contentIdx = model.startsWith('o1') || model.startsWith('o3') ? 1 : 0;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (responseFormat == null) {
    // Chat Completion
    const completion = await client.responses.create({
      model,
      input: messages,
    });
    const output = completion.output[contentIdx];
    let content = '';
    if (output?.type === 'message') {
      const textContent = output.content[0];
      content = textContent?.type === 'output_text' ? textContent.text : '';
    }
    // コスト計算
    const usage = completion.usage;
    const inputCost = (usage?.input_tokens ?? 0) * modelCost.input;
    const outputCost = (usage?.output_tokens ?? 0) * modelCost.output;
    return {
      messages,
      content,
      model: completion.model,
      createdAt: completion.created_at,
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      cost: inputCost + outputCost,
    };
  }

  // Structured Outputs
  const completion = await client.responses.parse({
    model,
    input: messages,
    text: { format: responseFormat },
  });
  const output = completion.output[contentIdx];
  let content: unknown = null;
  if (output?.type === 'message') {
    const textContent = output.content[0];
    content =
      textContent?.type === 'output_text' ? textContent.parsed : null;
  }
  // コスト計算
  const usage = completion.usage;
  const inputCost = (usage?.input_tokens ?? 0) * modelCost.input;
  const outputCost = (usage?.output_tokens ?? 0) * modelCost.output;
  return {
    messages,
    content,
    model: completion.model,
    createdAt: completion.created_at,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cost: inputCost + outputCost,
  };
}

// zodTextFormat のヘルパー re-export
export { zodTextFormat };
