/**
 * 阶段8：D6 fusion-router 增强（融合路由器）
 * 
 * 功能：
 * 1. 数据融合（多源数据整合、冲突解决、一致性保证）
 * 2. 同步增强（实时同步、冲突检测、版本管理）
 * 3. 路由优化（智能路由、负载均衡、故障转移）
 * 
 * 预估工时：10h
 */

// 数据存储
const fusionState = {
  dataSources: [], // 数据源列表
  fusedData: {}, // 融合后的数据
  syncStatus: {}, // 同步状态
  routingTable: [], // 路由表
  versions: {}, // 版本管理
};

// ==================== 1. 数据融合 ====================

/**
 * 注册数据源
 */
function registerDataSource(sourceId, sourceType, endpoint, options = {}) {
  if (!sourceId || !sourceType || !endpoint) {
    throw new Error('Missing required parameters: sourceId, sourceType, endpoint');
  }

  const existing = fusionState.dataSources.find(s => s.id === sourceId);
  if (existing) {
    throw new Error(`Data source already exists: ${sourceId}`);
  }

  const source = {
    id: sourceId,
    type: sourceType, // api, database, file, cache
    endpoint,
    priority: options.priority || 1,
    weight: options.weight || 1.0,
    timeout: options.timeout || 5000,
    retry: options.retry || 3,
    status: 'active',
    lastSync: null,
    stats: {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
    },
  };

  fusionState.dataSources.push(source);
  return { success: true, source };
}

/**
 * 多源数据整合
 */
async function fuseData(dataType, sources = [], options = {}) {
  if (!dataType) {
    throw new Error('Missing required parameter: dataType');
  }

  // 如果没有指定数据源，使用所有活跃的源
  const targetSources = sources.length > 0
    ? fusionState.dataSources.filter(s => sources.includes(s.id) && s.status === 'active')
    : fusionState.dataSources.filter(s => s.status === 'active');

  if (targetSources.length === 0) {
    throw new Error('No active data sources available');
  }

  const results = [];
  const errors = [];

  // 从多个源获取数据
  for (const source of targetSources) {
    try {
      source.stats.totalRequests++;
      const startTime = Date.now();

      // 模拟数据获取（实际应调用真实API）
      const data = await simulateDataFetch(source, dataType, options);
      
      const responseTime = Date.now() - startTime;
      source.stats.successRequests++;
      source.stats.avgResponseTime = 
        (source.stats.avgResponseTime * (source.stats.successRequests - 1) + responseTime) / source.stats.successRequests;

      results.push({
        sourceId: source.id,
        sourceType: source.type,
        data,
        timestamp: new Date().toISOString(),
        responseTime,
        weight: source.weight,
      });
    } catch (error) {
      source.stats.failedRequests++;
      errors.push({
        sourceId: source.id,
        error: error.message,
      });
    }
  }

  // 冲突解决
  const resolvedData = resolveConflicts(results, options.conflictResolution || 'latest');

  // 一致性检查
  const consistency = checkConsistency(results);

  // 保存融合结果
  fusionState.fusedData[dataType] = {
    data: resolvedData,
    sources: results.map(r => r.sourceId),
    timestamp: new Date().toISOString(),
    consistency,
  };

  return {
    success: true,
    dataType,
    resultCount: results.length,
    results,
    fusedData: resolvedData,
    consistency,
    errors: errors.length > 0 ? errors : null,
  };
}

/**
 * 模拟数据获取
 */
async function simulateDataFetch(source, dataType, options) {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

  // 返回模拟数据
  return {
    dataType,
    sourceId: source.id,
    sourceType: source.type,
    content: `Data from ${source.id} for ${dataType}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 冲突解决
 */
function resolveConflicts(results, strategy) {
  if (results.length === 0) {
    return null;
  }

  switch (strategy) {
    case 'latest':
      // 选择时间戳最新的
      return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].data;

    case 'priority':
      // 选择优先级最高的
      const prioritySource = fusionState.dataSources.find(s => s.id === results[0].sourceId);
      const maxPriority = Math.max(...results.map(r => {
        const s = fusionState.dataSources.find(s => s.id === r.sourceId);
        return s ? s.priority : 0;
      }));
      return results.find(r => {
        const s = fusionState.dataSources.find(s => s.id === r.sourceId);
        return s && s.priority === maxPriority;
      }).data;

    case 'weighted':
      // 按权重随机选择
      const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
      let random = Math.random() * totalWeight;
      for (const result of results) {
        random -= result.weight;
        if (random <= 0) {
          return result.data;
        }
      }
      return results[results.length - 1].data;

    case 'consensus':
      // 返回出现次数最多的结果（简化版）
      const dataStr = results.map(r => JSON.stringify(r.data));
      const frequency = {};
      let maxFreq = 0;
      let consensusData = null;
      for (const str of dataStr) {
        frequency[str] = (frequency[str] || 0) + 1;
        if (frequency[str] > maxFreq) {
          maxFreq = frequency[str];
          consensusData = JSON.parse(str);
        }
      }
      return consensusData;

    default:
      return results[0].data;
  }
}

/**
 * 一致性检查
 */
function checkConsistency(results) {
  if (results.length <= 1) {
    return { consistent: true, score: 1.0 };
  }

  // 简化版一致性检查：比较数据内容
  const dataStr = results.map(r => JSON.stringify(r.data));
  const uniqueData = new Set(dataStr);
  const consistencyScore = 1.0 - (uniqueData.size - 1) / results.length;

  return {
    consistent: uniqueData.size === 1,
    score: consistencyScore,
    uniqueSources: uniqueData.size,
    totalSources: results.length,
  };
}

// ==================== 2. 同步增强 ====================

/**
 * 实时同步
 */
async function syncData(dataType, options = {}) {
  if (!dataType) {
    throw new Error('Missing required parameter: dataType');
  }

  const syncId = `sync_${Date.now()}`;
  const startTime = new Date().toISOString();

  try {
    // 获取最新数据
    const fuseResult = await fuseData(dataType, options.sources, options);

    // 冲突检测
    const conflicts = detectConflicts(fuseResult.results);

    // 版本管理
    const version = createVersion(dataType, fuseResult.fusedData, {
      syncId,
      timestamp: startTime,
      sourceCount: fuseResult.resultCount,
    });

    // 更新同步状态
    fusionState.syncStatus[dataType] = {
      lastSync: startTime,
      status: conflicts.length > 0 ? 'conflict' : 'success',
      syncId,
      version: version.versionId,
    };

    return {
      success: true,
      syncId,
      dataType,
      startTime,
      endTime: new Date().toISOString(),
      result: fuseResult,
      conflicts,
      version,
    };
  } catch (error) {
    fusionState.syncStatus[dataType] = {
      lastSync: startTime,
      status: 'failed',
      syncId,
      error: error.message,
    };

    throw new Error(`Sync failed: ${error.message}`);
  }
}

/**
 * 冲突检测
 */
function detectConflicts(results) {
  const conflicts = [];

  if (results.length <= 1) {
    return conflicts;
  }

  // 检测数据不一致
  const dataMap = new Map();
  for (const result of results) {
    const key = JSON.stringify(result.data);
    if (!dataMap.has(key)) {
      dataMap.set(key, []);
    }
    dataMap.get(key).push(result.sourceId);
  }

  if (dataMap.size > 1) {
    conflicts.push({
      type: 'data_mismatch',
      description: 'Data inconsistency detected across sources',
      sources: results.map(r => r.sourceId),
      details: Array.from(dataMap.entries()).map(([data, sources]) => ({
        data: JSON.parse(data),
        sources,
      })),
    });
  }

  // 检测响应时间异常
  const avgTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const slowSources = results.filter(r => r.responseTime > avgTime * 2);
  if (slowSources.length > 0) {
    conflicts.push({
      type: 'performance_degradation',
      description: 'Slow response detected from some sources',
      sources: slowSources.map(r => r.sourceId),
      avgResponseTime: avgTime,
      slowSources: slowSources.map(r => ({
        sourceId: r.sourceId,
        responseTime: r.responseTime,
      })),
    });
  }

  return conflicts;
}

/**
 * 版本管理
 */
function createVersion(dataType, data, metadata = {}) {
  if (!fusionState.versions[dataType]) {
    fusionState.versions[dataType] = [];
  }

  const versionId = `v${fusionState.versions[dataType].length + 1}`;
  const version = {
    versionId,
    dataType,
    data,
    timestamp: new Date().toISOString(),
    metadata,
  };

  fusionState.versions[dataType].push(version);

  // 限制版本数量（保留最近10个版本）
  if (fusionState.versions[dataType].length > 10) {
    fusionState.versions[dataType] = fusionState.versions[dataType].slice(-10);
  }

  return version;
}

/**
 * 获取版本历史
 */
function getVersionHistory(dataType) {
  if (!fusionState.versions[dataType]) {
    return { success: false, error: `No version history for: ${dataType}` };
  }

  return {
    success: true,
    dataType,
    versions: fusionState.versions[dataType].map(v => ({
      versionId: v.versionId,
      timestamp: v.timestamp,
      metadata: v.metadata,
    })),
  };
}

/**
 * 回滚到指定版本
 */
function rollbackVersion(dataType, versionId) {
  if (!fusionState.versions[dataType]) {
    throw new Error(`No version history for: ${dataType}`);
  }

  const version = fusionState.versions[dataType].find(v => v.versionId === versionId);
  if (!version) {
    throw new Error(`Version not found: ${versionId}`);
  }

  // 恢复数据
  fusionState.fusedData[dataType] = {
    data: version.data,
    sources: [],
    timestamp: new Date().toISOString(),
    consistency: { consistent: true, score: 1.0 },
  };

  return {
    success: true,
    dataType,
    versionId,
    rolledBackAt: new Date().toISOString(),
  };
}

// ==================== 3. 路由优化 ====================

/**
 * 注册路由
 */
function registerRoute(routeId, endpoints, options = {}) {
  if (!routeId || !endpoints || endpoints.length === 0) {
    throw new Error('Missing required parameters: routeId, endpoints');
  }

  const existing = fusionState.routingTable.find(r => r.id === routeId);
  if (existing) {
    throw new Error(`Route already exists: ${routeId}`);
  }

  const route = {
    id: routeId,
    endpoints: endpoints.map(ep => ({
      url: ep.url,
      weight: ep.weight || 1.0,
      priority: ep.priority || 1,
      status: 'healthy',
      stats: {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
      },
    })),
    strategy: options.strategy || 'round-robin', // round-robin, weighted, least-connections
    healthCheck: options.healthCheck || false,
    timeout: options.timeout || 5000,
    retry: options.retry || 3,
    status: 'active',
  };

  fusionState.routingTable.push(route);
  return { success: true, route };
}

/**
 * 智能路由
 */
function routeRequest(routeId, requestData = {}) {
  if (!routeId) {
    throw new Error('Missing required parameter: routeId');
  }

  const route = fusionState.routingTable.find(r => r.id === routeId);
  if (!route) {
    throw new Error(`Route not found: ${routeId}`);
  }

  if (route.status !== 'active') {
    throw new Error(`Route is not active: ${routeId}`);
  }

  // 选择端点
  const endpoint = selectEndpoint(route, requestData);
  
  // 更新统计
  endpoint.stats.totalRequests++;

  return {
    success: true,
    routeId,
    endpoint: endpoint.url,
    strategy: route.strategy,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 选择端点
 */
function selectEndpoint(route, requestData) {
  const healthyEndpoints = route.endpoints.filter(ep => ep.status === 'healthy');
  
  if (healthyEndpoints.length === 0) {
    throw new Error(`No healthy endpoints available for route: ${route.id}`);
  }

  switch (route.strategy) {
    case 'round-robin':
      // 简化版轮询：选择第一个健康端点
      return healthyEndpoints[0];

    case 'weighted':
      // 按权重随机选择
      const totalWeight = healthyEndpoints.reduce((sum, ep) => sum + ep.weight, 0);
      let random = Math.random() * totalWeight;
      for (const ep of healthyEndpoints) {
        random -= ep.weight;
        if (random <= 0) {
          return ep;
        }
      }
      return healthyEndpoints[healthyEndpoints.length - 1];

    case 'least-connections':
      // 选择连接数最少的端点（简化版：选择请求数最少的）
      return healthyEndpoints.sort((a, b) => a.stats.totalRequests - b.stats.totalRequests)[0];

    case 'priority':
      // 选择优先级最高的
      return healthyEndpoints.sort((a, b) => a.priority - b.priority)[0];

    default:
      return healthyEndpoints[0];
  }
}

/**
 * 负载均衡
 */
function balanceLoad(routeId, options = {}) {
  if (!routeId) {
    throw new Error('Missing required parameter: routeId');
  }

  const route = fusionState.routingTable.find(r => r.id === routeId);
  if (!route) {
    throw new Error(`Route not found: ${routeId}`);
  }

  // 计算负载分布
  const distribution = route.endpoints.map(ep => ({
    url: ep.url,
    weight: ep.weight,
    priority: ep.priority,
    totalRequests: ep.stats.totalRequests,
    successRate: ep.stats.totalRequests > 0 
      ? ep.stats.successRequests / ep.stats.totalRequests 
      : 0,
    avgResponseTime: ep.stats.avgResponseTime,
  }));

  // 计算均衡度（简化版：基于请求数标准差）
  const requests = distribution.map(d => d.totalRequests);
  const avgRequests = requests.reduce((sum, r) => sum + r, 0) / requests.length;
  const variance = requests.reduce((sum, r) => sum + Math.pow(r - avgRequests, 2), 0) / requests.length;
  const stdDev = Math.sqrt(variance);
  const balanceScore = 1.0 - (stdDev / (avgRequests || 1));

  return {
    success: true,
    routeId,
    distribution,
    balanceScore: Math.max(0, balanceScore),
    recommendation: balanceScore < 0.7 ? 'Re-balance recommended' : 'Load is balanced',
  };
}

/**
 * 故障转移
 */
function failover(routeId, failedEndpoint) {
  if (!routeId || !failedEndpoint) {
    throw new Error('Missing required parameters: routeId, failedEndpoint');
  }

  const route = fusionState.routingTable.find(r => r.id === routeId);
  if (!route) {
    throw new Error(`Route not found: ${routeId}`);
  }

  // 标记故障端点
  const endpoint = route.endpoints.find(ep => ep.url === failedEndpoint);
  if (endpoint) {
    endpoint.status = 'unhealthy';
  }

  // 选择备用端点
  const backupEndpoints = route.endpoints.filter(ep => ep.status === 'healthy');
  if (backupEndpoints.length === 0) {
    throw new Error(`No backup endpoints available for route: ${routeId}`);
  }

  return {
    success: true,
    routeId,
    failedEndpoint,
    backupEndpoint: backupEndpoints[0].url,
    remainingHealthy: backupEndpoints.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 健康检查
 */
function healthCheck(routeId) {
  if (!routeId) {
    throw new Error('Missing required parameter: routeId');
  }

  const route = fusionState.routingTable.find(r => r.id === routeId);
  if (!route) {
    throw new Error(`Route not found: ${routeId}`);
  }

  const results = route.endpoints.map(ep => {
    // 模拟健康检查（实际应发送HTTP请求）
    const isHealthy = Math.random() > 0.2; // 80%概率健康
    ep.status = isHealthy ? 'healthy' : 'unhealthy';

    return {
      url: ep.url,
      status: ep.status,
      responseTime: Math.random() * 100,
      timestamp: new Date().toISOString(),
    };
  });

  const healthyCount = results.filter(r => r.status === 'healthy').length;

  return {
    success: true,
    routeId,
    results,
    healthyCount,
    totalCount: results.length,
    healthRatio: healthyCount / results.length,
  };
}

// ==================== 导出 ====================

export {
  // 数据融合
  registerDataSource,
  fuseData,
  resolveConflicts,
  checkConsistency,
  
  // 同步增强
  syncData,
  detectConflicts,
  createVersion,
  getVersionHistory,
  rollbackVersion,
  
  // 路由优化
  registerRoute,
  routeRequest,
  balanceLoad,
  failover,
  healthCheck,
  
  // 状态查询
  fusionState,
};
