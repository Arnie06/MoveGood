import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_LIMIT = Number(process.env.GEOAPIFY_DAILY_CREDITS ?? 3000);
const RUNTIME_DIR = path.join(process.cwd(), ".runtime");
const BUDGET_FILE = process.env.GEOAPIFY_BUDGET_FILE?.trim()
  ? path.resolve(process.cwd(), process.env.GEOAPIFY_BUDGET_FILE.trim())
  : path.join(RUNTIME_DIR, "geoapify-budget.json");

type GeoapifyBudgetState = {
  day: string;
  limit: number;
  used: number;
  requests: Array<{
    at: string;
    kind: string;
    credits: number;
    target: string;
  }>;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureBudgetDir() {
  await mkdir(path.dirname(BUDGET_FILE), { recursive: true });
}

async function readBudgetState(): Promise<GeoapifyBudgetState> {
  await ensureBudgetDir();

  try {
    const raw = await readFile(BUDGET_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<GeoapifyBudgetState>;
    const currentDay = todayKey();
    if (parsed.day !== currentDay) {
      return {
        day: currentDay,
        limit: DEFAULT_LIMIT,
        used: 0,
        requests: []
      };
    }

    return {
      day: parsed.day ?? currentDay,
      limit: parsed.limit ?? DEFAULT_LIMIT,
      used: parsed.used ?? 0,
      requests: Array.isArray(parsed.requests) ? parsed.requests : []
    };
  } catch {
    return {
      day: todayKey(),
      limit: DEFAULT_LIMIT,
      used: 0,
      requests: []
    };
  }
}

async function writeBudgetState(state: GeoapifyBudgetState) {
  await ensureBudgetDir();
  await writeFile(BUDGET_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function consumeGeoapifyBudget(input: {
  kind: string;
  target: string;
  credits?: number;
}) {
  const credits = input.credits ?? 1;
  const state = await readBudgetState();

  state.used += credits;
  state.requests.push({
    at: new Date().toISOString(),
    kind: input.kind,
    credits,
    target: input.target
  });

  await writeBudgetState(state);
}

export async function getGeoapifyBudgetStatus() {
  const state = await readBudgetState();
  return {
    day: state.day,
    used: state.used,
    limit: state.limit,
    remaining: Math.max(0, state.limit - state.used)
  };
}
