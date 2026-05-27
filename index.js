#!/usr/bin/env node
// Harness MCP Server - 阶段0原型
// 使用 @modelcontextprotocol/sdk 正确API

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { tools } from "./tools/index.js";
import { resources } from "./resources/index.js";
import { prompts } from "./prompts/index.js";
import { monitor } from "./lib/monitor-engine.js";

// 创建Server实例
const server = new Server({
  name: "harness",
  version: "4.0.0",
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
  },
});

// 注册 initialize handler
server.setRequestHandler(InitializeRequestSchema, (request) => {
  console.error("📦 Received initialize request:", request.params);
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    serverInfo: {
      name: "harness",
      version: "4.0.0",
    },
  };
});

// 注册 tools/list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("📋 Listing tools...");
  return {
    tools: tools.map(t => t.definition),
  };
});

// 注册 tools/call handler（带监控指标收集）
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const startTime = Date.now();
  
  console.error("🔧 Calling tool:", toolName);
  
  const tool = tools.find(t => t.definition.name === toolName);
  if (!tool) {
    monitor.recordFailure(toolName, Date.now() - startTime, `Tool not found: ${toolName}`);
    return {
      content: [{ type: "text", text: `Error: Tool not found: ${toolName}` }],
      isError: true,
    };
  }
  
  try {
    const result = await tool.handler(request.params.arguments || {});
    const elapsed = Date.now() - startTime;
    
    // 记录成功请求
    const isError = result && result.isError;
    if (isError) {
      monitor.recordFailure(toolName, elapsed, 'Tool returned error');
    } else {
      monitor.recordSuccess(toolName, elapsed);
    }
    
    // 如果 result 已经包含了 content 字段（MCP Response 格式），直接返回
    if (result && result.content && Array.isArray(result.content)) {
      return {
        content: result.content,
        isError: result.isError || false
      };
    }
    
    // 否则，把 result 序列化成 JSON 字符串
    return { 
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }] 
    };
  } catch (error) {
    monitor.recordFailure(toolName, Date.now() - startTime, error.message);
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// 注册 resources/list handler（阶段0空实现）
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  console.error("📂 Listing resources...");
  return {
    resources: resources.map(r => r.definition),
  };
});

// 注册 resources/read handler（阶段0空实现）
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  console.error("📖 Reading resource:", request.params.uri);
  
  const resource = resources.find(r => r.definition.uri === request.params.uri);
  if (!resource) {
    throw new Error(`Resource not found: ${request.params.uri}`);
  }
  
  const content = await resource.handler();
  return { 
    contents: [{ 
      uri: request.params.uri, 
      mimeType: "application/json", 
      text: JSON.stringify(content, null, 2) 
    }] 
  };
});

// 注册 prompts/list handler（阶段0空实现）
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  console.error("📝 Listing prompts...");
  return {
    prompts: prompts.map(p => p.definition),
  };
});

// 注册 prompts/get handler（阶段0空实现）
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  console.error("�获取的prompt:", request.params.name);
  
  const prompt = prompts.find(p => p.definition.name === request.params.name);
  if (!prompt) {
    throw new Error(`Prompt not found: ${request.params.name}`);
  }
  
  const messages = await prompt.handler(request.params.arguments || {});
  return { messages };
});

// 启动Server
async function main() {
  const transport = new StdioServerTransport();
  
  // 优雅关闭处理
  process.on('SIGTERM', async () => {
    console.error('⚠️  Received SIGTERM, shutting down gracefully...');
    monitor.stopAutoSnapshot();
    await monitor.persistSnapshot();
    await server.close();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.error('⚠️  Received SIGINT, shutting down gracefully...');
    monitor.stopAutoSnapshot();
    await monitor.persistSnapshot();
    await server.close();
    process.exit(0);
  });
  
  // 未捕获异常处理
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error.message);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled rejection:', reason);
  });
  
  // 启动自动快照（每 60 秒）
  monitor.startAutoSnapshot(60000);
  console.error(`📊 Monitor engine started (auto-snapshot: 60s)`);
  
  await server.connect(transport);
  console.error("✅ Harness MCP Server started (v4.0.0)");
}

main().catch(error => {
  console.error("❌ Failed to start Harness MCP Server:", error);
  process.exit(1);
});
