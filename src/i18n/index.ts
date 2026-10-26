import { getLanguage } from 'obsidian';
import { en, type MessageKey } from './en';
import { zh } from './zh';

const locale = getLanguage().toLowerCase().startsWith('zh') ? 'zh' : 'en';
const messages: Record<MessageKey, string> = locale === 'zh' ? zh : en;

export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = messages[key] ?? en[key] ?? key;
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export type { MessageKey };
