// test/runtime-guardian.test.js
// 测试 runtime-guardian Tool

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INDEX_JS = path.join(ROOT, 'index.js');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

async function runTest(name, testFn) {
  try {
    await testFn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ❌ ${name}`);
    console.error(`    Error: ${error.message}`);
    errors.push({ name, error: error.message });
    failed++;
  }
}

function sendRequest(proc, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    
    const requestStr = JSON.stringify(request) + '\n';
    proc.stdin.write(requestStr);
    
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 10000);
    
    const onData = (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          if (response.id === id) {
            clearTimeout(timeout);
            proc.stdout.off('data', onData);
            resolve(response);
            return;
          }
        } catch {
          // Ignore parse errors
        }
      }
    };
    
    proc.stdout.on('data', onData);
  });
}

async function main() {
  console.log('🧪 Runtime-Guardian Tool Tests\n');
  
  // 启动 MCP Server
  const proc = spawn('node', [INDEX_JS], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  
  // 等待服务器启动
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  try {
    // Test 1: tools/list 包含 harness_runtime_guardian  
    await runTest('Test 1: tools/list 包含 harness_runtime_guardian', async () => {
      const response = await sendRequest(proc, 1, 'tools/list');
      assert(response.result, 'Should have result');
      assert(Array.isArray(response.result.tools), 'tools should be an array');
      
      const tool = response.result.tools.find(t => t.name === 'harness_runtime_guardian');
      assert(tool, 'Should have harness_runtime_guardian tool');
      assert(tool.description, 'Tool should have description');
      assert(tool.inputSchema, 'Tool should have inputSchema');
    });
    
    // Test 2: 注册任务（register）
    await runTest('Test 2: 注册任务（register）', async () => {
      const response = await sendRequest(proc, 2, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'register',
          taskId: 'test-task-001',
          timeoutMs: 60000,
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'register', 'Action should be register');
      assert(result.taskId === 'test-task-001', 'Should have correct taskId');
      assert(result.startTime > 0, 'Should have startTime');
    });
    
    // Test 3: 更新资源使用（update）
    await runTest('Test 3: 更新资源使用（update）', async () => {
      // 先注册任务
      await sendRequest(proc, 31, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'register',
          taskId: 'test-task-002',
        },
      });
      
      // 更新资源使用
      const response = await sendRequest(proc, 32, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'update',
          taskId: 'test-task-002',
          resourceUsage: {
            memoryMB: 512.5,
            cpuPercent: 45.2,
          },
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'update', 'Action should be update');
      assert(result.taskId === 'test-task-002', 'Should have correct taskId');
    });
    
    // Test 4: 安全检查（check）
    await runTest('Test 4: 安全检查（check）', async () => {
      const response = await sendRequest(proc, 4, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'check',
          command: 'rm -rf /',
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'check', 'Action should be check');
      assert(result.safe === false, 'Should be unsafe (dangerous command)');
      assert(result.errors.length > 0, 'Should have errors');
    });
    
    // Test 5: 处理异常（handle）
    await runTest('Test 5: 处理异常（handle）', async () => {
      // 先注册任务
      await sendRequest(proc, 51, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'register',
          taskId: 'test-task-003',
        },
      });
      
      // 处理异常
      const response = await sendRequest(proc, 52, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'handle',
          taskId: 'test-task-003',
          error: 'Test error message',
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'handle', 'Action should be handle');
      assert(result.recovered !== undefined, 'Should have recovered flag');
    });
    
    // Test 6: 完成任务（complete）
    await runTest('Test 6: 完成任务（complete）', async () => {
      const response = await sendRequest(proc, 6, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'complete',
          taskId: 'test-task-001',
          result: {
            output: 'Task completed successfully',
          },
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'complete', 'Action should be complete');
      assert(result.taskId === 'test-task-001', 'Should have correct taskId');
    });
    
    // Test 7: 获取报告（report）
    await runTest('Test 7: 获取报告（report）', async () => {
      const response = await sendRequest(proc, 7, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'report',
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'report', 'Action should be report');
      assert(result.timestamp > 0, 'Should have timestamp');
      assert(result.activeTasksCount !== undefined, 'Should have activeTasksCount');
    });
    
    // Test 8: 缺少必需参数
    await runTest('Test 8: 缺少必需参数', async () => {
      const response = await sendRequest(proc, 8, 'tools/call', {
        name: 'harness_runtime_guardian',
        arguments: {
          // 缺少 action 参数
        },
      });
      
      // 注意：MCP Server 的错误响应格式是 { result: { content: [...], isError: true } }
      assert(response.result, 'Should have result');
      assert(response.result.isError === true, 'Should have isError: true');
      assert(response.result.content[0].text.includes('Missing required parameter'), 
        'Error should mention missing parameter');
    });
    
  } finally {
    proc.kill();
  }
  
  // 输出结果
  console.log(`\n📊 Results:`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total: ${passed + failed}`);
  
  if (errors.length > 0) {
    console.log(`\n❌ Errors:`);
    for (const { name, error } of errors) {
      console.log(`  - ${name}: ${error}`);
    }
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
