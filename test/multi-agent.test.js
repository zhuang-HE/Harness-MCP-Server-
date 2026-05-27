/**
 * 阶段9：D9 multi-agent增强（多Agent编排）测试
 * 
 * 测试内容：
 * 1. tools/list 包含 harness_multi_agent
 * 2. 注册Agent（register_agent）
 * 3. 发送消息（send_message）
 * 4. 广播消息（broadcast_message）
 * 5. 发布事件（publish_event）
 * 6. 状态同步（sync_state）
 * 7. 协作模式（create_master_worker, create_peer, create_hierarchical）
 * 8. 冲突解决（detect_resource_conflict, detect_decision_conflict, resolve_conflict）
 * 9. 获取冲突报告（get_conflict_report）
 * 10. 获取状态（get_status）
 * 
 * 预估工时：5h
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'index.js');

console.log('=== 阶段9：D9 multi-agent增强测试 ===\n');

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

    // Test 1: tools/list 包含 harness_multi_agent
    console.log('Test 1: tools/list 包含 harness_multi_agent');
    const listRequest = {
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/list',
      params: {},
    };
    const listResponse = await sendRequest(server, bufferRef, listRequest);
    const tools = listResponse.result.tools;
    assert(
      tools.some(t => t.name === 'harness_multi_agent'),
      'tools/list 包含 harness_multi_agent'
    );

    // Test 2: 注册Agent（register_agent）
    console.log('\nTest 2: 注册Agent（register_agent）');
    const registerAgentRequest = {
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'register_agent',
          agentId: 'agent1',
          agentType: 'worker',
          capabilities: ['coding', 'testing'],
        },
      },
    };
    const registerAgentResponse = await sendRequest(server, bufferRef, registerAgentRequest);
    assert(
      !registerAgentResponse.result.isError,
      '注册Agent成功'
    );

    // Test 3: 发送消息（send_message）
    console.log('\nTest 3: 发送消息（send_message）');
    const sendMessageRequest = {
      jsonrpc: '2.0',
      id: 102,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'send_message',
          fromAgentId: 'agent1',
          toAgentId: 'agent2',
          messageType: 'request',
          payload: { task: 'test' },
        },
      },
    };
    const sendMessageResponse = await sendRequest(server, bufferRef, sendMessageRequest);
    assert(
      !sendMessageResponse.result.isError,
      '发送消息成功'
    );

    // Test 4: 广播消息（broadcast_message）
    console.log('\nTest 4: 广播消息（broadcast_message）');
    const broadcastMessageRequest = {
      jsonrpc: '2.0',
      id: 103,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'broadcast_message',
          fromAgentId: 'agent1',
          messageType: 'notification',
          payload: { message: 'Hello all' },
        },
      },
    };
    const broadcastMessageResponse = await sendRequest(server, bufferRef, broadcastMessageRequest);
    assert(
      !broadcastMessageResponse.result.isError,
      '广播消息成功'
    );

    // Test 5: 发布事件（publish_event）
    console.log('\nTest 5: 发布事件（publish_event）');
    const publishEventRequest = {
      jsonrpc: '2.0',
      id: 104,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'publish_event',
          eventType: 'task_completed',
          data: { taskId: 'task1', result: 'success' },
          sourceAgentId: 'agent1',
        },
      },
    };
    const publishEventResponse = await sendRequest(server, bufferRef, publishEventRequest);
    assert(
      !publishEventResponse.result.isError,
      '发布事件成功'
    );

    // Test 6: 状态同步（sync_state）
    console.log('\nTest 6: 状态同步（sync_state）');
    const syncStateRequest = {
      jsonrpc: '2.0',
      id: 105,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'sync_state',
          agentId: 'agent1',
          stateData: { status: 'busy', currentTask: 'task1' },
        },
      },
    };
    const syncStateResponse = await sendRequest(server, bufferRef, syncStateRequest);
    assert(
      !syncStateResponse.result.isError,
      '状态同步成功'
    );

    // Test 7: 协作模式（create_master_worker, create_peer, create_hierarchical）
    console.log('\nTest 7: 协作模式（create_master_worker, create_peer, create_hierarchical）');
    
    // 7.1 create_master_worker
    const createMasterWorkerRequest = {
      jsonrpc: '2.0',
      id: 1061,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'create_master_worker',
          masterId: 'master1',
          workerIds: ['agent1', 'agent2'],
        },
      },
    };
    const createMasterWorkerResponse = await sendRequest(server, bufferRef, createMasterWorkerRequest);
    assert(
      !createMasterWorkerResponse.result.isError,
      '创建主从协作成功'
    );

    // Test 8: 冲突解决（detect_resource_conflict, detect_decision_conflict, resolve_conflict）
    console.log('\nTest 8: 冲突解决（detect_resource_conflict, detect_decision_conflict, resolve_conflict）');
    
    // 8.1 detect_resource_conflict
    const detectResourceConflictRequest = {
      jsonrpc: '2.0',
      id: 1071,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'detect_resource_conflict',
          taskId: 'task1',
          resourceType: 'GPU',
          requestedBy: ['agent1', 'agent2'],
        },
      },
    };
    const detectResourceConflictResponse = await sendRequest(server, bufferRef, detectResourceConflictRequest);
    assert(
      !detectResourceConflictResponse.result.isError,
      '检测资源冲突成功'
    );

    // 8.2 detect_decision_conflict
    const detectDecisionConflictRequest = {
      jsonrpc: '2.0',
      id: 1072,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'detect_decision_conflict',
          taskId: 'task1',
          options: ['optionA', 'optionB'],
          votes: { optionA: 3, optionB: 2 },
        },
      },
    };
    const detectDecisionConflictResponse = await sendRequest(server, bufferRef, detectDecisionConflictRequest);
    assert(
      !detectDecisionConflictResponse.result.isError,
      '检测决策冲突成功'
    );

    // Test 9: 获取冲突报告（get_conflict_report）
    console.log('\nTest 9: 获取冲突报告（get_conflict_report）');
    const getConflictReportRequest = {
      jsonrpc: '2.0',
      id: 108,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'get_conflict_report',
        },
      },
    };
    const getConflictReportResponse = await sendRequest(server, bufferRef, getConflictReportRequest);
    assert(
      !getConflictReportResponse.result.isError,
      '获取冲突报告成功'
    );

    // Test 10: 获取状态（get_status）
    console.log('\nTest 10: 获取状态（get_status）');
    const getStatusRequest = {
      jsonrpc: '2.0',
      id: 109,
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
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
