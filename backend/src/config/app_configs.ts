import dotenv from "dotenv";
dotenv.config();

const appConfig = {
  PORT: parseInt(process.env.PORT || "7001", 10),
  DATABASE_URL: process.env.DATABASE_URL || "",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:4000",
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || "default-secret",
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || "1h",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "default-refresh-secret",
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || "",

  UPLOADS_DIR: "uploads",

  LOKI_URL: process.env.LOKI_URL || "",
  APP_NAME: process.env.APP_NAME || "GebaBackend",
  NODE_ENV: process.env.NODE_ENV || "development",
} as const;

export default appConfig;
