import { isPlainObject } from 'typesdk/utils/is';
import { jsonSafeStringify } from 'typesdk/safe-json';
import type { Dict, HttpHeaders, HttpMethod } from 'typesdk/types';


const $proxy = Symbol('ApiRace::$PROXY');

export type ProxyFn = (_provider: ApiProvider, _signal?: AbortSignal) => Promise<Response>;

export type ResponseType = 
  | 'application/json'
  | 'text/xml'
  | 'text/plain'
  | 'x-application/protobuf'
  | 'application/x-www-form-urlencoded'
  | 'application/octet-stream';

export interface ProviderResponse {
  payload: Dict<any>;
  provider: string;
  responseStatus: number;
  responseHeaders: Dict<string>;
}

export type HttpProps = {
  method: HttpMethod;
  url: URL;
  pathname: string;
  search?: Dict<string>;
  body?: any;
  headers?: HttpHeaders;
}

export type ProviderProps = {
  priority?: number;
  method: HttpMethod;
  url: string;
  pathname: string;
  search?: Dict<string>;
  body?: any;
  headers?: HttpHeaders;
  name: string;
  responseType: ResponseType;
}

export class ApiProvider {
  private _priority?: number;
  private _method: HttpMethod;
  private _url: string;
  private _pathname: string;
  private _search?: Dict<string>;
  private _body?: any;
  private _headers?: HttpHeaders;
  private readonly _name: string;
  private readonly _responseType: ResponseType;

  constructor(props: ProviderProps) {
    this._priority = props.priority;
    this._method = props.method;
    this._url = props.url;
    this._pathname = props.pathname;
    this._search = props.search;
    this._body = props.body;
    this._headers = props.headers;
    this._name = props.name;
    this._responseType = props.responseType;
  }

  public get responseType(): ResponseType {
    return this._responseType;
  }

  public get priority(): number | undefined {
    return this._priority;
  }

  public set priority(value: number) {
    if(typeof value !== 'number') return;
    this._priority = value;
  }

  public get name(): string {
    return this._name;
  }

  public get http(): HttpProps {
    const u = new URL(this._pathname, this._url);

    // eslint-disable-next-line no-extra-boolean-cast
    if(!!this._search) {
      u.search = this._encodeSearchParams(this._search);
    }

    return {
      method: this._method,
      url: u,
      pathname: this._pathname,
      search: this._search,
      body: this._body,
      headers: this._headers,
    } as const;
  }

  private _encodeSearchParams(params: Dict<string>): string {
    const keys = Object.keys(params);
    const results: string[] = [];

    for(const key of keys) {
      results.push(`${key}=${encodeURIComponent(params[key])}`);
    }

    return results.join('&');
  }

  public removePriority() {
    this._priority = undefined;
  }
}


export type ProviderListWithPriority = Dict<{
  readonly provider: ApiProvider;
  priority: number;
}>;

export type RaceInit = {
  providers: ApiProvider[] | ProviderListWithPriority;
  timeoutPerAttempt?: number;
  maxAttempts?: number;
  timeout?: number;
  retryOnFail?: boolean;
  maxRetry?: number;
  [$proxy]?: ProxyFn;
  $proxy?: ProxyFn;
};


export class ApiRace {
  private readonly _providers: readonly ApiProvider[];
  private readonly _options: RaceInit;

  constructor(props: RaceInit) {
    if(!Array.isArray(props.providers)) {
      this._providers = this.#shortProvidersList(props.providers);
    } else {
      if(!props.providers.every(item => item instanceof ApiProvider)) {
        throw new TypeError('Invalid providers list');
      }

      this._providers = Object.freeze(props.providers) as readonly ApiProvider[];
    }

    this._options = props;
  }

  public run(): Promise<ProviderResponse> {
    return this.#run();
  }

  async #run(): Promise<ProviderResponse> {
    let result: ProviderResponse | undefined;

    for(const provider of this.#orderProviders()) {
      try {
        result = await this.#request(provider);
        break;
      } catch (err: any) {
        console.warn(`[ApiRace] ${provider.name} failed with error: ${err.message}`);

        if(this._options.retryOnFail) {
          console.warn(`[ApiRace] ${provider.name} retrying...`);
          continue;
        } else throw err;
      }
    }

    if(!result) {
      throw new Error('No providers available');
    }

    return result;
  }

  #orderProviders(): readonly ApiProvider[] {
    const results: ApiProvider[] = [];

    for(const provider of this._providers) {
      if(!provider.priority) {
        results.push(provider);
      } else {
        results.splice(provider.priority, 0, provider);
      }
    }

    return Object.freeze(results) as readonly ApiProvider[];
  }

  #shortProvidersList(list: ProviderListWithPriority): readonly ApiProvider[] {
    const results: ApiProvider[] = [];

    for(const item of Object.values(list)) {
      item.provider.priority = item.priority;
      results.push(item.provider);
    }

    return Object.freeze(results) as readonly ApiProvider[];
  }

  async #request(provider: ApiProvider): Promise<ProviderResponse> {
    let body: any = undefined;

    if(!!provider.http.body && typeof provider.http.body === 'object' && isPlainObject(provider.http.body)) {
      body = jsonSafeStringify(provider.http.body) ?? '{}';
    }

    const getPromise = () => {
      const p = this._options[$proxy] ?? this._options.$proxy;
      if(!!p && typeof p === 'function') return getProxyPromise(p);

      if(!this._options.timeoutPerAttempt) return fetch(provider.http.url.toString(), {
        body,
        method: provider.http.method,
        headers: provider.http.headers as Dict<string> | undefined,
      });

      const ac = new AbortController();

      return Promise.race([
        fetch(provider.http.url.toString(), {
          body,
          signal: ac.signal,
          method: provider.http.method,
          headers: provider.http.headers as Dict<string> | undefined,
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            ac.abort();
            reject(new Error('Request timeout'));
          }, this._options.timeoutPerAttempt);
        }) as Promise<Response>,
      ]);
    };

    const getProxyPromise = (runner: ProxyFn) => {
      if(!this._options.timeoutPerAttempt) return runner(provider);

      const ac = new AbortController();

      return Promise.race([
        runner(provider, ac.signal),
        new Promise((_, reject) => {
          setTimeout(() => {
            ac.abort();
            reject(new Error('Request timeout'));
          }, this._options.timeoutPerAttempt);
        }) as Promise<Response>,
      ]);
    };

    const res = await getPromise();
    return this.#parseResponse(res, provider);
  }

  async #parseResponse(res: Response, provider: ApiProvider): Promise<ProviderResponse> {
    const obj = { payload: {} } as ProviderResponse;

    switch(provider.responseType) {
      case 'application/json': {
        const payload = await res.json();
        const responseHeaders: Dict<string> = {};

        for(const [key, value] of res.headers.entries()) {
          responseHeaders[key] = value;
        }
        
        Object.assign(obj, {
          payload,
          provider: provider.name,
          responseStatus: res.status,
          responseHeaders,
        });

        break;
      }
      case 'application/octet-stream':
        throw new Error('Octet stream not supported yet');
      case 'application/x-www-form-urlencoded': {
        const payload: Dict<string> = {};
        const responseBody = await res.formData();
        const responseHeaders: Dict<string> = {};

        for(const [key, value] of res.headers.entries()) {
          responseHeaders[key] = value;
        }

        for(const [key, value] of responseBody.entries()) {
          payload[key] = value.toString();
        }
        
        Object.assign(obj, {
          payload,
          provider: provider.name,
          responseStatus: res.status,
          responseHeaders,
        });

        break;
      }
      case 'text/plain': {
        const $text = await res.text();
        const responseHeaders: Dict<string> = {};

        for(const [key, value] of res.headers.entries()) {
          responseHeaders[key] = value;
        }
        
        Object.assign(obj, {
          payload: { $text },
          provider: provider.name,
          responseStatus: res.status,
          responseHeaders,
        });

        break;
      }
      case 'x-application/protobuf':
        throw new Error('Protobuf not supported yet');
      case 'text/xml': {
        const $xml = await res.text();
        const responseHeaders: Dict<string> = {};

        for(const [key, value] of res.headers.entries()) {
          responseHeaders[key] = value;
        }

        Object.assign(obj, {
          payload: { $xml },
          provider: provider.name,
          responseStatus: res.status,
          responseHeaders,
        });

        break;
      }
      default: 
        throw new Error('Invalid response type');
    }

    return obj;
  }
}
