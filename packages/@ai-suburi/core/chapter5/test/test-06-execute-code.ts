import { Sandbox } from '@e2b/code-interpreter';

import { executeCode } from '../modules/execute-code.js';
import { setDataframe } from '../modules/set-dataframe.js';

/**
 * executeCodeの動作を確認するテスト。
 * サンドボックス上でデータフレームを設定し、Pythonコードを実行して結果を確認する。
 * @returns なし
 */
async function main(): Promise<void> {
  const sandbox = await Sandbox.create();
  try {
    await setDataframe(sandbox, 'chapter5/data/sample.csv');
    const dataThread = await executeCode(
      sandbox,
      '06_execute_code',
      0,
      'print(df.shape)',
    );
    console.log(JSON.stringify(dataThread, null, 4));
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
}

main();
