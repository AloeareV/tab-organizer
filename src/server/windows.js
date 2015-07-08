import { init as init_chrome } from "../chrome/server";
import { init as init_session } from "./session";
import { init as init_db } from "./migrate";
import { init as init_sync } from "./sync";
import { each, map, foldl } from "../util/iterator";
import { timestamp } from "../util/time";
import { assert, fail } from "../util/assert";
import { List } from "../util/immutable/list";
import { Record } from "../util/immutable/record";
import { Set } from "../util/mutable/set"; // TODO this is only needed for development
import { async } from "../util/async";


export const init = async(function* () {
  const db = yield init_db;
  const { windows, tabs, ports } = yield init_chrome;
  const session = yield init_session;
  const { sync } = yield init_sync;


  db.default(["current.windows"], List());
  db.default(["current.window-ids"], Record());
  db.default(["current.tab-ids"], Record());

  sync("current.windows");
  sync("current.window-ids");
  sync("current.tab-ids");


  const delay = (ms) => {
    db.delay("current.windows", ms);
    db.delay("current.window-ids", ms);
    db.delay("current.tab-ids", ms);
  };


  // TODO this can be removed for the final release, it's only for development
  // TODO more checks (e.g. that the indexes are correct)
  const check_integrity = () => {
    const windows    = db.get(["current.windows"]);
    const window_ids = db.get(["current.window-ids"]);
    const tab_ids    = db.get(["current.tab-ids"]);

    const seen = new Set();

    each(windows, (id) => {
      assert(window_ids.has(id));
      seen.add(id);
    });

    each(window_ids, ([id, window]) => {
      assert(window.get("id") === id);
      windows.index_of(id);

      const seen = new Set();

      each(window.get("tabs"), (id) => {
        assert(tab_ids.has(id));
        seen.add(id);
      });
    });

    each(tab_ids, ([id, tab]) => {
      assert(tab.get("id") === id);

      const window = window_ids.get(tab.get("window"));

      window.get("tabs").index_of(id);
    });
  };


  // TODO test this
  const update_time = (time, s) => {
    if (time.has(s)) {
      return time.set(s, timestamp());
    } else {
      return time.insert(s, timestamp());
    }
  };

  const update_tab = (db, tab_id, info) => {
    db.modify(["current.tab-ids", tab_id], (old_tab) => {
      const new_tab = old_tab.set("url", info.url)
                             .set("title", info.title)
                             .set("favicon", info.favicon)
                             .set("pinned", info.pinned);

      // TODO test this
      if (old_tab === new_tab) {
        return old_tab;

      } else {
        return new_tab.modify("time", (time) =>
          update_time(time, "updated"));
      }
    });
  };

  const make_new_tab = (db, window_id, tab_id, info) => {
    const tab = Record([
      ["id", tab_id],
      ["window", window_id],
      ["url", info.url],
      ["title", info.title],
      ["favicon", info.favicon],
      ["pinned", info.pinned],

      ["time", Record([
        ["created", timestamp()],
        //["updated", null],
        //["unloaded", null],
        //["focused", null],
        //["moved-in-window", null],
        //["moved-to-window", null]
      ])],

      ["tags", Record()]
    ]);

    db.insert(["current.tab-ids", tab_id], tab);
  };

  const update_window = (db, window_id, info) => {
    const tab_ids = db.get(["current.tab-ids"]);

    db.modify(["current.window-ids", window_id, "tabs"], (tabs) =>
      foldl(tabs, info.tabs, (tabs, info) => {
        const tab_id = session.tab_id(info.id);

        if (tab_ids.has(tab_id)) {
          // TODO assert that the index is correct ?
          update_tab(db, tab_id, info);
          return tabs;

        } else {
          make_new_tab(db, window_id, tab_id, info);
          // TODO is this correct ?
          return tabs.push(tab_id);
        }
      }));
  };

  const make_new_window = (db, window_id, info) => {
    const window = Record([
      ["id", window_id],
      ["name", null],

      ["tabs", List(map(info.tabs, (tab) => {
        const tab_id = session.tab_id(tab.id);
        make_new_tab(db, window_id, tab_id, tab);
        return tab_id;
      }))],

      ["time", Record([
        ["created", timestamp()],
        //["focused", null],
        //["unloaded", null]
      ])]
    ]);

    db.insert(["current.window-ids", window_id], window);
  };

  const find_right_index = (tabs, window, index) => {
    // TODO test this
    const prev = window.tabs.get(index - 1);
    const prev_id = session.tab_id(prev.id);
    // TODO can this be implemented more efficiently ?
    const prev_index = tabs.index_of(prev_id);
    return prev_index + 1;
  };

  const find_left_index = (tabs, window, index) => {
    // TODO test this
    if (window.tabs.has(index + 1)) {
      const next = window.tabs.get(index + 1);
      const next_id = session.tab_id(next.id);
      // TODO can this be implemented more efficiently ?
      return tabs.index_of(next_id);

    } else {
      // TODO is this correct ?
      return tabs.size;
    }
  };


  const window_init = (db, info) => {
    db.transaction((db) => {
      const id = session.window_id(info.id);

      // TODO this is a little inefficient
      const window_ids = db.get(["current.window-ids"]);

      // TODO is this correct ?
      if (window_ids.has(id)) {
        // TODO assert that the index is correct ?
        update_window(db, id, info);

      } else {
        make_new_window(db, id, info);

        // TODO is this correct ?
        // TODO what about when reopening a closed window ?
        db.modify(["current.windows"], (windows) => windows.push(id));
      }
    });
  };

  const window_open = ({ window: info }) => {
    db.transaction((db) => {
      const id = session.window_id(info.id);

      make_new_window(db, id, info);

      // TODO is this correct ?
      // TODO what about when reopening a closed window ?
      db.modify(["current.windows"], (windows) => windows.push(id));

      /*ports.send(uuid_port_tab, Record([
        ["type", "window-open"],
        ["window-id", id],
        ["index", new_index],
        // TODO this is a bit inefficient
        ["window", window_ids.get(id)]
      ]));*/
    });
  };

  const window_focus = (info) => {
    db.transaction((db) => {
      if (info.new !== null) {
        const id = session.window_id(info.new.id);

        db.modify(["current.window-ids", id, "time"], (time) =>
          update_time(time, "focused"));

        /*ports.send(uuid_port_tab, Record([
          ["type", "window-focus"],
          ["window-id", id],
          // TODO this is a bit inefficient
          ["window", window]
        ]));*/
      }
    });
  };

  const window_close = ({ window: info }) => {
    db.transaction((db) => {
      const id = session.window_id(info.id);

      const tabs = db.get(["current.window-ids", id, "tabs"]);

      // Removes all the unloaded tabs
      // TODO test this
      each(tabs, (tab_id) => {
        db.remove(["current.tab-ids", tab_id]);
      });

      db.remove(["current.window-ids", id]);

      db.modify(["current.windows"], (windows) =>
        // TODO can this be implemented more efficiently ?
        windows.remove(windows.index_of(id)));

      /*ports.send(uuid_port_tab, Record([
        ["type", "window-close"],
        ["window-id", id],
        ["index", index]
      ]));*/
    });
  };

  const tab_open = ({ window, tab, index }) => {
    db.transaction((db) => {
      const window_id = session.window_id(window.id);
      const tab_id = session.tab_id(tab.id);

      make_new_tab(db, window_id, tab_id, tab);

      db.modify(["current.window-ids", window_id, "tabs"], (tabs) =>
        tabs.insert(find_left_index(tabs, window, index), tab_id));

      /*ports.send(uuid_port_tab, Record([
        ["type", "tab-open"],
        ["window-id", window_id],
        ["tab-id", tab_id],
        ["index", new_index],
        ["tab", new_tab]
      ]));*/
    });
  };

  const tab_focus = (info) => {
    db.transaction((db) => {
      if (info.new !== null) {
        const tab_id = session.tab_id(info.new.id);

        db.modify(["current.tab-ids", tab_id, "time"], (time) =>
          update_time(time, "focused"));

        /*ports.send(uuid_port_tab, Record([
          ["type", "tab-focus"],
          ["tab-id", tab_id],
          ["tab", new_tab]
        ]));*/
      }
    });
  };

  const tab_update = ({ tab }) => {
    db.transaction((db) => {
      const tab_id = session.tab_id(tab.id);

      update_tab(db, tab_id, tab);
    });

    /*
    // TODO test this
    if (new_tab_ids !== old_tab_ids) {
      ports.send(uuid_port_tab, Record([
        ["type", "tab-update"],
        ["tab-id", tab_id],
        // TODO this is a bit inefficient
        ["tab", new_tab_ids.get(tab_id)]
      ]));
    }*/
  };

  // TODO test this
  const tab_move = ({ tab, old_window, new_window, old_index, new_index }) => {
    db.transaction((db) => {
      const tab_id = session.tab_id(tab.id);

      const old_window_id = session.window_id(old_window.id);
      const new_window_id = session.window_id(new_window.id);


      db.set(["current.tab-ids", tab_id, "window"], new_window_id);

      db.modify(["current.tab-ids", tab_id, "time"], (time) =>
        update_time(time, "moved"));


      db.modify(["current.window-ids", old_window_id, "tabs"], (tabs) =>
        tabs.remove(tabs.index_of(tab_id)));

      db.modify(["current.window-ids", new_window_id, "tabs"], (tabs) => {
        // TODO is this check correct ?
        if (old_window === new_window) {
          // Moved to the left
          if (new_index < old_index) {
            return tabs.insert(find_left_index(tabs, new_window, new_index), tab_id);

          // Moved to the right
          } else if (new_index > old_index) {
            return tabs.insert(find_right_index(tabs, new_window, new_index), tab_id);

          } else {
            fail();
          }

        } else {
          // TODO is this correct ?
          return tabs.insert(find_left_index(tabs, new_window, new_index), tab_id);
        }
      });

      /*ports.send(uuid_port_tab, Record([
        ["type", "tab-move"],
        ["old-window-id", old_window_id],
        ["new-window-id", new_window_id],
        ["tab-id", tab_id],
        ["old-index", session_old_index],
        ["new-index", session_new_index],
        ["tab", new_tab]
      ]));*/
    });
  };

  const tab_close = (info) => {
    db.transaction((db) => {
      // Delay by 10 seconds, so that when Chrome closes,
      // it doesn't remove the tabs / windows
      // TODO is this place correct ?
      if (info.window_closing) {
        delay(10000);
      }

      const window_id = session.window_id(info.window.id);
      const tab_id = session.tab_id(info.tab.id);

      db.remove(["current.tab-ids", tab_id]);

      db.modify(["current.window-ids", window_id, "tabs"], (tabs) =>
        // TODO can this be implemented more efficiently ?
        tabs.remove(tabs.index_of(tab_id)));

      /*ports.send(uuid_port_tab, Record([
        ["type", "tab-close"],
        ["window-id", window_id],
        ["tab-id", tab_id],
        ["index", index]
      ]));*/
    });
  };


  // This must go before `window_init`
  session.init(windows.get());


  check_integrity();

  // TODO time this
  db.transaction((db) => {
    each(windows.get(), (info) => {
      window_init(db, info);
    });
  });

  check_integrity();


  windows.on_open.listen((info) => {
    session.window_open(info);
    window_open(info);
  });

  windows.on_close.listen((info) => {
    window_close(info);
    // This must be after `window_close`
    session.window_close(info);
  });

  windows.on_focus.listen((info) => {
    window_focus(info);
  });

  tabs.on_open.listen((info) => {
    session.tab_open(info);
    tab_open(info);
  });

  tabs.on_close.listen((info) => {
    tab_close(info);
    // This must be after `tab_close`
    session.tab_close(info);
  });

  tabs.on_focus.listen((info) => {
    tab_focus(info);
  });

  tabs.on_move.listen((info) => {
    session.tab_move(info);
    tab_move(info);
  });

  tabs.on_update.listen((info) => {
    session.tab_update(info);
    tab_update(info);
  });

  tabs.on_replace.listen((info) => {
    session.tab_replace(info);
  });

  /*const window = yield open_window({});

  console.log(window);
  console.log(yield window.get_state());
  console.log(yield window.get_dimensions());

  console.log(yield window.set_state("maximized"));
  console.log(yield delay(1000));
  console.log(yield window.set_state("normal"));
  console.log(yield delay(1000));
  console.log(yield window.set_dimensions({ left: 50, width: 100, height: 50 }));
  console.log(yield delay(1000));
  console.log(yield window.get_dimensions());
  console.log(yield window.set_state("maximized"));
  console.log(yield delay(1000));
  console.log(yield window.get_state());
  console.log(yield window.close());*/
});
