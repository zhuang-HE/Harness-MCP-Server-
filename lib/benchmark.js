/**
 * Harness MCP Server - 性能基准 (D8: eval-framework)
 * 
 * 性能基准：建立性能基线，监控性能变化，生成基准报告
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BENCHMARK_RESULTS_PATH = path.join(ROOT, 'benchmark-results.json');
const BENCHMARK_BASELINE_PATH = path.join(ROOT, 'benchmark-baseline.json');

// 运行性能基准测试
export async function runBenchmark(options = {}) {
  const { suite, iterations = 10, warmup = 3 } = options;
  
  const results = {
    timestamp: new Date().toISOString(),
    suite: suite || 'default',
    iterations,
    warmup,
    benchmarks: []
  };
  
  // 运行预热
  for (let i = 0; i < warmup; i++) {
    await runBenchmarkIteration(suite, i, true);
  }
  
  // 运行正式基准测试
  for (let i = 0; i < iterations; i++) {
    const iterationResult = await runBenchmarkIteration(suite, i, false);
    results.benchmarks.push(iterationResult);
  }
  
  // 计算统计数据
  results.stats = calculateBenchmarkStats(results.benchmarks);
  
  // 保存基准测试结果
  saveBenchmarkResult(results);
  
  // 更新基线（如果配置为自动更新）
  const config = loadBenchmarkConfig();
  if (config.autoUpdateBaseline) {
    updateBaseline(suite || 'default', results.stats);
  }
  
  return results;
}

// 运行单次基准测试迭代
async function runBenchmarkIteration(suite, iteration, isWarmup) {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  // 根据suite运行不同的基准测试
  let result;
  switch (suite) {
    case 'eval-framework':
      result = await benchmarkEvalFramework();
      break;
    case 'skill-analyzer':
      result = await benchmarkSkillAnalyzer();
      break;
    case 'memory-decay':
      result = await benchmarkMemoryDecay();
      break;
    case 'task-orchestrator':
      result = await benchmarkTaskOrchestrator();
      break;
    default:
      result = await benchmarkDefault();
      break;
  }
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage();
  
  return {
    iteration: isWarmup ? `warmup-${iteration}` : iteration,
    isWarmup,
    duration: endTime - startTime,
    memory: {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal
    },
    result
  };
}

// 基准测试：eval-framework
async function benchmarkEvalFramework() {
  // 模拟五维评测
  const task = {
    result: 'test result',
    expected: 'test result',
    inputTokens: 100,
    outputTokens: 50,
    taskComplexity: 150
  };
  
  // 这里应该调用实际的eval-framework
  // 为了简化，我们模拟执行时间
  await sleep(10);
  
  return { task, score: 0.85 };
}

// 基准测试：skill-analyzer
async function benchmarkSkillAnalyzer() {
  // 模拟技能分析
  await sleep(5);
  
  return { skillsAnalyzed: 10, issuesFound: 3 };
}

// 基准测试：memory-decay
async function benchmarkMemoryDecay() {
  // 模拟记忆衰减
  await sleep(8);
  
  return { entriesProcessed: 100, entriesArchived: 20 };
}

// 基准测试：task-orchestrator
async function benchmarkTaskOrchestrator() {
  // 模拟任务编排
  await sleep(15);
  
  return { tasksOrchestrated: 5, agentsSpawned: 3 };
}

// 基准测试：默认
async function benchmarkDefault() {
  // 默认基准测试
  await sleep(1);
  
  return { status: 'ok' };
}

// 辅助函数：sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 计算基准测试统计数据
function calculateBenchmarkStats(benchmarks) {
  // 过滤掉预热迭代
  const formalBenchmarks = benchmarks.filter(b => !b.isWarmup);
  
  if (formalBenchmarks.length === 0) {
    return { error: 'No formal benchmarks' };
  }
  
  // 提取持续时间
  const durations = formalBenchmarks.map(b => b.duration);
  
  // 计算统计数据
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const median = calculateMedian(durations);
  const stdDev = calculateStandardDeviation(durations, mean);
  
  // 计算内存统计数据
  const memoryDeltas = formalBenchmarks.map(b => b.memory.heapUsed);
  const avgMemoryDelta = memoryDeltas.reduce((sum, m) => sum + m, 0) / memoryDeltas.length;
  
  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    samples: formalBenchmarks.length,
    avgMemoryDelta: Math.round(avgMemoryDelta / 1024 / 1024 * 100) / 100 // MB
  };
}

// 辅助函数：计算中位数
function calculateMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 !== 0 ? 
    sorted[mid] : 
    (sorted[mid - 1] + sorted[mid]) / 2;
}

// 辅助函数：计算标准差
function calculateStandardDeviation(values, mean) {
  const squareDiffs = values.map(value => {
    const diff = value - mean;
    return diff * diff;
  });
  
  const avgSquareDiff = squareDiffs.reduce((sum, d) => sum + d, 0) / squareDiffs.length;
  
  return Math.sqrt(avgSquareDiff);
}

// 保存基准测试结果
function saveBenchmarkResult(result) {
  try {
    let results = [];
    if (fs.existsSync(BENCHMARK_RESULTS_PATH)) {
      const content = fs.readFileSync(BENCHMARK_RESULTS_PATH, 'utf-8');
      results = JSON.parse(content);
    }
    
    results.push(result);
    
    // 只保留最近50条记录
    if (results.length > 50) {
      results = results.slice(-50);
    }
    
    fs.writeFileSync(BENCHMARK_RESULTS_PATH, JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('保存基准测试结果失败:', error);
  }
}

// 加载基准配置
function loadBenchmarkConfig() {
  const configPath = path.join(ROOT, 'config', 'benchmark.json');
  
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('加载基准配置失败:', error);
  }
  
  return getDefaultBenchmarkConfig();
}

function getDefaultBenchmarkConfig() {
  return {
    autoUpdateBaseline: true,
    thresholds: {
      maxMeanDuration: 1000, // 1秒
      maxStdDev: 200, // 200ms
      maxMemoryDelta: 100 // 100MB
    },
    suites: ['eval-framework', 'skill-analyzer', 'memory-decay', 'task-orchestrator', 'default']
  };
}

// 更新性能基线
function updateBaseline(suite, stats) {
  try {
    let baseline = {};
    if (fs.existsSync(BENCHMARK_BASELINE_PATH)) {
      const content = fs.readFileSync(BENCHMARK_BASELINE_PATH, 'utf-8');
      baseline = JSON.parse(content);
    }
    
    baseline[suite] = {
      timestamp: new Date().toISOString(),
      stats
    };
    
    fs.writeFileSync(BENCHMARK_BASELINE_PATH, JSON.stringify(baseline, null, 2));
  } catch (error) {
    console.error('更新性能基线失败:', error);
  }
}

// 查询基准测试结果
export async function getBenchmarkResults(filter = {}) {
  try {
    if (!fs.existsSync(BENCHMARK_RESULTS_PATH)) {
      return [];
    }
    
    const content = fs.readFileSync(BENCHMARK_RESULTS_PATH, 'utf-8');
    let results = JSON.parse(content);
    
    // 应用过滤条件
    if (filter.suite) {
      results = results.filter(r => r.suite === filter.suite);
    }
    if (filter.since) {
      results = results.filter(r => r.timestamp >= filter.since);
    }
    if (filter.limit) {
      results = results.slice(-filter.limit);
    }
    
    return results;
  } catch (error) {
    console.error('查询基准测试结果失败:', error);
    return [];
  }
}

// 生成基准测试报告
export async function generateBenchmarkReport(filter = {}) {
  const results = await getBenchmarkResults(filter);
  
  if (results.length === 0) {
    return {
      summary: '无基准测试结果',
      totalBenchmarks: 0,
      suites: {}
    };
  }
  
  // 按suite分组
  const suites = {};
  for (const result of results) {
    if (!suites[result.suite]) {
      suites[result.suite] = [];
    }
    suites[result.suite].push(result);
  }
  
  // 为每个suite生成统计信息
  const suiteStats = {};
  for (const [suite, suiteResults] of Object.entries(suites)) {
    const latestResult = suiteResults[suiteResults.length - 1];
    const baseline = loadBaseline(suite);
    
    suiteStats[suite] = {
      latestStats: latestResult.stats,
      baseline: baseline ? baseline.stats : null,
      regression: baseline ? 
        (latestResult.stats.mean - baseline.stats.mean) / baseline.stats.mean : 
        null,
      trend: calculateTrend(suiteResults.map(r => r.stats.mean))
    };
  }
  
  return {
    summary: `共执行${results.length}次基准测试，${Object.keys(suites).length}个测试套件`,
    totalBenchmarks: results.length,
    suites: suiteStats
  };
}

// 加载性能基线
function loadBaseline(suite) {
  try {
    if (!fs.existsSync(BENCHMARK_BASELINE_PATH)) {
      return null;
    }
    
    const content = fs.readFileSync(BENCHMARK_BASELINE_PATH, 'utf-8');
    const baseline = JSON.parse(content);
    
    return baseline[suite] || null;
  } catch (error) {
    console.error('加载性能基线失败:', error);
    return null;
  }
}

// 计算趋势
function calculateTrend(values) {
  if (values.length < 2) {
    return 'stable';
  }
  
  // 简单线性回归
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((sum, v) => sum + v, 0);
  const sumXY = values.reduce((sum, v, i) => sum + (i * v), 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  if (slope > 0.1) {
    return 'degrading';
  } else if (slope < -0.1) {
    return 'improving';
  } else {
    return 'stable';
  }
}

// 比较当前结果与基线
export async function compareWithBaseline(suite, currentStats) {
  const baseline = loadBaseline(suite);
  
  if (!baseline) {
    return {
      compared: false,
      reason: 'No baseline available'
    };
  }
  
  const config = loadBenchmarkConfig();
  const thresholds = config.thresholds;
  
  const comparison = {
    compared: true,
    suite,
    baseline: baseline.stats,
    current: currentStats,
    regression: {
      mean: (currentStats.mean - baseline.stats.mean) / baseline.stats.mean,
      stdDev: (currentStats.stdDev - baseline.stats.stdDev) / baseline.stats.stdDev,
      memory: (currentStats.avgMemoryDelta - baseline.stats.avgMemoryDelta) / baseline.stats.avgMemoryDelta
    },
    passed: true,
    failures: []
  };
  
  // 检查是否超过阈值
  if (currentStats.mean > thresholds.maxMeanDuration) {
    comparison.passed = false;
    comparison.failures.push(`Mean duration ${currentStats.mean}ms exceeds threshold ${thresholds.maxMeanDuration}ms`);
  }
  
  if (currentStats.stdDev > thresholds.maxStdDev) {
    comparison.passed = false;
    comparison.failures.push(`Standard deviation ${currentStats.stdDev}ms exceeds threshold ${thresholds.maxStdDev}ms`);
  }
  
  if (currentStats.avgMemoryDelta > thresholds.maxMemoryDelta) {
    comparison.passed = false;
    comparison.failures.push(`Memory delta ${currentStats.avgMemoryDelta}MB exceeds threshold ${thresholds.maxMemoryDelta}MB`);
  }
  
  // 检查回归
  if (comparison.regression.mean > 0.2) { // 20%回归
    comparison.passed = false;
    comparison.failures.push(`Performance regression detected: mean duration increased by ${Math.round(comparison.regression.mean * 100)}%`);
  }
  
  return comparison;
}

export default { runBenchmark, getBenchmarkResults, generateBenchmarkReport, compareWithBaseline };
