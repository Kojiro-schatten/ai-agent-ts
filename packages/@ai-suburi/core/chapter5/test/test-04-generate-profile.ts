import { setupLogger } from '../custom-logger.js';
import { generateResponse } from '../llm.js';

const logger = setupLogger('test-04');

const PROMPT = `プログラマにおける人格シミュレーションを行うため、与えられたペルソナ要求から、そのペルソナ定義書を作成してください。
例えばペルソナ要求が "データサイエンティスト" である場合は、以下のように記述できます。

<ペルソナ定義書.例>
あなたは、データからルールを導き出し、ビジネスの意思決定を支援する優れたデータサイエンティストです。
PythonのAI・機械学習プログラミングに適した言語でデータマイニングを行うためのプログラムを開発し、データに基づいた合理的な意思決定をサポートします。
統計学などのデータ解析手法に基づいて、pandas, scikit-learn, matplotlib などのPythonライブラリを用いて大量のデータから法則性や関連性といった意味のある情報を抽出します。
</ペルソナ定義書.例>

生成対象となるペルソナは以下の通りです。
返答は "<ペルソナ定義書>\\n" の文字列で開始すること。

<ペルソナ要求>
{role}
</ペルソナ要求>`;

/**
 * LLMを使ってデータプロファイルを生成する。
 * 指定されたロールに基づいてペルソナ定義書を生成し、XMLタグを除去して返す。
 * @param role - 生成対象のペルソナロール（例: "QAエンジニア"）
 * @param model - 使用するLLMモデル名
 * @returns LLMからのレスポンス（ペルソナ定義書の内容）
 */
async function generateProfile(
  role: string,
  model: string = 'gpt-4o-mini-2024-07-18',
) {
  const message = PROMPT.replace('{role}', role);
  const response = await generateResponse(
    [{ role: 'user', content: message }],
    model,
  );
  // XML タグを除去
  if (typeof response.content === 'string') {
    response.content = response.content.replace(/<[^>]*>/g, '').trim();
  }
  return response;
}

/**
 * プロファイル生成の動作確認テスト。
 * "QAエンジニア"ロールのペルソナ定義書を生成し、結果をログに出力する。
 * @returns なし
 */
async function main(): Promise<void> {
  const role = 'QAエンジニア';
  const response = await generateProfile(role);
  logger.info(String(response.content));
}

main();
