#!/usr/bin/env node
// 简单测试脚本：验证 Harness MCP Server 能启动并处理 initialize 请求

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

// 正确解析当前脚本的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const serverPath = resolve(__dirname, '../index.js');

console.log('🧪 启动 Harness MCP Server 进行测试...');
console.log('  Server path:', serverPath);

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// 发送 initialize 请求
const initializeRequest = JSON.stringify({
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
}) + '\n';

console.log('📤 发送 initialize 请求...');
server.stdin.write(initializeRequest);

// 等待响应
const timeout = setTimeout(() => {
  console.error('❌ 超时：未收到响应');
  server.kill();
  process.exit(1);
}, 5000);

server.stdout.on('data', (data) => {
  const response = data.toString();
  console.log('📥 收到响应:', response.trim());
  
  try {
    const json = JSON.parse(response);
    if (json.id === 1 && json.result) {
      console.log('✅ MCP Server 初始化成功！');
      console.log('  Server name:', json.result.serverInfo?.name);
      console.log('  Server version:', json.result.serverInfo?.version);
      clearTimeout(timeout);
      server.kill();
      process.exit(0);
    }
  } catch (e) {
    console.error('❌ 解析响应失败:', e.message);
  }
});

server.stderr.on('data', (data) => {
  console.error('  stderr:', data.toString().trim());
});

server.on('error', (error) => {
  console.error('❌ 启动失败:', error.message);
  clearTimeout(timeout);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ MCP Server 退出，代码: ${code}`);
    clearTimeout(timeout);
    process.exit(1);
  }
});
