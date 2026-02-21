// プログラムリスト5.3: E2B Sandbox の使い方
import { Sandbox } from '@e2b/code-interpreter';

import { setupLogger } from '../custom-logger.js';

const logger = setupLogger('test-01');

/**
 * E2Bサンドボックスの基本動作を確認するテスト。
 * サンドボックスを作成し、Pythonコードを実行して標準出力を確認する。
 * @returns なし
 */
async function main(): Promise<void> {
  const sandbox = await Sandbox.create();
  try {
    const execution = await sandbox.runCode("print('Hello World!')");
    logger.info(execution.logs.stdout.join('\n'));
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
}

main();
