// テンプレートエンジンの使い方（TypeScript テンプレートリテラル版）

/**
 * テンプレートに変数を埋め込んで文字列を生成する。
 * メッセージが指定された場合はフォーマットされた文字列を返し、未指定の場合は空文字列を返す。
 * @param message - 埋め込むメッセージ文字列（省略可能）
 * @returns フォーマットされたメッセージ文字列、または空文字列
 */
function renderTemplate(message?: string): string {
  return message ? `メッセージがあります: ${message}` : '';
}

/**
 * テンプレートレンダリングの動作確認テスト。
 * メッセージ指定あり・なしの両パターンでrenderTemplateの出力を確認する。
 */
function main(): void {
  // 1. 引数に message を指定した場合
  console.log('1.', renderTemplate('hello'));
  // 2. 引数に message を指定しなかった場合
  console.log('2.', renderTemplate());
}

main();
