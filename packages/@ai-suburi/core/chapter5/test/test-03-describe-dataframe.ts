import { Sandbox } from '@e2b/code-interpreter';

import { setupLogger } from '../custom-logger.js';
import { describeDataframe } from '../modules/describe-dataframe.js';

const logger = setupLogger('test-03');

/**
 * describeDataframeの動作を確認するテスト。
 * サンドボックス上でCSVファイルを読み込み、データフレームの概要情報を取得・表示する。
 * @returns なし
 */
async function main(): Promise<void> {
  const dataFile = 'chapter5/data/sample.csv';
  const sandbox = await Sandbox.create();
  try {
    const dataInfo = await describeDataframe(sandbox, dataFile);
    logger.info(dataInfo);
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
}

main();
