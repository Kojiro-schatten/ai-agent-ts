import * as cdk from 'aws-cdk-lib';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Construct } from 'constructs';

// ESM 環境での __dirname 相当
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AgentCore Runtime + Endpoint をデプロイする CDK スタック
 *
 * このスタックは以下のリソースを作成する:
 * 1. AgentCore Runtime — エージェントアプリのコンテナを実行する環境
 * 2. RuntimeEndpoint — Runtime を外部から呼び出すためのエンドポイント
 */
export class AgentCoreRuntimeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- 1. ローカル Dockerfile からアーティファクト作成 ---
    // agent/ ディレクトリの Dockerfile を使って Docker イメージをビルドする
    const artifact = agentcore.AgentRuntimeArtifact.fromAsset(
      path.join(__dirname, '../agent'),
    );

    // --- 2. Runtime 作成 ---
    // AgentCore Runtime はコンテナを ARM64 環境で実行し、
    // /ping と /invocations エンドポイントを公開する
    const runtime = new agentcore.Runtime(this, 'AgentRuntime', {
      agentRuntimeArtifact: artifact,
      environmentVariables: {
        MODEL_ID: 'anthropic.claude-sonnet-4-20250514',
      },
    });

    // --- 3. Bedrock モデルへのアクセス権限を付与 ---
    // Runtime の実行ロールに Bedrock の InvokeModel 権限を追加する
    runtime.grant(['bedrock:InvokeModel'], [
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
    ]);

    // --- 4. Endpoint 作成 ---
    // RuntimeEndpoint を作成することで、外部から Runtime を invoke できるようになる
    // Runtime の addEndpoint() メソッドを使うと、agentRuntimeId が自動で紐づく
    runtime.addEndpoint('AgentRuntimeEndpoint');
  }
}
