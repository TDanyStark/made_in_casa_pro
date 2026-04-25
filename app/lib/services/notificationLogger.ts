// ---------------------------------------------------------------------------
// notificationLogger — structured logging for the notification system
//
// All log lines follow the pattern:
//   [notif:{scope}] {level}: {message}
//
// This makes it easy to grep production logs for notification-specific errors
// without mixing them with generic Next.js output.
// ---------------------------------------------------------------------------

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, scope: string, message: string) {
  const prefix = `[notif:${scope}]`;
  switch (level) {
    case "info":
      console.log(`${prefix} INFO: ${message}`);
      break;
    case "warn":
      console.warn(`${prefix} WARN: ${message}`);
      break;
    case "error":
      console.error(`${prefix} ERROR: ${message}`);
      break;
  }
}

export const notifLog = {
  info: (scope: string, message: string) => log("info", scope, message),
  warn: (scope: string, message: string) => log("warn", scope, message),
  error: (scope: string, message: string) => log("error", scope, message),
};
