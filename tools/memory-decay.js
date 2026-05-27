// tools/memory-decay.js
// MCP Tool 定义：记忆衰减（D2）
import { MemoryDecayEngine, createMemoryDecayEngine } from '../lib/memory-decay-engine.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// 存储活跃的引擎实例
const decayInstances = new Map();

/**
 * Tool 定义
 */
export const definition = {
  name: 'harness_memory_decay',
  description: '记忆衰减管理：计算记忆衰减、评估重要度、自动蒸馏、优化存储。',  toolCategory: 'harness',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '操作类型：calculate（计算衰减）| evaluate（评估重要度）| distill（蒸馏记忆）| optimize（优化存储）',
        enum: ['calculate', 'evaluate', 'distill', 'optimize'],
      },
      memories: {
        type: 'array',
        description: '记忆数组（每个记忆包含 id, content, createdAt, lastAccessedAt, accessCount, importance）',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            createdAt: { type: 'number' },
            lastAccessedAt: { type: 'number' },
            accessCount: { type: 'number' },
            importance: { type: 'number' },
          },
          required: ['id'],
        },
      },
      memoryDir: {
        type: 'string',
        description: '记忆目录路径（用于从文件读取记忆）',
      },
      options: {
        type: 'object',
        description: '可选参数：decayRate, halfLifeDays, distillationThreshold 等',
        properties: {
          decayRate: { type: 'number' },
          halfLifeDays: { type: 'number' },
          distillationThreshold: { type: 'number' },
          maxMemoryAge: { type: 'number' },
        },
      },
      sessionId: {
        type: 'string',
        description: '会话ID（用于多轮记忆管理）',
      },
    },
    required: ['action'],
  },
};

/**
 * Tool 处理器
 */
export async function handler(args) {
  const {
    action,
    memories: inputMemories,
    memoryDir,
    options = {},
    sessionId = 'default',
  } = args;

  // 1. 验证必需参数
  if (!action) {
    throw new Error('Missing required parameter: action');
  }

  // 2. 获取或创建引擎实例
  let engine = decayInstances.get(sessionId);
  if (!engine) {
    engine = createMemoryDecayEngine(options);
    decayInstances.set(sessionId, engine);
  }

  // 3. 读取记忆（如果提供了目录）
  let memories = inputMemories || [];
  if (memoryDir) {
    try {
      const files = await fs.readdir(memoryDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(memoryDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const memory = JSON.parse(content);
          memories.push(memory);
        }
      }
    } catch (error) {
      throw new Error(`Failed to read memory directory: ${error.message}`);
    }
  }

  if (memories.length === 0 && action !== 'optimize') {
    throw new Error('No memories provided. Please provide memories array or memoryDir.');
  }

  // 4. 执行操作
  switch (action) {
    case 'calculate': {
      // 计算衰减后的重要度
      const results = memories.map(memory => ({
        id: memory.id,
        originalImportance: memory.importance || 0.5,
        decayedImportance: engine.calculateDecayedImportance(memory),
      }));

      return {
        success: true,
        action: 'calculate',
        memoriesProcessed: memories.length,
        results,
        summary: {
          averageDecayedImportance: results.reduce((sum, r) => sum + r.decayedImportance, 0) / results.length,
          minDecayedImportance: Math.min(...results.map(r => r.decayedImportance)),
          maxDecayedImportance: Math.max(...results.map(r => r.decayedImportance)),
        },
      };
    }

    case 'evaluate': {
      // 评估记忆重要度
      const evaluations = memories.map(memory => ({
        id: memory.id,
        evaluation: engine.evaluateImportance(memory),
      }));

      return {
        success: true,
        action: 'evaluate',
        memoriesProcessed: memories.length,
        evaluations,
        summary: {
          keepCount: evaluations.filter(e => e.evaluation.recommendation === 'keep').length,
          distillCount: evaluations.filter(e => e.evaluation.recommendation === 'distill').length,
          archiveCount: evaluations.filter(e => e.evaluation.recommendation === 'archive').length,
        },
      };
    }

    case 'distill': {
      // 蒸馏记忆
      const distilled = memories.map(memory => engine.distillMemory(memory));

      return {
        success: true,
        action: 'distill',
        memoriesProcessed: memories.length,
        distilled,
        summary: {
          averageCompressionRatio: distilled.reduce((sum, d) => sum + d.compressionRatio, 0) / distilled.length,
          totalOriginalSize: distilled.reduce((sum, d) => sum + d.originalLength, 0),
          totalDistilledSize: distilled.reduce((sum, d) => sum + d.distilledLength, 0),
        },
      };
    }

    case 'optimize': {
      // 优化存储
      const optimizationResult = await engine.optimizeStorage(memories);

      return {
        success: true,
        action: 'optimize',
        memoriesProcessed: memories.length,
        optimization: optimizationResult,
        summary: {
          hotCount: optimizationResult.hotCount,
          warmCount: optimizationResult.warmCount,
          coldCount: optimizationResult.coldCount,
          hotPath: optimizationResult.storagePaths.hot,
          warmPath: optimizationResult.storagePaths.warm,
          coldPath: optimizationResult.storagePaths.cold,
        },
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
