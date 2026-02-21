import { Sandbox } from '@e2b/code-interpreter';

import { setupLogger } from '../custom-logger.js';
import type { Plan } from '../models.js';
import { describeDataframe } from '../modules/describe-dataframe.js';
import { generatePlan } from '../modules/generate-plan.js';

const logger = setupLogger('test-09');

/**
 * generatePlanの動作を確認するテスト。
 * データファイルの概要情報をもとに、ユーザーリクエストに対する分析計画を生成・表示する。
 * @returns なし
 */
async function main(): Promise<void> {
  const dataPath = 'chapter5/data/sample.csv';
  const userRequest =
    'scoreを最大化するための広告キャンペーンを検討したい';

  const sandbox = await Sandbox.create();
  try {
    const dataInfo = await describeDataframe(sandbox, dataPath);
    const response = await generatePlan(
      dataInfo,
      userRequest,
      'gpt-4o-mini-2024-07-18',
    );
    if (response.content === null) {
      throw new Error('Failed to parse plan output');
    }
    const plan: Plan = response.content;
    logger.info(JSON.stringify(plan, null, 4));
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
}

main();
