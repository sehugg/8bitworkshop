
import { HDLModuleJS } from "./hdlruntime";
import { HDLModuleWASM } from "./hdlwasm";
import { VerilogXMLParser } from "./vxmlparser";

var fs = require('fs');

var xmltxt = fs.readFileSync(process.argv[2], 'utf8');
var parser = new VerilogXMLParser();
try {
    parser.parse(xmltxt);
} catch (e) {
    console.log(parser.cur_node);
    throw e;
}
console.log(parser);
var modname = 'TOP'; //process.argv[3];

async function testWASM() {
    var bmod = new HDLModuleWASM(parser.modules[modname], parser.modules['@CONST-POOL@']);
    await bmod.init();
    bmod.powercycle();
    bmod.test();
}

async function testJS() {
    var mod = new HDLModuleJS(parser.modules[modname], parser.modules['@CONST-POOL@']);
    mod.init();
    console.log(mod.getJSCode());
    mod.powercycle();
    var t1 = new Date().getTime();
    for (var i=0; i<100000000; i++) {
        mod.tick2(1);
    }
    mod.state.reset = 1;
    for (var j=0; j<10000000; j++) {
        mod.tick2(1);
    }
    var t2 = new Date().getTime();
    console.log(mod.state);
    console.log('js:',t2-t1, 'msec', i, 'iterations', i/1000/(t2-t1), 'MHz')
    //console.log(emitter);
}

testWASM().then(testJS);

