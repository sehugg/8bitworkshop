
import { BASICParser, DIALECTS } from "./compiler";
import { BASICRuntime } from "./runtime";

var readline = require('readline');
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
    crlfDelay: Infinity,
});
var inputlines = [];
rl.on('line', (line) => {
    //console.log(`Line from file: ${line}`);
    inputlines.push(line);
});

var fs = require('fs');

var parser = new BASICParser();
var runtime = new BASICRuntime();

// parse args
var filename = '/dev/stdin';
var args = process.argv.slice(2);
for (var i=0; i<args.length; i++) {
    if (args[i] == '-v')
        runtime.trace = true;
    else if (args[i] == '-d')
        parser.opts = DIALECTS[args[++i]] || Error('no such dialect');
    else
        filename = args[i];
}

// parse file
var data = fs.readFileSync(filename, 'utf-8');
try {
    var pgm = parser.parseFile(data, filename);
} catch (e) {
    if (parser.errors.length == 0)
        console.log("@@@ " + e.msg);
    else
        console.log(e);
}
parser.errors.forEach((err) => console.log("@@@ " + err.msg));
if (parser.errors.length) process.exit(2);

// run program
runtime.load(pgm);
runtime.reset();
runtime.print = (s:string) => {
    fs.writeSync(1, s+"");
}
runtime.input = async (prompt:string) => {
    return new Promise( (resolve, reject) => {
        function answered(answer) {
            var vals = answer.toUpperCase().split(',');
            console.log(">>>",vals);
            resolve(vals);
        }
        fs.writeSync(1, prompt+"?");
        if (inputlines.length) {
            answered(inputlines.shift());
        } else rl.question(prompt, (answer) => {
            answered(answer);
        });
    });
}
runtime.resume = function() {
    process.nextTick(() => {
        try {
            if (runtime.step()) {
                if (runtime.running) runtime.resume();
            } else if (runtime.exited) {
                console.log("*** PROGRAM EXITED ***");
                process.exit(0);
            }
        } catch (e) {
            console.log(`### ${e.message} (line ${runtime.getCurrentSourceLocation().label})`);
            process.exit(1);
        }
    });
}
runtime.resume();
