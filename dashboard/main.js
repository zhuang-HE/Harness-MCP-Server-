/**
 * Harness Monitor Dashboard — Electron 桌面应用
 *
 * 独立 .exe 监控仪表板，实时展示 Harness MCP Server 运行状态。
 */

import { app, BrowserWindow, Tray, Menu, nativeImage, dialog } from 'electron';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'monitor-snapshots.json');

let mainWindow = null;
let tray = null;
let httpServer = null;

const PORT = 3099;
const REFRESH_MS = 5000;

// ═══════════════════════════════════════
// 内嵌 HTTP API Server
// ═══════════════════════════════════════

function startApiServer() {
  httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/api') {
      try {
        const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
        const snapshots = JSON.parse(raw);
        const latest = snapshots[snapshots.length - 1] || null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ snapshots, latest, count: snapshots.length }));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ snapshots: [], latest: null, count: 0 }));
      }
      return;
    }

    if (url.pathname === '/api/health') {
      try {
        const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
        const snapshots = JSON.parse(raw);
        const latest = snapshots[snapshots.length - 1];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: latest ? 'ok' : 'no_data',
          lastSnapshot: latest?.timestamp || null,
          totalSnapshots: snapshots.length,
        }));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'no_data' }));
      }
      return;
    }

    // index.html
    const htmlPath = path.join(__dirname, 'index.html');
    try {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end('Dashboard not found');
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`📊 API Server running on port ${PORT}`);
  });
}

// ═══════════════════════════════════════
// 主窗口
// ═══════════════════════════════════════

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    title: 'Harness Monitor — MCP Server 监控仪表板',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 最小化到托盘而不是关闭
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ═══════════════════════════════════════
// 系统托盘
// ═══════════════════════════════════════

function createTray() {
  // 创建 16x16 的简单图标（绿色圆点表示正常）
  const iconSize = 16;
  const canvas = Buffer.alloc(iconSize * iconSize * 4);
  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      const idx = (y * iconSize + x) * 4;
      const cx = iconSize / 2, cy = iconSize / 2, r = 6;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        canvas[idx] = 63;     // R
        canvas[idx + 1] = 185; // G
        canvas[idx + 2] = 80;  // B
        canvas[idx + 3] = 255; // A
      }
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize });

  tray = new Tray(icon);
  tray.setToolTip('Harness Monitor — MCP Server 监控');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示仪表板', click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { type: 'separator' },
    { label: '刷新数据', click: () => { if (mainWindow) mainWindow.reload(); } },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) mainWindow.show();
    else createWindow();
  });
}

// ═══════════════════════════════════════
// 生命周期
// ═══════════════════════════════════════

app.whenReady().then(() => {
  startApiServer();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (httpServer) httpServer.close();
});

app.on('window-all-closed', () => {
  // 不退出，保持在系统托盘
});
