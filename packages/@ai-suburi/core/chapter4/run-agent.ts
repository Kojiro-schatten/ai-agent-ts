import { loadSettings } from './configs.js';
import { HelpDeskAgent } from './agent.js';
import { searchXyzManual } from './tools/search-xyz-manual.js';
import { searchXyzQa } from './tools/search-xyz-qa.js';

const settings = loadSettings();

const agent = new HelpDeskAgent(settings, [searchXyzManual, searchXyzQa]);

const question = `
お世話になっております。

現在、XYZシステムを利用しており、以下の点についてご教示いただければと存じます。

1. パスワードを所定回数間違えて、ログインがロックされたらどうすれば良いですか？

お忙しいところ恐縮ですが、ご対応のほどよろしくお願い申し上げます。
`;

// ヘルプデスクエージェント全体を実行
const result = await agent.runAgent(question);

// 回答
console.log(result.answer);
