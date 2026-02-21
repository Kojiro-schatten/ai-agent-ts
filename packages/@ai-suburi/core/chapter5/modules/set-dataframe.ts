import * as fs from 'node:fs';

import type { Sandbox } from '@e2b/code-interpreter';

/**
 * ローカルのCSVファイルをE2Bサンドボックスにアップロードし、pandasのDataFrameとして読み込む。
 * @param sandbox - E2Bサンドボックスインスタンス
 * @param filePath - アップロードするローカルCSVファイルのパス
 * @param timeout - コード実行のタイムアウト秒数（デフォルト: 1200）
 * @param remoteDataPath - サンドボックス内でのデータ保存先パス（デフォルト: '/home/data.csv'）
 */
export async function setDataframe(
  sandbox: Sandbox,
  filePath: string,
  timeout: number = 1200,
  remoteDataPath: string = '/home/data.csv',
): Promise<void> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  await sandbox.files.write(remoteDataPath, fileContent);
  await sandbox.runCode(
    `import pandas as pd; df = pd.read_csv('${remoteDataPath}')`,
    { timeoutMs: timeout * 1000 },
  );
}
