/**
 * Context Awareness Engine - 上下文感知引擎
 * 功能：任务识别、偏好学习、项目跟踪、上下文管理
 * 版本: v4.0.0 (Stage 3)
 * 日期: 2026-05-27
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 上下文感知结果接口
 */
export class ContextAwareness {
  constructor() {
    this.projectContext = null;
    this.userPreferences = new Map();
    this.taskHistory = [];
    this.contextCache = new Map();
  }

  /**
   * 分析任务上下文
   * @param {Object} params - 分析参数
   * @param {string} params.task - 任务描述
   * @param {string} params.project - 项目路径
   * @param {Object} [params.options] - 可选参数
   * @returns {Promise<Object>} 上下文感知结果
   */
  async analyzeTask(params) {
    const { task, project, options = {} } = params;
    
    if (!task || typeof task !== 'string') {
      throw new Error('Invalid task parameter: must be a non-empty string');
    }

    const awareness = {
      task,
      project: project || null,
      timestamp: new Date().toISOString(),
      context: {},
      recommendations: [],
      confidence: 0,
    };

    try {
      // 1. 项目上下文分析
      if (project) {
        awareness.context.project = await this._analyzeProjectContext(project);
      }

      // 2. 任务类型识别
      awareness.context.taskType = this._identifyTaskType(task);

      // 3. 用户偏好匹配
      awareness.context.preferences = this._matchUserPreferences(task);

      // 4. 历史任务关联
      awareness.context.relatedTasks = this._findRelatedTasks(task);

      // 5. 生成建议
      awareness.recommendations = this._generateRecommendations(awareness.context);

      // 6. 计算置信度
      awareness.confidence = this._calculateConfidence(awareness.context);

      // 7. 更新任务历史
      this._updateTaskHistory(task, awareness);

      return awareness;
    } catch (error) {
      console.error('❌ Context analysis failed:', error);
      throw error;
    }
  }

  /**
   * 分析项目上下文
   * @private
   */
  async _analyzeProjectContext(projectPath) {
    const context = {
      path: projectPath,
      exists: false,
      type: 'unknown',
      language: null,
      framework: null,
      hasPackageJson: false,
      hasReadme: false,
    };

    try {
      const stats = await fs.stat(projectPath).catch(() => null);
      if (!stats || !stats.isDirectory()) {
        return context;
      }

      context.exists = true;

      // 检测项目类型
      const files = await fs.readdir(projectPath);
      
      if (files.includes('package.json')) {
        context.hasPackageJson = true;
        const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
        context.type = 'node.js';
        context.language = 'javascript';
        context.framework = packageJson.dependencies?.react ? 'react' :
                          packageJson.dependencies?.vue ? 'vue' :
                          packageJson.dependencies?.express ? 'express' : 'node';
      } else if (files.includes('pom.xml')) {
        context.type = 'java';
        context.language = 'java';
        context.framework = 'maven';
      } else if (files.includes('requirements.txt') || files.includes('setup.py')) {
        context.type = 'python';
        context.language = 'python';
      } else if (files.includes('Cargo.toml')) {
        context.type = 'rust';
        context.language = 'rust';
      } else if (files.includes('go.mod')) {
        context.type = 'go';
        context.language = 'go';
      }

      context.hasReadme = files.some(f => f.toLowerCase().startsWith('readme'));

      return context;
    } catch (error) {
      console.error('⚠️  Project context analysis failed:', error.message);
      return context;
    }
  }

  /**
   * 识别任务类型
   * @private
   */
  _identifyTaskType(task) {
    const taskLower = task.toLowerCase();

    const typePatterns = [
      { type: 'code-generation', patterns: ['create', 'write', 'implement', 'build', 'generate', '创建', '编写', '实现', '构建'] },
      { type: 'code-review', patterns: ['review', 'check', 'audit', 'analyze', '评审', '检查', '审计', '分析'] },
      { type: 'debugging', patterns: ['debug', 'fix', 'error', 'bug', 'issue', '修复', '错误', '问题'] },
      { type: 'refactoring', patterns: ['refactor', 'optimize', 'improve', 'clean', '重构', '优化', '改进'] },
      { type: 'documentation', patterns: ['document', 'readme', 'comment', '文档', '注释'] },
      { type: 'testing', patterns: ['test', 'spec', 'coverage', '测试', '覆盖率'] },
      { type: 'deployment', patterns: ['deploy', 'release', 'publish', '部署', '发布'] },
      { type: 'data-analysis', patterns: ['analyze', 'visualize', 'chart', '分析', '可视化', '图表'] },
    ];

    for (const { type, patterns } of typePatterns) {
      if (patterns.some(p => taskLower.includes(p))) {
        return type;
      }
    }

    return 'general';
  }

  /**
   * 匹配用户偏好
   * @private
   */
  _matchUserPreferences(task) {
    const preferences = {
      preferredTools: [],
      codingStyle: 'standard',
      language: 'chinese',
    };

    // 从用户历史偏好中学习
    for (const [key, value] of this.userPreferences) {
      if (task.toLowerCase().includes(key.toLowerCase())) {
        preferences.preferredTools.push(...value.tools || []);
        preferences.codingStyle = value.codingStyle || preferences.codingStyle;
        preferences.language = value.language || preferences.language;
      }
    }

    return preferences;
  }

  /**
   * 查找相关任务
   * @private
   */
  _findRelatedTasks(task) {
    const related = [];
    const taskKeywords = task.toLowerCase().split(/\s+/);

    for (const historyTask of this.taskHistory) {
      const historyKeywords = historyTask.task.toLowerCase().split(/\s+/);
      const commonKeywords = taskKeywords.filter(k => historyKeywords.includes(k));
      
      if (commonKeywords.length > 0) {
        related.push({
          task: historyTask.task,
          timestamp: historyTask.timestamp,
          relevance: commonKeywords.length / Math.max(taskKeywords.length, 1),
        });
      }
    }

    return related
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
  }

  /**
   * 生成建议
   * @private
   */
  _generateRecommendations(context) {
    const recommendations = [];

    // 基于项目类型的建议
    if (context.project?.type === 'node.js') {
      recommendations.push({
        type: 'tool',
        message: '建议使用 npm/yarn 进行依赖管理',
        priority: 'medium',
      });
    }

    // 基于任务类型的建议
    if (context.taskType === 'code-review') {
      recommendations.push({
        type: 'process',
        message: '建议先运行测试，再进行代码审查',
        priority: 'high',
      });
    }

    // 基于历史任务的建议
    if (context.relatedTasks.length > 0) {
      recommendations.push({
        type: 'reference',
        message: `发现 ${context.relatedTasks.length} 个相关历史任务，可供参考`,
        priority: 'low',
      });
    }

    return recommendations;
  }

  /**
   * 计算置信度
   * @private
   */
  _calculateConfidence(context) {
    let confidence = 0.5; // 基础置信度

    // 项目上下文完整度
    if (context.project?.exists) {
      confidence += 0.2;
    }

    // 任务类型识别准确度
    if (context.taskType !== 'general') {
      confidence += 0.15;
    }

    // 用户偏好匹配度
    if (context.preferences.preferredTools.length > 0) {
      confidence += 0.1;
    }

    // 历史任务关联度
    if (context.relatedTasks.length > 0) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 更新任务历史
   * @private
   */
  _updateTaskHistory(task, awareness) {
    this.taskHistory.push({
      task,
      timestamp: awareness.timestamp,
      context: awareness.context,
    });

    // 限制历史记录大小
    if (this.taskHistory.length > 100) {
      this.taskHistory = this.taskHistory.slice(-100);
    }
  }

  /**
   * 学习用户偏好
   * @param {string} task - 任务描述
   * @param {Object} feedback - 用户反馈
   */
  learnFromFeedback(task, feedback) {
    const keywords = task.toLowerCase().split(/\s+/).filter(k => k.length > 3);
    
    for (const keyword of keywords) {
      const existing = this.userPreferences.get(keyword) || {
        count: 0,
        tools: [],
        codingStyle: 'standard',
        language: 'chinese',
      };

      existing.count++;
      
      if (feedback.preferredTools) {
        existing.tools = [...new Set([...existing.tools, ...feedback.preferredTools])];
      }
      
      if (feedback.codingStyle) {
        existing.codingStyle = feedback.codingStyle;
      }
      
      if (feedback.language) {
        existing.language = feedback.language;
      }

      this.userPreferences.set(keyword, existing);
    }
  }

  /**
   * 清除上下文缓存
   */
  clearCache() {
    this.contextCache.clear();
    this.taskHistory = [];
    this.userPreferences.clear();
  }

  /**
   * 获取上下文统计信息
   */
  getStats() {
    return {
      taskHistorySize: this.taskHistory.length,
      userPreferencesCount: this.userPreferences.size,
      contextCacheSize: this.contextCache.size,
    };
  }
}

/**
 * 创建上下文感知实例
 */
export function createContextAwareness() {
  return new ContextAwareness();
}

/**
 * 快速分析任务上下文（便捷函数）
 * @param {string} task - 任务描述
 * @param {string} [project] - 项目路径
 * @returns {Promise<Object>} 上下文感知结果
 */
export async function quickAnalyze(task, project = null) {
  const engine = createContextAwareness();
  return await engine.analyzeTask({ task, project });
}
