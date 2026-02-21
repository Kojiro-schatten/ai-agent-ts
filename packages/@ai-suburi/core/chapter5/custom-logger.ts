export interface Logger {
  info: (msg: string) => void;
  debug: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
  success: (msg: string) => void;
}

/**
 * 指定された名前でロガーをセットアップする。
 * タイムスタンプ・ログレベル・ロガー名を含むフォーマットでコンソールに出力する。
 * @param {string} name - ロガーの識別名（ログメッセージに含まれる）
 * @returns {Logger} info / debug / error / warn / success メソッドを持つロガーオブジェクト
 */
export function setupLogger(name: string): Logger {
  const formatMessage = (level: string, msg: string) => {
    const now = new Date().toISOString();
    return `${now} ${level} [${name}] ${msg}`;
  };

  return {
    info: (msg: string) => console.log(formatMessage('INFO', msg)),
    debug: (msg: string) => console.debug(formatMessage('DEBUG', msg)),
    error: (msg: string) => console.error(formatMessage('ERROR', msg)),
    warn: (msg: string) => console.warn(formatMessage('WARNING', msg)),
    success: (msg: string) => console.log(formatMessage('SUCCESS', msg)),
  };
}
