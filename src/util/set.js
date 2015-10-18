import { crash } from "./assert";
import { remove as _remove, size, each, push } from "./array";
export { size, each } from "./array";


export const make = () =>
  [];

export const has = (array, value) =>
  array["indexOf"](value) !== -1;

export const insert = (array, value) => {
  const index = array["indexOf"](value);

  if (index === -1) {
    push(array, value);

  } else {
    crash(new Error("Value already exists in set: " + value));
  }
};

export const include = (array, value) => {
  const index = array["indexOf"](value);

  if (index === -1) {
    push(array, value);
  }
};

export const remove = (array, value) => {
  const index = array["indexOf"](value);

  if (index === -1) {
    crash(new Error("Value does not exist in set: " + value));

  } else {
    _remove(array, index);
  }
};

export const exclude = (array, value) => {
  const index = array["indexOf"](value);

  if (index !== -1) {
    _remove(array, index);
  }
};
