/**
 * Harness MCP Server - 监控 Tools
 *
 * harness_monitor: 查询监控数据和历史快照
 * harness_health:   健康检查
 */

import { monitor } from '../lib/monitor-engine.js';

// ═══════════════════════════════════════════
// harness_monitor
// ═══════════════════════════════════════════

export const definition = {
  name: 'harness_monitor',
  description: '查询 Harness MCP Server 的实时监控数据，包括请求统计、响应时间、内存使用、工具调用统计和历史快照',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['snapshot', 'health', 'history', 'tools', 'reset'],
        description: '操作类型：snapshot（完整快照）、health（健康检查）、history（历史快照）、tools（工具统计）、reset（重置计数器）',
      },
      limit: {
        type: 'number',
        description: '返回历史快照数量（history 时使用，默认 20）',
      },
    },
    required: [],
  },
};

export async function handler(args = {}) {
  const { action = 'snapshot', limit = 20 } = args;

  try {
    switch (action) {
      case 'snapshot': {
        const snap = monitor.snapshot();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              action: 'snapshot',
              ...snap,
            }, null, 2),
          }],
        };
      }

      case 'health': {
        const health = monitor.getHealth();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              action: 'health',
              ...health,
            }, null, 2),
          }],
        };
      }

      case 'history': {
        const snapshots = monitor.getSnapshots(limit);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              action: 'history',
              count: snapshots.length,
              snapshots,
            }, null, 2),
          }],
        };
      }

      case 'tools': {
        const stats = Array.from(monitor.toolStats.entries()).map(([name, s]) => ({
          name,
          count: s.count,
          errors: s.errors,
          avgTime: s.count > 0 ? Math.round(s.totalTime / s.count) : 0,
          minTime: s.minTime === Infinity ? 0 : s.minTime,
          maxTime: s.maxTime,
          lastCalled: s.lastCalled,
        }));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              action: 'tools',
              count: stats.length,
              tools: stats,
            }, null, 2),
          }],
        };
      }

      case 'reset': {
        monitor.reset();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              action: 'reset',
              message: '计数器已重置',
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
        }, null, 2),
      }],
      isError: true,
    };
  }
}

// ═══════════════════════════════════════════
// harness_health
// ═══════════════════════════════════════════

export const healthDefinition = {
  name: 'harness_health',
  description: '执行 Harness MCP Server 健康检查，返回服务器状态、错误率和资源使用情况',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function healthHandler() {
  try {
    const health = monitor.getHealth();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ...health,
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
        }, null, 2),
      }],
      isError: true,
    };
  }
}
