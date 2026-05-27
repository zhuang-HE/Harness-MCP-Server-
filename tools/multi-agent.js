/**
 * 阶段9：D9 multi-agent增强（多Agent编排）
 * 
 * MCP Tool: harness_multi_agent
 * 功能：Agent通信、协作模式、冲突解决
 */

import {
  registerAgent,
  sendMessage,
  broadcastMessage,
  publishEvent,
  syncState,
  createMasterWorkerCollaboration,
  createPeerCollaboration,
  createHierarchicalCollaboration,
  detectResourceConflict,
  detectDecisionConflict,
  resolveConflict,
  getConflictReport,
  multiAgentState,
} from '../lib/multi-agent-engine.js';

// ==================== Tool 定义 ====================

export const definition = {
  name: 'harness_multi_agent',
  description: '多Agent编排：Agent通信、协作模式、冲突解决。支持消息传递、事件总线、状态同步、主从/对等/层次协作模式。',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'register_agent', // 注册Agent
          'send_message', // 发送消息
          'broadcast_message', // 广播消息
          'publish_event', // 发布事件
          'sync_state', // 状态同步
          'create_master_worker', // 创建主从协作
          'create_peer', // 创建对等协作
          'create_hierarchical', // 创建层次协作
          'detect_resource_conflict', // 检测资源冲突
          'detect_decision_conflict', // 检测决策冲突
          'resolve_conflict', // 解决冲突
          'get_conflict_report', // 获取冲突报告
          'get_status', // 获取状态
        ],
        description: '操作类型',
      },
      // Agent相关
      agentId: { type: 'string', description: 'Agent ID' },
      agentType: { type: 'string', description: 'Agent类型（master/worker/peer/coordinator）' },
      capabilities: { type: 'array', items: { type: 'string' }, description: 'Agent能力列表' },
      // 消息相关
      fromAgentId: { type: 'string', description: '发送方Agent ID' },
      toAgentId: { type: 'string', description: '接收方Agent ID' },
      messageType: { type: 'string', description: '消息类型（request/response/notification/heartbeat）' },
      payload: { type: 'object', description: '消息负载' },
      targetType: { type: 'string', description: '广播目标类型（指定Agent类型）' },
      // 协作相关
      masterId: { type: 'string', description: '主Agent ID' },
      workerIds: { type: 'array', items: { type: 'string' }, description: '工作Agent ID列表' },
      peerIds: { type: 'array', items: { type: 'string' }, description: '对等Agent ID列表' },
      rootId: { type: 'string', description: '根Agent ID（层次模式）' },
      levels: { type: 'array', items: { type: 'object' }, description: '层次结构定义' },
      // 冲突相关
      conflictId: { type: 'string', description: '冲突ID' },
      taskId: { type: 'string', description: '任务ID' },
      resourceType: { type: 'string', description: '资源类型' },
      requestedBy: { type: 'array', items: { type: 'string' }, description: '请求方Agent ID列表' },
      options: { type: 'array', items: { type: 'string' }, description: '决策选项列表' },
      votes: { type: 'object', description: '投票结果（选项->票数）' },
      resolution: { type: 'object', description: '冲突解决方案' },
      resolvedBy: { type: 'string', description: '解决方Agent ID' },
      // 状态相关
      stateData: { type: 'object', description: '状态数据' },
      // 事件相关
      eventType: { type: 'string', description: '事件类型' },
      data: { type: 'object', description: '事件数据' },
      sourceAgentId: { type: 'string', description: '事件源Agent ID' },
      // 通用
      sessionId: { type: 'string', description: '会话ID（用于日志追踪）' },
    },
    required: ['action'],
  },
};

// ==================== Handler ====================

export async function handler(args, context) {
  const { action } = args;
  const sessionId = args.sessionId || `session_${Date.now()}`;

  try {
    switch (action) {
      // ========== 1. Agent通信 ==========
      case 'register_agent': {
        const { agentId, agentType, capabilities } = args;
        const result = registerAgent(agentId, agentType, capabilities || []);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'send_message': {
        const { fromAgentId, toAgentId, messageType, payload } = args;
        const result = sendMessage(fromAgentId, toAgentId, messageType, payload || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'broadcast_message': {
        const { fromAgentId, messageType, payload, targetType } = args;
        const result = broadcastMessage(fromAgentId, messageType, payload || {}, targetType);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'publish_event': {
        const { eventType, data, sourceAgentId } = args;
        const result = publishEvent(eventType, data || {}, sourceAgentId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sync_state': {
        const { agentId, stateData } = args;
        const result = syncState(agentId, stateData || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // ========== 2. 协作模式 ==========
      case 'create_master_worker': {
        const { masterId, workerIds } = args;
        const result = createMasterWorkerCollaboration(masterId, workerIds || []);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_peer': {
        const { peerIds } = args;
        const result = createPeerCollaboration(peerIds || []);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_hierarchical': {
        const { rootId, levels } = args;
        const result = createHierarchicalCollaboration(rootId, levels || []);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // ========== 3. 冲突解决 ==========
      case 'detect_resource_conflict': {
        const { taskId, resourceType, requestedBy } = args;
        const result = detectResourceConflict(taskId, resourceType, requestedBy || []);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'detect_decision_conflict': {
        const { taskId, options, votes } = args;
        const result = detectDecisionConflict(taskId, options || [], votes || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'resolve_conflict': {
        const { conflictId, resolution, resolvedBy } = args;
        const result = resolveConflict(conflictId, resolution || {}, resolvedBy);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_conflict_report': {
        const result = getConflictReport();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_status': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                agents: multiAgentState.agents.length,
                messages: multiAgentState.messages.length,
                events: multiAgentState.events.length,
                collaborations: multiAgentState.collaborations.length,
                conflicts: multiAgentState.conflicts.length,
                openConflicts: multiAgentState.conflicts.filter(c => c.status === 'open').length,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            action,
            sessionId,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
