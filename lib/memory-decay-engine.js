// lib/memory-decay-engine.js
// 记忆衰减引擎 - 实现记忆衰减、重要度评分、自动蒸馏、存储优化
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/**
 * 记忆衰减引擎类
 */
export class MemoryDecayEngine {
  constructor(options = {}) {
    this.options = {
      // 衰减参数
      decayRate: options.decayRate || 0.05, // 每天衰减5%
      halfLifeDays: options.halfLifeDays || 30, // 30天半衰期
      minImportance: options.minImportance || 0.1, // 最低重要度阈值
      
      // 访问频率权重
      accessWeight: options.accessWeight || 0.3,
      timeWeight: options.timeWeight || 0.7,
      
      // 蒸馏参数
      distillationThreshold: options.distillationThreshold || 0.3, // 重要度低于此值触发蒸馏
      maxMemoryAge: options.maxMemoryAge || 365, // 最大记忆年龄（天）
      
      // 存储分层
      hotStoragePath: options.hotStoragePath || path.join(ROOT, '../.workbuddy/memory/hot'),
      warmStoragePath: options.warmStoragePath || path.join(ROOT, '../.workbuddy/memory/warm'),
      coldStoragePath: options.coldStoragePath || path.join(ROOT, '../.workbuddy/memory/cold'),
      
      ...options,
    };
    
    // 记忆缓存
    this.memoryCache = new Map();
    
    // 重要度缓存
    this.importanceCache = new Map();
  }
  
  /**
   * 计算记忆衰减后的重要度
   * @param {Object} memory - 记忆对象
   * @returns {number} 衰减后的重要度 (0-1)
   */
  calculateDecayedImportance(memory) {
    const now = Date.now();
    const createdAt = memory.createdAt || now;
    const lastAccessedAt = memory.lastAccessedAt || createdAt;
    const accessCount = memory.accessCount || 0;
    
    // 计算时间衰减（指数衰减）
    const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.exp(-daysSinceCreation / this.options.halfLifeDays);
    
    // 计算访问频率权重
    const frequencyScore = Math.min(accessCount / 100, 1); // 最高100次访问
    
    // 计算最后访问时间权重
    const daysSinceAccess = (now - lastAccessedAt) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSinceAccess / 7); // 7天内的访问权重高
    
    // 综合重要度计算
    const baseImportance = memory.importance || 0.5;
    const decayedImportance = baseImportance * timeDecay * 
                           (1 - this.options.accessWeight) +
                           (frequencyScore * 0.5 + recencyScore * 0.5) * 
                           this.options.accessWeight;
    
    // 缓存重要度
    this.importanceCache.set(memory.id, {
      importance: decayedImportance,
      calculatedAt: now,
    });
    
    return Math.max(decayedImportance, this.options.minImportance);
  }
  
  /**
   * 评估记忆重要度（多维度）
   * @param {Object} memory - 记忆对象
   * @returns {Object} 重要度评估结果
   */
  evaluateImportance(memory) {
    const scores = {
      // 1. 内容质量（长度、结构、完整性）
      contentQuality: this._evaluateContentQuality(memory),
      
      // 2. 访问频率
      accessFrequency: Math.min((memory.accessCount || 0) / 50, 1),
      
      // 3. 时间相关性（最近访问时间）
      timeRelevance: this._calculateTimeRelevance(memory),
      
      // 4. 关联度（与其他记忆的关联数量）
      connectivity: this._evaluateConnectivity(memory),
      
      // 5. 用户反馈（如果有）
      userFeedback: memory.userRating || 0.5,
    };
    
    // 加权综合评分
    const weights = {
      contentQuality: 0.3,
      accessFrequency: 0.2,
      timeRelevance: 0.2,
      connectivity: 0.15,
      userFeedback: 0.15,
    };
    
    const totalScore = Object.entries(scores).reduce(
      (sum, [key, score]) => sum + score * weights[key],
      0
    );
    
    return {
      totalScore,
      dimensions: scores,
      weights,
      recommendation: totalScore > 0.7 ? 'keep' : 
                     totalScore > 0.4 ? 'distill' : 'archive',
    };
  }
  
  /**
   * 自动蒸馏记忆（提取关键信息）
   * @param {Object} memory - 记忆对象
   * @returns {Object} 蒸馏后的记忆
   */
  distillMemory(memory) {
    const distilled = {
      id: memory.id,
      originalId: memory.id,
      distilledAt: Date.now(),
      originalLength: JSON.stringify(memory).length,
      
      // 提取关键信息
      keyPoints: this._extractKeyPoints(memory),
      summary: this._generateSummary(memory),
      tags: this._extractTags(memory),
      
      // 保留元数据
      createdAt: memory.createdAt,
      lastAccessedAt: memory.lastAccessedAt,
      accessCount: memory.accessCount,
      
      // 降低存储需求
      distilled: true,
    };
    
    distilled.distilledLength = JSON.stringify(distilled).length;
    distilled.compressionRatio = distilled.distilledLength / distilled.originalLength;
    
    return distilled;
  }
  
  /**
   * 优化记忆存储（分层存储策略）
   * @param {Array} memories - 记忆数组
   * @returns {Object} 存储优化结果
   */
  async optimizeStorage(memories) {
    const now = Date.now();
    const hotMemories = [];
    const warmMemories = [];
    const coldMemories = [];
    
    for (const memory of memories) {
      const daysSinceAccess = (now - (memory.lastAccessedAt || memory.createdAt)) / 
                             (1000 * 60 * 60 * 24);
      const importance = this.calculateDecayedImportance(memory);
      
      // 分层策略
      if (daysSinceAccess < 7 && importance > 0.7) {
        hotMemories.push(memory); // 热存储：7天内高频重要记忆
      } else if (daysSinceAccess < 90 && importance > 0.4) {
        warmMemories.push(memory); // 温存储：90天内中等重要记忆
      } else {
        coldMemories.push(memory); // 冷存储：其他记忆
      }
    }
    
    // 确保存储目录存在
    await this._ensureStorageDirs();
    
    // 写入分层存储
    const results = {
      hot: await this._writeMemories(hotMemories, this.options.hotStoragePath),
      warm: await this._writeMemories(warmMemories, this.options.warmStoragePath),
      cold: await this._writeMemories(coldMemories, this.options.coldStoragePath),
    };
    
    return {
      total: memories.length,
      hotCount: hotMemories.length,
      warmCount: warmMemories.length,
      coldCount: coldMemories.length,
      storagePaths: {
        hot: this.options.hotStoragePath,
        warm: this.options.warmStoragePath,
        cold: this.options.coldStoragePath,
      },
      results,
    };
  }
  
  /**
   * 批量处理记忆衰减
   * @param {Array} memories - 记忆数组
   * @returns {Object} 处理结果
   */
  async processMemories(memories) {
    const results = {
      processed: 0,
      distilled: 0,
      archived: 0,
      errors: [],
    };
    
    for (const memory of memories) {
      try {
        // 1. 计算衰减后的重要度
        const decayedImportance = this.calculateDecayedImportance(memory);
        
        // 2. 评估重要度
        const evaluation = this.evaluateImportance(memory);
        
        // 3. 根据评估结果处理
        if (evaluation.recommendation === 'distill') {
          // 蒸馏记忆
          const distilled = this.distillMemory(memory);
          results.distilled++;
          
          // 更新记忆
          Object.assign(memory, distilled);
        } else if (evaluation.recommendation === 'archive') {
          // 归档记忆
          memory.archived = true;
          memory.archivedAt = Date.now();
          results.archived++;
        }
        
        // 4. 更新记忆重要度
        memory.importance = decayedImportance;
        memory.lastDecayAt = Date.now();
        
        results.processed++;
      } catch (error) {
        results.errors.push({
          memoryId: memory.id,
          error: error.message,
        });
      }
    }
    
    return results;
  }
  
  // ========== 私有辅助方法 ==========
  
  /**
   * 评估内容质量
   */
  _evaluateContentQuality(memory) {
    const content = JSON.stringify(memory);
    const length = content.length;
    
    // 长度评分（太短或太长都不好）
    let lengthScore = 0;
    if (length > 100 && length < 5000) {
      lengthScore = 1.0;
    } else if (length >= 50 && length <= 10000) {
      lengthScore = 0.7;
    } else {
      lengthScore = 0.3;
    }
    
    // 结构评分（是否有结构化字段）
    const hasStructure = memory.summary || memory.tags || memory.keyPoints;
    const structureScore = hasStructure ? 1.0 : 0.5;
    
    return (lengthScore + structureScore) / 2;
  }
  
  /**
   * 计算时间相关性
   */
  _calculateTimeRelevance(memory) {
    const now = Date.now();
    const lastAccessedAt = memory.lastAccessedAt || memory.createdAt || now;
    const daysSinceAccess = (now - lastAccessedAt) / (1000 * 60 * 60 * 24);
    
    // 越近期访问，得分越高
    if (daysSinceAccess < 1) return 1.0;
    if (daysSinceAccess < 7) return 0.8;
    if (daysSinceAccess < 30) return 0.5;
    if (daysSinceAccess < 90) return 0.2;
    return 0.0;
  }
  
  /**
   * 评估关联度
   */
  _evaluateConnectivity(memory) {
    // 简单实现：检查是否有相关记忆ID
    const relatedCount = (memory.relatedMemories || []).length;
    return Math.min(relatedCount / 10, 1); // 最多10个关联
  }
  
  /**
   * 提取关键点
   */
  _extractKeyPoints(memory) {
    // 改进：只提取前50个字符，并分割成最多2个关键点
    const content = memory.content || JSON.stringify(memory);
    const shortContent = content.substring(0, 50);
    const sentences = shortContent.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 2).map(s => s.trim().substring(0, 20)); // 每个关键点最多20字符
  }
  
  /**
   * 生成摘要
   */
  _generateSummary(memory) {
    // 改进：只取前30个字符作为摘要
    const content = memory.content || JSON.stringify(memory);
    return content.substring(0, 30);
  }
  
  /**
   * 提取标签
   */
  _extractTags(memory) {
    // 改进：只提取前2个唯一关键词
    const content = (memory.content || '') + ' ' + (memory.summary || '');
    const words = content.match(/\b\w{4,}\b/g) || [];
    return [...new Set(words)].slice(0, 2); // 最多2个唯一关键词
  }
  
  /**
   * 确保存储目录存在
   */
  async _ensureStorageDirs() {
    const dirs = [
      this.options.hotStoragePath,
      this.options.warmStoragePath,
      this.options.coldStoragePath,
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
  
  /**
   * 写入记忆到指定路径
   */
  async _writeMemories(memories, dirPath) {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };
    
    for (const memory of memories) {
      try {
        const filePath = path.join(dirPath, `${memory.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(memory, null, 2));
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          memoryId: memory.id,
          error: error.message,
        });
      }
    }
    
    return results;
  }
}

/**
 * 创建记忆衰减引擎实例
 */
export function createMemoryDecayEngine(options = {}) {
  return new MemoryDecayEngine(options);
}

/**
 * 计算记忆衰减（便捷函数）
 */
export async function calculateDecay(memories, options = {}) {
  const engine = createMemoryDecayEngine(options);
  return memories.map(m => ({
    ...m,
    decayedImportance: engine.calculateDecayedImportance(m),
  }));
}

/**
 * 评估记忆重要度（便捷函数）
 */
export async function evaluateImportance(memories, options = {}) {
  const engine = createMemoryDecayEngine(options);
  return memories.map(m => ({
    memory: m,
    evaluation: engine.evaluateImportance(m),
  }));
}

/**
 * 蒸馏记忆（便捷函数）
 */
export async function distillMemories(memories, options = {}) {
  const engine = createMemoryDecayEngine(options);
  return memories.map(m => engine.distillMemory(m));
}

/**
 * 优化存储（便捷函数）
 */
export async function optimizeStorage(memories, options = {}) {
  const engine = createMemoryDecayEngine(options);
  return engine.optimizeStorage(memories);
}
