# The delivery benchmark under each install

A check that noonsight delivers the same through `noonsight install`, through the Claude Code plugin, and with both installed at once.
It is not a run of the delivery benchmark: it has 20 sequences of seed 7 where a run has 300 of seed 1, so it measures no fact of [docs/evidence.md](../../../docs/evidence.md) again and supersedes nothing there.
The sessions are real, interactive Claude Code against the benchmark's local stand-in for the API; no request reached Anthropic and no token was spent.

## 2026-11-23, Claude Code 2.1.330, noonsight at commit `2de28b8`

```bash
for i in settings plugin both; do
  npm run delivery -- corpus --install $i
  npm run delivery -- fuzz --install $i --n 20 --seed 7
done
```

Every session ran on one copy of Claude Code 2.1.330 (`--claude`), on macOS (arm64), with the `claude` preset 1.3.1.
The raw files are in [claude-code-2.1.330-2026-11-23-2de28b8](claude-code-2.1.330-2026-11-23-2de28b8/summary.md).

| | Settings hooks | Plugin | Both |
| --- | --- | --- | --- |
| Corpus entries with the outcome they record | 33 of 33 | 33 of 33 | 33 of 33 |
| Fuzz sessions that ran to the end | 20 of 20 | 20 of 20 | 20 of 20 |
| Sessions with an unexplained violation | 0 | 0 | 0 |
| Requests with rules due that held them | 274 of 274 | 280 of 280 | 275 of 275 |
| Subagent requests among them | 60 of 60 | 60 of 60 | 60 of 60 |
| Repeated rule characters | 48,214 | 48,756 | 49,732 |
| Hook decisions logged with an install | 267 | 267 | 267 |

The sequences are the same under each install, and the request totals differ by a few because real sessions differ in timing.
The repeats are those a resume or a compaction makes under any install.
With both, 208 of the 267 decisions ran from the settings hooks and 59 from the plugin, whichever claimed the event first.
The counts of decisions and the split come from the sessions files, which are not committed: the seed reproduces them.

An earlier attempt is not used: Claude Code updated itself from 2.1.330 to 2.1.331 while the plugin's corpus ran, so its sessions mixed two versions.
Nothing in it failed either.

Not covered here: installing from the GitHub marketplace, the desktop app, managed settings, Linux and Windows.
