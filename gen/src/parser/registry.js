"use strict";
// Parser registry - central place to map editorStyle -> parser for both editor and extractor.
// This keeps editors.ts and the indexer in sync.
Object.defineProperty(exports, "__esModule", { value: true });
exports.parserRegistry = void 0;
exports.getParserForStyle = getParserForStyle;
exports.getLanguageSupportForStyle = getLanguageSupportForStyle;
const lang_cpp_1 = require("@codemirror/lang-cpp");
const lang_6502_1 = require("./lang-6502");
const lang_z80_1 = require("./lang-z80");
const lang_wiz_1 = require("./lang-wiz");
const lang_verilog_1 = require("./lang-verilog");
const lang_inform6_1 = require("./lang-inform6");
const lang_dialog_1 = require("./lang-dialog");
const lang_basic_1 = require("./lang-basic");
const lang_fastbasic_1 = require("./lang-fastbasic");
const lang_bataribasic_1 = require("./lang-bataribasic");
const lang_markdown_1 = require("@codemirror/lang-markdown");
exports.parserRegistry = {
    'text/x-csrc': {
        language: (0, lang_cpp_1.cpp)(),
        parser: null // Lezer-based, extracted via lrextract.ts
    },
    '6502': {
        language: (0, lang_6502_1.asm6502)(),
        parser: null // Lezer-based, extracted via lrextract.ts
    },
    z80: {
        language: (0, lang_z80_1.asmZ80)(),
        parser: null // Lezer-based, extracted via lrextract.ts
    },
    'text/x-wiz': {
        language: (0, lang_wiz_1.wiz)(),
        parser: lang_wiz_1.wizStreamParser
    },
    verilog: {
        language: (0, lang_verilog_1.verilog)(),
        parser: lang_verilog_1.verilogStreamParser
    },
    inform6: {
        language: (0, lang_inform6_1.inform6)(),
        parser: lang_inform6_1.inform6StreamParser
    },
    dialog: {
        language: (0, lang_dialog_1.dialog)(),
        parser: lang_dialog_1.dialogStreamParser
    },
    basic: {
        language: (0, lang_basic_1.basic)(),
        parser: lang_basic_1.basicStreamParser
    },
    fastbasic: {
        language: (0, lang_fastbasic_1.fastBasic)(),
        parser: lang_fastbasic_1.fastBasicStreamParser
    },
    bataribasic: {
        language: (0, lang_bataribasic_1.batariBasic)(),
        parser: lang_bataribasic_1.batariBasicStreamParser
    },
    markdown: {
        language: (0, lang_markdown_1.markdown)(),
        parser: null
    },
    // Tier C - no parser available
    '6809': {
        language: null,
        parser: null
    },
    vasm: {
        language: null,
        parser: null
    },
    gas: {
        language: null,
        parser: null
    },
    ecs: {
        language: null,
        parser: null
    }
};
function getParserForStyle(editorStyle) {
    var _a;
    const entry = exports.parserRegistry[editorStyle];
    return (_a = entry === null || entry === void 0 ? void 0 : entry.parser) !== null && _a !== void 0 ? _a : null;
}
function getLanguageSupportForStyle(editorStyle) {
    var _a;
    const entry = exports.parserRegistry[editorStyle];
    return (_a = entry === null || entry === void 0 ? void 0 : entry.language) !== null && _a !== void 0 ? _a : null;
}
//# sourceMappingURL=registry.js.map