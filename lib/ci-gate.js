/**
 * Harness MCP Server - CI门禁 (D8: eval-framework)
 * 
 * CI门禁：在CI流程中自动执行五维评测，决定是否允许合并/部署
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluate, generateEvalReport } from './eval-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CI_GATE_CONFIG_PATH = path.join(ROOT, 'config', 'ci-gate.json');
const CI_GATE_LOG_PATH = path.join(ROOT, 'ci-gate-log.json');

// 加载CI门禁配置
function loadCIGateConfig() {
  try {
    if (fs.existsSync(CI_GATE_CONFIG_PATH)) {
      const content = fs.readFileSync(CI_GATE_CONFIG_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('加载CI门禁配置失败:', error);
  }
  
  return getDefaultCIGateConfig();
}

function getDefaultCIGateConfig() {
  return {
    enabled: true,
    blockOnFail: true,
    notifyOnFail: true,
    thresholds: {
      accuracy: 0.85,
      tokenEfficiency: 0.70,
      security: 0.90,
      stability: 0.80,
      maintainability: 0.75
    },
    actions: {
      onPass: ['merge', 'deploy'],
      onFail: ['block', 'notify']
    }
  };
}

// 执行CI门禁检查
export async function runCIGate(options = {}) {
  const config = loadCIGateConfig();
  
  if (!config.enabled) {
    return {
      passed: true,
      skipped: true,
      reason: 'CI门禁未启用',
      timestamp: new Date().toISOString()
    };
  }
  
  const { task, files, commitHash, branch } = options;
  
  // 执行五维评测
  const evalResult = await evaluate(task, options);
  
  // 检查是否通过门禁
  const gateResult = checkGate(evalResult, config);
  
  // 记录CI门禁日志
  const logEntry = {
    timestamp: new Date().toISOString(),
    task,
    commitHash,
    branch,
    evalResult,
    gateResult
  };
  
  saveCIGateLog(logEntry);
  
  // 如果未通过且配置了阻塞，则返回阻塞结果
  if (!gateResult.passed && config.blockOnFail) {
    return {
      passed: false,
      blocked: true,
      reason: '五维评测未通过门禁阈值',
      details: gateResult.details,
      actions: config.actions.onFail,
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    passed: gateResult.passed,
    blocked: false,
    reason: gateResult.passed ? '五维评测通过门禁阈值' : '部分维度未通过，但不阻塞',
    details: gateResult.details,
    actions: gateResult.passed ? config.actions.onPass : config.actions.onFail,
    timestamp: new Date().toISOString()
  };
}

// 检查门禁阈值
function checkGate(evalResult, config) {
  const details = {};
  let allPassed = true;
  
  for (const [dim, data] of Object.entries(evalResult.dimensions)) {
    const threshold = config.thresholds[dim] || 0.75;
    const passed = data.score >= threshold;
    
    details[dim] = {
      score: data.score,
      threshold,
      passed,
      gap: data.score - threshold
    };
    
    if (!passed) {
      allPassed = false;
    }
  }
  
  return {
    passed: allPassed,
    details
  };
}

// 保存CI门禁日志
function saveCIGateLog(logEntry) {
  try {
    let logs = [];
    if (fs.existsSync(CI_GATE_LOG_PATH)) {
      const content = fs.readFileSync(CI_GATE_LOG_PATH, 'utf-8');
      logs = JSON.parse(content);
    }
    
    logs.push(logEntry);
    
    // 只保留最近200条记录
    if (logs.length > 200) {
      logs = logs.slice(-200);
    }
    
    fs.writeFileSync(CI_GATE_LOG_PATH, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('保存CI门禁日志失败:', error);
  }
}

// 查询CI门禁日志
export async function getCIGateLogs(filter = {}) {
  try {
    if (!fs.existsSync(CI_GATE_LOG_PATH)) {
      return [];
    }
    
    const content = fs.readFileSync(CI_GATE_LOG_PATH, 'utf-8');
    let logs = JSON.parse(content);
    
    // 应用过滤条件
    if (filter.branch) {
      logs = logs.filter(log => log.branch === filter.branch);
    }
    if (filter.passed !== undefined) {
      logs = logs.filter(log => log.passed === filter.passed);
    }
    if (filter.since) {
      logs = logs.filter(log => log.timestamp >= filter.since);
    }
    if (filter.limit) {
      logs = logs.slice(-filter.limit);
    }
    
    return logs;
  } catch (error) {
    console.error('查询CI门禁日志失败:', error);
    return [];
  }
}

// 生成CI门禁报告
export async function generateCIGateReport(filter = {}) {
  const logs = await getCIGateLogs(filter);
  
  if (logs.length === 0) {
    return {
      summary: '无CI门禁日志',
      totalRuns: 0,
      passRate: 0,
      blockedCount: 0
    };
  }
  
  const totalRuns = logs.length;
  const passedCount = logs.filter(log => log.passed).length;
  const blockedCount = logs.filter(log => log.blocked).length;
  const passRate = passedCount / totalRuns;
  
  // 按维度统计
  const dimensions = {};
  for (const log of logs) {
    if (log.evalResult && log.evalResult.dimensions) {
      for (const [dim, data] of Object.entries(log.evalResult.dimensions)) {
        if (!dimensions[dim]) {
          dimensions[dim] = { scores: [], passCount: 0 };
        }
        dimensions[dim].scores.push(data.score);
        if (data.passed) dimensions[dim].passCount++;
      }
    }
  }
  
  // 计算维度平均分
  for (const [dim, data] of Object.entries(dimensions)) {
    data.averageScore = data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length;
    data.passRate = data.passCount / totalRuns;
    delete data.scores; // 删除原始分数，只保留统计信息
  }
  
  return {
    summary: `共执行${totalRuns}次CI门禁检查，通过率${Math.round(passRate * 100)}%，阻塞${blockedCount}次`,
    totalRuns,
    passedCount,
    blockedCount,
    passRate: Math.round(passRate * 100) / 100,
    averageScore: logs.reduce((sum, log) => sum + (log.evalResult ? log.evalResult.totalScore : 0), 0) / totalRuns,
    dimensions
  };
}

// 更新CI门禁配置
export async function updateCIGateConfig(updates) {
  try {
    const config = loadCIGateConfig();
    const updatedConfig = { ...config, ...updates };
    
    fs.writeFileSync(CI_GATE_CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));
    
    return {
      success: true,
      config: updatedConfig
    };
  } catch (error) {
    console.error('更新CI门禁配置失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default { runCIGate, getCIGateLogs, generateCIGateReport, updateCIGateConfig };
