const formatTimestamp = (): string => new Date().toISOString();

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.info(`[${formatTimestamp()}] [INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[${formatTimestamp()}] [WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[${formatTimestamp()}] [ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[${formatTimestamp()}] [DEBUG] ${message}`, ...args);
    }
  },
};
