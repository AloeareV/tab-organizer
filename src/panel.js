import "./client/panel/init";
import * as timer from "./util/timer";
import * as async from "./util/async";
import * as console from "./util/console";
import { init as init_ui } from "./client/panel/ui";

window.console.profile("panel");
const duration = timer.make();

async.run_all([init_ui], () => {
  timer.done(duration);
  window.console.profileEnd("panel");
  console.info("panel: initialized (" + timer.diff(duration) + "ms)");
});
