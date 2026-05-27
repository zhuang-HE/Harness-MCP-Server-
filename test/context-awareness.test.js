/**
 * Context Awareness Test - 上下文感知测试
 * 测试 harness_context_aware Tool
 * 版本: v4.0.0 (Stage 3)
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

    server.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[Server stderr]: ${output.trim()}`);

      if (output.includes('Harness MCP Server started')) {
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
 * 创建测试项目目录
 */
async function createTestProject() {
  const projectDir = path.join(TEMP_DIR, 'test-project');
  await fs.mkdir(projectDir, { recursive: true });

  // 创建 package.json
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    description: 'A test project for context awareness',
    dependencies: {
      react: '^18.0.0',
    },
  };

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf-8'
  );

  // 创建 README.md
  await fs.writeFile(
    path.join(projectDir, 'README.md'),
    '# Test Project\n\nThis is a test project.',
    'utf-8'
  );

  return projectDir;
}

/**
 * 主测试函数
 */
async function runTests() {
  let server;
  let passed = 0;
  let failed = 0;

  try {
    console.log('🧪 Starting Context Awareness tests...\n');

    // 启动 Server
    console.log('📦 Starting MCP Server...');
    server = await startServer();
    console.log('✅ Server started\n');

    // 测试1: tools/list 包含 harness_context_aware
    console.log('🔍 Test 1: tools/list should include harness_context_aware');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      const tools = response.result.tools;
      const hasContextAware = tools.some(t => t.name === 'harness_context_aware');

      if (hasContextAware) {
        console.log('✅ Test 1 passed: harness_context_aware found in tools/list\n');
        passed++;
      } else {
        console.log('❌ Test 1 failed: harness_context_aware not found in tools/list');
        console.log('   Available tools:', tools.map(t => t.name).join(', '));
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 1 failed: ${error.message}\n`);
      failed++;
    }

    // 测试2: 调用 harness_context_aware (无项目路径)
    console.log('🔍 Test 2: Call harness_context_aware (no project)');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'harness_context_aware',
          arguments: {
            task: 'Create a React component for user profile',
          },
        },
      });

      if (response.result && !response.result.isError) {
        const result = JSON.parse(response.result.content[0].text);
        
        if (result.success && result.task) {
          console.log('✅ Test 2 passed: Context analysis successful');
          console.log(`   Task: ${result.task}`);
          console.log(`   Task type: ${result.context?.taskType}`);
          console.log(`   Confidence: ${result.confidence}`);
          console.log(`   Recommendations: ${result.recommendations?.length || 0}\n`);
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

    // 创建测试项目
    const testProjectPath = await createTestProject();
    console.log(`📁 Created test project: ${testProjectPath}\n`);

    // 测试3: 调用 harness_context_aware (有项目路径)
    console.log('🔍 Test 3: Call harness_context_aware (with project)');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'harness_context_aware',
          arguments: {
            task: 'Review the code in this project',
            project: testProjectPath,
            includeHistory: true,
          },
        },
      });

      if (response.result && !response.result.isError) {
        const result = JSON.parse(response.result.content[0].text);
        
        if (result.success && result.context?.project?.exists) {
          console.log('✅ Test 3 passed: Project context analysis successful');
          console.log(`   Project type: ${result.context.project.type}`);
          console.log(`   Project language: ${result.context.project.language}`);
          console.log(`   Has package.json: ${result.context.project.hasPackageJson}`);
          console.log(`   Recommendations: ${result.recommendations?.length || 0}\n`);
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

    // 测试4: 调用 harness_context_aware (任务类型识别)
    console.log('🔍 Test 4: Call harness_context_aware (task type identification)');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'harness_context_aware',
          arguments: {
            task: 'Fix the bug in the login function',
            sessionId: 'test-session-1',
          },
        },
      });

      if (response.result && !response.result.isError) {
        const result = JSON.parse(response.result.content[0].text);
        
        if (result.success && result.context?.taskType === 'debugging') {
          console.log('✅ Test 4 passed: Task type correctly identified');
          console.log(`   Task type: ${result.context.taskType}`);
          console.log(`   Confidence: ${result.confidence}\n`);
          passed++;
        } else {
          console.log('❌ Test 4 failed: Task type not correctly identified');
          console.log('   Expected: debugging');
          console.log('   Actual:', result.context?.taskType);
          failed++;
        }
      } else {
        console.log('❌ Test 4 failed: Tool returned error');
        console.log('   Response:', JSON.stringify(response, null, 2));
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 4 failed: ${error.message}\n`);
      failed++;
    }

    // 测试5: 调用 harness_context_aware (缺少必需参数)
    console.log('🔍 Test 5: Call harness_context_aware (missing required param)');
    try {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'harness_context_aware',
          arguments: {
            // 缺少 task 参数
            project: testProjectPath,
          },
        },
      });

      if (response.result && response.result.isError) {
        console.log('✅ Test 5 passed: Correctly returned error for missing param\n');
        passed++;
      } else {
        console.log('❌ Test 5 failed: Should have returned error for missing param\n');
        failed++;
      }
    } catch (error) {
      console.log(`✅ Test 5 passed: Correctly threw error for missing param\n`);
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
