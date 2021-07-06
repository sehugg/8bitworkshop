
import { arrayCompare } from "../util";
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
//console.log(parser);
var modname = 'TOP'; //process.argv[3];

async function testWASM() {
    var bmod = new HDLModuleWASM(parser.modules[modname], parser.modules['@CONST-POOL@']);
    await bmod.init();
    bmod.powercycle();
    //console.log(this.globals);
    bmod.state.reset = 1;
    for (var i=0; i<10; i++) {
        bmod.tick2(1);
        if (i==5) bmod.state.reset = 0;
        bmod.nextTrace();
    }
    console.log(bmod.databuf);
    var t1 = new Date().getTime();
    var tickiters = 10000;
    var looplen = Math.round(100000000/tickiters);
    for (var i=0; i<looplen; i++) {
        bmod.tick2(tickiters);
    }
    var t2 = new Date().getTime();
    console.log('wasm:',t2-t1,'msec',i*tickiters,'iterations');
    console.log(bmod.databuf);
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

async function testJSvsWASM() {
    const top = parser.modules[modname];
    const constpool = parser.modules['@CONST-POOL@'];
    var jmod = new HDLModuleJS(top, constpool);
    jmod.init();
    jmod.powercycle();
    var bmod = new HDLModuleWASM(top, constpool);
    await bmod.init();
    bmod.powercycle();
    var varnames = Object.keys(top.vardefs);
    var exit = false;
    for (var i=0; i<100000000; i++) {
        for (var vname of varnames) {
            var jvalue = jmod.state[vname];
            var bvalue = bmod.state[vname];
            if (typeof jvalue === 'number') {
                if (jvalue != bvalue) {
                    console.log('*** Value for', vname, 'differs', jvalue, bvalue);
                    exit = true;
                }
            } else if ((jvalue as any).buffer != null) {
                if (!arrayCompare(jvalue as any, bvalue as any)) {
                    console.log('*** Value for', vname, 'differs', jvalue, bvalue);
                    exit = true;
                }
            }
        }
        if (jmod.isFinished() || bmod.isFinished()) {
            if (jmod.isFinished() != bmod.isFinished()) {
                console.log('*** Abnormal finish', jmod.isFinished(), bmod.isFinished());
            }
            exit = true;
        }
        if (jmod.isStopped() || bmod.isStopped()) {
            if (jmod.isStopped() != bmod.isStopped()) {
                console.log('*** Abnormal stop', jmod.isStopped(), bmod.isStopped());
            }
            exit = true;
        }
        if (exit) {
            console.log('exit iteration', i);
            break;
        }
        jmod.tick2(1);
        bmod.tick2(1);
    }
}

//testJS();
testWASM();
//testJSvsWASM();
//testWASM().then(testJS).then(testJSvsWASM);

