// test/memory-decay.test.js
// 测试 memory-decay Tool

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
  console.log('🧪 Memory-Decay Tool Tests\n');
  
  // 启动 MCP Server
  const proc = spawn('node', [INDEX_JS], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  
  // 等待服务器启动
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  try {
    // Test 1: tools/list 包含 harness_memory_decay
    await runTest('Test 1: tools/list 包含 harness_memory_decay', async () => {
      const response = await sendRequest(proc, 1, 'tools/list');
      assert(response.result, 'Should have result');
      assert(Array.isArray(response.result.tools), 'tools should be an array');
      
      const tool = response.result.tools.find(t => t.name === 'harness_memory_decay');
      assert(tool, 'Should have harness_memory_decay tool');
      assert(tool.description, 'Tool should have description');
      assert(tool.inputSchema, 'Tool should have inputSchema');
    });
    
    // Test 2: 计算衰减（calculate）
    await runTest('Test 2: 计算衰减（calculate）', async () => {
      const memories = [
        {
          id: 'mem-001',
          content: 'This is a test memory about code generation',
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30天前
          lastAccessedAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7天前
          accessCount: 10,
          importance: 0.8,
        },
        {
          id: 'mem-002',
          content: 'Another memory about debugging',
          createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60天前
          lastAccessedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30天前
          accessCount: 5,
          importance: 0.6,
        },
      ];
      
      const response = await sendRequest(proc, 2, 'tools/call', {
        name: 'harness_memory_decay',
        arguments: {
          action: 'calculate',
          memories,
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'calculate', 'Action should be calculate');
      assert(result.memoriesProcessed === 2, 'Should process 2 memories');
      assert(Array.isArray(result.results), 'Results should be an array');
      assert(result.results.length === 2, 'Should have 2 results');
      assert(result.results[0].decayedImportance < result.results[0].originalImportance,
        'Decayed importance should be less than original');
    });
    
    // Test 3: 评估重要度（evaluate）
    await runTest('Test 3: 评估重要度（evaluate）', async () => {
      const memories = [
        {
          id: 'mem-003',
          content: 'Important memory with detailed content that has structure and key points',
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10天前
          lastAccessedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2天前
          accessCount: 20,
          importance: 0.9,
          summary: 'This is a summary',
          tags: ['important', 'test'],
        },
      ];
      
      const response = await sendRequest(proc, 3, 'tools/call', {
        name: 'harness_memory_decay',
        arguments: {
          action: 'evaluate',
          memories,
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'evaluate', 'Action should be evaluate');
      assert(Array.isArray(result.evaluations), 'Evaluations should be an array');
      assert(result.evaluations[0].evaluation.recommendation, 'Should have recommendation');
    });
    
    // Test 4: 蒸馏记忆（distill）
    await runTest('Test 4: 蒸馏记忆（distill）', async () => {
      const memories = [
        {
          id: 'mem-004',
          content: 'This is a long memory that needs to be distilled into key points. ' +
                   'It contains important information that should be preserved. ' +
                   'The distillation process will extract the key points and generate a summary.',
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          accessCount: 1,
          importance: 0.5,
        },
      ];
      
      const response = await sendRequest(proc, 4, 'tools/call', {
        name: 'harness_memory_decay',
        arguments: {
          action: 'distill',
          memories,
        },
      });
      
      assert(response.result, 'Should have result');
      const content = response.result.content[0].text;
      const result = JSON.parse(content);
      
      assert(result.success === true, 'Should succeed');
      assert(result.action === 'distill', 'Action should be distill');
      assert(Array.isArray(result.distilled), 'Distilled should be an array');
      assert(result.distilled[0].compressionRatio < 1, 'Compression ratio should be less than 1');
      assert(result.distilled[0].keyPoints, 'Should have keyPoints');
      assert(result.distilled[0].summary, 'Should have summary');
    });
    
    // Test 5: 缺少必需参数
    await runTest('Test 5: 缺少必需参数', async () => {
      const response = await sendRequest(proc, 5, 'tools/call', {
        name: 'harness_memory_decay',
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
