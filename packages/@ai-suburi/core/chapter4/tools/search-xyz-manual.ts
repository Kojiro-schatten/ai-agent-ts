import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { setupLogger } from '../logger.js';
import type { AgentTool, SearchOutput } from '../models.js';

const MAX_SEARCH_RESULTS = 3;

const logger = setupLogger('search-xyz-manual');

export const searchXyzManual: AgentTool = {
  name: 'search_xyz_manual',
  definition: {
    type: 'function',
    function: {
      name: 'search_xyz_manual',
      description:
        'XYZシステムのドキュメントを調査する関数。' +
        'エラーコードや固有名詞が質問に含まれる場合は、この関数を使ってキーワード検索を行う。',
      parameters: {
        type: 'object',
        properties: {
          keywords: {
            type: 'string',
            description: '全文検索用のキーワード',
          },
        },
        required: ['keywords'],
      },
    },
  },

  async invoke(args: Record<string, unknown>): Promise<SearchOutput[]> {
    const keywords = (args['keywords'] as string | undefined) ?? '';
    logger.info(`Searching XYZ manual by keyword: ${keywords}`);

    if (!keywords.trim()) {
      logger.warn('Empty keywords provided, returning empty results');
      return [];
    }

    const es = new ElasticsearchClient({ node: 'http://localhost:9200' });

    const indexName = 'documents';

    const response = await es.search({
      index: indexName,
      query: { match: { content: keywords } },
    });

    const hits = response.hits.hits;
    logger.info(`Search results: ${hits.length} hits`);

    const outputs: SearchOutput[] = [];
    for (const hit of hits.slice(0, MAX_SEARCH_RESULTS)) {
      const source = hit._source as { file_name: string; content: string } | undefined;
      if (source) {
        outputs.push({
          file_name: source.file_name,
          content: source.content,
        });
      }
    }

    logger.info('Finished searching XYZ manual by keyword');
    return outputs;
  },
};
