import { Sandbox } from '@e2b/code-interpreter';
import { Command } from '@langchain/langgraph';

import { setupLogger } from '../../custom-logger.js';
import type { GraphDataThread } from '../../models.js';
import { executeCode } from '../../modules/execute-code.js';
import type { ProgrammerState } from '../state.js';

const logger = setupLogger('execute-code-node');

/**
 * コード実行ノード。サンドボックス環境でデータスレッドのコードを実行し、実行結果を状態に反映する。
 * @param state - プログラマーグラフの現在の状態
 * @returns 実行結果を含むデータスレッドと次のノード遷移先を含むCommandオブジェクト
 */
export async function executeCodeNode(state: ProgrammerState) {
  logger.info('|--> execute_code');
  const threads = [...(state.dataThreads ?? [])];
  const threadId = threads.length;
  const thread = threads[threads.length - 1]!;
  const sandbox = await Sandbox.connect(state.sandboxId);
  const originalDataThread = await executeCode(
    sandbox,
    'process_id',
    threadId,
    thread.code ?? '',
    thread.userRequest,
  );
  const updatedThread: GraphDataThread = {
    userRequest: thread.userRequest,
    code: thread.code,
    error: originalDataThread.error,
    stderr: originalDataThread.stderr,
    stdout: originalDataThread.stdout,
    isCompleted: false,
    observation: null,
    results: originalDataThread.results,
    pathes: {},
  };
  threads[threads.length - 1] = updatedThread;
  return new Command({
    goto: 'generate_review',
    update: {
      dataThreads: threads,
      nextNode: 'generate_review',
    },
  });
}
