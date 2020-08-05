
import { BASICParser } from "./compiler";

var parser = new BASICParser();
var readline = require('readline');
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});
rl.on('line', function (line) {
    parser.tokenize(line);
    console.log(parser.tokens);
    try {
        var ast = parser.parse();
        console.log(JSON.stringify(ast, null, 4));
    } catch (e) {
        console.log(e);
    }
    if (parser.errors.length) {
        console.log(parser.errors);
        parser.errors = [];
    }
})
