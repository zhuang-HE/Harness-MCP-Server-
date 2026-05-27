// tools/task-orchestrator.js
// Task Orchestrator Tool - 任务编排器工具
// MCP Tool: harness_task_orchestrate

import {
  analyzeTask,
  identifyDependencies,
  generateSubtasks,
  matchAgentCapabilities,
  balanceLoad,
  scheduleByPriority,
  trackProgress,
  identifyBottlenecks,
  triggerAlerts,
  executeParallel,
  optimizeResources,
  elasticScale,
} from "../lib/task-orchestrator-engine.js";

/**
 * Tool 定义
 */
export const definition = {
  name: "harness_task_orchestrator",
  description: "任务编排器：智能拆解、自动分配、进度跟踪、动态编排",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "操作类型：intelligent_decomposition（智能拆解）、auto_assignment（自动分配）、progress_tracking（进度跟踪）、dynamic_orchestration（动态编排）",
        enum: ["intelligent_decomposition", "auto_assignment", "progress_tracking", "dynamic_orchestration"],
      },
      // 智能拆解参数
      task: {
        type: "object",
        description: "任务对象（intelligent_decomposition时使用，格式：{ id, type, description }）",
      },
      existingTasks: {
        type: "array",
        description: "现有任务列表（intelligent_decomposition时使用）",
        items: {
          type: "object",
        },
      },
      // 自动分配参数
      agents: {
        type: "array",
        description: "可用Agent列表（auto_assignment时使用，格式：[{ id, name, capabilities, currentLoad, maxLoad }]）",
        items: {
          type: "object",
        },
      },
      tasks: {
        type: "array",
        description: "待分配任务列表（auto_assignment时使用）",
        items: {
          type: "object",
        },
      },
      strategy: {
        type: "object",
        description: "调度策略（auto_assignment时使用，格式：{ preemption, agingFactor, capabilityWeight, loadWeight }）",
      },
      // 进度跟踪参数
      taskId: {
        type: "string",
        description: "任务ID（progress_tracking时使用）",
      },
      subtasks: {
        type: "array",
        description: "子任务列表（progress_tracking时使用）",
        items: {
          type: "object",
        },
      },
      thresholds: {
        type: "object",
        description: "阈值配置（progress_tracking时使用，格式：{ maxDuration, maxRetries, minSuccessRate, maxLoad }）",
      },
      // 动态编排参数
      dependencies: {
        type: "array",
        description: "依赖关系（dynamic_orchestration时使用，格式：[{ taskId, dependsOn }]）",
        items: {
          type: "object",
        },
      },
      resources: {
        type: "object",
        description: "可用资源（dynamic_orchestration时使用，格式：{ maxConcurrentTasks, maxMemory, maxCpu }）",
      },
      scalingPolicy: {
        type: "object",
        description: "伸缩策略（dynamic_orchestration时使用，格式：{ scaleUpThreshold, scaleDownThreshold, maxAgents, minAgents, cooldownPeriod }）",
      },
    },
    required: ["action"],
  },
};

/**
 * Tool 处理器
 */
export async function handler(args) {
  const {
    action,
    // 智能拆解
    task,
    existingTasks = [],
    // 自动分配
    agents = [],
    tasks = [],
    strategy = {},
    // 进度跟踪
    taskId,
    subtasks = [],
    thresholds = {},
    // 动态编排
    dependencies = [],
    resources = {},
    scalingPolicy = {},
  } = args;

  // 验证必需参数
  if (!action) {
    throw new Error("缺少必需参数：action");
  }

  try {
    let resultData = null;

    switch (action) {
      // ========== 1. 智能拆解 ==========
      case "intelligent_decomposition": {
        if (!task) {
          throw new Error("intelligent_decomposition 需要提供 task");
        }

        const [analysis, deps, subtasksResult] = await Promise.all([
          analyzeTask(task),
          identifyDependencies(task, existingTasks),
          generateSubtasks(task, (await analyzeTask(task)).analysis),
        ]);

        resultData = {
          success: true,
          decomposition: {
            analysis: analysis.analysis,
            dependencies: deps.dependencies,
            subtasks: subtasksResult.subtasks,
            recommendations: analysis.recommendations,
          },
        };

        break;
      }

      // ========== 2. 自动分配 ==========
      case "auto_assignment": {
        if (!Array.isArray(agents) || agents.length === 0) {
          throw new Error("auto_assignment 需要提供 agents（非空数组）");
        }

        const results = {};

        // 2.1 Agent能力匹配
        if (tasks.length > 0) {
          const matches = [];
          for (const t of tasks) {
            const matchResult = await matchAgentCapabilities(t, agents);
            matches.push(matchResult);
          }
          results.capabilityMatches = matches;
        }

        // 2.2 负载均衡
        if (tasks.length > 0) {
          const balanceResult = await balanceLoad(agents, tasks);
          results.loadBalance = balanceResult;
        }

        // 2.3 优先级调度
        if (tasks.length > 0) {
          const scheduleResult = await scheduleByPriority(tasks, strategy);
          results.prioritySchedule = scheduleResult;
        }

        resultData = {
          success: true,
          assignment: results,
          totalAgents: agents.length,
          totalTasks: tasks.length,
        };

        break;
      }

      // ========== 3. 进度跟踪 ==========
      case "progress_tracking": {
        const results = {};

        // 3.1 实时进度
        if (taskId && Array.isArray(subtasks) && subtasks.length > 0) {
          const progressResult = await trackProgress(taskId, subtasks);
          results.progress = progressResult;
        }

        // 3.2 瓶颈识别（需要tasks和agents）
        if (Array.isArray(tasks) && tasks.length > 0 && Array.isArray(agents) && agents.length > 0) {
          const bottlenecksResult = await identifyBottlenecks(tasks, agents);
          results.bottlenecks = bottlenecksResult;
        }

        // 3.3 预警机制
        if (Array.isArray(tasks) && tasks.length > 0) {
          const alertsResult = await triggerAlerts(tasks, thresholds);
          results.alerts = alertsResult;
        }

        resultData = {
          success: true,
          tracking: results,
        };

        break;
      }

      // ========== 4. 动态编排 ==========
      case "dynamic_orchestration": {
        const results = {};

        // 4.1 并行执行
        if (Array.isArray(tasks) && tasks.length > 0) {
          const parallelResult = await executeParallel(tasks, dependencies);
          results.parallelExecution = parallelResult;
        }

        // 4.2 资源优化
        if (Array.isArray(tasks) && tasks.length > 0) {
          const optimizationResult = await optimizeResources(tasks, resources);
          results.resourceOptimization = optimizationResult;
        }

        // 4.3 弹性伸缩
        if (Array.isArray(agents) && agents.length > 0) {
          const scalingResult = await elasticScale(tasks, agents, scalingPolicy);
          results.elasticScaling = scalingResult;
        }

        resultData = {
          success: true,
          orchestration: results,
        };

        break;
      }

      default:
        throw new Error(`不支持的 action：${action}`);
    }

    return resultData;
  } catch (error) {
    // 让错误冒泡到 index.js 处理
    throw error;
  }
}
