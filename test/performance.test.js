/**
 * 阶段11：性能测试
 * 测试内容：并发、吞吐量、延迟、稳定性
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'index.js');

const CONCURRENT_LEVELS = [10, 50, 100];
const TEST_DURATION_MS = 10000; // 10秒稳定性测试

let totalPassed = 0;
let totalFailed = 0;
let server = null;

// ==================== 工具函数 ====================

function sendRequest(proc, request) {
  return new Promise((resolve, reject) => {
    const id = request.id || Math.random();
    const reqWithId = { ...request, id };

    let response = '';
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.stdout.removeListener('data', onData);
        reject(new Error('Timeout'));
      }
    }, 15000);

    const onData = (data) => {
      if (resolved) return;
      response += data.toString();
      try {
        const lines = response.trim().split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === id || (parsed.id && parsed.id.toString() === reqWithId.id.toString())) {
              resolved = true;
              clearTimeout(timeout);
              proc.stdout.removeListener('data', onData);
              resolve(parsed);
              return;
            }
          } catch (e) { /* skip non-JSON lines */ }
        }
      } catch (e) { /* 等待完整响应 */ }
    };

    proc.stdout.on('data', onData);
    proc.stdin.write(JSON.stringify(reqWithId) + '\n');
  });
}

// ==================== 测试函数 ====================

async function testConcurrency(proc, level) {
  // 增加 maxListeners 避免 EventEmitter 警告
  proc.stdout.setMaxListeners(level + 10);
  
  const startTime = Date.now();
  const requests = [];

  for (let i = 0; i < level; i++) {
    requests.push(
      sendRequest(proc, {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'harness_hello',
          arguments: { name: `PerfTest-${i}` }
        },
        id: 2000 + i
      })
    );
  }

  const results = await Promise.allSettled(requests);
  const duration = Date.now() - startTime;

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const throughput = Math.round(succeeded / (duration / 1000));

  return {
    level,
    duration,
    succeeded,
    failed,
    throughput,
    successRate: Math.round(succeeded / level * 100)
  };
}

async function testLatency(proc, samples = 20) {
  const latencies = [];

  for (let i = 0; i < samples; i++) {
    const start = Date.now();
    const response = await sendRequest(proc, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_status',
        arguments: {}
      },
      id: 3000 + i
    });
    latencies.push(Date.now() - start);

    // 小间隔避免过载
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  latencies.sort((a, b) => a - b);
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const median = latencies[Math.floor(latencies.length / 2)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];

  return { avg, median, p95, p99, min, max, samples };
}

async function testStability(proc, durationMs) {
  const startTime = Date.now();
  let requestCount = 0;
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  while (Date.now() - startTime < durationMs) {
    try {
      await sendRequest(proc, {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'harness_status',
          arguments: {}
        },
        id: 4000 + requestCount
      });
      successCount++;
    } catch (e) {
      failCount++;
      if (errors.length < 5) {
        errors.push(e.message);
      }
    }
    requestCount++;
  }

  const duration = Date.now() - startTime;
  const throughput = Math.round(requestCount / (duration / 1000));
  const uptime = Math.round(successCount / requestCount * 10000) / 100;

  return {
    duration: Math.round(duration / 1000),
    totalRequests: requestCount,
    successCount,
    failCount,
    throughput,
    uptime,
    errors: errors.length > 0 ? errors : null
  };
}

// ==================== 主流程 ====================

async function main() {
  console.log('🚀 阶段11：性能测试\n');
  console.log('═'.repeat(60));

  // ===== 启动服务器 =====
  console.log('\n📝 启动 MCP Server...');
  server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: join(__dirname, '..')
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('✅ MCP Server 已启动\n');

  try {
    // ===== 1. 并发测试 =====
    console.log('📊 测试1：并发请求测试');
    console.log('─'.repeat(40));

    for (const level of CONCURRENT_LEVELS) {
      const result = await testConcurrency(server, level);
      console.log(`  并发 ${level} 请求:`);
      console.log(`    - 耗时: ${result.duration}ms`);
      console.log(`    - 成功: ${result.succeeded}/${result.failed} 失败`);
      console.log(`    - 成功率: ${result.successRate}%`);
      console.log(`    - 吞吐量: ${result.throughput} req/s`);

      if (result.successRate >= 95) {
        console.log(`    ✅ 通过 (成功率 >= 95%)`);
        totalPassed++;
      } else {
        console.log(`    ❌ 失败 (成功率 < 95%)`);
        totalFailed++;
      }
      console.log();
    }

    // ===== 2. 延迟测试 =====
    console.log('📊 测试2：响应延迟测试');
    console.log('─'.repeat(40));

    const latency = await testLatency(server, 30);
    console.log(`  采样 ${latency.samples} 次:`);
    console.log(`    - 平均: ${latency.avg}ms`);
    console.log(`    - 中位数: ${latency.median}ms`);
    console.log(`    - P95: ${latency.p95}ms`);
    console.log(`    - P99: ${latency.p99}ms`);
    console.log(`    - 最小: ${latency.min}ms`);
    console.log(`    - 最大: ${latency.max}ms`);

    // P95 < 200ms 为通过
    if (latency.p95 < 200) {
      console.log(`    ✅ 通过 (P95 < 200ms)`);
      totalPassed++;
    } else {
      console.log(`    ❌ 失败 (P95 >= 200ms)`);
      totalFailed++;
    }
    console.log();

    // ===== 3. 稳定性测试 =====
    console.log('📊 测试3：稳定性测试 (10秒持续请求)');
    console.log('─'.repeat(40));

    const stability = await testStability(server, TEST_DURATION_MS);
    console.log(`  运行 ${stability.duration}s:`);
    console.log(`    - 总请求: ${stability.totalRequests}`);
    console.log(`    - 成功: ${stability.successCount}/${stability.failCount} 失败`);
    console.log(`    - 可用率: ${stability.uptime}%`);
    console.log(`    - 吞吐量: ${stability.throughput} req/s`);

    if (stability.errors) {
      console.log(`    - 错误样本: ${stability.errors.join(', ')}`);
    }

    // 可用率 > 99.5% 为通过
    if (stability.uptime >= 99.5) {
      console.log(`    ✅ 通过 (可用率 >= 99.5%)`);
      totalPassed++;
    } else {
      console.log(`    ❌ 失败 (可用率 < 99.5%)`);
      totalFailed++;
    }
    console.log();

    // ===== 4. 工具调用性能测试 =====
    // 重启 MCP Server 以清除高负载状态
    server.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: join(__dirname, '..')
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📊 测试4：工具调用性能测试 (重启后)');
    console.log('─'.repeat(40));

    const tools = [
      'harness_hello',
      'harness_status',
      'harness_eval_run',
      'harness_skill_analyze',
      'harness_context_aware'
    ];

    for (const toolName of tools) {
      const start = Date.now();
      try {
        let params;
        switch (toolName) {
          case 'harness_hello':
            params = { name: 'Perf' };
            break;
          case 'harness_status':
            params = {};
            break;
          case 'harness_eval_run':
            params = { task: 'perf test', result: 'test', expected: 'test' };
            break;
          case 'harness_skill_analyze':
            params = { skillPath: join(__dirname, '..', 'tools', 'hello.js') };
            break;
          case 'harness_context_aware':
            params = { task: 'perf test task' };
            break;
        }

        await sendRequest(server, {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: toolName, arguments: params },
          id: 5000 + tools.indexOf(toolName)
        });
        const elapsed = Date.now() - start;
        console.log(`  ${toolName}: ${elapsed}ms`);
      } catch (e) {
        console.log(`  ${toolName}: ❌ ${e.message}`);
      }
    }

  } finally {
    // 清理
    server.kill();
  }

  // ===== 汇总 =====
  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 性能测试结果：${totalPassed} passed, ${totalFailed} failed`);
  console.log(`  共 ${totalPassed + totalFailed} 个测试\n`);

  if (totalFailed > 0) {
    console.log('⚠️  部分测试未达到性能目标，建议优化。');
    process.exit(1);
  } else {
    console.log('✅ 所有性能指标达标！');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ 性能测试失败:', error);
  if (server) server.kill();
  process.exit(1);
});
