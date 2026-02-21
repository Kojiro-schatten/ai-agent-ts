import { Sandbox } from '@e2b/code-interpreter';
import { Command } from '@langchain/langgraph';

import { setupLogger } from '../../custom-logger.js';
import type { Plan, SubTask } from '../../models.js';
import { describeDataframe } from '../../modules/describe-dataframe.js';
import { generatePlan } from '../../modules/generate-plan.js';
import type { DataAnalysisState } from '../state.js';

const logger = setupLogger('generate-plan-node');

/**
 * 計画生成ノード。サンドボックスでデータを分析し、LLMを使用してユーザーの目標に基づく分析計画とサブタスクを作成する。
 * @param state - データ分析グラフの現在の状態
 * @returns データ情報とサブタスクリスト、次のノード遷移先を含むCommandオブジェクト
 */
export async function generatePlanNode(state: DataAnalysisState) {
  logger.info('|--> generate_plan');
  const sandbox = await Sandbox.create({ timeoutMs: 1200_000 });
  const dataInfo = await describeDataframe(sandbox, state.dataFile);
  await Sandbox.kill(sandbox.sandboxId);

  const llmResponse = await generatePlan(dataInfo, state.userGoal);
  if (llmResponse.content === null) {
    throw new Error('Failed to parse plan output');
  }
  const plan: Plan = llmResponse.content;
  const subTasks: SubTask[] = plan.tasks.map((task) => ({
    state: false,
    task,
  }));
  return new Command({
    goto: 'approve_plan',
    update: {
      dataInfo,
      subTasks,
      nextNode: 'approve_plan',
    },
  });
}
