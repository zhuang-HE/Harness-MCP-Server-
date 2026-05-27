// lib/runtime-guardian-engine.js
// 运行时守护引擎 - 实现执行监控、资源限制、安全检查、异常处理
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/**
 * 运行时守护引擎类
 */
export class RuntimeGuardianEngine {
  constructor(options = {}) {
    this.options = {
      // 资源限制
      maxMemoryMB: options.maxMemoryMB || 1024, // 最大内存 1GB
      maxCpuPercent: options.maxCpuPercent || 80, // 最大CPU 80%
      maxExecutionTimeMs: options.maxExecutionTimeMs || 300000, // 最大执行时间 5分钟
      maxConcurrentTasks: options.maxConcurrentTasks || 5, // 最大并发任务数
      
      // 安全检查
      enableDangerousOperationCheck: options.enableDangerousOperationCheck !== false,
      enablePermissionCheck: options.enablePermissionCheck !== false,
      dangerousPatterns: options.dangerousPatterns || [
        'rm -rf /',
        'dd if=',
        'mkfs',
        'format',
        'del /f /s /q',
        ':(){ :|:& };:', // Fork bomb
      ],
      
      // 监控配置
      monitoringIntervalMs: options.monitoringIntervalMs || 5000, // 监控间隔 5秒
      enableRealTimeMonitoring: options.enableRealTimeMonitoring !== false,
      
      // 异常处理
      enableAutoRecovery: options.enableAutoRecovery !== false,
      maxRetries: options.maxRetries || 3,
      recoveryDelayMs: options.recoveryDelayMs || 1000, // 恢复延迟 1秒
      
      ...options,
    };
    
    // 活跃任务跟踪
    this.activeTasks = new Map();
    
    // 资源使用历史
    this.resourceHistory = [];
    
    // 安全事件日志
    this.securityLogs = [];
    
    // 监控定时器
    this.monitoringTimer = null;
    
    // 启动实时监控
    if (this.options.enableRealTimeMonitoring) {
      this._startMonitoring();
    }
  }
  
  /**
   * 注册任务（开始监控）
   * @param {string} taskId - 任务ID
   * @param {Object} options - 任务选项
   * @returns {Object} 任务句柄
   */
  registerTask(taskId, options = {}) {
    const task = {
      id: taskId,
      startTime: Date.now(),
      status: 'running',
      resourceUsage: {
        memoryMB: 0,
        cpuPercent: 0,
      },
      retryCount: 0,
      logs: [],
    };
    
    this.activeTasks.set(taskId, task);
    
    // 设置超时
    if (options.timeoutMs || this.options.maxExecutionTimeMs) {
      task.timeoutHandle = setTimeout(() => {
        this._handleTimeout(taskId);
      }, options.timeoutMs || this.options.maxExecutionTimeMs);
    }
    
    return task;
  }
  
  /**
   * 更新任务资源使用
   * @param {string} taskId - 任务ID
   * @param {Object} usage - 资源使用数据
   */
  updateTaskResourceUsage(taskId, usage) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // 更新资源使用
    task.resourceUsage = {
      ...task.resourceUsage,
      ...usage,
      timestamp: Date.now(),
    };
    
    // 检查资源限制
    this._checkResourceLimits(taskId);
    
    // 记录历史
    this.resourceHistory.push({
      taskId,
      ...task.resourceUsage,
    });
  }
  
  /**
   * 检查安全检查
   * @param {string} taskId - 任务ID
   * @param {string} command - 要执行的命令
   * @returns {Object} 检查结果
   */
  checkSecurity(taskId, command) {
    const result = {
      safe: true,
      warnings: [],
      errors: [],
    };
    
    // 1. 检查危险操作
    if (this.options.enableDangerousOperationCheck) {
      for (const pattern of this.options.dangerousPatterns) {
        if (command.includes(pattern)) {
          result.safe = false;
          result.errors.push(`Dangerous operation detected: ${pattern}`);
          
          // 记录安全事件
          this.securityLogs.push({
            taskId,
            type: 'dangerous_operation',
            pattern,
            command,
            timestamp: Date.now(),
          });
        }
      }
    }
    
    // 2. 检查权限
    if (this.options.enablePermissionCheck) {
      const permissionResult = this._checkPermissions(taskId, command);
      if (!permissionResult.allowed) {
        result.safe = false;
        result.errors.push(...permissionResult.errors);
      }
    }
    
    return result;
  }
  
  /**
   * 处理任务异常
   * @param {string} taskId - 任务ID
   * @param {Error} error - 错误对象
   * @returns {Object} 处理结果
   */
  async handleException(taskId, error) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    task.status = 'error';
    task.lastError = error.message;
    task.logs.push({
      level: 'error',
      message: error.message,
      timestamp: Date.now(),
    });
    
    // 尝试自动恢复
    if (this.options.enableAutoRecovery && task.retryCount < this.options.maxRetries) {
      task.retryCount++;
      task.status = 'recovering';
      
      await new Promise(resolve => setTimeout(resolve, this.options.recoveryDelayMs));
      
      return {
        recovered: true,
        retryCount: task.retryCount,
        message: `Auto recovery attempt ${task.retryCount}/${this.options.maxRetries}`,
      };
    }
    
    // 无法恢复
    task.status = 'failed';
    return {
      recovered: false,
      retryCount: task.retryCount,
      message: 'Max retries exceeded or auto recovery disabled',
    };
  }
  
  /**
   * 完成任务
   * @param {string} taskId - 任务ID
   * @param {Object} result - 任务结果
   */
  completeTask(taskId, result = {}) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    task.status = 'completed';
    task.endTime = Date.now();
    task.result = result;
    
    // 清除超时
    if (task.timeoutHandle) {
      clearTimeout(task.timeoutHandle);
    }
    
    // 从活跃任务中移除
    this.activeTasks.delete(taskId);
  }
  
  /**
   * 获取监控报告
   * @returns {Object} 监控报告
   */
  getMonitoringReport() {
    const now = Date.now();
    const activeTasks = Array.from(this.activeTasks.values());
    
    return {
      timestamp: now,
      activeTasksCount: activeTasks.length,
      activeTasks: activeTasks.map(t => ({
        id: t.id,
        status: t.status,
        duration: now - t.startTime,
        retryCount: t.retryCount,
      })),
      resourceHistoryCount: this.resourceHistory.length,
      securityEventsCount: this.securityLogs.length,
      recentSecurityEvents: this.securityLogs.slice(-10), // 最近10个安全事件
    };
  }
  
  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }
  
  // ========== 私有辅助方法 ==========
  
  /**
   * 启动实时监控
   */
  _startMonitoring() {
    this.monitoringTimer = setInterval(() => {
      this._collectSystemMetrics();
    }, this.options.monitoringIntervalMs);
  }
  
  /**
   * 收集系统指标
   */
  async _collectSystemMetrics() {
    try {
      // 简化实现：在真实环境中，这里应该调用系统API获取CPU/内存使用情况
      const metrics = {
        timestamp: Date.now(),
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsagePercent: 0, // 简化：实际需要从系统获取
      };
      
      // 更新所有活跃任务的资源使用
      for (const [taskId, task] of this.activeTasks) {
        this.updateTaskResourceUsage(taskId, {
          memoryMB: metrics.memoryUsageMB,
          cpuPercent: metrics.cpuUsagePercent,
        });
      }
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }
  
  /**
   * 检查资源限制
   */
  _checkResourceLimits(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;
    
    const usage = task.resourceUsage;
    const warnings = [];
    
    // 检查内存
    if (usage.memoryMB > this.options.maxMemoryMB) {
      warnings.push(`Memory usage (${usage.memoryMB.toFixed(2)}MB) exceeds limit (${this.options.maxMemoryMB}MB)`);
    }
    
    // 检查CPU
    if (usage.cpuPercent > this.options.maxCpuPercent) {
      warnings.push(`CPU usage (${usage.cpuPercent}%) exceeds limit (${this.options.maxCpuPercent}%)`);
    }
    
    if (warnings.length > 0) {
      task.logs.push({
        level: 'warning',
        message: `Resource limit warnings: ${warnings.join('; ')}`,
        timestamp: Date.now(),
      });
    }
  }
  
  /**
   * 检查权限
   */
  _checkPermissions(taskId, command) {
    // 简化实现：在真实环境中，这里应该检查文件系统权限、网络权限等
    const result = {
      allowed: true,
      errors: [],
    };
    
    // 示例：检查是否尝试访问敏感路径
    const sensitivePaths = ['/etc/passwd', '/etc/shadow', 'C:\\Windows\\System32'];
    for (const path of sensitivePaths) {
      if (command.includes(path)) {
        result.allowed = false;
        result.errors.push(`Access to sensitive path denied: ${path}`);
      }
    }
    
    return result;
  }
  
  /**
   * 处理超时
   */
  _handleTimeout(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;
    
    task.status = 'timeout';
    task.logs.push({
      level: 'error',
      message: `Task timeout after ${this.options.maxExecutionTimeMs}ms`,
      timestamp: Date.now(),
    });
    
    // 从活跃任务中移除
    this.activeTasks.delete(taskId);
  }
}

/**
 * 创建运行时守护引擎实例
 */
export function createRuntimeGuardianEngine(options = {}) {
  return new RuntimeGuardianEngine(options);
}

/**
 * 快速安全检查（便捷函数）
 */
export async function quickSecurityCheck(command, options = {}) {
  const engine = createRuntimeGuardianEngine(options);
  return engine.checkSecurity('quick-check', command);
}

/**
 * 监控任务执行（便捷函数）
 */
export async function monitorTask(taskId, taskFn, options = {}) {
  const engine = createRuntimeGuardianEngine(options);
  
  // 注册任务
  engine.registerTask(taskId, options);
  
  try {
    // 执行任务
    const result = await taskFn();
    
    // 完成任务
    engine.completeTask(taskId, result);
    
    return {
      success: true,
      result,
    };
  } catch (error) {
    // 处理异常
    const recovery = await engine.handleException(taskId, error);
    
    if (recovery.recovered) {
      // 重试
      return monitorTask(taskId, taskFn, options);
    }
    
    return {
      success: false,
      error: error.message,
      recovery,
    };
  }
}
