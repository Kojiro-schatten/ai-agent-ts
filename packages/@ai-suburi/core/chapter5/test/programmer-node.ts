import { Sandbox } from '@e2b/code-interpreter';

import { setupLogger } from '../custom-logger.js';
import type { DataThread, Program, Review } from '../models.js';
import { describeDataframe } from '../modules/describe-dataframe.js';
import { executeCode } from '../modules/execute-code.js';
import { generateCode } from '../modules/generate-code.js';
import { generateReview } from '../modules/generate-review.js';
import { setDataframe } from '../modules/set-dataframe.js';

const logger = setupLogger('programmer-node');

/**
 * コード生成・実行・レビューのループを実行するプログラマーノード。
 * データファイルに対してユーザーのリクエストを処理し、コード生成→実行→レビューのサイクルを最大nTrial回繰り返す。
 * @param dataFile - 分析対象のデータファイルパス
 * @param userRequest - ユーザーからのリクエスト文字列
 * @param processId - プロセスを識別するためのID
 * @param model - 使用するLLMモデル名
 * @param nTrial - コード生成・実行・レビューの最大試行回数
 * @param idx - タスクのインデックス番号
 * @returns インデックス番号とデータスレッド配列のタプル
 */
export async function programmerNode(
  dataFile: string,
  userRequest: string,
  processId: string,
  model: string = 'gpt-4o-mini-2024-07-18',
  nTrial: number = 3,
  idx: number = 0,
): Promise<[number, DataThread[]]> {
  const sandbox = await Sandbox.create();
  try {
    const dataInfo = await describeDataframe(sandbox, dataFile);
    await setDataframe(sandbox, dataFile);
    const dataThreads: DataThread[] = [];
    for (let threadId = 0; threadId < nTrial; threadId++) {
      // 5.4.1. コード生成
      const previousThread =
        dataThreads.length > 0
          ? dataThreads[dataThreads.length - 1]!
          : null;
      const codeResponse = await generateCode(
        dataInfo,
        userRequest,
        undefined,
        previousThread,
        model,
      );
      if (codeResponse.content === null) {
        throw new Error('Failed to parse code generation output');
      }
      const program: Program = codeResponse.content;
      logger.info(JSON.stringify(program));
      // 5.4.2. コード実行
      const dataThread = await executeCode(
        sandbox,
        processId,
        threadId,
        program.code,
        userRequest,
      );
      if (dataThread.stdout) {
        logger.debug(`stdout=${dataThread.stdout}`);
      }
      if (dataThread.stderr) {
        logger.warn(`stderr=${dataThread.stderr}`);
      }
      // 5.4.3. レビュー生成
      const reviewResponse = await generateReview(
        dataInfo,
        userRequest,
        dataThread,
        undefined,
        undefined,
        model,
      );
      if (reviewResponse.content === null) {
        throw new Error('Failed to parse review output');
      }
      const review: Review = reviewResponse.content;
      logger.info(JSON.stringify(review));
      // data_thread を更新
      dataThread.observation = review.observation;
      dataThread.isCompleted = review.is_completed;
      dataThreads.push(dataThread);
      // 終了条件
      if (dataThread.isCompleted) {
        logger.success(`userRequest=${userRequest}`);
        logger.success(`code=${program.code}`);
        logger.success(`observation=${review.observation}`);
        break;
      }
    }
    return [idx, dataThreads];
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
}
