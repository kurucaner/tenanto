import DatadogWinston from "datadog-winston";
import type { FastifyBaseLogger } from "fastify";
import winston from "winston";

type Bindings = {
  [key: string]: any;
};

interface RedactOptions {
  censor?: string | ((value: unknown, path: string[]) => unknown);
  paths: string[];
  remove?: boolean;
}
type SerializerFn = (value: any) => any;
type Level = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
type LevelOrString = Level | (string & {});
interface ChildLoggerOptions<CustomLevels extends string = never> {
  customLevels?: { [level in CustomLevels]: number };
  formatters?: {
    level?: (label: string, number: number) => object;
    bindings?: (bindings: Bindings) => object;
    log?: (object: object) => object;
  };
  level?: LevelOrString;
  msgPrefix?: string;
  redact?: string[] | RedactOptions;
  serializers?: { [key: string]: SerializerFn };
}

import packageJson from "../../package.json";

const colors = {
  debug: "blue",
  error: "red",
  http: "magenta",
  info: "green",
  silly: "white",
  verbose: "cyan",
  warn: "yellow",
};
winston.addColors(colors);

const env = process.env.HOST_ENV ?? "development";
const isDev = env === "development";

const datadogTags = [
  `env:${env}`,
  `version:${packageJson.version}`,
  process.env.GITHUB_RUN_NUMBER ? `ci_run:${process.env.GITHUB_RUN_NUMBER}` : null,
]
  .filter(Boolean)
  .join(",");

const transports: winston.transport[] = [];

if (isDev) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    })
  );
}

export const WinstonLogger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  level: process.env.LOG_LEVEL ?? "info",
  transports,
});

if (process.env.DD_API_KEY) {
  const datadogOptions: DatadogWinston.DatadogTransportOptions = {
    apiKey: process.env.DD_API_KEY,
    ddsource: "nodejs",
    ddtags: datadogTags,
    hostname: `propertyos-server-${env}`,
    intakeRegion: "us5",
    service: "propertyos-server",
  };
  WinstonLogger.add(new DatadogWinston(datadogOptions));
}

/**
 * Winston 3's one-arg `.info(obj)` uses `obj.message` as the line message; Pino uses `msg`.
 * Without this, Winston wraps the whole object as `message` and dev `simple()` prints `[object Object]`.
 */
export function normalizeWinstonRecord(
  fields: Record<string, unknown>,
  fallbackMessage = "(log)"
): Record<string, unknown> {
  const { message: messageField, msg, ...rest } = fields;
  const fromMessage =
    typeof messageField === "string" && messageField.length > 0 ? messageField : undefined;
  const fromMsg = typeof msg === "string" && msg.length > 0 ? msg : undefined;
  const fromErr =
    typeof rest.errMessage === "string" && rest.errMessage.length > 0 ? rest.errMessage : undefined;
  const message = fromMessage ?? fromMsg ?? fromErr ?? fallbackMessage;
  return { ...rest, message };
}

function stringifyUnknownForLog(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol")
    return value.description ? `Symbol(${value.description})` : "Symbol()";
  if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }
  throw new Error(`stringifyUnknownForLog: unexpected typeof ${typeof value}`);
}

function logStringOrRecord(
  level: "debug" | "info" | "warn",
  msg: string | Record<string, unknown>
): void {
  if (typeof msg === "string") {
    if (level === "info") WinstonLogger.info(msg);
    else if (level === "warn") WinstonLogger.warn(msg);
    else WinstonLogger.debug(msg);
    return;
  }
  const payload = normalizeWinstonRecord(msg);
  if (level === "info") WinstonLogger.info(payload);
  else if (level === "warn") WinstonLogger.warn(payload);
  else WinstonLogger.debug(payload);
}

function pinoLikeLevelLog(level: "debug" | "info" | "warn", msg: unknown, args: unknown[]): void {
  if (typeof msg === "string" && args.length === 0) logStringOrRecord(level, msg);
  else if (msg != null && typeof msg === "object")
    logStringOrRecord(level, msg as Record<string, unknown>);
  else logStringOrRecord(level, stringifyUnknownForLog(msg));
}

function logError(obj: unknown): void {
  if (obj instanceof Error) {
    WinstonLogger.error(obj.message, { name: obj.name, stack: obj.stack });
  } else if (typeof obj === "string") {
    WinstonLogger.error(obj);
  } else {
    WinstonLogger.error(normalizeWinstonRecord({ ...(obj as Record<string, unknown>) }, "(error)"));
  }
}

/** Fastify-compatible `server.log` shim (Pino-like surface used across the app). */
export function createFastifyLogAdapter(): FastifyBaseLogger {
  const adapter = {
    child(_bindings: Bindings, _options?: ChildLoggerOptions): FastifyBaseLogger {
      return adapter as FastifyBaseLogger;
    },
    debug(msg: unknown, ...args: unknown[]) {
      pinoLikeLevelLog("debug", msg, args);
    },
    error(obj: unknown, ...args: unknown[]) {
      if (obj instanceof Error) logError(obj);
      else if (typeof obj === "string" && args.length === 0) logError(obj);
      else if (obj != null && typeof obj === "object")
        logError({ ...(obj as Record<string, unknown>), ...args });
      else logError(stringifyUnknownForLog(obj));
    },
    fatal(obj: unknown, ...args: unknown[]) {
      if (obj instanceof Error) {
        WinstonLogger.error(obj.message, { level: "fatal", name: obj.name, stack: obj.stack });
      } else if (typeof obj === "string" && args.length === 0) {
        WinstonLogger.error(obj);
      } else if (obj != null && typeof obj === "object") {
        WinstonLogger.error(
          normalizeWinstonRecord(
            { fatal: true, ...(obj as Record<string, unknown>), ...args },
            "(fatal)"
          )
        );
      } else {
        WinstonLogger.error(stringifyUnknownForLog(obj));
      }
    },
    info(msg: unknown, ...args: unknown[]) {
      pinoLikeLevelLog("info", msg, args);
    },
    get level(): string {
      return WinstonLogger.level;
    },
    set level(value: string) {
      WinstonLogger.level = value;
    },
    silent(..._args: unknown[]) {
      /* pino noop */
    },
    trace(msg: unknown, ...args: unknown[]) {
      pinoLikeLevelLog("debug", msg, args);
    },
    warn(msg: unknown, ...args: unknown[]) {
      pinoLikeLevelLog("warn", msg, args);
    },
  };
  return adapter as FastifyBaseLogger;
}
