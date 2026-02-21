import type OpenAI from 'openai';
import type { ResponseInputContent } from 'openai/resources/responses/responses';

import { generateResponse, zodTextFormat } from '../llm.js';
import type { DataThread, LLMResponse, Review } from '../models.js';
import { reviewSchema } from '../models.js';
import { generateReviewPrompt } from '../prompts.js';

/**
 * コード実行結果をレビューし、タスク要求の達成可否とフィードバックを生成する。
 * 実行結果に画像がある場合はbase64エンコードでLLMに送信する。
 * @param dataInfo - 解析対象のデータ情報
 * @param userRequest - ユーザーからのタスク要求
 * @param dataThread - レビュー対象のコード実行結果スレッド
 * @param hasResults - 実行結果（画像等）をLLMに送信するかどうか（デフォルト: false）
 * @param remoteSaveDir - グラフやデータの保存先ディレクトリパス（デフォルト: 'outputs/process_id/id'）
 * @param model - 使用するOpenAIモデル名（デフォルト: 'gpt-4o-mini-2024-07-18'）
 * @returns 生成されたReviewを含むLLMレスポンス
 */
export async function generateReview(
  dataInfo: string,
  userRequest: string,
  dataThread: DataThread,
  hasResults: boolean = false,
  remoteSaveDir: string = 'outputs/process_id/id',
  model: string = 'gpt-4o-mini-2024-07-18',
): Promise<LLMResponse<Review | null>> {
  const systemInstruction = generateReviewPrompt({
    dataInfo,
  });

  let resultsContent: ResponseInputContent[] = [];
  if (hasResults) {
    resultsContent = dataThread.results.map((res): ResponseInputContent =>
      res.type === 'png'
        ? {
            type: 'input_image',
            image_url: `data:image/jpeg;base64,${res.content}`,
            detail: 'auto',
          }
        : { type: 'input_text', text: res.content },
    );
  }

  const systemResultsItems: OpenAI.Responses.ResponseInputItem[] = hasResults
    ? [{ role: 'system', content: resultsContent }]
    : [];

  const messages: OpenAI.Responses.ResponseInputItem[] = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: userRequest },
    { role: 'assistant', content: dataThread.code ?? '' },
    ...systemResultsItems,
    {
      role: 'system',
      content: `stdout: ${dataThread.stdout}`,
    },
    {
      role: 'system',
      content: `stderr: ${dataThread.stderr}`,
    },
    {
      role: 'user',
      content: '実行結果に対するフィードバックを提供してください。',
    },
  ];

  return generateResponse(
    messages,
    model,
    zodTextFormat(reviewSchema, 'review'),
  );
}
