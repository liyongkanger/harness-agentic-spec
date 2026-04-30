#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REQUIRED_SOURCE_ITEMS = [
  'skills/local-spec-bootstrap/SKILL.md',
  'skills/local-spec-dev/SKILL.md',
  'skills/local-spec-new/SKILL.md',
  'skills/local-spec-new/references/java-greenfield-standards.md',
  'hooks/bootstrap-install.js',
  'hooks/session-start-openspec.js',
  'hooks/post-java-check.js',
  'tools/harness-spec.js',
  'openspec-templates/greenfield/project.md',
  'openspec-templates/greenfield/context/architecture.md',
  'openspec-templates/greenfield/context/interfaces.md',
  'openspec-templates/changes/_template/run.json',
  'openspec-templates/changes/_template/agent-space/assignments.json',
];

const AUTO_UPDATE_OFF_VALUES = new Set(['0', 'false', 'off', 'no']);

function bootstrapCodexAssets(options = {}) {
  const silent = Boolean(options.silent);
  const pluginRoot = findPluginRoot();
  if (!pluginRoot) {
    return { ok: false, skipped: true, reason: 'plugin root not found' };
  }

  const update = shouldAutoUpdate(options)
    ? tryAutoUpdatePlugin(pluginRoot, { silent })
    : { enabled: false, status: 'disabled' };

  assertSourceAssets(pluginRoot);

  const home = process.env.USERPROFILE || os.homedir();
  if (!home) throw new Error('Cannot resolve user home directory');

  const targets = [
    ['skills', path.join(home, '.codex', 'skills')],
    ['hooks', path.join(home, '.codex', 'harness-spec', 'hooks')],
    ['tools', path.join(home, '.codex', 'harness-spec', 'tools')],
    ['openspec-templates', path.join(home, '.codex', 'openspec-templates')],
  ];

  for (const [sourceName, targetDir] of targets) {
    copyDirectoryContents(path.join(pluginRoot, sourceName), targetDir);
  }

  const statePath = path.join(home, '.codex', 'harness-spec', 'install-state.json');
  ensureDir(path.dirname(statePath));
  fs.writeFileSync(statePath, `${JSON.stringify({
    plugin: 'harness-agentic-spec',
    pluginRoot,
    initializedAt: new Date().toISOString(),
    revision: getGitRevision(pluginRoot),
    autoUpdate: update,
    targets: targets.map(([, targetDir]) => targetDir.replace(/\\/g, '/')),
  }, null, 2)}\n`, 'utf8');

  const result = { ok: true, skipped: false, statePath, autoUpdate: update };
  if (!silent) {
    if (update.enabled && update.status === 'updated') {
      console.log(`[harness-agentic-spec] auto-updated ${update.before} -> ${update.after}`);
    } else if (update.enabled && update.status !== 'up-to-date') {
      console.log(`[harness-agentic-spec] auto-update ${update.status}: ${update.reason || 'no change'}`);
    }
    console.log(`[harness-agentic-spec] initialized Codex assets: ${statePath}`);
  }
  return result;
}

function shouldAutoUpdate(options) {
  if (options.autoUpdate === false) return false;
  const value = String(process.env.HARNESS_SPEC_AUTO_UPDATE || '').trim().toLowerCase();
  return !AUTO_UPDATE_OFF_VALUES.has(value);
}

function tryAutoUpdatePlugin(pluginRoot, options = {}) {
  const result = {
    enabled: true,
    status: 'skipped',
    reason: null,
    before: null,
    after: null,
    upstream: null,
  };

  if (!isGitWorkTree(pluginRoot)) {
    result.reason = 'plugin source is not a git worktree';
    return result;
  }

  result.before = getGitRevision(pluginRoot);

  const dirty = runGit(pluginRoot, ['status', '--porcelain', '--untracked-files=no'], 5000);
  if (!dirty.ok) {
    result.reason = `cannot inspect worktree: ${shortError(dirty)}`;
    return result;
  }
  if (dirty.stdout.trim()) {
    result.reason = 'local tracked changes present';
    return result;
  }

  const upstream = runGit(pluginRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], 5000);
  if (!upstream.ok || !upstream.stdout.trim()) {
    result.reason = 'current branch has no upstream';
    return result;
  }
  result.upstream = upstream.stdout.trim();

  const fetch = runGit(pluginRoot, ['fetch', '--quiet', '--prune'], 15000);
  if (!fetch.ok) {
    result.status = 'failed';
    result.reason = `fetch failed: ${shortError(fetch)}`;
    return result;
  }

  const remoteHead = runGit(pluginRoot, ['rev-parse', '@{u}'], 5000);
  if (!remoteHead.ok || !remoteHead.stdout.trim()) {
    result.reason = 'cannot resolve upstream revision';
    return result;
  }

  const local = String(result.before || '').trim();
  const remote = remoteHead.stdout.trim();
  if (local === remote) {
    result.status = 'up-to-date';
    result.after = local;
    return result;
  }

  const ancestor = runGit(pluginRoot, ['merge-base', '--is-ancestor', 'HEAD', '@{u}'], 5000);
  if (!ancestor.ok) {
    result.reason = 'upstream is not a fast-forward update';
    return result;
  }

  const pull = runGit(pluginRoot, ['pull', '--ff-only', '--quiet'], 20000);
  if (!pull.ok) {
    result.status = 'failed';
    result.reason = `pull failed: ${shortError(pull)}`;
    return result;
  }

  result.after = getGitRevision(pluginRoot);
  result.status = result.before === result.after ? 'up-to-date' : 'updated';
  return result;
}

function isGitWorkTree(pluginRoot) {
  const probe = runGit(pluginRoot, ['rev-parse', '--is-inside-work-tree'], 5000);
  return probe.ok && probe.stdout.trim() === 'true';
}

function getGitRevision(pluginRoot) {
  const revision = runGit(pluginRoot, ['rev-parse', '--short=12', 'HEAD'], 5000);
  return revision.ok ? revision.stdout.trim() : null;
}

function runGit(cwd, args, timeoutMs) {
  try {
    const child = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      timeout: timeoutMs,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return {
      ok: child.status === 0 && !child.error,
      status: child.status,
      stdout: child.stdout || '',
      stderr: child.stderr || '',
      error: child.error || null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      stdout: '',
      stderr: '',
      error,
    };
  }
}

function shortError(result) {
  const message = result.stderr || result.stdout || (result.error && result.error.message) || 'unknown error';
  return message.trim().split(/\r?\n/).slice(0, 2).join(' | ');
}

function findPluginRoot() {
  const root = path.resolve(__dirname, '..');
  const manifest = path.join(root, '.codex-plugin', 'plugin.json');
  if (fs.existsSync(manifest)) return root;

  const statePath = path.join(root, 'install-state.json');
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state.pluginRoot && fs.existsSync(path.join(state.pluginRoot, '.codex-plugin', 'plugin.json'))) {
        return state.pluginRoot;
      }
    } catch {
      return null;
    }
  }

  const envRoot = process.env.HARNESS_SPEC_PLUGIN_ROOT;
  if (envRoot && fs.existsSync(path.join(envRoot, '.codex-plugin', 'plugin.json'))) {
    return envRoot;
  }

  return null;
}

function assertSourceAssets(pluginRoot) {
  for (const relativePath of REQUIRED_SOURCE_ITEMS) {
    const fullPath = path.join(pluginRoot, ...relativePath.split('/'));
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing plugin asset: ${relativePath}`);
    }
  }
}

function copyDirectoryContents(sourceDir, targetDir) {
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      ensureDir(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

if (require.main === module) {
  try {
    const noUpdate = process.argv.includes('--no-update');
    bootstrapCodexAssets({ silent: false, autoUpdate: !noUpdate });
  } catch (error) {
    console.error(`[harness-agentic-spec] initialization failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  bootstrapCodexAssets,
  tryAutoUpdatePlugin,
};
