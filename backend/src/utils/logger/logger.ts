import winston from 'winston';
import appConfig from '../../config/app_configs.js';
import LokiTransport from 'winston-loki';
const winstonLogger = (lokiUrl: string, name: string, level: string, nodeEnv: string) => {
    const options = {
        console: {
            level,
            handleExceptions: true,
            format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.colorize({ all: true }), winston.format.printf(({ level, message, label, timestamp }) => {
                return `${timestamp} [${label || name}] ${level}: ${message}`;
            })),
            json: false,
        },
        loki: {
            labels: { app: name, environment: nodeEnv },
            level,
            host: lokiUrl,
            format: winston.format.json(),
            replaceTimestamp: true,
            onConnectionError: (err: any) => console.error(err),
        },
    };
    let transports = [];
    if (nodeEnv === 'development') {
        transports = [
            new winston.transports.Console(options.console),
            new LokiTransport(options.loki),
        ];
    }
    else {
        transports = [new LokiTransport(options.loki)];
    }
    const logger = winston.createLogger({
        exitOnError: false,
        defaultMeta: { service: name },
        transports: transports,
    });
    return logger;
};
const logger = winstonLogger(appConfig.LOKI_URL || 'http://217.217.249.150:3100', appConfig.APP_NAME || 'GebaBackend', 'info', appConfig.NODE_ENV || 'development');
export { logger };
