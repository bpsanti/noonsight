// A preset update: the version a configuration accepted ("preset_version") against the one the
// package ships, what check, accept and the session-start warning report, "hold", and the copies of
// earlier versions the package keeps.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfigDetails, readPreset, readPresetVersion } from '../src/config/load.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { comparePresets } from '../src/config/preset-changes.js';
import { setTopLevelString } from '../src/config/rewrite.js';
import { resolve } from '../src/core/resolve.js';
import { compareVersions } from '../src/version.js';
import { fakeClaude, hookHome, hookInput, LAB_PRESETS, runCli, tempTree } from './helpers.js';

const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-5-5';

/**
 * A presets directory whose lab preset is at 0.2.0 and keeps the lab preset as it is as 0.1.0. For
 * Sonnet, 0.2.0 renames carry-through to follow-through, removes investigate, adds new-on (on) and
 * new-off (off), turns progress-updates on, and changes the text of general. Haiku does not change.
 */
function updatedPresets(edit: (p: Record<string, any>) => void = () => {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-presets-'));
  const lab = path.join(dir, 'lab');
  fs.cpSync(path.join(LAB_PRESETS, 'lab'), lab, { recursive: true });
  const old = path.join(lab, 'versions', '0.1.0');
  fs.cpSync(path.join(LAB_PRESETS, 'lab'), old, { recursive: true });
  const write = (file: string, p: Record<string, any>): void => fs.writeFileSync(file, JSON.stringify(p, null, 2));
  const read = (file: string): Record<string, any> => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
  write(path.join(old, 'preset.json'), { ...read(path.join(old, 'preset.json')), version: '0.1.0' });

  const p = read(path.join(lab, 'preset.json'));
  p.version = '0.2.0';
  const rules = p.models[SONNET].rules as Record<string, any>[];
  const byId = (id: string): Record<string, any> => rules.find((r) => r.id === id) as Record<string, any>;
  Object.assign(byId('sonnet/carry-through'), { id: 'sonnet/follow-through', renamed_from: ['sonnet/carry-through'] });
  delete byId('sonnet/progress-updates').enabled;
  const template = byId('sonnet/general');
  p.models[SONNET].rules = [
    ...rules.filter((r) => r.id !== 'sonnet/investigate'),
    { ...template, id: 'sonnet/new-on', file: 'rules/sonnet-new-on.md' },
    { ...template, id: 'sonnet/new-off', file: 'rules/sonnet-new-off.md', enabled: false },
  ];
  edit(p);
  write(path.join(lab, 'preset.json'), p);
  fs.writeFileSync(path.join(lab, 'rules', 'sonnet-new-on.md'), '- The verification word for the new Sonnet rule is SONNET-NEW-5150.\n');
  fs.writeFileSync(path.join(lab, 'rules', 'sonnet-new-off.md'), '- The verification word for the new Sonnet rule that ships off is SONNET-OFF-8812.\n');
  fs.appendFileSync(path.join(lab, 'rules', 'sonnet-general.md'), '- This line was added in 0.2.0: SONNET-GEN-0200.\n');
  return dir;
}

/** A configuration file in its own directory, written as the text given or as a JSON value. */
function configFile(content: string | Record<string, unknown>): string {
  return path.join(tempTree({ 'noonsight.json': content }), 'noonsight.json');
}

function labConfig(extra: Record<string, unknown> = {}, sonnet: Record<string, unknown> = { disable: ['sonnet/carry-through'] }): Record<string, unknown> {
  return {
    version: 1,
    preset: 'lab',
    preset_version: '0.1.0',
    ...extra,
    models: { [SONNET]: { use: 'preset', ...sonnet }, [HAIKU]: { use: 'preset' } },
  };
}

function problemsOf(file: string, presetsDir: string): readonly string[] {
  try {
    loadConfigDetails(file, { presetsDir });
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
  assert.fail('the configuration was accepted');
}

function cliEnv(file: string, presetsDir: string): Record<string, string> {
  return { NOONSIGHT_CONFIG: file, NOONSIGHT_PRESETS_DIR: presetsDir, NOONSIGHT_SYSTEM_ROOT: tempTree({}), PATH: fakeClaude('2.1.325') };
}

const start = (model: string, source = 'startup'): string => hookInput('session-start-startup', { model, source });

test('the comparison lists, per model, the rules turned on or off, renamed and changed, and the entries that no longer match', () => {
  const presets = updatedPresets();
  const details = loadConfigDetails(configFile(labConfig()), { presetsDir: presets });
  assert.equal(details.preset?.version, '0.2.0', 'under "warn" the rules come from the installed version');
  const c = comparePresets(details.presetVersions, details.declared, { presetsDir: presets });
  assert.equal(c?.from?.version, '0.1.0');
  assert.equal(c?.held, false);
  assert.deepEqual(c?.models, [
    {
      model: SONNET,
      dropped: false,
      nowOn: [
        { id: 'sonnet/progress-updates', why: 'ships-on' },
        { id: 'sonnet/new-on', why: 'new' },
      ],
      nowOff: [{ id: 'sonnet/investigate', why: 'removed' }],
      renamed: [{ from: 'sonnet/carry-through', to: 'sonnet/follow-through' }],
      changed: [{ id: 'sonnet/general', what: ['text'] }],
      inherited: [],
      newOff: ['sonnet/new-off'],
      staleEntries: [{ list: 'disable', id: 'sonnet/carry-through', now: 'sonnet/follow-through' }],
    },
  ]);
});

test('an entry that names a rule by its id before a rename still applies to the rule', () => {
  const presets = updatedPresets();
  const { config } = loadConfigDetails(configFile(labConfig()), { presetsDir: presets });
  const d = resolve(config, { model: SONNET, scope: null, place: 'unattended' });
  assert.equal(d.status, 'matched');
  assert.ok(d.status === 'matched' && !d.rules.includes('sonnet/follow-through'), 'the renamed rule stays disabled');
  // Both names of one rule in enable and disable are one rule both enabled and disabled.
  const both = configFile(labConfig({}, { enable: ['sonnet/follow-through'], disable: ['sonnet/carry-through'] }));
  assert.ok(problemsOf(both, presets).some((p) => p.includes('rule "sonnet/follow-through" is both enabled and disabled (as "sonnet/follow-through" and "sonnet/carry-through")')));
});

test('an entry already written with the name a rename gives applies to the rule in both versions', () => {
  const sonnetOf = (presets: string, sonnet: Record<string, unknown>) => {
    const details = loadConfigDetails(configFile(labConfig({}, sonnet)), { presetsDir: presets });
    return comparePresets(details.presetVersions, details.declared, { presetsDir: presets })?.models.find((m) => m.model === SONNET);
  };
  const off = sonnetOf(updatedPresets(), { disable: ['sonnet/follow-through'] });
  assert.deepEqual(off?.nowOff, [{ id: 'sonnet/investigate', why: 'removed' }], 'follow-through was off before and after');
  assert.deepEqual(off?.staleEntries, []);
  const renameOff = (p: Record<string, any>): void => {
    const rule = (p.models[SONNET].rules as Record<string, any>[]).find((r) => r.id === 'sonnet/progress-updates') as Record<string, any>;
    Object.assign(rule, { id: 'sonnet/updates', renamed_from: ['sonnet/progress-updates'], enabled: false });
  };
  const on = sonnetOf(updatedPresets(renameOff), { enable: ['sonnet/updates'] });
  assert.deepEqual(on?.nowOn, [{ id: 'sonnet/new-on', why: 'new' }], 'updates was on before and after');
});

test('under "warn", an entry for a rule the update removed is reported, not refused; without a kept version it is refused as before', () => {
  const presets = updatedPresets();
  const stale = labConfig({}, { disable: ['sonnet/investigate'] });
  const details = loadConfigDetails(configFile(stale), { presetsDir: presets });
  const c = comparePresets(details.presetVersions, details.declared, { presetsDir: presets });
  assert.deepEqual(c?.models[0]?.staleEntries, [{ list: 'disable', id: 'sonnet/investigate', now: null }]);
  // nowOff lists only rules that were on: investigate was disabled.
  assert.deepEqual(c?.models[0]?.nowOff, []);
  const { preset_version: _, ...unrecorded } = stale;
  assert.ok(problemsOf(configFile(unrecorded), presets).some((p) => p.includes('preset "lab" has no rule "sonnet/investigate" for claude-sonnet-5-5')));
  // A typing error is refused with a kept version too.
  assert.ok(problemsOf(configFile(labConfig({}, { enable: ['sonnet/nope'] })), presets).some((p) => p.includes('has no rule "sonnet/nope"')));
});

test('check reports the installed version against the accepted one, model by model, and accept takes it', () => {
  const presets = updatedPresets();
  const text = `{\n    "version": 1,\n    "preset": "lab",\n    "preset_version": "0.1.0",\n    "models": {\n        "${SONNET}": { "use": "preset", "disable": ["sonnet/carry-through"] },\n        "${HAIKU}": { "use": "preset" }\n    }\n}\n`;
  const file = configFile(text);
  const env = cliEnv(file, presets);
  const check = runCli(['check'], env);
  assert.match(
    check.stdout,
    /^warning: preset lab: the package ships 0\.2\.0, and the configuration accepted 0\.1\.0, so sessions receive the rules of 0\.2\.0, which changed as listed below; run `noonsight accept` to accept 0\.2\.0 once reviewed$/m,
  );
  assert.match(
    check.stdout,
    new RegExp(
      `^warning: preset lab, ${SONNET}: now on: sonnet/progress-updates \\(ships on now\\), sonnet/new-on \\(new\\); now off: sonnet/investigate \\(removed\\); ` +
        'renamed: sonnet/carry-through to sonnet/follow-through; changed: sonnet/general \\(text\\); new and off unless enabled: sonnet/new-off; ' +
        '"disable" names "sonnet/carry-through", which is now "sonnet/follow-through"; it still applies to it, and "sonnet/follow-through" is the name to write$',
      'm',
    ),
  );
  assert.doesNotMatch(check.stdout, new RegExp(`preset lab, ${HAIKU}`));

  const accept = runCli(['accept'], env);
  assert.equal(accept.status, 0, accept.stderr);
  assert.match(accept.stdout, /^preset lab 0\.2\.0, accepted until now: 0\.1\.0$/m);
  assert.match(accept.stdout, new RegExp(`^  ${SONNET}: now on: sonnet/progress-updates`, 'm'));
  assert.match(accept.stdout, /wrote "preset_version": "0\.2\.0" to /);
  assert.equal(fs.readFileSync(file, 'utf8'), text.replace('"0.1.0"', '"0.2.0"'), 'only the version changed');

  const after = runCli(['check'], env);
  assert.match(after.stdout, /^ok: preset lab 0\.2\.0: the version the configuration accepted$/m);
  // The entry written with the old name is still named, as an entry to rewrite.
  assert.match(after.stdout, new RegExp(`^warning: preset lab, ${SONNET}: "disable" names "sonnet/carry-through", which is now "sonnet/follow-through"`, 'm'));
  const again = runCli(['accept'], env);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /preset lab 0\.2\.0 is already the accepted version; nothing to change/);
});

test('the session-start warning names what changed for the session\'s model, at startup only', () => {
  const presets = updatedPresets();
  const file = configFile(labConfig());
  const h = hookHome(file, { NOONSIGHT_PRESETS_DIR: presets });
  const r = h.hook('session-start', start(SONNET));
  assert.match(r.out?.hookSpecificOutput.additionalContext, /SONNET-NEW-5150/);
  assert.match(r.out?.hookSpecificOutput.additionalContext, /SONNET-GEN-0200/);
  assert.match(
    r.out?.systemMessage,
    new RegExp(`^noonsight: preset lab 0\\.2\\.0 changed the rules of ${SONNET} since 0\\.1\\.0, the version accepted in ${file.replaceAll('.', '\\.')}: now on: sonnet/progress-updates`),
  );
  assert.match(r.out?.systemMessage, /Run `noonsight check` for every model, and `noonsight accept` to accept 0\.2\.0\.$/);
  const [line] = h.log();
  assert.deepEqual(line?.preset_update, { accepted: '0.1.0', installed: '0.2.0', held: false });
  assert.equal(line?.warned, true);

  assert.equal(h.hook('session-start', start(SONNET, 'compact')).out?.systemMessage, undefined, 'only a new session is warned');
  const haiku = h.hook('session-start', start(HAIKU));
  assert.equal(haiku.out?.systemMessage, undefined, 'a model the update leaves as it was is not warned');
  assert.equal(h.log().at(-1)?.preset_update, undefined);

  // Once accepted, no warning.
  assert.equal(runCli(['accept'], cliEnv(file, presets)).status, 0);
  assert.equal(h.hook('session-start', start(SONNET)).out?.systemMessage, undefined);
});

test('"hold" keeps delivering the accepted version from the copy the package keeps, until accept takes the installed one', () => {
  const presets = updatedPresets();
  const file = configFile(labConfig({ on_preset_change: 'hold' }));
  const details = loadConfigDetails(file, { presetsDir: presets });
  assert.equal(details.preset?.version, '0.1.0');
  assert.equal(details.presetVersions.installed?.version, '0.2.0');

  const h = hookHome(file, { NOONSIGHT_PRESETS_DIR: presets });
  const r = h.hook('session-start', start(SONNET));
  const text: string = r.out?.hookSpecificOutput.additionalContext;
  assert.match(text, /SONNET-GEN-3306/);
  assert.doesNotMatch(text, /SONNET-GEN-0200|SONNET-NEW-5150/, 'nothing of 0.2.0 is delivered');
  assert.match(r.out?.systemMessage, new RegExp(`^noonsight: preset lab 0\\.2\\.0 is installed, and this session keeps the rules of 0\\.1\\.0, held in .*; 0\\.2\\.0 would change those of ${SONNET}: now on:`));
  assert.deepEqual(h.log()[0]?.preset_update, { accepted: '0.1.0', installed: '0.2.0', held: true });

  const env = cliEnv(file, presets);
  const check = runCli(['check'], env);
  assert.match(check.stdout, /^warning: preset lab: held at 0\.1\.0 \("on_preset_change": "hold"\) while the package ships 0\.2\.0, so sessions keep the rules of 0\.1\.0; accepting 0\.2\.0 would change them as listed below; run `noonsight accept` to accept 0\.2\.0$/m);
  assert.match(check.stdout, /"disable" names "sonnet\/carry-through", which the installed preset renames "sonnet\/follow-through"; it will still apply to it, and after accepting, "sonnet\/follow-through" is the name to write/);
  const models = runCli(['models'], env);
  assert.match(models.stdout, /^preset lab 0\.1\.0 \(held; the package ships 0\.2\.0\)/m);

  const accept = runCli(['accept'], env);
  assert.equal(accept.status, 0, accept.stderr);
  assert.match(accept.stdout, /sessions now receive the rules of 0\.2\.0$/m);
  const next = h.hook('session-start', hookInput('session-start-startup', { model: SONNET, session_id: 'b2e1c9d0-0000-4000-8000-000000000001' }));
  assert.match(next.out?.hookSpecificOutput.additionalContext, /SONNET-NEW-5150/);
  assert.equal(next.out?.systemMessage, undefined);
});

test('"hold" needs a recorded version that the package keeps', () => {
  const presets = updatedPresets();
  const { preset_version: _, ...unrecorded } = labConfig({ on_preset_change: 'hold' });
  assert.ok(problemsOf(configFile(unrecorded), presets).some((p) => p.startsWith('/on_preset_change: "hold" keeps the rules of the preset version in "preset_version"')));
  const gone = configFile(labConfig({ on_preset_change: 'hold', preset_version: '0.0.9' }));
  assert.ok(
    problemsOf(gone, presets).some((p) =>
      p.startsWith('/preset_version: preset "lab" 0.0.9 is held ("on_preset_change": "hold"), but the installed package ships 0.2.0 and keeps no copy of 0.0.9'),
    ),
  );
  // accept still repairs it, since it does not need the configuration to load as it is.
  assert.equal(runCli(['accept'], cliEnv(gone, presets)).status, 0);
  assert.equal(loadConfigDetails(gone, { presetsDir: presets }).preset?.version, '0.2.0');
  // Under "warn", a version the package does not keep only means the changes cannot be listed.
  const warn = configFile(labConfig({ preset_version: '0.0.9' }));
  const check = runCli(['check'], cliEnv(warn, presets));
  assert.match(check.stdout, /^warning: preset lab: the configuration accepted 0\.0\.9, but the package ships 0\.2\.0 and keeps no copy of 0\.0\.9, so what changed cannot be listed/m);
});

test('accept writes nothing when the configuration would be refused with the installed version', () => {
  const presets = updatedPresets();
  for (const extra of [{}, { on_preset_change: 'hold' }]) {
    const content = JSON.stringify(labConfig(extra, { disable: ['sonnet/investigate'] }), null, 2);
    const file = configFile(content);
    const r = runCli(['accept'], cliEnv(file, presets));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /with preset lab 0\.2\.0, configuration refused/);
    assert.match(r.stderr, /preset "lab" has no rule "sonnet\/investigate"/);
    assert.match(r.stderr, /Nothing was written/);
    assert.equal(fs.readFileSync(file, 'utf8'), content);
  }
});

/** A configuration whose Sonnet entry adds the rule user/mine, in its own directory with the rule's file. */
function replacingConfig(mine: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  const config = labConfig(extra, { add: [{ id: 'user/mine', file: 'mine.md', ...mine }] });
  return path.join(tempTree({ 'noonsight.json': config, 'mine.md': '- My own version: MINE-6021.\n' }), 'noonsight.json');
}

test('a "replaces" follows a renamed rule, and the change warning names the id to write', () => {
  const presets = updatedPresets();
  const file = replacingConfig({ replaces: 'sonnet/carry-through' });
  const details = loadConfigDetails(file, { presetsDir: presets });
  const rules = details.config.exact.get(SONNET);
  const mine = rules?.use === 'rules' ? rules.rules.find((r) => r.id === 'user/mine') : undefined;
  assert.equal(mine?.replaces, 'sonnet/follow-through', 'the rule replaces the renamed rule, in its place');
  assert.deepEqual(mine?.where, ['unattended', 'subagent']);
  assert.ok(rules?.use === 'rules' && !rules.rules.some((r) => r.id === 'sonnet/follow-through'));

  const c = comparePresets(details.presetVersions, details.declared, { presetsDir: presets });
  const sonnet = c?.models[0];
  assert.deepEqual(sonnet?.staleEntries, [{ list: 'replaces', rule: 'user/mine', id: 'sonnet/carry-through', now: 'sonnet/follow-through' }]);
  assert.deepEqual(sonnet?.renamed, [{ from: 'sonnet/carry-through', to: 'sonnet/follow-through' }]);
  assert.ok(![...(sonnet?.nowOn ?? []), ...(sonnet?.nowOff ?? [])].some((r) => r.id === 'sonnet/follow-through' || r.id === 'sonnet/carry-through'), 'the replaced rule stays off');

  const env = cliEnv(file, presets);
  assert.match(
    runCli(['check'], env).stdout,
    /; rule "user\/mine" replaces "sonnet\/carry-through", which is now "sonnet\/follow-through"; it still replaces it, and "sonnet\/follow-through" is the name to write$/m,
  );
  const held = runCli(['check'], cliEnv(replacingConfig({ replaces: 'sonnet/carry-through' }, { on_preset_change: 'hold' }), presets));
  assert.match(
    held.stdout,
    /rule "user\/mine" replaces "sonnet\/carry-through", which the installed preset renames "sonnet\/follow-through"; it will still replace it, and after accepting, "sonnet\/follow-through" is the name to write/,
  );
  assert.match(runCli(['models'], env).stdout, /^ {2}on {3}user\/mine {2}\(scopes: every scope; places: unattended, subagent; replaces sonnet\/follow-through\)$/m);
});

test('under "warn", a "replaces" for a rule the update removed is reported, and the rule keeps what it took from it', () => {
  const presets = updatedPresets();
  const file = replacingConfig({ replaces: 'sonnet/investigate' });
  const details = loadConfigDetails(file, { presetsDir: presets });
  const rules = details.config.exact.get(SONNET);
  assert.ok(rules?.use === 'rules');
  if (rules?.use !== 'rules') return;
  const mine = rules.rules.at(-1);
  assert.deepEqual([mine?.id, mine?.scopes, mine?.replaces], ['user/mine', ['investigate'], undefined], 'last, with the scopes of the removed rule, replacing nothing');

  const c = comparePresets(details.presetVersions, details.declared, { presetsDir: presets });
  assert.deepEqual(c?.models[0]?.staleEntries, [{ list: 'replaces', rule: 'user/mine', id: 'sonnet/investigate', now: null }]);
  assert.deepEqual(c?.models[0]?.nowOff, [], 'investigate was replaced, so its removal turns nothing off');
  const env = cliEnv(file, presets);
  assert.match(
    runCli(['check'], env).stdout,
    /rule "user\/mine" replaces "sonnet\/investigate", which the preset no longer has; "user\/mine" is still delivered, after the rules of "all_models", with what it took from "sonnet\/investigate"; remove "replaces", and write in "user\/mine" any scopes, places or triggers it took from "sonnet\/investigate" and should keep/,
  );
  const accept = runCli(['accept'], env);
  assert.equal(accept.status, 2);
  assert.match(accept.stderr, /\/add\/0\/replaces: preset "lab" has no rule "sonnet\/investigate"/);
});

test('a change to the scopes, places or triggers of a replaced rule reaches the rule that takes them, and is reported', () => {
  const presets = updatedPresets((p) => {
    const follow = (p.models[SONNET].rules as Record<string, any>[]).find((r) => r.id === 'sonnet/follow-through');
    if (follow) follow.where = ['session', 'unattended', 'subagent'];
  });
  const file = replacingConfig({ replaces: 'sonnet/carry-through' });
  const details = loadConfigDetails(file, { presetsDir: presets });
  const c = comparePresets(details.presetVersions, details.declared, { presetsDir: presets });
  assert.deepEqual(c?.models[0]?.inherited, [{ id: 'sonnet/follow-through', by: 'user/mine', what: ['places'] }]);
  assert.ok(!c?.models[0]?.changed.some((r) => r.id === 'sonnet/follow-through'), 'the preset rule itself is not delivered');
  const session = resolve(details.config, { model: SONNET, scope: null, place: 'session' });
  assert.ok(session.status === 'matched' && session.rules.includes('user/mine'));

  const h = hookHome(file, { NOONSIGHT_PRESETS_DIR: presets });
  assert.match(h.hook('session-start', start(SONNET)).out?.systemMessage, /changed in a replaced rule: sonnet\/follow-through \(places\), which user\/mine takes/);

  // A rule that gives its own places takes nothing from the replaced rule's.
  const own = loadConfigDetails(replacingConfig({ replaces: 'sonnet/carry-through', where: ['subagent'] }), { presetsDir: presets });
  assert.deepEqual(comparePresets(own.presetVersions, own.declared, { presetsDir: presets })?.models[0]?.inherited, []);
});

test('accept records a version a configuration did not record, after "preset", and writes through a symbolic link', () => {
  const presets = updatedPresets();
  const dir = tempTree({ 'real/noonsight.json': `{\n  "version": 1,\n  "preset": "lab",\n  "models": { "${HAIKU}": { "use": "preset" } }\n}\n` });
  const link = path.join(dir, 'noonsight.json');
  fs.symlinkSync(path.join(dir, 'real', 'noonsight.json'), link);
  const env = cliEnv(link, presets);
  assert.match(runCli(['check'], env).stdout, /^warning: preset lab 0\.2\.0: the configuration records no "preset_version"/m);
  const r = runCli(['accept'], env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /accepted until now: not recorded/);
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.equal(
    fs.readFileSync(link, 'utf8'),
    `{\n  "version": 1,\n  "preset": "lab",\n  "preset_version": "0.2.0",\n  "models": { "${HAIKU}": { "use": "preset" } }\n}\n`,
  );
});

test('setTopLevelString changes one value and nothing else', () => {
  const after = ['preset', 'version'];
  assert.equal(setTopLevelString('{"version":1,"preset":"lab"}', 'preset_version', '1.2.3', after), '{"version":1,"preset":"lab", "preset_version": "1.2.3"}');
  assert.equal(setTopLevelString('{\r\n\t"version": 1,\r\n\t"models": {}\r\n}', 'preset_version', '1.2.3', after), '{\r\n\t"version": 1,\r\n\t"preset_version": "1.2.3",\r\n\t"models": {}\r\n}');
  assert.equal(
    setTopLevelString('{ "preset_version" : "0.1.0", "x": { "preset_version": "keep" } }', 'preset_version', '1.2.3', after),
    '{ "preset_version" : "1.2.3", "x": { "preset_version": "keep" } }',
  );
  // Strings with braces, quotes and escapes before the key are skipped as strings.
  assert.equal(
    setTopLevelString('{"s": "a \\" } {", "version": 1}', 'preset_version', '1.2.3', after),
    '{"s": "a \\" } {", "version": 1, "preset_version": "1.2.3"}',
  );
  // Duplicate keys all get the value, so no reader sees another.
  assert.equal(setTopLevelString('{"preset_version": "a", "preset_version": "b"}', 'preset_version', 'c', after), '{"preset_version": "c", "preset_version": "c"}');
  assert.equal(setTopLevelString('{"models": {}}', 'preset_version', '1.2.3', after), '{"preset_version": "1.2.3", "models": {}}');
  assert.throws(() => setTopLevelString('[1]', 'preset_version', '1.2.3', after), /not a JSON object/);
});

test('a preset checks its renames and the version of every copy it keeps', () => {
  const clash = updatedPresets((p) => {
    p.models[SONNET].rules[0].renamed_from = ['sonnet/new-on'];
  });
  assert.ok(problemsOf(configFile(labConfig()), clash).some((p) => p.includes('"sonnet/new-on" is the id of a rule of claude-sonnet-5-5 in this version')));
  const twice = updatedPresets((p) => {
    p.models[SONNET].rules[0].renamed_from = ['sonnet/carry-through'];
  });
  assert.ok(problemsOf(configFile(labConfig()), twice).some((p) => /"sonnet\/carry-through" is already an earlier id of rule "sonnet\/(general|follow-through)"/.test(p)));

  const presets = updatedPresets();
  const copy = path.join(presets, 'lab', 'versions', '0.1.0', 'preset.json');
  fs.writeFileSync(copy, fs.readFileSync(copy, 'utf8').replace('"0.1.0"', '"0.1.1"'));
  assert.throws(() => readPresetVersion('lab', '0.1.0', { presetsDir: presets }), (e: unknown) => e instanceof ConfigError && e.problems.some((p) => p.includes('/version: is "0.1.1", but the copy is kept as version 0.1.0')));
  assert.equal(readPresetVersion('lab', '0.0.5', { presetsDir: presets }), null);
});

test('the shipped preset keeps a checked copy of every earlier version from 1.3.0 on', () => {
  const presetsDir = path.join(PACKAGE_ROOT, 'presets');
  const current = readPreset('claude', { presetsDir });
  const versionsDir = path.join(presetsDir, 'claude', 'versions');
  const kept = fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir).sort((a, b) => compareVersions(a, b) ?? 0) : [];
  if (current.version !== '1.3.0') assert.ok(kept.includes('1.3.0'), 'the preset is past 1.3.0, so the package keeps 1.3.0');
  for (const version of kept) {
    assert.ok((compareVersions(version, current.version) ?? 0) < 0, `${version} is earlier than the installed ${current.version}`);
    assert.equal(readPresetVersion('claude', version, { presetsDir })?.version, version);
  }
});
