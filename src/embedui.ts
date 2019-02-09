
window['Javatari'].AUTO_START = false;

import { PLATFORMS } from "./emu";
import { Platform } from "./baseplatform";
import { stringToByteArray } from "./util";

export var platform_id : string;	// platform ID string
export var platform : Platform;	// platform object

// external libs (TODO)
declare var ga, lzgmini;

var _qs = (function (a) {
    if (!a || a.length == 0)
        return {};
    var b = {};
    for (var i = 0; i < a.length; ++i) {
        var p = a[i].split('=', 2);
        if (p.length == 1)
            b[p[0]] = "";
        else
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return b;
})(window.location.search.substr(1).split('&'));

// catch errors
function installErrorHandler() {
  if (typeof window.onerror == "object") {
      window.onerror = function (msgevent, url, line, col, error) {
        ga('send', 'exception', {
          'exDescription': msgevent + " " + url + " " + " " + line + ":" + col + ", " + error,
          'exFatal': true
        });
        //alert(msgevent+"");
      };
  }
}

function uninstallErrorHandler() {
  window.onerror = null;
}

function addPageFocusHandlers() {
  var hidden = false;
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState == 'hidden' && platform.isRunning()) {
      platform.pause();
      hidden = true;
    } else if (document.visibilityState == 'visible' && hidden) {
      platform.resume();
      hidden = false;
    }
  });
  $(window).on("focus", function() {
    if (hidden) {
      platform.resume();
      hidden = false;
    }
  });
  $(window).on("blur", function() {
    if (platform.isRunning()) {
      platform.pause();
      hidden = true;
    }
  });
}

function startPlatform(qs) {
  if (!PLATFORMS[platform_id]) throw Error("Invalid platform '" + platform_id + "'.");
  platform = new PLATFORMS[platform_id]($("#emulator")[0]);
  platform.start();
  var title = qs['n'] || 'Game';
  var lzgvar = qs['r'];
  var lzgrom = stringToByteArray(atob(lzgvar));
  var rom = new lzgmini().decode(lzgrom);
  console.log(rom.length + ' bytes');
  platform.loadROM(title, rom);
  platform.resume();
  return true;
}

function loadPlatform(qs) {
  if (qs.data) qs = qs.data;
  platform_id = qs['p'];
  if (!platform_id) throw('No platform variable!');
  var scriptfn = 'gen/platform/' + platform_id.split(/[.-]/)[0] + '.js';
  loadScript(scriptfn, () => {
    console.log("loaded platform", platform_id);
    startPlatform(qs);
  });
}

function loadScript(scriptfn, onload) {
  var script = document.createElement('script');
  script.onload = onload;
  script.src = scriptfn;
  document.getElementsByTagName('head')[0].appendChild(script);
}

// start
export function startEmbed() {
  installErrorHandler();
  window.addEventListener("message", loadPlatform, false);
  if (_qs['p']) loadPlatform(_qs);
}

