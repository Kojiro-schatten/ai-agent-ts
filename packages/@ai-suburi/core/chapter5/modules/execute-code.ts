import type { Sandbox } from '@e2b/code-interpreter';

import { setupLogger } from '../custom-logger.js';
import type { DataThread } from '../models.js';

const logger = setupLogger('execute-code');

/**
 * E2Bサンドボックス上でPythonコードを実行し、stdout・stderr・実行結果を収集してDataThreadとして返す。
 * @param sandbox - E2Bサンドボックスインスタンス
 * @param processId - 処理を識別するプロセスID
 * @param threadId - スレッドの連番ID
 * @param code - 実行するPythonコード
 * @param userRequest - ユーザーからのタスク要求（デフォルト: null）
 * @param timeout - コード実行のタイムアウト秒数（デフォルト: 1200）
 * @returns 実行結果を格納したDataThreadオブジェクト
 */
export async function executeCode(
  sandbox: Sandbox,
  processId: string,
  threadId: number,
  code: string,
  userRequest: string | null = null,
  timeout: number = 1200,
): Promise<DataThread> {
  const execution = await sandbox.runCode(code, {
    timeoutMs: timeout * 1000,
  });
  logger.debug(`execution=${JSON.stringify(execution.toJSON())}`);

  const results = execution.results.map((r) =>
    r.png
      ? { type: 'png', content: r.png }
      : { type: 'raw', content: r.text ?? '' },
  );

  return {
    processId,
    threadId,
    userRequest,
    code,
    error: execution.error?.traceback ?? null,
    stderr: execution.logs.stderr.join('').trim(),
    stdout: execution.logs.stdout.join('').trim(),
    isCompleted: false,
    observation: null,
    results,
    pathes: {},
  };
}
