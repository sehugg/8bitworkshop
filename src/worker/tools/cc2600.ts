import { BuildStep, BuildStepResult } from "../builder";
import { compileCC6502 } from "./cc6502";

export function compilecc2600(step: BuildStep): Promise<BuildStepResult> {
    return compileCC6502(step, { tool: "cc2600", fsZip: "cc2600-fs.zip" });
}
