import { Sandbox } from '@e2b/code-interpreter';
import {
  Command,
  END,
  MemorySaver,
  StateGraph,
  type CompiledStateGraph,
} from '@langchain/langgraph';
import * as readline from 'node:readline';

import { setupLogger } from '../custom-logger.js';
import type { GraphDataThread } from '../models.js';
import { approvePlan } from './nodes/approve-plan-node.js';
import { generatePlanNode } from './nodes/generate-plan-node.js';
import { generateReportNode } from './nodes/generate-report-node.js';
import { buildProgrammerGraph } from './programmer.js';
import {
  DataAnalysisStateAnnotation,
  type DataAnalysisState,
  type ProgrammerState,
} from './state.js';

const logger = setupLogger('data-analysis');

/**
 * 未完了のサブタスクを選択し、プログラマーサブグラフを起動する。全タスクが完了済みの場合はレポート生成ノードへ遷移する。
 * @param state - データ分析グラフの現在の状態
 * @returns サブタスク実行またはレポート生成への遷移を含むCommandオブジェクト
 */
function openProgrammer(state: DataAnalysisState) {
  logger.info('|--> open_programmer');
  const subTasks = state.subTasks ?? [];
  let targetTask = null;
  for (const subTask of subTasks) {
    if (subTask.state === false) {
      targetTask = subTask.task;
      break;
    }
  }
  // 全てのタスクが完了していたら
  if (targetTask === null) {
    return new Command({
      goto: 'generate_report',
      update: {
        nextNode: 'generate_report',
      },
    });
  }
  // 未完了タスクがある場合は、そのタスクを実行
  const userRequest = targetTask.purpose;
  return new Command({
    goto: 'programmer',
    update: {
      userApproval: true,
      nextNode: 'programmer',
      userRequest,
    },
  });
}

/**
 * プログラマーサブグラフ終了後、サンドボックスを破棄し実行結果を親グラフに返す。サブタスクスレッドに結果を蓄積する。
 * @param state - プログラマーグラフの現在の状態
 * @returns 親グラフのopen_programmerノードへの遷移と結果を含むCommandオブジェクト
 */
function closeProgrammer(state: ProgrammerState) {
  logger.info('|--> _close_programmer');
  if (state.sandboxId) {
    Sandbox.kill(state.sandboxId);
  }
  const subTaskThreads = [...(state.subTaskThreads ?? [])];
  const dataThreads = state.dataThreads ?? [];
  if (dataThreads.length > 0) {
    subTaskThreads.push(dataThreads[dataThreads.length - 1]!);
  }
  return new Command({
    graph: Command.PARENT,
    goto: 'open_programmer',
    update: {
      nextNode: 'open_programmer',
      subTaskThreads,
      dataThreads: [],
      subTasks: (state.subTasks ?? []).slice(1),
    },
  });
}

/**
 * データ分析グラフ全体を構築してコンパイルする。計画生成、承認、プログラマー実行、レポート生成の各ノードを接続する。
 * @returns コンパイル済みのデータ分析グラフ
 */
export function buildDataAnalysisGraph(): CompiledStateGraph<
  any,
  any,
  any,
  any
> {
  const checkpointer = new MemorySaver();
  const graph = new StateGraph(DataAnalysisStateAnnotation)
    .addNode('generate_plan', generatePlanNode, {
      ends: ['approve_plan'],
    })
    .addNode('approve_plan', approvePlan, {
      ends: ['open_programmer', 'generate_plan'],
    })
    .addNode('programmer', buildProgrammerGraph(closeProgrammer), {
      ends: ['open_programmer'],
    })
    .addNode('open_programmer', openProgrammer, {
      ends: ['programmer', 'generate_report'],
    })
    .addNode('generate_report', generateReportNode, {
      ends: [END],
    })
    .addEdge('__start__', 'generate_plan');
  return graph.compile({ checkpointer });
}

/**
 * ワークフローを実行し、承認待ちの場合はユーザー入力を受け付けて再帰的に処理を続行する。
 * @param workflow - コンパイル済みのデータ分析グラフ
 * @param inputData - ワークフローへの入力データまたは再開用のCommandオブジェクト
 * @param config - ワークフロー実行設定（スレッドID、再帰制限など）
 * @returns ワークフローの実行結果
 */
export async function invokeWorkflow(
  workflow: CompiledStateGraph<any, any, any, any>,
  inputData: Record<string, unknown> | Command,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await workflow.invoke(inputData, config);
  if (result.nextNode === 'approve_plan') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const userInput = await new Promise<string>((resolve) => {
      rl.question('User Feedback: Approval? (y/n): ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
    return invokeWorkflow(
      workflow,
      new Command({ resume: userInput }),
      config,
    );
  }
  return result;
}

/**
 * コマンドライン引数を解析し、データ分析ワークフローを実行するエントリーポイント。
 * @returns Promise<void>
 */
async function main(): Promise<void> {
  const dataFile = process.argv[2] ?? 'data/sample.csv';
  const userGoal =
    process.argv[3] ?? 'scoreと曜日の関係について分析してください';
  const recursionLimit = Number(process.argv[4] ?? '30');

  const workflow = buildDataAnalysisGraph();
  const result = await invokeWorkflow(
    workflow,
    {
      userGoal,
      dataFile,
    },
    {
      configurable: { thread_id: 'some_id' },
      recursionLimit,
    },
  );

  console.log(result.report);
}

main();
