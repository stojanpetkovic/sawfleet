/**
 * Seasonal mode.
 *
 * Hurricane season (June 1 to November 30) shows a quiet banner, worked out in
 * the visitor's browser from the date, so it switches on and off without a new
 * deploy.
 *
 * Set `alert` to true while a storm is approaching: a red banner appears on every
 * page and the emergency request moves to the front (header button, hero, mobile
 * bar). It needs a deploy, so change it, publish, and switch it back afterwards.
 */
export const season = {
  alert: false,
  alertText: 'Storm alert for South Florida: emergency tree requests are flagged as urgent.',
  /** Month/day the season starts and ends, for the quiet banner. */
  start: { month: 6, day: 1 },
  end: { month: 11, day: 30 },
} as const;
