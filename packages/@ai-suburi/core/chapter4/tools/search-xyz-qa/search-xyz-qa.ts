import { tool } from '@langchain/core/tools';
import OpenAI from 'openai';
import { z } from 'zod/v4';
import { openDatabase } from '../db.js';
import { createQaIndex } from './create-qa-index.js';

// 検索結果の最大取得数
const MAX_SEARCH_RESULTS = 3;

// 検索結果の型定義
interface SearchOutput {
  fileName: string;
  content: string;
}

// 入力スキーマを定義
const searchQuerySchema = z.object({
  query: z.string().describe('検索クエリ'),
});

/**
 * 2つのベクトル間のコサイン類似度を計算する
 * @param a - 比較元のベクトル
 * @param b - 比較先のベクトル
 * @returns コサイン類似度（-1 〜 1）
 */
function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// LangChainのtool関数を使って、検索機能をツール化
const searchXyzQa = tool(
  async ({ query }): Promise<SearchOutput[]> => {
    console.log(`Searching XYZ QA by query: ${query}`);

    const db = openDatabase();

    // インデックスが未作成の場合は自動で作成
    const count = db
      .prepare('SELECT COUNT(*) as cnt FROM qa_documents')
      .get() as { cnt: number };
    if (count.cnt === 0) {
      db.close();
      console.log('QAインデックスが空のため、自動作成を開始します...');
      await createQaIndex();
      return searchXyzQa.invoke({ query });
    }

    try {
      // クエリのembeddingを生成
      console.log('Generating embedding vector from input query');
      const openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      const response = await openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      const firstData = response.data[0];
      if (!firstData) {
        throw new Error('Embedding API からの応答が空です');
      }
      const queryEmbedding = new Float64Array(firstData.embedding);

      // 全ドキュメントを取得してコサイン類似度を計算
      const rows = db
        .prepare('SELECT file_name, content, embedding FROM qa_documents')
        .all() as Array<{
        file_name: string;
        content: string;
        embedding: Buffer;
      }>;

      const scored = rows.map((row) => {
        const embedding = new Float64Array(
          row.embedding.buffer,
          row.embedding.byteOffset,
          row.embedding.byteLength / Float64Array.BYTES_PER_ELEMENT,
        );
        return {
          fileName: row.file_name,
          content: row.content,
          score: cosineSimilarity(queryEmbedding, embedding),
        };
      });

      // スコア降順でソートし、上位を返す
      scored.sort((a, b) => b.score - a.score);

      const outputs: SearchOutput[] = scored
        .slice(0, MAX_SEARCH_RESULTS)
        .map(({ fileName, content }) => ({ fileName, content }));

      console.log(`Search results: ${outputs.length} hits`);
      console.log('Finished searching XYZ QA by query');
      return outputs;
    } finally {
      db.close();
    }
  },
  {
    name: 'search_xyz_qa',
    description: 'XYZシステムの過去の質問回答ペアを検索する関数。',
    schema: searchQuerySchema,
  },
);

export { searchXyzQa, type SearchOutput };
