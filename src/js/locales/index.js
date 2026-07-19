import en from './en';
import es from './es';

const locales = { en, es };

export function resolveLocale(locale = 'en') {
  let requested = locale;

  if (requested === 'auto') {
    requested = (navigator.languages && navigator.languages[0]) || navigator.language || navigator.userLanguage || 'en';
  }

  const language = typeof requested === 'string' ? requested.toLowerCase().replace('_', '-').split('-')[0] : 'en';

  return {
    locale: locales[language] ? language : 'en',
    captions: locales[language] || en,
  };
}
