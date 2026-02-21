import type OpenAI from 'openai';

import { generateResponse, zodTextFormat } from '../llm.js';
import type { DataThread, LLMResponse, Program } from '../models.js';
import { programSchema } from '../models.js';
import { generateCodePrompt } from '../prompts.js';

/**
 * LLMを使ってデータ分析用のPythonコードを生成する。
 * 過去のスレッド情報がある場合は自己修正としてレビュー結果を反映する。
 * @param dataInfo - 解析対象のデータ情報
 * @param userRequest - ユーザーからのタスク要求
 * @param remoteSaveDir - グラフやデータの保存先ディレクトリパス（デフォルト: 'outputs/process_id/id'）
 * @param previousThread - 前回の実行スレッド情報（自己修正時に使用、デフォルト: null）
 * @param model - 使用するOpenAIモデル名（デフォルト: 'gpt-4o-mini-2024-07-18'）
 * @returns 生成されたProgramを含むLLMレスポンス
 */
export async function generateCode(
  dataInfo: string,
  userRequest: string,
  remoteSaveDir: string = 'outputs/process_id/id',
  previousThread: DataThread | null = null,
  model: string = 'gpt-4o-mini-2024-07-18',
): Promise<LLMResponse<Program | null>> {
  const systemMessage = generateCodePrompt({
    dataInfo,
    remoteSaveDir,
  });
  const messages: OpenAI.Responses.ResponseInputItem[] = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: `タスク要求: ${userRequest}` },
  ];
  // 自己修正：レビュー結果（5.4.3項参照）があれば反映する
  if (previousThread) {
    // 前のスレッドのコードを追加
    messages.push({
      role: 'assistant',
      content: previousThread.code ?? '',
    });
    // 前のスレッドの標準出力と標準エラーを追加
    if (previousThread.stdout && previousThread.stderr) {
      messages.push(
        {
          role: 'system',
          content: `stdout: ${previousThread.stdout}`,
        },
        {
          role: 'system',
          content: `stderr: ${previousThread.stderr}`,
        },
      );
    }
    // 前のスレッドの観測結果を追加
    if (previousThread.observation) {
      messages.push({
        role: 'user',
        content: `以下を参考にして、ユーザー要求を満たすコードを再生成してください: ${previousThread.observation}`,
      });
    }
  }
  return generateResponse(
    messages,
    model,
    zodTextFormat(programSchema, 'program'),
  );
}
