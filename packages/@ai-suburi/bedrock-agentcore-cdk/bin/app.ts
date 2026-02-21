#!/usr/bin/env npx tsx
import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { AgentCoreRuntimeStack } from '../lib/agentcore-runtime-stack.js';

const app = new cdk.App();

new AgentCoreRuntimeStack(app, 'AgentCoreRuntimeStack', {
  // CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION が設定されていればそれを使用
  // 未設定の場合は CDK が AWS CLI のプロファイルから自動検出する
  ...(process.env.CDK_DEFAULT_ACCOUNT && process.env.CDK_DEFAULT_REGION
    ? {
        env: {
          account: process.env.CDK_DEFAULT_ACCOUNT,
          region: process.env.CDK_DEFAULT_REGION,
        },
      }
    : {}),
});
