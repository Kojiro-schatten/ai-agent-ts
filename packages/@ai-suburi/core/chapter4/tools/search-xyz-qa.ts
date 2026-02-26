import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { loadSettings } from '../configs.js';
import { setupLogger } from '../logger.js';
import type { AgentTool, SearchOutput } from '../models.js';

const MAX_SEARCH_RESULTS = 3;

const logger = setupLogger('search-xyz-qa');

export const searchXyzQa: AgentTool = {
  name: 'search_xyz_qa',
  definition: {
    type: 'function',
    function: {
      name: 'search_xyz_qa',
      description: 'XYZシステムの過去の質問回答ペアを検索する関数。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '検索クエリ',
          },
        },
        required: ['query'],
      },
    },
  },

  async invoke(args: Record<string, unknown>): Promise<SearchOutput[]> {
    const query = args['query'] as string;
    logger.info(`Searching XYZ QA by query: ${query}`);

    const qdrantClient = new QdrantClient({ url: 'http://localhost:6333' });

    const settings = loadSettings();
    const openaiClient = new OpenAI({ apiKey: settings.openaiApiKey });

    logger.info('Generating embedding vector from input query');
    const embeddingResponse = await openaiClient.embeddings.create({
      input: query,
      model: 'text-embedding-3-small',
    });
    const queryVector = embeddingResponse.data[0]!.embedding;

    const searchResults = await qdrantClient.search('documents', {
      vector: queryVector,
      limit: MAX_SEARCH_RESULTS,
    });

    logger.info(`Search results: ${searchResults.length} hits`);

    const outputs: SearchOutput[] = [];
    for (const point of searchResults) {
      const payload = point.payload as { file_name: string; content: string } | undefined;
      if (payload) {
        outputs.push({
          file_name: payload.file_name,
          content: payload.content,
        });
      }
    }

    logger.info('Finished searching XYZ QA by query');
    return outputs;
  },
};
