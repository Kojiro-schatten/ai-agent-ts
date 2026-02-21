import { Sandbox } from '@e2b/code-interpreter';

import { setupLogger } from '../custom-logger.js';
import type { Review } from '../models.js';
import { describeDataframe } from '../modules/describe-dataframe.js';
import { executeCode } from '../modules/execute-code.js';
import { generateReview } from '../modules/generate-review.js';
import { setDataframe } from '../modules/set-dataframe.js';

const logger = setupLogger('test-07');

/**
 * generateReviewの動作を確認するテスト。
 * データフレームの概要取得・コード実行・レビュー生成の一連の流れを検証する。
 * @returns なし
 */
async function main(): Promise<void> {
  const processId = '07_generate_review';
  const dataPath = 'chapter5/data/sample.csv';
  const userRequest = 'データフレームのサイズを確認する';

  const sandbox = await Sandbox.create();
  let dataThread;
  try {
    const dataInfo = await describeDataframe(sandbox, dataPath);
    await setDataframe(sandbox, dataPath);
    dataThread = await executeCode(
      sandbox,
      processId,
      0,
      'print(df.shape)',
      userRequest,
    );
    logger.info(JSON.stringify(dataThread));

    const response = await generateReview(
      dataInfo,
      userRequest,
      dataThread,
    );
    if (response.content === null) {
      throw new Error('Failed to parse review output');
    }
    const review: Review = response.content;
    logger.info(JSON.stringify(review, null, 4));
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
}

main();
