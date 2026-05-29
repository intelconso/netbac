// HACCP cooling cycle validation.
//
// Rules (from réglementation française / paquet hygiène):
// - Cooling must bring core temperature from +63 °C down to +10 °C
//   in 2 hours or less.
// - After cooling, the product is stored at 0..+3 °C, conserved up to
//   3 days max (in absence of microbiological analysis).
//
// validateCoolingCycle returns the list of human-readable French errors
// (empty array == OK). The UI surfaces them verbatim.

import {
  validateCoolingCycle,
  computeCoolingDlc,
  COOLING_MAX_DURATION_MS,
  COOLING_MAX_END_TEMP,
} from '../src/lib/cooling';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('validateCoolingCycle', () => {
  const baseStart = 1_700_000_000_000;

  it('passes when duration <= 2h and end temp <= 10°C', () => {
    expect(
      validateCoolingCycle({
        startedAt: baseStart,
        finishedAt: baseStart + 90 * MIN,
        tempStart: 63,
        tempEnd: 8,
      }),
    ).toEqual([]);
  });

  it('passes exactly at the 2h boundary', () => {
    expect(
      validateCoolingCycle({
        startedAt: baseStart,
        finishedAt: baseStart + 2 * HOUR,
        tempStart: 63,
        tempEnd: 10,
      }),
    ).toEqual([]);
  });

  it('blocks when duration is greater than 2h', () => {
    const errors = validateCoolingCycle({
      startedAt: baseStart,
      finishedAt: baseStart + 2 * HOUR + 1 * MIN,
      tempStart: 63,
      tempEnd: 8,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/2\s*h/i);
    expect(errors[0]).toMatch(/dur[ée]e/i);
  });

  it('blocks when end temperature is greater than 10°C', () => {
    const errors = validateCoolingCycle({
      startedAt: baseStart,
      finishedAt: baseStart + 1 * HOUR,
      tempStart: 63,
      tempEnd: 12,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/10\s*°?C/i);
  });

  it('reports both errors when duration and end temp both fail', () => {
    const errors = validateCoolingCycle({
      startedAt: baseStart,
      finishedAt: baseStart + 3 * HOUR,
      tempStart: 63,
      tempEnd: 15,
    });
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => /dur[ée]e/i.test(e))).toBe(true);
    expect(errors.some((e) => /10\s*°?C/i.test(e))).toBe(true);
  });

  it('blocks when finishedAt is before startedAt (negative duration)', () => {
    const errors = validateCoolingCycle({
      startedAt: baseStart,
      finishedAt: baseStart - 1 * MIN,
      tempStart: 63,
      tempEnd: 8,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('blocks when any required field is missing', () => {
    const errors = validateCoolingCycle({
      startedAt: baseStart,
      finishedAt: undefined as any,
      tempStart: 63,
      tempEnd: 8,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('exposes the documented thresholds as constants', () => {
    expect(COOLING_MAX_DURATION_MS).toBe(2 * HOUR);
    expect(COOLING_MAX_END_TEMP).toBe(10);
  });
});

describe('computeCoolingDlc', () => {
  it('returns finishedAt + 3 days', () => {
    const finishedAt = 1_700_000_000_000;
    expect(computeCoolingDlc(finishedAt)).toBe(finishedAt + 3 * DAY);
  });
});
