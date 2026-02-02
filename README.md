# genai-agent-advanced-book-typescript

TypeScript版 現場で活用するためのAIエージェント実践入門

## 開発環境

本プロジェクトでは以下のツールを使用しています。

| ツール | 説明 |
| --- | --- |
| [pnpm](https://pnpm.io/) | パッケージマネージャー |
| [tsx](https://www.npmjs.com/package/tsx) | TypeScript ファイルの直接実行 |
| [Biome](https://biomejs.dev/) | リンター・フォーマッター |

## direnvのインストール

direnvを使って環境変数を管理します。

### macOS (Homebrew)

```zsh
brew install direnv
```

シェルにhookを追加します（zshの場合）。

```zsh
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```

### `.envrc` の設定

プロジェクトルートに `.envrc` ファイルを作成し、必要な環境変数を記述します。

```zsh
cp .envrc.example .envrc  # テンプレートがある場合
direnv allow
```

## pnpmのインストール

### Homebrew

```zsh
brew install pnpm
```

### npm

```zsh
npm install -g pnpm
```

## npmパッケージのインストール

```zsh
pnpm install
```

TSファイル実行例

```zsh
pnpm tsx src/chapter3/test3-1-chat-completions-api.ts
```
