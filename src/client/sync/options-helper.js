import * as async from "../../util/async";
import * as record from "../../util/record";
import * as mutable from "../../util/mutable";
import { ports } from "../../chrome/client";


// TODO rather than syncing with the background page, maybe instead use `chrome.storage.local` ?
export const make_options = (uuid) => {
  const out = async.make();

  const port = ports.open(uuid);

  const options = record.make();

  const get = (s) =>
    record.get(options, s);

  const types = record.make({
    "init": (info) => {
      const current  = record.get(info, "current");
      const defaults = record.get(info, "default");

      record.each(defaults, (key, value) => {
        const x = mutable.make(record.get_default(current, key, () =>
                             value));

        record.insert(options, key, x);

        // TODO test this
        mutable.on_change(x, (value) => {
          ports.send(port, record.make({
            "type": "set",
            "key": key,
            "value": value
          }));
        });
      });

      const get_default = (s) =>
        record.get(defaults, s);

      async.success(out, { get, get_default });
    },

    "set": (info) => {
      const key   = record.get(info, "key");
      const value = record.get(info, "value");
      // TODO this shouldn't send out a message
      mutable.set(get(key), value);
    }
  });

  ports.on_receive(port, (x) => {
    record.get(types, record.get(x, "type"))(x);
  });

  return out;
};
