export interface ILogger {
  logLevel: number;
  log: (level: number, message: string) => void;
  setLevel: (level: number) => void;
}

// Default logger behavior
export const DefaultLogger: ILogger = {
  logLevel: 2,
  setLevel(level: number) {
    this.logLevel = level;
  },
  log(level, msg) {
    if (level <= this.logLevel) {
      switch (level) {
        case 1:
          console.error(msg);
          break;
        case 2:
          console.warn(msg);
          break;
        case 3:
          console.info(msg);
          break;
        case 4:
          console.debug(msg);
          break;
      }
    }
  },
};

// Logger variable that will be used throughout the application
let AppLogger: ILogger = DefaultLogger;

export function setLogger(logger: ILogger) {
  AppLogger = logger;
}

export function setLevel(level: number) {
  AppLogger.setLevel(level);
}

export function logError(message: string) {
  AppLogger.log(1, message);
}

export function logWarn(message: string) {
  AppLogger.log(2, message);
}

export function logInfo(message: string) {
  AppLogger.log(3, message);
}

export function logDebug(message: string) {
  AppLogger.log(4, message);
}
