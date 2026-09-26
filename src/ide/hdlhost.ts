
import { setHDLHost } from "../common/hdl/hdlhost";
import { SplitWaveformScope } from "./waveform";

// The verilog platform's UI in the IDE: the waveform split pane and the
// toolbar controls it toggles.
export function installHDLHost() {
  setHDLHost({
    createScope: (video, provider) => new SplitWaveformScope(video, provider),
    showVideoControls(show) {
      $("#speed_bar, #run_bar, #dbg_record").toggle(show);
    },
    showSettleCount(evals) {
      if (evals == null) {
        $("#verilog_bar").hide();
      } else {
        $("#verilog_bar").show();
        $("#settle_label").text(evals + "");
      }
    },
  });
}
