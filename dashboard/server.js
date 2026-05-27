#!/usr/bin/env node
/**
 * Harness Monitor Dashboard - HTTP Server
 *
 * 提供实时监控仪表板 HTTP 接口：
 *   GET /        - 仪表板 HTML 页面
 *   GET /api     - 监控数据 JSON API
 *   GET /api/health - 健康检查
 *
 * 用法:
 *   node dashboard/server.js [port]
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PORT = parseInt(process.argv[2] || '3099', 10);
const SNAPSHOT_PATH = path.join(ROOT, 'monitor-snapshots.json');
const HTML_PATH = path.join(__dirname, 'index.html');

// ═══════════════════════════════════════
// 读取监控数据
// ═══════════════════════════════════════

function readSnapshot() {
  try {
    const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
    const snapshots = JSON.parse(raw);
    const latest = snapshots[snapshots.length - 1] || null;
    return { snapshots, latest, count: snapshots.length };
  } catch {
    return { snapshots: [], latest: null, count: 0 };
  }
}

// ═══════════════════════════════════════
// HTTP 服务器
// ═══════════════════════════════════════

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API: 监控数据
  if (url.pathname === '/api') {
    const data = readSnapshot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // API: 健康检查
  if (url.pathname === '/api/health') {
    const data = readSnapshot();
    const latest = data.latest;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: latest ? 'ok' : 'no_data',
      lastSnapshot: latest?.timestamp || null,
      totalSnapshots: data.count,
    }));
    return;
  }

  // 仪表板 HTML
  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const html = fs.readFileSync(HTML_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Dashboard HTML not found');
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n📊 Harness Monitor Dashboard`);
  console.log(`   HTTP Server running at: http://localhost:${PORT}`);
  console.log(`   API endpoint:          http://localhost:${PORT}/api`);
  console.log(`   Health check:          http://localhost:${PORT}/api/health\n`);
});

// ═══════════════════════════════════════
// 优雅关闭
// ═══════════════════════════════════════

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
