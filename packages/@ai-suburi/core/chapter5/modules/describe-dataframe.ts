import * as fs from 'node:fs';

import type { Sandbox } from '@e2b/code-interpreter';

import { describeDataframePrompt } from '../prompts.js';

/**
 * E2Bサンドボックス上でpandasを使い、データフレームのinfo・サンプル・統計量を取得して整形した文字列を返す。
 * @param sandbox - E2Bサンドボックスインスタンス
 * @param filePath - アップロードするローカルCSVファイルのパス
 * @param remoteDataPath - サンドボックス内でのデータ保存先パス（デフォルト: '/home/data.csv'）
 * @returns 整形されたデータフレーム概要のプロンプト文字列
 */
export async function describeDataframe(
  sandbox: Sandbox,
  filePath: string,
  remoteDataPath: string = '/home/data.csv',
): Promise<string> {
  // sandbox にファイルをアップロード
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  await sandbox.files.write(remoteDataPath, fileContent);

  // sandbox 内で pandas describe を実行（tabulate は to_markdown() に必要）
  await sandbox.runCode('import subprocess; subprocess.run(["pip", "install", "-q", "tabulate"])');

  const code = `
import pandas as pd
import io

df = pd.read_csv('${remoteDataPath}')

buf = io.StringIO()
df.info(buf=buf)
df_info = buf.getvalue()

df_sample = df.sample(5).to_markdown()
df_describe = df.describe().to_markdown()

print("===DF_INFO===")
print(df_info)
print("===DF_SAMPLE===")
print(df_sample)
print("===DF_DESCRIBE===")
print(df_describe)
`;
  const execution = await sandbox.runCode(code);
  const stdout = execution.logs.stdout.join('');

  // stdout をパースして各セクションを取得
  const infoMatch = stdout.match(
    /===DF_INFO===\n([\s\S]*?)===DF_SAMPLE===/,
  );
  const sampleMatch = stdout.match(
    /===DF_SAMPLE===\n([\s\S]*?)===DF_DESCRIBE===/,
  );
  const describeMatch = stdout.match(/===DF_DESCRIBE===\n([\s\S]*?)$/);

  const dfInfo = infoMatch?.[1]?.trim() ?? '';
  const dfSample = sampleMatch?.[1]?.trim() ?? '';
  const dfDescribe = describeMatch?.[1]?.trim() ?? '';

  return describeDataframePrompt({ dfInfo, dfSample, dfDescribe });
}
