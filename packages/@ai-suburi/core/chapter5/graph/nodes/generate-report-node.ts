import { Command, END } from '@langchain/langgraph';

import { setupLogger } from '../../custom-logger.js';
import { generateReport } from '../../modules/generate-report.js';
import type { DataAnalysisState } from '../state.js';

const logger = setupLogger('generate-report-node');

/**
 * レポート生成ノード。全サブタスクの実行結果をLLMで統合し、データ分析のレポートを生成する。
 * @param state - データ分析グラフの現在の状態
 * @returns 生成されたレポートと次のノード遷移先（終了）を含むCommandオブジェクト
 */
export async function generateReportNode(state: DataAnalysisState) {
  logger.info('|--> generate_report');
  const llmResponse = await generateReport(
    state.dataInfo,
    state.userRequest,
    (state.subTaskThreads ?? []).map((t) => ({
      processId: 'process_id',
      threadId: 0,
      userRequest: t.userRequest,
      code: t.code,
      error: t.error,
      stderr: t.stderr,
      stdout: t.stdout,
      isCompleted: t.isCompleted,
      observation: t.observation,
      results: t.results,
      pathes: t.pathes,
    })),
    'gpt-4o-mini-2024-07-18',
    'outputs/graph',
  );
  return new Command({
    goto: END,
    update: {
      report: llmResponse.content,
      nextNode: END,
    },
  });
}
