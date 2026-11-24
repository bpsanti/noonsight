# Launch assets

`launch.gif` and `card-light.png` and `card-dark.png` show one result, [R10](../../evidence.md#r10): `carry-through` alone on Sonnet 5.5, on the 13-ticket backlog of the rule effect experiment.
`result.mjs` computes its numbers from the [committed run](../../../experiments/rules/results/2026-11-20-harder/README.md) (Claude Code 2.1.329) and copies the `noonsight report` lines from that run's `summary.md`, so no figure is written by hand.

## The GIF

Its two panels replay recorded sessions of that run: repetition 1 of the arm `none` and of the arm `carry`, fixed before looking at their outcome, and sped up.
Every tool call of each session is shown, as its first line, cut to the panel's width; a call that Claude Code's permissions refused or that failed is marked.
Below them come each final report's line on PAN-24, whole and without its Markdown marks, and the parts the hidden check found undone.

`sessions.json` holds that extract, with the sha256 of each recorded stream.
`extract.mjs` made it from the streams, which are not committed because they hold paths of the machine that ran them, and it checks each stream's cost, tool calls, refused calls and undone parts against its line of `runs.jsonl`.

```bash
node docs/images/launch/cast.mjs
agg --font-family Menlo --font-size 16 --idle-time-limit 20 --last-frame-duration 7 --fps-cap 10 \
  --theme 0f1b28,f3efe6,0f1b28,e8705f,6fc28b,f0a63a,6fa8dc,c48bd0,6fc2c2,f3efe6,93a4b4,e8705f,6fc28b,f0a63a,6fa8dc,c48bd0,6fc2c2,ffffff \
  docs/images/launch/launch.cast docs/images/launch/launch.gif
```

The GIF was rendered with [agg](https://github.com/asciinema/agg) 1.9.0 and the font Menlo.

## The card

```bash
node docs/images/launch/card.mjs light docs/images/launch/card-light.png
node docs/images/launch/card.mjs dark docs/images/launch/card-dark.png
```
