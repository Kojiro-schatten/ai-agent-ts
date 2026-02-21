# chapter5_python → TypeScript 変換プラン

## Context

`packages/@ai-suburi/core/chapter5_python/` にある Python 実装（データ分析 AI エージェント）を TypeScript に変換し、`packages/@ai-suburi/core/chapter5/` を新規作成する。chapter4 の既存パターン（Zod, LangGraph, ESM）を踏襲しつつ、Python 版の機能を忠実に再現する。

## 設計方針（ユーザー確認済み）

| 項目 | 決定 |
|:---|:---|
| OpenAI API | **Responses API** (`openai.responses.create/parse`) - Python版と同じ |
| scripts/ 配置 | **test/** にリネーム - chapter4パターン準拠 |
| describe_dataframe | **E2B sandbox内でpandas実行** - Python出力と完全互換 |

## ディレクトリ構成

```
packages/@ai-suburi/core/chapter5/
├── data/
│   └── sample.csv                    # Python版からコピー
├── models.ts                         # 全モデル定義（Zod + interfaces）
├── configs.ts                        # 環境変数（OPENAI_API_KEY, E2B_API_KEY）
├── custom-logger.ts                  # ロガー（chapter4拡張: warn/success追加）
├── prompts.ts                        # Jinja2 → テンプレートリテラル関数（5つ）
├── llm.ts                            # OpenAI Responses API ラッパー
├── modules/
│   ├── describe-dataframe.ts         # E2B sandbox内pandas describe
│   ├── generate-code.ts              # LLM コード生成（Structured Output: Program）
│   ├── set-dataframe.ts              # E2B sandbox CSV アップロード
│   ├── execute-code.ts               # E2B sandbox コード実行
│   ├── generate-review.ts            # LLM レビュー（画像vision対応）
│   ├── generate-plan.ts              # LLM 分析計画立案
│   └── generate-report.ts            # 結果集約 → Markdownレポート
├── graph/
│   ├── state.ts                      # ProgrammerState, DataAnalysisState
│   ├── nodes/
│   │   ├── set-dataframe-node.ts
│   │   ├── generate-code-node.ts
│   │   ├── execute-code-node.ts
│   │   ├── generate-review-node.ts
│   │   ├── generate-plan-node.ts
│   │   ├── generate-report-node.ts
│   │   └── approve-plan-node.ts
│   ├── programmer.ts                 # Programmer サブグラフ
│   └── data-analysis.ts              # メイングラフ（plan→approve→execute→report）
└── test/
    ├── test-01-e2b-sandbox.ts
    ├── test-02-template.ts
    ├── test-03-describe-dataframe.ts
    ├── test-04-generate-profile.ts
    ├── test-05-generate-code.ts
    ├── test-06-execute-code.ts
    ├── test-07-generate-review.ts
    ├── test-08-programmer.ts
    ├── test-09-generate-plan.ts
    ├── test-10-execute-plan.ts
    └── test-11-generate-report.ts
```

## ファイル別変換詳細

### 1. `models.ts` — 全モデル統合

Python の 4ファイル（`data_thread.py`, `program.py`, `review.py`, `plan.py`）+ `llm_response.py` + graph用 `DataThread` を1ファイルに統合。

- `Program`, `Review`, `Plan`, `Task` → Zod schema + `z.infer<>` で型導出
- `SubTask`, `DataThread`, `LLMResponse` → TypeScript interface
- Pydantic `Field(description=...)` → Zod `.describe(...)`
- snake_case → camelCase（`process_id` → `processId`）

**参照元:** `chapter5_python/src/models/*.py`, `chapter5_python/src/llms/models/llm_response.py`, `chapter5_python/src/graph/models/programmer_state.py`

### 2. `configs.ts` — 環境変数

```typescript
export interface Settings {
  openaiApiKey: string;
  e2bApiKey: string;
  openaiModel: string;  // default: "gpt-4o-2024-11-20"
}
```

**参照元:** `chapter4/configs.ts`

### 3. `custom-logger.ts` — ロガー

chapter4 の Logger interface を拡張して `warn` + `success` を追加（Python版 loguru の `logger.warning()`, `logger.success()` に対応）。

**参照元:** `chapter4/custom-logger.ts`

### 4. `prompts.ts` — テンプレート関数

5つの Jinja2 テンプレートを TypeScript 関数に変換:
- `describeDataframePrompt(dfInfo, dfSample, dfDescribe)` → `describe_dataframe.jinja`
- `generateCodePrompt(dataInfo?, remoteSaveDir)` → `generate_code.jinja`
- `generatePlanPrompt(dataInfo?)` → `generate_plan.jinja`
- `generateReviewPrompt(dataInfo?)` → `generate_review.jinja`
- `generateReportPrompt(dataInfo?)` → `generate_report.jinja`

Jinja2 の `{% if data_info %}` → `${dataInfo ? \`...\` : ''}`

**参照元:** `chapter5_python/src/prompts/*.jinja`, `chapter4/prompts.ts`

### 5. `llm.ts` — OpenAI Responses API ラッパー

Python版 `src/llms/apis/openai.py` の忠実な変換:
- `openai.responses.create()` — 通常レスポンス
- `openai.responses.parse()` — Structured Output（Zod schema）
- コスト計算ロジックも移植
- `content_idx` の o1/o3 判定ロジックも維持

**参照元:** `chapter5_python/src/llms/apis/openai.py`

### 6. `modules/describe-dataframe.ts`

**Python版との変更点:** ホスト側 pandas → E2B sandbox内 pandas に変更。

sandbox 内で以下の Python コードを実行して結果を取得:
```python
df = pd.read_csv('/path/to/data.csv')
df.info(), df.sample(5).to_markdown(), df.describe().to_markdown()
```

stdout をパースして `prompts.ts` の `describeDataframePrompt()` に渡す。

**参照元:** `chapter5_python/src/modules/describe_dataframe.py`

### 7. `modules/set-dataframe.ts`

E2B sandbox にCSVファイルをアップロードし、pandas で読み込む。
- `fs.readFileSync()` でバッファ取得 → `sandbox.files.write()` でアップロード
- sandbox 内で `pd.read_csv()` を実行

**参照元:** `chapter5_python/src/modules/set_dataframe.py`

### 8. `modules/execute-code.ts`

E2B sandbox でコード実行し、DataThread を返す。
- `sandbox.runCode(code)` → `execution.results` をパース
- PNG画像: `r.png` → base64 string として results に格納
- テキスト: `r.text` → results に格納

**参照元:** `chapter5_python/src/modules/execute_code.py`

### 9. `modules/generate-code.ts`

LLM でコード生成（Structured Output: `programSchema`）。
- 前回の DataThread（レビュー結果）があれば自己修正メッセージを追加
- `openai.responses.parse()` + `programSchema`

**参照元:** `chapter5_python/src/modules/generate_code.py`

### 10. `modules/generate-review.ts`

LLM でコード実行結果をレビュー（vision対応）。
- 画像結果は base64 → `image_url` メッセージ形式で送信
- `openai.responses.parse()` + `reviewSchema`

**参照元:** `chapter5_python/src/modules/generate_review.py`

### 11. `modules/generate-plan.ts`

LLM で分析計画を立案。
- `openai.responses.parse()` + `planSchema`

**参照元:** `chapter5_python/src/modules/generate_plan.py`

### 12. `modules/generate-report.ts`

分析結果を集約して Markdown レポートを生成。
- base64画像 → `Buffer.from(base64, 'base64')` + `fs.writeFileSync()` でPNG保存（PIL不要）
- vision メッセージでLLMに送信
- レポートを `outputs/` に保存

**参照元:** `chapter5_python/src/modules/generate_report.py`

### 13. `graph/state.ts`

LangGraph の Annotation で状態定義:
- `ProgrammerStateAnnotation` — サブグラフ用
- `DataAnalysisStateAnnotation` — メイングラフ用
- graph 内で使う `DataThread` interface（`programmer_state.py` の BaseModel 版）

**参照元:** `chapter5_python/src/graph/models/programmer_state.py`, `data_analysis_state.py`, `chapter4/agent.ts`

### 14. `graph/nodes/` — 7ノード

各ノードを関数として実装。`Command` で次ノードへの遷移を制御:
- `setDataframeNode` — sandbox 接続 → CSV アップロード → describe
- `generateCodeNode` — コード生成 → DataThread 作成
- `executeCodeNode` — sandbox でコード実行
- `generateReviewNode` — レビュー → 完了判定 or 再生成ループ
- `generatePlanNode` — 分析計画立案
- `approvePlan` — `interrupt()` で human-in-the-loop
- `generateReportNode` — レポート生成

**参照元:** `chapter5_python/src/graph/nodes/*.py`

### 15. `graph/programmer.ts`

Programmer サブグラフ:
```
set_dataframe → generate_code → execute_code → generate_review
                     ↑                              ↓
                     └──── (未完了なら再生成) ──────┘
```

`close_programmer` を外部から注入するパターンを維持。

**参照元:** `chapter5_python/src/graph/programmer.py`

### 16. `graph/data-analysis.ts`

メイングラフ:
```
generate_plan → approve_plan → open_programmer → programmer(subgraph)
                                      ↑                    ↓
                                      └── (未完了タスク) ──┘
                                                           ↓
                                                    generate_report
```

- `Command(graph=Command.PARENT)` — サブグラフから親グラフへの制御戻し
- `interrupt()` — human-in-the-loop（approve_plan）
- `MemorySaver` checkpointer

**参照元:** `chapter5_python/src/graph/data_analysis.py`

### 17. `test/` — 11テストスクリプト

Python の `scripts/01~11` をそれぞれ変換。`pnpm tsx` で実行可能なスタンドアロンスクリプト。
- `ThreadPoolExecutor` → `Promise.all()` に変換

**参照元:** `chapter5_python/scripts/*.py`

## 新規依存パッケージ

```bash
cd packages/@ai-suburi/core && pnpm add @e2b/code-interpreter
```

既存パッケージ（追加不要）: `openai`, `zod`, `@langchain/langgraph`, `@langchain/core`

## 実装順序

### Phase 1: 基盤（依存なし）
1. `data/sample.csv` コピー
2. `configs.ts`
3. `custom-logger.ts`
4. `models.ts`
5. `prompts.ts`

### Phase 2: コアモジュール
6. `llm.ts`
7. `modules/set-dataframe.ts`
8. `modules/describe-dataframe.ts`
9. `modules/execute-code.ts`
10. `modules/generate-code.ts`
11. `modules/generate-review.ts`
12. `modules/generate-plan.ts`
13. `modules/generate-report.ts`

### Phase 3: テスト（モジュール動作確認）
14. `test/test-01-e2b-sandbox.ts` 〜 `test/test-07-generate-review.ts`

### Phase 4: LangGraph グラフ
15. `graph/state.ts`
16. `graph/nodes/*` （7ノード）
17. `graph/programmer.ts`
18. `graph/data-analysis.ts`

### Phase 5: 残りテスト
19. `test/test-08-programmer.ts` 〜 `test/test-11-generate-report.ts`

## 検証方法

1. **型チェック**: `npx tsc --noEmit` でコンパイルエラーがないことを確認
2. **個別テスト**: 各 `test/test-*.ts` を `pnpm tsx` で実行し、Python版と同等の動作を確認
   - E2B_API_KEY と OPENAI_API_KEY の環境変数が必要
3. **E2Eテスト**: `test/test-11-generate-report.ts`（全体フロー）を実行し、`outputs/` にレポートが生成されることを確認

## 注意点

- **E2B TS SDK の API**: Python版 `Sandbox()` のコンテキストマネージャ → TS版は `Sandbox.create()` + `sandbox.close()` / `Sandbox.kill(id)` になる可能性。実装時にSDKドキュメントを確認
- **LangGraph `Command` / `interrupt`**: `@langchain/langgraph` v1.1.4 での対応状況を実装時に確認。`Command(graph=Command.PARENT)` パターンの TS 互換性が重要
- **Responses API の Structured Output**: `openai.responses.parse()` + Zod schema の組み合わせが TS SDK v6 で正しく動くか確認が必要
