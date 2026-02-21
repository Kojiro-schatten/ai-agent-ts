import express from 'express';
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

// --- Express アプリ ---
const app = express();
app.use(express.json());

/**
 * ヘルスチェックエンドポイント
 * AgentCore Runtime はこのエンドポイントでコンテナの状態を監視する
 */
app.get('/ping', (_req, res) => {
  res.json({ status: 'Healthy' });
});

/**
 * メインの推論エンドポイント
 * AgentCore Runtime からのリクエストを受け取り、Bedrock モデルで処理して応答を返す
 */
app.post('/invocations', async (req, res) => {
  try {
    const { prompt } = req.body as { prompt?: string };

    if (!prompt) {
      res.status(400).json({
        response: 'prompt field is required',
        status: 'error',
      });
      return;
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

    res.json({
      response: responseText,
      status: 'success',
    });
  } catch (error) {
    console.error('Invocation error:', error);
    res.status(500).json({
      response: error instanceof Error ? error.message : 'Unknown error',
      status: 'error',
    });
  }
});

// --- サーバー起動 ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Agent server running on http://0.0.0.0:${PORT} (model: ${MODEL_ID})`,
  );
});
