import { Command } from '@langchain/langgraph';

import { setupLogger } from '../../custom-logger.js';
import type { GraphDataThread, Review } from '../../models.js';
import { generateReview } from '../../modules/generate-review.js';
import type { ProgrammerState } from '../state.js';

const logger = setupLogger('generate-review-node');

/**
 * レビュー生成ノード。コードの実行結果をLLMで評価し、完了していればプログラマー終了ノードへ、未完了ならコード再生成ノードへ遷移する。
 * @param state - プログラマーグラフの現在の状態
 * @returns レビュー結果を反映したデータスレッドと次のノード遷移先を含むCommandオブジェクト
 */
export async function generateReviewNode(state: ProgrammerState) {
  logger.info('|--> generate_review');
  const threads = [...(state.dataThreads ?? [])];
  const thread = threads[threads.length - 1]!;
  const response = await generateReview(
    state.dataInfo,
    thread.userRequest ?? '',
    {
      processId: 'process_id',
      threadId: threads.length,
      userRequest: thread.userRequest,
      code: thread.code,
      error: thread.error,
      stderr: thread.stderr,
      stdout: thread.stdout,
      isCompleted: thread.isCompleted,
      observation: thread.observation,
      results: thread.results,
      pathes: thread.pathes,
    },
  );
  if (response.content === null) {
    throw new Error('Failed to parse review output');
  }
  const review: Review = response.content;
  const updatedThread: GraphDataThread = {
    ...thread,
    observation: review.observation,
    isCompleted: review.is_completed,
  };
  threads[threads.length - 1] = updatedThread;
  if (review.is_completed) {
    return new Command({
      goto: 'close_programmer',
      update: {
        dataThreads: threads,
        nextNode: 'close_programmer',
      },
    });
  }
  return new Command({
    goto: 'generate_code',
    update: {
      dataThreads: threads,
      nextNode: 'generate_code',
    },
  });
}
