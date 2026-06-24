import { getDaysRemaining, getStatusColor, formatDate, formatRelativeTime } from '../src/lib/utils';

describe('getDaysRemaining', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 0 for a DLC at the same instant', () => {
    expect(getDaysRemaining(Date.now())).toBe(0);
  });

  it('returns positive days when DLC is in the future', () => {
    const threeDays = Date.now() + 3 * 24 * 60 * 60 * 1000;
    expect(getDaysRemaining(threeDays)).toBe(3);
  });

  it('returns negative days when DLC has passed', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    expect(getDaysRemaining(twoDaysAgo)).toBe(-2);
  });

  it('rounds up partial days (1.5 days remaining → 2)', () => {
    const oneAndHalfDays = Date.now() + 1.5 * 24 * 60 * 60 * 1000;
    expect(getDaysRemaining(oneAndHalfDays)).toBe(2);
  });
});

describe('getStatusColor', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-01T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns red once the limit day has passed', () => {
    expect(getStatusColor(Date.now() - 24 * 60 * 60 * 1000 - 1000)).toBe('#EF4444');
  });

  it('returns amber on the limit day itself (still valid)', () => {
    expect(getStatusColor(Date.now())).toBe('#F59E0B');
  });

  it('returns amber when 2 days or fewer remain', () => {
    const twoDays = Date.now() + 2 * 24 * 60 * 60 * 1000 - 1000;
    expect(getStatusColor(twoDays)).toBe('#F59E0B');
  });

  it('returns green when more than 2 days remain', () => {
    const fiveDays = Date.now() + 5 * 24 * 60 * 60 * 1000;
    expect(getStatusColor(fiveDays)).toBe('#10B981');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-05-01T12:00:00Z').getTime();

  it('returns "à l\'instant" for under a minute', () => {
    expect(formatRelativeTime(now - 30 * 1000, now)).toBe("à l'instant");
  });

  it('returns minutes for under an hour', () => {
    expect(formatRelativeTime(now - 5 * 60 * 1000, now)).toBe('il y a 5 min');
  });

  it('returns hours for under a day', () => {
    expect(formatRelativeTime(now - 3 * 60 * 60 * 1000, now)).toBe('il y a 3 h');
  });

  it('returns days for under a week', () => {
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60 * 1000, now)).toBe('il y a 2 j');
  });

  it('falls back to formatDate beyond 7 days', () => {
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(tenDaysAgo, now)).toBe(formatDate(tenDaysAgo));
  });

  it('handles future timestamps gracefully', () => {
    expect(formatRelativeTime(now + 60 * 1000, now)).toBe("à l'instant");
  });
});

describe('formatDate', () => {
  it('pads single-digit days and months', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('formats a typical date', () => {
    expect(formatDate(new Date(2026, 11, 31))).toBe('31/12/2026');
  });

  it('accepts a number timestamp', () => {
    const ts = new Date(2026, 4, 15).getTime();
    expect(formatDate(ts)).toBe('15/05/2026');
  });
});
