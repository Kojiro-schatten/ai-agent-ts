import type OpenAI from 'openai';

import { generateResponse, zodTextFormat } from '../llm.js';
import type { LLMResponse, Plan } from '../models.js';
import { planSchema } from '../models.js';
import { generatePlanPrompt } from '../prompts.js';

/**
 * LLMを使ってデータ分析の計画を生成する。
 * ユーザーのタスク要求とデータ情報をもとに、仮説ベースの分析計画を立案する。
 * @param dataInfo - 解析対象のデータ情報
 * @param userRequest - ユーザーからのタスク要求
 * @param model - 使用するOpenAIモデル名（デフォルト: 'gpt-4o-mini-2024-07-18'）
 * @returns 生成されたPlanを含むLLMレスポンス
 */
export async function generatePlan(
  dataInfo: string,
  userRequest: string,
  model: string = 'gpt-4o-mini-2024-07-18',
): Promise<LLMResponse<Plan | null>> {
  const systemMessage = generatePlanPrompt({ dataInfo });
  const messages: OpenAI.Responses.ResponseInputItem[] = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: `タスク要求: ${userRequest}` },
  ];
  return generateResponse(
    messages,
    model,
    zodTextFormat(planSchema, 'plan'),
  );
}
