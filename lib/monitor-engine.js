/**
 * Harness MCP Server - 监控引擎 (Monitor Engine)
 *
 * 提供实时指标收集、聚合统计和历史存储。
 * 单例模式，全局共享监控状态。
 *
 * 指标类型：
 *   - Counter: 只增计数器（请求总数、错误总数）
 *   - Gauge:   可增可减（内存使用、活跃连接）
 *   - Histogram: 分布统计（响应时间）
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'monitor-snapshots.json');

// ═══════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil(sortedArr.length * p / 100) - 1;
  return sortedArr[Math.max(0, idx)];
}

function round(n, d = 2) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}

// ═══════════════════════════════════════════════
// 监控引擎类
// ═══════════════════════════════════════════════

export class MonitorEngine {
  constructor() {
    if (MonitorEngine._instance) return MonitorEngine._instance;

    // --- 计数器 ---
    this.totalRequests = 0;
    this.successRequests = 0;
    this.failedRequests = 0;

    // --- 工具调用统计 ---
    // { toolName: { count, totalTime, errors, lastCalled } }
    this.toolStats = new Map();

    // --- 响应时间（环形缓冲区，最近 1000 条） ---
    this.responseTimes = [];
    this.MAX_SAMPLES = 1000;

    // --- 时间窗口聚合 ---
    this.windows = {
      '1m':  { duration: 60_000,   samples: [] },
      '5m':  { duration: 300_000,  samples: [] },
      '15m': { duration: 900_000,  samples: [] },
      '1h':  { duration: 3600_000, samples: [] },
    };

    // --- 服务器启动时间 ---
    this.startTime = Date.now();
    this.lastSnapshotTime = this.startTime;

    // --- 错误日志（最近 50 条） ---
    this.errorLog = [];
    this.MAX_ERRORS = 50;

    // --- 快照历史（最近 100 条） ---
    this.snapshots = [];
    this.MAX_SNAPSHOTS = 100;
    this.autoSnapshotInterval = null;

    MonitorEngine._instance = this;
  }

  // ══════════════════════════════════════════
  // 请求记录
  // ══════════════════════════════════════════

  /**
   * 记录一次成功的工具调用
   * @param {string} toolName - 工具名称
   * @param {number} elapsedMs - 响应时间（毫秒）
   */
  recordSuccess(toolName, elapsedMs = 0) {
    this.totalRequests++;
    this.successRequests++;
    this._recordToolCall(toolName, elapsedMs);
    this._addResponseTime(elapsedMs);
  }

  /**
   * 记录一次失败的工具调用
   * @param {string} toolName - 工具名称
   * @param {number} elapsedMs - 响应时间（毫秒）
   * @param {string} errorMessage - 错误信息
   */
  recordFailure(toolName, elapsedMs = 0, errorMessage = '') {
    this.totalRequests++;
    this.failedRequests++;
    if (toolName) {
      this._recordToolCall(toolName, elapsedMs, true);
    }
    this._addResponseTime(elapsedMs);
    this._logError(toolName, errorMessage);
  }

  _recordToolCall(toolName, elapsedMs, isError = false) {
    let stat = this.toolStats.get(toolName);
    if (!stat) {
      stat = { count: 0, totalTime: 0, errors: 0, lastCalled: null, minTime: Infinity, maxTime: 0 };
      this.toolStats.set(toolName, stat);
    }
    stat.count++;
    stat.totalTime += elapsedMs;
    stat.lastCalled = Date.now();
    if (isError) stat.errors++;
    if (elapsedMs < stat.minTime) stat.minTime = elapsedMs;
    if (elapsedMs > stat.maxTime) stat.maxTime = elapsedMs;
  }

  _addResponseTime(ms) {
    const now = Date.now();
    this.responseTimes.push({ value: ms, timestamp: now });
    if (this.responseTimes.length > this.MAX_SAMPLES) {
      this.responseTimes = this.responseTimes.slice(-this.MAX_SAMPLES);
    }

    // 更新时间窗口
    for (const key of Object.keys(this.windows)) {
      const w = this.windows[key];
      w.samples.push({ value: ms, timestamp: now });
      // 清理过期样本
      const cutoff = now - w.duration;
      w.samples = w.samples.filter(s => s.timestamp >= cutoff);
    }
  }

  _logError(toolName, message) {
    this.errorLog.push({
      timestamp: Date.now(),
      tool: toolName,
      message: message.substring(0, 200),
    });
    if (this.errorLog.length > this.MAX_ERRORS) {
      this.errorLog = this.errorLog.slice(-this.MAX_ERRORS);
    }
  }

  // ══════════════════════════════════════════
  // 快照管理
  // ══════════════════════════════════════════

  /**
   * 生成当前状态的快照
   * @returns {Object} 监控快照
   */
  snapshot() {
    const now = Date.now();
    const uptime = Math.round((now - this.startTime) / 1000);

    const responseValues = this.responseTimes.map(r => r.value).sort((a, b) => a - b);

    const snapshot = {
      timestamp: now,
      uptime,
      server: {
        totalRequests: this.totalRequests,
        successRequests: this.successRequests,
        failedRequests: this.failedRequests,
        errorRate: this.totalRequests > 0
          ? round(this.failedRequests / this.totalRequests * 100, 2)
          : 0,
        successRate: this.totalRequests > 0
          ? round(this.successRequests / this.totalRequests * 100, 2)
          : 100,
      },
      latency: {
        avg: responseValues.length > 0 ? round(responseValues.reduce((a, b) => a + b, 0) / responseValues.length) : 0,
        p50: percentile(responseValues, 50),
        p95: percentile(responseValues, 95),
        p99: percentile(responseValues, 99),
        min: responseValues[0] || 0,
        max: responseValues[responseValues.length - 1] || 0,
        samples: responseValues.length,
      },
      throughput: {
        total: this.totalRequests > 0 ? round(this.totalRequests / (uptime || 1), 2) : 0,
        '1m': this._calcThroughput('1m'),
        '5m': this._calcThroughput('5m'),
        '15m': this._calcThroughput('15m'),
      },
      memory: {
        heapUsedMB: round(process.memoryUsage().heapUsed / 1024 / 1024, 2),
        heapTotalMB: round(process.memoryUsage().heapTotal / 1024 / 1024, 2),
        rssMB: round(process.memoryUsage().rss / 1024 / 1024, 2),
        externalMB: round(process.memoryUsage().external / 1024 / 1024, 2),
      },
      tools: Array.from(this.toolStats.entries()).map(([name, stat]) => ({
        name,
        count: stat.count,
        errors: stat.errors,
        avgTime: stat.count > 0 ? round(stat.totalTime / stat.count) : 0,
        minTime: stat.minTime === Infinity ? 0 : stat.minTime,
        maxTime: stat.maxTime,
        lastCalled: stat.lastCalled,
      })),
      errors: {
        count: this.errorLog.length,
        recent: this.errorLog.slice(-5),
      },
    };

    // 保存到快照历史
    this.snapshots.push({ timestamp: now, ...snapshot });
    if (this.snapshots.length > this.MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-this.MAX_SNAPSHOTS);
    }

    this.lastSnapshotTime = now;
    return snapshot;
  }

  _calcThroughput(windowKey) {
    const w = this.windows[windowKey];
    if (!w || w.samples.length === 0) return 0;
    const now = Date.now();
    const windowStart = now - w.duration;
    const count = w.samples.filter(s => s.timestamp >= windowStart).length;
    return round(count / (w.duration / 1000), 2);
  }

  /**
   * 启动自动快照
   * @param {number} intervalMs - 快照间隔（默认 60 秒）
   */
  startAutoSnapshot(intervalMs = 60000) {
    if (this.autoSnapshotInterval) return;
    this.autoSnapshotInterval = setInterval(() => {
      this.snapshot();
    }, intervalMs);
  }

  /**
   * 停止自动快照
   */
  stopAutoSnapshot() {
    if (this.autoSnapshotInterval) {
      clearInterval(this.autoSnapshotInterval);
      this.autoSnapshotInterval = null;
    }
  }

  /**
   * 获取健康状态
   * @returns {Object} 健康检查结果
   */
  getHealth() {
    const now = Date.now();
    const uptime = Math.round((now - this.startTime) / 1000);
    const mem = process.memoryUsage();

    let status = 'healthy';
    const warnings = [];

    // 检查错误率
    const errorRate = this.totalRequests > 0
      ? this.failedRequests / this.totalRequests
      : 0;
    if (errorRate > 0.1) {
      status = 'degraded';
      warnings.push(`High error rate: ${round(errorRate * 100)}%`);
    }
    if (errorRate > 0.5) {
      status = 'unhealthy';
      warnings.push(`Critical error rate: ${round(errorRate * 100)}%`);
    }

    // 检查内存
    const heapUsedMB = mem.heapUsed / 1024 / 1024;
    if (heapUsedMB > 512) {
      status = status === 'healthy' ? 'degraded' : status;
      warnings.push(`High memory usage: ${round(heapUsedMB)}MB`);
    }

    return {
      status,
      uptime,
      totalRequests: this.totalRequests,
      errorRate: round(errorRate * 100, 2),
      memoryMB: round(heapUsedMB, 2),
      warnings,
      lastCheck: now,
    };
  }

  /**
   * 获取历史快照
   * @param {number} limit - 最大返回数量
   * @returns {Array} 快照历史
   */
  getSnapshots(limit = 20) {
    return this.snapshots.slice(-limit);
  }

  /**
   * 持久化当前快照到文件
   */
  async persistSnapshot() {
    try {
      const snap = this.snapshot();
      let existing = [];
      try {
        const data = await fs.readFile(SNAPSHOT_PATH, 'utf-8');
        existing = JSON.parse(data);
      } catch {}
      existing.push(snap);
      if (existing.length > 500) existing = existing.slice(-500);
      await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(existing, null, 2));
    } catch (e) {
      // 持久化失败不阻塞
    }
  }

  /**
   * 重置计数器（保留工具统计和快照历史）
   */
  reset() {
    this.totalRequests = 0;
    this.successRequests = 0;
    this.failedRequests = 0;
    this.responseTimes = [];
    for (const key of Object.keys(this.windows)) {
      this.windows[key].samples = [];
    }
    this.errorLog = [];
  }
}

// 导出单例
const monitor = new MonitorEngine();
export { monitor };
