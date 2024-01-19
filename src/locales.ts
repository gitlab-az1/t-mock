export const enum Locales {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  IT = 'it',
  PT = 'pt',
}

export const enum LocaleNames {
  EN = 'English',
  ES = 'Español',
  FR = 'Français',
  IT = 'Italiano',
  PT = 'Português',
}


export const isLocale = (locale: string): locale is Locales => {
  const locs = ([
    Locales.EN,
    Locales.ES,
    Locales.FR,
    Locales.IT,
    Locales.PT,
  ] as const).map(item => item.toLowerCase());

  return locs.includes(locale.toLowerCase() as Locales);
};
