/**
 * Harness MCP Server - eval-framework Tool (D8: eval-framework)
 * 
 * MCP Tool：五维评测 + CI门禁 + 性能基准
 */

import { evaluate, generateEvalReport } from '../lib/eval-engine.js';
import { runCIGate, generateCIGateReport } from '../lib/ci-gate.js';
import { runBenchmark, generateBenchmarkReport } from '../lib/benchmark.js';

// Tool定义：harness_eval_run（五维评测）
export const evalRunDefinition = {
  name: 'harness_eval_run',
  description: '执行五维评测（准确性/Token效率/安全性/稳定性/可维护性），返回评测结果',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: '任务描述或任务ID'
      },
      result: {
        type: 'string',
        description: '任务执行结果（用于评估准确性）'
      },
      expected: {
        type: 'string',
        description: '预期结果（用于评估准确性）'
      },
      inputTokens: {
        type: 'number',
        description: '输入Token数（用于评估Token效率）'
      },
      outputTokens: {
        type: 'number',
        description: '输出Token数（用于评估Token效率）'
      },
      taskComplexity: {
        type: 'number',
        description: '任务复杂度（用于评估Token效率）'
      },
      code: {
        type: 'string',
        description: '代码内容（用于评估安全性）'
      },
      prompt: {
        type: 'string',
        description: '提示词内容（用于评估安全性）'
      },
      output: {
        type: 'string',
        description: '输出内容（用于评估安全性）'
      },
      errorCount: {
        type: 'number',
        description: '错误次数（用于评估稳定性）'
      },
      retryCount: {
        type: 'number',
        description: '重试次数（用于评估稳定性）'
      },
      executionTime: {
        type: 'number',
        description: '执行时间（毫秒，用于评估稳定性）'
      },
      fileCount: {
        type: 'number',
        description: '文件数量（用于评估可维护性）'
      },
      commentRatio: {
        type: 'number',
        description: '注释率（用于评估可维护性）'
      }
    },
    required: ['task']
  }
};

// Tool处理器：harness_eval_run
export async function evalRunHandler(args) {
  try {
    const { task, ...options } = args;
    
    // 执行五维评测
    const evalResult = await evaluate(task, options);
    
    // 调试：删除所有可能的意外字段
    delete evalResult.content;
    delete evalResult.config;
    delete evalResult.result;
    
    // 构建简化的返回结果（避免嵌套）
    // 注意：使用 JSON.parse(JSON.stringify(...)) 来深拷贝并去除循环引用
    const safeDimensions = JSON.parse(JSON.stringify(evalResult.dimensions || {}));
    
    const simplifiedResult = {
      success: true,
      task: evalResult.task,
      timestamp: evalResult.timestamp,
      totalScore: evalResult.totalScore,
      passed: evalResult.passed,
      dimensions: safeDimensions,
      message: evalResult.passed ? 
        `✅ 五维评测通过！总分：${evalResult.totalScore}/1.0` : 
        `❌ 五维评测未通过！总分：${evalResult.totalScore}/1.0`
    };
    
    // 调试：确保 simplifiedResult 不包含 content 字段
    delete simplifiedResult.content;
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(simplifiedResult, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

// Tool定义：harness_eval_report（生成评测报告）
export const evalReportDefinition = {
  name: 'harness_eval_report',
  description: '生成五维评测报告，支持按任务/通过状态/时间过滤',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: '按任务过滤（可选）'
      },
      passed: {
        type: 'boolean',
        description: '按通过状态过滤（可选）'
      },
      since: {
        type: 'string',
        description: '按时间过滤，ISO 8601格式（可选）'
      }
    }
  }
};

// Tool处理器：harness_eval_report
export async function evalReportHandler(args) {
  try {
    const { task, passed, since } = args;
    const filter = {};
    
    if (task) filter.task = task;
    if (passed !== undefined) filter.passed = passed;
    if (since) filter.since = since;
    
    // 生成评测报告
    const report = await generateEvalReport(filter);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            report
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

// Tool定义：harness_ci_gate（执行CI门禁检查）
export const ciGateDefinition = {
  name: 'harness_ci_gate',
  description: '执行CI门禁检查，基于五维评测结果决定是否允许合并/部署',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: '任务描述或任务ID'
      },
      files: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: '涉及的文件列表（可选）'
      },
      commitHash: {
        type: 'string',
        description: '提交哈希（可选）'
      },
      branch: {
        type: 'string',
        description: '分支名称（可选）'
      }
    },
    required: ['task']
  }
};

// Tool处理器：harness_ci_gate
export async function ciGateHandler(args) {
  try {
    const { task, files, commitHash, branch } = args;
    
    // 执行CI门禁检查
    const gateResult = await runCIGate({ task, files, commitHash, branch });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            passed: gateResult.passed,
            blocked: gateResult.blocked,
            reason: gateResult.reason,
            details: gateResult.details,
            actions: gateResult.actions,
            timestamp: gateResult.timestamp,
            message: gateResult.blocked ? 
              `🚫 CI门禁未通过，已阻塞合并/部署！原因：${gateResult.reason}` : 
              `✅ CI门禁通过！${gateResult.reason}`
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

// Tool定义：harness_ci_gate_report（生成CI门禁报告）
export const ciGateReportDefinition = {
  name: 'harness_ci_gate_report',
  description: '生成CI门禁报告，支持按分支/通过状态/时间过滤',
  inputSchema: {
    type: 'object',
    properties: {
      branch: {
        type: 'string',
        description: '按分支过滤（可选）'
      },
      passed: {
        type: 'boolean',
        description: '按通过状态过滤（可选）'
      },
      since: {
        type: 'string',
        description: '按时间过滤，ISO 8601格式（可选）'
      },
      limit: {
        type: 'number',
        description: '限制返回记录数（可选）'
      }
    }
  }
};

// Tool处理器：harness_ci_gate_report
export async function ciGateReportHandler(args) {
  try {
    const { branch, passed, since, limit } = args;
    const filter = {};
    
    if (branch) filter.branch = branch;
    if (passed !== undefined) filter.passed = passed;
    if (since) filter.since = since;
    if (limit) filter.limit = limit;
    
    // 生成CI门禁报告
    const report = await generateCIGateReport(filter);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            report
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

// Tool定义：harness_benchmark_run（运行性能基准测试）
export const benchmarkRunDefinition = {
  name: 'harness_benchmark_run',
  description: '运行性能基准测试，建立性能基线，监控性能变化',
  inputSchema: {
    type: 'object',
    properties: {
      suite: {
        type: 'string',
        description: '测试套件名称（eval-framework/skill-analyzer/memory-decay/task-orchestrator/default）',
        enum: ['eval-framework', 'skill-analyzer', 'memory-decay', 'task-orchestrator', 'default']
      },
      iterations: {
        type: 'number',
        description: '迭代次数（默认10次）',
        default: 10
      },
      warmup: {
        type: 'number',
        description: '预热次数（默认3次）',
        default: 3
      }
    }
  }
};

// Tool处理器：harness_benchmark_run
export async function benchmarkRunHandler(args) {
  try {
    const { suite, iterations = 10, warmup = 3 } = args;
    
    // 运行性能基准测试
    const benchmarkResult = await runBenchmark({ suite, iterations, warmup });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            result: benchmarkResult,
            message: `✅ 性能基准测试完成！套件：${suite || 'default'}，迭代：${iterations}次`
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

// Tool定义：harness_benchmark_report（生成性能基准报告）
export const benchmarkReportDefinition = {
  name: 'harness_benchmark_report',
  description: '生成性能基准报告，支持按套件/时间过滤',
  inputSchema: {
    type: 'object',
    properties: {
      suite: {
        type: 'string',
        description: '按测试套件过滤（可选）'
      },
      since: {
        type: 'string',
        description: '按时间过滤，ISO 8601格式（可选）'
      },
      limit: {
        type: 'number',
        description: '限制返回记录数（可选）'
      }
    }
  }
};

// Tool处理器：harness_benchmark_report
export async function benchmarkReportHandler(args) {
  try {
    const { suite, since, limit } = args;
    const filter = {};
    
    if (suite) filter.suite = suite;
    if (since) filter.since = since;
    if (limit) filter.limit = limit;
    
    // 生成性能基准报告
    const report = await generateBenchmarkReport(filter);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            report
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

// 导出所有Tool定义
export const definitions = [
  evalRunDefinition,
  evalReportDefinition,
  ciGateDefinition,
  ciGateReportDefinition,
  benchmarkRunDefinition,
  benchmarkReportDefinition
];

// 导出所有Tool处理器
export const handlers = {
  [evalRunDefinition.name]: evalRunHandler,
  [evalReportDefinition.name]: evalReportHandler,
  [ciGateDefinition.name]: ciGateHandler,
  [ciGateReportDefinition.name]: ciGateReportHandler,
  [benchmarkRunDefinition.name]: benchmarkRunHandler,
  [benchmarkReportDefinition.name]: benchmarkReportHandler
};
