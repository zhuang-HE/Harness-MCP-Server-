/**
 * Skill Analyzer Engine - 技能分析引擎
 * 功能：扫描技能文件、检测问题、生成审计报告、自动修复
 * 版本: v4.0.0 (Stage 2)
 * 日期: 2026-05-27
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 审计规则定义
 */
const AUDIT_RULES = [
  // Frontmatter 规则
  {
    id: 'F1',
    severity: 'P1',
    category: 'frontmatter',
    message: '缺少 frontmatter (--- 分隔符)',
    check: (content) => {
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
      return !match;
    },
  },
  {
    id: 'F2',
    severity: 'P1',
    category: 'frontmatter',
    message: 'frontmatter 缺少 agent_created 字段',
    check: (content) => {
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!match) return true;
      const fm = match[1];
      return !fm.includes('agent_created:');
    },
  },
  {
    id: 'F3',
    severity: 'P2',
    category: 'frontmatter',
    message: 'frontmatter 格式错误（字段缺冒号）',
    check: (content) => {
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!match) return false;
      const fm = match[1];
      const lines = fm.split('\n');
      return lines.some(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return false;
        return !trimmed.includes(':') && !trimmed.startsWith('-');
      });
    },
  },
  
  // 路径规则
  {
    id: 'P1',
    severity: 'P0',
    category: 'path',
    message: 'SKILL.md 与目录名不匹配',
    check: (content, skillPath) => {
      const dirName = path.basename(path.dirname(skillPath));
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!match) return false;
      const fm = match[1];
      const nameMatch = fm.match(/^name:\s*(.+)$/m);
      if (!nameMatch) return false;
      const skillName = nameMatch[1].trim();
      return skillName !== dirName;
    },
  },
  {
    id: 'P2',
    severity: 'P1',
    category: 'path',
    message: '使用 replace_in_file 而非 Edit 工具',
    check: (content) => {
      return content.includes('replace_in_file');
    },
  },
  
  // 代码质量规则
  {
    id: 'C1',
    severity: 'P2',
    category: 'code-quality',
    message: '包含 console.log 调试语句',
    check: (content) => {
      return /console\.(log|debug|info)\s*\(/.test(content);
    },
  },
  {
    id: 'C2',
    severity: 'P1',
    category: 'code-quality',
    message: '包含 TODO/FIXME 注释',
    check: (content) => {
      return /(TODO|FIXME|HACK|XXX)\s*:/.test(content);
    },
  },
  {
    id: 'C3',
    severity: 'P2',
    category: 'code-quality',
    message: '函数缺少 JSDoc 注释',
    check: (content) => {
      const funcMatches = content.match(/^export\s+(async\s+)?function\s+\w+/gm);
      if (!funcMatches) return false;
      
      for (const funcMatch of funcMatches) {
        const funcName = funcMatch.replace(/^export\s+(async\s+)?function\s+/, '');
        const funcIndex = content.indexOf(funcMatch);
        const linesBefore = content.substring(0, funcIndex).split('\n');
        const lastLine = linesBefore[linesBefore.length - 2];
        if (lastLine && !lastLine.trim().startsWith('/**')) {
          return true;
        }
      }
      return false;
    },
  },
  
  // 安全规则
  {
    id: 'S1',
    severity: 'P0',
    category: 'security',
    message: '包含 eval() 调用',
    check: (content) => {
      return /\beval\s*\(/.test(content);
    },
  },
  {
    id: 'S2',
    severity: 'P0',
    category: 'security',
    message: '包含动态 require() 调用',
    check: (content) => {
      return /require\s*\(\s*[^'"`]/.test(content);
    },
  },
  {
    id: 'S3',
    severity: 'P1',
    category: 'security',
    message: '包含 child_process 执行',
    check: (content) => {
      return /(exec|spawn|fork)\s*\(/.test(content) && content.includes('child_process');
    },
  },
  {
    id: 'S4',
    severity: 'P1',
    category: 'security',
    message: '包含网络请求但未检查 HTTPS',
    check: (content) => {
      return /http:\/\//.test(content) && !content.includes('https://');
    },
  },
  
  // 文档规则
  {
    id: 'D1',
    severity: 'P2',
    category: 'documentation',
    message: '缺少使用示例',
    check: (content) => {
      return !content.includes('## Example') && !content.includes('## 示例');
    },
  },
  {
    id: 'D2',
    severity: 'P2',
    category: 'documentation',
    message: '缺少参数说明',
    check: (content) => {
      const hasParams = content.includes('@param') || content.includes('parameters');
      const hasArgs = content.includes('args') || content.includes('arguments');
      return !hasParams && !hasArgs;
    },
  },
];

/**
 * 分析单个 Skill
 */
export async function analyzeSkill(skillPath, options = {}) {
  const { fix = false, verbose = false } = options;
  
  const results = {
    skillPath,
    skillName: null,
    issues: [],
    fixed: false,
    fixedIssues: [],
    score: 0,
    summary: '',
  };
  
  try {
    // 1. 读取 Skill 文件
    const content = await fs.readFile(skillPath, 'utf-8');
    const fileName = path.basename(skillPath);
    
    // 2. 提取 skill name
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
      results.skillName = nameMatch[1].trim();
    }
    
    if (verbose) {
      console.error(`📋 Analyzing: ${skillPath}`);
    }
    
    // 3. 运行审计规则
    for (const rule of AUDIT_RULES) {
      try {
        const failed = rule.check(content, skillPath);
        if (failed) {
          results.issues.push({
            ruleId: rule.id,
            severity: rule.severity,
            category: rule.category,
            message: rule.message,
            path: skillPath,
            autoFixable: isAutoFixable(rule.id),
          });
        }
      } catch (error) {
        if (verbose) {
          console.error(`⚠️  Rule ${rule.id} failed:`, error.message);
        }
      }
    }
    
    // 4. 自动修复（如果启用）
    if (fix && results.issues.some(i => i.autoFixable)) {
      const { fixedContent, fixedIssues } = await autoFixContent(content, results.issues);
      
      if (fixedIssues.length > 0) {
        await fs.writeFile(skillPath, fixedContent, 'utf-8');
        results.fixed = true;
        results.fixedIssues = fixedIssues;
        
        if (verbose) {
          console.error(`🔧 Auto-fixed ${fixedIssues.length} issues`);
        }
      }
    }
    
    // 5. 计算质量评分
    results.score = calculateQualityScore(results.issues);
    results.summary = generateSummary(results);
    
  } catch (error) {
    results.error = error.message;
  }
  
  return results;
}

/**
 * 判断规则是否可自动修复
 */
function isAutoFixable(ruleId) {
  const autoFixableRules = [
    'F3', // frontmatter 格式错误 - 可尝试修复
    'C1', // console.log - 可移除
    'P2', // replace_in_file - 可替换
  ];
  return autoFixableRules.includes(ruleId);
}

/**
 * 自动修复内容
 */
async function autoFixContent(content, issues) {
  let fixedContent = content;
  const fixedIssues = [];
  
  for (const issue of issues) {
    if (!issue.autoFixable) continue;
    
    try {
      switch (issue.ruleId) {
        case 'F3': {
          // 尝试修复 frontmatter 格式
          const fixed = fixFrontmatterFormat(fixedContent);
          if (fixed !== fixedContent) {
            fixedContent = fixed;
            fixedIssues.push(issue);
          }
          break;
        }
        
        case 'C1': {
          // 移除 console.log 语句
          const fixed = fixedContent.replace(/^\s*console\.(log|debug|info)\s*\([^)]*\);?\s*$/gm, '');
          if (fixed !== fixedContent) {
            fixedContent = fixed;
            fixedIssues.push(issue);
          }
          break;
        }
        
        case 'P2': {
          // 替换 replace_in_file 为 Edit
          const fixed = fixedContent.replace(/replace_in_file/g, 'Edit');
          if (fixed !== fixedContent) {
            fixedContent = fixed;
            fixedIssues.push(issue);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`⚠️  Auto-fix failed for ${issue.ruleId}:`, error.message);
    }
  }
  
  return { fixedContent, fixedIssues };
}

/**
 * 修复 frontmatter 格式
 */
function fixFrontmatterFormat(content) {
  return content.replace(/^---\s*\n([\s\S]*?)\n---/g, (match, fm) => {
    const lines = fm.split('\n');
    const fixedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
        return line;
      }
      if (!trimmed.includes(':') && trimmed.includes(' ')) {
        return trimmed.replace(/^(\S+)\s+(.+)$/, '$1: $2');
      }
      return line;
    });
    return `---\n${fixedLines.join('\n')}\n---`;
  });
}

/**
 * 计算质量评分
 */
function calculateQualityScore(issues) {
  const weights = {
    'P0': 20,
    'P1': 10,
    'P2': 5,
    'P3': 2,
  };
  
  const deductions = issues.reduce((sum, issue) => {
    return sum + (weights[issue.severity] || 0);
  }, 0);
  
  return Math.max(0, 100 - deductions);
}

/**
 * 生成摘要
 */
function generateSummary(results) {
  const { issues, score } = results;
  
  const p0Count = issues.filter(i => i.severity === 'P0').length;
  const p1Count = issues.filter(i => i.severity === 'P1').length;
  const p2Count = issues.filter(i => i.severity === 'P2').length;
  const p3Count = issues.filter(i => i.severity === 'P3').length;
  
  let summary = `质量评分: ${score}/100. `;
  summary += `发现问题: ${issues.length} 个 `;
  summary += `(P0: ${p0Count}, P1: ${p1Count}, P2: ${p2Count}, P3: ${p3Count})`;
  
  if (results.fixed) {
    summary += `; 已自动修复: ${results.fixedIssues.length} 个`;
  }
  
  return summary;
}

/**
 * 批量分析多个 Skills
 */
export async function analyzeSkills(skillPaths, options = {}) {
  const { concurrency = 3, fix = false, verbose = false } = options;
  
  const results = [];
  
  // 限制并发数
  for (let i = 0; i < skillPaths.length; i += concurrency) {
    const batch = skillPaths.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(skillPath => analyzeSkill(skillPath, { fix, verbose }))
    );
    results.push(...batchResults);
    
    if (verbose) {
      console.error(`📊 Progress: ${results.length}/${skillPaths.length}`);
    }
  }
  
  return results;
}

/**
 * 生成审计报告
 */
export function generateAuditReport(results, format = 'markdown') {
  if (format === 'json') {
    return JSON.stringify(results, null, 2);
  }
  
  let report = '# Skill Audit Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `Total Skills: ${results.length}\n\n`;
  
  // 统计
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const p0Issues = results.flatMap(r => r.issues).filter(i => i.severity === 'P0').length;
  const p1Issues = results.flatMap(r => r.issues).filter(i => i.severity === 'P1').length;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  
  report += `## Summary\n\n`;
  report += `- Total Issues: ${totalIssues}\n`;
  report += `  - P0 (Critical): ${p0Issues}\n`;
  report += `  - P1 (High): ${p1Issues}\n`;
  report += `- Average Quality Score: ${avgScore.toFixed(1)}/100\n\n`;
  
  // 详细结果
  report += `## Details\n\n`;
  
  for (const result of results) {
    report += `### ${result.skillName || 'Unknown'} (${path.basename(path.dirname(result.skillPath))})\n\n`;
    report += `Path: \`${result.skillPath}\`\n\n`;
    report += `Quality Score: **${result.score}/100**\n\n`;
    
    if (result.issues.length === 0) {
      report += `✅ No issues found.\n\n`;
    } else {
      report += `Issues (${result.issues.length}):\n\n`;
      
      const grouped = result.issues.reduce((groups, issue) => {
        const category = issue.category;
        if (!groups[category]) groups[category] = [];
        groups[category].push(issue);
        return groups;
      }, {});
      
      for (const [category, issues] of Object.entries(grouped)) {
        report += `#### ${category}\n\n`;
        for (const issue of issues) {
          const icon = issue.severity === 'P0' ? '🔴' : issue.severity === 'P1' ? '🟠' : issue.severity === 'P2' ? '🟡' : '⚪';
          report += `- ${icon} **${issue.ruleId}** (${issue.severity}): ${issue.message}\n`;
          if (issue.autoFixable) {
            report += `  - Auto-fixable: ✅\n`;
          }
        }
        report += `\n`;
      }
    }
    
    if (result.fixed) {
      report += `🔧 **Auto-fixed ${result.fixedIssues.length} issues**\n\n`;
    }
    
    report += `---\n\n`;
  }
  
  return report;
}

/**
 * 扫描目录查找所有 Skills
 */
export async function scanSkillsDirectory(basePath) {
  const skills = [];
  
  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = path.join(basePath, entry.name, 'SKILL.md');
      try {
        await fs.access(skillPath);
        skills.push(skillPath);
      } catch {
        // 不包含 SKILL.md，跳过
      }
    }
  } catch (error) {
    console.error(`⚠️  Failed to scan directory: ${error.message}`);
  }
  
  return skills;
}
