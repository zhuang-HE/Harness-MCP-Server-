/**
 * Harness MCP Server - 评测引擎 (D8: eval-framework)
 * 
 * 五维评测：准确性、Token效率、安全性、稳定性、可维护性
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'default.json');
const EVAL_RESULTS_PATH = path.join(ROOT, 'eval-results.json');

// 加载配置
function loadConfig() {
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    eval: {
      dimensions: [
        { name: 'accuracy', weight: 0.25, threshold: 0.85 },
        { name: 'tokenEfficiency', weight: 0.20, threshold: 0.70 },
        { name: 'security', weight: 0.20, threshold: 0.90 },
        { name: 'stability', weight: 0.15, threshold: 0.80 },
        { name: 'maintainability', weight: 0.20, threshold: 0.75 }
      ],
      ciGate: {
        enabled: true,
        blockOnFail: true,
        notifyOnFail: true
      }
    }
  };
}

// 五维评测
export async function evaluate(task, options = {}) {
  const config = loadConfig();
  const dimensions = config.eval.dimensions;
  
  const results = {};
  let totalScore = 0;
  
  for (const dim of dimensions) {
    const score = await evaluateDimension(dim.name, task, options);
    results[dim.name] = {
      score,
      weight: dim.weight,
      threshold: dim.threshold,
      passed: score >= dim.threshold
    };
    totalScore += score * dim.weight;
  }
  
  const passed = Object.values(results).every(r => r.passed);
  
  const evalResult = {
    task,
    timestamp: new Date().toISOString(),
    dimensions: results,
    totalScore: Math.round(totalScore * 100) / 100,
    passed,
    config: config.eval
  };
  
  // 保存评测结果
  saveEvalResult(evalResult);
  
  return evalResult;
}

// 评测单个维度
async function evaluateDimension(dimension, task, options) {
  switch (dimension) {
    case 'accuracy':
      return evaluateAccuracy(task, options);
    case 'tokenEfficiency':
      return evaluateTokenEfficiency(task, options);
    case 'security':
      return evaluateSecurity(task, options);
    case 'stability':
      return evaluateStability(task, options);
    case 'maintainability':
      return evaluateMaintainability(task, options);
    default:
      return 0;
  }
}

// D1: 准确性评测
function evaluateAccuracy(task, options) {
  // 基于任务执行结果评估准确性
  const { result, expected } = task;
  
  if (!result || !expected) {
    return 0.5; // 无足够信息，返回中等分数
  }
  
  // 简单字符串匹配（可扩展为语义相似度）
  if (typeof result === 'string' && typeof expected === 'string') {
    const similarity = calculateStringSimilarity(result, expected);
    return similarity;
  }
  
  // 对象深度比较
  if (typeof result === 'object' && typeof expected === 'object') {
    const matchRatio = calculateObjectMatch(result, expected);
    return matchRatio;
  }
  
  return 0.5;
}

// D2: Token效率评测
function evaluateTokenEfficiency(task, options) {
  const { inputTokens, outputTokens, taskComplexity } = task;
  
  if (!inputTokens || !outputTokens) {
    return 0.5;
  }
  
  // 计算Token效率 = 输出质量 / (输入Token + 输出Token)
  const totalTokens = inputTokens + outputTokens;
  const efficiency = taskComplexity ? 
    Math.min(1, taskComplexity / totalTokens) : 
    Math.min(1, 1000 / totalTokens);
  
  return Math.round(efficiency * 100) / 100;
}

// D3: 安全性评测
function evaluateSecurity(task, options) {
  const { code, prompt, output } = task;
  let securityScore = 1.0;
  
  // 检查常见安全漏洞
  const securityRules = [
    { pattern: /eval\s*\(/i, penalty: 0.3, name: 'eval使用' },
    { pattern: /exec\s*\(/i, penalty: 0.3, name: 'exec使用' },
    { pattern: /rm\s+-rf/i, penalty: 0.5, name: '危险删除' },
    { pattern: /password\s*=\s*['"]\w+['"]/i, penalty: 0.4, name: '硬编码密码' },
    { pattern: /apikey\s*=\s*['"]\w+['"]/i, penalty: 0.4, name: '硬编码API密钥' }
  ];
  
  const content = JSON.stringify({ code, prompt, output });
  
  for (const rule of securityRules) {
    if (rule.pattern.test(content)) {
      securityScore -= rule.penalty;
    }
  }
  
  return Math.max(0, Math.round(securityScore * 100) / 100);
}

// D4: 稳定性评测
function evaluateStability(task, options) {
  const { errorCount, retryCount, executionTime } = task;
  
  let stabilityScore = 1.0;
  
  // 错误惩罚
  if (errorCount > 0) {
    stabilityScore -= Math.min(0.5, errorCount * 0.1);
  }
  
  // 重试惩罚
  if (retryCount > 0) {
    stabilityScore -= Math.min(0.3, retryCount * 0.05);
  }
  
  // 执行时间惩罚（超过30秒开始惩罚）
  if (executionTime > 30000) {
    stabilityScore -= Math.min(0.2, (executionTime - 30000) / 300000);
  }
  
  return Math.max(0, Math.round(stabilityScore * 100) / 100);
}

// D5: 可维护性评测
function evaluateMaintainability(task, options) {
  const { code, fileCount, commentRatio } = task;
  
  let maintainabilityScore = 0.7; // 基础分
  
  // 代码注释率加分
  if (commentRatio) {
    maintainabilityScore += Math.min(0.2, commentRatio * 0.5);
  }
  
  // 文件数量惩罚（单任务超过10个文件开始惩罚）
  if (fileCount > 10) {
    maintainabilityScore -= Math.min(0.3, (fileCount - 10) * 0.03);
  }
  
  // 代码复杂度惩罚（简单评估：行数）
  if (code) {
    const lines = code.split('\n').length;
    if (lines > 500) {
      maintainabilityScore -= Math.min(0.2, (lines - 500) / 5000);
    }
  }
  
  return Math.max(0, Math.min(1, Math.round(maintainabilityScore * 100) / 100));
}

// 辅助函数：字符串相似度
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return matrix[str1.length][str2.length];
}

// 辅助函数：对象匹配度
function calculateObjectMatch(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  const allKeys = new Set([...keys1, ...keys2]);
  
  let matchCount = 0;
  for (const key of allKeys) {
    if (JSON.stringify(obj1[key]) === JSON.stringify(obj2[key])) {
      matchCount++;
    }
  }
  
  return matchCount / allKeys.size;
}

// 保存评测结果
function saveEvalResult(result) {
  try {
    let results = [];
    if (fs.existsSync(EVAL_RESULTS_PATH)) {
      const content = fs.readFileSync(EVAL_RESULTS_PATH, 'utf-8');
      results = JSON.parse(content);
    }
    
    results.push(result);
    
    // 只保留最近100条记录
    if (results.length > 100) {
      results = results.slice(-100);
    }
    
    fs.writeFileSync(EVAL_RESULTS_PATH, JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('保存评测结果失败:', error);
  }
}

// 查询评测结果
export async function getEvalResults(filter = {}) {
  try {
    if (!fs.existsSync(EVAL_RESULTS_PATH)) {
      return [];
    }
    
    const content = fs.readFileSync(EVAL_RESULTS_PATH, 'utf-8');
    let results = JSON.parse(content);
    
    // 应用过滤条件
    if (filter.task) {
      results = results.filter(r => r.task === filter.task);
    }
    if (filter.passed !== undefined) {
      results = results.filter(r => r.passed === filter.passed);
    }
    if (filter.since) {
      results = results.filter(r => r.timestamp >= filter.since);
    }
    
    return results;
  } catch (error) {
    console.error('查询评测结果失败:', error);
    return [];
  }
}

// 生成评测报告
export async function generateEvalReport(filter = {}) {
  const results = await getEvalResults(filter);
  
  if (results.length === 0) {
    return {
      summary: '无评测结果',
      totalEvaluations: 0,
      passRate: 0,
      averageScore: 0,
      dimensions: {}
    };
  }
  
  const totalEvaluations = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const passRate = passedCount / totalEvaluations;
  const averageScore = results.reduce((sum, r) => sum + r.totalScore, 0) / totalEvaluations;
  
  // 按维度统计
  const dimensions = {};
  for (const result of results) {
    for (const [dim, data] of Object.entries(result.dimensions)) {
      if (!dimensions[dim]) {
        dimensions[dim] = { scores: [], passCount: 0 };
      }
      dimensions[dim].scores.push(data.score);
      if (data.passed) dimensions[dim].passCount++;
    }
  }
  
  // 计算维度平均分
  for (const [dim, data] of Object.entries(dimensions)) {
    data.averageScore = data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length;
    data.passRate = data.passCount / totalEvaluations;
    delete data.scores; // 删除原始分数，只保留统计信息
  }
  
  return {
    summary: `共执行${totalEvaluations}次评测，通过率${Math.round(passRate * 100)}%`,
    totalEvaluations,
    passedCount,
    passRate: Math.round(passRate * 100) / 100,
    averageScore: Math.round(averageScore * 100) / 100,
    dimensions
  };
}

export default { evaluate, getEvalResults, generateEvalReport };
