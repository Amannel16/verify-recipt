type LogLevel = "info" | "warn" | "error" | "debug";

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, message: unknown, ...args: unknown[]) {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  switch (level) {
    case "error":
      console.error(prefix, message, ...args);
      break;
    case "warn":
      console.warn(prefix, message, ...args);
      break;
    case "debug":
      if (process.env.NODE_ENV === "development") {
        console.debug(prefix, message, ...args);
      }
      break;
    default:
      console.log(prefix, message, ...args);
  }
}

export const logger = {
  info: (message: unknown, ...args: unknown[]) => log("info", message, ...args),
  warn: (message: unknown, ...args: unknown[]) => log("warn", message, ...args),
  error: (message: unknown, ...args: unknown[]) => log("error", message, ...args),
  debug: (message: unknown, ...args: unknown[]) => log("debug", message, ...args),
};
