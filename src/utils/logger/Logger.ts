import * as fs from 'fs';
import * as bunyan from 'bunyan';

import config from '../../config';

const { dir: logDir } = config.logging;

export const Logger = (name?: string) => {
    const logger = bunyan.createLogger({
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

