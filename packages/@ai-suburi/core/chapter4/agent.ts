import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { Annotation, END, START, StateGraph, Send } from '@langchain/langgraph';
import type { Settings } from './configs.js';
import { setupLogger } from './logger.js';
import {
  PlanSchema,
  ReflectionResultSchema,
} from './models.js';
import type {
  AgentResult,
  AgentTool,
  ReflectionResult,
  Subtask,
  ToolResult,
} from './models.js';
import { HelpDeskAgentPrompts } from './prompts.js';

const MAX_CHALLENGE_COUNT = 3;

const logger = setupLogger('agent');

// --- メイングラフの状態定義 ---

const AgentStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  plan: Annotation<string[]>,
  current_step: Annotation<number>,
  subtask_results: Annotation<Subtask[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  last_answer: Annotation<string>,
});

type AgentStateType = typeof AgentStateAnnotation.State;

// --- サブグラフの状態定義 ---

const AgentSubGraphStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  plan: Annotation<string[]>,
  subtask: Annotation<string>,
  is_completed: Annotation<boolean>,
  messages: Annotation<OpenAI.ChatCompletionMessageParam[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  challenge_count: Annotation<number>,
  tool_results: Annotation<ToolResult[][]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  reflection_results: Annotation<ReflectionResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  subtask_answer: Annotation<string>,
});

type AgentSubGraphStateType = typeof AgentSubGraphStateAnnotation.State;

// --- ヘルプデスクエージェントクラス ---

export class HelpDeskAgent {
  private settings: Settings;
  private tools: AgentTool[];
  private toolMap: Map<string, AgentTool>;
  private prompts: HelpDeskAgentPrompts;
  private client: OpenAI;

  constructor(
    settings: Settings,
    tools: AgentTool[] = [],
    prompts: HelpDeskAgentPrompts = new HelpDeskAgentPrompts(),
  ) {
    this.settings = settings;
    this.tools = tools;
    this.toolMap = new Map(tools.map((t) => [t.name, t]));
    this.prompts = prompts;
    this.client = new OpenAI({ apiKey: this.settings.openaiApiKey });
  }

  /**
   * 計画を作成する
   */
  async createPlan(state: AgentStateType): Promise<Partial<AgentStateType>> {
    logger.info('🚀 Starting plan generation process...');

    const systemPrompt = this.prompts.plannerSystemPrompt;
    const userPrompt = this.prompts.formatPlannerUserPrompt({
      question: state.question,
    });

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    logger.debug(`Final prompt messages: ${JSON.stringify(messages)}`);

    try {
      logger.info('Sending request to OpenAI...');
      const response = await this.client.chat.completions.parse({
        model: this.settings.openaiModel,
        messages,
        response_format: zodResponseFormat(PlanSchema, 'Plan'),
      });
      logger.info('✅ Successfully received response from OpenAI.');

      const plan = response.choices[0]?.message.parsed;
      if (!plan) {
        throw new Error('Plan parsing returned null');
      }

      logger.info('Plan generation complete!');
      return { plan: plan.subtasks };
    } catch (e) {
      logger.error(`Error during OpenAI request: ${e}`);
      throw e;
    }
  }

  /**
   * ツールを選択する
   */
  async selectTools(state: AgentSubGraphStateType): Promise<Partial<AgentSubGraphStateType>> {
    logger.info('🚀 Starting tool selection process...');

    const openaiTools = this.tools.map((t) => t.definition);

    let messages: OpenAI.ChatCompletionMessageParam[];

    if (state.challenge_count === 0) {
      logger.debug('Creating user prompt for tool selection...');
      const userPrompt = this.prompts.formatSubtaskToolSelectionUserPrompt({
        question: state.question,
        plan: JSON.stringify(state.plan),
        subtask: state.subtask,
      });

      messages = [
        { role: 'system', content: this.prompts.subtaskSystemPrompt },
        { role: 'user', content: userPrompt },
      ];
    } else {
      logger.debug('Creating user prompt for tool retry...');

      // リトライされた場合は過去の対話情報にプロンプトを追加する
      // NOTE: トークン数節約のため過去の検索結果は除く
      // roleがtoolまたはtool_callsを持つものは除く
      messages = state.messages.filter(
        (m) => m.role !== 'tool' || !('tool_calls' in m),
      );

      const userRetryPrompt = this.prompts.subtaskRetryAnswerUserPrompt;
      messages.push({ role: 'user', content: userRetryPrompt });
    }

    try {
      logger.info('Sending request to OpenAI...');
      const response = await this.client.chat.completions.create({
        model: this.settings.openaiModel,
        messages,
        tools: openaiTools,
      });
      logger.info('✅ Successfully received response from OpenAI.');
      logger.info(JSON.stringify(response, null, 2));
      
      const toolCalls = response.choices[0]?.message.tool_calls;
      if (!toolCalls) {
        throw new Error('Tool calls are None');
      }

      // function型のtool callのみを取得
      const functionToolCalls = toolCalls.filter(
        (tc): tc is OpenAI.ChatCompletionMessageFunctionToolCall => tc.type === 'function',
      );

      const aiMessage: OpenAI.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        tool_calls: functionToolCalls,
      };

      logger.info('Tool selection complete!');
      messages.push(aiMessage);

      return { messages };
    } catch (e) {
      logger.error(`Error during OpenAI request: ${e}`);
      throw e;
    }
  }

  /**
   * ツールを実行する
   */
  async executeTools(state: AgentSubGraphStateType): Promise<Partial<AgentSubGraphStateType>> {
    logger.info('🚀 Starting tool execution process...');
    const messages = [...state.messages];

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant' || !('tool_calls' in lastMessage)) {
      logger.error(`Messages: ${JSON.stringify(messages)}`);
      throw new Error('Tool calls are None');
    }

    const allToolCalls = (lastMessage as OpenAI.ChatCompletionAssistantMessageParam).tool_calls;
    if (!allToolCalls) {
      throw new Error('Tool calls are None');
    }

    // function型のtool callのみを処理
    const toolCalls = allToolCalls.filter(
      (tc): tc is OpenAI.ChatCompletionMessageFunctionToolCall => tc.type === 'function',
    );

    const toolResults: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolArgsStr = toolCall.function.arguments;
      const toolArgs = JSON.parse(toolArgsStr) as Record<string, unknown>;

      const tool = this.toolMap.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      const result = await tool.invoke(toolArgs);

      toolResults.push({
        tool_name: toolName,
        args: toolArgsStr,
        results: result,
      });

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }

    logger.info('Tool execution complete!');
    return { messages, tool_results: [toolResults] };
  }

  /**
   * サブタスク回答を作成する
   */
  async createSubtaskAnswer(state: AgentSubGraphStateType): Promise<Partial<AgentSubGraphStateType>> {
    logger.info('🚀 Starting subtask answer creation process...');
    const messages = [...state.messages];

    try {
      logger.info('Sending request to OpenAI...');
      const response = await this.client.chat.completions.create({
        model: this.settings.openaiModel,
        messages,
      });
      logger.info('✅ Successfully received response from OpenAI.');

      const subtaskAnswer = response.choices[0]?.message.content ?? '';

      messages.push({ role: 'assistant', content: subtaskAnswer });

      logger.info('Subtask answer creation complete!');
      return { messages, subtask_answer: subtaskAnswer };
    } catch (e) {
      logger.error(`Error during OpenAI request: ${e}`);
      throw e;
    }
  }

  /**
   * サブタスク回答を内省する
   */
  async reflectSubtask(state: AgentSubGraphStateType): Promise<Partial<AgentSubGraphStateType>> {
    logger.info('🚀 Starting reflection process...');
    const messages = [...state.messages];

    const userPrompt = this.prompts.subtaskReflectionUserPrompt;
    messages.push({ role: 'user', content: userPrompt });

    try {
      logger.info('Sending request to OpenAI...');
      const response = await this.client.chat.completions.parse({
        model: this.settings.openaiModel,
        messages,
        response_format: zodResponseFormat(ReflectionResultSchema, 'ReflectionResult'),
      });
      logger.info('✅ Successfully received response from OpenAI.');

      const reflectionResult = response.choices[0]?.message.parsed;
      if (!reflectionResult) {
        throw new Error('Reflection result is None');
      }

      messages.push({
        role: 'assistant',
        content: JSON.stringify(reflectionResult),
      });

      const newChallengeCount = state.challenge_count + 1;
      const updateState: Partial<AgentSubGraphStateType> = {
        messages,
        reflection_results: [reflectionResult],
        challenge_count: newChallengeCount,
        is_completed: reflectionResult.is_completed,
      };

      if (newChallengeCount >= MAX_CHALLENGE_COUNT && !reflectionResult.is_completed) {
        updateState.subtask_answer = `${state.subtask}の回答が見つかりませんでした。`;
      }

      logger.info('Reflection complete!');
      return updateState;
    } catch (e) {
      logger.error(`Error during OpenAI request: ${e}`);
      throw e;
    }
  }

  /**
   * 最終回答を作成する
   */
  async createAnswer(state: AgentStateType): Promise<Partial<AgentStateType>> {
    logger.info('🚀 Starting final answer creation process...');

    const systemPrompt = this.prompts.createLastAnswerSystemPrompt;

    const subtaskResults = state.subtask_results.map((result) => [
      result.task_name,
      result.subtask_answer,
    ]);
    const userPrompt = this.prompts.formatCreateLastAnswerUserPrompt({
      question: state.question,
      subtask_results: JSON.stringify(subtaskResults),
    });

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      logger.info('Sending request to OpenAI...');
      const response = await this.client.chat.completions.create({
        model: this.settings.openaiModel,
        messages,
      });
      logger.info('✅ Successfully received response from OpenAI.');

      logger.info('Final answer creation complete!');
      return { last_answer: response.choices[0]?.message.content ?? '' };
    } catch (e) {
      logger.error(`Error during OpenAI request: ${e}`);
      throw e;
    }
  }

  /**
   * サブグラフを実行する（メイングラフのノード）
   */
  private async executeSubgraph(state: AgentStateType): Promise<Partial<AgentStateType>> {
    const subgraph = this.createSubgraph();

    const result = await subgraph.invoke({
      question: state.question,
      plan: state.plan,
      subtask: state.plan[state.current_step]!,
      is_completed: false,
      challenge_count: 0,
      messages: [],
      subtask_answer: '',
    });

    const subtaskResult: Subtask = {
      task_name: result.subtask,
      tool_results: result.tool_results,
      reflection_results: result.reflection_results,
      is_completed: result.is_completed,
      subtask_answer: result.subtask_answer,
      challenge_count: result.challenge_count,
    };

    return { subtask_results: [subtaskResult] };
  }

  /**
   * サブタスク実行の継続判定（Send で並列実行）
   */
  private shouldContinueExecSubtasks(state: AgentStateType): Send[] {
    return state.plan.map(
      (_, idx) =>
        new Send('execute_subtasks', {
          question: state.question,
          plan: state.plan,
          current_step: idx,
        }),
    );
  }

  /**
   * サブタスクフローの継続判定
   */
  private shouldContinueExecSubtaskFlow(state: AgentSubGraphStateType): string {
    if (state.is_completed || state.challenge_count >= MAX_CHALLENGE_COUNT) {
      return 'end';
    }
    return 'continue';
  }

  /**
   * サブグラフを作成する
   */
  private createSubgraph() {
    const workflow = new StateGraph(AgentSubGraphStateAnnotation)
      .addNode('select_tools', async (state) => this.selectTools(state))
      .addNode('execute_tools', async (state) => this.executeTools(state))
      .addNode('create_subtask_answer', async (state) => this.createSubtaskAnswer(state))
      .addNode('reflect_subtask', async (state) => this.reflectSubtask(state))
      .addEdge(START, 'select_tools')
      .addEdge('select_tools', 'execute_tools')
      .addEdge('execute_tools', 'create_subtask_answer')
      .addEdge('create_subtask_answer', 'reflect_subtask')
      .addConditionalEdges(
        'reflect_subtask',
        (state) => this.shouldContinueExecSubtaskFlow(state),
        { continue: 'select_tools', end: END },
      );

    return workflow.compile();
  }

  /**
   * エージェントのメイングラフを作成する
   */
  createGraph() {
    const workflow = new StateGraph(AgentStateAnnotation)
      .addNode('create_plan', async (state) => this.createPlan(state))
      .addNode('execute_subtasks', async (state) => this.executeSubgraph(state))
      .addNode('create_answer', async (state) => this.createAnswer(state))
      .addEdge(START, 'create_plan')
      .addConditionalEdges('create_plan', (state) => this.shouldContinueExecSubtasks(state))
      .addEdge('execute_subtasks', 'create_answer')
      .addEdge('create_answer', END);

    return workflow.compile();
  }

  /**
   * エージェントを実行する
   */
  async runAgent(question: string): Promise<AgentResult> {
    /**
      これは LangGraphで作ったエージェントのメイングラフを初期状態で起動してる とこだよ！
      const app = this.createGraph();
      createGraph() で作られた LangGraphのステートマシン（ワークフロー） のコンパイル済みオブジェクト。中身はこの流れ👇
      START → create_plan → execute_subtasks(並列) → create_answer → END

      invoke() って何？
      そのワークフローを 最初から最後まで実行する メソッド。 引数は 初期ステート（状態） を渡してるの。

      1. 初期状態 { question: "パスワードの制限は？", plan: [], ... } でスタート
      2. create_plan ノードが動いて → plan に ["通知制限を調べる", "パスワード制限を調べる"] みたいなのが入る
      3. execute_subtasks が plan の各項目を 並列で 実行して → subtask_results に結果が溜まる
      4. create_answer が全サブタスクの結果をまとめて → last_answer に最終回答が入る
      5. result に最終状態が返ってくる！
     */
    const app = this.createGraph();

    const result = await app.invoke({
      question, // ユーザーの質問文（入力）
      current_step: 0, // 今何番目のサブタスクか（最初だから0）
      plan: [], // 計画（まだ空、create_planノードで埋まる）
      last_answer: '', // 最終回答（まだ空、create_answerノードで埋まる）
    });

    return {
      question,
      plan: { subtasks: result.plan },
      subtasks: result.subtask_results,
      answer: result.last_answer,
    };
  }
}
