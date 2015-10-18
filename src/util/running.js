import * as functions from "./functions";
import { crash } from "./assert";


export const make = (f) => {
  return {
    _running: true,
    _stop: f
  };
};

export const stop = (runner) => {
  if (runner._running) {
    const _stop = runner._stop;
    runner._running = false;
    runner._stop = null;
    _stop();

  } else {
    crash(new Error("Runner is already stopped!"));
  }
};

export const noop = () =>
  make(functions.noop);
