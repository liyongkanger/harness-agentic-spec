#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const STAGES = [
  'proposal',
  'impact',
  'design',
  'tasks',
  'implementation',
  'verification',
  'review',
  'archive',
];

const STAGE_STATUSES = new Set(['pending', 'running', 'passed', 'blocked']);
const TASK_STATUSES = new Set([
  'pending',
  'in_progress',
  'implemented',
  'verified',
  'reviewed',
  'needs_fix',
  'blocked',
  'done',
]);

const REQUIRED_ARTIFACTS = {
  proposal: 'proposal.md',
  impact: 'impact.md',
  design: 'design.md',
  tasks: 'tasks.md',
  verification: 'verification.md',
  review: 'review.md',
};

const REQUIRED_AGENT_SPACE = [
  'brief.md',
  'assignments.md',
  'assignments.json',
  'decisions.md',
  'questions.md',
  'findings',
  'reviews',
  'verification',
  'checkpoints',
  'handoffs',
];

const AGENT_MODES = new Set(['read_only', 'write_allowed', 'write_docs']);
const AGENT_STATUSES = new Set(['pending', 'in_progress', 'done', 'blocked']);
const MAIN_AGENT_ONLY_PATTERNS = [
  /(^|\/)run\.json$/,
  /(^|\/)agent-space\/decisions\.md$/,
  /(^|\/)agent-space\/assignments\.json$/,
];

const PLACEHOLDER_PATTERNS = [
  /\{change-id\}/,
  /\{Change Title\}/,
  /\{变更标题\}/,
  /\{变更点\s*\d+\}/,
  /\{可观察、可验证的验收标准\s*\d+\}/,
  /\{功能点\}/,
  /\{验收项\}/,
  /\{风险\s*\d+\}/,
  /待确认/,
  /待填写/,
];

const GATE_RULES = {
  proposal: {
    artifact: 'proposal.md',
    requiredSections: ['为什么做', '改什么', '验收标准', '非目标', '开放问题'],
    note: 'Demand must be executable and acceptance criteria must be observable.',
  },
  impact: {
    artifact: 'impact.md',
    requiredSections: ['代码证据', '影响模块', '可能涉及文件', '风险', '影响面门禁'],
    note: 'Impact analysis must be evidence-backed before design starts.',
  },
  design: {
    artifact: 'design.md',
    requiredSections: ['概述', '决策', '实现方案', '数据和契约变更', '错误处理和边界场景', '测试策略', '设计门禁'],
    note: 'Design must map acceptance criteria to implementable behavior.',
  },
  tasks: {
    artifact: 'tasks.md',
    requiredSections: ['实现任务', '任务级循环', '最终门禁'],
    note: 'Tasks must be independently executable and reviewable.',
  },
  implementation: {
    artifact: 'tasks.md',
    requiredSections: ['实现任务', '最终门禁'],
    note: 'Implementation must finish every task with evidence.',
  },
  verification: {
    artifact: 'verification.md',
    requiredSections: ['命令', '测试', '人工/静态检查', '验证结论'],
    note: 'Verification must contain concrete command and test results.',
  },
  review: {
    artifact: 'review.md',
    requiredSections: ['需求级审查结论', '验收覆盖', '任务审查', '跨任务业务流审查', '审查反思', '审查结论'],
    strict: true,
    note: 'Review must prove acceptance coverage and residual risk.',
  },
  archive: {
    artifact: 'review.md',
    requiredSections: ['需求级审查结论', '验收覆盖', '审查结论'],
    strict: true,
    note: 'Archive requires review to be complete and long-term behavior captured when needed.',
  },
};

function main() {
  const rawArgs = process.argv.slice(2);
  const command = rawArgs[0];

  if (!command || command === '-h' || command === '--help' || command === 'help') {
    printHelp();
    return 0;
  }

  const { opts, positional } = parseArgs(rawArgs.slice(1));
  const root = path.resolve(opts.root || process.cwd());

  if (command === 'status') {
    return runStatus(root, opts);
  }

  if (command === 'validate') {
    return runValidate(root, opts, positional);
  }

  if (command === 'gate') {
    return runGate(root, opts, positional);
  }

  if (command === 'agents') {
    return runAgents(root, opts, positional);
  }

  printError(`Unknown command: ${command}`);
  printHelp();
  return 2;
}

function parseArgs(args) {
  const opts = {
    all: false,
    json: false,
    strict: false,
    root: null,
    waive: null,
  };
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--all') {
      opts.all = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--strict') {
      opts.strict = true;
    } else if (arg === '--waive') {
      i += 1;
      if (i >= args.length) throwUsage('--waive requires a reason');
      opts.waive = args[i];
    } else if (arg.startsWith('--waive=')) {
      opts.waive = arg.slice('--waive='.length);
    } else if (arg === '--root') {
      i += 1;
      if (i >= args.length) throwUsage('--root requires a value');
      opts.root = args[i];
    } else if (arg.startsWith('--root=')) {
      opts.root = arg.slice('--root='.length);
    } else if (arg.startsWith('-')) {
      throwUsage(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  return { opts, positional };
}

function runStatus(root, opts) {
  const result = {
    ok: true,
    command: 'status',
    root,
    changes: [],
    error: null,
  };

  let changes;
  try {
    changes = discoverChanges(root);
  } catch (e) {
    result.ok = false;
    result.error = e.message;
    return finish(result, opts.json);
  }

  result.changes = changes
    .filter(change => opts.all || !isArchived(change.run))
    .map(change => summarizeChange(change));

  return finish(result, opts.json);
}

function runValidate(root, opts, positional) {
  const result = {
    ok: true,
    command: 'validate',
    root,
    strict: opts.strict,
    changes: [],
    summary: {
      errors: 0,
      warnings: 0,
    },
    error: null,
  };

  let changes;
  try {
    changes = discoverChanges(root);
  } catch (e) {
    result.ok = false;
    result.error = e.message;
    return finish(result, opts.json);
  }

  let selected;
  if (opts.all) {
    selected = changes;
  } else if (positional.length > 0) {
    const wanted = new Set(positional);
    selected = changes.filter(change => wanted.has(change.name));
    for (const changeId of wanted) {
      if (!selected.some(change => change.name === changeId)) {
        const missing = {
          change: changeId,
          ok: false,
          errors: [{ code: 'change.missing', message: `Change not found: ${changeId}` }],
          warnings: [],
        };
        result.changes.push(missing);
        result.summary.errors += 1;
      }
    }
  } else {
    selected = changes.filter(change => !isArchived(change.run));
  }

  for (const change of selected) {
    const changeResult = validateChange(root, change, opts.strict);
    result.changes.push(changeResult);
    result.summary.errors += changeResult.errors.length;
    result.summary.warnings += changeResult.warnings.length;
  }

  result.ok = result.summary.errors === 0;
  return finish(result, opts.json);
}

function runGate(root, opts, positional) {
  const stage = positional[0];
  const changeId = positional[1];
  const result = {
    ok: false,
    command: 'gate',
    root,
    stage: stage || null,
    change: changeId || null,
    decision: 'block',
    strict: false,
    waived: false,
    waiver_reason: opts.waive || null,
    errors: [],
    warnings: [],
    checks: [],
    note: null,
    error: null,
  };

  if (!stage || !changeId) {
    result.error = 'gate requires <stage> and <change-id>';
    return finish(result, opts.json);
  }

  if (!GATE_RULES[stage]) {
    result.error = `Unknown gate stage: ${stage}`;
    return finish(result, opts.json);
  }

  let changes;
  try {
    changes = discoverChanges(root);
  } catch (e) {
    result.error = e.message;
    return finish(result, opts.json);
  }

  const change = changes.find(item => item.name === changeId);
  if (!change) {
    result.errors.push({ code: 'change.missing', message: `Change not found: ${changeId}` });
    return finishGate(result, opts.json);
  }

  const rule = GATE_RULES[stage];
  const strict = opts.strict || Boolean(rule.strict);
  const validation = validateChange(root, change, strict);
  result.strict = strict;
  result.errors.push(...validation.errors);
  result.warnings.push(...validation.warnings);
  result.note = rule.note;

  applyGateRules(root, change, stage, rule, result);
  return finishGate(result, opts.json);
}

function runAgents(root, opts, positional) {
  const subcommand = positional[0];
  const changeId = positional[1];
  const result = {
    ok: false,
    command: 'agents',
    subcommand: subcommand || null,
    root,
    change: changeId || null,
    assignments_path: null,
    agents: [],
    errors: [],
    warnings: [],
    created: false,
    error: null,
  };

  if (!subcommand || !['init', 'status', 'verify'].includes(subcommand)) {
    result.error = 'agents requires one of: init, status, verify';
    return finish(result, opts.json);
  }
  if (!changeId) {
    result.error = 'agents command requires <change-id>';
    return finish(result, opts.json);
  }

  let change;
  try {
    change = findChange(root, changeId);
  } catch (e) {
    result.error = e.message;
    return finish(result, opts.json);
  }

  result.assignments_path = rel(root, assignmentsJsonPath(change));

  if (subcommand === 'init') {
    return runAgentsInit(root, change, result, opts);
  }
  if (subcommand === 'status') {
    return runAgentsStatus(root, change, result, opts);
  }
  return runAgentsVerify(root, change, result, opts);
}

function runAgentsInit(root, change, result, opts) {
  const assignmentsPath = assignmentsJsonPath(change);
  if (fs.existsSync(assignmentsPath)) {
    const existing = readJson(assignmentsPath);
    result.agents = Array.isArray(existing.agents) ? existing.agents : [];
    result.warnings.push({
      code: 'agents.assignments_exists',
      message: 'assignments.json already exists; left unchanged',
      file: rel(root, assignmentsPath),
    });
    result.ok = true;
    return finish(result, opts.json);
  }

  ensureDir(path.dirname(assignmentsPath));
  ensureDir(path.join(change.dir, 'agent-space', 'handoffs'));

  const taskIds = extractTaskIds(path.join(change.dir, 'tasks.md'));
  const agents = [];

  if (taskIds.length === 0) {
    result.warnings.push({
      code: 'agents.no_tasks',
      message: 'No Tn tasks found in tasks.md; created impact-only assignments',
      file: rel(root, path.join(change.dir, 'tasks.md')),
    });
    agents.push(...defaultImpactAgents(change.name));
  } else {
    for (const taskId of taskIds) {
      agents.push(defaultWorkerAgent(change.name, taskId));
      agents.push(defaultVerifierAgent(change.name, taskId));
      agents.push(defaultReviewerAgent(change.name, taskId));
    }
  }

  const assignments = {
    version: 1,
    change_id: change.name,
    agents,
  };

  fs.writeFileSync(assignmentsPath, JSON.stringify(assignments, null, 2) + '\n', 'utf8');
  result.created = true;
  result.agents = agents;
  result.ok = true;
  return finish(result, opts.json);
}

function runAgentsStatus(root, change, result, opts) {
  const assignments = loadAssignments(change, result);
  if (!assignments) return finish(result, opts.json);

  result.agents = Array.isArray(assignments.agents) ? assignments.agents : [];
  result.ok = result.errors.length === 0;
  return finish(result, opts.json);
}

function runAgentsVerify(root, change, result, opts) {
  const assignments = loadAssignments(change, result);
  if (!assignments) return finish(result, opts.json);

  verifyAssignments(root, change, assignments, result, {
    requireOutputs: opts.strict,
    requireDone: opts.strict,
  });
  result.agents = Array.isArray(assignments.agents) ? assignments.agents : [];
  result.ok = result.errors.length === 0;
  return finish(result, opts.json);
}

function applyGateRules(root, change, stage, rule, result) {
  if (change.runError || !change.run) return;

  const run = change.run;
  const stageIndex = STAGES.indexOf(stage);
  const addCheck = (name, status, detail) => {
    const check = { name, status };
    if (detail) check.detail = detail;
    result.checks.push(check);
  };
  const addError = (code, message, file) => {
    const item = { code, message };
    if (file) item.file = rel(root, file);
    result.errors.push(item);
  };
  const addWarning = (code, message, file) => {
    const item = { code, message };
    if (file) item.file = rel(root, file);
    result.warnings.push(item);
  };

  if (run.current_stage !== STAGES[stageIndex + 1] && run.current_stage !== stage) {
    addWarning(
      'gate.current_stage_unexpected',
      `Gate "${stage}" usually runs while current_stage is "${stage}" or after moving to "${STAGES[stageIndex + 1] || 'archive'}"; current_stage is "${run.current_stage}"`,
      change.runPath,
    );
  }

  const currentStatus = run.stages && run.stages[stage];
  if (currentStatus !== 'passed') {
    addError('gate.stage_not_passed', `Stage "${stage}" must be passed before this gate can pass`, change.runPath);
    addCheck('stage passed', 'block', `status=${currentStatus || 'missing'}`);
  } else {
    addCheck('stage passed', 'pass');
  }

  for (let i = 0; i < stageIndex; i += 1) {
    const previous = STAGES[i];
    if (run.stages[previous] !== 'passed') {
      addError('gate.previous_stage_not_passed', `Previous stage "${previous}" must be passed`, change.runPath);
    }
  }

  const artifactPath = path.join(change.dir, rule.artifact);
  if (!fs.existsSync(artifactPath)) {
    addError('gate.artifact_missing', `Gate artifact missing: ${rule.artifact}`, artifactPath);
    addCheck('artifact exists', 'block', rule.artifact);
  } else {
    addCheck('artifact exists', 'pass', rule.artifact);
    const text = readText(artifactPath);
    for (const section of rule.requiredSections) {
      if (!hasMarkdownHeading(text, section)) {
        addError('gate.required_section_missing', `Missing required section in ${rule.artifact}: ${section}`, artifactPath);
      }
    }
    const unresolved = PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));
    if (unresolved) {
      addError('gate.placeholder', `Unresolved placeholder content in ${rule.artifact}`, artifactPath);
    } else {
      addCheck('no placeholders in gate artifact', 'pass', rule.artifact);
    }
  }

  const checkpointPath = path.join(change.dir, 'agent-space', 'checkpoints', `${stage}-done.md`);
  if (stage !== 'archive') {
    if (!fs.existsSync(checkpointPath)) {
      addError('gate.checkpoint_missing', `Missing gate checkpoint: ${stage}-done.md`, checkpointPath);
    } else {
      addCheck('checkpoint exists', 'pass', `${stage}-done.md`);
    }
  }

  if (stage === 'tasks') {
    const taskCount = countTaskItems(path.join(change.dir, 'tasks.md'));
    if (taskCount === 0) {
      addError('gate.tasks_empty', 'tasks.md must contain at least one Tn task', path.join(change.dir, 'tasks.md'));
    } else {
      addCheck('tasks present', 'pass', `${taskCount} task(s)`);
    }
  }

  if (['tasks', 'implementation', 'verification', 'review'].includes(stage)) {
    const agentResult = {
      errors: [],
      warnings: [],
    };
    const assignments = loadAssignments(change, agentResult);
    if (!assignments) {
      addError('gate.agent_assignments_missing', 'agent-space/assignments.json is required for Agent collaboration gates', assignmentsJsonPath(change));
    } else {
      verifyAssignments(root, change, assignments, agentResult, {
        requireOutputs: ['implementation', 'verification', 'review'].includes(stage),
        requireDone: ['verification', 'review'].includes(stage),
      });
      for (const error of agentResult.errors) {
        result.errors.push(error);
      }
      for (const warning of agentResult.warnings) {
        result.warnings.push(warning);
      }
      if (agentResult.errors.length === 0) {
        addCheck('agent assignments verified', 'pass');
      }
    }
  }

  if (stage === 'implementation' || stage === 'verification' || stage === 'review' || stage === 'archive') {
    const incomplete = findIncompleteTasks(path.join(change.dir, 'tasks.md'));
    if (incomplete.length > 0) {
      addError('gate.tasks_not_done', `All tasks must be done; incomplete statuses: ${incomplete.join(', ')}`, path.join(change.dir, 'tasks.md'));
    } else {
      addCheck('all tasks done', 'pass');
    }
  }
}

function findChange(root, changeId) {
  const changes = discoverChanges(root);
  const change = changes.find(item => item.name === changeId);
  if (!change) throw new Error(`Change not found: ${changeId}`);
  return change;
}

function assignmentsJsonPath(change) {
  return path.join(change.dir, 'agent-space', 'assignments.json');
}

function loadAssignments(change, result) {
  const file = assignmentsJsonPath(change);
  if (!fs.existsSync(file)) {
    result.errors.push({
      code: 'agents.assignments_missing',
      message: 'Missing agent-space/assignments.json',
      file: rel(change.root || process.cwd(), file),
    });
    return null;
  }

  try {
    const assignments = readJson(file);
    if (!assignments || typeof assignments !== 'object') {
      result.errors.push({
        code: 'agents.assignments_invalid',
        message: 'assignments.json must contain an object',
        file: rel(change.root || process.cwd(), file),
      });
      return null;
    }
    return assignments;
  } catch (e) {
    result.errors.push({
      code: 'agents.assignments_invalid_json',
      message: e.message,
      file: rel(change.root || process.cwd(), file),
    });
    return null;
  }
}

function verifyAssignments(root, change, assignments, result, options = {}) {
  const file = assignmentsJsonPath(change);
  if (assignments.change_id !== change.name) {
    result.errors.push({
      code: 'agents.change_id_mismatch',
      message: `assignments.change_id must match directory name "${change.name}"`,
      file: rel(root, file),
    });
  }

  if (!Array.isArray(assignments.agents)) {
    result.errors.push({
      code: 'agents.list_missing',
      message: 'assignments.agents must be an array',
      file: rel(root, file),
    });
    return;
  }

  const ids = new Set();
  const taskRoles = new Map();
  const writeAgents = [];

  for (const agent of assignments.agents) {
    const agentId = agent && agent.id;
    if (!agentId) {
      result.errors.push({ code: 'agents.id_missing', message: 'Every agent must have an id', file: rel(root, file) });
      continue;
    }
    if (ids.has(agentId)) {
      result.errors.push({ code: 'agents.id_duplicate', message: `Duplicate agent id: ${agentId}`, file: rel(root, file) });
    }
    ids.add(agentId);

    if (!agent.role) {
      result.errors.push({ code: 'agents.role_missing', message: `Agent ${agentId} must declare role`, file: rel(root, file) });
    }
    if (!AGENT_MODES.has(agent.mode)) {
      result.errors.push({ code: 'agents.mode_invalid', message: `Agent ${agentId} has invalid mode: ${agent.mode}`, file: rel(root, file) });
    }
    if (!AGENT_STATUSES.has(agent.status)) {
      result.errors.push({ code: 'agents.status_invalid', message: `Agent ${agentId} has invalid status: ${agent.status}`, file: rel(root, file) });
    }

    const outputs = Array.isArray(agent.required_outputs) ? agent.required_outputs : [];
    if (outputs.length === 0) {
      result.errors.push({ code: 'agents.outputs_missing', message: `Agent ${agentId} must declare required_outputs`, file: rel(root, file) });
    }
    for (const output of outputs) {
      const outputPath = path.join(change.dir, output);
      if (!fs.existsSync(outputPath)) {
        const item = { code: 'agents.output_missing', message: `Agent ${agentId} required output missing: ${output}`, file: rel(root, outputPath) };
        if (options.requireOutputs) result.errors.push(item);
        else result.warnings.push(item);
      }
    }

    if (options.requireDone && agent.status !== 'done') {
      result.errors.push({ code: 'agents.not_done', message: `Agent ${agentId} must be done before this gate`, file: rel(root, file) });
    }

    const ownedPaths = Array.isArray(agent.owned_paths) ? agent.owned_paths : [];
    if (agent.mode === 'write_allowed') {
      if (ownedPaths.length === 0) {
        result.errors.push({ code: 'agents.owned_paths_missing', message: `Write agent ${agentId} must declare owned_paths`, file: rel(root, file) });
      }
      writeAgents.push({ id: agentId, paths: ownedPaths });
    }

    for (const ownedPath of ownedPaths) {
      if (MAIN_AGENT_ONLY_PATTERNS.some(pattern => pattern.test(normalizePath(ownedPath)))) {
        result.errors.push({
          code: 'agents.main_agent_path_owned',
          message: `Agent ${agentId} cannot own main-agent-only path: ${ownedPath}`,
          file: rel(root, file),
        });
      }
    }

    if (agent.task) {
      const taskId = String(agent.task);
      if (!taskRoles.has(taskId)) taskRoles.set(taskId, new Map());
      const roles = taskRoles.get(taskId);
      const role = String(agent.role);
      if (!roles.has(role)) roles.set(role, []);
      roles.get(role).push(agentId);
    }
  }

  checkOwnedPathConflicts(writeAgents, result, rel(root, file));
  checkTaskRoleSeparation(taskRoles, result, rel(root, file));
}

function checkOwnedPathConflicts(writeAgents, result, file) {
  for (let i = 0; i < writeAgents.length; i += 1) {
    for (let j = i + 1; j < writeAgents.length; j += 1) {
      for (const left of writeAgents[i].paths) {
        for (const right of writeAgents[j].paths) {
          if (pathsOverlap(left, right)) {
            result.errors.push({
              code: 'agents.owned_paths_conflict',
              message: `Write agents ${writeAgents[i].id} and ${writeAgents[j].id} have overlapping owned_paths: ${left} <-> ${right}`,
              file,
            });
          }
        }
      }
    }
  }
}

function checkTaskRoleSeparation(taskRoles, result, file) {
  for (const [taskId, roles] of taskRoles.entries()) {
    const workers = roles.get('worker') || roles.get('implementation') || [];
    const reviewers = roles.get('reviewer') || roles.get('review') || [];
    const verifiers = roles.get('verifier') || roles.get('verification') || [];

    if (workers.length > 0 && reviewers.length === 0) {
      result.errors.push({ code: 'agents.reviewer_missing', message: `Task ${taskId} must have a reviewer agent`, file });
    }
    if (workers.length > 0 && verifiers.length === 0) {
      result.errors.push({ code: 'agents.verifier_missing', message: `Task ${taskId} must have a verifier agent`, file });
    }

    for (const worker of workers) {
      if (reviewers.includes(worker)) {
        result.errors.push({ code: 'agents.reviewer_not_independent', message: `Task ${taskId} reviewer cannot be the same as worker: ${worker}`, file });
      }
      if (verifiers.includes(worker)) {
        result.errors.push({ code: 'agents.verifier_not_independent', message: `Task ${taskId} verifier cannot be the same as worker: ${worker}`, file });
      }
    }
  }
}

function defaultImpactAgents(changeId) {
  return [
    {
      id: 'impact-api',
      role: 'impact',
      task: null,
      mode: 'read_only',
      owned_paths: [],
      forbidden_paths: mainAgentOnlyPaths(changeId),
      required_outputs: ['agent-space/findings/impact-api.md'],
      status: 'pending',
    },
    {
      id: 'impact-db',
      role: 'impact',
      task: null,
      mode: 'read_only',
      owned_paths: [],
      forbidden_paths: mainAgentOnlyPaths(changeId),
      required_outputs: ['agent-space/findings/impact-db.md'],
      status: 'pending',
    },
    {
      id: 'impact-job-mq',
      role: 'impact',
      task: null,
      mode: 'read_only',
      owned_paths: [],
      forbidden_paths: mainAgentOnlyPaths(changeId),
      required_outputs: ['agent-space/findings/impact-job-mq.md'],
      status: 'pending',
    },
  ];
}

function defaultWorkerAgent(changeId, taskId) {
  return {
    id: `worker-${taskId}`,
    role: 'worker',
    task: taskId,
    mode: 'write_allowed',
    owned_paths: [],
    forbidden_paths: mainAgentOnlyPaths(changeId),
    required_outputs: [`agent-space/handoffs/${taskId}-worker.md`],
    status: 'pending',
  };
}

function defaultVerifierAgent(changeId, taskId) {
  return {
    id: `verifier-${taskId}`,
    role: 'verifier',
    task: taskId,
    mode: 'write_docs',
    owned_paths: [`openspec/changes/${changeId}/agent-space/verification/${taskId}.md`],
    forbidden_paths: mainAgentOnlyPaths(changeId),
    required_outputs: [`agent-space/verification/${taskId}.md`],
    status: 'pending',
  };
}

function defaultReviewerAgent(changeId, taskId) {
  return {
    id: `reviewer-${taskId}`,
    role: 'reviewer',
    task: taskId,
    mode: 'write_docs',
    owned_paths: [`openspec/changes/${changeId}/agent-space/reviews/${taskId}-review.md`],
    forbidden_paths: mainAgentOnlyPaths(changeId),
    required_outputs: [`agent-space/reviews/${taskId}-review.md`],
    status: 'pending',
  };
}

function mainAgentOnlyPaths(changeId) {
  return [
    `openspec/changes/${changeId}/run.json`,
    `openspec/changes/${changeId}/agent-space/decisions.md`,
    `openspec/changes/${changeId}/agent-space/assignments.json`,
  ];
}

function finishGate(result, json) {
  if (result.errors.length > 0) {
    if (result.waiver_reason) {
      result.decision = 'waived';
      result.waived = true;
      result.ok = true;
    } else {
      result.decision = 'block';
      result.ok = false;
    }
  } else if (result.warnings.length > 0) {
    result.decision = 'warn';
    result.ok = true;
  } else {
    result.decision = 'pass';
    result.ok = true;
  }

  return finish(result, json);
}

function discoverChanges(root) {
  const changesDir = path.join(root, 'openspec', 'changes');
  if (!fs.existsSync(changesDir)) {
    throw new Error(`OpenSpec changes directory not found: ${changesDir}`);
  }

  const entries = fs.readdirSync(changesDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .filter(entry => !entry.name.startsWith('_'))
    .map(entry => {
      const dir = path.join(changesDir, entry.name);
      const runPath = path.join(dir, 'run.json');
      let run = null;
      let runError = null;

      try {
        run = readJson(runPath);
      } catch (e) {
        runError = e.message;
      }

      return {
        name: entry.name,
        dir,
        runPath,
        root,
        run,
        runError,
      };
    });
}

function summarizeChange(change) {
  const run = change.run || {};
  return {
    change_id: run.change_id || change.name,
    title: run.title || '',
    current_stage: run.current_stage || null,
    stage_status: run.stages && run.current_stage ? run.stages[run.current_stage] : null,
    active_task: run.active_task || null,
    iteration: Number.isInteger(run.iteration) ? run.iteration : null,
    updated_at: run.updated_at || null,
    last_error: run.last_error || null,
    path: rel(change.root || process.cwd(), change.dir),
    valid_run_json: !change.runError,
    run_error: change.runError,
  };
}

function validateChange(root, change, strict) {
  const errors = [];
  const warnings = [];

  const add = (severity, code, message, file) => {
    const item = { code, message };
    if (file) item.file = rel(root, file);
    if (severity === 'error') errors.push(item);
    else warnings.push(item);
  };

  if (change.runError) {
    add('error', 'run.invalid_json', change.runError, change.runPath);
    return {
      change: change.name,
      ok: false,
      errors,
      warnings,
    };
  }

  const run = change.run;
  if (!run || typeof run !== 'object') {
    add('error', 'run.invalid', 'run.json must contain a JSON object', change.runPath);
    return { change: change.name, ok: false, errors, warnings };
  }

  validateRunJson(change, run, add);
  validateArtifacts(change, run, strict, add);
  validateAgentSpace(change, run, strict, add);
  validateTasksMarkdown(change, add);
  validateCheckpoints(change, strict, add);

  return {
    change: change.name,
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function validateRunJson(change, run, add) {
  if (run.change_id !== change.name) {
    add('error', 'run.change_id_mismatch', `run.change_id must match directory name "${change.name}"`, change.runPath);
  }

  if (!STAGES.includes(run.current_stage)) {
    add('error', 'run.current_stage_invalid', `Invalid current_stage: ${run.current_stage}`, change.runPath);
  }

  if (!run.stages || typeof run.stages !== 'object') {
    add('error', 'run.stages_missing', 'run.stages must be an object', change.runPath);
    return;
  }

  for (const stage of STAGES) {
    if (!(stage in run.stages)) {
      add('error', 'run.stage_missing', `Missing stage status: ${stage}`, change.runPath);
      continue;
    }
    if (!STAGE_STATUSES.has(run.stages[stage])) {
      add('error', 'run.stage_status_invalid', `Invalid status for ${stage}: ${run.stages[stage]}`, change.runPath);
    }
  }

  for (const stage of Object.keys(run.stages)) {
    if (!STAGES.includes(stage)) {
      add('warning', 'run.stage_unknown', `Unknown stage in run.stages: ${stage}`, change.runPath);
    }
  }

  const currentIndex = STAGES.indexOf(run.current_stage);
  if (currentIndex > 0) {
    for (let i = 0; i < currentIndex; i += 1) {
      const previous = STAGES[i];
      if (run.stages[previous] !== 'passed') {
        add('error', 'run.previous_stage_not_passed', `Stage "${previous}" must be passed before current_stage "${run.current_stage}"`, change.runPath);
      }
    }
  }

  for (let i = 1; i < STAGES.length; i += 1) {
    const stage = STAGES[i];
    if (run.stages[stage] === 'passed') {
      const missingPrevious = STAGES.slice(0, i).find(previous => run.stages[previous] !== 'passed');
      if (missingPrevious) {
        add('error', 'run.stage_order_invalid', `Stage "${stage}" is passed before "${missingPrevious}"`, change.runPath);
      }
    }
  }

  const hasBlockedStage = STAGES.some(stage => run.stages[stage] === 'blocked');
  if (hasBlockedStage && !run.last_error) {
    add('warning', 'run.blocked_without_error', 'A stage is blocked but last_error is empty', change.runPath);
  }
  if (!hasBlockedStage && run.last_error) {
    add('warning', 'run.error_without_block', 'last_error is set but no stage is blocked', change.runPath);
  }

  if (!Number.isInteger(run.iteration) || run.iteration < 0) {
    add('error', 'run.iteration_invalid', 'iteration must be a non-negative integer', change.runPath);
  }

  if (run.updated_at && Number.isNaN(Date.parse(run.updated_at))) {
    add('warning', 'run.updated_at_invalid', `updated_at is not parseable: ${run.updated_at}`, change.runPath);
  }

  if (run.active_task != null && !/^T\d+$/.test(String(run.active_task))) {
    add('warning', 'run.active_task_format', `active_task should look like T1/T2: ${run.active_task}`, change.runPath);
  }
}

function validateArtifacts(change, run, strict, add) {
  const artifacts = run.artifacts && typeof run.artifacts === 'object' ? run.artifacts : {};

  for (const [stage, defaultFile] of Object.entries(REQUIRED_ARTIFACTS)) {
    const artifactPath = artifacts[stage] || defaultFile;
    const fullPath = path.join(change.dir, artifactPath);
    if (!fs.existsSync(fullPath)) {
      add('error', 'artifact.missing', `Missing artifact for ${stage}: ${artifactPath}`, fullPath);
      continue;
    }

    const text = readText(fullPath);
    const hasPlaceholder = PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));
    if (hasPlaceholder) {
      const stagePassed = run.stages && run.stages[stage] === 'passed';
      if (strict || stagePassed) {
        add(strict ? 'error' : 'warning', 'artifact.placeholder', `Unresolved placeholder content in ${artifactPath}`, fullPath);
      }
    }
  }
}

function validateAgentSpace(change, run, strict, add) {
  const artifactPath = run.artifacts && run.artifacts.agent_space ? run.artifacts.agent_space : 'agent-space/';
  const agentSpaceDir = path.join(change.dir, artifactPath);

  if (!fs.existsSync(agentSpaceDir) || !fs.statSync(agentSpaceDir).isDirectory()) {
    add('error', 'agent_space.missing', `Missing agent-space directory: ${artifactPath}`, agentSpaceDir);
    return;
  }

  for (const item of REQUIRED_AGENT_SPACE) {
    const fullPath = path.join(agentSpaceDir, item);
    if (!fs.existsSync(fullPath)) {
      add(strict ? 'error' : 'warning', `agent_space.${item}.missing`, `Missing agent-space item: ${item}`, fullPath);
    }
  }
}

function validateTasksMarkdown(change, add) {
  const tasksPath = path.join(change.dir, 'tasks.md');
  if (!fs.existsSync(tasksPath)) return;

  const text = readText(tasksPath);
  const matches = [
    ...text.matchAll(/状态[：:]\s*`([^`]+)`/g),
    ...text.matchAll(/状态[：:]\s*([a-z_]+)/g),
  ];

  const seen = new Set();
  for (const match of matches) {
    const status = String(match[1]).trim();
    if (seen.has(status)) continue;
    seen.add(status);
    if (!TASK_STATUSES.has(status)) {
      add('error', 'task.status_invalid', `Invalid task status in tasks.md: ${status}`, tasksPath);
    }
  }
}

function validateCheckpoints(change, strict, add) {
  const checkpointsDir = path.join(change.dir, 'agent-space', 'checkpoints');
  if (!fs.existsSync(checkpointsDir) || !fs.statSync(checkpointsDir).isDirectory()) {
    return;
  }

  const checkpointFiles = fs.readdirSync(checkpointsDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(checkpointsDir, file));

  for (const file of checkpointFiles) {
    const text = readText(file);
    const lineCount = text.trimEnd().split(/\r?\n/).length;
    if (lineCount > 30) {
      add(strict ? 'error' : 'warning', 'checkpoint.too_long', `Checkpoint exceeds 30 lines (${lineCount})`, file);
    }
  }

  const run = readJson(change.runPath);
  for (const stage of STAGES) {
    if (stage === 'archive') continue;
    if (run.stages && run.stages[stage] === 'passed') {
      const expected = path.join(checkpointsDir, `${stage}-done.md`);
      if (!fs.existsSync(expected)) {
        add(strict ? 'error' : 'warning', 'checkpoint.missing_for_passed_stage', `Missing checkpoint for passed stage: ${stage}-done.md`, expected);
      }
    }
  }
}

function hasMarkdownHeading(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, 'm').test(text);
}

function countTaskItems(tasksPath) {
  if (!fs.existsSync(tasksPath)) return 0;
  const text = readText(tasksPath);
  return [...text.matchAll(/^\s*-\s+\[[ xX]\]\s+T\d+\./gm)].length;
}

function findIncompleteTasks(tasksPath) {
  if (!fs.existsSync(tasksPath)) return ['missing tasks.md'];
  const text = readText(tasksPath);
  const statuses = [...text.matchAll(/状态[：:]\s*`([^`]+)`/g)].map(match => String(match[1]).trim());
  if (statuses.length === 0) return ['missing task statuses'];
  return [...new Set(statuses.filter(status => status !== 'done'))];
}

function extractTaskIds(tasksPath) {
  if (!fs.existsSync(tasksPath)) return [];
  const text = readText(tasksPath);
  return [...new Set([...text.matchAll(/^\s*-\s+\[[ xX]\]\s+(T\d+)\./gm)].map(match => match[1]))];
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function pathsOverlap(left, right) {
  const a = normalizePath(left);
  const b = normalizePath(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const aPrefix = staticPrefix(a);
  const bPrefix = staticPrefix(b);
  if (!aPrefix || !bPrefix) return true;
  return aPrefix.startsWith(`${bPrefix}/`) || bPrefix.startsWith(`${aPrefix}/`) || aPrefix === bPrefix;
}

function staticPrefix(pattern) {
  const normalized = normalizePath(pattern);
  const wildcardIndex = normalized.search(/[*?\[]/);
  const raw = wildcardIndex === -1 ? normalized : normalized.slice(0, wildcardIndex);
  return raw.replace(/\/+$/, '');
}

function isArchived(run) {
  if (!run) return false;
  return run.current_stage === 'archive' || run.current_stage === 'archived';
}

function readJson(file) {
  try {
    return JSON.parse(stripBom(fs.readFileSync(file, 'utf8')));
  } catch (e) {
    throw new Error(`${file}: ${e.message}`);
  }
}

function readText(file) {
  return stripBom(fs.readFileSync(file, 'utf8'));
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function finish(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }
  return result.ok ? 0 : 1;
}

function printResult(result) {
  if (result.error) {
    printError(result.error);
    return;
  }

  if (result.command === 'status') {
    if (result.changes.length === 0) {
      console.log('No matching changes.');
      return;
    }
    for (const change of result.changes) {
      const status = change.stage_status ? `${change.current_stage}:${change.stage_status}` : change.current_stage || 'unknown';
      const task = change.active_task || 'none';
      const title = change.title ? ` - ${change.title}` : '';
      console.log(`${change.change_id} [${status}] task=${task}${title}`);
      if (change.last_error) console.log(`  blocked: ${change.last_error}`);
      if (change.run_error) console.log(`  run.json error: ${change.run_error}`);
    }
    return;
  }

  if (result.command === 'gate') {
    const label = result.decision.toUpperCase();
    console.log(`${label} ${result.stage} ${result.change}`);
    if (result.note) console.log(`  ${result.note}`);
    if (result.waived) console.log(`  waiver: ${result.waiver_reason}`);
    for (const check of result.checks) {
      console.log(`  check ${check.status}: ${check.name}${check.detail ? ` (${check.detail})` : ''}`);
    }
    for (const error of result.errors) {
      console.log(`  error ${error.code}: ${error.message}${error.file ? ` (${error.file})` : ''}`);
    }
    for (const warning of result.warnings) {
      console.log(`  warning ${warning.code}: ${warning.message}${warning.file ? ` (${warning.file})` : ''}`);
    }
    return;
  }

  if (result.command === 'agents') {
    const status = result.ok ? 'OK' : 'FAIL';
    console.log(`${status} agents ${result.subcommand} ${result.change || ''}`.trim());
    if (result.created) console.log(`  created: ${result.assignments_path}`);
    if (result.assignments_path) console.log(`  assignments: ${result.assignments_path}`);
    for (const agent of result.agents) {
      const task = agent.task || 'none';
      const owned = Array.isArray(agent.owned_paths) && agent.owned_paths.length ? ` owned=${agent.owned_paths.join(',')}` : '';
      console.log(`  ${agent.id} role=${agent.role} task=${task} mode=${agent.mode} status=${agent.status}${owned}`);
    }
    for (const error of result.errors) {
      console.log(`  error ${error.code}: ${error.message}${error.file ? ` (${error.file})` : ''}`);
    }
    for (const warning of result.warnings) {
      console.log(`  warning ${warning.code}: ${warning.message}${warning.file ? ` (${warning.file})` : ''}`);
    }
    if (result.error) console.log(`  error: ${result.error}`);
    return;
  }

  for (const change of result.changes) {
    const marker = change.ok ? 'OK' : 'FAIL';
    console.log(`${marker} ${change.change}`);
    for (const error of change.errors) {
      console.log(`  error ${error.code}: ${error.message}${error.file ? ` (${error.file})` : ''}`);
    }
    for (const warning of change.warnings) {
      console.log(`  warning ${warning.code}: ${warning.message}${warning.file ? ` (${warning.file})` : ''}`);
    }
  }
  console.log(`Summary: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s)`);
}

function printHelp() {
  console.log(`harness-spec

Usage:
  node tools/harness-spec.js status [--root <project>] [--all] [--json]
  node tools/harness-spec.js validate [change-id...] [--root <project>] [--all] [--strict] [--json]
  node tools/harness-spec.js gate <stage> <change-id> [--root <project>] [--strict] [--json] [--waive <reason>]
  node tools/harness-spec.js agents <init|status|verify> <change-id> [--root <project>] [--strict] [--json]

Commands:
  status      List active OpenSpec changes. Use --all to include archived changes.
  validate    Validate change run.json, artifacts, agent-space, checkpoints, and task statuses.
  gate        Evaluate the quality gate for a completed stage. Decisions: pass, warn, block, waived.
  agents      Manage and verify machine-readable Agent collaboration assignments.

Options:
  --root      Project root containing openspec/.
  --all       Include every change under openspec/changes/.
  --strict    Treat unresolved placeholders and missing agent-space items as errors.
  --json      Emit machine-readable JSON.
  --waive     Convert a blocking gate into a waived pass with a required reason.
`);
}

function printError(message) {
  console.error(`error: ${message}`);
}

function throwUsage(message) {
  printError(message);
  printHelp();
  process.exit(2);
}

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/') || '.';
}

try {
  process.exitCode = main();
} catch (e) {
  printError(e.message);
  process.exitCode = 2;
}
