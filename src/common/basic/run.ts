
import { BASICParser, DIALECTS, BASICOptions } from "./compiler";
import { BASICRuntime } from "./runtime";
import { lpad, rpad } from "../util";

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

function getCurrentLabel() {
    var loc = runtime.getCurrentSourceLocation();
    return loc ? loc.label : "?";
}

// parse args
var filename = '/dev/stdin';
var args = process.argv.slice(2);
var force = false;
for (var i=0; i<args.length; i++) {
    if (args[i] == '-v')
        runtime.trace = true;
    else if (args[i] == '-d')
        parser.opts = DIALECTS[args[++i]] || Error('no such dialect');
    else if (args[i] == '-f')
        force = true;
    else if (args[i] == '--dialects')
        dumpDialectInfo();
    else
        filename = args[i];
}

// parse file
var data = fs.readFileSync(filename, 'utf-8');
try {
    var pgm = parser.parseFile(data, filename);
} catch (e) {
    console.log(e);
    if (parser.errors.length == 0)
        console.log(`@@@ ${e}`);
}
parser.errors.forEach((err) => console.log(`@@@ ${err.msg} (line ${err.label})`));
if (parser.errors.length && !force) process.exit(2);

// run program
try {
    runtime.load(pgm);
} catch (e) {
    console.log(`### ${e.message} (line ${getCurrentLabel()})`);
    process.exit(1);
}
runtime.reset();
runtime.print = (s:string) => {
    fs.writeSync(1, s+"");
}
runtime.input = async (prompt:string) => {
    return new Promise( (resolve, reject) => {
        function answered(answer) {
            var line = answer.toUpperCase();
            var vals = line.split(',');
            //console.log(">>>",vals);
            resolve({line:line, vals:vals});
        }
        prompt += ' ?';
        if (inputlines.length) {
            fs.writeSync(1, prompt);
            fs.writeSync(1, '\n');
            answered(inputlines.shift());
        } else rl.question(prompt, (answer) => {
            fs.writeSync(1, '\n');
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
                //console.log("*** PROGRAM EXITED ***");
                process.exit(0);
            }
        } catch (e) {
            console.log(`### ${e.message} (line ${getCurrentLabel()})`);
            process.exit(1);
        }
    });
}
runtime.resume();

/////

function dumpDialectInfo() {
    var dialects = new Set<BASICOptions>();
    var array = {};
    var SELECTED_DIALECTS = ['TINY','ECMA55','DARTMOUTH','HP','DEC','ALTAIR','BASIC80','MODERN'];
    SELECTED_DIALECTS.forEach((dkey) => {
        dialects.add(DIALECTS[dkey]);
    });
    var ALL_KEYWORDS = new Set<string>();
    var ALL_FUNCTIONS = new Set<string>();
    var ALL_OPERATORS = new Set<string>();
    dialects.forEach((dialect) => {
        Object.entries(dialect).forEach(([key, value]) => {
            if (value === null) value = "all";
            else if (value === true) value = "Y";
            else if (value === false) value = "-";
            else if (Array.isArray(value))
                value = value.length;
            if (!array[key]) array[key] = [];
            array[key].push(value);
            if (dialect.validKeywords) dialect.validKeywords.map(ALL_KEYWORDS.add.bind(ALL_KEYWORDS));
            if (dialect.validFunctions) dialect.validFunctions.map(ALL_FUNCTIONS.add.bind(ALL_FUNCTIONS));
            if (dialect.validOperators) dialect.validOperators.map(ALL_OPERATORS.add.bind(ALL_OPERATORS));
        });
    });
    dialects.forEach((dialect) => {
        ALL_KEYWORDS.forEach((keyword) => {
            if (parser.supportsCommand(keyword)) {
                var has = dialect.validKeywords == null || dialect.validKeywords.indexOf(keyword) >= 0;
                keyword = '`'+keyword+'`'
                if (!array[keyword]) array[keyword] = [];
                array[keyword].push(has ? "Y" : "-");
            }
        });
        ALL_OPERATORS.forEach((keyword) => {
            var has = dialect.validOperators == null || dialect.validOperators.indexOf(keyword) >= 0;
            if (keyword == '#') keyword = '*#*';
            keyword = "*a* " + keyword + " *b*";
            if (!array[keyword]) array[keyword] = [];
            array[keyword].push(has ? "Y" : "-");
        });
        ALL_FUNCTIONS.forEach((keyword) => {
            if (runtime.supportsFunction(keyword)) {
                var has = dialect.validFunctions == null || dialect.validFunctions.indexOf(keyword) >= 0;
                keyword = '`'+keyword+'()`'
                if (!array[keyword]) array[keyword] = [];
                array[keyword].push(has ? "Y" : "-");
            }
        });
    });
    Object.entries(array).forEach(([key, arr]) => {
        var s = rpad(key, 30) + "|";
        s += (arr as []).map((val) => rpad(val, 9)).join('|');
        console.log(s);
    });
    process.exit(0);
}

