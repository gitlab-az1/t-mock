import { Locales, isLocale } from '../locales';


export type ModuleInit = {
  locale?: Locales;
}


export abstract class Module {
  private _locale: Locales = Locales.EN;

  constructor(props?: ModuleInit) {
    if(!!props?.locale && isLocale(props.locale)) {
      this._locale = props.locale;
    }
  }

  public set locale(locale: Locales) {
    if(!isLocale(locale)) return;
    this._locale = locale;
  }

  public get locale(): Locales {
    return this._locale;
  }
}

export default Module;
