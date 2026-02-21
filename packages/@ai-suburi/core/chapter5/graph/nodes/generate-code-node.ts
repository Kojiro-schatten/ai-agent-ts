import { Command } from '@langchain/langgraph';

import { setupLogger } from '../../custom-logger.js';
import type { GraphDataThread, Program } from '../../models.js';
import { generateCode } from '../../modules/generate-code.js';
import type { ProgrammerState } from '../state.js';

const logger = setupLogger('generate-code-node');

/**
 * コード生成ノード。LLMを使用してデータ情報とユーザーリクエストに基づくPythonコードを生成し、データスレッドに追加する。
 * @param state - プログラマーグラフの現在の状態
 * @returns 生成されたコードを含むデータスレッドと次のノード遷移先を含むCommandオブジェクト
 */
export async function generateCodeNode(state: ProgrammerState) {
  logger.info('|--> generate_code');
  const threads = [...(state.dataThreads ?? [])];
  let request = state.userRequest;
  if (threads.length > 0) {
    const lastThread = threads[threads.length - 1]!;
    request += '\n' + (lastThread.observation ?? '');
  }
  const response = await generateCode(
    state.dataInfo,
    request,
  );
  if (response.content === null) {
    throw new Error('Failed to parse code generation output');
  }
  const program: Program = response.content;
  const thread: GraphDataThread = {
    userRequest: request,
    code: program.code,
    error: null,
    stderr: null,
    stdout: null,
    isCompleted: false,
    observation: null,
    results: [],
    pathes: {},
  };
  threads.push(thread);
  return new Command({
    goto: 'execute_code',
    update: {
      dataThreads: threads,
      nextNode: 'execute_code',
    },
  });
}
