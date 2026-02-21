import { Sandbox } from '@e2b/code-interpreter';
import { Command } from '@langchain/langgraph';

import { setupLogger } from '../../custom-logger.js';
import { describeDataframe } from '../../modules/describe-dataframe.js';
import { setDataframe } from '../../modules/set-dataframe.js';
import type { ProgrammerState } from '../state.js';

const logger = setupLogger('set-dataframe-node');

/**
 * データフレーム設定ノード。サンドボックスを作成し、指定されたデータファイルを読み込んでデータフレームの情報を取得する。
 * @param state - プログラマーグラフの現在の状態
 * @returns データ情報と次のノード遷移先を含むCommandオブジェクト
 */
export async function setDataframeNode(state: ProgrammerState) {
  logger.info('|--> set_dataframe');
  const sandbox = await Sandbox.connect(state.sandboxId);
  await setDataframe(sandbox, state.dataFile);
  const dataInfo = await describeDataframe(sandbox, state.dataFile);
  return new Command({
    goto: 'generate_code',
    update: {
      dataInfo,
      nextNode: 'generate_code',
    },
  });
}
