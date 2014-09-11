@ = require([
  { id: "sjs:object" },
  { id: "sjs:sequence" },
  { id: "lib:util/event" },
  { id: "lib:util/util" },
  { id: "lib:util/observe" },
  { id: "lib:extension/main" },
])


// TODO this is hacky
var init = []


function make(db_name, port_name, defs) {
  var opts = {}
  var vars = {}

  function get(key) {
    return vars ..@get(key)
  }

  // TODO this is hacky
  init.push(function () {
    var db_opt = @db.get(db_name, {})

    function makeVar(key, value) {
      // ObservableVar only emits changes when the current value is different from the new value
      // TODO I should probably use my own custom version of ObservableVars, to get the exact behavior I want
      vars ..@setNew(key, @Observer(value))

      opts ..@setNew(key, value)

      get(key) ..@listen(function (value) {
        opts ..@setUnique(key, value)

        if (value === defs ..@get(key)) {
          db_opt ..@delete(key)
        } else {
          // TODO library function for this, but can't use util/set because the key may or may not exist
          db_opt[key] = value
        }

        @db.set(db_name, db_opt)

        @connection.send(port_name, {
          type: "set",
          key: key,
          value: value
        })
      })
    }

    db_opt ..@eachKeys(function (key, value) {
      makeVar(key, value)
    })

    defs ..@eachKeys(function (key, value) {
      // TODO object/has
      if (!(key in vars)) {
        makeVar(key, value)
      }
    })

    @connection.on.connect(port_name) ..@listen(function (connection) {
      connection.send({
        options: opts,
        defaults: defs
      })
    })

    @connection.on.message(port_name) ..@listen(function (message) {
      if (message.type === "set") {
        var key   = message ..@get("key")
        var value = message ..@get("value")
        get(key).set(value)

      } else if (message.type === "reset") {
        defs ..@eachKeys(function (key, value) {
          get(key).set(value)
        })

      } else {
        @assert.fail()
      }
    })
  })

  return get
}


exports.opt = make("options.user", "options", {
  "counter.enabled"           : true,
  "counter.type"              : "in-chrome",

  "size.sidebar"              : 300,
  "size.sidebar.position"     : "left",

  "size.popup.left"           : 0.5,
  "size.popup.top"            : 0.5,
  "size.popup.width"          : 920,
  "size.popup.height"         : 496,

  "size.bubble.width"         : 300,
  "size.bubble.height"        : 600,

  "popup.type"                : "bubble",

  "popup.hotkey.ctrl"         : true,
  "popup.hotkey.shift"        : true,
  "popup.hotkey.alt"          : false,
  "popup.hotkey.letter"       : "E",

  "popup.close.escape"        : false,
  "popup.switch.action"       : "minimize",
  "popup.close.when"          : "switch-tab", // "manual",

  "group.sort.type"           : "group",
  "groups.layout"             : "vertical",
  "groups.layout.grid.column" : 3,
  "groups.layout.grid.row"    : 2,

  "tabs.close.location"       : "right",
  "tabs.close.display"        : "hover",
  "tabs.close.duplicates"     : false,
  "tabs.click.type"           : "focus",

  "theme.animation"           : true,
  "theme.color"               : "blue",

  "usage-tracking"            : true
})


exports.cache = make("options.cache", "cache", {
  "popup.scroll"             : 0,
  "search.last"              : "",

  "counter.session"          : null,

  "screen.available.checked" : false,
  "screen.available.left"    : 0,
  "screen.available.top"     : 0,
  "screen.available.width"   : screen ..@get("width"), // TODO ew
  "screen.available.height"  : screen ..@get("height") // TODO ew
})


// This is needed so that migration can finish before loading up the options/cache
exports.init = function () {
  // TODO this is hacky
  init ..@each(function (f) {
    f()
  })

  console.info("options: finished")
}