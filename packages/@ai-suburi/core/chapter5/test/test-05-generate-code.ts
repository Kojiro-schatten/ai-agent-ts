import { Sandbox } from '@e2b/code-interpreter';

import { setupLogger } from '../custom-logger.js';
import type { Program } from '../models.js';
import { describeDataframe } from '../modules/describe-dataframe.js';
import { generateCode } from '../modules/generate-code.js';

const logger = setupLogger('test-05');

/**
 * generateCodeの動作を確認するテスト。
 * データファイルの概要情報を取得し、ユーザーリクエストに基づいてコードを生成・表示する。
 * @returns なし
 */
async function main(): Promise<void> {
  const dataPath = 'chapter5/data/sample.csv';
  const userRequest = 'データの概要について教えて';

  const sandbox = await Sandbox.create();
  try {
    const dataInfo = await describeDataframe(sandbox, dataPath);
    const response = await generateCode(dataInfo, userRequest);
    if (response.content === null) {
      throw new Error('Failed to parse code generation output');
    }
    const program: Program = response.content;
    logger.info(JSON.stringify(program, null, 4));
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
}

main();
