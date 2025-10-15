/**
 * Gets a nested value from an object using a dot-notation path.
 */
export const get = (obj: any, path: string, defaultValue: any = undefined) => {
  if (!obj || !path) return defaultValue;
  const result = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .reduce((res: any, key: string) => (res !== null && res !== undefined ? res[key] : res), obj);
  return result === undefined || result === obj ? defaultValue : result;
};

/**
 * Sets a nested value in an object using a dot-notation path, returning a new object.
 */
export const set = (obj: any, path: string, value: any) => {
  const newObj = JSON.parse(JSON.stringify(obj ?? {}));
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = newObj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (current[k] === undefined) current[k] = {};
    current = current[k];
  }
  current[keys[keys.length - 1]] = value;
  return newObj;
};

