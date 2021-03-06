// ========================================================================== //
// Singleton

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

// ========================================================================== //
// Types

/**
 * Allows to specify a value or dynamic version specified as a function
 * evaluated in runtime.
 */
export type Flexible<T> = T | (() => T);

/**
 * Returns value of Flexible<T>.
 * @param flexValue flexible value
 */
export function getValueOfFlexible<T>(flexVal: Flexible<T>): T {
  return typeof flexVal === 'function' ? (flexVal as () => T)() : flexVal;
}

/**
 * Action without parameter.
 */
export type ActionNoParam = () => void;

/**
 * Action with single parameter of type T.
 */
export type Action<T> = (val: T) => void;

/**
 * Non-parametric condition.
 */
export type ConditionNoParam = () => boolean;

/**
 * Condition with single parameter of type T.
 */
export type Condition<T> = (input: T) => boolean;

// ========================================================================== //
// Various functions

/**
 * Generates a unique identifier, aka. UUID.
 * @returns UUID string
 */
export function uuid(): string {
  return ('' + 1e7 + -1e3 + -4e3 + -8e3 + -1e11).replace(/1|0/g, function () {
    return (0 | (Math.random() * 16)).toString(16);
  });
}
