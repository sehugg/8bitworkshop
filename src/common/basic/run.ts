
import { BASICParser, ECMA55_MINIMAL } from "./compiler";
import { BASICRuntime } from "./runtime";

var readline = require('readline');
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    //terminal: false
});

var parser = new BASICParser();
parser.opts = ECMA55_MINIMAL;
var fs = require('fs');
var filename = process.argv[2];
var data = fs.readFileSync(filename, 'utf-8');
try {
    var pgm = parser.parseFile(data, filename);
} catch (e) {
    console.log("@@@ " + e.message);
    throw e;
}

var runtime = new BASICRuntime();
runtime.trace = process.argv[3] == '-v';
runtime.load(pgm);
runtime.reset();
runtime.print = (s:string) => {
    fs.writeSync(1, s+"");
}
runtime.input = async (prompt:string) => {
    return new Promise( (resolve, reject) => {
        fs.writeSync(1, "\n");
        rl.question(prompt, (answer) => {
            var vals = answer.toUpperCase().split(',');
            resolve(vals);
        });
    });
}
runtime.resume = function() {
    process.nextTick(() => {
        try {
            if (runtime.step()) {
                if (runtime.running) runtime.resume();
            } else if (runtime.exited) {
                rl.close();
            }
        } catch (e) {
            console.log("### " + e.message);
            throw e;
        }
    });
}
runtime.resume();
