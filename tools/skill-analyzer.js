/**
 * Skill Analyzer MCP Tool - 技能分析器 Tool 定义
 * 功能：分析 Skill 质量，检测问题，生成审计报告
 * 版本: v4.0.0 (Stage 2)
 * 日期: 2026-05-27
 */

import { analyzeSkill, analyzeSkills, generateAuditReport, scanSkillsDirectory } from '../lib/skill-analyzer-engine.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Tool 定义
 */
export const definition = {
  name: 'harness_skill_analyze',
  description: '分析 Skill 质量，检测问题（P0/P1/P2/P3），生成审计报告。支持单文件分析和批量扫描。',
  inputSchema: {
    type: 'object',
    properties: {
      skillPath: {
        type: 'string',
        description: 'Skill 路径（绝对路径，指向 SKILL.md 文件或包含 SKILL.md 的目录）',
      },
      scanDirectory: {
        type: 'boolean',
        description: '是否扫描整个目录（查找所有 Skills）',
        default: false,
      },
      fix: {
        type: 'boolean',
        description: '是否自动修复问题（仅限可自动修复的问题）',
        default: false,
      },
      verbose: {
        type: 'boolean',
        description: '是否输出详细日志',
        default: false,
      },
      format: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: '报告格式',
        default: 'markdown',
      },
    },
    required: ['skillPath'],
  },
};

/**
 * Tool 处理器
 */
export async function handler(args) {
  const {
    skillPath,
    scanDirectory = false,
    fix = false,
    verbose = false,
    format = 'markdown',
  } = args;

  // 1. 验证路径
  const stats = await fs.stat(skillPath).catch(() => null);
  if (!stats) {
    throw new Error(`Path not found: ${skillPath}`);
  }

  // 2. 扫描目录模式
  if (scanDirectory && stats.isDirectory()) {
    if (verbose) {
      console.error(`📂 Scanning directory: ${skillPath}`);
    }

    const skillPaths = await scanSkillsDirectory(skillPath);
    
    if (skillPaths.length === 0) {
      return {
        success: true,
        scanned: true,
        basePath: skillPath,
        skillsFound: 0,
        message: 'No Skills found in directory',
      };
    }

    if (verbose) {
      console.error(`📋 Found ${skillPaths.length} Skills`);
    }

    // 批量分析
    const results = await analyzeSkills(skillPaths, { fix, verbose });
    
    // 生成报告
    const report = generateAuditReport(results, format);
    
    // 统计
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const p0Count = results.flatMap(r => r.issues).filter(i => i.severity === 'P0').length;
    const fixedCount = results.filter(r => r.fixed).length;
    
    return {
      success: true,
      scanned: true,
      basePath: skillPath,
      skillsFound: skillPaths.length,
      skillsAnalyzed: results.length,
      totalIssues,
      p0Issues: p0Count,
      fixedSkills: fixedCount,
      reportFormat: format,
      report: format === 'json' ? JSON.parse(report) : report,
      summary: generateSummary(results),
    };
  }

  // 3. 单文件分析模式
  let targetPath = skillPath;
  
  // 如果传入的是目录，尝试查找 SKILL.md
  if (stats.isDirectory()) {
    targetPath = path.join(skillPath, 'SKILL.md');
    try {
      await fs.access(targetPath);
    } catch {
      throw new Error(`No SKILL.md found in directory: ${skillPath}`);
    }
  }

  if (verbose) {
    console.error(`🔍 Analyzing: ${targetPath}`);
  }

  // 分析单个 Skill
  const result = await analyzeSkill(targetPath, { fix, verbose });

  // 生成报告
  const report = generateAuditReport([result], format);

  return {
    success: true,
    scanned: false,
    skillPath: targetPath,
    skillName: result.skillName,
    issuesFound: result.issues.length,
    issues: result.issues,
    qualityScore: result.score,
    fixed: result.fixed,
    fixedIssues: result.fixedIssues,
    reportFormat: format,
    report: format === 'json' ? JSON.parse(report) : report,
    summary: result.summary,
  };
}

/**
 * 生成简洁摘要
 */
function generateSummary(results) {
  const total = results.length;
  const withIssues = results.filter(r => r.issues.length > 0).length;
  const fixed = results.filter(r => r.fixed).length;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / total;

  return {
    totalSkills: total,
    skillsWithIssues: withIssues,
    skillsFixed: fixed,
    averageQualityScore: Math.round(avgScore * 10) / 10,
    topIssues: getTopIssues(results),
  };
}

/**
 * 获取最高频问题
 */
function getTopIssues(results) {
  const issueCounts = {};
  
  for (const result of results) {
    for (const issue of result.issues) {
      const key = `${issue.ruleId}:${issue.message}`;
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    }
  }

  return Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({
      issue: key.split(':')[0],
      message: key.split(':').slice(1).join(':'),
      count,
    }));
}
