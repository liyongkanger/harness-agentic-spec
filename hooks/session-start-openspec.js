#!/usr/bin/env node
/**
 * session-start-openspec.js
 * SessionStart hook: 检测当前项目是否有 openspec/，
 * 找到进行中的 change，加载最新 checkpoint 注入上下文。
 */

const fs = require('fs');
const path = require('path');

const projectDir = process.cwd();
const openspecDir = path.join(projectDir, 'openspec');
const changesDir = path.join(openspecDir, 'changes');

// 不是 openspec 项目，静默退出
if (!fs.existsSync(openspecDir) || !fs.existsSync(changesDir)) {
  process.exit(0);
}

// 找所有非归档、非模板的 change 目录
let activeDirs;
try {
  activeDirs = fs.readdirSync(changesDir).filter(name => {
    if (name.startsWith('_') || name === 'README.md') return false;
    const runJsonPath = path.join(changesDir, name, 'run.json');
    if (!fs.existsSync(runJsonPath)) return false;
    try {
      const run = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
      return run.current_stage !== 'archive' && run.current_stage !== 'archived';
    } catch {
      return false;
    }
  });
} catch {
  process.exit(0);
}

if (activeDirs.length === 0) {
  process.exit(0);
}

const lines = ['[OpenSpec] 检测到进行中的 change，已加载上下文：\n'];

for (const changeId of activeDirs) {
  const changeDir = path.join(changesDir, changeId);
  const runJsonPath = path.join(changeDir, 'run.json');

  let run;
  try {
    run = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
  } catch {
    continue;
  }

  lines.push(`━━━ ${changeId} ━━━`);
  lines.push(`阶段: ${run.current_stage || '?'} | 任务: ${run.active_task || 'none'} | 迭代: ${run.iteration || 0}`);
  if (run.last_error) lines.push(`阻塞原因: ${run.last_error}`);

  // 优先读最新 checkpoint
  const checkpointsDir = path.join(changeDir, 'agent-space', 'checkpoints');
  let contextContent = null;

  if (fs.existsSync(checkpointsDir)) {
    const files = fs.readdirSync(checkpointsDir)
      .filter(f => f.endsWith('.md'))
      .sort();
    if (files.length > 0) {
      const latest = files[files.length - 1];
      try {
        contextContent = fs.readFileSync(path.join(checkpointsDir, latest), 'utf8').trim();
        lines.push(`Checkpoint: ${latest}`);
      } catch { /* ignore */ }
    }
  }

  // 回退：brief.md（摘要前100行）+ decisions.md（全量）
  if (!contextContent) {
    const briefPath = path.join(changeDir, 'agent-space', 'brief.md');
    const decisionsPath = path.join(changeDir, 'agent-space', 'decisions.md');
    const parts = [];

    if (fs.existsSync(briefPath)) {
      try {
        const brief = fs.readFileSync(briefPath, 'utf8').trim();
        // 只取前100行，避免冗长
        const briefLines = brief.split('\n').slice(0, 100);
        parts.push('### brief.md（前100行）\n' + briefLines.join('\n'));
      } catch { /* ignore */ }
    }

    if (fs.existsSync(decisionsPath)) {
      try {
        parts.push('### decisions.md\n' + fs.readFileSync(decisionsPath, 'utf8').trim());
      } catch { /* ignore */ }
    }

    if (parts.length > 0) {
      contextContent = parts.join('\n\n');
      lines.push('(无 checkpoint，加载 brief.md + decisions.md)');
    }
  }

  if (contextContent) {
    lines.push('');
    lines.push(contextContent);
  }

  lines.push('');
}

lines.push('提示：继续此 change 请直接说"继续"，或指定 change-id。');

console.log(lines.join('\n'));
