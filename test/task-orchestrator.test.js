// test/task-orchestrator.test.js
// Task Orchestrator Tool 测试脚本

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SERVER_PATH = path.join(ROOT_DIR, "index.js");

// 颜色输出
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 启动MCP服务器
 */
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn(
      "C:\\ProgramData\\WorkBuddy\\chromium-env\\135zglc\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node.exe",
      [SERVER_PATH],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    
    let buffer = "";
    let stderr = "";
    
    server.stdout.on("data", (data) => {
      buffer += data.toString();
    });
    
    server.stderr.on("data", (data) => {
      stderr += data.toString();
      // 检查是否成功启动
      if (stderr.includes("Harness MCP Server started")) {
        log("  ✓ MCP Server 启动成功", "green");
      }
    });
    
    // 等待服务器启动
    setTimeout(() => {
      resolve({ server, getBuffer: () => buffer, getStderr: () => stderr });
    }, 2000);
    
    server.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * 发送请求到MCP服务器
 */
async function sendRequest(serverHandle, request) {
  const { server, getBuffer } = serverHandle;
  
  return new Promise((resolve) => {
    const requestStr = JSON.stringify(request) + "\n";
    server.stdin.write(requestStr);
    
    // 等待响应
    setTimeout(() => {
      const buffer = getBuffer();
      const lines = buffer.split("\n").filter(line => line.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          if (response.id === request.id) {
            resolve(response);
            return;
          }
        } catch {
          // 忽略无法解析的行
        }
      }
      resolve(null);
    }, 1000);
  });
}

/**
 * 关闭服务器
 */
function stopServer(serverHandle) {
  if (serverHandle && serverHandle.server) {
    serverHandle.server.kill();
  }
}

// ==================== 测试用例 ====================

/**
 * Test 1: 验证 tools/list 包含 harness_task_orchestrate
 */
async function testToolList(serverHandle) {
  log("\n🔍 Test 1: tools/list 包含 harness_task_orchestrate...", "blue");
  
  const request = {
    jsonrpc: "2.0",
    id: 1101,
    method: "tools/list",
    params: {},
  };
  
  const response = await sendRequest(serverHandle, request);
  
  if (!response || !response.result) {
    log("  ✗ 未收到响应", "red");
    return false;
  }
  
  const tools = response.result.tools || [];
  const hasTaskOrchestrator = tools.some(t => t.name === "harness_task_orchestrate");
  
  if (hasTaskOrchestrator) {
    log("  ✓ harness_task_orchestrate 已注册", "green");
    return true;
  } else {
    log("  ✗ harness_task_orchestrate 未注册", "red");
    return false;
  }
}

/**
 * Test 2: 智能拆解（intelligent_decomposition）
 */
async function testIntelligentDecomposition(serverHandle) {
  log("\n🧩 Test 2: 智能拆解（intelligent_decomposition）...", "blue");
  
  const task = {
    id: "task-001",
    type: "fullstack-development",
    description: "开发一个全栈Web应用，包含前端、后端和数据库",
  };
  
  const existingTasks = [
    { id: "task-002", description: "基于task-001的API设计" },
  ];
  
  const request = {
    jsonrpc: "2.0",
    id: 1102,
    method: "tools/call",
    params: {
      name: "harness_task_orchestrate",
      arguments: {
        action: "intelligent_decomposition",
        task,
        existingTasks,
      },
    },
  };
  
  const response = await sendRequest(serverHandle, request);
  
  if (!response || !response.result) {
    log("  ✗ 未收到响应", "red");
    return false;
  }
  
  if (response.result.isError) {
    log(`  ✗ 调用失败: ${response.result.content[0].text}`, "red");
    return false;
  }
  
  const result = JSON.parse(response.result.content[0].text);
  
  if (result.success && result.decomposition) {
    log("  ✓ 智能拆解成功", "green");
    log(`    - 子任务数: ${result.decomposition.subtasks ? result.decomposition.subtasks.length : 0}`, "green");
    return true;
  } else {
    log("  ✗ 智能拆解失败", "red");
    return false;
  }
}

/**
 * Test 3: 自动分配（auto_assignment）
 */
async function testAutoAssignment(serverHandle) {
  log("\n🤖 Test 3: 自动分配（auto_assignment）...", "blue");
  
  const agents = [
    { id: "agent-001", name: "Agent-A", capabilities: ["code-generation", "code-review"], currentLoad: 1, maxLoad: 3 },
    { id: "agent-002", name: "Agent-B", capabilities: ["testing", "debugging"], currentLoad: 2, maxLoad: 3 },
    { id: "agent-003", name: "Agent-C", capabilities: ["documentation", "code-generation"], currentLoad: 0, maxLoad: 3 },
  ];
  
  const tasks = [
    { id: "task-001", name: "代码生成", type: "code-generation", priority: "high" },
    { id: "task-002", name: "代码审查", type: "code-review", priority: "medium" },
    { id: "task-003", name: "测试", type: "testing", priority: "low" },
  ];
  
  const request = {
    jsonrpc: "2.0",
    id: 1103,
    method: "tools/call",
    params: {
      name: "harness_task_orchestrate",
      arguments: {
        action: "auto_assignment",
        agents,
        tasks,
      },
    },
  };
  
  const response = await sendRequest(serverHandle, request);
  
  if (!response || !response.result) {
    log("  ✗ 未收到响应", "red");
    return false;
  }
  
  if (response.result.isError) {
    log(`  ✗ 调用失败: ${response.result.content[0].text}`, "red");
    return false;
  }
  
  const result = JSON.parse(response.result.content[0].text);
  
  if (result.success && result.assignment) {
    log("  ✓ 自动分配成功", "green");
    log(`    - 分配项数: ${result.assignment.assignments ? result.assignment.assignments.length : 0}`, "green");
    return true;
  } else {
    log("  ✗ 自动分配失败", "red");
    return false;
  }
}

/**
 * Test 4: 进度跟踪（progress_tracking）
 */
async function testProgressTracking(serverHandle) {
  log("\n📊 Test 4: 进度跟踪（progress_tracking）...", "blue");
  
  const taskId = "task-001";
  const subtasks = [
    { id: "subtask-001", name: "子任务1", status: "completed", progress: 100 },
    { id: "subtask-002", name: "子任务2", status: "in_progress", progress: 50 },
    { id: "subtask-003", name: "子任务3", status: "pending", progress: 0 },
  ];
  
  const tasks = [
    { id: "task-001", name: "任务1", status: "in_progress", startTime: Date.now() - 60 * 60 * 1000 },
    { id: "task-002", name: "任务2", status: "completed", startTime: Date.now() - 2 * 60 * 60 * 1000 },
  ];
  
  const agents = [
    { id: "agent-001", name: "Agent-A", currentLoad: 2, maxLoad: 3 },
  ];
  
  const request = {
    jsonrpc: "2.0",
    id: 1104,
    method: "tools/call",
    params: {
      name: "harness_task_orchestrate",
      arguments: {
        action: "progress_tracking",
        taskId,
        subtasks,
        tasks,
        agents,
      },
    },
  };
  
  const response = await sendRequest(serverHandle, request);
  
  if (!response || !response.result) {
    log("  ✗ 未收到响应", "red");
    return false;
  }
  
  if (response.result.isError) {
    log(`  ✗ 调用失败: ${response.result.content[0].text}`, "red");
    return false;
  }
  
  const result = JSON.parse(response.result.content[0].text);
  
  if (result.success && result.tracking) {
    log("  ✓ 进度跟踪成功", "green");
    log(`    - 进度信息: ${result.tracking.progress ? "已获取" : "未获取"}`, "green");
    return true;
  } else {
    log("  ✗ 进度跟踪失败", "red");
    return false;
  }
}

/**
 * Test 5: 动态编排（dynamic_orchestration）
 */
async function testDynamicOrchestration(serverHandle) {
  log("\n🔄 Test 5: 动态编排（dynamic_orchestration）...", "blue");
  
  const tasks = [
    { id: "task-001", name: "任务1", resourceRequirement: 0.8 },
    { id: "task-002", name: "任务2", resourceRequirement: 0.5 },
    { id: "task-003", name: "任务3", resourceRequirement: 0.3 },
  ];
  
  const dependencies = [
    { taskId: "task-002", dependsOn: "task-001" },
    { taskId: "task-003", dependsOn: "task-002" },
  ];
  
  const agents = [
    { id: "agent-001", name: "Agent-A", currentLoad: 1, maxLoad: 3 },
    { id: "agent-002", name: "Agent-B", currentLoad: 2, maxLoad: 3 },
  ];
  
  const request = {
    jsonrpc: "2.0",
    id: 1105,
    method: "tools/call",
    params: {
      name: "harness_task_orchestrate",
      arguments: {
        action: "dynamic_orchestration",
        tasks,
        dependencies,
        agents,
      },
    },
  };
  
  const response = await sendRequest(serverHandle, request);
  
  if (!response || !response.result) {
    log("  ✗ 未收到响应", "red");
    return false;
  }
  
  if (response.result.isError) {
    log(`  ✗ 调用失败: ${response.result.content[0].text}`, "red");
    return false;
  }
  
  const result = JSON.parse(response.result.content[0].text);
  
  if (result.success && result.orchestration) {
    log("  ✓ 动态编排成功", "green");
    log(`    - 编排信息: ${result.orchestration.parallelExecution ? "已获取" : "未获取"}`, "green");
    return true;
  } else {
    log("  ✗ 动态编排失败", "red");
    return false;
  }
}

/**
 * Test 6: 缺少必需参数
 */
async function testMissingParams(serverHandle) {
  log("\n❌ Test 6: 缺少必需参数...", "blue");
  
  const request = {
    jsonrpc: "2.0",
    id: 1106,
    method: "tools/call",
    params: {
      name: "harness_task_orchestrate",
      arguments: {
        // 缺少 action
      },
    },
  };
  
  const response = await sendRequest(serverHandle, request);
  
  if (!response || !response.result) {
    log("  ✗ 未收到响应", "red");
    return false;
  }
  
  if (response.result.isError) {
    log("  ✓ 正确返回错误（缺少必需参数）", "green");
    return true;
  } else {
    log("  ✗ 未返回错误（应该返回错误）", "red");
    return false;
  }
}

// ==================== 主测试流程 ====================

async function runTests() {
  log("=".repeat(60), "blue");
  log("🧪 开始测试 Task Orchestrator Tool", "blue");
  log("=".repeat(60), "blue");
  
  let serverHandle;
  let passed = 0;
  let failed = 0;
  
  try {
    // 启动服务器
    log("\n🚀 启动 MCP Server...", "blue");
    serverHandle = await startServer();
    
    // 发送 initialize 请求
    log("  📡 发送 initialize 请求...", "blue");
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    };
    await sendRequest(serverHandle, initRequest);
    
    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 运行测试
    const tests = [
      { name: "tools/list 包含 harness_task_orchestrate", fn: testToolList },
      { name: "智能拆解（intelligent_decomposition）", fn: testIntelligentDecomposition },
      { name: "自动分配（auto_assignment）", fn: testAutoAssignment },
      { name: "进度跟踪（progress_tracking）", fn: testProgressTracking },
      { name: "动态编排（dynamic_orchestration）", fn: testDynamicOrchestration },
      { name: "缺少必需参数", fn: testMissingParams },
    ];
    
    for (const test of tests) {
      try {
        const result = await test.fn(serverHandle);
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        log(`  ✗ 测试异常: ${error.message}`, "red");
        failed++;
      }
    }
    
  } catch (error) {
    log(`\n❌ 测试异常: ${error.message}`, "red");
    failed++;
  } finally {
    // 关闭服务器
    if (serverHandle) {
      stopServer(serverHandle);
    }
  }
  
  // 输出测试结果
  log("\n" + "=".repeat(60), "blue");
  log("📊 测试结果", "blue");
  log("=".repeat(60), "blue");
  log(`✅ 通过: ${passed}`, "green");
  log(`❌ 失败: ${failed}`, failed > 0 ? "red" : "green");
  log(`📈 通过率: ${(passed / (passed + failed)) * 100}%`, "blue");
  log("=".repeat(60), "blue");
  
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runTests();
