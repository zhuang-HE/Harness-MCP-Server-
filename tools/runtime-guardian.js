// tools/runtime-guardian.js
// MCP Tool 定义：运行时守护（D7）
import { RuntimeGuardianEngine, createRuntimeGuardianEngine } from '../lib/runtime-guardian-engine.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// 存储活跃的引擎实例
const guardianInstances = new Map();

/**
 * Tool 定义
 */
export const definition = {
  name: 'harness_runtime_guardian',
  description: '运行时守护：监控任务执行、检查资源限制、执行安全检查、处理异常。',
  toolCategory: 'harness',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '操作类型：register（注册任务）| update（更新资源）| check（安全检查）| handle（处理异常）| complete（完成任务）| report（获取报告）| stop（停止监控）',
        enum: ['register', 'update', 'check', 'handle', 'complete', 'report', 'stop'],
      },
      taskId: {
        type: 'string',
        description: '任务ID（register/update/handle/complete 操作必需）',
      },
      timeoutMs: {
        type: 'number',
        description: '任务超时时间（毫秒，仅 register 操作）',
      },
      resourceUsage: {
        type: 'object',
        description: '资源使用数据（仅 update 操作）',
        properties: {
          memoryMB: { type: 'number' },
          cpuPercent: { type: 'number' },
        },
      },
      command: {
        type: 'string',
        description: '要执行的命令（仅 check 操作）',
      },
      error: {
        type: 'string',
        description: '错误信息（仅 handle 操作）',
      },
      result: {
        type: 'object',
        description: '任务结果（仅 complete 操作）',
      },
      options: {
        type: 'object',
        description: '可选参数：maxMemoryMB, maxCpuPercent, maxExecutionTimeMs 等',
        properties: {
          maxMemoryMB: { type: 'number' },
          maxCpuPercent: { type: 'number' },
          maxExecutionTimeMs: { type: 'number' },
          enableDangerousOperationCheck: { type: 'boolean' },
          enablePermissionCheck: { type: 'boolean' },
          enableAutoRecovery: { type: 'boolean' },
        },
      },
      sessionId: {
        type: 'string',
        description: '会话ID（用于多任务管理）',
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
    taskId,
    timeoutMs,
    resourceUsage,
    command,
    error,
    result,
    options = {},
    sessionId = 'default',
  } = args;

  // 1. 验证必需参数
  if (!action) {
    throw new Error('Missing required parameter: action');
  }

  // 2. 获取或创建引擎实例
  let engine = guardianInstances.get(sessionId);
  if (!engine) {
    engine = createRuntimeGuardianEngine(options);
    guardianInstances.set(sessionId, engine);
  }

  // 3. 执行操作
  switch (action) {
    case 'register': {
      if (!taskId) {
        throw new Error('Missing required parameter for register: taskId');
      }
      
      const task = engine.registerTask(taskId, { timeoutMs });
      
      return {
        success: true,
        action: 'register',
        taskId,
        startTime: task.startTime,
        timeoutMs: timeoutMs || engine.options.maxExecutionTimeMs,
        message: `Task ${taskId} registered successfully`,
      };
    }

    case 'update': {
      if (!taskId) {
        throw new Error('Missing required parameter for update: taskId');
      }
      
      if (!resourceUsage) {
        throw new Error('Missing required parameter for update: resourceUsage');
      }
      
      engine.updateTaskResourceUsage(taskId, resourceUsage);
      
      const task = engine.activeTasks.get(taskId);
      return {
        success: true,
        action: 'update',
        taskId,
        resourceUsage: task.resourceUsage,
        message: `Task ${taskId} resource usage updated`,
      };
    }

    case 'check': {
      if (!command) {
        throw new Error('Missing required parameter for check: command');
      }
      
      const securityResult = engine.checkSecurity(taskId || 'unknown', command);
      
      return {
        success: true,
        action: 'check',
        command,
        safe: securityResult.safe,
        warnings: securityResult.warnings,
        errors: securityResult.errors,
        message: securityResult.safe ? 'Command is safe' : 'Command has security issues',
      };
    }

    case 'handle': {
      if (!taskId) {
        throw new Error('Missing required parameter for handle: taskId');
      }
      
      if (!error) {
        throw new Error('Missing required parameter for handle: error');
      }
      
      const recovery = await engine.handleException(taskId, new Error(error));
      
      return {
        success: true,
        action: 'handle',
        taskId,
        recovered: recovery.recovered,
        retryCount: recovery.retryCount,
        message: recovery.message,
      };
    }

    case 'complete': {
      if (!taskId) {
        throw new Error('Missing required parameter for complete: taskId');
      }
      
      engine.completeTask(taskId, result || {});
      
      return {
        success: true,
        action: 'complete',
        taskId,
        message: `Task ${taskId} completed successfully`,
      };
    }

    case 'report': {
      const report = engine.getMonitoringReport();
      
      return {
        success: true,
        action: 'report',
        timestamp: report.timestamp,
        activeTasksCount: report.activeTasksCount,
        activeTasks: report.activeTasks,
        resourceHistoryCount: report.resourceHistoryCount,
        securityEventsCount: report.securityEventsCount,
        recentSecurityEvents: report.recentSecurityEvents,
      };
    }

    case 'stop': {
      engine.stopMonitoring();
      guardianInstances.delete(sessionId);
      
      return {
        success: true,
        action: 'stop',
        message: 'Monitoring stopped successfully',
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
