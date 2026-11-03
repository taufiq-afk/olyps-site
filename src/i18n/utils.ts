import { ui, type UiKey } from './ui';
import { siteLangs, defaultLang, type Lang } from '../site.config';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (siteLangs as string[]).includes(value);
}

export function getLang(value: unknown): Lang {
  return isLang(value) ? value : defaultLang;
}

export function useTranslations(lang: Lang) {
  return (key: UiKey): string => ui[lang][key];
}

// Mengubah /{base}/{lang}/rest menjadi /{base}/{target}/rest.
export function switchLangPath(pathname: string, base: string, target: Lang): string {
  const cleanBase = base.replace(/\/$/, '');
  const rest = pathname.startsWith(cleanBase) ? pathname.slice(cleanBase.length) : pathname;
  const segments = rest.split('/').filter(Boolean);
  if (segments.length && isLang(segments[0])) segments.shift();
  const tail = segments.length ? `/${segments.join('/')}/` : '/';
  return `${cleanBase}/${target}${tail}`;
}
