import { getEnvVar } from '@/utils';
import dayjs from 'dayjs';
import path from 'node:path';
import pino, { stdTimeFunctions } from 'pino';

const scriptDir = import.meta.dir;
const rootDir = path.join(scriptDir, '../..');

const fileTransport = {
  target: 'pino/file',
  options: {
    destination: `${rootDir}/logs/${dayjs().format('YYYY-MM-DD')}.log`,
    mkdir: true,
    translateTime: 'SYS:standard',
  },
};

const prettyTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    ignore: 'pid,hostname',
  },
};

const isDev = getEnvVar('NODE_ENV', 'development') === 'development';

export const logger = pino({
  level: getEnvVar('LOG_LEVEL', 'info'),
  redact: ['password', 'secret'],
  // Exclude pid and hostname from logs
  base: undefined,
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: !isDev
    ? () => `,"time": "${dayjs().format('YYYY-MM-DD HH:mm:ss')}"`
    : stdTimeFunctions.epochTime,
  transport: isDev ? prettyTransport : fileTransport,
});
