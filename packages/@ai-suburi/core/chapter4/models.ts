import { z } from 'zod/v4';
import type OpenAI from 'openai';

// --- Zod schemas (for OpenAI structured output) ---

export const PlanSchema = z.object({
  subtasks: z.array(z.string()).describe('問題を解決するためのサブタスクリスト'),
});

export const ReflectionResultSchema = z.object({
  advice: z.string().describe(
    '評価がNGの場合は、別のツールを試す、別の文言でツールを試すなど、なぜNGなのかとどうしたら改善できるかを考えアドバイスを作成してください。' +
    'アドバイスの内容は過去のアドバイスと計画内の他のサブタスクと重複しないようにしてください。' +
    'アドバイスの内容をもとにツール選択・実行からやり直します。',
  ),
  is_completed: z.boolean().describe(
    'ツールの実行結果と回答から、サブタスクに対して正しく回答できているかの評価結果',
  ),
});

// --- TypeScript types ---

export type Plan = z.infer<typeof PlanSchema>;
export type ReflectionResult = z.infer<typeof ReflectionResultSchema>;

export interface SearchOutput {
  file_name: string;
  content: string;
}

export interface ToolResult {
  tool_name: string;
  args: string;
  results: SearchOutput[];
}

export interface Subtask {
  task_name: string;
  tool_results: ToolResult[][];
  reflection_results: ReflectionResult[];
  is_completed: boolean;
  subtask_answer: string;
  challenge_count: number;
}

export interface AgentResult {
  question: string;
  plan: Plan;
  subtasks: Subtask[];
  answer: string;
}

// --- Agent Tool interface ---

export interface AgentTool {
  name: string;
  definition: OpenAI.ChatCompletionTool;
  invoke: (args: Record<string, unknown>) => Promise<SearchOutput[]>;
}
