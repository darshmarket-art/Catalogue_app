type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

// One JSON object per line: Cloud Logging picks up `severity` and `message` automatically.
function write(severity: Severity, message: string, fields?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test') return;
  const line = JSON.stringify({ severity, message, ...fields });
  if (severity === 'ERROR') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => write('INFO', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('WARNING', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('ERROR', message, fields)
};
