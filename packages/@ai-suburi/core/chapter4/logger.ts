export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export interface Logger {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export function setupLogger(name: string, level: LogLevel = 'INFO'): Logger {
  const minLevel = LOG_LEVELS[level];

  function log(msgLevel: LogLevel, message: string): void {
    if (LOG_LEVELS[msgLevel] >= minLevel) {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} ${msgLevel} [${name}] ${message}`);
    }
  }

  return {
    debug: (message: string) => log('DEBUG', message),
    info: (message: string) => log('INFO', message),
    warn: (message: string) => log('WARN', message),
    error: (message: string) => log('ERROR', message),
  };
}
