import type { Logger } from "winston";
import type { SignatureDatabase } from "./SignatureDatabase";

// The response of GET /signature-database/v1/stats. The breakdown is null if the
// service has no usable base file, because a full count by type in Postgres is too
// expensive (it reads all of compiled_contracts_signatures).
export interface SignatureStatsResult {
  count: {
    function: number | null;
    event: number | null;
    error: number | null;
    unknown: number | null;
    total: number;
  };
  metadata: {
    refreshed_at: string;
  };
}

// The daily counts that a BigQuery scheduled query writes for all signatures with
// created_at <= t0 (see bigquery/signature-stats-base.sql).
export interface SignatureStatsBase {
  t0: Date;
  function: number;
  event: number;
  error: number;
  unknown: number;
  total: number;
}

export interface SignatureStatsOptions {
  // URL of the base file. Without it, the breakdown is always null.
  baseUrl?: string;
  baseRefreshIntervalMs?: number;
  baseMaxAgeMs?: number;
  cacheTtlMs?: number;
  // How often the Postgres-only total gets a new full count
  totalBaseMaxAgeMs?: number;
  now?: () => Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const BASE_FIELDS = ["function", "event", "error", "unknown", "total"] as const;

// BigQuery's JSON export writes newline-delimited JSON and INT64 values as strings.
export function parseSignatureStatsBase(text: string): SignatureStatsBase {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) {
    throw new Error("Base file is empty");
  }
  const raw = JSON.parse(line) as Record<string, unknown>;

  const t0 = new Date(String(raw.t0));
  if (typeof raw.t0 !== "string" || isNaN(t0.getTime())) {
    throw new Error(`Invalid t0 in base file: ${String(raw.t0)}`);
  }

  const counts = {} as Record<(typeof BASE_FIELDS)[number], number>;
  for (const field of BASE_FIELDS) {
    const rawValue = raw[field];
    const value = Number(rawValue);
    const isNumberOrDigits =
      typeof rawValue === "number" ||
      (typeof rawValue === "string" && /^\d+$/.test(rawValue));
    if (!isNumberOrDigits || !Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid ${field} in base file: ${String(raw[field])}`);
    }
    counts[field] = value;
  }

  return { t0, ...counts };
}

export class SignatureStats {
  private readonly baseUrl?: string;
  private readonly baseRefreshIntervalMs: number;
  private readonly baseMaxAgeMs: number;
  private readonly cacheTtlMs: number;
  private readonly totalBaseMaxAgeMs: number;
  private readonly now: () => Date;

  private base?: SignatureStatsBase;
  private baseRefreshTimer?: NodeJS.Timeout;
  private baseLoad?: Promise<void>;

  // Fallback without a base file: a full count of the total only
  private totalBase?: { t0: Date; total: number };
  private totalBaseLoad?: Promise<{ t0: Date; total: number }>;

  private cached?: { at: number; result: SignatureStatsResult };
  private inFlight?: Promise<SignatureStatsResult>;

  constructor(
    private readonly database: SignatureDatabase,
    private readonly logger: Logger,
    options: SignatureStatsOptions = {},
  ) {
    this.baseUrl = options.baseUrl;
    this.baseRefreshIntervalMs = options.baseRefreshIntervalMs ?? HOUR_MS;
    this.baseMaxAgeMs = options.baseMaxAgeMs ?? 3 * DAY_MS;
    this.cacheTtlMs = options.cacheTtlMs ?? 5000;
    this.totalBaseMaxAgeMs = options.totalBaseMaxAgeMs ?? DAY_MS;
    this.now = options.now ?? (() => new Date());
  }

  // Reads the base file now and then on each interval
  start(): Promise<void> {
    if (!this.baseUrl) {
      this.logger.info(
        "SIGNATURE_STATS_BASE_URL is not set: /stats gives no breakdown by type",
      );
      return Promise.resolve();
    }
    this.baseRefreshTimer = setInterval(() => {
      void this.loadBase();
    }, this.baseRefreshIntervalMs);
    this.baseRefreshTimer.unref();
    return this.loadBase();
  }

  stop(): void {
    if (this.baseRefreshTimer) {
      clearInterval(this.baseRefreshTimer);
      this.baseRefreshTimer = undefined;
    }
  }

  // Reads the base file. If the read fails, the service keeps the file that it has.
  loadBase(): Promise<void> {
    if (!this.baseUrl) {
      return Promise.resolve();
    }
    if (!this.baseLoad) {
      this.baseLoad = this.fetchBase(this.baseUrl).finally(() => {
        this.baseLoad = undefined;
      });
    }
    return this.baseLoad;
  }

  private async fetchBase(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const base = parseSignatureStatsBase(await response.text());
      if (this.base && base.t0 < this.base.t0) {
        this.logger.warn("Base file is older than the current base, ignored", {
          t0: base.t0.toISOString(),
          currentT0: this.base.t0.toISOString(),
        });
        return;
      }
      this.base = base;
      this.logger.info("Loaded signature stats base", {
        t0: base.t0.toISOString(),
        total: base.total,
      });
    } catch (error) {
      this.logger.warn("Could not load signature stats base", {
        url,
        error: error instanceof Error ? error.message : String(error),
        currentT0: this.base?.t0.toISOString(),
      });
    }
  }

  private usableBase(): SignatureStatsBase | undefined {
    if (!this.base) {
      return undefined;
    }
    const age = this.now().getTime() - this.base.t0.getTime();
    return age < this.baseMaxAgeMs ? this.base : undefined;
  }

  async getStats(): Promise<SignatureStatsResult> {
    if (
      this.cached &&
      this.now().getTime() - this.cached.at < this.cacheTtlMs
    ) {
      return this.cached.result;
    }
    if (!this.inFlight) {
      this.inFlight = this.computeStats()
        .then((result) => {
          this.cached = { at: this.now().getTime(), result };
          return result;
        })
        .finally(() => {
          this.inFlight = undefined;
        });
    }
    return this.inFlight;
  }

  private async computeStats(): Promise<SignatureStatsResult> {
    const refreshedAt = this.now().toISOString();
    const base = this.usableBase();

    if (base) {
      const delta = await this.database.countSignaturesSince(base.t0);
      return {
        count: {
          function: base.function + delta.function,
          event: base.event + delta.event,
          error: base.error + delta.error,
          unknown: base.unknown + delta.unknown,
          total: base.total + delta.total,
        },
        metadata: { refreshed_at: refreshedAt },
      };
    }

    const totalBase = await this.getTotalBase();
    const delta = await this.database.countSignaturesSince(totalBase.t0);
    return {
      count: {
        function: null,
        event: null,
        error: null,
        unknown: null,
        total: totalBase.total + delta.total,
      },
      metadata: { refreshed_at: refreshedAt },
    };
  }

  // A full count of the total, with the same one-hour margin as the BigQuery base.
  // It is computed again after totalBaseMaxAgeMs, so that the delta stays small.
  private async getTotalBase(): Promise<{ t0: Date; total: number }> {
    const now = this.now();
    const isFresh =
      this.totalBase &&
      now.getTime() - this.totalBase.t0.getTime() < this.totalBaseMaxAgeMs;
    if (!isFresh && !this.totalBaseLoad) {
      const t0 = new Date(now.getTime() - HOUR_MS);
      this.totalBaseLoad = this.database
        .countSignaturesUntil(t0)
        .then((total) => {
          this.totalBase = { t0, total };
          return this.totalBase;
        })
        .finally(() => {
          this.totalBaseLoad = undefined;
        });
      // An old count is still correct with its delta, so do not wait for the new one
      this.totalBaseLoad.catch((error) => {
        this.logger.error("Could not count signatures", { error });
      });
    }
    return this.totalBase ?? this.totalBaseLoad!;
  }
}
