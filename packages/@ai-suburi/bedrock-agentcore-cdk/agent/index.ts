import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

// --- 設定 ---
const PORT = 8080;
const MODEL_ID =
  process.env.MODEL_ID ?? 'anthropic.claude-sonnet-4-20250514';

// --- Bedrock クライアント ---
const bedrockClient = new BedrockRuntimeClient({});

// --- Hono アプリ ---
const app = new Hono();

/**
 * ヘルスチェックエンドポイント
 * AgentCore Runtime はこのエンドポイントでコンテナの状態を監視する
 */
app.get('/ping', (c) => {
  return c.json({ status: 'Healthy' });
});

/**
 * メインの推論エンドポイント
 * AgentCore Runtime からのリクエストを受け取り、Bedrock モデルで処理して応答を返す
 */
app.post('/invocations', async (c) => {
  try {
    const { prompt } = await c.req.json<{ prompt?: string }>();

    if (!prompt) {
      return c.json(
        { response: 'prompt field is required', status: 'error' },
        400,
      );
    }

    // Bedrock Converse API でモデルを呼び出す
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
    });

    const result = await bedrockClient.send(command);

    // レスポンスからテキストを抽出
    const outputMessage = result.output?.message;
    const responseText =
      outputMessage?.content
        ?.map((block) => ('text' in block ? block.text : ''))
        .join('') ?? '';

    return c.json({ response: responseText, status: 'success' });
  } catch (error) {
    console.error('Invocation error:', error);
    return c.json(
      {
        response: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      },
      500,
    );
  }
});

// --- サーバー起動 ---
serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(
    `Agent server running on http://0.0.0.0:${PORT} (model: ${MODEL_ID})`,
  );
});
