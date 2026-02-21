import { Sandbox } from '@e2b/code-interpreter';
import {
  Command,
  END,
  StateGraph,
  type CompiledStateGraph,
} from '@langchain/langgraph';

import { setupLogger } from '../custom-logger.js';
import { executeCodeNode } from './nodes/execute-code-node.js';
import { generateCodeNode } from './nodes/generate-code-node.js';
import { generateReviewNode } from './nodes/generate-review-node.js';
import { setDataframeNode } from './nodes/set-dataframe-node.js';
import { ProgrammerStateAnnotation, type ProgrammerState } from './state.js';

const logger = setupLogger('programmer');

/**
 * プログラマーグラフの終了ノード。使用済みのサンドボックスを破棄し、グラフを終了する。
 * @param state - プログラマーグラフの現在の状態
 * @returns 終了遷移を含むCommandオブジェクト
 */
function closeProgrammerNode(state: ProgrammerState) {
  Sandbox.kill(state.sandboxId);
  return new Command({
    goto: END,
    update: {
      nextNode: END,
    },
  });
}

/**
 * プログラマーサブグラフを構築してコンパイルする。データフレーム設定、コード生成、コード実行、レビュー生成、終了ノードを接続する。
 * @param closeProgrammerFn - プログラマー終了時に実行するカスタム関数（省略時はデフォルトの終了ノードを使用）
 * @returns コンパイル済みのプログラマーサブグラフ
 */
export function buildProgrammerGraph(
  closeProgrammerFn?: (state: ProgrammerState) => Command,
): CompiledStateGraph<any, any, any, any> {
  const graph = new StateGraph(ProgrammerStateAnnotation)
    .addNode('set_dataframe', setDataframeNode, {
      ends: ['generate_code'],
    })
    .addNode('generate_code', generateCodeNode, {
      ends: ['execute_code'],
    })
    .addNode('execute_code', executeCodeNode, {
      ends: ['generate_review'],
    })
    .addNode('generate_review', generateReviewNode, {
      ends: ['close_programmer', 'generate_code'],
    })
    .addNode(
      'close_programmer',
      closeProgrammerFn ?? closeProgrammerNode,
      { ends: [END] },
    )
    .addEdge('__start__', 'set_dataframe');
  return graph.compile();
}

/**
 * プログラマーワークフローを実行し、各ノードのストリーム結果をコンソールに表示する。
 * @param workflow - コンパイル済みのプログラマーサブグラフ
 * @param userRequest - ユーザーからの分析リクエスト
 * @param dataFile - 分析対象のデータファイルパス
 * @param recursionLimit - グラフの再帰実行上限（デフォルト: 15）
 * @returns Promise<void>
 */
export async function runProgrammerWorkflow(
  workflow: CompiledStateGraph<any, any, any, any>,
  userRequest: string,
  dataFile: string,
  recursionLimit: number = 15,
): Promise<void> {
  const sandbox = await Sandbox.create({ timeoutMs: 1200_000 });
  const sandboxId = sandbox.sandboxId;

  const stream = await workflow.stream(
    {
      userRequest,
      dataFile,
      dataThreads: [],
      sandboxId,
    },
    { recursionLimit },
  );

  for await (const state of stream) {
    for (const [nodeName, nodeState] of Object.entries(state)) {
      switch (nodeName) {
        case 'set_dataframe': {
          console.log(nodeState.dataInfo);
          break;
        }
        case 'generate_code': {
          const dataThreads = nodeState.dataThreads;
          const dataThread = dataThreads?.[dataThreads.length - 1];
          console.log(dataThread?.code);
          break;
        }
        case 'execute_code': {
          const dataThreads = nodeState.dataThreads;
          const dataThread = dataThreads?.[dataThreads.length - 1];
          if (dataThread?.stdout) {
            logger.info(dataThread.stdout);
          }
          if (dataThread?.stderr) {
            logger.warn(dataThread.stderr);
          }
          if (dataThread?.results?.length > 0) {
            console.log(dataThread.results);
          }
          break;
        }
        case 'generate_review': {
          const dataThreads = nodeState.dataThreads;
          const dataThread = dataThreads?.[dataThreads.length - 1];
          if (dataThread?.isCompleted) {
            logger.success(`observation: ${dataThread.observation}`);
          } else {
            logger.warn(`observation: ${dataThread?.observation}`);
          }
          break;
        }
      }
    }
  }
}

/**
 * コマンドライン引数を解析し、プログラマーワークフローを実行するエントリーポイント。
 * @returns Promise<void>
 */
async function main(): Promise<void> {
  const dataFile = process.argv[2] ?? 'data/sample.csv';
  const userRequest =
    process.argv[3] ?? 'scoreと曜日の関係について分析してください';
  const recursionLimit = Number(process.argv[4] ?? '15');

  const workflow = buildProgrammerGraph();
  await runProgrammerWorkflow(workflow, userRequest, dataFile, recursionLimit);
}

main();
