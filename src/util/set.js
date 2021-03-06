/* @flow */
import { crash } from "./assert";
import { remove as _remove, size, each, push } from "./array";
export { size, each } from "./array";


export type Set<A> = Array<A>;


export const make = <A>(): Set<A> =>
  [];

export const has = <A>(array: Set<A>, value: A): boolean =>
  array.indexOf(value) !== -1;

export const insert = <A>(array: Set<A>, value: A): void => {
  const index = array.indexOf(value);

  if (index === -1) {
    push(array, value);

  } else {
    crash(new Error("Value already exists in set: " + value));
  }
};

export const include = <A>(array: Set<A>, value: A): void => {
  const index = array.indexOf(value);

  if (index === -1) {
    push(array, value);
  }
};

export const remove = <A>(array: Set<A>, value: A): void => {
  const index = array.indexOf(value);

  if (index === -1) {
    crash(new Error("Value does not exist in set: " + value));

  } else {
    _remove(array, index);
  }
};

export const exclude = <A>(array: Set<A>, value: A): void => {
  const index = array.indexOf(value);

  if (index !== -1) {
    _remove(array, index);
  }
};
