// TextMate grammar and language configuration for Verilog (.v files):
// IEEE 1364-2005 keywords, compiler directives, system tasks and sized
// literals. No SystemVerilog. The language has no `extensions`; the
// extension assigns it per project (see projectinfo.ts verilogLanguageFor).
// No vscode import; scripts/syntaxes.ts writes the files.

export const VERILOG_LANGUAGE = {
  id: '8bws-verilog',
  aliases: ['Verilog (8bitworkshop)'],
  scopeName: 'source.verilog.8bws',
};

const KEYWORDS = `always and assign automatic begin buf bufif0 bufif1 case casex casez cell cmos config deassign default
  defparam design disable edge else end endcase endconfig endfunction endgenerate endmodule endprimitive endspecify
  endtable endtask event for force forever fork function generate genvar highz0 highz1 if ifnone incdir include initial
  instance join large liblist library localparam macromodule medium module nand negedge nmos nor noshowcancelled not
  notif0 notif1 or parameter pmos posedge primitive pull0 pull1 pulldown pullup pulsestyle_onevent pulsestyle_ondetect
  rcmos release repeat rnmos rpmos rtran rtranif0 rtranif1 scalared showcancelled small specify specparam strong0
  strong1 supply0 supply1 table task tran tranif0 tranif1 tri tri0 tri1 triand trior trireg use vectored wait wand
  weak0 weak1 while wire wor xnor xor`.split(/\s+/);

const TYPES = `input output inout reg wire integer real realtime time signed unsigned supply0 supply1 tri tri0 tri1
  triand trior trireg wand wor`.split(/\s+/);

const DIRECTIVES = `celldefine default_nettype define else elsif endcelldefine endif ifdef ifndef include line
  nounconnected_drive resetall timescale unconnected_drive undef`.split(/\s+/);

const alt = (w: string[]) => [...new Set(w)].sort((a, b) => b.length - a.length || a.localeCompare(b)).join('|');
const ID = `[A-Za-z_][\\w$]*`;

export function makeVerilogGrammar(): object {
  const s = 'verilog';
  return {
    $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: VERILOG_LANGUAGE.aliases[0],
    scopeName: VERILOG_LANGUAGE.scopeName,
    patterns: [
      { include: '#inline-asm' },
      { include: '#comment' },
      { include: '#string' },
      { include: '#directive' },
      { include: '#number' },
      { include: '#systask' },
      // module name (...), task/function names
      {
        match: `\\b(module|macromodule|primitive)\\s+(${ID})`,
        captures: { 1: { name: `keyword.control.${s}` }, 2: { name: `entity.name.type.module.${s}` } },
      },
      {
        match: `\\b(task|function)\\b(?:\\s+(?:automatic\\s+)?(?:signed\\s+)?(?:\\[[^\\]]*\\]\\s*)?(?:(?:integer|real|realtime|time)\\s+)?(${ID})(?=\\s*[;(]))?`,
        captures: { 1: { name: `keyword.control.${s}` }, 2: { name: `entity.name.function.${s}` } },
      },
      { match: `\\b(?:${alt(TYPES)})\\b`, name: `storage.type.${s}` },
      { match: `\\b(?:${alt(KEYWORDS)})\\b`, name: `keyword.control.${s}` },
      // instance: modname [#(...)] inst (
      { match: `^\\s*(${ID})\\s+(?=#\\s*\\()`, captures: { 1: { name: `entity.name.type.module.${s}` } } },
      { match: `^\\s*(?!(?:${alt(KEYWORDS)})\\b)(${ID})\\s+(${ID})\\s*(?=\\()`, captures: {
        1: { name: `entity.name.type.module.${s}` }, 2: { name: `variable.other.instance.${s}` } } },
      { match: `\\.(${ID})\\s*(?=\\()`, name: `variable.parameter.port.${s}` },
      { match: `<=|>=|===|!==|==|!=|&&|\\|\\||<<<|>>>|<<|>>|~&|~\\||~\\^|\\^~|\\*\\*|[-+*/%&|^~!<>=?:@#]`, name: `keyword.operator.${s}` },
    ],
    repository: {
      comment: {
        patterns: [
          { name: `comment.line.double-slash.${s}`, match: `//.*$` },
          { name: `comment.block.${s}`, begin: `/\\*`, end: `\\*/` },
        ],
      },
      // __asm ... __endasm: JSASM source inside an initializer. Its mnemonics
      // depend on the .arch, so only the generic parts are highlighted.
      'inline-asm': {
        name: `meta.embedded.asm.${s}`,
        begin: `\\b(__asm)\\b`, end: `\\b(__endasm)\\b`,
        beginCaptures: { 1: { name: `keyword.control.${s}` } },
        endCaptures: { 1: { name: `keyword.control.${s}` } },
        patterns: [
          { match: `;.*$`, name: `comment.line.semicolon.${s}` },
          { match: `^\\s*(\\.[A-Za-z_]\\w*)`, captures: { 1: { name: `keyword.control.directive.${s}` } } },
          { match: `^\\s*([A-Za-z_][\\w.]*)(:)`, captures: {
            1: { name: `entity.name.function.label.${s}` }, 2: { name: `punctuation.separator.label.${s}` } } },
          { match: `\\$[0-9a-fA-F]+|\\b0[xX][0-9a-fA-F]+\\b|\\b[0-9]+\\b`, name: `constant.numeric.${s}` },
          { include: '#string' },
        ],
      },
      string: {
        name: `string.quoted.double.${s}`,
        begin: `"`, end: `"|$`,
        patterns: [{ match: `\\\\.`, name: `constant.character.escape.${s}` }, { match: `%[-0-9.]*[bBdDhHoOxXcCsSmMtTvVeEfFgGlL%]`, name: `constant.other.placeholder.${s}` }],
      },
      directive: {
        patterns: [
          { match: `\`(?:${alt(DIRECTIVES)})\\b`, name: `keyword.control.directive.${s}` },
          // macro use: `NAME
          { match: `\`${ID}`, name: `entity.name.function.macro.${s}` },
        ],
      },
      systask: { match: `\\$[A-Za-z_][\\w$]*`, name: `support.function.${s}` },
      number: {
        patterns: [
          // 8'hFF, 'b01xz, 4'sd3 (size, base and digits may be separated by space)
          { match: `(?:\\b\\d[\\d_]*)?\\s*'[sS]?[bB]\\s*[01xXzZ?_]+`, name: `constant.numeric.binary.${s}` },
          { match: `(?:\\b\\d[\\d_]*)?\\s*'[sS]?[oO]\\s*[0-7xXzZ?_]+`, name: `constant.numeric.octal.${s}` },
          { match: `(?:\\b\\d[\\d_]*)?\\s*'[sS]?[hH]\\s*[0-9a-fA-FxXzZ?_]+`, name: `constant.numeric.hex.${s}` },
          { match: `(?:\\b\\d[\\d_]*)?\\s*'[sS]?[dD]\\s*[0-9xXzZ?_]+`, name: `constant.numeric.decimal.${s}` },
          { match: `\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][-+]?\\d+)?\\b`, name: `constant.numeric.decimal.${s}` },
        ],
      },
    },
  };
}

export function makeVerilogConfiguration(): object {
  const blocks: [string, string][] = [
    ['module', 'endmodule'], ['function', 'endfunction'], ['task', 'endtask'], ['case', 'endcase'],
    ['generate', 'endgenerate'], ['primitive', 'endprimitive'], ['table', 'endtable'], ['specify', 'endspecify'],
  ];
  return {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['(', ')'], ['[', ']'], ['{', '}'], ['begin', 'end']],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '"', close: '"', notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [['(', ')'], ['[', ']'], ['{', '}'], ['"', '"']],
    wordPattern: '[`$]?[A-Za-z_][\\w$]*|\\d+\'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ?_]+|\\d+',
    folding: {
      markers: {
        start: `^\\s*(?:${['begin', ...blocks.map((b) => b[0]), '`ifn?def'].join('|')})\\b`,
        end: `^\\s*(?:${['end', ...blocks.map((b) => b[1]), '`endif'].join('|')})\\b`,
      },
    },
  };
}
