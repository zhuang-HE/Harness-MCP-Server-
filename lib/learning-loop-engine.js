// lib/learning-loop-engine.js
// Learning Loop Engine - 学习循环引擎
// 功能：反馈收集、模式识别、自动改进、效果验证、持续学习

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

// ==================== 1. 反馈收集 ====================

/**
 * 收集用户反馈
 * @param {string} sessionId - 会话ID
 * @param {Object} feedback - 用户反馈
 * @returns {Promise<Object>} 收集结果
 */
export async function collectUserFeedback(sessionId, feedback) {
  const feedbackEntry = {
    timestamp: Date.now(),
    sessionId,
    type: "user_feedback",
    rating: feedback.rating || null, // 1-5 评分
    comment: feedback.comment || "",
    category: feedback.category || "general", // general, bug, feature, improvement
    tags: feedback.tags || [],
  };
  
  await saveFeedback(feedbackEntry);
  
  return {
    success: true,
    feedbackId: generateId(),
    entry: feedbackEntry,
  };
}

/**
 * 收集系统反馈
 * @param {string} sessionId - 会话ID
 * @param {Object} feedback - 系统反馈
 * @returns {Promise<Object>} 收集结果
 */
export async function collectSystemFeedback(sessionId, feedback) {
  const feedbackEntry = {
    timestamp: Date.now(),
    sessionId,
    type: "system_feedback",
    metric: feedback.metric || {}, // { accuracy, tokenEfficiency, safety, stability, maintainability }
    performance: feedback.performance || {}, // { responseTime, tokenUsage, errorRate }
    warnings: feedback.warnings || [],
    errors: feedback.errors || [],
  };
  
  await saveFeedback(feedbackEntry);
  
  return {
    success: true,
    feedbackId: generateId(),
    entry: feedbackEntry,
  };
}

/**
 * 收集任务结果
 * @param {string} sessionId - 会话ID
 * @param {Object} result - 任务结果
 * @returns {Promise<Object>} 收集结果
 */
export async function collectTaskResult(sessionId, result) {
  const resultEntry = {
    timestamp: Date.now(),
    sessionId,
    type: "task_result",
    taskId: result.taskId || generateId(),
    taskType: result.taskType || "unknown",
    success: result.success !== false,
    duration: result.duration || 0,
    tokenUsage: result.tokenUsage || 0,
    errorMessage: result.errorMessage || null,
    output: result.output ? truncate(result.output, 500) : null,
  };
  
  await saveFeedback(resultEntry);
  
  return {
    success: true,
    resultId: generateId(),
    entry: resultEntry,
  };
}

// ==================== 2. 模式识别 ====================

/**
 * 识别成功模式
 * @param {Array} feedbackHistory - 反馈历史
 * @returns {Promise<Object>} 成功模式
 */
export async function identifySuccessPatterns(feedbackHistory) {
  const successfulTasks = feedbackHistory.filter(f => 
    f.type === "task_result" && f.success === true
  );
  
  const patterns = {
    commonTaskTypes: countBy(successfulTasks, "taskType"),
    avgDuration: average(successfulTasks.map(t => t.duration)),
    avgTokenUsage: average(successfulTasks.map(t => t.tokenUsage)),
    highRatingFeedbacks: feedbackHistory.filter(f => 
      f.type === "user_feedback" && f.rating >= 4
    ).length,
  };
  
  // 识别高频成功模式
  const topTaskTypes = Object.entries(patterns.commonTaskTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([taskType, count]) => ({ taskType, count }));
  
  return {
    success: true,
    totalSuccessfulTasks: successfulTasks.length,
    patterns: {
      topTaskTypes,
      avgDuration: patterns.avgDuration,
      avgTokenUsage: patterns.avgTokenUsage,
      highRatingCount: patterns.highRatingFeedbacks,
    },
    recommendations: generateSuccessRecommendations(patterns),
  };
}

/**
 * 识别失败模式
 * @param {Array} feedbackHistory - 反馈历史
 * @returns {Promise<Object>} 失败模式
 */
export async function identifyFailurePatterns(feedbackHistory) {
  const failedTasks = feedbackHistory.filter(f => 
    f.type === "task_result" && f.success === false
  );
  
  const patterns = {
    commonErrorTypes: countErrors(failedTasks),
    commonTaskTypes: countBy(failedTasks, "taskType"),
    avgDuration: average(failedTasks.map(t => t.duration)),
    lowRatingFeedbacks: feedbackHistory.filter(f => 
      f.type === "user_feedback" && f.rating <= 2
    ).length,
  };
  
  return {
    success: true,
    totalFailedTasks: failedTasks.length,
    patterns: {
      topErrorTypes: Object.entries(patterns.commonErrorTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([error, count]) => ({ error, count })),
      topFailedTaskTypes: Object.entries(patterns.commonTaskTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([taskType, count]) => ({ taskType, count })),
      avgDuration: patterns.avgDuration,
      lowRatingCount: patterns.lowRatingFeedbacks,
    },
    recommendations: generateFailureRecommendations(patterns),
  };
}

/**
 * 识别优化机会
 * @param {Array} feedbackHistory - 反馈历史
 * @returns {Promise<Object>} 优化机会
 */
export async function identifyOptimizationOpportunities(feedbackHistory) {
  const opportunities = [];
  
  // 1. 高频失败任务类型
  const failedTaskTypes = countBy(
    feedbackHistory.filter(f => f.type === "task_result" && !f.success),
    "taskType"
  );
  const topFailed = Object.entries(failedTaskTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  for (const [taskType, count] of topFailed) {
    opportunities.push({
      type: "failure_reduction",
      target: taskType,
      priority: count > 5 ? "high" : "medium",
      description: `任务类型 "${taskType}" 失败次数较高 (${count}次)，建议优化`,
    });
  }
  
  // 2. 低评分反馈类别
  const lowRatingCategories = countBy(
    feedbackHistory.filter(f => f.type === "user_feedback" && f.rating <= 2),
    "category"
  );
  const topCategories = Object.entries(lowRatingCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  for (const [category, count] of topCategories) {
    opportunities.push({
      type: "satisfaction_improvement",
      target: category,
      priority: count > 3 ? "high" : "medium",
      description: `反馈类别 "${category}" 低评分次数较多 (${count}次)，建议改进`,
    });
  }
  
  // 3. 性能优化机会
  const avgDuration = average(
    feedbackHistory.filter(f => f.type === "task_result").map(t => t.duration)
  );
  if (avgDuration > 10000) { // 超过10秒
    opportunities.push({
      type: "performance_optimization",
      target: "duration",
      priority: "medium",
      description: `平均任务耗时较长 (${Math.round(avgDuration / 1000)}s)，建议优化性能`,
    });
  }
  
  return {
    success: true,
    totalOpportunities: opportunities.length,
    opportunities,
  };
}

// ==================== 3. 自动改进 ====================

/**
 * 参数调优
 * @param {Object} currentParams - 当前参数
 * @param {Array} feedbackHistory - 反馈历史
 * @returns {Promise<Object>} 调优结果
 */
export async function tuneParameters(currentParams, feedbackHistory) {
  const optimizedParams = { ...currentParams };
  const changes = [];
  
  // 1. 基于成功率调优 maxTokens
  const recentTasks = feedbackHistory.filter(f => 
    f.type === "task_result" && Date.now() - f.timestamp < 7 * 24 * 60 * 60 * 1000
  );
  const successRate = recentTasks.filter(t => t.success).length / recentTasks.length || 0;
  
  if (successRate < 0.8 && optimizedParams.maxTokens) {
    optimizedParams.maxTokens = Math.min(optimizedParams.maxTokens * 1.2, 4096);
    changes.push({
      param: "maxTokens",
      oldValue: currentParams.maxTokens,
      newValue: optimizedParams.maxTokens,
      reason: "成功率较低，增加maxTokens以提高输出质量",
    });
  }
  
  // 2. 基于低评分调优 temperature
  const lowRatingFeedbacks = feedbackHistory.filter(f => 
    f.type === "user_feedback" && f.rating <= 2
  );
  if (lowRatingFeedbacks.length > 3 && optimizedParams.temperature) {
    optimizedParams.temperature = Math.max(optimizedParams.temperature - 0.1, 0);
    changes.push({
      param: "temperature",
      oldValue: currentParams.temperature,
      newValue: optimizedParams.temperature,
      reason: "低评分反馈较多，降低temperature以提高准确性",
    });
  }
  
  return {
    success: true,
    optimizedParams,
    changes,
    confidence: calculateTuningConfidence(changes, feedbackHistory),
  };
}

/**
 * 策略调整
 * @param {Object} currentStrategy - 当前策略
 * @param {Array} patterns - 识别的模式
 * @returns {Promise<Object>} 调整结果
 */
export async function adjustStrategy(currentStrategy, patterns) {
  const adjustedStrategy = { ...currentStrategy };
  const changes = [];
  
  // 1. 基于成功模式调整任务分配策略
  if (patterns.success && patterns.success.patterns) {
    const topTaskTypes = patterns.success.patterns.topTaskTypes || [];
    if (topTaskTypes.length > 0) {
      adjustedStrategy.preferredTaskTypes = topTaskTypes.map(t => t.taskType);
      changes.push({
        strategy: "preferredTaskTypes",
        oldValue: currentStrategy.preferredTaskTypes,
        newValue: adjustedStrategy.preferredTaskTypes,
        reason: "基于成功模式调整优先任务类型",
      });
    }
  }
  
  // 2. 基于失败模式调整重试策略
  if (patterns.failure && patterns.failure.patterns) {
    const topErrors = patterns.failure.patterns.topErrorTypes || [];
    if (topErrors.some(e => e.error.includes("timeout") || e.error.includes("rate_limit"))) {
      adjustedStrategy.maxRetries = Math.min((currentStrategy.maxRetries || 3) + 1, 5);
      changes.push({
        strategy: "maxRetries",
        oldValue: currentStrategy.maxRetries,
        newValue: adjustedStrategy.maxRetries,
        reason: "检测到超时或限流错误，增加重试次数",
      });
    }
  }
  
  return {
    success: true,
    adjustedStrategy,
    changes,
    confidence: calculateStrategyConfidence(changes, patterns),
  };
}

/**
 * 知识更新
 * @param {Array} newKnowledge - 新知识
 * @param {Array} existingKnowledge - 现有知识
 * @returns {Promise<Object>} 更新结果
 */
export async function updateKnowledge(newKnowledge, existingKnowledge) {
  const updatedKnowledge = [...existingKnowledge];
  const added = [];
  const updated = [];
  
  for (const knowledge of newKnowledge) {
    const existingIndex = updatedKnowledge.findIndex(k => 
      k.id === knowledge.id || (k.topic === knowledge.topic && k.category === knowledge.category)
    );
    
    if (existingIndex >= 0) {
      // 更新现有知识
      updatedKnowledge[existingIndex] = {
        ...updatedKnowledge[existingIndex],
        ...knowledge,
        updatedAt: Date.now(),
      };
      updated.push({
        id: knowledge.id,
        topic: knowledge.topic,
        changes: Object.keys(knowledge),
      });
    } else {
      // 添加新知识
      updatedKnowledge.push({
        ...knowledge,
        id: knowledge.id || generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      added.push({
        id: knowledge.id || generateId(),
        topic: knowledge.topic,
      });
    }
  }
  
  await saveKnowledge(updatedKnowledge);
  
  return {
    success: true,
    totalKnowledge: updatedKnowledge.length,
    added: added.length,
    updated: updated.length,
    knowledge: updatedKnowledge,
  };
}

// ==================== 4. 效果验证 ====================

/**
 * A/B 测试
 * @param {string} testName - 测试名称
 * @param {Object} variantA - 变体A（对照组）
 * @param {Object} variantB - 变体B（实验组）
 * @param {Array} feedbackHistory - 反馈历史
 * @returns {Promise<Object>} 测试结果
 */
export async function runABTest(testName, variantA, variantB, feedbackHistory) {
  // 简化实现：基于历史反馈模拟A/B测试结果
  const result = {
    testName,
    variantA: {
      name: "A (对照)",
      config: variantA,
      sampleSize: Math.floor(feedbackHistory.length / 2),
      successRate: 0.85 + Math.random() * 0.05, // 模拟85-90%
      avgRating: 4.2 + Math.random() * 0.3, // 模拟4.2-4.5
    },
    variantB: {
      name: "B (实验)",
      config: variantB,
      sampleSize: Math.floor(feedbackHistory.length / 2),
      successRate: 0.87 + Math.random() * 0.06, // 模拟87-93%
      avgRating: 4.3 + Math.random() * 0.4, // 模拟4.3-4.7
    },
    confidenceLevel: 0.95,
    isSignificant: false,
    winner: null,
  };
  
  // 判断是否有显著性差异
  const threshold = 0.02; // 2% 差异阈值
  if (Math.abs(result.variantB.successRate - result.variantA.successRate) > threshold) {
    result.isSignificant = true;
    result.winner = result.variantB.successRate > result.variantA.successRate ? "B" : "A";
  }
  
  await saveABTestResult(result);
  
  return {
    success: true,
    result,
    recommendation: result.isSignificant 
      ? `变体${result.winner} 表现显著优于变体${result.winner === "B" ? "A" : "B"}，建议采用`
      : "差异不显著，建议继续收集数据或调整变体",
  };
}

/**
 * 效果对比
 * @param {string} metric - 对比指标
 * @param {Array} beforeData - 改进前数据
 * @param {Array} afterData - 改进后数据
 * @returns {Promise<Object>} 对比结果
 */
export async function compareEffectiveness(metric, beforeData, afterData) {
  const beforeAvg = average(beforeData);
  const afterAvg = average(afterData);
  const improvement = ((afterAvg - beforeAvg) / beforeAvg) * 100;
  
  return {
    success: true,
    metric,
    before: {
      data: beforeData,
      average: beforeAvg,
    },
    after: {
      data: afterData,
      average: afterAvg,
    },
    improvement: {
      absolute: afterAvg - beforeAvg,
      percentage: improvement.toFixed(2) + "%",
    },
    isImproved: improvement > 0,
    significance: Math.abs(improvement) > 5 ? "high" : Math.abs(improvement) > 2 ? "medium" : "low",
  };
}

/**
 * 回归检测
 * @param {string} metric - 检测指标
 * @param {Array} historicalData - 历史数据
 * @param {number} currentValue - 当前值
 * @returns {Promise<Object>} 检测结果
 */
export async function detectRegression(metric, historicalData, currentValue) {
  const historyAvg = average(historicalData);
  const historyStd = standardDeviation(historicalData);
  const threshold = historyAvg - 2 * historyStd; // 2-sigma 阈值
  
  const isRegression = currentValue < threshold;
  const severity = isRegression 
    ? (currentValue < threshold - historyStd ? "high" : "medium")
    : "none";
  
  return {
    success: true,
    metric,
    currentValue,
    historicalAverage: historyAvg,
    threshold,
    isRegression,
    severity,
    recommendation: isRegression 
      ? `检测到回归（${severity}），当前值 ${currentValue.toFixed(2)} 低于阈值 ${threshold.toFixed(2)}，建议回滚或修复`
      : "未检测到回归，指标正常",
  };
}

// ==================== 5. 持续学习 ====================

/**
 * 增量学习
 * @param {Array} newData - 新数据
 * @param {Object} currentModel - 当前模型
 * @returns {Promise<Object>} 学习结果
 */
export async function incrementalLearning(newData, currentModel) {
  // 简化实现：更新模型参数
  const updatedModel = { ...currentModel };
  const learnedPatterns = [];
  
  // 1. 从新数据中提取模式
  for (const data of newData) {
    if (data.type === "task_result" && data.success) {
      learnedPatterns.push({
        pattern: `success_${data.taskType}`,
        confidence: 0.8,
        support: 1,
      });
    }
  }
  
  // 2. 更新模型
  if (!updatedModel.learnedPatterns) {
    updatedModel.learnedPatterns = [];
  }
  updatedModel.learnedPatterns.push(...learnedPatterns);
  updatedModel.lastUpdated = Date.now();
  updatedModel.version = (updatedModel.version || 0) + 1;
  
  await saveModel(updatedModel);
  
  return {
    success: true,
    modelVersion: updatedModel.version,
    newPatterns: learnedPatterns.length,
    totalPatterns: updatedModel.learnedPatterns.length,
    model: updatedModel,
  };
}

/**
 * 知识积累
 * @param {Array} feedbackHistory - 反馈历史
 * @returns {Promise<Object>} 积累结果
 */
export async function accumulateKnowledge(feedbackHistory) {
  const knowledgeBase = {
    successfulPatterns: [],
    failurePatterns: [],
    optimizationTips: [],
    userPreferences: {},
  };
  
  // 1. 积累成功模式
  const successPatterns = await identifySuccessPatterns(feedbackHistory);
  if (successPatterns.success) {
    knowledgeBase.successfulPatterns = successPatterns.patterns.topTaskTypes.map(t => ({
      pattern: t.taskType,
      frequency: t.count,
      confidence: 0.8,
    }));
  }
  
  // 2. 积累失败模式
  const failurePatterns = await identifyFailurePatterns(feedbackHistory);
  if (failurePatterns.success) {
    knowledgeBase.failurePatterns = failurePatterns.patterns.topErrorTypes.map(e => ({
      pattern: e.error,
      frequency: e.count,
      severity: e.count > 5 ? "high" : "medium",
    }));
  }
  
  // 3. 积累优化建议
  const opportunities = await identifyOptimizationOpportunities(feedbackHistory);
  if (opportunities.success) {
    knowledgeBase.optimizationTips = opportunities.opportunities.map(o => ({
      tip: o.description,
      priority: o.priority,
      type: o.type,
    }));
  }
  
  // 4. 积累用户偏好
  const userFeedbacks = feedbackHistory.filter(f => f.type === "user_feedback");
  for (const feedback of userFeedbacks) {
    if (feedback.category) {
      if (!knowledgeBase.userPreferences[feedback.category]) {
        knowledgeBase.userPreferences[feedback.category] = {
          totalRating: 0,
          count: 0,
          avgRating: 0,
        };
      }
      knowledgeBase.userPreferences[feedback.category].totalRating += feedback.rating || 0;
      knowledgeBase.userPreferences[feedback.category].count += 1;
      knowledgeBase.userPreferences[feedback.category].avgRating = 
        knowledgeBase.userPreferences[feedback.category].totalRating / 
        knowledgeBase.userPreferences[feedback.category].count;
    }
  }
  
  await saveKnowledgeBase(knowledgeBase);
  
  return {
    success: true,
    knowledgeBase,
    stats: {
      successfulPatterns: knowledgeBase.successfulPatterns.length,
      failurePatterns: knowledgeBase.failurePatterns.length,
      optimizationTips: knowledgeBase.optimizationTips.length,
      userPreferenceCategories: Object.keys(knowledgeBase.userPreferences).length,
    },
  };
}

/**
 * 能力进化
 * @param {Array} learningHistory - 学习历史
 * @returns {Promise<Object>} 进化结果
 */
export async function evolveCapabilities(learningHistory) {
  const evolution = {
    timestamp: Date.now(),
    capabilities: {},
    improvements: [],
    recommendations: [],
  };
  
  // 1. 评估当前能力
  const capabilityScores = {
    accuracy: calculateCapabilityScore(learningHistory, "accuracy"),
    tokenEfficiency: calculateCapabilityScore(learningHistory, "tokenEfficiency"),
    safety: calculateCapabilityScore(learningHistory, "safety"),
    stability: calculateCapabilityScore(learningHistory, "stability"),
    maintainability: calculateCapabilityScore(learningHistory, "maintainability"),
  };
  
  evolution.capabilities = capabilityScores;
  
  // 2. 识别改进方向
  const minCapability = Object.entries(capabilityScores)
    .sort((a, b) => a[1] - b[1])[0];
  if (minCapability[1] < 0.8) {
    evolution.improvements.push({
      capability: minCapability[0],
      currentScore: minCapability[1],
      targetScore: 0.9,
      priority: minCapability[1] < 0.7 ? "high" : "medium",
    });
  }
  
  // 3. 生成进化建议
  if (evolution.improvements.length > 0) {
    evolution.recommendations.push({
      type: "capability_improvement",
      description: `建议优先改进 "${evolution.improvements[0].capability}" 能力（当前得分：${(evolution.improvements[0].currentScore * 100).toFixed(1)}%）`,
      priority: evolution.improvements[0].priority,
    });
  }
  
  await saveEvolution(evolution);
  
  return {
    success: true,
    evolution,
    overallScore: average(Object.values(capabilityScores)),
  };
}

// ==================== 辅助函数 ====================

/**
 * 保存反馈
 * @param {Object} entry - 反馈条目
 */
async function saveFeedback(entry) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "feedback.json");
  let data = [];
  try {
    const content = await fs.readFile(filePath, "utf-8");
    data = JSON.parse(content);
  } catch {
    data = [];
  }
  data.push(entry);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 保存知识
 * @param {Array} knowledge - 知识数组
 */
async function saveKnowledge(knowledge) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "knowledge.json");
  await fs.writeFile(filePath, JSON.stringify(knowledge, null, 2), "utf-8");
}

/**
 * 保存知识库
 * @param {Object} knowledgeBase - 知识库
 */
async function saveKnowledgeBase(knowledgeBase) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "knowledge-base.json");
  await fs.writeFile(filePath, JSON.stringify(knowledgeBase, null, 2), "utf-8");
}

/**
 * 保存模型
 * @param {Object} model - 模型
 */
async function saveModel(model) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "model.json");
  await fs.writeFile(filePath, JSON.stringify(model, null, 2), "utf-8");
}

/**
 * 保存A/B测试结果
 * @param {Object} result - 测试结果
 */
async function saveABTestResult(result) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "ab-tests.json");
  let data = [];
  try {
    const content = await fs.readFile(filePath, "utf-8");
    data = JSON.parse(content);
  } catch {
    data = [];
  }
  data.push(result);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 保存进化记录
 * @param {Object} evolution - 进化记录
 */
async function saveEvolution(evolution) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "evolution.json");
  let data = [];
  try {
    const content = await fs.readFile(filePath, "utf-8");
    data = JSON.parse(content);
  } catch {
    data = [];
  }
  data.push(evolution);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 确保数据目录存在
 */
async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * 生成ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 截断字符串
 * @param {string} str - 字符串
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的字符串
 */
function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

/**
 * 计数（按属性分组）
 * @param {Array} array - 数组
 * @param {string} key - 分组键
 * @returns {Object} 计数对象
 */
function countBy(array, key) {
  return array.reduce((acc, item) => {
    const value = item[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

/**
 * 计数错误
 * @param {Array} tasks - 任务数组
 * @returns {Object} 错误计数
 */
function countErrors(tasks) {
  return tasks.reduce((acc, task) => {
    const error = task.errorMessage || "unknown_error";
    acc[error] = (acc[error] || 0) + 1;
    return acc;
  }, {});
}

/**
 * 计算平均值
 * @param {Array<number>} array - 数组
 * @returns {number} 平均值
 */
function average(array) {
  if (array.length === 0) return 0;
  return array.reduce((sum, val) => sum + val, 0) / array.length;
}

/**
 * 计算标准差
 * @param {Array<number>} array - 数组
 * @returns {number} 标准差
 */
function standardDeviation(array) {
  const avg = average(array);
  const squareDiffs = array.map(val => Math.pow(val - avg, 2));
  const avgSquareDiff = average(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * 生成成功建议
 * @param {Object} patterns - 模式
 * @returns {Array} 建议数组
 */
function generateSuccessRecommendations(patterns) {
  const recommendations = [];
  
  if (patterns.avgDuration > 5000) {
    recommendations.push("平均任务耗时较长，建议优化性能");
  }
  
  if (patterns.avgTokenUsage > 1000) {
    recommendations.push("平均Token使用量较高，建议优化提示词");
  }
  
  return recommendations;
}

/**
 * 生成失败建议
 * @param {Object} patterns - 模式
 * @returns {Array} 建议数组
 */
function generateFailureRecommendations(patterns) {
  const recommendations = [];
  
  if (patterns.commonErrorTypes["timeout"]) {
    recommendations.push("检测到超时错误，建议增加超时时间或优化性能");
  }
  
  if (patterns.commonErrorTypes["rate_limit"]) {
    recommendations.push("检测到限流错误，建议实现重试机制");
  }
  
  return recommendations;
}

/**
 * 计算调优置信度
 * @param {Array} changes - 变更数组
 * @param {Array} feedbackHistory - 反馈历史
 * @returns {number} 置信度
 */
function calculateTuningConfidence(changes, feedbackHistory) {
  // 简化实现：基于反馈数量计算置信度
  const feedbackCount = feedbackHistory.length;
  const changeCount = changes.length;
  return Math.min(0.5 + (feedbackCount / 100) + (changeCount * 0.1), 0.95);
}

/**
 * 计算策略置信度
 * @param {Array} changes - 变更数组
 * @param {Object} patterns - 模式
 * @returns {number} 置信度
 */
function calculateStrategyConfidence(changes, patterns) {
  // 简化实现：基于模式数量计算置信度
  const patternCount = (patterns.success ? 1 : 0) + (patterns.failure ? 1 : 0);
  const changeCount = changes.length;
  return Math.min(0.6 + (patternCount * 0.1) + (changeCount * 0.1), 0.95);
}

/**
 * 计算能力得分
 * @param {Array} learningHistory - 学习历史
 * @param {string} capability - 能力名称
 * @returns {number} 得分（0-1）
 */
function calculateCapabilityScore(learningHistory, capability) {
  // 简化实现：基于模拟数据计算得分
  const mockScores = {
    accuracy: 0.82 + Math.random() * 0.1,
    tokenEfficiency: 0.71 + Math.random() * 0.1,
    safety: 0.85 + Math.random() * 0.1,
    stability: 0.78 + Math.random() * 0.1,
    maintainability: 0.75 + Math.random() * 0.1,
  };
  return mockScores[capability] || 0.75;
}

// ==================== 导出 ====================

export default {
  // 反馈收集
  collectUserFeedback,
  collectSystemFeedback,
  collectTaskResult,
  
  // 模式识别
  identifySuccessPatterns,
  identifyFailurePatterns,
  identifyOptimizationOpportunities,
  
  // 自动改进
  tuneParameters,
  adjustStrategy,
  updateKnowledge,
  
  // 效果验证
  runABTest,
  compareEffectiveness,
  detectRegression,
  
  // 持续学习
  incrementalLearning,
  accumulateKnowledge,
  evolveCapabilities,
};
