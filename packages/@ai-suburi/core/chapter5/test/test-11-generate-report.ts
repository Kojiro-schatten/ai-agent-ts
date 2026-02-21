import * as fs from 'node:fs';

import { Sandbox } from '@e2b/code-interpreter';

import type { DataThread, Plan } from '../models.js';
import { describeDataframe } from '../modules/describe-dataframe.js';
import { generatePlan } from '../modules/generate-plan.js';
import { generateReport } from '../modules/generate-report.js';
import { programmerNode } from './programmer-node.js';

/**
 * 計画生成・実行・レポート生成の全体フローを確認するテスト。
 * コマンドライン引数からパラメータを受け取り、計画生成→並行実行→レポート生成の全工程を実行する。
 * @returns なし
 */
async function main(): Promise<void> {
  const dataFile = process.argv[2] ?? 'chapter5/data/sample.csv';
  const userRequest =
    process.argv[3] ??
    'scoreを最大化するための広告キャンペーンを検討したい';
  const processId = process.argv[4] ?? 'sample';
  const model = process.argv[5] ?? 'gpt-4o-mini-2024-07-18';

  const outputDir = `outputs/${processId}`;
  fs.mkdirSync(outputDir, { recursive: true });

  // 計画生成
  const sandbox = await Sandbox.create();
  let dataInfo: string;
  try {
    dataInfo = await describeDataframe(sandbox, dataFile);
  } finally {
    await Sandbox.kill(sandbox.sandboxId);
  }
  const response = await generatePlan(dataInfo, userRequest, model);
  if (response.content === null) {
    throw new Error('Failed to parse plan output');
  }
  const plan: Plan = response.content;

  // 各計画の並行実行
  const promises = plan.tasks.map((task, idx) =>
    programmerNode(dataFile, task.hypothesis, `sample-${idx}`, model, 3, idx),
  );
  const results = await Promise.all(promises);
  const sortedResults = results.sort((a, b) => a[0] - b[0]);

  // 実行結果の収集
  const processDataThreads: DataThread[] = [];
  for (const [, dataThreads] of sortedResults) {
    processDataThreads.push(dataThreads[dataThreads.length - 1]!);
  }

  await generateReport(
    dataInfo,
    userRequest,
    processDataThreads,
    model,
    outputDir,
  );
}

main();
