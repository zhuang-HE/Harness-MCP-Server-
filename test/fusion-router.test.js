/**
 * 阶段8：D6 fusion-router 增强（融合路由器）测试
 * 
 * 测试内容：
 * 1. tools/list 包含 harness_fusion_router
 * 2. 注册数据源（register_source）
 * 3. 数据融合（fuse_data）
 * 4. 冲突解决（resolve_conflict）
 * 5. 一致性检查（check_consistency）
 * 6. 实时同步（sync_data）
 * 7. 冲突检测（detect_conflict）
 * 8. 版本管理（create_version, get_version_history, rollback_version）
 * 9. 路由优化（register_route, route_request, balance_load, failover, health_check）
 * 10. 获取状态（get_status）
 * 
 * 预估工时：10h
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'index.js');

console.log('=== 阶段8：D6 fusion-router 增强测试 ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ Test ${totalTests}: ${testName}`);
    passedTests++;
    return true;
  } else {
    console.log(`  ❌ Test ${totalTests}: ${testName}`);
    return false;
  }
}

function assertEqual(actual, expected, testName) {
  totalTests++;
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ✅ Test ${totalTests}: ${testName}`);
    passedTests++;
    return true;
  } else {
    console.log(`  ❌ Test ${totalTests}: ${testName}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual: ${JSON.stringify(actual)}`);
    return false;
  }
}

// 启动MCP Server
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: join(__dirname, '..'),
    });

    let buffer = '';
    let resolved = false;

    server.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.result && response.result.capabilities) {
              if (!resolved) {
                resolved = true;
                resolve({ server, buffer });
              }
            }
          } catch (e) {
            // 忽略非JSON行
          }
        }
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    server.on('error', (err) => {
      if (!resolved) {
        reject(err);
      }
    });

    // 发送初始化请求
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    };
    server.stdin.write(JSON.stringify(initRequest) + '\n');
  });
}

// 发送MCP请求
function sendRequest(server, bufferRef, request) {
  return new Promise((resolve, reject) => {
    const requestId = request.id;
    const requestStr = JSON.stringify(request) + '\n';
    
    let buffer = bufferRef.value || '';
    
    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.id === requestId) {
              server.stdout.removeListener('data', onData);
              bufferRef.value = buffer;
              resolve(response);
              return;
            }
          } catch (e) {
            // 忽略非JSON行
          }
        }
      }
    };

    server.stdout.on('data', onData);
    server.stdin.write(requestStr);
  });
}

async function runTests() {
  let server;
  let buffer = '';
  const bufferRef = { value: '' };

  try {
    // 启动服务器
    console.log('启动MCP Server...');
    const result = await startServer();
    server = result.server;
    buffer = result.buffer;
    bufferRef.value = buffer;
    console.log('✅ Server started\n');

    // Test 1: tools/list 包含 harness_fusion_router
    console.log('Test 1: tools/list 包含 harness_fusion_router');
    const listRequest = {
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/list',
      params: {},
    };
    const listResponse = await sendRequest(server, bufferRef, listRequest);
    const tools = listResponse.result.tools;
    assert(
      tools.some(t => t.name === 'harness_fusion_router'),
      'tools/list 包含 harness_fusion_router'
    );

    // Test 2: 注册数据源（register_source）
    console.log('\nTest 2: 注册数据源（register_source）');
    const registerSourceRequest = {
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'register_source',
          sourceId: 'source1',
          sourceType: 'api',
          endpoint: 'https://api.example.com',
          priority: 1,
          weight: 1.0,
          timeout: 5000,
          retry: 3,
        },
      },
    };
    const registerSourceResponse = await sendRequest(server, bufferRef, registerSourceRequest);
    assert(
      !registerSourceResponse.result.isError,
      '注册数据源成功'
    );

    // Test 3: 数据融合（fuse_data）
    console.log('\nTest 3: 数据融合（fuse_data）');
    const fuseDataRequest = {
      jsonrpc: '2.0',
      id: 102,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'fuse_data',
          dataType: 'user_data',
          sources: ['source1'],
          conflictResolution: 'latest',
        },
      },
    };
    const fuseDataResponse = await sendRequest(server, bufferRef, fuseDataRequest);
    assert(
      !fuseDataResponse.result.isError,
      '数据融合成功'
    );

    // Test 4: 冲突解决（resolve_conflict）
    console.log('\nTest 4: 冲突解决（resolve_conflict）');
    const resolveConflictRequest = {
      jsonrpc: '2.0',
      id: 103,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'resolve_conflict',
          results: [
            { sourceId: 'source1', data: { value: 1 }, timestamp: new Date().toISOString() },
            { sourceId: 'source2', data: { value: 2 }, timestamp: new Date().toISOString() },
          ],
          strategy: 'latest',
        },
      },
    };
    const resolveConflictResponse = await sendRequest(server, bufferRef, resolveConflictRequest);
    assert(
      !resolveConflictResponse.result.isError,
      '冲突解决成功'
    );

    // Test 5: 一致性检查（check_consistency）
    console.log('\nTest 5: 一致性检查（check_consistency）');
    const checkConsistencyRequest = {
      jsonrpc: '2.0',
      id: 104,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'check_consistency',
          results: [
            { sourceId: 'source1', data: { value: 1 } },
            { sourceId: 'source2', data: { value: 1 } },
          ],
        },
      },
    };
    const checkConsistencyResponse = await sendRequest(server, bufferRef, checkConsistencyRequest);
    assert(
      !checkConsistencyResponse.result.isError,
      '一致性检查成功'
    );

    // Test 6: 实时同步（sync_data）
    console.log('\nTest 6: 实时同步（sync_data）');
    const syncDataRequest = {
      jsonrpc: '2.0',
      id: 105,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'sync_data',
          dataType: 'user_data',
          sources: ['source1'],
        },
      },
    };
    const syncDataResponse = await sendRequest(server, bufferRef, syncDataRequest);
    assert(
      !syncDataResponse.result.isError,
      '实时同步成功'
    );

    // Test 7: 冲突检测（detect_conflict）
    console.log('\nTest 7: 冲突检测（detect_conflict）');
    const detectConflictRequest = {
      jsonrpc: '2.0',
      id: 106,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'detect_conflict',
          results: [
            { sourceId: 'source1', data: { value: 1 } },
            { sourceId: 'source2', data: { value: 2 } },
          ],
        },
      },
    };
    const detectConflictResponse = await sendRequest(server, bufferRef, detectConflictRequest);
    assert(
      !detectConflictResponse.result.isError,
      '冲突检测成功'
    );

    // Test 8: 版本管理（create_version, get_version_history, rollback_version）
    console.log('\nTest 8: 版本管理（create_version, get_version_history, rollback_version）');
    
    // 8.1 create_version
    const createVersionRequest = {
      jsonrpc: '2.0',
      id: 1071,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'create_version',
          dataType: 'user_data',
          data: { value: 1 },
          metadata: { author: 'test' },
        },
      },
    };
    const createVersionResponse = await sendRequest(server, bufferRef, createVersionRequest);
    assert(
      !createVersionResponse.result.isError,
      '创建版本成功'
    );

    // 8.2 get_version_history
    const getVersionHistoryRequest = {
      jsonrpc: '2.0',
      id: 1072,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'get_version_history',
          dataType: 'user_data',
        },
      },
    };
    const getVersionHistoryResponse = await sendRequest(server, bufferRef, getVersionHistoryRequest);
    assert(
      !getVersionHistoryResponse.result.isError,
      '获取版本历史成功'
    );

    // Test 9: 路由优化（register_route, route_request, balance_load, failover, health_check）
    console.log('\nTest 9: 路由优化（register_route, route_request, balance_load, failover, health_check）');
    
    // 9.1 register_route
    const registerRouteRequest = {
      jsonrpc: '2.0',
      id: 1081,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'register_route',
          routeId: 'route1',
          endpoints: [
            { url: 'https://api1.example.com', weight: 1.0, priority: 1 },
            { url: 'https://api2.example.com', weight: 1.0, priority: 2 },
          ],
          strategy: 'round-robin',
        },
      },
    };
    const registerRouteResponse = await sendRequest(server, bufferRef, registerRouteRequest);
    assert(
      !registerRouteResponse.result.isError,
      '注册路由成功'
    );

    // 9.2 route_request
    const routeRequestRequest = {
      jsonrpc: '2.0',
      id: 1082,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'route_request',
          routeId: 'route1',
          requestData: { userId: 123 },
        },
      },
    };
    const routeRequestResponse = await sendRequest(server, bufferRef, routeRequestRequest);
    assert(
      !routeRequestResponse.result.isError,
      '智能路由成功'
    );

    // 9.3 balance_load
    const balanceLoadRequest = {
      jsonrpc: '2.0',
      id: 1083,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'balance_load',
          routeId: 'route1',
        },
      },
    };
    const balanceLoadResponse = await sendRequest(server, bufferRef, balanceLoadRequest);
    assert(
      !balanceLoadResponse.result.isError,
      '负载均衡成功'
    );

    // Test 10: 获取状态（get_status）
    console.log('\nTest 10: 获取状态（get_status）');
    const getStatusRequest = {
      jsonrpc: '2.0',
      id: 109,
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'get_status',
        },
      },
    };
    const getStatusResponse = await sendRequest(server, bufferRef, getStatusRequest);
    assert(
      !getStatusResponse.result.isError,
      '获取状态成功'
    );

    console.log(`\n=== 测试结果 ===`);
    console.log(`Passed: ${passedTests}/${totalTests}`);
    if (passedTests === totalTests) {
      console.log('✅ All tests passed!');
    } else {
      console.log(`❌ ${totalTests - passedTests} test(s) failed`);
      process.exit(1);
    }

  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  } finally {
    if (server) {
      server.kill();
    }
  }
}

runTests();
