import * as fs from 'node:fs';

import type OpenAI from 'openai';
import type { ResponseInputContent } from 'openai/resources/responses/responses';

import { setupLogger } from '../custom-logger.js';
import { generateResponse } from '../llm.js';
import type { DataThread, LLMResponse } from '../models.js';
import { generateReportPrompt } from '../prompts.js';

const logger = setupLogger('generate-report');

/**
 * 実行結果を集約してマークダウン形式の分析レポートを生成し、ファイルに保存する。
 * 画像結果はPNGファイルとして出力ディレクトリに書き出す。
 * @param dataInfo - 解析対象のデータ情報
 * @param userRequest - ユーザーからのタスク要求
 * @param processDataThreads - 各分析タスクの実行結果スレッド配列（デフォルト: []）
 * @param model - 使用するOpenAIモデル名（デフォルト: 'gpt-4o-mini-2024-07-18'）
 * @param outputDir - レポートと画像の出力先ディレクトリ（デフォルト: 'outputs/sample'）
 * @returns 生成されたレポートテキストを含むLLMレスポンス
 */
export async function generateReport(
  dataInfo: string,
  userRequest: string,
  processDataThreads: DataThread[] = [],
  model: string = 'gpt-4o-mini-2024-07-18',
  outputDir: string = 'outputs/sample',
): Promise<LLMResponse> {
  fs.mkdirSync(outputDir, { recursive: true });

  // プロンプトの構築
  const systemMessage = generateReportPrompt({ dataInfo });
  const messages: OpenAI.Responses.ResponseInputItem[] = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: `タスク要求: ${userRequest}` },
  ];

  // 実行結果の追加
  for (const dataThread of processDataThreads) {
    const userContents: ResponseInputContent[] = [
      {
        type: 'input_text',
        text: `instruction: ${dataThread.userRequest}`,
      },
      { type: 'input_text', text: `stdout: ${dataThread.stdout}` },
      {
        type: 'input_text',
        text: `observation: ${dataThread.observation}`,
      },
    ];

    for (let rix = 0; rix < dataThread.results.length; rix++) {
      const res = dataThread.results[rix]!;
      if (res.type === 'png') {
        // base64 → PNG ファイルとして保存
        const imageData = Buffer.from(res.content, 'base64');
        const imagePath = `${dataThread.processId}_${dataThread.threadId}_${rix}.png`;
        fs.writeFileSync(`${outputDir}/${imagePath}`, imageData);
        userContents.push(
          {
            type: 'input_text',
            text: `画像パス: "${imagePath}", 画像:`,
          },
          {
            type: 'input_image',
            image_url: `data:image/png;base64,${res.content}`,
            detail: 'auto',
          },
        );
      } else {
        userContents.push({
          type: 'input_text',
          text: `実行結果: ${res.content}`,
        });
      }
    }
    messages.push({ role: 'user', content: userContents });
  }

  // レポートの生成と保存
  const llmResponse = await generateResponse(messages, model);
  fs.writeFileSync(`${outputDir}/report.md`, llmResponse.content);
  logger.success(`WRITE ... ${outputDir}/report.md`);

  return llmResponse;
}
