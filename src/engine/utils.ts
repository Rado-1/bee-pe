/**
 * Singleton pattern.
 * URL: https://trevoratlas.com/posts/how-to-create-a-typescript-singleton-decorator
 *
 * INFO instantiate singleton subclasses first, then superclasses;
 * see https://github.com/aigoncharov/singleton/issues/1
 *
 */
export const SINGLETON_KEY = Symbol();

export type Singleton<T extends new (...args: any[]) => any> = T & {
  [SINGLETON_KEY]: T extends new (...args: any[]) => infer I ? I : never;
};

export const Singleton = <T extends new (...args: any[]) => any>(type: T) =>
  new Proxy(type, {
    // this will hijack the constructor
    construct(target: Singleton<T>, argsList, newTarget) {
      // we should skip the proxy for children of our target class
      if (target.prototype !== newTarget.prototype) {
        return Reflect.construct(target, argsList, newTarget);
      }
      // if our target class does not have an instance, create it
      if (!target[SINGLETON_KEY]) {
        target[SINGLETON_KEY] = Reflect.construct(target, argsList, newTarget);
      }
      // return the instance we created!
      return target[SINGLETON_KEY];
    },
  });

/**
 * Allows to specify a value or dynamic version specified as a function
 * evaluated in runtime.
 */
export type Flexible<T> = T | (() => T);

export function getValueOfFlexible<T>(value: Flexible<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

export type Action = () => void;

export type StringAction = (val: string) => void;

export type Condition = () => boolean;

export function uuid(): string {
  return ('' + 1e7 + -1e3 + -4e3 + -8e3 + -1e11).replace(/1|0/g, function () {
    return (0 | (Math.random() * 16)).toString(16);
  });
}
