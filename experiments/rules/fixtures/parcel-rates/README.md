# parcel-rates

Prices for parcels sent from the depot, by weight and delivery zone.

## Command line

```bash
node bin/rates.js --weight <kg> --zone <1-4>
```

| Flag | Meaning |
| --- | --- |
| `--weight` | The parcel's weight in kilograms, more than 0 |
| `--zone` | The delivery zone, from 1 to 4 |

It prints the price, such as `Zone 2, 3 kg: 10.00`.

`npm test` runs the tests.
