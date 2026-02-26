import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { QdrantClient } from '@qdrant/js-client-rest';

async function deleteEsIndex(es: ElasticsearchClient, indexName: string): Promise<void> {
  const exists = await es.indices.exists({ index: indexName });
  if (exists) {
    await es.indices.delete({ index: indexName });
    console.log(`Index '${indexName}' has been deleted.`);
  } else {
    console.log(`Index '${indexName}' does not exist.`);
  }
}

async function deleteQdrantIndex(
  qdrantClient: QdrantClient,
  collectionName: string,
): Promise<void> {
  const exists = await qdrantClient.collectionExists(collectionName);
  if (exists.exists) {
    await qdrantClient.deleteCollection(collectionName);
    console.log(`Collection '${collectionName}' has been deleted.`);
  } else {
    console.log(`Collection '${collectionName}' does not exist.`);
  }
}

async function main(): Promise<void> {
  const es = new ElasticsearchClient({ node: 'http://localhost:9200' });
  const qdrantClient = new QdrantClient({ url: 'http://localhost:6333' });

  const indexName = 'documents';

  await deleteEsIndex(es, indexName);
  await deleteQdrantIndex(qdrantClient, indexName);
}

main().catch(console.error);
