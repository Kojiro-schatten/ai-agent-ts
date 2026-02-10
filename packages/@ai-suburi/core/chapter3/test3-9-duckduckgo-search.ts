import { SafeSearchType, search } from "duck-duck-scrape";

// リトライ付きで検索を実行する関数
async function searchWithRetry(
  query: string,
  maxRetries = 3,
  baseDelay = 2000,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await search(query, {
        safeSearch: SafeSearchType.OFF,
        locale: "ja-JP",
      });
    } catch (e) {
      if (attempt === maxRetries) throw e;
      const delay = baseDelay * attempt;
      console.log(
        `検索リクエストがブロックされました。${delay}ms 待機してリトライします... (${attempt}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("検索に失敗しました");
}

// DuckDuckGo検索を実行（リトライ付き）
const searchQuery = "AIエージェント 実践本";
const searchResponse = await searchWithRetry(searchQuery);
const searchResults = searchResponse.results.slice(0, 3);

// 検索結果を表示
console.log("\n検索結果:");
searchResults.forEach((result, i) => {
  console.log(`\n${i + 1}. ${result.title}`);
  console.log(`   概要: ${(result.description ?? "").slice(0, 100)}...`);
  console.log(`   URL: ${result.url}`);
});

// 最初の検索結果のURLを取得
if (searchResults.length > 0) {
  const url = searchResults[0]?.url ?? "";
  console.log(`\n最初の検索結果のURLにアクセスしています: ${url}`);

  // Webページを取得
  try {
    const response = await fetch(url);
    const htmlContent = await response.text();
    console.log(`\nHTTPステータスコード: ${response.status}`);
    console.log(
      `\nHTMLコンテンツの大きさ: ${new Blob([htmlContent]).size} bytes`,
    );
    console.log(
      `\nHTMLコンテンツの最初の部分: \n${htmlContent.slice(0, 500)}...`,
    );
  } catch (e) {
    console.log(`\nエラーが発生しました: ${e}`);
  }
} else {
  console.log("\n検索結果はありませんでした");
}
