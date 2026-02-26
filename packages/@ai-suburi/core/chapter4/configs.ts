export interface Settings {
  openaiApiKey: string;
  openaiApiBase: string;
  openaiModel: string;
}

export function loadSettings(): Settings {
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  const openaiApiBase = process.env['OPENAI_API_BASE'] || 'https://api.openai.com/v1';
  const openaiModel = process.env['OPENAI_MODEL'] || 'gpt-5-nano-2025-08-07';

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  return { openaiApiKey, openaiApiBase, openaiModel };
}
