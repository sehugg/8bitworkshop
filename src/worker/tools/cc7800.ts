import { BuildStep, BuildStepResult } from "../builder";
import { compileCC6502 } from "./cc6502";

export function compileCC7800(step: BuildStep): Promise<BuildStepResult> {
    return compileCC6502(step, { tool: "cc7800", fsZip: "cc7800-fs.zip" });
}
