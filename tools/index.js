// tools/index.js
// 统一导出所有 Harness Tools

import { definition as helloDefinition, handler as helloHandler } from "./hello.js";
import { definition as statusDefinition, handler as statusHandler } from "./status.js";
// 阶段1：D8 eval-framework
import { 
  evalRunDefinition, 
  evalRunHandler,
  evalReportDefinition,
  evalReportHandler,
  ciGateDefinition,
  ciGateHandler,
  ciGateReportDefinition,
  ciGateReportHandler,
  benchmarkRunDefinition,
  benchmarkRunHandler,
  benchmarkReportDefinition,
  benchmarkReportHandler
} from "./eval-framework.js";
// 阶段2：D3 skill-analyzer
import { definition as skillAnalyzeDefinition, handler as skillAnalyzeHandler } from "./skill-analyzer.js";
// 阶段3：D1 context-awareness
import { definition as contextAwareDefinition, handler as contextAwareHandler } from "./context-awareness.js";
// 阶段4：D2 memory-decay
import { definition as memoryDecayDefinition, handler as memoryDecayHandler } from "./memory-decay.js";
// 阶段5：D7 runtime-guardian
import { definition as runtimeGuardianDefinition, handler as runtimeGuardianHandler } from "./runtime-guardian.js";
// 阶段6：D4 learning-loop
import { definition as learningLoopDefinition, handler as learningLoopHandler } from "./learning-loop.js";
// 阶段7：D5 task-orchestrator 增强
import { definition as taskOrchestratorDefinition, handler as taskOrchestratorHandler } from "./task-orchestrator.js";
// 阶段8：D6 fusion-router 增强
import { definition as fusionRouterDefinition, handler as fusionRouterHandler } from "./fusion-router.js";
// 阶段9：D9 multi-agent 增强
import { definition as multiAgentDefinition, handler as multiAgentHandler } from "./multi-agent.js";
// 阶段11：监控系统
import { definition as monitorDefinition, handler as monitorHandler, healthDefinition, healthHandler } from "./monitor.js";

export const tools = [
  {
    definition: helloDefinition,
    handler: helloHandler,
  },
  {
    definition: statusDefinition,
    handler: statusHandler,
  },
  // 阶段1：D8 eval-framework (五维评测 + CI门禁 + 性能基准)
  {
    definition: evalRunDefinition,
    handler: evalRunHandler,
  },
  {
    definition: evalReportDefinition,
    handler: evalReportHandler,
  },
  {
    definition: ciGateDefinition,
    handler: ciGateHandler,
  },
  {
    definition: ciGateReportDefinition,
    handler: ciGateReportHandler,
  },
  {
    definition: benchmarkRunDefinition,
    handler: benchmarkRunHandler,
  },
  {
    definition: benchmarkReportDefinition,
    handler: benchmarkReportHandler,
  },
  // 阶段2：D3 skill-analyzer (技能分析器)
  {
    definition: skillAnalyzeDefinition,
    handler: skillAnalyzeHandler,
  },
  // 阶段3：D1 context-awareness (上下文感知)
  {
    definition: contextAwareDefinition,
    handler: contextAwareHandler,
  },
  // 阶段4：D2 memory-decay (记忆衰减)
  {
    definition: memoryDecayDefinition,
    handler: memoryDecayHandler,
  },
  // 阶段5：D7 runtime-guardian (运行时守护)
  {
    definition: runtimeGuardianDefinition,
    handler: runtimeGuardianHandler,
  },
  // 阶段6：D4 learning-loop (学习循环)
  {
    definition: learningLoopDefinition,
    handler: learningLoopHandler,
  },
  // 阶段7：D5 task-orchestrator 增强 (任务编排器)
  {
    definition: taskOrchestratorDefinition,
    handler: taskOrchestratorHandler,
  },
  // 阶段8：D6 fusion-router 增强 (融合路由器)
  {
    definition: fusionRouterDefinition,
    handler: fusionRouterHandler,
  },
  // 阶段9：D9 multi-agent 增强 (多Agent编排)
  {
    definition: multiAgentDefinition,
    handler: multiAgentHandler,
  },
  // 阶段11：监控系统
  {
    definition: monitorDefinition,
    handler: monitorHandler,
  },
  {
    definition: healthDefinition,
    handler: healthHandler,
  },
];
