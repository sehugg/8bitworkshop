
// Widgets embedded directly in a platform's UI (not a ProjectWindows tab,
// e.g. the Verilog waveform viewer alongside the emulator screen) register
// their container + topic id here so F1 can find them while focused.
// This stays out of views/helpview.ts, which imports every help page.
let elementHelpTopics: { div: HTMLElement; id: string }[] = [];

export function registerElementHelpTopic(div: HTMLElement, id: string) {
  elementHelpTopics.push({ div, id });
}

export function unregisterElementHelpTopic(div: HTMLElement) {
  elementHelpTopics = elementHelpTopics.filter((eh) => eh.div !== div);
}

// topic id for the currently focused element-scoped widget, if any
export function elementHelpTopicForFocus(): string | null {
  const ae = document.activeElement;
  if (!ae) return null;
  for (const eh of elementHelpTopics) {
    if (eh.div.contains(ae)) return eh.id;
  }
  return null;
}
