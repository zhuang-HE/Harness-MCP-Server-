# Harness MCP Server

> **AI Agent 九维增强 MCP Server** — 18 个 Tools、实时监控仪表板、WorkBuddy 生产就绪

[![Tools](https://img.shields.io/badge/tools-18-blue)](https://github.com/zhuang-HE/Harness-MCP-Server-)
[![Tests](https://img.shields.io/badge/tests-14%2F14-brightgreen)]()
[![Perf](https://img.shields.io/badge/perf-5%2F5-brightgreen)]()
[![Version](https://img.shields.io/badge/version-4.0.0-orange)]()

---

## 架构

```
harness/
├── index.js                 # MCP Server 入口（优雅关闭/监控集成）
├── dashboard/
│   ├── server.js            # HTTP 监控服务器 (:3099)
│   └── index.html           # Chart.js 实时仪表板
├── lib/                     # 12 个核心引擎
│   ├── eval-engine.js       # 五维评测引擎
│   ├── ci-gate.js           # CI 门禁
│   ├── benchmark.js         # 性能基准
│   ├── skill-analyzer-engine.js  # 技能分析
│   ├── context-awareness-engine.js # 上下文感知
│   ├── memory-decay-engine.js     # 记忆衰减
│   ├── runtime-guardian-engine.js # 运行时守护
│   ├── learning-loop-engine.js    # 学习循环
│   ├── task-orchestrator-engine.js # 任务编排
│   ├── fusion-router-engine.js    # 融合路由
│   ├── multi-agent-engine.js      # 多 Agent 协作
│   └── monitor-engine.js          # 监控引擎（新增）
├── tools/                   # 18 个 MCP Tools
│   ├── eval-framework.js    # 6 个评测工具
│   ├── skill-analyzer.js
│   ├── context-awareness.js
│   ├── memory-decay.js
│   ├── runtime-guardian.js
│   ├── learning-loop.js
│   ├── task-orchestrator.js
│   ├── fusion-router.js
│   ├── multi-agent.js
│   ├── monitor.js           # harness_monitor + harness_health（新增）
│   ├── status.js / hello.js
│   └── index.js             # 统一注册
├── test/                    # 14 个集成测试 + 5 个性能测试
├── data/                    # 运行时数据存储
├── config/
├── mcp.json                 # WorkBuddy MCP 配置模板
└── package.json
```

---

## 18 个 MCP Tools

| # | 工具 | 阶段 | 功能 |
|---|------|------|------|
| 1 | `harness_hello` | 基础 | 测试连通性 |
| 2 | `harness_status` | 基础 | 服务器状态/工具数/运行时间 |
| 3 | `harness_eval_run` | D8 | 五维评测（准确性/Token效率/安全性/稳定性/可维护性） |
| 4 | `harness_eval_report` | D8 | 生成评测报告 |
| 5 | `harness_ci_gate` | D8 | CI 门禁检查 |
| 6 | `harness_ci_gate_report` | D8 | CI 门禁日志 |
| 7 | `harness_benchmark_run` | D8 | 性能基准测试 |
| 8 | `harness_benchmark_report` | D8 | 性能基准报告 |
| 9 | `harness_skill_analyze` | D3 | 技能质量分析+自动修复 |
| 10 | `harness_context_aware` | D1 | 任务类型识别+项目分析+偏好学习 |
| 11 | `harness_memory_decay` | D2 | 记忆衰减/重要度评分/自动蒸馏 |
| 12 | `harness_runtime_guardian` | D7 | 执行监控/资源限制/安全检查 |
| 13 | `harness_learning_loop` | D4 | 反馈收集/模式识别/自动改进 |
| 14 | `harness_task_orchestrator` | D5 | 智能拆解/自动分配/进度跟踪 |
| 15 | `harness_fusion_router` | D6 | 数据融合/同步增强/路由优化 |
| 16 | `harness_multi_agent` | D9 | Agent 通信/协作模式/冲突解决 |
| 17 | `harness_monitor` | 🆕 | 实时监控快照/历史/工具统计 |
| 18 | `harness_health` | 🆕 | 健康检查（状态/错误率/内存） |

---

## 快速开始

### 安装

```bash
cd ~/.workbuddy/mcp-servers/harness
npm install
```

### 运行

```bash
node index.js
```

### WorkBuddy 集成

在 `~/.workbuddy/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "harness": {
      "command": "node",
      "args": ["C:/Users/庄赫/.workbuddy/mcp-servers/harness/index.js"],
      "disabled": false
    }
  }
}
```

重启 WorkBuddy 后即可使用全部 18 个工具。

---

## 测试

```bash
# 全部集成测试（14 个）
node test/integration.test.js

# 性能测试（5 个：并发/延迟/稳定性/工具/吞吐量）
node test/performance.test.js

# 单独模块测试
node test/eval-framework.test.js       # 5 tests
node test/skill-analyzer.test.js       # 5 tests
node test/context-awareness.test.js    # 5 tests
node test/memory-decay.test.js         # 5 tests
node test/runtime-guardian.test.js     # 8 tests
node test/learning-loop.test.js        # 9 tests
node test/task-orchestrator.test.js    # 6 tests
node test/fusion-router.test.js        # 13 tests
node test/multi-agent.test.js          # 11 tests
```

---

## 监控仪表板

```bash
node dashboard/server.js 3099
```

访问 `http://localhost:3099` 查看实时监控：

| 面板 | 内容 |
|------|------|
| 概览卡片 | 总请求/成功率/错误率/运行时间 |
| 趋势图 | 请求趋势 + 响应时间分布 |
| 性能面板 | P50/P95/P99 延迟、吞吐量、内存使用 |
| 工具统计 | 每个 Tool 的调用次数/平均耗时/错误数 |
| 错误日志 | 最近 50 条错误详情 |

---

## 性能指标

| 测试 | 结果 |
|------|------|
| 100 并发 | 6,667 req/s, 100% 成功率 |
| 响应延迟 P95 | < 2ms |
| 稳定性 (10s) | 99.96% 可用率 |
| 峰值吞吐量 | 8,333 req/s |

---

## 部署状态

- ✅ WorkBuddy 生产环境已部署
- ✅ GitHub 仓库已上线
- ✅ 51/51 任务已完成
- ✅ 14/14 集成测试通过
- ✅ 5/5 性能测试通过

---

## License

MIT © [zhuang-HE](https://github.com/zhuang-HE)
