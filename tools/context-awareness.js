/**
 * Context Awareness MCP Tool - 上下文感知 Tool 定义
 * 功能：分析任务上下文，识别任务类型，匹配用户偏好，生成建议
 * 版本: v4.0.0 (Stage 3)
 * 日期: 2026-05-27
 */

import { createContextAwareness, quickAnalyze } from '../lib/context-awareness-engine.js';
import fs from 'fs/promises';

// 上下文感知实例缓存
const awarenessInstances = new Map();

/**
 * Tool 定义
 */
export const definition = {
  name: 'harness_context_aware',
  description: '分析任务上下文，识别任务类型，匹配用户偏好，生成智能建议。支持项目上下文分析和历史任务关联。',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: '任务描述（例如："创建一个 React 组件"、"审查这段代码"）',
      },
      project: {
        type: 'string',
        description: '项目路径（绝对路径，用于分析项目上下文）',
      },
      sessionId: {
        type: 'string',
        description: '会话 ID（用于复用上下文感知实例）',
      },
      includeHistory: {
        type: 'boolean',
        description: '是否包含历史任务关联',
        default: true,
      },
      learn: {
        type: 'boolean',
        description: '是否从结果中学习用户偏好',
        default: false,
      },
    },
    required: ['task'],
  },
};

/**
 * Tool 处理器
 */
export async function handler(args) {
  const {
    task,
    project = null,
    sessionId = 'default',
    includeHistory = true,
    learn = false,
  } = args;

  try {
    // 0. 验证必需参数
    if (!task || typeof task !== 'string') {
      throw new Error('Missing or invalid required parameter: task');
    }

    // 1. 获取或创建上下文感知实例
    let engine = awarenessInstances.get(sessionId);
    if (!engine) {
      engine = createContextAwareness();
      awarenessInstances.set(sessionId, engine);
    }

    // 2. 分析任务上下文
    console.error(`🔍 Analyzing task context: ${task.substring(0, 50)}...`);
    
    const result = await engine.analyzeTask({
      task,
      project,
      options: { includeHistory },
    });

    // 3. 学习用户偏好（如果启用）
    if (learn && result.context) {
      console.error('📚 Learning from user feedback...');
      // 这里可以从结果中提取反馈信息
      // engine.learnFromFeedback(task, feedback);
    }

    // 4. 返回结果
    return {
      success: true,
      task: result.task,
      project: result.project,
      timestamp: result.timestamp,
      context: result.context,
      recommendations: result.recommendations,
      confidence: result.confidence,
      stats: engine.getStats(),
    };

  } catch (error) {
    console.error('❌ Context awareness analysis failed:', error);
    throw error;
  }
}

/**
 * 清除上下文感知实例缓存
 */
export function clearInstances() {
  awarenessInstances.clear();
}

/**
 * 获取活跃的会话列表
 */
export function getActiveSessions() {
  return Array.from(awarenessInstances.keys());
}
