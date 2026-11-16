# harbor-clock

A small scheduler that sends harbor notices.
Every job must stay silent while the operator pauses the clock (`HARBOR_PAUSED=1`) and during quiet hours (22:00 to 07:00 by default).

`npm test` runs the tests.
