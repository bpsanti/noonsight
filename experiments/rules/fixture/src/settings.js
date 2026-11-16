// The operator's settings: the pause switch and the quiet hours.

export function loadSettings(env = process.env) {
  return {
    paused: env.HARBOR_PAUSED === '1',
    quietStart: Number(env.HARBOR_QUIET_START ?? 22),
    quietEnd: Number(env.HARBOR_QUIET_END ?? 7),
  };
}

export function inQuietHours(settings, now) {
  const hour = now.getHours();
  if (settings.quietStart > settings.quietEnd) return hour >= settings.quietStart || hour < settings.quietEnd;
  return hour >= settings.quietStart && hour < settings.quietEnd;
}

export function mayRun(settings, now) {
  return !settings.paused && !inQuietHours(settings, now);
}
