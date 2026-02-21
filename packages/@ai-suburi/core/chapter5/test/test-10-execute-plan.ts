import * as fs from 'node:fs';

import { Sandbox } from '@e2b/code-interpreter';

import { setupLogger } from '../custom-logger.js';
import type { Plan } from '../models.js';
import { describeDataframe } from '../modules/describe-dataframe.js';
import { generatePlan } from '../modules/generate-plan.js';
import { programmerNode } from './programmer-node.js';

const logger = setupLogger('test-10');

/**
 * 計画生成から並行実行までの一連フローを確認するテスト。
 * データの概要取得、分析計画の生成、各タスクの並行実行、実行結果のファイル保存を行う。
 * @returns なし
 */
async function main(): Promise<void> {
  const dataFile = 'chapter5/data/sample.csv';
  const userRequest =
    'scoreを最大化するための広告キャンペーンを検討したい';
  const outputDir = 'outputs/tmp';
  fs.mkdirSync(outputDir, { recursive: true });

  // 計画生成
  const sandbox = await Sandbox.create();
  let dataInfo: string;
  try {
    dataInfo = await describeDataframe(sandbox, dataFile);
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
  const response = await generatePlan(
    dataInfo,
    userRequest,
    'gpt-4o-mini-2024-07-18',
  );
  if (response.content === null) {
    throw new Error('Failed to parse plan output');
  }
  const plan: Plan = response.content;

  // 各計画の並行実行
  const promises = plan.tasks.map((task, idx) =>
    programmerNode(
      dataFile,
      task.hypothesis,
      `sample-${idx}`,
      'gpt-4o-2024-11-20',
      3,
      idx,
    ),
  );
  const results = await Promise.all(promises);
  const sortedResults = results.sort((a, b) => a[0] - b[0]);

  // 実行結果の保存
  for (const [, dataThreads] of sortedResults) {
    const dataThread = dataThreads[dataThreads.length - 1]!;
    const outputFile = `${outputDir}/${dataThread.processId}_${dataThread.threadId}`;
    if (dataThread.isCompleted) {
      for (let i = 0; i < dataThread.results.length; i++) {
        const res = dataThread.results[i]!;
        if (res.type === 'png') {
          const imageData = Buffer.from(res.content, 'base64');
          fs.writeFileSync(`${outputFile}_${i}.png`, imageData);
        } else {
          fs.writeFileSync(`${outputFile}_${i}.txt`, res.content);
        }
      }
    } else {
      logger.warn(
        `userRequest=${dataThread.userRequest} is not completed.`,
      );
    }
  }
}

main();
