
//import binaryen = require('binaryen');
//import { fn } from "jquery";
import { HDLError, HDLModuleJS } from "./hdlruntime";
import { HDLModuleWASM } from "./hdlwasm";
import { CompileError, VerilogXMLParser } from "./vxmlparser";

export function fuzz(buf) {
    var parser = new VerilogXMLParser();
    var str = buf.toString();
    try {
        parser.parse(str);
    } catch (e) {
        if (e instanceof CompileError) return;
        throw e;
    }
    if (1) {
        var wmod = new HDLModuleWASM(parser.modules['TOP'], parser.modules['@CONST-POOL@']);
        wmod.traceBufferSize = 0x8000;
        wmod.maxMemoryMB = 0.25;
        wmod.initSync();
        wmod.powercycle();
        wmod.tick2(10000);
    }
    if (0) {
        var jmod = new HDLModuleJS(parser.modules['TOP'], parser.modules['@CONST-POOL@']);
        jmod.init();
        try {
            jmod.powercycle();
            jmod.tick2(10000);
        } catch (e) {
            if (e instanceof HDLError) return;
            const fs = require('fs');
            fs.writeFileSync('hdlfuzz-output.js', jmod.getJSCode());
            throw e;
        } finally {
            jmod.dispose();
        }
    }
}
