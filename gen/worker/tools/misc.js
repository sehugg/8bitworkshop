"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileWiz = exports.compileBASIC = exports.compileInform6 = exports.translateShowdown = void 0;
const workermain_1 = require("../workermain");
const basic_compiler = __importStar(require("../../common/basic/compiler"));
const util_1 = require("../../common/util");
function translateShowdown(step) {
    (0, workermain_1.setupRequireFunction)();
    (0, workermain_1.load)("showdown.min");
    var showdown = workermain_1.emglobal['showdown'];
    var converter = new showdown.Converter({
        tables: 'true',
        smoothLivePreview: 'true',
        requireSpaceBeforeHeadingText: 'true',
        emoji: 'true',
    });
    var code = (0, workermain_1.getWorkFileAsString)(step.path);
    var html = converter.makeHtml(code);
    delete workermain_1.emglobal['require'];
    return {
        output: html
    };
}
exports.translateShowdown = translateShowdown;
function compileInform6(step) {
    (0, workermain_1.loadNative)("inform");
    var errors = [];
    (0, workermain_1.gatherFiles)(step, { mainFilePath: "main.inf" });
    var objpath = step.prefix + ".z5";
    if ((0, workermain_1.staleFiles)(step, [objpath])) {
        var errorMatcher = (0, workermain_1.msvcErrorMatcher)(errors);
        var lstout = "";
        var match_fn = (s) => {
            if (s.indexOf("Error:") >= 0) {
                errorMatcher(s);
            }
            else {
                lstout += s;
                lstout += "\n";
            }
        };
        // TODO: step.path must end in '.inf' or error
        var args = ['-afjnops', '-v5', '-Cu', '-E1', '-k', '+/share/lib', step.path];
        var inform = workermain_1.emglobal.inform({
            instantiateWasm: (0, workermain_1.moduleInstFn)('inform'),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_fn,
            printErr: match_fn,
        });
        var FS = inform.FS;
        (0, workermain_1.setupFS)(FS, 'inform');
        (0, workermain_1.populateFiles)(step, FS);
        //fixParamsWithDefines(step.path, step.params);
        (0, workermain_1.execMain)(step, inform, args);
        if (errors.length)
            return { errors: errors };
        var objout = FS.readFile(objpath, { encoding: 'binary' });
        (0, workermain_1.putWorkFile)(objpath, objout);
        if (!(0, workermain_1.anyTargetChanged)(step, [objpath]))
            return;
        // parse debug XML
        var symbolmap = {};
        var segments = [];
        var entitymap = {
            // number -> string
            'object': {}, 'property': {}, 'attribute': {}, 'constant': {}, 'global-variable': {}, 'routine': {},
        };
        var dbgout = FS.readFile("gameinfo.dbg", { encoding: 'utf8' });
        var xmlroot = (0, util_1.parseXMLPoorly)(dbgout);
        //console.log(xmlroot);
        var segtype = "ram";
        xmlroot.children.forEach((node) => {
            switch (node.type) {
                case 'global-variable':
                case 'routine':
                    var ident = node.children.find((c, v) => c.type == 'identifier').text;
                    var address = parseInt(node.children.find((c, v) => c.type == 'address').text);
                    symbolmap[ident] = address;
                    entitymap[node.type][address] = ident;
                    break;
                case 'object':
                case 'property':
                case 'attribute':
                    var ident = node.children.find((c, v) => c.type == 'identifier').text;
                    var value = parseInt(node.children.find((c, v) => c.type == 'value').text);
                    //entitymap[node.type][ident] = value;
                    entitymap[node.type][value] = ident;
                    //symbolmap[ident] = address | 0x1000000;
                    break;
                case 'story-file-section':
                    var name = node.children.find((c, v) => c.type == 'type').text;
                    var address = parseInt(node.children.find((c, v) => c.type == 'address').text);
                    var endAddress = parseInt(node.children.find((c, v) => c.type == 'end-address').text);
                    if (name == "grammar table")
                        segtype = "rom";
                    segments.push({ name: name, start: address, size: endAddress - address, type: segtype });
            }
        });
        // parse listing
        var listings = {};
        //    35  +00015 <*> call_vs      long_19 location long_424 -> sp 
        var lines = (0, workermain_1.parseListing)(lstout, /\s*(\d+)\s+[+]([0-9a-f]+)\s+([<*>]*)\s*(\w+)\s+(.+)/i, -1, 2, 4);
        var lstpath = step.prefix + '.lst';
        listings[lstpath] = { lines: [], asmlines: lines, text: lstout };
        return {
            output: objout,
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments,
            debuginfo: entitymap,
        };
    }
}
exports.compileInform6 = compileInform6;
function compileBASIC(step) {
    var jsonpath = step.path + ".json";
    (0, workermain_1.gatherFiles)(step);
    if ((0, workermain_1.staleFiles)(step, [jsonpath])) {
        var parser = new basic_compiler.BASICParser();
        var code = (0, workermain_1.getWorkFileAsString)(step.path);
        try {
            var ast = parser.parseFile(code, step.path);
        }
        catch (e) {
            console.log(e);
            if (parser.errors.length == 0)
                throw e;
        }
        if (parser.errors.length) {
            return { errors: parser.errors };
        }
        // put AST into JSON (sans source locations) to see if it has changed
        var json = JSON.stringify(ast, (key, value) => { return (key == '$loc' ? undefined : value); });
        (0, workermain_1.putWorkFile)(jsonpath, json);
        if ((0, workermain_1.anyTargetChanged)(step, [jsonpath]))
            return {
                output: ast,
                listings: parser.getListings(),
            };
    }
}
exports.compileBASIC = compileBASIC;
function compileWiz(step) {
    (0, workermain_1.loadNative)("wiz");
    var params = step.params;
    (0, workermain_1.gatherFiles)(step, { mainFilePath: "main.wiz" });
    var destpath = step.prefix + (params.wiz_rom_ext || ".bin");
    var errors = [];
    if ((0, workermain_1.staleFiles)(step, [destpath])) {
        var wiz = workermain_1.emglobal.wiz({
            instantiateWasm: (0, workermain_1.moduleInstFn)('wiz'),
            noInitialRun: true,
            print: workermain_1.print_fn,
            //test.wiz:2: error: expected statement, but got identifier `test`
            printErr: (0, workermain_1.makeErrorMatcher)(errors, /(.+?):(\d+):\s*(.+)/, 2, 3, step.path, 1),
        });
        var FS = wiz.FS;
        (0, workermain_1.setupFS)(FS, 'wiz');
        (0, workermain_1.populateFiles)(step, FS);
        (0, workermain_1.populateExtraFiles)(step, FS, params.extra_compile_files);
        const FWDIR = '/share/common';
        var args = [
            '-o', destpath,
            '-I', FWDIR + '/' + (params.wiz_inc_dir || step.platform),
            '-s', 'wla',
            '--color=none',
            step.path
        ];
        args.push('--system', params.wiz_sys_type || params.arch);
        (0, workermain_1.execMain)(step, wiz, args);
        if (errors.length)
            return { errors: errors };
        var binout = FS.readFile(destpath, { encoding: 'binary' });
        (0, workermain_1.putWorkFile)(destpath, binout);
        var dbgout = FS.readFile(step.prefix + '.sym', { encoding: 'utf8' });
        var symbolmap = {};
        for (var s of dbgout.split("\n")) {
            var toks = s.split(/ /);
            // 00:4008 header.basic_start
            if (toks && toks.length >= 2) {
                var tokrange = toks[0].split(':');
                var start = parseInt(tokrange[1], 16);
                var sym = toks[1];
                symbolmap[sym] = start;
            }
        }
        return {
            output: binout,
            errors: errors,
            symbolmap: symbolmap,
        };
    }
}
exports.compileWiz = compileWiz;
//# sourceMappingURL=misc.js.map