/**
 * 阶段9：D9 multi-agent增强（多Agent编排）
 * 
 * 功能：
 * 1. Agent通信（消息传递、事件总线、状态同步）
 * 2. 协作模式（主从模式、对等模式、层次模式）
 * 3. 冲突解决（资源冲突、决策冲突、优先级冲突）
 * 
 * 预估工时：5h
 */

// 数据存储
const multiAgentState = {
  agents: [], // Agent列表
  messages: [], // 消息队列
  events: [], // 事件总线
  collaborations: [], // 协作模式
  conflicts: [], // 冲突记录
};

// ==================== 1. Agent通信 ====================

/**
 * 注册Agent
 */
function registerAgent(agentId, agentType, capabilities = []) {
  if (!agentId || !agentType) {
    throw new Error('Missing required parameters: agentId, agentType');
  }

  const existing = multiAgentState.agents.find(a => a.id === agentId);
  if (existing) {
    throw new Error(`Agent already exists: ${agentId}`);
  }

  const agent = {
    id: agentId,
    type: agentType, // master, worker, peer, coordinator
    capabilities,
    status: 'idle', // idle, busy, offline
    registeredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    stats: {
      messagesSent: 0,
      messagesReceived: 0,
      tasksCompleted: 0,
      uptime: 0,
    },
  };

  multiAgentState.agents.push(agent);
  return { success: true, agent };
}

/**
 * 发送消息
 */
function sendMessage(fromAgentId, toAgentId, messageType, payload = {}) {
  if (!fromAgentId || !toAgentId || !messageType) {
    throw new Error('Missing required parameters: fromAgentId, toAgentId, messageType');
  }

  const fromAgent = multiAgentState.agents.find(a => a.id === fromAgentId);
  const toAgent = multiAgentState.agents.find(a => a.id === toAgentId);

  if (!fromAgent) {
    throw new Error(`From agent not found: ${fromAgentId}`);
  }
  if (!toAgent) {
    throw new Error(`To agent not found: ${toAgentId}`);
  }

  const message = {
    id: `msg_${Date.now()}`,
    from: fromAgentId,
    to: toAgentId,
    type: messageType, // request, response, notification, heartbeat
    payload,
    timestamp: new Date().toISOString(),
    status: 'pending', // pending, delivered, read, failed
  };

  multiAgentState.messages.push(message);
  fromAgent.stats.messagesSent++;
  toAgent.stats.messagesReceived++;

  // 更新Agent最后活跃时间
  fromAgent.lastSeen = new Date().toISOString();
  toAgent.lastSeen = new Date().toISOString();

  return { success: true, message };
}

/**
 * 广播消息
 */
function broadcastMessage(fromAgentId, messageType, payload = {}, targetType = null) {
  if (!fromAgentId || !messageType) {
    throw new Error('Missing required parameters: fromAgentId, messageType');
  }

  const fromAgent = multiAgentState.agents.find(a => a.id === fromAgentId);
  if (!fromAgent) {
    throw new Error(`From agent not found: ${fromAgentId}`);
  }

  const targets = targetType
    ? multiAgentState.agents.filter(a => a.type === targetType && a.id !== fromAgentId)
    : multiAgentState.agents.filter(a => a.id !== fromAgentId);

  const messages = [];
  for (const target of targets) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      from: fromAgentId,
      to: target.id,
      type: messageType,
      payload,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    multiAgentState.messages.push(message);
    messages.push(message);
    target.stats.messagesReceived++;
  }

  fromAgent.stats.messagesSent += messages.length;
  fromAgent.lastSeen = new Date().toISOString();

  return { success: true, messages, count: messages.length };
}

/**
 * 事件总线（发布事件）
 */
function publishEvent(eventType, data = {}, sourceAgentId = null) {
  if (!eventType) {
    throw new Error('Missing required parameter: eventType');
  }

  const event = {
    id: `evt_${Date.now()}`,
    type: eventType,
    data,
    source: sourceAgentId,
    timestamp: new Date().toISOString(),
    deliveredTo: [],
  };

  multiAgentState.events.push(event);

  // 简化版事件传递：标记所有在线Agent为已送达
  const onlineAgents = multiAgentState.agents.filter(a => a.status !== 'offline');
  event.deliveredTo = onlineAgents.map(a => a.id);

  return { success: true, event, deliveredCount: event.deliveredTo.length };
}

/**
 * 状态同步
 */
function syncState(agentId, stateData = {}) {
  if (!agentId) {
    throw new Error('Missing required parameter: agentId');
  }

  const agent = multiAgentState.agents.find(a => a.id === agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // 更新Agent状态
  agent.status = stateData.status || agent.status;
  agent.lastSeen = new Date().toISOString();
  agent.state = stateData;

  // 发布状态变更事件
  publishEvent('agent_state_changed', {
    agentId,
    status: agent.status,
    state: stateData,
  }, agentId);

  return { success: true, agent, syncedAt: new Date().toISOString() };
}

// ==================== 2. 协作模式 ====================

/**
 * 创建主从模式协作
 */
function createMasterWorkerCollaboration(masterId, workerIds = []) {
  if (!masterId) {
    throw new Error('Missing required parameter: masterId');
  }

  const master = multiAgentState.agents.find(a => a.id === masterId);
  if (!master) {
    throw new Error(`Master agent not found: ${masterId}`);
  }

  const workers = [];
  for (const workerId of workerIds) {
    const worker = multiAgentState.agents.find(a => a.id === workerId);
    if (worker) {
      workers.push(worker);
    }
  }

  const collab = {
    id: `collab_${Date.now()}`,
    type: 'master-worker',
    master: masterId,
    workers: workerIds,
    status: 'active',
    createdAt: new Date().toISOString(),
    stats: {
      tasksAssigned: 0,
      tasksCompleted: 0,
      avgCompletionTime: 0,
    },
  };

  multiAgentState.collaborations.push(collab);

  // 发布协作创建事件
  publishEvent('collaboration_created', { collabId: collab.id, type: 'master-worker' });

  return { success: true, collaboration: collab };
}

/**
 * 创建对等模式协作
 */
function createPeerCollaboration(peerIds = []) {
  if (peerIds.length < 2) {
    throw new Error('Peer collaboration requires at least 2 peers');
  }

  const peers = [];
  for (const peerId of peerIds) {
    const peer = multiAgentState.agents.find(a => a.id === peerId);
    if (peer) {
      peers.push(peer);
    }
  }

  if (peers.length < 2) {
    throw new Error('Not enough valid peers found');
  }

  const collab = {
    id: `collab_${Date.now()}`,
    type: 'peer-to-peer',
    peers: peerIds,
    status: 'active',
    createdAt: new Date().toISOString(),
    stats: {
      messagesExchanged: 0,
      tasksCollaborated: 0,
    },
  };

  multiAgentState.collaborations.push(collab);

  // 发布协作创建事件
  publishEvent('collaboration_created', { collabId: collab.id, type: 'peer-to-peer' });

  return { success: true, collaboration: collab };
}

/**
 * 创建层次模式协作
 */
function createHierarchicalCollaboration(rootId, levels = []) {
  if (!rootId) {
    throw new Error('Missing required parameter: rootId');
  }

  const root = multiAgentState.agents.find(a => a.id === rootId);
  if (!root) {
    throw new Error(`Root agent not found: ${rootId}`);
  }

  const hierarchy = {
    root: rootId,
    levels: levels.map(level => ({
      level: level.level,
      agents: level.agents || [],
    })),
  };

  const collab = {
    id: `collab_${Date.now()}`,
    type: 'hierarchical',
    hierarchy,
    status: 'active',
    createdAt: new Date().toISOString(),
    stats: {
      decisionsMade: 0,
      escalations: 0,
    },
  };

  multiAgentState.collaborations.push(collab);

  // 发布协作创建事件
  publishEvent('collaboration_created', { collabId: collab.id, type: 'hierarchical' });

  return { success: true, collaboration: collab };
}

// ==================== 3. 冲突解决 ====================

/**
 * 检测资源冲突
 */
function detectResourceConflict(taskId, resourceType, requestedBy = []) {
  if (!taskId || !resourceType) {
    throw new Error('Missing required parameters: taskId, resourceType');
  }

  // 简化版冲突检测：检查是否有多个Agent请求同一资源
  const conflict = {
    id: `conflict_${Date.now()}`,
    type: 'resource',
    taskId,
    resourceType,
    requestedBy,
    severity: requestedBy.length > 2 ? 'high' : 'medium',
    status: 'open',
    detectedAt: new Date().toISOString(),
  };

  multiAgentState.conflicts.push(conflict);

  // 发布冲突检测事件
  publishEvent('conflict_detected', { conflictId: conflict.id, type: 'resource' });

  return { success: true, conflict };
}

/**
 * 检测决策冲突
 */
function detectDecisionConflict(taskId, options = [], votes = {}) {
  if (!taskId || !options || options.length === 0) {
    throw new Error('Missing required parameters: taskId, options');
  }

  // 简化版决策冲突检测：检查投票是否分散
  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);
  const maxVotes = Math.max(...Object.values(votes));
  const isConsensus = maxVotes / totalVotes > 0.5;

  if (!isConsensus) {
    const conflict = {
      id: `conflict_${Date.now()}`,
      type: 'decision',
      taskId,
      options,
      votes,
      severity: totalVotes > 5 ? 'high' : 'low',
      status: 'open',
      detectedAt: new Date().toISOString(),
    };

    multiAgentState.conflicts.push(conflict);

    // 发布冲突检测事件
    publishEvent('conflict_detected', { conflictId: conflict.id, type: 'decision' });

    return { success: true, conflict, resolved: false };
  }

  return { success: true, resolved: true, decision: options[0] };
}

/**
 * 解决冲突
 */
function resolveConflict(conflictId, resolution = {}, resolvedBy = null) {
  if (!conflictId) {
    throw new Error('Missing required parameter: conflictId');
  }

  const conflict = multiAgentState.conflicts.find(c => c.id === conflictId);
  if (!conflict) {
    throw new Error(`Conflict not found: ${conflictId}`);
  }

  if (conflict.status === 'resolved') {
    throw new Error(`Conflict already resolved: ${conflictId}`);
  }

  conflict.status = 'resolved';
  conflict.resolvedAt = new Date().toISOString();
  conflict.resolvedBy = resolvedBy;
  conflict.resolution = resolution;

  // 发布冲突解决事件
  publishEvent('conflict_resolved', { conflictId, resolution });

  return { success: true, conflict };
}

/**
 * 获取冲突报告
 */
function getConflictReport() {
  const openConflicts = multiAgentState.conflicts.filter(c => c.status === 'open');
  const resolvedConflicts = multiAgentState.conflicts.filter(c => c.status === 'resolved');

  const report = {
    total: multiAgentState.conflicts.length,
    open: openConflicts.length,
    resolved: resolvedConflicts.length,
    byType: {
      resource: multiAgentState.conflicts.filter(c => c.type === 'resource').length,
      decision: multiAgentState.conflicts.filter(c => c.type === 'decision').length,
      priority: multiAgentState.conflicts.filter(c => c.type === 'priority').length,
    },
    bySeverity: {
      high: multiAgentState.conflicts.filter(c => c.severity === 'high').length,
      medium: multiAgentState.conflicts.filter(c => c.severity === 'medium').length,
      low: multiAgentState.conflicts.filter(c => c.severity === 'low').length,
    },
    openConflicts: openConflicts.map(c => ({
      id: c.id,
      type: c.type,
      taskId: c.taskId,
      severity: c.severity,
      detectedAt: c.detectedAt,
    })),
  };

  return { success: true, report };
}

// ==================== 导出 ====================

export {
  // Agent通信
  registerAgent,
  sendMessage,
  broadcastMessage,
  publishEvent,
  syncState,
  
  // 协作模式
  createMasterWorkerCollaboration,
  createPeerCollaboration,
  createHierarchicalCollaboration,
  
  // 冲突解决
  detectResourceConflict,
  detectDecisionConflict,
  resolveConflict,
  getConflictReport,
  
  // 状态查询
  multiAgentState,
};
