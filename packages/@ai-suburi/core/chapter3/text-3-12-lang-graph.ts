import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

// ワークフロー前後の状態を記録するためのスキーマ
// この状態が各ノードに引数として渡される
const AgentState = Annotation.Root({
  input: Annotation<string>, // ユーザーの入力
  plans: Annotation<string[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }), // 計画ノードの結果
  feedbacks: Annotation<string[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }), // 振り返りノードの結果
  output: Annotation<string>, // 生成ノードの結果
  iteration: Annotation<number>,
});

// AgentStateの型を取得
type AgentStateType = typeof AgentState.State;

// LangGraphでエージェントワークフローの構築
// 各ノードの処理（ここでは省略）
function planNode(
  state: AgentStateType,
): Partial<AgentStateType> {
  // TODO: LLMを使って計画を立てる処理を実装
  console.log(`[planner] input: ${state.input}, iteration: ${state.iteration}`);
  return { plans: [`Plan for iteration ${state.iteration}`] };
}

function generationNode(
  state: AgentStateType,
): Partial<AgentStateType> {
  // TODO: LLMを使って文章を生成する処理を実装
  console.log(`[generator] iteration: ${state.iteration}`);
  return {
    output: `Generated output for iteration ${state.iteration}`,
    iteration: state.iteration + 1,
  };
}

function reflectionNode(
  state: AgentStateType,
): Partial<AgentStateType> {
  // TODO: LLMを使って振り返りを行う処理を実装
  console.log(`[reflector] iteration: ${state.iteration}`);
  return { feedbacks: [`Feedback for iteration ${state.iteration}`] };
}

// 条件付きエッジ用の条件。3回イテレーション
function shouldContinue(state: AgentStateType): string {
  if (state.iteration > 3) {
    // End after 3 iterations
    return END;
  }
  return 'reflector';
}

// Graph全体を定義
const workflow = new StateGraph(AgentState)
  // 使用するノードを追加。ノード名と対応する関数を書く。
  // 名前はこの後も使うので一意である必要がある
  .addNode('planner', planNode)
  .addNode('generator', generationNode)
  .addNode('reflector', reflectionNode)
  // エントリーポイントを定義。これが最初に呼ばれるノード
  .addEdge(START, 'planner')
  // ノードをつなぐエッジを追加
  .addEdge('planner', 'generator')
  .addConditionalEdges('generator', shouldContinue, ['reflector', END])
  .addEdge('reflector', 'planner');

// 最後にworkflowをコンパイルする。これでLangChainのrunnableな形式になる
// runnableになることでinvoke, streamが使用できるようになる
const app = workflow.compile();

// invokeで実行する。stateの初期値を渡す
const result = await app.invoke({
  input: 'LangGraphを使ったエージェントワークフロー構築方法のブログ記事を作成して',
  iteration: 0,
});

console.log('Result:', result);

// npx tsx packages/@ai-suburi/core/chapter3/text-3-12-lang-graph.ts 2>&1
// 実際に使う時は planNode / generationNode / reflectionNode の中で LLM
// を呼ぶ処理を書けば、ちゃんとしたエージェントワークフローになる
