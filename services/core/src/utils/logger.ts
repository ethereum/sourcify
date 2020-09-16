import * as fs from 'fs';
import * as bunyan from 'bunyan';

export const Logger = (logDir: any, name?: string) => {
    const logger: bunyan = bunyan.createLogger({
        name: name || 'Sourcify',
        streams: [{
            stream: process.stdout,
            level: 30
        }]
    });

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
    return logger;
}


