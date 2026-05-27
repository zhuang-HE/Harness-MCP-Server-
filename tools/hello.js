// tools/hello.js
// 示例 Tool：Hello World

export const definition = {
  name: "harness_hello",
  description: "测试 Harness MCP Server 是否正常运行",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "可选：你的名字",
      },
    },
    required: [],
  },
};

export async function handler(args = {}) {
  const { name } = args;
  const greeting = name ? `Hello, ${name}!` : "Hello, World!";
  
  return {
    success: true,
    message: greeting,
    timestamp: new Date().toISOString(),
    server: "harness",
    version: "4.0.0",
  };
}
