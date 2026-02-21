import { Command } from '@langchain/langgraph';
import { interrupt } from '@langchain/langgraph';

import { setupLogger } from '../../custom-logger.js';
import type { DataAnalysisState } from '../state.js';

const logger = setupLogger('approve-plan-node');

/**
 * 計画承認ノード。ユーザーの承認を待ち、承認された場合はプログラマーノードへ、拒否された場合は計画再生成ノードへ遷移する。
 * @param state - データ分析グラフの現在の状態
 * @returns ユーザーの承認結果に基づく次のノード遷移先を含むCommandオブジェクト
 */
export async function approvePlan(state: DataAnalysisState) {
  logger.info('|--> approve_plan');
  const isApproval = interrupt({
    subTasks: state.subTasks,
  });
  if (
    typeof isApproval === 'string' &&
    isApproval.toLowerCase() === 'y'
  ) {
    return new Command({
      goto: 'open_programmer',
      update: {
        userApproval: true,
        nextNode: 'open_programmer',
      },
    });
  }
  return new Command({
    goto: 'generate_plan',
    update: {
      userApproval: false,
      nextNode: 'generate_plan',
    },
  });
}
