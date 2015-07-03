import { chrome } from "../../common/globals";
import { Timer } from "../../util/time";
import { Dict } from "../../util/dict";
import { to_json, from_json } from "../../util/json";
import { async } from "../../util/async";
import { async_chrome, throw_error } from "../common/util";
import { assert } from "../../util/assert";
import { each, entries } from "../../util/iterator";


// TODO move this into another module
const warn_if = (test, ...args) => {
  if (test) {
    console["warn"](...args);
  } else {
    console["debug"](...args);
  }
};


export const init = async(function* () {
  const timer = new Timer();

  let db = from_json(yield async_chrome((callback) => {
    chrome["storage"]["local"]["get"](null, callback);
  }));

  timer.done();

  let setting = false;


  const delaying = new Dict();

  const with_delay = (key, f) => {
    if (delaying.has(key)) {
      delaying.get(key).thunk = f;
    } else {
      f();
    }
  };

  const delay = (key, ms) => {
    if (delaying.has(key)) {
      const info = delaying.get(key);

      // Only delay if `ms` is greater than `info.ms`
      if (ms <= info.ms) {
        return;
      }
    }

    const o = {
      thunk: null,
      ms: ms
    };

    delaying.set(key, o);

    setTimeout(() => {
      if (delaying.get(key) === o) {
        delaying.remove(key);
      }

      o.thunk();
    }, ms);
  };


  const get = (key, def) => {
    if (db.has(key)) {
      return db.get(key);
    } else {
      return def;
    }
  };

  const set = (key, value) => {
    assert(!setting);

    delay(key, 1000);

    db = db.set(key, value);

    with_delay(key, () => {
      const timer_serialize = new Timer();
      const s_value = to_json(value);
      timer_serialize.done();

      const timer = new Timer();

      chrome["storage"]["local"]["set"]({ [key]: s_value }, () => {
        throw_error();
        timer.done();

        warn_if((timer.diff() + timer_serialize.diff()) >= 1000,
                "db.set: \"" +
                key +
                "\" (serialize " +
                timer_serialize.diff() +
                "ms) (commit " +
                timer.diff() +
                "ms)");
      });
    });
  };

  const get_all = () => db;

  const set_all = (o) => {
    assert(!setting);

    // TODO is this still necessary ?
    setting = true;

    db = o;

    return async(function* () {
      try {
        yield async_chrome((callback) => {
          chrome["storage"]["local"]["clear"](callback);
        });

        const v = to_json(o);

        yield async_chrome((callback) => {
          chrome["storage"]["local"]["set"](v, callback);
        });

      } finally {
        setting = false;
      }
    });
  };

  console["debug"]("db: initialized (" + timer.diff() + "ms)", db);

  return {
    get,
    set,
    remove,
    delay,
    get_all,
    set_all
  };
});