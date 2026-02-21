export interface Settings {
  openaiApiKey: string;
  e2bApiKey: string;
  openaiModel: string;
}

/**
 * 環境変数からアプリケーション設定を読み込む。
 * OPENAI_API_KEY および E2B_API_KEY が未設定の場合はエラーをスローする。
 * @returns {Settings} 環境変数から取得した設定オブジェクト
 */
export function loadSettings(): Settings {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const e2bApiKey = process.env.E2B_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-2024-11-20';

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  if (!e2bApiKey) {
    throw new Error('E2B_API_KEY environment variable is required');
  }

  return { openaiApiKey, e2bApiKey, openaiModel };
}
