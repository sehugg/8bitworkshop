"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fuzz = void 0;
//import binaryen = require('binaryen');
//import { fn } from "jquery";
const hdlruntime_1 = require("./hdlruntime");
const hdlwasm_1 = require("./hdlwasm");
const vxmlparser_1 = require("./vxmlparser");
function fuzz(buf) {
    var parser = new vxmlparser_1.VerilogXMLParser();
    var str = buf.toString();
    try {
        parser.parse(str);
    }
    catch (e) {
        if (e instanceof vxmlparser_1.CompileError)
            return;
        throw e;
    }
    if (1) {
        var wmod = new hdlwasm_1.HDLModuleWASM(parser.modules['TOP'], parser.modules['@CONST-POOL@']);
        wmod.traceBufferSize = 0x8000;
        wmod.maxMemoryMB = 0.25;
        wmod.initSync();
        wmod.powercycle();
        wmod.tick2(10000);
    }
    if (0) {
        var jmod = new hdlruntime_1.HDLModuleJS(parser.modules['TOP'], parser.modules['@CONST-POOL@']);
        jmod.init();
        try {
            jmod.powercycle();
            jmod.tick2(10000);
        }
        catch (e) {
            if (e instanceof hdlruntime_1.HDLError)
                return;
            const fs = require('fs');
            fs.writeFileSync('hdlfuzz-output.js', jmod.getJSCode());
            throw e;
        }
        finally {
            jmod.dispose();
        }
    }
}
exports.fuzz = fuzz;
//# sourceMappingURL=fuzz.js.map