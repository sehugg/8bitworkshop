"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installHDLHost = installHDLHost;
const hdlhost_1 = require("../common/hdl/hdlhost");
const waveform_1 = require("./waveform");
// The verilog platform's UI in the IDE: the waveform split pane and the
// toolbar controls it toggles.
function installHDLHost() {
    (0, hdlhost_1.setHDLHost)({
        createScope: (video, provider) => new waveform_1.SplitWaveformScope(video, provider),
        showVideoControls(show) {
            $("#speed_bar, #run_bar, #dbg_record").toggle(show);
        },
        showSettleCount(evals) {
            if (evals == null) {
                $("#verilog_bar").hide();
            }
            else {
                $("#verilog_bar").show();
                $("#settle_label").text(evals + "");
            }
        },
    });
}
//# sourceMappingURL=hdlhost.js.map