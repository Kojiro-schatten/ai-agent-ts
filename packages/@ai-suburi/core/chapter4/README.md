# Chapter 4 - RAG を活用したヘルプデスクエージェント（TypeScript版）

書籍「現場で活用するためのAIエージェント実践入門」（講談社）の第4章に対応するソースコードです。
原書の Python 実装を TypeScript に移植しています。

## 概要

XYZ システムのヘルプデスク業務を自動化するエージェントです。
LangGraph によるワークフロー制御と、Elasticsearch（キーワード検索）+ Qdrant（ベクトル検索）の 2 種類の RAG を組み合わせて回答を生成します。

### エージェントの処理フロー

```
質問 → 計画立案(create_plan)
           ↓
       サブタスク並列実行(execute_subtasks × N)
         ┌──────────────────────────┐
         │ ツール選択(select_tools)   │
         │     ↓                     │
         │ ツール実行(execute_tools)   │
         │     ↓                     │
         │ 回答作成(create_subtask_answer) │
         │     ↓                     │
         │ 内省(reflect_subtask)      │
         │     ↓                     │
         │ OK → 完了 / NG → リトライ   │
         └──────────────────────────┘
           ↓
       最終回答作成(create_answer)
```

## ディレクトリ構成

```
chapter4/
├── run-agent.ts                # エージェント実行スクリプト（エントリーポイント）
├── agent.ts                    # HelpDeskAgent（LangGraph メイングラフ + サブグラフ）
├── configs.ts                  # 環境変数からの設定読み込み
├── logger.ts                   # シンプルなロガー
├── models.ts                   # Zod スキーマ / TypeScript 型定義
├── prompts.ts                  # プロンプト定数 + HelpDeskAgentPrompts クラス
├── tools/
│   ├── search-xyz-manual.ts    # Elasticsearch キーワード検索ツール
│   └── search-xyz-qa.ts       # Qdrant ベクトル検索ツール
├── scripts/
│   ├── create-index.ts         # インデックス作成 + データ投入スクリプト
│   └── delete-index.ts         # インデックス削除スクリプト
├── data/                       # PDF / CSV データ
├── docker-compose.yml          # Elasticsearch + Qdrant コンテナ定義
├── .docker/Dockerfile          # Elasticsearch（kuromoji プラグイン入り）
├── .env.sample                 # 環境変数のサンプル
└── Makefile                    # 便利コマンド集
```

## 前提条件

- Node.js 20 以上
- pnpm（パッケージマネージャ）
- Docker および Docker Compose
- OpenAI の API キー

## 環境構築

### 1. 依存パッケージのインストール

プロジェクトルートで実行します。

```bash
pnpm install
```

### 2. 環境変数の設定

プロジェクトルートの `.envrc`（または `.env`）に以下を設定します。

```bash
export OPENAI_API_KEY="<your_openai_api_key>"
export OPENAI_API_BASE="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-4o-2024-08-06"
```

OpenAI API キーを持っていない場合は [OpenAI Platform](https://platform.openai.com/) から取得してください。

direnv を使っている場合は `direnv allow` で反映されます。

### 3. Docker コンテナの起動

chapter4 ディレクトリに移動して実行します。

```bash
cd packages/@ai-suburi/core/chapter4
make start.engine
```

Elasticsearch（kuromoji プラグイン付き）と Qdrant が起動します。

### 4. 検索インデックスの構築

```bash
make create.index
```

`data/` 内の PDF と CSV を読み込み、以下のインデックスを作成します。

| 検索エンジン | コレクション名 | データソース | 用途 |
|-------------|--------------|------------|------|
| Elasticsearch | `documents` | PDF（マニュアル） | キーワード検索 |
| Qdrant | `documents` | CSV（過去 QA） | ベクトル検索 |

#### トラブルシューティング

`create.index` 実行時に Elasticsearch でエラーが発生する場合は、`docker-compose.yml` の volumes をコメントアウトしてください。
コメントアウトした場合、データは永続化されないため、コンテナ削除時に再構築が必要です。

```yaml
    # volumes:
    #   - ./.rag_data/es_data:/usr/share/elasticsearch/data
```

## エージェントの実行

```typescript
import { loadSettings } from './configs.js';
import { HelpDeskAgent } from './agent.js';
import { searchXyzManual } from './tools/search-xyz-manual.js';
import { searchXyzQa } from './tools/search-xyz-qa.js';

const settings = loadSettings();
const agent = new HelpDeskAgent(settings, [searchXyzManual, searchXyzQa]);

const result = await agent.runAgent('パスワードに利用可能な文字の制限について教えてください');
console.log(result.answer);
```

同梱の `run-agent.ts` で動作確認できます。

```bash
npx tsx run-agent.ts
```

## 主な技術スタック

| 役割 | ライブラリ |
|------|----------|
| エージェントワークフロー | `@langchain/langgraph`（StateGraph / Send） |
| LLM 呼び出し | `openai` SDK（Structured Output / Function Calling） |
| スキーマ定義 | `zod` v4（zodResponseFormat 連携） |
| キーワード検索 | `@elastic/elasticsearch` v9 |
| ベクトル検索 | `@qdrant/js-client-rest` |
| PDF パース | `pdf-parse` v2 |
| CSV パース | `csv-parse` |

## Make コマンド一覧

| コマンド | 内容 |
|---------|------|
| `make start.engine` | Docker コンテナ起動 |
| `make stop.engine` | Docker コンテナ停止 |
| `make create.index` | 検索インデックス作成 + データ投入 |
| `make delete.index` | 検索インデックス削除 |
