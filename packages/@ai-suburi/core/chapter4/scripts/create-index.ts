import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { parse } from 'csv-parse/sync';
import { loadSettings } from '../configs.js';
import type { Settings } from '../configs.js';

// --- ドキュメント型 ---

interface Document {
  pageContent: string;
  metadata: { source: string };
}

// --- テキスト分割 ---

function splitText(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - chunkOverlap;
  }
  return chunks;
}

// --- ファイル探索 ---

function findFiles(dirPath: string, ext: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (extname(fullPath).toLowerCase() === ext) {
        results.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return results;
}

// --- PDF ドキュメント読み込み ---

async function loadPdfDocs(dataDirPath: string): Promise<Document[]> {
  const pdfPaths = findFiles(dataDirPath, '.pdf');
  const docs: Document[] = [];

  for (const pdfPath of pdfPaths) {
    const dataBuffer = readFileSync(pdfPath);
    const parser = new PDFParse({ data: dataBuffer });
    const textResult = await parser.getText();
    const text = textResult.text;
    await parser.destroy();

    // RecursiveCharacterTextSplitter相当の処理
    const chunks = splitText(text, 300, 20);

    for (const chunk of chunks) {
      docs.push({
        pageContent: chunk,
        metadata: { source: pdfPath },
      });
    }
  }

  return docs;
}

// --- CSV ドキュメント読み込み ---

function loadCsvDocs(dataDirPath: string): Document[] {
  const csvPaths = findFiles(dataDirPath, '.csv');
  const docs: Document[] = [];

  for (const csvPath of csvPaths) {
    const content = readFileSync(csvPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    }) as Record<string, string>[];

    for (const record of records) {
      const rowContent = Object.entries(record)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      docs.push({
        pageContent: rowContent,
        metadata: { source: csvPath },
      });
    }
  }

  return docs;
}

// --- Elasticsearch インデックス作成 ---

async function createKeywordSearchIndex(
  es: ElasticsearchClient,
  indexName: string,
): Promise<void> {
  const exists = await es.indices.exists({ index: indexName });
  if (!exists) {
    await es.indices.create({
      index: indexName,
      mappings: {
        properties: {
          content: {
            type: 'text',
            analyzer: 'kuromoji_analyzer',
          },
        },
      },
      settings: {
        analysis: {
          analyzer: {
            kuromoji_analyzer: {
              type: 'custom',
              char_filter: ['icu_normalizer'],
              tokenizer: 'kuromoji_tokenizer',
              filter: [
                'kuromoji_baseform',
                'kuromoji_part_of_speech',
                'ja_stop',
                'kuromoji_number',
                'kuromoji_stemmer',
              ],
            },
          },
        },
      },
    });
    console.log(`Index ${indexName} created successfully`);
  } else {
    console.log(`Index ${indexName} already exists`);
  }
}

// --- Qdrant コレクション作成 ---

async function createVectorSearchIndex(
  qdrantClient: QdrantClient,
  indexName: string,
): Promise<void> {
  const result = await qdrantClient.createCollection(indexName, {
    vectors: { size: 1536, distance: 'Cosine' },
  });
  if (result) {
    console.log(`Collection ${indexName} created successfully`);
  } else {
    console.log(`Failed to create collection ${indexName}`);
  }
}

// --- Elasticsearch にドキュメント追加 ---

async function addDocumentsToEs(
  es: ElasticsearchClient,
  indexName: string,
  docs: Document[],
): Promise<void> {
  // バッチサイズごとに分割して送信（タイムアウト防止）
  const BATCH_SIZE = 20;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const operations = batch.flatMap((doc) => [
      { index: { _index: indexName } },
      {
        file_name: basename(doc.metadata.source),
        content: doc.pageContent,
      },
    ]);

    await es.bulk({ operations });
    console.log(`  Indexed ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length} documents`);
  }
  console.log(`Added ${docs.length} documents to Elasticsearch`);
}

// --- Qdrant にドキュメント追加 ---

async function addDocumentsToQdrant(
  qdrantClient: QdrantClient,
  indexName: string,
  docs: Document[],
  settings: Settings,
): Promise<void> {
  const client = new OpenAI({ apiKey: settings.openaiApiKey });

  const points = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    const content = doc.pageContent.replace(/ /g, '');

    const embedding = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: content,
    });

    points.push({
      id: i,
      vector: embedding.data[0]!.embedding,
      payload: {
        file_name: basename(doc.metadata.source),
        content,
      },
    });
  }

  const operationInfo = await qdrantClient.upsert(indexName, {
    points,
    wait: true,
  });
  console.log(operationInfo);
}

// --- メイン処理 ---

async function main(): Promise<void> {
  const es = new ElasticsearchClient({
    node: 'http://localhost:9200',
    requestTimeout: 120_000,
  });
  const qdrantClient = new QdrantClient({ url: 'http://localhost:6333' });

  const settings = loadSettings();

  const indexName = 'documents';

  console.log(`Creating index for keyword search: ${indexName}`);
  await createKeywordSearchIndex(es, indexName);
  console.log('--------------------------------');

  console.log(`Creating index for vector search: ${indexName}`);
  await createVectorSearchIndex(qdrantClient, indexName);
  console.log('--------------------------------');

  const dataDir = join(import.meta.dirname!, '..', 'data');

  console.log('Loading documents from manual data');
  const manualDocs = await loadPdfDocs(dataDir);
  console.log(`Loaded ${manualDocs.length} documents`);
  console.log('--------------------------------');

  console.log('Loading documents from QA data');
  const qaDocs = loadCsvDocs(dataDir);
  console.log(`Loaded ${qaDocs.length} documents`);

  console.log('Adding documents to keyword search index');
  await addDocumentsToEs(es, indexName, manualDocs);
  console.log('--------------------------------');

  console.log('Adding documents to vector search index');
  await addDocumentsToQdrant(qdrantClient, indexName, qaDocs, settings);
  console.log('--------------------------------');

  console.log('Done');
}

main().catch(console.error);
