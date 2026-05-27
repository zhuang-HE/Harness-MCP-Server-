/**
 * 测试脚本：验证 eval-framework 工具注册和调用
 * 
 * 测试内容：
 * 1. 启动 MCP Server
 * 2. 发送 initialize 请求
 * 3. 发送 tools/list 请求（验证工具注册）
 * 4. 发送 tools/call 请求（测试工具调用）
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.join(__dirname, '..', 'index.js');

console.log('🧪 启动 Harness MCP Server 进行测试...');
console.log(`📂 服务器路径: ${serverPath}`);

// 启动 MCP Server
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let step = 0;

// 处理服务器输出
server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // 按行分割
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // 保留最后一个不完整的行
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const response = JSON.parse(line);
      handleResponse(response);
    } catch (error) {
      console.error('❌ 解析响应失败:', error.message, '原始内容:', line);
    }
  }
});

// 处理服务器错误
server.stderr.on('data', (data) => {
  console.error('❌ 服务器错误:', data.toString());
});

// 发送请求
function sendRequest(request) {
  const message = JSON.stringify(request) + '\n';
  server.stdin.write(message);
}

// 处理响应
function handleResponse(response) {
  step++;
  
  console.log(`\n📥 步骤 ${step}: 收到响应`);
  console.log('📦 响应内容:', JSON.stringify(response, null, 2));
  
  if (step === 1) {
    // 验证 initialize 响应
    if (response.result && response.result.protocolVersion) {
      console.log('✅ MCP Server 初始化成功！');
      console.log(`🔢 协议版本: ${response.result.protocolVersion}`);
      console.log(`📛 服务器名称: ${response.result.serverInfo?.name || 'N/A'}`);
      console.log(`🔢 服务器版本: ${response.result.serverInfo?.version || 'N/A'}`);
      
      // 发送 tools/list 请求
      console.log('\n📤 步骤 2: 发送 tools/list 请求...');
      sendRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });
    } else {
      console.error('❌ MCP Server 初始化失败！');
      server.kill();
      process.exit(1);
    }
  } else if (step === 2) {
    // 验证 tools/list 响应
    if (response.result && response.result.tools) {
      const tools = response.result.tools;
      console.log(`✅ 工具列表获取成功！共 ${tools.length} 个工具`);
      
      // 检查 eval-framework 工具是否已注册
      const evalTools = tools.filter(t => t.name.startsWith('harness_eval') || t.name.startsWith('harness_ci') || t.name.startsWith('harness_benchmark'));
      
      if (evalTools.length > 0) {
        console.log(`\n🎯 找到 ${evalTools.length} 个 eval-framework 工具:`);
        for (const tool of evalTools) {
          console.log(`  - ${tool.name}: ${tool.description}`);
        }
        
        // 测试调用一个工具
        console.log('\n📤 步骤 3: 测试调用 harness_eval_run...');
        sendRequest({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'harness_eval_run',
            arguments: {
              task: '测试任务'
            }
          }
        });
      } else {
        console.warn('⚠️ 未找到 eval-framework 工具！');
        server.kill();
        process.exit(1);
      }
    } else {
      console.error('❌ 工具列表获取失败！');
      server.kill();
      process.exit(1);
    }
  } else if (step === 3) {
    // 验证 tools/call 响应
    if (response.result && response.result.content) {
      console.log('✅ 工具调用成功！');
      console.log('📦 调用结果:', JSON.stringify(response.result.content, null, 2));
      
      console.log('\n🎉 所有测试通过！eval-framework 工具注册和调用正常。');
      server.kill();
      process.exit(0);
    } else {
      console.error('❌ 工具调用失败！', response.error || response);
      server.kill();
      process.exit(1);
    }
  }
}

// 超时处理
setTimeout(() => {
  console.error('❌ 测试超时！');
  server.kill();
  process.exit(1);
}, 15000);

// 启动测试
console.log('\n📤 步骤 1: 发送 initialize 请求...');
sendRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
});
