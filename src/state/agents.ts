// What the subagent hooks keep between the call that starts a subagent and its result.
//
//   agent-calls/<tool_use_id>.json  written before the subagent starts: the model noonsight predicted,
//                                   and what it delivered. The result of the same call, which carries
//                                   the same tool_use_id, compares it with the model that ran.
//   agents/<agent id>.json          written when a call's result names the subagent and the model
//                                   it started on, so a call made inside that subagent knows the
//                                   model it would inherit.
//
// Both keys come from Claude Code's hook input, and both kinds of record are pruned with the others.

import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './files.js';

export interface AgentCall {
  readonly session_id: string | null;
  readonly subagent_type: string;
  /** The model the rules were chosen for, or null when noonsight could not tell. */
  readonly predicted: string | null;
  readonly status: 'matched' | 'none' | 'undeclared';
  readonly sha256: string | null;
  readonly delivered: 'rules' | 'already-delivered' | 'nothing';
  /** What routing decided for the call; absent in a record an earlier version wrote. */
  readonly routing?: string;
  /** Why routing decided so; absent in a record an earlier version wrote. */
  readonly routing_reason?: string;
  readonly at: string;
}

export interface AgentModel {
  readonly model: string;
  readonly at: string;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function agentCallFile(stateDir: string, toolUseId: string | null): string | null {
  return toolUseId !== null && SAFE_ID.test(toolUseId) ? path.join(stateDir, 'agent-calls', `${toolUseId}.json`) : null;
}

export function agentFile(stateDir: string, agentId: string | null): string | null {
  return agentId !== null && SAFE_ID.test(agentId) ? path.join(stateDir, 'agents', `${agentId}.json`) : null;
}

export function readAgentCall(file: string | null): AgentCall | null {
  const v = readJson(file);
  if (
    v !== null &&
    (v.session_id === null || typeof v.session_id === 'string') &&
    typeof v.subagent_type === 'string' &&
    (v.predicted === null || typeof v.predicted === 'string') &&
    (v.status === 'matched' || v.status === 'none' || v.status === 'undeclared') &&
    (v.sha256 === null || typeof v.sha256 === 'string') &&
    (v.delivered === 'rules' || v.delivered === 'already-delivered' || v.delivered === 'nothing') &&
    (v.routing === undefined || typeof v.routing === 'string') &&
    (v.routing_reason === undefined || typeof v.routing_reason === 'string')
  )
    return v as unknown as AgentCall;
  return null;
}

export function readAgentModel(file: string | null): string | null {
  const v = readJson(file);
  return v !== null && typeof v.model === 'string' && v.model !== '' ? v.model : null;
}

export function writeRecord(file: string | null, record: AgentCall | AgentModel): void {
  if (file === null) return;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileAtomic(file, `${JSON.stringify(record)}\n`, 0o600);
}

export function removeRecord(file: string | null): void {
  if (file === null) return;
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // Pruned later.
  }
}

function readJson(file: string | null): Record<string, unknown> | null {
  if (file === null) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
