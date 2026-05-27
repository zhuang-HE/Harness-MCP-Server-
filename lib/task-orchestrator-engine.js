// lib/task-orchestrator-engine.js
// Task Orchestrator Engine - 任务编排器引擎（增强版）
// 功能：智能拆解、自动分配、进度跟踪、动态编排

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

// ==================== 1. 智能拆解 ====================

/**
 * 任务分析
 * @param {Object} task - 任务对象
 * @returns {Promise<Object>} 分析结果
 */
export async function analyzeTask(task) {
  const analysis = {
    taskId: task.id || generateId(),
    taskType: task.type || "unknown",
    complexity: calculateComplexity(task),
    estimatedDuration: estimateDuration(task),
    requiredCapabilities: identifyRequiredCapabilities(task),
    dependencies: identifyDependencies(task),
  };
  
  return {
    success: true,
    analysis,
    recommendations: generateAnalysisRecommendations(analysis),
  };
}

/**
 * 依赖识别
 * @param {Object} task - 任务对象
 * @param {Array} existingTasks - 现有任务列表
 * @returns {Promise<Object>} 依赖识别结果
 */
export async function identifyDependencies(task, existingTasks = []) {
  const dependencies = [];
  
  // 1. 基于任务类型识别依赖
  if (task.type === "testing" && task.relatedTask) {
    dependencies.push({
      taskId: task.relatedTask,
      type: "sequential",
      reason: "测试任务必须在开发任务完成后执行",
    });
  }
  
  if (task.type === "deployment" && task.relatedTasks) {
    for (const relatedTask of task.relatedTasks) {
      dependencies.push({
        taskId: relatedTask,
        type: "sequential",
        reason: "部署任务必须在所有开发任务完成后执行",
      });
    }
  }
  
  // 2. 基于关键词识别依赖
  if (task.description) {
    const keywords = ["基于", "依赖", "使用", "集成"];
    for (const keyword of keywords) {
      if (task.description.includes(keyword)) {
        // 简化实现：假设依赖已存在任务
        const possibleDeps = existingTasks.filter(t => 
          t.description && t.description.includes(keyword)
        );
        for (const dep of possibleDeps) {
          dependencies.push({
            taskId: dep.id,
            type: "sequential",
            reason: `基于关键词"${keyword}"识别的依赖`,
          });
        }
      }
    }
  }
  
  // 3. 去重
  const uniqueDeps = [];
  const seenIds = new Set();
  for (const dep of dependencies) {
    if (!seenIds.has(dep.taskId)) {
      seenIds.add(dep.taskId);
      uniqueDeps.push(dep);
    }
  }
  
  return {
    success: true,
    taskId: task.id,
    dependencies: uniqueDeps,
    totalDependencies: uniqueDeps.length,
  };
}

/**
 * 子任务生成
 * @param {Object} task - 任务对象
 * @param {Object} analysis - 任务分析结果
 * @returns {Promise<Object>} 子任务生成结果
 */
export async function generateSubtasks(task, analysis) {
  const subtasks = [];
  
  // 1. 基于任务类型生成子任务
  if (task.type === "fullstack-development") {
    subtasks.push(
      { id: generateId(), name: "前端开发", type: "frontend", estimatedDuration: analysis.estimatedDuration * 0.4 },
      { id: generateId(), name: "后端开发", type: "backend", estimatedDuration: analysis.estimatedDuration * 0.4 },
      { id: generateId(), name: "集成测试", type: "testing", estimatedDuration: analysis.estimatedDuration * 0.2 }
    );
  } else if (task.type === "code-generation") {
    subtasks.push(
      { id: generateId(), name: "代码生成", type: "code-generation", estimatedDuration: analysis.estimatedDuration * 0.6 },
      { id: generateId(), name: "代码审查", type: "code-review", estimatedDuration: analysis.estimatedDuration * 0.2 },
      { id: generateId(), name: "测试", type: "testing", estimatedDuration: analysis.estimatedDuration * 0.2 }
    );
  } else {
    // 默认：拆分为3个子任务
    const chunkDuration = analysis.estimatedDuration / 3;
    subtasks.push(
      { id: generateId(), name: "子任务1", type: task.type, estimatedDuration: chunkDuration },
      { id: generateId(), name: "子任务2", type: task.type, estimatedDuration: chunkDuration },
      { id: generateId(), name: "子任务3", type: task.type, estimatedDuration: chunkDuration }
    );
  }
  
  // 2. 设置依赖关系
  for (let i = 1; i < subtasks.length; i++) {
    subtasks[i].dependencies = [subtasks[i-1].id];
  }
  
  // 3. 保存子任务
  await saveSubtasks(task.id, subtasks);
  
  return {
    success: true,
    taskId: task.id,
    subtasks,
    totalSubtasks: subtasks.length,
  };
}

// ==================== 2. 自动分配 ====================

/**
 * Agent能力匹配
 * @param {Object} task - 任务对象
 * @param {Array} agents - 可用Agent列表
 * @returns {Promise<Object>} 匹配结果
 */
export async function matchAgentCapabilities(task, agents) {
  const matches = [];
  
  for (const agent of agents) {
    const score = calculateCapabilityMatchScore(task, agent);
    if (score > 0.5) { // 阈值：50%
      matches.push({
        agentId: agent.id,
        agentName: agent.name,
        score,
        matchedCapabilities: agent.capabilities.filter(cap => 
          task.requiredCapabilities && task.requiredCapabilities.includes(cap)
        ),
      });
    }
  }
  
  // 按分数排序
  matches.sort((a, b) => b.score - a.score);
  
  return {
    success: true,
    taskId: task.id,
    matches,
    bestMatch: matches.length > 0 ? matches[0] : null,
  };
}

/**
 * 负载均衡
 * @param {Array} agents - 可用Agent列表
 * @param {Array} tasks - 待分配任务列表
 * @returns {Promise<Object>} 均衡结果
 */
export async function balanceLoad(agents, tasks) {
  const assignments = [];
  const agentLoad = {};
  
  // 1. 初始化Agent负载
  for (const agent of agents) {
    agentLoad[agent.id] = {
      agentId: agent.id,
      agentName: agent.name,
      currentLoad: agent.currentLoad || 0,
      maxLoad: agent.maxLoad || 3,
      tasks: [],
    };
  }
  
  // 2. 按优先级排序任务
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  });
  
  // 3. 分配任务（贪心算法：每次选择负载最低的Agent）
  for (const task of sortedTasks) {
    let bestAgentId = null;
    let minLoad = Infinity;
    
    for (const agent of agents) {
      const load = agentLoad[agent.id];
      if (load.currentLoad < load.maxLoad && load.currentLoad < minLoad) {
        bestAgentId = agent.id;
        minLoad = load.currentLoad;
      }
    }
    
    if (bestAgentId) {
      agentLoad[bestAgentId].currentLoad += 1;
      agentLoad[bestAgentId].tasks.push(task.id);
      assignments.push({
        taskId: task.id,
        agentId: bestAgentId,
        agentName: agentLoad[bestAgentId].agentName,
      });
    }
  }
  
  // 4. 计算均衡度
  const loads = Object.values(agentLoad).map(a => a.currentLoad);
  const avgLoad = loads.reduce((sum, l) => sum + l, 0) / loads.length;
  const balanceScore = 1 - (standardDeviation(loads) / avgLoad || 0);
  
  return {
    success: true,
    assignments,
    agentLoad: Object.values(agentLoad),
    balanceScore,
    statistics: {
      totalTasks: tasks.length,
      totalAgents: agents.length,
      assignedTasks: assignments.length,
      unassignedTasks: tasks.length - assignments.length,
    },
  };
}

/**
 * 优先级调度
 * @param {Array} tasks - 任务列表
 * @param {Object} strategy - 调度策略
 * @returns {Promise<Object>} 调度结果
 */
export async function scheduleByPriority(tasks, strategy = {}) {
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  const defaultStrategy = {
    preemption: false, // 是否允许抢占
    agingFactor: 0.1, // 老化因子（防止饥饿）
    capabilityWeight: 0.6, // 能力权重
    loadWeight: 0.4, // 负载权重
  };
  
  const finalStrategy = { ...defaultStrategy, ...strategy };
  
  // 1. 计算调度分数
  const scoredTasks = tasks.map(task => {
    const priorityScore = (priorityOrder[task.priority] || 0) / 3;
    const agingScore = Math.min(task.waitingTime || 0, 100) * finalStrategy.agingFactor;
    const capabilityScore = task.capabilityScore || 0.5;
    const loadScore = 1 - (task.agentLoad || 0) / (task.agentMaxLoad || 3);
    
    const totalScore = 
      priorityScore * 0.4 +
      agingScore * 0.2 +
      capabilityScore * finalStrategy.capabilityWeight * 0.2 +
      loadScore * finalStrategy.loadWeight * 0.2;
    
    return {
      ...task,
      schedulingScore: totalScore,
    };
  });
  
  // 2. 按分数排序
  scoredTasks.sort((a, b) => b.schedulingScore - a.schedulingScore);
  
  // 3. 生成调度计划
  const schedule = scoredTasks.map((task, index) => ({
    rank: index + 1,
    taskId: task.id,
    taskName: task.name,
    priority: task.priority,
    schedulingScore: task.schedulingScore,
    estimatedStartTime: Date.now() + index * (task.estimatedDuration || 3600000),
  }));
  
  return {
    success: true,
    schedule,
    strategy: finalStrategy,
    statistics: {
      totalTasks: tasks.length,
      highPriority: tasks.filter(t => t.priority === "high").length,
      mediumPriority: tasks.filter(t => t.priority === "medium").length,
      lowPriority: tasks.filter(t => t.priority === "low").length,
    },
  };
}

// ==================== 3. 进度跟踪 ====================

/**
 * 实时进度
 * @param {string} taskId - 任务ID
 * @param {Array} subtasks - 子任务列表
 * @returns {Promise<Object>} 进度结果
 */
export async function trackProgress(taskId, subtasks = []) {
  // 简化实现：基于子任务状态计算进度
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(st => st.status === "completed").length;
  const inProgressSubtasks = subtasks.filter(st => st.status === "in_progress").length;
  
  const progressPercentage = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
  
  const status = 
    completedSubtasks === totalSubtasks ? "completed" :
    inProgressSubtasks > 0 ? "in_progress" :
    "pending";
  
  return {
    success: true,
    taskId,
    progress: {
      percentage: progressPercentage,
      completed: completedSubtasks,
      total: totalSubtasks,
      status,
    },
    subtasks: subtasks.map(st => ({
      id: st.id,
      name: st.name,
      status: st.status || "pending",
      progress: st.progress || 0,
    })),
  };
}

/**
 * 瓶颈识别
 * @param {Array} tasks - 任务列表
 * @param {Array} agents - Agent列表
 * @returns {Promise<Object>} 瓶颈识别结果
 */
export async function identifyBottlenecks(tasks, agents) {
  const bottlenecks = [];
  
  // 1. 识别长时间运行的任务
  const longRunningTasks = tasks.filter(t => 
    t.status === "in_progress" && 
    Date.now() - t.startTime > 2 * 60 * 60 * 1000 // 超过2小时
  );
  
  for (const task of longRunningTasks) {
    bottlenecks.push({
      type: "long_running_task",
      taskId: task.id,
      taskName: task.name,
      duration: Date.now() - task.startTime,
      severity: "high",
      recommendation: "考虑拆分任务或增加资源",
    });
  }
  
  // 2. 识别高负载Agent
  const overloadedAgents = agents.filter(a => 
    (a.currentLoad || 0) / (a.maxLoad || 3) > 0.8
  );
  
  for (const agent of overloadedAgents) {
    bottlenecks.push({
      type: "overloaded_agent",
      agentId: agent.id,
      agentName: agent.name,
      currentLoad: agent.currentLoad,
      maxLoad: agent.maxLoad,
      severity: "medium",
      recommendation: "考虑重新分配任务或增加Agent",
    });
  }
  
  // 3. 识别依赖死锁
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const stuckTasks = pendingTasks.filter(t => 
    t.dependencies && t.dependencies.some(dep => 
      tasks.find(dt => dt.id === dep.taskId && dt.status !== "completed")
    )
  );
  
  for (const task of stuckTasks) {
    bottlenecks.push({
      type: "dependency_deadlock",
      taskId: task.id,
      taskName: task.name,
      dependencies: task.dependencies,
      severity: "high",
      recommendation: "检查依赖任务状态，考虑手动干预",
    });
  }
  
  return {
    success: true,
    bottlenecks,
    totalBottlenecks: bottlenecks.length,
    severityCounts: {
      high: bottlenecks.filter(b => b.severity === "high").length,
      medium: bottlenecks.filter(b => b.severity === "medium").length,
      low: bottlenecks.filter(b => b.severity === "low").length,
    },
  };
}

/**
 * 预警机制
 * @param {Array} tasks - 任务列表
 * @param {Object} thresholds - 阈值配置
 * @returns {Promise<Object>} 预警结果
 */
export async function triggerAlerts(tasks, thresholds = {}) {
  const defaultThresholds = {
    maxDuration: 4 * 60 * 60 * 1000, // 最大持续时间：4小时
    maxRetries: 3, // 最大重试次数
    minSuccessRate: 0.8, // 最小成功率：80%
    maxLoad: 0.9, // 最大负载：90%
  };
  
  const finalThresholds = { ...defaultThresholds, ...thresholds };
  const alerts = [];
  
  // 1. 超时预警
  const timeoutTasks = tasks.filter(t => 
    t.status === "in_progress" && 
    Date.now() - t.startTime > finalThresholds.maxDuration
  );
  
  for (const task of timeoutTasks) {
    alerts.push({
      type: "timeout",
      taskId: task.id,
      taskName: task.name,
      severity: "high",
      message: `任务 "${task.name}" 执行时间超过阈值（${(finalThresholds.maxDuration / 1000 / 60).toFixed(0)}分钟）`,
      threshold: finalThresholds.maxDuration,
    });
  }
  
  // 2. 重试次数预警
  const retryTasks = tasks.filter(t => 
    (t.retryCount || 0) >= finalThresholds.maxRetries
  );
  
  for (const task of retryTasks) {
    alerts.push({
      type: "max_retries_reached",
      taskId: task.id,
      taskName: task.name,
      severity: "high",
      message: `任务 "${task.name}" 已达到最大重试次数（${finalThresholds.maxRetries}）`,
      threshold: finalThresholds.maxRetries,
    });
  }
  
  // 3. 成功率预警
  const agentSuccessRates = calculateAgentSuccessRates(tasks);
  for (const [agentId, rate] of Object.entries(agentSuccessRates)) {
    if (rate < finalThresholds.minSuccessRate) {
      alerts.push({
        type: "low_success_rate",
        agentId,
        severity: "medium",
        message: `Agent ${agentId} 成功率（${(rate * 100).toFixed(1)}%）低于阈值（${(finalThresholds.minSuccessRate * 100).toFixed(0)}%）`,
        threshold: finalThresholds.minSuccessRate,
      });
    }
  }
  
  // 4. 负载预警
  const agentLoads = calculateAgentLoads(tasks);
  for (const [agentId, load] of Object.entries(agentLoads)) {
    if (load > finalThresholds.maxLoad) {
      alerts.push({
        type: "high_load",
        agentId,
        severity: "medium",
        message: `Agent ${agentId} 负载（${(load * 100).toFixed(1)}%）超过阈值（${(finalThresholds.maxLoad * 100).toFixed(0)}%）`,
        threshold: finalThresholds.maxLoad,
      });
    }
  }
  
  return {
    success: true,
    alerts,
    totalAlerts: alerts.length,
    severityCounts: {
      high: alerts.filter(a => a.severity === "high").length,
      medium: alerts.filter(a => a.severity === "medium").length,
      low: alerts.filter(a => a.severity === "low").length,
    },
  };
}

// ==================== 4. 动态编排 ====================

/**
 * 并行执行
 * @param {Array} tasks - 任务列表
 * @param {Array} dependencies - 依赖关系
 * @returns {Promise<Object>} 并行执行计划
 */
export async function executeParallel(tasks, dependencies = []) {
  // 1. 构建依赖图
  const dependencyGraph = {};
  for (const task of tasks) {
    dependencyGraph[task.id] = {
      task,
      dependencies: dependencies.filter(d => d.taskId === task.id).map(d => d.dependsOn),
      dependents: dependencies.filter(d => d.dependsOn === task.id).map(d => d.taskId),
    };
  }
  
  // 2. 拓扑排序（Kahn's algorithm）
  const executionPlan = [];
  const inDegree = {};
  const queue = [];
  
  // 初始化入度
  for (const taskId of Object.keys(dependencyGraph)) {
    inDegree[taskId] = dependencyGraph[taskId].dependencies.length;
    if (inDegree[taskId] === 0) {
      queue.push(taskId);
    }
  }
  
  // 拓扑排序
  while (queue.length > 0) {
    const taskId = queue.shift();
    executionPlan.push(taskId);
    
    for (const dependentId of dependencyGraph[taskId].dependents) {
      inDegree[dependentId]--;
      if (inDegree[dependentId] === 0) {
        queue.push(dependentId);
      }
    }
  }
  
  // 3. 生成并行执行批次
  const batches = [];
  const executed = new Set();
  
  while (executed.size < tasks.length) {
    const batch = [];
    
    for (const taskId of executionPlan) {
      if (executed.has(taskId)) continue;
      
      const taskDeps = dependencyGraph[taskId].dependencies;
      if (taskDeps.every(depId => executed.has(depId))) {
        batch.push(taskId);
      }
    }
    
    if (batch.length === 0) break; // 防止死循环
    
    for (const taskId of batch) {
      executed.add(taskId);
    }
    
    batches.push(batch);
  }
  
  return {
    success: true,
    executionPlan,
    parallelBatches: batches,
    totalBatches: batches.length,
    statistics: {
      totalTasks: tasks.length,
      totalBatches: batches.length,
      avgParallelism: tasks.length / batches.length,
    },
  };
}

/**
 * 资源优化
 * @param {Array} tasks - 任务列表
 * @param {Object} resources - 可用资源
 * @returns {Promise<Object>} 优化结果
 */
export async function optimizeResources(tasks, resources = {}) {
  const defaultResources = {
    maxConcurrentTasks: 5,
    maxMemory: 8 * 1024 * 1024 * 1024, // 8GB
    maxCpu: 4, // 4 cores
  };
  
  const finalResources = { ...defaultResources, ...resources };
  const optimizedPlan = [];
  
  // 1. 按资源需求分组
  const resourceGroups = {
    low: tasks.filter(t => (t.resourceRequirement || 0) < 0.3),
    medium: tasks.filter(t => (t.resourceRequirement || 0) >= 0.3 && (t.resourceRequirement || 0) < 0.7),
    high: tasks.filter(t => (t.resourceRequirement || 0) >= 0.7),
  };
  
  // 2. 生成优化计划（优先执行低资源需求任务）
  for (const [group, groupTasks] of Object.entries(resourceGroups)) {
    if (groupTasks.length === 0) continue;
    
    optimizedPlan.push({
      group,
      tasks: groupTasks.map(t => t.id),
      resourceRequirement: groupTasks.reduce((sum, t) => sum + (t.resourceRequirement || 0.5), 0),
      recommendedOrder: groupTasks.sort((a, b) => 
        (a.resourceRequirement || 0.5) - (b.resourceRequirement || 0.5)
      ).map(t => t.id),
    });
  }
  
  // 3. 计算资源利用率
  const totalResourceRequirement = tasks.reduce((sum, t) => sum + (t.resourceRequirement || 0.5), 0);
  const maxPossibleResource = finalResources.maxConcurrentTasks * 1; // 假设每个任务资源需求为1
  const utilizationRate = totalResourceRequirement / maxPossibleResource;
  
  return {
    success: true,
    optimizedPlan,
    resourceUtilization: {
      totalResourceRequirement,
      maxPossibleResource,
      utilizationRate,
      recommendation: utilizationRate > 0.8 ? "资源利用率较高，考虑增加资源" : "资源利用率正常",
    },
    statistics: {
      lowResourceTasks: resourceGroups.low.length,
      mediumResourceTasks: resourceGroups.medium.length,
      highResourceTasks: resourceGroups.high.length,
    },
  };
}

/**
 * 弹性伸缩
 * @param {Array} tasks - 任务列表
 * @param {Array} agents - 当前Agent列表
 * @param {Object} scalingPolicy - 伸缩策略
 * @returns {Promise<Object>} 伸缩结果
 */
export async function elasticScale(tasks, agents, scalingPolicy = {}) {
  const defaultPolicy = {
    scaleUpThreshold: 0.8, // 扩容阈值：负载 > 80%
    scaleDownThreshold: 0.3, // 缩容阈值：负载 < 30%
    maxAgents: 10, // 最大Agent数
    minAgents: 1, // 最小Agent数
    cooldownPeriod: 5 * 60 * 1000, // 冷却期：5分钟
  };
  
  const finalPolicy = { ...defaultPolicy, ...scalingPolicy };
  
  // 1. 计算当前负载
  const currentLoad = agents.reduce((sum, a) => sum + (a.currentLoad || 0), 0);
  const maxLoad = agents.reduce((sum, a) => sum + (a.maxLoad || 3), 0);
  const loadPercentage = maxLoad > 0 ? currentLoad / maxLoad : 0;
  
  // 2. 判断是否需要伸缩
  let action = "none";
  let targetAgentCount = agents.length;
  
  if (loadPercentage > finalPolicy.scaleUpThreshold && agents.length < finalPolicy.maxAgents) {
    action = "scale_up";
    targetAgentCount = Math.min(agents.length + 1, finalPolicy.maxAgents);
  } else if (loadPercentage < finalPolicy.scaleDownThreshold && agents.length > finalPolicy.minAgents) {
    action = "scale_down";
    targetAgentCount = Math.max(agents.length - 1, finalPolicy.minAgents);
  }
  
  // 3. 生成伸缩计划
  const scalingPlan = {
    action,
    currentAgentCount: agents.length,
    targetAgentCount,
    currentLoad,
    maxLoad,
    loadPercentage,
    reason: action === "scale_up" ? "负载过高，需要扩容" :
            action === "scale_down" ? "负载过低，需要缩容" : "负载正常，无需伸缩",
  };
  
  // 4. 模拟Agent创建/销毁
  if (action === "scale_up") {
    const newAgents = [];
    for (let i = agents.length; i < targetAgentCount; i++) {
      newAgents.push({
        id: generateId(),
        name: `agent-${i + 1}`,
        capabilities: ["code-generation", "code-review"],
        currentLoad: 0,
        maxLoad: 3,
        createdAt: Date.now(),
      });
    }
    scalingPlan.newAgents = newAgents;
  } else if (action === "scale_down") {
    const removedAgents = agents.slice(targetAgentCount);
    scalingPlan.removedAgents = removedAgents.map(a => ({
      id: a.id,
      name: a.name,
    }));
  }
  
  return {
    success: true,
    scalingPlan,
    recommendation: scalingPlan.reason,
  };
}

// ==================== 辅助函数 ====================

/**
 * 计算任务复杂度
 * @param {Object} task - 任务对象
 * @returns {number} 复杂度（0-1）
 */
function calculateComplexity(task) {
  let complexity = 0.5; // 默认中等复杂度
  
  if (task.description) {
    const complexKeywords = ["复杂", "集成", "分布式", "高并发", "微服务"];
    const simpleKeywords = ["简单", "单一", "基础", "CRUD"];
    
    for (const keyword of complexKeywords) {
      if (task.description.includes(keyword)) {
        complexity += 0.1;
      }
    }
    
    for (const keyword of simpleKeywords) {
      if (task.description.includes(keyword)) {
        complexity -= 0.1;
      }
    }
  }
  
  if (task.type === "fullstack-development") {
    complexity += 0.2;
  } else if (task.type === "code-generation") {
    complexity += 0.1;
  }
  
  return Math.max(0, Math.min(1, complexity));
}

/**
 * 估算任务持续时间
 * @param {Object} task - 任务对象
 * @returns {number} 估算持续时间（毫秒）
 */
function estimateDuration(task) {
  const baseDuration = 2 * 60 * 60 * 1000; // 基础持续时间：2小时
  
  const complexityMultiplier = 0.5 + calculateComplexity(task); // 0.5-1.5
  const typeMultiplier = 
    task.type === "fullstack-development" ? 2.0 :
    task.type === "code-generation" ? 1.5 :
    task.type === "testing" ? 1.0 :
    task.type === "documentation" ? 0.8 :
    1.0;
  
  return Math.round(baseDuration * complexityMultiplier * typeMultiplier);
}

/**
 * 识别任务所需能力
 * @param {Object} task - 任务对象
 * @returns {Array<string>} 所需能力列表
 */
function identifyRequiredCapabilities(task) {
  const capabilityMap = {
    "code-generation": ["code-generation", "debugging"],
    "code-review": ["code-review", "static-analysis"],
    "testing": ["testing", "debugging"],
    "documentation": ["documentation", "technical-writing"],
    "fullstack-development": ["code-generation", "code-review", "testing", "database"],
    "debugging": ["debugging", "log-analysis"],
  };
  
  return capabilityMap[task.type] || ["code-generation"];
}

/**
 * 计算能力匹配分数
 * @param {Object} task - 任务对象
 * @param {Object} agent - Agent对象
 * @returns {number} 匹配分数（0-1）
 */
function calculateCapabilityMatchScore(task, agent) {
  const requiredCapabilities = identifyRequiredCapabilities(task);
  const agentCapabilities = agent.capabilities || [];
  
  if (requiredCapabilities.length === 0) return 0.5;
  
  const matchedCount = requiredCapabilities.filter(cap => 
    agentCapabilities.includes(cap)
  ).length;
  
  return matchedCount / requiredCapabilities.length;
}

/**
 * 生成分析建议
 * @param {Object} analysis - 分析结果
 * @returns {Array<string>} 建议列表
 */
function generateAnalysisRecommendations(analysis) {
  const recommendations = [];
  
  if (analysis.complexity > 0.7) {
    recommendations.push("任务复杂度较高，建议拆分为多个子任务");
  }
  
  if (analysis.estimatedDuration > 4 * 60 * 60 * 1000) {
    recommendations.push("任务估算持续时间较长，建议增加资源或并行执行");
  }
  
  if (analysis.dependencies.length > 0) {
    recommendations.push(`任务有 ${analysis.dependencies.length} 个依赖，请确保依赖任务按时完成`);
  }
  
  return recommendations;
}

/**
 * 计算标准差
 * @param {Array<number>} array - 数组
 * @returns {number} 标准差
 */
function standardDeviation(array) {
  const avg = array.reduce((sum, val) => sum + val, 0) / array.length;
  const squareDiffs = array.map(val => Math.pow(val - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * 计算Agent成功率
 * @param {Array} tasks - 任务列表
 * @returns {Object} Agent成功率映射
 */
function calculateAgentSuccessRates(tasks) {
  const agentStats = {};
  
  for (const task of tasks) {
    if (!task.agentId) continue;
    
    if (!agentStats[task.agentId]) {
      agentStats[task.agentId] = { total: 0, success: 0 };
    }
    
    agentStats[task.agentId].total += 1;
    if (task.status === "completed" && task.success !== false) {
      agentStats[task.agentId].success += 1;
    }
  }
  
  const successRates = {};
  for (const [agentId, stats] of Object.entries(agentStats)) {
    successRates[agentId] = stats.total > 0 ? stats.success / stats.total : 0;
  }
  
  return successRates;
}

/**
 * 计算Agent负载
 * @param {Array} tasks - 任务列表
 * @returns {Object} Agent负载映射
 */
function calculateAgentLoads(tasks) {
  const agentLoads = {};
  
  for (const task of tasks) {
    if (!task.agentId) continue;
    
    if (!agentLoads[task.agentId]) {
      agentLoads[task.agentId] = 0;
    }
    
    agentLoads[task.agentId] += task.resourceRequirement || 0.5;
  }
  
  // 归一化到0-1
  const maxLoad = Math.max(...Object.values(agentLoads), 1);
  for (const agentId of Object.keys(agentLoads)) {
    agentLoads[agentId] = agentLoads[agentId] / maxLoad;
  }
  
  return agentLoads;
}

/**
 * 生成ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 保存子任务
 * @param {string} taskId - 任务ID
 * @param {Array} subtasks - 子任务列表
 */
async function saveSubtasks(taskId, subtasks) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `subtasks-${taskId}.json`);
  await fs.writeFile(filePath, JSON.stringify(subtasks, null, 2), "utf-8");
}

/**
 * 确保数据目录存在
 */
async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// ==================== 导出 ====================

export default {
  // 智能拆解
  analyzeTask,
  identifyDependencies,
  generateSubtasks,
  
  // 自动分配
  matchAgentCapabilities,
  balanceLoad,
  scheduleByPriority,
  
  // 进度跟踪
  trackProgress,
  identifyBottlenecks,
  triggerAlerts,
  
  // 动态编排
  executeParallel,
  optimizeResources,
  elasticScale,
};
