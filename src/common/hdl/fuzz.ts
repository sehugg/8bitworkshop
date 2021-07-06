
//import binaryen = require('binaryen');
import { HDLModuleJS } from "./hdlruntime";
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
    /*
    if (0) {
        var wmod = new HDLModuleWASM(parser.modules['TOP'], parser.modules['@CONST-POOL@']);
        wmod.traceBufferSize = 0x8000;
        wmod.maxMemoryMB = 0.25;
        wmod.init().then(() => {
            wmod.powercycle();
            wmod.tick2(10000);
            wmod.dispose();
        })
    }
    */
    if (1) {
        var jmod = new HDLModuleJS(parser.modules['TOP'], parser.modules['@CONST-POOL@']);
        jmod.init();
        jmod.powercycle();
        jmod.tick2(10000);
        jmod.dispose();
    }
}
