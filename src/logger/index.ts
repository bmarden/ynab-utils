import { getEnvVar } from '@/utils';
import dayjs from 'dayjs';
import path from 'node:path';
import pino from 'pino';

const scriptDir = import.meta.dir;
const rootDir = path.join(scriptDir, '../..');

const fileTransport = {
  target: 'pino/file',
  options: {
    destination: `${rootDir}/logs/${dayjs().format('YYYY-MM-DD')}.log`,
    mkdir: true,
  },
};

const prettyTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
  },
};

const isDev = getEnvVar('NODE_ENV', 'development') === 'development';

export const logger = pino({
  level: getEnvVar('LOG_LEVEL', 'info'),
  redact: ['password', 'secret'],
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: () => `,"time": "${dayjs().format('YYYY-MM-DD HH:mm:ss')}"`,
  transport: isDev ? prettyTransport : fileTransport,
});
