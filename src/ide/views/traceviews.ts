import { StateRecorderImpl } from "../../common/recorder";
import { ProjectView } from "./baseviews";

export class TracePlaybackView implements ProjectView {
    maindiv : HTMLElement;
    recreateOnResize = true;
    totalRows = 0x1400;
    stateRecorder : StateRecorderImpl;
  
    createDiv(parent : HTMLElement) {
      var div = document.createElement('div');
      div.setAttribute("class", "memdump");
      parent.appendChild(div);
      return this.maindiv = div;
    }
    tick() {      
    }
    refresh() {
    }
}
