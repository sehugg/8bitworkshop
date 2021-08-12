import { Segment, CodeListingMap, WorkerResult, WorkerError } from "../../common/workertypes";
import { BuildStep, BuildStepResult, setupRequireFunction, load, emglobal, getWorkFileAsString, loadNative, gatherFiles, staleFiles, msvcErrorMatcher, moduleInstFn, setupFS, populateFiles, execMain, putWorkFile, anyTargetChanged, parseListing, print_fn, makeErrorMatcher, populateExtraFiles } from "../workermain";
import { EmscriptenModule } from "../workermain"
import * as basic_compiler from '../../common/basic/compiler';
import { parseXMLPoorly } from "../../common/util";

export function translateShowdown(step: BuildStep): BuildStepResult {
    setupRequireFunction();
    load("showdown.min");
    var showdown = emglobal['showdown'];
    var converter = new showdown.Converter({
        tables: 'true',
        smoothLivePreview: 'true',
        requireSpaceBeforeHeadingText: 'true',
        emoji: 'true',
    });
    var code = getWorkFileAsString(step.path);
    var html = converter.makeHtml(code);
    delete emglobal['require'];
    return {
        output: html
    };
}

export function compileInform6(step: BuildStep): BuildStepResult {
    loadNative("inform");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.inf" });
    var objpath = step.prefix + ".z5";
    if (staleFiles(step, [objpath])) {
        var errorMatcher = msvcErrorMatcher(errors);
        var lstout = "";
        var match_fn = (s: string) => {
            if (s.indexOf("Error:") >= 0) {
                errorMatcher(s);
            } else {
                lstout += s;
                lstout += "\n";
            }
        }
        // TODO: step.path must end in '.inf' or error
        var args = ['-afjnops', '-v5', '-Cu', '-E1', '-k', '+/share/lib', step.path];
        var inform: EmscriptenModule = emglobal.inform({
            instantiateWasm: moduleInstFn('inform'),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_fn,
            printErr: match_fn,
        });
        var FS = inform.FS;
        setupFS(FS, 'inform');
        populateFiles(step, FS);
        //fixParamsWithDefines(step.path, step.params);
        execMain(step, inform, args);
        if (errors.length)
            return { errors: errors };
        var objout = FS.readFile(objpath, { encoding: 'binary' });
        putWorkFile(objpath, objout);
        if (!anyTargetChanged(step, [objpath]))
            return;

        // parse debug XML
        var symbolmap = {};
        var segments: Segment[] = [];
        var entitymap = {
            // number -> string
            'object': {}, 'property': {}, 'attribute': {}, 'constant': {}, 'global-variable': {}, 'routine': {},
        };
        var dbgout = FS.readFile("gameinfo.dbg", { encoding: 'utf8' });
        var xmlroot = parseXMLPoorly(dbgout);
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
                    if (name == "grammar table") segtype = "rom";
                    segments.push({ name: name, start: address, size: endAddress - address, type: segtype });
            }
        });
        // parse listing
        var listings: CodeListingMap = {};
        //    35  +00015 <*> call_vs      long_19 location long_424 -> sp 
        var lines = parseListing(lstout, /\s*(\d+)\s+[+]([0-9a-f]+)\s+([<*>]*)\s*(\w+)\s+(.+)/i, -1, 2, 4);
        var lstpath = step.prefix + '.lst';
        listings[lstpath] = { lines: [], asmlines: lines, text: lstout };
        return {
            output: objout, //.slice(0),
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments,
            debuginfo: entitymap,
        };
    }
}

export function compileBASIC(step: BuildStep): WorkerResult {
    var jsonpath = step.path + ".json";
    gatherFiles(step);
    if (staleFiles(step, [jsonpath])) {
        var parser = new basic_compiler.BASICParser();
        var code = getWorkFileAsString(step.path);
        try {
            var ast = parser.parseFile(code, step.path);
        } catch (e) {
            console.log(e);
            if (parser.errors.length == 0) throw e;
        }
        if (parser.errors.length) {
            return { errors: parser.errors };
        }
        // put AST into JSON (sans source locations) to see if it has changed
        var json = JSON.stringify(ast, (key, value) => { return (key == '$loc' ? undefined : value) });
        putWorkFile(jsonpath, json);
        if (anyTargetChanged(step, [jsonpath])) return {
            output: ast,
            listings: parser.getListings(),
        };
    }
}

export function compileWiz(step: BuildStep): WorkerResult {
    loadNative("wiz");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.wiz" });
    var destpath = step.prefix + (params.wiz_rom_ext || ".bin");
    var errors: WorkerError[] = [];
    if (staleFiles(step, [destpath])) {
        var wiz: EmscriptenModule = emglobal.wiz({
            instantiateWasm: moduleInstFn('wiz'),
            noInitialRun: true,
            print: print_fn,
            //test.wiz:2: error: expected statement, but got identifier `test`
            printErr: makeErrorMatcher(errors, /(.+?):(\d+):\s*(.+)/, 2, 3, step.path, 1),
        });
        var FS = wiz.FS;
        setupFS(FS, 'wiz');
        populateFiles(step, FS);
        populateExtraFiles(step, FS, params.extra_compile_files);
        const FWDIR = '/share/common';
        var args = [
            '-o', destpath,
            '-I', FWDIR + '/' + (params.wiz_inc_dir || step.platform),
            '-s', 'wla',
            '--color=none',
            step.path];
        args.push('--system', params.wiz_sys_type || params.arch);
        execMain(step, wiz, args);
        if (errors.length)
            return { errors: errors };
        var binout = FS.readFile(destpath, { encoding: 'binary' });
        putWorkFile(destpath, binout);
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
            output: binout, //.slice(0),
            errors: errors,
            symbolmap: symbolmap,
        };
    }
}

