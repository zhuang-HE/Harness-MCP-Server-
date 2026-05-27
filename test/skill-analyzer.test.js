/**
 * Skill Analyzer Test - 技能分析器测试
 * 测试 harness_skill_analyze Tool
 * 版本: v4.0.0 (Stage 2)
 * 日期: 2026-05-27
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.join(__dirname, '..', 'index.js');
const TEMP_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'));

/**
 * 启动 MCP Server
 */
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';
    let initialized = false;

    server.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[Server stderr]: ${output.trim()}`);

      if (output.includes('Harness MCP Server started')) {
        initialized = true;
        resolve(server);
      }
    });

    server.on('error', (error) => {
      reject(error);
    });

    // 发送 initialize 请求
    const initRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    }) + '\n';

    server.stdin.write(initRequest);
  });
}

/**
 * 发送请求到 Server
 */
function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const response = JSON.parse(line);
          if (response.id === request.id) {
            server.stdout.removeListener('data', onData);
            resolve(response);
          }
        } catch {
          // 忽略不完整 JSON
        }
      }

      buffer = lines[lines.length - 1] || '';
    };

    server.stdout.on('data', onData);

    const requestStr = JSON.stringify(request) + '\n';
    server.stdin.write(requestStr);
  });
}

/**
 * 创建测试 Skill 文件
 */
async function createTestSkill() {
  const skillDir = path.join(TEMP_DIR, 'test-skill');
  await fs.mkdir(skillDir, { recursive: true });

  const skillContent = `---
name: test-skill
description: A test skill for testing
agent_created: true
---

# Test Skill

This is a test skill.

\`\`\`javascript
console.log("debug message");
replace_in_file();
\`\`\`

## Example
\`\`\`bash
echo "test"
\`\`\`
`;

  const skillPath = path.join(skillDir, 'SKILL.md');
  await fs.writeFile(skillPath, skillContent, 'utf-8');

  return skillPath;
}

/**
 * 主测试函数
 */
async function runTests() {
  let server;
  let passed = 0;
  let failed = 0;

  try {
    console.log('🧪 Starting Skill Analyzer tests...\n');

    // 启动 Server
    console.log('📦 Starting MCP Server...');
    server = await startServer();
    console.log('✅ Server started\n');

    // 测试1：tools/list 包含 harness_skill_analyze
    console.log('🔍 Test 1: tools/list should include harness_skill_analyze');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      const tools = response.result.tools;
      const hasSkillAnalyze = tools.some(t => t.name === 'harness_skill_analyze');

      if (hasSkillAnalyze) {
        console.log('✅ Test 1 passed: harness_skill_analyze found in tools/list\n');
        passed++;
      } else {
        console.log('❌ Test 1 failed: harness_skill_analyze not found in tools/list');
        console.log('   Available tools:', tools.map(t => t.name).join(', '));
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 1 failed: ${error.message}\n`);
      failed++;
    }

    // 创建测试 Skill
    const testSkillPath = await createTestSkill();
    console.log(`📝 Created test skill: ${testSkillPath}\n`);

    // 测试2：调用 harness_skill_analyze (单文件分析)
    console.log('🔍 Test 2: Call harness_skill_analyze (single file)');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'harness_skill_analyze',
          arguments: {
            skillPath: testSkillPath,
            verbose: true,
            format: 'json',
          },
        },
      });

      if (response.result && !response.result.isError) {
        const result = JSON.parse(response.result.content[0].text);
        
        if (result.success && result.skillName === 'test-skill') {
          console.log('✅ Test 2 passed: Skill analysis successful');
          console.log(`   Skill: ${result.skillName}`);
          console.log(`   Issues found: ${result.issuesFound}`);
          console.log(`   Quality score: ${result.qualityScore}/100`);
          console.log(`   Summary: ${result.summary}\n`);
          passed++;
        } else {
          console.log('❌ Test 2 failed: Unexpected result');
          console.log('   Result:', JSON.stringify(result, null, 2));
          failed++;
        }
      } else {
        console.log('❌ Test 2 failed: Tool returned error');
        console.log('   Response:', JSON.stringify(response, null, 2));
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 2 failed: ${error.message}\n`);
      failed++;
    }

    // 测试3：调用 harness_skill_analyze (扫描目录)
    console.log('🔍 Test 3: Call harness_skill_analyze (scan directory)');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'harness_skill_analyze',
          arguments: {
            skillPath: TEMP_DIR,
            scanDirectory: true,
            verbose: false,
            format: 'markdown',
          },
        },
      });

      if (response.result && !response.result.isError) {
        const result = JSON.parse(response.result.content[0].text);
        
        if (result.success && result.scanned && result.skillsFound >= 1) {
          console.log('✅ Test 3 passed: Directory scan successful');
          console.log(`   Skills found: ${result.skillsFound}`);
          console.log(`   Skills analyzed: ${result.skillsAnalyzed}`);
          console.log(`   Total issues: ${result.totalIssues}`);
          console.log(`   Summary: ${JSON.stringify(result.summary)}\n`);
          passed++;
        } else {
          console.log('❌ Test 3 failed: Unexpected result');
          console.log('   Result:', JSON.stringify(result, null, 2));
          failed++;
        }
      } else {
        console.log('❌ Test 3 failed: Tool returned error');
        console.log('   Response:', JSON.stringify(response, null, 2));
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 3 failed: ${error.message}\n`);
      failed++;
    }

    // 测试4：调用 harness_skill_analyze (自动修复)
    console.log('🔍 Test 4: Call harness_skill_analyze (auto-fix)');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'harness_skill_analyze',
          arguments: {
            skillPath: testSkillPath,
            fix: true,
            verbose: false,
          },
        },
      });

      if (response.result && !response.result.isError) {
        const result = JSON.parse(response.result.content[0].text);
        
        console.log('✅ Test 4 passed: Auto-fix attempted');
        console.log(`   Fixed: ${result.fixed}`);
        console.log(`   Fixed issues: ${result.fixedIssues ? result.fixedIssues.length : 0}\n`);
        passed++;
      } else {
        console.log('❌ Test 4 failed: Tool returned error');
        console.log('   Response:', JSON.stringify(response, null, 2));
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 4 failed: ${error.message}\n`);
      failed++;
    }

    // 测试5：调用 harness_skill_analyze (错误路径)
    console.log('🔍 Test 5: Call harness_skill_analyze (invalid path)');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'harness_skill_analyze',
          arguments: {
            skillPath: '/invalid/path/that/does/not/exist',
          },
        },
      });

      if (response.result && response.result.isError) {
        console.log('✅ Test 5 passed: Correctly returned error for invalid path\n');
        passed++;
      } else {
        console.log('❌ Test 5 failed: Should have returned error for invalid path\n');
        failed++;
      }
    } catch (error) {
      console.log(`✅ Test 5 passed: Correctly threw error for invalid path\n`);
      passed++;
    }

    // 输出测试摘要
    console.log('---');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${passed + failed}\n`);

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    if (server) {
      server.kill();
    }

    // 清理临时目录
    fsSync.rm(TEMP_DIR, { recursive: true, force: true }, () => {});
  }

  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
