// test/learning-loop.test.js
// Learning Loop Tool 测试脚本

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
 * Test 1: 验证 tools/list 包含 harness_learning_loop
 */
async function testToolList(serverHandle) {
  log("\n�running Test 1: tools/list 包含 harness_learning_loop...", "blue");
  
  const request = {
    jsonrpc: "2.0",
    id: 1001,
    method: "tools/list",
    params: {},
  };
  
  const response = await sendRequest(serverHandle, request);
  
  if (!response || !response.result) {
    log("  ✗ 未收到响应", "red");
    return false;
  }
  
  const tools = response.result.tools || [];
  const hasLearningLoop = tools.some(t => t.name === "harness_learning_loop");
  
  if (hasLearningLoop) {
    log("  ✓ harness_learning_loop 已注册", "green");
    return true;
  } else {
    log("  ✗ harness_learning_loop 未注册", "red");
    return false;
  }
}

/**
 * Test 2: 反馈收集（collect_feedback - user）
 */
async function testCollectFeedbackUser(serverHandle) {
  log("\n�running Test 2: 反馈收集（user）...", "blue");
  
  const request = {
    jsonrpc: "2.0",
    id: 1002,
    method: "tools/call",
    params: {
      name: "harness_learning_loop",
      arguments: {
        action: "collect_feedback",
        feedbackType: "user",
        sessionId: "test-session-001",
        feedback: {
          rating: 5,
          comment: "非常好用！",
          category: "general",
          tags: ["positive", "easy-to-use"],
        },
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
  
  if (result.success && result.entry && result.entry.type === "user_feedback") {
    log("  ✓ 用户反馈收集成功", "green");
    return true;
  } else {
    log("  ✗ 用户反馈收集失败", "red");
    return false;
  }
}

/**
 * Test 3: 反馈收集（collect_feedback - system）
 */
async function testCollectFeedbackSystem(serverHandle) {
  log("\n🏃 Test 3: 反馈收集（system）...", "blue");
  
  const request = {
    jsonrpc: "2.0",
    id: 1003,
    method: "tools/call",
    params: {
      name: "harness_learning_loop",
      arguments: {
        action: "collect_feedback",
        feedbackType: "system",
        sessionId: "test-session-001",
        feedback: {
          metric: {
            accuracy: 0.92,
            tokenEfficiency: 0.85,
            safety: 0.95,
          },
          performance: {
            responseTime: 1500,
            tokenUsage: 800,
            errorRate: 0.02,
          },
          warnings: [],
          errors: [],
        },
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
  
  if (result.success && result.entry && result.entry.type === "system_feedback") {
    log("  ✓ 系统反馈收集成功", "green");
    return true;
  } else {
    log("  ✗ 系统反馈收集失败", "red");
    return false;
  }
}

/**
 * Test 4: 反馈收集（collect_feedback - task_result）
 */
async function testCollectFeedbackTaskResult(serverHandle) {
  log("\n🏃 Test 4: 反馈收集（task_result）...", "blue");
  
  const request = {
    jsonrpc: "2.0",
    id: 1004,
    method: "tools/call",
    params: {
      name: "harness_learning_loop",
      arguments: {
        action: "collect_feedback",
        feedbackType: "task_result",
        sessionId: "test-session-001",
        result: {
          taskId: "task-001",
          taskType: "code-generation",
          success: true,
          duration: 3500,
          tokenUsage: 1200,
        },
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
  
  if (result.success && result.entry && result.entry.type === "task_result") {
    log("  ✓ 任务结果收集成功", "green");
    return true;
  } else {
    log("  ✗ 任务结果收集失败", "red");
    return false;
  }
}

/**
 * Test 5: 模式识别（identify_patterns）
 */
async function testIdentifyPatterns(serverHandle) {
  log("\n🌀 Test 5: 模式识别（identify_patterns）...", "blue");
  
  // 先创建一些测试反馈数据
  const feedbackHistory = [
    {
      type: "task_result",
      sessionId: "test-session-001",
      timestamp: Date.now(),
      taskId: "task-001",
      taskType: "code-generation",
      success: true,
      duration: 2500,
      tokenUsage: 1000,
    },
    {
      type: "task_result",
      sessionId: "test-session-001",
      timestamp: Date.now(),
      taskId: "task-002",
      taskType: "code-review",
      success: true,
      duration: 3500,
      tokenUsage: 1500,
    },
    {
      type: "task_result",
      sessionId: "test-session-001",
      timestamp: Date.now(),
      taskId: "task-003",
      taskType: "code-generation",
      success: false,
      duration: 5000,
      tokenUsage: 2000,
      errorMessage: "timeout",
    },
    {
      type: "user_feedback",
      sessionId: "test-session-001",
      timestamp: Date.now(),
      rating: 5,
      comment: "非常好！",
      category: "general",
    },
    {
      type: "user_feedback",
      sessionId: "test-session-001",
      timestamp: Date.now(),
      rating: 2,
      comment: "太慢了",
      category: "performance",
    },
  ];
  
  const request = {
    jsonrpc: "2.0",
    id: 1005,
    method: "tools/call",
    params: {
      name: "harness_learning_loop",
      arguments: {
        action: "identify_patterns",
        feedbackHistory,
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
  
  if (result.success && result.patterns) {
    log("  ✓ 模式识别成功", "green");
    log(`    - 成功模式: ${result.patterns.success ? "已识别" : "未识别"}`, result.patterns.success ? "green" : "yellow");
    log(`    - 失败模式: ${result.patterns.failure ? "已识别" : "未识别"}`, result.patterns.failure ? "green" : "yellow");
    log(`    - 优化机会: ${result.patterns.optimization ? "已识别" : "未识别"}`, result.patterns.optimization ? "green" : "yellow");
    return true;
  } else {
    log("  ✗ 模式识别失败", "red");
    return false;
  }
}

/**
 * Test 6: 自动改进（auto_improve）
 */
async function testAutoImprove(serverHandle) {
  log("\n🔧 Test 6: 自动改进（auto_improve）...", "blue");
  
  const currentParams = {
    maxTokens: 2048,
    temperature: 0.7,
    topP: 0.9,
  };
  
  const currentStrategy = {
    preferredTaskTypes: ["code-generation"],
    maxRetries: 3,
  };
  
  const newKnowledge = [
    {
      id: "knowledge-001",
      topic: "code-generation",
      category: "best-practice",
      content: "使用异步编程可以提高性能",
    },
  ];
  
  const existingKnowledge = [];
  
  const request = {
    jsonrpc: "2.0",
    id: 1006,
    method: "tools/call",
    params: {
      name: "harness_learning_loop",
      arguments: {
        action: "auto_improve",
        currentParams,
        currentStrategy,
        newKnowledge,
        existingKnowledge,
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
  
  if (result.success && result.improvements) {
    log("  ✓ 自动改进成功", "green");
    log(`    - 改进项数: ${result.totalImprovements}`, "green");
    return true;
  } else {
    log("  ✗ 自动改进失败", "red");
    return false;
  }
}

/**
 * Test 7: 效果验证（verify_effectiveness - ab_test）
 */
async function testVerifyEffectivenessABTest(serverHandle) {
  log("\n📊 Test 7: 效果验证（A/B测试）...", "blue");
  
  const testName = "test-ab-001";
  const variantA = { maxTokens: 2048, temperature: 0.7 };
  const variantB = { maxTokens: 4096, temperature: 0.5 };
  const feedbackHistory = [
    { type: "task_result", success: true },
    { type: "task_result", success: true },
    { type: "task_result", success: false },
  ];
  
  const request = {
    jsonrpc: "2.0",
    id: 1007,
    method: "tools/call",
    params: {
      name: "harness_learning_loop",
      arguments: {
        action: "verify_effectiveness",
        testName,
        variantA,
        variantB,
        feedbackHistory,
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
  
  if (result.success && result.verifications) {
    log("  ✓ A/B测试成功", "green");
    return true;
  } else {
    log("  ✗ A/B测试失败", "red");
    return false;
  }
}

/**
 * Test 8: 持续学习（continuous_learning）
 */
async function testContinuousLearning(serverHandle) {
  log("\n📚 Test 8: 持续学习（continuous_learning）...", "blue");
  
  const newData = [
    {
      type: "task_result",
      taskType: "code-generation",
      success: true,
      timestamp: Date.now(),
    },
    {
      type: "task_result",
      taskType: "code-review",
      success: true,
      timestamp: Date.now(),
    },
  ];
  
  const currentModel = {
    version: 1,
    learnedPatterns: [],
  };
  
  const feedbackHistory = [
    {
      type: "user_feedback",
      rating: 5,
      category: "general",
      timestamp: Date.now(),
    },
  ];
  
  const learningHistory = feedbackHistory;
  
  const request = {
    jsonrpc: "2.0",
    id: 1008,
    method: "tools/call",
    params: {
      name: "harness_learning_loop",
      arguments: {
        action: "continuous_learning",
        newData,
        currentModel,
        feedbackHistory,
        learningHistory,
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
  
  if (result.success && result.learnings) {
    log("  ✓ 持续学习成功", "green");
    log(`    - 学习项数: ${result.totalLearnings}`, "green");
    return true;
  } else {
    log("  ✗ 持续学习失败", "red");
    return false;
  }
}

/**
 * Test 9: 缺少必需参数
 */
async function testMissingParams(serverHandle) {
  log("\n❌ Test 9: 缺少必需参数...", "blue");
  
  const request = {
    jsonrpc: "2.0",
    id: 1009,
    method: "tools/call",
    params: {
      name: "harness_learning_loop",
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
  log("🧪 开始测试 Learning Loop Tool", "blue");
  log("=".repeat(60), "blue");
  
  let serverHandle;
  let passed = 0;
  let failed = 0;
  
  try {
    // 启动服务器
    log("\n🚀 启动 MCP Server...", "blue");
    serverHandle = await startServer();
    
    // 发送 initialize 请求
    log("  📦 发送 initialize 请求...", "blue");
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
      { name: "tools/list 包含 harness_learning_loop", fn: testToolList },
      { name: "反馈收集（user）", fn: testCollectFeedbackUser },
      { name: "反馈收集（system）", fn: testCollectFeedbackSystem },
      { name: "反馈收集（task_result）", fn: testCollectFeedbackTaskResult },
      { name: "模式识别（identify_patterns）", fn: testIdentifyPatterns },
      { name: "自动改进（auto_improve）", fn: testAutoImprove },
      { name: "效果验证（A/B测试）", fn: testVerifyEffectivenessABTest },
      { name: "持续学习（continuous_learning）", fn: testContinuousLearning },
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
  log(`📈 通过率: ${(passed / (passed + failed) * 100).toFixed(1)}%`, "blue");
  log("=".repeat(60), "blue");
  
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runTests();
