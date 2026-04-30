#!/usr/bin/env node
/**
 * post-java-check.js
 * PostToolUse hook：Java/Maven 项目三项自动检查
 *
 * 触发条件（Edit/Write 后）：
 *   *.java           → mvn compile（受影响模块）
 *   *Mapper.xml      → XML id 与 Java Mapper 方法对齐检查
 *   *Controller.java → Feign Client @RequestLine 路径同步检查（在 compile 前）
 *
 * 环境变量：
 *   OPENSPEC_JAVA_HOOKS=off   关闭所有检查
 *   OPENSPEC_SKIP_COMPILE=1   跳过 mvn compile（只做静态检查）
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.env.OPENSPEC_JAVA_HOOKS === 'off') process.exit(0);

// ── 读取 hook 输入 ────────────────────────────────────────────────────────────
let data;
try {
  const raw = fs.readFileSync(0, 'utf8').trim();
  data = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(0);
}

const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');
if (!filePath) process.exit(0);

const fileName = path.basename(filePath);

// ── 路由 ──────────────────────────────────────────────────────────────────────
if (filePath.endsWith('.java')) {
  if (fileName.endsWith('Controller.java')) checkControllerClient(filePath);
  if (process.env.OPENSPEC_SKIP_COMPILE !== '1') runMavenCompile(filePath);
} else if (fileName.endsWith('Mapper.xml')) {
  checkMapperAlignment(filePath);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Maven 编译
// ─────────────────────────────────────────────────────────────────────────────
function findMaven(filePath) {
  const parts = filePath.split('/');
  let rootDir = null;
  let moduleDir = null;

  for (let i = parts.length - 1; i > 0; i--) {
    const dir = parts.slice(0, i).join('/');
    if (fs.existsSync(`${dir}/pom.xml`)) {
      if (!moduleDir) moduleDir = dir;
      rootDir = dir;
    }
  }
  if (!rootDir) return null;

  return {
    root:   rootDir,
    module: moduleDir && moduleDir !== rootDir
      ? path.relative(rootDir, moduleDir).replace(/\\/g, '/')
      : null,
  };
}

function runMavenCompile(filePath) {
  const maven = findMaven(filePath);
  if (!maven) return;

  const cmd = maven.module
    ? `mvn compile -pl ${maven.module} -am -q`
    : `mvn compile -q`;

  process.stdout.write(`[java] 编译: ${cmd} ... `);

  try {
    execSync(cmd, {
      cwd:     maven.root,
      stdio:   'pipe',
      timeout: 90000,
      env:     { ...process.env, MAVEN_OPTS: '-Xmx512m' },
    });
    console.log('✅');
  } catch (e) {
    const lines = [e.stdout?.toString(), e.stderr?.toString()]
      .filter(Boolean).join('\n').split('\n')
      .filter(l => /\[ERROR\]|ERROR|cannot find symbol|does not exist/.test(l))
      .slice(0, 20).join('\n');
    console.log(`❌\n${lines || e.message.slice(0, 500)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mapper.xml / Java Mapper 对齐
// ─────────────────────────────────────────────────────────────────────────────
function checkMapperAlignment(xmlPath) {
  let xml;
  try { xml = fs.readFileSync(xmlPath, 'utf8'); } catch { return; }

  // 提取所有 SQL 语句 id
  const ids = [...xml.matchAll(/<(?:select|insert|update|delete|sql)[^>]+\bid="([^"]+)"/gi)]
    .map(m => m[1]);
  if (!ids.length) return;

  const maven    = findMaven(xmlPath);
  if (!maven) return;

  const baseName = path.basename(xmlPath, '.xml');
  const javaFile = findFile(maven.root, f => f.endsWith(`${baseName}.java`) && f.includes('/mapper/'));

  if (!javaFile) {
    console.log(`[mapper] ⚠️  未找到对应 Java Mapper: ${baseName}.java`);
    return;
  }

  let java;
  try { java = fs.readFileSync(javaFile, 'utf8'); } catch { return; }

  const missing = ids.filter(id => !new RegExp(`\\b${id}\\s*\\(`).test(java));

  if (missing.length) {
    console.log(`[mapper] ⚠️  XML id 在 Java 中无对应方法: ${missing.join(', ')}`);
    console.log(`         → ${path.relative(maven.root, javaFile)}`);
  } else {
    console.log(`[mapper] ✅ Mapper 对齐 (${ids.length} 个 id)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Controller / Feign Client 路径同步
// ─────────────────────────────────────────────────────────────────────────────
function checkControllerClient(ctrlPath) {
  let ctrl;
  try { ctrl = fs.readFileSync(ctrlPath, 'utf8'); } catch { return; }

  // 基础路径
  const baseMatch = ctrl.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/);
  const base      = baseMatch ? baseMatch[1].replace(/\/$/, '') : '';

  // 方法级路径
  const paths = [];
  for (const m of ctrl.matchAll(/@(?:Get|Post|Put|Delete|Patch)Mapping\s*(?:\(\s*(?:value\s*=\s*)?["']([^"']*)["'])?/g)) {
    const full = (base + (m[1] != null ? '/' + m[1] : '')).replace(/\/+/g, '/');
    if (full) paths.push(full);
  }
  if (!paths.length) return;

  const maven    = findMaven(ctrlPath);
  if (!maven) return;

  const clientName = path.basename(ctrlPath, '.java').replace('Controller', 'Client');
  const clientFile = findFile(maven.root, f => f.endsWith(`${clientName}.java`) && f.includes('/client/'));
  if (!clientFile) return; // 没有 client 模块则跳过

  let client;
  try { client = fs.readFileSync(clientFile, 'utf8'); } catch { return; }

  const missing = paths.filter(p => !client.includes(p));

  if (missing.length) {
    console.log(`[ctrl-client] ⚠️  路径在 Feign Client 中缺失: ${missing.join(', ')}`);
    console.log(`              → ${path.relative(maven.root, clientFile)}`);
  } else {
    console.log(`[ctrl-client] ✅ Controller/Client 路径对齐 (${paths.length} 个)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具：递归查找文件
// ─────────────────────────────────────────────────────────────────────────────
function findFile(dir, predicate, depth = 10) {
  if (depth <= 0) return null;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }

  for (const e of entries) {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'target') continue;
      const r = findFile(full, predicate, depth - 1);
      if (r) return r;
    } else if (predicate(full)) {
      return full;
    }
  }
  return null;
}
