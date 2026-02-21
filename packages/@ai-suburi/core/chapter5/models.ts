import { z } from 'zod/v4';

// === Program (from models/program.py) ===
export const programSchema = z.object({
  achievement_condition: z.string().describe('要求の達成条件'),
  execution_plan: z.string().describe('実行計画'),
  code: z.string().describe('生成対象となるコード'),
});
export type Program = z.infer<typeof programSchema>;

// === Review (from models/review.py) ===
export const reviewSchema = z.object({
  observation: z
    .string()
    .describe(
      'まずはコードの実行結果に対する客観的な事実を記述する。例えば「正常に終了し、〇〇という結果を得た。」「エラーが発生した。」などを記述する。' +
        'その後、コードの実行結果がユーザーから与えられた要求に対して最低限担保できているかを評価する。' +
        '要求を満たさない場合は、その修正方針を追記する。',
    ),
  is_completed: z
    .boolean()
    .describe(
      '実行結果がユーザーから与えられた要求に対して最低限担保できているかを評価する。' +
        'タスク要求を満たさない場合はFalse、改善点はあれど最低限要求を満たす場合はTrueとする。',
    ),
});
export type Review = z.infer<typeof reviewSchema>;

// === Task (from models/plan.py) ===
export const taskSchema = z.object({
  hypothesis: z
    .string()
    .describe(
      '検証可能な仮説を、その推測理由とともに詳細に記述する。' +
        '仮説は、データ分析によって検証したい因果関係や傾向、または期待される結果について、' +
        '具体的かつ明確に表現する。',
    ),
  purpose: z
    .string()
    .describe(
      'この仮説を検証することで明らかにしたい課題や目的を具体的に記述する。' +
        '仮説の検証がどのような意思決定や業務改善につながるか、またはどのような知見を得たいのかを明確に示す。',
    ),
  description: z
    .string()
    .describe(
      'どのような分析手法（例：単変量解析、多変量解析、回帰分析、クラスタリングなど）を用いるか記述する。' +
        'どの変数を使用するか、また関数の引数・戻り値を指定し、どのような比較や可視化を行うか詳細に記述する。',
    ),
  chart_type: z
    .string()
    .describe('想定する可視化の種類を記述する。'),
});
export type Task = z.infer<typeof taskSchema>;

// === Plan (from models/plan.py) ===
export const planSchema = z.object({
  purpose: z.string().describe('タスク要求から解釈される問い合わせ目的'),
  archivement: z
    .string()
    .describe('タスク要求から推測されるタスク達成条件'),
  tasks: z.array(taskSchema),
});
export type Plan = z.infer<typeof planSchema>;

// === SubTask (from models/plan.py) ===
export interface SubTask {
  state: boolean;
  task: Task;
}

// === DataThread (from models/data_thread.py) ===
export interface DataThread {
  processId: string;
  threadId: number;
  userRequest: string | null;
  code: string | null;
  error: string | null;
  stderr: string | null;
  stdout: string | null;
  isCompleted: boolean;
  observation: string | null;
  results: Array<{ type: string; content: string }>;
  pathes: Record<string, string>;
}

// === GraphDataThread (from graph/models/programmer_state.py) ===
export interface GraphDataThread {
  userRequest: string | null;
  code: string | null;
  error: string | null;
  stderr: string | null;
  stdout: string | null;
  isCompleted: boolean;
  observation: string | null;
  results: Array<{ type: string; content: string }>;
  pathes: Record<string, string>;
}

// === LLMResponse (from llms/models/llm_response.py) ===
export interface LLMResponse<T = string> {
  messages: unknown[];
  content: T;
  model: string;
  createdAt: number;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}
