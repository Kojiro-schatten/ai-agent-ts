import { setupLogger } from '../custom-logger.js';
import { programmerNode } from './programmer-node.js';

const logger = setupLogger('test-08');

/**
 * programmerNodeの動作を確認するテスト。
 * サンプルデータに対してプログラマーノードを実行し、各試行の結果を表示する。
 * @returns なし
 */
async function main(): Promise<void> {
  const [, dataThreads] = await programmerNode(
    'chapter5/data/sample.csv',
    'スコアの分布を可視化して',
    '08_programmer',
  );

  logger.info(`試行回数: ${dataThreads.length}`);
  for (let idx = 0; idx < dataThreads.length; idx++) {
    const dataThread = dataThreads[idx]!;
    console.log('\n\n');
    console.log(`##### ${idx} #####`);
    console.log(dataThread.code);
    console.log('='.repeat(80));
    console.log(dataThread.stdout);
    console.log(dataThread.stderr);
    console.log('-'.repeat(80));
    console.log(dataThread.observation);
    console.log(`isCompleted: ${dataThread.isCompleted}`);
  }
}

main();
