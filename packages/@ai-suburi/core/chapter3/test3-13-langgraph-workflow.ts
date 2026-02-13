import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0.7 });

// ワークフロー全体の状態を記録するためのAnnotation
// 基本的に各ノードにこの型の状態が引数に渡される
const AgentState = Annotation.Root({
  input: Annotation<string>(),
  plans: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  feedbacks: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  output: Annotation<string>(),
  iteration: Annotation<number>(),
});

type AgentStateType = typeof AgentState.State;

/**
 * 計画ノード: ユーザーの入力に基づいてブログ記事の作成計画を生成する
 * @param state - ワークフローの現在の状態
 * @returns plans フィールドを含む部分的な状態更新
 */
function planNode(state: AgentStateType) {
  // 現在の入力に基づいて計画を作成
  return {
    plans: [
      `ブログ記事「${state.input}」の作成計画:`,
      '1. イントロダクション',
      '2. 基本概念',
      '3. シンプルなワークフロー例',
      '4. まとめ',
    ],
  };
}

/**
 * 生成ノード: LLM を使って計画とフィードバックに基づきブログ記事のセクションを生成する
 * @param state - ワークフローの現在の状態
 * @returns output と iteration フィールドを含む部分的な状態更新
 */
async function generationNode(state: AgentStateType) {
  const iteration = state.iteration + 1;

  const feedbackContext =
    state.feedbacks.length > 0
      ? `\n\n過去のフィードバック:\n${state.feedbacks.join('\n')}`
      : '';

  const previousOutput = state.output ? `\n\n前回の出力:\n${state.output}` : '';

  const response = await llm.invoke([
    {
      role: 'system',
      content:
        'あなたはブログ記事のライターです。計画に基づいてブログ記事のセクションを執筆してください。マークダウン形式で出力してください。',
    },
    {
      role: 'user',
      content: `以下の計画に基づいて、イテレーション ${iteration} のブログ記事セクションを書いてください。

計画:
${state.plans.join('\n')}${previousOutput}${feedbackContext}

フィードバックがある場合はそれを反映して改善してください。`,
    },
  ]);

  const output = `イテレーション ${iteration} の出力:\n${response.content}`;
  return { output, iteration };
}

/**
 * 振り返りノード: LLM を使って生成された出力を評価し、改善のためのフィードバックを生成する
 * @param state - ワークフローの現在の状態
 * @returns feedbacks フィールドを含む部分的な状態更新
 */
async function reflectionNode(state: AgentStateType) {
  const response = await llm.invoke([
    {
      role: 'system',
      content:
        'あなたはブログ記事の編集者です。与えられたブログ記事のセクションを批評し、具体的な改善点をフィードバックしてください。良い点も指摘してください。',
    },
    {
      role: 'user',
      content: `以下のブログ記事セクション（イテレーション ${state.iteration}）を評価してフィードバックしてください。

${state.output}`,
    },
  ]);

  const feedback = `フィードバック (イテレーション ${state.iteration}):\n${response.content}`;
  return { feedbacks: [feedback] };
}

/**
 * 条件付きエッジの判定関数: イテレーション回数に応じてワークフローの継続・終了を決定する
 * @param state - ワークフローの現在の状態
 * @returns 3回を超えた場合は END、それ以外は 'reflector' を返す
 */
function shouldContinue(state: AgentStateType): typeof END | 'reflector' {
  if (state.iteration > 3) {
    return END;
  }
  return 'reflector';
}

// Graph全体を定義
const workflow = new StateGraph(AgentState)
  // 使用するノードを追加。ノード名と対応する関数を書く
  .addNode('planner', planNode)
  .addNode('generator', generationNode)
  .addNode('reflector', reflectionNode)
  // エントリーポイントを定義。これが最初に呼ばれるノード
  .addEdge(START, 'planner')
  // ノードをつなぐエッジを追加
  .addEdge('planner', 'generator')
  .addConditionalEdges('generator', shouldContinue, ['reflector', END])
  .addEdge('reflector', 'generator');

// 最後にworkflowをコンパイルする。これでinvokeやstreamが使用できるようになる
const app = workflow.compile();

/**
 * エージェントワークフローを実行し、各ステップの出力とMermaidグラフを表示する
 */
async function main() {
  const inputs = {
    input:
      'LangGraphを用いたエージェントワークフロー構築方法のブログ記事を作成して',
    iteration: 0,
    plans: [],
    feedbacks: [],
    output: '',
  };

  for await (const s of await app.stream(inputs)) {
    console.log(Object.values(s)[0]);
    console.log('----');
  }

  // mermaidのグラフ定義を表示
  const mermaidGraph = (await app.getGraphAsync()).drawMermaid();
  console.log(mermaidGraph);
}

main();
