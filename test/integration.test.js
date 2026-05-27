/**
 * 阶段10：集成测试
 * 
 * 测试内容：所有18个工具联合测试
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'index.js');

let passed = 0;
let failed = 0;
const errors = [];

function sendRequest(proc, request) {
  return new Promise((resolve, reject) => {
    const id = request.id || Math.random();
    const reqWithId = { ...request, id };
    
    let response = '';
    let timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for response'));
    }, 10000);
    
    const onData = (data) => {
      response += data.toString();
      try {
        const lines = response.trim().split('\n').filter(l => l.trim());
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.id === id || (parsed.id && reqWithId.id && parsed.id.toString() === reqWithId.id.toString())) {
            clearTimeout(timeout);
            proc.stdout.removeListener('data', onData);
            resolve(parsed);
            return;
          }
        }
      } catch (e) {
        // 等待完整响应
      }
    };
    
    proc.stdout.on('data', onData);
    proc.stdin.write(JSON.stringify(reqWithId) + '\n');
  });
}

async function runTest(name, testFn) {
  try {
    await testFn();
    console.log(`  ✅ Test ${passed + failed + 1}: ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ❌ Test ${passed + failed + 1}: ${name}`);
    console.error(`    Error: ${error.message}`);
    // 输出更详细的错误信息（如果有响应内容）
    if (error.response) {
      console.error(`    Response: ${JSON.stringify(error.response, null, 2)}`);
    }
    errors.push({ name, error: error.message });
    failed++;
  }
}

async function main() {
  console.log('🚀 开始阶段10：集成测试\n');
  
  console.log('📝 步骤1：启动MCP Server...');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: join(__dirname, '..')
  });
  
  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('✅ MCP Server started\n');
  console.log('📝 步骤2：运行集成测试...\n');
  
  // Test 1: 获取所有工具列表
  await runTest('tools/list - 获取所有18个工具', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1001
    });
    
    if (!response.result || !response.result.tools) {
      throw new Error('Invalid response format');
    }
    
    const tools = response.result.tools;
    if (tools.length !== 18) {
      throw new Error(`Expected 18 tools, got ${tools.length}`);
    }
    
    // 验证所有工具都存在
    const expectedTools = [
      'harness_hello',
      'harness_status',
      // 阶段1
      'harness_eval_run',
      'harness_eval_report',
      'harness_ci_gate',
      'harness_ci_gate_report',
      'harness_benchmark_run',
      'harness_benchmark_report',
      // 阶段2
      'harness_skill_analyze',
      // 阶段3
      'harness_context_aware',
      // 阶段4
      'harness_memory_decay',
      // 阶段5
      'harness_runtime_guardian',
      // 阶段6
      'harness_learning_loop',
      // 阶段7
      'harness_task_orchestrator',
      // 阶段8
      'harness_fusion_router',
      // 阶段9
      'harness_multi_agent',
      // 阶段11：监控系统
      'harness_monitor',
      'harness_health'
    ];
    
    for (const toolName of expectedTools) {
      if (!tools.find(t => t.name === toolName)) {
        throw new Error(`Missing tool: ${toolName}`);
      }
    }
  });
  
  // Test 2: 测试hello工具
  await runTest('harness_hello - 测试hello工具', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_hello',
        arguments: { name: 'Integration Test' }
      },
      id: 1002
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = response.result.content[0].text;
    if (!content.includes('Hello, Integration Test!')) {
      throw new Error('Unexpected response content');
    }
  });
  
  // Test 3: 测试status工具
  await runTest('harness_status - 测试status工具', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_status',
        arguments: {}
      },
      id: 1003
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (content.status !== 'ok') {
      throw new Error('Unexpected status');
    }
    
    if (content.toolsCount !== 18) {
      throw new Error(`Expected 18 tools, got ${content.toolsCount}`);
    }
  });
  
  // Test 4: 测试eval-framework工具（阶段1）
  await runTest('harness_eval_run - 测试评测框架', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_eval_run',
        arguments: {
          task: 'test task',
          result: 'test result',
          expected: 'test result'
        }
      },
      id: 1004
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Eval run failed');
    }
  });
  
  // Test 5: 测试skill-analyzer工具（阶段2）
  await runTest('harness_skill_analyze - 测试技能分析器', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_skill_analyze',
        arguments: {
          skillPath: join(__dirname, '..', 'tools', 'hello.js')
        }
      },
      id: 1005
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Skill analyze failed');
    }
  });
  
  // Test 6: 测试context-awareness工具（阶段3）
  await runTest('harness_context_aware - 测试上下文感知', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_context_aware',
        arguments: {
          task: 'test task'
        }
      },
      id: 1006
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Context aware failed');
    }
  });
  
  // Test 7: 测试memory-decay工具（阶段4）
  await runTest('harness_memory_decay - 测试记忆衰减', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_memory_decay',
        arguments: {
          action: 'calculate',
          memories: [
            { id: 'mem1', content: 'test', timestamp: Date.now() }
          ]
        }
      },
      id: 1007
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Memory decay failed');
    }
  });
  
  // Test 8: 测试runtime-guardian工具（阶段5）
  await runTest('harness_runtime_guardian - 测试运行时守护', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_runtime_guardian',
        arguments: {
          action: 'register',
          taskId: 'test-task-001'
        }
      },
      id: 1008
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Runtime guardian failed');
    }
  });
  
  // Test 9: 测试learning-loop工具（阶段6）
  await runTest('harness_learning_loop - 测试学习循环', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_learning_loop',
        arguments: {
          action: 'collect_feedback',
          feedbackType: 'user',
          sessionId: 'test-session',
          feedback: {
            rating: 5,
            comment: 'test feedback'
          }
        }
      },
      id: 1009
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Learning loop failed');
    }
  });
  
  // Test 10: 测试task-orchestrator工具（阶段7）
  await runTest('harness_task_orchestrator - 测试任务编排器', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_task_orchestrator',
        arguments: {
          action: 'intelligent_decomposition',
          task: {
            id: 'task-001',
            type: 'code-generation',
            description: 'Test task'
          }
        }
      },
      id: 1010
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Task orchestrator failed');
    }
  });
  
  // Test 11: 测试fusion-router工具（阶段8）
  await runTest('harness_fusion_router - 测试融合路由器', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_fusion_router',
        arguments: {
          action: 'register_source',
          sourceId: 'source-001',
          sourceType: 'api',
          endpoint: 'http://example.com/api'
        }
      },
      id: 1011
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Fusion router failed');
    }
  });
  
  // Test 12: 测试multi-agent工具（阶段9）
  await runTest('harness_multi_agent - 测试多Agent编排', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_multi_agent',
        arguments: {
          action: 'register_agent',
          agentId: 'agent-001',
          agentType: 'worker',
          capabilities: ['coding', 'testing']
        }
      },
      id: 1012
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success) {
      throw new Error('Multi-agent failed');
    }
  });
  
  // Test 13: 测试health工具（阶段11：监控系统）
  await runTest('harness_health - 测试健康检查', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_health',
        arguments: {}
      },
      id: 1013
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success || !content.status) {
      throw new Error('Health check failed');
    }
  });
  
  // Test 14: 测试monitor工具（阶段11：监控系统）
  await runTest('harness_monitor - 测试监控查询', async () => {
    const response = await sendRequest(server, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'harness_monitor',
        arguments: { action: 'snapshot' }
      },
      id: 1014
    });
    
    if (!response.result || !response.result.content) {
      throw new Error('Invalid response format');
    }
    
    const content = JSON.parse(response.result.content[0].text);
    if (!content.success || content.server === undefined) {
      throw new Error('Monitor snapshot failed');
    }
  });
  
  console.log(`\n📊 阶段10 集成测试结果：${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    console.log('❌ 失败的测试：');
    for (const { name, error } of errors) {
      console.log(`  - ${name}: ${error}`);
    }
    console.log();
  }
  
  console.log('📝 步骤3：生成文档...\n');
  
  // 生成简化的用户手册
  const fs = await import('fs');
  const path = await import('path');
  const testOutputDir = join(__dirname, 'test-output');
  
  // 确保test-output目录存在
  try {
    fs.mkdirSync(testOutputDir, { recursive: true });
  } catch (e) {
    // 目录可能已存在
  }
  
  const manualPath = join(testOutputDir, 'Harness-MCP-Server-用户手册.md');
  
  const userManual = `# WorkBuddy Harness MCP Server 用户手册
  
## 简介
WorkBuddy Harness MCP Server 是一个基于Model Context Protocol (MCP) 的AI Agent能力增强服务器，提供九维架构的全面增强。

## 安装
\`\`\`bash
cd ~/.workbuddy/mcp-servers/harness
npm install
\`\`\`

## 配置
在 WorkBuddy 配置中添加 MCP Server：
\`\`\`json
{
  "mcpServers": {
    "harness": {
      "command": "node",
      "args": ["~/.workbuddy/mcp-servers/harness/index.js"]
    }
  }
}
\`\`\`

## 可用工具

### 基础工具
- **harness_hello**: 测试工具，返回问候语
- **harness_status**: 获取服务器状态

### 阶段1：评测框架 (D8: eval-framework)
- **harness_eval_run**: 执行五维评测（准确性/Token效率/安全性/稳定性/可维护性）
- **harness_eval_report**: 生成评测报告
- **harness_ci_gate**: 执行CI门禁检查
- **harness_ci_gate_report**: 生成CI门禁报告
- **harness_benchmark_run**: 运行性能基准测试
- **harness_benchmark_report**: 生成性能基准报告

### 阶段2：技能分析器 (D3: skill-analyzer)
- **harness_skill_analyze**: 分析技能质量，识别问题，自动修复

### 阶段3：上下文感知 (D1: context-awareness)
- **harness_context_aware**: 分析任务上下文，提供智能建议

### 阶段4：记忆衰减 (D2: memory-decay)
- **harness_memory_decay**: 管理记忆衰减、重要度评分、自动蒸馏

### 阶段5：运行时守护 (D7: runtime-guardian)
- **harness_runtime_guardian**: 监控执行、限制资源、检查安全、处理异常

### 阶段6：学习循环 (D4: learning-loop)
- **harness_learning_loop**: 收集反馈、识别模式、自动改进、效果验证

### 阶段7：任务编排器 (D5: task-orchestrator)
- **harness_task_orchestrator**: 智能拆解任务、自动分配、进度跟踪、动态编排

### 阶段8：融合路由器 (D6: fusion-router)
- **harness_fusion_router**: 数据融合、同步增强、路由优化

### 阶段9：多Agent编排 (D9: multi-agent)
- **harness_multi_agent**: Agent通信、协作模式、冲突解决

## 使用示例

### 示例1：评测AI回复质量
\`\`\`javascript
// 调用 harness_eval_run
{
  "type": "accuracy",
  "result": "AI生成的代码",
  "groundTruth": "期望的代码"
}
\`\`\`

### 示例2：分析技能质量
\`\`\`javascript
// 调用 harness_skill_analyze
{
  "skillPath": "~/.workbuddy/skills/my-skill/SKILL.md"
}
\`\`\`

### 示例3：任务编排
\`\`\`javascript
// 调用 harness_task_orchestrator
{
  "action": "decompose",
  "task": {
    "id": "task-001",
    "type": "code-generation",
    "description": "实现用户登录功能"
  }
}
\`\`\`

## 故障排除
1. **工具调用失败**：检查参数是否符合 schema 定义
2. **服务器无法启动**：检查 Node.js 版本（需要 18+）和依赖是否安装
3. **测试结果不一致**：检查测试环境是否一致

## 联系支持
- GitHub: https://github.com/zhuang-HE/workbuddy
- 文档: docs/Harness MCP Server 设计规格书.md
`;

  fs.writeFileSync(manualPath, userManual);
  console.log(`✅ 用户手册已生成: ${manualPath}\n`);
  
  // 生成API文档
  const apiDocPath = join(testOutputDir, 'Harness-MCP-Server-API文档.md');
  
  const apiDoc = `# WorkBuddy Harness MCP Server API 文档

## 协议
Model Context Protocol (MCP) 1.0.0

## 工具列表

### harness_hello
测试工具，返回问候语。

**输入**:
- \`name\` (string, required): 名称

**输出**:
- \`message\` (string): 问候语

---

### harness_status
获取服务器状态。

**输入**: 无

**输出**:
- \`status\` (string): 状态（ok/error）
- \`toolsCount\` (number): 工具数量
- \`phases\` (array): 完成的阶段列表

---

### harness_eval_run
执行五维评测。

**输入**:
- \`type\` (string, required): 评测类型（accuracy/token-efficiency/security/stability/maintainability）
- \`result\` (any, required): 评测结果
- \`groundTruth\` (any, optional): 基准真值

**输出**:
- \`success\` (boolean): 是否成功
- \`score\` (number): 评测分数

---

### harness_skill_analyze
分析技能质量。

**输入**:
- \`skillPath\` (string, required): 技能文件路径
- \`scanDirectory\` (string, optional): 扫描目录
- \`fix\` (boolean, optional): 是否自动修复
- \`verbose\` (boolean, optional): 详细输出
- \`format\` (string, optional): 输出格式（markdown/json）

**输出**:
- \`success\` (boolean): 是否成功
- \`issues\` (array): 问题列表
- \`qualityScore\` (number): 质量评分
- \`fixed\` (array): 已修复的问题

---

### harness_context_aware
分析任务上下文。

**输入**:
- \`task\` (string, required): 任务描述
- \`project\` (string, optional): 项目路径
- \`sessionId\` (string, optional): 会话ID
- \`includeHistory\` (boolean, optional): 包含历史
- \`learn\` (boolean, optional): 学习偏好

**输出**:
- \`success\` (boolean): 是否成功
- \`taskType\` (string): 任务类型
- \`projectContext\` (object): 项目上下文
- \`suggestions\` (array): 建议列表
- \`confidence\` (number): 置信度

---

### harness_memory_decay
管理记忆衰减。

**输入**:
- \`action\` (string, required): 操作类型（calculate/evaluate/distill）
- \`memories\` (array, optional): 记忆列表
- \`memoryDir\` (string, optional): 记忆目录
- \`options\` (object, optional): 选项
- \`sessionId\` (string, optional): 会话ID

**输出**:
- \`success\` (boolean): 是否成功
- \`results\` (array): 处理结果
- \`stats\` (object): 统计数据

---

### harness_runtime_guardian
运行时守护。

**输入**:
- \`action\` (string, required): 操作类型（register/update/check/handle/complete/report）
- \`taskId\` (string, optional): 任务ID
- \`timeoutMs\` (number, optional): 超时时间（毫秒）
- \`resourceUsage\` (object, optional): 资源使用情况
- \`command\` (string, optional): 命令
- \`error\` (object, optional): 错误
- \`result\` (object, optional): 结果
- \`options\` (object, optional): 选项
- \`sessionId\` (string, optional): 会话ID

**输出**:
- \`success\` (boolean): 是否成功
- \`status\` (string): 状态
- \`stats\` (object): 统计数据

---

### harness_learning_loop
学习循环。

**输入**:
- \`action\` (string, required): 操作类型（collect/identify/improve/verify/evolve）
- \`feedback\` (object, optional): 反馈
- \`patterns\` (array, optional): 模式列表
- \`improvements\` (array, optional): 改进列表
- \`experiment\` (object, optional): 实验
- \`comparison\` (object, optional): 对比
- \`model\` (object, optional): 模型
- \`knowledge\` (object, optional): 知识
- \`sessionId\` (string, optional): 会话ID

**输出**:
- \`success\` (boolean): 是否成功
- \`results\` (array): 处理结果
- \`stats\` (object): 统计数据

---

### harness_task_orchestrator
任务编排器。

**输入**:
- \`action\` (string, required): 操作类型（decompose/assign/track/orchestrate）
- \`task\` (object, optional): 任务
- \`tasks\` (array, optional): 任务列表
- \`agents\` (array, optional): Agent列表
- \`assignments\` (array, optional): 分配列表
- \`progress\` (object, optional): 进度
- \`options\` (object, optional): 选项
- \`sessionId\` (string, optional): 会话ID

**输出**:
- \`success\` (boolean): 是否成功
- \`results\` (array): 处理结果
- \`stats\` (object): 统计数据

---

### harness_fusion_router
融合路由器。

**输入**:
- \`action\` (string, required): 操作类型（register-source/fetch/fuse/resolve-conflict/check-consistency/sync/detect-conflicts/manage-versions/optimize-route/check-health）
- \`source\` (object, optional): 数据源
- \`sources\` (array, optional): 数据源列表
- \`query\` (object, optional): 查询
- \`fusedData\` (array, optional): 融合数据
- \`strategy\` (string, optional): 策略
- \`syncConfig\` (object, optional): 同步配置
- \`conflicts\` (array, optional): 冲突列表
- \`version\` (object, optional): 版本
- \`routes\` (array, optional): 路由列表
- \`endpoints\` (array, optional): 端点列表
- \`options\` (object, optional): 选项
- \`sessionId\` (string, optional): 会话ID

**输出**:
- \`success\` (boolean): 是否成功
- \`results\` (array): 处理结果
- \`stats\` (object): 统计数据

---

### harness_multi_agent
多Agent编排。

**输入**:
- \`action\` (string, required): 操作类型（register/send-message/broadcast/publish-event/sync-state/set-mode/resolve-conflict）
- \`agent\` (object, optional): Agent
- \`agents\` (array, optional): Agent列表
- \`message\` (object, optional): 消息
- \`event\` (object, optional): 事件
- \`state\` (object, optional): 状态
- \`mode\` (string, optional): 协作模式
- \`conflict\` (object, optional): 冲突
- \`resolution\` (object, optional): 解决方案
- \`options\` (object, optional): 选项
- \`sessionId\` (string, optional): 会话ID

**输出**:
- \`success\` (boolean): 是否成功
- \`results\` (array): 处理结果
- \`stats\` (object): 统计数据

---

## 错误格式
当工具调用失败时，返回：
\`\`\`json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\\"success\\": false, \\"error\\": \\"错误描述\\"}"
      }
    ],
    "isError": true
  }
}
\`\`\`
`;

  fs.writeFileSync(apiDocPath, apiDoc);
  console.log(`✅ API文档已生成: ${apiDocPath}\n`);
  
  // 生成部署指南
  const deployPath = join(testOutputDir, 'Harness-MCP-Server-部署指南.md');
  
  const deployGuide = `# WorkBuddy Harness MCP Server 部署指南

## 系统要求
- Node.js 18.0.0+
- npm 9.0.0+
- 磁盘空间: 100MB+

## 部署步骤

### 1. 安装依赖
\`\`\`bash
cd ~/.workbuddy/mcp-servers/harness
npm install
\`\`\`

### 2. 配置WorkBuddy
在 WorkBuddy 配置目录添加 MCP Server 配置：
\`\`\`bash
# ~/.workbuddy/mcp.json
{
  "mcpServers": {
    "harness": {
      "command": "node",
      "args": ["~/.workbuddy/mcp-servers/harness/index.js"]
    }
  }
}
\`\`\`

### 3. 启动WorkBuddy
\`\`\`bash
# 重启WorkBuddy使配置生效
\`\`\`

### 4. 验证部署
\`\`\`bash
# 运行集成测试
cd ~/.workbuddy/mcp-servers/harness/test
node integration.test.js
\`\`\`

## 更新部署
\`\`\`bash
cd ~/.workbuddy/mcp-servers/harness
git pull origin main
npm install
# 重启WorkBuddy
\`\`\`

## 故障排除

### 问题1：MCP Server无法启动
**检查**:
1. Node.js版本是否符合要求
2. 依赖是否完整安装
3. 文件路径是否正确

**解决**:
\`\`\`bash
node --version  # 应该 >= 18.0.0
cd ~/.workbuddy/mcp-servers/harness
rm -rf node_modules
npm install
\`\`\`

### 问题2：工具调用失败
**检查**:
1. 参数是否符合schema定义
2. 服务器是否正常运行
3. 查看服务器日志

**解决**:
\`\`\`bash
# 手动启动服务器查看日志
cd ~/.workbuddy/mcp-servers/harness
node index.js
\`\`\`

### 问题3：性能问题
**检查**:
1. 系统资源是否充足
2. 是否有死循环或内存泄漏
3. 是否触发资源限制

**解决**:
调整 runtime-guardian 的资源限制配置。

## 监控建议
1. 定期检查服务器日志
2. 监控内存和CPU使用
3. 设置告警阈值
4. 定期清理日志文件
`;

  fs.writeFileSync(deployPath, deployGuide);
  console.log(`✅ 部署指南已生成: ${deployPath}\n`);
  
  console.log('🎉 阶段10 完成！\n');
  console.log('📊 最终统计：');
  console.log(`  - 集成测试: ${passed} passed, ${failed} failed`);
  console.log(`  - 文档生成: 3个文档`);
  console.log(`  - 项目状态: ✅ 已完成\n`);
  
  server.kill();
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Integration test failed:', error);
  process.exit(1);
});
