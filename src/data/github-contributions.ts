const API = 'https://github-contributions-api.jogruber.de/v4/Carluve?y=last';

export interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

export interface GithubActivityData {
  totalLastYear: number;
  contributions: ContributionDay[];
}

let pending: Promise<GithubActivityData | null> | undefined;

/** One fetch per build. A network or payload failure returns null so the page can use the chart image. */
export function getGithubActivity(): Promise<GithubActivityData | null> {
  if (!pending) pending = load();
  return pending;
}

async function load(): Promise<GithubActivityData | null> {
  try {
    const response = await fetch(API, {
      headers: { accept: 'application/json', 'user-agent': 'carlosluengo-com' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      console.warn(`GitHub contributions request returned ${response.status}; using the chart image.`);
      return null;
    }
    const data = (await response.json()) as {
      total?: { lastYear?: unknown };
      contributions?: unknown;
    };
    if (!Array.isArray(data.contributions)) return null;

    const contributions = data.contributions.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const day = entry as { date?: unknown; count?: unknown; level?: unknown };
      if (typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) return [];
      if (typeof day.count !== 'number' || typeof day.level !== 'number') return [];
      return [{ date: day.date, count: day.count, level: Math.max(0, Math.min(4, day.level)) }];
    });
    if (contributions.length === 0) return null;

    const reported = data.total?.lastYear;
    const totalLastYear =
      typeof reported === 'number' ? reported : contributions.reduce((sum, day) => sum + day.count, 0);

    return { totalLastYear, contributions };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`GitHub contributions fetch failed (${message}); using the chart image.`);
    return null;
  }
}
