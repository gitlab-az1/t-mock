import { ssrSafeWindow } from '../_ssr';


/**
 * Get the FormData class.
 * If running in a browser, this will return the native FormData class.
 * else it will return the node.js form-data module.
 * 
 * @returns {typeof FormData} The FormData class 
 */
export function formData(): typeof FormData {
  if(ssrSafeWindow
    && typeof ssrSafeWindow.FormData !== 'undefined'
    && !!FormData) return ssrSafeWindow.FormData;  

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('form-data') as typeof FormData;
}

export default formData;
