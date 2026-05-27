// tools/learning-loop.js
// Learning Loop Tool - 学习循环工具
// MCP Tool: harness_learning_loop

import {
  collectUserFeedback,
  collectSystemFeedback,
  collectTaskResult,
  identifySuccessPatterns,
  identifyFailurePatterns,
  identifyOptimizationOpportunities,
  tuneParameters,
  adjustStrategy,
  updateKnowledge,
  runABTest,
  compareEffectiveness,
  detectRegression,
  incrementalLearning,
  accumulateKnowledge,
  evolveCapabilities,
} from "../lib/learning-loop-engine.js";

/**
 * Tool 定义
 */
export const definition = {
  name: "harness_learning_loop",
  description: "学习循环：反馈收集、模式识别、自动改进、效果验证、持续学习",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "操作类型：collect_feedback（收集反馈）、identify_patterns（识别模式）、auto_improve（自动改进）、verify_effectiveness（效果验证）、continuous_learning（持续学习）",
        enum: ["collect_feedback", "identify_patterns", "auto_improve", "verify_effectiveness", "continuous_learning"],
      },
      // 反馈收集参数
      feedbackType: {
        type: "string",
        description: "反馈类型（collect_feedback时使用）：user（用户反馈）、system（系统反馈）、task_result（任务结果）",
        enum: ["user", "system", "task_result"],
      },
      sessionId: {
        type: "string",
        description: "会话ID",
      },
      feedback: {
        type: "object",
        description: "反馈数据（用户反馈：{ rating, comment, category, tags }；系统反馈：{ metric, performance, warnings, errors }）",
      },
      result: {
        type: "object",
        description: "任务结果（task_result时使用）：{ taskId, taskType, success, duration, tokenUsage, errorMessage, output }",
      },
      // 模式识别参数
      feedbackHistory: {
        type: "array",
        description: "反馈历史（identify_patterns时使用，格式：[{ type, ... }]）",
        items: {
          type: "object",
        },
      },
      // 自动改进参数
      currentParams: {
        type: "object",
        description: "当前参数（auto_improve时使用，格式：{ maxTokens, temperature, ... }）",
      },
      currentStrategy: {
        type: "object",
        description: "当前策略（auto_improve时使用，格式：{ preferredTaskTypes, maxRetries, ... }）",
      },
      patterns: {
        type: "object",
        description: "识别的模式（auto_improve时使用，格式：{ success: {...}, failure: {...} }）",
      },
      newKnowledge: {
        type: "array",
        description: "新知识（auto_improve时使用，格式：[{ id, topic, category, ... }]）",
        items: {
          type: "object",
        },
      },
      existingKnowledge: {
        type: "array",
        description: "现有知识（auto_improve时使用，格式：[{ id, topic, category, ... }]）",
        items: {
          type: "object",
        },
      },
      // 效果验证参数
      testName: {
        type: "string",
        description: "测试名称（verify_effectiveness时使用）",
      },
      variantA: {
        type: "object",
        description: "变体A（verify_effectiveness时使用）",
      },
      variantB: {
        type: "object",
        description: "变体B（verify_effectiveness时使用）",
      },
      metric: {
        type: "string",
        description: "对比/检测指标（verify_effectiveness时使用）",
      },
      beforeData: {
        type: "array",
        description: "改进前数据（verify_effectiveness时使用）",
        items: {
          type: "number",
        },
      },
      afterData: {
        type: "array",
        description: "改进后数据（verify_effectiveness时使用）",
        items: {
          type: "number",
        },
      },
      historicalData: {
        type: "array",
        description: "历史数据（verify_effectiveness时使用）",
        items: {
          type: "number",
        },
      },
      currentValue: {
        type: "number",
        description: "当前值（verify_effectiveness时使用）",
      },
      // 持续学习参数
      newData: {
        type: "array",
        description: "新数据（continuous_learning时使用）",
        items: {
          type: "object",
        },
      },
      currentModel: {
        type: "object",
        description: "当前模型（continuous_learning时使用）",
      },
      learningHistory: {
        type: "array",
        description: "学习历史（continuous_learning时使用）",
        items: {
          type: "object",
        },
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
    // 反馈收集
    feedbackType,
    sessionId,
    feedback,
    result,
    // 模式识别
    feedbackHistory = [],
    // 自动改进
    currentParams,
    currentStrategy,
    patterns,
    newKnowledge,
    existingKnowledge,
    // 效果验证
    testName,
    variantA,
    variantB,
    metric,
    beforeData,
    afterData,
    historicalData,
    currentValue,
    // 持续学习
    newData,
    currentModel,
    learningHistory,
  } = args;

  // 验证必需参数
  if (!action) {
    throw new Error("缺少必需参数：action");
  }

  try {
    let resultData = null;

    switch (action) {
      // ========== 1. 反馈收集 ==========
      case "collect_feedback": {
        if (!feedbackType) {
          throw new Error("collect_feedback 需要提供 feedbackType（user/system/task_result）");
        }

        if (feedbackType === "user") {
          if (!sessionId || !feedback) {
            throw new Error("collect_feedback (user) 需要提供 sessionId 和 feedback");
          }
          resultData = await collectUserFeedback(sessionId, feedback);
        } else if (feedbackType === "system") {
          if (!sessionId || !feedback) {
            throw new Error("collect_feedback (system) 需要提供 sessionId 和 feedback");
          }
          resultData = await collectSystemFeedback(sessionId, feedback);
        } else if (feedbackType === "task_result") {
          if (!sessionId || !result) {
            throw new Error("collect_feedback (task_result) 需要提供 sessionId 和 result");
          }
          resultData = await collectTaskResult(sessionId, result);
        } else {
          throw new Error(`不支持的 feedbackType：${feedbackType}`);
        }

        break;
      }

      // ========== 2. 模式识别 ==========
      case "identify_patterns": {
        if (!Array.isArray(feedbackHistory) || feedbackHistory.length === 0) {
          // 尝试从文件读取历史数据
          try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const __filename = (await import("url")).fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const dataDir = path.resolve(__dirname, "..", "data");
            const filePath = path.join(dataDir, "feedback.json");
            const content = await fs.readFile(filePath, "utf-8");
            feedbackHistory = JSON.parse(content);
          } catch {
            throw new Error("identify_patterns 需要提供 feedbackHistory 或确保 data/feedback.json 存在");
          }
        }

        const [successPatterns, failurePatterns, optimizationOpportunities] = await Promise.all([
          identifySuccessPatterns(feedbackHistory),
          identifyFailurePatterns(feedbackHistory),
          identifyOptimizationOpportunities(feedbackHistory),
        ]);

        resultData = {
          success: true,
          patterns: {
            success: successPatterns,
            failure: failurePatterns,
            optimization: optimizationOpportunities,
          },
        };

        break;
      }

      // ========== 3. 自动改进 ==========
      case "auto_improve": {
        if (!currentParams && !currentStrategy && !newKnowledge) {
          throw new Error("auto_improve 需要提供 currentParams、currentStrategy 或 newKnowledge 中的至少一个");
        }

        const improvements = [];

        if (currentParams) {
          const tuned = await tuneParameters(currentParams, feedbackHistory);
          improvements.push({
            type: "parameter_tuning",
            result: tuned,
          });
        }

        if (currentStrategy) {
          const adjusted = await adjustStrategy(currentStrategy, patterns || {});
          improvements.push({
            type: "strategy_adjustment",
            result: adjusted,
          });
        }

        if (newKnowledge && existingKnowledge) {
          const updated = await updateKnowledge(newKnowledge, existingKnowledge);
          improvements.push({
            type: "knowledge_update",
            result: updated,
          });
        }

        resultData = {
          success: true,
          improvements,
          totalImprovements: improvements.length,
        };

        break;
      }

      // ========== 4. 效果验证 ==========
      case "verify_effectiveness": {
        if (!testName && !metric) {
          throw new Error("verify_effectiveness 需要提供 testName（A/B测试）或 metric（效果对比/回归检测）");
        }

        const verifications = [];

        // A/B 测试
        if (testName && variantA && variantB) {
          const abTest = await runABTest(testName, variantA, variantB, feedbackHistory);
          verifications.push({
            type: "ab_test",
            result: abTest,
          });
        }

        // 效果对比
        if (metric && beforeData && afterData) {
          const comparison = await compareEffectiveness(metric, beforeData, afterData);
          verifications.push({
            type: "comparison",
            result: comparison,
          });
        }

        // 回归检测
        if (metric && historicalData && currentValue !== undefined) {
          const regression = await detectRegression(metric, historicalData, currentValue);
          verifications.push({
            type: "regression_detection",
            result: regression,
          });
        }

        if (verifications.length === 0) {
          throw new Error("verify_effectiveness 无法执行任何验证，请检查参数");
        }

        resultData = {
          success: true,
          verifications,
          totalVerifications: verifications.length,
        };

        break;
      }

      // ========== 5. 持续学习 ==========
      case "continuous_learning": {
        if (!newData && !feedbackHistory && !learningHistory) {
          throw new Error("continuous_learning 需要提供 newData、feedbackHistory 或 learningHistory 中的至少一个");
        }

        const learnings = [];

        // 增量学习
        if (newData && currentModel) {
          const incremental = await incrementalLearning(newData, currentModel);
          learnings.push({
            type: "incremental_learning",
            result: incremental,
          });
        }

        // 知识积累
        if (Array.isArray(feedbackHistory) && feedbackHistory.length > 0) {
          const accumulation = await accumulateKnowledge(feedbackHistory);
          learnings.push({
            type: "knowledge_accumulation",
            result: accumulation,
          });
        }

        // 能力进化
        if (learningHistory && learningHistory.length > 0) {
          const evolution = await evolveCapabilities(learningHistory);
          learnings.push({
            type: "capability_evolution",
            result: evolution,
          });
        }

        resultData = {
          success: true,
          learnings,
          totalLearnings: learnings.length,
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
