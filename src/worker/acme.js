var ACME = function(Module) {
  Module = Module || {};

// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof ACME !== 'undefined' ? ACME : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk



function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
}
updateGlobalBufferViews();


// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;





// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 21616;
  /* global initializers */  __ATINIT__.push();
  

/* memory initializer */ allocate([64,0,0,0,64,0,0,0,0,1,0,0,255,255,255,255,0,0,0,0,0,0,0,0,1,0,0,0,235,37,0,0,248,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,5,38,0,0,0,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,231,37,0,0,8,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,171,34,0,0,8,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,175,34,0,0,16,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,179,34,0,0,24,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,227,37,0,0,32,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,252,37,0,0,40,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,251,37,0,0,48,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,38,0,0,56,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,61,49,0,0,176,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,66,49,0,0,176,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,140,34,0,0,184,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,144,34,0,0,192,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,150,34,0,0,200,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,157,34,0,0,208,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,164,34,0,0,216,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,153,34,0,0,224,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,160,34,0,0,232,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,167,34,0,0,240,1,0,0,8,0,0,0,8,0,0,0,2,0,0,0,32,0,0,0,3,0,0,0,32,0,0,0,4,0,0,0,32,0,0,0,8,0,0,0,32,0,0,0,9,0,0,0,32,0,0,0,10,0,0,0,32,0,0,0,5,0,0,0,32,0,0,0,6,0,0,0,32,0,0,0,7,0,0,0,32,0,0,0,24,0,0,0,22,0,0,0,25,0,0,0,22,0,0,0,23,0,0,0,22,0,0,0,21,0,0,0,26,0,0,0,22,0,0,0,26,0,0,0,34,0,0,0,12,0,0,0,35,0,0,0,8,0,0,0,36,0,0,0,10,0,0,0,37,0,0,0,10,0,0,0,1,0,0,0,2,0,0,0,13,0,0,0,28,0,0,0,12,0,0,0,30,0,0,0,14,0,0,0,20,0,0,0,15,0,0,0,20,0,0,0,16,0,0,0,20,0,0,0,11,0,0,0,6,0,0,0,33,0,0,0,16,0,0,0,17,0,0,0,4,0,0,0,28,0,0,0,14,0,0,0,20,0,0,0,26,0,0,0,19,0,0,0,26,0,0,0,27,0,0,0,24,0,0,0,26,0,0,0,24,0,0,0,18,0,0,0,29,0,0,0,29,0,0,0,18,0,0,0,31,0,0,0,18,0,0,0,30,0,0,0,18,0,0,0,32,0,0,0,18,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,247,36,0,0,60,3,0,0,0,0,0,0,0,0,0,0,1,0,0,0,252,36,0,0,72,3,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,37,0,0,84,3,0,0,0,0,0,0,0,0,0,0,1,0,0,0,9,37,0,0,96,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15,37,0,0,108,3,0,0,1,0,0,0,1,0,0,0,234,0,0,0,2,0,0,0,5,0,0,0,234,0,0,0,3,0,0,0,5,0,0,0,234,0,0,0,4,0,0,0,0,0,0,0,234,0,0,0,5,0,0,0,2,0,0,0,234,0,0,0,80,79,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,40,38,0,0,128,3,0,0,0,0,0,0,0,0,0,0,1,0,0,0,44,38,0,0,124,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,48,38,0,0,132,3,0,0,1,0,0,0,1,0,0,0,10,0,0,0,216,3,0,0,134,40,0,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,156,42,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,227,37,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,251,37,0,0,2,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,160,42,0,0,3,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,164,42,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,168,42,0,0,5,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,172,42,0,0,6,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,176,42,0,0,7,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,40,43,0,0,0,5,0,0,0,0,0,0,0,0,0,0,1,0,0,0,231,37,0,0,1,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,172,43,0,0,2,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,5,38,0,0,3,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,38,0,0,4,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,176,43,0,0,5,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,180,43,0,0,6,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,184,43,0,0,7,6,0,0,0,0,0,0,0,0,0,0,1,0,0,0,188,43,0,0,8,6,0,0,0,0,0,0,0,0,0,0,1,0,0,0,192,43,0,0,9,6,0,0,0,0,0,0,0,0,0,0,1,0,0,0,196,43,0,0,10,6,0,0,0,0,0,0,0,0,0,0,1,0,0,0,44,43,0,0,11,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,48,43,0,0,12,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,200,43,0,0,16,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,204,43,0,0,48,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,208,43,0,0,80,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,212,43,0,0,112,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,216,43,0,0,144,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,220,43,0,0,176,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,224,43,0,0,208,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,228,43,0,0,240,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,184,42,0,0,0,8,0,0,0,0,0,0,0,0,0,0,1,0,0,0,188,42,0,0,1,8,0,0,0,0,0,0,0,0,0,0,1,0,0,0,232,43,0,0,0,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,236,43,0,0,8,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,240,43,0,0,24,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,244,43,0,0,40,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,248,43,0,0,56,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,252,43,0,0,64,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,44,0,0,72,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,4,44,0,0,88,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,8,44,0,0,96,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,12,44,0,0,104,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,16,44,0,0,120,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,20,44,0,0,136,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,24,44,0,0,138,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,28,44,0,0,152,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,32,44,0,0,154,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,36,44,0,0,168,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,40,44,0,0,170,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,44,44,0,0,184,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,48,44,0,0,186,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,52,44,0,0,200,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,56,44,0,0,202,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,60,44,0,0,216,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,64,44,0,0,232,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,68,44,0,0,234,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,72,44,0,0,248,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,92,43,0,0,25,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,96,43,0,0,26,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,100,43,0,0,27,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,104,43,0,0,28,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,108,43,0,0,29,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,112,43,0,0,30,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,116,43,0,0,31,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,120,43,0,0,32,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,124,43,0,0,32,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,128,43,0,0,33,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,132,43,0,0,33,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,136,43,0,0,34,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,140,43,0,0,35,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,235,37,0,0,24,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,144,43,0,0,25,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,148,43,0,0,26,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,152,43,0,0,27,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,156,43,0,0,28,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,160,43,0,0,29,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,164,43,0,0,31,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,168,43,0,0,30,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,88,43,0,0,23,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,239,37,0,0,18,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,80,43,0,0,36,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,84,43,0,0,37,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,156,42,0,0,8,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,227,37,0,0,9,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,251,37,0,0,10,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,160,42,0,0,11,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,164,42,0,0,12,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,168,42,0,0,13,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,172,42,0,0,14,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,176,42,0,0,15,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,184,42,0,0,2,8,0,0,0,0,0,0,0,0,0,0,1,0,0,0,40,43,0,0,15,5,0,0,0,0,0,0,0,0,0,0,1,0,0,0,44,43,0,0,16,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,48,43,0,0,17,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,239,37,0,0,128,16,0,0,0,0,0,0,0,0,0,0,1,0,0,0,52,43,0,0,90,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,56,43,0,0,122,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,60,43,0,0,218,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,64,43,0,0,250,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,68,43,0,0,13,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,72,43,0,0,14,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,76,43,0,0,18,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,32,43,0,0,219,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,36,43,0,0,203,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,156,42,0,0,16,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,227,37,0,0,17,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,251,37,0,0,18,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,160,42,0,0,19,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,164,42,0,0,20,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,168,42,0,0,21,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,172,42,0,0,22,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,176,42,0,0,23,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,180,42,0,0,24,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,184,42,0,0,3,8,0,0,0,0,0,0,0,0,0,0,1,0,0,0,188,42,0,0,5,8,0,0,0,0,0,0,0,0,0,0,1,0,0,0,192,42,0,0,4,8,0,0,0,0,0,0,0,0,0,0,1,0,0,0,196,42,0,0,6,8,0,0,0,0,0,0,0,0,0,0,1,0,0,0,200,42,0,0,68,24,0,0,0,0,0,0,0,0,0,0,1,0,0,0,204,42,0,0,84,24,0,0,0,0,0,0,0,0,0,0,1,0,0,0,208,42,0,0,98,20,0,0,0,0,0,0,0,0,0,0,1,0,0,0,243,37,0,0,130,20,0,0,0,0,0,0,0,0,0,0,1,0,0,0,212,42,0,0,19,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,216,42,0,0,20,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,220,42,0,0,21,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,224,42,0,0,22,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,228,42,0,0,11,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,232,42,0,0,27,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,236,42,0,0,43,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,240,42,0,0,59,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,244,42,0,0,66,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,248,42,0,0,75,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,252,42,0,0,91,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,43,0,0,107,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,4,43,0,0,123,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,8,43,0,0,139,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,12,43,0,0,155,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,16,43,0,0,171,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,20,43,0,0,187,12,0,0,0,0,0,0,0,0,0,0,1,0,0,0,24,43,0,0,235,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,28,43,0,0,251,12,0,0,5,13,0,0,37,45,0,0,69,77,0,0,101,109,0,0,133,141,0,0,165,173,0,0,197,205,0,0,229,237,0,0,5,13,0,0,37,45,0,0,69,77,0,0,101,109,0,0,133,141,0,0,165,173,0,0,197,205,0,0,229,237,0,0,5,13,15,0,37,45,47,0,69,77,79,0,101,109,111,0,133,141,143,0,165,173,175,0,197,205,207,0,229,237,239,0,0,0,0,0,7,15,0,0,39,47,0,0,71,79,0,0,103,111,0,0,135,143,0,0,167,175,0,0,199,207,0,0,231,239,0,0,0,0,0,0,21,29,0,0,53,61,0,0,85,93,0,0,117,125,0,0,149,157,0,0,181,189,0,0,213,221,0,0,245,253,0,0,21,29,0,0,53,61,0,0,85,93,0,0,117,125,0,0,149,157,0,0,181,189,0,0,213,221,0,0,245,253,0,0,21,29,31,0,53,61,63,0,85,93,95,0,117,125,127,0,149,157,159,0,181,189,191,0,213,221,223,0,245,253,255,0,0,0,0,0,23,31,0,0,55,63,0,0,87,95,0,0,119,127,0,0,0,0,0,0,0,0,0,0,215,223,0,0,247,255,0,0,0,0,0,0,0,76,0,0,0,32,0,0,0,76,0,0,0,76,92,0,0,0,92,0,0,32,34,0,0,0,34,0,0,0,0,0,0,0,0,0,1,0,0,0,170,47,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,247,37,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,176,47,0,0,3,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,175,48,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,183,48,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,187,48,0,0,3,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,186,48,0,0,3,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,189,48,0,0,3,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,192,48,0,0,3,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,197,48,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,200,48,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,205,48,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,208,48,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,213,48,0,0,6,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,218,48,0,0,7,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,221,48,0,0,8,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,226,48,0,0,9,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,231,48,0,0,10,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,234,48,0,0,11,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,239,48,0,0,12,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,247,37,0,0,13,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,244,48,0,0,14,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,247,48,0,0,14,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,255,48,0,0,15,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,49,0,0,15,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,44,38,0,0,16,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,40,38,0,0,17,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,48,38,0,0,18,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,9,38,0,0,19,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,7,49,0,0,20,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,11,49,0,0,20,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,18,49,0,0,21,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,21,49,0,0,21,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,26,49,0,0,22,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,32,49,0,0,23,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,41,49,0,0,24,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,48,49,0,0,25,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,52,49,0,0,26,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,55,49,0,0,27,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,244,37,0,0,28,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,58,49,0,0,29,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,61,49,0,0,30,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,66,49,0,0,30,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,74,49,0,0,31,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,232,37,0,0,32,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,78,49,0,0,32,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,89,49,0,0,33,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,35,38,0,0,33,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,92,49,0,0,34,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,32,38,0,0,34,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,95,49,0,0,35,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,99,49,0,0,35,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,106,49,0,0,36,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,109,49,0,0,37,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,115,49,0,0,38,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,122,49,0,0,39,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,126,49,0,0,40,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,129,49,0,0,41,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,135,49,0,0,42,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,255,37,0,0,43,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,140,49,0,0,44,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,148,49,0,0,45,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,152,49,0,0,45,0,0,0,232,20,0,0,0,0,0,0,86,52,0,0,93,52,0,0,0,0,0,0,252,20,0,0,5,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,90,80,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,112,21,0,0,5,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,2,0,0,0,98,80,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,112,21,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,25,0,57,0,89,0,121,0,153,0,185,0,217,0,249,0,25,0,57,0,89,0,121,0,153,0,185,0,217,0,249,0,25,0,57,0,89,0,121,0,153,0,185,0,217,0,249,0,0,0,27,0,59,0,91,0,123,151,0,183,191,0,219,0,251,0,159,36,44,6,14,38,46,70,78,102,110,132,140,134,142,164,172,166,174,196,204,228,236,198,206,230,238,4,12,20,28,36,44,198,206,230,238,100,156,2,0,0,0,0,0,0,244,0,0,0,0,0,0,0,0,4,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,22,30,54,62,86,94,118,126,148,0,0,0,180,188,0,0,0,0,0,0,214,222,246,254,0,0,0,0,52,60,214,222,246,254,116,158,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,20,0,0,28,0,0,0,0,0,0,0,0,0,0,0,0,0,156,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,150,0,0,0,182,190,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,187,0,155,0,158,0,0,0,0,0,0,0,108,0,0,0,108,0,108,0,0,0,0,0,0,0,0,0,0,0,124,0,124,0,0,0,252,0,0,0,0,0,0,0,0,0,220,0,220,0,0,0,0,119,0,69,114,114,111,114,58,32,67,97,110,110,111,116,32,111,112,101,110,32,115,121,109,98,111,108,32,108,105,115,116,32,102,105,108,101,32,34,37,115,34,46,10,0,69,114,114,111,114,58,32,67,97,110,110,111,116,32,111,112,101,110,32,86,73,67,69,32,108,97,98,101,108,32,100,117,109,112,32,102,105,108,101,32,34,37,115,34,46,10,0,78,111,32,116,111,112,32,108,101,118,101,108,32,115,111,117,114,99,101,115,32,103,105,118,101,110,0,65,67,77,69,32,45,32,116,104,101,32,65,67,77,69,32,67,114,111,115,115,97,115,115,101,109,98,108,101,114,32,102,111,114,32,77,117,108,116,105,112,108,101,32,69,110,118,105,114,111,110,109,101,110,116,115,10,32,32,67,111,112,121,114,105,103,104,116,32,40,67,41,32,49,57,57,56,45,50,48,49,54,32,77,97,114,99,111,32,66,97,121,101,0,65,67,77,69,32,99,111,109,101,115,32,119,105,116,104,32,65,66,83,79,76,85,84,69,76,89,32,78,79,32,87,65,82,82,65,78,84,89,59,32,102,111,114,32,100,101,116,97,105,108,115,32,114,101,97,100,32,116,104,101,32,104,101,108,112,32,102,105,108,101,46,10,32,32,84,104,105,115,32,105,115,32,102,114,101,101,32,115,111,102,116,119,97,114,101,44,32,97,110,100,32,121,111,117,32,97,114,101,32,119,101,108,99,111,109,101,32,116,111,32,114,101,100,105,115,116,114,105,98,117,116,101,32,105,116,32,117,110,100,101,114,10,32,32,99,101,114,116,97,105,110,32,99,111,110,100,105,116,105,111,110,115,59,32,97,115,32,111,117,116,108,105,110,101,100,32,105,110,32,116,104,101,32,71,78,85,32,71,101,110,101,114,97,108,32,80,117,98,108,105,99,32,76,105,99,101,110,115,101,46,10,68,101,100,105,99,97,116,101,100,32,116,111,32,116,104,101,32,119,105,115,101,115,116,32,98,101,105,110,103,32,73,32,101,118,101,114,32,104,97,100,32,116,104,101,32,112,108,101,97,115,117,114,101,32,111,102,32,114,101,97,100,105,110,103,10,32,32,98,111,111,107,115,32,111,102,32,40,99,117,114,114,101,110,116,108,121,32,115,112,101,110,100,105,110,103,32,115,111,109,101,32,116,105,109,101,32,100,101,97,100,32,102,111,114,32,116,97,120,32,114,101,97,115,111,110,115,41,46,10,84,104,101,32,110,101,119,101,115,116,32,118,101,114,115,105,111,110,32,99,97,110,32,98,101,32,102,111,117,110,100,32,97,116,32,116,104,101,32,65,67,77,69,32,104,111,109,101,112,97,103,101,58,10,32,32,104,116,116,112,58,47,47,115,111,117,114,99,101,102,111,114,103,101,46,110,101,116,47,112,47,97,99,109,101,45,99,114,111,115,115,97,115,115,47,10,10,85,115,97,103,101,58,10,97,99,109,101,32,91,79,80,84,73,79,78,46,46,46,93,32,91,70,73,76,69,93,46,46,46,10,10,79,112,116,105,111,110,115,58,10,32,32,45,104,44,32,45,45,104,101,108,112,32,32,32,32,32,32,32,32,32,32,32,32,32,115,104,111,119,32,116,104,105,115,32,104,101,108,112,32,97,110,100,32,101,120,105,116,10,32,32,45,102,44,32,45,45,102,111,114,109,97,116,32,70,79,82,77,65,84,32,32,32,32,115,101,116,32,111,117,116,112,117,116,32,102,105,108,101,32,102,111,114,109,97,116,10,32,32,45,111,44,32,45,45,111,117,116,102,105,108,101,32,70,73,76,69,32,32,32,32,32,115,101,116,32,111,117,116,112,117,116,32,102,105,108,101,32,110,97,109,101,10,32,32,45,114,44,32,45,45,114,101,112,111,114,116,32,70,73,76,69,32,32,32,32,32,32,115,101,116,32,114,101,112,111,114,116,32,102,105,108,101,32,110,97,109,101,10,32,32,45,108,44,32,45,45,115,121,109,98,111,108,108,105,115,116,32,70,73,76,69,32,32,115,101,116,32,115,121,109,98,111,108,32,108,105,115,116,32,102,105,108,101,32,110,97,109,101,10,32,32,32,32,32,32,45,45,108,97,98,101,108,100,117,109,112,32,32,32,32,32,32,32,32,40,111,108,100,32,110,97,109,101,32,102,111,114,32,45,45,115,121,109,98,111,108,108,105,115,116,41,10,32,32,32,32,32,32,45,45,118,105,99,101,108,97,98,101,108,115,32,70,73,76,69,32,32,115,101,116,32,102,105,108,101,32,110,97,109,101,32,102,111,114,32,108,97,98,101,108,32,100,117,109,112,32,105,110,32,86,73,67,69,32,102,111,114,109,97,116,10,32,32,32,32,32,32,45,45,115,101,116,112,99,32,78,85,77,66,69,82,32,32,32,32,32,115,101,116,32,112,114,111,103,114,97,109,32,99,111,117,110,116,101,114,10,32,32,32,32,32,32,45,45,99,112,117,32,67,80,85,32,32,32,32,32,32,32,32,32,32,115,101,116,32,116,97,114,103,101,116,32,112,114,111,99,101,115,115,111,114,10,32,32,32,32,32,32,45,45,105,110,105,116,109,101,109,32,78,85,77,66,69,82,32,32,32,100,101,102,105,110,101,32,39,101,109,112,116,121,39,32,109,101,109,111,114,121,10,32,32,32,32,32,32,45,45,109,97,120,101,114,114,111,114,115,32,78,85,77,66,69,82,32,115,101,116,32,110,117,109,98,101,114,32,111,102,32,101,114,114,111,114,115,32,98,101,102,111,114,101,32,101,120,105,116,105,110,103,10,32,32,32,32,32,32,45,45,109,97,120,100,101,112,116,104,32,78,85,77,66,69,82,32,32,115,101,116,32,114,101,99,117,114,115,105,111,110,32,100,101,112,116,104,32,102,111,114,32,109,97,99,114,111,32,99,97,108,108,115,32,97,110,100,32,33,115,114,99,10,32,32,45,118,68,73,71,73,84,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,115,101,116,32,118,101,114,98,111,115,105,116,121,32,108,101,118,101,108,10,32,32,45,68,83,89,77,66,79,76,61,86,65,76,85,69,32,32,32,32,32,32,32,32,32,100,101,102,105,110,101,32,103,108,111,98,97,108,32,115,121,109,98,111,108,10,32,32,45,87,110,111,45,108,97,98,101,108,45,105,110,100,101,110,116,32,32,32,32,32,32,115,117,112,112,114,101,115,115,32,119,97,114,110,105,110,103,115,32,97,98,111,117,116,32,105,110,100,101,110,116,101,100,32,108,97,98,101,108,115,10,32,32,45,87,110,111,45,111,108,100,45,102,111,114,32,32,32,32,32,32,32,32,32,32,32,115,117,112,112,114,101,115,115,32,119,97,114,110,105,110,103,115,32,97,98,111,117,116,32,111,108,100,32,34,33,102,111,114,34,32,115,121,110,116,97,120,10,32,32,45,87,116,121,112,101,45,109,105,115,109,97,116,99,104,32,32,32,32,32,32,32,32,101,110,97,98,108,101,32,116,121,112,101,32,99,104,101,99,107,105,110,103,32,40,119,97,114,110,32,97,98,111,117,116,32,116,121,112,101,32,109,105,115,109,97,116,99,104,41,10,32,32,32,32,32,32,45,45,117,115,101,45,115,116,100,111,117,116,32,32,32,32,32,32,32,102,105,120,32,102,111,114,32,39,82,101,108,97,117,110,99,104,54,52,39,32,73,68,69,32,40,115,101,101,32,100,111,99,115,41,10,32,32,32,32,32,32,45,45,109,115,118,99,32,32,32,32,32,32,32,32,32,32,32,32,32,115,101,116,32,111,117,116,112,117,116,32,101,114,114,111,114,32,109,101,115,115,97,103,101,32,102,111,114,109,97,116,32,116,111,32,116,104,97,116,32,111,102,32,77,83,32,86,105,115,117,97,108,32,83,116,117,100,105,111,10,32,32,45,86,44,32,45,45,118,101,114,115,105,111,110,32,32,32,32,32,32,32,32,32,32,115,104,111,119,32,118,101,114,115,105,111,110,32,97,110,100,32,101,120,105,116,10,0,84,104,105,115,32,105,115,32,65,67,77,69,44,32,114,101,108,101,97,115,101,32,48,46,57,53,46,56,32,40,34,70,101,110,99,104,117,114,99,104,34,41,44,32,56,32,79,99,116,32,50,48,49,54,10,32,32,80,108,97,116,102,111,114,109,32,105,110,100,101,112,101,110,100,101,110,116,32,118,101,114,115,105,111,110,46,0,111,117,116,112,117,116,32,102,105,108,101,110,97,109,101,0,115,121,109,98,111,108,32,108,105,115,116,32,102,105,108,101,110,97,109,101,0,114,101,112,111,114,116,32,102,105,108,101,110,97,109,101,0,110,111,45,108,97,98,101,108,45,105,110,100,101,110,116,0,110,111,45,111,108,100,45,102,111,114,0,116,121,112,101,45,109,105,115,109,97,116,99,104,0,37,115,85,110,107,110,111,119,110,32,119,97,114,110,105,110,103,32,108,101,118,101,108,46,10,0,37,115,67,111,117,108,100,32,110,111,116,32,112,97,114,115,101,32,39,37,115,39,46,10,0,111,117,116,112,117,116,32,102,111,114,109,97,116,0,37,115,85,110,107,110,111,119,110,32,111,117,116,112,117,116,32,102,111,114,109,97,116,32,40,107,110,111,119,110,32,102,111,114,109,97,116,115,32,97,114,101,58,32,37,115,41,46,10,0,104,101,108,112,0,102,111,114,109,97,116,0,111,117,116,102,105,108,101,0,108,97,98,101,108,100,117,109,112,0,118,105,99,101,108,97,98,101,108,115,0,86,73,67,69,32,108,97,98,101,108,115,32,102,105,108,101,110,97,109,101,0,114,101,112,111,114,116,0,115,101,116,112,99,0,109,97,120,101,114,114,111,114,115,0,109,97,120,105,109,117,109,32,101,114,114,111,114,32,99,111,117,110,116,0,109,97,120,100,101,112,116,104,0,114,101,99,117,114,115,105,111,110,32,100,101,112,116,104,0,117,115,101,45,115,116,100,111,117,116,0,109,115,118,99,0,118,101,114,115,105,111,110,0,112,114,111,103,114,97,109,32,99,111,117,110,116,101,114,0,37,115,80,114,111,103,114,97,109,32,99,111,117,110,116,101,114,32,111,117,116,32,111,102,32,114,97,110,103,101,32,40,48,45,48,120,102,102,102,102,41,46,10,0,67,80,85,32,116,121,112,101,0,37,115,85,110,107,110,111,119,110,32,67,80,85,32,116,121,112,101,32,40,107,110,111,119,110,32,116,121,112,101,115,32,97,114,101,58,32,37,115,41,46,10,0,105,110,105,116,109,101,109,32,118,97,108,117,101,0,37,115,73,110,105,116,109,101,109,32,118,97,108,117,101,32,111,117,116,32,111,102,32,114,97,110,103,101,32,40,48,45,48,120,102,102,41,46,10,0,70,105,114,115,116,32,112,97,115,115,46,0,70,117,114,116,104,101,114,32,112,97,115,115,46,0,69,120,116,114,97,32,112,97,115,115,32,116,111,32,103,101,110,101,114,97,116,101,32,108,105,115,116,105,110,103,32,114,101,112,111,114,116,46,0,69,120,116,114,97,32,112,97,115,115,32,110,101,101,100,101,100,32,116,111,32,102,105,110,100,32,101,114,114,111,114,46,0,69,114,114,111,114,58,32,67,97,110,110,111,116,32,111,112,101,110,32,116,111,112,108,101,118,101,108,32,102,105,108,101,32,34,37,115,34,46,10,0,79,112,116,105,111,110,115,32,40,115,116,97,114,116,105,110,103,32,119,105,116,104,32,39,45,39,41,32,109,117,115,116,32,98,101,32,103,105,118,101,110,32,95,98,101,102,111,114,101,95,32,115,111,117,114,99,101,32,102,105,108,101,115,33,10,0,69,114,114,111,114,58,32,67,97,110,110,111,116,32,111,112,101,110,32,114,101,112,111,114,116,32,102,105,108,101,32,34,37,115,34,46,10,0,78,111,32,111,117,116,112,117,116,32,102,105,108,101,32,115,112,101,99,105,102,105,101,100,32,40,117,115,101,32,116,104,101,32,34,45,111,34,32,111,112,116,105,111,110,32,111,114,32,116,104,101,32,34,33,116,111,34,32,112,115,101,117,100,111,32,111,112,99,111,100,101,41,46,10,0,119,98,0,69,114,114,111,114,58,32,67,97,110,110,111,116,32,111,112,101,110,32,111,117,116,112,117,116,32,102,105,108,101,32,34,37,115,34,46,10,0,105,110,116,0,102,108,111,97,116,0,97,114,99,115,105,110,0,97,114,99,99,111,115,0,97,114,99,116,97,110,0,108,115,108,0,100,105,118,0,109,111,100,0,84,111,111,32,109,97,110,121,32,39,40,39,46,0,86,97,108,117,101,32,110,111,116,32,100,101,102,105,110,101,100,32,40,0,41,46,0,73,108,108,101,103,97,108,32,115,121,109,98,111,108,32,110,97,109,101,32,108,101,110,103,116,104,0,84,104,101,114,101,39,115,32,109,111,114,101,32,116,104,97,110,32,111,110,101,32,99,104,97,114,97,99,116,101,114,46,0,42,0,85,110,107,110,111,119,110,32,102,117,110,99,116,105,111,110,46,0,67,45,115,116,121,108,101,32,34,61,61,34,32,99,111,109,112,97,114,105,115,111,110,32,100,101,116,101,99,116,101,100,46,0,85,110,107,110,111,119,110,32,111,112,101,114,97,116,111,114,46,0,83,116,114,97,110,103,101,80,97,114,101,110,116,104,101,115,105,115,0,84,111,111,32,109,97,110,121,32,39,41,39,46,0,65,114,103,117,109,101,110,116,32,111,117,116,32,111,102,32,114,97,110,103,101,46,0,69,120,112,111,110,101,110,116,32,105,115,32,110,101,103,97,116,105,118,101,46,0,68,105,118,105,115,105,111,110,32,98,121,32,122,101,114,111,46,0,67,111,110,118,101,114,116,101,100,32,116,111,32,105,110,116,101,103,101,114,32,102,111,114,32,98,105,110,97,114,121,32,108,111,103,105,99,32,111,112,101,114,97,116,111,114,46,0,34,69,79,82,34,32,105,115,32,100,101,112,114,101,99,97,116,101,100,59,32,117,115,101,32,34,88,79,82,34,32,105,110,115,116,101,97,100,46,0,73,108,108,101,103,97,108,79,112,101,114,97,116,111,114,72,97,110,100,108,101,0,79,112,101,114,97,110,100,83,116,97,99,107,78,111,116,69,109,112,116,121,0,79,112,101,114,97,116,111,114,83,116,97,99,107,78,111,116,69,109,112,116,121,0,78,111,32,118,97,108,117,101,32,103,105,118,101,110,46,0,69,114,114,111,114,32,105,110,32,67,76,73,32,97,114,103,117,109,101,110,116,115,58,32,0,37,115,85,110,107,110,111,119,110,32,111,112,116,105,111,110,32,40,45,45,37,115,41,46,10,0,37,115,85,110,107,110,111,119,110,32,115,119,105,116,99,104,32,40,45,37,99,41,46,10,0,37,115,77,105,115,115,105,110,103,32,37,115,46,10,0,37,115,37,115,46,10,0,39,54,53,48,50,39,44,32,39,54,53,49,48,39,44,32,39,99,54,52,100,116,118,50,39,44,32,39,54,53,99,48,50,39,44,32,39,54,53,56,49,54,39,0,54,53,48,50,0,54,53,49,48,0,99,54,52,100,116,118,50,0,54,53,99,48,50,0,54,53,56,49,54,0,67,104,111,115,101,110,32,67,80,85,32,100,111,101,115,32,110,111,116,32,115,117,112,112,111,114,116,32,108,111,110,103,32,114,101,103,105,115,116,101,114,115,46,0,69,114,114,111,114,58,32,78,111,32,109,101,109,111,114,121,32,102,111,114,32,100,121,110,97,109,105,99,32,98,117,102,102,101,114,46,10,0,67,111,110,118,101,114,115,105,111,110,32,116,97,98,108,101,32,105,110,99,111,109,112,108,101,116,101,46,0,85,110,107,110,111,119,110,32,101,110,99,111,100,105,110,103,46,0,119,104,105,108,101,0,117,110,116,105,108,0,101,108,115,101,0,80,97,114,115,105,110,103,32,115,111,117,114,99,101,32,102,105,108,101,32,39,37,115,39,10,0,70,111,117,110,100,32,39,125,39,32,105,110,115,116,101,97,100,32,111,102,32,101,110,100,45,111,102,45,102,105,108,101,46,0,97,110,100,0,97,115,108,0,97,115,114,0,98,114,97,0,98,114,108,0,99,98,109,0,101,111,114,0,101,114,114,111,114,0,108,115,114,0,115,99,114,120,111,114,0,60,117,110,116,105,116,108,101,100,62,0,90,111,110,101,0,115,117,98,122,111,110,101,0,112,101,116,0,114,97,119,0,115,99,114,0,67,97,110,110,111,116,32,111,112,101,110,32,105,110,112,117,116,32,102,105,108,101,46,0,78,111,32,115,116,114,105,110,103,32,103,105,118,101,110,46,0,77,105,115,115,105,110,103,32,39,123,39,46,0,79,117,116,32,111,102,32,109,101,109,111,114,121,46,0,70,111,117,110,100,32,101,110,100,45,111,102,45,102,105,108,101,32,105,110,115,116,101,97,100,32,111,102,32,39,125,39,46,0,78,117,109,98,101,114,32,111,117,116,32,111,102,32,114,97,110,103,101,46,0,80,114,111,103,114,97,109,32,99,111,117,110,116,101,114,32,117,110,100,101,102,105,110,101,100,46,0,83,121,110,116,97,120,32,101,114,114,111,114,46,0,24,0,0,0,0,0,0,0,0,16,16,0,0,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,8,0,0,8,0,0,0,64,64,64,64,64,64,64,64,64,64,16,16,0,0,0,0,0,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,224,0,0,0,0,192,0,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,0,0,16,0,0,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,83,101,114,105,111,117,115,32,101,114,114,111,114,0,37,115,40,37,100,41,32,58,32,37,115,32,40,37,115,32,37,115,41,58,32,37,115,10,0,37,115,32,45,32,70,105,108], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
/* memory initializer */ allocate([101,32,37,115,44,32,108,105,110,101,32,37,100,32,40,37,115,32,37,115,41,58,32,37,115,10,0,87,97,114,110,105,110,103,0,76,97,98,101,108,32,110,97,109,101,32,115,116,97,114,116,115,32,119,105,116,104,32,97,32,115,104,105,102,116,45,115,112,97,99,101,32,99,104,97,114,97,99,116,101,114,46,0,69,114,114,111,114,0,66,117,103,32,105,110,32,65,67,77,69,44,32,99,111,100,101,32,102,111,108,108,111,119,115,0,40,48,120,37,120,58,41,0,114,98,0,60,110,111,110,101,62,0,83,111,117,114,99,101,32,102,105,108,101,32,99,111,110,116,97,105,110,115,32,105,108,108,101,103,97,108,32,99,104,97,114,97,99,116,101,114,46,0,83,116,114,97,110,103,101,73,110,112,117,116,77,111,100,101,0,10,59,32,42,42,42,42,42,42,42,42,32,83,111,117,114,99,101,58,32,37,115,10,0,37,54,100,32,32,0,37,48,52,120,0,37,48,50,120,0,37,45,52,115,32,37,45,49,57,115,0,37,115,10,0,81,117,111,116,101,115,32,115,116,105,108,108,32,111,112,101,110,32,97,116,32,101,110,100,32,111,102,32,108,105,110,101,46,0,71,97,114,98,97,103,101,32,100,97,116,97,32,97,116,32,101,110,100,32,111,102,32,115,116,97,116,101,109,101,110,116,46,0,87,114,105,116,105,110,103,32,116,111,32,108,105,98,114,97,114,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,46,0,34,65,67,77,69,34,32,101,110,118,105,114,111,110,109,101,110,116,32,118,97,114,105,97,98,108,101,32,110,111,116,32,102,111,117,110,100,46,0,70,105,108,101,32,110,97,109,101,32,113,117,111,116,101,115,32,110,111,116,32,102,111,117,110,100,32,40,34,34,32,111,114,32,60,62,41,46,0,78,111,32,102,105,108,101,32,110,97,109,101,32,103,105,118,101,110,46,0,73,108,108,101,103,97,108,32,112,111,115,116,102,105,120,46,0,77,97,99,114,111,32,97,108,114,101,97,100,121,32,100,101,102,105,110,101,100,46,0,111,114,105,103,105,110,97,108,0,100,101,102,105,110,105,116,105,111,110,0,84,111,111,32,100,101,101,112,108,121,32,110,101,115,116,101,100,46,32,82,101,99,117,114,115,105,118,101,32,109,97,99,114,111,32,99,97,108,108,115,63,0,77,97,99,114,111,32,110,111,116,32,100,101,102,105,110,101,100,32,40,111,114,32,119,114,111,110,103,32,115,105,103,110,97,116,117,114,101,41,46,0,77,97,99,114,111,0,77,97,99,114,111,32,112,97,114,97,109,101,116,101,114,32,116,119,105,99,101,46,0,73,108,108,101,103,97,108,66,108,111,99,107,84,101,114,109,105,110,97,116,111,114,0,46,46,46,99,97,108,108,101,100,32,102,114,111,109,32,104,101,114,101,46,0,111,114,97,0,97,100,99,0,115,116,97,0,108,100,97,0,99,109,112,0,115,98,99,0,112,101,105,0,106,109,112,0,106,115,114,0,106,109,108,0,106,115,108,0,109,118,112,0,109,118,110,0,112,101,114,0,99,111,112,0,114,101,112,0,115,101,112,0,112,101,97,0,112,104,100,0,116,99,115,0,112,108,100,0,116,115,99,0,119,100,109,0,112,104,107,0,116,99,100,0,114,116,108,0,116,100,99,0,112,104,98,0,116,120,121,0,112,108,98,0,116,121,120,0,120,98,97,0,120,99,101,0,115,116,112,0,119,97,105,0,98,105,116,0,100,101,99,0,105,110,99,0,112,104,121,0,112,108,121,0,112,104,120,0,112,108,120,0,116,115,98,0,116,114,98,0,115,116,122,0,115,97,99,0,115,105,114,0,97,110,99,0,115,108,111,0,114,108,97,0,115,114,101,0,114,114,97,0,115,97,120,0,108,97,120,0,100,99,112,0,105,115,99,0,108,97,115,0,116,97,115,0,115,104,97,0,115,104,120,0,115,104,121,0,97,114,114,0,115,98,120,0,100,111,112,0,116,111,112,0,106,97,109,0,97,110,101,0,108,120,97,0,114,111,108,0,115,116,121,0,115,116,120,0,108,100,121,0,108,100,120,0,99,112,121,0,99,112,120,0,98,112,108,0,98,109,105,0,98,118,99,0,98,118,115,0,98,99,99,0,98,99,115,0,98,110,101,0,98,101,113,0,98,114,107,0,112,104,112,0,99,108,99,0,112,108,112,0,115,101,99,0,114,116,105,0,112,104,97,0,99,108,105,0,114,116,115,0,112,108,97,0,115,101,105,0,100,101,121,0,116,120,97,0,116,121,97,0,116,120,115,0,116,97,121,0,116,97,120,0,99,108,118,0,116,115,120,0,105,110,121,0,100,101,120,0,99,108,100,0,105,110,120,0,110,111,112,0,115,101,100,0,9,41,73,105,0,169,201,233,9,41,73,105,0,169,201,233,9,41,73,105,0,169,201,233,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,35,67,99,131,163,195,227,0,0,0,0,0,0,0,0,0,0,1,33,65,97,129,161,193,225,1,33,65,97,129,161,193,225,1,33,65,97,129,161,193,225,0,3,35,67,99,131,163,195,227,0,0,0,0,0,0,0,0,0,18,50,82,114,146,178,210,242,18,50,82,114,146,178,210,242,212,0,0,0,0,0,0,0,0,0,17,49,81,113,145,177,209,241,17,49,81,113,145,177,209,241,17,49,81,113,145,177,209,241,0,19,51,83,115,0,179,211,243,147,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,39,71,103,135,167,199,231,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,23,55,87,119,151,183,215,247,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,19,51,83,115,147,179,211,243,0,0,0,0,0,0,0,0,0,0,73,108,108,101,103,97,108,32,99,111,109,98,105,110,97,116,105,111,110,32,111,102,32,99,111,109,109,97,110,100,32,97,110,100,32,97,100,100,114,101,115,115,105,110,103,32,109,111,100,101,46,0,0,10,42,74,106,0,0,0,0,0,0,0,0,0,0,0,58,26,0,0,0,0,0,0,0,0,0,128,12,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,160,162,192,224,0,0,0,0,137,0,0,0,0,194,226,0,11,75,107,203,128,0,0,171,139,0,0,0,0,50,66,65,115,115,101,109,98,108,105,110,103,32,117,110,115,116,97,98,108,101,32,65,78,69,32,35,78,79,78,90,69,82,79,32,105,110,115,116,114,117,99,116,105,111,110,0,65,115,115,101,109,98,108,105,110,103,32,117,110,115,116,97,98,108,101,32,76,88,65,32,35,78,79,78,90,69,82,79,32,105,110,115,116,114,117,99,116,105,111,110,0,65,115,115,101,109,98,108,105,110,103,32,98,117,103,103,121,32,74,77,80,40,36,120,120,102,102,41,32,105,110,115,116,114,117,99,116,105,111,110,0,84,97,114,103,101,116,32,110,111,116,32,105,110,32,98,97,110,107,32,40,48,120,37,108,120,41,46,0,84,97,114,103,101,116,32,111,117,116,32,111,102,32,114,97,110,103,101,32,40,37,108,100,59,32,37,108,100,32,116,111,111,32,102,97,114,41,46,0,73,108,108,101,103,97,108,71,114,111,117,112,73,110,100,101,120,0,73,108,108,101,103,97,108,32,99,111,109,98,105,110,97,116,105,111,110,32,111,102,32,99,111,109,109,97,110,100,32,97,110,100,32,112,111,115,116,102,105,120,46,0,85,115,105,110,103,32,111,118,101,114,115,105,122,101,100,32,97,100,100,114,101,115,115,105,110,103,32,109,111,100,101,46,0,78,101,103,97,116,105,118,101,32,118,97,108,117,101,32,45,32,99,97,110,110,111,116,32,99,104,111,111,115,101,32,97,100,100,114,101,115,115,105,110,103,32,109,111,100,101,46,0,39,112,108,97,105,110,39,44,32,39,99,98,109,39,44,32,39,97,112,112,108,101,39,0,80,114,111,100,117,99,101,100,32,116,111,111,32,109,117,99,104,32,99,111,100,101,46,0,83,101,103,109,101,110,116,32,114,101,97,99,104,101,100,32,97,110,111,116,104,101,114,32,111,110,101,44,32,111,118,101,114,119,114,105,116,105,110,103,32,105,116,46,0,77,101,109,111,114,121,32,97,108,114,101,97,100,121,32,105,110,105,116,105,97,108,105,115,101,100,46,0,97,112,112,108,101,0,112,108,97,105,110,0,79,117,116,112,117,116,32,102,105,108,101,32,97,108,114,101,97,100,121,32,99,104,111,115,101,110,46,0,83,97,118,105,110,103,32,37,108,100,32,40,48,120,37,108,120,41,32,98,121,116,101,115,32,40,48,120,37,108,120,32,45,32,48,120,37,108,120,32,101,120,99,108,117,115,105,118,101,41,46,10,0,83,101,103,109,101,110,116,32,115,105,122,101,32,105,115,32,37,108,100,32,40,48,120,37,108,120,41,32,98,121,116,101,115,32,40,48,120,37,108,120,32,45,32,48,120,37,108,120,32,101,120,99,108,117,115,105,118,101,41,46,10,0,83,101,103,109,101,110,116,32,115,116,97,114,116,115,32,105,110,115,105,100,101,32,97,110,111,116,104,101,114,32,111,110,101,44,32,111,118,101,114,119,114,105,116,105,110,103,32,105,116,46,0,65,67,77,69,0,111,118,101,114,108,97,121,0,105,110,118,105,115,105,98,108,101,0,85,110,107,110,111,119,110,32,34,42,32,61,34,32,115,101,103,109,101,110,116,32,109,111,100,105,102,105,101,114,46,0,105,110,105,116,109,101,109,0,116,111,0,48,56,0,98,121,0,98,121,116,101,0,119,111,0,119,111,114,100,0,49,54,0,98,101,49,54,0,108,101,49,54,0,50,52,0,98,101,50,52,0,108,101,50,52,0,51,50,0,98,101,51,50,0,108,101,51,50,0,99,116,0,99,111,110,118,116,97,98,0,116,120,0,116,101,120,116,0,98,105,110,0,98,105,110,97,114,121,0,102,105,0,102,105,108,108,0,97,108,105,103,110,0,112,115,101,117,100,111,112,99,0,114,101,97,108,112,99,0,99,112,117,0,97,108,0,97,115,0,114,115,0,97,100,100,114,0,97,100,100,114,101,115,115,0,115,101,116,0,115,121,109,98,111,108,108,105,115,116,0,122,110,0,115,122,0,115,114,99,0,115,111,117,114,99,101,0,105,102,0,105,102,100,101,102,0,105,102,110,100,101,102,0,102,111,114,0,100,111,0,109,97,99,114,111,0,119,97,114,110,0,115,101,114,105,111,117,115,0,101,111,102,0,101,110,100,111,102,102,105,108,101,0,33,115,101,114,105,111,117,115,58,32,0,37,46,51,48,103,0,60,85,78,68,69,70,73,78,69,68,32,70,76,79,65,84,62,0,37,108,100,32,40,48,120,37,108,120,41,0,60,85,78,68,69,70,73,78,69,68,32,73,78,84,62,0,33,101,114,114,111,114,58,32,0,33,119,97,114,110,58,32,0,70,111,117,110,100,32,110,101,119,32,34,33,102,111,114,34,32,115,121,110,116,97,120,46,0,87,114,111,110,103,32,116,121,112,101,32,102,111,114,32,108,111,111,112,39,115,32,69,78,68,32,118,97,108,117,101,32,45,32,109,117,115,116,32,109,97,116,99,104,32,116,121,112,101,32,111,102,32,83,84,65,82,84,32,118,97,108,117,101,46,0,70,111,117,110,100,32,111,108,100,32,34,33,102,111,114,34,32,115,121,110,116,97,120,46,0,76,111,111,112,32,99,111,117,110,116,32,105,115,32,110,101,103,97,116,105,118,101,46,0,84,111,111,32,100,101,101,112,108,121,32,110,101,115,116,101,100,46,32,82,101,99,117,114,115,105,118,101,32,34,33,115,111,117,114,99,101,34,63,0,34,33,115,117,98,122,111,110,101,32,123,125,34,32,105,115,32,111,98,115,111,108,101,116,101,59,32,117,115,101,32,34,33,122,111,110,101,32,123,125,34,32,105,110,115,116,101,97,100,46,0,83,117,98,122,111,110,101,0,83,121,109,98,111,108,32,108,105,115,116,32,102,105,108,101,32,110,97,109,101,32,97,108,114,101,97,100,121,32,99,104,111,115,101,110,46,0,85,110,107,110,111,119,110,32,112,114,111,99,101,115,115,111,114,46,0,34,33,112,115,101,117,100,111,112,99,47,33,114,101,97,108,112,99,34,32,105,115,32,111,98,115,111,108,101,116,101,59,32,117,115,101,32,34,33,112,115,101,117,100,111,112,99,32,123,125,34,32,105,110,115,116,101,97,100,46,0,78,101,103,97,116,105,118,101,32,115,105,122,101,32,97,114,103,117,109,101,110,116,46,0,80,97,100,100,105,110,103,32,119,105,116,104,32,122,101,114,111,101,115,46,0,76,111,97,100,101,100,32,37,100,32,40,48,120,37,48,52,120,41,32,98,121,116,101,115,32,102,114,111,109,32,102,105,108,101,32,111,102,102,115,101,116,32,37,108,100,32,40,48,120,37,48,52,108,120,41,46,10,0,34,33,99,98,109,34,32,105,115,32,111,98,115,111,108,101,116,101,59,32,117,115,101,32,34,33,99,116,32,112,101,116,34,32,105,110,115,116,101,97,100,46,0,85,115,101,100,32,34,33,116,111,34,32,119,105,116,104,111,117,116,32,102,105,108,101,32,102,111,114,109,97,116,32,105,110,100,105,99,97,116,111,114,46,32,68,101,102,97,117,108,116,105,110,103,32,116,111,32,34,99,98,109,34,46,0,85,110,107,110,111,119,110,32,111,117,116,112,117,116,32,102,111,114,109,97,116,46,0,85,110,107,110,111,119,110,32,112,115,101,117,100,111,32,111,112,99,111,100,101,46,0,100,117,114,105,110,103,0,105,110,105,116,0,84,111,111,32,108,97,116,101,32,102,111,114,32,112,111,115,116,102,105,120,46,0,83,121,109,98,111,108,32,97,108,114,101,97,100,121,32,100,101,102,105,110,101,100,46,0,76,97,98,101,108,32,110,97,109,101,32,110,111,116,32,105,110,32,108,101,102,116,109,111,115,116,32,99,111,108,117,109,110,46,0,33,97,100,100,114,0,9,37,115,0,43,50,9,61,32,0,43,51,9,61,32,0,9,61,32,0,37,46,51,48,102,0,36,37,120,0,32,63,0,9,59,32,63,0,9,59,32,117,110,117,115,101,100,0,97,108,32,67,58,37,48,52,120,32,46,37,115,10,0,87,114,111,110,103,32,116,121,112,101,32,45,32,101,120,112,101,99,116,101,100,32,105,110,116,101,103,101,114,46,0,87,114,111,110,103,32,116,121,112,101,32,45,32,101,120,112,101,99,116,101,100,32,97,100,100,114,101,115,115,46,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,46,0,114,119,97,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,1,2,3,4,5,6,7,8,9,255,255,255,255,255,255,255,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,255,255,255,255,255,255,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,1,2,4,7,3,6,5,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+10240);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_i64Subtract"] = _i64Subtract;

   
  Module["_i64Add"] = _i64Add;

   
  Module["_memset"] = _memset;

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Runtime.dynCall('vi', routine, [arg]) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

  
  
  
  
  var _environ=STATICTOP; STATICTOP += 16;;var ___environ=_environ;function ___buildEnvironment(env) {
      // WARNING: Arbitrary limit!
      var MAX_ENV_VALUES = 64;
      var TOTAL_ENV_SIZE = 1024;
  
      // Statically allocate memory for the environment.
      var poolPtr;
      var envPtr;
      if (!___buildEnvironment.called) {
        ___buildEnvironment.called = true;
        // Set default values. Use string keys for Closure Compiler compatibility.
        ENV['USER'] = ENV['LOGNAME'] = 'web_user';
        ENV['PATH'] = '/';
        ENV['PWD'] = '/';
        ENV['HOME'] = '/home/web_user';
        ENV['LANG'] = 'C';
        ENV['_'] = Module['thisProgram'];
        // Allocate memory.
        poolPtr = allocate(TOTAL_ENV_SIZE, 'i8', ALLOC_STATIC);
        envPtr = allocate(MAX_ENV_VALUES * 4,
                          'i8*', ALLOC_STATIC);
        HEAP32[((envPtr)>>2)]=poolPtr;
        HEAP32[((_environ)>>2)]=envPtr;
      } else {
        envPtr = HEAP32[((_environ)>>2)];
        poolPtr = HEAP32[((envPtr)>>2)];
      }
  
      // Collect key=value lines.
      var strings = [];
      var totalSize = 0;
      for (var key in env) {
        if (typeof env[key] === 'string') {
          var line = key + '=' + env[key];
          strings.push(line);
          totalSize += line.length;
        }
      }
      if (totalSize > TOTAL_ENV_SIZE) {
        throw new Error('Environment size exceeded TOTAL_ENV_SIZE!');
      }
  
      // Make new.
      var ptrSize = 4;
      for (var i = 0; i < strings.length; i++) {
        var line = strings[i];
        writeAsciiToMemory(line, poolPtr);
        HEAP32[(((envPtr)+(i * ptrSize))>>2)]=poolPtr;
        poolPtr += line.length + 1;
      }
      HEAP32[(((envPtr)+(strings.length * ptrSize))>>2)]=0;
    }var ENV={};function _getenv(name) {
      // char *getenv(const char *name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/getenv.html
      if (name === 0) return 0;
      name = Pointer_stringify(name);
      if (!ENV.hasOwnProperty(name)) return 0;
  
      if (_getenv.ret) _free(_getenv.ret);
      _getenv.ret = allocate(intArrayFromString(ENV[name]), 'i8', ALLOC_NORMAL);
      return _getenv.ret;
    }

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function _abort() {
      Module['abort']();
    }

  
  
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};
  
  var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};
  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }
  
  var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up--; up) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function (path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      },resolve:function () {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function (from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  
  var TTY={ttys:[],init:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function (dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function (stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function (stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function (stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          for (var i = 0; i < length; i++) {
            try {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              var isPosixPlatform = (process.platform != 'win32'); // Node doesn't offer a direct check, so test by exclusion
  
              var fd = process.stdin.fd;
              if (isPosixPlatform) {
                // Linux and Mac cannot use process.stdin.fd (which isn't set up as sync)
                var usingDevice = false;
                try {
                  fd = fs.openSync('/dev/stdin', 'r');
                  usingDevice = true;
                } catch (e) {}
              }
  
              try {
                bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
              } catch(e) {
                // Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
                // reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
                if (e.toString().indexOf('EOF') != -1) bytesRead = 0;
                else throw e;
              }
  
              if (usingDevice) { fs.closeSync(fd); }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString('utf-8');
              } else {
                result = null;
              }
  
            } else if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  var MEMFS={ops_table:null,mount:function (mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.buffer.byteLength which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },getFileDataAsRegularArray:function (node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr; // Returns a copy of the original data.
        }
        return node.contents; // No-op, the file contents are already in a JS array. Return as-is.
      },getFileDataAsTypedArray:function (node) {
        if (!node.contents) return new Uint8Array;
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function (node, newCapacity) {
        // If we are asked to expand the size of a file that already exists, revert to using a standard JS array to store the file
        // instead of a typed array. This makes resizing the array more flexible because we can just .push() elements at the back to
        // increase the size.
        if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
          node.contents = MEMFS.getFileDataAsRegularArray(node);
          node.usedBytes = node.contents.length; // We might be writing to a lazy-loaded file which had overridden this property, so force-reset it.
        }
  
        if (!node.contents || node.contents.subarray) { // Keep using a typed array if creating a new storage, or if old one was a typed array as well.
          var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
          if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
          // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
          // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
          // avoid overshooting the allocation cap by a very large margin.
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) | 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity); // Allocate new storage.
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
          return;
        }
        // Not using a typed array to back the file storage. Use a standard JS array instead.
        if (!node.contents && newCapacity > 0) node.contents = [];
        while (node.contents.length < newCapacity) node.contents.push(0);
      },resizeFileStorage:function (node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
          return;
        }
        if (!node.contents || node.contents.subarray) { // Resize a typed array if that is being used as the backing store.
          var oldContents = node.contents;
          node.contents = new Uint8Array(new ArrayBuffer(newSize)); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
          return;
        }
        // Backing with a JS array.
        if (!node.contents) node.contents = [];
        if (node.contents.length > newSize) node.contents.length = newSize;
        else while (node.contents.length < newSize) node.contents.push(0);
        node.usedBytes = newSize;
      },node_ops:{getattr:function (node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function (parent, name) {
          throw FS.genericErrors[ERRNO_CODES.ENOENT];
        },mknod:function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function (old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function (parent, name) {
          delete parent.contents[name];
        },rmdir:function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
          delete parent.contents[name];
        },readdir:function (node) {
          var entries = ['.', '..']
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return node.link;
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function (stream, buffer, offset, length, position, canOwn) {
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) { // Can we just reuse the buffer we are given?
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); // Use typed array write if available.
          else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position+length);
          return length;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        },allocate:function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < stream.node.usedBytes) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
            }
            buffer.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};
  
  var IDBFS={dbs:{},indexedDB:function () {
        if (typeof indexedDB !== 'undefined') return indexedDB;
        var ret = null;
        if (typeof window === 'object') ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, 'IDBFS used, but indexedDB not supported');
        return ret;
      },DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
        // reuse all of the core MEMFS functionality
        return MEMFS.mount.apply(null, arguments);
      },syncfs:function (mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
          if (err) return callback(err);
  
          IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);
  
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
  
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },getDB:function (name, callback) {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
  
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return callback(e);
        }
        if (!req) {
          return callback("Unable to connect to IndexedDB");
        }
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          var transaction = e.target.transaction;
  
          var fileStore;
  
          if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
          } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
          }
  
          if (!fileStore.indexNames.contains('timestamp')) {
            fileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = function() {
          db = req.result;
  
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },getLocalSet:function (mount, callback) {
        var entries = {};
  
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return function(p) {
            return PATH.join2(root, p);
          }
        };
  
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  
        while (check.length) {
          var path = check.pop();
          var stat;
  
          try {
            stat = FS.stat(path);
          } catch (e) {
            return callback(e);
          }
  
          if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
          }
  
          entries[path] = { timestamp: stat.mtime };
        }
  
        return callback(null, { type: 'local', entries: entries });
      },getRemoteSet:function (mount, callback) {
        var entries = {};
  
        IDBFS.getDB(mount.mountpoint, function(err, db) {
          if (err) return callback(err);
  
          var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
          transaction.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
          };
  
          var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
          var index = store.index('timestamp');
  
          index.openKeyCursor().onsuccess = function(event) {
            var cursor = event.target.result;
  
            if (!cursor) {
              return callback(null, { type: 'remote', db: db, entries: entries });
            }
  
            entries[cursor.primaryKey] = { timestamp: cursor.key };
  
            cursor.continue();
          };
        });
      },loadLocalEntry:function (path, callback) {
        var stat, node;
  
        try {
          var lookup = FS.lookupPath(path);
          node = lookup.node;
          stat = FS.stat(path);
        } catch (e) {
          return callback(e);
        }
  
        if (FS.isDir(stat.mode)) {
          return callback(null, { timestamp: stat.mtime, mode: stat.mode });
        } else if (FS.isFile(stat.mode)) {
          // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
          // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
          node.contents = MEMFS.getFileDataAsTypedArray(node);
          return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node.contents });
        } else {
          return callback(new Error('node type not supported'));
        }
      },storeLocalEntry:function (path, entry, callback) {
        try {
          if (FS.isDir(entry.mode)) {
            FS.mkdir(path, entry.mode);
          } else if (FS.isFile(entry.mode)) {
            FS.writeFile(path, entry.contents, { encoding: 'binary', canOwn: true });
          } else {
            return callback(new Error('node type not supported'));
          }
  
          FS.chmod(path, entry.mode);
          FS.utime(path, entry.timestamp, entry.timestamp);
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },removeLocalEntry:function (path, callback) {
        try {
          var lookup = FS.lookupPath(path);
          var stat = FS.stat(path);
  
          if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
          } else if (FS.isFile(stat.mode)) {
            FS.unlink(path);
          }
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },loadRemoteEntry:function (store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) { callback(null, event.target.result); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },storeRemoteEntry:function (store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },removeRemoteEntry:function (store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },reconcile:function (src, dst, callback) {
        var total = 0;
  
        var create = [];
        Object.keys(src.entries).forEach(function (key) {
          var e = src.entries[key];
          var e2 = dst.entries[key];
          if (!e2 || e.timestamp > e2.timestamp) {
            create.push(key);
            total++;
          }
        });
  
        var remove = [];
        Object.keys(dst.entries).forEach(function (key) {
          var e = dst.entries[key];
          var e2 = src.entries[key];
          if (!e2) {
            remove.push(key);
            total++;
          }
        });
  
        if (!total) {
          return callback(null);
        }
  
        var errored = false;
        var completed = 0;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= total) {
            return callback(null);
          }
        };
  
        transaction.onerror = function(e) {
          done(this.error);
          e.preventDefault();
        };
  
        // sort paths in ascending order so directory entries are created
        // before the files inside them
        create.sort().forEach(function (path) {
          if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeLocalEntry(path, entry, done);
            });
          } else {
            IDBFS.loadLocalEntry(path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeRemoteEntry(store, path, entry, done);
            });
          }
        });
  
        // sort paths in descending order so files are deleted before their
        // parent directories
        remove.sort().reverse().forEach(function(path) {
          if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
          } else {
            IDBFS.removeRemoteEntry(store, path, done);
          }
        });
      }};
  
  var NODEFS={isWindows:false,staticInit:function () {
        NODEFS.isWindows = !!process.platform.match(/^win/);
      },mount:function (mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
      },createNode:function (parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node;
      },getMode:function (path) {
        var stat;
        try {
          stat = fs.lstatSync(path);
          if (NODEFS.isWindows) {
            // On Windows, directories return permission bits 'rw-rw-rw-', even though they have 'rwxrwxrwx', so
            // propagate write bits to execute bits.
            stat.mode = stat.mode | ((stat.mode & 146) >> 1);
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return stat.mode;
      },realPath:function (node) {
        var parts = [];
        while (node.parent !== node) {
          parts.push(node.name);
          node = node.parent;
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts);
      },flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:function (flags) {
        flags &= ~010000000 /*O_PATH*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~00004000 /*O_NONBLOCK*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~0100000 /*O_LARGEFILE*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~02000000 /*O_CLOEXEC*/; // Some applications may pass it; it makes no sense for a single process.
        if (flags in NODEFS.flagsToPermissionStringMap) {
          return NODEFS.flagsToPermissionStringMap[flags];
        } else {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
      },node_ops:{getattr:function (node) {
          var path = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs.lstatSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
          // See http://support.microsoft.com/kb/140365
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
          }
          return {
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            rdev: stat.rdev,
            size: stat.size,
            atime: stat.atime,
            mtime: stat.mtime,
            ctime: stat.ctime,
            blksize: stat.blksize,
            blocks: stat.blocks
          };
        },setattr:function (node, attr) {
          var path = NODEFS.realPath(node);
          try {
            if (attr.mode !== undefined) {
              fs.chmodSync(path, attr.mode);
              // update the common node structure mode as well
              node.mode = attr.mode;
            }
            if (attr.timestamp !== undefined) {
              var date = new Date(attr.timestamp);
              fs.utimesSync(path, date, date);
            }
            if (attr.size !== undefined) {
              fs.truncateSync(path, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },lookup:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path);
          return NODEFS.createNode(parent, name, mode);
        },mknod:function (parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          // create the backing node for this in the fs root as well
          var path = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs.mkdirSync(path, node.mode);
            } else {
              fs.writeFileSync(path, '', { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return node;
        },rename:function (oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },unlink:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.unlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },rmdir:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.rmdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readdir:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },symlink:function (parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readlink:function (node) {
          var path = NODEFS.realPath(node);
          try {
            path = fs.readlinkSync(path);
            path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
            return path;
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }},stream_ops:{open:function (stream) {
          var path = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },close:function (stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },read:function (stream, buffer, offset, length, position) {
          if (length === 0) return 0; // node errors on 0 length reads
          // FIXME this is terrible.
          var nbuffer = new Buffer(length);
          var res;
          try {
            res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          if (res > 0) {
            for (var i = 0; i < res; i++) {
              buffer[offset + i] = nbuffer[i];
            }
          }
          return res;
        },write:function (stream, buffer, offset, length, position) {
          // FIXME this is terrible.
          var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
          var res;
          try {
            res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return res;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
              }
            }
          }
  
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
  
          return position;
        }}};
  
  var WORKERFS={DIR_MODE:16895,FILE_MODE:33279,reader:null,mount:function (mount) {
        assert(ENVIRONMENT_IS_WORKER);
        if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
        var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
        var createdParents = {};
        function ensureParent(path) {
          // return the parent node, creating subdirs as necessary
          var parts = path.split('/');
          var parent = root;
          for (var i = 0; i < parts.length-1; i++) {
            var curr = parts.slice(0, i+1).join('/');
            // Issue 4254: Using curr as a node name will prevent the node
            // from being found in FS.nameTable when FS.open is called on
            // a path which holds a child of this node,
            // given that all FS functions assume node names
            // are just their corresponding parts within their given path,
            // rather than incremental aggregates which include their parent's
            // directories.
            if (!createdParents[curr]) {
              createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
            }
            parent = createdParents[curr];
          }
          return parent;
        }
        function base(path) {
          var parts = path.split('/');
          return parts[parts.length-1];
        }
        // We also accept FileList here, by using Array.prototype
        Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
          WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
        });
        (mount.opts["blobs"] || []).forEach(function(obj) {
          WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
        });
        (mount.opts["packages"] || []).forEach(function(pack) {
          pack['metadata'].files.forEach(function(file) {
            var name = file.filename.substr(1); // remove initial slash
            WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack['blob'].slice(file.start, file.end));
          });
        });
        return root;
      },createNode:function (parent, name, mode, dev, contents, mtime) {
        var node = FS.createNode(parent, name, mode);
        node.mode = mode;
        node.node_ops = WORKERFS.node_ops;
        node.stream_ops = WORKERFS.stream_ops;
        node.timestamp = (mtime || new Date).getTime();
        assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
        if (mode === WORKERFS.FILE_MODE) {
          node.size = contents.size;
          node.contents = contents;
        } else {
          node.size = 4096;
          node.contents = {};
        }
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },node_ops:{getattr:function (node) {
          return {
            dev: 1,
            ino: undefined,
            mode: node.mode,
            nlink: 1,
            uid: 0,
            gid: 0,
            rdev: undefined,
            size: node.size,
            atime: new Date(node.timestamp),
            mtime: new Date(node.timestamp),
            ctime: new Date(node.timestamp),
            blksize: 4096,
            blocks: Math.ceil(node.size / 4096),
          };
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
        },lookup:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        },mknod:function (parent, name, mode, dev) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rename:function (oldNode, newDir, newName) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },unlink:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rmdir:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readdir:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },symlink:function (parent, newName, oldPath) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readlink:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          if (position >= stream.node.size) return 0;
          var chunk = stream.node.contents.slice(position, position + length);
          var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
          buffer.set(new Uint8Array(ab), offset);
          return chunk.size;
        },write:function (stream, buffer, offset, length, position) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.size;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        }}};
  
  var _stdin=STATICTOP; STATICTOP += 16;;
  
  var _stdout=STATICTOP; STATICTOP += 16;;
  
  var _stderr=STATICTOP; STATICTOP += 16;;var FS={root:null,mounts:[],devices:[null],streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,syncFSRequests:0,handleFSError:function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function (path, opts) {
        path = PATH.resolve(FS.cwd(), path);
        opts = opts || {};
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
        }
  
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function (node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function (parentid, name) {
        var hash = 0;
  
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function (parent, name) {
        var err = FS.mayLookup(parent);
        if (err) {
          throw new FS.ErrnoError(err, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function (parent, name, mode, rdev) {
        if (!FS.FSNode) {
          FS.FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
              parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
          };
  
          FS.FSNode.prototype = {};
  
          // compatibility
          var readMode = 292 | 73;
          var writeMode = 146;
  
          // NOTE we must use Object.defineProperties instead of individual calls to
          // Object.defineProperty in order to make closure compiler happy
          Object.defineProperties(FS.FSNode.prototype, {
            read: {
              get: function() { return (this.mode & readMode) === readMode; },
              set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
              get: function() { return (this.mode & writeMode) === writeMode; },
              set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
              get: function() { return FS.isDir(this.mode); }
            },
            isDevice: {
              get: function() { return FS.isChrdev(this.mode); }
            }
          });
        }
  
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },destroyNode:function (node) {
        FS.hashRemoveNode(node);
      },isRoot:function (node) {
        return node === node.parent;
      },isMountpoint:function (node) {
        return !!node.mounted;
      },isFile:function (mode) {
        return (mode & 61440) === 32768;
      },isDir:function (mode) {
        return (mode & 61440) === 16384;
      },isLink:function (mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function (mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function (mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function (mode) {
        return (mode & 61440) === 4096;
      },isSocket:function (mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function (flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return ERRNO_CODES.EACCES;
        }
        return 0;
      },mayLookup:function (dir) {
        var err = FS.nodePermissions(dir, 'x');
        if (err) return err;
        if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
        return 0;
      },mayCreate:function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return ERRNO_CODES.EEXIST;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function (dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var err = FS.nodePermissions(dir, 'wx');
        if (err) {
          return err;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return ERRNO_CODES.ENOTDIR;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return ERRNO_CODES.EBUSY;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return 0;
      },mayOpen:function (node, flags) {
        if (!node) {
          return ERRNO_CODES.ENOENT;
        }
        if (FS.isLink(node.mode)) {
          return ERRNO_CODES.ELOOP;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return ERRNO_CODES.EISDIR;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
      },getStream:function (fd) {
        return FS.streams[fd];
      },createStream:function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function(){};
          FS.FSStream.prototype = {};
          // compatibility
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          });
        }
        // clone it, so we can return an instance of FSStream
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function (fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function () {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }},major:function (dev) {
        return ((dev) >> 8);
      },minor:function (dev) {
        return ((dev) & 0xff);
      },makedev:function (ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function (dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function (dev) {
        return FS.devices[dev];
      },getMounts:function (mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function (populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          console.log('warning: ' + FS.syncFSRequests + ' FS.syncfs operations in flight at once, probably just doing extra work');
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(err) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(err);
        }
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(err);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },mount:function (type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
          }
        }
  
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },unmount:function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.indexOf(current.mount) !== -1) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },lookup:function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function (path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function (path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function (path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdev:function (path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function (oldpath, newpath) {
        if (!PATH.resolve(oldpath)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        // new path should not be an ancestor of the old path
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        err = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          err = FS.nodePermissions(old_dir, 'w');
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        try {
          if (FS.trackingDelegate['willMovePath']) {
            FS.trackingDelegate['willMovePath'](old_path, new_path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate['onMovePath']) FS.trackingDelegate['onMovePath'](old_path, new_path);
        } catch(e) {
          console.log("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        return node.node_ops.readdir(node);
      },unlink:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, false);
        if (err) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },stat:function (path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return node.node_ops.getattr(node);
      },lstat:function (path) {
        return FS.stat(path, true);
      },chmod:function (path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function (path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chmod(stream.node, mode);
      },chown:function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        FS.truncate(stream.node, len);
      },utime:function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var err = FS.mayOpen(node, flags);
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            Module['printErr']('read file: ' + path);
          }
        }
        try {
          if (FS.trackingDelegate['onOpenFile']) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate['onOpenFile'](path, trackingFlags);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function (stream) {
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
      },llseek:function (stream, offset, whence) {
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          console.log("FS.trackingDelegate['onWriteToFile']('"+path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function (stream, offset, length) {
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function (stream, buffer, offset, length, position, prot, flags) {
        // TODO if PROT is PROT_WRITE, make sure we have write access
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EACCES);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },msync:function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function (stream) {
        return 0;
      },ioctl:function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'r';
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },writeFile:function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'w';
        opts.encoding = opts.encoding || 'utf8';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var stream = FS.open(path, opts.flags, opts.mode);
        if (opts.encoding === 'utf8') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn);
        } else if (opts.encoding === 'binary') {
          FS.write(stream, data, 0, data.length, 0, opts.canOwn);
        }
        FS.close(stream);
      },cwd:function () {
        return FS.currentPath;
      },chdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function () {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function () {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function(stream, buffer, offset, length, pos) { return length; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using Module['printErr']
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        var random_device;
        if (typeof crypto !== 'undefined') {
          // for modern web browsers
          var randomBuffer = new Uint8Array(1);
          random_device = function() { crypto.getRandomValues(randomBuffer); return randomBuffer[0]; };
        } else if (ENVIRONMENT_IS_NODE) {
          // for nodejs
          random_device = function() { return require('crypto').randomBytes(1)[0]; };
        } else {
          // default for ES5 platforms
          random_device = function() { return (Math.random()*256)|0; };
        }
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createSpecialDirectories:function () {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount: function() {
            var node = FS.createNode('/proc/self', 'fd', 16384 | 0777, 73);
            node.node_ops = {
              lookup: function(parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: function() { return stream.path } }
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },createStandardStreams:function () {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 'r');
        assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');
  
        var stdout = FS.open('/dev/stdout', 'w');
        assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');
  
        var stderr = FS.open('/dev/stderr', 'w');
        assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
      },ensureErrnoError:function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          //Module.printErr(stackTrace()); // useful for debugging
          this.node = node;
          this.setErrno = function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [ERRNO_CODES.ENOENT].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function () {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
          'IDBFS': IDBFS,
          'NODEFS': NODEFS,
          'WORKERFS': WORKERFS,
        };
      },init:function (input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function () {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        var fflush = Module['_fflush'];
        if (fflush) fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function (relative, base) {
        return PATH.resolve(base, relative);
      },standardizePath:function (path) {
        return PATH.normalize(path);
      },findObject:function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function (path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createFolder:function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function (parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 'w');
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        }
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        }
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
          var lazyArray = this;
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        }
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init(); // XXX perhaps this method should move onto Browser?
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency('cp ' + fullname); // might have several active requests for the same fullname
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function () {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          console.log('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};var SYSCALLS={DEFAULT_POLLMASK:5,mappings:{},umask:511,calculateAt:function (dirfd, path) {
        if (path[0] !== '/') {
          // relative path
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            dir = dirstream.path;
          }
          path = PATH.join2(dir, path);
        }
        return path;
      },doStat:function (func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -ERRNO_CODES.ENOTDIR;
          }
          throw e;
        }
        HEAP32[((buf)>>2)]=stat.dev;
        HEAP32[(((buf)+(4))>>2)]=0;
        HEAP32[(((buf)+(8))>>2)]=stat.ino;
        HEAP32[(((buf)+(12))>>2)]=stat.mode;
        HEAP32[(((buf)+(16))>>2)]=stat.nlink;
        HEAP32[(((buf)+(20))>>2)]=stat.uid;
        HEAP32[(((buf)+(24))>>2)]=stat.gid;
        HEAP32[(((buf)+(28))>>2)]=stat.rdev;
        HEAP32[(((buf)+(32))>>2)]=0;
        HEAP32[(((buf)+(36))>>2)]=stat.size;
        HEAP32[(((buf)+(40))>>2)]=4096;
        HEAP32[(((buf)+(44))>>2)]=stat.blocks;
        HEAP32[(((buf)+(48))>>2)]=(stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(52))>>2)]=0;
        HEAP32[(((buf)+(56))>>2)]=(stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)]=0;
        HEAP32[(((buf)+(64))>>2)]=(stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)]=0;
        HEAP32[(((buf)+(72))>>2)]=stat.ino;
        return 0;
      },doMsync:function (addr, stream, len, flags) {
        var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
        FS.msync(stream, buffer, 0, len, flags);
      },doMkdir:function (path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function (path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -ERRNO_CODES.EINVAL;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function (path, buf, bufsize) {
        if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
        var ret = FS.readlink(path);
        ret = ret.slice(0, Math.max(0, bufsize));
        writeStringToMemory(ret, buf, true);
        return ret.length;
      },doAccess:function (path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -ERRNO_CODES.EINVAL;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -ERRNO_CODES.EACCES;
        }
        return 0;
      },doDup:function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.read(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break; // nothing more to read
        }
        return ret;
      },doWritev:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },getStreamFromFD:function () {
        var stream = FS.getStream(SYSCALLS.get());
        if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return stream;
      },getSocketFromFD:function () {
        var socket = SOCKFS.getSocket(SYSCALLS.get());
        if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return socket;
      },getSocketAddress:function (allowNull) {
        var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
        if (allowNull && addrp === 0) return null;
        var info = __read_sockaddr(addrp, addrlen);
        if (info.errno) throw new FS.ErrnoError(info.errno);
        info.addr = DNS.lookup_addr(info.addr) || info.addr;
        return info;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall5(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // open
      var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get() // optional TODO
      var stream = FS.open(pathname, flags, mode);
      return stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___lock() {}

  function ___unlock() {}

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC); 
  Module["_llvm_cttz_i32"] = _llvm_cttz_i32; 
  Module["___udivmoddi4"] = ___udivmoddi4; 
  Module["___udivdi3"] = ___udivdi3;

  
   
  Module["___muldsi3"] = ___muldsi3; 
  Module["___muldi3"] = ___muldi3;

  function _llvm_stackrestore(p) {
      var self = _llvm_stacksave;
      var ret = self.LLVM_SAVEDSTACKS[p];
      self.LLVM_SAVEDSTACKS.splice(p, 1);
      Runtime.stackRestore(ret);
    }

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

  function _llvm_stacksave() {
      var self = _llvm_stacksave;
      if (!self.LLVM_SAVEDSTACKS) {
        self.LLVM_SAVEDSTACKS = [];
      }
      self.LLVM_SAVEDSTACKS.push(Runtime.stackSave());
      return self.LLVM_SAVEDSTACKS.length-1;
    }

   
  Module["___uremdi3"] = ___uremdi3;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  
  function __exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      Module['exit'](status);
    }function _exit(status) {
      __exit(status);
    }

  var _llvm_pow_f64=Math_pow;

   
  Module["_pthread_self"] = _pthread_self;

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doWritev(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
      switch (op) {
        case 21505: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        case 21506: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          var argp = SYSCALLS.get();
          HEAP32[((argp)>>2)]=0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return -ERRNO_CODES.EINVAL; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.get();
          return FS.ioctl(stream, op, argp);
        }
        default: abort('bad ioctl syscall ' + op);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall221(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // fcntl64
      var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -ERRNO_CODES.EINVAL;
          }
          var newStream;
          newStream = FS.open(stream.path, stream.flags, 0, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 12:
        case 12: {
          var arg = SYSCALLS.get();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)]=2;
          return 0;
        }
        case 13:
        case 14:
        case 13:
        case 14:
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -ERRNO_CODES.EINVAL; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fnctl() returns that, and we set errno ourselves.
          ___setErrNo(ERRNO_CODES.EINVAL);
          return -1;
        default: {
          return -ERRNO_CODES.EINVAL;
        }
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall145(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // readv
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doReadv(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
___buildEnvironment(ENV);;
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;Module["FS_unlink"] = FS.unlink;;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });;
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); };
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);



function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "invoke_i": invoke_i, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_vii": invoke_vii, "invoke_vi": invoke_vi, "_pthread_cleanup_pop": _pthread_cleanup_pop, "___syscall221": ___syscall221, "_llvm_pow_f64": _llvm_pow_f64, "_abort": _abort, "___syscall5": ___syscall5, "_llvm_stackrestore": _llvm_stackrestore, "___buildEnvironment": ___buildEnvironment, "___setErrNo": ___setErrNo, "_sbrk": _sbrk, "_emscripten_memcpy_big": _emscripten_memcpy_big, "__exit": __exit, "_llvm_stacksave": _llvm_stacksave, "_getenv": _getenv, "___syscall54": ___syscall54, "___unlock": ___unlock, "___lock": ___lock, "___syscall6": ___syscall6, "_pthread_cleanup_push": _pthread_cleanup_push, "___syscall140": ___syscall140, "_exit": _exit, "___syscall145": ___syscall145, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'use asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var invoke_i=env.invoke_i;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_vii=env.invoke_vii;
  var invoke_vi=env.invoke_vi;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var ___syscall221=env.___syscall221;
  var _llvm_pow_f64=env._llvm_pow_f64;
  var _abort=env._abort;
  var ___syscall5=env.___syscall5;
  var _llvm_stackrestore=env._llvm_stackrestore;
  var ___buildEnvironment=env.___buildEnvironment;
  var ___setErrNo=env.___setErrNo;
  var _sbrk=env._sbrk;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var __exit=env.__exit;
  var _llvm_stacksave=env._llvm_stacksave;
  var _getenv=env._getenv;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var ___lock=env.___lock;
  var ___syscall6=env.___syscall6;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var ___syscall140=env.___syscall140;
  var _exit=env._exit;
  var ___syscall145=env.___syscall145;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _ACME_finalize($0) {
 $0 = $0|0;
 var $$0 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = HEAP32[4387]|0;
 $2 = ($1|0)==(0|0);
 if (!($2)) {
  $3 = HEAP32[4099]|0;
  $4 = ($3|0)==(0|0);
  if (!($4)) {
   (_fclose($3)|0);
   HEAP32[4099] = 0;
  }
 }
 $5 = HEAP32[4092]|0;
 $6 = ($5|0)==(0|0);
 do {
  if ($6) {
   $$0 = $0;
  } else {
   $7 = (_fopen($5,6054)|0);
   $8 = ($7|0)==(0|0);
   if ($8) {
    $9 = HEAP32[1342]|0;
    $10 = HEAP32[4092]|0;
    HEAP32[$vararg_buffer>>2] = $10;
    (_fprintf($9,6056,$vararg_buffer)|0);
    $$0 = 1;
    break;
   } else {
    _symbols_list($7);
    (_fclose($7)|0);
    $$0 = $0;
    break;
   }
  }
 } while(0);
 $11 = HEAP32[4093]|0;
 $12 = ($11|0)==(0|0);
 if ($12) {
  $$1 = $$0;
  STACKTOP = sp;return ($$1|0);
 }
 $13 = (_fopen($11,6054)|0);
 $14 = ($13|0)==(0|0);
 if ($14) {
  $15 = HEAP32[1342]|0;
  $16 = HEAP32[4093]|0;
  HEAP32[$vararg_buffer1>>2] = $16;
  (_fprintf($15,6099,$vararg_buffer1)|0);
  $$1 = 1;
  STACKTOP = sp;return ($$1|0);
 } else {
  _symbols_vicelabels($13);
  (_fclose($13)|0);
  $$1 = $$0;
  STACKTOP = sp;return ($$1|0);
 }
 return (0)|0;
}
function _main($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$012$i = 0, $$pre$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $or$cond$i = 0, $phitmp$i = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $2 = ($0|0)==(1);
 if ($2) {
  _show_help_and_exit();
  // unreachable;
 }
 $3 = HEAP32[1342]|0;
 HEAP32[4385] = $3;
 (_cliargs_init($0,$1)|0);
 _DynaBuf_init();
 _AnyOS_entry();
 _cliargs_handle_options(11,12);
 _cliargs_get_rest(16384,16388,6146);
 _ALU_init();
 _Macro_init();
 _Mnemo_init();
 $4 = HEAP32[4]|0;
 _Output_init($4);
 _pseudoopcodes_init();
 HEAP32[4387] = 16396;
 ;HEAP32[16396>>2]=0|0;HEAP32[16396+4>>2]=0|0;HEAP32[16396+8>>2]=0|0;HEAP32[16396+12>>2]=0|0;
 $5 = HEAP32[4383]|0;
 $6 = ($5|0)>(1);
 $7 = $3;
 if ($6) {
  (_puts(8485)|0);
 }
 HEAP32[4388] = 0;
 $8 = (_perform_pass()|0);
 $9 = ($8|0)==(0);
 if (!($9)) {
  $$012$i = $8;
  while(1) {
   $10 = HEAP32[4388]|0;
   $11 = (($10) + 1)|0;
   HEAP32[4388] = $11;
   $12 = HEAP32[4383]|0;
   $13 = ($12|0)>(1);
   if ($13) {
    (_puts(8497)|0);
   }
   $14 = (_perform_pass()|0);
   $15 = ($14|0)!=(0);
   $16 = ($14|0)<($$012$i|0);
   $or$cond$i = $15 & $16;
   if ($or$cond$i) {
    $$012$i = $14;
   } else {
    break;
   }
  }
  $phitmp$i = ($14|0)==(0);
  if (!($phitmp$i)) {
   $30 = HEAP32[4383]|0;
   $31 = ($30|0)>(1);
   if ($31) {
    (_puts(8550)|0);
   }
   HEAP32[4363] = 1;
   $32 = HEAP32[4388]|0;
   $33 = (($32) + 1)|0;
   HEAP32[4388] = $33;
   (_perform_pass()|0);
   $39 = (_ACME_finalize(0)|0);
   STACKTOP = sp;return ($39|0);
  }
 }
 $17 = HEAP32[4095]|0;
 $18 = ($17|0)==(0|0);
 do {
  if (!($18)) {
   $19 = HEAP32[4383]|0;
   $20 = ($19|0)>(1);
   if ($20) {
    (_puts(8511)|0);
    $$pre$i = HEAP32[4095]|0;
    $21 = $$pre$i;
   } else {
    $21 = $17;
   }
   $22 = (_fopen($21,6054)|0);
   HEAP32[4099] = $22;
   $23 = ($22|0)==(0|0);
   if ($23) {
    HEAP32[$vararg_buffer>>2] = $21;
    (_fprintf($7,8689,$vararg_buffer)|0);
    break;
   }
   $24 = HEAP32[4388]|0;
   $25 = (($24) + 1)|0;
   HEAP32[4388] = $25;
   (_perform_pass()|0);
   $26 = HEAP32[4387]|0;
   $27 = ($26|0)==(0|0);
   if (!($27)) {
    $28 = HEAP32[4099]|0;
    $29 = ($28|0)==(0|0);
    if (!($29)) {
     (_fclose($28)|0);
     HEAP32[4099] = 0;
    }
   }
  }
 } while(0);
 $34 = HEAP32[4094]|0;
 $35 = ($34|0)==(0|0);
 if ($35) {
  (_fwrite(8727,75,1,$7)|0);
  $39 = (_ACME_finalize(0)|0);
  STACKTOP = sp;return ($39|0);
 }
 $36 = (_fopen($34,8803)|0);
 $37 = ($36|0)==(0|0);
 if ($37) {
  $38 = HEAP32[4094]|0;
  HEAP32[$vararg_buffer1>>2] = $38;
  (_fprintf($7,8806,$vararg_buffer1)|0);
  $39 = (_ACME_finalize(0)|0);
  STACKTOP = sp;return ($39|0);
 } else {
  _Output_save_file($36);
  (_fclose($36)|0);
  $39 = (_ACME_finalize(0)|0);
  STACKTOP = sp;return ($39|0);
 }
 return (0)|0;
}
function _show_help_and_exit() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 (_puts(6173)|0);
 _show_version(0);
 (_puts(6267)|0);
 _exit(0);
 // unreachable;
}
function _short_option($0) {
 $0 = $0|0;
 var $$0$i = 0, $$0$i$i = 0, $$011 = 0, $$015$i$i = 0, $$018 = 0, $$1 = 0, $$off = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 12|0;
 $2 = HEAP8[$0>>0]|0;
 $3 = ($2<<24>>24)==(0);
 if ($3) {
  $$011 = 0;
  STACKTOP = sp;return ($$011|0);
 } else {
  $$018 = $0;$5 = $2;
 }
 L3: while(1) {
  $4 = $5 << 24 >> 24;
  switch ($4|0) {
  case 68:  {
   label = 3;
   break L3;
   break;
  }
  case 104:  {
   label = 17;
   break L3;
   break;
  }
  case 86:  {
   label = 25;
   break L3;
   break;
  }
  case 87:  {
   label = 26;
   break L3;
   break;
  }
  case 102:  {
   $26 = (_cliargs_safe_get_next(8101)|0);
   $27 = HEAP32[4380]|0;
   $28 = ((($27)) + 4|0);
   HEAP32[$28>>2] = 0;
   _DynaBuf_add_string($27,$26);
   $29 = HEAP32[4380]|0;
   _DynaBuf_append($29,0);
   $30 = HEAP32[4380]|0;
   _DynaBuf_to_lower($30,$30);
   $31 = (_outputfile_set_format()|0);
   $32 = ($31|0)==(0);
   if ($32) {
    $$1 = $$018;
   } else {
    label = 19;
    break L3;
   }
   break;
  }
  case 111:  {
   $34 = (_cliargs_safe_get_next(7956)|0);
   HEAP32[4094] = $34;
   $$1 = $$018;
   break;
  }
  case 108:  {
   $35 = (_cliargs_safe_get_next(7972)|0);
   HEAP32[4092] = $35;
   $$1 = $$018;
   break;
  }
  case 114:  {
   $36 = (_cliargs_safe_get_next(7993)|0);
   HEAP32[4095] = $36;
   $$1 = $$018;
   break;
  }
  case 118:  {
   $37 = HEAP32[4383]|0;
   $38 = (($37) + 1)|0;
   HEAP32[4383] = $38;
   $39 = ((($$018)) + 1|0);
   $40 = HEAP8[$39>>0]|0;
   $$off = (($40) + -48)<<24>>24;
   $41 = ($$off&255)<(10);
   if ($41) {
    $42 = $40 << 24 >> 24;
    $43 = (($42) + -48)|0;
    HEAP32[4383] = $43;
    $$1 = $39;
   } else {
    $$1 = $$018;
   }
   break;
  }
  default: {
   $$011 = $5;
   label = 34;
   break L3;
  }
  }
  $52 = ((($$1)) + 1|0);
  $53 = HEAP8[$52>>0]|0;
  $54 = ($53<<24>>24)==(0);
  if ($54) {
   $$011 = 0;
   label = 34;
   break;
  } else {
   $$018 = $52;$5 = $53;
  }
 }
 if ((label|0) == 3) {
  $6 = ((($$018)) + 1|0);
  $7 = HEAP32[4380]|0;
  $8 = ((($7)) + 4|0);
  HEAP32[$8>>2] = 0;
  $$0$i = $6;
  L15: while(1) {
   $9 = HEAP8[$$0$i>>0]|0;
   switch ($9<<24>>24) {
   case 61:  {
    break L15;
    break;
   }
   case 0:  {
    label = 7;
    break L15;
    break;
   }
   default: {
   }
   }
   $10 = HEAP32[4380]|0;
   $11 = ((($$0$i)) + 1|0);
   _DynaBuf_append($10,$9);
   $$0$i = $11;
  }
  if ((label|0) == 7) {
   _could_not_parse($6);
   // unreachable;
  }
  $12 = ((($$0$i)) + 1|0);
  $13 = HEAP8[$12>>0]|0;
  $14 = ($13<<24>>24)==(0);
  if ($14) {
   _could_not_parse($6);
   // unreachable;
  }
  L24: do {
   switch ($13<<24>>24) {
   case 37:  {
    $15 = ((($$0$i)) + 2|0);
    $$0$i$i = 2;$$015$i$i = $15;
    break;
   }
   case 38:  {
    $16 = ((($$0$i)) + 2|0);
    $$0$i$i = 8;$$015$i$i = $16;
    break;
   }
   case 36:  {
    $17 = ((($$0$i)) + 2|0);
    $$0$i$i = 16;$$015$i$i = $17;
    break;
   }
   case 48:  {
    $18 = ((($$0$i)) + 2|0);
    $19 = HEAP8[$18>>0]|0;
    switch ($19<<24>>24) {
    case 88: case 120:  {
     break;
    }
    default: {
     $$0$i$i = 10;$$015$i$i = $12;
     break L24;
    }
    }
    $20 = ((($$0$i)) + 3|0);
    $$0$i$i = 16;$$015$i$i = $20;
    break;
   }
   default: {
    $$0$i$i = 10;$$015$i$i = $12;
   }
   }
  } while(0);
  $21 = (_strtol($$015$i$i,$1,$$0$i$i)|0);
  $22 = HEAP32[$1>>2]|0;
  $23 = HEAP8[$22>>0]|0;
  $24 = ($23<<24>>24)==(0);
  if (!($24)) {
   _could_not_parse($22);
   // unreachable;
  }
  $25 = HEAP32[4380]|0;
  _DynaBuf_append($25,0);
  _symbol_define($21);
  $$011 = 0;
  STACKTOP = sp;return ($$011|0);
 }
 else if ((label|0) == 17) {
  _show_help_and_exit();
  // unreachable;
 }
 else if ((label|0) == 19) {
  $33 = HEAP32[1342]|0;
  HEAP32[$vararg_buffer>>2] = 9321;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 12081;
  (_fprintf($33,8115,$vararg_buffer)|0);
  _exit(1);
  // unreachable;
 }
 else if ((label|0) == 25) {
  (_puts(7869)|0);
  _exit(0);
  // unreachable;
 }
 else if ((label|0) == 26) {
  $44 = ((($$018)) + 1|0);
  $45 = (_strcmp($44,8009)|0);
  $46 = ($45|0)==(0);
  if ($46) {
   HEAP32[242] = 0;
   $$011 = 0;
   STACKTOP = sp;return ($$011|0);
  }
  $47 = (_strcmp($44,8025)|0);
  $48 = ($47|0)==(0);
  if ($48) {
   HEAP32[243] = 0;
   $$011 = 0;
   STACKTOP = sp;return ($$011|0);
  }
  $49 = (_strcmp($44,8036)|0);
  $50 = ($49|0)==(0);
  if (!($50)) {
   $51 = HEAP32[1342]|0;
   HEAP32[$vararg_buffer2>>2] = 9321;
   (_fprintf($51,8050,$vararg_buffer2)|0);
   _exit(1);
   // unreachable;
  }
  HEAP32[4384] = 1;
  $$011 = 0;
  STACKTOP = sp;return ($$011|0);
 }
 else if ((label|0) == 34) {
  STACKTOP = sp;return ($$011|0);
 }
 return (0)|0;
}
function _long_option($0) {
 $0 = $0|0;
 var $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i18 = 0, $$0$i21 = 0, $$015$i = 0, $$015$i$i = 0, $$015$i$i17 = 0, $$015$i20 = 0, $$off$i = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $11 = 0, $12 = 0;
 var $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0;
 var $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0;
 var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_buffer5 = 0, $vararg_buffer9 = 0, $vararg_ptr1 = 0;
 var $vararg_ptr8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer9 = sp + 24|0;
 $vararg_buffer5 = sp + 16|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 28|0;
 $2 = (_strcmp($0,8165)|0);
 $3 = ($2|0)==(0);
 if ($3) {
  _show_help_and_exit();
  // unreachable;
 }
 $4 = (_strcmp($0,8170)|0);
 $5 = ($4|0)==(0);
 if ($5) {
  $6 = (_cliargs_safe_get_next(8101)|0);
  $7 = HEAP32[4380]|0;
  $8 = ((($7)) + 4|0);
  HEAP32[$8>>2] = 0;
  _DynaBuf_add_string($7,$6);
  $9 = HEAP32[4380]|0;
  _DynaBuf_append($9,0);
  $10 = HEAP32[4380]|0;
  _DynaBuf_to_lower($10,$10);
  $11 = (_outputfile_set_format()|0);
  $12 = ($11|0)==(0);
  if ($12) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  } else {
   $13 = HEAP32[1342]|0;
   HEAP32[$vararg_buffer>>2] = 9321;
   $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
   HEAP32[$vararg_ptr1>>2] = 12081;
   (_fprintf($13,8115,$vararg_buffer)|0);
   _exit(1);
   // unreachable;
  }
 }
 $14 = (_strcmp($0,8177)|0);
 $15 = ($14|0)==(0);
 if ($15) {
  $16 = (_cliargs_safe_get_next(7956)|0);
  HEAP32[4094] = $16;
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $17 = (_strcmp($0,8185)|0);
 $18 = ($17|0)==(0);
 if ($18) {
  $19 = (_cliargs_safe_get_next(7972)|0);
  HEAP32[4092] = $19;
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $20 = (_strcmp($0,12622)|0);
 $21 = ($20|0)==(0);
 if ($21) {
  $22 = (_cliargs_safe_get_next(7972)|0);
  HEAP32[4092] = $22;
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $23 = (_strcmp($0,8195)|0);
 $24 = ($23|0)==(0);
 if ($24) {
  $25 = (_cliargs_safe_get_next(8206)|0);
  HEAP32[4093] = $25;
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $26 = (_strcmp($0,8227)|0);
 $27 = ($26|0)==(0);
 if ($27) {
  $28 = (_cliargs_safe_get_next(7993)|0);
  HEAP32[4095] = $28;
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $29 = (_strcmp($0,8234)|0);
 $30 = ($29|0)==(0);
 if ($30) {
  $31 = (_cliargs_safe_get_next(8319)|0);
  $32 = HEAP8[$31>>0]|0;
  L32: do {
   switch ($32<<24>>24) {
   case 37:  {
    $33 = ((($31)) + 1|0);
    $$0$i$i = 2;$$015$i$i = $33;
    break;
   }
   case 38:  {
    $34 = ((($31)) + 1|0);
    $$0$i$i = 8;$$015$i$i = $34;
    break;
   }
   case 36:  {
    $35 = ((($31)) + 1|0);
    $$0$i$i = 16;$$015$i$i = $35;
    break;
   }
   case 48:  {
    $36 = ((($31)) + 1|0);
    $37 = HEAP8[$36>>0]|0;
    switch ($37<<24>>24) {
    case 88: case 120:  {
     break;
    }
    default: {
     $$0$i$i = 10;$$015$i$i = $31;
     break L32;
    }
    }
    $38 = ((($31)) + 2|0);
    $$0$i$i = 16;$$015$i$i = $38;
    break;
   }
   default: {
    $$0$i$i = 10;$$015$i$i = $31;
   }
   }
  } while(0);
  $39 = (_strtol($$015$i$i,$1,$$0$i$i)|0);
  $40 = HEAP32[$1>>2]|0;
  $41 = HEAP8[$40>>0]|0;
  $42 = ($41<<24>>24)==(0);
  if (!($42)) {
   _could_not_parse($40);
   // unreachable;
  }
  HEAP32[5] = $39;
  $43 = ($39>>>0)<(65536);
  if ($43) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  } else {
   $44 = HEAP32[1342]|0;
   HEAP32[$vararg_buffer2>>2] = 9321;
   (_fprintf($44,8335,$vararg_buffer2)|0);
   _exit(1);
   // unreachable;
  }
 }
 $45 = (_strcmp($0,12592)|0);
 $46 = ($45|0)==(0);
 if ($46) {
  $47 = (_cliargs_safe_get_next(8379)|0);
  $48 = HEAP32[4380]|0;
  $49 = ((($48)) + 4|0);
  HEAP32[$49>>2] = 0;
  _DynaBuf_add_string($48,$47);
  $50 = HEAP32[4380]|0;
  _DynaBuf_append($50,0);
  $51 = HEAP32[4380]|0;
  _DynaBuf_to_lower($51,$51);
  $52 = (_cputype_find()|0);
  $53 = ($52|0)==(0|0);
  if ($53) {
   $54 = HEAP32[1342]|0;
   HEAP32[$vararg_buffer5>>2] = 9321;
   $vararg_ptr8 = ((($vararg_buffer5)) + 4|0);
   HEAP32[$vararg_ptr8>>2] = 9419;
   (_fprintf($54,8388,$vararg_buffer5)|0);
   _exit(1);
   // unreachable;
  }
  HEAP32[4098] = $52;
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $55 = (_strcmp($0,12463)|0);
 $56 = ($55|0)==(0);
 if ($56) {
  $57 = (_cliargs_safe_get_next(8431)|0);
  $58 = HEAP8[$57>>0]|0;
  L55: do {
   switch ($58<<24>>24) {
   case 37:  {
    $59 = ((($57)) + 1|0);
    $$0$i$i18 = 2;$$015$i$i17 = $59;
    break;
   }
   case 38:  {
    $60 = ((($57)) + 1|0);
    $$0$i$i18 = 8;$$015$i$i17 = $60;
    break;
   }
   case 36:  {
    $61 = ((($57)) + 1|0);
    $$0$i$i18 = 16;$$015$i$i17 = $61;
    break;
   }
   case 48:  {
    $62 = ((($57)) + 1|0);
    $63 = HEAP8[$62>>0]|0;
    switch ($63<<24>>24) {
    case 88: case 120:  {
     break;
    }
    default: {
     $$0$i$i18 = 10;$$015$i$i17 = $57;
     break L55;
    }
    }
    $64 = ((($57)) + 2|0);
    $$0$i$i18 = 16;$$015$i$i17 = $64;
    break;
   }
   default: {
    $$0$i$i18 = 10;$$015$i$i17 = $57;
   }
   }
  } while(0);
  $65 = (_strtol($$015$i$i17,$1,$$0$i$i18)|0);
  $66 = HEAP32[$1>>2]|0;
  $67 = HEAP8[$66>>0]|0;
  $68 = ($67<<24>>24)==(0);
  if (!($68)) {
   _could_not_parse($66);
   // unreachable;
  }
  HEAP32[4] = $65;
  $$off$i = (($65) + 128)|0;
  $69 = ($$off$i>>>0)<(384);
  if ($69) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  } else {
   $70 = HEAP32[1342]|0;
   HEAP32[$vararg_buffer9>>2] = 9321;
   (_fprintf($70,8445,$vararg_buffer9)|0);
   _exit(1);
   // unreachable;
  }
 }
 $71 = (_strcmp($0,8240)|0);
 $72 = ($71|0)==(0);
 if ($72) {
  $73 = (_cliargs_safe_get_next(8250)|0);
  $74 = HEAP8[$73>>0]|0;
  L71: do {
   switch ($74<<24>>24) {
   case 37:  {
    $75 = ((($73)) + 1|0);
    $$0$i = 2;$$015$i = $75;
    break;
   }
   case 38:  {
    $76 = ((($73)) + 1|0);
    $$0$i = 8;$$015$i = $76;
    break;
   }
   case 36:  {
    $77 = ((($73)) + 1|0);
    $$0$i = 16;$$015$i = $77;
    break;
   }
   case 48:  {
    $78 = ((($73)) + 1|0);
    $79 = HEAP8[$78>>0]|0;
    switch ($79<<24>>24) {
    case 88: case 120:  {
     break;
    }
    default: {
     $$0$i = 10;$$015$i = $73;
     break L71;
    }
    }
    $80 = ((($73)) + 2|0);
    $$0$i = 16;$$015$i = $80;
    break;
   }
   default: {
    $$0$i = 10;$$015$i = $73;
   }
   }
  } while(0);
  $81 = (_strtol($$015$i,$1,$$0$i)|0);
  $82 = HEAP32[$1>>2]|0;
  $83 = HEAP8[$82>>0]|0;
  $84 = ($83<<24>>24)==(0);
  if (!($84)) {
   _could_not_parse($82);
   // unreachable;
  }
  HEAP32[244] = $81;
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $85 = (_strcmp($0,8270)|0);
 $86 = ($85|0)==(0);
 if (!($86)) {
  $99 = (_strcmp($0,8295)|0);
  $100 = ($99|0)==(0);
  if ($100) {
   $101 = HEAP32[1371]|0;
   HEAP32[4385] = $101;
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
  $102 = (_strcmp($0,8306)|0);
  $103 = ($102|0)==(0);
  if ($103) {
   HEAP32[4386] = 1;
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
  $104 = (_strcmp($0,8311)|0);
  $105 = ($104|0)==(0);
  if ($105) {
   (_puts(7869)|0);
   _exit(0);
   // unreachable;
  } else {
   $$0 = $0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $87 = (_cliargs_safe_get_next(8279)|0);
 $88 = HEAP8[$87>>0]|0;
 L97: do {
  switch ($88<<24>>24) {
  case 37:  {
   $89 = ((($87)) + 1|0);
   $$0$i21 = 2;$$015$i20 = $89;
   break;
  }
  case 38:  {
   $90 = ((($87)) + 1|0);
   $$0$i21 = 8;$$015$i20 = $90;
   break;
  }
  case 36:  {
   $91 = ((($87)) + 1|0);
   $$0$i21 = 16;$$015$i20 = $91;
   break;
  }
  case 48:  {
   $92 = ((($87)) + 1|0);
   $93 = HEAP8[$92>>0]|0;
   switch ($93<<24>>24) {
   case 88: case 120:  {
    break;
   }
   default: {
    $$0$i21 = 10;$$015$i20 = $87;
    break L97;
   }
   }
   $94 = ((($87)) + 2|0);
   $$0$i21 = 16;$$015$i20 = $94;
   break;
  }
  default: {
   $$0$i21 = 10;$$015$i20 = $87;
  }
  }
 } while(0);
 $95 = (_strtol($$015$i20,$1,$$0$i21)|0);
 $96 = HEAP32[$1>>2]|0;
 $97 = HEAP8[$96>>0]|0;
 $98 = ($97<<24>>24)==(0);
 if (!($98)) {
  _could_not_parse($96);
  // unreachable;
 }
 HEAP32[3] = $95;
 HEAP32[2] = $95;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _show_version($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 (_puts(7869)|0);
 $1 = ($0|0)==(0);
 if ($1) {
  return;
 } else {
  _exit(0);
  // unreachable;
 }
}
function _could_not_parse($0) {
 $0 = $0|0;
 var $1 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = HEAP32[1342]|0;
 HEAP32[$vararg_buffer>>2] = 9321;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $0;
 (_fprintf($1,8076,$vararg_buffer)|0);
 _exit(1);
 // unreachable;
}
function _perform_pass() {
 var $$09 = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 _Output_passinit();
 $0 = HEAP32[4098]|0;
 _cputype_passinit($0);
 $1 = HEAP32[5]|0;
 $2 = ($1|0)==(-1);
 if (!($2)) {
  _vcpu_set_pc($1,0);
 }
 _encoding_passinit();
 _section_passinit();
 HEAP32[4390] = 0;
 HEAP32[4389] = 0;
 $3 = HEAP32[4096]|0;
 $4 = ($3|0)>(0);
 if (!($4)) {
  _Output_end_segment();
  $25 = HEAP32[4390]|0;
  STACKTOP = sp;return ($25|0);
 }
 $5 = HEAP32[1342]|0;
 $$09 = 0;
 while(1) {
  $6 = HEAP32[4097]|0;
  $7 = (($6) + ($$09<<2)|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = (_fopen($8,10371)|0);
  $10 = ($9|0)==(0|0);
  $11 = HEAP32[4097]|0;
  $12 = (($11) + ($$09<<2)|0);
  $13 = HEAP32[$12>>2]|0;
  if ($10) {
   HEAP32[$vararg_buffer>>2] = $13;
   (_fprintf($5,8583,$vararg_buffer)|0);
   $14 = HEAP32[4097]|0;
   $15 = (($14) + ($$09<<2)|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = HEAP8[$16>>0]|0;
   $18 = ($17<<24>>24)==(45);
   if ($18) {
    (_fwrite(8623,65,1,$5)|0);
   }
   $19 = HEAP32[4389]|0;
   $20 = (($19) + 1)|0;
   HEAP32[4389] = $20;
  } else {
   _flow_parse_and_close_file($9,$13);
  }
  $21 = (($$09) + 1)|0;
  $22 = HEAP32[4096]|0;
  $23 = ($21|0)<($22|0);
  if ($23) {
   $$09 = $21;
  } else {
   break;
  }
 }
 $$pre = HEAP32[4389]|0;
 $phitmp = ($$pre|0)==(0);
 if ($phitmp) {
  _Output_end_segment();
  $25 = HEAP32[4390]|0;
  STACKTOP = sp;return ($25|0);
 } else {
  $24 = (_ACME_finalize(1)|0);
  _exit(($24|0));
  // unreachable;
 }
 return (0)|0;
}
function _ALU_init() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_DynaBuf_create(256)|0);
 HEAP32[4364] = $0;
 $1 = (_DynaBuf_create(8)|0);
 HEAP32[4365] = $1;
 $2 = (_DynaBuf_create(256)|0);
 HEAP32[4366] = $2;
 _Tree_add_table(17468,24);
 _Tree_add_table(17472,224);
 $3 = HEAP32[106]|0;
 $4 = $3 << 1;
 HEAP32[106] = $4;
 $5 = HEAP32[4369]|0;
 $6 = $3 << 3;
 $7 = (_realloc($5,$6)|0);
 HEAP32[4369] = $7;
 $8 = ($7|0)==(0|0);
 if ($8) {
  _Throw_serious_error(9834);
  // unreachable;
 }
 $9 = HEAP32[107]|0;
 $10 = $9 << 1;
 HEAP32[107] = $10;
 $11 = HEAP32[4370]|0;
 $12 = ($9*48)|0;
 $13 = (_realloc($11,$12)|0);
 HEAP32[4370] = $13;
 $14 = ($13|0)==(0|0);
 if ($14) {
  _Throw_serious_error(9834);
  // unreachable;
 } else {
  return;
 }
}
function _ALU_optional_defined_int($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $storemerge = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $1 = sp;
 $2 = (_parse_expression($1)|0);
 $3 = ($2|0)==(0);
 if (!($3)) {
  _Throw_error(8887);
 }
 $4 = HEAP32[$1>>2]|0;
 $5 = $4 & 80;
 $6 = ($5|0)==(64);
 if ($6) {
  $7 = HEAP32[4364]|0;
  $8 = ((($7)) + 4|0);
  HEAP32[$8>>2] = 0;
  _DynaBuf_add_string($7,8901);
  $9 = HEAP32[4364]|0;
  $10 = HEAP32[4366]|0;
  $11 = HEAP32[$10>>2]|0;
  _DynaBuf_add_string($9,$11);
  $12 = HEAP32[4364]|0;
  _DynaBuf_add_string($12,8921);
  $13 = HEAP32[4364]|0;
  _DynaBuf_append($13,0);
  $14 = HEAP32[4364]|0;
  $15 = HEAP32[$14>>2]|0;
  _Throw_serious_error($15);
  // unreachable;
 }
 $16 = $4 & 64;
 $17 = ($16|0)==(0);
 if ($17) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $18 = $4 & 256;
 $19 = ($18|0)==(0);
 $20 = ((($1)) + 8|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = +HEAPF64[$20>>3];
 $23 = (~~(($22)));
 $storemerge = $19 ? $21 : $23;
 HEAP32[$0>>2] = $storemerge;
 $$0 = 1;
 STACKTOP = sp;return ($$0|0);
}
function _parse_expression($0) {
 $0 = $0|0;
 var $$$0$i$i = 0, $$$0$i$i$i = 0, $$$i$i = 0, $$$i$i$i = 0, $$$i19$i = 0, $$$i22$i = 0, $$$i7$i$i = 0, $$0$$i$i = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i$i23 = 0, $$0$i20$i = 0, $$0$i30$i = 0, $$0$i5$i$i = 0, $$0$lcssa$i$i = 0, $$0$lcssa$i$i$i = 0.0, $$0$ph = 0, $$0$ph$i$i = 0, $$010$i$i = 0.0;
 var $$010$i$i$i = 0.0, $$01011$i$i = 0, $$012$i = 0, $$013$i = 0, $$013$i$i = 0, $$014$i$i = 0, $$015$lcssa21$i$i = 0, $$01517$i$i = 0, $$018$i$i = 0, $$018$i$i$i = 0, $$018$i18$i = 0, $$020$i$i = 0, $$020$i$i$i = 0, $$026$i$i = 0, $$026$i$i$i = 0, $$027$i$i = 0, $$027$i$i$i = 0, $$07$lcssa$i$i$i = 0.0, $$079$i$i = 0.0, $$079$i$i$i = 0.0;
 var $$0912$i$i = 0, $$1 = 0, $$1$i = 0, $$16$i$i = 0, $$22$i$i = 0, $$22$i$i$i = 0, $$3$ph = 0, $$31$i$i = 0, $$31$i$i$i = 0, $$334 = 0, $$33435 = 0, $$33437 = 0, $$mux$i$i = 0, $$mux$i$i$i = 0, $$off = 0, $$off$i = 0, $$off$i$i = 0, $$off$i$i$i = 0, $$off$i31$i = 0, $$off37$i = 0;
 var $$off8$i$i$i = 0, $$phi$trans$insert$i = 0, $$phi$trans$insert$i$i = 0, $$phi$trans$insert$i10$i = 0, $$phi$trans$insert$i13$i = 0, $$phi$trans$insert$i2$i = 0, $$phi$trans$insert$i20$i = 0, $$phi$trans$insert$i28 = 0, $$phi$trans$insert$i6$i = 0, $$phi$trans$insert103$i = 0, $$phi$trans$insert45$i = 0, $$phi$trans$insert47$i = 0, $$phi$trans$insert49$i = 0, $$phi$trans$insert50$i = 0, $$phi$trans$insert51$i = 0, $$phi$trans$insert53$i = 0, $$phi$trans$insert55$i = 0, $$phi$trans$insert57$i = 0, $$phi$trans$insert58$i = 0, $$phi$trans$insert62$i = 0;
 var $$phi$trans$insert64$i = 0, $$phi$trans$insert70$i = 0, $$phi$trans$insert74$i = 0, $$phi$trans$insert78$i = 0, $$phi$trans$insert84$i = 0, $$phi$trans$insert86$i = 0, $$phi$trans$insert91$i = 0, $$phi$trans$insert95$i = 0, $$phi$trans$insert99$i = 0, $$pr = 0, $$pr$i$i = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i$i18 = 0.0, $$pre$i11$i = 0.0, $$pre$i14$i = 0.0, $$pre$i17 = 0, $$pre$i21$i = 0.0, $$pre$i26$i = 0, $$pre$i29 = 0;
 var $$pre$i3$i = 0.0, $$pre$i7$i = 0.0, $$pre$phi$iZ2D = 0, $$pre$phi110$iZ2D = 0, $$pre$phi112$iZ2D = 0, $$pre$phi114$iZ2D = 0, $$pre$phi116$iZ2D = 0, $$pre$phi118$iZ2D = 0, $$pre$phi120$iZ2D = 0, $$pre$phi122$iZ2D = 0, $$pre1$i$i = 0, $$pre1$i17$i = 0, $$pre101$i = 0, $$pre105$i = 0, $$pre106$i = 0, $$pre107$i = 0, $$pre108$i = 0, $$pre109$i = 0, $$pre111$i = 0, $$pre113$i = 0;
 var $$pre2$i$i = 0, $$pre2$i18$i = 0, $$pre39$i = 0, $$pre40$i = 0, $$pre41$i = 0, $$pre42$i = 0, $$pre43$i = 0, $$pre44$i = 0.0, $$pre46$i = 0.0, $$pre47$i = 0, $$pre48$i = 0, $$pre48$i27 = 0.0, $$pre49$i = 0, $$pre50$i = 0.0, $$pre51$i = 0, $$pre52$i = 0, $$pre52$i26 = 0.0, $$pre54$i = 0, $$pre54$i25 = 0.0, $$pre55$i = 0;
 var $$pre56$i = 0, $$pre56$i24 = 0, $$pre57$i = 0, $$pre59$i = 0, $$pre59$i21 = 0, $$pre60$i = 0, $$pre61$i = 0, $$pre63$i = 0.0, $$pre65$i = 0.0, $$pre66$i = 0, $$pre67$i = 0, $$pre68$i = 0, $$pre69$i = 0, $$pre71$i = 0.0, $$pre72$i = 0, $$pre73$i = 0, $$pre75$i = 0, $$pre76$i = 0, $$pre77$i = 0, $$pre79$i = 0.0;
 var $$pre80$i = 0, $$pre81$i = 0, $$pre82$i = 0, $$pre83$i = 0, $$pre85$i = 0.0, $$pre87$i = 0.0, $$pre88$i = 0, $$pre89$i = 0, $$pre93$i = 0, $$pre97$i = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0.0, $1005 = 0, $1006 = 0;
 var $1007 = 0.0, $1008 = 0.0, $1009 = 0.0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0;
 var $1025 = 0, $1026 = 0, $1027 = 0.0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0.0, $1037 = 0, $1038 = 0.0, $1039 = 0.0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0;
 var $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0.0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0;
 var $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0.0, $1067 = 0, $1068 = 0.0, $1069 = 0.0, $107 = 0, $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0;
 var $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0, $1089 = 0.0, $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0.0, $1096 = 0, $1097 = 0;
 var $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0, $1106 = 0, $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0;
 var $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0, $1123 = 0.0, $1124 = 0, $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0.0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0;
 var $1133 = 0, $1134 = 0.0, $1135 = 0, $1136 = 0.0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0, $1141 = 0, $1142 = 0, $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0;
 var $1151 = 0, $1152 = 0, $1153 = 0, $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0, $116 = 0, $1160 = 0.0, $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0.0, $1167 = 0, $1168 = 0, $1169 = 0;
 var $117 = 0, $1170 = 0, $1171 = 0.0, $1172 = 0, $1173 = 0.0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0, $1178 = 0, $1179 = 0, $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0;
 var $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0, $1196 = 0, $1197 = 0.0, $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0.0, $1204 = 0;
 var $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0.0, $1209 = 0, $121 = 0, $1210 = 0.0, $1211 = 0, $1212 = 0, $1213 = 0, $1214 = 0, $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0;
 var $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0, $1231 = 0, $1232 = 0, $1233 = 0, $1234 = 0.0, $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0.0;
 var $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0.0, $1246 = 0, $1247 = 0.0, $1248 = 0, $1249 = 0, $125 = 0, $1250 = 0, $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0;
 var $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0, $1268 = 0, $1269 = 0, $127 = 0, $1270 = 0, $1271 = 0.0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0.0;
 var $1278 = 0, $1279 = 0, $128 = 0, $1280 = 0, $1281 = 0, $1282 = 0.0, $1283 = 0, $1284 = 0.0, $1285 = 0, $1286 = 0, $1287 = 0, $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0;
 var $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0, $1303 = 0, $1304 = 0, $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0.0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0;
 var $1313 = 0, $1314 = 0.0, $1315 = 0, $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0.0, $132 = 0, $1320 = 0, $1321 = 0.0, $1322 = 0, $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0;
 var $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0, $134 = 0, $1340 = 0, $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0.0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0;
 var $135 = 0, $1350 = 0.0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0, $1358 = 0, $1359 = 0, $136 = 0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0;
 var $1368 = 0, $1369 = 0, $137 = 0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $1375 = 0, $1376 = 0, $1377 = 0, $1378 = 0, $1379 = 0, $138 = 0, $1380 = 0, $1381 = 0.0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0;
 var $1386 = 0, $1387 = 0.0, $1388 = 0, $1389 = 0, $139 = 0, $1390 = 0, $1391 = 0, $1392 = 0, $1393 = 0, $1394 = 0, $1395 = 0, $1396 = 0, $1397 = 0, $1398 = 0, $1399 = 0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0;
 var $1403 = 0, $1404 = 0, $1405 = 0, $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0, $1411 = 0, $1412 = 0, $1413 = 0, $1414 = 0, $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0.0, $1419 = 0, $142 = 0, $1420 = 0;
 var $1421 = 0, $1422 = 0, $1423 = 0, $1424 = 0.0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0, $143 = 0, $1430 = 0, $1431 = 0, $1432 = 0, $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0;
 var $144 = 0, $1440 = 0, $1441 = 0, $1442 = 0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0, $1448 = 0, $1449 = 0, $145 = 0, $1450 = 0, $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0, $1457 = 0;
 var $1458 = 0, $1459 = 0, $146 = 0, $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0, $1466 = 0, $1467 = 0, $1468 = 0, $1469 = 0, $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0;
 var $1476 = 0, $1477 = 0, $1478 = 0, $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0, $1484 = 0, $1485 = 0, $1486 = 0, $1487 = 0, $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0;
 var $1494 = 0, $1495 = 0, $1496 = 0, $1497 = 0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0, $1501 = 0, $1502 = 0, $1503 = 0, $1504 = 0.0, $1505 = 0, $1506 = 0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0;
 var $1511 = 0, $1512 = 0, $1513 = 0, $1514 = 0, $1515 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0;
 var $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0;
 var $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0;
 var $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0;
 var $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0.0, $234 = 0, $235 = 0.0, $236 = 0.0, $237 = 0.0;
 var $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0.0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0;
 var $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0;
 var $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0;
 var $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0;
 var $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0;
 var $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0.0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0.0, $34 = 0, $340 = 0, $341 = 0.0, $342 = 0.0, $343 = 0.0, $344 = 0, $345 = 0;
 var $346 = 0, $347 = 0, $348 = 0, $349 = 0.0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0;
 var $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0;
 var $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0;
 var $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0;
 var $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0;
 var $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0;
 var $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0;
 var $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0;
 var $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0.0, $504 = 0, $505 = 0, $506 = 0, $507 = 0;
 var $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0.0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0;
 var $526 = 0, $527 = 0, $528 = 0.0, $529 = 0, $53 = 0, $530 = 0.0, $531 = 0.0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0.0, $543 = 0;
 var $544 = 0.0, $545 = 0.0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0.0, $557 = 0, $558 = 0.0, $559 = 0.0, $56 = 0, $560 = 0, $561 = 0;
 var $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0.0, $571 = 0, $572 = 0, $573 = 0.0, $574 = 0, $575 = 0.0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0;
 var $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0.0, $598 = 0;
 var $599 = 0, $6 = 0, $60 = 0, $600 = 0.0, $601 = 0, $602 = 0.0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0;
 var $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0.0, $625 = 0, $626 = 0.0, $627 = 0.0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0;
 var $634 = 0, $635 = 0, $636 = 0.0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0.0;
 var $652 = 0.0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0.0, $667 = 0, $668 = 0, $669 = 0, $67 = 0;
 var $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0.0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0;
 var $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0.0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0;
 var $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0;
 var $724 = 0.0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0.0, $731 = 0, $732 = 0, $733 = 0.0, $734 = 0.0, $735 = 0.0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0;
 var $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0;
 var $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0.0, $775 = 0, $776 = 0, $777 = 0, $778 = 0;
 var $779 = 0, $78 = 0, $780 = 0.0, $781 = 0, $782 = 0, $783 = 0.0, $784 = 0.0, $785 = 0.0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0;
 var $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0.0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0.0;
 var $814 = 0, $815 = 0, $816 = 0.0, $817 = 0, $818 = 0.0, $819 = 0.0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0;
 var $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0;
 var $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0.0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0.0, $865 = 0, $866 = 0, $867 = 0.0, $868 = 0;
 var $869 = 0.0, $87 = 0, $870 = 0.0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0;
 var $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0;
 var $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0.0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0.0;
 var $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0;
 var $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0;
 var $959 = 0, $96 = 0, $960 = 0, $961 = 0.0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0.0, $968 = 0, $969 = 0, $97 = 0, $970 = 0.0, $971 = 0.0, $972 = 0.0, $973 = 0, $974 = 0, $975 = 0, $976 = 0;
 var $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0;
 var $995 = 0, $996 = 0, $997 = 0, $998 = 0.0, $999 = 0, $brmerge$i$i = 0, $brmerge$i$i$i = 0, $or$cond = 0, $or$cond$i = 0, $or$cond$i$i = 0, $or$cond$i16$i = 0, $sext$i$i = 0, $sext$i$i$i = 0, $sext$off$i$i = 0, $sext$off$i$i$i = 0, $sext$off33$i$i = 0, $sext$off33$i$i$i = 0, $storemerge$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $1 = sp;
 HEAP32[4371] = 0;
 HEAP32[4372] = 0;
 HEAP32[4373] = 0;
 HEAP32[4374] = 1;
 $2 = HEAP32[4369]|0;
 HEAP32[$2>>2] = 576;
 $3 = ((($1)) + 8|0);
 $4 = ((($1)) + 16|0);
 $$0$ph = 0;
 L1: while(1) {
  L3: while(1) {
   $5 = HEAP32[4374]|0;
   $6 = HEAP32[106]|0;
   $7 = ($5|0)<($6|0);
   if (!($7)) {
    $8 = $6 << 1;
    HEAP32[106] = $8;
    $9 = HEAP32[4369]|0;
    $10 = $6 << 3;
    $11 = (_realloc($9,$10)|0);
    HEAP32[4369] = $11;
    $12 = ($11|0)==(0|0);
    if ($12) {
     label = 5;
     break L1;
    }
   }
   $13 = HEAP32[4371]|0;
   $14 = HEAP32[107]|0;
   $15 = ($13|0)<($14|0);
   if (!($15)) {
    $16 = $14 << 1;
    HEAP32[107] = $16;
    $17 = HEAP32[4370]|0;
    $18 = ($14*48)|0;
    $19 = (_realloc($17,$18)|0);
    HEAP32[4370] = $19;
    $20 = ($19|0)==(0|0);
    if ($20) {
     label = 8;
     break L1;
    }
   }
   $21 = HEAP32[4372]|0;
   switch ($21|0) {
   case 1:  {
    label = 140;
    break L3;
    break;
   }
   case 0:  {
    break;
   }
   case 2:  {
    $471 = HEAP32[4374]|0;
    $472 = ($471|0)<(2);
    if ($472) {
     HEAP32[4372] = 0;
     continue L3;
    }
    $473 = (($471) + -2)|0;
    $474 = HEAP32[4369]|0;
    $475 = (($474) + ($473<<2)|0);
    $476 = HEAP32[$475>>2]|0;
    $477 = ((($476)) + 4|0);
    $478 = HEAP8[$477>>0]|0;
    $479 = (($471) + -1)|0;
    $480 = (($474) + ($479<<2)|0);
    $481 = HEAP32[$480>>2]|0;
    $482 = ((($481)) + 4|0);
    $483 = HEAP8[$482>>0]|0;
    $484 = ($478<<24>>24)<($483<<24>>24);
    if ($484) {
     HEAP32[4372] = 0;
     continue L3;
    }
    $485 = ($478<<24>>24)!=($483<<24>>24);
    $486 = $483 & 1;
    $487 = ($486<<24>>24)==(0);
    $or$cond$i = $485 | $487;
    if (!($or$cond$i)) {
     HEAP32[4372] = 0;
     continue L3;
    }
    $488 = HEAP32[$476>>2]|0;
    switch ($488|0) {
    case 1:  {
     label = 175;
     break L1;
     break;
    }
    case 17:  {
     label = 180;
     break L3;
     break;
    }
    case 2:  {
     label = 181;
     break L3;
     break;
    }
    case 3:  {
     label = 182;
     break L3;
     break;
    }
    case 4:  {
     label = 185;
     break L3;
     break;
    }
    case 5:  {
     label = 188;
     break L3;
     break;
    }
    case 6:  {
     label = 192;
     break L3;
     break;
    }
    case 7:  {
     label = 196;
     break L3;
     break;
    }
    case 8:  {
     label = 200;
     break L3;
     break;
    }
    case 9:  {
     label = 209;
     break L3;
     break;
    }
    case 10:  {
     label = 218;
     break L3;
     break;
    }
    case 12:  {
     label = 222;
     break L3;
     break;
    }
    case 13:  {
     label = 226;
     break L3;
     break;
    }
    case 14:  {
     label = 230;
     break L3;
     break;
    }
    case 15:  {
     label = 234;
     break L3;
     break;
    }
    case 16:  {
     label = 238;
     break L3;
     break;
    }
    case 18:  {
     label = 242;
     break L3;
     break;
    }
    case 19:  {
     label = 258;
     break L3;
     break;
    }
    case 20:  {
     label = 267;
     break L3;
     break;
    }
    case 21:  {
     label = 284;
     break L3;
     break;
    }
    case 22:  {
     label = 302;
     break L3;
     break;
    }
    case 26:  {
     label = 314;
     break L3;
     break;
    }
    case 27:  {
     label = 323;
     break L3;
     break;
    }
    case 23:  {
     label = 332;
     break L3;
     break;
    }
    case 24:  {
     label = 339;
     break L3;
     break;
    }
    case 25:  {
     label = 345;
     break L3;
     break;
    }
    case 29:  {
     label = 352;
     break L3;
     break;
    }
    case 30:  {
     label = 361;
     break L3;
     break;
    }
    case 31:  {
     label = 370;
     break L3;
     break;
    }
    case 32:  {
     label = 379;
     break L3;
     break;
    }
    case 33:  {
     label = 388;
     break L3;
     break;
    }
    case 28:  {
     label = 397;
     break L3;
     break;
    }
    case 34:  {
     label = 406;
     break L3;
     break;
    }
    case 36:  {
     label = 413;
     break L3;
     break;
    }
    case 37:  {
     label = 414;
     break L3;
     break;
    }
    case 35:  {
     label = 421;
     break L3;
     break;
    }
    case 11:  {
     break;
    }
    default: {
     label = 428;
     break L1;
    }
    }
    HEAP32[4373] = 128;
    $489 = HEAP32[$481>>2]|0;
    switch ($489|0) {
    case 0:  {
     label = 178;
     break L3;
     break;
    }
    case 17:  {
     break;
    }
    default: {
     label = 179;
     break L1;
    }
    }
    HEAP32[4374] = $473;
    HEAP32[4372] = 1;
    continue L3;
    break;
   }
   default: {
    $$334 = $$0$ph;$1475 = $21;
    label = 433;
    break L1;
   }
   }
   $22 = HEAP8[20560]|0;
   $23 = ($22<<24>>24)==(32);
   if ($23) {
    (_GetByte()|0);
    $$pre$i = HEAP8[20560]|0;
    $25 = $$pre$i;
   } else {
    $25 = $22;
   }
   $24 = $25 << 24 >> 24;
   L28: do {
    switch ($24|0) {
    case 41:  {
     label = 41;
     break L1;
     break;
    }
    case 33:  {
     $$012$i = 592;
     label = 138;
     break L3;
     break;
    }
    case 60:  {
     label = 134;
     break L3;
     break;
    }
    case 62:  {
     label = 135;
     break L3;
     break;
    }
    case 94:  {
     label = 136;
     break L3;
     break;
    }
    case 40:  {
     label = 137;
     break L3;
     break;
    }
    case 43:  {
     $26 = HEAP32[4380]|0;
     $27 = ((($26)) + 4|0);
     HEAP32[$27>>2] = 0;
     $29 = $26;$31 = 0;
     while(1) {
      $28 = ((($29)) + 8|0);
      $30 = HEAP32[$28>>2]|0;
      $32 = ($31|0)==($30|0);
      if ($32) {
       _DynaBuf_enlarge($29);
       $$pre57$i = HEAP32[4380]|0;
       $$phi$trans$insert58$i = ((($$pre57$i)) + 4|0);
       $$pre59$i = HEAP32[$$phi$trans$insert58$i>>2]|0;
       $34 = $$pre57$i;$36 = $$pre59$i;
      } else {
       $34 = $29;$36 = $31;
      }
      $33 = ((($34)) + 4|0);
      $35 = (($36) + 1)|0;
      HEAP32[$33>>2] = $35;
      $37 = HEAP32[$34>>2]|0;
      $38 = (($37) + ($36)|0);
      HEAP8[$38>>0] = 43;
      $39 = (_GetByte()|0);
      $40 = ($39<<24>>24)==(43);
      $$pre54$i = HEAP32[4380]|0;
      $$phi$trans$insert55$i = ((($$pre54$i)) + 4|0);
      $$pre56$i = HEAP32[$$phi$trans$insert55$i>>2]|0;
      if ($40) {
       $29 = $$pre54$i;$31 = $$pre56$i;
      } else {
       break;
      }
     }
     _symbol_fix_forward_anon_name(0);
     $41 = HEAP32[1337]|0;
     $42 = HEAP32[$41>>2]|0;
     $43 = (_symbol_find($42,32)|0);
     $44 = HEAP32[$43>>2]|0;
     $45 = $44 & 16;
     $46 = ($45|0)==(0);
     if ($46) {
      $47 = HEAP32[4380]|0;
      $48 = HEAP32[$47>>2]|0;
      $49 = HEAP32[4366]|0;
      $50 = ((($49)) + 4|0);
      HEAP32[$50>>2] = 0;
      _DynaBuf_add_string($49,$48);
      $51 = HEAP32[4366]|0;
      $52 = ((($51)) + 4|0);
      $53 = HEAP32[$52>>2]|0;
      $54 = ($53>>>0)<($$pre56$i>>>0);
      if ($54) {
       label = 19;
       break L1;
      }
      HEAP32[$52>>2] = $$pre56$i;
      _DynaBuf_append($51,0);
     }
     $56 = HEAP32[4388]|0;
     $57 = ($56|0)==(0);
     if ($57) {
      $58 = ((($43)) + 24|0);
      $59 = HEAP32[$58>>2]|0;
      $60 = (($59) + 1)|0;
      HEAP32[$58>>2] = $60;
     }
     $61 = HEAP32[4371]|0;
     $62 = HEAP32[4370]|0;
     $63 = (($62) + (($61*24)|0)|0);
     ;HEAP32[$63>>2]=HEAP32[$43>>2]|0;HEAP32[$63+4>>2]=HEAP32[$43+4>>2]|0;HEAP32[$63+8>>2]=HEAP32[$43+8>>2]|0;HEAP32[$63+12>>2]=HEAP32[$43+12>>2]|0;HEAP32[$63+16>>2]=HEAP32[$43+16>>2]|0;HEAP32[$63+20>>2]=HEAP32[$43+20>>2]|0;
     $64 = (($61) + 1)|0;
     HEAP32[4371] = $64;
     $65 = (($62) + (($61*24)|0)|0);
     $66 = HEAP32[$65>>2]|0;
     $67 = $66 | 64;
     HEAP32[$65>>2] = $67;
     break;
    }
    case 45:  {
     $68 = HEAP32[4380]|0;
     $69 = ((($68)) + 4|0);
     HEAP32[$69>>2] = 0;
     $$013$i = 0;$71 = $68;$73 = 0;
     while(1) {
      $70 = ((($71)) + 8|0);
      $72 = HEAP32[$70>>2]|0;
      $74 = ($73|0)==($72|0);
      if ($74) {
       _DynaBuf_enlarge($71);
       $$pre49$i = HEAP32[4380]|0;
       $$phi$trans$insert50$i = ((($$pre49$i)) + 4|0);
       $$pre51$i = HEAP32[$$phi$trans$insert50$i>>2]|0;
       $76 = $$pre49$i;$78 = $$pre51$i;
      } else {
       $76 = $71;$78 = $73;
      }
      $75 = ((($76)) + 4|0);
      $77 = (($78) + 1)|0;
      HEAP32[$75>>2] = $77;
      $79 = HEAP32[$76>>2]|0;
      $80 = (($79) + ($78)|0);
      HEAP8[$80>>0] = 45;
      $81 = (_GetByte()|0);
      $82 = ($81<<24>>24)==(45);
      if (!($82)) {
       break;
      }
      $83 = $$013$i ^ 1;
      $$pre47$i = HEAP32[4380]|0;
      $$phi$trans$insert$i = ((($$pre47$i)) + 4|0);
      $$pre48$i = HEAP32[$$phi$trans$insert$i>>2]|0;
      $$013$i = $83;$71 = $$pre47$i;$73 = $$pre48$i;
     }
     $84 = HEAP8[20560]|0;
     $85 = ($84<<24>>24)==(32);
     if ($85) {
      (_GetByte()|0);
      $$pre52$i = HEAP8[20560]|0;
      $87 = $$pre52$i;
     } else {
      $87 = $84;
     }
     $86 = $87&255;
     $88 = (9945 + ($86)|0);
     $89 = HEAP8[$88>>0]|0;
     $90 = $89 & 8;
     $91 = ($90<<24>>24)==(0);
     if ($91) {
      label = 39;
      break L3;
     }
     $92 = HEAP32[4380]|0;
     _DynaBuf_append($92,0);
     $93 = HEAP32[1337]|0;
     $94 = HEAP32[$93>>2]|0;
     $95 = HEAP32[4380]|0;
     $96 = ((($95)) + 4|0);
     $97 = HEAP32[$96>>2]|0;
     $98 = (($97) + -1)|0;
     $99 = (_symbol_find($94,32)|0);
     $100 = HEAP32[$99>>2]|0;
     $101 = $100 & 16;
     $102 = ($101|0)==(0);
     if ($102) {
      $103 = HEAP32[4380]|0;
      $104 = HEAP32[$103>>2]|0;
      $105 = HEAP32[4366]|0;
      $106 = ((($105)) + 4|0);
      HEAP32[$106>>2] = 0;
      _DynaBuf_add_string($105,$104);
      $107 = HEAP32[4366]|0;
      $108 = ((($107)) + 4|0);
      $109 = HEAP32[$108>>2]|0;
      $110 = ($109>>>0)<($98>>>0);
      if ($110) {
       label = 34;
       break L1;
      }
      HEAP32[$108>>2] = $98;
      _DynaBuf_append($107,0);
     }
     $112 = HEAP32[4388]|0;
     $113 = ($112|0)==(0);
     if ($113) {
      $114 = ((($99)) + 24|0);
      $115 = HEAP32[$114>>2]|0;
      $116 = (($115) + 1)|0;
      HEAP32[$114>>2] = $116;
     }
     $117 = HEAP32[4371]|0;
     $118 = HEAP32[4370]|0;
     $119 = (($118) + (($117*24)|0)|0);
     ;HEAP32[$119>>2]=HEAP32[$99>>2]|0;HEAP32[$119+4>>2]=HEAP32[$99+4>>2]|0;HEAP32[$119+8>>2]=HEAP32[$99+8>>2]|0;HEAP32[$119+12>>2]=HEAP32[$99+12>>2]|0;HEAP32[$119+16>>2]=HEAP32[$99+16>>2]|0;HEAP32[$119+20>>2]=HEAP32[$99+20>>2]|0;
     $120 = (($117) + 1)|0;
     HEAP32[4371] = $120;
     $121 = (($118) + (($117*24)|0)|0);
     $122 = HEAP32[$121>>2]|0;
     $123 = $122 | 64;
     HEAP32[$121>>2] = $123;
     break;
    }
    case 39: case 34:  {
     $129 = (_GetQuotedByte()|0);
     $130 = ($129<<24>>24)==(0);
     if (!($130)) {
      $131 = HEAP8[20560]|0;
      $132 = ($131<<24>>24)==($25<<24>>24);
      if ($132) {
       _Throw_error(9804);
       _Input_skip_remainder();
       break L28;
      }
      $133 = (_encoding_encode_char($131)|0);
      $134 = $133 << 24 >> 24;
      $135 = (_GetQuotedByte()|0);
      $136 = ($135<<24>>24)==($25<<24>>24);
      if ($136) {
       (_GetByte()|0);
      } else {
       $137 = HEAP8[20560]|0;
       $138 = ($137<<24>>24)==(0);
       if (!($138)) {
        _Throw_error(8951);
        _Input_skip_remainder();
       }
      }
      $139 = HEAP32[4371]|0;
      $140 = HEAP32[4370]|0;
      $141 = (($140) + (($139*24)|0)|0);
      HEAP32[$141>>2] = 88;
      $142 = (((($140) + (($139*24)|0)|0)) + 8|0);
      HEAP32[$142>>2] = $134;
      $143 = (($139) + 1)|0;
      HEAP32[4371] = $143;
      $144 = (((($140) + (($139*24)|0)|0)) + 16|0);
      HEAP32[$144>>2] = 0;
     }
     break;
    }
    case 37:  {
     $$0$i$i = -1;$$020$i$i = 0;
     L130: while(1) {
      $145 = (($$0$i$i) + 1)|0;
      $146 = (_GetByte()|0);
      $147 = $146 << 24 >> 24;
      switch ($147|0) {
      case 46: case 48:  {
       $148 = $$020$i$i << 1;
       $$0$i$i = $145;$$020$i$i = $148;
       continue L130;
       break;
      }
      case 35: case 49:  {
       $149 = $$020$i$i << 1;
       $150 = $149 | 1;
       $$0$i$i = $145;$$020$i$i = $150;
       continue L130;
       break;
      }
      default: {
       break L130;
      }
      }
     }
     $151 = ($$0$i$i|0)>(7);
     do {
      if ($151) {
       $152 = ($$0$i$i|0)>(15);
       if ($152) {
        $153 = ($$020$i$i|0)<(65536);
        $$$i$i = $153 ? 84 : 80;
        $$018$i$i = $$$i$i;
        break;
       } else {
        $154 = ($$020$i$i|0)<(256);
        $$22$i$i = $154 ? 82 : 80;
        $$018$i$i = $$22$i$i;
        break;
       }
      } else {
       $$018$i$i = 80;
      }
     } while(0);
     $155 = HEAP32[4371]|0;
     $156 = HEAP32[4370]|0;
     $157 = (($156) + (($155*24)|0)|0);
     HEAP32[$157>>2] = $$018$i$i;
     $158 = (((($156) + (($155*24)|0)|0)) + 8|0);
     HEAP32[$158>>2] = $$020$i$i;
     $159 = (($155) + 1)|0;
     HEAP32[4371] = $159;
     $160 = (((($156) + (($155*24)|0)|0)) + 16|0);
     HEAP32[$160>>2] = 0;
     break;
    }
    case 38:  {
     (_GetByte()|0);
     $161 = HEAP8[20560]|0;
     $162 = $161 & -8;
     $163 = ($162<<24>>24)==(48);
     do {
      if ($163) {
       $$01517$i$i = 0;$$018$i18$i = 0;$165 = $161;
       while(1) {
        $164 = $165&255;
        $166 = $$01517$i$i << 3;
        $167 = $164 & 7;
        $168 = $166 | $167;
        $169 = (($$018$i18$i) + 1)|0;
        (_GetByte()|0);
        $170 = HEAP8[20560]|0;
        $171 = $170 & -8;
        $172 = ($171<<24>>24)==(48);
        if ($172) {
         $$01517$i$i = $168;$$018$i18$i = $169;$165 = $170;
        } else {
         break;
        }
       }
       $173 = ($$018$i18$i|0)>(2);
       if ($173) {
        $174 = ($$018$i18$i|0)>(5);
        if ($174) {
         $175 = ($168|0)<(65536);
         $$$i19$i = $175 ? 84 : 80;
         $$014$i$i = $$$i19$i;$$015$lcssa21$i$i = $168;
         break;
        } else {
         $176 = ($168|0)<(256);
         $$16$i$i = $176 ? 82 : 80;
         $$014$i$i = $$16$i$i;$$015$lcssa21$i$i = $168;
         break;
        }
       } else {
        $$014$i$i = 80;$$015$lcssa21$i$i = $168;
       }
      } else {
       $$014$i$i = 80;$$015$lcssa21$i$i = 0;
      }
     } while(0);
     $177 = HEAP32[4371]|0;
     $178 = HEAP32[4370]|0;
     $179 = (($178) + (($177*24)|0)|0);
     HEAP32[$179>>2] = $$014$i$i;
     $180 = (((($178) + (($177*24)|0)|0)) + 8|0);
     HEAP32[$180>>2] = $$015$lcssa21$i$i;
     $181 = (($177) + 1)|0;
     HEAP32[4371] = $181;
     $182 = (((($178) + (($177*24)|0)|0)) + 16|0);
     HEAP32[$182>>2] = 0;
     break;
    }
    case 36:  {
     $$0$i20$i = 0;$$027$i$i = -1;
     while(1) {
      $183 = (($$027$i$i) + 1)|0;
      $184 = (_GetByte()|0);
      $185 = $184&255;
      $186 = (9945 + ($185)|0);
      $187 = HEAP8[$186>>0]|0;
      $188 = $187&255;
      $189 = $188 & 32;
      $190 = $189 | $185;
      $sext$i$i = $190 << 24;
      $191 = $sext$i$i >> 24;
      $sext$off$i$i = (($sext$i$i) + -788529153)|0;
      $192 = ($sext$off$i$i>>>0)<(184549375);
      $193 = $$0$i20$i << 4;
      $194 = (($193) + -48)|0;
      $195 = (($194) + ($191))|0;
      $$$0$i$i = $192 ? $195 : $$0$i20$i;
      $sext$off33$i$i = (($sext$i$i) + -1610612737)|0;
      $196 = ($sext$off33$i$i>>>0)<(117440511);
      $197 = $$$0$i$i << 4;
      $198 = (($191) + -87)|0;
      $199 = (($198) + ($197))|0;
      $brmerge$i$i = $196 | $192;
      $$mux$i$i = $196 ? $199 : $$$0$i$i;
      if ($brmerge$i$i) {
       $$0$i20$i = $$mux$i$i;$$027$i$i = $183;
      } else {
       break;
      }
     }
     $200 = ($$027$i$i|0)>(1);
     do {
      if ($200) {
       $201 = ($$027$i$i|0)>(3);
       if ($201) {
        $202 = ($$$0$i$i|0)<(65536);
        $$$i22$i = $202 ? 84 : 80;
        $$026$i$i = $$$i22$i;
        break;
       } else {
        $203 = ($$$0$i$i|0)<(256);
        $$31$i$i = $203 ? 82 : 80;
        $$026$i$i = $$31$i$i;
        break;
       }
      } else {
       $$026$i$i = 80;
      }
     } while(0);
     $204 = HEAP32[4371]|0;
     $205 = HEAP32[4370]|0;
     $206 = (($205) + (($204*24)|0)|0);
     HEAP32[$206>>2] = $$026$i$i;
     $207 = (((($205) + (($204*24)|0)|0)) + 8|0);
     HEAP32[$207>>2] = $$$0$i$i;
     $208 = (($204) + 1)|0;
     HEAP32[4371] = $208;
     $209 = (((($205) + (($204*24)|0)|0)) + 16|0);
     HEAP32[$209>>2] = 0;
     break;
    }
    case 42:  {
     (_GetByte()|0);
     _vcpu_read_pc($1);
     $210 = HEAP32[$1>>2]|0;
     $211 = $210 & 16;
     $212 = ($211|0)==(0);
     if ($212) {
      $213 = HEAP32[4366]|0;
      $214 = ((($213)) + 4|0);
      HEAP32[$214>>2] = 0;
      _DynaBuf_add_string($213,8984);
      $215 = HEAP32[4366]|0;
      $216 = ((($215)) + 4|0);
      $217 = HEAP32[$216>>2]|0;
      $218 = ($217|0)==(0);
      if ($218) {
       label = 73;
       break L1;
      }
      HEAP32[$216>>2] = 1;
      _DynaBuf_append($215,0);
      $$pre$i$i = HEAP32[$1>>2]|0;
      $220 = $$pre$i$i;
     } else {
      $220 = $210;
     }
     $219 = $220 | 64;
     $221 = HEAP32[4371]|0;
     $222 = HEAP32[4370]|0;
     $223 = (($222) + (($221*24)|0)|0);
     HEAP32[$223>>2] = $219;
     $224 = HEAP32[$3>>2]|0;
     $225 = (((($222) + (($221*24)|0)|0)) + 8|0);
     HEAP32[$225>>2] = $224;
     $226 = HEAP32[$4>>2]|0;
     $227 = (($221) + 1)|0;
     HEAP32[4371] = $227;
     $228 = (((($222) + (($221*24)|0)|0)) + 16|0);
     HEAP32[$228>>2] = $226;
     break;
    }
    case 46:  {
     (_GetByte()|0);
     $229 = HEAP8[20560]|0;
     $$off$i = (($229) + -48)<<24>>24;
     $230 = ($$off$i&255)<(10);
     if ($230) {
      $$010$i$i = 0.0;$$079$i$i = 1.0;$232 = $229;
      while(1) {
       $231 = $232&255;
       $233 = $$010$i$i * 10.0;
       $234 = $231 & 15;
       $235 = (+($234|0));
       $236 = $233 + $235;
       $237 = $$079$i$i * 10.0;
       (_GetByte()|0);
       $238 = HEAP8[20560]|0;
       $$off$i$i = (($238) + -48)<<24>>24;
       $239 = ($$off$i$i&255)<(10);
       if ($239) {
        $$010$i$i = $236;$$079$i$i = $237;$232 = $238;
       } else {
        break;
       }
      }
      $240 = HEAP32[4371]|0;
      $241 = HEAP32[4370]|0;
      $242 = (($241) + (($240*24)|0)|0);
      HEAP32[$242>>2] = 336;
      $243 = $236 / $237;
      $244 = (((($241) + (($240*24)|0)|0)) + 8|0);
      HEAPF64[$244>>3] = $243;
      $245 = (($240) + 1)|0;
      HEAP32[4371] = $245;
      $246 = (((($241) + (($240*24)|0)|0)) + 16|0);
      HEAP32[$246>>2] = 0;
      break L28;
     }
     $247 = (_Input_read_keyword()|0);
     $248 = ($247|0)==(0);
     if ($248) {
      label = 87;
      break L1;
     }
     $249 = HEAP32[1337]|0;
     $250 = HEAP32[$249>>2]|0;
     $251 = HEAP32[4380]|0;
     $252 = ((($251)) + 4|0);
     $253 = HEAP32[$252>>2]|0;
     $254 = (_symbol_find($250,32)|0);
     $255 = HEAP32[$254>>2]|0;
     $256 = $255 & 16;
     $257 = ($256|0)==(0);
     if ($257) {
      $258 = HEAP32[4380]|0;
      $259 = HEAP32[$258>>2]|0;
      $260 = HEAP32[4366]|0;
      $261 = ((($260)) + 4|0);
      HEAP32[$261>>2] = 0;
      _DynaBuf_append($260,46);
      $$pre$i26$i = HEAP32[4366]|0;
      _DynaBuf_add_string($$pre$i26$i,$259);
      $262 = HEAP32[4366]|0;
      $263 = ((($262)) + 4|0);
      $264 = HEAP32[$263>>2]|0;
      $265 = ($264>>>0)<($253>>>0);
      if ($265) {
       label = 82;
       break L1;
      }
      HEAP32[$263>>2] = $253;
      _DynaBuf_append($262,0);
     }
     $267 = HEAP32[4388]|0;
     $268 = ($267|0)==(0);
     if ($268) {
      $269 = ((($254)) + 24|0);
      $270 = HEAP32[$269>>2]|0;
      $271 = (($270) + 1)|0;
      HEAP32[$269>>2] = $271;
     }
     $272 = HEAP32[4371]|0;
     $273 = HEAP32[4370]|0;
     $274 = (($273) + (($272*24)|0)|0);
     ;HEAP32[$274>>2]=HEAP32[$254>>2]|0;HEAP32[$274+4>>2]=HEAP32[$254+4>>2]|0;HEAP32[$274+8>>2]=HEAP32[$254+8>>2]|0;HEAP32[$274+12>>2]=HEAP32[$254+12>>2]|0;HEAP32[$274+16>>2]=HEAP32[$254+16>>2]|0;HEAP32[$274+20>>2]=HEAP32[$254+20>>2]|0;
     $275 = (($272) + 1)|0;
     HEAP32[4371] = $275;
     $276 = (($273) + (($272*24)|0)|0);
     $277 = HEAP32[$276>>2]|0;
     $278 = $277 | 64;
     HEAP32[$276>>2] = $278;
     break;
    }
    default: {
     $$off37$i = (($25) + -48)<<24>>24;
     $279 = ($$off37$i&255)<(10);
     $280 = $25&255;
     if (!($279)) {
      $359 = (9945 + ($280)|0);
      $360 = HEAP8[$359>>0]|0;
      $361 = ($360<<24>>24)<(0);
      if (!($361)) {
       $426 = HEAP32[4371]|0;
       $427 = HEAP32[4370]|0;
       $428 = (($427) + (($426*24)|0)|0);
       HEAP32[$428>>2] = 0;
       $429 = (((($427) + (($426*24)|0)|0)) + 8|0);
       HEAP32[$429>>2] = 0;
       $430 = (($426) + 1)|0;
       HEAP32[4371] = $430;
       $431 = (((($427) + (($426*24)|0)|0)) + 16|0);
       HEAP32[$431>>2] = 0;
       $432 = HEAP32[4374]|0;
       $433 = (($432) + -1)|0;
       $434 = HEAP32[4369]|0;
       $435 = (($434) + ($433<<2)|0);
       $436 = HEAP32[$435>>2]|0;
       $437 = ($436|0)==(576|0);
       if (!($437)) {
        label = 133;
        break L1;
       }
       $438 = (($432) + 1)|0;
       HEAP32[4374] = $438;
       $439 = (($434) + ($432<<2)|0);
       HEAP32[$439>>2] = 17500;
       HEAP32[4372] = 2;
       continue L3;
      }
      $362 = (_Input_read_keyword()|0);
      $363 = ($362|0)==(3);
      if ($363) {
       $364 = HEAP32[4380]|0;
       $365 = HEAP32[$364>>2]|0;
       $366 = HEAP8[$365>>0]|0;
       $367 = $366 << 24 >> 24;
       $368 = $367 | 32;
       $369 = ($368|0)==(110);
       if ($369) {
        $370 = ((($365)) + 1|0);
        $371 = HEAP8[$370>>0]|0;
        $372 = $371 << 24 >> 24;
        $373 = $372 | 32;
        $374 = ($373|0)==(111);
        if ($374) {
         $375 = ((($365)) + 2|0);
         $376 = HEAP8[$375>>0]|0;
         $377 = $376 << 24 >> 24;
         $378 = $377 | 32;
         $379 = ($378|0)==(116);
         if ($379) {
          label = 118;
          break L3;
         }
        }
       }
      }
      $384 = HEAP8[20560]|0;
      $385 = ($384<<24>>24)==(40);
      if ($385) {
       label = 120;
       break L3;
      }
      $397 = HEAP32[4380]|0;
      $398 = ((($397)) + 4|0);
      $399 = HEAP32[$398>>2]|0;
      $400 = (($399) + -1)|0;
      $401 = (_symbol_find(0,32)|0);
      $402 = HEAP32[$401>>2]|0;
      $403 = $402 & 16;
      $404 = ($403|0)==(0);
      if ($404) {
       $405 = HEAP32[4380]|0;
       $406 = HEAP32[$405>>2]|0;
       $407 = HEAP32[4366]|0;
       $408 = ((($407)) + 4|0);
       HEAP32[$408>>2] = 0;
       _DynaBuf_add_string($407,$406);
       $409 = HEAP32[4366]|0;
       $410 = ((($409)) + 4|0);
       $411 = HEAP32[$410>>2]|0;
       $412 = ($411>>>0)<($400>>>0);
       if ($412) {
        label = 126;
        break L1;
       }
       HEAP32[$410>>2] = $400;
       _DynaBuf_append($409,0);
      }
      $414 = HEAP32[4388]|0;
      $415 = ($414|0)==(0);
      if ($415) {
       $416 = ((($401)) + 24|0);
       $417 = HEAP32[$416>>2]|0;
       $418 = (($417) + 1)|0;
       HEAP32[$416>>2] = $418;
      }
      $419 = HEAP32[4371]|0;
      $420 = HEAP32[4370]|0;
      $421 = (($420) + (($419*24)|0)|0);
      ;HEAP32[$421>>2]=HEAP32[$401>>2]|0;HEAP32[$421+4>>2]=HEAP32[$401+4>>2]|0;HEAP32[$421+8>>2]=HEAP32[$401+8>>2]|0;HEAP32[$421+12>>2]=HEAP32[$401+12>>2]|0;HEAP32[$421+16>>2]=HEAP32[$401+16>>2]|0;HEAP32[$421+20>>2]=HEAP32[$401+20>>2]|0;
      $422 = (($419) + 1)|0;
      HEAP32[4371] = $422;
      $423 = (($420) + (($419*24)|0)|0);
      $424 = HEAP32[$423>>2]|0;
      $425 = $424 | 64;
      HEAP32[$423>>2] = $425;
      break L28;
     }
     $281 = $280 & 15;
     (_GetByte()|0);
     $282 = ($281|0)==(0);
     L50: do {
      if ($282) {
       $283 = HEAP8[20560]|0;
       switch ($283<<24>>24) {
       case 98:  {
        $$0$i$i$i = -1;$$020$i$i$i = 0;
        break;
       }
       case 120:  {
        $$0$i5$i$i = 0;$$027$i$i$i = -1;
        while(1) {
         $300 = (($$027$i$i$i) + 1)|0;
         $301 = (_GetByte()|0);
         $302 = $301&255;
         $303 = (9945 + ($302)|0);
         $304 = HEAP8[$303>>0]|0;
         $305 = $304&255;
         $306 = $305 & 32;
         $307 = $306 | $302;
         $sext$i$i$i = $307 << 24;
         $308 = $sext$i$i$i >> 24;
         $sext$off$i$i$i = (($sext$i$i$i) + -788529153)|0;
         $309 = ($sext$off$i$i$i>>>0)<(184549375);
         $310 = $$0$i5$i$i << 4;
         $311 = (($310) + -48)|0;
         $312 = (($311) + ($308))|0;
         $$$0$i$i$i = $309 ? $312 : $$0$i5$i$i;
         $sext$off33$i$i$i = (($sext$i$i$i) + -1610612737)|0;
         $313 = ($sext$off33$i$i$i>>>0)<(117440511);
         $314 = $$$0$i$i$i << 4;
         $315 = (($308) + -87)|0;
         $316 = (($315) + ($314))|0;
         $brmerge$i$i$i = $313 | $309;
         $$mux$i$i$i = $313 ? $316 : $$$0$i$i$i;
         if ($brmerge$i$i$i) {
          $$0$i5$i$i = $$mux$i$i$i;$$027$i$i$i = $300;
         } else {
          break;
         }
        }
        $317 = ($$027$i$i$i|0)>(1);
        do {
         if ($317) {
          $318 = ($$027$i$i$i|0)>(3);
          if ($318) {
           $319 = ($$$0$i$i$i|0)<(65536);
           $$$i7$i$i = $319 ? 84 : 80;
           $$026$i$i$i = $$$i7$i$i;
           break;
          } else {
           $320 = ($$$0$i$i$i|0)<(256);
           $$31$i$i$i = $320 ? 82 : 80;
           $$026$i$i$i = $$31$i$i$i;
           break;
          }
         } else {
          $$026$i$i$i = 80;
         }
        } while(0);
        $321 = HEAP32[4371]|0;
        $322 = HEAP32[4370]|0;
        $323 = (($322) + (($321*24)|0)|0);
        HEAP32[$323>>2] = $$026$i$i$i;
        $324 = (((($322) + (($321*24)|0)|0)) + 8|0);
        HEAP32[$324>>2] = $$$0$i$i$i;
        $325 = (($321) + 1)|0;
        HEAP32[4371] = $325;
        $326 = (((($322) + (($321*24)|0)|0)) + 16|0);
        HEAP32[$326>>2] = 0;
        break L28;
        break;
       }
       default: {
        $$0$i30$i = 0;$327 = $283;
        break L50;
       }
       }
       L62: while(1) {
        $284 = (($$0$i$i$i) + 1)|0;
        $285 = (_GetByte()|0);
        $286 = $285 << 24 >> 24;
        switch ($286|0) {
        case 46: case 48:  {
         $287 = $$020$i$i$i << 1;
         $$0$i$i$i = $284;$$020$i$i$i = $287;
         continue L62;
         break;
        }
        case 35: case 49:  {
         $288 = $$020$i$i$i << 1;
         $289 = $288 | 1;
         $$0$i$i$i = $284;$$020$i$i$i = $289;
         continue L62;
         break;
        }
        default: {
         break L62;
        }
        }
       }
       $290 = ($$0$i$i$i|0)>(7);
       do {
        if ($290) {
         $291 = ($$0$i$i$i|0)>(15);
         if ($291) {
          $292 = ($$020$i$i$i|0)<(65536);
          $$$i$i$i = $292 ? 84 : 80;
          $$018$i$i$i = $$$i$i$i;
          break;
         } else {
          $293 = ($$020$i$i$i|0)<(256);
          $$22$i$i$i = $293 ? 82 : 80;
          $$018$i$i$i = $$22$i$i$i;
          break;
         }
        } else {
         $$018$i$i$i = 80;
        }
       } while(0);
       $294 = HEAP32[4371]|0;
       $295 = HEAP32[4370]|0;
       $296 = (($295) + (($294*24)|0)|0);
       HEAP32[$296>>2] = $$018$i$i$i;
       $297 = (((($295) + (($294*24)|0)|0)) + 8|0);
       HEAP32[$297>>2] = $$020$i$i$i;
       $298 = (($294) + 1)|0;
       HEAP32[4371] = $298;
       $299 = (((($295) + (($294*24)|0)|0)) + 16|0);
       HEAP32[$299>>2] = 0;
       break L28;
      } else {
       $$0$ph$i$i = $281;
       label = 105;
      }
     } while(0);
     while(1) {
      if ((label|0) == 105) {
       label = 0;
       $$pr$i$i = HEAP8[20560]|0;
       $$0$i30$i = $$0$ph$i$i;$327 = $$pr$i$i;
      }
      $$off$i31$i = (($327) + -48)<<24>>24;
      $328 = ($$off$i31$i&255)<(10);
      if (!($328)) {
       break;
      }
      $329 = $327&255;
      $330 = ($$0$i30$i*10)|0;
      $331 = $329 & 15;
      $332 = (($330) + ($331))|0;
      (_GetByte()|0);
      $$0$ph$i$i = $332;
      label = 105;
     }
     $333 = ($327<<24>>24)==(46);
     if (!($333)) {
      $353 = HEAP32[4371]|0;
      $354 = HEAP32[4370]|0;
      $355 = (($354) + (($353*24)|0)|0);
      HEAP32[$355>>2] = 80;
      $356 = (((($354) + (($353*24)|0)|0)) + 8|0);
      HEAP32[$356>>2] = $$0$i30$i;
      $357 = (($353) + 1)|0;
      HEAP32[4371] = $357;
      $358 = (((($354) + (($353*24)|0)|0)) + 16|0);
      HEAP32[$358>>2] = 0;
      break L28;
     }
     (_GetByte()|0);
     $334 = (+($$0$i30$i|0));
     $335 = HEAP8[20560]|0;
     $$off8$i$i$i = (($335) + -48)<<24>>24;
     $336 = ($$off8$i$i$i&255)<(10);
     if ($336) {
      $$010$i$i$i = $334;$$079$i$i$i = 1.0;$338 = $335;
      while(1) {
       $337 = $338&255;
       $339 = $$010$i$i$i * 10.0;
       $340 = $337 & 15;
       $341 = (+($340|0));
       $342 = $339 + $341;
       $343 = $$079$i$i$i * 10.0;
       (_GetByte()|0);
       $344 = HEAP8[20560]|0;
       $$off$i$i$i = (($344) + -48)<<24>>24;
       $345 = ($$off$i$i$i&255)<(10);
       if ($345) {
        $$010$i$i$i = $342;$$079$i$i$i = $343;$338 = $344;
       } else {
        $$0$lcssa$i$i$i = $342;$$07$lcssa$i$i$i = $343;
        break;
       }
      }
     } else {
      $$0$lcssa$i$i$i = $334;$$07$lcssa$i$i$i = 1.0;
     }
     $346 = HEAP32[4371]|0;
     $347 = HEAP32[4370]|0;
     $348 = (($347) + (($346*24)|0)|0);
     HEAP32[$348>>2] = 336;
     $349 = $$0$lcssa$i$i$i / $$07$lcssa$i$i$i;
     $350 = (((($347) + (($346*24)|0)|0)) + 8|0);
     HEAPF64[$350>>3] = $349;
     $351 = (($346) + 1)|0;
     HEAP32[4371] = $351;
     $352 = (((($347) + (($346*24)|0)|0)) + 16|0);
     HEAP32[$352>>2] = 0;
    }
    }
   } while(0);
   HEAP32[4372] = 1;
  }
  switch (label|0) {
   case 39: {
    label = 0;
    $124 = ($$013$i|0)==(0);
    if ($124) {
     $125 = HEAP32[4374]|0;
     $126 = (($125) + 1)|0;
     HEAP32[4374] = $126;
     $127 = HEAP32[4369]|0;
     $128 = (($127) + ($125<<2)|0);
     HEAP32[$128>>2] = 584;
     $$3$ph = $$0$ph;
    } else {
     $$3$ph = $$0$ph;
    }
    break;
   }
   case 118: {
    label = 0;
    $380 = HEAP32[4374]|0;
    $381 = (($380) + 1)|0;
    HEAP32[4374] = $381;
    $382 = HEAP32[4369]|0;
    $383 = (($382) + ($380<<2)|0);
    HEAP32[$383>>2] = 592;
    $$3$ph = $$0$ph;
    break;
   }
   case 120: {
    label = 0;
    $386 = HEAP32[4365]|0;
    $387 = HEAP32[4380]|0;
    _DynaBuf_to_lower($386,$387);
    $388 = HEAP32[4368]|0;
    $389 = HEAP32[4365]|0;
    $390 = (_Tree_easy_scan($388,$1,$389)|0);
    $391 = ($390|0)==(0);
    if ($391) {
     _Throw_error(8986);
    } else {
     $392 = HEAP32[$1>>2]|0;
     $393 = HEAP32[4374]|0;
     $394 = (($393) + 1)|0;
     HEAP32[4374] = $394;
     $395 = HEAP32[4369]|0;
     $396 = (($395) + ($393<<2)|0);
     HEAP32[$396>>2] = $392;
    }
    $$3$ph = $$0$ph;
    break;
   }
   case 134: {
    label = 0;
    $$012$i = 600;
    label = 138;
    break;
   }
   case 135: {
    label = 0;
    $$012$i = 608;
    label = 138;
    break;
   }
   case 136: {
    label = 0;
    $$012$i = 616;
    label = 138;
    break;
   }
   case 137: {
    label = 0;
    $$012$i = 624;
    label = 138;
    break;
   }
   case 140: {
    label = 0;
    $444 = HEAP8[20560]|0;
    $445 = ($444<<24>>24)==(32);
    if ($445) {
     (_GetByte()|0);
     $$pre$i17 = HEAP8[20560]|0;
     $447 = $$pre$i17;
    } else {
     $447 = $444;
    }
    $446 = $447 << 24 >> 24;
    L191: do {
     switch ($446|0) {
     case 94:  {
      $$0$i = 688;
      label = 165;
      break;
     }
     case 43:  {
      $$0$i = 680;
      label = 165;
      break;
     }
     case 45:  {
      $$0$i = 672;
      label = 165;
      break;
     }
     case 42:  {
      $$0$i = 664;
      label = 165;
      break;
     }
     case 47:  {
      $$0$i = 656;
      label = 165;
      break;
     }
     case 37:  {
      $$0$i = 536;
      label = 165;
      break;
     }
     case 38:  {
      $$0$i = 544;
      label = 165;
      break;
     }
     case 124:  {
      $$0$i = 552;
      label = 165;
      break;
     }
     case 61:  {
      $448 = (_GetByte()|0);
      $449 = ($448<<24>>24)==(61);
      if ($449) {
       _Throw_first_pass_warning(9004);
       $$0$i = 648;
       label = 165;
      } else {
       $$1$i = 648;
       label = 166;
      }
      break;
     }
     case 41:  {
      $$0$i = 640;
      label = 165;
      break;
     }
     case 33:  {
      $450 = (_GetByte()|0);
      $451 = ($450<<24>>24)==(61);
      if ($451) {
       $$0$i = 632;
       label = 165;
      } else {
       _Throw_error(9931);
       $storemerge$i = 4;
      }
      break;
     }
     case 60:  {
      $452 = (_GetByte()|0);
      $453 = $452 << 24 >> 24;
      switch ($453|0) {
      case 61:  {
       $$0$i = 696;
       label = 165;
       break L191;
       break;
      }
      case 60:  {
       $$0$i = 520;
       label = 165;
       break L191;
       break;
      }
      case 62:  {
       $$0$i = 632;
       label = 165;
       break L191;
       break;
      }
      default: {
       $$1$i = 712;
       label = 166;
       break L191;
      }
      }
      break;
     }
     case 62:  {
      $454 = (_GetByte()|0);
      $455 = $454 << 24 >> 24;
      switch ($455|0) {
      case 61:  {
       $$0$i = 704;
       label = 165;
       break L191;
       break;
      }
      case 60:  {
       $$0$i = 632;
       label = 165;
       break L191;
       break;
      }
      case 62:  {
       $456 = (_GetByte()|0);
       $457 = ($456<<24>>24)==(62);
       if ($457) {
        $$0$i = 512;
        label = 165;
        break L191;
       } else {
        $$1$i = 504;
        label = 166;
        break L191;
       }
       break;
      }
      default: {
       $$1$i = 720;
       label = 166;
       break L191;
      }
      }
      break;
     }
     default: {
      $458 = $447&255;
      $459 = (9945 + ($458)|0);
      $460 = HEAP8[$459>>0]|0;
      $461 = ($460<<24>>24)<(0);
      if ($461) {
       (_Input_read_and_lower_keyword()|0);
       $462 = HEAP32[4367]|0;
       $463 = HEAP32[4380]|0;
       $464 = (_Tree_easy_scan($462,$1,$463)|0);
       $465 = ($464|0)==(0);
       if ($465) {
        _Throw_error(9038);
        $storemerge$i = 4;
        break L191;
       } else {
        $466 = HEAP32[$1>>2]|0;
        $$1$i = $466;
        label = 166;
        break L191;
       }
      } else {
       $$1$i = 17500;
       label = 166;
      }
     }
     }
    } while(0);
    if ((label|0) == 165) {
     label = 0;
     (_GetByte()|0);
     $$1$i = $$0$i;
     label = 166;
    }
    if ((label|0) == 166) {
     label = 0;
     $467 = HEAP32[4374]|0;
     $468 = (($467) + 1)|0;
     HEAP32[4374] = $468;
     $469 = HEAP32[4369]|0;
     $470 = (($469) + ($467<<2)|0);
     HEAP32[$470>>2] = $$1$i;
     $storemerge$i = 2;
    }
    HEAP32[4372] = $storemerge$i;
    $$3$ph = $$0$ph;
    break;
   }
   case 178: {
    label = 0;
    $490 = (($$0$ph) + 1)|0;
    $$1 = $490;$1468 = $471;$1470 = $474;
    label = 431;
    break;
   }
   case 180: {
    label = 0;
    _Throw_error(9075);
    label = 430;
    break;
   }
   case 181: {
    label = 0;
    $491 = HEAP32[4371]|0;
    $492 = (($491) + -1)|0;
    $493 = HEAP32[4370]|0;
    $494 = (((($493) + (($492*24)|0)|0)) + 16|0);
    HEAP32[$494>>2] = 1;
    label = 430;
    break;
   }
   case 182: {
    label = 0;
    $495 = HEAP32[4371]|0;
    $496 = (($495) + -1)|0;
    $497 = HEAP32[4370]|0;
    $498 = (($497) + (($496*24)|0)|0);
    $499 = HEAP32[$498>>2]|0;
    $500 = $499 & 256;
    $501 = ($500|0)==(0);
    if (!($501)) {
     $502 = (((($497) + (($496*24)|0)|0)) + 8|0);
     $503 = +HEAPF64[$502>>3];
     $504 = (~~(($503)));
     HEAP32[$502>>2] = $504;
     $505 = $499 & -257;
     HEAP32[$498>>2] = $505;
    }
    $506 = (((($497) + (($496*24)|0)|0)) + 16|0);
    HEAP32[$506>>2] = 0;
    label = 430;
    break;
   }
   case 185: {
    label = 0;
    $507 = HEAP32[4371]|0;
    $508 = (($507) + -1)|0;
    $509 = HEAP32[4370]|0;
    $510 = (($509) + (($508*24)|0)|0);
    $511 = HEAP32[$510>>2]|0;
    $512 = $511 & 256;
    $513 = ($512|0)==(0);
    if ($513) {
     $514 = (((($509) + (($508*24)|0)|0)) + 8|0);
     $515 = HEAP32[$514>>2]|0;
     $516 = (+($515|0));
     HEAPF64[$514>>3] = $516;
     $517 = $511 | 256;
     HEAP32[$510>>2] = $517;
    }
    $518 = (((($509) + (($508*24)|0)|0)) + 16|0);
    HEAP32[$518>>2] = 0;
    label = 430;
    break;
   }
   case 188: {
    label = 0;
    $519 = HEAP32[4371]|0;
    $520 = (($519) + -1)|0;
    $521 = HEAP32[4370]|0;
    $522 = (($521) + (($520*24)|0)|0);
    $523 = HEAP32[$522>>2]|0;
    $524 = $523 & 256;
    $525 = ($524|0)==(0);
    if ($525) {
     $526 = (((($521) + (($520*24)|0)|0)) + 8|0);
     $527 = HEAP32[$526>>2]|0;
     $528 = (+($527|0));
     HEAPF64[$526>>3] = $528;
     $529 = $523 | 256;
     HEAP32[$522>>2] = $529;
     $$pre108$i = (((($521) + (($520*24)|0)|0)) + 8|0);
     $$pre$phi$iZ2D = $$pre108$i;$530 = $528;
    } else {
     $$phi$trans$insert$i$i = (((($521) + (($520*24)|0)|0)) + 8|0);
     $$pre$i$i18 = +HEAPF64[$$phi$trans$insert$i$i>>3];
     $$pre$phi$iZ2D = $$phi$trans$insert$i$i;$530 = $$pre$i$i18;
    }
    $531 = (+Math_sin((+$530)));
    HEAPF64[$$pre$phi$iZ2D>>3] = $531;
    $532 = (((($521) + (($520*24)|0)|0)) + 16|0);
    HEAP32[$532>>2] = 0;
    label = 430;
    break;
   }
   case 192: {
    label = 0;
    $533 = HEAP32[4371]|0;
    $534 = (($533) + -1)|0;
    $535 = HEAP32[4370]|0;
    $536 = (($535) + (($534*24)|0)|0);
    $537 = HEAP32[$536>>2]|0;
    $538 = $537 & 256;
    $539 = ($538|0)==(0);
    if ($539) {
     $540 = (((($535) + (($534*24)|0)|0)) + 8|0);
     $541 = HEAP32[$540>>2]|0;
     $542 = (+($541|0));
     HEAPF64[$540>>3] = $542;
     $543 = $537 | 256;
     HEAP32[$536>>2] = $543;
     $$pre109$i = (((($535) + (($534*24)|0)|0)) + 8|0);
     $$pre$phi110$iZ2D = $$pre109$i;$544 = $542;
    } else {
     $$phi$trans$insert$i2$i = (((($535) + (($534*24)|0)|0)) + 8|0);
     $$pre$i3$i = +HEAPF64[$$phi$trans$insert$i2$i>>3];
     $$pre$phi110$iZ2D = $$phi$trans$insert$i2$i;$544 = $$pre$i3$i;
    }
    $545 = (+Math_cos((+$544)));
    HEAPF64[$$pre$phi110$iZ2D>>3] = $545;
    $546 = (((($535) + (($534*24)|0)|0)) + 16|0);
    HEAP32[$546>>2] = 0;
    label = 430;
    break;
   }
   case 196: {
    label = 0;
    $547 = HEAP32[4371]|0;
    $548 = (($547) + -1)|0;
    $549 = HEAP32[4370]|0;
    $550 = (($549) + (($548*24)|0)|0);
    $551 = HEAP32[$550>>2]|0;
    $552 = $551 & 256;
    $553 = ($552|0)==(0);
    if ($553) {
     $554 = (((($549) + (($548*24)|0)|0)) + 8|0);
     $555 = HEAP32[$554>>2]|0;
     $556 = (+($555|0));
     HEAPF64[$554>>3] = $556;
     $557 = $551 | 256;
     HEAP32[$550>>2] = $557;
     $$pre111$i = (((($549) + (($548*24)|0)|0)) + 8|0);
     $$pre$phi112$iZ2D = $$pre111$i;$558 = $556;
    } else {
     $$phi$trans$insert$i6$i = (((($549) + (($548*24)|0)|0)) + 8|0);
     $$pre$i7$i = +HEAPF64[$$phi$trans$insert$i6$i>>3];
     $$pre$phi112$iZ2D = $$phi$trans$insert$i6$i;$558 = $$pre$i7$i;
    }
    $559 = (+Math_tan((+$558)));
    HEAPF64[$$pre$phi112$iZ2D>>3] = $559;
    $560 = (((($549) + (($548*24)|0)|0)) + 16|0);
    HEAP32[$560>>2] = 0;
    label = 430;
    break;
   }
   case 200: {
    label = 0;
    $561 = HEAP32[4371]|0;
    $562 = (($561) + -1)|0;
    $563 = HEAP32[4370]|0;
    $564 = (($563) + (($562*24)|0)|0);
    $565 = HEAP32[$564>>2]|0;
    $566 = $565 & 256;
    $567 = ($566|0)==(0);
    if ($567) {
     $568 = (((($563) + (($562*24)|0)|0)) + 8|0);
     $569 = HEAP32[$568>>2]|0;
     $570 = (+($569|0));
     HEAPF64[$568>>3] = $570;
     $571 = $565 | 256;
     HEAP32[$564>>2] = $571;
     $573 = $570;$578 = $571;
    } else {
     $$phi$trans$insert$i10$i = (((($563) + (($562*24)|0)|0)) + 8|0);
     $$pre$i11$i = +HEAPF64[$$phi$trans$insert$i10$i>>3];
     $573 = $$pre$i11$i;$578 = $565;
    }
    $572 = !($573 >= -1.0);
    $574 = !($573 <= 1.0);
    $or$cond$i$i = $572 | $574;
    if ($or$cond$i$i) {
     $577 = $578 & 16;
     $579 = ($577|0)==(0);
     if ($579) {
      $581 = $561;$583 = $563;
     } else {
      _Throw_error(9089);
      $$pre1$i$i = HEAP32[4371]|0;
      $$pre2$i$i = HEAP32[4370]|0;
      $581 = $$pre1$i$i;$583 = $$pre2$i$i;
     }
     $580 = (($581) + -1)|0;
     $582 = (((($583) + (($580*24)|0)|0)) + 8|0);
     HEAPF64[$582>>3] = 0.0;
     $585 = $581;$587 = $583;
    } else {
     $575 = (+Math_asin((+$573)));
     $576 = (((($563) + (($562*24)|0)|0)) + 8|0);
     HEAPF64[$576>>3] = $575;
     $585 = $561;$587 = $563;
    }
    $584 = (($585) + -1)|0;
    $586 = (((($587) + (($584*24)|0)|0)) + 16|0);
    HEAP32[$586>>2] = 0;
    label = 430;
    break;
   }
   case 209: {
    label = 0;
    $588 = HEAP32[4371]|0;
    $589 = (($588) + -1)|0;
    $590 = HEAP32[4370]|0;
    $591 = (($590) + (($589*24)|0)|0);
    $592 = HEAP32[$591>>2]|0;
    $593 = $592 & 256;
    $594 = ($593|0)==(0);
    if ($594) {
     $595 = (((($590) + (($589*24)|0)|0)) + 8|0);
     $596 = HEAP32[$595>>2]|0;
     $597 = (+($596|0));
     HEAPF64[$595>>3] = $597;
     $598 = $592 | 256;
     HEAP32[$591>>2] = $598;
     $600 = $597;$605 = $598;
    } else {
     $$phi$trans$insert$i13$i = (((($590) + (($589*24)|0)|0)) + 8|0);
     $$pre$i14$i = +HEAPF64[$$phi$trans$insert$i13$i>>3];
     $600 = $$pre$i14$i;$605 = $592;
    }
    $599 = !($600 >= -1.0);
    $601 = !($600 <= 1.0);
    $or$cond$i16$i = $599 | $601;
    if ($or$cond$i16$i) {
     $604 = $605 & 16;
     $606 = ($604|0)==(0);
     if ($606) {
      $608 = $588;$610 = $590;
     } else {
      _Throw_error(9089);
      $$pre1$i17$i = HEAP32[4371]|0;
      $$pre2$i18$i = HEAP32[4370]|0;
      $608 = $$pre1$i17$i;$610 = $$pre2$i18$i;
     }
     $607 = (($608) + -1)|0;
     $609 = (((($610) + (($607*24)|0)|0)) + 8|0);
     HEAPF64[$609>>3] = 0.0;
     $612 = $608;$614 = $610;
    } else {
     $602 = (+Math_acos((+$600)));
     $603 = (((($590) + (($589*24)|0)|0)) + 8|0);
     HEAPF64[$603>>3] = $602;
     $612 = $588;$614 = $590;
    }
    $611 = (($612) + -1)|0;
    $613 = (((($614) + (($611*24)|0)|0)) + 16|0);
    HEAP32[$613>>2] = 0;
    label = 430;
    break;
   }
   case 218: {
    label = 0;
    $615 = HEAP32[4371]|0;
    $616 = (($615) + -1)|0;
    $617 = HEAP32[4370]|0;
    $618 = (($617) + (($616*24)|0)|0);
    $619 = HEAP32[$618>>2]|0;
    $620 = $619 & 256;
    $621 = ($620|0)==(0);
    if ($621) {
     $622 = (((($617) + (($616*24)|0)|0)) + 8|0);
     $623 = HEAP32[$622>>2]|0;
     $624 = (+($623|0));
     HEAPF64[$622>>3] = $624;
     $625 = $619 | 256;
     HEAP32[$618>>2] = $625;
     $$pre113$i = (((($617) + (($616*24)|0)|0)) + 8|0);
     $$pre$phi114$iZ2D = $$pre113$i;$626 = $624;
    } else {
     $$phi$trans$insert$i20$i = (((($617) + (($616*24)|0)|0)) + 8|0);
     $$pre$i21$i = +HEAPF64[$$phi$trans$insert$i20$i>>3];
     $$pre$phi114$iZ2D = $$phi$trans$insert$i20$i;$626 = $$pre$i21$i;
    }
    $627 = (+Math_atan((+$626)));
    HEAPF64[$$pre$phi114$iZ2D>>3] = $627;
    $628 = (((($617) + (($616*24)|0)|0)) + 16|0);
    HEAP32[$628>>2] = 0;
    label = 430;
    break;
   }
   case 222: {
    label = 0;
    $629 = HEAP32[4371]|0;
    $630 = (($629) + -1)|0;
    $631 = HEAP32[4370]|0;
    $632 = (($631) + (($630*24)|0)|0);
    $633 = HEAP32[$632>>2]|0;
    $634 = $633 & 256;
    $635 = ($634|0)==(0);
    $$phi$trans$insert103$i = (((($631) + (($630*24)|0)|0)) + 8|0);
    if ($635) {
     $$pre105$i = HEAP32[$$phi$trans$insert103$i>>2]|0;
     $$pre$phi116$iZ2D = $$phi$trans$insert103$i;$640 = $$pre105$i;$642 = $633;
    } else {
     $636 = +HEAPF64[$$phi$trans$insert103$i>>3];
     $637 = (~~(($636)));
     HEAP32[$$phi$trans$insert103$i>>2] = $637;
     $638 = $633 & -257;
     HEAP32[$632>>2] = $638;
     $$pre$phi116$iZ2D = $$phi$trans$insert103$i;$640 = $637;$642 = $638;
    }
    $639 = $640 ^ -1;
    HEAP32[$$pre$phi116$iZ2D>>2] = $639;
    $641 = $642 & -9;
    HEAP32[$632>>2] = $641;
    label = 430;
    break;
   }
   case 226: {
    label = 0;
    $643 = HEAP32[4371]|0;
    $644 = (($643) + -1)|0;
    $645 = HEAP32[4370]|0;
    $646 = (($645) + (($644*24)|0)|0);
    $647 = HEAP32[$646>>2]|0;
    $648 = $647 & 256;
    $649 = ($648|0)==(0);
    $650 = (((($645) + (($644*24)|0)|0)) + 8|0);
    if ($649) {
     $653 = HEAP32[$650>>2]|0;
     $654 = (0 - ($653))|0;
     HEAP32[$650>>2] = $654;
    } else {
     $651 = +HEAPF64[$650>>3];
     $652 = -$651;
     HEAPF64[$650>>3] = $652;
    }
    $655 = $647 & -9;
    HEAP32[$646>>2] = $655;
    $656 = (((($645) + (($644*24)|0)|0)) + 16|0);
    $657 = HEAP32[$656>>2]|0;
    $658 = (0 - ($657))|0;
    HEAP32[$656>>2] = $658;
    label = 430;
    break;
   }
   case 230: {
    label = 0;
    $659 = HEAP32[4371]|0;
    $660 = (($659) + -1)|0;
    $661 = HEAP32[4370]|0;
    $662 = (($661) + (($660*24)|0)|0);
    $663 = HEAP32[$662>>2]|0;
    $664 = $663 & 256;
    $665 = ($664|0)==(0);
    $$phi$trans$insert99$i = (((($661) + (($660*24)|0)|0)) + 8|0);
    if ($665) {
     $$pre101$i = HEAP32[$$phi$trans$insert99$i>>2]|0;
     $$pre$phi118$iZ2D = $$phi$trans$insert99$i;$670 = $$pre101$i;$672 = $663;
    } else {
     $666 = +HEAPF64[$$phi$trans$insert99$i>>3];
     $667 = (~~(($666)));
     HEAP32[$$phi$trans$insert99$i>>2] = $667;
     $668 = $663 & -257;
     HEAP32[$662>>2] = $668;
     $$pre$phi118$iZ2D = $$phi$trans$insert99$i;$670 = $667;$672 = $668;
    }
    $669 = $670 & 255;
    HEAP32[$$pre$phi118$iZ2D>>2] = $669;
    $671 = $672 & -16;
    $673 = $671 | 8;
    HEAP32[$662>>2] = $673;
    $674 = (((($661) + (($660*24)|0)|0)) + 16|0);
    HEAP32[$674>>2] = 0;
    label = 430;
    break;
   }
   case 234: {
    label = 0;
    $675 = HEAP32[4371]|0;
    $676 = (($675) + -1)|0;
    $677 = HEAP32[4370]|0;
    $678 = (($677) + (($676*24)|0)|0);
    $679 = HEAP32[$678>>2]|0;
    $680 = $679 & 256;
    $681 = ($680|0)==(0);
    $$phi$trans$insert95$i = (((($677) + (($676*24)|0)|0)) + 8|0);
    if ($681) {
     $$pre97$i = HEAP32[$$phi$trans$insert95$i>>2]|0;
     $$pre$phi120$iZ2D = $$phi$trans$insert95$i;$686 = $$pre97$i;$689 = $679;
    } else {
     $682 = +HEAPF64[$$phi$trans$insert95$i>>3];
     $683 = (~~(($682)));
     HEAP32[$$phi$trans$insert95$i>>2] = $683;
     $684 = $679 & -257;
     HEAP32[$678>>2] = $684;
     $$pre$phi120$iZ2D = $$phi$trans$insert95$i;$686 = $683;$689 = $684;
    }
    $685 = $686 >>> 8;
    $687 = $685 & 255;
    HEAP32[$$pre$phi120$iZ2D>>2] = $687;
    $688 = $689 & -16;
    $690 = $688 | 8;
    HEAP32[$678>>2] = $690;
    $691 = (((($677) + (($676*24)|0)|0)) + 16|0);
    HEAP32[$691>>2] = 0;
    label = 430;
    break;
   }
   case 238: {
    label = 0;
    $692 = HEAP32[4371]|0;
    $693 = (($692) + -1)|0;
    $694 = HEAP32[4370]|0;
    $695 = (($694) + (($693*24)|0)|0);
    $696 = HEAP32[$695>>2]|0;
    $697 = $696 & 256;
    $698 = ($697|0)==(0);
    $$phi$trans$insert91$i = (((($694) + (($693*24)|0)|0)) + 8|0);
    if ($698) {
     $$pre93$i = HEAP32[$$phi$trans$insert91$i>>2]|0;
     $$pre$phi122$iZ2D = $$phi$trans$insert91$i;$703 = $$pre93$i;$706 = $696;
    } else {
     $699 = +HEAPF64[$$phi$trans$insert91$i>>3];
     $700 = (~~(($699)));
     HEAP32[$$phi$trans$insert91$i>>2] = $700;
     $701 = $696 & -257;
     HEAP32[$695>>2] = $701;
     $$pre$phi122$iZ2D = $$phi$trans$insert91$i;$703 = $700;$706 = $701;
    }
    $702 = $703 >>> 16;
    $704 = $702 & 255;
    HEAP32[$$pre$phi122$iZ2D>>2] = $704;
    $705 = $706 & -16;
    $707 = $705 | 8;
    HEAP32[$695>>2] = $707;
    $708 = (((($694) + (($693*24)|0)|0)) + 16|0);
    HEAP32[$708>>2] = 0;
    label = 430;
    break;
   }
   case 242: {
    label = 0;
    $709 = HEAP32[4371]|0;
    $710 = (($709) + -1)|0;
    $711 = HEAP32[4370]|0;
    $712 = (($711) + (($710*24)|0)|0);
    $713 = HEAP32[$712>>2]|0;
    $714 = (($709) + -2)|0;
    $715 = (($711) + (($714*24)|0)|0);
    $716 = HEAP32[$715>>2]|0;
    $717 = $716 | $713;
    $718 = $717 & 256;
    $719 = ($718|0)==(0);
    if (!($719)) {
     $720 = $716 & 256;
     $721 = ($720|0)==(0);
     if ($721) {
      $722 = (((($711) + (($714*24)|0)|0)) + 8|0);
      $723 = HEAP32[$722>>2]|0;
      $724 = (+($723|0));
      HEAPF64[$722>>3] = $724;
      $725 = $716 | 256;
      HEAP32[$715>>2] = $725;
     }
     $726 = $713 & 256;
     $727 = ($726|0)==(0);
     if ($727) {
      $728 = (((($711) + (($710*24)|0)|0)) + 8|0);
      $729 = HEAP32[$728>>2]|0;
      $730 = (+($729|0));
      HEAPF64[$728>>3] = $730;
      $731 = $713 | 256;
      HEAP32[$712>>2] = $731;
      $734 = $730;
     } else {
      $$phi$trans$insert86$i = (((($711) + (($710*24)|0)|0)) + 8|0);
      $$pre87$i = +HEAPF64[$$phi$trans$insert86$i>>3];
      $734 = $$pre87$i;
     }
     $732 = (((($711) + (($714*24)|0)|0)) + 8|0);
     $733 = +HEAPF64[$732>>3];
     $735 = (+Math_pow((+$733),(+$734)));
     HEAPF64[$732>>3] = $735;
     $736 = (((($711) + (($714*24)|0)|0)) + 16|0);
     HEAP32[$736>>2] = 0;
     $1442 = $709;$1444 = $711;
     label = 429;
     break;
    }
    $737 = (((($711) + (($710*24)|0)|0)) + 8|0);
    $738 = HEAP32[$737>>2]|0;
    $739 = ($738|0)>(-1);
    if ($739) {
     $740 = (((($711) + (($714*24)|0)|0)) + 8|0);
     $741 = ($738|0)==(0);
     if ($741) {
      $$0$lcssa$i$i = 1;
     } else {
      $742 = HEAP32[$740>>2]|0;
      $$01011$i$i = $742;$$013$i$i = 1;$$0912$i$i = $738;
      while(1) {
       $743 = $$0912$i$i & 1;
       $744 = ($743|0)==(0);
       $745 = $744 ? 1 : $$01011$i$i;
       $$0$$i$i = Math_imul($745, $$013$i$i)|0;
       $746 = Math_imul($$01011$i$i, $$01011$i$i)|0;
       $747 = $$0912$i$i >> 1;
       $748 = ($747|0)==(0);
       if ($748) {
        $$0$lcssa$i$i = $$0$$i$i;
        break;
       } else {
        $$01011$i$i = $746;$$013$i$i = $$0$$i$i;$$0912$i$i = $747;
       }
      }
     }
     HEAP32[$740>>2] = $$0$lcssa$i$i;
     $756 = $709;$758 = $711;
    } else {
     $749 = $713 & 16;
     $750 = ($749|0)==(0);
     if ($750) {
      $752 = $709;$754 = $711;
     } else {
      _Throw_error(9112);
      $$pre88$i = HEAP32[4371]|0;
      $$pre89$i = HEAP32[4370]|0;
      $752 = $$pre88$i;$754 = $$pre89$i;
     }
     $751 = (($752) + -2)|0;
     $753 = (((($754) + (($751*24)|0)|0)) + 8|0);
     HEAP32[$753>>2] = 0;
     $756 = $752;$758 = $754;
    }
    $755 = (($756) + -2)|0;
    $757 = (((($758) + (($755*24)|0)|0)) + 16|0);
    HEAP32[$757>>2] = 0;
    $1442 = $756;$1444 = $758;
    label = 429;
    break;
   }
   case 258: {
    label = 0;
    $759 = HEAP32[4371]|0;
    $760 = (($759) + -1)|0;
    $761 = HEAP32[4370]|0;
    $762 = (($761) + (($760*24)|0)|0);
    $763 = HEAP32[$762>>2]|0;
    $764 = (($759) + -2)|0;
    $765 = (($761) + (($764*24)|0)|0);
    $766 = HEAP32[$765>>2]|0;
    $767 = $766 | $763;
    $768 = $767 & 256;
    $769 = ($768|0)==(0);
    if ($769) {
     $786 = (((($761) + (($760*24)|0)|0)) + 8|0);
     $787 = HEAP32[$786>>2]|0;
     $788 = (((($761) + (($764*24)|0)|0)) + 8|0);
     $789 = HEAP32[$788>>2]|0;
     $790 = Math_imul($789, $787)|0;
     HEAP32[$788>>2] = $790;
    } else {
     $770 = $766 & 256;
     $771 = ($770|0)==(0);
     if ($771) {
      $772 = (((($761) + (($764*24)|0)|0)) + 8|0);
      $773 = HEAP32[$772>>2]|0;
      $774 = (+($773|0));
      HEAPF64[$772>>3] = $774;
      $775 = $766 | 256;
      HEAP32[$765>>2] = $775;
     }
     $776 = $763 & 256;
     $777 = ($776|0)==(0);
     if ($777) {
      $778 = (((($761) + (($760*24)|0)|0)) + 8|0);
      $779 = HEAP32[$778>>2]|0;
      $780 = (+($779|0));
      HEAPF64[$778>>3] = $780;
      $781 = $763 | 256;
      HEAP32[$762>>2] = $781;
      $785 = $780;
     } else {
      $$phi$trans$insert84$i = (((($761) + (($760*24)|0)|0)) + 8|0);
      $$pre85$i = +HEAPF64[$$phi$trans$insert84$i>>3];
      $785 = $$pre85$i;
     }
     $782 = (((($761) + (($764*24)|0)|0)) + 8|0);
     $783 = +HEAPF64[$782>>3];
     $784 = $785 * $783;
     HEAPF64[$782>>3] = $784;
    }
    $791 = (((($761) + (($764*24)|0)|0)) + 16|0);
    HEAP32[$791>>2] = 0;
    $1442 = $759;$1444 = $761;
    label = 429;
    break;
   }
   case 267: {
    label = 0;
    $792 = HEAP32[4371]|0;
    $793 = (($792) + -1)|0;
    $794 = HEAP32[4370]|0;
    $795 = (($794) + (($793*24)|0)|0);
    $796 = HEAP32[$795>>2]|0;
    $797 = (($792) + -2)|0;
    $798 = (($794) + (($797*24)|0)|0);
    $799 = HEAP32[$798>>2]|0;
    $800 = $799 | $796;
    $801 = $800 & 256;
    $802 = ($801|0)==(0);
    do {
     if ($802) {
      $827 = (((($794) + (($793*24)|0)|0)) + 8|0);
      $828 = HEAP32[$827>>2]|0;
      $829 = ($828|0)==(0);
      if (!($829)) {
       $830 = (((($794) + (($797*24)|0)|0)) + 8|0);
       $831 = HEAP32[$830>>2]|0;
       $832 = (($831|0) / ($828|0))&-1;
       HEAP32[$830>>2] = $832;
       $840 = $792;$842 = $794;
       break;
      }
      $833 = $796 & 16;
      $834 = ($833|0)==(0);
      if ($834) {
       $836 = $792;$838 = $794;
      } else {
       _Throw_error(9134);
       $$pre82$i = HEAP32[4371]|0;
       $$pre83$i = HEAP32[4370]|0;
       $836 = $$pre82$i;$838 = $$pre83$i;
      }
      $835 = (($836) + -2)|0;
      $837 = (((($838) + (($835*24)|0)|0)) + 8|0);
      HEAP32[$837>>2] = 0;
      $840 = $836;$842 = $838;
     } else {
      $803 = $799 & 256;
      $804 = ($803|0)==(0);
      if ($804) {
       $805 = (((($794) + (($797*24)|0)|0)) + 8|0);
       $806 = HEAP32[$805>>2]|0;
       $807 = (+($806|0));
       HEAPF64[$805>>3] = $807;
       $808 = $799 | 256;
       HEAP32[$798>>2] = $808;
      }
      $809 = $796 & 256;
      $810 = ($809|0)==(0);
      if ($810) {
       $811 = (((($794) + (($793*24)|0)|0)) + 8|0);
       $812 = HEAP32[$811>>2]|0;
       $813 = (+($812|0));
       HEAPF64[$811>>3] = $813;
       $814 = $796 | 256;
       HEAP32[$795>>2] = $814;
       $816 = $813;$821 = $814;
      } else {
       $$phi$trans$insert78$i = (((($794) + (($793*24)|0)|0)) + 8|0);
       $$pre79$i = +HEAPF64[$$phi$trans$insert78$i>>3];
       $816 = $$pre79$i;$821 = $796;
      }
      $815 = $816 != 0.0;
      if ($815) {
       $817 = (((($794) + (($797*24)|0)|0)) + 8|0);
       $818 = +HEAPF64[$817>>3];
       $819 = $818 / $816;
       HEAPF64[$817>>3] = $819;
       $840 = $792;$842 = $794;
       break;
      }
      $820 = $821 & 16;
      $822 = ($820|0)==(0);
      if ($822) {
       $824 = $792;$826 = $794;
      } else {
       _Throw_error(9134);
       $$pre80$i = HEAP32[4371]|0;
       $$pre81$i = HEAP32[4370]|0;
       $824 = $$pre80$i;$826 = $$pre81$i;
      }
      $823 = (($824) + -2)|0;
      $825 = (((($826) + (($823*24)|0)|0)) + 8|0);
      HEAPF64[$825>>3] = 0.0;
      $840 = $824;$842 = $826;
     }
    } while(0);
    $839 = (($840) + -2)|0;
    $841 = (((($842) + (($839*24)|0)|0)) + 16|0);
    HEAP32[$841>>2] = 0;
    $1442 = $840;$1444 = $842;
    label = 429;
    break;
   }
   case 284: {
    label = 0;
    $843 = HEAP32[4371]|0;
    $844 = (($843) + -1)|0;
    $845 = HEAP32[4370]|0;
    $846 = (($845) + (($844*24)|0)|0);
    $847 = HEAP32[$846>>2]|0;
    $848 = (($843) + -2)|0;
    $849 = (($845) + (($848*24)|0)|0);
    $850 = HEAP32[$849>>2]|0;
    $851 = $850 | $847;
    $852 = $851 & 256;
    $853 = ($852|0)==(0);
    do {
     if ($853) {
      $885 = (((($845) + (($844*24)|0)|0)) + 8|0);
      $886 = HEAP32[$885>>2]|0;
      $887 = ($886|0)==(0);
      if (!($887)) {
       $888 = (((($845) + (($848*24)|0)|0)) + 8|0);
       $889 = HEAP32[$888>>2]|0;
       $890 = (($889|0) / ($886|0))&-1;
       HEAP32[$888>>2] = $890;
       $898 = $843;$900 = $845;
       break;
      }
      $891 = $847 & 16;
      $892 = ($891|0)==(0);
      if ($892) {
       $894 = $843;$896 = $845;
      } else {
       _Throw_error(9134);
       $$pre76$i = HEAP32[4371]|0;
       $$pre77$i = HEAP32[4370]|0;
       $894 = $$pre76$i;$896 = $$pre77$i;
      }
      $893 = (($894) + -2)|0;
      $895 = (((($896) + (($893*24)|0)|0)) + 8|0);
      HEAP32[$895>>2] = 0;
      $898 = $894;$900 = $896;
     } else {
      $854 = $850 & 256;
      $855 = ($854|0)==(0);
      if ($855) {
       $856 = (((($845) + (($848*24)|0)|0)) + 8|0);
       $857 = HEAP32[$856>>2]|0;
       $858 = (+($857|0));
       HEAPF64[$856>>3] = $858;
       $859 = $850 | 256;
       HEAP32[$849>>2] = $859;
       $1515 = $859;
      } else {
       $1515 = $850;
      }
      $860 = $847 & 256;
      $861 = ($860|0)==(0);
      if ($861) {
       $862 = (((($845) + (($844*24)|0)|0)) + 8|0);
       $863 = HEAP32[$862>>2]|0;
       $864 = (+($863|0));
       HEAPF64[$862>>3] = $864;
       $865 = $847 | 256;
       HEAP32[$846>>2] = $865;
       $867 = $864;$873 = $865;
      } else {
       $$phi$trans$insert70$i = (((($845) + (($844*24)|0)|0)) + 8|0);
       $$pre71$i = +HEAPF64[$$phi$trans$insert70$i>>3];
       $867 = $$pre71$i;$873 = $847;
      }
      $866 = $867 != 0.0;
      if ($866) {
       $868 = (((($845) + (($848*24)|0)|0)) + 8|0);
       $869 = +HEAPF64[$868>>3];
       $870 = $869 / $867;
       $871 = (~~(($870)));
       HEAP32[$868>>2] = $871;
       $880 = $843;$882 = $845;$884 = $1515;
      } else {
       $872 = $873 & 16;
       $874 = ($872|0)==(0);
       if ($874) {
        $876 = $843;$878 = $845;
       } else {
        _Throw_error(9134);
        $$pre72$i = HEAP32[4371]|0;
        $$pre73$i = HEAP32[4370]|0;
        $876 = $$pre72$i;$878 = $$pre73$i;
       }
       $875 = (($876) + -2)|0;
       $877 = (((($878) + (($875*24)|0)|0)) + 8|0);
       HEAP32[$877>>2] = 0;
       $$phi$trans$insert74$i = (($878) + (($875*24)|0)|0);
       $$pre75$i = HEAP32[$$phi$trans$insert74$i>>2]|0;
       $880 = $876;$882 = $878;$884 = $$pre75$i;
      }
      $879 = (($880) + -2)|0;
      $881 = (($882) + (($879*24)|0)|0);
      $883 = $884 & -257;
      HEAP32[$881>>2] = $883;
      $898 = $880;$900 = $882;
     }
    } while(0);
    $897 = (($898) + -2)|0;
    $899 = (((($900) + (($897*24)|0)|0)) + 16|0);
    HEAP32[$899>>2] = 0;
    $1442 = $898;$1444 = $900;
    label = 429;
    break;
   }
   case 302: {
    label = 0;
    $901 = HEAP32[4371]|0;
    $902 = (($901) + -1)|0;
    $903 = HEAP32[4370]|0;
    $904 = (($903) + (($902*24)|0)|0);
    $905 = HEAP32[$904>>2]|0;
    $906 = (($901) + -2)|0;
    $907 = (($903) + (($906*24)|0)|0);
    $908 = HEAP32[$907>>2]|0;
    $909 = $908 | $905;
    $910 = $909 & 256;
    $911 = ($910|0)==(0);
    if ($911) {
     $925 = $901;$927 = $903;
    } else {
     $912 = $908 & 256;
     $913 = ($912|0)==(0);
     if (!($913)) {
      $914 = (((($903) + (($906*24)|0)|0)) + 8|0);
      $915 = +HEAPF64[$914>>3];
      $916 = (~~(($915)));
      HEAP32[$914>>2] = $916;
      $917 = $908 & -257;
      HEAP32[$907>>2] = $917;
     }
     $918 = $905 & 256;
     $919 = ($918|0)==(0);
     if (!($919)) {
      $920 = (((($903) + (($902*24)|0)|0)) + 8|0);
      $921 = +HEAPF64[$920>>3];
      $922 = (~~(($921)));
      HEAP32[$920>>2] = $922;
      $923 = $905 & -257;
      HEAP32[$904>>2] = $923;
     }
     _Throw_first_pass_warning(9152);
     $$pre66$i = HEAP32[4371]|0;
     $$pre67$i = HEAP32[4370]|0;
     $925 = $$pre66$i;$927 = $$pre67$i;
    }
    $924 = (($925) + -1)|0;
    $926 = (((($927) + (($924*24)|0)|0)) + 8|0);
    $928 = HEAP32[$926>>2]|0;
    $929 = ($928|0)==(0);
    if ($929) {
     $934 = (($927) + (($924*24)|0)|0);
     $935 = HEAP32[$934>>2]|0;
     $936 = $935 & 16;
     $937 = ($936|0)==(0);
     if ($937) {
      $939 = $925;$941 = $927;
     } else {
      _Throw_error(9134);
      $$pre68$i = HEAP32[4371]|0;
      $$pre69$i = HEAP32[4370]|0;
      $939 = $$pre68$i;$941 = $$pre69$i;
     }
     $938 = (($939) + -2)|0;
     $940 = (((($941) + (($938*24)|0)|0)) + 8|0);
     HEAP32[$940>>2] = 0;
     $943 = $939;$945 = $941;
    } else {
     $930 = (($925) + -2)|0;
     $931 = (((($927) + (($930*24)|0)|0)) + 8|0);
     $932 = HEAP32[$931>>2]|0;
     $933 = (($932|0) % ($928|0))&-1;
     HEAP32[$931>>2] = $933;
     $943 = $925;$945 = $927;
    }
    $942 = (($943) + -2)|0;
    $944 = (((($945) + (($942*24)|0)|0)) + 16|0);
    HEAP32[$944>>2] = 0;
    $1442 = $943;$1444 = $945;
    label = 429;
    break;
   }
   case 314: {
    label = 0;
    $946 = HEAP32[4371]|0;
    $947 = (($946) + -1)|0;
    $948 = HEAP32[4370]|0;
    $949 = (($948) + (($947*24)|0)|0);
    $950 = HEAP32[$949>>2]|0;
    $951 = (($946) + -2)|0;
    $952 = (($948) + (($951*24)|0)|0);
    $953 = HEAP32[$952>>2]|0;
    $954 = $953 | $950;
    $955 = $954 & 256;
    $956 = ($955|0)==(0);
    if ($956) {
     $973 = (((($948) + (($947*24)|0)|0)) + 8|0);
     $974 = HEAP32[$973>>2]|0;
     $975 = (((($948) + (($951*24)|0)|0)) + 8|0);
     $976 = HEAP32[$975>>2]|0;
     $977 = (($976) + ($974))|0;
     HEAP32[$975>>2] = $977;
    } else {
     $957 = $953 & 256;
     $958 = ($957|0)==(0);
     if ($958) {
      $959 = (((($948) + (($951*24)|0)|0)) + 8|0);
      $960 = HEAP32[$959>>2]|0;
      $961 = (+($960|0));
      HEAPF64[$959>>3] = $961;
      $962 = $953 | 256;
      HEAP32[$952>>2] = $962;
     }
     $963 = $950 & 256;
     $964 = ($963|0)==(0);
     if ($964) {
      $965 = (((($948) + (($947*24)|0)|0)) + 8|0);
      $966 = HEAP32[$965>>2]|0;
      $967 = (+($966|0));
      HEAPF64[$965>>3] = $967;
      $968 = $950 | 256;
      HEAP32[$949>>2] = $968;
      $972 = $967;
     } else {
      $$phi$trans$insert64$i = (((($948) + (($947*24)|0)|0)) + 8|0);
      $$pre65$i = +HEAPF64[$$phi$trans$insert64$i>>3];
      $972 = $$pre65$i;
     }
     $969 = (((($948) + (($951*24)|0)|0)) + 8|0);
     $970 = +HEAPF64[$969>>3];
     $971 = $972 + $970;
     HEAPF64[$969>>3] = $971;
    }
    $978 = (((($948) + (($947*24)|0)|0)) + 16|0);
    $979 = HEAP32[$978>>2]|0;
    $980 = (((($948) + (($951*24)|0)|0)) + 16|0);
    $981 = HEAP32[$980>>2]|0;
    $982 = (($981) + ($979))|0;
    HEAP32[$980>>2] = $982;
    $1442 = $946;$1444 = $948;
    label = 429;
    break;
   }
   case 323: {
    label = 0;
    $983 = HEAP32[4371]|0;
    $984 = (($983) + -1)|0;
    $985 = HEAP32[4370]|0;
    $986 = (($985) + (($984*24)|0)|0);
    $987 = HEAP32[$986>>2]|0;
    $988 = (($983) + -2)|0;
    $989 = (($985) + (($988*24)|0)|0);
    $990 = HEAP32[$989>>2]|0;
    $991 = $990 | $987;
    $992 = $991 & 256;
    $993 = ($992|0)==(0);
    if ($993) {
     $1010 = (((($985) + (($984*24)|0)|0)) + 8|0);
     $1011 = HEAP32[$1010>>2]|0;
     $1012 = (((($985) + (($988*24)|0)|0)) + 8|0);
     $1013 = HEAP32[$1012>>2]|0;
     $1014 = (($1013) - ($1011))|0;
     HEAP32[$1012>>2] = $1014;
    } else {
     $994 = $990 & 256;
     $995 = ($994|0)==(0);
     if ($995) {
      $996 = (((($985) + (($988*24)|0)|0)) + 8|0);
      $997 = HEAP32[$996>>2]|0;
      $998 = (+($997|0));
      HEAPF64[$996>>3] = $998;
      $999 = $990 | 256;
      HEAP32[$989>>2] = $999;
     }
     $1000 = $987 & 256;
     $1001 = ($1000|0)==(0);
     if ($1001) {
      $1002 = (((($985) + (($984*24)|0)|0)) + 8|0);
      $1003 = HEAP32[$1002>>2]|0;
      $1004 = (+($1003|0));
      HEAPF64[$1002>>3] = $1004;
      $1005 = $987 | 256;
      HEAP32[$986>>2] = $1005;
      $1009 = $1004;
     } else {
      $$phi$trans$insert62$i = (((($985) + (($984*24)|0)|0)) + 8|0);
      $$pre63$i = +HEAPF64[$$phi$trans$insert62$i>>3];
      $1009 = $$pre63$i;
     }
     $1006 = (((($985) + (($988*24)|0)|0)) + 8|0);
     $1007 = +HEAPF64[$1006>>3];
     $1008 = $1007 - $1009;
     HEAPF64[$1006>>3] = $1008;
    }
    $1015 = (((($985) + (($984*24)|0)|0)) + 16|0);
    $1016 = HEAP32[$1015>>2]|0;
    $1017 = (((($985) + (($988*24)|0)|0)) + 16|0);
    $1018 = HEAP32[$1017>>2]|0;
    $1019 = (($1018) - ($1016))|0;
    HEAP32[$1017>>2] = $1019;
    $1442 = $983;$1444 = $985;
    label = 429;
    break;
   }
   case 332: {
    label = 0;
    $1020 = HEAP32[4371]|0;
    $1021 = (($1020) + -1)|0;
    $1022 = HEAP32[4370]|0;
    $1023 = (($1022) + (($1021*24)|0)|0);
    $1024 = HEAP32[$1023>>2]|0;
    $1025 = $1024 & 256;
    $1026 = ($1025|0)==(0);
    $$phi$trans$insert57$i = (((($1022) + (($1021*24)|0)|0)) + 8|0);
    if ($1026) {
     $$pre59$i21 = HEAP32[$$phi$trans$insert57$i>>2]|0;
     $1035 = $$pre59$i21;
    } else {
     $1027 = +HEAPF64[$$phi$trans$insert57$i>>3];
     $1028 = (~~(($1027)));
     HEAP32[$$phi$trans$insert57$i>>2] = $1028;
     $1029 = $1024 & -257;
     HEAP32[$1023>>2] = $1029;
     $1035 = $1028;
    }
    $1030 = (($1020) + -2)|0;
    $1031 = (($1022) + (($1030*24)|0)|0);
    $1032 = HEAP32[$1031>>2]|0;
    $1033 = $1032 & 256;
    $1034 = ($1033|0)==(0);
    if ($1034) {
     $1040 = (((($1022) + (($1030*24)|0)|0)) + 8|0);
     $1041 = HEAP32[$1040>>2]|0;
     $1042 = $1041 << $1035;
     HEAP32[$1040>>2] = $1042;
     $1044 = $1020;$1046 = $1022;
    } else {
     $1036 = (+_ldexp(1.0,$1035));
     $1037 = (((($1022) + (($1030*24)|0)|0)) + 8|0);
     $1038 = +HEAPF64[$1037>>3];
     $1039 = $1036 * $1038;
     HEAPF64[$1037>>3] = $1039;
     $$pre60$i = HEAP32[4371]|0;
     $$pre61$i = HEAP32[4370]|0;
     $1044 = $$pre60$i;$1046 = $$pre61$i;
    }
    $1043 = (($1044) + -2)|0;
    $1045 = (((($1046) + (($1043*24)|0)|0)) + 16|0);
    HEAP32[$1045>>2] = 0;
    $1442 = $1044;$1444 = $1046;
    label = 429;
    break;
   }
   case 339: {
    label = 0;
    $1047 = HEAP32[4371]|0;
    $1048 = (($1047) + -1)|0;
    $1049 = HEAP32[4370]|0;
    $1050 = (($1049) + (($1048*24)|0)|0);
    $1051 = HEAP32[$1050>>2]|0;
    $1052 = $1051 & 256;
    $1053 = ($1052|0)==(0);
    if (!($1053)) {
     $1054 = (((($1049) + (($1048*24)|0)|0)) + 8|0);
     $1055 = +HEAPF64[$1054>>3];
     $1056 = (~~(($1055)));
     HEAP32[$1054>>2] = $1056;
     $1057 = $1051 & -257;
     HEAP32[$1050>>2] = $1057;
    }
    $1058 = (($1047) + -2)|0;
    $1059 = (($1049) + (($1058*24)|0)|0);
    $1060 = HEAP32[$1059>>2]|0;
    $1061 = $1060 & 256;
    $1062 = ($1061|0)==(0);
    if ($1062) {
     $1070 = (((($1049) + (($1058*24)|0)|0)) + 8|0);
     $1071 = HEAP32[$1070>>2]|0;
     $1072 = (((($1049) + (($1048*24)|0)|0)) + 8|0);
     $1073 = HEAP32[$1072>>2]|0;
     $$0$i$i23 = $1071 >> $1073;
     HEAP32[$1070>>2] = $$0$i$i23;
    } else {
     $1063 = (((($1049) + (($1048*24)|0)|0)) + 8|0);
     $1064 = HEAP32[$1063>>2]|0;
     $1065 = 1 << $1064;
     $1066 = (+($1065|0));
     $1067 = (((($1049) + (($1058*24)|0)|0)) + 8|0);
     $1068 = +HEAPF64[$1067>>3];
     $1069 = $1068 / $1066;
     HEAPF64[$1067>>3] = $1069;
    }
    $1074 = (((($1049) + (($1058*24)|0)|0)) + 16|0);
    HEAP32[$1074>>2] = 0;
    $1442 = $1047;$1444 = $1049;
    label = 429;
    break;
   }
   case 345: {
    label = 0;
    $1075 = HEAP32[4371]|0;
    $1076 = (($1075) + -1)|0;
    $1077 = HEAP32[4370]|0;
    $1078 = (($1077) + (($1076*24)|0)|0);
    $1079 = HEAP32[$1078>>2]|0;
    $1080 = (($1075) + -2)|0;
    $1081 = (($1077) + (($1080*24)|0)|0);
    $1082 = HEAP32[$1081>>2]|0;
    $1083 = $1082 | $1079;
    $1084 = $1083 & 256;
    $1085 = ($1084|0)==(0);
    if ($1085) {
     $1099 = $1075;$1101 = $1077;
    } else {
     $1086 = $1082 & 256;
     $1087 = ($1086|0)==(0);
     if (!($1087)) {
      $1088 = (((($1077) + (($1080*24)|0)|0)) + 8|0);
      $1089 = +HEAPF64[$1088>>3];
      $1090 = (~~(($1089)));
      HEAP32[$1088>>2] = $1090;
      $1091 = $1082 & -257;
      HEAP32[$1081>>2] = $1091;
     }
     $1092 = $1079 & 256;
     $1093 = ($1092|0)==(0);
     if (!($1093)) {
      $1094 = (((($1077) + (($1076*24)|0)|0)) + 8|0);
      $1095 = +HEAPF64[$1094>>3];
      $1096 = (~~(($1095)));
      HEAP32[$1094>>2] = $1096;
      $1097 = $1079 & -257;
      HEAP32[$1078>>2] = $1097;
     }
     _Throw_first_pass_warning(9152);
     $$pre55$i = HEAP32[4371]|0;
     $$pre56$i24 = HEAP32[4370]|0;
     $1099 = $$pre55$i;$1101 = $$pre56$i24;
    }
    $1098 = (($1099) + -2)|0;
    $1100 = (((($1101) + (($1098*24)|0)|0)) + 8|0);
    $1102 = HEAP32[$1100>>2]|0;
    $1103 = (($1099) + -1)|0;
    $1104 = (((($1101) + (($1103*24)|0)|0)) + 8|0);
    $1105 = HEAP32[$1104>>2]|0;
    $1106 = $1102 >>> $1105;
    HEAP32[$1100>>2] = $1106;
    $1107 = (((($1101) + (($1098*24)|0)|0)) + 16|0);
    HEAP32[$1107>>2] = 0;
    $1442 = $1099;$1444 = $1101;
    label = 429;
    break;
   }
   case 352: {
    label = 0;
    $1108 = HEAP32[4371]|0;
    $1109 = (($1108) + -1)|0;
    $1110 = HEAP32[4370]|0;
    $1111 = (($1110) + (($1109*24)|0)|0);
    $1112 = HEAP32[$1111>>2]|0;
    $1113 = (($1108) + -2)|0;
    $1114 = (($1110) + (($1113*24)|0)|0);
    $1115 = HEAP32[$1114>>2]|0;
    $1116 = $1115 | $1112;
    $1117 = $1116 & 256;
    $1118 = ($1117|0)==(0);
    if ($1118) {
     $1138 = (((($1110) + (($1113*24)|0)|0)) + 8|0);
     $1139 = HEAP32[$1138>>2]|0;
     $1140 = (((($1110) + (($1109*24)|0)|0)) + 8|0);
     $1141 = HEAP32[$1140>>2]|0;
     $1142 = ($1139|0)<=($1141|0);
     $1143 = $1142&1;
     HEAP32[$1138>>2] = $1143;
    } else {
     $1119 = $1115 & 256;
     $1120 = ($1119|0)==(0);
     if ($1120) {
      $1121 = (((($1110) + (($1113*24)|0)|0)) + 8|0);
      $1122 = HEAP32[$1121>>2]|0;
      $1123 = (+($1122|0));
      HEAPF64[$1121>>3] = $1123;
      $1124 = $1115 | 256;
      HEAP32[$1114>>2] = $1124;
      $1132 = $1124;
     } else {
      $1132 = $1115;
     }
     $1125 = $1112 & 256;
     $1126 = ($1125|0)==(0);
     if ($1126) {
      $1127 = (((($1110) + (($1109*24)|0)|0)) + 8|0);
      $1128 = HEAP32[$1127>>2]|0;
      $1129 = (+($1128|0));
      HEAPF64[$1127>>3] = $1129;
      $1130 = $1112 | 256;
      HEAP32[$1111>>2] = $1130;
      $1136 = $1129;
     } else {
      $$phi$trans$insert53$i = (((($1110) + (($1109*24)|0)|0)) + 8|0);
      $$pre54$i25 = +HEAPF64[$$phi$trans$insert53$i>>3];
      $1136 = $$pre54$i25;
     }
     $1131 = $1132 & -257;
     HEAP32[$1114>>2] = $1131;
     $1133 = (((($1110) + (($1113*24)|0)|0)) + 8|0);
     $1134 = +HEAPF64[$1133>>3];
     $1135 = $1134 <= $1136;
     $1137 = $1135&1;
     HEAP32[$1133>>2] = $1137;
    }
    $1144 = (((($1110) + (($1113*24)|0)|0)) + 16|0);
    HEAP32[$1144>>2] = 0;
    $1442 = $1108;$1444 = $1110;
    label = 429;
    break;
   }
   case 361: {
    label = 0;
    $1145 = HEAP32[4371]|0;
    $1146 = (($1145) + -1)|0;
    $1147 = HEAP32[4370]|0;
    $1148 = (($1147) + (($1146*24)|0)|0);
    $1149 = HEAP32[$1148>>2]|0;
    $1150 = (($1145) + -2)|0;
    $1151 = (($1147) + (($1150*24)|0)|0);
    $1152 = HEAP32[$1151>>2]|0;
    $1153 = $1152 | $1149;
    $1154 = $1153 & 256;
    $1155 = ($1154|0)==(0);
    if ($1155) {
     $1175 = (((($1147) + (($1150*24)|0)|0)) + 8|0);
     $1176 = HEAP32[$1175>>2]|0;
     $1177 = (((($1147) + (($1146*24)|0)|0)) + 8|0);
     $1178 = HEAP32[$1177>>2]|0;
     $1179 = ($1176|0)<($1178|0);
     $1180 = $1179&1;
     HEAP32[$1175>>2] = $1180;
    } else {
     $1156 = $1152 & 256;
     $1157 = ($1156|0)==(0);
     if ($1157) {
      $1158 = (((($1147) + (($1150*24)|0)|0)) + 8|0);
      $1159 = HEAP32[$1158>>2]|0;
      $1160 = (+($1159|0));
      HEAPF64[$1158>>3] = $1160;
      $1161 = $1152 | 256;
      HEAP32[$1151>>2] = $1161;
      $1169 = $1161;
     } else {
      $1169 = $1152;
     }
     $1162 = $1149 & 256;
     $1163 = ($1162|0)==(0);
     if ($1163) {
      $1164 = (((($1147) + (($1146*24)|0)|0)) + 8|0);
      $1165 = HEAP32[$1164>>2]|0;
      $1166 = (+($1165|0));
      HEAPF64[$1164>>3] = $1166;
      $1167 = $1149 | 256;
      HEAP32[$1148>>2] = $1167;
      $1173 = $1166;
     } else {
      $$phi$trans$insert51$i = (((($1147) + (($1146*24)|0)|0)) + 8|0);
      $$pre52$i26 = +HEAPF64[$$phi$trans$insert51$i>>3];
      $1173 = $$pre52$i26;
     }
     $1168 = $1169 & -257;
     HEAP32[$1151>>2] = $1168;
     $1170 = (((($1147) + (($1150*24)|0)|0)) + 8|0);
     $1171 = +HEAPF64[$1170>>3];
     $1172 = $1171 < $1173;
     $1174 = $1172&1;
     HEAP32[$1170>>2] = $1174;
    }
    $1181 = (((($1147) + (($1150*24)|0)|0)) + 16|0);
    HEAP32[$1181>>2] = 0;
    $1442 = $1145;$1444 = $1147;
    label = 429;
    break;
   }
   case 370: {
    label = 0;
    $1182 = HEAP32[4371]|0;
    $1183 = (($1182) + -1)|0;
    $1184 = HEAP32[4370]|0;
    $1185 = (($1184) + (($1183*24)|0)|0);
    $1186 = HEAP32[$1185>>2]|0;
    $1187 = (($1182) + -2)|0;
    $1188 = (($1184) + (($1187*24)|0)|0);
    $1189 = HEAP32[$1188>>2]|0;
    $1190 = $1189 | $1186;
    $1191 = $1190 & 256;
    $1192 = ($1191|0)==(0);
    if ($1192) {
     $1212 = (((($1184) + (($1187*24)|0)|0)) + 8|0);
     $1213 = HEAP32[$1212>>2]|0;
     $1214 = (((($1184) + (($1183*24)|0)|0)) + 8|0);
     $1215 = HEAP32[$1214>>2]|0;
     $1216 = ($1213|0)>=($1215|0);
     $1217 = $1216&1;
     HEAP32[$1212>>2] = $1217;
    } else {
     $1193 = $1189 & 256;
     $1194 = ($1193|0)==(0);
     if ($1194) {
      $1195 = (((($1184) + (($1187*24)|0)|0)) + 8|0);
      $1196 = HEAP32[$1195>>2]|0;
      $1197 = (+($1196|0));
      HEAPF64[$1195>>3] = $1197;
      $1198 = $1189 | 256;
      HEAP32[$1188>>2] = $1198;
      $1206 = $1198;
     } else {
      $1206 = $1189;
     }
     $1199 = $1186 & 256;
     $1200 = ($1199|0)==(0);
     if ($1200) {
      $1201 = (((($1184) + (($1183*24)|0)|0)) + 8|0);
      $1202 = HEAP32[$1201>>2]|0;
      $1203 = (+($1202|0));
      HEAPF64[$1201>>3] = $1203;
      $1204 = $1186 | 256;
      HEAP32[$1185>>2] = $1204;
      $1210 = $1203;
     } else {
      $$phi$trans$insert49$i = (((($1184) + (($1183*24)|0)|0)) + 8|0);
      $$pre50$i = +HEAPF64[$$phi$trans$insert49$i>>3];
      $1210 = $$pre50$i;
     }
     $1205 = $1206 & -257;
     HEAP32[$1188>>2] = $1205;
     $1207 = (((($1184) + (($1187*24)|0)|0)) + 8|0);
     $1208 = +HEAPF64[$1207>>3];
     $1209 = $1208 >= $1210;
     $1211 = $1209&1;
     HEAP32[$1207>>2] = $1211;
    }
    $1218 = (((($1184) + (($1187*24)|0)|0)) + 16|0);
    HEAP32[$1218>>2] = 0;
    $1442 = $1182;$1444 = $1184;
    label = 429;
    break;
   }
   case 379: {
    label = 0;
    $1219 = HEAP32[4371]|0;
    $1220 = (($1219) + -1)|0;
    $1221 = HEAP32[4370]|0;
    $1222 = (($1221) + (($1220*24)|0)|0);
    $1223 = HEAP32[$1222>>2]|0;
    $1224 = (($1219) + -2)|0;
    $1225 = (($1221) + (($1224*24)|0)|0);
    $1226 = HEAP32[$1225>>2]|0;
    $1227 = $1226 | $1223;
    $1228 = $1227 & 256;
    $1229 = ($1228|0)==(0);
    if ($1229) {
     $1249 = (((($1221) + (($1224*24)|0)|0)) + 8|0);
     $1250 = HEAP32[$1249>>2]|0;
     $1251 = (((($1221) + (($1220*24)|0)|0)) + 8|0);
     $1252 = HEAP32[$1251>>2]|0;
     $1253 = ($1250|0)>($1252|0);
     $1254 = $1253&1;
     HEAP32[$1249>>2] = $1254;
    } else {
     $1230 = $1226 & 256;
     $1231 = ($1230|0)==(0);
     if ($1231) {
      $1232 = (((($1221) + (($1224*24)|0)|0)) + 8|0);
      $1233 = HEAP32[$1232>>2]|0;
      $1234 = (+($1233|0));
      HEAPF64[$1232>>3] = $1234;
      $1235 = $1226 | 256;
      HEAP32[$1225>>2] = $1235;
      $1243 = $1235;
     } else {
      $1243 = $1226;
     }
     $1236 = $1223 & 256;
     $1237 = ($1236|0)==(0);
     if ($1237) {
      $1238 = (((($1221) + (($1220*24)|0)|0)) + 8|0);
      $1239 = HEAP32[$1238>>2]|0;
      $1240 = (+($1239|0));
      HEAPF64[$1238>>3] = $1240;
      $1241 = $1223 | 256;
      HEAP32[$1222>>2] = $1241;
      $1247 = $1240;
     } else {
      $$phi$trans$insert47$i = (((($1221) + (($1220*24)|0)|0)) + 8|0);
      $$pre48$i27 = +HEAPF64[$$phi$trans$insert47$i>>3];
      $1247 = $$pre48$i27;
     }
     $1242 = $1243 & -257;
     HEAP32[$1225>>2] = $1242;
     $1244 = (((($1221) + (($1224*24)|0)|0)) + 8|0);
     $1245 = +HEAPF64[$1244>>3];
     $1246 = $1245 > $1247;
     $1248 = $1246&1;
     HEAP32[$1244>>2] = $1248;
    }
    $1255 = (((($1221) + (($1224*24)|0)|0)) + 16|0);
    HEAP32[$1255>>2] = 0;
    $1442 = $1219;$1444 = $1221;
    label = 429;
    break;
   }
   case 388: {
    label = 0;
    $1256 = HEAP32[4371]|0;
    $1257 = (($1256) + -1)|0;
    $1258 = HEAP32[4370]|0;
    $1259 = (($1258) + (($1257*24)|0)|0);
    $1260 = HEAP32[$1259>>2]|0;
    $1261 = (($1256) + -2)|0;
    $1262 = (($1258) + (($1261*24)|0)|0);
    $1263 = HEAP32[$1262>>2]|0;
    $1264 = $1263 | $1260;
    $1265 = $1264 & 256;
    $1266 = ($1265|0)==(0);
    if ($1266) {
     $1286 = (((($1258) + (($1261*24)|0)|0)) + 8|0);
     $1287 = HEAP32[$1286>>2]|0;
     $1288 = (((($1258) + (($1257*24)|0)|0)) + 8|0);
     $1289 = HEAP32[$1288>>2]|0;
     $1290 = ($1287|0)!=($1289|0);
     $1291 = $1290&1;
     HEAP32[$1286>>2] = $1291;
    } else {
     $1267 = $1263 & 256;
     $1268 = ($1267|0)==(0);
     if ($1268) {
      $1269 = (((($1258) + (($1261*24)|0)|0)) + 8|0);
      $1270 = HEAP32[$1269>>2]|0;
      $1271 = (+($1270|0));
      HEAPF64[$1269>>3] = $1271;
      $1272 = $1263 | 256;
      HEAP32[$1262>>2] = $1272;
      $1280 = $1272;
     } else {
      $1280 = $1263;
     }
     $1273 = $1260 & 256;
     $1274 = ($1273|0)==(0);
     if ($1274) {
      $1275 = (((($1258) + (($1257*24)|0)|0)) + 8|0);
      $1276 = HEAP32[$1275>>2]|0;
      $1277 = (+($1276|0));
      HEAPF64[$1275>>3] = $1277;
      $1278 = $1260 | 256;
      HEAP32[$1259>>2] = $1278;
      $1284 = $1277;
     } else {
      $$phi$trans$insert45$i = (((($1258) + (($1257*24)|0)|0)) + 8|0);
      $$pre46$i = +HEAPF64[$$phi$trans$insert45$i>>3];
      $1284 = $$pre46$i;
     }
     $1279 = $1280 & -257;
     HEAP32[$1262>>2] = $1279;
     $1281 = (((($1258) + (($1261*24)|0)|0)) + 8|0);
     $1282 = +HEAPF64[$1281>>3];
     $1283 = $1282 != $1284;
     $1285 = $1283&1;
     HEAP32[$1281>>2] = $1285;
    }
    $1292 = (((($1258) + (($1261*24)|0)|0)) + 16|0);
    HEAP32[$1292>>2] = 0;
    $1442 = $1256;$1444 = $1258;
    label = 429;
    break;
   }
   case 397: {
    label = 0;
    $1293 = HEAP32[4371]|0;
    $1294 = (($1293) + -1)|0;
    $1295 = HEAP32[4370]|0;
    $1296 = (($1295) + (($1294*24)|0)|0);
    $1297 = HEAP32[$1296>>2]|0;
    $1298 = (($1293) + -2)|0;
    $1299 = (($1295) + (($1298*24)|0)|0);
    $1300 = HEAP32[$1299>>2]|0;
    $1301 = $1300 | $1297;
    $1302 = $1301 & 256;
    $1303 = ($1302|0)==(0);
    if ($1303) {
     $1323 = (((($1295) + (($1298*24)|0)|0)) + 8|0);
     $1324 = HEAP32[$1323>>2]|0;
     $1325 = (((($1295) + (($1294*24)|0)|0)) + 8|0);
     $1326 = HEAP32[$1325>>2]|0;
     $1327 = ($1324|0)==($1326|0);
     $1328 = $1327&1;
     HEAP32[$1323>>2] = $1328;
    } else {
     $1304 = $1300 & 256;
     $1305 = ($1304|0)==(0);
     if ($1305) {
      $1306 = (((($1295) + (($1298*24)|0)|0)) + 8|0);
      $1307 = HEAP32[$1306>>2]|0;
      $1308 = (+($1307|0));
      HEAPF64[$1306>>3] = $1308;
      $1309 = $1300 | 256;
      HEAP32[$1299>>2] = $1309;
      $1317 = $1309;
     } else {
      $1317 = $1300;
     }
     $1310 = $1297 & 256;
     $1311 = ($1310|0)==(0);
     if ($1311) {
      $1312 = (((($1295) + (($1294*24)|0)|0)) + 8|0);
      $1313 = HEAP32[$1312>>2]|0;
      $1314 = (+($1313|0));
      HEAPF64[$1312>>3] = $1314;
      $1315 = $1297 | 256;
      HEAP32[$1296>>2] = $1315;
      $1321 = $1314;
     } else {
      $$phi$trans$insert$i28 = (((($1295) + (($1294*24)|0)|0)) + 8|0);
      $$pre44$i = +HEAPF64[$$phi$trans$insert$i28>>3];
      $1321 = $$pre44$i;
     }
     $1316 = $1317 & -257;
     HEAP32[$1299>>2] = $1316;
     $1318 = (((($1295) + (($1298*24)|0)|0)) + 8|0);
     $1319 = +HEAPF64[$1318>>3];
     $1320 = $1319 == $1321;
     $1322 = $1320&1;
     HEAP32[$1318>>2] = $1322;
    }
    $1329 = (((($1295) + (($1298*24)|0)|0)) + 16|0);
    HEAP32[$1329>>2] = 0;
    $1442 = $1293;$1444 = $1295;
    label = 429;
    break;
   }
   case 406: {
    label = 0;
    $1330 = HEAP32[4371]|0;
    $1331 = (($1330) + -1)|0;
    $1332 = HEAP32[4370]|0;
    $1333 = (($1332) + (($1331*24)|0)|0);
    $1334 = HEAP32[$1333>>2]|0;
    $1335 = (($1330) + -2)|0;
    $1336 = (($1332) + (($1335*24)|0)|0);
    $1337 = HEAP32[$1336>>2]|0;
    $1338 = $1337 | $1334;
    $1339 = $1338 & 256;
    $1340 = ($1339|0)==(0);
    if ($1340) {
     $1354 = $1330;$1356 = $1332;
    } else {
     $1341 = $1337 & 256;
     $1342 = ($1341|0)==(0);
     if (!($1342)) {
      $1343 = (((($1332) + (($1335*24)|0)|0)) + 8|0);
      $1344 = +HEAPF64[$1343>>3];
      $1345 = (~~(($1344)));
      HEAP32[$1343>>2] = $1345;
      $1346 = $1337 & -257;
      HEAP32[$1336>>2] = $1346;
     }
     $1347 = $1334 & 256;
     $1348 = ($1347|0)==(0);
     if (!($1348)) {
      $1349 = (((($1332) + (($1331*24)|0)|0)) + 8|0);
      $1350 = +HEAPF64[$1349>>3];
      $1351 = (~~(($1350)));
      HEAP32[$1349>>2] = $1351;
      $1352 = $1334 & -257;
      HEAP32[$1333>>2] = $1352;
     }
     _Throw_first_pass_warning(9152);
     $$pre42$i = HEAP32[4371]|0;
     $$pre43$i = HEAP32[4370]|0;
     $1354 = $$pre42$i;$1356 = $$pre43$i;
    }
    $1353 = (($1354) + -1)|0;
    $1355 = (((($1356) + (($1353*24)|0)|0)) + 8|0);
    $1357 = HEAP32[$1355>>2]|0;
    $1358 = (($1354) + -2)|0;
    $1359 = (((($1356) + (($1358*24)|0)|0)) + 8|0);
    $1360 = HEAP32[$1359>>2]|0;
    $1361 = $1360 & $1357;
    HEAP32[$1359>>2] = $1361;
    $1362 = (((($1356) + (($1353*24)|0)|0)) + 16|0);
    $1363 = HEAP32[$1362>>2]|0;
    $1364 = (((($1356) + (($1358*24)|0)|0)) + 16|0);
    $1365 = HEAP32[$1364>>2]|0;
    $1366 = (($1365) + ($1363))|0;
    HEAP32[$1364>>2] = $1366;
    $1442 = $1354;$1444 = $1356;
    label = 429;
    break;
   }
   case 413: {
    label = 0;
    _Throw_first_pass_warning(9200);
    label = 414;
    break;
   }
   case 421: {
    label = 0;
    $1404 = HEAP32[4371]|0;
    $1405 = (($1404) + -1)|0;
    $1406 = HEAP32[4370]|0;
    $1407 = (($1406) + (($1405*24)|0)|0);
    $1408 = HEAP32[$1407>>2]|0;
    $1409 = (($1404) + -2)|0;
    $1410 = (($1406) + (($1409*24)|0)|0);
    $1411 = HEAP32[$1410>>2]|0;
    $1412 = $1411 | $1408;
    $1413 = $1412 & 256;
    $1414 = ($1413|0)==(0);
    if ($1414) {
     $1428 = $1404;$1430 = $1406;
    } else {
     $1415 = $1411 & 256;
     $1416 = ($1415|0)==(0);
     if (!($1416)) {
      $1417 = (((($1406) + (($1409*24)|0)|0)) + 8|0);
      $1418 = +HEAPF64[$1417>>3];
      $1419 = (~~(($1418)));
      HEAP32[$1417>>2] = $1419;
      $1420 = $1411 & -257;
      HEAP32[$1410>>2] = $1420;
     }
     $1421 = $1408 & 256;
     $1422 = ($1421|0)==(0);
     if (!($1422)) {
      $1423 = (((($1406) + (($1405*24)|0)|0)) + 8|0);
      $1424 = +HEAPF64[$1423>>3];
      $1425 = (~~(($1424)));
      HEAP32[$1423>>2] = $1425;
      $1426 = $1408 & -257;
      HEAP32[$1407>>2] = $1426;
     }
     _Throw_first_pass_warning(9152);
     $$pre$i29 = HEAP32[4371]|0;
     $$pre39$i = HEAP32[4370]|0;
     $1428 = $$pre$i29;$1430 = $$pre39$i;
    }
    $1427 = (($1428) + -1)|0;
    $1429 = (((($1430) + (($1427*24)|0)|0)) + 8|0);
    $1431 = HEAP32[$1429>>2]|0;
    $1432 = (($1428) + -2)|0;
    $1433 = (((($1430) + (($1432*24)|0)|0)) + 8|0);
    $1434 = HEAP32[$1433>>2]|0;
    $1435 = $1434 | $1431;
    HEAP32[$1433>>2] = $1435;
    $1436 = (((($1430) + (($1427*24)|0)|0)) + 16|0);
    $1437 = HEAP32[$1436>>2]|0;
    $1438 = (((($1430) + (($1432*24)|0)|0)) + 16|0);
    $1439 = HEAP32[$1438>>2]|0;
    $1440 = (($1439) + ($1437))|0;
    HEAP32[$1438>>2] = $1440;
    $1442 = $1428;$1444 = $1430;
    label = 429;
    break;
   }
  }
  if ((label|0) == 138) {
   label = 0;
   (_GetByte()|0);
   $440 = HEAP32[4374]|0;
   $441 = (($440) + 1)|0;
   HEAP32[4374] = $441;
   $442 = HEAP32[4369]|0;
   $443 = (($442) + ($440<<2)|0);
   HEAP32[$443>>2] = $$012$i;
   $$3$ph = $$0$ph;
  }
  else if ((label|0) == 414) {
   label = 0;
   $1367 = HEAP32[4371]|0;
   $1368 = (($1367) + -1)|0;
   $1369 = HEAP32[4370]|0;
   $1370 = (($1369) + (($1368*24)|0)|0);
   $1371 = HEAP32[$1370>>2]|0;
   $1372 = (($1367) + -2)|0;
   $1373 = (($1369) + (($1372*24)|0)|0);
   $1374 = HEAP32[$1373>>2]|0;
   $1375 = $1374 | $1371;
   $1376 = $1375 & 256;
   $1377 = ($1376|0)==(0);
   if ($1377) {
    $1391 = $1367;$1393 = $1369;
   } else {
    $1378 = $1374 & 256;
    $1379 = ($1378|0)==(0);
    if (!($1379)) {
     $1380 = (((($1369) + (($1372*24)|0)|0)) + 8|0);
     $1381 = +HEAPF64[$1380>>3];
     $1382 = (~~(($1381)));
     HEAP32[$1380>>2] = $1382;
     $1383 = $1374 & -257;
     HEAP32[$1373>>2] = $1383;
    }
    $1384 = $1371 & 256;
    $1385 = ($1384|0)==(0);
    if (!($1385)) {
     $1386 = (((($1369) + (($1368*24)|0)|0)) + 8|0);
     $1387 = +HEAPF64[$1386>>3];
     $1388 = (~~(($1387)));
     HEAP32[$1386>>2] = $1388;
     $1389 = $1371 & -257;
     HEAP32[$1370>>2] = $1389;
    }
    _Throw_first_pass_warning(9152);
    $$pre40$i = HEAP32[4371]|0;
    $$pre41$i = HEAP32[4370]|0;
    $1391 = $$pre40$i;$1393 = $$pre41$i;
   }
   $1390 = (($1391) + -1)|0;
   $1392 = (((($1393) + (($1390*24)|0)|0)) + 8|0);
   $1394 = HEAP32[$1392>>2]|0;
   $1395 = (($1391) + -2)|0;
   $1396 = (((($1393) + (($1395*24)|0)|0)) + 8|0);
   $1397 = HEAP32[$1396>>2]|0;
   $1398 = $1397 ^ $1394;
   HEAP32[$1396>>2] = $1398;
   $1399 = (((($1393) + (($1390*24)|0)|0)) + 16|0);
   $1400 = HEAP32[$1399>>2]|0;
   $1401 = (((($1393) + (($1395*24)|0)|0)) + 16|0);
   $1402 = HEAP32[$1401>>2]|0;
   $1403 = (($1402) + ($1400))|0;
   HEAP32[$1401>>2] = $1403;
   $1442 = $1391;$1444 = $1393;
   label = 429;
  }
  if ((label|0) == 429) {
   label = 0;
   $1441 = (($1442) + -1)|0;
   $1443 = (($1444) + (($1441*24)|0)|0);
   $1445 = HEAP32[$1443>>2]|0;
   $1446 = $1445 & 103;
   $1447 = (($1442) + -2)|0;
   $1448 = (($1444) + (($1447*24)|0)|0);
   $1449 = HEAP32[$1448>>2]|0;
   $1450 = $1449 | $1446;
   HEAP32[$1448>>2] = $1450;
   $1451 = HEAP32[4371]|0;
   $1452 = (($1451) + -1)|0;
   $1453 = (($1444) + (($1452*24)|0)|0);
   $1454 = HEAP32[$1453>>2]|0;
   $1455 = $1454 | -17;
   $1456 = (($1451) + -2)|0;
   $1457 = (($1444) + (($1456*24)|0)|0);
   $1458 = HEAP32[$1457>>2]|0;
   $1459 = $1458 & $1455;
   HEAP32[$1457>>2] = $1459;
   $1460 = HEAP32[4371]|0;
   $1461 = (($1460) + -2)|0;
   $1462 = (($1444) + (($1461*24)|0)|0);
   $1463 = HEAP32[$1462>>2]|0;
   $1464 = $1463 & -9;
   HEAP32[$1462>>2] = $1464;
   $1465 = HEAP32[4371]|0;
   $1466 = (($1465) + -1)|0;
   HEAP32[4371] = $1466;
   label = 430;
  }
  if ((label|0) == 430) {
   label = 0;
   HEAP32[4373] = 0;
   $$pre106$i = HEAP32[4374]|0;
   $$pre107$i = HEAP32[4369]|0;
   $$1 = $$0$ph;$1468 = $$pre106$i;$1470 = $$pre107$i;
   label = 431;
  }
  if ((label|0) == 431) {
   label = 0;
   $1467 = (($1468) + -1)|0;
   $1469 = (($1470) + ($1467<<2)|0);
   $1471 = HEAP32[$1469>>2]|0;
   $1472 = (($1468) + -2)|0;
   $1473 = (($1470) + ($1472<<2)|0);
   HEAP32[$1473>>2] = $1471;
   HEAP32[4374] = $1467;
   $$3$ph = $$1;
  }
  $$pr = HEAP32[4372]|0;
  $1474 = ($$pr>>>0)<(3);
  if ($1474) {
   $$0$ph = $$3$ph;
  } else {
   $$334 = $$3$ph;$1475 = $$pr;
   label = 433;
   break;
  }
 }
 switch (label|0) {
  case 5: {
   _Throw_serious_error(9834);
   // unreachable;
   break;
  }
  case 8: {
   _Throw_serious_error(9834);
   // unreachable;
   break;
  }
  case 19: {
   $55 = (($53) - ($$pre56$i))|0;
   _Bug_found(8924,$55);
   // unreachable;
   break;
  }
  case 34: {
   $111 = (($109) - ($98))|0;
   _Bug_found(8924,$111);
   // unreachable;
   break;
  }
  case 41: {
   _Throw_error(9931);
   HEAP32[4372] = 4;
   $$33435 = $$0$ph;
   STACKTOP = sp;return ($$33435|0);
   break;
  }
  case 73: {
   _Bug_found(8924,-1);
   // unreachable;
   break;
  }
  case 82: {
   $266 = (($264) - ($253))|0;
   _Bug_found(8924,$266);
   // unreachable;
   break;
  }
  case 87: {
   HEAP32[4372] = 4;
   $$33435 = $$0$ph;
   STACKTOP = sp;return ($$33435|0);
   break;
  }
  case 126: {
   $413 = (($411) - ($400))|0;
   _Bug_found(8924,$413);
   // unreachable;
   break;
  }
  case 133: {
   _Throw_error(9931);
   HEAP32[4372] = 4;
   $$33435 = $$0$ph;
   STACKTOP = sp;return ($$33435|0);
   break;
  }
  case 175: {
   HEAP32[4374] = $479;
   HEAP32[4372] = 5;
   $$33437 = $$0$ph;
   break;
  }
  case 179: {
   _Bug_found(9056,$489);
   // unreachable;
   break;
  }
  case 428: {
   _Bug_found(9240,$488);
   // unreachable;
   break;
  }
  case 433: {
   $1476 = ($1475|0)==(5);
   if ($1476) {
    $$33437 = $$334;
   } else {
    $$33435 = $$334;
    STACKTOP = sp;return ($$33435|0);
   }
   break;
  }
 }
 $1477 = HEAP32[4371]|0;
 $1478 = ($1477|0)==(1);
 if (!($1478)) {
  _Bug_found(9262,$1477);
  // unreachable;
 }
 $1479 = HEAP32[4374]|0;
 $1480 = ($1479|0)==(1);
 if (!($1480)) {
  _Bug_found(9283,$1479);
  // unreachable;
 }
 $1481 = HEAP32[4370]|0;
 ;HEAP32[$0>>2]=HEAP32[$1481>>2]|0;HEAP32[$0+4>>2]=HEAP32[$1481+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$1481+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$1481+12>>2]|0;HEAP32[$0+16>>2]=HEAP32[$1481+16>>2]|0;HEAP32[$0+20>>2]=HEAP32[$1481+20>>2]|0;
 $1482 = HEAP32[4373]|0;
 $1483 = HEAP32[$0>>2]|0;
 $1484 = $1483 | $1482;
 HEAP32[$0>>2] = $1484;
 $1485 = $1484 & 4;
 $1486 = ($1485|0)==(0);
 if ($1486) {
  $1488 = $1484 & 2;
  $1489 = ($1488|0)==(0);
  if ($1489) {
   $1492 = $1484;
  } else {
   $1490 = $1484 & -2;
   HEAP32[$0>>2] = $1490;
   $1492 = $1490;
  }
 } else {
  $1487 = $1484 & -4;
  HEAP32[$0>>2] = $1487;
  $1492 = $1487;
 }
 $1491 = $1492 & 64;
 $1493 = ($1491|0)==(0);
 if ($1493) {
  $1494 = $1492 & -17;
  HEAP32[$0>>2] = $1494;
  $1496 = $1494;
 } else {
  $1496 = $1492;
 }
 $1495 = $1496 & 256;
 $1497 = ($1495|0)==(0);
 $1498 = $1496 & 16;
 $1499 = ($1498|0)==(0);
 if ($1497) {
  if ($1499) {
   $1508 = ((($0)) + 8|0);
   HEAP32[$1508>>2] = 0;
   $$33435 = $$33437;
   STACKTOP = sp;return ($$33435|0);
  }
  $1509 = $1496 & 32;
  $1510 = ($1509|0)==(0);
  if (!($1510)) {
   $$33435 = $$33437;
   STACKTOP = sp;return ($$33435|0);
  }
  $1511 = ((($0)) + 8|0);
  $1512 = HEAP32[$1511>>2]|0;
  $$off = (($1512) + 128)|0;
  $1513 = ($$off>>>0)<(384);
  if (!($1513)) {
   $$33435 = $$33437;
   STACKTOP = sp;return ($$33435|0);
  }
  $1514 = $1496 | 8;
  HEAP32[$0>>2] = $1514;
  $$33435 = $$33437;
  STACKTOP = sp;return ($$33435|0);
 } else {
  if ($1499) {
   $1500 = ((($0)) + 8|0);
   HEAPF64[$1500>>3] = 0.0;
   $$33435 = $$33437;
   STACKTOP = sp;return ($$33435|0);
  }
  $1501 = $1496 & 32;
  $1502 = ($1501|0)==(0);
  if (!($1502)) {
   $$33435 = $$33437;
   STACKTOP = sp;return ($$33435|0);
  }
  $1503 = ((($0)) + 8|0);
  $1504 = +HEAPF64[$1503>>3];
  $1505 = !($1504 <= 255.0);
  $1506 = !($1504 >= -128.0);
  $or$cond = $1505 | $1506;
  if ($or$cond) {
   $$33435 = $$33437;
   STACKTOP = sp;return ($$33435|0);
  }
  $1507 = $1496 | 8;
  HEAP32[$0>>2] = $1507;
  $$33435 = $$33437;
  STACKTOP = sp;return ($$33435|0);
 }
 return (0)|0;
}
function _ALU_int_result($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_parse_expression($0)|0);
 $2 = ($1|0)==(0);
 if (!($2)) {
  _Throw_error(8887);
 }
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 256;
 $5 = ($4|0)==(0);
 if ($5) {
  $11 = $3;
 } else {
  $6 = ((($0)) + 8|0);
  $7 = +HEAPF64[$6>>3];
  $8 = (~~(($7)));
  HEAP32[$6>>2] = $8;
  $9 = $3 & -257;
  HEAP32[$0>>2] = $9;
  $11 = $9;
 }
 $10 = $11 & 64;
 $12 = ($10|0)==(0);
 if ($12) {
  _Throw_error(9305);
  return;
 }
 $13 = $11 & 16;
 $14 = ($13|0)==(0);
 if (!($14)) {
  return;
 }
 $15 = HEAP32[4390]|0;
 $16 = (($15) + 1)|0;
 HEAP32[4390] = $16;
 $17 = HEAP32[4363]|0;
 $18 = ($17|0)==(0|0);
 if ($18) {
  return;
 }
 $19 = HEAP32[4364]|0;
 $20 = ((($19)) + 4|0);
 HEAP32[$20>>2] = 0;
 _DynaBuf_add_string($19,8901);
 $21 = HEAP32[4364]|0;
 $22 = HEAP32[4366]|0;
 $23 = HEAP32[$22>>2]|0;
 _DynaBuf_add_string($21,$23);
 $24 = HEAP32[4364]|0;
 _DynaBuf_add_string($24,8921);
 $25 = HEAP32[4364]|0;
 _DynaBuf_append($25,0);
 $26 = HEAP32[4364]|0;
 $27 = HEAP32[$26>>2]|0;
 _Throw_error($27);
 return;
}
function _ALU_any_int() {
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0;
 var $26 = 0, $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 $1 = (_parse_expression($0)|0);
 $2 = ($1|0)==(0);
 if (!($2)) {
  _Throw_error(8887);
 }
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 64;
 $5 = ($4|0)==(0);
 if ($5) {
  _Throw_error(9305);
 } else {
  $6 = $3 & 16;
  $7 = ($6|0)==(0);
  if ($7) {
   $8 = HEAP32[4390]|0;
   $9 = (($8) + 1)|0;
   HEAP32[4390] = $9;
   $10 = HEAP32[4363]|0;
   $11 = ($10|0)==(0|0);
   if (!($11)) {
    $12 = HEAP32[4364]|0;
    $13 = ((($12)) + 4|0);
    HEAP32[$13>>2] = 0;
    _DynaBuf_add_string($12,8901);
    $14 = HEAP32[4364]|0;
    $15 = HEAP32[4366]|0;
    $16 = HEAP32[$15>>2]|0;
    _DynaBuf_add_string($14,$16);
    $17 = HEAP32[4364]|0;
    _DynaBuf_add_string($17,8921);
    $18 = HEAP32[4364]|0;
    _DynaBuf_append($18,0);
    $19 = HEAP32[4364]|0;
    $20 = HEAP32[$19>>2]|0;
    _Throw_error($20);
   }
  }
 }
 $21 = $3 & 256;
 $22 = ($21|0)==(0);
 $23 = ((($0)) + 8|0);
 $24 = +HEAPF64[$23>>3];
 $25 = (~~(($24)));
 HEAPF64[tempDoublePtr>>3] = $24;$26 = HEAP32[tempDoublePtr>>2]|0;
 $27 = HEAP32[tempDoublePtr+4>>2]|0;
 $$0 = $22 ? $26 : $25;
 STACKTOP = sp;return ($$0|0);
}
function _ALU_defined_int($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0.0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_parse_expression($0)|0);
 $2 = ($1|0)==(0);
 if (!($2)) {
  _Throw_error(8887);
 }
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 16;
 $5 = ($4|0)==(0);
 if ($5) {
  $6 = HEAP32[4364]|0;
  $7 = ((($6)) + 4|0);
  HEAP32[$7>>2] = 0;
  _DynaBuf_add_string($6,8901);
  $8 = HEAP32[4364]|0;
  $9 = HEAP32[4366]|0;
  $10 = HEAP32[$9>>2]|0;
  _DynaBuf_add_string($8,$10);
  $11 = HEAP32[4364]|0;
  _DynaBuf_add_string($11,8921);
  $12 = HEAP32[4364]|0;
  _DynaBuf_append($12,0);
  $13 = HEAP32[4364]|0;
  $14 = HEAP32[$13>>2]|0;
  _Throw_serious_error($14);
  // unreachable;
 }
 $15 = $3 & 256;
 $16 = ($15|0)==(0);
 if ($16) {
  return;
 }
 $17 = ((($0)) + 8|0);
 $18 = +HEAPF64[$17>>3];
 $19 = (~~(($18)));
 HEAP32[$17>>2] = $19;
 $20 = $3 & -257;
 HEAP32[$0>>2] = $20;
 return;
}
function _ALU_liberal_int($0) {
 $0 = $0|0;
 var $$0 = 0, $$pre = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_parse_expression($0)|0);
 $2 = HEAP32[$0>>2]|0;
 $3 = $2 & 256;
 $4 = ($3|0)==(0);
 if ($4) {
  $26 = $2;
 } else {
  $5 = ((($0)) + 8|0);
  $6 = +HEAPF64[$5>>3];
  $7 = (~~(($6)));
  HEAP32[$5>>2] = $7;
  $8 = $2 & -257;
  HEAP32[$0>>2] = $8;
  $26 = $8;
 }
 $9 = ($1|0)>(1);
 if ($9) {
  _Throw_error(8887);
  $$pre = HEAP32[$0>>2]|0;
  $$0 = 0;$11 = $$pre;
 } else {
  $$0 = $1;$11 = $26;
 }
 $10 = $11 & 80;
 $12 = ($10|0)==(64);
 if (!($12)) {
  return ($$0|0);
 }
 $13 = HEAP32[4390]|0;
 $14 = (($13) + 1)|0;
 HEAP32[4390] = $14;
 $15 = HEAP32[4363]|0;
 $16 = ($15|0)==(0|0);
 if ($16) {
  return ($$0|0);
 }
 $17 = HEAP32[4364]|0;
 $18 = ((($17)) + 4|0);
 HEAP32[$18>>2] = 0;
 _DynaBuf_add_string($17,8901);
 $19 = HEAP32[4364]|0;
 $20 = HEAP32[4366]|0;
 $21 = HEAP32[$20>>2]|0;
 _DynaBuf_add_string($19,$21);
 $22 = HEAP32[4364]|0;
 _DynaBuf_add_string($22,8921);
 $23 = HEAP32[4364]|0;
 _DynaBuf_append($23,0);
 $24 = HEAP32[4364]|0;
 $25 = HEAP32[$24>>2]|0;
 _Throw_error($25);
 return ($$0|0);
}
function _ALU_any_result($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_parse_expression($0)|0);
 $2 = ($1|0)==(0);
 if (!($2)) {
  _Throw_error(8887);
 }
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 64;
 $5 = ($4|0)==(0);
 if ($5) {
  _Throw_error(9305);
  return;
 }
 $6 = $3 & 16;
 $7 = ($6|0)==(0);
 if (!($7)) {
  return;
 }
 $8 = HEAP32[4390]|0;
 $9 = (($8) + 1)|0;
 HEAP32[4390] = $9;
 $10 = HEAP32[4363]|0;
 $11 = ($10|0)==(0|0);
 if ($11) {
  return;
 }
 $12 = HEAP32[4364]|0;
 $13 = ((($12)) + 4|0);
 HEAP32[$13>>2] = 0;
 _DynaBuf_add_string($12,8901);
 $14 = HEAP32[4364]|0;
 $15 = HEAP32[4366]|0;
 $16 = HEAP32[$15>>2]|0;
 _DynaBuf_add_string($14,$16);
 $17 = HEAP32[4364]|0;
 _DynaBuf_add_string($17,8921);
 $18 = HEAP32[4364]|0;
 _DynaBuf_append($18,0);
 $19 = HEAP32[4364]|0;
 $20 = HEAP32[$19>>2]|0;
 _Throw_error($20);
 return;
}
function _cliargs_handle_options($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $2 = HEAP32[4377]|0;
 $3 = ($2|0)==(0);
 if ($3) {
  STACKTOP = sp;return;
 } else {
  $9 = $2;
 }
 while(1) {
  $4 = HEAP32[4378]|0;
  $5 = HEAP32[$4>>2]|0;
  $6 = HEAP8[$5>>0]|0;
  $7 = ($6<<24>>24)==(45);
  if (!($7)) {
   label = 10;
   break;
  }
  $8 = (($9) + -1)|0;
  HEAP32[4377] = $8;
  $10 = ((($4)) + 4|0);
  HEAP32[4378] = $10;
  $11 = ((($5)) + 1|0);
  $12 = HEAP8[$11>>0]|0;
  $13 = ($12<<24>>24)==(45);
  if ($13) {
   $14 = ((($5)) + 2|0);
   $15 = HEAP8[$14>>0]|0;
   $16 = ($15<<24>>24)==(0);
   if ($16) {
    label = 10;
    break;
   }
   $17 = (FUNCTION_TABLE_ii[$1 & 15]($14)|0);
   $18 = ($17|0)==(0|0);
   if (!($18)) {
    label = 6;
    break;
   }
  } else {
   $20 = (FUNCTION_TABLE_ii[$0 & 15]($11)|0);
   $21 = ($20<<24>>24)==(0);
   if (!($21)) {
    label = 9;
    break;
   }
  }
  $22 = HEAP32[4377]|0;
  $23 = ($22|0)==(0);
  if ($23) {
   label = 10;
   break;
  } else {
   $9 = $22;
  }
 }
 if ((label|0) == 6) {
  $19 = HEAP32[1342]|0;
  HEAP32[$vararg_buffer>>2] = 9321;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $17;
  (_fprintf($19,9346,$vararg_buffer)|0);
  _exit(1);
  // unreachable;
 }
 else if ((label|0) == 9) {
  $24 = HEAP32[1342]|0;
  $25 = $20 << 24 >> 24;
  HEAP32[$vararg_buffer2>>2] = 9321;
  $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
  HEAP32[$vararg_ptr5>>2] = $25;
  (_fprintf($24,9372,$vararg_buffer2)|0);
  _exit(1);
  // unreachable;
 }
 else if ((label|0) == 10) {
  STACKTOP = sp;return;
 }
}
function _cliargs_safe_get_next($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = HEAP32[4377]|0;
 $2 = ($1|0)==(0);
 if (!($2)) {
  $3 = (($1) + -1)|0;
  HEAP32[4377] = $3;
  $4 = HEAP32[4378]|0;
  $5 = ((($4)) + 4|0);
  HEAP32[4378] = $5;
  $6 = HEAP32[$4>>2]|0;
  $7 = ($6|0)==(0|0);
  if (!($7)) {
   STACKTOP = sp;return ($6|0);
  }
 }
 $8 = HEAP32[1342]|0;
 HEAP32[$vararg_buffer>>2] = 9321;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $0;
 (_fprintf($8,9397,$vararg_buffer)|0);
 _exit(1);
 // unreachable;
 return (0)|0;
}
function _cliargs_init($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[4377] = $0;
 HEAP32[4378] = $1;
 $2 = ($0|0)==(0);
 if ($2) {
  $$0$i = 0;
  return ($$0$i|0);
 }
 $3 = (($0) + -1)|0;
 HEAP32[4377] = $3;
 $4 = ((($1)) + 4|0);
 HEAP32[4378] = $4;
 $5 = HEAP32[$1>>2]|0;
 $$0$i = $5;
 return ($$0$i|0);
}
function _cliargs_get_rest($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $or$cond = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $3 = HEAP32[4377]|0;
 HEAP32[$0>>2] = $3;
 $4 = HEAP32[4378]|0;
 HEAP32[$1>>2] = $4;
 $5 = ($2|0)!=(0|0);
 $6 = ($3|0)==(0);
 $or$cond = $5 & $6;
 if ($or$cond) {
  $7 = HEAP32[1342]|0;
  HEAP32[$vararg_buffer>>2] = 9321;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $2;
  (_fprintf($7,9412,$vararg_buffer)|0);
  _exit(1);
  // unreachable;
 } else {
  STACKTOP = sp;return;
 }
}
function _cputype_find() {
 var $$0 = 0, $$pre = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 $1 = HEAP32[4379]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  _Tree_add_table(17516,728);
  $$pre = HEAP32[4379]|0;
  $4 = $$pre;
 } else {
  $4 = $1;
 }
 $3 = HEAP32[4380]|0;
 $5 = (_Tree_easy_scan($4,$0,$3)|0);
 $6 = ($5|0)==(0);
 $7 = HEAP32[$0>>2]|0;
 $$0 = $6 ? 0 : $7;
 STACKTOP = sp;return ($$0|0);
}
function _vcpu_check_and_set_reg_length($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[4080]|0;
 $3 = ((($2)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = $4 & 2;
 $6 = ($5|0)==(0);
 $7 = ($1|0)!=(0);
 $or$cond = $7 & $6;
 if ($or$cond) {
  _Throw_error(9493);
  return;
 } else {
  HEAP32[$0>>2] = $1;
  return;
 }
}
function _cputype_passinit($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)!=(0|0);
 $2 = $1 ? $0 : 828;
 HEAP32[4080] = $2;
 return;
}
function _DynaBuf_create($0) {
 $0 = $0|0;
 var $$ = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)<(128);
 $$ = $1 ? 128 : $0;
 $2 = (_malloc(12)|0);
 $3 = ($2|0)==(0|0);
 if (!($3)) {
  $4 = ((($2)) + 4|0);
  HEAP32[$4>>2] = 0;
  $5 = ((($2)) + 8|0);
  HEAP32[$5>>2] = $$;
  $6 = (_malloc($$)|0);
  HEAP32[$2>>2] = $6;
  $7 = ($6|0)==(0|0);
  if (!($7)) {
   return ($2|0);
  }
 }
 $8 = HEAP32[1342]|0;
 (_fwrite(9537,37,1,$8)|0);
 _exit(1);
 // unreachable;
 return (0)|0;
}
function _DynaBuf_enlarge($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 8|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = $2 << 1;
 $4 = HEAP32[$0>>2]|0;
 $5 = (_realloc($4,$3)|0);
 $6 = ($5|0)==(0|0);
 if ($6) {
  _Throw_serious_error(9834);
  // unreachable;
 } else {
  HEAP32[$1>>2] = $3;
  HEAP32[$0>>2] = $5;
  return;
 }
}
function _DynaBuf_get_copy($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_safe_malloc($2)|0);
 $4 = HEAP32[$0>>2]|0;
 $5 = HEAP32[$1>>2]|0;
 _memcpy(($3|0),($4|0),($5|0))|0;
 return ($3|0);
}
function _DynaBuf_append($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$pre = 0, $$pre5 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($0)) + 4|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ((($0)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($3|0)==($5|0);
 do {
  if ($6) {
   $7 = $3 << 1;
   $8 = HEAP32[$0>>2]|0;
   $9 = (_realloc($8,$7)|0);
   $10 = ($9|0)==(0|0);
   if ($10) {
    _Throw_serious_error(9834);
    // unreachable;
   } else {
    HEAP32[$4>>2] = $7;
    HEAP32[$0>>2] = $9;
    $$pre = HEAP32[$2>>2]|0;
    $12 = $$pre;$14 = $9;
    break;
   }
  } else {
   $$pre5 = HEAP32[$0>>2]|0;
   $12 = $3;$14 = $$pre5;
  }
 } while(0);
 $11 = (($12) + 1)|0;
 HEAP32[$2>>2] = $11;
 $13 = (($14) + ($12)|0);
 HEAP8[$13>>0] = $1;
 return;
}
function _DynaBuf_add_string($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$pn = 0, $$pre = 0, $$pre7 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$1>>0]|0;
 $3 = ($2<<24>>24)==(0);
 if ($3) {
  return;
 }
 $4 = ((($0)) + 4|0);
 $5 = ((($0)) + 8|0);
 $$pn = $1;$18 = $2;
 while(1) {
  $6 = ((($$pn)) + 1|0);
  $7 = HEAP32[$4>>2]|0;
  $8 = HEAP32[$5>>2]|0;
  $9 = ($7|0)==($8|0);
  if ($9) {
   $10 = $7 << 1;
   $11 = HEAP32[$0>>2]|0;
   $12 = (_realloc($11,$10)|0);
   $13 = ($12|0)==(0|0);
   if ($13) {
    label = 6;
    break;
   }
   HEAP32[$5>>2] = $10;
   HEAP32[$0>>2] = $12;
   $$pre = HEAP32[$4>>2]|0;
   $15 = $$pre;$17 = $12;
  } else {
   $$pre7 = HEAP32[$0>>2]|0;
   $15 = $7;$17 = $$pre7;
  }
  $14 = (($15) + 1)|0;
  HEAP32[$4>>2] = $14;
  $16 = (($17) + ($15)|0);
  HEAP8[$16>>0] = $18;
  $19 = HEAP8[$6>>0]|0;
  $20 = ($19<<24>>24)==(0);
  if ($20) {
   label = 9;
   break;
  } else {
   $$pn = $6;$18 = $19;
  }
 }
 if ((label|0) == 6) {
  _Throw_serious_error(9834);
  // unreachable;
 }
 else if ((label|0) == 9) {
  return;
 }
}
function _DynaBuf_to_lower($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$lcssa = 0, $$01314 = 0, $$015 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 4|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ((($0)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($3|0)>($5|0);
 $7 = HEAP32[$0>>2]|0;
 do {
  if ($6) {
   $8 = (_realloc($7,$3)|0);
   $9 = ($8|0)==(0|0);
   if ($9) {
    _Throw_serious_error(9834);
    // unreachable;
   } else {
    HEAP32[$4>>2] = $3;
    HEAP32[$0>>2] = $8;
    $21 = $8;
    break;
   }
  } else {
   $21 = $7;
  }
 } while(0);
 $10 = HEAP32[$1>>2]|0;
 $11 = HEAP8[$10>>0]|0;
 $12 = ($11<<24>>24)==(0);
 if ($12) {
  $$0$lcssa = $21;
  HEAP8[$$0$lcssa>>0] = 0;
  return;
 } else {
  $$01314 = $10;$$015 = $21;$15 = $11;
 }
 while(1) {
  $13 = ((($$01314)) + 1|0);
  $14 = $15&255;
  $16 = $14 | 32;
  $17 = $16&255;
  $18 = ((($$015)) + 1|0);
  HEAP8[$$015>>0] = $17;
  $19 = HEAP8[$13>>0]|0;
  $20 = ($19<<24>>24)==(0);
  if ($20) {
   $$0$lcssa = $18;
   break;
  } else {
   $$01314 = $13;$$015 = $18;$15 = $19;
  }
 }
 HEAP8[$$0$lcssa>>0] = 0;
 return;
}
function _DynaBuf_init() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_malloc(12)|0);
 $1 = ($0|0)==(0|0);
 if (!($1)) {
  $2 = ((($0)) + 4|0);
  HEAP32[$2>>2] = 0;
  $3 = ((($0)) + 8|0);
  HEAP32[$3>>2] = 1024;
  $4 = (_malloc(1024)|0);
  HEAP32[$0>>2] = $4;
  $5 = ($4|0)==(0|0);
  if (!($5)) {
   HEAP32[4380] = $0;
   return;
  }
 }
 $6 = HEAP32[1342]|0;
 (_fwrite(9537,37,1,$6)|0);
 _exit(1);
 // unreachable;
}
function _encoderfn_raw($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function _encoderfn_pet($0) {
 $0 = $0|0;
 var $$0 = 0, $$off = 0, $$off9 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 << 24 >> 24;
 $$off = (($0) + -65)<<24>>24;
 $2 = ($$off&255)<(26);
 if ($2) {
  $3 = $1 | 128;
  $4 = $3&255;
  $$0 = $4;
  return ($$0|0);
 }
 $$off9 = (($0) + -97)<<24>>24;
 $5 = ($$off9&255)<(26);
 if (!($5)) {
  $$0 = $0;
  return ($$0|0);
 }
 $6 = (($1) + 224)|0;
 $7 = $6&255;
 $$0 = $7;
 return ($$0|0);
}
function _encoderfn_scr($0) {
 $0 = $0|0;
 var $$0 = 0, $$off = 0, $$off11 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0 << 24 >> 24;
 $$off = (($0) + -97)<<24>>24;
 $2 = ($$off&255)<(26);
 L1: do {
  if ($2) {
   $3 = (($1) + 160)|0;
   $4 = $3&255;
   $$0 = $4;
  } else {
   $$off11 = (($0) + -91)<<24>>24;
   $5 = ($$off11&255)<(5);
   if ($5) {
    $6 = (($1) + 192)|0;
    $7 = $6&255;
    $$0 = $7;
    break;
   }
   switch ($0<<24>>24) {
   case 96:  {
    $$0 = 64;
    break L1;
    break;
   }
   case 64:  {
    $$0 = 0;
    break L1;
    break;
   }
   default: {
    $$0 = $0;
    break L1;
   }
   }
  }
 } while(0);
 return ($$0|0);
}
function _encoderfn_file($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0&255;
 $2 = HEAP32[222]|0;
 $3 = (($2) + ($1)|0);
 $4 = HEAP8[$3>>0]|0;
 return ($4|0);
}
function _encoding_encode_char($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[4381]|0;
 $2 = HEAP32[$1>>2]|0;
 $3 = (FUNCTION_TABLE_ii[$2 & 15]($0)|0);
 return ($3|0);
}
function _encoding_passinit() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[4381] = 892;
 return;
}
function _encoding_load($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (_fopen($1,10371)|0);
 $3 = ($2|0)==(0|0);
 if ($3) {
  _Throw_error(9780);
  return;
 }
 $4 = (_fread($0,1,256,$2)|0);
 $5 = ($4|0)==(256);
 if (!($5)) {
  _Throw_error(9575);
 }
 (_fclose($2)|0);
 return;
}
function _encoding_find() {
 var $$0 = 0, $$pre = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 $1 = HEAP32[4382]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  _Tree_add_table(17528,908);
  $$pre = HEAP32[4382]|0;
  $4 = $$pre;
 } else {
  $4 = $1;
 }
 $3 = HEAP32[4380]|0;
 $5 = (_Tree_easy_scan($4,$0,$3)|0);
 $6 = ($5|0)==(0);
 if ($6) {
  _Throw_error(9604);
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 } else {
  $7 = HEAP32[$0>>2]|0;
  $$0 = $7;
  STACKTOP = sp;return ($$0|0);
 }
 return (0)|0;
}
function _flow_forloop($0) {
 $0 = $0|0;
 var $$cast = 0, $$pre = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $1 = sp + 24|0;
 $2 = sp;
 $3 = HEAP32[245]|0;
 ;HEAP32[$1>>2]=HEAP32[$3>>2]|0;HEAP32[$1+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$1+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$1+12>>2]=HEAP32[$3+12>>2]|0;HEAP32[$1+16>>2]=HEAP32[$3+16>>2]|0;
 $4 = ((($1)) + 8|0);
 HEAP32[$4>>2] = 1;
 $$cast = $3;
 HEAP32[245] = $1;
 HEAP32[$2>>2] = 80;
 $5 = ((($0)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($2)) + 8|0);
 HEAP32[$7>>2] = $6;
 $8 = ((($0)) + 20|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($2)) + 16|0);
 HEAP32[$10>>2] = $9;
 $11 = HEAP32[$0>>2]|0;
 _symbol_set_value($11,$2,1);
 $12 = ((($0)) + 4|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ($13|0)==(0);
 if ($14) {
  $15 = ((($0)) + 24|0);
  $16 = ((($0)) + 28|0);
  $17 = ((($0)) + 16|0);
  $18 = ((($0)) + 12|0);
  while(1) {
   $40 = HEAP32[$15>>2]|0;
   $41 = HEAP32[245]|0;
   $42 = ((($41)) + 4|0);
   HEAP32[$42>>2] = $40;
   $43 = HEAP32[$16>>2]|0;
   $44 = ((($41)) + 16|0);
   HEAP32[$44>>2] = $43;
   _Parse_until_eob_or_eof();
   $45 = HEAP8[20560]|0;
   $46 = ($45<<24>>24)==(125);
   if (!($46)) {
    label = 9;
    break;
   }
   $48 = HEAP32[$17>>2]|0;
   $49 = HEAP32[$7>>2]|0;
   $50 = (($49) + ($48))|0;
   HEAP32[$7>>2] = $50;
   $51 = HEAP32[$0>>2]|0;
   _symbol_set_value($51,$2,1);
   $52 = HEAP32[$7>>2]|0;
   $53 = HEAP32[$18>>2]|0;
   $54 = HEAP32[$17>>2]|0;
   $55 = (($54) + ($53))|0;
   $56 = ($52|0)==($55|0);
   if ($56) {
    label = 11;
    break;
   }
  }
  if ((label|0) == 9) {
   $47 = $45 << 24 >> 24;
   _Bug_found(10864,$47);
   // unreachable;
  }
  else if ((label|0) == 11) {
   HEAP32[245] = $$cast;
   STACKTOP = sp;return;
  }
 }
 $19 = ((($0)) + 12|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = ($20|0)==(0);
 if ($21) {
  HEAP32[245] = $$cast;
  STACKTOP = sp;return;
 }
 $22 = ((($0)) + 16|0);
 $23 = ((($0)) + 24|0);
 $24 = ((($0)) + 28|0);
 $$pre = HEAP32[$7>>2]|0;
 $27 = $$pre;
 while(1) {
  $25 = HEAP32[$22>>2]|0;
  $26 = (($27) + ($25))|0;
  HEAP32[$7>>2] = $26;
  $28 = HEAP32[$0>>2]|0;
  _symbol_set_value($28,$2,1);
  $29 = HEAP32[$23>>2]|0;
  $30 = HEAP32[245]|0;
  $31 = ((($30)) + 4|0);
  HEAP32[$31>>2] = $29;
  $32 = HEAP32[$24>>2]|0;
  $33 = ((($30)) + 16|0);
  HEAP32[$33>>2] = $32;
  _Parse_until_eob_or_eof();
  $34 = HEAP8[20560]|0;
  $35 = ($34<<24>>24)==(125);
  if (!($35)) {
   label = 6;
   break;
  }
  $37 = HEAP32[$7>>2]|0;
  $38 = HEAP32[$19>>2]|0;
  $39 = ($37|0)<($38|0);
  if ($39) {
   $27 = $37;
  } else {
   label = 11;
   break;
  }
 }
 if ((label|0) == 6) {
  $36 = $34 << 24 >> 24;
  _Bug_found(10864,$36);
  // unreachable;
 }
 else if ((label|0) == 11) {
  HEAP32[245] = $$cast;
  STACKTOP = sp;return;
 }
}
function _flow_store_doloop_condition($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[245]|0;
 $3 = ((($2)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 HEAP32[$0>>2] = $4;
 $5 = ((($0)) + 4|0);
 HEAP32[$5>>2] = 0;
 $6 = ((($0)) + 8|0);
 HEAP32[$6>>2] = 0;
 $7 = HEAP8[20560]|0;
 $8 = ($7<<24>>24)==($1<<24>>24);
 if ($8) {
  return;
 }
 $9 = (_Input_read_and_lower_keyword()|0);
 $10 = ($9|0)==(0);
 if ($10) {
  return;
 }
 $11 = HEAP32[4380]|0;
 $12 = HEAP32[$11>>2]|0;
 $13 = (_strcmp($12,9622)|0);
 $14 = ($13|0)==(0);
 do {
  if (!($14)) {
   $15 = (_strcmp($12,9628)|0);
   $16 = ($15|0)==(0);
   if ($16) {
    HEAP32[$5>>2] = 1;
    break;
   }
   _Throw_error(9931);
   return;
  }
 } while(0);
 $17 = HEAP8[20560]|0;
 $18 = ($17<<24>>24)==(32);
 if ($18) {
  (_GetByte()|0);
  $$pre = HEAP32[4380]|0;
  $20 = $$pre;
 } else {
  $20 = $11;
 }
 $19 = ((($20)) + 4|0);
 HEAP32[$19>>2] = 0;
 _Input_until_terminator($1);
 $21 = HEAP32[4380]|0;
 _DynaBuf_append($21,0);
 $22 = HEAP32[4380]|0;
 $23 = (_DynaBuf_get_copy($22)|0);
 HEAP32[$6>>2] = $23;
 return;
}
function _flow_doloop($0) {
 $0 = $0|0;
 var $$$i = 0, $$$i5 = 0, $$cast = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $1 = sp;
 $2 = sp + 24|0;
 $3 = HEAP32[245]|0;
 ;HEAP32[$2>>2]=HEAP32[$3>>2]|0;HEAP32[$2+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$2+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$2+12>>2]=HEAP32[$3+12>>2]|0;HEAP32[$2+16>>2]=HEAP32[$3+16>>2]|0;
 $4 = ((($2)) + 8|0);
 HEAP32[$4>>2] = 1;
 $$cast = $3;
 HEAP32[245] = $2;
 $5 = ((($0)) + 8|0);
 $6 = ((($0)) + 12|0);
 $7 = ((($0)) + 16|0);
 $8 = ((($0)) + 28|0);
 $9 = ((($0)) + 20|0);
 $10 = ((($0)) + 24|0);
 $11 = ((($1)) + 8|0);
 $12 = ((($0)) + 4|0);
 $13 = ((($1)) + 8|0);
 while(1) {
  $14 = HEAP32[$5>>2]|0;
  $15 = ($14|0)==(0|0);
  if ($15) {
  } else {
   $16 = $14;
   $17 = HEAP32[$0>>2]|0;
   $18 = HEAP32[245]|0;
   $19 = ((($18)) + 4|0);
   HEAP32[$19>>2] = $17;
   $20 = ((($18)) + 16|0);
   HEAP32[$20>>2] = $16;
   (_GetByte()|0);
   _ALU_defined_int($1);
   $21 = HEAP8[20560]|0;
   $22 = ($21<<24>>24)==(0);
   if (!($22)) {
    label = 5;
    break;
   }
   $23 = HEAP32[$12>>2]|0;
   $24 = ($23|0)!=(0);
   $25 = HEAP32[$13>>2]|0;
   $26 = ($25|0)!=(0);
   $$$i = $24 ^ $26;
   if (!($$$i)) {
    label = 14;
    break;
   }
  }
  $27 = HEAP32[$6>>2]|0;
  $28 = HEAP32[245]|0;
  $29 = ((($28)) + 4|0);
  HEAP32[$29>>2] = $27;
  $30 = HEAP32[$7>>2]|0;
  $31 = ((($28)) + 16|0);
  HEAP32[$31>>2] = $30;
  _Parse_until_eob_or_eof();
  $32 = HEAP8[20560]|0;
  $33 = ($32<<24>>24)==(125);
  if (!($33)) {
   label = 8;
   break;
  }
  $35 = HEAP32[$8>>2]|0;
  $36 = ($35|0)==(0|0);
  if ($36) {
   continue;
  }
  $37 = $35;
  $38 = HEAP32[$9>>2]|0;
  $39 = HEAP32[245]|0;
  $40 = ((($39)) + 4|0);
  HEAP32[$40>>2] = $38;
  $41 = ((($39)) + 16|0);
  HEAP32[$41>>2] = $37;
  (_GetByte()|0);
  _ALU_defined_int($1);
  $42 = HEAP8[20560]|0;
  $43 = ($42<<24>>24)==(0);
  if (!($43)) {
   label = 12;
   break;
  }
  $44 = HEAP32[$10>>2]|0;
  $45 = ($44|0)!=(0);
  $46 = HEAP32[$11>>2]|0;
  $47 = ($46|0)!=(0);
  $$$i5 = $45 ^ $47;
  if (!($$$i5)) {
   label = 14;
   break;
  }
 }
 if ((label|0) == 5) {
  _Throw_serious_error(9931);
  // unreachable;
 }
 else if ((label|0) == 8) {
  $34 = $32 << 24 >> 24;
  _Bug_found(10864,$34);
  // unreachable;
 }
 else if ((label|0) == 12) {
  _Throw_serious_error(9931);
  // unreachable;
 }
 else if ((label|0) == 14) {
  HEAP32[245] = $$cast;
  HEAP8[20560] = 0;
  STACKTOP = sp;return;
 }
}
function _flow_parse_block_else_block($0) {
 $0 = $0|0;
 var $$pr = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 if ($1) {
  (_Input_skip_or_store_block(0)|0);
 } else {
  _Parse_until_eob_or_eof();
  $2 = HEAP8[20560]|0;
  $3 = ($2<<24>>24)==(125);
  if (!($3)) {
   _Throw_serious_error(9849);
   // unreachable;
  }
 }
 $4 = (_GetByte()|0);
 $5 = ($4<<24>>24)==(32);
 if ($5) {
  (_GetByte()|0);
 }
 $6 = HEAP8[20560]|0;
 $7 = ($6<<24>>24)==(0);
 if ($7) {
  return;
 }
 $8 = (_Input_read_and_lower_keyword()|0);
 $9 = ($8|0)==(0);
 do {
  if (!($9)) {
   $10 = HEAP32[4380]|0;
   $11 = HEAP32[$10>>2]|0;
   $12 = (_strcmp($11,9634)|0);
   $13 = ($12|0)==(0);
   if (!($13)) {
    _Throw_error(9931);
    break;
   }
   $14 = HEAP8[20560]|0;
   $15 = ($14<<24>>24)==(32);
   if ($15) {
    (_GetByte()|0);
    $$pr = HEAP8[20560]|0;
    $16 = $$pr;
   } else {
    $16 = $14;
   }
   $17 = ($16<<24>>24)==(123);
   if (!($17)) {
    _Throw_serious_error(9821);
    // unreachable;
   }
   if ($1) {
    _Parse_until_eob_or_eof();
    $18 = HEAP8[20560]|0;
    $19 = ($18<<24>>24)==(125);
    if (!($19)) {
     _Throw_serious_error(9849);
     // unreachable;
    }
   } else {
    (_Input_skip_or_store_block(0)|0);
   }
   (_GetByte()|0);
  }
 } while(0);
 _Input_ensure_EOS();
 return;
}
function _flow_parse_and_close_file($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = HEAP32[4383]|0;
 $3 = ($2|0)>(2);
 if ($3) {
  HEAP32[$vararg_buffer>>2] = $1;
  (_printf(9639,$vararg_buffer)|0);
 }
 _Input_new_file($1,$0);
 _Parse_until_eob_or_eof();
 $4 = HEAP8[20560]|0;
 $5 = ($4<<24>>24)==(13);
 if (!($5)) {
  _Throw_error(9665);
 }
 $6 = HEAP32[245]|0;
 $7 = ((($6)) + 16|0);
 $8 = HEAP32[$7>>2]|0;
 (_fclose($8)|0);
 STACKTOP = sp;return;
}
function _safe_malloc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_malloc($0)|0);
 $2 = ($1|0)==(0|0);
 if ($2) {
  _Throw_serious_error(9834);
  // unreachable;
 } else {
  return ($1|0);
 }
 return (0)|0;
}
function _Throw_serious_error($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _throw_message($0,10201);
 $1 = (_ACME_finalize(1)|0);
 _exit(($1|0));
 // unreachable;
}
function _throw_message($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer6 = 0, $vararg_ptr1 = 0, $vararg_ptr10 = 0, $vararg_ptr11 = 0, $vararg_ptr12 = 0;
 var $vararg_ptr13 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, $vararg_ptr5 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer6 = sp + 24|0;
 $vararg_buffer = sp;
 $2 = HEAP32[4391]|0;
 $3 = (($2) + 1)|0;
 HEAP32[4391] = $3;
 $4 = HEAP32[4386]|0;
 $5 = ($4|0)==(0);
 $6 = HEAP32[4385]|0;
 $7 = HEAP32[245]|0;
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($7)) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = HEAP32[1337]|0;
 $12 = ((($11)) + 4|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($11)) + 8|0);
 $15 = HEAP32[$14>>2]|0;
 if ($5) {
  HEAP32[$vararg_buffer6>>2] = $1;
  $vararg_ptr9 = ((($vararg_buffer6)) + 4|0);
  HEAP32[$vararg_ptr9>>2] = $8;
  $vararg_ptr10 = ((($vararg_buffer6)) + 8|0);
  HEAP32[$vararg_ptr10>>2] = $10;
  $vararg_ptr11 = ((($vararg_buffer6)) + 12|0);
  HEAP32[$vararg_ptr11>>2] = $13;
  $vararg_ptr12 = ((($vararg_buffer6)) + 16|0);
  HEAP32[$vararg_ptr12>>2] = $15;
  $vararg_ptr13 = ((($vararg_buffer6)) + 20|0);
  HEAP32[$vararg_ptr13>>2] = $0;
  (_fprintf($6,10240,$vararg_buffer6)|0);
  STACKTOP = sp;return;
 } else {
  HEAP32[$vararg_buffer>>2] = $8;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $10;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $1;
  $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
  HEAP32[$vararg_ptr3>>2] = $13;
  $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
  HEAP32[$vararg_ptr4>>2] = $15;
  $vararg_ptr5 = ((($vararg_buffer)) + 20|0);
  HEAP32[$vararg_ptr5>>2] = $0;
  (_fprintf($6,10215,$vararg_buffer)|0);
  STACKTOP = sp;return;
 }
}
function _Parse_until_eob_or_eof() {
 var $$0 = 0, $$1 = 0, $$6 = 0, $$6$ph = 0, $$old$i = 0, $$old2$i = 0, $$phi$trans$insert$i = 0, $$phi$trans$insert$i3 = 0, $$phi$trans$insert4$i = 0, $$pr = 0, $$pre = 0, $$pre$i = 0, $$pre$i2 = 0, $$pre2$i = 0, $$pre2$i4 = 0, $$pre3$i = 0, $$pre5$i = 0, $0 = 0, $1 = 0, $10 = 0;
 var $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond$i = 0, $or$cond3$i = 0, $vararg_buffer = 0, $vararg_buffer6 = 0, $vararg_ptr1 = 0, $vararg_ptr10 = 0, $vararg_ptr11 = 0, $vararg_ptr12 = 0, $vararg_ptr13 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, $vararg_ptr5 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer6 = sp + 24|0;
 $vararg_buffer = sp;
 (_GetByte()|0);
 L1: while(1) {
  $0 = HEAP8[20560]|0;
  switch ($0<<24>>24) {
  case 13: case 125:  {
   break L1;
   break;
  }
  default: {
  }
  }
  _typesystem_force_address_statement(0);
  $$pre = HEAP8[20560]|0;
  $$0 = 0;$2 = $$pre;
  while(1) {
   $1 = $2 << 24 >> 24;
   L6: do {
    switch ($1|0) {
    case 0:  {
     $$6 = $$0;$105 = $2;
     break;
    }
    case 32:  {
     $3 = $$0 | 1;
     $$1 = $3;
     label = 6;
     break;
    }
    case 10:  {
     $$1 = $$0;
     label = 6;
     break;
    }
    case 45:  {
     $4 = $$0 & 2;
     $5 = ($4|0)==(0);
     if (!($5)) {
      _Throw_error(9931);
      _Input_skip_remainder();
      $$6$ph = $$0;
      label = 48;
      break L6;
     }
     $6 = HEAP32[4380]|0;
     $7 = ((($6)) + 4|0);
     HEAP32[$7>>2] = 0;
     $11 = 0;$9 = $6;
     while(1) {
      $8 = ((($9)) + 8|0);
      $10 = HEAP32[$8>>2]|0;
      $12 = ($11|0)==($10|0);
      if ($12) {
       _DynaBuf_enlarge($9);
       $$pre3$i = HEAP32[4380]|0;
       $$phi$trans$insert4$i = ((($$pre3$i)) + 4|0);
       $$pre5$i = HEAP32[$$phi$trans$insert4$i>>2]|0;
       $14 = $$pre3$i;$16 = $$pre5$i;
      } else {
       $14 = $9;$16 = $11;
      }
      $13 = ((($14)) + 4|0);
      $15 = (($16) + 1)|0;
      HEAP32[$13>>2] = $15;
      $17 = HEAP32[$14>>2]|0;
      $18 = (($17) + ($16)|0);
      HEAP8[$18>>0] = 45;
      $19 = (_GetByte()|0);
      $20 = ($19<<24>>24)==(45);
      $$pre$i = HEAP32[4380]|0;
      if (!($20)) {
       break;
      }
      $$phi$trans$insert$i = ((($$pre$i)) + 4|0);
      $$pre2$i = HEAP32[$$phi$trans$insert$i>>2]|0;
      $11 = $$pre2$i;$9 = $$pre$i;
     }
     $21 = $$0 | 2;
     _DynaBuf_append($$pre$i,0);
     $22 = HEAP32[1337]|0;
     $23 = HEAP32[$22>>2]|0;
     _symbol_set_label($23,$21,0,1);
     $$6$ph = $21;
     label = 48;
     break;
    }
    case 43:  {
     (_GetByte()|0);
     $24 = HEAP8[20560]|0;
     $25 = ($24<<24>>24)==(46);
     if (!($25)) {
      $26 = $24&255;
      $27 = (9945 + ($26)|0);
      $28 = HEAP8[$27>>0]|0;
      $29 = $28 & 64;
      $30 = ($29<<24>>24)==(0);
      if ($30) {
       $31 = $$0 & 2;
       $32 = ($31|0)==(0);
       if (!($32)) {
        _Throw_error(9931);
        _Input_skip_remainder();
        $$6$ph = $$0;
        label = 48;
        break L6;
       }
       $33 = $$0 | 2;
       $34 = HEAP32[4380]|0;
       $35 = ((($34)) + 4|0);
       HEAP32[$35>>2] = 0;
       _DynaBuf_append($34,43);
       $36 = HEAP8[20560]|0;
       $37 = ($36<<24>>24)==(43);
       if ($37) {
        while(1) {
         $38 = HEAP32[4380]|0;
         $39 = ((($38)) + 4|0);
         $40 = HEAP32[$39>>2]|0;
         $41 = ((($38)) + 8|0);
         $42 = HEAP32[$41>>2]|0;
         $43 = ($40|0)==($42|0);
         if ($43) {
          _DynaBuf_enlarge($38);
          $$pre$i2 = HEAP32[4380]|0;
          $$phi$trans$insert$i3 = ((($$pre$i2)) + 4|0);
          $$pre2$i4 = HEAP32[$$phi$trans$insert$i3>>2]|0;
          $45 = $$pre$i2;$47 = $$pre2$i4;
         } else {
          $45 = $38;$47 = $40;
         }
         $44 = ((($45)) + 4|0);
         $46 = (($47) + 1)|0;
         HEAP32[$44>>2] = $46;
         $48 = HEAP32[$45>>2]|0;
         $49 = (($48) + ($47)|0);
         HEAP8[$49>>0] = 43;
         (_GetByte()|0);
         $50 = HEAP8[20560]|0;
         $51 = ($50<<24>>24)==(43);
         if (!($51)) {
          break;
         }
        }
       }
       _symbol_fix_forward_anon_name(1);
       $52 = HEAP32[4380]|0;
       _DynaBuf_append($52,0);
       $53 = HEAP32[1337]|0;
       $54 = HEAP32[$53>>2]|0;
       _symbol_set_label($54,$33,0,0);
       $$6$ph = $33;
       label = 48;
       break L6;
      }
     }
     _Macro_parse_call();
     $$6$ph = $$0;
     label = 48;
     break;
    }
    case 33:  {
     _pseudoopcode_parse();
     $$6$ph = $$0;
     label = 48;
     break;
    }
    case 42:  {
     $55 = (_GetByte()|0);
     $56 = ($55<<24>>24)==(32);
     if ($56) {
      (_GetByte()|0);
     }
     $57 = HEAP8[20560]|0;
     $58 = ($57<<24>>24)==(61);
     if ($58) {
      (_GetByte()|0);
      _notreallypo_setpc();
      _Input_ensure_EOS();
      $$6$ph = $$0;
      label = 48;
      break L6;
     } else {
      _Throw_error(9931);
      _Input_skip_remainder();
      $$6$ph = $$0;
      label = 48;
      break L6;
     }
     break;
    }
    case 46:  {
     $59 = $$0 & 2;
     $60 = ($59|0)==(0);
     if (!($60)) {
      _Throw_error(9931);
      _Input_skip_remainder();
      $$6$ph = $$0;
      label = 48;
      break L6;
     }
     $61 = $$0 | 2;
     (_GetByte()|0);
     $62 = (_Input_read_keyword()|0);
     $63 = ($62|0)==(0);
     if ($63) {
      $$6$ph = $61;
      label = 48;
     } else {
      $64 = HEAP32[1337]|0;
      $65 = HEAP32[$64>>2]|0;
      _symbol_parse_definition($65,$61);
      $$6$ph = $61;
      label = 48;
     }
     break;
    }
    default: {
     $66 = $2&255;
     $67 = (9945 + ($66)|0);
     $68 = HEAP8[$67>>0]|0;
     $69 = ($68<<24>>24)<(0);
     if (!($69)) {
      _Throw_error(9931);
      _Input_skip_remainder();
      $$6$ph = $$0;
      label = 48;
      break L6;
     }
     $70 = HEAP32[4080]|0;
     $71 = HEAP32[$70>>2]|0;
     $72 = (_Input_read_keyword()|0);
     $73 = (FUNCTION_TABLE_ii[$71 & 15]($72)|0);
     $74 = ($73|0)==(0);
     if ($74) {
      $75 = $$0 & 2;
      $76 = ($75|0)==(0);
      if (!($76)) {
       _Throw_error(9931);
       _Input_skip_remainder();
       $$6$ph = $$0;
       label = 48;
       break L6;
      }
      $77 = $$0 | 2;
      $78 = HEAP32[4380]|0;
      $79 = HEAP32[$78>>2]|0;
      $80 = HEAP8[$79>>0]|0;
      $81 = ($80<<24>>24)==(-96);
      if ($81) {
       $$old$i = HEAP32[4388]|0;
       $$old2$i = ($$old$i|0)==(0);
       if ($$old2$i) {
        label = 43;
       }
      } else {
       $82 = ((($78)) + 4|0);
       $83 = HEAP32[$82>>2]|0;
       $84 = ($83|0)>(1);
       $85 = ($80<<24>>24)==(-62);
       $or$cond$i = $85 & $84;
       if ($or$cond$i) {
        $86 = ((($79)) + 1|0);
        $87 = HEAP8[$86>>0]|0;
        $88 = ($87<<24>>24)==(-96);
        $89 = HEAP32[4388]|0;
        $90 = ($89|0)==(0);
        $or$cond3$i = $88 & $90;
        if ($or$cond3$i) {
         label = 43;
        }
       }
      }
      do {
       if ((label|0) == 43) {
        label = 0;
        $91 = HEAP32[4391]|0;
        $92 = (($91) + 1)|0;
        HEAP32[4391] = $92;
        $93 = HEAP32[4386]|0;
        $94 = ($93|0)==(0);
        $95 = HEAP32[4385]|0;
        $96 = HEAP32[245]|0;
        $97 = HEAP32[$96>>2]|0;
        $98 = ((($96)) + 4|0);
        $99 = HEAP32[$98>>2]|0;
        $100 = HEAP32[1337]|0;
        $101 = ((($100)) + 4|0);
        $102 = HEAP32[$101>>2]|0;
        $103 = ((($100)) + 8|0);
        $104 = HEAP32[$103>>2]|0;
        if ($94) {
         HEAP32[$vararg_buffer6>>2] = 10275;
         $vararg_ptr9 = ((($vararg_buffer6)) + 4|0);
         HEAP32[$vararg_ptr9>>2] = $97;
         $vararg_ptr10 = ((($vararg_buffer6)) + 8|0);
         HEAP32[$vararg_ptr10>>2] = $99;
         $vararg_ptr11 = ((($vararg_buffer6)) + 12|0);
         HEAP32[$vararg_ptr11>>2] = $102;
         $vararg_ptr12 = ((($vararg_buffer6)) + 16|0);
         HEAP32[$vararg_ptr12>>2] = $104;
         $vararg_ptr13 = ((($vararg_buffer6)) + 20|0);
         HEAP32[$vararg_ptr13>>2] = 10283;
         (_fprintf($95,10240,$vararg_buffer6)|0);
         break;
        } else {
         HEAP32[$vararg_buffer>>2] = $97;
         $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
         HEAP32[$vararg_ptr1>>2] = $99;
         $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
         HEAP32[$vararg_ptr2>>2] = 10275;
         $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
         HEAP32[$vararg_ptr3>>2] = $102;
         $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
         HEAP32[$vararg_ptr4>>2] = $104;
         $vararg_ptr5 = ((($vararg_buffer)) + 20|0);
         HEAP32[$vararg_ptr5>>2] = 10283;
         (_fprintf($95,10215,$vararg_buffer)|0);
         break;
        }
       }
      } while(0);
      _symbol_parse_definition(0,$77);
      $$6$ph = $77;
      label = 48;
     } else {
      $$6$ph = $$0;
      label = 48;
     }
    }
    }
   } while(0);
   if ((label|0) == 6) {
    label = 0;
    (_GetByte()|0);
    $$6$ph = $$1;
    label = 48;
   }
   if ((label|0) == 48) {
    label = 0;
    $$pr = HEAP8[20560]|0;
    $$6 = $$6$ph;$105 = $$pr;
   }
   $106 = ($105<<24>>24)==(0);
   if ($106) {
    break;
   } else {
    $$0 = $$6;$2 = $105;
   }
  }
  _vcpu_end_statement();
  (_GetByte()|0);
 }
 STACKTOP = sp;return;
}
function _Throw_error($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0;
 var $vararg_buffer6 = 0, $vararg_ptr1 = 0, $vararg_ptr10 = 0, $vararg_ptr11 = 0, $vararg_ptr12 = 0, $vararg_ptr13 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, $vararg_ptr5 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer6 = sp + 24|0;
 $vararg_buffer = sp;
 $1 = HEAP32[4391]|0;
 $2 = (($1) + 1)|0;
 HEAP32[4391] = $2;
 $3 = HEAP32[4386]|0;
 $4 = ($3|0)==(0);
 $5 = HEAP32[4385]|0;
 $6 = HEAP32[245]|0;
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($6)) + 4|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = HEAP32[1337]|0;
 $11 = ((($10)) + 4|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($10)) + 8|0);
 $14 = HEAP32[$13>>2]|0;
 if ($4) {
  HEAP32[$vararg_buffer6>>2] = 10331;
  $vararg_ptr9 = ((($vararg_buffer6)) + 4|0);
  HEAP32[$vararg_ptr9>>2] = $7;
  $vararg_ptr10 = ((($vararg_buffer6)) + 8|0);
  HEAP32[$vararg_ptr10>>2] = $9;
  $vararg_ptr11 = ((($vararg_buffer6)) + 12|0);
  HEAP32[$vararg_ptr11>>2] = $12;
  $vararg_ptr12 = ((($vararg_buffer6)) + 16|0);
  HEAP32[$vararg_ptr12>>2] = $14;
  $vararg_ptr13 = ((($vararg_buffer6)) + 20|0);
  HEAP32[$vararg_ptr13>>2] = $0;
  (_fprintf($5,10240,$vararg_buffer6)|0);
 } else {
  HEAP32[$vararg_buffer>>2] = $7;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $9;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = 10331;
  $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
  HEAP32[$vararg_ptr3>>2] = $12;
  $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
  HEAP32[$vararg_ptr4>>2] = $14;
  $vararg_ptr5 = ((($vararg_buffer)) + 20|0);
  HEAP32[$vararg_ptr5>>2] = $0;
  (_fprintf($5,10215,$vararg_buffer)|0);
 }
 $15 = HEAP32[4389]|0;
 $16 = (($15) + 1)|0;
 HEAP32[4389] = $16;
 $17 = HEAP32[244]|0;
 $18 = ($16|0)<($17|0);
 if ($18) {
  STACKTOP = sp;return;
 } else {
  $19 = (_ACME_finalize(1)|0);
  _exit(($19|0));
  // unreachable;
 }
}
function _Parse_optional_block() {
 var $$0 = 0, $$pr = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[20560]|0;
 $1 = ($0<<24>>24)==(32);
 if ($1) {
  (_GetByte()|0);
  $$pr = HEAP8[20560]|0;
  $2 = $$pr;
 } else {
  $2 = $0;
 }
 $3 = ($2<<24>>24)==(123);
 if (!($3)) {
  $$0 = 0;
  return ($$0|0);
 }
 _Parse_until_eob_or_eof();
 $4 = HEAP8[20560]|0;
 $5 = ($4<<24>>24)==(125);
 if (!($5)) {
  _Throw_serious_error(9849);
  // unreachable;
 }
 (_GetByte()|0);
 $$0 = 1;
 return ($$0|0);
}
function _Throw_get_counter() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4391]|0;
 return ($0|0);
}
function _Throw_warning($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer6 = 0, $vararg_ptr1 = 0, $vararg_ptr10 = 0, $vararg_ptr11 = 0, $vararg_ptr12 = 0;
 var $vararg_ptr13 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, $vararg_ptr5 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer6 = sp + 24|0;
 $vararg_buffer = sp;
 $1 = HEAP32[4391]|0;
 $2 = (($1) + 1)|0;
 HEAP32[4391] = $2;
 $3 = HEAP32[4386]|0;
 $4 = ($3|0)==(0);
 $5 = HEAP32[4385]|0;
 $6 = HEAP32[245]|0;
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($6)) + 4|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = HEAP32[1337]|0;
 $11 = ((($10)) + 4|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ((($10)) + 8|0);
 $14 = HEAP32[$13>>2]|0;
 if ($4) {
  HEAP32[$vararg_buffer6>>2] = 10275;
  $vararg_ptr9 = ((($vararg_buffer6)) + 4|0);
  HEAP32[$vararg_ptr9>>2] = $7;
  $vararg_ptr10 = ((($vararg_buffer6)) + 8|0);
  HEAP32[$vararg_ptr10>>2] = $9;
  $vararg_ptr11 = ((($vararg_buffer6)) + 12|0);
  HEAP32[$vararg_ptr11>>2] = $12;
  $vararg_ptr12 = ((($vararg_buffer6)) + 16|0);
  HEAP32[$vararg_ptr12>>2] = $14;
  $vararg_ptr13 = ((($vararg_buffer6)) + 20|0);
  HEAP32[$vararg_ptr13>>2] = $0;
  (_fprintf($5,10240,$vararg_buffer6)|0);
  STACKTOP = sp;return;
 } else {
  HEAP32[$vararg_buffer>>2] = $7;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $9;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = 10275;
  $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
  HEAP32[$vararg_ptr3>>2] = $12;
  $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
  HEAP32[$vararg_ptr4>>2] = $14;
  $vararg_ptr5 = ((($vararg_buffer)) + 20|0);
  HEAP32[$vararg_ptr5>>2] = $0;
  (_fprintf($5,10215,$vararg_buffer)|0);
  STACKTOP = sp;return;
 }
}
function _Throw_first_pass_warning($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer6 = 0, $vararg_ptr1 = 0, $vararg_ptr10 = 0;
 var $vararg_ptr11 = 0, $vararg_ptr12 = 0, $vararg_ptr13 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, $vararg_ptr5 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer6 = sp + 24|0;
 $vararg_buffer = sp;
 $1 = HEAP32[4388]|0;
 $2 = ($1|0)==(0);
 if (!($2)) {
  STACKTOP = sp;return;
 }
 $3 = HEAP32[4391]|0;
 $4 = (($3) + 1)|0;
 HEAP32[4391] = $4;
 $5 = HEAP32[4386]|0;
 $6 = ($5|0)==(0);
 $7 = HEAP32[4385]|0;
 $8 = HEAP32[245]|0;
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($8)) + 4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = HEAP32[1337]|0;
 $13 = ((($12)) + 4|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($12)) + 8|0);
 $16 = HEAP32[$15>>2]|0;
 if ($6) {
  HEAP32[$vararg_buffer6>>2] = 10275;
  $vararg_ptr9 = ((($vararg_buffer6)) + 4|0);
  HEAP32[$vararg_ptr9>>2] = $9;
  $vararg_ptr10 = ((($vararg_buffer6)) + 8|0);
  HEAP32[$vararg_ptr10>>2] = $11;
  $vararg_ptr11 = ((($vararg_buffer6)) + 12|0);
  HEAP32[$vararg_ptr11>>2] = $14;
  $vararg_ptr12 = ((($vararg_buffer6)) + 16|0);
  HEAP32[$vararg_ptr12>>2] = $16;
  $vararg_ptr13 = ((($vararg_buffer6)) + 20|0);
  HEAP32[$vararg_ptr13>>2] = $0;
  (_fprintf($7,10240,$vararg_buffer6)|0);
  STACKTOP = sp;return;
 } else {
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $11;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = 10275;
  $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
  HEAP32[$vararg_ptr3>>2] = $14;
  $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
  HEAP32[$vararg_ptr4>>2] = $16;
  $vararg_ptr5 = ((($vararg_buffer)) + 20|0);
  HEAP32[$vararg_ptr5>>2] = $0;
  (_fprintf($7,10215,$vararg_buffer)|0);
  STACKTOP = sp;return;
 }
}
function _Bug_found($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 _Throw_warning(10337);
 $2 = HEAP32[1342]|0;
 HEAP32[$vararg_buffer>>2] = $1;
 (_fprintf($2,10363,$vararg_buffer)|0);
 _Throw_serious_error($0);
 // unreachable;
}
function _Input_new_file($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[245]|0;
 HEAP32[$2>>2] = $0;
 $3 = HEAP32[245]|0;
 $4 = ((($3)) + 4|0);
 HEAP32[$4>>2] = 1;
 $5 = ((($3)) + 8|0);
 HEAP32[$5>>2] = 0;
 $6 = ((($3)) + 12|0);
 HEAP32[$6>>2] = 0;
 $7 = ((($3)) + 16|0);
 HEAP32[$7>>2] = $1;
 return;
}
function _GetByte() {
 var $$0$ph$i = 0, $$1$i = 0, $$pre$i = 0, $$pre51 = 0, $$pre67$i = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $storemerge = 0, $storemerge$ph = 0, $storemerge3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[245]|0;
 $1 = ((($0)) + 8|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $$0$ph$i = 0;$9 = $0;
   L2: while(1) {
    $8 = ((($9)) + 12|0);
    $10 = HEAP32[$8>>2]|0;
    switch ($10|0) {
    case 0:  {
     label = 4;
     break L2;
     break;
    }
    case 1:  {
     $$1$i = $$0$ph$i;
     label = 6;
     break L2;
     break;
    }
    case 3:  {
     label = 35;
     break L2;
     break;
    }
    case 4:  {
     $storemerge3 = 5;
     label = 36;
     break L2;
     break;
    }
    case 7:  {
     label = 31;
     break L2;
     break;
    }
    case 8:  {
     label = 32;
     break L2;
     break;
    }
    case 2:  {
     $27 = $9;
     L5: while(1) {
      $26 = ((($27)) + 16|0);
      $28 = HEAP32[$26>>2]|0;
      $29 = (_getc($28)|0);
      $30 = HEAP32[4099]|0;
      $31 = ($30|0)==(0|0);
      if (!($31)) {
       $32 = $29&255;
       _report_srcchar($32);
      }
      switch ($29|0) {
      case 9: case 32:  {
       break;
      }
      default: {
       break L5;
      }
      }
      $$pre67$i = HEAP32[245]|0;
      $27 = $$pre67$i;
     }
     $33 = HEAP32[245]|0;
     $34 = ((($33)) + 12|0);
     HEAP32[$34>>2] = 1;
     $$0$ph$i = $29;$9 = $33;
     continue L2;
     break;
    }
    case 5:  {
     $35 = ((($9)) + 16|0);
     $36 = HEAP32[$35>>2]|0;
     $37 = (_getc($36)|0);
     $38 = HEAP32[4099]|0;
     $39 = ($38|0)==(0|0);
     if (!($39)) {
      $40 = $37&255;
      _report_srcchar($40);
     }
     $41 = ($37|0)==(10);
     $42 = HEAP32[245]|0;
     $43 = ((($42)) + 12|0);
     if ($41) {
      HEAP32[$43>>2] = 0;
      $$0$ph$i = 10;$9 = $42;
      continue L2;
     } else {
      HEAP32[$43>>2] = 1;
      $$0$ph$i = $37;$9 = $42;
      continue L2;
     }
     break;
    }
    case 6:  {
     $45 = $9;
     L19: while(1) {
      $44 = ((($45)) + 16|0);
      $46 = HEAP32[$44>>2]|0;
      $47 = (_getc($46)|0);
      $48 = HEAP32[4099]|0;
      $49 = ($48|0)==(0|0);
      if (!($49)) {
       $50 = $47&255;
       _report_srcchar($50);
      }
      switch ($47|0) {
      case 10: case 13: case -1:  {
       break L19;
       break;
      }
      default: {
      }
      }
      $$pre$i = HEAP32[245]|0;
      $45 = $$pre$i;
     }
     $51 = HEAP32[245]|0;
     $52 = ((($51)) + 12|0);
     HEAP32[$52>>2] = 1;
     $$0$ph$i = $47;$9 = $51;
     continue L2;
     break;
    }
    default: {
     label = 33;
     break L2;
    }
    }
   }
   if ((label|0) == 4) {
    $11 = ((($9)) + 16|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = (_getc($12)|0);
    $14 = HEAP32[4099]|0;
    $15 = ($14|0)==(0|0);
    if ($15) {
     $$1$i = $13;
     label = 6;
    } else {
     $16 = $13&255;
     _report_srcchar($16);
     $$1$i = $13;
     label = 6;
    }
   }
   else if ((label|0) == 31) {
    HEAP32[$8>>2] = 0;
    $storemerge$ph = 125;
   }
   else if ((label|0) == 32) {
    HEAP32[$8>>2] = 0;
    $storemerge$ph = 13;
   }
   else if ((label|0) == 33) {
    _Bug_found(10421,$10);
    // unreachable;
   }
   else if ((label|0) == 35) {
    $storemerge3 = 0;
    label = 36;
   }
   if ((label|0) == 36) {
    HEAP32[$8>>2] = $storemerge3;
    HEAP8[20560] = 10;
    $55 = $9;
    break;
   }
   L35: do {
    if ((label|0) == 6) {
     $17 = HEAP32[245]|0;
     $18 = ((($17)) + 12|0);
     HEAP32[$18>>2] = 0;
     $19 = ($$1$i|0)==(-1);
     if ($19) {
      HEAP32[$18>>2] = 8;
      $storemerge$ph = 0;
      break;
     }
     $20 = $$1$i&255;
     $21 = $$1$i & 255;
     $22 = (9945 + ($21)|0);
     $23 = HEAP8[$22>>0]|0;
     $24 = $23 & 16;
     $25 = ($24<<24>>24)==(0);
     if ($25) {
      $storemerge = $20;
      label = 37;
      break L1;
     }
     switch ($$1$i|0) {
     case 58:  {
      $storemerge$ph = 0;
      break L35;
      break;
     }
     case 32: case 9:  {
      HEAP32[$18>>2] = 2;
      $storemerge$ph = 32;
      break L35;
      break;
     }
     case 10:  {
      HEAP32[$18>>2] = 3;
      $storemerge$ph = 0;
      break L35;
      break;
     }
     case 13:  {
      HEAP32[$18>>2] = 4;
      $storemerge$ph = 0;
      break L35;
      break;
     }
     case 125:  {
      HEAP32[$18>>2] = 7;
      $storemerge$ph = 0;
      break L35;
      break;
     }
     case 59:  {
      HEAP32[$18>>2] = 6;
      $storemerge$ph = 0;
      break L35;
      break;
     }
     default: {
      _Throw_error(10381);
      $storemerge = $20;
      label = 37;
      break L1;
     }
     }
    }
   } while(0);
   HEAP8[20560] = $storemerge$ph;
   $58 = $storemerge$ph;
   return ($58|0);
  } else {
   $4 = ((($0)) + 16|0);
   $5 = HEAP32[$4>>2]|0;
   $6 = ((($5)) + 1|0);
   HEAP32[$4>>2] = $6;
   $7 = HEAP8[$5>>0]|0;
   $storemerge = $7;
   label = 37;
  }
 } while(0);
 do {
  if ((label|0) == 37) {
   HEAP8[20560] = $storemerge;
   $53 = ($storemerge<<24>>24)==(10);
   if ($53) {
    $$pre51 = HEAP32[245]|0;
    $55 = $$pre51;
    break;
   } else {
    $58 = $storemerge;
    return ($58|0);
   }
  }
 } while(0);
 $54 = ((($55)) + 4|0);
 $56 = HEAP32[$54>>2]|0;
 $57 = (($56) + 1)|0;
 HEAP32[$54>>2] = $57;
 $58 = 10;
 return ($58|0);
}
function _report_srcchar($0) {
 $0 = $0|0;
 var $$09 = 0, $$pr = 0, $$pre = 0, $$pre11 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, $phitmp12 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer10 = 0, $vararg_buffer14 = 0, $vararg_buffer4 = 0, $vararg_buffer7 = 0, $vararg_ptr13 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $vararg_buffer14 = sp + 40|0;
 $vararg_buffer10 = sp + 32|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer4 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 64|0;
 $2 = sp + 44|0;
 $3 = HEAP32[245]|0;
 $4 = HEAP32[4387]|0;
 $5 = HEAP32[(16400)>>2]|0;
 $6 = ($3|0)==($5|0);
 if ($6) {
  $$pr = HEAP8[20561]|0;
  $11 = ($$pr<<24>>24)==(10);
  if ($11) {
   $12 = HEAP32[4099]|0;
   $13 = ((($3)) + 4|0);
   $14 = HEAP32[$13>>2]|0;
   $15 = (($14) + -1)|0;
   HEAP32[$vararg_buffer1>>2] = $15;
   (_fprintf($12,10462,$vararg_buffer1)|0);
   $16 = HEAP32[4387]|0;
   $17 = HEAP32[(16408)>>2]|0;
   $18 = ($17|0)==(0);
   if ($18) {
    HEAP8[$1>>0] = 0;
    HEAP8[$2>>0] = 0;
    $32 = $16;
   } else {
    $19 = HEAP32[(16412)>>2]|0;
    HEAP32[$vararg_buffer4>>2] = $19;
    (_snprintf($1,9,10468,$vararg_buffer4)|0);
    $$pre = HEAP32[4387]|0;
    $$pre11 = HEAP32[(16408)>>2]|0;
    $phitmp = ($$pre11|0)==(0);
    HEAP8[$2>>0] = 0;
    if ($phitmp) {
     $32 = $$pre;
    } else {
     $$09 = 0;$23 = $$pre;
     while(1) {
      $20 = $$09 << 1;
      $21 = (($2) + ($20)|0);
      $22 = (((($23)) + 1044|0) + ($$09)|0);
      $24 = HEAP8[$22>>0]|0;
      $25 = $24&255;
      HEAP32[$vararg_buffer7>>2] = $25;
      (_sprintf($21,10473,$vararg_buffer7)|0);
      $26 = (($$09) + 1)|0;
      $27 = HEAP32[4387]|0;
      $28 = HEAP32[(16408)>>2]|0;
      $29 = ($26>>>0)<($28>>>0);
      if ($29) {
       $$09 = $26;$23 = $27;
      } else {
       break;
      }
     }
     $phitmp12 = ($28|0)==(9);
     if ($phitmp12) {
      $30 = ((($2)) + 16|0);
      HEAP8[$30>>0]=3026478&255;HEAP8[$30+1>>0]=(3026478>>8)&255;HEAP8[$30+2>>0]=(3026478>>16)&255;HEAP8[$30+3>>0]=3026478>>24;
      $32 = $27;
     } else {
      $32 = $27;
     }
    }
   }
   $31 = HEAP32[$32>>2]|0;
   HEAP32[$vararg_buffer10>>2] = $1;
   $vararg_ptr13 = ((($vararg_buffer10)) + 4|0);
   HEAP32[$vararg_ptr13>>2] = $2;
   (_fprintf($31,10478,$vararg_buffer10)|0);
   $33 = HEAP32[4387]|0;
   $34 = HEAP32[(16404)>>2]|0;
   $35 = ($34|0)==(1024);
   if ($35) {
    HEAP32[(16404)>>2] = 1023;
    $37 = 1023;
   } else {
    $37 = $34;
   }
   $36 = (((($33)) + 20|0) + ($37)|0);
   HEAP8[$36>>0] = 0;
   $38 = HEAP32[4099]|0;
   $39 = ((($33)) + 20|0);
   HEAP32[$vararg_buffer14>>2] = $39;
   (_fprintf($38,10489,$vararg_buffer14)|0);
   $40 = HEAP32[4387]|0;
   HEAP32[(16404)>>2] = 0;
   HEAP32[(16408)>>2] = 0;
   $42 = $40;
  } else {
   $42 = $4;
  }
 } else {
  $7 = HEAP32[4099]|0;
  $8 = HEAP32[$3>>2]|0;
  HEAP32[$vararg_buffer>>2] = $8;
  (_fprintf($7,10438,$vararg_buffer)|0);
  $9 = HEAP32[245]|0;
  $10 = HEAP32[4387]|0;
  HEAP32[(16400)>>2] = $9;
  HEAP32[(16404)>>2] = 0;
  HEAP8[20561] = 0;
  $42 = $10;
 }
 switch ($0<<24>>24) {
 case 13: case 10:  {
  HEAP8[20561] = $0;
  STACKTOP = sp;return;
  break;
 }
 default: {
 }
 }
 $41 = ((($42)) + 8|0);
 $43 = HEAP32[$41>>2]|0;
 $44 = ($43>>>0)<(1024);
 if (!($44)) {
  HEAP8[20561] = $0;
  STACKTOP = sp;return;
 }
 $45 = (($43) + 1)|0;
 HEAP32[$41>>2] = $45;
 $46 = (((($42)) + 20|0) + ($43)|0);
 HEAP8[$46>>0] = $0;
 HEAP8[20561] = $0;
 STACKTOP = sp;return;
}
function _GetQuotedByte() {
 var $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $storemerge = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[245]|0;
 $1 = ((($0)) + 8|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0);
 $4 = ((($0)) + 16|0);
 L1: do {
  if ($3) {
   $8 = HEAP32[$4>>2]|0;
   $9 = (_getc($8)|0);
   $10 = HEAP32[4099]|0;
   $11 = ($10|0)==(0|0);
   if (!($11)) {
    $12 = $9&255;
    _report_srcchar($12);
   }
   switch ($9|0) {
   case -1:  {
    $13 = HEAP32[245]|0;
    $14 = ((($13)) + 12|0);
    HEAP32[$14>>2] = 8;
    HEAP8[20560] = 0;
    break L1;
    break;
   }
   case 10:  {
    $15 = HEAP32[245]|0;
    $16 = ((($15)) + 12|0);
    HEAP32[$16>>2] = 3;
    HEAP8[20560] = 0;
    break L1;
    break;
   }
   case 13:  {
    $17 = HEAP32[245]|0;
    $18 = ((($17)) + 12|0);
    HEAP32[$18>>2] = 4;
    HEAP8[20560] = 0;
    break L1;
    break;
   }
   default: {
    $19 = $9&255;
    $storemerge = $19;
    label = 10;
    break L1;
   }
   }
  } else {
   $5 = HEAP32[$4>>2]|0;
   $6 = ((($5)) + 1|0);
   HEAP32[$4>>2] = $6;
   $7 = HEAP8[$5>>0]|0;
   $storemerge = $7;
   label = 10;
  }
 } while(0);
 if ((label|0) == 10) {
  HEAP8[20560] = $storemerge;
  $20 = ($storemerge<<24>>24)==(0);
  if (!($20)) {
   $21 = $storemerge;
   return ($21|0);
  }
 }
 _Throw_error(10493);
 $$pre = HEAP8[20560]|0;
 $21 = $$pre;
 return ($21|0);
}
function _Input_skip_remainder() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[20560]|0;
 $1 = ($0<<24>>24)==(0);
 if ($1) {
  return;
 }
 while(1) {
  (_GetByte()|0);
  $2 = HEAP8[20560]|0;
  $3 = ($2<<24>>24)==(0);
  if ($3) {
   break;
  }
 }
 return;
}
function _Input_ensure_EOS() {
 var $$pr = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[20560]|0;
 $1 = ($0<<24>>24)==(32);
 if ($1) {
  (_GetByte()|0);
  $$pr = HEAP8[20560]|0;
  $2 = $$pr;
 } else {
  $2 = $0;
 }
 $3 = ($2<<24>>24)==(0);
 if ($3) {
  return;
 }
 _Throw_error(10527);
 $4 = HEAP8[20560]|0;
 $5 = ($4<<24>>24)==(0);
 if ($5) {
  return;
 }
 while(1) {
  (_GetByte()|0);
  $6 = HEAP8[20560]|0;
  $7 = ($6<<24>>24)==(0);
  if ($7) {
   break;
  }
 }
 return;
}
function _Input_skip_or_store_block($0) {
 $0 = $0|0;
 var $$0$ph = 0, $$010 = 0, $$1 = 0, $$phi$trans$insert = 0, $$phi$trans$insert36 = 0, $$pre = 0, $$pre33 = 0, $$pre34 = 0, $$pre35 = 0, $$pre37 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0;
 var $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $9 = 0, $or$cond = 0, $or$cond$us = 0;
 var $storemerge$i = 0, $storemerge$i$us = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[4380]|0;
 $2 = ((($1)) + 4|0);
 HEAP32[$2>>2] = 0;
 $3 = ($0|0)!=(0);
 $$0$ph = 1;
 L1: while(1) {
  L3: do {
   if ($3) {
    while(1) {
     $4 = (_GetByte()|0);
     $5 = HEAP32[4380]|0;
     $6 = ((($5)) + 4|0);
     $7 = HEAP32[$6>>2]|0;
     $8 = ((($5)) + 8|0);
     $9 = HEAP32[$8>>2]|0;
     $10 = ($7|0)==($9|0);
     if ($10) {
      _DynaBuf_enlarge($5);
      $$pre = HEAP32[4380]|0;
      $$phi$trans$insert = ((($$pre)) + 4|0);
      $$pre33 = HEAP32[$$phi$trans$insert>>2]|0;
      $12 = $$pre;$14 = $$pre33;
     } else {
      $12 = $5;$14 = $7;
     }
     $11 = ((($12)) + 4|0);
     $13 = (($14) + 1)|0;
     HEAP32[$11>>2] = $13;
     $15 = HEAP32[$12>>2]|0;
     $16 = (($15) + ($14)|0);
     HEAP8[$16>>0] = $4;
     $17 = $4 << 24 >> 24;
     switch ($17|0) {
     case 13:  {
      label = 7;
      break L1;
      break;
     }
     case 39: case 34:  {
      $57 = $4;
      label = 8;
      break L3;
      break;
     }
     case 123:  {
      label = 35;
      break L3;
      break;
     }
     case 125:  {
      label = 36;
      break L3;
      break;
     }
     default: {
     }
     }
    }
   } else {
    while(1) {
     $18 = (_GetByte()|0);
     $19 = $18 << 24 >> 24;
     switch ($19|0) {
     case 13:  {
      label = 7;
      break L1;
      break;
     }
     case 39: case 34:  {
      $57 = $18;
      label = 8;
      break L3;
      break;
     }
     case 123:  {
      label = 35;
      break L3;
      break;
     }
     case 125:  {
      label = 36;
      break L3;
      break;
     }
     default: {
     }
     }
    }
   }
  } while(0);
  L11: do {
   if ((label|0) == 8) {
    label = 0;
    if (!($3)) {
     while(1) {
      $58 = HEAP32[245]|0;
      $59 = ((($58)) + 8|0);
      $60 = HEAP32[$59>>2]|0;
      $61 = ($60|0)==(0);
      $62 = ((($58)) + 16|0);
      L16: do {
       if ($61) {
        $66 = HEAP32[$62>>2]|0;
        $67 = (_getc($66)|0);
        $68 = HEAP32[4099]|0;
        $69 = ($68|0)==(0|0);
        if (!($69)) {
         $70 = $67&255;
         _report_srcchar($70);
        }
        switch ($67|0) {
        case -1:  {
         $71 = HEAP32[245]|0;
         $72 = ((($71)) + 12|0);
         HEAP32[$72>>2] = 8;
         HEAP8[20560] = 0;
         label = 33;
         break L16;
         break;
        }
        case 10:  {
         $73 = HEAP32[245]|0;
         $74 = ((($73)) + 12|0);
         HEAP32[$74>>2] = 3;
         HEAP8[20560] = 0;
         label = 33;
         break L16;
         break;
        }
        case 13:  {
         $75 = HEAP32[245]|0;
         $76 = ((($75)) + 12|0);
         HEAP32[$76>>2] = 4;
         HEAP8[20560] = 0;
         label = 33;
         break L16;
         break;
        }
        default: {
         $77 = $67&255;
         $storemerge$i = $77;
         label = 32;
         break L16;
        }
        }
       } else {
        $63 = HEAP32[$62>>2]|0;
        $64 = ((($63)) + 1|0);
        HEAP32[$62>>2] = $64;
        $65 = HEAP8[$63>>0]|0;
        $storemerge$i = $65;
        label = 32;
       }
      } while(0);
      if ((label|0) == 32) {
       label = 0;
       HEAP8[20560] = $storemerge$i;
       $78 = ($storemerge$i<<24>>24)==(0);
       if ($78) {
        label = 33;
       } else {
        $79 = $storemerge$i;
       }
      }
      if ((label|0) == 33) {
       label = 0;
       _Throw_error(10493);
       $$pre34 = HEAP8[20560]|0;
       $79 = $$pre34;
      }
      $80 = ($79<<24>>24)==(0);
      $81 = ($79<<24>>24)==($57<<24>>24);
      $or$cond = $80 | $81;
      if ($or$cond) {
       $$1 = $$0$ph;
       break L11;
      }
     }
    }
    while(1) {
     $20 = HEAP32[245]|0;
     $21 = ((($20)) + 8|0);
     $22 = HEAP32[$21>>2]|0;
     $23 = ($22|0)==(0);
     $24 = ((($20)) + 16|0);
     L34: do {
      if ($23) {
       $28 = HEAP32[$24>>2]|0;
       $29 = (_getc($28)|0);
       $30 = HEAP32[4099]|0;
       $31 = ($30|0)==(0|0);
       if (!($31)) {
        $32 = $29&255;
        _report_srcchar($32);
       }
       switch ($29|0) {
       case -1:  {
        $37 = HEAP32[245]|0;
        $38 = ((($37)) + 12|0);
        HEAP32[$38>>2] = 8;
        HEAP8[20560] = 0;
        label = 19;
        break L34;
        break;
       }
       case 10:  {
        $35 = HEAP32[245]|0;
        $36 = ((($35)) + 12|0);
        HEAP32[$36>>2] = 3;
        HEAP8[20560] = 0;
        label = 19;
        break L34;
        break;
       }
       case 13:  {
        $33 = HEAP32[245]|0;
        $34 = ((($33)) + 12|0);
        HEAP32[$34>>2] = 4;
        HEAP8[20560] = 0;
        label = 19;
        break L34;
        break;
       }
       default: {
        $39 = $29&255;
        $storemerge$i$us = $39;
        label = 18;
        break L34;
       }
       }
      } else {
       $25 = HEAP32[$24>>2]|0;
       $26 = ((($25)) + 1|0);
       HEAP32[$24>>2] = $26;
       $27 = HEAP8[$25>>0]|0;
       $storemerge$i$us = $27;
       label = 18;
      }
     } while(0);
     if ((label|0) == 18) {
      label = 0;
      HEAP8[20560] = $storemerge$i$us;
      $40 = ($storemerge$i$us<<24>>24)==(0);
      if ($40) {
       label = 19;
      }
     }
     if ((label|0) == 19) {
      label = 0;
      _Throw_error(10493);
     }
     $41 = HEAP32[4380]|0;
     $42 = ((($41)) + 4|0);
     $43 = HEAP32[$42>>2]|0;
     $44 = ((($41)) + 8|0);
     $45 = HEAP32[$44>>2]|0;
     $46 = ($43|0)==($45|0);
     if ($46) {
      _DynaBuf_enlarge($41);
      $$pre35 = HEAP32[4380]|0;
      $$phi$trans$insert36 = ((($$pre35)) + 4|0);
      $$pre37 = HEAP32[$$phi$trans$insert36>>2]|0;
      $49 = $$pre35;$51 = $$pre37;
     } else {
      $49 = $41;$51 = $43;
     }
     $47 = HEAP8[20560]|0;
     $48 = ((($49)) + 4|0);
     $50 = (($51) + 1)|0;
     HEAP32[$48>>2] = $50;
     $52 = HEAP32[$49>>2]|0;
     $53 = (($52) + ($51)|0);
     HEAP8[$53>>0] = $47;
     $54 = HEAP8[20560]|0;
     $55 = ($54<<24>>24)==(0);
     $56 = ($54<<24>>24)==($57<<24>>24);
     $or$cond$us = $55 | $56;
     if ($or$cond$us) {
      $$1 = $$0$ph;
      break;
     }
    }
   }
   else if ((label|0) == 35) {
    label = 0;
    $82 = (($$0$ph) + 1)|0;
    $$1 = $82;
   }
   else if ((label|0) == 36) {
    label = 0;
    $83 = (($$0$ph) + -1)|0;
    $$1 = $83;
   }
  } while(0);
  $84 = ($$1|0)==(0);
  if ($84) {
   label = 38;
   break;
  } else {
   $$0$ph = $$1;
  }
 }
 if ((label|0) == 7) {
  _Throw_serious_error(9849);
  // unreachable;
 }
 else if ((label|0) == 38) {
  if (!($3)) {
   $$010 = 0;
   return ($$010|0);
  }
  $85 = HEAP32[4380]|0;
  _DynaBuf_append($85,0);
  $86 = HEAP32[4380]|0;
  _DynaBuf_append($86,13);
  $87 = HEAP32[4380]|0;
  $88 = (_DynaBuf_get_copy($87)|0);
  $$010 = $88;
  return ($$010|0);
 }
 return (0)|0;
}
function _Input_until_terminator($0) {
 $0 = $0|0;
 var $$010 = 0, $$phi$trans$insert = 0, $$phi$trans$insert13 = 0, $$pre = 0, $$pre11 = 0, $$pre12 = 0, $$pre14 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $or$cond = 0, $or$cond8 = 0, $or$cond9 = 0, $storemerge$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[20560]|0;
 $2 = ($1<<24>>24)==($0<<24>>24);
 $3 = ($1<<24>>24)==(0);
 $or$cond9 = $2 | $3;
 if ($or$cond9) {
  return;
 } else {
  $$010 = $1;
 }
 L3: while(1) {
  $4 = HEAP32[4380]|0;
  $5 = ((($4)) + 4|0);
  $6 = HEAP32[$5>>2]|0;
  $7 = ((($4)) + 8|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = ($6|0)==($8|0);
  if ($9) {
   _DynaBuf_enlarge($4);
   $$pre = HEAP32[4380]|0;
   $$phi$trans$insert = ((($$pre)) + 4|0);
   $$pre11 = HEAP32[$$phi$trans$insert>>2]|0;
   $11 = $$pre;$13 = $$pre11;
  } else {
   $11 = $4;$13 = $6;
  }
  $10 = ((($11)) + 4|0);
  $12 = (($13) + 1)|0;
  HEAP32[$10>>2] = $12;
  $14 = HEAP32[$11>>2]|0;
  $15 = (($14) + ($13)|0);
  HEAP8[$15>>0] = $$010;
  switch ($$010<<24>>24) {
  case 39: case 34:  {
   while(1) {
    $16 = HEAP32[245]|0;
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ($18|0)==(0);
    $20 = ((($16)) + 16|0);
    L11: do {
     if ($19) {
      $24 = HEAP32[$20>>2]|0;
      $25 = (_getc($24)|0);
      $26 = HEAP32[4099]|0;
      $27 = ($26|0)==(0|0);
      if (!($27)) {
       $28 = $25&255;
       _report_srcchar($28);
      }
      switch ($25|0) {
      case -1:  {
       $29 = HEAP32[245]|0;
       $30 = ((($29)) + 12|0);
       HEAP32[$30>>2] = 8;
       HEAP8[20560] = 0;
       label = 15;
       break L11;
       break;
      }
      case 10:  {
       $31 = HEAP32[245]|0;
       $32 = ((($31)) + 12|0);
       HEAP32[$32>>2] = 3;
       HEAP8[20560] = 0;
       label = 15;
       break L11;
       break;
      }
      case 13:  {
       $33 = HEAP32[245]|0;
       $34 = ((($33)) + 12|0);
       HEAP32[$34>>2] = 4;
       HEAP8[20560] = 0;
       label = 15;
       break L11;
       break;
      }
      default: {
       $35 = $25&255;
       $storemerge$i = $35;
       label = 14;
       break L11;
      }
      }
     } else {
      $21 = HEAP32[$20>>2]|0;
      $22 = ((($21)) + 1|0);
      HEAP32[$20>>2] = $22;
      $23 = HEAP8[$21>>0]|0;
      $storemerge$i = $23;
      label = 14;
     }
    } while(0);
    if ((label|0) == 14) {
     label = 0;
     HEAP8[20560] = $storemerge$i;
     $36 = ($storemerge$i<<24>>24)==(0);
     if ($36) {
      label = 15;
     }
    }
    if ((label|0) == 15) {
     label = 0;
     _Throw_error(10493);
    }
    $37 = HEAP32[4380]|0;
    $38 = ((($37)) + 4|0);
    $39 = HEAP32[$38>>2]|0;
    $40 = ((($37)) + 8|0);
    $41 = HEAP32[$40>>2]|0;
    $42 = ($39|0)==($41|0);
    if ($42) {
     _DynaBuf_enlarge($37);
     $$pre12 = HEAP32[4380]|0;
     $$phi$trans$insert13 = ((($$pre12)) + 4|0);
     $$pre14 = HEAP32[$$phi$trans$insert13>>2]|0;
     $45 = $$pre12;$47 = $$pre14;
    } else {
     $45 = $37;$47 = $39;
    }
    $43 = HEAP8[20560]|0;
    $44 = ((($45)) + 4|0);
    $46 = (($47) + 1)|0;
    HEAP32[$44>>2] = $46;
    $48 = HEAP32[$45>>2]|0;
    $49 = (($48) + ($47)|0);
    HEAP8[$49>>0] = $43;
    $50 = HEAP8[20560]|0;
    $51 = ($50<<24>>24)==(0);
    $52 = ($50<<24>>24)==($$010<<24>>24);
    $or$cond8 = $51 | $52;
    if ($or$cond8) {
     break;
    }
   }
   if (!($52)) {
    label = 21;
    break L3;
   }
   break;
  }
  default: {
  }
  }
  $53 = (_GetByte()|0);
  $54 = ($53<<24>>24)==($0<<24>>24);
  $55 = ($53<<24>>24)==(0);
  $or$cond = $54 | $55;
  if ($or$cond) {
   label = 21;
   break;
  } else {
   $$010 = $53;
  }
 }
 if ((label|0) == 21) {
  return;
 }
}
function _Input_append_keyword_to_global_dynabuf() {
 var $$0$lcssa7 = 0, $$04 = 0, $$phi$trans$insert = 0, $$pre = 0, $$pre5 = 0, $$pre6 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[20560]|0;
 $1 = $0&255;
 $2 = (9945 + ($1)|0);
 $3 = HEAP8[$2>>0]|0;
 $4 = $3 & 64;
 $5 = ($4<<24>>24)==(0);
 if ($5) {
  _Throw_error(9804);
  $$0$lcssa7 = 0;
  return ($$0$lcssa7|0);
 } else {
  $$04 = 0;$26 = $0;
 }
 while(1) {
  $6 = HEAP32[4380]|0;
  $7 = ((($6)) + 4|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = ((($6)) + 8|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($8|0)==($10|0);
  if ($11) {
   _DynaBuf_enlarge($6);
   $$pre = HEAP8[20560]|0;
   $$pre5 = HEAP32[4380]|0;
   $$phi$trans$insert = ((($$pre5)) + 4|0);
   $$pre6 = HEAP32[$$phi$trans$insert>>2]|0;
   $13 = $$pre5;$15 = $$pre6;$18 = $$pre;
  } else {
   $13 = $6;$15 = $8;$18 = $26;
  }
  $12 = ((($13)) + 4|0);
  $14 = (($15) + 1)|0;
  HEAP32[$12>>2] = $14;
  $16 = HEAP32[$13>>2]|0;
  $17 = (($16) + ($15)|0);
  HEAP8[$17>>0] = $18;
  $19 = (($$04) + 1)|0;
  (_GetByte()|0);
  $20 = HEAP8[20560]|0;
  $21 = $20&255;
  $22 = (9945 + ($21)|0);
  $23 = HEAP8[$22>>0]|0;
  $24 = $23 & 64;
  $25 = ($24<<24>>24)==(0);
  if ($25) {
   $$0$lcssa7 = $19;
   break;
  } else {
   $$04 = $19;$26 = $20;
  }
 }
 return ($$0$lcssa7|0);
}
function _Input_read_scope_and_keyword($0) {
 $0 = $0|0;
 var $$pr = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $storemerge = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[20560]|0;
 $2 = ($1<<24>>24)==(32);
 if ($2) {
  (_GetByte()|0);
  $$pr = HEAP8[20560]|0;
  $3 = $$pr;
 } else {
  $3 = $1;
 }
 $4 = ($3<<24>>24)==(46);
 if ($4) {
  (_GetByte()|0);
  $5 = HEAP32[1337]|0;
  $6 = HEAP32[$5>>2]|0;
  $storemerge = $6;
 } else {
  $storemerge = 0;
 }
 HEAP32[$0>>2] = $storemerge;
 $7 = (_Input_read_keyword()|0);
 return ($7|0);
}
function _Input_read_keyword() {
 var $$0$lcssa7$i = 0, $$04$i = 0, $$phi$trans$insert = 0, $$phi$trans$insert$i = 0, $$pre = 0, $$pre$i = 0, $$pre2 = 0, $$pre5$i = 0, $$pre6$i = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4380]|0;
 $1 = ((($0)) + 4|0);
 HEAP32[$1>>2] = 0;
 $2 = HEAP8[20560]|0;
 $3 = $2&255;
 $4 = (9945 + ($3)|0);
 $5 = HEAP8[$4>>0]|0;
 $6 = $5 & 64;
 $7 = ($6<<24>>24)==(0);
 if ($7) {
  _Throw_error(9804);
  $$0$lcssa7$i = 0;
  $27 = HEAP32[4380]|0;
  _DynaBuf_append($27,0);
  return ($$0$lcssa7$i|0);
 } else {
  $$04$i = 0;$11 = 0;$28 = $2;$9 = $0;
 }
 while(1) {
  $8 = ((($9)) + 8|0);
  $10 = HEAP32[$8>>2]|0;
  $12 = ($11|0)==($10|0);
  if ($12) {
   _DynaBuf_enlarge($9);
   $$pre$i = HEAP8[20560]|0;
   $$pre5$i = HEAP32[4380]|0;
   $$phi$trans$insert$i = ((($$pre5$i)) + 4|0);
   $$pre6$i = HEAP32[$$phi$trans$insert$i>>2]|0;
   $14 = $$pre5$i;$16 = $$pre6$i;$19 = $$pre$i;
  } else {
   $14 = $9;$16 = $11;$19 = $28;
  }
  $13 = ((($14)) + 4|0);
  $15 = (($16) + 1)|0;
  HEAP32[$13>>2] = $15;
  $17 = HEAP32[$14>>2]|0;
  $18 = (($17) + ($16)|0);
  HEAP8[$18>>0] = $19;
  $20 = (($$04$i) + 1)|0;
  (_GetByte()|0);
  $21 = HEAP8[20560]|0;
  $22 = $21&255;
  $23 = (9945 + ($22)|0);
  $24 = HEAP8[$23>>0]|0;
  $25 = $24 & 64;
  $26 = ($25<<24>>24)==(0);
  if ($26) {
   $$0$lcssa7$i = $20;
   break;
  }
  $$pre = HEAP32[4380]|0;
  $$phi$trans$insert = ((($$pre)) + 4|0);
  $$pre2 = HEAP32[$$phi$trans$insert>>2]|0;
  $$04$i = $20;$11 = $$pre2;$28 = $21;$9 = $$pre;
 }
 $27 = HEAP32[4380]|0;
 _DynaBuf_append($27,0);
 return ($$0$lcssa7$i|0);
}
function _Input_read_and_lower_keyword() {
 var $$0$lcssa7$i = 0, $$04$i = 0, $$phi$trans$insert = 0, $$phi$trans$insert$i = 0, $$pre = 0, $$pre$i = 0, $$pre2 = 0, $$pre5$i = 0, $$pre6$i = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4380]|0;
 $1 = ((($0)) + 4|0);
 HEAP32[$1>>2] = 0;
 $2 = HEAP8[20560]|0;
 $3 = $2&255;
 $4 = (9945 + ($3)|0);
 $5 = HEAP8[$4>>0]|0;
 $6 = $5 & 64;
 $7 = ($6<<24>>24)==(0);
 if ($7) {
  _Throw_error(9804);
  $$0$lcssa7$i = 0;
  $27 = HEAP32[4380]|0;
  _DynaBuf_append($27,0);
  $28 = HEAP32[4380]|0;
  _DynaBuf_to_lower($28,$28);
  return ($$0$lcssa7$i|0);
 } else {
  $$04$i = 0;$11 = 0;$29 = $2;$9 = $0;
 }
 while(1) {
  $8 = ((($9)) + 8|0);
  $10 = HEAP32[$8>>2]|0;
  $12 = ($11|0)==($10|0);
  if ($12) {
   _DynaBuf_enlarge($9);
   $$pre$i = HEAP8[20560]|0;
   $$pre5$i = HEAP32[4380]|0;
   $$phi$trans$insert$i = ((($$pre5$i)) + 4|0);
   $$pre6$i = HEAP32[$$phi$trans$insert$i>>2]|0;
   $14 = $$pre5$i;$16 = $$pre6$i;$19 = $$pre$i;
  } else {
   $14 = $9;$16 = $11;$19 = $29;
  }
  $13 = ((($14)) + 4|0);
  $15 = (($16) + 1)|0;
  HEAP32[$13>>2] = $15;
  $17 = HEAP32[$14>>2]|0;
  $18 = (($17) + ($16)|0);
  HEAP8[$18>>0] = $19;
  $20 = (($$04$i) + 1)|0;
  (_GetByte()|0);
  $21 = HEAP8[20560]|0;
  $22 = $21&255;
  $23 = (9945 + ($22)|0);
  $24 = HEAP8[$23>>0]|0;
  $25 = $24 & 64;
  $26 = ($25<<24>>24)==(0);
  if ($26) {
   $$0$lcssa7$i = $20;
   break;
  }
  $$pre = HEAP32[4380]|0;
  $$phi$trans$insert = ((($$pre)) + 4|0);
  $$pre2 = HEAP32[$$phi$trans$insert>>2]|0;
  $$04$i = $20;$11 = $$pre2;$29 = $21;$9 = $$pre;
 }
 $27 = HEAP32[4380]|0;
 _DynaBuf_append($27,0);
 $28 = HEAP32[4380]|0;
 _DynaBuf_to_lower($28,$28);
 return ($$0$lcssa7$i|0);
}
function _Input_read_filename($0) {
 $0 = $0|0;
 var $$0 = 0, $$06 = 0, $$be = 0, $$phi$trans$insert = 0, $$pr = 0, $$pr12 = 0, $$pre = 0, $$pre$i = 0, $$pre$i9 = 0, $$pre15 = 0, $$pre16 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $8 = 0, $9 = 0, $or$cond = 0, $storemerge$i = 0, $storemerge$i8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[4380]|0;
 $2 = ((($1)) + 4|0);
 HEAP32[$2>>2] = 0;
 $3 = HEAP8[20560]|0;
 $4 = ($3<<24>>24)==(32);
 if ($4) {
  (_GetByte()|0);
  $$pr = HEAP8[20560]|0;
  $5 = $$pr;
 } else {
  $5 = $3;
 }
 switch ($5<<24>>24) {
 case 60:  {
  label = 4;
  break;
 }
 case 34:  {
  $$0 = 34;
  break;
 }
 default: {
  _Throw_error(10634);
  $$06 = 1;
  return ($$06|0);
 }
 }
 do {
  if ((label|0) == 4) {
   $6 = ($0|0)==(0);
   if ($6) {
    _Throw_error(10561);
    $$06 = 1;
    return ($$06|0);
   }
   $7 = HEAP32[4674]|0;
   $8 = ($7|0)==(0|0);
   if (!($8)) {
    $9 = HEAP32[4380]|0;
    _DynaBuf_add_string($9,$7);
    $$0 = 62;
    break;
   }
   _Throw_error(10595);
   $$06 = 1;
   return ($$06|0);
  }
 } while(0);
 $10 = HEAP32[245]|0;
 $11 = ((($10)) + 8|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = ($12|0)==(0);
 $14 = ((($10)) + 16|0);
 L18: do {
  if ($13) {
   $18 = HEAP32[$14>>2]|0;
   $19 = (_getc($18)|0);
   $20 = HEAP32[4099]|0;
   $21 = ($20|0)==(0|0);
   if (!($21)) {
    $22 = $19&255;
    _report_srcchar($22);
   }
   switch ($19|0) {
   case -1:  {
    $23 = HEAP32[245]|0;
    $24 = ((($23)) + 12|0);
    HEAP32[$24>>2] = 8;
    HEAP8[20560] = 0;
    label = 20;
    break L18;
    break;
   }
   case 10:  {
    $25 = HEAP32[245]|0;
    $26 = ((($25)) + 12|0);
    HEAP32[$26>>2] = 3;
    HEAP8[20560] = 0;
    label = 20;
    break L18;
    break;
   }
   case 13:  {
    $27 = HEAP32[245]|0;
    $28 = ((($27)) + 12|0);
    HEAP32[$28>>2] = 4;
    HEAP8[20560] = 0;
    label = 20;
    break L18;
    break;
   }
   default: {
    $29 = $19&255;
    $storemerge$i = $29;
    label = 19;
    break L18;
   }
   }
  } else {
   $15 = HEAP32[$14>>2]|0;
   $16 = ((($15)) + 1|0);
   HEAP32[$14>>2] = $16;
   $17 = HEAP8[$15>>0]|0;
   $storemerge$i = $17;
   label = 19;
  }
 } while(0);
 if ((label|0) == 19) {
  HEAP8[20560] = $storemerge$i;
  $30 = ($storemerge$i<<24>>24)==(0);
  if ($30) {
   label = 20;
  } else {
   $$pr12 = $storemerge$i;
  }
 }
 if ((label|0) == 20) {
  _Throw_error(10493);
  $$pre$i = HEAP8[20560]|0;
  $$pr12 = $$pre$i;
 }
 $31 = $$pr12 << 24 >> 24;
 $32 = ($31|0)==($$0|0);
 if ($32) {
  _Throw_error(10673);
  $$06 = 1;
  return ($$06|0);
 }
 $33 = ($$pr12<<24>>24)==(0);
 if ($33) {
  $$06 = 1;
  return ($$06|0);
 } else {
  $72 = $$pr12;
 }
 while(1) {
  $34 = HEAP32[4380]|0;
  $35 = ((($34)) + 4|0);
  $36 = HEAP32[$35>>2]|0;
  $37 = ((($34)) + 8|0);
  $38 = HEAP32[$37>>2]|0;
  $39 = ($36|0)==($38|0);
  if ($39) {
   _DynaBuf_enlarge($34);
   $$pre = HEAP8[20560]|0;
   $$pre15 = HEAP32[4380]|0;
   $$phi$trans$insert = ((($$pre15)) + 4|0);
   $$pre16 = HEAP32[$$phi$trans$insert>>2]|0;
   $41 = $$pre15;$43 = $$pre16;$46 = $$pre;
  } else {
   $41 = $34;$43 = $36;$46 = $72;
  }
  $40 = ((($41)) + 4|0);
  $42 = (($43) + 1)|0;
  HEAP32[$40>>2] = $42;
  $44 = HEAP32[$41>>2]|0;
  $45 = (($44) + ($43)|0);
  HEAP8[$45>>0] = $46;
  $47 = HEAP32[245]|0;
  $48 = ((($47)) + 8|0);
  $49 = HEAP32[$48>>2]|0;
  $50 = ($49|0)==(0);
  $51 = ((($47)) + 16|0);
  L45: do {
   if ($50) {
    $55 = HEAP32[$51>>2]|0;
    $56 = (_getc($55)|0);
    $57 = HEAP32[4099]|0;
    $58 = ($57|0)==(0|0);
    if (!($58)) {
     $59 = $56&255;
     _report_srcchar($59);
    }
    switch ($56|0) {
    case -1:  {
     $60 = HEAP32[245]|0;
     $61 = ((($60)) + 12|0);
     HEAP32[$61>>2] = 8;
     HEAP8[20560] = 0;
     label = 37;
     break L45;
     break;
    }
    case 10:  {
     $62 = HEAP32[245]|0;
     $63 = ((($62)) + 12|0);
     HEAP32[$63>>2] = 3;
     HEAP8[20560] = 0;
     label = 37;
     break L45;
     break;
    }
    case 13:  {
     $64 = HEAP32[245]|0;
     $65 = ((($64)) + 12|0);
     HEAP32[$65>>2] = 4;
     HEAP8[20560] = 0;
     label = 37;
     break L45;
     break;
    }
    default: {
     $66 = $56&255;
     $storemerge$i8 = $66;
     label = 35;
     break L45;
    }
    }
   } else {
    $52 = HEAP32[$51>>2]|0;
    $53 = ((($52)) + 1|0);
    HEAP32[$51>>2] = $53;
    $54 = HEAP8[$52>>0]|0;
    $storemerge$i8 = $54;
    label = 35;
   }
  } while(0);
  if ((label|0) == 35) {
   label = 0;
   HEAP8[20560] = $storemerge$i8;
   $67 = ($storemerge$i8<<24>>24)==(0);
   if ($67) {
    label = 37;
   } else {
    $$be = $storemerge$i8;
   }
  }
  if ((label|0) == 37) {
   label = 0;
   _Throw_error(10493);
   $$pre$i9 = HEAP8[20560]|0;
   $$be = $$pre$i9;
  }
  $68 = ($$be<<24>>24)==(0);
  $69 = $$be << 24 >> 24;
  $70 = ($69|0)==($$0|0);
  $or$cond = $68 | $70;
  if ($or$cond) {
   break;
  } else {
   $72 = $$be;
  }
 }
 if ($68) {
  $$06 = 1;
  return ($$06|0);
 }
 (_GetByte()|0);
 $71 = HEAP32[4380]|0;
 _DynaBuf_append($71,0);
 $$06 = 0;
 return ($$06|0);
}
function _Input_accept_comma() {
 var $$0 = 0, $$pr = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[20560]|0;
 $1 = ($0<<24>>24)==(32);
 if ($1) {
  (_GetByte()|0);
  $$pr = HEAP8[20560]|0;
  $2 = $$pr;
 } else {
  $2 = $0;
 }
 $3 = ($2<<24>>24)==(44);
 if (!($3)) {
  $$0 = 0;
  return ($$0|0);
 }
 $4 = (_GetByte()|0);
 $5 = ($4<<24>>24)==(32);
 if (!($5)) {
  $$0 = 1;
  return ($$0|0);
 }
 (_GetByte()|0);
 $$0 = 1;
 return ($$0|0);
}
function _Input_get_force_bit() {
 var $$0$ph = 0, $$1 = 0, $$1$ph = 0, $$pr = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[20560]|0;
 $1 = ($0<<24>>24)==(43);
 if ($1) {
  $2 = (_GetByte()|0);
  switch ($2<<24>>24) {
  case 49:  {
   $$0$ph = 1;
   label = 5;
   break;
  }
  case 50:  {
   $$0$ph = 2;
   label = 5;
   break;
  }
  default: {
   $3 = ($2<<24>>24)==(51);
   if ($3) {
    $$0$ph = 4;
    label = 5;
   } else {
    _Throw_error(10693);
    $$1$ph = 0;
   }
  }
  }
  if ((label|0) == 5) {
   (_GetByte()|0);
   $$1$ph = $$0$ph;
  }
  $$pr = HEAP8[20560]|0;
  $$1 = $$1$ph;$4 = $$pr;
 } else {
  $$1 = 0;$4 = $0;
 }
 $5 = ($4<<24>>24)==(32);
 if (!($5)) {
  return ($$1|0);
 }
 (_GetByte()|0);
 return ($$1|0);
}
function _Macro_init() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_DynaBuf_create(128)|0);
 HEAP32[4392] = $0;
 $1 = (_DynaBuf_create(128)|0);
 HEAP32[4393] = $1;
 $2 = HEAP32[251]|0;
 $3 = $2 << 1;
 HEAP32[251] = $3;
 $4 = HEAP32[4394]|0;
 $5 = ($2*48)|0;
 $6 = (_realloc($4,$5)|0);
 HEAP32[4394] = $6;
 $7 = ($6|0)==(0|0);
 if ($7) {
  _Throw_serious_error(9834);
  // unreachable;
 } else {
  return;
 }
}
function _Macro_parse_definition() {
 var $$phi$trans$insert$i = 0, $$pr = 0, $$pre$i = 0, $$pre3$i = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 $1 = (_get_scope_and_title()|0);
 $2 = HEAP32[4380]|0;
 $3 = ((($2)) + 4|0);
 HEAP32[$3>>2] = 0;
 $4 = HEAP8[20560]|0;
 $5 = ($4<<24>>24)==(123);
 if (!($5)) {
  $12 = $4;
  while(1) {
   $13 = ($12<<24>>24)==(126);
   $14 = HEAP32[4393]|0;
   if ($13) {
    _DynaBuf_append($14,86);
    $15 = HEAP32[4380]|0;
    _DynaBuf_append($15,126);
    (_GetByte()|0);
   } else {
    _DynaBuf_append($14,118);
   }
   $16 = HEAP8[20560]|0;
   $17 = ($16<<24>>24)==(46);
   if ($17) {
    $18 = HEAP32[4380]|0;
    _DynaBuf_append($18,46);
    (_GetByte()|0);
   }
   (_Input_append_keyword_to_global_dynabuf()|0);
   $19 = (_Input_accept_comma()|0);
   $20 = ($19|0)==(0);
   if ($20) {
    break;
   }
   $21 = HEAP32[4380]|0;
   $22 = ((($21)) + 4|0);
   $23 = HEAP32[$22>>2]|0;
   $24 = ((($21)) + 8|0);
   $25 = HEAP32[$24>>2]|0;
   $26 = ($23|0)==($25|0);
   if ($26) {
    _DynaBuf_enlarge($21);
    $$pre$i = HEAP32[4380]|0;
    $$phi$trans$insert$i = ((($$pre$i)) + 4|0);
    $$pre3$i = HEAP32[$$phi$trans$insert$i>>2]|0;
    $7 = $$pre$i;$9 = $$pre3$i;
   } else {
    $7 = $21;$9 = $23;
   }
   $6 = ((($7)) + 4|0);
   $8 = (($9) + 1)|0;
   HEAP32[$6>>2] = $8;
   $10 = HEAP32[$7>>2]|0;
   $11 = (($10) + ($9)|0);
   HEAP8[$11>>0] = 44;
   $$pr = HEAP8[20560]|0;
   $12 = $$pr;
  }
  $27 = HEAP8[20560]|0;
  $28 = ($27<<24>>24)==(123);
  if (!($28)) {
   _Throw_serious_error(9821);
   // unreachable;
  }
 }
 $29 = HEAP32[4380]|0;
 _DynaBuf_append($29,0);
 $30 = HEAP32[4380]|0;
 $31 = (_DynaBuf_get_copy($30)|0);
 $32 = HEAP32[4393]|0;
 _DynaBuf_append($32,0);
 $33 = HEAP32[4380]|0;
 $34 = ((($33)) + 4|0);
 HEAP32[$34>>2] = 0;
 $35 = HEAP32[4393]|0;
 $36 = HEAP32[$35>>2]|0;
 _DynaBuf_add_string($33,$36);
 $37 = HEAP32[4380]|0;
 _DynaBuf_append($37,0);
 $38 = (_Tree_hard_scan($0,17580,$1,1)|0);
 $39 = ($38|0)==(0);
 if ($39) {
  $40 = HEAP32[$0>>2]|0;
  $41 = ((($40)) + 16|0);
  $42 = HEAP32[$41>>2]|0;
  _Throw_warning(10710);
  $43 = ((($42)) + 4|0);
  $44 = HEAP32[$43>>2]|0;
  $45 = HEAP32[245]|0;
  HEAP32[$45>>2] = $44;
  $46 = HEAP32[$42>>2]|0;
  $47 = HEAP32[245]|0;
  $48 = ((($47)) + 4|0);
  HEAP32[$48>>2] = $46;
  $49 = HEAP32[1337]|0;
  $50 = ((($49)) + 4|0);
  HEAP32[$50>>2] = 10733;
  $51 = ((($49)) + 8|0);
  HEAP32[$51>>2] = 10742;
  _Throw_serious_error(10710);
  // unreachable;
 } else {
  $52 = (_safe_malloc(20)|0);
  $53 = HEAP32[245]|0;
  $54 = ((($53)) + 4|0);
  $55 = HEAP32[$54>>2]|0;
  HEAP32[$52>>2] = $55;
  $56 = HEAP32[$53>>2]|0;
  $57 = (_strlen($56)|0);
  $58 = (($57) + 1)|0;
  $59 = (_safe_malloc($58)|0);
  _memcpy(($59|0),($56|0),($58|0))|0;
  $60 = ((($52)) + 4|0);
  HEAP32[$60>>2] = $59;
  $61 = HEAP32[4392]|0;
  $62 = HEAP32[$61>>2]|0;
  $63 = (_strlen($62)|0);
  $64 = (($63) + 1)|0;
  $65 = (_safe_malloc($64)|0);
  _memcpy(($65|0),($62|0),($64|0))|0;
  $66 = ((($52)) + 8|0);
  HEAP32[$66>>2] = $65;
  $67 = ((($52)) + 12|0);
  HEAP32[$67>>2] = $31;
  $68 = (_Input_skip_or_store_block(1)|0);
  $69 = ((($52)) + 16|0);
  HEAP32[$69>>2] = $68;
  $70 = HEAP32[$0>>2]|0;
  $71 = ((($70)) + 16|0);
  HEAP32[$71>>2] = $52;
  STACKTOP = sp;return;
 }
}
function _get_scope_and_title() {
 var $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 (_Input_read_scope_and_keyword($0)|0);
 $1 = HEAP32[4392]|0;
 $2 = ((($1)) + 4|0);
 HEAP32[$2>>2] = 0;
 $3 = HEAP32[4393]|0;
 $4 = ((($3)) + 4|0);
 HEAP32[$4>>2] = 0;
 $5 = HEAP32[$0>>2]|0;
 $6 = ($5|0)==(0);
 if ($6) {
  $9 = $1;
 } else {
  _DynaBuf_append($1,46);
  $$pre = HEAP32[4392]|0;
  $9 = $$pre;
 }
 $7 = HEAP32[4380]|0;
 $8 = HEAP32[$7>>2]|0;
 _DynaBuf_add_string($9,$8);
 $10 = HEAP32[4393]|0;
 $11 = HEAP32[4380]|0;
 $12 = HEAP32[$11>>2]|0;
 _DynaBuf_add_string($10,$12);
 $13 = HEAP32[4392]|0;
 _DynaBuf_append($13,0);
 $14 = HEAP32[4393]|0;
 _DynaBuf_append($14,32);
 $15 = HEAP8[20560]|0;
 $16 = ($15<<24>>24)==(32);
 if (!($16)) {
  $17 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 (_GetByte()|0);
 $17 = HEAP32[$0>>2]|0;
 STACKTOP = sp;return ($17|0);
}
function _Macro_parse_call() {
 var $$0 = 0, $$1 = 0, $$pr = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $0 = sp + 32|0;
 $1 = sp + 12|0;
 $2 = sp + 8|0;
 $3 = sp + 4|0;
 $4 = sp;
 $5 = HEAP32[2]|0;
 $6 = (($5) + -1)|0;
 HEAP32[2] = $6;
 $7 = ($5|0)<(1);
 if ($7) {
  _Throw_serious_error(10753);
  // unreachable;
 }
 $8 = (_get_scope_and_title()|0);
 $9 = HEAP8[20560]|0;
 $10 = ($9<<24>>24)==(0);
 L4: do {
  if (!($10)) {
   $$0 = 0;
   while(1) {
    $11 = HEAP32[251]|0;
    $12 = ($11|0)>($$0|0);
    if (!($12)) {
     $13 = $11 << 1;
     HEAP32[251] = $13;
     $14 = HEAP32[4394]|0;
     $15 = ($11*48)|0;
     $16 = (_realloc($14,$15)|0);
     HEAP32[4394] = $16;
     $17 = ($16|0)==(0|0);
     if ($17) {
      break;
     }
    }
    $18 = HEAP8[20560]|0;
    $19 = ($18<<24>>24)==(126);
    $20 = HEAP32[4393]|0;
    if ($19) {
     _DynaBuf_append($20,86);
     (_GetByte()|0);
     (_Input_read_scope_and_keyword($4)|0);
     $21 = HEAP32[$4>>2]|0;
     $22 = (_symbol_find($21,0)|0);
     $23 = HEAP32[4394]|0;
     $24 = (($23) + (($$0*24)|0)|0);
     HEAP32[$24>>2] = $22;
    } else {
     _DynaBuf_append($20,118);
     $25 = HEAP32[4394]|0;
     $26 = (($25) + (($$0*24)|0)|0);
     _ALU_any_result($26);
    }
    $27 = (($$0) + 1)|0;
    $28 = (_Input_accept_comma()|0);
    $29 = ($28|0)==(0);
    if ($29) {
     break L4;
    } else {
     $$0 = $27;
    }
   }
   _Throw_serious_error(9834);
   // unreachable;
  }
 } while(0);
 $30 = HEAP32[4393]|0;
 _DynaBuf_append($30,0);
 $31 = HEAP32[4380]|0;
 $32 = ((($31)) + 4|0);
 HEAP32[$32>>2] = 0;
 $33 = HEAP32[4393]|0;
 $34 = HEAP32[$33>>2]|0;
 _DynaBuf_add_string($31,$34);
 $35 = HEAP32[4380]|0;
 _DynaBuf_append($35,0);
 (_Tree_hard_scan($2,17580,$8,0)|0);
 $36 = HEAP32[$2>>2]|0;
 $37 = ($36|0)==(0|0);
 if ($37) {
  _Throw_error(10795);
  _Input_skip_remainder();
  $86 = HEAP32[2]|0;
  $87 = (($86) + 1)|0;
  HEAP32[2] = $87;
  STACKTOP = sp;return;
 }
 $38 = ((($36)) + 16|0);
 $39 = HEAP32[$38>>2]|0;
 $40 = HEAP8[20560]|0;
 $41 = ((($39)) + 4|0);
 $42 = HEAP32[$41>>2]|0;
 HEAP32[$1>>2] = $42;
 $43 = HEAP32[$39>>2]|0;
 $44 = ((($1)) + 4|0);
 HEAP32[$44>>2] = $43;
 $45 = ((($1)) + 8|0);
 HEAP32[$45>>2] = 1;
 $46 = ((($1)) + 12|0);
 HEAP32[$46>>2] = 0;
 $47 = ((($39)) + 12|0);
 $48 = HEAP32[$47>>2]|0;
 $49 = ((($1)) + 16|0);
 HEAP32[$49>>2] = $48;
 $50 = HEAP32[245]|0;
 HEAP32[245] = $1;
 $51 = (_Throw_get_counter()|0);
 $52 = HEAP32[1337]|0;
 $53 = ((($39)) + 8|0);
 $54 = HEAP32[$53>>2]|0;
 _section_new($0,10835,$54,0);
 (_GetByte()|0);
 $55 = HEAP8[20560]|0;
 $56 = ($55<<24>>24)==(0);
 L20: do {
  if (!($56)) {
   $$1 = 0;$58 = $55;
   while(1) {
    $59 = ($58<<24>>24)==(126);
    if ($59) {
     (_GetByte()|0);
     (_Input_read_scope_and_keyword($4)|0);
     $60 = HEAP32[$4>>2]|0;
     $61 = (_Tree_hard_scan($3,18728,$60,1)|0);
     $62 = HEAP32[4388]|0;
     $63 = $62 | $61;
     $64 = ($63|0)==(0);
     if ($64) {
      _Throw_error(10841);
     }
     $65 = HEAP32[4394]|0;
     $66 = (($65) + (($$1*24)|0)|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = HEAP32[$3>>2]|0;
     $69 = ((($68)) + 16|0);
     HEAP32[$69>>2] = $67;
    } else {
     (_Input_read_scope_and_keyword($4)|0);
     $70 = HEAP32[$4>>2]|0;
     $71 = (_symbol_find($70,0)|0);
     $72 = HEAP32[4394]|0;
     $73 = (($72) + (($$1*24)|0)|0);
     ;HEAP32[$71>>2]=HEAP32[$73>>2]|0;HEAP32[$71+4>>2]=HEAP32[$73+4>>2]|0;HEAP32[$71+8>>2]=HEAP32[$73+8>>2]|0;HEAP32[$71+12>>2]=HEAP32[$73+12>>2]|0;HEAP32[$71+16>>2]=HEAP32[$73+16>>2]|0;HEAP32[$71+20>>2]=HEAP32[$73+20>>2]|0;
    }
    $74 = (_Input_accept_comma()|0);
    $75 = ($74|0)==(0);
    if ($75) {
     break L20;
    }
    $57 = (($$1) + 1)|0;
    $$pr = HEAP8[20560]|0;
    $$1 = $57;$58 = $$pr;
   }
  }
 } while(0);
 $76 = HEAP32[245]|0;
 $77 = ((($76)) + 12|0);
 HEAP32[$77>>2] = 0;
 $78 = ((($39)) + 16|0);
 $79 = HEAP32[$78>>2]|0;
 $80 = ((($76)) + 16|0);
 HEAP32[$80>>2] = $79;
 _Parse_until_eob_or_eof();
 $81 = HEAP8[20560]|0;
 $82 = ($81<<24>>24)==(125);
 if (!($82)) {
  $83 = $81 << 24 >> 24;
  _Bug_found(10864,$83);
  // unreachable;
 }
 _section_finalize($0);
 HEAP32[1337] = $52;
 HEAP32[245] = $50;
 HEAP8[20560] = $40;
 $84 = (_Throw_get_counter()|0);
 $85 = ($84|0)==($51|0);
 if (!($85)) {
  _Throw_warning(10887);
 }
 _Input_ensure_EOS();
 $86 = HEAP32[2]|0;
 $87 = (($86) + 1)|0;
 HEAP32[2] = $87;
 STACKTOP = sp;return;
}
function _Mnemo_init() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_DynaBuf_create(8)|0);
 HEAP32[4651] = $0;
 _Tree_add_table(18608,1008);
 _Tree_add_table(18612,2128);
 _Tree_add_table(18616,2548);
 _Tree_add_table(18620,2568);
 _Tree_add_table(18624,2628);
 _Tree_add_table(18628,3028);
 _Tree_add_table(18632,3068);
 return;
}
function _keyword_is_6502mnemo($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(3);
 if (!($1)) {
  $$0 = 0;
  return ($$0|0);
 }
 $2 = HEAP32[4651]|0;
 $3 = HEAP32[4380]|0;
 _DynaBuf_to_lower($2,$3);
 $4 = HEAP32[4652]|0;
 $5 = HEAP32[4651]|0;
 $6 = (_check_mnemo_tree($4,$5)|0);
 $7 = ($6|0)!=(0);
 $8 = $7&1;
 $$0 = $8;
 return ($$0|0);
}
function _check_mnemo_tree($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$$i = 0, $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i18 = 0, $$0$i16 = 0, $$0$i21 = 0, $$0$off$i = 0, $$1$i = 0, $$1$i17 = 0, $$1$i20 = 0, $$neg11$i = 0, $$neg3$i = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0;
 var $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0;
 var $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0;
 var $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0;
 var $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0;
 var $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0;
 var $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond$i$i = 0, $or$cond$i$i15 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer5 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0;
 $vararg_buffer5 = sp + 40|0;
 $vararg_buffer1 = sp + 32|0;
 $vararg_buffer = sp + 24|0;
 $2 = sp;
 $3 = sp + 48|0;
 $4 = sp + 44|0;
 $5 = (_Tree_easy_scan($0,$4,$1)|0);
 $6 = ($5|0)==(0);
 if ($6) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $7 = HEAP32[$4>>2]|0;
 $8 = $7 & 255;
 $9 = $7 & 768;
 $10 = $7 >> 10;
 switch ($10|0) {
 case 0:  {
  $11 = (_Input_get_force_bit()|0);
  $12 = (_get_argument($2)|0);
  do {
   switch ($12|0) {
   case 64:  {
    $13 = (11340 + ($8)|0);
    $14 = HEAP8[$13>>0]|0;
    $15 = HEAP32[4080]|0;
    $16 = ((($15)) + 4|0);
    $17 = HEAP32[$16>>2]|0;
    $18 = $17 & 2;
    $19 = ($18|0)==(0);
    $20 = ($9|0)==(0);
    $or$cond$i$i = $20 | $19;
    if ($or$cond$i$i) {
     $21 = $14&255;
     $$0$i$i = $21;$$1$i = $11;
    } else {
     $22 = ($11|0)==(0);
     if ($22) {
      $23 = $7 & 256;
      $24 = ($23|0)!=(0);
      $25 = HEAP32[(16356)>>2]|0;
      $26 = HEAP32[(16360)>>2]|0;
      $27 = $24 ? $25 : $26;
      $28 = ($27|0)!=(0);
      $29 = $28 ? 2 : 1;
      $$0$i = $29;
     } else {
      $$0$i = $11;
     }
     $30 = $14&255;
     $31 = $30 << 8;
     $32 = $31 | $30;
     $$0$i$i = $32;$$1$i = $$0$i;
    }
    _make_command($$1$i,$2,$$0$i$i);
    break;
   }
   case 0:  {
    $33 = (3788 + ($8<<2)|0);
    $34 = HEAP32[$33>>2]|0;
    _make_command($11,$2,$34);
    break;
   }
   case 2:  {
    $35 = (3924 + ($8<<2)|0);
    $36 = HEAP32[$35>>2]|0;
    _make_command($11,$2,$36);
    break;
   }
   case 3:  {
    $37 = (5716 + ($8<<1)|0);
    $38 = HEAP16[$37>>1]|0;
    $39 = $38&65535;
    _make_command($11,$2,$39);
    break;
   }
   case 1:  {
    $40 = (11374 + ($8)|0);
    $41 = HEAP8[$40>>0]|0;
    $42 = $41&255;
    _make_command($11,$2,$42);
    break;
   }
   case 24:  {
    $43 = (11408 + ($8)|0);
    $44 = HEAP8[$43>>0]|0;
    $45 = $44&255;
    _make_command($11,$2,$45);
    break;
   }
   case 16:  {
    $46 = (11442 + ($8)|0);
    $47 = HEAP8[$46>>0]|0;
    $48 = $47&255;
    _make_command($11,$2,$48);
    break;
   }
   case 19:  {
    $49 = (11476 + ($8)|0);
    $50 = HEAP8[$49>>0]|0;
    $51 = $50&255;
    _make_command($11,$2,$51);
    break;
   }
   case 32:  {
    $52 = (11510 + ($8)|0);
    $53 = HEAP8[$52>>0]|0;
    $54 = $53&255;
    _make_command($11,$2,$54);
    break;
   }
   case 35:  {
    $55 = (11544 + ($8)|0);
    $56 = HEAP8[$55>>0]|0;
    $57 = $56&255;
    _make_command($11,$2,$57);
    break;
   }
   case 23:  {
    $58 = (11578 + ($8)|0);
    $59 = HEAP8[$58>>0]|0;
    $60 = $59&255;
    _make_command($11,$2,$60);
    break;
   }
   default: {
    _Throw_error(11612);
   }
   }
  } while(0);
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
  break;
 }
 case 1:  {
  $61 = (_Input_get_force_bit()|0);
  $62 = (_get_argument($2)|0);
  L30: do {
   switch ($62|0) {
   case 128:  {
    $63 = (11664 + ($8)|0);
    $64 = HEAP8[$63>>0]|0;
    $65 = ($64<<24>>24)==(0);
    if ($65) {
     _Throw_error(11612);
     break L30;
    } else {
     $66 = HEAP32[4659]|0;
     $67 = $64&255;
     FUNCTION_TABLE_vi[$66 & 15]($67);
     break L30;
    }
    break;
   }
   case 64:  {
    $68 = (11702 + ($8)|0);
    $69 = HEAP8[$68>>0]|0;
    $70 = HEAP32[4080]|0;
    $71 = ((($70)) + 4|0);
    $72 = HEAP32[$71>>2]|0;
    $73 = $72 & 2;
    $74 = ($73|0)==(0);
    $75 = ($9|0)==(0);
    $or$cond$i$i15 = $75 | $74;
    if ($or$cond$i$i15) {
     $76 = $69&255;
     $$0$i$i18 = $76;$$1$i17 = $61;
    } else {
     $77 = ($61|0)==(0);
     if ($77) {
      $78 = $7 & 256;
      $79 = ($78|0)!=(0);
      $80 = HEAP32[(16356)>>2]|0;
      $81 = HEAP32[(16360)>>2]|0;
      $82 = $79 ? $80 : $81;
      $83 = ($82|0)!=(0);
      $84 = $83 ? 2 : 1;
      $$0$i16 = $84;
     } else {
      $$0$i16 = $61;
     }
     $85 = $69&255;
     $86 = $85 << 8;
     $87 = $86 | $85;
     $$0$i$i18 = $87;$$1$i17 = $$0$i16;
    }
    _make_command($$1$i17,$2,$$0$i$i18);
    $88 = HEAP32[4080]|0;
    $89 = ((($88)) + 4|0);
    $90 = HEAP32[$89>>2]|0;
    $91 = $90 & 4;
    $92 = ($91|0)==(0);
    if (!($92)) {
     $93 = ((($2)) + 8|0);
     $94 = HEAP32[$93>>2]|0;
     $95 = $94 & 255;
     $96 = ($95|0)==(0);
     if (!($96)) {
      $97 = HEAP32[$2>>2]|0;
      $98 = $97 & 16;
      $99 = ($98|0)==(0);
      if (!($99)) {
       switch ($$0$i$i18|0) {
       case 139:  {
        _Throw_warning(11740);
        break L30;
        break;
       }
       case 171:  {
        _Throw_warning(11785);
        break L30;
        break;
       }
       default: {
        break L30;
       }
       }
      }
     }
    }
    break;
   }
   case 0:  {
    $100 = (5784 + ($8<<1)|0);
    $101 = HEAP16[$100>>1]|0;
    $102 = $101&65535;
    _make_command($61,$2,$102);
    break;
   }
   case 2:  {
    $103 = (5860 + ($8<<1)|0);
    $104 = HEAP16[$103>>1]|0;
    $105 = $104&65535;
    _make_command($61,$2,$105);
    break;
   }
   case 3:  {
    $106 = (5936 + ($8<<1)|0);
    $107 = HEAP16[$106>>1]|0;
    $108 = $107&65535;
    _make_command($61,$2,$108);
    break;
   }
   default: {
    _Throw_error(11612);
   }
   }
  } while(0);
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
  break;
 }
 case 2:  {
  $109 = (_Input_get_force_bit()|0);
  $110 = (_get_argument($2)|0);
  switch ($110|0) {
  case 0:  {
   $111 = (4060 + ($8<<2)|0);
   $112 = HEAP32[$111>>2]|0;
   _make_command($109,$2,$112);
   break;
  }
  case 16:  {
   $113 = (6012 + ($8<<1)|0);
   $114 = HEAP16[$113>>1]|0;
   $115 = $114&65535;
   _make_command($109,$2,$115);
   $116 = ((($2)) + 8|0);
   $117 = HEAP32[$116>>2]|0;
   $118 = $117 & 255;
   $119 = ($118|0)==(255);
   if ($119) {
    $120 = HEAP32[$2>>2]|0;
    $121 = $120 & 16;
    $122 = ($121|0)==(0);
    if (!($122)) {
     $123 = HEAP32[4080]|0;
     $124 = ((($123)) + 4|0);
     $125 = HEAP32[$124>>2]|0;
     $126 = $125 & 1;
     $127 = ($126|0)==(0);
     if (!($127)) {
      _Throw_warning(11830);
     }
    }
   }
   break;
  }
  case 24:  {
   $128 = (6026 + ($8<<1)|0);
   $129 = HEAP16[$128>>1]|0;
   $130 = $129&65535;
   _make_command($109,$2,$130);
   break;
  }
  case 32:  {
   $131 = (6040 + ($8<<1)|0);
   $132 = HEAP16[$131>>1]|0;
   $133 = $132&65535;
   _make_command($109,$2,$133);
   break;
  }
  default: {
   _Throw_error(11612);
  }
  }
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
  break;
 }
 case 3:  {
  $134 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$134 & 15]($8);
  _Input_ensure_EOS();
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
  break;
 }
 case 4:  {
  _ALU_int_result($2);
  _typesystem_want_addr($2);
  $135 = HEAP32[(16328)>>2]|0;
  $136 = HEAP32[$2>>2]|0;
  $137 = $135 & 16;
  $138 = $137 & $136;
  $139 = ($138|0)==(0);
  do {
   if ($139) {
    $$1$i20 = 0;
   } else {
    $140 = ((($2)) + 8|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = $141 | 65535;
    $143 = ($142|0)==(65535);
    if (!($143)) {
     HEAP32[$vararg_buffer>>2] = $141;
     (_sprintf($3,11870,$vararg_buffer)|0);
     _Throw_error($3);
     $$1$i20 = 0;
     break;
    }
    $144 = HEAP32[(16336)>>2]|0;
    $$neg11$i = (($141) + -2)|0;
    $145 = (($$neg11$i) - ($144))|0;
    $146 = $145 & 65535;
    $147 = $145 & 32768;
    $148 = ($147|0)==(0);
    $149 = $145 | -65536;
    $$$i = $148 ? $146 : $149;
    $$0$off$i = (($$$i) + 128)|0;
    $150 = ($$0$off$i>>>0)>(255);
    if ($150) {
     $151 = ($$$i|0)<(-128);
     $152 = (-128 - ($$$i))|0;
     $153 = (($$$i) + -127)|0;
     $154 = $151 ? $152 : $153;
     HEAP32[$vararg_buffer1>>2] = $$$i;
     $vararg_ptr4 = ((($vararg_buffer1)) + 4|0);
     HEAP32[$vararg_ptr4>>2] = $154;
     (_sprintf($3,11898,$vararg_buffer1)|0);
     _Throw_error($3);
     $$1$i20 = $$$i;
    } else {
     $$1$i20 = $$$i;
    }
   }
  } while(0);
  $155 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$155 & 15]($8);
  $156 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$156 & 15]($$1$i20);
  _Input_ensure_EOS();
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
  break;
 }
 case 5:  {
  _ALU_int_result($2);
  _typesystem_want_addr($2);
  $157 = HEAP32[(16328)>>2]|0;
  $158 = HEAP32[$2>>2]|0;
  $159 = $157 & 16;
  $160 = $159 & $158;
  $161 = ($160|0)==(0);
  do {
   if ($161) {
    $$0$i21 = 0;
   } else {
    $162 = ((($2)) + 8|0);
    $163 = HEAP32[$162>>2]|0;
    $164 = $163 | 65535;
    $165 = ($164|0)==(65535);
    if ($165) {
     $166 = HEAP32[(16336)>>2]|0;
     $$neg3$i = (($163) + 65533)|0;
     $167 = (($$neg3$i) - ($166))|0;
     $168 = $167 & 65535;
     $$0$i21 = $168;
     break;
    } else {
     HEAP32[$vararg_buffer5>>2] = $163;
     (_sprintf($3,11870,$vararg_buffer5)|0);
     _Throw_error($3);
     $$0$i21 = 0;
     break;
    }
   }
  } while(0);
  $169 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$169 & 15]($8);
  _output_le16($$0$i21);
  _Input_ensure_EOS();
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
  break;
 }
 case 6:  {
  $170 = (_ALU_any_int()|0);
  $171 = (_Input_accept_comma()|0);
  $172 = ($171|0)==(0);
  if ($172) {
   _Throw_error(9931);
   $$0 = 1;
   STACKTOP = sp;return ($$0|0);
  } else {
   $173 = (_ALU_any_int()|0);
   $174 = HEAP32[4659]|0;
   FUNCTION_TABLE_vi[$174 & 15]($8);
   _output_8($173);
   _output_8($170);
   _Input_ensure_EOS();
   $$0 = 1;
   STACKTOP = sp;return ($$0|0);
  }
  break;
 }
 default: {
  _Bug_found(11938,$8);
  // unreachable;
 }
 }
 return (0)|0;
}
function _get_argument($0) {
 $0 = $0|0;
 var $$0$ph$i = 0, $$0$ph$i18 = 0, $$0$ph$i21 = 0, $$06$i = 0, $$06$i19 = 0, $$06$i22 = 0, $$2 = 0, $$3 = 0, $$pre = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[20560]|0;
 $2 = ($1<<24>>24)==(32);
 if ($2) {
  (_GetByte()|0);
  $$pre = HEAP8[20560]|0;
  $4 = $$pre;
 } else {
  $4 = $1;
 }
 $3 = $4 << 24 >> 24;
 switch ($3|0) {
 case 91:  {
  (_GetByte()|0);
  _ALU_int_result($0);
  _typesystem_want_addr($0);
  $5 = HEAP8[20560]|0;
  $6 = ($5<<24>>24)==(93);
  if (!($6)) {
   _Throw_error(9931);
   $$3 = 0;
   _Input_ensure_EOS();
   return ($$3|0);
  }
  (_GetByte()|0);
  $7 = (_Input_accept_comma()|0);
  $8 = ($7|0)==(0);
  L36: do {
   if ($8) {
    $$06$i = 0;
   } else {
    $9 = HEAP8[20560]|0;
    $10 = $9 << 24 >> 24;
    switch ($10|0) {
    case 83: case 115:  {
     $$0$ph$i = 1;
     break;
    }
    case 88: case 120:  {
     $$0$ph$i = 2;
     break;
    }
    case 89: case 121:  {
     $$0$ph$i = 3;
     break;
    }
    default: {
     _Throw_error(9931);
     $$06$i = 0;
     break L36;
    }
    }
    $11 = (_GetByte()|0);
    $12 = ($11<<24>>24)==(32);
    if ($12) {
     (_GetByte()|0);
     $$06$i = $$0$ph$i;
    } else {
     $$06$i = $$0$ph$i;
    }
   }
  } while(0);
  $13 = $$06$i | 32;
  $$3 = $13;
  _Input_ensure_EOS();
  return ($$3|0);
  break;
 }
 case 35:  {
  (_GetByte()|0);
  _ALU_int_result($0);
  _typesystem_want_imm($0);
  $$3 = 64;
  _Input_ensure_EOS();
  return ($$3|0);
  break;
 }
 default: {
  $14 = (_ALU_liberal_int($0)|0);
  _typesystem_want_addr($0);
  $15 = HEAP32[$0>>2]|0;
  $16 = $15 << 1;
  $17 = $16 & 128;
  $18 = $15 >>> 3;
  $19 = $18 & 16;
  $20 = $17 | $19;
  $21 = $20 ^ 128;
  $22 = ($14|0)==(0);
  do {
   if ($22) {
    $$2 = $21;
   } else {
    $23 = (_Input_accept_comma()|0);
    $24 = ($23|0)==(0);
    L8: do {
     if ($24) {
      $$06$i19 = 0;
     } else {
      $25 = HEAP8[20560]|0;
      $26 = $25 << 24 >> 24;
      switch ($26|0) {
      case 83: case 115:  {
       $$0$ph$i18 = 1;
       break;
      }
      case 88: case 120:  {
       $$0$ph$i18 = 2;
       break;
      }
      case 89: case 121:  {
       $$0$ph$i18 = 3;
       break;
      }
      default: {
       _Throw_error(9931);
       $$06$i19 = 0;
       break L8;
      }
      }
      $27 = (_GetByte()|0);
      $28 = ($27<<24>>24)==(32);
      if ($28) {
       (_GetByte()|0);
       $$06$i19 = $$0$ph$i18;
      } else {
       $$06$i19 = $$0$ph$i18;
      }
     }
    } while(0);
    $29 = $$06$i19 << 2;
    $30 = $29 | $21;
    $31 = HEAP8[20560]|0;
    $32 = ($31<<24>>24)==(41);
    if ($32) {
     (_GetByte()|0);
     $$2 = $30;
     break;
    } else {
     _Throw_error(9931);
     $$2 = $30;
     break;
    }
   }
  } while(0);
  $33 = (_Input_accept_comma()|0);
  $34 = ($33|0)==(0);
  L21: do {
   if ($34) {
    $$06$i22 = 0;
   } else {
    $35 = HEAP8[20560]|0;
    $36 = $35 << 24 >> 24;
    switch ($36|0) {
    case 83: case 115:  {
     $$0$ph$i21 = 1;
     break;
    }
    case 88: case 120:  {
     $$0$ph$i21 = 2;
     break;
    }
    case 89: case 121:  {
     $$0$ph$i21 = 3;
     break;
    }
    default: {
     _Throw_error(9931);
     $$06$i22 = 0;
     break L21;
    }
    }
    $37 = (_GetByte()|0);
    $38 = ($37<<24>>24)==(32);
    if ($38) {
     (_GetByte()|0);
     $$06$i22 = $$0$ph$i21;
    } else {
     $$06$i22 = $$0$ph$i21;
    }
   }
  } while(0);
  $39 = $$06$i22 | $$2;
  $$3 = $39;
  _Input_ensure_EOS();
  return ($$3|0);
 }
 }
 return (0)|0;
}
function _make_command($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0$i = 0, $$1 = 0, $$1$ = 0, $$off$i$i = 0, $$off7$i$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $7 = 0, $8 = 0, $9 = 0, $not$ = 0, $or$cond$i = 0, $or$cond31$i = 0, $or$cond33$i = 0, $trunc = 0, $trunc$clear = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $2 & 255;
 $not$ = ($3|0)!=(0);
 $$ = $not$&1;
 $4 = $2 & 65280;
 $5 = ($4|0)==(0);
 $6 = $$ | 2;
 $$1 = $5 ? $$ : $6;
 $7 = $2 & 16711680;
 $8 = ($7|0)==(0);
 $9 = $$1 | 4;
 $$1$ = $8 ? $$1 : $9;
 $10 = ($$1$|0)==(0);
 if ($10) {
  _Throw_error(11612);
  return;
 }
 $11 = ($0|0)==(0);
 L5: do {
  if ($11) {
   $14 = HEAP32[$1>>2]|0;
   $15 = $14 & 7;
   $16 = ($15|0)==(0);
   if (!($16)) {
    $17 = $$1$ & 1;
    $18 = $17 & $14;
    $19 = ($18|0)==(0);
    if (!($19)) {
     label = 29;
     break;
    }
    $20 = $$1$ & 2;
    $21 = $20 & $14;
    $22 = ($21|0)==(0);
    if (!($22)) {
     label = 30;
     break;
    }
    $23 = $$1$ & 4;
    $24 = ($23|0)==(0);
    if (!($24)) {
     label = 31;
     break;
    }
    _Throw_error(9883);
    return;
   }
   $trunc = $$1$&255;
   $trunc$clear = $trunc & 7;
   switch ($trunc$clear<<24>>24) {
   case 1: case 2: case 4:  {
    $$0$i = $$1$;
    label = 28;
    break L5;
    break;
   }
   default: {
   }
   }
   $25 = $14 & 32;
   $26 = ($25|0)==(0);
   if ($26) {
    $45 = ((($1)) + 8|0);
    $46 = HEAP32[$45>>2]|0;
    $47 = ($46|0)<(0);
    if ($47) {
     _Throw_error(12033);
     return;
    }
    $48 = $$1$ & 1;
    $49 = ($48|0)!=(0);
    $50 = ($46|0)<(256);
    $or$cond31$i = $49 & $50;
    if ($or$cond31$i) {
     label = 29;
     break;
    }
    $51 = $$1$ & 2;
    $52 = ($51|0)!=(0);
    $53 = ($46|0)<(65536);
    $or$cond33$i = $52 & $53;
    if ($or$cond33$i) {
     label = 30;
     break;
    }
    $54 = $$1$ & 4;
    $55 = ($54|0)==(0);
    if (!($55)) {
     label = 31;
     break;
    }
    _Throw_error(9883);
    return;
   }
   $27 = $$1$ & 1;
   $28 = ($27|0)==(0);
   $29 = $14 & 8;
   $30 = ($29|0)==(0);
   $or$cond$i = $28 | $30;
   if ($or$cond$i) {
    $31 = $$1$ & 2;
    $32 = ($31|0)==(0);
    if (!($32)) {
     $33 = $14 & 16;
     $34 = ($33|0)==(0);
     if ($34) {
      label = 30;
      break;
     }
     $35 = ((($1)) + 8|0);
     $36 = HEAP32[$35>>2]|0;
     $$off7$i$i = (($36) + 128)|0;
     $37 = ($$off7$i$i>>>0)<(384);
     if (!($37)) {
      label = 30;
      break;
     }
     _Throw_warning(12000);
     label = 30;
     break;
    }
    $38 = $$1$ & 4;
    $39 = ($38|0)==(0);
    if ($39) {
     label = 29;
    } else {
     $40 = $14 & 16;
     $41 = ($40|0)==(0);
     if ($41) {
      label = 31;
     } else {
      $42 = ((($1)) + 8|0);
      $43 = HEAP32[$42>>2]|0;
      $$off$i$i = (($43) + 32768)|0;
      $44 = ($$off$i$i>>>0)<(98304);
      if ($44) {
       _Throw_warning(12000);
       label = 31;
      } else {
       label = 31;
      }
     }
    }
   } else {
    label = 29;
   }
  } else {
   $12 = $$1$ & $0;
   $13 = ($12|0)==(0);
   if ($13) {
    _Throw_error(11956);
    return;
   } else {
    $$0$i = $0;
    label = 28;
   }
  }
 } while(0);
 L38: do {
  if ((label|0) == 28) {
   switch ($$0$i|0) {
   case 1:  {
    label = 29;
    break L38;
    break;
   }
   case 2:  {
    label = 30;
    break L38;
    break;
   }
   case 4:  {
    label = 31;
    break L38;
    break;
   }
   default: {
   }
   }
   return;
  }
 } while(0);
 if ((label|0) == 29) {
  $56 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$56 & 15]($3);
  $57 = ((($1)) + 8|0);
  $58 = HEAP32[$57>>2]|0;
  _output_8($58);
  return;
 }
 else if ((label|0) == 30) {
  $59 = HEAP32[4659]|0;
  $60 = $2 >>> 8;
  $61 = $60 & 255;
  FUNCTION_TABLE_vi[$59 & 15]($61);
  $62 = ((($1)) + 8|0);
  $63 = HEAP32[$62>>2]|0;
  _output_le16($63);
  return;
 }
 else if ((label|0) == 31) {
  $64 = HEAP32[4659]|0;
  $65 = $2 >>> 16;
  $66 = $65 & 255;
  FUNCTION_TABLE_vi[$64 & 15]($66);
  $67 = ((($1)) + 8|0);
  $68 = HEAP32[$67>>2]|0;
  _output_le24($68);
  return;
 }
}
function _keyword_is_6510mnemo($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(3);
 if (!($1)) {
  $$0 = 0;
  return ($$0|0);
 }
 $2 = HEAP32[4651]|0;
 $3 = HEAP32[4380]|0;
 _DynaBuf_to_lower($2,$3);
 $4 = HEAP32[4653]|0;
 $5 = HEAP32[4651]|0;
 $6 = (_check_mnemo_tree($4,$5)|0);
 $7 = ($6|0)==(0);
 if (!($7)) {
  $$0 = 1;
  return ($$0|0);
 }
 $8 = HEAP32[4654]|0;
 $9 = HEAP32[4651]|0;
 $10 = (_check_mnemo_tree($8,$9)|0);
 $11 = ($10|0)==(0);
 if (!($11)) {
  $$0 = 1;
  return ($$0|0);
 }
 $12 = HEAP32[4652]|0;
 $13 = HEAP32[4651]|0;
 $14 = (_check_mnemo_tree($12,$13)|0);
 $15 = ($14|0)!=(0);
 $16 = $15&1;
 $$0 = $16;
 return ($$0|0);
}
function _keyword_is_c64dtv2mnemo($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(3);
 if (!($1)) {
  $$0 = 0;
  return ($$0|0);
 }
 $2 = HEAP32[4651]|0;
 $3 = HEAP32[4380]|0;
 _DynaBuf_to_lower($2,$3);
 $4 = HEAP32[4655]|0;
 $5 = HEAP32[4651]|0;
 $6 = (_check_mnemo_tree($4,$5)|0);
 $7 = ($6|0)==(0);
 if (!($7)) {
  $$0 = 1;
  return ($$0|0);
 }
 $8 = HEAP32[4653]|0;
 $9 = HEAP32[4651]|0;
 $10 = (_check_mnemo_tree($8,$9)|0);
 $11 = ($10|0)==(0);
 if (!($11)) {
  $$0 = 1;
  return ($$0|0);
 }
 $12 = HEAP32[4652]|0;
 $13 = HEAP32[4651]|0;
 $14 = (_check_mnemo_tree($12,$13)|0);
 $15 = ($14|0)!=(0);
 $16 = $15&1;
 $$0 = $16;
 return ($$0|0);
}
function _keyword_is_65c02mnemo($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(3);
 if (!($1)) {
  $$0 = 0;
  return ($$0|0);
 }
 $2 = HEAP32[4651]|0;
 $3 = HEAP32[4380]|0;
 _DynaBuf_to_lower($2,$3);
 $4 = HEAP32[4656]|0;
 $5 = HEAP32[4651]|0;
 $6 = (_check_mnemo_tree($4,$5)|0);
 $7 = ($6|0)==(0);
 if (!($7)) {
  $$0 = 1;
  return ($$0|0);
 }
 $8 = HEAP32[4652]|0;
 $9 = HEAP32[4651]|0;
 $10 = (_check_mnemo_tree($8,$9)|0);
 $11 = ($10|0)!=(0);
 $12 = $11&1;
 $$0 = $12;
 return ($$0|0);
}
function _keyword_is_65816mnemo($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(3);
 if (!($1)) {
  $$0 = 0;
  return ($$0|0);
 }
 $2 = HEAP32[4651]|0;
 $3 = HEAP32[4380]|0;
 _DynaBuf_to_lower($2,$3);
 $4 = HEAP32[4658]|0;
 $5 = HEAP32[4651]|0;
 $6 = (_check_mnemo_tree($4,$5)|0);
 $7 = ($6|0)==(0);
 if (!($7)) {
  $$0 = 1;
  return ($$0|0);
 }
 $8 = HEAP32[4656]|0;
 $9 = HEAP32[4651]|0;
 $10 = (_check_mnemo_tree($8,$9)|0);
 $11 = ($10|0)==(0);
 if (!($11)) {
  $$0 = 1;
  return ($$0|0);
 }
 $12 = HEAP32[4652]|0;
 $13 = HEAP32[4651]|0;
 $14 = (_check_mnemo_tree($12,$13)|0);
 $15 = ($14|0)==(0);
 if (!($15)) {
  $$0 = 1;
  return ($$0|0);
 }
 $16 = HEAP32[4657]|0;
 $17 = HEAP32[4651]|0;
 $18 = (_check_mnemo_tree($16,$17)|0);
 $19 = ($18|0)!=(0);
 $20 = $19&1;
 $$0 = $20;
 return ($$0|0);
}
function _Output_fake($0) {
 $0 = $0|0;
 var $$0 = 0, $$0$lcssa$i$i = 0, $$0$lcssa$i$i13 = 0, $$05$i$i = 0, $$05$i$i11 = 0, $$lcssa$i$i = 0, $$lcssa$i$i14 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $8 = 0, $9 = 0, $storemerge$i$i = 0, $storemerge$i$i15 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)<(1);
 if ($1) {
  return;
 }
 $2 = HEAP32[4659]|0;
 $3 = ($2|0)==(2|0);
 if ($3) {
  $4 = (($0) + -1)|0;
  _Throw_error(9904);
  HEAP32[4659] = 3;
  $5 = HEAP32[(18644)>>2]|0;
  $6 = HEAP32[(18664)>>2]|0;
  $7 = ($5|0)>($6|0);
  if ($7) {
   $8 = ($5|0)>(65535);
   if ($8) {
    _Throw_serious_error(12105);
    // unreachable;
   }
   $9 = HEAP32[4388]|0;
   $10 = ($9|0)==(0);
   if ($10) {
    _Throw_warning(12129);
    $11 = (($5) + 1)|0;
    $12 = HEAP32[(18672)>>2]|0;
    $13 = (($5) + 2)|0;
    HEAP32[(18680)>>2] = $13;
    $14 = ((($12)) + 8|0);
    $15 = HEAP32[$14>>2]|0;
    $16 = ($15|0)>($11|0);
    if ($16) {
     $$0$lcssa$i$i13 = $12;$$lcssa$i$i14 = $15;
    } else {
     $$05$i$i11 = $12;
     while(1) {
      $17 = HEAP32[$$05$i$i11>>2]|0;
      $18 = ((($17)) + 8|0);
      $19 = HEAP32[$18>>2]|0;
      $20 = ($19|0)>($11|0);
      if ($20) {
       $$0$lcssa$i$i13 = $17;$$lcssa$i$i14 = $19;
       break;
      } else {
       $$05$i$i11 = $17;
      }
     }
    }
    $21 = ($$0$lcssa$i$i13|0)==((18672)|0);
    $22 = (($$lcssa$i$i14) + -1)|0;
    $storemerge$i$i15 = $21 ? 65535 : $22;
    HEAP32[(18664)>>2] = $storemerge$i$i15;
   }
  }
  $23 = HEAP32[(18644)>>2]|0;
  $24 = HEAP32[(18648)>>2]|0;
  $25 = ($23|0)<($24|0);
  if ($25) {
   HEAP32[(18648)>>2] = $23;
  }
  $26 = HEAP32[(18652)>>2]|0;
  $27 = ($23|0)>($26|0);
  if ($27) {
   HEAP32[(18652)>>2] = $23;
  }
  $28 = HEAP32[4387]|0;
  $29 = HEAP32[4099]|0;
  $30 = ($29|0)==(0|0);
  do {
   if (!($30)) {
    $31 = HEAP32[(16408)>>2]|0;
    $32 = ($31|0)==(0);
    if ($32) {
     HEAP32[(16412)>>2] = $23;
    } else {
     $33 = ($31>>>0)<(9);
     if (!($33)) {
      break;
     }
    }
    $34 = (($31) + 1)|0;
    HEAP32[(16408)>>2] = $34;
    $35 = (((($28)) + 1044|0) + ($31)|0);
    HEAP8[$35>>0] = 0;
   }
  } while(0);
  $36 = (($23) + 1)|0;
  HEAP32[(18644)>>2] = $36;
  $37 = HEAP32[4660]|0;
  $38 = (($37) + ($23)|0);
  HEAP8[$38>>0] = 0;
  $39 = HEAP32[(16352)>>2]|0;
  $40 = (($39) + 1)|0;
  HEAP32[(16352)>>2] = $40;
  $$0 = $4;
 } else {
  $$0 = $0;
 }
 $41 = HEAP32[(18644)>>2]|0;
 $42 = (($41) + ($$0))|0;
 $43 = (($42) + -1)|0;
 $44 = HEAP32[(18664)>>2]|0;
 $45 = ($43|0)>($44|0);
 if ($45) {
  $46 = ($43|0)>(65535);
  if ($46) {
   _Throw_serious_error(12105);
   // unreachable;
  }
  $47 = HEAP32[4388]|0;
  $48 = ($47|0)==(0);
  if ($48) {
   _Throw_warning(12129);
   $49 = HEAP32[(18672)>>2]|0;
   $50 = (($42) + 1)|0;
   HEAP32[(18680)>>2] = $50;
   $51 = ((($49)) + 8|0);
   $52 = HEAP32[$51>>2]|0;
   $53 = ($52|0)>($42|0);
   if ($53) {
    $$0$lcssa$i$i = $49;$$lcssa$i$i = $52;
   } else {
    $$05$i$i = $49;
    while(1) {
     $54 = HEAP32[$$05$i$i>>2]|0;
     $55 = ((($54)) + 8|0);
     $56 = HEAP32[$55>>2]|0;
     $57 = ($56|0)>($42|0);
     if ($57) {
      $$0$lcssa$i$i = $54;$$lcssa$i$i = $56;
      break;
     } else {
      $$05$i$i = $54;
     }
    }
   }
   $58 = ($$0$lcssa$i$i|0)==((18672)|0);
   $59 = (($$lcssa$i$i) + -1)|0;
   $storemerge$i$i = $58 ? 65535 : $59;
   HEAP32[(18664)>>2] = $storemerge$i$i;
  }
 }
 $60 = HEAP32[(18644)>>2]|0;
 $61 = HEAP32[(18648)>>2]|0;
 $62 = ($60|0)<($61|0);
 if ($62) {
  HEAP32[(18648)>>2] = $60;
 }
 $63 = (($$0) + -1)|0;
 $64 = (($63) + ($60))|0;
 $65 = HEAP32[(18652)>>2]|0;
 $66 = ($64|0)>($65|0);
 if ($66) {
  HEAP32[(18652)>>2] = $64;
 }
 $67 = (($60) + ($$0))|0;
 HEAP32[(18644)>>2] = $67;
 $68 = HEAP32[(16352)>>2]|0;
 $69 = (($68) + ($$0))|0;
 HEAP32[(16352)>>2] = $69;
 return;
}
function _no_output($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _Throw_error(9904);
 HEAP32[4659] = 3;
 _real_output($0);
 return;
}
function _real_output($0) {
 $0 = $0|0;
 var $$0$lcssa$i$i = 0, $$05$i$i = 0, $$lcssa$i$i = 0, $$pre = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $storemerge$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[(18644)>>2]|0;
 $2 = HEAP32[(18664)>>2]|0;
 $3 = ($1|0)>($2|0);
 if ($3) {
  $4 = ($1|0)>(65535);
  if ($4) {
   _Throw_serious_error(12105);
   // unreachable;
  }
  $5 = HEAP32[4388]|0;
  $6 = ($5|0)==(0);
  if ($6) {
   _Throw_warning(12129);
   $7 = (($1) + 1)|0;
   $8 = HEAP32[(18672)>>2]|0;
   $9 = (($1) + 2)|0;
   HEAP32[(18680)>>2] = $9;
   $10 = ((($8)) + 8|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)>($7|0);
   if ($12) {
    $$0$lcssa$i$i = $8;$$lcssa$i$i = $11;
   } else {
    $$05$i$i = $8;
    while(1) {
     $13 = HEAP32[$$05$i$i>>2]|0;
     $14 = ((($13)) + 8|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>($7|0);
     if ($16) {
      $$0$lcssa$i$i = $13;$$lcssa$i$i = $15;
      break;
     } else {
      $$05$i$i = $13;
     }
    }
   }
   $17 = ($$0$lcssa$i$i|0)==((18672)|0);
   $18 = (($$lcssa$i$i) + -1)|0;
   $storemerge$i$i = $17 ? 65535 : $18;
   HEAP32[(18664)>>2] = $storemerge$i$i;
  }
 }
 $19 = HEAP32[(18644)>>2]|0;
 $20 = HEAP32[(18648)>>2]|0;
 $21 = ($19|0)<($20|0);
 if ($21) {
  HEAP32[(18648)>>2] = $19;
 }
 $22 = HEAP32[(18652)>>2]|0;
 $23 = ($19|0)>($22|0);
 if ($23) {
  HEAP32[(18652)>>2] = $19;
 }
 $24 = HEAP32[4387]|0;
 $25 = HEAP32[4099]|0;
 $26 = ($25|0)==(0|0);
 $$pre = $0&255;
 do {
  if (!($26)) {
   $27 = HEAP32[(16408)>>2]|0;
   $28 = ($27|0)==(0);
   if ($28) {
    HEAP32[(16412)>>2] = $19;
   } else {
    $29 = ($27>>>0)<(9);
    if (!($29)) {
     break;
    }
   }
   $30 = (($27) + 1)|0;
   HEAP32[(16408)>>2] = $30;
   $31 = (((($24)) + 1044|0) + ($27)|0);
   HEAP8[$31>>0] = $$pre;
  }
 } while(0);
 $32 = (($19) + 1)|0;
 HEAP32[(18644)>>2] = $32;
 $33 = HEAP32[4660]|0;
 $34 = (($33) + ($19)|0);
 HEAP8[$34>>0] = $$pre;
 $35 = HEAP32[(16352)>>2]|0;
 $36 = (($35) + 1)|0;
 HEAP32[(16352)>>2] = $36;
 return;
}
function _output_8($0) {
 $0 = $0|0;
 var $$off = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$off = (($0) + 128)|0;
 $1 = ($$off>>>0)<(384);
 if ($1) {
  $2 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$2 & 15]($0);
  return;
 } else {
  _Throw_error(9883);
  return;
 }
}
function _output_be16($0) {
 $0 = $0|0;
 var $$off = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$off = (($0) + 32768)|0;
 $1 = ($$off>>>0)<(98304);
 if ($1) {
  $2 = HEAP32[4659]|0;
  $3 = $0 >> 8;
  FUNCTION_TABLE_vi[$2 & 15]($3);
  $4 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$4 & 15]($0);
  return;
 } else {
  _Throw_error(9883);
  return;
 }
}
function _output_le16($0) {
 $0 = $0|0;
 var $$off = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$off = (($0) + 32768)|0;
 $1 = ($$off>>>0)<(98304);
 if ($1) {
  $2 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$2 & 15]($0);
  $3 = HEAP32[4659]|0;
  $4 = $0 >> 8;
  FUNCTION_TABLE_vi[$3 & 15]($4);
  return;
 } else {
  _Throw_error(9883);
  return;
 }
}
function _output_be24($0) {
 $0 = $0|0;
 var $$off = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$off = (($0) + 8388608)|0;
 $1 = ($$off>>>0)<(25165824);
 if ($1) {
  $2 = HEAP32[4659]|0;
  $3 = $0 >> 16;
  FUNCTION_TABLE_vi[$2 & 15]($3);
  $4 = HEAP32[4659]|0;
  $5 = $0 >> 8;
  FUNCTION_TABLE_vi[$4 & 15]($5);
  $6 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$6 & 15]($0);
  return;
 } else {
  _Throw_error(9883);
  return;
 }
}
function _output_le24($0) {
 $0 = $0|0;
 var $$off = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$off = (($0) + 8388608)|0;
 $1 = ($$off>>>0)<(25165824);
 if ($1) {
  $2 = HEAP32[4659]|0;
  FUNCTION_TABLE_vi[$2 & 15]($0);
  $3 = HEAP32[4659]|0;
  $4 = $0 >> 8;
  FUNCTION_TABLE_vi[$3 & 15]($4);
  $5 = HEAP32[4659]|0;
  $6 = $0 >> 16;
  FUNCTION_TABLE_vi[$5 & 15]($6);
  return;
 } else {
  _Throw_error(9883);
  return;
 }
}
function _output_be32($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[4659]|0;
 $2 = $0 >> 24;
 FUNCTION_TABLE_vi[$1 & 15]($2);
 $3 = HEAP32[4659]|0;
 $4 = $0 >> 16;
 FUNCTION_TABLE_vi[$3 & 15]($4);
 $5 = HEAP32[4659]|0;
 $6 = $0 >> 8;
 FUNCTION_TABLE_vi[$5 & 15]($6);
 $7 = HEAP32[4659]|0;
 FUNCTION_TABLE_vi[$7 & 15]($0);
 return;
}
function _output_le32($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[4659]|0;
 FUNCTION_TABLE_vi[$1 & 15]($0);
 $2 = HEAP32[4659]|0;
 $3 = $0 >> 8;
 FUNCTION_TABLE_vi[$2 & 15]($3);
 $4 = HEAP32[4659]|0;
 $5 = $0 >> 16;
 FUNCTION_TABLE_vi[$4 & 15]($5);
 $6 = HEAP32[4659]|0;
 $7 = $0 >> 24;
 FUNCTION_TABLE_vi[$6 & 15]($7);
 return;
}
function _output_initmem($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[(18656)>>2]|0;
 $2 = ($1|0)==(0);
 if (!($2)) {
  _Throw_warning(12174);
  $$0 = 1;
  return ($$0|0);
 }
 HEAP32[(18656)>>2] = 1;
 $3 = HEAP32[4660]|0;
 _memset(($3|0),($0|0),65536)|0;
 $4 = HEAP32[4390]|0;
 $5 = ($4|0)==(0);
 if (!($5)) {
  $$0 = 0;
  return ($$0|0);
 }
 HEAP32[4390] = 1;
 $$0 = 0;
 return ($$0|0);
}
function _outputfile_set_format() {
 var $$0 = 0, $$pre = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 $1 = HEAP32[4672]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  _Tree_add_table(18688,4088);
  $$pre = HEAP32[4672]|0;
  $4 = $$pre;
 } else {
  $4 = $1;
 }
 $3 = HEAP32[4380]|0;
 $5 = (_Tree_easy_scan($4,$0,$3)|0);
 $6 = ($5|0)==(0);
 if ($6) {
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
 }
 $7 = HEAP32[$0>>2]|0;
 HEAP32[4673] = $7;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _outputfile_prefer_cbm_format() {
 var $$0 = 0, $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4673]|0;
 $1 = ($0|0)==(0);
 if ($1) {
  HEAP32[4673] = 2;
  $$0 = 1;
 } else {
  $$0 = 0;
 }
 return ($$0|0);
}
function _outputfile_set_filename() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4094]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $2 = HEAP32[4380]|0;
  $3 = (_DynaBuf_get_copy($2)|0);
  HEAP32[4094] = $3;
  $$0 = 0;
  return ($$0|0);
 } else {
  _Throw_warning(12214);
  $$0 = 1;
  return ($$0|0);
 }
 return (0)|0;
}
function _Output_init($0) {
 $0 = $0|0;
 var $1 = 0, $not$ = 0, $phitmp2 = 0, $storemerge = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_safe_malloc(65536)|0);
 HEAP32[4660] = $1;
 $phitmp2 = $0&255;
 $not$ = ($0|0)!=(256);
 $storemerge = $not$&1;
 HEAP32[(18656)>>2] = $storemerge;
 _memset(($1|0),($phitmp2|0),65536)|0;
 HEAP32[(18672)>>2] = (18672);
 HEAP32[(18676)>>2] = (18672);
 return;
}
function _Output_save_file($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0;
 var $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = HEAP32[(18652)>>2]|0;
 $2 = HEAP32[(18648)>>2]|0;
 $3 = ($1|0)<($2|0);
 $4 = (($1) + 1)|0;
 $5 = (($4) - ($2))|0;
 $$023 = $3 ? 0 : $2;
 $$0 = $3 ? 0 : $5;
 $6 = HEAP32[4383]|0;
 $7 = ($6|0)==(0);
 if (!($7)) {
  $8 = $3 ? 0 : $4;
  HEAP32[$vararg_buffer>>2] = $$0;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $$0;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $$023;
  $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
  HEAP32[$vararg_ptr3>>2] = $8;
  (_printf(12242,$vararg_buffer)|0);
 }
 $9 = HEAP32[4673]|0;
 switch ($9|0) {
 case 1:  {
  $10 = $$023 & 255;
  (_putc($10,$0)|0);
  $11 = $$023 >> 8;
  (_putc($11,$0)|0);
  $12 = $$0 & 255;
  (_putc($12,$0)|0);
  $13 = $$0 >> 8;
  (_putc($13,$0)|0);
  break;
 }
 case 2:  {
  $14 = $$023 & 255;
  (_putc($14,$0)|0);
  $15 = $$023 >> 8;
  (_putc($15,$0)|0);
  break;
 }
 default: {
 }
 }
 $16 = HEAP32[4660]|0;
 $17 = (($16) + ($$023)|0);
 (_fwrite($17,$$0,1,$0)|0);
 STACKTOP = sp;return;
}
function _Output_passinit() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[(18648)>>2] = 65535;
 HEAP32[(18652)>>2] = 0;
 HEAP32[4659] = 2;
 HEAP32[(18644)>>2] = 0;
 HEAP32[(18660)>>2] = -1;
 HEAP32[(18664)>>2] = 65535;
 HEAP32[(18668)>>2] = 0;
 HEAP32[(16328)>>2] = 0;
 HEAP32[(16336)>>2] = 0;
 HEAP32[(16352)>>2] = 0;
 HEAP32[(16356)>>2] = 0;
 HEAP32[(16360)>>2] = 0;
 return;
}
function _Output_end_segment() {
 var $$0$i = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[4388]|0;
 $1 = ($0|0)==(0);
 if (!($1)) {
  STACKTOP = sp;return;
 }
 $2 = HEAP32[(18660)>>2]|0;
 $3 = ($2|0)==(-1);
 if ($3) {
  STACKTOP = sp;return;
 }
 $4 = HEAP32[(18668)>>2]|0;
 $5 = $4 & 2;
 $6 = ($5|0)==(0);
 if (!($6)) {
  STACKTOP = sp;return;
 }
 $7 = HEAP32[(18644)>>2]|0;
 $8 = (($7) - ($2))|0;
 $9 = ($8|0)==(0);
 if ($9) {
  STACKTOP = sp;return;
 }
 $10 = HEAP32[(18672)>>2]|0;
 $11 = (_safe_malloc(16)|0);
 $12 = ((($11)) + 8|0);
 HEAP32[$12>>2] = $2;
 $13 = ((($11)) + 12|0);
 HEAP32[$13>>2] = $8;
 HEAP32[(18680)>>2] = $2;
 $14 = (($8) + 1)|0;
 HEAP32[(18684)>>2] = $14;
 $15 = HEAP32[$12>>2]|0;
 $$0$i = $10;
 while(1) {
  $16 = ((($$0$i)) + 8|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = ($17|0)<($15|0);
  if (!($18)) {
   $19 = ($17|0)==($15|0);
   if (!($19)) {
    break;
   }
   $20 = ((($$0$i)) + 12|0);
   $21 = HEAP32[$20>>2]|0;
   $22 = HEAP32[$13>>2]|0;
   $23 = ($21|0)<($22|0);
   if (!($23)) {
    break;
   }
  }
  $24 = HEAP32[$$0$i>>2]|0;
  $$0$i = $24;
 }
 HEAP32[$11>>2] = $$0$i;
 $25 = ((($$0$i)) + 4|0);
 $26 = HEAP32[$25>>2]|0;
 $27 = ((($11)) + 4|0);
 HEAP32[$27>>2] = $26;
 HEAP32[$25>>2] = $11;
 $28 = HEAP32[$27>>2]|0;
 HEAP32[$28>>2] = $11;
 $29 = HEAP32[4383]|0;
 $30 = ($29|0)>(1);
 if (!($30)) {
  STACKTOP = sp;return;
 }
 $31 = HEAP32[(18660)>>2]|0;
 $32 = HEAP32[(18644)>>2]|0;
 HEAP32[$vararg_buffer>>2] = $8;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $8;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $31;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $32;
 (_printf(12295,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _vcpu_set_pc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$lcssa$i$i = 0, $$05$i$i = 0, $$07$i$i = 0, $$lcssa$i$i = 0, $$pre$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $storemerge$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[(16336)>>2]|0;
 $3 = (($0) - ($2))|0;
 HEAP32[(16336)>>2] = $0;
 $4 = HEAP32[(16328)>>2]|0;
 $5 = $4 | 16;
 HEAP32[(16328)>>2] = $5;
 HEAP32[(16344)>>2] = 1;
 _Output_end_segment();
 $6 = HEAP32[(18644)>>2]|0;
 $7 = (($3) + ($6))|0;
 $8 = $7 & 65535;
 HEAP32[(18644)>>2] = $8;
 HEAP32[(18660)>>2] = $8;
 HEAP32[(18668)>>2] = $1;
 HEAP32[4659] = 3;
 $9 = HEAP32[4388]|0;
 $10 = ($9|0)==(0);
 if (!($10)) {
  return;
 }
 $11 = $1 & 1;
 $12 = ($11|0)==(0);
 L4: do {
  if ($12) {
   $13 = HEAP32[(18672)>>2]|0;
   $14 = (($8) + 1)|0;
   HEAP32[(18680)>>2] = $14;
   HEAP32[(18684)>>2] = 1;
   $15 = ((($13)) + 8|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = ($16|0)>($8|0);
   if ($17) {
    $29 = $8;
   } else {
    $$07$i$i = $13;$21 = $16;
    while(1) {
     $18 = ((($$07$i$i)) + 12|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = (($19) + ($21))|0;
     $22 = ($20|0)>($8|0);
     if ($22) {
      break;
     }
     $23 = HEAP32[$$07$i$i>>2]|0;
     $24 = ((($23)) + 8|0);
     $25 = HEAP32[$24>>2]|0;
     $26 = ($25|0)>($8|0);
     if ($26) {
      $29 = $8;
      break L4;
     } else {
      $$07$i$i = $23;$21 = $25;
     }
    }
    _Throw_warning(12357);
    $$pre$i = HEAP32[(18660)>>2]|0;
    $29 = $$pre$i;
   }
  } else {
   $29 = $8;
  }
 } while(0);
 $27 = HEAP32[(18672)>>2]|0;
 $28 = (($29) + 1)|0;
 HEAP32[(18680)>>2] = $28;
 $30 = ((($27)) + 8|0);
 $31 = HEAP32[$30>>2]|0;
 $32 = ($31|0)>($29|0);
 if ($32) {
  $$0$lcssa$i$i = $27;$$lcssa$i$i = $31;
 } else {
  $$05$i$i = $27;
  while(1) {
   $33 = HEAP32[$$05$i$i>>2]|0;
   $34 = ((($33)) + 8|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)>($29|0);
   if ($36) {
    $$0$lcssa$i$i = $33;$$lcssa$i$i = $35;
    break;
   } else {
    $$05$i$i = $33;
   }
  }
 }
 $37 = ($$0$lcssa$i$i|0)==((18672)|0);
 $38 = (($$lcssa$i$i) + -1)|0;
 $storemerge$i$i = $37 ? 65535 : $38;
 HEAP32[(18664)>>2] = $storemerge$i$i;
 return;
}
function _vcpu_read_pc($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 ;HEAP32[$0>>2]=HEAP32[(16328)>>2]|0;HEAP32[$0+4>>2]=HEAP32[(16328)+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[(16328)+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[(16328)+12>>2]|0;HEAP32[$0+16>>2]=HEAP32[(16328)+16>>2]|0;HEAP32[$0+20>>2]=HEAP32[(16328)+20>>2]|0;
 return;
}
function _vcpu_get_statement_size() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[(16352)>>2]|0;
 return ($0|0);
}
function _vcpu_end_statement() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[(16336)>>2]|0;
 $1 = HEAP32[(16352)>>2]|0;
 $2 = (($1) + ($0))|0;
 $3 = $2 & 65535;
 HEAP32[(16336)>>2] = $3;
 HEAP32[(16352)>>2] = 0;
 return;
}
function _AnyOS_entry() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_getenv((12408|0))|0);
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = HEAP32[4380]|0;
 $3 = ((($2)) + 4|0);
 HEAP32[$3>>2] = 0;
 _DynaBuf_add_string($2,$0);
 $4 = HEAP32[4380]|0;
 _DynaBuf_append($4,47);
 $5 = HEAP32[4380]|0;
 _DynaBuf_append($5,0);
 $6 = HEAP32[4380]|0;
 $7 = (_DynaBuf_get_copy($6)|0);
 HEAP32[4674] = $7;
 return;
}
function _notreallypo_setpc() {
 var $$0$be = 0, $$0$lcssa = 0, $$06 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 _ALU_defined_int($0);
 $1 = (_Input_accept_comma()|0);
 $2 = ($1|0)==(0);
 L1: do {
  if ($2) {
   $$0$lcssa = 0;
  } else {
   $$06 = 0;
   while(1) {
    $3 = (_Input_read_and_lower_keyword()|0);
    $4 = ($3|0)==(0);
    if ($4) {
     label = 10;
     break;
    }
    $5 = HEAP32[4380]|0;
    $6 = HEAP32[$5>>2]|0;
    $7 = (_strcmp($6,12413)|0);
    $8 = ($7|0)==(0);
    if ($8) {
     $9 = $$06 | 1;
     $$0$be = $9;
    } else {
     $10 = (_strcmp($6,12421)|0);
     $11 = ($10|0)==(0);
     if (!($11)) {
      break;
     }
     $12 = $$06 | 2;
     $$0$be = $12;
    }
    $13 = (_Input_accept_comma()|0);
    $14 = ($13|0)==(0);
    if ($14) {
     $$0$lcssa = $$0$be;
     break L1;
    } else {
     $$06 = $$0$be;
    }
   }
   if ((label|0) == 10) {
    STACKTOP = sp;return;
   }
   _Throw_error(12431);
   STACKTOP = sp;return;
  }
 } while(0);
 $15 = ((($0)) + 8|0);
 $16 = HEAP32[$15>>2]|0;
 _vcpu_set_pc($16,$$0$lcssa);
 STACKTOP = sp;return;
}
function _pseudoopcodes_init() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_DynaBuf_create(80)|0);
 HEAP32[4675] = $0;
 _Tree_add_table(18704,4148);
 return;
}
function _po_initmem() {
 var $$ = 0, $$0 = 0, $$off = 0, $$pre = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 $1 = HEAP32[4388]|0;
 $2 = ($1|0)==(0);
 if (!($2)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 _ALU_defined_int($0);
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $$off = (($4) + 128)|0;
 $5 = ($$off>>>0)>(383);
 if ($5) {
  _Throw_error(9883);
  $$pre = HEAP32[$3>>2]|0;
  $7 = $$pre;
 } else {
  $7 = $4;
 }
 $6 = $7&255;
 $8 = (_output_initmem($6)|0);
 $9 = ($8|0)==(0);
 $$ = $9&1;
 $$0 = $$;
 STACKTOP = sp;return ($$0|0);
}
function _po_to() {
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_Input_read_filename(0)|0);
 $1 = HEAP32[4388]|0;
 $2 = $1 | $0;
 $3 = ($2|0)==(0);
 do {
  if ($3) {
   $4 = (_outputfile_set_filename()|0);
   $5 = ($4|0)==(0);
   if ($5) {
    $6 = (_Input_accept_comma()|0);
    $7 = ($6|0)==(0);
    if ($7) {
     $8 = (_outputfile_prefer_cbm_format()|0);
     $9 = ($8|0)==(0);
     if ($9) {
      $$0 = 1;
      break;
     }
     _Throw_warning(13289);
     $$0 = 1;
     break;
    }
    $10 = (_Input_read_and_lower_keyword()|0);
    $11 = ($10|0)==(0);
    if ($11) {
     $$0 = 0;
    } else {
     $12 = (_outputfile_set_format()|0);
     $13 = ($12|0)==(0);
     if ($13) {
      $$0 = 1;
     } else {
      _Throw_error(13352);
      $$0 = 0;
     }
    }
   } else {
    $$0 = 0;
   }
  } else {
   $$0 = 0;
  }
 } while(0);
 return ($$0|0);
}
function _po_byte() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 while(1) {
  $0 = (_ALU_any_int()|0);
  _output_8($0);
  $1 = (_Input_accept_comma()|0);
  $2 = ($1|0)==(0);
  if ($2) {
   break;
  }
 }
 return 1;
}
function _po_16() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4080]|0;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = $2 & 8;
 $4 = ($3|0)!=(0);
 $5 = $4 ? 5 : 4;
 while(1) {
  $6 = (_ALU_any_int()|0);
  FUNCTION_TABLE_vi[$5 & 15]($6);
  $7 = (_Input_accept_comma()|0);
  $8 = ($7|0)==(0);
  if ($8) {
   break;
  }
 }
 return 1;
}
function _po_be16() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 while(1) {
  $0 = (_ALU_any_int()|0);
  _output_be16($0);
  $1 = (_Input_accept_comma()|0);
  $2 = ($1|0)==(0);
  if ($2) {
   break;
  }
 }
 return 1;
}
function _po_le16() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 while(1) {
  $0 = (_ALU_any_int()|0);
  _output_le16($0);
  $1 = (_Input_accept_comma()|0);
  $2 = ($1|0)==(0);
  if ($2) {
   break;
  }
 }
 return 1;
}
function _po_24() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4080]|0;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = $2 & 8;
 $4 = ($3|0)!=(0);
 $5 = $4 ? 7 : 6;
 while(1) {
  $6 = (_ALU_any_int()|0);
  FUNCTION_TABLE_vi[$5 & 15]($6);
  $7 = (_Input_accept_comma()|0);
  $8 = ($7|0)==(0);
  if ($8) {
   break;
  }
 }
 return 1;
}
function _po_be24() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 while(1) {
  $0 = (_ALU_any_int()|0);
  _output_be24($0);
  $1 = (_Input_accept_comma()|0);
  $2 = ($1|0)==(0);
  if ($2) {
   break;
  }
 }
 return 1;
}
function _po_le24() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 while(1) {
  $0 = (_ALU_any_int()|0);
  _output_le24($0);
  $1 = (_Input_accept_comma()|0);
  $2 = ($1|0)==(0);
  if ($2) {
   break;
  }
 }
 return 1;
}
function _po_32() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4080]|0;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = $2 & 8;
 $4 = ($3|0)!=(0);
 $5 = $4 ? 9 : 8;
 while(1) {
  $6 = (_ALU_any_int()|0);
  FUNCTION_TABLE_vi[$5 & 15]($6);
  $7 = (_Input_accept_comma()|0);
  $8 = ($7|0)==(0);
  if ($8) {
   break;
  }
 }
 return 1;
}
function _po_be32() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 while(1) {
  $0 = (_ALU_any_int()|0);
  _output_be32($0);
  $1 = (_Input_accept_comma()|0);
  $2 = ($1|0)==(0);
  if ($2) {
   break;
  }
 }
 return 1;
}
function _po_le32() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 while(1) {
  $0 = (_ALU_any_int()|0);
  _output_le32($0);
  $1 = (_Input_accept_comma()|0);
  $2 = ($1|0)==(0);
  if ($2) {
   break;
  }
 }
 return 1;
}
function _obsolete_po_cbm() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 _Throw_error(13246);
 return 1;
}
function _po_convtab() {
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0;
 $0 = sp;
 $1 = HEAP8[20560]|0;
 switch ($1<<24>>24) {
 case 34: case 60:  {
  $2 = (_Input_read_filename(1)|0);
  $3 = ($2|0)==(0);
  if (!($3)) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
  $4 = HEAP32[222]|0;
  $5 = HEAP32[4381]|0;
  $6 = HEAP32[4380]|0;
  $7 = HEAP32[$6>>2]|0;
  _encoding_load($0,$7);
  HEAP32[4381] = 904;
  HEAP32[222] = $0;
  $8 = (_Parse_optional_block()|0);
  $9 = ($8|0)==(0);
  if ($9) {
   _memcpy(($4|0),($0|0),256)|0;
  } else {
   HEAP32[4381] = $5;
  }
  HEAP32[222] = $4;
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
  break;
 }
 default: {
  $10 = HEAP32[222]|0;
  $11 = HEAP32[4381]|0;
  $12 = (_Input_read_and_lower_keyword()|0);
  $13 = ($12|0)==(0);
  if (!($13)) {
   $14 = (_encoding_find()|0);
   $15 = ($14|0)==(0|0);
   if (!($15)) {
    HEAP32[4381] = $14;
   }
  }
  HEAP32[222] = $0;
  $16 = (_Parse_optional_block()|0);
  $17 = ($16|0)==(0);
  if (!($17)) {
   HEAP32[4381] = $11;
  }
  HEAP32[222] = $10;
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
 }
 }
 return (0)|0;
}
function _po_text() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4381]|0;
 $1 = (_encode_string($0,0)|0);
 return ($1|0);
}
function _po_raw() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_encode_string(892,0)|0);
 return ($0|0);
}
function _po_pet() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_encode_string(896,0)|0);
 return ($0|0);
}
function _po_scr() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_encode_string(900,0)|0);
 return ($0|0);
}
function _po_scrxor() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_ALU_any_int()|0);
 $1 = (_Input_accept_comma()|0);
 $2 = ($1|0)==(0);
 if ($2) {
  _Throw_error(9931);
  $$0 = 0;
  return ($$0|0);
 } else {
  $3 = $0&255;
  $4 = (_encode_string(900,$3)|0);
  $$0 = $4;
  return ($$0|0);
 }
 return (0)|0;
}
function _po_binary() {
 var $$0 = 0, $$pr = 0, $$pre$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond5 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $0 = sp + 20|0;
 $1 = sp + 16|0;
 HEAP32[$0>>2] = -1;
 HEAP32[$1>>2] = 0;
 $2 = (_Input_read_filename(1)|0);
 $3 = ($2|0)==(0);
 if (!($3)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $4 = HEAP32[4380]|0;
 $5 = HEAP32[$4>>2]|0;
 $6 = (_fopen($5,10371)|0);
 $7 = ($6|0)==(0|0);
 if ($7) {
  _Throw_error(9780);
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $8 = (_Input_accept_comma()|0);
 $9 = ($8|0)==(0);
 if (!($9)) {
  $10 = (_ALU_optional_defined_int($0)|0);
  $11 = ($10|0)!=(0);
  $12 = HEAP32[$0>>2]|0;
  $13 = ($12|0)<(0);
  $or$cond = $11 & $13;
  if ($or$cond) {
   _Throw_serious_error(13143);
   // unreachable;
  }
  $14 = (_Input_accept_comma()|0);
  $15 = ($14|0)==(0);
  if (!($15)) {
   (_ALU_optional_defined_int($1)|0);
  }
 }
 $16 = HEAP32[$0>>2]|0;
 $17 = ($16|0)>(-1);
 if ($17) {
  $18 = HEAP32[4390]|0;
  $19 = HEAP32[4389]|0;
  $20 = $19 | $18;
  $21 = ($20|0)==(0);
  if ($21) {
   label = 12;
  } else {
   _Output_fake($16);
  }
 } else {
  label = 12;
 }
 L18: do {
  if ((label|0) == 12) {
   $22 = HEAP32[$1>>2]|0;
   (_fseek($6,$22,0)|0);
   $$pr = HEAP32[$0>>2]|0;
   $23 = ($$pr|0)==(0);
   if (!($23)) {
    while(1) {
     $24 = (_getc($6)|0);
     $25 = ($24|0)==(-1);
     if ($25) {
      break;
     }
     $26 = HEAP32[4659]|0;
     FUNCTION_TABLE_vi[$26 & 15]($24);
     $27 = HEAP32[$0>>2]|0;
     $28 = (($27) + -1)|0;
     HEAP32[$0>>2] = $28;
     $29 = ($28|0)==(0);
     if ($29) {
      break L18;
     }
    }
    $$pre$pre = HEAP32[$0>>2]|0;
    $30 = ($$pre$pre|0)>(0);
    if ($30) {
     _Throw_warning(13167);
     while(1) {
      $31 = HEAP32[4659]|0;
      FUNCTION_TABLE_vi[$31 & 15](0);
      $32 = HEAP32[$0>>2]|0;
      $33 = (($32) + -1)|0;
      HEAP32[$0>>2] = $33;
      $34 = ($33|0)==(0);
      if ($34) {
       break;
      }
     }
    }
   }
  }
 } while(0);
 (_fclose($6)|0);
 $35 = HEAP32[4388]|0;
 $36 = ($35|0)==(0);
 $37 = HEAP32[4383]|0;
 $38 = ($37|0)>(1);
 $or$cond5 = $36 & $38;
 if (!($or$cond5)) {
  $$0 = 1;
  STACKTOP = sp;return ($$0|0);
 }
 $39 = (_vcpu_get_statement_size()|0);
 $40 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $39;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $39;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $40;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $40;
 (_printf(13188,$vararg_buffer)|0);
 $$0 = 1;
 STACKTOP = sp;return ($$0|0);
}
function _po_fill() {
 var $$0$ph = 0, $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 _ALU_defined_int($0);
 $1 = (_Input_accept_comma()|0);
 $2 = ($1|0)==(0);
 if ($2) {
  $$0$ph = 0;
 } else {
  $3 = (_ALU_any_int()|0);
  $$0$ph = $3;
 }
 $4 = ((($0)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (($5) + -1)|0;
 HEAP32[$4>>2] = $6;
 $7 = ($5|0)==(0);
 if ($7) {
  STACKTOP = sp;return 1;
 }
 while(1) {
  _output_8($$0$ph);
  $8 = HEAP32[$4>>2]|0;
  $9 = (($8) + -1)|0;
  HEAP32[$4>>2] = $9;
  $10 = ($8|0)==(0);
  if ($10) {
   break;
  }
 }
 STACKTOP = sp;return 1;
}
function _po_align() {
 var $$06$ph = 0, $$07 = 0, $$08 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $0 = sp + 24|0;
 $1 = sp;
 $2 = HEAP32[(16336)>>2]|0;
 $3 = HEAP32[(16328)>>2]|0;
 $4 = $3 & 16;
 $5 = ($4|0)==(0);
 if ($5) {
  _Throw_error(9904);
  $6 = HEAP32[(16328)>>2]|0;
  $7 = $6 | 16;
  HEAP32[(16328)>>2] = $7;
  $$07 = 0;
  STACKTOP = sp;return ($$07|0);
 }
 _ALU_defined_int($0);
 $8 = (_Input_accept_comma()|0);
 $9 = ($8|0)==(0);
 if ($9) {
  _Throw_error(9931);
 }
 _ALU_defined_int($1);
 $10 = (_Input_accept_comma()|0);
 $11 = ($10|0)==(0);
 if ($11) {
  $13 = HEAP32[4080]|0;
  $14 = ((($13)) + 8|0);
  $15 = HEAP8[$14>>0]|0;
  $16 = $15 << 24 >> 24;
  $$06$ph = $16;
 } else {
  $12 = (_ALU_any_int()|0);
  $$06$ph = $12;
 }
 $17 = ((($0)) + 8|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = $18 & $2;
 $20 = ((($1)) + 8|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = ($19|0)==($21|0);
 if ($22) {
  $$07 = 1;
  STACKTOP = sp;return ($$07|0);
 } else {
  $$08 = $2;
 }
 while(1) {
  $23 = (($$08) + 1)|0;
  _output_8($$06$ph);
  $24 = HEAP32[$17>>2]|0;
  $25 = $24 & $23;
  $26 = HEAP32[$20>>2]|0;
  $27 = ($25|0)==($26|0);
  if ($27) {
   $$07 = 1;
   break;
  } else {
   $$08 = $23;
  }
 }
 STACKTOP = sp;return ($$07|0);
}
function _po_pseudopc() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 $1 = HEAP32[(16328)>>2]|0;
 _ALU_defined_int($0);
 $2 = ((($0)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = HEAP32[(16336)>>2]|0;
 HEAP32[(16336)>>2] = $3;
 $5 = HEAP32[(16328)>>2]|0;
 $6 = $5 | 16;
 HEAP32[(16328)>>2] = $6;
 $7 = (_Parse_optional_block()|0);
 $8 = ($7|0)==(0);
 if ($8) {
  _Throw_error(13082);
  STACKTOP = sp;return 1;
 } else {
  $9 = HEAP32[(16336)>>2]|0;
  $10 = (($4) - ($3))|0;
  $11 = (($10) + ($9))|0;
  $12 = $11 & 65535;
  HEAP32[(16336)>>2] = $12;
  HEAP32[(16328)>>2] = $1;
  STACKTOP = sp;return 1;
 }
 return (0)|0;
}
function _obsolete_po_realpc() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 _Throw_error(13082);
 return 1;
}
function _po_cpu() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4080]|0;
 $1 = (_Input_read_and_lower_keyword()|0);
 $2 = ($1|0)==(0);
 do {
  if (!($2)) {
   $3 = (_cputype_find()|0);
   $4 = ($3|0)==(0|0);
   if ($4) {
    _Throw_error(13063);
    break;
   } else {
    HEAP32[4080] = $3;
    break;
   }
  }
 } while(0);
 $5 = (_Parse_optional_block()|0);
 $6 = ($5|0)==(0);
 if ($6) {
  return 1;
 }
 HEAP32[4080] = $0;
 return 1;
}
function _po_al() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[(16356)>>2]|0;
 _vcpu_check_and_set_reg_length((16356),1);
 $1 = (_Parse_optional_block()|0);
 $2 = ($1|0)==(0);
 if ($2) {
  return 1;
 }
 _vcpu_check_and_set_reg_length((16356),$0);
 return 1;
}
function _po_as() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[(16356)>>2]|0;
 _vcpu_check_and_set_reg_length((16356),0);
 $1 = (_Parse_optional_block()|0);
 $2 = ($1|0)==(0);
 if ($2) {
  return 1;
 }
 _vcpu_check_and_set_reg_length((16356),$0);
 return 1;
}
function _po_rl() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[(16360)>>2]|0;
 _vcpu_check_and_set_reg_length((16360),1);
 $1 = (_Parse_optional_block()|0);
 $2 = ($1|0)==(0);
 if ($2) {
  return 1;
 }
 _vcpu_check_and_set_reg_length((16360),$0);
 return 1;
}
function _po_rs() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[(16360)>>2]|0;
 _vcpu_check_and_set_reg_length((16360),0);
 $1 = (_Parse_optional_block()|0);
 $2 = ($1|0)==(0);
 if ($2) {
  return 1;
 }
 _vcpu_check_and_set_reg_length((16360),$0);
 return 1;
}
function _po_address() {
 var $$0 = 0, $$pr = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[20560]|0;
 $1 = ($0<<24>>24)==(32);
 if ($1) {
  (_GetByte()|0);
  $$pr = HEAP8[20560]|0;
  $2 = $$pr;
 } else {
  $2 = $0;
 }
 $3 = ($2<<24>>24)==(123);
 if ($3) {
  _typesystem_force_address_block();
  $$0 = 1;
  return ($$0|0);
 } else {
  _typesystem_force_address_statement(1);
  $$0 = 2;
  return ($$0|0);
 }
 return (0)|0;
}
function _po_set() {
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 $1 = sp + 24|0;
 $2 = (_Input_read_scope_and_keyword($1)|0);
 $3 = ($2|0)==(0);
 if ($3) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $4 = (_Input_get_force_bit()|0);
 $5 = HEAP32[$1>>2]|0;
 $6 = (_symbol_find($5,$4)|0);
 $7 = HEAP8[20560]|0;
 $8 = ($7<<24>>24)==(61);
 if (!($8)) {
  _Throw_error(9931);
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 (_GetByte()|0);
 _ALU_any_result($0);
 $9 = HEAP32[$6>>2]|0;
 $10 = $9 & -16;
 HEAP32[$6>>2] = $10;
 $11 = ($4|0)==(0);
 if (!($11)) {
  $12 = $10 | $4;
  HEAP32[$6>>2] = $12;
  $13 = HEAP32[$0>>2]|0;
  $14 = $13 & -16;
  HEAP32[$0>>2] = $14;
 }
 _symbol_set_value($6,$0,1);
 $$0 = 1;
 STACKTOP = sp;return ($$0|0);
}
function _po_symbollist() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_Input_read_filename(0)|0);
 $1 = HEAP32[4388]|0;
 $2 = $1 | $0;
 $3 = ($2|0)==(0);
 if (!($3)) {
  $$0 = 0;
  return ($$0|0);
 }
 $4 = HEAP32[4092]|0;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $6 = HEAP32[4380]|0;
  $7 = (_DynaBuf_get_copy($6)|0);
  HEAP32[4092] = $7;
  $$0 = 1;
  return ($$0|0);
 } else {
  _Throw_warning(13025);
  $$0 = 0;
  return ($$0|0);
 }
 return (0)|0;
}
function _po_zone() {
 var $$0 = 0, $$04 = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 $1 = HEAP32[1337]|0;
 ;HEAP32[$0>>2]=HEAP32[$1>>2]|0;HEAP32[$0+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$1+12>>2]|0;
 $2 = HEAP8[20560]|0;
 $3 = $2&255;
 $4 = (9945 + ($3)|0);
 $5 = HEAP8[$4>>0]|0;
 $6 = $5 & 64;
 $7 = ($6<<24>>24)==(0);
 if ($7) {
  $$0 = 0;$$04 = 9744;$10 = $1;
 } else {
  (_Input_read_keyword()|0);
  $8 = HEAP32[4380]|0;
  $9 = (_DynaBuf_get_copy($8)|0);
  $$pre = HEAP32[1337]|0;
  $$0 = 1;$$04 = $9;$10 = $$pre;
 }
 _section_new($10,13017,$$04,$$0);
 $11 = (_Parse_optional_block()|0);
 $12 = ($11|0)==(0);
 if ($12) {
  _section_finalize($0);
  $15 = HEAP32[1337]|0;
  $16 = ((($15)) + 4|0);
  HEAP32[$16>>2] = 9755;
  STACKTOP = sp;return 1;
 } else {
  $13 = HEAP32[1337]|0;
  _section_finalize($13);
  $14 = HEAP32[1337]|0;
  ;HEAP32[$14>>2]=HEAP32[$0>>2]|0;HEAP32[$14+4>>2]=HEAP32[$0+4>>2]|0;HEAP32[$14+8>>2]=HEAP32[$0+8>>2]|0;HEAP32[$14+12>>2]=HEAP32[$0+12>>2]|0;
  STACKTOP = sp;return 1;
 }
 return (0)|0;
}
function _obsolete_po_subzone() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 _Throw_error(12966);
 (_po_zone()|0);
 return 1;
}
function _po_source() {
 var $$0 = 0, $$alloca_mul = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 $1 = HEAP32[3]|0;
 $2 = (($1) + -1)|0;
 HEAP32[3] = $2;
 $3 = ($1|0)<(1);
 if ($3) {
  _Throw_serious_error(12926);
  // unreachable;
 }
 $4 = (_Input_read_filename(1)|0);
 $5 = ($4|0)==(0);
 if (!($5)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $6 = HEAP32[4380]|0;
 $7 = HEAP32[$6>>2]|0;
 $8 = (_fopen($7,10371)|0);
 $9 = ($8|0)==(0|0);
 if ($9) {
  _Throw_error(9780);
 } else {
  $10 = HEAP32[4380]|0;
  $11 = ((($10)) + 4|0);
  $12 = HEAP32[$11>>2]|0;
  $13 = (_llvm_stacksave()|0);
  $$alloca_mul = $12;
  $14 = STACKTOP; STACKTOP = STACKTOP + ((((1*$$alloca_mul)|0)+15)&-16)|0;;
  $15 = HEAP32[4380]|0;
  $16 = HEAP32[$15>>2]|0;
  (_strcpy($14,$16)|0);
  $17 = HEAP32[245]|0;
  $18 = HEAP8[20560]|0;
  HEAP32[245] = $0;
  _flow_parse_and_close_file($8,$14);
  HEAP32[245] = $17;
  HEAP8[20560] = $18;
  _llvm_stackrestore(($13|0));
 }
 $19 = HEAP32[3]|0;
 $20 = (($19) + 1)|0;
 HEAP32[3] = $20;
 $$0 = 1;
 STACKTOP = sp;return ($$0|0);
}
function _po_if() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 _ALU_defined_int($0);
 $1 = HEAP8[20560]|0;
 $2 = ($1<<24>>24)==(123);
 if ($2) {
  $3 = ((($0)) + 8|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = ($4|0)!=(0);
  $6 = $5&1;
  _flow_parse_block_else_block($6);
  STACKTOP = sp;return 1;
 } else {
  _Throw_serious_error(9821);
  // unreachable;
 }
 return (0)|0;
}
function _po_ifdef() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_ifdef_ifndef(0)|0);
 return ($0|0);
}
function _po_ifndef() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_ifdef_ifndef(1)|0);
 return ($0|0);
}
function _po_for() {
 var $$0 = 0, $$pre = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $0 = sp + 56|0;
 $1 = sp;
 $2 = sp + 24|0;
 $3 = (_Input_read_scope_and_keyword($0)|0);
 $4 = ($3|0)==(0);
 if ($4) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $5 = (_Input_get_force_bit()|0);
 $6 = HEAP32[$0>>2]|0;
 $7 = (_symbol_find($6,$5)|0);
 HEAP32[$2>>2] = $7;
 $8 = (_Input_accept_comma()|0);
 $9 = ($8|0)==(0);
 if ($9) {
  _Throw_error(9931);
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 _ALU_defined_int($1);
 $10 = ((($1)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($2)) + 8|0);
 $13 = ((($2)) + 20|0);
 HEAP32[$13>>2] = $11;
 $14 = (_Input_accept_comma()|0);
 $15 = ($14|0)==(0);
 $16 = ((($2)) + 4|0);
 do {
  if ($15) {
   HEAP32[$16>>2] = 1;
   $33 = HEAP32[243]|0;
   $34 = ($33|0)==(0);
   if (!($34)) {
    _Throw_first_pass_warning(12877);
   }
   $35 = ((($1)) + 8|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = ($36|0)<(0);
   if ($37) {
    _Throw_serious_error(12902);
    // unreachable;
   } else {
    HEAP32[$12>>2] = 0;
    $38 = ((($2)) + 12|0);
    HEAP32[$38>>2] = $36;
    $39 = ((($2)) + 16|0);
    HEAP32[$39>>2] = 1;
    break;
   }
  } else {
   HEAP32[$16>>2] = 0;
   $17 = HEAP32[243]|0;
   $18 = ($17|0)==(0);
   if ($18) {
    _Throw_first_pass_warning(12786);
   }
   $19 = ((($1)) + 8|0);
   $20 = HEAP32[$19>>2]|0;
   HEAP32[$12>>2] = $20;
   _ALU_defined_int($1);
   $21 = HEAP32[$19>>2]|0;
   $22 = ((($2)) + 12|0);
   HEAP32[$22>>2] = $21;
   $23 = HEAP32[4384]|0;
   $24 = ($23|0)==(0);
   if ($24) {
    $29 = $21;
   } else {
    $25 = HEAP32[$10>>2]|0;
    $26 = HEAP32[$13>>2]|0;
    $27 = ($25|0)==($26|0);
    if ($27) {
     $29 = $21;
    } else {
     _Throw_first_pass_warning(12811);
     $$pre = HEAP32[$22>>2]|0;
     $29 = $$pre;
    }
   }
   $28 = HEAP32[$12>>2]|0;
   $30 = ($29|0)<($28|0);
   $31 = $30 ? -1 : 1;
   $32 = ((($2)) + 16|0);
   HEAP32[$32>>2] = $31;
  }
 } while(0);
 $40 = HEAP8[20560]|0;
 $41 = ($40<<24>>24)==(123);
 if (!($41)) {
  _Throw_serious_error(9821);
  // unreachable;
 }
 $42 = HEAP32[245]|0;
 $43 = ((($42)) + 4|0);
 $44 = HEAP32[$43>>2]|0;
 $45 = ((($2)) + 24|0);
 HEAP32[$45>>2] = $44;
 $46 = (_Input_skip_or_store_block(1)|0);
 $47 = ((($2)) + 28|0);
 HEAP32[$47>>2] = $46;
 _flow_forloop($2);
 $48 = HEAP32[$47>>2]|0;
 _free($48);
 (_GetByte()|0);
 $$0 = 1;
 STACKTOP = sp;return ($$0|0);
}
function _po_do() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp;
 $1 = HEAP8[20560]|0;
 $2 = ($1<<24>>24)==(32);
 if ($2) {
  (_GetByte()|0);
 }
 _flow_store_doloop_condition($0,123);
 $3 = HEAP8[20560]|0;
 $4 = ($3<<24>>24)==(123);
 if (!($4)) {
  _Throw_serious_error(9821);
  // unreachable;
 }
 $5 = HEAP32[245]|0;
 $6 = ((($5)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($0)) + 12|0);
 HEAP32[$8>>2] = $7;
 $9 = (_Input_skip_or_store_block(1)|0);
 $10 = ((($0)) + 16|0);
 HEAP32[$10>>2] = $9;
 $11 = (_GetByte()|0);
 $12 = ($11<<24>>24)==(32);
 if ($12) {
  (_GetByte()|0);
 }
 $13 = ((($0)) + 20|0);
 _flow_store_doloop_condition($13,0);
 _flow_doloop($0);
 $14 = ((($0)) + 8|0);
 $15 = HEAP32[$14>>2]|0;
 _free($15);
 $16 = HEAP32[$10>>2]|0;
 _free($16);
 $17 = ((($0)) + 28|0);
 $18 = HEAP32[$17>>2]|0;
 _free($18);
 STACKTOP = sp;return 3;
}
function _po_macro() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4388]|0;
 $1 = ($0|0)==(0);
 if ($1) {
  _Macro_parse_definition();
  (_GetByte()|0);
  return 1;
 }
 $2 = HEAP8[20560]|0;
 $3 = ($2<<24>>24)==(123);
 if (!($3)) {
  while(1) {
   (_GetByte()|0);
   $4 = HEAP8[20560]|0;
   $5 = ($4<<24>>24)==(123);
   if ($5) {
    break;
   }
  }
 }
 (_Input_skip_or_store_block(0)|0);
 (_GetByte()|0);
 return 1;
}
function _po_warn() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_throw_string(12778,10)|0);
 return ($0|0);
}
function _po_error() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_throw_string(12769,1)|0);
 return ($0|0);
}
function _po_serious() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_throw_string(12706,11)|0);
 return ($0|0);
}
function _po_endoffile() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _Input_ensure_EOS();
 $0 = HEAP32[245]|0;
 $1 = ((($0)) + 12|0);
 HEAP32[$1>>2] = 8;
 return 3;
}
function _throw_string($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$phi$trans$insert = 0, $$pre = 0, $$pre2 = 0, $$pre3 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0.0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $vararg_buffer1 = sp + 32|0;
 $vararg_buffer = sp + 24|0;
 $2 = sp;
 $3 = sp + 40|0;
 $4 = HEAP32[4675]|0;
 $5 = ((($4)) + 4|0);
 HEAP32[$5>>2] = 0;
 _DynaBuf_add_string($4,$0);
 $6 = ((($2)) + 8|0);
 $7 = ((($2)) + 8|0);
 L1: while(1) {
  $8 = HEAP8[20560]|0;
  $9 = ($8<<24>>24)==(34);
  do {
   if ($9) {
    (_GetQuotedByte()|0);
    L5: while(1) {
     $10 = HEAP8[20560]|0;
     switch ($10<<24>>24) {
     case 0:  {
      $$0 = 3;
      label = 18;
      break L1;
      break;
     }
     case 34:  {
      break L5;
      break;
     }
     default: {
     }
     }
     $11 = HEAP32[4675]|0;
     $12 = ((($11)) + 4|0);
     $13 = HEAP32[$12>>2]|0;
     $14 = ((($11)) + 8|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($13|0)==($15|0);
     if ($16) {
      _DynaBuf_enlarge($11);
      $$pre = HEAP8[20560]|0;
      $$pre2 = HEAP32[4675]|0;
      $$phi$trans$insert = ((($$pre2)) + 4|0);
      $$pre3 = HEAP32[$$phi$trans$insert>>2]|0;
      $18 = $$pre2;$20 = $$pre3;$23 = $$pre;
     } else {
      $18 = $11;$20 = $13;$23 = $10;
     }
     $17 = ((($18)) + 4|0);
     $19 = (($20) + 1)|0;
     HEAP32[$17>>2] = $19;
     $21 = HEAP32[$18>>2]|0;
     $22 = (($21) + ($20)|0);
     HEAP8[$22>>0] = $23;
     (_GetQuotedByte()|0);
    }
    (_GetByte()|0);
   } else {
    _ALU_any_result($2);
    $24 = HEAP32[$2>>2]|0;
    $25 = $24 & 256;
    $26 = ($25|0)==(0);
    $27 = $24 & 16;
    $28 = ($27|0)!=(0);
    if ($26) {
     if ($28) {
      $32 = HEAP32[$6>>2]|0;
      HEAP32[$vararg_buffer1>>2] = $32;
      $vararg_ptr4 = ((($vararg_buffer1)) + 4|0);
      HEAP32[$vararg_ptr4>>2] = $32;
      (_sprintf($3,12741,$vararg_buffer1)|0);
      $33 = HEAP32[4675]|0;
      _DynaBuf_add_string($33,$3);
      break;
     } else {
      $34 = HEAP32[4675]|0;
      _DynaBuf_add_string($34,12753);
      break;
     }
    } else {
     if ($28) {
      $29 = +HEAPF64[$7>>3];
      HEAPF64[$vararg_buffer>>3] = $29;
      (_sprintf($3,12717,$vararg_buffer)|0);
      $30 = HEAP32[4675]|0;
      _DynaBuf_add_string($30,$3);
      break;
     } else {
      $31 = HEAP32[4675]|0;
      _DynaBuf_add_string($31,12723);
      break;
     }
    }
   }
  } while(0);
  $35 = (_Input_accept_comma()|0);
  $36 = ($35|0)==(0);
  if ($36) {
   break;
  }
 }
 if ((label|0) == 18) {
  STACKTOP = sp;return ($$0|0);
 }
 $37 = HEAP32[4675]|0;
 _DynaBuf_append($37,0);
 $38 = HEAP32[4675]|0;
 $39 = HEAP32[$38>>2]|0;
 FUNCTION_TABLE_vi[$1 & 15]($39);
 $$0 = 1;
 STACKTOP = sp;return ($$0|0);
}
function _ifdef_ifndef($0) {
 $0 = $0|0;
 var $$0 = 0, $$0$ = 0, $$08 = 0, $$lobit = 0, $$pr = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp + 4|0;
 $2 = sp;
 $3 = (_Input_read_scope_and_keyword($2)|0);
 $4 = ($3|0)==(0);
 if ($4) {
  $$08 = 0;
  STACKTOP = sp;return ($$08|0);
 }
 $5 = HEAP32[$2>>2]|0;
 (_Tree_hard_scan($1,18728,$5,0)|0);
 $6 = HEAP32[$1>>2]|0;
 $7 = ($6|0)==(0|0);
 if ($7) {
  $$0 = 0;
 } else {
  $8 = ((($6)) + 16|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = HEAP32[4388]|0;
  $11 = ($10|0)==(0);
  if ($11) {
   $12 = ((($9)) + 24|0);
   $13 = HEAP32[$12>>2]|0;
   $14 = (($13) + 1)|0;
   HEAP32[$12>>2] = $14;
  }
  $15 = HEAP32[$9>>2]|0;
  $16 = $15 >>> 4;
  $$lobit = $16 & 1;
  $$0 = $$lobit;
 }
 $17 = HEAP8[20560]|0;
 $18 = ($17<<24>>24)==(32);
 if ($18) {
  (_GetByte()|0);
  $$pr = HEAP8[20560]|0;
  $20 = $$pr;
 } else {
  $20 = $17;
 }
 $not$ = ($0|0)!=(0);
 $19 = $not$&1;
 $$0$ = $$0 ^ $19;
 $21 = ($20<<24>>24)==(123);
 if ($21) {
  _flow_parse_block_else_block($$0$);
  $$08 = 1;
  STACKTOP = sp;return ($$08|0);
 } else {
  $22 = ($$0$|0)!=(0);
  $23 = $22 ? 2 : 0;
  $$08 = $23;
  STACKTOP = sp;return ($$08|0);
 }
 return (0)|0;
}
function _encode_string($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[4381]|0;
 HEAP32[4381] = $0;
 L1: while(1) {
  $3 = HEAP8[20560]|0;
  $4 = ($3<<24>>24)==(34);
  if ($4) {
   (_GetQuotedByte()|0);
   L5: while(1) {
    $5 = HEAP8[20560]|0;
    switch ($5<<24>>24) {
    case 0:  {
     $$0 = 3;
     label = 10;
     break L1;
     break;
    }
    case 34:  {
     break L5;
     break;
    }
    default: {
    }
    }
    $6 = (_encoding_encode_char($5)|0);
    $7 = $6 ^ $1;
    $8 = $7 << 24 >> 24;
    _output_8($8);
    (_GetQuotedByte()|0);
   }
   (_GetByte()|0);
  } else {
   $9 = (_ALU_any_int()|0);
   _output_8($9);
  }
  $10 = (_Input_accept_comma()|0);
  $11 = ($10|0)==(0);
  if ($11) {
   break;
  }
 }
 if ((label|0) == 10) {
  return ($$0|0);
 }
 HEAP32[4381] = $2;
 $$0 = 1;
 return ($$0|0);
}
function _pseudoopcode_parse() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 (_GetByte()|0);
 $1 = (_Input_read_and_lower_keyword()|0);
 $2 = ($1|0)==(0);
 L1: do {
  if (!($2)) {
   $3 = HEAP32[4676]|0;
   $4 = HEAP32[4380]|0;
   $5 = (_Tree_easy_scan($3,$0,$4)|0);
   $6 = ($5|0)!=(0);
   $7 = HEAP32[$0>>2]|0;
   $8 = ($7|0)!=(0|0);
   $or$cond = $6 & $8;
   if (!($or$cond)) {
    _Throw_error(13375);
    break;
   }
   $9 = HEAP8[20560]|0;
   $10 = ($9<<24>>24)==(32);
   if ($10) {
    (_GetByte()|0);
   }
   $11 = (FUNCTION_TABLE_i[$7 & 63]()|0);
   switch ($11|0) {
   case 0:  {
    break L1;
    break;
   }
   case 1:  {
    break;
   }
   default: {
    STACKTOP = sp;return;
   }
   }
   _Input_ensure_EOS();
   STACKTOP = sp;return;
  }
 } while(0);
 _Input_skip_remainder();
 STACKTOP = sp;return;
}
function _section_new($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = HEAP32[4677]|0;
 $5 = (($4) + 1)|0;
 HEAP32[4677] = $5;
 HEAP32[$0>>2] = $5;
 $6 = ((($0)) + 4|0);
 HEAP32[$6>>2] = $1;
 $7 = ((($0)) + 8|0);
 HEAP32[$7>>2] = $2;
 $8 = ((($0)) + 12|0);
 HEAP32[$8>>2] = $3;
 HEAP32[1337] = $0;
 return;
}
function _section_finalize($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 12|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0);
 if ($3) {
  return;
 }
 $4 = ((($0)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 _free($5);
 return;
}
function _section_passinit() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[4677] = 1;
 HEAP32[4678] = 1;
 HEAP32[(18716)>>2] = 9755;
 HEAP32[(18720)>>2] = 9744;
 HEAP32[(18724)>>2] = 0;
 HEAP32[1337] = 18712;
 return;
}
function _symbol_find($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$022 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = $1 & 7;
 $4 = (_Tree_hard_scan($2,18728,$0,1)|0);
 $5 = ($4|0)==(0);
 if (!($5)) {
  $6 = (_safe_malloc(32)|0);
  HEAP32[$6>>2] = $1;
  $7 = ((($6)) + 16|0);
  HEAP32[$7>>2] = 0;
  $8 = $1 & 256;
  $9 = ($8|0)==(0);
  $10 = ((($6)) + 8|0);
  if ($9) {
   HEAP32[$10>>2] = 0;
  } else {
   HEAPF64[$10>>3] = 0.0;
  }
  $11 = ((($6)) + 24|0);
  HEAP32[$11>>2] = 0;
  $12 = HEAP32[4388]|0;
  $13 = ((($6)) + 28|0);
  HEAP32[$13>>2] = $12;
  $14 = HEAP32[$2>>2]|0;
  $15 = ((($14)) + 16|0);
  HEAP32[$15>>2] = $6;
  $$022 = $6;
  STACKTOP = sp;return ($$022|0);
 }
 $16 = HEAP32[$2>>2]|0;
 $17 = ((($16)) + 16|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = ($3|0)==(0);
 if ($19) {
  $$022 = $18;
  STACKTOP = sp;return ($$022|0);
 }
 $20 = HEAP32[$18>>2]|0;
 $21 = $20 & 7;
 $22 = ($21|0)==($3|0);
 if ($22) {
  $$022 = $18;
  STACKTOP = sp;return ($$022|0);
 }
 _Throw_error(13410);
 $$022 = $18;
 STACKTOP = sp;return ($$022|0);
}
function _symbol_set_value($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 16;
 $5 = ($4|0)!=(0);
 $6 = ($2|0)==(0);
 $or$cond = $6 & $5;
 L1: do {
  if ($or$cond) {
   $7 = HEAP32[$1>>2]|0;
   $8 = $7 ^ $3;
   $9 = $8 & 256;
   $10 = ($9|0)==(0);
   do {
    if ($10) {
     $11 = $3 & 256;
     $12 = ($11|0)==(0);
     $13 = ((($0)) + 8|0);
     if ($12) {
      $18 = HEAP32[$13>>2]|0;
      $19 = ((($1)) + 8|0);
      $20 = HEAP32[$19>>2]|0;
      $21 = ($18|0)==($20|0);
      if ($21) {
       break L1;
      } else {
       break;
      }
     } else {
      $14 = +HEAPF64[$13>>3];
      $15 = ((($1)) + 8|0);
      $16 = +HEAPF64[$15>>3];
      $17 = $14 != $16;
      if ($17) {
       break;
      } else {
       break L1;
      }
     }
    }
   } while(0);
   _Throw_error(13432);
  } else {
   ;HEAP32[$0>>2]=HEAP32[$1>>2]|0;HEAP32[$0+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$1+12>>2]|0;HEAP32[$0+16>>2]=HEAP32[$1+16>>2]|0;HEAP32[$0+20>>2]=HEAP32[$1+20>>2]|0;
  }
 } while(0);
 $22 = $3 & 40;
 $23 = ($22|0)==(32);
 if ($23) {
  $24 = HEAP32[$1>>2]|0;
  $25 = $24 & -9;
  HEAP32[$1>>2] = $25;
 }
 if ($6) {
  $29 = $3 & 55;
  $30 = ($29|0)==(0);
  $31 = HEAP32[$1>>2]|0;
  $32 = $31 & 7;
  $33 = $30 ? $32 : 0;
  $$0 = $3 | $33;
  $34 = $31 & -8;
  $35 = $34 | $$0;
  $$1 = $35;
  HEAP32[$0>>2] = $$1;
  return;
 } else {
  $26 = $3 & 32;
  $27 = HEAP32[$1>>2]|0;
  $28 = $27 | $26;
  $$1 = $28;
  HEAP32[$0>>2] = $$1;
  return;
 }
}
function _symbol_set_label($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$022$i = 0, $$sink = 0, $$sroa$12$0$$sroa_idx17 = 0, $$sroa$911$0$$sroa_idx13 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $4 = sp + 24|0;
 $5 = sp;
 $6 = $2 & 7;
 $7 = (_Tree_hard_scan($4,18728,$0,1)|0);
 $8 = ($7|0)==(0);
 if ($8) {
  $19 = HEAP32[$4>>2]|0;
  $20 = ((($19)) + 16|0);
  $21 = HEAP32[$20>>2]|0;
  $22 = ($6|0)==(0);
  if ($22) {
   $$022$i = $21;
  } else {
   $23 = HEAP32[$21>>2]|0;
   $24 = $23 & 7;
   $25 = ($24|0)==($6|0);
   if ($25) {
    $$022$i = $21;
   } else {
    _Throw_error(13410);
    $$022$i = $21;
   }
  }
 } else {
  $9 = (_safe_malloc(32)|0);
  HEAP32[$9>>2] = $2;
  $10 = ((($9)) + 16|0);
  HEAP32[$10>>2] = 0;
  $11 = $2 & 256;
  $12 = ($11|0)==(0);
  $13 = ((($9)) + 8|0);
  if ($12) {
   HEAP32[$13>>2] = 0;
  } else {
   HEAPF64[$13>>3] = 0.0;
  }
  $14 = ((($9)) + 24|0);
  HEAP32[$14>>2] = 0;
  $15 = HEAP32[4388]|0;
  $16 = ((($9)) + 28|0);
  HEAP32[$16>>2] = $15;
  $17 = HEAP32[$4>>2]|0;
  $18 = ((($17)) + 16|0);
  HEAP32[$18>>2] = $9;
  $$022$i = $9;
 }
 $26 = $1 & 1;
 $27 = ($26|0)!=(0);
 $28 = HEAP32[242]|0;
 $29 = ($28|0)!=(0);
 $or$cond = $27 & $29;
 if ($or$cond) {
  _Throw_first_pass_warning(13456);
 }
 _vcpu_read_pc($5);
 $30 = HEAP32[$5>>2]|0;
 $31 = $30 & 16;
 $32 = ((($5)) + 8|0);
 $33 = HEAP32[$32>>2]|0;
 $34 = HEAP32[$$022$i>>2]|0;
 $35 = $34 & 16;
 $36 = ($35|0)!=(0);
 $37 = ($3|0)==(0);
 $or$cond$i = $37 & $36;
 if (!($or$cond$i)) {
  $43 = ((($5)) + 16|0);
  $44 = HEAP32[$43>>2]|0;
  HEAP32[$$022$i>>2] = $31;
  $$sroa$911$0$$sroa_idx13 = ((($$022$i)) + 8|0);
  $45 = $$sroa$911$0$$sroa_idx13;
  $46 = $45;
  HEAP32[$46>>2] = $33;
  $47 = (($45) + 4)|0;
  $48 = $47;
  HEAP32[$48>>2] = 0;
  $$sroa$12$0$$sroa_idx17 = ((($$022$i)) + 16|0);
  HEAP32[$$sroa$12$0$$sroa_idx17>>2] = $44;
  $49 = $34 & 32;
  $$sink = $37 ? $34 : $49;
  $50 = $$sink | $31;
  HEAP32[$$022$i>>2] = $50;
  STACKTOP = sp;return;
 }
 $38 = $34 & 256;
 $39 = ($38|0)==(0);
 if ($39) {
  $40 = ((($$022$i)) + 8|0);
  $41 = HEAP32[$40>>2]|0;
  $42 = ($41|0)==($33|0);
  if ($42) {
   $49 = $34 & 32;
   $$sink = $37 ? $34 : $49;
   $50 = $$sink | $31;
   HEAP32[$$022$i>>2] = $50;
   STACKTOP = sp;return;
  }
 }
 _Throw_error(13432);
 $49 = $34 & 32;
 $$sink = $37 ? $34 : $49;
 $50 = $$sink | $31;
 HEAP32[$$022$i>>2] = $50;
 STACKTOP = sp;return;
}
function _symbol_parse_definition($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $$022$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0.0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $2 = sp + 24|0;
 $3 = sp;
 $4 = (_Input_get_force_bit()|0);
 $5 = HEAP8[20560]|0;
 $6 = ($5<<24>>24)==(61);
 if (!($6)) {
  _symbol_set_label($0,$1,$4,0);
  STACKTOP = sp;return;
 }
 $7 = $4 & 7;
 $8 = (_Tree_hard_scan($2,18728,$0,1)|0);
 $9 = ($8|0)==(0);
 if ($9) {
  $20 = HEAP32[$2>>2]|0;
  $21 = ((($20)) + 16|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = ($7|0)==(0);
  if ($23) {
   $$022$i = $22;
  } else {
   $24 = HEAP32[$22>>2]|0;
   $25 = $24 & 7;
   $26 = ($25|0)==($7|0);
   if ($26) {
    $$022$i = $22;
   } else {
    _Throw_error(13410);
    $$022$i = $22;
   }
  }
 } else {
  $10 = (_safe_malloc(32)|0);
  HEAP32[$10>>2] = $4;
  $11 = ((($10)) + 16|0);
  HEAP32[$11>>2] = 0;
  $12 = $4 & 256;
  $13 = ($12|0)==(0);
  $14 = ((($10)) + 8|0);
  if ($13) {
   HEAP32[$14>>2] = 0;
  } else {
   HEAPF64[$14>>3] = 0.0;
  }
  $15 = ((($10)) + 24|0);
  HEAP32[$15>>2] = 0;
  $16 = HEAP32[4388]|0;
  $17 = ((($10)) + 28|0);
  HEAP32[$17>>2] = $16;
  $18 = HEAP32[$2>>2]|0;
  $19 = ((($18)) + 16|0);
  HEAP32[$19>>2] = $10;
  $$022$i = $10;
 }
 (_GetByte()|0);
 _ALU_any_result($3);
 $27 = (_typesystem_says_address()|0);
 $28 = ($27|0)==(0);
 if (!($28)) {
  $29 = ((($3)) + 16|0);
  HEAP32[$29>>2] = 1;
 }
 $30 = HEAP32[$$022$i>>2]|0;
 $31 = $30 & 16;
 $32 = ($31|0)==(0);
 L18: do {
  if ($32) {
   ;HEAP32[$$022$i>>2]=HEAP32[$3>>2]|0;HEAP32[$$022$i+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$$022$i+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$$022$i+12>>2]=HEAP32[$3+12>>2]|0;HEAP32[$$022$i+16>>2]=HEAP32[$3+16>>2]|0;HEAP32[$$022$i+20>>2]=HEAP32[$3+20>>2]|0;
  } else {
   $33 = HEAP32[$3>>2]|0;
   $34 = $33 ^ $30;
   $35 = $34 & 256;
   $36 = ($35|0)==(0);
   do {
    if ($36) {
     $37 = $30 & 256;
     $38 = ($37|0)==(0);
     $39 = ((($$022$i)) + 8|0);
     if ($38) {
      $44 = HEAP32[$39>>2]|0;
      $45 = ((($3)) + 8|0);
      $46 = HEAP32[$45>>2]|0;
      $47 = ($44|0)==($46|0);
      if ($47) {
       break L18;
      } else {
       break;
      }
     } else {
      $40 = +HEAPF64[$39>>3];
      $41 = ((($3)) + 8|0);
      $42 = +HEAPF64[$41>>3];
      $43 = $40 != $42;
      if ($43) {
       break;
      } else {
       break L18;
      }
     }
    }
   } while(0);
   _Throw_error(13432);
  }
 } while(0);
 $48 = $30 & 40;
 $49 = ($48|0)==(32);
 $50 = HEAP32[$3>>2]|0;
 if ($49) {
  $51 = $50 & -9;
  HEAP32[$3>>2] = $51;
  $55 = $51;
 } else {
  $55 = $50;
 }
 $52 = $30 & 55;
 $53 = ($52|0)==(0);
 $54 = $55 & 7;
 $56 = $53 ? $54 : 0;
 $57 = $55 & -8;
 $$0$i = $57 | $30;
 $58 = $$0$i | $56;
 HEAP32[$$022$i>>2] = $58;
 _Input_ensure_EOS();
 STACKTOP = sp;return;
}
function _symbol_define($0) {
 $0 = $0|0;
 var $$022$i = 0, $$sroa$75$0$$sroa_idx7 = 0, $$sroa$8 = 0, $$sroa$8$0$$sroa_raw_idx = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp + 12|0;
 $$sroa$8 = sp;
 $2 = (_Tree_hard_scan($1,18728,0,1)|0);
 $3 = ($2|0)==(0);
 if ($3) {
  $12 = HEAP32[$1>>2]|0;
  $13 = ((($12)) + 16|0);
  $14 = HEAP32[$13>>2]|0;
  $$022$i = $14;
 } else {
  $4 = (_safe_malloc(32)|0);
  HEAP32[$4>>2] = 0;
  $5 = ((($4)) + 16|0);
  HEAP32[$5>>2] = 0;
  $6 = ((($4)) + 8|0);
  HEAP32[$6>>2] = 0;
  $7 = ((($4)) + 24|0);
  HEAP32[$7>>2] = 0;
  $8 = HEAP32[4388]|0;
  $9 = ((($4)) + 28|0);
  HEAP32[$9>>2] = $8;
  $10 = HEAP32[$1>>2]|0;
  $11 = ((($10)) + 16|0);
  HEAP32[$11>>2] = $4;
  $$022$i = $4;
 }
 $15 = HEAP32[$$022$i>>2]|0;
 $$sroa$75$0$$sroa_idx7 = ((($$022$i)) + 8|0);
 HEAP32[$$sroa$75$0$$sroa_idx7>>2] = $0;
 $$sroa$8$0$$sroa_raw_idx = ((($$022$i)) + 12|0);
 ;HEAP32[$$sroa$8$0$$sroa_raw_idx>>2]=HEAP32[$$sroa$8>>2]|0;HEAP32[$$sroa$8$0$$sroa_raw_idx+4>>2]=HEAP32[$$sroa$8+4>>2]|0;HEAP32[$$sroa$8$0$$sroa_raw_idx+8>>2]=HEAP32[$$sroa$8+8>>2]|0;
 $16 = $15 & 32;
 $17 = $16 | 80;
 HEAP32[$$022$i>>2] = $17;
 STACKTOP = sp;return;
}
function _symbols_list($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _Tree_dump_forest(18728,0,1,$0);
 return;
}
function _dump_one_symbol($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0.0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $trunc = 0, $trunc$clear = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer4 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $2 = ((($0)) + 16|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = HEAP32[4384]|0;
 $5 = ($4|0)==(0);
 if (!($5)) {
  $6 = ((($3)) + 16|0);
  $7 = HEAP32[$6>>2]|0;
  $8 = ($7|0)==(1);
  if ($8) {
   (_fwrite(13491,5,1,$1)|0);
  }
 }
 $9 = ((($0)) + 12|0);
 $10 = HEAP32[$9>>2]|0;
 HEAP32[$vararg_buffer>>2] = $10;
 (_fprintf($1,13497,$vararg_buffer)|0);
 $11 = HEAP32[$3>>2]|0;
 $trunc = $11&255;
 $trunc$clear = $trunc & 7;
 switch ($trunc$clear<<24>>24) {
 case 2:  {
  (_fwrite(13501,5,1,$1)|0);
  break;
 }
 case 4: case 6:  {
  (_fwrite(13507,5,1,$1)|0);
  break;
 }
 default: {
  (_fwrite(13513,3,1,$1)|0);
 }
 }
 $12 = HEAP32[$3>>2]|0;
 $13 = $12 & 16;
 $14 = ($13|0)==(0);
 do {
  if ($14) {
   (_fwrite(13527,2,1,$1)|0);
  } else {
   $15 = $12 & 256;
   $16 = ($15|0)==(0);
   $17 = ((($3)) + 8|0);
   if ($16) {
    $19 = HEAP32[$17>>2]|0;
    HEAP32[$vararg_buffer4>>2] = $19;
    (_fprintf($1,13523,$vararg_buffer4)|0);
    break;
   } else {
    $18 = +HEAPF64[$17>>3];
    HEAPF64[$vararg_buffer1>>3] = $18;
    (_fprintf($1,13517,$vararg_buffer1)|0);
    break;
   }
  }
 } while(0);
 $20 = HEAP32[$3>>2]|0;
 $21 = $20 & 32;
 $22 = ($21|0)==(0);
 if (!($22)) {
  (_fwrite(13530,4,1,$1)|0);
 }
 $23 = ((($3)) + 24|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ($24|0)==(0);
 if (!($25)) {
  (_fputc(10,$1)|0);
  STACKTOP = sp;return;
 }
 (_fwrite(13535,9,1,$1)|0);
 (_fputc(10,$1)|0);
 STACKTOP = sp;return;
}
function _symbols_vicelabels($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _Tree_dump_forest(18728,0,2,$0);
 (_fputc(10,$0)|0);
 _Tree_dump_forest(18728,0,3,$0);
 (_fputc(10,$0)|0);
 _Tree_dump_forest(18728,0,4,$0);
 return;
}
function _dump_vice_unusednonaddress($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = ((($0)) + 16|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ((($3)) + 24|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0);
 if (!($6)) {
  STACKTOP = sp;return;
 }
 $7 = HEAP32[$3>>2]|0;
 $8 = $7 & 272;
 $9 = ($8|0)==(16);
 if (!($9)) {
  STACKTOP = sp;return;
 }
 $10 = ((($3)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ($11|0)==(1);
 if ($12) {
  STACKTOP = sp;return;
 }
 $13 = ((($3)) + 8|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($0)) + 12|0);
 $16 = HEAP32[$15>>2]|0;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $16;
 (_fprintf($1,13545,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _dump_vice_usednonaddress($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = ((($0)) + 16|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ((($3)) + 24|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0);
 if ($6) {
  STACKTOP = sp;return;
 }
 $7 = HEAP32[$3>>2]|0;
 $8 = $7 & 272;
 $9 = ($8|0)==(16);
 if (!($9)) {
  STACKTOP = sp;return;
 }
 $10 = ((($3)) + 16|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ($11|0)==(1);
 if ($12) {
  STACKTOP = sp;return;
 }
 $13 = ((($3)) + 8|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($0)) + 12|0);
 $16 = HEAP32[$15>>2]|0;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $16;
 (_fprintf($1,13545,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _dump_vice_address($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = ((($0)) + 16|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = HEAP32[$3>>2]|0;
 $5 = $4 & 272;
 $6 = ($5|0)==(16);
 if (!($6)) {
  STACKTOP = sp;return;
 }
 $7 = ((($3)) + 16|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ($8|0)==(1);
 if (!($9)) {
  STACKTOP = sp;return;
 }
 $10 = ((($3)) + 8|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($0)) + 12|0);
 $13 = HEAP32[$12>>2]|0;
 HEAP32[$vararg_buffer>>2] = $11;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $13;
 (_fprintf($1,13545,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _symbol_fix_forward_anon_name($0) {
 $0 = $0|0;
 var $$0 = 0, $$022$i = 0, $$phi$trans$insert = 0, $$phi$trans$insert14 = 0, $$phi$trans$insert17 = 0, $$pre = 0, $$pre$phi19Z2D = 0, $$pre12 = 0, $$pre15 = 0, $$pre16 = 0, $$pre18 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 $2 = HEAP32[4380]|0;
 _DynaBuf_append($2,0);
 $3 = HEAP32[1337]|0;
 $4 = HEAP32[$3>>2]|0;
 $5 = (_Tree_hard_scan($1,18728,$4,1)|0);
 $6 = ($5|0)==(0);
 if ($6) {
  $15 = HEAP32[$1>>2]|0;
  $16 = ((($15)) + 16|0);
  $17 = HEAP32[$16>>2]|0;
  $$pre = HEAP32[4388]|0;
  $$022$i = $17;$21 = $$pre;
 } else {
  $7 = (_safe_malloc(32)|0);
  HEAP32[$7>>2] = 0;
  $8 = ((($7)) + 16|0);
  HEAP32[$8>>2] = 0;
  $9 = ((($7)) + 8|0);
  HEAP32[$9>>2] = 0;
  $10 = ((($7)) + 24|0);
  HEAP32[$10>>2] = 0;
  $11 = HEAP32[4388]|0;
  $12 = ((($7)) + 28|0);
  HEAP32[$12>>2] = $11;
  $13 = HEAP32[$1>>2]|0;
  $14 = ((($13)) + 16|0);
  HEAP32[$14>>2] = $7;
  $$022$i = $7;$21 = $11;
 }
 $18 = ((($$022$i)) + 28|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ($19|0)==($21|0);
 if ($20) {
  $$phi$trans$insert = ((($$022$i)) + 8|0);
  $$pre12 = HEAP32[$$phi$trans$insert>>2]|0;
  $$pre$phi19Z2D = $$phi$trans$insert;$47 = $$pre12;
 } else {
  HEAP32[$18>>2] = $21;
  $22 = ((($$022$i)) + 8|0);
  HEAP32[$22>>2] = 0;
  $$pre$phi19Z2D = $22;$47 = 0;
 }
 $23 = HEAP32[4380]|0;
 $24 = ((($23)) + 4|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = (($25) + -1)|0;
 HEAP32[$24>>2] = $26;
 $$0 = $47;$28 = $23;$30 = $26;
 while(1) {
  $27 = ((($28)) + 8|0);
  $29 = HEAP32[$27>>2]|0;
  $31 = ($30|0)==($29|0);
  if ($31) {
   _DynaBuf_enlarge($28);
   $$pre16 = HEAP32[4380]|0;
   $$phi$trans$insert17 = ((($$pre16)) + 4|0);
   $$pre18 = HEAP32[$$phi$trans$insert17>>2]|0;
   $36 = $$pre16;$38 = $$pre18;
  } else {
   $36 = $28;$38 = $30;
  }
  $32 = $$0 & 15;
  $33 = (($32) + 97)|0;
  $34 = $33&255;
  $35 = ((($36)) + 4|0);
  $37 = (($38) + 1)|0;
  HEAP32[$35>>2] = $37;
  $39 = HEAP32[$36>>2]|0;
  $40 = (($39) + ($38)|0);
  HEAP8[$40>>0] = $34;
  $41 = $$0 >>> 4;
  $42 = ($41|0)==(0);
  $43 = HEAP32[4380]|0;
  if ($42) {
   break;
  }
  $$phi$trans$insert14 = ((($43)) + 4|0);
  $$pre15 = HEAP32[$$phi$trans$insert14>>2]|0;
  $$0 = $41;$28 = $43;$30 = $$pre15;
 }
 _DynaBuf_append($43,0);
 $44 = ($0|0)==(0);
 if ($44) {
  STACKTOP = sp;return;
 }
 $45 = HEAP32[$$pre$phi19Z2D>>2]|0;
 $46 = (($45) + 1)|0;
 HEAP32[$$pre$phi19Z2D>>2] = $46;
 STACKTOP = sp;return;
}
function _Tree_add_table($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$be$i = 0, $$0$be$i8 = 0, $$0$lcssa = 0, $$0$lcssa$i = 0, $$0$lcssa$i$i = 0, $$0$lcssa$i$i6 = 0, $$0$lcssa$i10 = 0, $$011$i$i = 0, $$011$i$i3 = 0, $$014 = 0, $$0910$i$i = 0, $$0910$i$i4 = 0, $$lcssa13 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)==(0);
 if ($4) {
  $$0$lcssa = $1;$$lcssa13 = $2;
 } else {
  $$014 = $1;$19 = $2;
  while(1) {
   $5 = ((($$014)) + 20|0);
   $6 = ((($$014)) + 12|0);
   $7 = HEAP32[$6>>2]|0;
   $8 = HEAP8[$7>>0]|0;
   $9 = ($8<<24>>24)==(0);
   if ($9) {
    $$0$lcssa$i$i = 0;
   } else {
    $$011$i$i = 0;$$0910$i$i = $7;$15 = $8;
    while(1) {
     $10 = ((($$0910$i$i)) + 1|0);
     $11 = $$011$i$i << 7;
     $12 = $$011$i$i >>> 25;
     $13 = $11 | $12;
     $14 = $15 << 24 >> 24;
     $16 = $13 ^ $14;
     $17 = HEAP8[$10>>0]|0;
     $18 = ($17<<24>>24)==(0);
     if ($18) {
      $$0$lcssa$i$i = $16;
      break;
     } else {
      $$011$i$i = $16;$$0910$i$i = $10;$15 = $17;
     }
    }
   }
   HEAP32[$19>>2] = $$0$lcssa$i$i;
   $20 = HEAP32[$0>>2]|0;
   $21 = ($20|0)==(0|0);
   if ($21) {
    $$0$lcssa$i = $0;
   } else {
    $23 = $20;
    while(1) {
     $22 = ((($23)) + 8|0);
     $24 = HEAP32[$22>>2]|0;
     $25 = ($$0$lcssa$i$i>>>0)>($24>>>0);
     $26 = ((($23)) + 4|0);
     $$0$be$i = $25 ? $23 : $26;
     $27 = HEAP32[$$0$be$i>>2]|0;
     $28 = ($27|0)==(0|0);
     if ($28) {
      $$0$lcssa$i = $$0$be$i;
      break;
     } else {
      $23 = $27;
     }
    }
   }
   HEAP32[$$0$lcssa$i>>2] = $$014;
   $29 = ((($$014)) + 28|0);
   $30 = HEAP32[$29>>2]|0;
   $31 = ($30|0)==(0);
   if ($31) {
    $$0$lcssa = $5;$$lcssa13 = $29;
    break;
   } else {
    $$014 = $5;$19 = $29;
   }
  }
 }
 $32 = ((($$0$lcssa)) + 12|0);
 $33 = HEAP32[$32>>2]|0;
 $34 = HEAP8[$33>>0]|0;
 $35 = ($34<<24>>24)==(0);
 if ($35) {
  $$0$lcssa$i$i6 = 0;
 } else {
  $$011$i$i3 = 0;$$0910$i$i4 = $33;$41 = $34;
  while(1) {
   $36 = ((($$0910$i$i4)) + 1|0);
   $37 = $$011$i$i3 << 7;
   $38 = $$011$i$i3 >>> 25;
   $39 = $37 | $38;
   $40 = $41 << 24 >> 24;
   $42 = $39 ^ $40;
   $43 = HEAP8[$36>>0]|0;
   $44 = ($43<<24>>24)==(0);
   if ($44) {
    $$0$lcssa$i$i6 = $42;
    break;
   } else {
    $$011$i$i3 = $42;$$0910$i$i4 = $36;$41 = $43;
   }
  }
 }
 HEAP32[$$lcssa13>>2] = $$0$lcssa$i$i6;
 $45 = HEAP32[$0>>2]|0;
 $46 = ($45|0)==(0|0);
 if ($46) {
  $$0$lcssa$i10 = $0;
  HEAP32[$$0$lcssa$i10>>2] = $$0$lcssa;
  return;
 } else {
  $48 = $45;
 }
 while(1) {
  $47 = ((($48)) + 8|0);
  $49 = HEAP32[$47>>2]|0;
  $50 = ($$0$lcssa$i$i6>>>0)>($49>>>0);
  $51 = ((($48)) + 4|0);
  $$0$be$i8 = $50 ? $48 : $51;
  $52 = HEAP32[$$0$be$i8>>2]|0;
  $53 = ($52|0)==(0|0);
  if ($53) {
   $$0$lcssa$i10 = $$0$be$i8;
   break;
  } else {
   $48 = $52;
  }
 }
 HEAP32[$$0$lcssa$i10>>2] = $$0$lcssa;
 return;
}
function _Tree_easy_scan($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$0$lcssa$i = 0, $$011$i = 0, $$023$be = 0, $$023$be$in = 0, $$02333 = 0, $$024 = 0, $$025 = 0, $$0910$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$2>>2]|0;
 $4 = HEAP8[$3>>0]|0;
 $5 = ($4<<24>>24)==(0);
 if ($5) {
  $$0$lcssa$i = 0;
 } else {
  $$011$i = 0;$$0910$i = $3;$11 = $4;
  while(1) {
   $6 = ((($$0910$i)) + 1|0);
   $7 = $$011$i << 7;
   $8 = $$011$i >>> 25;
   $9 = $7 | $8;
   $10 = $11 << 24 >> 24;
   $12 = $9 ^ $10;
   $13 = HEAP8[$6>>0]|0;
   $14 = ($13<<24>>24)==(0);
   if ($14) {
    $$0$lcssa$i = $12;
    break;
   } else {
    $$011$i = $12;$$0910$i = $6;$11 = $13;
   }
  }
 }
 $15 = ($0|0)==(0|0);
 if ($15) {
  $$0 = 0;
  return ($$0|0);
 } else {
  $$02333 = $0;
 }
 L7: while(1) {
  $16 = ((($$02333)) + 8|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = ($$0$lcssa$i>>>0)>($17>>>0);
  if ($18) {
   $$023$be$in = $$02333;
  } else {
   $20 = ($$0$lcssa$i|0)==($17|0);
   L12: do {
    if ($20) {
     $21 = ((($$02333)) + 12|0);
     $22 = HEAP32[$21>>2]|0;
     $$024 = $3;$$025 = $22;
     while(1) {
      $23 = HEAP8[$$024>>0]|0;
      $24 = HEAP8[$$025>>0]|0;
      $25 = ($23<<24>>24)==($24<<24>>24);
      if (!($25)) {
       break L12;
      }
      $26 = ((($$025)) + 1|0);
      $27 = ((($$024)) + 1|0);
      $28 = ($23<<24>>24)==(0);
      if ($28) {
       break L7;
      } else {
       $$024 = $27;$$025 = $26;
      }
     }
    }
   } while(0);
   $31 = ((($$02333)) + 4|0);
   $$023$be$in = $31;
  }
  $$023$be = HEAP32[$$023$be$in>>2]|0;
  $19 = ($$023$be|0)==(0|0);
  if ($19) {
   $$0 = 0;
   label = 13;
   break;
  } else {
   $$02333 = $$023$be;
  }
 }
 if ((label|0) == 13) {
  return ($$0|0);
 }
 $29 = ((($$02333)) + 16|0);
 $30 = HEAP32[$29>>2]|0;
 HEAP32[$1>>2] = $30;
 $$0 = 1;
 return ($$0|0);
}
function _Tree_hard_scan($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $$0$lcssa$i = 0, $$011$i = 0, $$047$be = 0, $$047$lcssa = 0, $$04758 = 0, $$048 = 0, $$049 = 0, $$0910$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $4 = HEAP32[4380]|0;
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP8[$5>>0]|0;
 $7 = ($6<<24>>24)==(0);
 if ($7) {
  $$0$lcssa$i = 0;
 } else {
  $$011$i = 0;$$0910$i = $5;$13 = $6;
  while(1) {
   $8 = ((($$0910$i)) + 1|0);
   $9 = $$011$i << 7;
   $10 = $$011$i >>> 25;
   $11 = $9 | $10;
   $12 = $13 << 24 >> 24;
   $14 = $11 ^ $12;
   $15 = HEAP8[$8>>0]|0;
   $16 = ($15<<24>>24)==(0);
   if ($16) {
    $$0$lcssa$i = $14;
    break;
   } else {
    $$011$i = $14;$$0910$i = $8;$13 = $15;
   }
  }
 }
 $17 = $$0$lcssa$i ^ $2;
 $18 = $17 >>> 16;
 $19 = $18 ^ $17;
 $20 = $19 >>> 8;
 $21 = $20 ^ $19;
 $22 = $21 & 255;
 $23 = (($1) + ($22<<2)|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = ($24|0)==(0|0);
 L5: do {
  if ($25) {
   $$047$lcssa = $23;
  } else {
   $$04758 = $23;$27 = $24;
   L6: while(1) {
    $26 = ((($27)) + 8|0);
    $28 = HEAP32[$26>>2]|0;
    $29 = ($17>>>0)>($28>>>0);
    if ($29) {
     $$047$be = $27;
    } else {
     $32 = ($17|0)==($28|0);
     L11: do {
      if ($32) {
       $33 = ((($27)) + 20|0);
       $34 = HEAP32[$33>>2]|0;
       $35 = ($34|0)==($2|0);
       if ($35) {
        $36 = ((($27)) + 12|0);
        $37 = HEAP32[$36>>2]|0;
        $$048 = $5;$$049 = $37;
        while(1) {
         $38 = HEAP8[$$048>>0]|0;
         $39 = HEAP8[$$049>>0]|0;
         $40 = ($38<<24>>24)==($39<<24>>24);
         if (!($40)) {
          break L11;
         }
         $41 = ((($$049)) + 1|0);
         $42 = ((($$048)) + 1|0);
         $43 = ($38<<24>>24)==(0);
         if ($43) {
          break L6;
         } else {
          $$048 = $42;$$049 = $41;
         }
        }
       }
      }
     } while(0);
     $45 = ((($27)) + 4|0);
     $$047$be = $45;
    }
    $30 = HEAP32[$$047$be>>2]|0;
    $31 = ($30|0)==(0|0);
    if ($31) {
     $$047$lcssa = $$047$be;
     break L5;
    } else {
     $$04758 = $$047$be;$27 = $30;
    }
   }
   $44 = HEAP32[$$04758>>2]|0;
   HEAP32[$0>>2] = $44;
   $$0 = 0;
   return ($$0|0);
  }
 } while(0);
 $46 = ($3|0)==(0);
 if ($46) {
  HEAP32[$0>>2] = 0;
  $$0 = 0;
  return ($$0|0);
 } else {
  $47 = (_safe_malloc(24)|0);
  HEAP32[$47>>2] = 0;
  $48 = ((($47)) + 4|0);
  HEAP32[$48>>2] = 0;
  $49 = ((($47)) + 8|0);
  HEAP32[$49>>2] = $17;
  $50 = ((($47)) + 20|0);
  HEAP32[$50>>2] = $2;
  $51 = HEAP32[4380]|0;
  $52 = (_DynaBuf_get_copy($51)|0);
  $53 = ((($47)) + 12|0);
  HEAP32[$53>>2] = $52;
  HEAP32[$$047$lcssa>>2] = $47;
  HEAP32[$0>>2] = $47;
  $$0 = 1;
  return ($$0|0);
 }
 return (0)|0;
}
function _dump_tree($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$tr = 0, $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$tr = $0;
 while(1) {
  $4 = ((($$tr)) + 20|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = ($5|0)==($1|0);
  if ($6) {
   FUNCTION_TABLE_vii[$2 & 7]($$tr,$3);
  }
  $7 = HEAP32[$$tr>>2]|0;
  $8 = ($7|0)==(0|0);
  if (!($8)) {
   _dump_tree($7,$1,$2,$3);
  }
  $9 = ((($$tr)) + 4|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($10|0)==(0|0);
  if ($11) {
   break;
  } else {
   $$tr = $10;
  }
 }
 return;
}
function _Tree_dump_forest($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$010 = 0, $$089 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$010 = 255;$$089 = $0;
 while(1) {
  $4 = HEAP32[$$089>>2]|0;
  $5 = ($4|0)==(0|0);
  if (!($5)) {
   _dump_tree($4,$1,$2,$3);
  }
  $6 = ((($$089)) + 4|0);
  $7 = (($$010) + -1)|0;
  $8 = ($$010|0)>(0);
  if ($8) {
   $$010 = $7;$$089 = $6;
  } else {
   break;
  }
 }
 return;
}
function _typesystem_says_address() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4938]|0;
 $1 = HEAP32[4939]|0;
 $2 = $1 | $0;
 return ($2|0);
}
function _typesystem_force_address_block() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4938]|0;
 HEAP32[4938] = 1;
 (_Parse_optional_block()|0);
 HEAP32[4938] = $0;
 return;
}
function _typesystem_force_address_statement($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[4939] = $0;
 return;
}
function _typesystem_want_imm($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[4384]|0;
 $2 = ($1|0)==(0);
 if ($2) {
  return;
 }
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 16;
 $5 = ($4|0)==(0);
 if ($5) {
  return;
 }
 $6 = ((($0)) + 16|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($7|0)==(0);
 if ($8) {
  return;
 }
 _Throw_warning(13560);
 return;
}
function _typesystem_want_addr($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[4384]|0;
 $2 = ($1|0)==(0);
 if ($2) {
  return;
 }
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 16;
 $5 = ($4|0)==(0);
 if ($5) {
  return;
 }
 $6 = ((($0)) + 16|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($7|0)==(1);
 if ($8) {
  return;
 }
 _Throw_warning(13591);
 return;
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $3 = (___syscall6(6,($vararg_buffer|0))|0);
 $4 = (___syscall_ret($3)|0);
 STACKTOP = sp;return ($4|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$056 = 0, $$058 = 0, $$059 = 0, $$061 = 0, $$1 = 0, $$157 = 0, $$160 = 0, $$phi$trans$insert = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = ((($0)) + 44|0);
 $$056 = 2;$$058 = $12;$$059 = $3;
 while(1) {
  $15 = HEAP32[4940]|0;
  $16 = ($15|0)==(0|0);
  if ($16) {
   $20 = HEAP32[$13>>2]|0;
   HEAP32[$vararg_buffer3>>2] = $20;
   $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
   HEAP32[$vararg_ptr6>>2] = $$059;
   $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
   HEAP32[$vararg_ptr7>>2] = $$056;
   $21 = (___syscall146(146,($vararg_buffer3|0))|0);
   $22 = (___syscall_ret($21)|0);
   $$0 = $22;
  } else {
   _pthread_cleanup_push((12|0),($0|0));
   $17 = HEAP32[$13>>2]|0;
   HEAP32[$vararg_buffer>>2] = $17;
   $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
   HEAP32[$vararg_ptr1>>2] = $$059;
   $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
   HEAP32[$vararg_ptr2>>2] = $$056;
   $18 = (___syscall146(146,($vararg_buffer|0))|0);
   $19 = (___syscall_ret($18)|0);
   _pthread_cleanup_pop(0);
   $$0 = $19;
  }
  $23 = ($$058|0)==($$0|0);
  if ($23) {
   label = 6;
   break;
  }
  $30 = ($$0|0)<(0);
  if ($30) {
   label = 8;
   break;
  }
  $38 = (($$058) - ($$0))|0;
  $39 = ((($$059)) + 4|0);
  $40 = HEAP32[$39>>2]|0;
  $41 = ($$0>>>0)>($40>>>0);
  if ($41) {
   $42 = HEAP32[$14>>2]|0;
   HEAP32[$4>>2] = $42;
   HEAP32[$7>>2] = $42;
   $43 = (($$0) - ($40))|0;
   $44 = ((($$059)) + 8|0);
   $45 = (($$056) + -1)|0;
   $$phi$trans$insert = ((($$059)) + 12|0);
   $$pre = HEAP32[$$phi$trans$insert>>2]|0;
   $$1 = $43;$$157 = $45;$$160 = $44;$53 = $$pre;
  } else {
   $46 = ($$056|0)==(2);
   if ($46) {
    $47 = HEAP32[$4>>2]|0;
    $48 = (($47) + ($$0)|0);
    HEAP32[$4>>2] = $48;
    $$1 = $$0;$$157 = 2;$$160 = $$059;$53 = $40;
   } else {
    $$1 = $$0;$$157 = $$056;$$160 = $$059;$53 = $40;
   }
  }
  $49 = HEAP32[$$160>>2]|0;
  $50 = (($49) + ($$1)|0);
  HEAP32[$$160>>2] = $50;
  $51 = ((($$160)) + 4|0);
  $52 = (($53) - ($$1))|0;
  HEAP32[$51>>2] = $52;
  $$056 = $$157;$$058 = $38;$$059 = $$160;
 }
 if ((label|0) == 6) {
  $24 = HEAP32[$14>>2]|0;
  $25 = ((($0)) + 48|0);
  $26 = HEAP32[$25>>2]|0;
  $27 = (($24) + ($26)|0);
  $28 = ((($0)) + 16|0);
  HEAP32[$28>>2] = $27;
  $29 = $24;
  HEAP32[$4>>2] = $29;
  HEAP32[$7>>2] = $29;
  $$061 = $2;
 }
 else if ((label|0) == 8) {
  $31 = ((($0)) + 16|0);
  HEAP32[$31>>2] = 0;
  HEAP32[$4>>2] = 0;
  HEAP32[$7>>2] = 0;
  $32 = HEAP32[$0>>2]|0;
  $33 = $32 | 32;
  HEAP32[$0>>2] = $33;
  $34 = ($$056|0)==(2);
  if ($34) {
   $$061 = 0;
  } else {
   $35 = ((($$059)) + 4|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = (($2) - ($36))|0;
   $$061 = $37;
  }
 }
 STACKTOP = sp;return ($$061|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $3;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $6 = (___syscall140(140,($vararg_buffer|0))|0);
 $7 = (___syscall_ret($6)|0);
 $8 = ($7|0)<(0);
 if ($8) {
  HEAP32[$3>>2] = -1;
  $9 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $9 = $$pre;
 }
 STACKTOP = sp;return ($9|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4940]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 19804;
 } else {
  $2 = (_pthread_self()|0);
  $3 = ((($2)) + 64|0);
  $4 = HEAP32[$3>>2]|0;
  $$0 = $4;
 }
 return ($$0|0);
}
function _cleanup_88($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 68|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0);
 if ($3) {
  ___unlockfile($0);
 }
 return;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $vararg_buffer = sp;
 $3 = sp + 12|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 1;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21505;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $3;
  $10 = (___syscall54(54,($vararg_buffer|0))|0);
  $11 = ($10|0)==(0);
  if (!($11)) {
   $12 = ((($0)) + 75|0);
   HEAP8[$12>>0] = -1;
  }
 }
 $13 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($13|0);
}
function ___stdio_read($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$026 = 0, $$cast = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 HEAP32[$3>>2] = $1;
 $4 = ((($3)) + 4|0);
 $5 = ((($0)) + 48|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6|0)!=(0);
 $8 = $7&1;
 $9 = (($2) - ($8))|0;
 HEAP32[$4>>2] = $9;
 $10 = ((($3)) + 8|0);
 $11 = ((($0)) + 44|0);
 $12 = HEAP32[$11>>2]|0;
 HEAP32[$10>>2] = $12;
 $13 = ((($3)) + 12|0);
 HEAP32[$13>>2] = $6;
 $14 = HEAP32[4940]|0;
 $15 = ($14|0)==(0|0);
 if ($15) {
  $20 = ((($0)) + 60|0);
  $21 = HEAP32[$20>>2]|0;
  HEAP32[$vararg_buffer3>>2] = $21;
  $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
  HEAP32[$vararg_ptr6>>2] = $3;
  $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
  HEAP32[$vararg_ptr7>>2] = 2;
  $22 = (___syscall145(145,($vararg_buffer3|0))|0);
  $23 = (___syscall_ret($22)|0);
  $$0 = $23;
 } else {
  _pthread_cleanup_push((13|0),($0|0));
  $16 = ((($0)) + 60|0);
  $17 = HEAP32[$16>>2]|0;
  HEAP32[$vararg_buffer>>2] = $17;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $3;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = 2;
  $18 = (___syscall145(145,($vararg_buffer|0))|0);
  $19 = (___syscall_ret($18)|0);
  _pthread_cleanup_pop(0);
  $$0 = $19;
 }
 $24 = ($$0|0)<(1);
 if ($24) {
  $25 = $$0 & 48;
  $26 = $25 ^ 16;
  $27 = HEAP32[$0>>2]|0;
  $28 = $27 | $26;
  HEAP32[$0>>2] = $28;
  $29 = ((($0)) + 8|0);
  HEAP32[$29>>2] = 0;
  $30 = ((($0)) + 4|0);
  HEAP32[$30>>2] = 0;
  $$026 = $$0;
 } else {
  $31 = HEAP32[$4>>2]|0;
  $32 = ($$0>>>0)>($31>>>0);
  if ($32) {
   $33 = (($$0) - ($31))|0;
   $34 = HEAP32[$11>>2]|0;
   $35 = ((($0)) + 4|0);
   HEAP32[$35>>2] = $34;
   $$cast = $34;
   $36 = (($$cast) + ($33)|0);
   $37 = ((($0)) + 8|0);
   HEAP32[$37>>2] = $36;
   $38 = HEAP32[$5>>2]|0;
   $39 = ($38|0)==(0);
   if ($39) {
    $$026 = $2;
   } else {
    $40 = ((($$cast)) + 1|0);
    HEAP32[$35>>2] = $40;
    $41 = HEAP8[$$cast>>0]|0;
    $42 = (($2) + -1)|0;
    $43 = (($1) + ($42)|0);
    HEAP8[$43>>0] = $41;
    $$026 = $2;
   }
  } else {
   $$026 = $$0;
  }
 }
 STACKTOP = sp;return ($$026|0);
}
function _cleanup($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 68|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0);
 if ($3) {
  ___unlockfile($0);
 }
 return;
}
function _strerror($0) {
 $0 = $0|0;
 var $$011$lcssa = 0, $$01113 = 0, $$015 = 0, $$112 = 0, $$114 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$015 = 0;
 while(1) {
  $2 = (13622 + ($$015)|0);
  $3 = HEAP8[$2>>0]|0;
  $4 = $3&255;
  $5 = ($4|0)==($0|0);
  if ($5) {
   label = 2;
   break;
  }
  $6 = (($$015) + 1)|0;
  $7 = ($6|0)==(87);
  if ($7) {
   $$01113 = 13710;$$114 = 87;
   label = 5;
   break;
  } else {
   $$015 = $6;
  }
 }
 if ((label|0) == 2) {
  $1 = ($$015|0)==(0);
  if ($1) {
   $$011$lcssa = 13710;
  } else {
   $$01113 = 13710;$$114 = $$015;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  while(1) {
   label = 0;
   $$112 = $$01113;
   while(1) {
    $8 = HEAP8[$$112>>0]|0;
    $9 = ($8<<24>>24)==(0);
    $10 = ((($$112)) + 1|0);
    if ($9) {
     break;
    } else {
     $$112 = $10;
    }
   }
   $11 = (($$114) + -1)|0;
   $12 = ($11|0)==(0);
   if ($12) {
    $$011$lcssa = $10;
    break;
   } else {
    $$01113 = $10;$$114 = $11;
    label = 5;
   }
  }
 }
 return ($$011$lcssa|0);
}
function _wcrtomb($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0|0);
 do {
  if ($3) {
   $$0 = 1;
  } else {
   $4 = ($1>>>0)<(128);
   if ($4) {
    $5 = $1&255;
    HEAP8[$0>>0] = $5;
    $$0 = 1;
    break;
   }
   $6 = ($1>>>0)<(2048);
   if ($6) {
    $7 = $1 >>> 6;
    $8 = $7 | 192;
    $9 = $8&255;
    $10 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $9;
    $11 = $1 & 63;
    $12 = $11 | 128;
    $13 = $12&255;
    HEAP8[$10>>0] = $13;
    $$0 = 2;
    break;
   }
   $14 = ($1>>>0)<(55296);
   $15 = $1 & -8192;
   $16 = ($15|0)==(57344);
   $or$cond = $14 | $16;
   if ($or$cond) {
    $17 = $1 >>> 12;
    $18 = $17 | 224;
    $19 = $18&255;
    $20 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $19;
    $21 = $1 >>> 6;
    $22 = $21 & 63;
    $23 = $22 | 128;
    $24 = $23&255;
    $25 = ((($0)) + 2|0);
    HEAP8[$20>>0] = $24;
    $26 = $1 & 63;
    $27 = $26 | 128;
    $28 = $27&255;
    HEAP8[$25>>0] = $28;
    $$0 = 3;
    break;
   }
   $29 = (($1) + -65536)|0;
   $30 = ($29>>>0)<(1048576);
   if ($30) {
    $31 = $1 >>> 18;
    $32 = $31 | 240;
    $33 = $32&255;
    $34 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $33;
    $35 = $1 >>> 12;
    $36 = $35 & 63;
    $37 = $36 | 128;
    $38 = $37&255;
    $39 = ((($0)) + 2|0);
    HEAP8[$34>>0] = $38;
    $40 = $1 >>> 6;
    $41 = $40 & 63;
    $42 = $41 | 128;
    $43 = $42&255;
    $44 = ((($0)) + 3|0);
    HEAP8[$39>>0] = $43;
    $45 = $1 & 63;
    $46 = $45 | 128;
    $47 = $46&255;
    HEAP8[$44>>0] = $47;
    $$0 = 4;
    break;
   } else {
    $48 = (___errno_location()|0);
    HEAP32[$48>>2] = 84;
    $$0 = -1;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function _wctomb($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = (_wcrtomb($0,$1,0)|0);
  $$0 = $3;
 }
 return ($$0|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___uflow($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 $2 = ((($0)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)==(0|0);
 if ($4) {
  $5 = (___toread($0)|0);
  $6 = ($5|0)==(0);
  if ($6) {
   label = 3;
  } else {
   $$0 = -1;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $7 = ((($0)) + 32|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = (FUNCTION_TABLE_iiii[$8 & 7]($0,$1,1)|0);
  $10 = ($9|0)==(1);
  if ($10) {
   $11 = HEAP8[$1>>0]|0;
   $12 = $11&255;
   $$0 = $12;
  } else {
   $$0 = -1;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function ___toread($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 74|0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $4 = (($3) + 255)|0;
 $5 = $4 | $3;
 $6 = $5&255;
 HEAP8[$1>>0] = $6;
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = ((($0)) + 44|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = ($8>>>0)>($10>>>0);
 if ($11) {
  $12 = ((($0)) + 36|0);
  $13 = HEAP32[$12>>2]|0;
  (FUNCTION_TABLE_iiii[$13 & 7]($0,0,0)|0);
 }
 $14 = ((($0)) + 16|0);
 HEAP32[$14>>2] = 0;
 $15 = ((($0)) + 28|0);
 HEAP32[$15>>2] = 0;
 HEAP32[$7>>2] = 0;
 $16 = HEAP32[$0>>2]|0;
 $17 = $16 & 20;
 $18 = ($17|0)==(0);
 if ($18) {
  $22 = HEAP32[$9>>2]|0;
  $23 = ((($0)) + 8|0);
  HEAP32[$23>>2] = $22;
  $24 = ((($0)) + 4|0);
  HEAP32[$24>>2] = $22;
  $$0 = 0;
 } else {
  $19 = $16 & 4;
  $20 = ($19|0)==(0);
  if ($20) {
   $$0 = -1;
  } else {
   $21 = $16 | 32;
   HEAP32[$0>>2] = $21;
   $$0 = -1;
  }
 }
 return ($$0|0);
}
function _strchr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (___strchrnul($0,$1)|0);
 $3 = HEAP8[$2>>0]|0;
 $4 = $1&255;
 $5 = ($3<<24>>24)==($4<<24>>24);
 $6 = $5 ? $2 : 0;
 return ($6|0);
}
function _fclose($0) {
 $0 = $0|0;
 var $$pre = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 76|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)>(-1);
 if ($3) {
  (___lockfile($0)|0);
 }
 $4 = HEAP32[$0>>2]|0;
 $5 = $4 & 1;
 $6 = ($5|0)!=(0);
 if (!($6)) {
  ___lock(((19788)|0));
  $7 = ((($0)) + 52|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = ($8|0)==(0|0);
  $10 = $8;
  $$pre = ((($0)) + 56|0);
  if (!($9)) {
   $11 = HEAP32[$$pre>>2]|0;
   $12 = ((($8)) + 56|0);
   HEAP32[$12>>2] = $11;
  }
  $13 = HEAP32[$$pre>>2]|0;
  $14 = ($13|0)==(0|0);
  $15 = $13;
  if (!($14)) {
   $16 = ((($13)) + 52|0);
   HEAP32[$16>>2] = $10;
  }
  $17 = HEAP32[(19784)>>2]|0;
  $18 = ($17|0)==($0|0);
  if ($18) {
   HEAP32[(19784)>>2] = $15;
  }
  ___unlock(((19788)|0));
 }
 $19 = (_fflush($0)|0);
 $20 = ((($0)) + 12|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = (FUNCTION_TABLE_ii[$21 & 15]($0)|0);
 $23 = $22 | $19;
 $24 = ((($0)) + 92|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = ($25|0)==(0|0);
 if (!($26)) {
  _free($25);
 }
 if (!($6)) {
  _free($0);
 }
 return ($23|0);
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[1400]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $28 = 0;
   } else {
    $10 = HEAP32[1400]|0;
    $11 = (_fflush($10)|0);
    $28 = $11;
   }
   ___lock(((19788)|0));
   $$02325 = HEAP32[(19784)>>2]|0;
   $12 = ($$02325|0)==(0|0);
   if ($12) {
    $$024$lcssa = $28;
   } else {
    $$02327 = $$02325;$$02426 = $28;
    while(1) {
     $13 = ((($$02327)) + 76|0);
     $14 = HEAP32[$13>>2]|0;
     $15 = ($14|0)>(-1);
     if ($15) {
      $16 = (___lockfile($$02327)|0);
      $24 = $16;
     } else {
      $24 = 0;
     }
     $17 = ((($$02327)) + 20|0);
     $18 = HEAP32[$17>>2]|0;
     $19 = ((($$02327)) + 28|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = ($18>>>0)>($20>>>0);
     if ($21) {
      $22 = (___fflush_unlocked($$02327)|0);
      $23 = $22 | $$02426;
      $$1 = $23;
     } else {
      $$1 = $$02426;
     }
     $25 = ($24|0)==(0);
     if (!($25)) {
      ___unlockfile($$02327);
     }
     $26 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$26>>2]|0;
     $27 = ($$023|0)==(0|0);
     if ($27) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___unlock(((19788)|0));
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 7]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = ((($0)) + 40|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = $11;
   $18 = $13;
   $19 = (($17) - ($18))|0;
   (FUNCTION_TABLE_iiii[$16 & 7]($0,$19,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function ___strchrnul($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$029$lcssa = 0, $$02936 = 0, $$030$lcssa = 0, $$03039 = 0, $$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond33 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 & 255;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $8 = (_strlen($0)|0);
   $9 = (($0) + ($8)|0);
   $$0 = $9;
  } else {
   $4 = $0;
   $5 = $4 & 3;
   $6 = ($5|0)==(0);
   if ($6) {
    $$030$lcssa = $0;
   } else {
    $7 = $1&255;
    $$03039 = $0;
    while(1) {
     $10 = HEAP8[$$03039>>0]|0;
     $11 = ($10<<24>>24)==(0);
     $12 = ($10<<24>>24)==($7<<24>>24);
     $or$cond = $11 | $12;
     if ($or$cond) {
      $$0 = $$03039;
      break L1;
     }
     $13 = ((($$03039)) + 1|0);
     $14 = $13;
     $15 = $14 & 3;
     $16 = ($15|0)==(0);
     if ($16) {
      $$030$lcssa = $13;
      break;
     } else {
      $$03039 = $13;
     }
    }
   }
   $17 = Math_imul($2, 16843009)|0;
   $18 = HEAP32[$$030$lcssa>>2]|0;
   $19 = (($18) + -16843009)|0;
   $20 = $18 & -2139062144;
   $21 = $20 ^ -2139062144;
   $22 = $21 & $19;
   $23 = ($22|0)==(0);
   L10: do {
    if ($23) {
     $$02936 = $$030$lcssa;$25 = $18;
     while(1) {
      $24 = $25 ^ $17;
      $26 = (($24) + -16843009)|0;
      $27 = $24 & -2139062144;
      $28 = $27 ^ -2139062144;
      $29 = $28 & $26;
      $30 = ($29|0)==(0);
      if (!($30)) {
       $$029$lcssa = $$02936;
       break L10;
      }
      $31 = ((($$02936)) + 4|0);
      $32 = HEAP32[$31>>2]|0;
      $33 = (($32) + -16843009)|0;
      $34 = $32 & -2139062144;
      $35 = $34 ^ -2139062144;
      $36 = $35 & $33;
      $37 = ($36|0)==(0);
      if ($37) {
       $$02936 = $31;$25 = $32;
      } else {
       $$029$lcssa = $31;
       break;
      }
     }
    } else {
     $$029$lcssa = $$030$lcssa;
    }
   } while(0);
   $38 = $1&255;
   $$1 = $$029$lcssa;
   while(1) {
    $39 = HEAP8[$$1>>0]|0;
    $40 = ($39<<24>>24)==(0);
    $41 = ($39<<24>>24)==($38<<24>>24);
    $or$cond33 = $40 | $41;
    $42 = ((($$1)) + 1|0);
    if ($or$cond33) {
     $$0 = $$1;
     break;
    } else {
     $$1 = $42;
    }
   }
  }
 } while(0);
 return ($$0|0);
}
function _strlen($0) {
 $0 = $0|0;
 var $$0 = 0, $$014 = 0, $$015$lcssa = 0, $$01518 = 0, $$1$lcssa = 0, $$pn = 0, $$pn29 = 0, $$pre = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1 & 3;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $$015$lcssa = $0;
   label = 4;
  } else {
   $$01518 = $0;$22 = $1;
   while(1) {
    $4 = HEAP8[$$01518>>0]|0;
    $5 = ($4<<24>>24)==(0);
    if ($5) {
     $$pn = $22;
     break L1;
    }
    $6 = ((($$01518)) + 1|0);
    $7 = $6;
    $8 = $7 & 3;
    $9 = ($8|0)==(0);
    if ($9) {
     $$015$lcssa = $6;
     label = 4;
     break;
    } else {
     $$01518 = $6;$22 = $7;
    }
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $$0 = $$015$lcssa;
  while(1) {
   $10 = HEAP32[$$0>>2]|0;
   $11 = (($10) + -16843009)|0;
   $12 = $10 & -2139062144;
   $13 = $12 ^ -2139062144;
   $14 = $13 & $11;
   $15 = ($14|0)==(0);
   $16 = ((($$0)) + 4|0);
   if ($15) {
    $$0 = $16;
   } else {
    break;
   }
  }
  $17 = $10&255;
  $18 = ($17<<24>>24)==(0);
  if ($18) {
   $$1$lcssa = $$0;
  } else {
   $$pn29 = $$0;
   while(1) {
    $19 = ((($$pn29)) + 1|0);
    $$pre = HEAP8[$19>>0]|0;
    $20 = ($$pre<<24>>24)==(0);
    if ($20) {
     $$1$lcssa = $19;
     break;
    } else {
     $$pn29 = $19;
    }
   }
  }
  $21 = $$1$lcssa;
  $$pn = $21;
 }
 $$014 = (($$pn) - ($1))|0;
 return ($$014|0);
}
function ___fdopen($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$cast = 0, $$pre = 0, $$pre34 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $memchr = 0, $vararg_buffer = 0, $vararg_buffer12 = 0, $vararg_buffer3 = 0, $vararg_buffer7 = 0, $vararg_ptr1 = 0, $vararg_ptr10 = 0, $vararg_ptr11 = 0, $vararg_ptr15 = 0, $vararg_ptr16 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, dest = 0, label = 0;
 var sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0;
 $vararg_buffer12 = sp + 40|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $2 = sp + 52|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = $3 << 24 >> 24;
 $memchr = (_memchr(16048,$4,4)|0);
 $5 = ($memchr|0)==(0|0);
 if ($5) {
  $6 = (___errno_location()|0);
  HEAP32[$6>>2] = 22;
  $$0 = 0;
 } else {
  $7 = (_malloc(1144)|0);
  $8 = ($7|0)==(0|0);
  if ($8) {
   $$0 = 0;
  } else {
   dest=$7; stop=dest+112|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
   $9 = (_strchr($1,43)|0);
   $10 = ($9|0)==(0|0);
   if ($10) {
    $11 = ($3<<24>>24)==(114);
    $12 = $11 ? 8 : 4;
    HEAP32[$7>>2] = $12;
   }
   $13 = (_strchr($1,101)|0);
   $14 = ($13|0)==(0|0);
   if ($14) {
    $15 = $3;
   } else {
    HEAP32[$vararg_buffer>>2] = $0;
    $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
    HEAP32[$vararg_ptr1>>2] = 2;
    $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
    HEAP32[$vararg_ptr2>>2] = 1;
    (___syscall221(221,($vararg_buffer|0))|0);
    $$pre = HEAP8[$1>>0]|0;
    $15 = $$pre;
   }
   $16 = ($15<<24>>24)==(97);
   if ($16) {
    HEAP32[$vararg_buffer3>>2] = $0;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = 3;
    $17 = (___syscall221(221,($vararg_buffer3|0))|0);
    $18 = $17 & 1024;
    $19 = ($18|0)==(0);
    if ($19) {
     $20 = $17 | 1024;
     HEAP32[$vararg_buffer7>>2] = $0;
     $vararg_ptr10 = ((($vararg_buffer7)) + 4|0);
     HEAP32[$vararg_ptr10>>2] = 4;
     $vararg_ptr11 = ((($vararg_buffer7)) + 8|0);
     HEAP32[$vararg_ptr11>>2] = $20;
     (___syscall221(221,($vararg_buffer7|0))|0);
    }
    $21 = HEAP32[$7>>2]|0;
    $22 = $21 | 128;
    HEAP32[$7>>2] = $22;
    $29 = $22;
   } else {
    $$pre34 = HEAP32[$7>>2]|0;
    $29 = $$pre34;
   }
   $23 = ((($7)) + 60|0);
   HEAP32[$23>>2] = $0;
   $24 = ((($7)) + 120|0);
   $25 = ((($7)) + 44|0);
   HEAP32[$25>>2] = $24;
   $26 = ((($7)) + 48|0);
   HEAP32[$26>>2] = 1024;
   $27 = ((($7)) + 75|0);
   HEAP8[$27>>0] = -1;
   $28 = $29 & 8;
   $30 = ($28|0)==(0);
   if ($30) {
    HEAP32[$vararg_buffer12>>2] = $0;
    $vararg_ptr15 = ((($vararg_buffer12)) + 4|0);
    HEAP32[$vararg_ptr15>>2] = 21505;
    $vararg_ptr16 = ((($vararg_buffer12)) + 8|0);
    HEAP32[$vararg_ptr16>>2] = $2;
    $31 = (___syscall54(54,($vararg_buffer12|0))|0);
    $32 = ($31|0)==(0);
    if ($32) {
     HEAP8[$27>>0] = 10;
    }
   }
   $33 = ((($7)) + 32|0);
   HEAP32[$33>>2] = 5;
   $34 = ((($7)) + 36|0);
   HEAP32[$34>>2] = 1;
   $35 = ((($7)) + 40|0);
   HEAP32[$35>>2] = 2;
   $36 = ((($7)) + 12|0);
   HEAP32[$36>>2] = 10;
   $37 = HEAP32[(19764)>>2]|0;
   $38 = ($37|0)==(0);
   if ($38) {
    $39 = ((($7)) + 76|0);
    HEAP32[$39>>2] = -1;
   }
   ___lock(((19788)|0));
   $40 = HEAP32[(19784)>>2]|0;
   $41 = ((($7)) + 56|0);
   HEAP32[$41>>2] = $40;
   $42 = ($40|0)==(0);
   if (!($42)) {
    $$cast = $40;
    $43 = ((($$cast)) + 52|0);
    HEAP32[$43>>2] = $7;
   }
   HEAP32[(19784)>>2] = $7;
   ___unlock(((19788)|0));
   $$0 = $7;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _memchr($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$035$lcssa = 0, $$035$lcssa65 = 0, $$03555 = 0, $$036$lcssa = 0, $$036$lcssa64 = 0, $$03654 = 0, $$046 = 0, $$137$lcssa = 0, $$13745 = 0, $$140 = 0, $$2 = 0, $$23839 = 0, $$3 = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0;
 var $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond53 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1 & 255;
 $4 = $0;
 $5 = $4 & 3;
 $6 = ($5|0)!=(0);
 $7 = ($2|0)!=(0);
 $or$cond53 = $7 & $6;
 L1: do {
  if ($or$cond53) {
   $8 = $1&255;
   $$03555 = $0;$$03654 = $2;
   while(1) {
    $9 = HEAP8[$$03555>>0]|0;
    $10 = ($9<<24>>24)==($8<<24>>24);
    if ($10) {
     $$035$lcssa65 = $$03555;$$036$lcssa64 = $$03654;
     label = 6;
     break L1;
    }
    $11 = ((($$03555)) + 1|0);
    $12 = (($$03654) + -1)|0;
    $13 = $11;
    $14 = $13 & 3;
    $15 = ($14|0)!=(0);
    $16 = ($12|0)!=(0);
    $or$cond = $16 & $15;
    if ($or$cond) {
     $$03555 = $11;$$03654 = $12;
    } else {
     $$035$lcssa = $11;$$036$lcssa = $12;$$lcssa = $16;
     label = 5;
     break;
    }
   }
  } else {
   $$035$lcssa = $0;$$036$lcssa = $2;$$lcssa = $7;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($$lcssa) {
   $$035$lcssa65 = $$035$lcssa;$$036$lcssa64 = $$036$lcssa;
   label = 6;
  } else {
   $$2 = $$035$lcssa;$$3 = 0;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $17 = HEAP8[$$035$lcssa65>>0]|0;
   $18 = $1&255;
   $19 = ($17<<24>>24)==($18<<24>>24);
   if ($19) {
    $$2 = $$035$lcssa65;$$3 = $$036$lcssa64;
   } else {
    $20 = Math_imul($3, 16843009)|0;
    $21 = ($$036$lcssa64>>>0)>(3);
    L11: do {
     if ($21) {
      $$046 = $$035$lcssa65;$$13745 = $$036$lcssa64;
      while(1) {
       $22 = HEAP32[$$046>>2]|0;
       $23 = $22 ^ $20;
       $24 = (($23) + -16843009)|0;
       $25 = $23 & -2139062144;
       $26 = $25 ^ -2139062144;
       $27 = $26 & $24;
       $28 = ($27|0)==(0);
       if (!($28)) {
        break;
       }
       $29 = ((($$046)) + 4|0);
       $30 = (($$13745) + -4)|0;
       $31 = ($30>>>0)>(3);
       if ($31) {
        $$046 = $29;$$13745 = $30;
       } else {
        $$0$lcssa = $29;$$137$lcssa = $30;
        label = 11;
        break L11;
       }
      }
      $$140 = $$046;$$23839 = $$13745;
     } else {
      $$0$lcssa = $$035$lcssa65;$$137$lcssa = $$036$lcssa64;
      label = 11;
     }
    } while(0);
    if ((label|0) == 11) {
     $32 = ($$137$lcssa|0)==(0);
     if ($32) {
      $$2 = $$0$lcssa;$$3 = 0;
      break;
     } else {
      $$140 = $$0$lcssa;$$23839 = $$137$lcssa;
     }
    }
    while(1) {
     $33 = HEAP8[$$140>>0]|0;
     $34 = ($33<<24>>24)==($18<<24>>24);
     if ($34) {
      $$2 = $$140;$$3 = $$23839;
      break L8;
     }
     $35 = ((($$140)) + 1|0);
     $36 = (($$23839) + -1)|0;
     $37 = ($36|0)==(0);
     if ($37) {
      $$2 = $35;$$3 = 0;
      break;
     } else {
      $$140 = $35;$$23839 = $36;
     }
    }
   }
  }
 } while(0);
 $38 = ($$3|0)!=(0);
 $39 = $38 ? $$2 : 0;
 return ($39|0);
}
function _snprintf($0,$1,$2,$varargs) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $varargs = $varargs|0;
 var $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp;
 HEAP32[$3>>2] = $varargs;
 $4 = (_vsnprintf($0,$1,$2,$3)|0);
 STACKTOP = sp;return ($4|0);
}
function _vsnprintf($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$$015 = 0, $$0 = 0, $$014 = 0, $$015 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $4 = sp + 112|0;
 $5 = sp;
 dest=$5; src=5604; stop=dest+112|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $6 = (($1) + -1)|0;
 $7 = ($6>>>0)>(2147483646);
 if ($7) {
  $8 = ($1|0)==(0);
  if ($8) {
   $$014 = $4;$$015 = 1;
   label = 4;
  } else {
   $9 = (___errno_location()|0);
   HEAP32[$9>>2] = 75;
   $$0 = -1;
  }
 } else {
  $$014 = $0;$$015 = $1;
  label = 4;
 }
 if ((label|0) == 4) {
  $10 = $$014;
  $11 = (-2 - ($10))|0;
  $12 = ($$015>>>0)>($11>>>0);
  $$$015 = $12 ? $11 : $$015;
  $13 = ((($5)) + 48|0);
  HEAP32[$13>>2] = $$$015;
  $14 = ((($5)) + 20|0);
  HEAP32[$14>>2] = $$014;
  $15 = ((($5)) + 44|0);
  HEAP32[$15>>2] = $$014;
  $16 = (($$014) + ($$$015)|0);
  $17 = ((($5)) + 16|0);
  HEAP32[$17>>2] = $16;
  $18 = ((($5)) + 28|0);
  HEAP32[$18>>2] = $16;
  $19 = (_vfprintf($5,$2,$3)|0);
  $20 = ($$$015|0)==(0);
  if ($20) {
   $$0 = $19;
  } else {
   $21 = HEAP32[$14>>2]|0;
   $22 = HEAP32[$17>>2]|0;
   $23 = ($21|0)==($22|0);
   $24 = $23 << 31 >> 31;
   $25 = (($21) + ($24)|0);
   HEAP8[$25>>0] = 0;
   $$0 = $19;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _vfprintf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0 = 0, $$1 = 0, $$1$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0;
 $3 = sp + 120|0;
 $4 = sp + 80|0;
 $5 = sp;
 $6 = sp + 136|0;
 dest=$4; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$2>>2]|0;
 HEAP32[$3>>2] = $vacopy_currentptr;
 $7 = (_printf_core(0,$1,$3,$5,$4)|0);
 $8 = ($7|0)<(0);
 if ($8) {
  $$0 = -1;
 } else {
  $9 = ((($0)) + 76|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($10|0)>(-1);
  if ($11) {
   $12 = (___lockfile($0)|0);
   $39 = $12;
  } else {
   $39 = 0;
  }
  $13 = HEAP32[$0>>2]|0;
  $14 = $13 & 32;
  $15 = ((($0)) + 74|0);
  $16 = HEAP8[$15>>0]|0;
  $17 = ($16<<24>>24)<(1);
  if ($17) {
   $18 = $13 & -33;
   HEAP32[$0>>2] = $18;
  }
  $19 = ((($0)) + 48|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ($20|0)==(0);
  if ($21) {
   $23 = ((($0)) + 44|0);
   $24 = HEAP32[$23>>2]|0;
   HEAP32[$23>>2] = $6;
   $25 = ((($0)) + 28|0);
   HEAP32[$25>>2] = $6;
   $26 = ((($0)) + 20|0);
   HEAP32[$26>>2] = $6;
   HEAP32[$19>>2] = 80;
   $27 = ((($6)) + 80|0);
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = $27;
   $29 = (_printf_core($0,$1,$3,$5,$4)|0);
   $30 = ($24|0)==(0|0);
   if ($30) {
    $$1 = $29;
   } else {
    $31 = ((($0)) + 36|0);
    $32 = HEAP32[$31>>2]|0;
    (FUNCTION_TABLE_iiii[$32 & 7]($0,0,0)|0);
    $33 = HEAP32[$26>>2]|0;
    $34 = ($33|0)==(0|0);
    $$ = $34 ? -1 : $29;
    HEAP32[$23>>2] = $24;
    HEAP32[$19>>2] = 0;
    HEAP32[$28>>2] = 0;
    HEAP32[$25>>2] = 0;
    HEAP32[$26>>2] = 0;
    $$1 = $$;
   }
  } else {
   $22 = (_printf_core($0,$1,$3,$5,$4)|0);
   $$1 = $22;
  }
  $35 = HEAP32[$0>>2]|0;
  $36 = $35 & 32;
  $37 = ($36|0)==(0);
  $$1$ = $37 ? $$1 : -1;
  $38 = $35 | $14;
  HEAP32[$0>>2] = $38;
  $40 = ($39|0)==(0);
  if (!($40)) {
   ___unlockfile($0);
  }
  $$0 = $$1$;
 }
 STACKTOP = sp;return ($$0|0);
}
function _printf_core($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$$0259 = 0, $$$0262 = 0, $$$0269 = 0, $$$3484$i = 0, $$$3484705$i = 0, $$$3484706$i = 0, $$$3501$i = 0, $$$4266 = 0, $$$4502$i = 0, $$$5 = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$lcssa$i300 = 0, $$0228 = 0, $$0229396 = 0, $$0232 = 0, $$0235 = 0, $$0237 = 0;
 var $$0240$lcssa = 0, $$0240$lcssa460 = 0, $$0240395 = 0, $$0243 = 0, $$0247 = 0, $$0249$lcssa = 0, $$0249383 = 0, $$0252 = 0, $$0253 = 0, $$0254 = 0, $$0254$ = 0, $$0259 = 0, $$0262342 = 0, $$0262390 = 0, $$0269 = 0, $$0269$phi = 0, $$0321 = 0, $$0463$lcssa$i = 0, $$0463594$i = 0, $$0464603$i = 0;
 var $$0466$i = 0.0, $$0470$i = 0, $$0471$i = 0.0, $$0479$i = 0, $$0487652$i = 0, $$0488$i = 0, $$0488663$i = 0, $$0488665$i = 0, $$0496$$9$i = 0, $$0497664$i = 0, $$0498$i = 0, $$05$lcssa$i = 0, $$0509592$i = 0.0, $$0510$i = 0, $$0511$i = 0, $$0514647$i = 0, $$0520$i = 0, $$0522$$i = 0, $$0522$i = 0, $$0524$i = 0;
 var $$0526$i = 0, $$0528$i = 0, $$0528639$i = 0, $$0528641$i = 0, $$0531646$i = 0, $$056$i = 0, $$06$i = 0, $$06$i290 = 0, $$06$i298 = 0, $$1 = 0, $$1230407 = 0, $$1233 = 0, $$1236 = 0, $$1238 = 0, $$1241406 = 0, $$1244394 = 0, $$1248 = 0, $$1250 = 0, $$1255 = 0, $$1260 = 0;
 var $$1263 = 0, $$1263$ = 0, $$1270 = 0, $$1322 = 0, $$1465$i = 0, $$1467$i = 0.0, $$1469$i = 0.0, $$1472$i = 0.0, $$1480$i = 0, $$1482$lcssa$i = 0, $$1482671$i = 0, $$1489651$i = 0, $$1499$lcssa$i = 0, $$1499670$i = 0, $$1508593$i = 0, $$1512$lcssa$i = 0, $$1512617$i = 0, $$1515$i = 0, $$1521$i = 0, $$1525$i = 0;
 var $$1527$i = 0, $$1529624$i = 0, $$1532$lcssa$i = 0, $$1532640$i = 0, $$1607$i = 0, $$2 = 0, $$2$i = 0, $$2234 = 0, $$2239 = 0, $$2242381 = 0, $$2245 = 0, $$2251 = 0, $$2256 = 0, $$2256$ = 0, $$2261 = 0, $$2271 = 0, $$2323$lcssa = 0, $$2323382 = 0, $$2473$i = 0.0, $$2476$$545$i = 0;
 var $$2476$$547$i = 0, $$2476$i = 0, $$2483$ph$i = 0, $$2490$lcssa$i = 0, $$2490632$i = 0, $$2500$i = 0, $$2513$i = 0, $$2516628$i = 0, $$2530$i = 0, $$2533627$i = 0, $$3$i = 0.0, $$3257 = 0, $$3265 = 0, $$3272 = 0, $$331 = 0, $$332 = 0, $$333 = 0, $$3379 = 0, $$3477$i = 0, $$3484$lcssa$i = 0;
 var $$3484658$i = 0, $$3501$lcssa$i = 0, $$3501657$i = 0, $$3534623$i = 0, $$4$i = 0.0, $$4258458 = 0, $$4266 = 0, $$4325 = 0, $$4478$lcssa$i = 0, $$4478600$i = 0, $$4492$i = 0, $$4502$i = 0, $$4518$i = 0, $$5 = 0, $$5$lcssa$i = 0, $$537$i = 0, $$538$$i = 0, $$538$i = 0, $$541$i = 0.0, $$544$i = 0;
 var $$546$i = 0, $$5486$lcssa$i = 0, $$5486633$i = 0, $$5493606$i = 0, $$5519$ph$i = 0, $$553$i = 0, $$554$i = 0, $$557$i = 0.0, $$5611$i = 0, $$6 = 0, $$6$i = 0, $$6268 = 0, $$6494599$i = 0, $$7 = 0, $$7495610$i = 0, $$7505$$i = 0, $$7505$i = 0, $$7505$ph$i = 0, $$8$i = 0, $$9$ph$i = 0;
 var $$lcssa683$i = 0, $$neg$i = 0, $$neg572$i = 0, $$pn$i = 0, $$pr = 0, $$pr$i = 0, $$pr571$i = 0, $$pre = 0, $$pre$i = 0, $$pre$phi704$iZ2D = 0, $$pre452 = 0, $$pre453 = 0, $$pre454 = 0, $$pre697$i = 0, $$pre700$i = 0, $$pre703$i = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0;
 var $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0;
 var $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0;
 var $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0;
 var $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0;
 var $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0;
 var $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0;
 var $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0;
 var $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0.0, $372 = 0, $373 = 0, $374 = 0, $375 = 0.0;
 var $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0;
 var $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0.0, $404 = 0.0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0;
 var $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0.0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0.0, $424 = 0.0, $425 = 0.0, $426 = 0.0, $427 = 0.0, $428 = 0.0, $429 = 0, $43 = 0;
 var $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0;
 var $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0.0, $455 = 0.0, $456 = 0.0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0;
 var $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0;
 var $485 = 0, $486 = 0, $487 = 0.0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0.0, $494 = 0.0, $495 = 0.0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0;
 var $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0;
 var $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0;
 var $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0;
 var $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0;
 var $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0;
 var $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0.0, $606 = 0.0, $607 = 0, $608 = 0.0, $609 = 0, $61 = 0;
 var $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0;
 var $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0;
 var $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0;
 var $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0;
 var $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0;
 var $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0;
 var $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0;
 var $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0;
 var $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0;
 var $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0;
 var $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0;
 var $809 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0, $exitcond$i = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $isdigit = 0, $isdigit$i = 0, $isdigit$i292 = 0, $isdigit275 = 0;
 var $isdigit277 = 0, $isdigit5$i = 0, $isdigit5$i288 = 0, $isdigittmp = 0, $isdigittmp$ = 0, $isdigittmp$i = 0, $isdigittmp$i291 = 0, $isdigittmp274 = 0, $isdigittmp276 = 0, $isdigittmp4$i = 0, $isdigittmp4$i287 = 0, $isdigittmp7$i = 0, $isdigittmp7$i289 = 0, $notlhs$i = 0, $notrhs$i = 0, $or$cond = 0, $or$cond$i = 0, $or$cond280 = 0, $or$cond282 = 0, $or$cond285 = 0;
 var $or$cond3$not$i = 0, $or$cond412 = 0, $or$cond540$i = 0, $or$cond543$i = 0, $or$cond552$i = 0, $or$cond6$i = 0, $scevgep694$i = 0, $scevgep694695$i = 0, $storemerge = 0, $storemerge273345 = 0, $storemerge273389 = 0, $storemerge278 = 0, $sum = 0, $trunc = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 624|0;
 $5 = sp + 24|0;
 $6 = sp + 16|0;
 $7 = sp + 588|0;
 $8 = sp + 576|0;
 $9 = sp;
 $10 = sp + 536|0;
 $11 = sp + 8|0;
 $12 = sp + 528|0;
 $13 = ($0|0)!=(0|0);
 $14 = ((($10)) + 40|0);
 $15 = $14;
 $16 = ((($10)) + 39|0);
 $17 = ((($11)) + 4|0);
 $18 = $7;
 $19 = (0 - ($18))|0;
 $20 = ((($8)) + 12|0);
 $21 = ((($8)) + 11|0);
 $22 = $20;
 $23 = (($22) - ($18))|0;
 $24 = (-2 - ($18))|0;
 $25 = (($22) + 2)|0;
 $26 = ((($5)) + 288|0);
 $27 = ((($7)) + 9|0);
 $28 = $27;
 $29 = ((($7)) + 8|0);
 $$0243 = 0;$$0247 = 0;$$0269 = 0;$$0321 = $1;
 L1: while(1) {
  $30 = ($$0247|0)>(-1);
  do {
   if ($30) {
    $31 = (2147483647 - ($$0247))|0;
    $32 = ($$0243|0)>($31|0);
    if ($32) {
     $33 = (___errno_location()|0);
     HEAP32[$33>>2] = 75;
     $$1248 = -1;
     break;
    } else {
     $34 = (($$0243) + ($$0247))|0;
     $$1248 = $34;
     break;
    }
   } else {
    $$1248 = $$0247;
   }
  } while(0);
  $35 = HEAP8[$$0321>>0]|0;
  $36 = ($35<<24>>24)==(0);
  if ($36) {
   label = 243;
   break;
  } else {
   $$1322 = $$0321;$37 = $35;
  }
  L9: while(1) {
   switch ($37<<24>>24) {
   case 37:  {
    $$0249383 = $$1322;$$2323382 = $$1322;
    label = 9;
    break L9;
    break;
   }
   case 0:  {
    $$0249$lcssa = $$1322;$$2323$lcssa = $$1322;
    break L9;
    break;
   }
   default: {
   }
   }
   $38 = ((($$1322)) + 1|0);
   $$pre = HEAP8[$38>>0]|0;
   $$1322 = $38;$37 = $$pre;
  }
  L12: do {
   if ((label|0) == 9) {
    while(1) {
     label = 0;
     $39 = ((($$2323382)) + 1|0);
     $40 = HEAP8[$39>>0]|0;
     $41 = ($40<<24>>24)==(37);
     if (!($41)) {
      $$0249$lcssa = $$0249383;$$2323$lcssa = $$2323382;
      break L12;
     }
     $42 = ((($$0249383)) + 1|0);
     $43 = ((($$2323382)) + 2|0);
     $44 = HEAP8[$43>>0]|0;
     $45 = ($44<<24>>24)==(37);
     if ($45) {
      $$0249383 = $42;$$2323382 = $43;
      label = 9;
     } else {
      $$0249$lcssa = $42;$$2323$lcssa = $43;
      break;
     }
    }
   }
  } while(0);
  $46 = $$0249$lcssa;
  $47 = $$0321;
  $48 = (($46) - ($47))|0;
  if ($13) {
   $49 = HEAP32[$0>>2]|0;
   $50 = $49 & 32;
   $51 = ($50|0)==(0);
   if ($51) {
    (___fwritex($$0321,$48,$0)|0);
   }
  }
  $52 = ($48|0)==(0);
  if (!($52)) {
   $$0269$phi = $$0269;$$0243 = $48;$$0247 = $$1248;$$0321 = $$2323$lcssa;$$0269 = $$0269$phi;
   continue;
  }
  $53 = ((($$2323$lcssa)) + 1|0);
  $54 = HEAP8[$53>>0]|0;
  $55 = $54 << 24 >> 24;
  $isdigittmp = (($55) + -48)|0;
  $isdigit = ($isdigittmp>>>0)<(10);
  if ($isdigit) {
   $56 = ((($$2323$lcssa)) + 2|0);
   $57 = HEAP8[$56>>0]|0;
   $58 = ($57<<24>>24)==(36);
   $59 = ((($$2323$lcssa)) + 3|0);
   $$331 = $58 ? $59 : $53;
   $$$0269 = $58 ? 1 : $$0269;
   $isdigittmp$ = $58 ? $isdigittmp : -1;
   $$pre452 = HEAP8[$$331>>0]|0;
   $$0253 = $isdigittmp$;$$1270 = $$$0269;$61 = $$pre452;$storemerge = $$331;
  } else {
   $$0253 = -1;$$1270 = $$0269;$61 = $54;$storemerge = $53;
  }
  $60 = $61 << 24 >> 24;
  $62 = (($60) + -32)|0;
  $63 = ($62>>>0)<(32);
  L25: do {
   if ($63) {
    $$0262390 = 0;$65 = $62;$69 = $61;$storemerge273389 = $storemerge;
    while(1) {
     $64 = 1 << $65;
     $66 = $64 & 75913;
     $67 = ($66|0)==(0);
     if ($67) {
      $$0262342 = $$0262390;$78 = $69;$storemerge273345 = $storemerge273389;
      break L25;
     }
     $68 = $69 << 24 >> 24;
     $70 = (($68) + -32)|0;
     $71 = 1 << $70;
     $72 = $71 | $$0262390;
     $73 = ((($storemerge273389)) + 1|0);
     $74 = HEAP8[$73>>0]|0;
     $75 = $74 << 24 >> 24;
     $76 = (($75) + -32)|0;
     $77 = ($76>>>0)<(32);
     if ($77) {
      $$0262390 = $72;$65 = $76;$69 = $74;$storemerge273389 = $73;
     } else {
      $$0262342 = $72;$78 = $74;$storemerge273345 = $73;
      break;
     }
    }
   } else {
    $$0262342 = 0;$78 = $61;$storemerge273345 = $storemerge;
   }
  } while(0);
  $79 = ($78<<24>>24)==(42);
  do {
   if ($79) {
    $80 = ((($storemerge273345)) + 1|0);
    $81 = HEAP8[$80>>0]|0;
    $82 = $81 << 24 >> 24;
    $isdigittmp276 = (($82) + -48)|0;
    $isdigit277 = ($isdigittmp276>>>0)<(10);
    if ($isdigit277) {
     $83 = ((($storemerge273345)) + 2|0);
     $84 = HEAP8[$83>>0]|0;
     $85 = ($84<<24>>24)==(36);
     if ($85) {
      $86 = (($4) + ($isdigittmp276<<2)|0);
      HEAP32[$86>>2] = 10;
      $87 = HEAP8[$80>>0]|0;
      $88 = $87 << 24 >> 24;
      $89 = (($88) + -48)|0;
      $90 = (($3) + ($89<<3)|0);
      $91 = $90;
      $92 = $91;
      $93 = HEAP32[$92>>2]|0;
      $94 = (($91) + 4)|0;
      $95 = $94;
      $96 = HEAP32[$95>>2]|0;
      $97 = ((($storemerge273345)) + 3|0);
      $$0259 = $93;$$2271 = 1;$storemerge278 = $97;
     } else {
      label = 24;
     }
    } else {
     label = 24;
    }
    if ((label|0) == 24) {
     label = 0;
     $98 = ($$1270|0)==(0);
     if (!($98)) {
      $$0 = -1;
      break L1;
     }
     if (!($13)) {
      $$1260 = 0;$$1263 = $$0262342;$$3272 = 0;$$4325 = $80;$$pr = $81;
      break;
     }
     $arglist_current = HEAP32[$2>>2]|0;
     $99 = $arglist_current;
     $100 = ((0) + 4|0);
     $expanded4 = $100;
     $expanded = (($expanded4) - 1)|0;
     $101 = (($99) + ($expanded))|0;
     $102 = ((0) + 4|0);
     $expanded8 = $102;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $103 = $101 & $expanded6;
     $104 = $103;
     $105 = HEAP32[$104>>2]|0;
     $arglist_next = ((($104)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     $$0259 = $105;$$2271 = 0;$storemerge278 = $80;
    }
    $106 = ($$0259|0)<(0);
    $107 = $$0262342 | 8192;
    $108 = (0 - ($$0259))|0;
    $$$0262 = $106 ? $107 : $$0262342;
    $$$0259 = $106 ? $108 : $$0259;
    $$pre453 = HEAP8[$storemerge278>>0]|0;
    $$1260 = $$$0259;$$1263 = $$$0262;$$3272 = $$2271;$$4325 = $storemerge278;$$pr = $$pre453;
   } else {
    $109 = $78 << 24 >> 24;
    $isdigittmp4$i = (($109) + -48)|0;
    $isdigit5$i = ($isdigittmp4$i>>>0)<(10);
    if ($isdigit5$i) {
     $$06$i = 0;$113 = $storemerge273345;$isdigittmp7$i = $isdigittmp4$i;
     while(1) {
      $110 = ($$06$i*10)|0;
      $111 = (($110) + ($isdigittmp7$i))|0;
      $112 = ((($113)) + 1|0);
      $114 = HEAP8[$112>>0]|0;
      $115 = $114 << 24 >> 24;
      $isdigittmp$i = (($115) + -48)|0;
      $isdigit$i = ($isdigittmp$i>>>0)<(10);
      if ($isdigit$i) {
       $$06$i = $111;$113 = $112;$isdigittmp7$i = $isdigittmp$i;
      } else {
       break;
      }
     }
     $116 = ($111|0)<(0);
     if ($116) {
      $$0 = -1;
      break L1;
     } else {
      $$1260 = $111;$$1263 = $$0262342;$$3272 = $$1270;$$4325 = $112;$$pr = $114;
     }
    } else {
     $$1260 = 0;$$1263 = $$0262342;$$3272 = $$1270;$$4325 = $storemerge273345;$$pr = $78;
    }
   }
  } while(0);
  $117 = ($$pr<<24>>24)==(46);
  L45: do {
   if ($117) {
    $118 = ((($$4325)) + 1|0);
    $119 = HEAP8[$118>>0]|0;
    $120 = ($119<<24>>24)==(42);
    if (!($120)) {
     $147 = $119 << 24 >> 24;
     $isdigittmp4$i287 = (($147) + -48)|0;
     $isdigit5$i288 = ($isdigittmp4$i287>>>0)<(10);
     if ($isdigit5$i288) {
      $$06$i290 = 0;$151 = $118;$isdigittmp7$i289 = $isdigittmp4$i287;
     } else {
      $$0254 = 0;$$6 = $118;
      break;
     }
     while(1) {
      $148 = ($$06$i290*10)|0;
      $149 = (($148) + ($isdigittmp7$i289))|0;
      $150 = ((($151)) + 1|0);
      $152 = HEAP8[$150>>0]|0;
      $153 = $152 << 24 >> 24;
      $isdigittmp$i291 = (($153) + -48)|0;
      $isdigit$i292 = ($isdigittmp$i291>>>0)<(10);
      if ($isdigit$i292) {
       $$06$i290 = $149;$151 = $150;$isdigittmp7$i289 = $isdigittmp$i291;
      } else {
       $$0254 = $149;$$6 = $150;
       break L45;
      }
     }
    }
    $121 = ((($$4325)) + 2|0);
    $122 = HEAP8[$121>>0]|0;
    $123 = $122 << 24 >> 24;
    $isdigittmp274 = (($123) + -48)|0;
    $isdigit275 = ($isdigittmp274>>>0)<(10);
    if ($isdigit275) {
     $124 = ((($$4325)) + 3|0);
     $125 = HEAP8[$124>>0]|0;
     $126 = ($125<<24>>24)==(36);
     if ($126) {
      $127 = (($4) + ($isdigittmp274<<2)|0);
      HEAP32[$127>>2] = 10;
      $128 = HEAP8[$121>>0]|0;
      $129 = $128 << 24 >> 24;
      $130 = (($129) + -48)|0;
      $131 = (($3) + ($130<<3)|0);
      $132 = $131;
      $133 = $132;
      $134 = HEAP32[$133>>2]|0;
      $135 = (($132) + 4)|0;
      $136 = $135;
      $137 = HEAP32[$136>>2]|0;
      $138 = ((($$4325)) + 4|0);
      $$0254 = $134;$$6 = $138;
      break;
     }
    }
    $139 = ($$3272|0)==(0);
    if (!($139)) {
     $$0 = -1;
     break L1;
    }
    if ($13) {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $140 = $arglist_current2;
     $141 = ((0) + 4|0);
     $expanded11 = $141;
     $expanded10 = (($expanded11) - 1)|0;
     $142 = (($140) + ($expanded10))|0;
     $143 = ((0) + 4|0);
     $expanded15 = $143;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $144 = $142 & $expanded13;
     $145 = $144;
     $146 = HEAP32[$145>>2]|0;
     $arglist_next3 = ((($145)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $$0254 = $146;$$6 = $121;
    } else {
     $$0254 = 0;$$6 = $121;
    }
   } else {
    $$0254 = -1;$$6 = $$4325;
   }
  } while(0);
  $$0252 = 0;$$7 = $$6;
  while(1) {
   $154 = HEAP8[$$7>>0]|0;
   $155 = $154 << 24 >> 24;
   $156 = (($155) + -65)|0;
   $157 = ($156>>>0)>(57);
   if ($157) {
    $$0 = -1;
    break L1;
   }
   $158 = ((($$7)) + 1|0);
   $159 = ((15514 + (($$0252*58)|0)|0) + ($156)|0);
   $160 = HEAP8[$159>>0]|0;
   $161 = $160&255;
   $162 = (($161) + -1)|0;
   $163 = ($162>>>0)<(8);
   if ($163) {
    $$0252 = $161;$$7 = $158;
   } else {
    break;
   }
  }
  $164 = ($160<<24>>24)==(0);
  if ($164) {
   $$0 = -1;
   break;
  }
  $165 = ($160<<24>>24)==(19);
  $166 = ($$0253|0)>(-1);
  do {
   if ($165) {
    if ($166) {
     $$0 = -1;
     break L1;
    } else {
     label = 51;
    }
   } else {
    if ($166) {
     $167 = (($4) + ($$0253<<2)|0);
     HEAP32[$167>>2] = $161;
     $168 = (($3) + ($$0253<<3)|0);
     $169 = $168;
     $170 = $169;
     $171 = HEAP32[$170>>2]|0;
     $172 = (($169) + 4)|0;
     $173 = $172;
     $174 = HEAP32[$173>>2]|0;
     $175 = $9;
     $176 = $175;
     HEAP32[$176>>2] = $171;
     $177 = (($175) + 4)|0;
     $178 = $177;
     HEAP32[$178>>2] = $174;
     label = 51;
     break;
    }
    if (!($13)) {
     $$0 = 0;
     break L1;
    }
    _pop_arg_24($9,$161,$2);
   }
  } while(0);
  if ((label|0) == 51) {
   label = 0;
   if (!($13)) {
    $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
    continue;
   }
  }
  $179 = HEAP8[$$7>>0]|0;
  $180 = $179 << 24 >> 24;
  $181 = ($$0252|0)!=(0);
  $182 = $180 & 15;
  $183 = ($182|0)==(3);
  $or$cond280 = $181 & $183;
  $184 = $180 & -33;
  $$0235 = $or$cond280 ? $184 : $180;
  $185 = $$1263 & 8192;
  $186 = ($185|0)==(0);
  $187 = $$1263 & -65537;
  $$1263$ = $186 ? $$1263 : $187;
  L74: do {
   switch ($$0235|0) {
   case 110:  {
    $trunc = $$0252&255;
    switch ($trunc<<24>>24) {
    case 0:  {
     $194 = HEAP32[$9>>2]|0;
     HEAP32[$194>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 1:  {
     $195 = HEAP32[$9>>2]|0;
     HEAP32[$195>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 2:  {
     $196 = ($$1248|0)<(0);
     $197 = $196 << 31 >> 31;
     $198 = HEAP32[$9>>2]|0;
     $199 = $198;
     $200 = $199;
     HEAP32[$200>>2] = $$1248;
     $201 = (($199) + 4)|0;
     $202 = $201;
     HEAP32[$202>>2] = $197;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 3:  {
     $203 = $$1248&65535;
     $204 = HEAP32[$9>>2]|0;
     HEAP16[$204>>1] = $203;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 4:  {
     $205 = $$1248&255;
     $206 = HEAP32[$9>>2]|0;
     HEAP8[$206>>0] = $205;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 6:  {
     $207 = HEAP32[$9>>2]|0;
     HEAP32[$207>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 7:  {
     $208 = ($$1248|0)<(0);
     $209 = $208 << 31 >> 31;
     $210 = HEAP32[$9>>2]|0;
     $211 = $210;
     $212 = $211;
     HEAP32[$212>>2] = $$1248;
     $213 = (($211) + 4)|0;
     $214 = $213;
     HEAP32[$214>>2] = $209;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    default: {
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
    }
    }
    break;
   }
   case 112:  {
    $215 = ($$0254>>>0)>(8);
    $216 = $215 ? $$0254 : 8;
    $217 = $$1263$ | 8;
    $$1236 = 120;$$1255 = $216;$$3265 = $217;
    label = 63;
    break;
   }
   case 88: case 120:  {
    $$1236 = $$0235;$$1255 = $$0254;$$3265 = $$1263$;
    label = 63;
    break;
   }
   case 111:  {
    $257 = $9;
    $258 = $257;
    $259 = HEAP32[$258>>2]|0;
    $260 = (($257) + 4)|0;
    $261 = $260;
    $262 = HEAP32[$261>>2]|0;
    $263 = ($259|0)==(0);
    $264 = ($262|0)==(0);
    $265 = $263 & $264;
    if ($265) {
     $$0$lcssa$i300 = $14;
    } else {
     $$06$i298 = $14;$267 = $259;$271 = $262;
     while(1) {
      $266 = $267 & 7;
      $268 = $266 | 48;
      $269 = $268&255;
      $270 = ((($$06$i298)) + -1|0);
      HEAP8[$270>>0] = $269;
      $272 = (_bitshift64Lshr(($267|0),($271|0),3)|0);
      $273 = tempRet0;
      $274 = ($272|0)==(0);
      $275 = ($273|0)==(0);
      $276 = $274 & $275;
      if ($276) {
       $$0$lcssa$i300 = $270;
       break;
      } else {
       $$06$i298 = $270;$267 = $272;$271 = $273;
      }
     }
    }
    $277 = $$1263$ & 8;
    $278 = ($277|0)==(0);
    if ($278) {
     $$0228 = $$0$lcssa$i300;$$1233 = 0;$$1238 = 15994;$$2256 = $$0254;$$4266 = $$1263$;
     label = 76;
    } else {
     $279 = $$0$lcssa$i300;
     $280 = (($15) - ($279))|0;
     $281 = ($$0254|0)>($280|0);
     $282 = (($280) + 1)|0;
     $$0254$ = $281 ? $$0254 : $282;
     $$0228 = $$0$lcssa$i300;$$1233 = 0;$$1238 = 15994;$$2256 = $$0254$;$$4266 = $$1263$;
     label = 76;
    }
    break;
   }
   case 105: case 100:  {
    $283 = $9;
    $284 = $283;
    $285 = HEAP32[$284>>2]|0;
    $286 = (($283) + 4)|0;
    $287 = $286;
    $288 = HEAP32[$287>>2]|0;
    $289 = ($288|0)<(0);
    if ($289) {
     $290 = (_i64Subtract(0,0,($285|0),($288|0))|0);
     $291 = tempRet0;
     $292 = $9;
     $293 = $292;
     HEAP32[$293>>2] = $290;
     $294 = (($292) + 4)|0;
     $295 = $294;
     HEAP32[$295>>2] = $291;
     $$0232 = 1;$$0237 = 15994;$300 = $290;$301 = $291;
     label = 75;
     break L74;
    }
    $296 = $$1263$ & 2048;
    $297 = ($296|0)==(0);
    if ($297) {
     $298 = $$1263$ & 1;
     $299 = ($298|0)==(0);
     $$ = $299 ? 15994 : (15996);
     $$0232 = $298;$$0237 = $$;$300 = $285;$301 = $288;
     label = 75;
    } else {
     $$0232 = 1;$$0237 = (15995);$300 = $285;$301 = $288;
     label = 75;
    }
    break;
   }
   case 117:  {
    $188 = $9;
    $189 = $188;
    $190 = HEAP32[$189>>2]|0;
    $191 = (($188) + 4)|0;
    $192 = $191;
    $193 = HEAP32[$192>>2]|0;
    $$0232 = 0;$$0237 = 15994;$300 = $190;$301 = $193;
    label = 75;
    break;
   }
   case 99:  {
    $321 = $9;
    $322 = $321;
    $323 = HEAP32[$322>>2]|0;
    $324 = (($321) + 4)|0;
    $325 = $324;
    $326 = HEAP32[$325>>2]|0;
    $327 = $323&255;
    HEAP8[$16>>0] = $327;
    $$2 = $16;$$2234 = 0;$$2239 = 15994;$$2251 = $14;$$5 = 1;$$6268 = $187;
    break;
   }
   case 109:  {
    $328 = (___errno_location()|0);
    $329 = HEAP32[$328>>2]|0;
    $330 = (_strerror($329)|0);
    $$1 = $330;
    label = 81;
    break;
   }
   case 115:  {
    $331 = HEAP32[$9>>2]|0;
    $332 = ($331|0)!=(0|0);
    $333 = $332 ? $331 : 16004;
    $$1 = $333;
    label = 81;
    break;
   }
   case 67:  {
    $340 = $9;
    $341 = $340;
    $342 = HEAP32[$341>>2]|0;
    $343 = (($340) + 4)|0;
    $344 = $343;
    $345 = HEAP32[$344>>2]|0;
    HEAP32[$11>>2] = $342;
    HEAP32[$17>>2] = 0;
    HEAP32[$9>>2] = $11;
    $$4258458 = -1;$809 = $11;
    label = 85;
    break;
   }
   case 83:  {
    $$pre454 = HEAP32[$9>>2]|0;
    $346 = ($$0254|0)==(0);
    if ($346) {
     _pad($0,32,$$1260,0,$$1263$);
     $$0240$lcssa460 = 0;
     label = 96;
    } else {
     $$4258458 = $$0254;$809 = $$pre454;
     label = 85;
    }
    break;
   }
   case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
    $371 = +HEAPF64[$9>>3];
    HEAP32[$6>>2] = 0;
    HEAPF64[tempDoublePtr>>3] = $371;$372 = HEAP32[tempDoublePtr>>2]|0;
    $373 = HEAP32[tempDoublePtr+4>>2]|0;
    $374 = ($373|0)<(0);
    if ($374) {
     $375 = -$371;
     $$0471$i = $375;$$0520$i = 1;$$0522$i = 16011;
    } else {
     $376 = $$1263$ & 2048;
     $377 = ($376|0)==(0);
     $378 = $$1263$ & 1;
     if ($377) {
      $379 = ($378|0)==(0);
      $$$i = $379 ? (16012) : (16017);
      $$0471$i = $371;$$0520$i = $378;$$0522$i = $$$i;
     } else {
      $$0471$i = $371;$$0520$i = 1;$$0522$i = (16014);
     }
    }
    HEAPF64[tempDoublePtr>>3] = $$0471$i;$380 = HEAP32[tempDoublePtr>>2]|0;
    $381 = HEAP32[tempDoublePtr+4>>2]|0;
    $382 = $381 & 2146435072;
    $383 = ($382>>>0)<(2146435072);
    $384 = (0)<(0);
    $385 = ($382|0)==(2146435072);
    $386 = $385 & $384;
    $387 = $383 | $386;
    do {
     if ($387) {
      $403 = (+_frexpl($$0471$i,$6));
      $404 = $403 * 2.0;
      $405 = $404 != 0.0;
      if ($405) {
       $406 = HEAP32[$6>>2]|0;
       $407 = (($406) + -1)|0;
       HEAP32[$6>>2] = $407;
      }
      $408 = $$0235 | 32;
      $409 = ($408|0)==(97);
      if ($409) {
       $410 = $$0235 & 32;
       $411 = ($410|0)==(0);
       $412 = ((($$0522$i)) + 9|0);
       $$0522$$i = $411 ? $$0522$i : $412;
       $413 = $$0520$i | 2;
       $414 = ($$0254>>>0)>(11);
       $415 = (12 - ($$0254))|0;
       $416 = ($415|0)==(0);
       $417 = $414 | $416;
       do {
        if ($417) {
         $$1472$i = $404;
        } else {
         $$0509592$i = 8.0;$$1508593$i = $415;
         while(1) {
          $418 = (($$1508593$i) + -1)|0;
          $419 = $$0509592$i * 16.0;
          $420 = ($418|0)==(0);
          if ($420) {
           break;
          } else {
           $$0509592$i = $419;$$1508593$i = $418;
          }
         }
         $421 = HEAP8[$$0522$$i>>0]|0;
         $422 = ($421<<24>>24)==(45);
         if ($422) {
          $423 = -$404;
          $424 = $423 - $419;
          $425 = $419 + $424;
          $426 = -$425;
          $$1472$i = $426;
          break;
         } else {
          $427 = $404 + $419;
          $428 = $427 - $419;
          $$1472$i = $428;
          break;
         }
        }
       } while(0);
       $429 = HEAP32[$6>>2]|0;
       $430 = ($429|0)<(0);
       $431 = (0 - ($429))|0;
       $432 = $430 ? $431 : $429;
       $433 = ($432|0)<(0);
       $434 = $433 << 31 >> 31;
       $435 = (_fmt_u($432,$434,$20)|0);
       $436 = ($435|0)==($20|0);
       if ($436) {
        HEAP8[$21>>0] = 48;
        $$0511$i = $21;
       } else {
        $$0511$i = $435;
       }
       $437 = $429 >> 31;
       $438 = $437 & 2;
       $439 = (($438) + 43)|0;
       $440 = $439&255;
       $441 = ((($$0511$i)) + -1|0);
       HEAP8[$441>>0] = $440;
       $442 = (($$0235) + 15)|0;
       $443 = $442&255;
       $444 = ((($$0511$i)) + -2|0);
       HEAP8[$444>>0] = $443;
       $notrhs$i = ($$0254|0)<(1);
       $445 = $$1263$ & 8;
       $446 = ($445|0)==(0);
       $$0524$i = $7;$$2473$i = $$1472$i;
       while(1) {
        $447 = (~~(($$2473$i)));
        $448 = (15978 + ($447)|0);
        $449 = HEAP8[$448>>0]|0;
        $450 = $449&255;
        $451 = $450 | $410;
        $452 = $451&255;
        $453 = ((($$0524$i)) + 1|0);
        HEAP8[$$0524$i>>0] = $452;
        $454 = (+($447|0));
        $455 = $$2473$i - $454;
        $456 = $455 * 16.0;
        $457 = $453;
        $458 = (($457) - ($18))|0;
        $459 = ($458|0)==(1);
        do {
         if ($459) {
          $notlhs$i = $456 == 0.0;
          $or$cond3$not$i = $notrhs$i & $notlhs$i;
          $or$cond$i = $446 & $or$cond3$not$i;
          if ($or$cond$i) {
           $$1525$i = $453;
           break;
          }
          $460 = ((($$0524$i)) + 2|0);
          HEAP8[$453>>0] = 46;
          $$1525$i = $460;
         } else {
          $$1525$i = $453;
         }
        } while(0);
        $461 = $456 != 0.0;
        if ($461) {
         $$0524$i = $$1525$i;$$2473$i = $456;
        } else {
         break;
        }
       }
       $462 = ($$0254|0)!=(0);
       $$pre700$i = $$1525$i;
       $463 = (($24) + ($$pre700$i))|0;
       $464 = ($463|0)<($$0254|0);
       $or$cond412 = $462 & $464;
       $465 = $444;
       $466 = (($25) + ($$0254))|0;
       $467 = (($466) - ($465))|0;
       $468 = (($23) - ($465))|0;
       $469 = (($468) + ($$pre700$i))|0;
       $$0526$i = $or$cond412 ? $467 : $469;
       $470 = (($$0526$i) + ($413))|0;
       _pad($0,32,$$1260,$470,$$1263$);
       $471 = HEAP32[$0>>2]|0;
       $472 = $471 & 32;
       $473 = ($472|0)==(0);
       if ($473) {
        (___fwritex($$0522$$i,$413,$0)|0);
       }
       $474 = $$1263$ ^ 65536;
       _pad($0,48,$$1260,$470,$474);
       $475 = (($$pre700$i) - ($18))|0;
       $476 = HEAP32[$0>>2]|0;
       $477 = $476 & 32;
       $478 = ($477|0)==(0);
       if ($478) {
        (___fwritex($7,$475,$0)|0);
       }
       $479 = (($22) - ($465))|0;
       $sum = (($475) + ($479))|0;
       $480 = (($$0526$i) - ($sum))|0;
       _pad($0,48,$480,0,0);
       $481 = HEAP32[$0>>2]|0;
       $482 = $481 & 32;
       $483 = ($482|0)==(0);
       if ($483) {
        (___fwritex($444,$479,$0)|0);
       }
       $484 = $$1263$ ^ 8192;
       _pad($0,32,$$1260,$470,$484);
       $485 = ($470|0)<($$1260|0);
       $$537$i = $485 ? $$1260 : $470;
       $$0470$i = $$537$i;
       break;
      }
      $486 = ($$0254|0)<(0);
      $$538$i = $486 ? 6 : $$0254;
      if ($405) {
       $487 = $404 * 268435456.0;
       $488 = HEAP32[$6>>2]|0;
       $489 = (($488) + -28)|0;
       HEAP32[$6>>2] = $489;
       $$3$i = $487;$$pr$i = $489;
      } else {
       $$pre697$i = HEAP32[$6>>2]|0;
       $$3$i = $404;$$pr$i = $$pre697$i;
      }
      $490 = ($$pr$i|0)<(0);
      $$554$i = $490 ? $5 : $26;
      $$0498$i = $$554$i;$$4$i = $$3$i;
      while(1) {
       $491 = (~~(($$4$i))>>>0);
       HEAP32[$$0498$i>>2] = $491;
       $492 = ((($$0498$i)) + 4|0);
       $493 = (+($491>>>0));
       $494 = $$4$i - $493;
       $495 = $494 * 1.0E+9;
       $496 = $495 != 0.0;
       if ($496) {
        $$0498$i = $492;$$4$i = $495;
       } else {
        break;
       }
      }
      $497 = ($$pr$i|0)>(0);
      if ($497) {
       $$1482671$i = $$554$i;$$1499670$i = $492;$498 = $$pr$i;
       while(1) {
        $499 = ($498|0)>(29);
        $500 = $499 ? 29 : $498;
        $$0488663$i = ((($$1499670$i)) + -4|0);
        $501 = ($$0488663$i>>>0)<($$1482671$i>>>0);
        do {
         if ($501) {
          $$2483$ph$i = $$1482671$i;
         } else {
          $$0488665$i = $$0488663$i;$$0497664$i = 0;
          while(1) {
           $502 = HEAP32[$$0488665$i>>2]|0;
           $503 = (_bitshift64Shl(($502|0),0,($500|0))|0);
           $504 = tempRet0;
           $505 = (_i64Add(($503|0),($504|0),($$0497664$i|0),0)|0);
           $506 = tempRet0;
           $507 = (___uremdi3(($505|0),($506|0),1000000000,0)|0);
           $508 = tempRet0;
           HEAP32[$$0488665$i>>2] = $507;
           $509 = (___udivdi3(($505|0),($506|0),1000000000,0)|0);
           $510 = tempRet0;
           $$0488$i = ((($$0488665$i)) + -4|0);
           $511 = ($$0488$i>>>0)<($$1482671$i>>>0);
           if ($511) {
            break;
           } else {
            $$0488665$i = $$0488$i;$$0497664$i = $509;
           }
          }
          $512 = ($509|0)==(0);
          if ($512) {
           $$2483$ph$i = $$1482671$i;
           break;
          }
          $513 = ((($$1482671$i)) + -4|0);
          HEAP32[$513>>2] = $509;
          $$2483$ph$i = $513;
         }
        } while(0);
        $$2500$i = $$1499670$i;
        while(1) {
         $514 = ($$2500$i>>>0)>($$2483$ph$i>>>0);
         if (!($514)) {
          break;
         }
         $515 = ((($$2500$i)) + -4|0);
         $516 = HEAP32[$515>>2]|0;
         $517 = ($516|0)==(0);
         if ($517) {
          $$2500$i = $515;
         } else {
          break;
         }
        }
        $518 = HEAP32[$6>>2]|0;
        $519 = (($518) - ($500))|0;
        HEAP32[$6>>2] = $519;
        $520 = ($519|0)>(0);
        if ($520) {
         $$1482671$i = $$2483$ph$i;$$1499670$i = $$2500$i;$498 = $519;
        } else {
         $$1482$lcssa$i = $$2483$ph$i;$$1499$lcssa$i = $$2500$i;$$pr571$i = $519;
         break;
        }
       }
      } else {
       $$1482$lcssa$i = $$554$i;$$1499$lcssa$i = $492;$$pr571$i = $$pr$i;
      }
      $521 = ($$pr571$i|0)<(0);
      if ($521) {
       $522 = (($$538$i) + 25)|0;
       $523 = (($522|0) / 9)&-1;
       $524 = (($523) + 1)|0;
       $525 = ($408|0)==(102);
       $$3484658$i = $$1482$lcssa$i;$$3501657$i = $$1499$lcssa$i;$527 = $$pr571$i;
       while(1) {
        $526 = (0 - ($527))|0;
        $528 = ($526|0)>(9);
        $529 = $528 ? 9 : $526;
        $530 = ($$3484658$i>>>0)<($$3501657$i>>>0);
        do {
         if ($530) {
          $534 = 1 << $529;
          $535 = (($534) + -1)|0;
          $536 = 1000000000 >>> $529;
          $$0487652$i = 0;$$1489651$i = $$3484658$i;
          while(1) {
           $537 = HEAP32[$$1489651$i>>2]|0;
           $538 = $537 & $535;
           $539 = $537 >>> $529;
           $540 = (($539) + ($$0487652$i))|0;
           HEAP32[$$1489651$i>>2] = $540;
           $541 = Math_imul($538, $536)|0;
           $542 = ((($$1489651$i)) + 4|0);
           $543 = ($542>>>0)<($$3501657$i>>>0);
           if ($543) {
            $$0487652$i = $541;$$1489651$i = $542;
           } else {
            break;
           }
          }
          $544 = HEAP32[$$3484658$i>>2]|0;
          $545 = ($544|0)==(0);
          $546 = ((($$3484658$i)) + 4|0);
          $$$3484$i = $545 ? $546 : $$3484658$i;
          $547 = ($541|0)==(0);
          if ($547) {
           $$$3484706$i = $$$3484$i;$$4502$i = $$3501657$i;
           break;
          }
          $548 = ((($$3501657$i)) + 4|0);
          HEAP32[$$3501657$i>>2] = $541;
          $$$3484706$i = $$$3484$i;$$4502$i = $548;
         } else {
          $531 = HEAP32[$$3484658$i>>2]|0;
          $532 = ($531|0)==(0);
          $533 = ((($$3484658$i)) + 4|0);
          $$$3484705$i = $532 ? $533 : $$3484658$i;
          $$$3484706$i = $$$3484705$i;$$4502$i = $$3501657$i;
         }
        } while(0);
        $549 = $525 ? $$554$i : $$$3484706$i;
        $550 = $$4502$i;
        $551 = $549;
        $552 = (($550) - ($551))|0;
        $553 = $552 >> 2;
        $554 = ($553|0)>($524|0);
        $555 = (($549) + ($524<<2)|0);
        $$$4502$i = $554 ? $555 : $$4502$i;
        $556 = HEAP32[$6>>2]|0;
        $557 = (($556) + ($529))|0;
        HEAP32[$6>>2] = $557;
        $558 = ($557|0)<(0);
        if ($558) {
         $$3484658$i = $$$3484706$i;$$3501657$i = $$$4502$i;$527 = $557;
        } else {
         $$3484$lcssa$i = $$$3484706$i;$$3501$lcssa$i = $$$4502$i;
         break;
        }
       }
      } else {
       $$3484$lcssa$i = $$1482$lcssa$i;$$3501$lcssa$i = $$1499$lcssa$i;
      }
      $559 = ($$3484$lcssa$i>>>0)<($$3501$lcssa$i>>>0);
      $560 = $$554$i;
      do {
       if ($559) {
        $561 = $$3484$lcssa$i;
        $562 = (($560) - ($561))|0;
        $563 = $562 >> 2;
        $564 = ($563*9)|0;
        $565 = HEAP32[$$3484$lcssa$i>>2]|0;
        $566 = ($565>>>0)<(10);
        if ($566) {
         $$1515$i = $564;
         break;
        } else {
         $$0514647$i = $564;$$0531646$i = 10;
        }
        while(1) {
         $567 = ($$0531646$i*10)|0;
         $568 = (($$0514647$i) + 1)|0;
         $569 = ($565>>>0)<($567>>>0);
         if ($569) {
          $$1515$i = $568;
          break;
         } else {
          $$0514647$i = $568;$$0531646$i = $567;
         }
        }
       } else {
        $$1515$i = 0;
       }
      } while(0);
      $570 = ($408|0)!=(102);
      $571 = $570 ? $$1515$i : 0;
      $572 = (($$538$i) - ($571))|0;
      $573 = ($408|0)==(103);
      $574 = ($$538$i|0)!=(0);
      $575 = $574 & $573;
      $$neg$i = $575 << 31 >> 31;
      $576 = (($572) + ($$neg$i))|0;
      $577 = $$3501$lcssa$i;
      $578 = (($577) - ($560))|0;
      $579 = $578 >> 2;
      $580 = ($579*9)|0;
      $581 = (($580) + -9)|0;
      $582 = ($576|0)<($581|0);
      if ($582) {
       $583 = ((($$554$i)) + 4|0);
       $584 = (($576) + 9216)|0;
       $585 = (($584|0) / 9)&-1;
       $586 = (($585) + -1024)|0;
       $587 = (($583) + ($586<<2)|0);
       $588 = (($584|0) % 9)&-1;
       $$0528639$i = (($588) + 1)|0;
       $589 = ($$0528639$i|0)<(9);
       if ($589) {
        $$0528641$i = $$0528639$i;$$1532640$i = 10;
        while(1) {
         $590 = ($$1532640$i*10)|0;
         $$0528$i = (($$0528641$i) + 1)|0;
         $exitcond$i = ($$0528$i|0)==(9);
         if ($exitcond$i) {
          $$1532$lcssa$i = $590;
          break;
         } else {
          $$0528641$i = $$0528$i;$$1532640$i = $590;
         }
        }
       } else {
        $$1532$lcssa$i = 10;
       }
       $591 = HEAP32[$587>>2]|0;
       $592 = (($591>>>0) % ($$1532$lcssa$i>>>0))&-1;
       $593 = ($592|0)==(0);
       $594 = ((($587)) + 4|0);
       $595 = ($594|0)==($$3501$lcssa$i|0);
       $or$cond540$i = $595 & $593;
       do {
        if ($or$cond540$i) {
         $$4492$i = $587;$$4518$i = $$1515$i;$$8$i = $$3484$lcssa$i;
        } else {
         $596 = (($591>>>0) / ($$1532$lcssa$i>>>0))&-1;
         $597 = $596 & 1;
         $598 = ($597|0)==(0);
         $$541$i = $598 ? 9007199254740992.0 : 9007199254740994.0;
         $599 = (($$1532$lcssa$i|0) / 2)&-1;
         $600 = ($592>>>0)<($599>>>0);
         if ($600) {
          $$0466$i = 0.5;
         } else {
          $601 = ($592|0)==($599|0);
          $or$cond543$i = $595 & $601;
          $$557$i = $or$cond543$i ? 1.0 : 1.5;
          $$0466$i = $$557$i;
         }
         $602 = ($$0520$i|0)==(0);
         do {
          if ($602) {
           $$1467$i = $$0466$i;$$1469$i = $$541$i;
          } else {
           $603 = HEAP8[$$0522$i>>0]|0;
           $604 = ($603<<24>>24)==(45);
           if (!($604)) {
            $$1467$i = $$0466$i;$$1469$i = $$541$i;
            break;
           }
           $605 = -$$541$i;
           $606 = -$$0466$i;
           $$1467$i = $606;$$1469$i = $605;
          }
         } while(0);
         $607 = (($591) - ($592))|0;
         HEAP32[$587>>2] = $607;
         $608 = $$1469$i + $$1467$i;
         $609 = $608 != $$1469$i;
         if (!($609)) {
          $$4492$i = $587;$$4518$i = $$1515$i;$$8$i = $$3484$lcssa$i;
          break;
         }
         $610 = (($607) + ($$1532$lcssa$i))|0;
         HEAP32[$587>>2] = $610;
         $611 = ($610>>>0)>(999999999);
         if ($611) {
          $$2490632$i = $587;$$5486633$i = $$3484$lcssa$i;
          while(1) {
           $612 = ((($$2490632$i)) + -4|0);
           HEAP32[$$2490632$i>>2] = 0;
           $613 = ($612>>>0)<($$5486633$i>>>0);
           if ($613) {
            $614 = ((($$5486633$i)) + -4|0);
            HEAP32[$614>>2] = 0;
            $$6$i = $614;
           } else {
            $$6$i = $$5486633$i;
           }
           $615 = HEAP32[$612>>2]|0;
           $616 = (($615) + 1)|0;
           HEAP32[$612>>2] = $616;
           $617 = ($616>>>0)>(999999999);
           if ($617) {
            $$2490632$i = $612;$$5486633$i = $$6$i;
           } else {
            $$2490$lcssa$i = $612;$$5486$lcssa$i = $$6$i;
            break;
           }
          }
         } else {
          $$2490$lcssa$i = $587;$$5486$lcssa$i = $$3484$lcssa$i;
         }
         $618 = $$5486$lcssa$i;
         $619 = (($560) - ($618))|0;
         $620 = $619 >> 2;
         $621 = ($620*9)|0;
         $622 = HEAP32[$$5486$lcssa$i>>2]|0;
         $623 = ($622>>>0)<(10);
         if ($623) {
          $$4492$i = $$2490$lcssa$i;$$4518$i = $621;$$8$i = $$5486$lcssa$i;
          break;
         } else {
          $$2516628$i = $621;$$2533627$i = 10;
         }
         while(1) {
          $624 = ($$2533627$i*10)|0;
          $625 = (($$2516628$i) + 1)|0;
          $626 = ($622>>>0)<($624>>>0);
          if ($626) {
           $$4492$i = $$2490$lcssa$i;$$4518$i = $625;$$8$i = $$5486$lcssa$i;
           break;
          } else {
           $$2516628$i = $625;$$2533627$i = $624;
          }
         }
        }
       } while(0);
       $627 = ((($$4492$i)) + 4|0);
       $628 = ($$3501$lcssa$i>>>0)>($627>>>0);
       $$$3501$i = $628 ? $627 : $$3501$lcssa$i;
       $$5519$ph$i = $$4518$i;$$7505$ph$i = $$$3501$i;$$9$ph$i = $$8$i;
      } else {
       $$5519$ph$i = $$1515$i;$$7505$ph$i = $$3501$lcssa$i;$$9$ph$i = $$3484$lcssa$i;
      }
      $629 = (0 - ($$5519$ph$i))|0;
      $$7505$i = $$7505$ph$i;
      while(1) {
       $630 = ($$7505$i>>>0)>($$9$ph$i>>>0);
       if (!($630)) {
        $$lcssa683$i = 0;
        break;
       }
       $631 = ((($$7505$i)) + -4|0);
       $632 = HEAP32[$631>>2]|0;
       $633 = ($632|0)==(0);
       if ($633) {
        $$7505$i = $631;
       } else {
        $$lcssa683$i = 1;
        break;
       }
      }
      do {
       if ($573) {
        $634 = $574&1;
        $635 = $634 ^ 1;
        $$538$$i = (($635) + ($$538$i))|0;
        $636 = ($$538$$i|0)>($$5519$ph$i|0);
        $637 = ($$5519$ph$i|0)>(-5);
        $or$cond6$i = $636 & $637;
        if ($or$cond6$i) {
         $638 = (($$0235) + -1)|0;
         $$neg572$i = (($$538$$i) + -1)|0;
         $639 = (($$neg572$i) - ($$5519$ph$i))|0;
         $$0479$i = $638;$$2476$i = $639;
        } else {
         $640 = (($$0235) + -2)|0;
         $641 = (($$538$$i) + -1)|0;
         $$0479$i = $640;$$2476$i = $641;
        }
        $642 = $$1263$ & 8;
        $643 = ($642|0)==(0);
        if (!($643)) {
         $$1480$i = $$0479$i;$$3477$i = $$2476$i;$$pre$phi704$iZ2D = $642;
         break;
        }
        do {
         if ($$lcssa683$i) {
          $644 = ((($$7505$i)) + -4|0);
          $645 = HEAP32[$644>>2]|0;
          $646 = ($645|0)==(0);
          if ($646) {
           $$2530$i = 9;
           break;
          }
          $647 = (($645>>>0) % 10)&-1;
          $648 = ($647|0)==(0);
          if ($648) {
           $$1529624$i = 0;$$3534623$i = 10;
          } else {
           $$2530$i = 0;
           break;
          }
          while(1) {
           $649 = ($$3534623$i*10)|0;
           $650 = (($$1529624$i) + 1)|0;
           $651 = (($645>>>0) % ($649>>>0))&-1;
           $652 = ($651|0)==(0);
           if ($652) {
            $$1529624$i = $650;$$3534623$i = $649;
           } else {
            $$2530$i = $650;
            break;
           }
          }
         } else {
          $$2530$i = 9;
         }
        } while(0);
        $653 = $$0479$i | 32;
        $654 = ($653|0)==(102);
        $655 = $$7505$i;
        $656 = (($655) - ($560))|0;
        $657 = $656 >> 2;
        $658 = ($657*9)|0;
        $659 = (($658) + -9)|0;
        if ($654) {
         $660 = (($659) - ($$2530$i))|0;
         $661 = ($660|0)<(0);
         $$544$i = $661 ? 0 : $660;
         $662 = ($$2476$i|0)<($$544$i|0);
         $$2476$$545$i = $662 ? $$2476$i : $$544$i;
         $$1480$i = $$0479$i;$$3477$i = $$2476$$545$i;$$pre$phi704$iZ2D = 0;
         break;
        } else {
         $663 = (($659) + ($$5519$ph$i))|0;
         $664 = (($663) - ($$2530$i))|0;
         $665 = ($664|0)<(0);
         $$546$i = $665 ? 0 : $664;
         $666 = ($$2476$i|0)<($$546$i|0);
         $$2476$$547$i = $666 ? $$2476$i : $$546$i;
         $$1480$i = $$0479$i;$$3477$i = $$2476$$547$i;$$pre$phi704$iZ2D = 0;
         break;
        }
       } else {
        $$pre703$i = $$1263$ & 8;
        $$1480$i = $$0235;$$3477$i = $$538$i;$$pre$phi704$iZ2D = $$pre703$i;
       }
      } while(0);
      $667 = $$3477$i | $$pre$phi704$iZ2D;
      $668 = ($667|0)!=(0);
      $669 = $668&1;
      $670 = $$1480$i | 32;
      $671 = ($670|0)==(102);
      if ($671) {
       $672 = ($$5519$ph$i|0)>(0);
       $673 = $672 ? $$5519$ph$i : 0;
       $$2513$i = 0;$$pn$i = $673;
      } else {
       $674 = ($$5519$ph$i|0)<(0);
       $675 = $674 ? $629 : $$5519$ph$i;
       $676 = ($675|0)<(0);
       $677 = $676 << 31 >> 31;
       $678 = (_fmt_u($675,$677,$20)|0);
       $679 = $678;
       $680 = (($22) - ($679))|0;
       $681 = ($680|0)<(2);
       if ($681) {
        $$1512617$i = $678;
        while(1) {
         $682 = ((($$1512617$i)) + -1|0);
         HEAP8[$682>>0] = 48;
         $683 = $682;
         $684 = (($22) - ($683))|0;
         $685 = ($684|0)<(2);
         if ($685) {
          $$1512617$i = $682;
         } else {
          $$1512$lcssa$i = $682;
          break;
         }
        }
       } else {
        $$1512$lcssa$i = $678;
       }
       $686 = $$5519$ph$i >> 31;
       $687 = $686 & 2;
       $688 = (($687) + 43)|0;
       $689 = $688&255;
       $690 = ((($$1512$lcssa$i)) + -1|0);
       HEAP8[$690>>0] = $689;
       $691 = $$1480$i&255;
       $692 = ((($$1512$lcssa$i)) + -2|0);
       HEAP8[$692>>0] = $691;
       $693 = $692;
       $694 = (($22) - ($693))|0;
       $$2513$i = $692;$$pn$i = $694;
      }
      $695 = (($$0520$i) + 1)|0;
      $696 = (($695) + ($$3477$i))|0;
      $$1527$i = (($696) + ($669))|0;
      $697 = (($$1527$i) + ($$pn$i))|0;
      _pad($0,32,$$1260,$697,$$1263$);
      $698 = HEAP32[$0>>2]|0;
      $699 = $698 & 32;
      $700 = ($699|0)==(0);
      if ($700) {
       (___fwritex($$0522$i,$$0520$i,$0)|0);
      }
      $701 = $$1263$ ^ 65536;
      _pad($0,48,$$1260,$697,$701);
      do {
       if ($671) {
        $702 = ($$9$ph$i>>>0)>($$554$i>>>0);
        $$0496$$9$i = $702 ? $$554$i : $$9$ph$i;
        $$5493606$i = $$0496$$9$i;
        while(1) {
         $703 = HEAP32[$$5493606$i>>2]|0;
         $704 = (_fmt_u($703,0,$27)|0);
         $705 = ($$5493606$i|0)==($$0496$$9$i|0);
         do {
          if ($705) {
           $711 = ($704|0)==($27|0);
           if (!($711)) {
            $$1465$i = $704;
            break;
           }
           HEAP8[$29>>0] = 48;
           $$1465$i = $29;
          } else {
           $706 = ($704>>>0)>($7>>>0);
           if (!($706)) {
            $$1465$i = $704;
            break;
           }
           $707 = $704;
           $708 = (($707) - ($18))|0;
           _memset(($7|0),48,($708|0))|0;
           $$0464603$i = $704;
           while(1) {
            $709 = ((($$0464603$i)) + -1|0);
            $710 = ($709>>>0)>($7>>>0);
            if ($710) {
             $$0464603$i = $709;
            } else {
             $$1465$i = $709;
             break;
            }
           }
          }
         } while(0);
         $712 = HEAP32[$0>>2]|0;
         $713 = $712 & 32;
         $714 = ($713|0)==(0);
         if ($714) {
          $715 = $$1465$i;
          $716 = (($28) - ($715))|0;
          (___fwritex($$1465$i,$716,$0)|0);
         }
         $717 = ((($$5493606$i)) + 4|0);
         $718 = ($717>>>0)>($$554$i>>>0);
         if ($718) {
          break;
         } else {
          $$5493606$i = $717;
         }
        }
        $719 = ($667|0)==(0);
        do {
         if (!($719)) {
          $720 = HEAP32[$0>>2]|0;
          $721 = $720 & 32;
          $722 = ($721|0)==(0);
          if (!($722)) {
           break;
          }
          (___fwritex(16046,1,$0)|0);
         }
        } while(0);
        $723 = ($717>>>0)<($$7505$i>>>0);
        $724 = ($$3477$i|0)>(0);
        $725 = $724 & $723;
        if ($725) {
         $$4478600$i = $$3477$i;$$6494599$i = $717;
         while(1) {
          $726 = HEAP32[$$6494599$i>>2]|0;
          $727 = (_fmt_u($726,0,$27)|0);
          $728 = ($727>>>0)>($7>>>0);
          if ($728) {
           $729 = $727;
           $730 = (($729) - ($18))|0;
           _memset(($7|0),48,($730|0))|0;
           $$0463594$i = $727;
           while(1) {
            $731 = ((($$0463594$i)) + -1|0);
            $732 = ($731>>>0)>($7>>>0);
            if ($732) {
             $$0463594$i = $731;
            } else {
             $$0463$lcssa$i = $731;
             break;
            }
           }
          } else {
           $$0463$lcssa$i = $727;
          }
          $733 = HEAP32[$0>>2]|0;
          $734 = $733 & 32;
          $735 = ($734|0)==(0);
          if ($735) {
           $736 = ($$4478600$i|0)>(9);
           $737 = $736 ? 9 : $$4478600$i;
           (___fwritex($$0463$lcssa$i,$737,$0)|0);
          }
          $738 = ((($$6494599$i)) + 4|0);
          $739 = (($$4478600$i) + -9)|0;
          $740 = ($738>>>0)<($$7505$i>>>0);
          $741 = ($$4478600$i|0)>(9);
          $742 = $741 & $740;
          if ($742) {
           $$4478600$i = $739;$$6494599$i = $738;
          } else {
           $$4478$lcssa$i = $739;
           break;
          }
         }
        } else {
         $$4478$lcssa$i = $$3477$i;
        }
        $743 = (($$4478$lcssa$i) + 9)|0;
        _pad($0,48,$743,9,0);
       } else {
        $744 = ((($$9$ph$i)) + 4|0);
        $$7505$$i = $$lcssa683$i ? $$7505$i : $744;
        $745 = ($$3477$i|0)>(-1);
        if ($745) {
         $746 = ($$pre$phi704$iZ2D|0)==(0);
         $$5611$i = $$3477$i;$$7495610$i = $$9$ph$i;
         while(1) {
          $747 = HEAP32[$$7495610$i>>2]|0;
          $748 = (_fmt_u($747,0,$27)|0);
          $749 = ($748|0)==($27|0);
          if ($749) {
           HEAP8[$29>>0] = 48;
           $$0$i = $29;
          } else {
           $$0$i = $748;
          }
          $750 = ($$7495610$i|0)==($$9$ph$i|0);
          do {
           if ($750) {
            $754 = ((($$0$i)) + 1|0);
            $755 = HEAP32[$0>>2]|0;
            $756 = $755 & 32;
            $757 = ($756|0)==(0);
            if ($757) {
             (___fwritex($$0$i,1,$0)|0);
            }
            $758 = ($$5611$i|0)<(1);
            $or$cond552$i = $746 & $758;
            if ($or$cond552$i) {
             $$2$i = $754;
             break;
            }
            $759 = HEAP32[$0>>2]|0;
            $760 = $759 & 32;
            $761 = ($760|0)==(0);
            if (!($761)) {
             $$2$i = $754;
             break;
            }
            (___fwritex(16046,1,$0)|0);
            $$2$i = $754;
           } else {
            $751 = ($$0$i>>>0)>($7>>>0);
            if (!($751)) {
             $$2$i = $$0$i;
             break;
            }
            $scevgep694$i = (($$0$i) + ($19)|0);
            $scevgep694695$i = $scevgep694$i;
            _memset(($7|0),48,($scevgep694695$i|0))|0;
            $$1607$i = $$0$i;
            while(1) {
             $752 = ((($$1607$i)) + -1|0);
             $753 = ($752>>>0)>($7>>>0);
             if ($753) {
              $$1607$i = $752;
             } else {
              $$2$i = $752;
              break;
             }
            }
           }
          } while(0);
          $762 = $$2$i;
          $763 = (($28) - ($762))|0;
          $764 = HEAP32[$0>>2]|0;
          $765 = $764 & 32;
          $766 = ($765|0)==(0);
          if ($766) {
           $767 = ($$5611$i|0)>($763|0);
           $768 = $767 ? $763 : $$5611$i;
           (___fwritex($$2$i,$768,$0)|0);
          }
          $769 = (($$5611$i) - ($763))|0;
          $770 = ((($$7495610$i)) + 4|0);
          $771 = ($770>>>0)<($$7505$$i>>>0);
          $772 = ($769|0)>(-1);
          $773 = $771 & $772;
          if ($773) {
           $$5611$i = $769;$$7495610$i = $770;
          } else {
           $$5$lcssa$i = $769;
           break;
          }
         }
        } else {
         $$5$lcssa$i = $$3477$i;
        }
        $774 = (($$5$lcssa$i) + 18)|0;
        _pad($0,48,$774,18,0);
        $775 = HEAP32[$0>>2]|0;
        $776 = $775 & 32;
        $777 = ($776|0)==(0);
        if (!($777)) {
         break;
        }
        $778 = $$2513$i;
        $779 = (($22) - ($778))|0;
        (___fwritex($$2513$i,$779,$0)|0);
       }
      } while(0);
      $780 = $$1263$ ^ 8192;
      _pad($0,32,$$1260,$697,$780);
      $781 = ($697|0)<($$1260|0);
      $$553$i = $781 ? $$1260 : $697;
      $$0470$i = $$553$i;
     } else {
      $388 = $$0235 & 32;
      $389 = ($388|0)!=(0);
      $390 = $389 ? 16030 : 16034;
      $391 = ($$0471$i != $$0471$i) | (0.0 != 0.0);
      $392 = $389 ? 16038 : 16042;
      $$1521$i = $391 ? 0 : $$0520$i;
      $$0510$i = $391 ? $392 : $390;
      $393 = (($$1521$i) + 3)|0;
      _pad($0,32,$$1260,$393,$187);
      $394 = HEAP32[$0>>2]|0;
      $395 = $394 & 32;
      $396 = ($395|0)==(0);
      if ($396) {
       (___fwritex($$0522$i,$$1521$i,$0)|0);
       $$pre$i = HEAP32[$0>>2]|0;
       $398 = $$pre$i;
      } else {
       $398 = $394;
      }
      $397 = $398 & 32;
      $399 = ($397|0)==(0);
      if ($399) {
       (___fwritex($$0510$i,3,$0)|0);
      }
      $400 = $$1263$ ^ 8192;
      _pad($0,32,$$1260,$393,$400);
      $401 = ($393|0)<($$1260|0);
      $402 = $401 ? $$1260 : $393;
      $$0470$i = $402;
     }
    } while(0);
    $$0243 = $$0470$i;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
    continue L1;
    break;
   }
   default: {
    $$2 = $$0321;$$2234 = 0;$$2239 = 15994;$$2251 = $14;$$5 = $$0254;$$6268 = $$1263$;
   }
   }
  } while(0);
  L310: do {
   if ((label|0) == 63) {
    label = 0;
    $218 = $9;
    $219 = $218;
    $220 = HEAP32[$219>>2]|0;
    $221 = (($218) + 4)|0;
    $222 = $221;
    $223 = HEAP32[$222>>2]|0;
    $224 = $$1236 & 32;
    $225 = ($220|0)==(0);
    $226 = ($223|0)==(0);
    $227 = $225 & $226;
    if ($227) {
     $$05$lcssa$i = $14;$248 = 0;$250 = 0;
    } else {
     $$056$i = $14;$229 = $220;$236 = $223;
     while(1) {
      $228 = $229 & 15;
      $230 = (15978 + ($228)|0);
      $231 = HEAP8[$230>>0]|0;
      $232 = $231&255;
      $233 = $232 | $224;
      $234 = $233&255;
      $235 = ((($$056$i)) + -1|0);
      HEAP8[$235>>0] = $234;
      $237 = (_bitshift64Lshr(($229|0),($236|0),4)|0);
      $238 = tempRet0;
      $239 = ($237|0)==(0);
      $240 = ($238|0)==(0);
      $241 = $239 & $240;
      if ($241) {
       break;
      } else {
       $$056$i = $235;$229 = $237;$236 = $238;
      }
     }
     $242 = $9;
     $243 = $242;
     $244 = HEAP32[$243>>2]|0;
     $245 = (($242) + 4)|0;
     $246 = $245;
     $247 = HEAP32[$246>>2]|0;
     $$05$lcssa$i = $235;$248 = $244;$250 = $247;
    }
    $249 = ($248|0)==(0);
    $251 = ($250|0)==(0);
    $252 = $249 & $251;
    $253 = $$3265 & 8;
    $254 = ($253|0)==(0);
    $or$cond282 = $254 | $252;
    $255 = $$1236 >> 4;
    $256 = (15994 + ($255)|0);
    $$332 = $or$cond282 ? 15994 : $256;
    $$333 = $or$cond282 ? 0 : 2;
    $$0228 = $$05$lcssa$i;$$1233 = $$333;$$1238 = $$332;$$2256 = $$1255;$$4266 = $$3265;
    label = 76;
   }
   else if ((label|0) == 75) {
    label = 0;
    $302 = (_fmt_u($300,$301,$14)|0);
    $$0228 = $302;$$1233 = $$0232;$$1238 = $$0237;$$2256 = $$0254;$$4266 = $$1263$;
    label = 76;
   }
   else if ((label|0) == 81) {
    label = 0;
    $334 = (_memchr($$1,0,$$0254)|0);
    $335 = ($334|0)==(0|0);
    $336 = $334;
    $337 = $$1;
    $338 = (($336) - ($337))|0;
    $339 = (($$1) + ($$0254)|0);
    $$3257 = $335 ? $$0254 : $338;
    $$1250 = $335 ? $339 : $334;
    $$2 = $$1;$$2234 = 0;$$2239 = 15994;$$2251 = $$1250;$$5 = $$3257;$$6268 = $187;
   }
   else if ((label|0) == 85) {
    label = 0;
    $$0229396 = $809;$$0240395 = 0;$$1244394 = 0;
    while(1) {
     $347 = HEAP32[$$0229396>>2]|0;
     $348 = ($347|0)==(0);
     if ($348) {
      $$0240$lcssa = $$0240395;$$2245 = $$1244394;
      break;
     }
     $349 = (_wctomb($12,$347)|0);
     $350 = ($349|0)<(0);
     $351 = (($$4258458) - ($$0240395))|0;
     $352 = ($349>>>0)>($351>>>0);
     $or$cond285 = $350 | $352;
     if ($or$cond285) {
      $$0240$lcssa = $$0240395;$$2245 = $349;
      break;
     }
     $353 = ((($$0229396)) + 4|0);
     $354 = (($349) + ($$0240395))|0;
     $355 = ($$4258458>>>0)>($354>>>0);
     if ($355) {
      $$0229396 = $353;$$0240395 = $354;$$1244394 = $349;
     } else {
      $$0240$lcssa = $354;$$2245 = $349;
      break;
     }
    }
    $356 = ($$2245|0)<(0);
    if ($356) {
     $$0 = -1;
     break L1;
    }
    _pad($0,32,$$1260,$$0240$lcssa,$$1263$);
    $357 = ($$0240$lcssa|0)==(0);
    if ($357) {
     $$0240$lcssa460 = 0;
     label = 96;
    } else {
     $$1230407 = $809;$$1241406 = 0;
     while(1) {
      $358 = HEAP32[$$1230407>>2]|0;
      $359 = ($358|0)==(0);
      if ($359) {
       $$0240$lcssa460 = $$0240$lcssa;
       label = 96;
       break L310;
      }
      $360 = ((($$1230407)) + 4|0);
      $361 = (_wctomb($12,$358)|0);
      $362 = (($361) + ($$1241406))|0;
      $363 = ($362|0)>($$0240$lcssa|0);
      if ($363) {
       $$0240$lcssa460 = $$0240$lcssa;
       label = 96;
       break L310;
      }
      $364 = HEAP32[$0>>2]|0;
      $365 = $364 & 32;
      $366 = ($365|0)==(0);
      if ($366) {
       (___fwritex($12,$361,$0)|0);
      }
      $367 = ($362>>>0)<($$0240$lcssa>>>0);
      if ($367) {
       $$1230407 = $360;$$1241406 = $362;
      } else {
       $$0240$lcssa460 = $$0240$lcssa;
       label = 96;
       break;
      }
     }
    }
   }
  } while(0);
  if ((label|0) == 96) {
   label = 0;
   $368 = $$1263$ ^ 8192;
   _pad($0,32,$$1260,$$0240$lcssa460,$368);
   $369 = ($$1260|0)>($$0240$lcssa460|0);
   $370 = $369 ? $$1260 : $$0240$lcssa460;
   $$0243 = $370;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
   continue;
  }
  if ((label|0) == 76) {
   label = 0;
   $303 = ($$2256|0)>(-1);
   $304 = $$4266 & -65537;
   $$$4266 = $303 ? $304 : $$4266;
   $305 = $9;
   $306 = $305;
   $307 = HEAP32[$306>>2]|0;
   $308 = (($305) + 4)|0;
   $309 = $308;
   $310 = HEAP32[$309>>2]|0;
   $311 = ($307|0)!=(0);
   $312 = ($310|0)!=(0);
   $313 = $311 | $312;
   $314 = ($$2256|0)!=(0);
   $or$cond = $314 | $313;
   if ($or$cond) {
    $315 = $$0228;
    $316 = (($15) - ($315))|0;
    $317 = $313&1;
    $318 = $317 ^ 1;
    $319 = (($318) + ($316))|0;
    $320 = ($$2256|0)>($319|0);
    $$2256$ = $320 ? $$2256 : $319;
    $$2 = $$0228;$$2234 = $$1233;$$2239 = $$1238;$$2251 = $14;$$5 = $$2256$;$$6268 = $$$4266;
   } else {
    $$2 = $14;$$2234 = $$1233;$$2239 = $$1238;$$2251 = $14;$$5 = 0;$$6268 = $$$4266;
   }
  }
  $782 = $$2251;
  $783 = $$2;
  $784 = (($782) - ($783))|0;
  $785 = ($$5|0)<($784|0);
  $$$5 = $785 ? $784 : $$5;
  $786 = (($$$5) + ($$2234))|0;
  $787 = ($$1260|0)<($786|0);
  $$2261 = $787 ? $786 : $$1260;
  _pad($0,32,$$2261,$786,$$6268);
  $788 = HEAP32[$0>>2]|0;
  $789 = $788 & 32;
  $790 = ($789|0)==(0);
  if ($790) {
   (___fwritex($$2239,$$2234,$0)|0);
  }
  $791 = $$6268 ^ 65536;
  _pad($0,48,$$2261,$786,$791);
  _pad($0,48,$$$5,$784,0);
  $792 = HEAP32[$0>>2]|0;
  $793 = $792 & 32;
  $794 = ($793|0)==(0);
  if ($794) {
   (___fwritex($$2,$784,$0)|0);
  }
  $795 = $$6268 ^ 8192;
  _pad($0,32,$$2261,$786,$795);
  $$0243 = $$2261;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
 }
 L345: do {
  if ((label|0) == 243) {
   $796 = ($0|0)==(0|0);
   if ($796) {
    $797 = ($$0269|0)==(0);
    if ($797) {
     $$0 = 0;
    } else {
     $$2242381 = 1;
     while(1) {
      $798 = (($4) + ($$2242381<<2)|0);
      $799 = HEAP32[$798>>2]|0;
      $800 = ($799|0)==(0);
      if ($800) {
       $$3379 = $$2242381;
       break;
      }
      $801 = (($3) + ($$2242381<<3)|0);
      _pop_arg_24($801,$799,$2);
      $802 = (($$2242381) + 1)|0;
      $803 = ($802|0)<(10);
      if ($803) {
       $$2242381 = $802;
      } else {
       $$0 = 1;
       break L345;
      }
     }
     while(1) {
      $806 = (($4) + ($$3379<<2)|0);
      $807 = HEAP32[$806>>2]|0;
      $808 = ($807|0)==(0);
      $804 = (($$3379) + 1)|0;
      if (!($808)) {
       $$0 = -1;
       break L345;
      }
      $805 = ($804|0)<(10);
      if ($805) {
       $$3379 = $804;
      } else {
       $$0 = 1;
       break;
      }
     }
    }
   } else {
    $$0 = $$1248;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___fwritex($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$032 = 0, $$033 = 0, $$034 = 0, $$1 = 0, $$pre = 0, $$pre38 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($2)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $7 = (___towrite($2)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$3>>2]|0;
   $12 = $$pre;
   label = 5;
  } else {
   $$032 = 0;
  }
 } else {
  $6 = $4;
  $12 = $6;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $9 = ((($2)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = (($12) - ($10))|0;
   $13 = ($11>>>0)<($1>>>0);
   $14 = $10;
   if ($13) {
    $15 = ((($2)) + 36|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = (FUNCTION_TABLE_iiii[$16 & 7]($2,$0,$1)|0);
    $$032 = $17;
    break;
   }
   $18 = ((($2)) + 75|0);
   $19 = HEAP8[$18>>0]|0;
   $20 = ($19<<24>>24)>(-1);
   L10: do {
    if ($20) {
     $$0 = $1;
     while(1) {
      $21 = ($$0|0)==(0);
      if ($21) {
       $$033 = $1;$$034 = $0;$$1 = 0;$32 = $14;
       break L10;
      }
      $22 = (($$0) + -1)|0;
      $23 = (($0) + ($22)|0);
      $24 = HEAP8[$23>>0]|0;
      $25 = ($24<<24>>24)==(10);
      if ($25) {
       break;
      } else {
       $$0 = $22;
      }
     }
     $26 = ((($2)) + 36|0);
     $27 = HEAP32[$26>>2]|0;
     $28 = (FUNCTION_TABLE_iiii[$27 & 7]($2,$0,$$0)|0);
     $29 = ($28>>>0)<($$0>>>0);
     if ($29) {
      $$032 = $$0;
      break L5;
     }
     $30 = (($0) + ($$0)|0);
     $31 = (($1) - ($$0))|0;
     $$pre38 = HEAP32[$9>>2]|0;
     $$033 = $31;$$034 = $30;$$1 = $$0;$32 = $$pre38;
    } else {
     $$033 = $1;$$034 = $0;$$1 = 0;$32 = $14;
    }
   } while(0);
   _memcpy(($32|0),($$034|0),($$033|0))|0;
   $33 = HEAP32[$9>>2]|0;
   $34 = (($33) + ($$033)|0);
   HEAP32[$9>>2] = $34;
   $35 = (($$1) + ($$033))|0;
   $$032 = $35;
  }
 } while(0);
 return ($$032|0);
}
function _pop_arg_24($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$mask = 0, $$mask31 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0;
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(20);
 L1: do {
  if (!($3)) {
   do {
    switch ($1|0) {
    case 9:  {
     $arglist_current = HEAP32[$2>>2]|0;
     $4 = $arglist_current;
     $5 = ((0) + 4|0);
     $expanded28 = $5;
     $expanded = (($expanded28) - 1)|0;
     $6 = (($4) + ($expanded))|0;
     $7 = ((0) + 4|0);
     $expanded32 = $7;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $8 = $6 & $expanded30;
     $9 = $8;
     $10 = HEAP32[$9>>2]|0;
     $arglist_next = ((($9)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     HEAP32[$0>>2] = $10;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $11 = $arglist_current2;
     $12 = ((0) + 4|0);
     $expanded35 = $12;
     $expanded34 = (($expanded35) - 1)|0;
     $13 = (($11) + ($expanded34))|0;
     $14 = ((0) + 4|0);
     $expanded39 = $14;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $15 = $13 & $expanded37;
     $16 = $15;
     $17 = HEAP32[$16>>2]|0;
     $arglist_next3 = ((($16)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $18 = ($17|0)<(0);
     $19 = $18 << 31 >> 31;
     $20 = $0;
     $21 = $20;
     HEAP32[$21>>2] = $17;
     $22 = (($20) + 4)|0;
     $23 = $22;
     HEAP32[$23>>2] = $19;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$2>>2]|0;
     $24 = $arglist_current5;
     $25 = ((0) + 4|0);
     $expanded42 = $25;
     $expanded41 = (($expanded42) - 1)|0;
     $26 = (($24) + ($expanded41))|0;
     $27 = ((0) + 4|0);
     $expanded46 = $27;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $28 = $26 & $expanded44;
     $29 = $28;
     $30 = HEAP32[$29>>2]|0;
     $arglist_next6 = ((($29)) + 4|0);
     HEAP32[$2>>2] = $arglist_next6;
     $31 = $0;
     $32 = $31;
     HEAP32[$32>>2] = $30;
     $33 = (($31) + 4)|0;
     $34 = $33;
     HEAP32[$34>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$2>>2]|0;
     $35 = $arglist_current8;
     $36 = ((0) + 8|0);
     $expanded49 = $36;
     $expanded48 = (($expanded49) - 1)|0;
     $37 = (($35) + ($expanded48))|0;
     $38 = ((0) + 8|0);
     $expanded53 = $38;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $39 = $37 & $expanded51;
     $40 = $39;
     $41 = $40;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $44 = (($41) + 4)|0;
     $45 = $44;
     $46 = HEAP32[$45>>2]|0;
     $arglist_next9 = ((($40)) + 8|0);
     HEAP32[$2>>2] = $arglist_next9;
     $47 = $0;
     $48 = $47;
     HEAP32[$48>>2] = $43;
     $49 = (($47) + 4)|0;
     $50 = $49;
     HEAP32[$50>>2] = $46;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$2>>2]|0;
     $51 = $arglist_current11;
     $52 = ((0) + 4|0);
     $expanded56 = $52;
     $expanded55 = (($expanded56) - 1)|0;
     $53 = (($51) + ($expanded55))|0;
     $54 = ((0) + 4|0);
     $expanded60 = $54;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $55 = $53 & $expanded58;
     $56 = $55;
     $57 = HEAP32[$56>>2]|0;
     $arglist_next12 = ((($56)) + 4|0);
     HEAP32[$2>>2] = $arglist_next12;
     $58 = $57&65535;
     $59 = $58 << 16 >> 16;
     $60 = ($59|0)<(0);
     $61 = $60 << 31 >> 31;
     $62 = $0;
     $63 = $62;
     HEAP32[$63>>2] = $59;
     $64 = (($62) + 4)|0;
     $65 = $64;
     HEAP32[$65>>2] = $61;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$2>>2]|0;
     $66 = $arglist_current14;
     $67 = ((0) + 4|0);
     $expanded63 = $67;
     $expanded62 = (($expanded63) - 1)|0;
     $68 = (($66) + ($expanded62))|0;
     $69 = ((0) + 4|0);
     $expanded67 = $69;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $70 = $68 & $expanded65;
     $71 = $70;
     $72 = HEAP32[$71>>2]|0;
     $arglist_next15 = ((($71)) + 4|0);
     HEAP32[$2>>2] = $arglist_next15;
     $$mask31 = $72 & 65535;
     $73 = $0;
     $74 = $73;
     HEAP32[$74>>2] = $$mask31;
     $75 = (($73) + 4)|0;
     $76 = $75;
     HEAP32[$76>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$2>>2]|0;
     $77 = $arglist_current17;
     $78 = ((0) + 4|0);
     $expanded70 = $78;
     $expanded69 = (($expanded70) - 1)|0;
     $79 = (($77) + ($expanded69))|0;
     $80 = ((0) + 4|0);
     $expanded74 = $80;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $81 = $79 & $expanded72;
     $82 = $81;
     $83 = HEAP32[$82>>2]|0;
     $arglist_next18 = ((($82)) + 4|0);
     HEAP32[$2>>2] = $arglist_next18;
     $84 = $83&255;
     $85 = $84 << 24 >> 24;
     $86 = ($85|0)<(0);
     $87 = $86 << 31 >> 31;
     $88 = $0;
     $89 = $88;
     HEAP32[$89>>2] = $85;
     $90 = (($88) + 4)|0;
     $91 = $90;
     HEAP32[$91>>2] = $87;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$2>>2]|0;
     $92 = $arglist_current20;
     $93 = ((0) + 4|0);
     $expanded77 = $93;
     $expanded76 = (($expanded77) - 1)|0;
     $94 = (($92) + ($expanded76))|0;
     $95 = ((0) + 4|0);
     $expanded81 = $95;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $96 = $94 & $expanded79;
     $97 = $96;
     $98 = HEAP32[$97>>2]|0;
     $arglist_next21 = ((($97)) + 4|0);
     HEAP32[$2>>2] = $arglist_next21;
     $$mask = $98 & 255;
     $99 = $0;
     $100 = $99;
     HEAP32[$100>>2] = $$mask;
     $101 = (($99) + 4)|0;
     $102 = $101;
     HEAP32[$102>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$2>>2]|0;
     $103 = $arglist_current23;
     $104 = ((0) + 8|0);
     $expanded84 = $104;
     $expanded83 = (($expanded84) - 1)|0;
     $105 = (($103) + ($expanded83))|0;
     $106 = ((0) + 8|0);
     $expanded88 = $106;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $107 = $105 & $expanded86;
     $108 = $107;
     $109 = +HEAPF64[$108>>3];
     $arglist_next24 = ((($108)) + 8|0);
     HEAP32[$2>>2] = $arglist_next24;
     HEAPF64[$0>>3] = $109;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$2>>2]|0;
     $110 = $arglist_current26;
     $111 = ((0) + 8|0);
     $expanded91 = $111;
     $expanded90 = (($expanded91) - 1)|0;
     $112 = (($110) + ($expanded90))|0;
     $113 = ((0) + 8|0);
     $expanded95 = $113;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $114 = $112 & $expanded93;
     $115 = $114;
     $116 = +HEAPF64[$115>>3];
     $arglist_next27 = ((($115)) + 8|0);
     HEAP32[$2>>2] = $arglist_next27;
     HEAPF64[$0>>3] = $116;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_u($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$010$lcssa$off0 = 0, $$012 = 0, $$09$lcssa = 0, $$0914 = 0, $$1$lcssa = 0, $$111 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(0);
 $4 = ($0>>>0)>(4294967295);
 $5 = ($1|0)==(0);
 $6 = $5 & $4;
 $7 = $3 | $6;
 if ($7) {
  $$0914 = $2;$8 = $0;$9 = $1;
  while(1) {
   $10 = (___uremdi3(($8|0),($9|0),10,0)|0);
   $11 = tempRet0;
   $12 = $10 | 48;
   $13 = $12&255;
   $14 = ((($$0914)) + -1|0);
   HEAP8[$14>>0] = $13;
   $15 = (___udivdi3(($8|0),($9|0),10,0)|0);
   $16 = tempRet0;
   $17 = ($9>>>0)>(9);
   $18 = ($8>>>0)>(4294967295);
   $19 = ($9|0)==(9);
   $20 = $19 & $18;
   $21 = $17 | $20;
   if ($21) {
    $$0914 = $14;$8 = $15;$9 = $16;
   } else {
    break;
   }
  }
  $$010$lcssa$off0 = $15;$$09$lcssa = $14;
 } else {
  $$010$lcssa$off0 = $0;$$09$lcssa = $2;
 }
 $22 = ($$010$lcssa$off0|0)==(0);
 if ($22) {
  $$1$lcssa = $$09$lcssa;
 } else {
  $$012 = $$010$lcssa$off0;$$111 = $$09$lcssa;
  while(1) {
   $23 = (($$012>>>0) % 10)&-1;
   $24 = $23 | 48;
   $25 = $24&255;
   $26 = ((($$111)) + -1|0);
   HEAP8[$26>>0] = $25;
   $27 = (($$012>>>0) / 10)&-1;
   $28 = ($$012>>>0)<(10);
   if ($28) {
    $$1$lcssa = $26;
    break;
   } else {
    $$012 = $27;$$111 = $26;
   }
  }
 }
 return ($$1$lcssa|0);
}
function _pad($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa16 = 0, $$012 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0;
 $5 = sp;
 $6 = $4 & 73728;
 $7 = ($6|0)==(0);
 $8 = ($2|0)>($3|0);
 $or$cond = $8 & $7;
 do {
  if ($or$cond) {
   $9 = (($2) - ($3))|0;
   $10 = ($9>>>0)>(256);
   $11 = $10 ? 256 : $9;
   _memset(($5|0),($1|0),($11|0))|0;
   $12 = ($9>>>0)>(255);
   $13 = HEAP32[$0>>2]|0;
   $14 = $13 & 32;
   $15 = ($14|0)==(0);
   if ($12) {
    $16 = (($2) - ($3))|0;
    $$012 = $9;$23 = $13;$24 = $15;
    while(1) {
     if ($24) {
      (___fwritex($5,256,$0)|0);
      $$pre = HEAP32[$0>>2]|0;
      $20 = $$pre;
     } else {
      $20 = $23;
     }
     $17 = (($$012) + -256)|0;
     $18 = ($17>>>0)>(255);
     $19 = $20 & 32;
     $21 = ($19|0)==(0);
     if ($18) {
      $$012 = $17;$23 = $20;$24 = $21;
     } else {
      break;
     }
    }
    $22 = $16 & 255;
    if ($21) {
     $$0$lcssa16 = $22;
    } else {
     break;
    }
   } else {
    if ($15) {
     $$0$lcssa16 = $9;
    } else {
     break;
    }
   }
   (___fwritex($5,$$0$lcssa16,$0)|0);
  }
 } while(0);
 STACKTOP = sp;return;
}
function _frexpl($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (+_frexp($0,$1));
 return (+$2);
}
function _frexp($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $$0 = 0.0, $$016 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, $storemerge = 0, $trunc$clear = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$2 = HEAP32[tempDoublePtr>>2]|0;
 $3 = HEAP32[tempDoublePtr+4>>2]|0;
 $4 = (_bitshift64Lshr(($2|0),($3|0),52)|0);
 $5 = tempRet0;
 $6 = $4&65535;
 $trunc$clear = $6 & 2047;
 switch ($trunc$clear<<16>>16) {
 case 0:  {
  $7 = $0 != 0.0;
  if ($7) {
   $8 = $0 * 1.8446744073709552E+19;
   $9 = (+_frexp($8,$1));
   $10 = HEAP32[$1>>2]|0;
   $11 = (($10) + -64)|0;
   $$016 = $9;$storemerge = $11;
  } else {
   $$016 = $0;$storemerge = 0;
  }
  HEAP32[$1>>2] = $storemerge;
  $$0 = $$016;
  break;
 }
 case 2047:  {
  $$0 = $0;
  break;
 }
 default: {
  $12 = $4 & 2047;
  $13 = (($12) + -1022)|0;
  HEAP32[$1>>2] = $13;
  $14 = $3 & -2146435073;
  $15 = $14 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $2;HEAP32[tempDoublePtr+4>>2] = $15;$16 = +HEAPF64[tempDoublePtr>>3];
  $$0 = $16;
 }
 }
 return (+$$0);
}
function ___towrite($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 74|0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $4 = (($3) + 255)|0;
 $5 = $4 | $3;
 $6 = $5&255;
 HEAP8[$1>>0] = $6;
 $7 = HEAP32[$0>>2]|0;
 $8 = $7 & 8;
 $9 = ($8|0)==(0);
 if ($9) {
  $11 = ((($0)) + 8|0);
  HEAP32[$11>>2] = 0;
  $12 = ((($0)) + 4|0);
  HEAP32[$12>>2] = 0;
  $13 = ((($0)) + 44|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ((($0)) + 28|0);
  HEAP32[$15>>2] = $14;
  $16 = ((($0)) + 20|0);
  HEAP32[$16>>2] = $14;
  $17 = $14;
  $18 = ((($0)) + 48|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = (($17) + ($19)|0);
  $21 = ((($0)) + 16|0);
  HEAP32[$21>>2] = $20;
  $$0 = 0;
 } else {
  $10 = $7 | 32;
  HEAP32[$0>>2] = $10;
  $$0 = -1;
 }
 return ($$0|0);
}
function _sn_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$cast = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($0)) + 20|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (($4) - ($6))|0;
 $8 = ($7>>>0)>($2>>>0);
 $$ = $8 ? $2 : $7;
 $$cast = $6;
 _memcpy(($$cast|0),($1|0),($$|0))|0;
 $9 = HEAP32[$5>>2]|0;
 $10 = (($9) + ($$)|0);
 HEAP32[$5>>2] = $10;
 return ($2|0);
}
function _printf($0,$varargs) {
 $0 = $0|0;
 $varargs = $varargs|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 HEAP32[$1>>2] = $varargs;
 $2 = HEAP32[1371]|0;
 $3 = (_vfprintf($2,$0,$1)|0);
 STACKTOP = sp;return ($3|0);
}
function ___fseeko($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 76|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)>(-1);
 if ($5) {
  $7 = (___lockfile($0)|0);
  $phitmp = ($7|0)==(0);
  $8 = (___fseeko_unlocked($0,$1,$2)|0);
  if ($phitmp) {
   $9 = $8;
  } else {
   ___unlockfile($0);
   $9 = $8;
  }
 } else {
  $6 = (___fseeko_unlocked($0,$1,$2)|0);
  $9 = $6;
 }
 return ($9|0);
}
function ___fseeko_unlocked($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$019 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($2|0)==(1);
 if ($3) {
  $4 = ((($0)) + 8|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = ((($0)) + 4|0);
  $7 = HEAP32[$6>>2]|0;
  $8 = (($1) - ($5))|0;
  $9 = (($8) + ($7))|0;
  $$019 = $9;
 } else {
  $$019 = $1;
 }
 $10 = ((($0)) + 20|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($0)) + 28|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ($11>>>0)>($13>>>0);
 if ($14) {
  $15 = ((($0)) + 36|0);
  $16 = HEAP32[$15>>2]|0;
  (FUNCTION_TABLE_iiii[$16 & 7]($0,0,0)|0);
  $17 = HEAP32[$10>>2]|0;
  $18 = ($17|0)==(0|0);
  if ($18) {
   $$0 = -1;
  } else {
   label = 5;
  }
 } else {
  label = 5;
 }
 if ((label|0) == 5) {
  $19 = ((($0)) + 16|0);
  HEAP32[$19>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $20 = ((($0)) + 40|0);
  $21 = HEAP32[$20>>2]|0;
  $22 = (FUNCTION_TABLE_iiii[$21 & 7]($0,$$019,$2)|0);
  $23 = ($22|0)<(0);
  if ($23) {
   $$0 = -1;
  } else {
   $24 = ((($0)) + 8|0);
   HEAP32[$24>>2] = 0;
   $25 = ((($0)) + 4|0);
   HEAP32[$25>>2] = 0;
   $26 = HEAP32[$0>>2]|0;
   $27 = $26 & -17;
   HEAP32[$0>>2] = $27;
   $$0 = 0;
  }
 }
 return ($$0|0);
}
function _fopen($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $memchr = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $memchr = (_memchr(16048,$3,4)|0);
 $4 = ($memchr|0)==(0|0);
 if ($4) {
  $5 = (___errno_location()|0);
  HEAP32[$5>>2] = 22;
  $$0 = 0;
 } else {
  $6 = (___fmodeflags($1)|0);
  $7 = $6 | 32768;
  HEAP32[$vararg_buffer>>2] = $0;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $7;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = 438;
  $8 = (___syscall5(5,($vararg_buffer|0))|0);
  $9 = (___syscall_ret($8)|0);
  $10 = ($9|0)<(0);
  if ($10) {
   $$0 = 0;
  } else {
   $11 = (___fdopen($9,$1)|0);
   $12 = ($11|0)==(0|0);
   if ($12) {
    HEAP32[$vararg_buffer3>>2] = $9;
    (___syscall6(6,($vararg_buffer3|0))|0);
    $$0 = 0;
   } else {
    $$0 = $11;
   }
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function ___fmodeflags($0) {
 $0 = $0|0;
 var $$ = 0, $$$4 = 0, $$0 = 0, $$0$ = 0, $$2 = 0, $$2$ = 0, $$4 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_strchr($0,43)|0);
 $2 = ($1|0)==(0|0);
 $3 = HEAP8[$0>>0]|0;
 $not$ = ($3<<24>>24)!=(114);
 $$ = $not$&1;
 $$0 = $2 ? $$ : 2;
 $4 = (_strchr($0,120)|0);
 $5 = ($4|0)==(0|0);
 $6 = $$0 | 128;
 $$0$ = $5 ? $$0 : $6;
 $7 = (_strchr($0,101)|0);
 $8 = ($7|0)==(0|0);
 $9 = $$0$ | 524288;
 $$2 = $8 ? $$0$ : $9;
 $10 = ($3<<24>>24)==(114);
 $11 = $$2 | 64;
 $$2$ = $10 ? $$2 : $11;
 $12 = ($3<<24>>24)==(119);
 $13 = $$2$ | 512;
 $$4 = $12 ? $13 : $$2$;
 $14 = ($3<<24>>24)==(97);
 $15 = $$4 | 1024;
 $$$4 = $14 ? $15 : $$4;
 return ($$$4|0);
}
function _isspace($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(32);
 $2 = (($0) + -9)|0;
 $3 = ($2>>>0)<(5);
 $4 = $1 | $3;
 $5 = $4&1;
 return ($5|0);
}
function ___shlim($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($0)) + 104|0);
 HEAP32[$2>>2] = $1;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($0)) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (($4) - ($6))|0;
 $8 = ((($0)) + 108|0);
 HEAP32[$8>>2] = $7;
 $9 = ($1|0)!=(0);
 $10 = ($7|0)>($1|0);
 $or$cond = $9 & $10;
 if ($or$cond) {
  $11 = $6;
  $12 = (($11) + ($1)|0);
  $13 = ((($0)) + 100|0);
  HEAP32[$13>>2] = $12;
 } else {
  $14 = ((($0)) + 100|0);
  HEAP32[$14>>2] = $4;
 }
 return;
}
function ___shgetc($0) {
 $0 = $0|0;
 var $$0 = 0, $$phi$trans$insert = 0, $$phi$trans$insert28 = 0, $$pre = 0, $$pre29 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 104|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0);
 if ($3) {
  label = 3;
 } else {
  $4 = ((($0)) + 108|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = ($5|0)<($2|0);
  if ($6) {
   label = 3;
  } else {
   label = 4;
  }
 }
 if ((label|0) == 3) {
  $7 = (___uflow($0)|0);
  $8 = ($7|0)<(0);
  if ($8) {
   label = 4;
  } else {
   $10 = HEAP32[$1>>2]|0;
   $11 = ($10|0)==(0);
   $$phi$trans$insert = ((($0)) + 8|0);
   $$pre = HEAP32[$$phi$trans$insert>>2]|0;
   if ($11) {
    $12 = $$pre;
    $42 = $12;
    label = 9;
   } else {
    $13 = ((($0)) + 4|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = $14;
    $16 = (($$pre) - ($15))|0;
    $17 = ((($0)) + 108|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = (($10) - ($18))|0;
    $20 = ($16|0)<($19|0);
    $21 = $$pre;
    if ($20) {
     $42 = $21;
     label = 9;
    } else {
     $22 = (($19) + -1)|0;
     $23 = (($14) + ($22)|0);
     $24 = ((($0)) + 100|0);
     HEAP32[$24>>2] = $23;
     $26 = $21;
    }
   }
   if ((label|0) == 9) {
    $25 = ((($0)) + 100|0);
    HEAP32[$25>>2] = $$pre;
    $26 = $42;
   }
   $27 = ($26|0)==(0|0);
   $$phi$trans$insert28 = ((($0)) + 4|0);
   if ($27) {
    $$pre29 = HEAP32[$$phi$trans$insert28>>2]|0;
    $37 = $$pre29;
   } else {
    $28 = HEAP32[$$phi$trans$insert28>>2]|0;
    $29 = $26;
    $30 = ((($0)) + 108|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = (($29) + 1)|0;
    $33 = (($32) - ($28))|0;
    $34 = (($33) + ($31))|0;
    HEAP32[$30>>2] = $34;
    $35 = $28;
    $37 = $35;
   }
   $36 = ((($37)) + -1|0);
   $38 = HEAP8[$36>>0]|0;
   $39 = $38&255;
   $40 = ($39|0)==($7|0);
   if ($40) {
    $$0 = $7;
   } else {
    $41 = $7&255;
    HEAP8[$36>>0] = $41;
    $$0 = $7;
   }
  }
 }
 if ((label|0) == 4) {
  $9 = ((($0)) + 100|0);
  HEAP32[$9>>2] = 0;
  $$0 = -1;
 }
 return ($$0|0);
}
function ___intscan($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0154222 = 0, $$0157 = 0, $$0157$ = 0, $$0159 = 0, $$1155188 = 0, $$1158 = 0, $$1160 = 0, $$1160169 = 0, $$1165 = 0, $$1165167 = 0, $$1165168 = 0, $$166 = 0, $$2156206 = 0, $$2161$be = 0, $$2161$lcssa = 0, $$3162$be = 0, $$3162$lcssa = 0, $$3162211 = 0, $$4163$be = 0, $$4163$lcssa = 0;
 var $$5$be = 0, $$6$be = 0, $$6$lcssa = 0, $$7$be = 0, $$7194 = 0, $$8 = 0, $$9$be = 0, $$lcssa = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0;
 var $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0;
 var $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0;
 var $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0;
 var $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0;
 var $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0;
 var $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0;
 var $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0;
 var $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0;
 var $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0;
 var $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0;
 var $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $or$cond = 0, $or$cond12 = 0, $or$cond183 = 0, $or$cond5 = 0, $or$cond7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ($1>>>0)>(36);
 L1: do {
  if ($5) {
   $8 = (___errno_location()|0);
   HEAP32[$8>>2] = 22;
   $289 = 0;$290 = 0;
  } else {
   $6 = ((($0)) + 4|0);
   $7 = ((($0)) + 100|0);
   while(1) {
    $9 = HEAP32[$6>>2]|0;
    $10 = HEAP32[$7>>2]|0;
    $11 = ($9>>>0)<($10>>>0);
    if ($11) {
     $12 = ((($9)) + 1|0);
     HEAP32[$6>>2] = $12;
     $13 = HEAP8[$9>>0]|0;
     $14 = $13&255;
     $16 = $14;
    } else {
     $15 = (___shgetc($0)|0);
     $16 = $15;
    }
    $17 = (_isspace($16)|0);
    $18 = ($17|0)==(0);
    if ($18) {
     break;
    }
   }
   $19 = ($16|0)==(45);
   L11: do {
    switch ($16|0) {
    case 43: case 45:  {
     $20 = $19 << 31 >> 31;
     $21 = HEAP32[$6>>2]|0;
     $22 = HEAP32[$7>>2]|0;
     $23 = ($21>>>0)<($22>>>0);
     if ($23) {
      $24 = ((($21)) + 1|0);
      HEAP32[$6>>2] = $24;
      $25 = HEAP8[$21>>0]|0;
      $26 = $25&255;
      $$0157 = $20;$$0159 = $26;
      break L11;
     } else {
      $27 = (___shgetc($0)|0);
      $$0157 = $20;$$0159 = $27;
      break L11;
     }
     break;
    }
    default: {
     $$0157 = 0;$$0159 = $16;
    }
    }
   } while(0);
   $28 = ($1|0)==(0);
   $29 = $1 | 16;
   $30 = ($29|0)==(16);
   $31 = ($$0159|0)==(48);
   $or$cond5 = $30 & $31;
   do {
    if ($or$cond5) {
     $32 = HEAP32[$6>>2]|0;
     $33 = HEAP32[$7>>2]|0;
     $34 = ($32>>>0)<($33>>>0);
     if ($34) {
      $35 = ((($32)) + 1|0);
      HEAP32[$6>>2] = $35;
      $36 = HEAP8[$32>>0]|0;
      $37 = $36&255;
      $40 = $37;
     } else {
      $38 = (___shgetc($0)|0);
      $40 = $38;
     }
     $39 = $40 | 32;
     $41 = ($39|0)==(120);
     if (!($41)) {
      if ($28) {
       $$1160169 = $40;$$1165168 = 8;
       label = 46;
       break;
      } else {
       $$1160 = $40;$$1165 = $1;
       label = 32;
       break;
      }
     }
     $42 = HEAP32[$6>>2]|0;
     $43 = HEAP32[$7>>2]|0;
     $44 = ($42>>>0)<($43>>>0);
     if ($44) {
      $45 = ((($42)) + 1|0);
      HEAP32[$6>>2] = $45;
      $46 = HEAP8[$42>>0]|0;
      $47 = $46&255;
      $50 = $47;
     } else {
      $48 = (___shgetc($0)|0);
      $50 = $48;
     }
     $49 = ((16053) + ($50)|0);
     $51 = HEAP8[$49>>0]|0;
     $52 = ($51&255)>(15);
     if ($52) {
      $53 = HEAP32[$7>>2]|0;
      $54 = ($53|0)==(0|0);
      if (!($54)) {
       $55 = HEAP32[$6>>2]|0;
       $56 = ((($55)) + -1|0);
       HEAP32[$6>>2] = $56;
      }
      $57 = ($2|0)==(0);
      if ($57) {
       ___shlim($0,0);
       $289 = 0;$290 = 0;
       break L1;
      }
      if ($54) {
       $289 = 0;$290 = 0;
       break L1;
      }
      $58 = HEAP32[$6>>2]|0;
      $59 = ((($58)) + -1|0);
      HEAP32[$6>>2] = $59;
      $289 = 0;$290 = 0;
      break L1;
     } else {
      $$1160169 = $50;$$1165168 = 16;
      label = 46;
     }
    } else {
     $$166 = $28 ? 10 : $1;
     $60 = ((16053) + ($$0159)|0);
     $61 = HEAP8[$60>>0]|0;
     $62 = $61&255;
     $63 = ($62>>>0)<($$166>>>0);
     if ($63) {
      $$1160 = $$0159;$$1165 = $$166;
      label = 32;
     } else {
      $64 = HEAP32[$7>>2]|0;
      $65 = ($64|0)==(0|0);
      if (!($65)) {
       $66 = HEAP32[$6>>2]|0;
       $67 = ((($66)) + -1|0);
       HEAP32[$6>>2] = $67;
      }
      ___shlim($0,0);
      $68 = (___errno_location()|0);
      HEAP32[$68>>2] = 22;
      $289 = 0;$290 = 0;
      break L1;
     }
    }
   } while(0);
   if ((label|0) == 32) {
    $69 = ($$1165|0)==(10);
    if ($69) {
     $70 = (($$1160) + -48)|0;
     $71 = ($70>>>0)<(10);
     if ($71) {
      $$0154222 = 0;$74 = $70;
      while(1) {
       $72 = ($$0154222*10)|0;
       $73 = (($72) + ($74))|0;
       $75 = HEAP32[$6>>2]|0;
       $76 = HEAP32[$7>>2]|0;
       $77 = ($75>>>0)<($76>>>0);
       if ($77) {
        $78 = ((($75)) + 1|0);
        HEAP32[$6>>2] = $78;
        $79 = HEAP8[$75>>0]|0;
        $80 = $79&255;
        $$2161$be = $80;
       } else {
        $81 = (___shgetc($0)|0);
        $$2161$be = $81;
       }
       $82 = (($$2161$be) + -48)|0;
       $83 = ($82>>>0)<(10);
       $84 = ($73>>>0)<(429496729);
       $85 = $83 & $84;
       if ($85) {
        $$0154222 = $73;$74 = $82;
       } else {
        break;
       }
      }
      $$2161$lcssa = $$2161$be;$291 = $73;$292 = 0;
     } else {
      $$2161$lcssa = $$1160;$291 = 0;$292 = 0;
     }
     $86 = (($$2161$lcssa) + -48)|0;
     $87 = ($86>>>0)<(10);
     if ($87) {
      $$3162211 = $$2161$lcssa;$88 = $291;$89 = $292;$92 = $86;
      while(1) {
       $90 = (___muldi3(($88|0),($89|0),10,0)|0);
       $91 = tempRet0;
       $93 = ($92|0)<(0);
       $94 = $93 << 31 >> 31;
       $95 = $92 ^ -1;
       $96 = $94 ^ -1;
       $97 = ($91>>>0)>($96>>>0);
       $98 = ($90>>>0)>($95>>>0);
       $99 = ($91|0)==($96|0);
       $100 = $99 & $98;
       $101 = $97 | $100;
       if ($101) {
        $$3162$lcssa = $$3162211;$$lcssa = $92;$293 = $88;$294 = $89;
        break;
       }
       $102 = (_i64Add(($90|0),($91|0),($92|0),($94|0))|0);
       $103 = tempRet0;
       $104 = HEAP32[$6>>2]|0;
       $105 = HEAP32[$7>>2]|0;
       $106 = ($104>>>0)<($105>>>0);
       if ($106) {
        $107 = ((($104)) + 1|0);
        HEAP32[$6>>2] = $107;
        $108 = HEAP8[$104>>0]|0;
        $109 = $108&255;
        $$3162$be = $109;
       } else {
        $110 = (___shgetc($0)|0);
        $$3162$be = $110;
       }
       $111 = (($$3162$be) + -48)|0;
       $112 = ($111>>>0)<(10);
       $113 = ($103>>>0)<(429496729);
       $114 = ($102>>>0)<(2576980378);
       $115 = ($103|0)==(429496729);
       $116 = $115 & $114;
       $117 = $113 | $116;
       $or$cond7 = $112 & $117;
       if ($or$cond7) {
        $$3162211 = $$3162$be;$88 = $102;$89 = $103;$92 = $111;
       } else {
        $$3162$lcssa = $$3162$be;$$lcssa = $111;$293 = $102;$294 = $103;
        break;
       }
      }
      $118 = ($$lcssa>>>0)>(9);
      if ($118) {
       $$1158 = $$0157;$262 = $294;$264 = $293;
      } else {
       $$1165167 = 10;$$8 = $$3162$lcssa;$295 = $293;$296 = $294;
       label = 72;
      }
     } else {
      $$1158 = $$0157;$262 = $292;$264 = $291;
     }
    } else {
     $$1160169 = $$1160;$$1165168 = $$1165;
     label = 46;
    }
   }
   L63: do {
    if ((label|0) == 46) {
     $119 = (($$1165168) + -1)|0;
     $120 = $119 & $$1165168;
     $121 = ($120|0)==(0);
     if ($121) {
      $126 = ($$1165168*23)|0;
      $127 = $126 >>> 5;
      $128 = $127 & 7;
      $129 = (16309 + ($128)|0);
      $130 = HEAP8[$129>>0]|0;
      $131 = $130 << 24 >> 24;
      $132 = ((16053) + ($$1160169)|0);
      $133 = HEAP8[$132>>0]|0;
      $134 = $133&255;
      $135 = ($134>>>0)<($$1165168>>>0);
      if ($135) {
       $$1155188 = 0;$138 = $134;
       while(1) {
        $136 = $$1155188 << $131;
        $137 = $138 | $136;
        $139 = HEAP32[$6>>2]|0;
        $140 = HEAP32[$7>>2]|0;
        $141 = ($139>>>0)<($140>>>0);
        if ($141) {
         $142 = ((($139)) + 1|0);
         HEAP32[$6>>2] = $142;
         $143 = HEAP8[$139>>0]|0;
         $144 = $143&255;
         $$4163$be = $144;
        } else {
         $145 = (___shgetc($0)|0);
         $$4163$be = $145;
        }
        $146 = ((16053) + ($$4163$be)|0);
        $147 = HEAP8[$146>>0]|0;
        $148 = $147&255;
        $149 = ($148>>>0)<($$1165168>>>0);
        $150 = ($137>>>0)<(134217728);
        $151 = $150 & $149;
        if ($151) {
         $$1155188 = $137;$138 = $148;
        } else {
         break;
        }
       }
       $$4163$lcssa = $$4163$be;$155 = $147;$157 = 0;$159 = $137;
      } else {
       $$4163$lcssa = $$1160169;$155 = $133;$157 = 0;$159 = 0;
      }
      $152 = (_bitshift64Lshr(-1,-1,($131|0))|0);
      $153 = tempRet0;
      $154 = $155&255;
      $156 = ($154>>>0)>=($$1165168>>>0);
      $158 = ($157>>>0)>($153>>>0);
      $160 = ($159>>>0)>($152>>>0);
      $161 = ($157|0)==($153|0);
      $162 = $161 & $160;
      $163 = $158 | $162;
      $or$cond183 = $156 | $163;
      if ($or$cond183) {
       $$1165167 = $$1165168;$$8 = $$4163$lcssa;$295 = $159;$296 = $157;
       label = 72;
       break;
      } else {
       $164 = $159;$165 = $157;$169 = $155;
      }
      while(1) {
       $166 = (_bitshift64Shl(($164|0),($165|0),($131|0))|0);
       $167 = tempRet0;
       $168 = $169&255;
       $170 = $168 | $166;
       $171 = HEAP32[$6>>2]|0;
       $172 = HEAP32[$7>>2]|0;
       $173 = ($171>>>0)<($172>>>0);
       if ($173) {
        $174 = ((($171)) + 1|0);
        HEAP32[$6>>2] = $174;
        $175 = HEAP8[$171>>0]|0;
        $176 = $175&255;
        $$5$be = $176;
       } else {
        $177 = (___shgetc($0)|0);
        $$5$be = $177;
       }
       $178 = ((16053) + ($$5$be)|0);
       $179 = HEAP8[$178>>0]|0;
       $180 = $179&255;
       $181 = ($180>>>0)>=($$1165168>>>0);
       $182 = ($167>>>0)>($153>>>0);
       $183 = ($170>>>0)>($152>>>0);
       $184 = ($167|0)==($153|0);
       $185 = $184 & $183;
       $186 = $182 | $185;
       $or$cond = $181 | $186;
       if ($or$cond) {
        $$1165167 = $$1165168;$$8 = $$5$be;$295 = $170;$296 = $167;
        label = 72;
        break L63;
       } else {
        $164 = $170;$165 = $167;$169 = $179;
       }
      }
     }
     $122 = ((16053) + ($$1160169)|0);
     $123 = HEAP8[$122>>0]|0;
     $124 = $123&255;
     $125 = ($124>>>0)<($$1165168>>>0);
     if ($125) {
      $$2156206 = 0;$189 = $124;
      while(1) {
       $187 = Math_imul($$2156206, $$1165168)|0;
       $188 = (($189) + ($187))|0;
       $190 = HEAP32[$6>>2]|0;
       $191 = HEAP32[$7>>2]|0;
       $192 = ($190>>>0)<($191>>>0);
       if ($192) {
        $193 = ((($190)) + 1|0);
        HEAP32[$6>>2] = $193;
        $194 = HEAP8[$190>>0]|0;
        $195 = $194&255;
        $$6$be = $195;
       } else {
        $196 = (___shgetc($0)|0);
        $$6$be = $196;
       }
       $197 = ((16053) + ($$6$be)|0);
       $198 = HEAP8[$197>>0]|0;
       $199 = $198&255;
       $200 = ($199>>>0)<($$1165168>>>0);
       $201 = ($188>>>0)<(119304647);
       $202 = $201 & $200;
       if ($202) {
        $$2156206 = $188;$189 = $199;
       } else {
        break;
       }
      }
      $$6$lcssa = $$6$be;$204 = $198;$297 = $188;$298 = 0;
     } else {
      $$6$lcssa = $$1160169;$204 = $123;$297 = 0;$298 = 0;
     }
     $203 = $204&255;
     $205 = ($203>>>0)<($$1165168>>>0);
     if ($205) {
      $206 = (___udivdi3(-1,-1,($$1165168|0),0)|0);
      $207 = tempRet0;
      $$7194 = $$6$lcssa;$208 = $298;$210 = $297;$218 = $204;
      while(1) {
       $209 = ($208>>>0)>($207>>>0);
       $211 = ($210>>>0)>($206>>>0);
       $212 = ($208|0)==($207|0);
       $213 = $212 & $211;
       $214 = $209 | $213;
       if ($214) {
        $$1165167 = $$1165168;$$8 = $$7194;$295 = $210;$296 = $208;
        label = 72;
        break L63;
       }
       $215 = (___muldi3(($210|0),($208|0),($$1165168|0),0)|0);
       $216 = tempRet0;
       $217 = $218&255;
       $219 = $217 ^ -1;
       $220 = ($216>>>0)>(4294967295);
       $221 = ($215>>>0)>($219>>>0);
       $222 = ($216|0)==(-1);
       $223 = $222 & $221;
       $224 = $220 | $223;
       if ($224) {
        $$1165167 = $$1165168;$$8 = $$7194;$295 = $210;$296 = $208;
        label = 72;
        break L63;
       }
       $225 = (_i64Add(($217|0),0,($215|0),($216|0))|0);
       $226 = tempRet0;
       $227 = HEAP32[$6>>2]|0;
       $228 = HEAP32[$7>>2]|0;
       $229 = ($227>>>0)<($228>>>0);
       if ($229) {
        $230 = ((($227)) + 1|0);
        HEAP32[$6>>2] = $230;
        $231 = HEAP8[$227>>0]|0;
        $232 = $231&255;
        $$7$be = $232;
       } else {
        $233 = (___shgetc($0)|0);
        $$7$be = $233;
       }
       $234 = ((16053) + ($$7$be)|0);
       $235 = HEAP8[$234>>0]|0;
       $236 = $235&255;
       $237 = ($236>>>0)<($$1165168>>>0);
       if ($237) {
        $$7194 = $$7$be;$208 = $226;$210 = $225;$218 = $235;
       } else {
        $$1165167 = $$1165168;$$8 = $$7$be;$295 = $225;$296 = $226;
        label = 72;
        break;
       }
      }
     } else {
      $$1165167 = $$1165168;$$8 = $$6$lcssa;$295 = $297;$296 = $298;
      label = 72;
     }
    }
   } while(0);
   if ((label|0) == 72) {
    $238 = ((16053) + ($$8)|0);
    $239 = HEAP8[$238>>0]|0;
    $240 = $239&255;
    $241 = ($240>>>0)<($$1165167>>>0);
    if ($241) {
     while(1) {
      $242 = HEAP32[$6>>2]|0;
      $243 = HEAP32[$7>>2]|0;
      $244 = ($242>>>0)<($243>>>0);
      if ($244) {
       $245 = ((($242)) + 1|0);
       HEAP32[$6>>2] = $245;
       $246 = HEAP8[$242>>0]|0;
       $247 = $246&255;
       $$9$be = $247;
      } else {
       $248 = (___shgetc($0)|0);
       $$9$be = $248;
      }
      $249 = ((16053) + ($$9$be)|0);
      $250 = HEAP8[$249>>0]|0;
      $251 = $250&255;
      $252 = ($251>>>0)<($$1165167>>>0);
      if (!($252)) {
       break;
      }
     }
     $253 = (___errno_location()|0);
     HEAP32[$253>>2] = 34;
     $254 = $3 & 1;
     $255 = ($254|0)==(0);
     $256 = (0)==(0);
     $257 = $255 & $256;
     $$0157$ = $257 ? $$0157 : 0;
     $$1158 = $$0157$;$262 = $4;$264 = $3;
    } else {
     $$1158 = $$0157;$262 = $296;$264 = $295;
    }
   }
   $258 = HEAP32[$7>>2]|0;
   $259 = ($258|0)==(0|0);
   if (!($259)) {
    $260 = HEAP32[$6>>2]|0;
    $261 = ((($260)) + -1|0);
    HEAP32[$6>>2] = $261;
   }
   $263 = ($262>>>0)<($4>>>0);
   $265 = ($264>>>0)<($3>>>0);
   $266 = ($262|0)==($4|0);
   $267 = $266 & $265;
   $268 = $263 | $267;
   if (!($268)) {
    $269 = $3 & 1;
    $270 = ($269|0)!=(0);
    $271 = (0)!=(0);
    $272 = $270 | $271;
    $273 = ($$1158|0)!=(0);
    $or$cond12 = $272 | $273;
    if (!($or$cond12)) {
     $274 = (___errno_location()|0);
     HEAP32[$274>>2] = 34;
     $275 = (_i64Add(($3|0),($4|0),-1,-1)|0);
     $276 = tempRet0;
     $289 = $276;$290 = $275;
     break;
    }
    $277 = ($262>>>0)>($4>>>0);
    $278 = ($264>>>0)>($3>>>0);
    $279 = ($262|0)==($4|0);
    $280 = $279 & $278;
    $281 = $277 | $280;
    if ($281) {
     $282 = (___errno_location()|0);
     HEAP32[$282>>2] = 34;
     $289 = $4;$290 = $3;
     break;
    }
   }
   $283 = ($$1158|0)<(0);
   $284 = $283 << 31 >> 31;
   $285 = $264 ^ $$1158;
   $286 = $262 ^ $284;
   $287 = (_i64Subtract(($285|0),($286|0),($$1158|0),($284|0))|0);
   $288 = tempRet0;
   $289 = $288;$290 = $287;
  }
 } while(0);
 tempRet0 = ($289);
 return ($290|0);
}
function _scalbn($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $$ = 0, $$0 = 0.0, $$020 = 0, $$1 = 0, $10 = 0.0, $11 = 0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0.0, $2 = 0, $20 = 0.0, $3 = 0.0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)>(1023);
 if ($2) {
  $3 = $0 * 8.9884656743115795E+307;
  $4 = (($1) + -1023)|0;
  $5 = ($4|0)>(1023);
  $6 = (($1) + -2046)|0;
  if ($5) {
   $7 = $3 * 8.9884656743115795E+307;
   $8 = ($6|0)>(1023);
   $$ = $8 ? 1023 : $6;
   $$0 = $7;$$020 = $$;
  } else {
   $$0 = $3;$$020 = $4;
  }
 } else {
  $9 = ($1|0)<(-1022);
  if ($9) {
   $10 = $0 * 2.2250738585072014E-308;
   $11 = (($1) + 1022)|0;
   $12 = ($11|0)<(-1022);
   $13 = (($1) + 2044)|0;
   if ($12) {
    $14 = $10 * 2.2250738585072014E-308;
    $15 = ($13|0)<(-1022);
    $$1 = $15 ? -1022 : $13;
    $$0 = $14;$$020 = $$1;
   } else {
    $$0 = $10;$$020 = $11;
   }
  } else {
   $$0 = $0;$$020 = $1;
  }
 }
 $16 = (($$020) + 1023)|0;
 $17 = (_bitshift64Shl(($16|0),0,52)|0);
 $18 = tempRet0;
 HEAP32[tempDoublePtr>>2] = $17;HEAP32[tempDoublePtr+4>>2] = $18;$19 = +HEAPF64[tempDoublePtr>>3];
 $20 = $$0 * $19;
 return (+$20);
}
function ___overflow($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = $1&255;
 HEAP8[$2>>0] = $3;
 $4 = ((($0)) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0|0);
 if ($6) {
  $7 = (___towrite($0)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$4>>2]|0;
   $12 = $$pre;
   label = 4;
  } else {
   $$0 = -1;
  }
 } else {
  $12 = $5;
  label = 4;
 }
 do {
  if ((label|0) == 4) {
   $9 = ((($0)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = ($10>>>0)<($12>>>0);
   if ($11) {
    $13 = $1 & 255;
    $14 = ((($0)) + 75|0);
    $15 = HEAP8[$14>>0]|0;
    $16 = $15 << 24 >> 24;
    $17 = ($13|0)==($16|0);
    if (!($17)) {
     $18 = ((($10)) + 1|0);
     HEAP32[$9>>2] = $18;
     HEAP8[$10>>0] = $3;
     $$0 = $13;
     break;
    }
   }
   $19 = ((($0)) + 36|0);
   $20 = HEAP32[$19>>2]|0;
   $21 = (FUNCTION_TABLE_iiii[$20 & 7]($0,$2,1)|0);
   $22 = ($21|0)==(1);
   if ($22) {
    $23 = HEAP8[$2>>0]|0;
    $24 = $23&255;
    $$0 = $24;
   } else {
    $$0 = -1;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function _fprintf($0,$1,$varargs) {
 $0 = $0|0;
 $1 = $1|0;
 $varargs = $varargs|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 HEAP32[$2>>2] = $varargs;
 $3 = (_vfprintf($0,$1,$2)|0);
 STACKTOP = sp;return ($3|0);
}
function _getc($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 76|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)<(0);
 if ($3) {
  label = 3;
 } else {
  $4 = (___lockfile($0)|0);
  $5 = ($4|0)==(0);
  if ($5) {
   label = 3;
  } else {
   $15 = ((($0)) + 4|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = ((($0)) + 8|0);
   $18 = HEAP32[$17>>2]|0;
   $19 = ($16>>>0)<($18>>>0);
   if ($19) {
    $20 = ((($16)) + 1|0);
    HEAP32[$15>>2] = $20;
    $21 = HEAP8[$16>>0]|0;
    $22 = $21&255;
    $24 = $22;
   } else {
    $23 = (___uflow($0)|0);
    $24 = $23;
   }
   ___unlockfile($0);
   $$0 = $24;
  }
 }
 do {
  if ((label|0) == 3) {
   $6 = ((($0)) + 4|0);
   $7 = HEAP32[$6>>2]|0;
   $8 = ((($0)) + 8|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = ($7>>>0)<($9>>>0);
   if ($10) {
    $11 = ((($7)) + 1|0);
    HEAP32[$6>>2] = $11;
    $12 = HEAP8[$7>>0]|0;
    $13 = $12&255;
    $$0 = $13;
    break;
   } else {
    $14 = (___uflow($0)|0);
    $$0 = $14;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function _fputc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 76|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)<(0);
 if ($4) {
  label = 3;
 } else {
  $5 = (___lockfile($1)|0);
  $6 = ($5|0)==(0);
  if ($6) {
   label = 3;
  } else {
   $20 = ((($1)) + 75|0);
   $21 = HEAP8[$20>>0]|0;
   $22 = $21 << 24 >> 24;
   $23 = ($22|0)==($0|0);
   if ($23) {
    label = 10;
   } else {
    $24 = ((($1)) + 20|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = ((($1)) + 16|0);
    $27 = HEAP32[$26>>2]|0;
    $28 = ($25>>>0)<($27>>>0);
    if ($28) {
     $29 = $0&255;
     $30 = ((($25)) + 1|0);
     HEAP32[$24>>2] = $30;
     HEAP8[$25>>0] = $29;
     $31 = $0 & 255;
     $33 = $31;
    } else {
     label = 10;
    }
   }
   if ((label|0) == 10) {
    $32 = (___overflow($1,$0)|0);
    $33 = $32;
   }
   ___unlockfile($1);
   $$0 = $33;
  }
 }
 do {
  if ((label|0) == 3) {
   $7 = ((($1)) + 75|0);
   $8 = HEAP8[$7>>0]|0;
   $9 = $8 << 24 >> 24;
   $10 = ($9|0)==($0|0);
   if (!($10)) {
    $11 = ((($1)) + 20|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ((($1)) + 16|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($12>>>0)<($14>>>0);
    if ($15) {
     $16 = $0&255;
     $17 = ((($12)) + 1|0);
     HEAP32[$11>>2] = $17;
     HEAP8[$12>>0] = $16;
     $18 = $0 & 255;
     $$0 = $18;
     break;
    }
   }
   $19 = (___overflow($1,$0)|0);
   $$0 = $19;
  }
 } while(0);
 return ($$0|0);
}
function _fwrite($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = Math_imul($2, $1)|0;
 $5 = ((($3)) + 76|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6|0)>(-1);
 if ($7) {
  $9 = (___lockfile($3)|0);
  $phitmp = ($9|0)==(0);
  $10 = (___fwritex($0,$4,$3)|0);
  if ($phitmp) {
   $11 = $10;
  } else {
   ___unlockfile($3);
   $11 = $10;
  }
 } else {
  $8 = (___fwritex($0,$4,$3)|0);
  $11 = $8;
 }
 $12 = ($11|0)==($4|0);
 if ($12) {
  $14 = $2;
 } else {
  $13 = (($11>>>0) / ($1>>>0))&-1;
  $14 = $13;
 }
 return ($14|0);
}
function _sprintf($0,$1,$varargs) {
 $0 = $0|0;
 $1 = $1|0;
 $varargs = $varargs|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 HEAP32[$2>>2] = $varargs;
 $3 = (_vsprintf($0,$1,$2)|0);
 STACKTOP = sp;return ($3|0);
}
function _vsprintf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_vsnprintf($0,2147483647,$1,$2)|0);
 return ($3|0);
}
function _putc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 76|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)<(0);
 if ($4) {
  label = 3;
 } else {
  $5 = (___lockfile($1)|0);
  $6 = ($5|0)==(0);
  if ($6) {
   label = 3;
  } else {
   $20 = ((($1)) + 75|0);
   $21 = HEAP8[$20>>0]|0;
   $22 = $21 << 24 >> 24;
   $23 = ($22|0)==($0|0);
   if ($23) {
    label = 10;
   } else {
    $24 = ((($1)) + 20|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = ((($1)) + 16|0);
    $27 = HEAP32[$26>>2]|0;
    $28 = ($25>>>0)<($27>>>0);
    if ($28) {
     $29 = $0&255;
     $30 = ((($25)) + 1|0);
     HEAP32[$24>>2] = $30;
     HEAP8[$25>>0] = $29;
     $31 = $0 & 255;
     $33 = $31;
    } else {
     label = 10;
    }
   }
   if ((label|0) == 10) {
    $32 = (___overflow($1,$0)|0);
    $33 = $32;
   }
   ___unlockfile($1);
   $$0 = $33;
  }
 }
 do {
  if ((label|0) == 3) {
   $7 = ((($1)) + 75|0);
   $8 = HEAP8[$7>>0]|0;
   $9 = $8 << 24 >> 24;
   $10 = ($9|0)==($0|0);
   if (!($10)) {
    $11 = ((($1)) + 20|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ((($1)) + 16|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($12>>>0)<($14>>>0);
    if ($15) {
     $16 = $0&255;
     $17 = ((($12)) + 1|0);
     HEAP32[$11>>2] = $17;
     HEAP8[$12>>0] = $16;
     $18 = $0 & 255;
     $$0 = $18;
     break;
    }
   }
   $19 = (___overflow($1,$0)|0);
   $$0 = $19;
  }
 } while(0);
 return ($$0|0);
}
function _fread($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$ = 0, $$0 = 0, $$053$ph = 0, $$05357 = 0, $$054$ph = 0, $$05456 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = Math_imul($2, $1)|0;
 $5 = ((($3)) + 76|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6|0)>(-1);
 if ($7) {
  $8 = (___lockfile($3)|0);
  $34 = $8;
 } else {
  $34 = 0;
 }
 $9 = ((($3)) + 74|0);
 $10 = HEAP8[$9>>0]|0;
 $11 = $10 << 24 >> 24;
 $12 = (($11) + 255)|0;
 $13 = $12 | $11;
 $14 = $13&255;
 HEAP8[$9>>0] = $14;
 $15 = ((($3)) + 8|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ((($3)) + 4|0);
 $18 = HEAP32[$17>>2]|0;
 $19 = (($16) - ($18))|0;
 $20 = ($19|0)>(0);
 $21 = $18;
 if ($20) {
  $22 = ($19>>>0)<($4>>>0);
  $$ = $22 ? $19 : $4;
  _memcpy(($0|0),($21|0),($$|0))|0;
  $23 = (($21) + ($$)|0);
  HEAP32[$17>>2] = $23;
  $24 = (($0) + ($$)|0);
  $25 = (($4) - ($$))|0;
  $$053$ph = $25;$$054$ph = $24;
 } else {
  $$053$ph = $4;$$054$ph = $0;
 }
 $26 = ($$053$ph|0)==(0);
 L7: do {
  if ($26) {
   label = 13;
  } else {
   $27 = ((($3)) + 32|0);
   $$05357 = $$053$ph;$$05456 = $$054$ph;
   while(1) {
    $28 = (___toread($3)|0);
    $29 = ($28|0)==(0);
    if (!($29)) {
     break;
    }
    $30 = HEAP32[$27>>2]|0;
    $31 = (FUNCTION_TABLE_iiii[$30 & 7]($3,$$05456,$$05357)|0);
    $32 = (($31) + 1)|0;
    $33 = ($32>>>0)<(2);
    if ($33) {
     break;
    }
    $38 = (($$05357) - ($31))|0;
    $39 = (($$05456) + ($31)|0);
    $40 = ($38|0)==(0);
    if ($40) {
     label = 13;
     break L7;
    } else {
     $$05357 = $38;$$05456 = $39;
    }
   }
   $35 = ($34|0)==(0);
   if (!($35)) {
    ___unlockfile($3);
   }
   $36 = (($4) - ($$05357))|0;
   $37 = (($36>>>0) / ($1>>>0))&-1;
   $$0 = $37;
  }
 } while(0);
 if ((label|0) == 13) {
  $41 = ($34|0)==(0);
  if ($41) {
   $$0 = $2;
  } else {
   ___unlockfile($3);
   $$0 = $2;
  }
 }
 return ($$0|0);
}
function _fputs($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (_strlen($0)|0);
 $3 = (_fwrite($0,$2,1,$1)|0);
 $4 = (($3) + -1)|0;
 return ($4|0);
}
function _puts($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[1371]|0;
 $2 = ((($1)) + 76|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)>(-1);
 if ($4) {
  $5 = (___lockfile($1)|0);
  $20 = $5;
 } else {
  $20 = 0;
 }
 $6 = (_fputs($0,$1)|0);
 $7 = ($6|0)<(0);
 do {
  if ($7) {
   $19 = 1;
  } else {
   $8 = ((($1)) + 75|0);
   $9 = HEAP8[$8>>0]|0;
   $10 = ($9<<24>>24)==(10);
   if (!($10)) {
    $11 = ((($1)) + 20|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ((($1)) + 16|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($12>>>0)<($14>>>0);
    if ($15) {
     $16 = ((($12)) + 1|0);
     HEAP32[$11>>2] = $16;
     HEAP8[$12>>0] = 10;
     $19 = 0;
     break;
    }
   }
   $17 = (___overflow($1,10)|0);
   $phitmp = ($17|0)<(0);
   $19 = $phitmp;
  }
 } while(0);
 $18 = $19 << 31 >> 31;
 $21 = ($20|0)==(0);
 if (!($21)) {
  ___unlockfile($1);
 }
 return ($18|0);
}
function _fseek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (___fseeko($0,$1,$2)|0);
 return ($3|0);
}
function _strtol($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_strtox_378($0,$1,$2,-2147483648,0)|0);
 $4 = tempRet0;
 return ($3|0);
}
function _strtox_378($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0;
 $5 = sp;
 HEAP32[$5>>2] = 0;
 $6 = ((($5)) + 4|0);
 HEAP32[$6>>2] = $0;
 $7 = ((($5)) + 44|0);
 HEAP32[$7>>2] = $0;
 $8 = ($0|0)<(0|0);
 $9 = ((($0)) + 2147483647|0);
 $$sink = $8 ? (-1) : $9;
 $10 = ((($5)) + 8|0);
 HEAP32[$10>>2] = $$sink;
 $11 = ((($5)) + 76|0);
 HEAP32[$11>>2] = -1;
 ___shlim($5,0);
 $12 = (___intscan($5,$2,1,$3,$4)|0);
 $13 = tempRet0;
 $14 = ($1|0)==(0|0);
 if (!($14)) {
  $15 = ((($5)) + 108|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = HEAP32[$6>>2]|0;
  $18 = HEAP32[$10>>2]|0;
  $19 = (($17) + ($16))|0;
  $20 = (($19) - ($18))|0;
  $21 = (($0) + ($20)|0);
  HEAP32[$1>>2] = $21;
 }
 tempRet0 = ($13);
 STACKTOP = sp;return ($12|0);
}
function _strcmp($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$011 = 0, $$0710 = 0, $$lcssa = 0, $$lcssa8 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$0>>0]|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = ($2<<24>>24)!=($3<<24>>24);
 $5 = ($2<<24>>24)==(0);
 $or$cond9 = $5 | $4;
 if ($or$cond9) {
  $$lcssa = $3;$$lcssa8 = $2;
 } else {
  $$011 = $1;$$0710 = $0;
  while(1) {
   $6 = ((($$0710)) + 1|0);
   $7 = ((($$011)) + 1|0);
   $8 = HEAP8[$6>>0]|0;
   $9 = HEAP8[$7>>0]|0;
   $10 = ($8<<24>>24)!=($9<<24>>24);
   $11 = ($8<<24>>24)==(0);
   $or$cond = $11 | $10;
   if ($or$cond) {
    $$lcssa = $9;$$lcssa8 = $8;
    break;
   } else {
    $$011 = $7;$$0710 = $6;
   }
  }
 }
 $12 = $$lcssa8&255;
 $13 = $$lcssa&255;
 $14 = (($12) - ($13))|0;
 return ($14|0);
}
function _strcpy($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 (___stpcpy($0,$1)|0);
 return ($0|0);
}
function ___stpcpy($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$lcssa = 0, $$025$lcssa = 0, $$02536 = 0, $$026$lcssa = 0, $$02642 = 0, $$027$lcssa = 0, $$02741 = 0, $$029 = 0, $$037 = 0, $$1$ph = 0, $$128$ph = 0, $$12834 = 0, $$135 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1;
 $3 = $0;
 $4 = $2 ^ $3;
 $5 = $4 & 3;
 $6 = ($5|0)==(0);
 L1: do {
  if ($6) {
   $7 = $2 & 3;
   $8 = ($7|0)==(0);
   if ($8) {
    $$026$lcssa = $1;$$027$lcssa = $0;
   } else {
    $$02642 = $1;$$02741 = $0;
    while(1) {
     $9 = HEAP8[$$02642>>0]|0;
     HEAP8[$$02741>>0] = $9;
     $10 = ($9<<24>>24)==(0);
     if ($10) {
      $$029 = $$02741;
      break L1;
     }
     $11 = ((($$02642)) + 1|0);
     $12 = ((($$02741)) + 1|0);
     $13 = $11;
     $14 = $13 & 3;
     $15 = ($14|0)==(0);
     if ($15) {
      $$026$lcssa = $11;$$027$lcssa = $12;
      break;
     } else {
      $$02642 = $11;$$02741 = $12;
     }
    }
   }
   $16 = HEAP32[$$026$lcssa>>2]|0;
   $17 = (($16) + -16843009)|0;
   $18 = $16 & -2139062144;
   $19 = $18 ^ -2139062144;
   $20 = $19 & $17;
   $21 = ($20|0)==(0);
   if ($21) {
    $$02536 = $$027$lcssa;$$037 = $$026$lcssa;$24 = $16;
    while(1) {
     $22 = ((($$037)) + 4|0);
     $23 = ((($$02536)) + 4|0);
     HEAP32[$$02536>>2] = $24;
     $25 = HEAP32[$22>>2]|0;
     $26 = (($25) + -16843009)|0;
     $27 = $25 & -2139062144;
     $28 = $27 ^ -2139062144;
     $29 = $28 & $26;
     $30 = ($29|0)==(0);
     if ($30) {
      $$02536 = $23;$$037 = $22;$24 = $25;
     } else {
      $$0$lcssa = $22;$$025$lcssa = $23;
      break;
     }
    }
   } else {
    $$0$lcssa = $$026$lcssa;$$025$lcssa = $$027$lcssa;
   }
   $$1$ph = $$0$lcssa;$$128$ph = $$025$lcssa;
   label = 8;
  } else {
   $$1$ph = $1;$$128$ph = $0;
   label = 8;
  }
 } while(0);
 if ((label|0) == 8) {
  $31 = HEAP8[$$1$ph>>0]|0;
  HEAP8[$$128$ph>>0] = $31;
  $32 = ($31<<24>>24)==(0);
  if ($32) {
   $$029 = $$128$ph;
  } else {
   $$12834 = $$128$ph;$$135 = $$1$ph;
   while(1) {
    $33 = ((($$135)) + 1|0);
    $34 = ((($$12834)) + 1|0);
    $35 = HEAP8[$33>>0]|0;
    HEAP8[$34>>0] = $35;
    $36 = ($35<<24>>24)==(0);
    if ($36) {
     $$029 = $34;
     break;
    } else {
     $$12834 = $34;$$135 = $33;
    }
   }
  }
 }
 return ($$029|0);
}
function _ldexp($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (+_scalbn($0,$1));
 return (+$2);
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0190$i = 0, $$$0191$i = 0, $$$4349$i = 0, $$$i = 0, $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i17$i = 0, $$0$i18$i = 0, $$01$i$i = 0, $$0187$i = 0, $$0189$i = 0, $$0190$i = 0, $$0191$i = 0, $$0197 = 0, $$0199 = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0;
 var $$024370$i = 0, $$0286$i$i = 0, $$0287$i$i = 0, $$0288$i$i = 0, $$0294$i$i = 0, $$0295$i$i = 0, $$0340$i = 0, $$0342$i = 0, $$0343$i = 0, $$0345$i = 0, $$0351$i = 0, $$0356$i = 0, $$0357$$i = 0, $$0357$i = 0, $$0359$i = 0, $$0360$i = 0, $$0366$i = 0, $$1194$i = 0, $$1196$i = 0, $$124469$i = 0;
 var $$1290$i$i = 0, $$1292$i$i = 0, $$1341$i = 0, $$1346$i = 0, $$1361$i = 0, $$1368$i = 0, $$1372$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2353$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i201 = 0, $$3348$i = 0, $$3370$i = 0, $$4$lcssa$i = 0, $$413$i = 0, $$4349$lcssa$i = 0, $$434912$i = 0, $$4355$$4$i = 0;
 var $$4355$ph$i = 0, $$435511$i = 0, $$5256$i = 0, $$723947$i = 0, $$748$i = 0, $$not$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i19$i = 0, $$pre$i205 = 0, $$pre$i208 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i20$iZ2D = 0, $$pre$phi$i206Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre9$i$i = 0, $1 = 0;
 var $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0;
 var $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0;
 var $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0;
 var $1053 = 0, $1054 = 0, $1055 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0;
 var $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0;
 var $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0;
 var $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0;
 var $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0;
 var $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0;
 var $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0;
 var $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0;
 var $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0;
 var $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0;
 var $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0;
 var $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0;
 var $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0;
 var $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0;
 var $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0;
 var $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0;
 var $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0;
 var $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0;
 var $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0;
 var $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0;
 var $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0;
 var $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0;
 var $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0;
 var $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0;
 var $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0;
 var $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0;
 var $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0;
 var $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0;
 var $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0;
 var $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0;
 var $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0;
 var $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0;
 var $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0;
 var $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0;
 var $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0;
 var $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0;
 var $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0;
 var $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0;
 var $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0;
 var $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0;
 var $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0;
 var $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0;
 var $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0;
 var $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0;
 var $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i204 = 0, $exitcond$i$i = 0, $not$$i$i = 0, $not$$i22$i = 0;
 var $not$7$i = 0, $or$cond$i = 0, $or$cond$i211 = 0, $or$cond1$i = 0, $or$cond1$i210 = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[4952]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (19848 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($16|0)==($20|0);
    do {
     if ($21) {
      $22 = 1 << $14;
      $23 = $22 ^ -1;
      $24 = $8 & $23;
      HEAP32[4952] = $24;
     } else {
      $25 = HEAP32[(19824)>>2]|0;
      $26 = ($20>>>0)<($25>>>0);
      if ($26) {
       _abort();
       // unreachable;
      }
      $27 = ((($20)) + 12|0);
      $28 = HEAP32[$27>>2]|0;
      $29 = ($28|0)==($18|0);
      if ($29) {
       HEAP32[$27>>2] = $16;
       HEAP32[$17>>2] = $20;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $30 = $14 << 3;
    $31 = $30 | 3;
    $32 = ((($18)) + 4|0);
    HEAP32[$32>>2] = $31;
    $33 = (($18) + ($30)|0);
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = $35 | 1;
    HEAP32[$34>>2] = $36;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $37 = HEAP32[(19816)>>2]|0;
   $38 = ($6>>>0)>($37>>>0);
   if ($38) {
    $39 = ($9|0)==(0);
    if (!($39)) {
     $40 = $9 << $7;
     $41 = 2 << $7;
     $42 = (0 - ($41))|0;
     $43 = $41 | $42;
     $44 = $40 & $43;
     $45 = (0 - ($44))|0;
     $46 = $44 & $45;
     $47 = (($46) + -1)|0;
     $48 = $47 >>> 12;
     $49 = $48 & 16;
     $50 = $47 >>> $49;
     $51 = $50 >>> 5;
     $52 = $51 & 8;
     $53 = $52 | $49;
     $54 = $50 >>> $52;
     $55 = $54 >>> 2;
     $56 = $55 & 4;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 2;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = $62 >>> 1;
     $64 = $63 & 1;
     $65 = $61 | $64;
     $66 = $62 >>> $64;
     $67 = (($65) + ($66))|0;
     $68 = $67 << 1;
     $69 = (19848 + ($68<<2)|0);
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ((($71)) + 8|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = ($69|0)==($73|0);
     do {
      if ($74) {
       $75 = 1 << $67;
       $76 = $75 ^ -1;
       $77 = $8 & $76;
       HEAP32[4952] = $77;
       $98 = $77;
      } else {
       $78 = HEAP32[(19824)>>2]|0;
       $79 = ($73>>>0)<($78>>>0);
       if ($79) {
        _abort();
        // unreachable;
       }
       $80 = ((($73)) + 12|0);
       $81 = HEAP32[$80>>2]|0;
       $82 = ($81|0)==($71|0);
       if ($82) {
        HEAP32[$80>>2] = $69;
        HEAP32[$70>>2] = $73;
        $98 = $8;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $83 = $67 << 3;
     $84 = (($83) - ($6))|0;
     $85 = $6 | 3;
     $86 = ((($71)) + 4|0);
     HEAP32[$86>>2] = $85;
     $87 = (($71) + ($6)|0);
     $88 = $84 | 1;
     $89 = ((($87)) + 4|0);
     HEAP32[$89>>2] = $88;
     $90 = (($87) + ($84)|0);
     HEAP32[$90>>2] = $84;
     $91 = ($37|0)==(0);
     if (!($91)) {
      $92 = HEAP32[(19828)>>2]|0;
      $93 = $37 >>> 3;
      $94 = $93 << 1;
      $95 = (19848 + ($94<<2)|0);
      $96 = 1 << $93;
      $97 = $98 & $96;
      $99 = ($97|0)==(0);
      if ($99) {
       $100 = $98 | $96;
       HEAP32[4952] = $100;
       $$pre = ((($95)) + 8|0);
       $$0199 = $95;$$pre$phiZ2D = $$pre;
      } else {
       $101 = ((($95)) + 8|0);
       $102 = HEAP32[$101>>2]|0;
       $103 = HEAP32[(19824)>>2]|0;
       $104 = ($102>>>0)<($103>>>0);
       if ($104) {
        _abort();
        // unreachable;
       } else {
        $$0199 = $102;$$pre$phiZ2D = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $92;
      $105 = ((($$0199)) + 12|0);
      HEAP32[$105>>2] = $92;
      $106 = ((($92)) + 8|0);
      HEAP32[$106>>2] = $$0199;
      $107 = ((($92)) + 12|0);
      HEAP32[$107>>2] = $95;
     }
     HEAP32[(19816)>>2] = $84;
     HEAP32[(19828)>>2] = $87;
     $$0 = $72;
     STACKTOP = sp;return ($$0|0);
    }
    $108 = HEAP32[(19812)>>2]|0;
    $109 = ($108|0)==(0);
    if ($109) {
     $$0197 = $6;
    } else {
     $110 = (0 - ($108))|0;
     $111 = $108 & $110;
     $112 = (($111) + -1)|0;
     $113 = $112 >>> 12;
     $114 = $113 & 16;
     $115 = $112 >>> $114;
     $116 = $115 >>> 5;
     $117 = $116 & 8;
     $118 = $117 | $114;
     $119 = $115 >>> $117;
     $120 = $119 >>> 2;
     $121 = $120 & 4;
     $122 = $118 | $121;
     $123 = $119 >>> $121;
     $124 = $123 >>> 1;
     $125 = $124 & 2;
     $126 = $122 | $125;
     $127 = $123 >>> $125;
     $128 = $127 >>> 1;
     $129 = $128 & 1;
     $130 = $126 | $129;
     $131 = $127 >>> $129;
     $132 = (($130) + ($131))|0;
     $133 = (20112 + ($132<<2)|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = ((($134)) + 4|0);
     $136 = HEAP32[$135>>2]|0;
     $137 = $136 & -8;
     $138 = (($137) - ($6))|0;
     $$0189$i = $134;$$0190$i = $134;$$0191$i = $138;
     while(1) {
      $139 = ((($$0189$i)) + 16|0);
      $140 = HEAP32[$139>>2]|0;
      $141 = ($140|0)==(0|0);
      if ($141) {
       $142 = ((($$0189$i)) + 20|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        break;
       } else {
        $146 = $143;
       }
      } else {
       $146 = $140;
      }
      $145 = ((($146)) + 4|0);
      $147 = HEAP32[$145>>2]|0;
      $148 = $147 & -8;
      $149 = (($148) - ($6))|0;
      $150 = ($149>>>0)<($$0191$i>>>0);
      $$$0191$i = $150 ? $149 : $$0191$i;
      $$$0190$i = $150 ? $146 : $$0190$i;
      $$0189$i = $146;$$0190$i = $$$0190$i;$$0191$i = $$$0191$i;
     }
     $151 = HEAP32[(19824)>>2]|0;
     $152 = ($$0190$i>>>0)<($151>>>0);
     if ($152) {
      _abort();
      // unreachable;
     }
     $153 = (($$0190$i) + ($6)|0);
     $154 = ($$0190$i>>>0)<($153>>>0);
     if (!($154)) {
      _abort();
      // unreachable;
     }
     $155 = ((($$0190$i)) + 24|0);
     $156 = HEAP32[$155>>2]|0;
     $157 = ((($$0190$i)) + 12|0);
     $158 = HEAP32[$157>>2]|0;
     $159 = ($158|0)==($$0190$i|0);
     do {
      if ($159) {
       $169 = ((($$0190$i)) + 20|0);
       $170 = HEAP32[$169>>2]|0;
       $171 = ($170|0)==(0|0);
       if ($171) {
        $172 = ((($$0190$i)) + 16|0);
        $173 = HEAP32[$172>>2]|0;
        $174 = ($173|0)==(0|0);
        if ($174) {
         $$3$i = 0;
         break;
        } else {
         $$1194$i = $173;$$1196$i = $172;
        }
       } else {
        $$1194$i = $170;$$1196$i = $169;
       }
       while(1) {
        $175 = ((($$1194$i)) + 20|0);
        $176 = HEAP32[$175>>2]|0;
        $177 = ($176|0)==(0|0);
        if (!($177)) {
         $$1194$i = $176;$$1196$i = $175;
         continue;
        }
        $178 = ((($$1194$i)) + 16|0);
        $179 = HEAP32[$178>>2]|0;
        $180 = ($179|0)==(0|0);
        if ($180) {
         break;
        } else {
         $$1194$i = $179;$$1196$i = $178;
        }
       }
       $181 = ($$1196$i>>>0)<($151>>>0);
       if ($181) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$1196$i>>2] = 0;
        $$3$i = $$1194$i;
        break;
       }
      } else {
       $160 = ((($$0190$i)) + 8|0);
       $161 = HEAP32[$160>>2]|0;
       $162 = ($161>>>0)<($151>>>0);
       if ($162) {
        _abort();
        // unreachable;
       }
       $163 = ((($161)) + 12|0);
       $164 = HEAP32[$163>>2]|0;
       $165 = ($164|0)==($$0190$i|0);
       if (!($165)) {
        _abort();
        // unreachable;
       }
       $166 = ((($158)) + 8|0);
       $167 = HEAP32[$166>>2]|0;
       $168 = ($167|0)==($$0190$i|0);
       if ($168) {
        HEAP32[$163>>2] = $158;
        HEAP32[$166>>2] = $161;
        $$3$i = $158;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $182 = ($156|0)==(0|0);
     do {
      if (!($182)) {
       $183 = ((($$0190$i)) + 28|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = (20112 + ($184<<2)|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($$0190$i|0)==($186|0);
       if ($187) {
        HEAP32[$185>>2] = $$3$i;
        $cond$i = ($$3$i|0)==(0|0);
        if ($cond$i) {
         $188 = 1 << $184;
         $189 = $188 ^ -1;
         $190 = $108 & $189;
         HEAP32[(19812)>>2] = $190;
         break;
        }
       } else {
        $191 = HEAP32[(19824)>>2]|0;
        $192 = ($156>>>0)<($191>>>0);
        if ($192) {
         _abort();
         // unreachable;
        }
        $193 = ((($156)) + 16|0);
        $194 = HEAP32[$193>>2]|0;
        $195 = ($194|0)==($$0190$i|0);
        if ($195) {
         HEAP32[$193>>2] = $$3$i;
        } else {
         $196 = ((($156)) + 20|0);
         HEAP32[$196>>2] = $$3$i;
        }
        $197 = ($$3$i|0)==(0|0);
        if ($197) {
         break;
        }
       }
       $198 = HEAP32[(19824)>>2]|0;
       $199 = ($$3$i>>>0)<($198>>>0);
       if ($199) {
        _abort();
        // unreachable;
       }
       $200 = ((($$3$i)) + 24|0);
       HEAP32[$200>>2] = $156;
       $201 = ((($$0190$i)) + 16|0);
       $202 = HEAP32[$201>>2]|0;
       $203 = ($202|0)==(0|0);
       do {
        if (!($203)) {
         $204 = ($202>>>0)<($198>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = ((($$3$i)) + 16|0);
          HEAP32[$205>>2] = $202;
          $206 = ((($202)) + 24|0);
          HEAP32[$206>>2] = $$3$i;
          break;
         }
        }
       } while(0);
       $207 = ((($$0190$i)) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[(19824)>>2]|0;
        $211 = ($208>>>0)<($210>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = ((($$3$i)) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = ((($208)) + 24|0);
         HEAP32[$213>>2] = $$3$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($$0191$i>>>0)<(16);
     if ($214) {
      $215 = (($$0191$i) + ($6))|0;
      $216 = $215 | 3;
      $217 = ((($$0190$i)) + 4|0);
      HEAP32[$217>>2] = $216;
      $218 = (($$0190$i) + ($215)|0);
      $219 = ((($218)) + 4|0);
      $220 = HEAP32[$219>>2]|0;
      $221 = $220 | 1;
      HEAP32[$219>>2] = $221;
     } else {
      $222 = $6 | 3;
      $223 = ((($$0190$i)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = $$0191$i | 1;
      $225 = ((($153)) + 4|0);
      HEAP32[$225>>2] = $224;
      $226 = (($153) + ($$0191$i)|0);
      HEAP32[$226>>2] = $$0191$i;
      $227 = ($37|0)==(0);
      if (!($227)) {
       $228 = HEAP32[(19828)>>2]|0;
       $229 = $37 >>> 3;
       $230 = $229 << 1;
       $231 = (19848 + ($230<<2)|0);
       $232 = 1 << $229;
       $233 = $8 & $232;
       $234 = ($233|0)==(0);
       if ($234) {
        $235 = $8 | $232;
        HEAP32[4952] = $235;
        $$pre$i = ((($231)) + 8|0);
        $$0187$i = $231;$$pre$phi$iZ2D = $$pre$i;
       } else {
        $236 = ((($231)) + 8|0);
        $237 = HEAP32[$236>>2]|0;
        $238 = HEAP32[(19824)>>2]|0;
        $239 = ($237>>>0)<($238>>>0);
        if ($239) {
         _abort();
         // unreachable;
        } else {
         $$0187$i = $237;$$pre$phi$iZ2D = $236;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $228;
       $240 = ((($$0187$i)) + 12|0);
       HEAP32[$240>>2] = $228;
       $241 = ((($228)) + 8|0);
       HEAP32[$241>>2] = $$0187$i;
       $242 = ((($228)) + 12|0);
       HEAP32[$242>>2] = $231;
      }
      HEAP32[(19816)>>2] = $$0191$i;
      HEAP32[(19828)>>2] = $153;
     }
     $243 = ((($$0190$i)) + 8|0);
     $$0 = $243;
     STACKTOP = sp;return ($$0|0);
    }
   } else {
    $$0197 = $6;
   }
  } else {
   $244 = ($0>>>0)>(4294967231);
   if ($244) {
    $$0197 = -1;
   } else {
    $245 = (($0) + 11)|0;
    $246 = $245 & -8;
    $247 = HEAP32[(19812)>>2]|0;
    $248 = ($247|0)==(0);
    if ($248) {
     $$0197 = $246;
    } else {
     $249 = (0 - ($246))|0;
     $250 = $245 >>> 8;
     $251 = ($250|0)==(0);
     if ($251) {
      $$0356$i = 0;
     } else {
      $252 = ($246>>>0)>(16777215);
      if ($252) {
       $$0356$i = 31;
      } else {
       $253 = (($250) + 1048320)|0;
       $254 = $253 >>> 16;
       $255 = $254 & 8;
       $256 = $250 << $255;
       $257 = (($256) + 520192)|0;
       $258 = $257 >>> 16;
       $259 = $258 & 4;
       $260 = $259 | $255;
       $261 = $256 << $259;
       $262 = (($261) + 245760)|0;
       $263 = $262 >>> 16;
       $264 = $263 & 2;
       $265 = $260 | $264;
       $266 = (14 - ($265))|0;
       $267 = $261 << $264;
       $268 = $267 >>> 15;
       $269 = (($266) + ($268))|0;
       $270 = $269 << 1;
       $271 = (($269) + 7)|0;
       $272 = $246 >>> $271;
       $273 = $272 & 1;
       $274 = $273 | $270;
       $$0356$i = $274;
      }
     }
     $275 = (20112 + ($$0356$i<<2)|0);
     $276 = HEAP32[$275>>2]|0;
     $277 = ($276|0)==(0|0);
     L123: do {
      if ($277) {
       $$2353$i = 0;$$3$i201 = 0;$$3348$i = $249;
       label = 86;
      } else {
       $278 = ($$0356$i|0)==(31);
       $279 = $$0356$i >>> 1;
       $280 = (25 - ($279))|0;
       $281 = $278 ? 0 : $280;
       $282 = $246 << $281;
       $$0340$i = 0;$$0345$i = $249;$$0351$i = $276;$$0357$i = $282;$$0360$i = 0;
       while(1) {
        $283 = ((($$0351$i)) + 4|0);
        $284 = HEAP32[$283>>2]|0;
        $285 = $284 & -8;
        $286 = (($285) - ($246))|0;
        $287 = ($286>>>0)<($$0345$i>>>0);
        if ($287) {
         $288 = ($286|0)==(0);
         if ($288) {
          $$413$i = $$0351$i;$$434912$i = 0;$$435511$i = $$0351$i;
          label = 90;
          break L123;
         } else {
          $$1341$i = $$0351$i;$$1346$i = $286;
         }
        } else {
         $$1341$i = $$0340$i;$$1346$i = $$0345$i;
        }
        $289 = ((($$0351$i)) + 20|0);
        $290 = HEAP32[$289>>2]|0;
        $291 = $$0357$i >>> 31;
        $292 = (((($$0351$i)) + 16|0) + ($291<<2)|0);
        $293 = HEAP32[$292>>2]|0;
        $294 = ($290|0)==(0|0);
        $295 = ($290|0)==($293|0);
        $or$cond1$i = $294 | $295;
        $$1361$i = $or$cond1$i ? $$0360$i : $290;
        $296 = ($293|0)==(0|0);
        $297 = $296&1;
        $298 = $297 ^ 1;
        $$0357$$i = $$0357$i << $298;
        if ($296) {
         $$2353$i = $$1361$i;$$3$i201 = $$1341$i;$$3348$i = $$1346$i;
         label = 86;
         break;
        } else {
         $$0340$i = $$1341$i;$$0345$i = $$1346$i;$$0351$i = $293;$$0357$i = $$0357$$i;$$0360$i = $$1361$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 86) {
      $299 = ($$2353$i|0)==(0|0);
      $300 = ($$3$i201|0)==(0|0);
      $or$cond$i = $299 & $300;
      if ($or$cond$i) {
       $301 = 2 << $$0356$i;
       $302 = (0 - ($301))|0;
       $303 = $301 | $302;
       $304 = $247 & $303;
       $305 = ($304|0)==(0);
       if ($305) {
        $$0197 = $246;
        break;
       }
       $306 = (0 - ($304))|0;
       $307 = $304 & $306;
       $308 = (($307) + -1)|0;
       $309 = $308 >>> 12;
       $310 = $309 & 16;
       $311 = $308 >>> $310;
       $312 = $311 >>> 5;
       $313 = $312 & 8;
       $314 = $313 | $310;
       $315 = $311 >>> $313;
       $316 = $315 >>> 2;
       $317 = $316 & 4;
       $318 = $314 | $317;
       $319 = $315 >>> $317;
       $320 = $319 >>> 1;
       $321 = $320 & 2;
       $322 = $318 | $321;
       $323 = $319 >>> $321;
       $324 = $323 >>> 1;
       $325 = $324 & 1;
       $326 = $322 | $325;
       $327 = $323 >>> $325;
       $328 = (($326) + ($327))|0;
       $329 = (20112 + ($328<<2)|0);
       $330 = HEAP32[$329>>2]|0;
       $$4355$ph$i = $330;
      } else {
       $$4355$ph$i = $$2353$i;
      }
      $331 = ($$4355$ph$i|0)==(0|0);
      if ($331) {
       $$4$lcssa$i = $$3$i201;$$4349$lcssa$i = $$3348$i;
      } else {
       $$413$i = $$3$i201;$$434912$i = $$3348$i;$$435511$i = $$4355$ph$i;
       label = 90;
      }
     }
     if ((label|0) == 90) {
      while(1) {
       label = 0;
       $332 = ((($$435511$i)) + 4|0);
       $333 = HEAP32[$332>>2]|0;
       $334 = $333 & -8;
       $335 = (($334) - ($246))|0;
       $336 = ($335>>>0)<($$434912$i>>>0);
       $$$4349$i = $336 ? $335 : $$434912$i;
       $$4355$$4$i = $336 ? $$435511$i : $$413$i;
       $337 = ((($$435511$i)) + 16|0);
       $338 = HEAP32[$337>>2]|0;
       $339 = ($338|0)==(0|0);
       if (!($339)) {
        $$413$i = $$4355$$4$i;$$434912$i = $$$4349$i;$$435511$i = $338;
        label = 90;
        continue;
       }
       $340 = ((($$435511$i)) + 20|0);
       $341 = HEAP32[$340>>2]|0;
       $342 = ($341|0)==(0|0);
       if ($342) {
        $$4$lcssa$i = $$4355$$4$i;$$4349$lcssa$i = $$$4349$i;
        break;
       } else {
        $$413$i = $$4355$$4$i;$$434912$i = $$$4349$i;$$435511$i = $341;
        label = 90;
       }
      }
     }
     $343 = ($$4$lcssa$i|0)==(0|0);
     if ($343) {
      $$0197 = $246;
     } else {
      $344 = HEAP32[(19816)>>2]|0;
      $345 = (($344) - ($246))|0;
      $346 = ($$4349$lcssa$i>>>0)<($345>>>0);
      if ($346) {
       $347 = HEAP32[(19824)>>2]|0;
       $348 = ($$4$lcssa$i>>>0)<($347>>>0);
       if ($348) {
        _abort();
        // unreachable;
       }
       $349 = (($$4$lcssa$i) + ($246)|0);
       $350 = ($$4$lcssa$i>>>0)<($349>>>0);
       if (!($350)) {
        _abort();
        // unreachable;
       }
       $351 = ((($$4$lcssa$i)) + 24|0);
       $352 = HEAP32[$351>>2]|0;
       $353 = ((($$4$lcssa$i)) + 12|0);
       $354 = HEAP32[$353>>2]|0;
       $355 = ($354|0)==($$4$lcssa$i|0);
       do {
        if ($355) {
         $365 = ((($$4$lcssa$i)) + 20|0);
         $366 = HEAP32[$365>>2]|0;
         $367 = ($366|0)==(0|0);
         if ($367) {
          $368 = ((($$4$lcssa$i)) + 16|0);
          $369 = HEAP32[$368>>2]|0;
          $370 = ($369|0)==(0|0);
          if ($370) {
           $$3370$i = 0;
           break;
          } else {
           $$1368$i = $369;$$1372$i = $368;
          }
         } else {
          $$1368$i = $366;$$1372$i = $365;
         }
         while(1) {
          $371 = ((($$1368$i)) + 20|0);
          $372 = HEAP32[$371>>2]|0;
          $373 = ($372|0)==(0|0);
          if (!($373)) {
           $$1368$i = $372;$$1372$i = $371;
           continue;
          }
          $374 = ((($$1368$i)) + 16|0);
          $375 = HEAP32[$374>>2]|0;
          $376 = ($375|0)==(0|0);
          if ($376) {
           break;
          } else {
           $$1368$i = $375;$$1372$i = $374;
          }
         }
         $377 = ($$1372$i>>>0)<($347>>>0);
         if ($377) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$1372$i>>2] = 0;
          $$3370$i = $$1368$i;
          break;
         }
        } else {
         $356 = ((($$4$lcssa$i)) + 8|0);
         $357 = HEAP32[$356>>2]|0;
         $358 = ($357>>>0)<($347>>>0);
         if ($358) {
          _abort();
          // unreachable;
         }
         $359 = ((($357)) + 12|0);
         $360 = HEAP32[$359>>2]|0;
         $361 = ($360|0)==($$4$lcssa$i|0);
         if (!($361)) {
          _abort();
          // unreachable;
         }
         $362 = ((($354)) + 8|0);
         $363 = HEAP32[$362>>2]|0;
         $364 = ($363|0)==($$4$lcssa$i|0);
         if ($364) {
          HEAP32[$359>>2] = $354;
          HEAP32[$362>>2] = $357;
          $$3370$i = $354;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $378 = ($352|0)==(0|0);
       do {
        if ($378) {
         $470 = $247;
        } else {
         $379 = ((($$4$lcssa$i)) + 28|0);
         $380 = HEAP32[$379>>2]|0;
         $381 = (20112 + ($380<<2)|0);
         $382 = HEAP32[$381>>2]|0;
         $383 = ($$4$lcssa$i|0)==($382|0);
         if ($383) {
          HEAP32[$381>>2] = $$3370$i;
          $cond$i204 = ($$3370$i|0)==(0|0);
          if ($cond$i204) {
           $384 = 1 << $380;
           $385 = $384 ^ -1;
           $386 = $247 & $385;
           HEAP32[(19812)>>2] = $386;
           $470 = $386;
           break;
          }
         } else {
          $387 = HEAP32[(19824)>>2]|0;
          $388 = ($352>>>0)<($387>>>0);
          if ($388) {
           _abort();
           // unreachable;
          }
          $389 = ((($352)) + 16|0);
          $390 = HEAP32[$389>>2]|0;
          $391 = ($390|0)==($$4$lcssa$i|0);
          if ($391) {
           HEAP32[$389>>2] = $$3370$i;
          } else {
           $392 = ((($352)) + 20|0);
           HEAP32[$392>>2] = $$3370$i;
          }
          $393 = ($$3370$i|0)==(0|0);
          if ($393) {
           $470 = $247;
           break;
          }
         }
         $394 = HEAP32[(19824)>>2]|0;
         $395 = ($$3370$i>>>0)<($394>>>0);
         if ($395) {
          _abort();
          // unreachable;
         }
         $396 = ((($$3370$i)) + 24|0);
         HEAP32[$396>>2] = $352;
         $397 = ((($$4$lcssa$i)) + 16|0);
         $398 = HEAP32[$397>>2]|0;
         $399 = ($398|0)==(0|0);
         do {
          if (!($399)) {
           $400 = ($398>>>0)<($394>>>0);
           if ($400) {
            _abort();
            // unreachable;
           } else {
            $401 = ((($$3370$i)) + 16|0);
            HEAP32[$401>>2] = $398;
            $402 = ((($398)) + 24|0);
            HEAP32[$402>>2] = $$3370$i;
            break;
           }
          }
         } while(0);
         $403 = ((($$4$lcssa$i)) + 20|0);
         $404 = HEAP32[$403>>2]|0;
         $405 = ($404|0)==(0|0);
         if ($405) {
          $470 = $247;
         } else {
          $406 = HEAP32[(19824)>>2]|0;
          $407 = ($404>>>0)<($406>>>0);
          if ($407) {
           _abort();
           // unreachable;
          } else {
           $408 = ((($$3370$i)) + 20|0);
           HEAP32[$408>>2] = $404;
           $409 = ((($404)) + 24|0);
           HEAP32[$409>>2] = $$3370$i;
           $470 = $247;
           break;
          }
         }
        }
       } while(0);
       $410 = ($$4349$lcssa$i>>>0)<(16);
       do {
        if ($410) {
         $411 = (($$4349$lcssa$i) + ($246))|0;
         $412 = $411 | 3;
         $413 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$413>>2] = $412;
         $414 = (($$4$lcssa$i) + ($411)|0);
         $415 = ((($414)) + 4|0);
         $416 = HEAP32[$415>>2]|0;
         $417 = $416 | 1;
         HEAP32[$415>>2] = $417;
        } else {
         $418 = $246 | 3;
         $419 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$419>>2] = $418;
         $420 = $$4349$lcssa$i | 1;
         $421 = ((($349)) + 4|0);
         HEAP32[$421>>2] = $420;
         $422 = (($349) + ($$4349$lcssa$i)|0);
         HEAP32[$422>>2] = $$4349$lcssa$i;
         $423 = $$4349$lcssa$i >>> 3;
         $424 = ($$4349$lcssa$i>>>0)<(256);
         if ($424) {
          $425 = $423 << 1;
          $426 = (19848 + ($425<<2)|0);
          $427 = HEAP32[4952]|0;
          $428 = 1 << $423;
          $429 = $427 & $428;
          $430 = ($429|0)==(0);
          if ($430) {
           $431 = $427 | $428;
           HEAP32[4952] = $431;
           $$pre$i205 = ((($426)) + 8|0);
           $$0366$i = $426;$$pre$phi$i206Z2D = $$pre$i205;
          } else {
           $432 = ((($426)) + 8|0);
           $433 = HEAP32[$432>>2]|0;
           $434 = HEAP32[(19824)>>2]|0;
           $435 = ($433>>>0)<($434>>>0);
           if ($435) {
            _abort();
            // unreachable;
           } else {
            $$0366$i = $433;$$pre$phi$i206Z2D = $432;
           }
          }
          HEAP32[$$pre$phi$i206Z2D>>2] = $349;
          $436 = ((($$0366$i)) + 12|0);
          HEAP32[$436>>2] = $349;
          $437 = ((($349)) + 8|0);
          HEAP32[$437>>2] = $$0366$i;
          $438 = ((($349)) + 12|0);
          HEAP32[$438>>2] = $426;
          break;
         }
         $439 = $$4349$lcssa$i >>> 8;
         $440 = ($439|0)==(0);
         if ($440) {
          $$0359$i = 0;
         } else {
          $441 = ($$4349$lcssa$i>>>0)>(16777215);
          if ($441) {
           $$0359$i = 31;
          } else {
           $442 = (($439) + 1048320)|0;
           $443 = $442 >>> 16;
           $444 = $443 & 8;
           $445 = $439 << $444;
           $446 = (($445) + 520192)|0;
           $447 = $446 >>> 16;
           $448 = $447 & 4;
           $449 = $448 | $444;
           $450 = $445 << $448;
           $451 = (($450) + 245760)|0;
           $452 = $451 >>> 16;
           $453 = $452 & 2;
           $454 = $449 | $453;
           $455 = (14 - ($454))|0;
           $456 = $450 << $453;
           $457 = $456 >>> 15;
           $458 = (($455) + ($457))|0;
           $459 = $458 << 1;
           $460 = (($458) + 7)|0;
           $461 = $$4349$lcssa$i >>> $460;
           $462 = $461 & 1;
           $463 = $462 | $459;
           $$0359$i = $463;
          }
         }
         $464 = (20112 + ($$0359$i<<2)|0);
         $465 = ((($349)) + 28|0);
         HEAP32[$465>>2] = $$0359$i;
         $466 = ((($349)) + 16|0);
         $467 = ((($466)) + 4|0);
         HEAP32[$467>>2] = 0;
         HEAP32[$466>>2] = 0;
         $468 = 1 << $$0359$i;
         $469 = $470 & $468;
         $471 = ($469|0)==(0);
         if ($471) {
          $472 = $470 | $468;
          HEAP32[(19812)>>2] = $472;
          HEAP32[$464>>2] = $349;
          $473 = ((($349)) + 24|0);
          HEAP32[$473>>2] = $464;
          $474 = ((($349)) + 12|0);
          HEAP32[$474>>2] = $349;
          $475 = ((($349)) + 8|0);
          HEAP32[$475>>2] = $349;
          break;
         }
         $476 = HEAP32[$464>>2]|0;
         $477 = ($$0359$i|0)==(31);
         $478 = $$0359$i >>> 1;
         $479 = (25 - ($478))|0;
         $480 = $477 ? 0 : $479;
         $481 = $$4349$lcssa$i << $480;
         $$0342$i = $481;$$0343$i = $476;
         while(1) {
          $482 = ((($$0343$i)) + 4|0);
          $483 = HEAP32[$482>>2]|0;
          $484 = $483 & -8;
          $485 = ($484|0)==($$4349$lcssa$i|0);
          if ($485) {
           label = 148;
           break;
          }
          $486 = $$0342$i >>> 31;
          $487 = (((($$0343$i)) + 16|0) + ($486<<2)|0);
          $488 = $$0342$i << 1;
          $489 = HEAP32[$487>>2]|0;
          $490 = ($489|0)==(0|0);
          if ($490) {
           label = 145;
           break;
          } else {
           $$0342$i = $488;$$0343$i = $489;
          }
         }
         if ((label|0) == 145) {
          $491 = HEAP32[(19824)>>2]|0;
          $492 = ($487>>>0)<($491>>>0);
          if ($492) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$487>>2] = $349;
           $493 = ((($349)) + 24|0);
           HEAP32[$493>>2] = $$0343$i;
           $494 = ((($349)) + 12|0);
           HEAP32[$494>>2] = $349;
           $495 = ((($349)) + 8|0);
           HEAP32[$495>>2] = $349;
           break;
          }
         }
         else if ((label|0) == 148) {
          $496 = ((($$0343$i)) + 8|0);
          $497 = HEAP32[$496>>2]|0;
          $498 = HEAP32[(19824)>>2]|0;
          $499 = ($497>>>0)>=($498>>>0);
          $not$7$i = ($$0343$i>>>0)>=($498>>>0);
          $500 = $499 & $not$7$i;
          if ($500) {
           $501 = ((($497)) + 12|0);
           HEAP32[$501>>2] = $349;
           HEAP32[$496>>2] = $349;
           $502 = ((($349)) + 8|0);
           HEAP32[$502>>2] = $497;
           $503 = ((($349)) + 12|0);
           HEAP32[$503>>2] = $$0343$i;
           $504 = ((($349)) + 24|0);
           HEAP32[$504>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $505 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $505;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0197 = $246;
      }
     }
    }
   }
  }
 } while(0);
 $506 = HEAP32[(19816)>>2]|0;
 $507 = ($506>>>0)<($$0197>>>0);
 if (!($507)) {
  $508 = (($506) - ($$0197))|0;
  $509 = HEAP32[(19828)>>2]|0;
  $510 = ($508>>>0)>(15);
  if ($510) {
   $511 = (($509) + ($$0197)|0);
   HEAP32[(19828)>>2] = $511;
   HEAP32[(19816)>>2] = $508;
   $512 = $508 | 1;
   $513 = ((($511)) + 4|0);
   HEAP32[$513>>2] = $512;
   $514 = (($511) + ($508)|0);
   HEAP32[$514>>2] = $508;
   $515 = $$0197 | 3;
   $516 = ((($509)) + 4|0);
   HEAP32[$516>>2] = $515;
  } else {
   HEAP32[(19816)>>2] = 0;
   HEAP32[(19828)>>2] = 0;
   $517 = $506 | 3;
   $518 = ((($509)) + 4|0);
   HEAP32[$518>>2] = $517;
   $519 = (($509) + ($506)|0);
   $520 = ((($519)) + 4|0);
   $521 = HEAP32[$520>>2]|0;
   $522 = $521 | 1;
   HEAP32[$520>>2] = $522;
  }
  $523 = ((($509)) + 8|0);
  $$0 = $523;
  STACKTOP = sp;return ($$0|0);
 }
 $524 = HEAP32[(19820)>>2]|0;
 $525 = ($524>>>0)>($$0197>>>0);
 if ($525) {
  $526 = (($524) - ($$0197))|0;
  HEAP32[(19820)>>2] = $526;
  $527 = HEAP32[(19832)>>2]|0;
  $528 = (($527) + ($$0197)|0);
  HEAP32[(19832)>>2] = $528;
  $529 = $526 | 1;
  $530 = ((($528)) + 4|0);
  HEAP32[$530>>2] = $529;
  $531 = $$0197 | 3;
  $532 = ((($527)) + 4|0);
  HEAP32[$532>>2] = $531;
  $533 = ((($527)) + 8|0);
  $$0 = $533;
  STACKTOP = sp;return ($$0|0);
 }
 $534 = HEAP32[5070]|0;
 $535 = ($534|0)==(0);
 if ($535) {
  HEAP32[(20288)>>2] = 4096;
  HEAP32[(20284)>>2] = 4096;
  HEAP32[(20292)>>2] = -1;
  HEAP32[(20296)>>2] = -1;
  HEAP32[(20300)>>2] = 0;
  HEAP32[(20252)>>2] = 0;
  $536 = $1;
  $537 = $536 & -16;
  $538 = $537 ^ 1431655768;
  HEAP32[$1>>2] = $538;
  HEAP32[5070] = $538;
  $542 = 4096;
 } else {
  $$pre$i208 = HEAP32[(20288)>>2]|0;
  $542 = $$pre$i208;
 }
 $539 = (($$0197) + 48)|0;
 $540 = (($$0197) + 47)|0;
 $541 = (($542) + ($540))|0;
 $543 = (0 - ($542))|0;
 $544 = $541 & $543;
 $545 = ($544>>>0)>($$0197>>>0);
 if (!($545)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $546 = HEAP32[(20248)>>2]|0;
 $547 = ($546|0)==(0);
 if (!($547)) {
  $548 = HEAP32[(20240)>>2]|0;
  $549 = (($548) + ($544))|0;
  $550 = ($549>>>0)<=($548>>>0);
  $551 = ($549>>>0)>($546>>>0);
  $or$cond1$i210 = $550 | $551;
  if ($or$cond1$i210) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $552 = HEAP32[(20252)>>2]|0;
 $553 = $552 & 4;
 $554 = ($553|0)==(0);
 L255: do {
  if ($554) {
   $555 = HEAP32[(19832)>>2]|0;
   $556 = ($555|0)==(0|0);
   L257: do {
    if ($556) {
     label = 172;
    } else {
     $$0$i17$i = (20256);
     while(1) {
      $557 = HEAP32[$$0$i17$i>>2]|0;
      $558 = ($557>>>0)>($555>>>0);
      if (!($558)) {
       $559 = ((($$0$i17$i)) + 4|0);
       $560 = HEAP32[$559>>2]|0;
       $561 = (($557) + ($560)|0);
       $562 = ($561>>>0)>($555>>>0);
       if ($562) {
        break;
       }
      }
      $563 = ((($$0$i17$i)) + 8|0);
      $564 = HEAP32[$563>>2]|0;
      $565 = ($564|0)==(0|0);
      if ($565) {
       label = 172;
       break L257;
      } else {
       $$0$i17$i = $564;
      }
     }
     $588 = (($541) - ($524))|0;
     $589 = $588 & $543;
     $590 = ($589>>>0)<(2147483647);
     if ($590) {
      $591 = (_sbrk(($589|0))|0);
      $592 = HEAP32[$$0$i17$i>>2]|0;
      $593 = HEAP32[$559>>2]|0;
      $594 = (($592) + ($593)|0);
      $595 = ($591|0)==($594|0);
      if ($595) {
       $596 = ($591|0)==((-1)|0);
       if (!($596)) {
        $$723947$i = $589;$$748$i = $591;
        label = 190;
        break L255;
       }
      } else {
       $$2247$ph$i = $591;$$2253$ph$i = $589;
       label = 180;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 172) {
     $566 = (_sbrk(0)|0);
     $567 = ($566|0)==((-1)|0);
     if (!($567)) {
      $568 = $566;
      $569 = HEAP32[(20284)>>2]|0;
      $570 = (($569) + -1)|0;
      $571 = $570 & $568;
      $572 = ($571|0)==(0);
      $573 = (($570) + ($568))|0;
      $574 = (0 - ($569))|0;
      $575 = $573 & $574;
      $576 = (($575) - ($568))|0;
      $577 = $572 ? 0 : $576;
      $$$i = (($577) + ($544))|0;
      $578 = HEAP32[(20240)>>2]|0;
      $579 = (($$$i) + ($578))|0;
      $580 = ($$$i>>>0)>($$0197>>>0);
      $581 = ($$$i>>>0)<(2147483647);
      $or$cond$i211 = $580 & $581;
      if ($or$cond$i211) {
       $582 = HEAP32[(20248)>>2]|0;
       $583 = ($582|0)==(0);
       if (!($583)) {
        $584 = ($579>>>0)<=($578>>>0);
        $585 = ($579>>>0)>($582>>>0);
        $or$cond2$i = $584 | $585;
        if ($or$cond2$i) {
         break;
        }
       }
       $586 = (_sbrk(($$$i|0))|0);
       $587 = ($586|0)==($566|0);
       if ($587) {
        $$723947$i = $$$i;$$748$i = $566;
        label = 190;
        break L255;
       } else {
        $$2247$ph$i = $586;$$2253$ph$i = $$$i;
        label = 180;
       }
      }
     }
    }
   } while(0);
   L274: do {
    if ((label|0) == 180) {
     $597 = (0 - ($$2253$ph$i))|0;
     $598 = ($$2247$ph$i|0)!=((-1)|0);
     $599 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $599 & $598;
     $600 = ($539>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $600 & $or$cond7$i;
     do {
      if ($or$cond10$i) {
       $601 = HEAP32[(20288)>>2]|0;
       $602 = (($540) - ($$2253$ph$i))|0;
       $603 = (($602) + ($601))|0;
       $604 = (0 - ($601))|0;
       $605 = $603 & $604;
       $606 = ($605>>>0)<(2147483647);
       if ($606) {
        $607 = (_sbrk(($605|0))|0);
        $608 = ($607|0)==((-1)|0);
        if ($608) {
         (_sbrk(($597|0))|0);
         break L274;
        } else {
         $609 = (($605) + ($$2253$ph$i))|0;
         $$5256$i = $609;
         break;
        }
       } else {
        $$5256$i = $$2253$ph$i;
       }
      } else {
       $$5256$i = $$2253$ph$i;
      }
     } while(0);
     $610 = ($$2247$ph$i|0)==((-1)|0);
     if (!($610)) {
      $$723947$i = $$5256$i;$$748$i = $$2247$ph$i;
      label = 190;
      break L255;
     }
    }
   } while(0);
   $611 = HEAP32[(20252)>>2]|0;
   $612 = $611 | 4;
   HEAP32[(20252)>>2] = $612;
   label = 187;
  } else {
   label = 187;
  }
 } while(0);
 if ((label|0) == 187) {
  $613 = ($544>>>0)<(2147483647);
  if ($613) {
   $614 = (_sbrk(($544|0))|0);
   $615 = (_sbrk(0)|0);
   $616 = ($614|0)!=((-1)|0);
   $617 = ($615|0)!=((-1)|0);
   $or$cond5$i = $616 & $617;
   $618 = ($614>>>0)<($615>>>0);
   $or$cond11$i = $618 & $or$cond5$i;
   if ($or$cond11$i) {
    $619 = $615;
    $620 = $614;
    $621 = (($619) - ($620))|0;
    $622 = (($$0197) + 40)|0;
    $$not$i = ($621>>>0)>($622>>>0);
    if ($$not$i) {
     $$723947$i = $621;$$748$i = $614;
     label = 190;
    }
   }
  }
 }
 if ((label|0) == 190) {
  $623 = HEAP32[(20240)>>2]|0;
  $624 = (($623) + ($$723947$i))|0;
  HEAP32[(20240)>>2] = $624;
  $625 = HEAP32[(20244)>>2]|0;
  $626 = ($624>>>0)>($625>>>0);
  if ($626) {
   HEAP32[(20244)>>2] = $624;
  }
  $627 = HEAP32[(19832)>>2]|0;
  $628 = ($627|0)==(0|0);
  do {
   if ($628) {
    $629 = HEAP32[(19824)>>2]|0;
    $630 = ($629|0)==(0|0);
    $631 = ($$748$i>>>0)<($629>>>0);
    $or$cond12$i = $630 | $631;
    if ($or$cond12$i) {
     HEAP32[(19824)>>2] = $$748$i;
    }
    HEAP32[(20256)>>2] = $$748$i;
    HEAP32[(20260)>>2] = $$723947$i;
    HEAP32[(20268)>>2] = 0;
    $632 = HEAP32[5070]|0;
    HEAP32[(19844)>>2] = $632;
    HEAP32[(19840)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $633 = $$01$i$i << 1;
     $634 = (19848 + ($633<<2)|0);
     $635 = ((($634)) + 12|0);
     HEAP32[$635>>2] = $634;
     $636 = ((($634)) + 8|0);
     HEAP32[$636>>2] = $634;
     $637 = (($$01$i$i) + 1)|0;
     $exitcond$i$i = ($637|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $$01$i$i = $637;
     }
    }
    $638 = (($$723947$i) + -40)|0;
    $639 = ((($$748$i)) + 8|0);
    $640 = $639;
    $641 = $640 & 7;
    $642 = ($641|0)==(0);
    $643 = (0 - ($640))|0;
    $644 = $643 & 7;
    $645 = $642 ? 0 : $644;
    $646 = (($$748$i) + ($645)|0);
    $647 = (($638) - ($645))|0;
    HEAP32[(19832)>>2] = $646;
    HEAP32[(19820)>>2] = $647;
    $648 = $647 | 1;
    $649 = ((($646)) + 4|0);
    HEAP32[$649>>2] = $648;
    $650 = (($646) + ($647)|0);
    $651 = ((($650)) + 4|0);
    HEAP32[$651>>2] = 40;
    $652 = HEAP32[(20296)>>2]|0;
    HEAP32[(19836)>>2] = $652;
   } else {
    $$024370$i = (20256);
    while(1) {
     $653 = HEAP32[$$024370$i>>2]|0;
     $654 = ((($$024370$i)) + 4|0);
     $655 = HEAP32[$654>>2]|0;
     $656 = (($653) + ($655)|0);
     $657 = ($$748$i|0)==($656|0);
     if ($657) {
      label = 200;
      break;
     }
     $658 = ((($$024370$i)) + 8|0);
     $659 = HEAP32[$658>>2]|0;
     $660 = ($659|0)==(0|0);
     if ($660) {
      break;
     } else {
      $$024370$i = $659;
     }
    }
    if ((label|0) == 200) {
     $661 = ((($$024370$i)) + 12|0);
     $662 = HEAP32[$661>>2]|0;
     $663 = $662 & 8;
     $664 = ($663|0)==(0);
     if ($664) {
      $665 = ($627>>>0)>=($653>>>0);
      $666 = ($627>>>0)<($$748$i>>>0);
      $or$cond50$i = $666 & $665;
      if ($or$cond50$i) {
       $667 = (($655) + ($$723947$i))|0;
       HEAP32[$654>>2] = $667;
       $668 = HEAP32[(19820)>>2]|0;
       $669 = ((($627)) + 8|0);
       $670 = $669;
       $671 = $670 & 7;
       $672 = ($671|0)==(0);
       $673 = (0 - ($670))|0;
       $674 = $673 & 7;
       $675 = $672 ? 0 : $674;
       $676 = (($627) + ($675)|0);
       $677 = (($$723947$i) - ($675))|0;
       $678 = (($677) + ($668))|0;
       HEAP32[(19832)>>2] = $676;
       HEAP32[(19820)>>2] = $678;
       $679 = $678 | 1;
       $680 = ((($676)) + 4|0);
       HEAP32[$680>>2] = $679;
       $681 = (($676) + ($678)|0);
       $682 = ((($681)) + 4|0);
       HEAP32[$682>>2] = 40;
       $683 = HEAP32[(20296)>>2]|0;
       HEAP32[(19836)>>2] = $683;
       break;
      }
     }
    }
    $684 = HEAP32[(19824)>>2]|0;
    $685 = ($$748$i>>>0)<($684>>>0);
    if ($685) {
     HEAP32[(19824)>>2] = $$748$i;
     $749 = $$748$i;
    } else {
     $749 = $684;
    }
    $686 = (($$748$i) + ($$723947$i)|0);
    $$124469$i = (20256);
    while(1) {
     $687 = HEAP32[$$124469$i>>2]|0;
     $688 = ($687|0)==($686|0);
     if ($688) {
      label = 208;
      break;
     }
     $689 = ((($$124469$i)) + 8|0);
     $690 = HEAP32[$689>>2]|0;
     $691 = ($690|0)==(0|0);
     if ($691) {
      $$0$i$i$i = (20256);
      break;
     } else {
      $$124469$i = $690;
     }
    }
    if ((label|0) == 208) {
     $692 = ((($$124469$i)) + 12|0);
     $693 = HEAP32[$692>>2]|0;
     $694 = $693 & 8;
     $695 = ($694|0)==(0);
     if ($695) {
      HEAP32[$$124469$i>>2] = $$748$i;
      $696 = ((($$124469$i)) + 4|0);
      $697 = HEAP32[$696>>2]|0;
      $698 = (($697) + ($$723947$i))|0;
      HEAP32[$696>>2] = $698;
      $699 = ((($$748$i)) + 8|0);
      $700 = $699;
      $701 = $700 & 7;
      $702 = ($701|0)==(0);
      $703 = (0 - ($700))|0;
      $704 = $703 & 7;
      $705 = $702 ? 0 : $704;
      $706 = (($$748$i) + ($705)|0);
      $707 = ((($686)) + 8|0);
      $708 = $707;
      $709 = $708 & 7;
      $710 = ($709|0)==(0);
      $711 = (0 - ($708))|0;
      $712 = $711 & 7;
      $713 = $710 ? 0 : $712;
      $714 = (($686) + ($713)|0);
      $715 = $714;
      $716 = $706;
      $717 = (($715) - ($716))|0;
      $718 = (($706) + ($$0197)|0);
      $719 = (($717) - ($$0197))|0;
      $720 = $$0197 | 3;
      $721 = ((($706)) + 4|0);
      HEAP32[$721>>2] = $720;
      $722 = ($714|0)==($627|0);
      do {
       if ($722) {
        $723 = HEAP32[(19820)>>2]|0;
        $724 = (($723) + ($719))|0;
        HEAP32[(19820)>>2] = $724;
        HEAP32[(19832)>>2] = $718;
        $725 = $724 | 1;
        $726 = ((($718)) + 4|0);
        HEAP32[$726>>2] = $725;
       } else {
        $727 = HEAP32[(19828)>>2]|0;
        $728 = ($714|0)==($727|0);
        if ($728) {
         $729 = HEAP32[(19816)>>2]|0;
         $730 = (($729) + ($719))|0;
         HEAP32[(19816)>>2] = $730;
         HEAP32[(19828)>>2] = $718;
         $731 = $730 | 1;
         $732 = ((($718)) + 4|0);
         HEAP32[$732>>2] = $731;
         $733 = (($718) + ($730)|0);
         HEAP32[$733>>2] = $730;
         break;
        }
        $734 = ((($714)) + 4|0);
        $735 = HEAP32[$734>>2]|0;
        $736 = $735 & 3;
        $737 = ($736|0)==(1);
        if ($737) {
         $738 = $735 & -8;
         $739 = $735 >>> 3;
         $740 = ($735>>>0)<(256);
         L326: do {
          if ($740) {
           $741 = ((($714)) + 8|0);
           $742 = HEAP32[$741>>2]|0;
           $743 = ((($714)) + 12|0);
           $744 = HEAP32[$743>>2]|0;
           $745 = $739 << 1;
           $746 = (19848 + ($745<<2)|0);
           $747 = ($742|0)==($746|0);
           do {
            if (!($747)) {
             $748 = ($742>>>0)<($749>>>0);
             if ($748) {
              _abort();
              // unreachable;
             }
             $750 = ((($742)) + 12|0);
             $751 = HEAP32[$750>>2]|0;
             $752 = ($751|0)==($714|0);
             if ($752) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $753 = ($744|0)==($742|0);
           if ($753) {
            $754 = 1 << $739;
            $755 = $754 ^ -1;
            $756 = HEAP32[4952]|0;
            $757 = $756 & $755;
            HEAP32[4952] = $757;
            break;
           }
           $758 = ($744|0)==($746|0);
           do {
            if ($758) {
             $$pre9$i$i = ((($744)) + 8|0);
             $$pre$phi10$i$iZ2D = $$pre9$i$i;
            } else {
             $759 = ($744>>>0)<($749>>>0);
             if ($759) {
              _abort();
              // unreachable;
             }
             $760 = ((($744)) + 8|0);
             $761 = HEAP32[$760>>2]|0;
             $762 = ($761|0)==($714|0);
             if ($762) {
              $$pre$phi10$i$iZ2D = $760;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $763 = ((($742)) + 12|0);
           HEAP32[$763>>2] = $744;
           HEAP32[$$pre$phi10$i$iZ2D>>2] = $742;
          } else {
           $764 = ((($714)) + 24|0);
           $765 = HEAP32[$764>>2]|0;
           $766 = ((($714)) + 12|0);
           $767 = HEAP32[$766>>2]|0;
           $768 = ($767|0)==($714|0);
           do {
            if ($768) {
             $778 = ((($714)) + 16|0);
             $779 = ((($778)) + 4|0);
             $780 = HEAP32[$779>>2]|0;
             $781 = ($780|0)==(0|0);
             if ($781) {
              $782 = HEAP32[$778>>2]|0;
              $783 = ($782|0)==(0|0);
              if ($783) {
               $$3$i$i = 0;
               break;
              } else {
               $$1290$i$i = $782;$$1292$i$i = $778;
              }
             } else {
              $$1290$i$i = $780;$$1292$i$i = $779;
             }
             while(1) {
              $784 = ((($$1290$i$i)) + 20|0);
              $785 = HEAP32[$784>>2]|0;
              $786 = ($785|0)==(0|0);
              if (!($786)) {
               $$1290$i$i = $785;$$1292$i$i = $784;
               continue;
              }
              $787 = ((($$1290$i$i)) + 16|0);
              $788 = HEAP32[$787>>2]|0;
              $789 = ($788|0)==(0|0);
              if ($789) {
               break;
              } else {
               $$1290$i$i = $788;$$1292$i$i = $787;
              }
             }
             $790 = ($$1292$i$i>>>0)<($749>>>0);
             if ($790) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$$1292$i$i>>2] = 0;
              $$3$i$i = $$1290$i$i;
              break;
             }
            } else {
             $769 = ((($714)) + 8|0);
             $770 = HEAP32[$769>>2]|0;
             $771 = ($770>>>0)<($749>>>0);
             if ($771) {
              _abort();
              // unreachable;
             }
             $772 = ((($770)) + 12|0);
             $773 = HEAP32[$772>>2]|0;
             $774 = ($773|0)==($714|0);
             if (!($774)) {
              _abort();
              // unreachable;
             }
             $775 = ((($767)) + 8|0);
             $776 = HEAP32[$775>>2]|0;
             $777 = ($776|0)==($714|0);
             if ($777) {
              HEAP32[$772>>2] = $767;
              HEAP32[$775>>2] = $770;
              $$3$i$i = $767;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $791 = ($765|0)==(0|0);
           if ($791) {
            break;
           }
           $792 = ((($714)) + 28|0);
           $793 = HEAP32[$792>>2]|0;
           $794 = (20112 + ($793<<2)|0);
           $795 = HEAP32[$794>>2]|0;
           $796 = ($714|0)==($795|0);
           do {
            if ($796) {
             HEAP32[$794>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $797 = 1 << $793;
             $798 = $797 ^ -1;
             $799 = HEAP32[(19812)>>2]|0;
             $800 = $799 & $798;
             HEAP32[(19812)>>2] = $800;
             break L326;
            } else {
             $801 = HEAP32[(19824)>>2]|0;
             $802 = ($765>>>0)<($801>>>0);
             if ($802) {
              _abort();
              // unreachable;
             }
             $803 = ((($765)) + 16|0);
             $804 = HEAP32[$803>>2]|0;
             $805 = ($804|0)==($714|0);
             if ($805) {
              HEAP32[$803>>2] = $$3$i$i;
             } else {
              $806 = ((($765)) + 20|0);
              HEAP32[$806>>2] = $$3$i$i;
             }
             $807 = ($$3$i$i|0)==(0|0);
             if ($807) {
              break L326;
             }
            }
           } while(0);
           $808 = HEAP32[(19824)>>2]|0;
           $809 = ($$3$i$i>>>0)<($808>>>0);
           if ($809) {
            _abort();
            // unreachable;
           }
           $810 = ((($$3$i$i)) + 24|0);
           HEAP32[$810>>2] = $765;
           $811 = ((($714)) + 16|0);
           $812 = HEAP32[$811>>2]|0;
           $813 = ($812|0)==(0|0);
           do {
            if (!($813)) {
             $814 = ($812>>>0)<($808>>>0);
             if ($814) {
              _abort();
              // unreachable;
             } else {
              $815 = ((($$3$i$i)) + 16|0);
              HEAP32[$815>>2] = $812;
              $816 = ((($812)) + 24|0);
              HEAP32[$816>>2] = $$3$i$i;
              break;
             }
            }
           } while(0);
           $817 = ((($811)) + 4|0);
           $818 = HEAP32[$817>>2]|0;
           $819 = ($818|0)==(0|0);
           if ($819) {
            break;
           }
           $820 = HEAP32[(19824)>>2]|0;
           $821 = ($818>>>0)<($820>>>0);
           if ($821) {
            _abort();
            // unreachable;
           } else {
            $822 = ((($$3$i$i)) + 20|0);
            HEAP32[$822>>2] = $818;
            $823 = ((($818)) + 24|0);
            HEAP32[$823>>2] = $$3$i$i;
            break;
           }
          }
         } while(0);
         $824 = (($714) + ($738)|0);
         $825 = (($738) + ($719))|0;
         $$0$i18$i = $824;$$0286$i$i = $825;
        } else {
         $$0$i18$i = $714;$$0286$i$i = $719;
        }
        $826 = ((($$0$i18$i)) + 4|0);
        $827 = HEAP32[$826>>2]|0;
        $828 = $827 & -2;
        HEAP32[$826>>2] = $828;
        $829 = $$0286$i$i | 1;
        $830 = ((($718)) + 4|0);
        HEAP32[$830>>2] = $829;
        $831 = (($718) + ($$0286$i$i)|0);
        HEAP32[$831>>2] = $$0286$i$i;
        $832 = $$0286$i$i >>> 3;
        $833 = ($$0286$i$i>>>0)<(256);
        if ($833) {
         $834 = $832 << 1;
         $835 = (19848 + ($834<<2)|0);
         $836 = HEAP32[4952]|0;
         $837 = 1 << $832;
         $838 = $836 & $837;
         $839 = ($838|0)==(0);
         do {
          if ($839) {
           $840 = $836 | $837;
           HEAP32[4952] = $840;
           $$pre$i19$i = ((($835)) + 8|0);
           $$0294$i$i = $835;$$pre$phi$i20$iZ2D = $$pre$i19$i;
          } else {
           $841 = ((($835)) + 8|0);
           $842 = HEAP32[$841>>2]|0;
           $843 = HEAP32[(19824)>>2]|0;
           $844 = ($842>>>0)<($843>>>0);
           if (!($844)) {
            $$0294$i$i = $842;$$pre$phi$i20$iZ2D = $841;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i20$iZ2D>>2] = $718;
         $845 = ((($$0294$i$i)) + 12|0);
         HEAP32[$845>>2] = $718;
         $846 = ((($718)) + 8|0);
         HEAP32[$846>>2] = $$0294$i$i;
         $847 = ((($718)) + 12|0);
         HEAP32[$847>>2] = $835;
         break;
        }
        $848 = $$0286$i$i >>> 8;
        $849 = ($848|0)==(0);
        do {
         if ($849) {
          $$0295$i$i = 0;
         } else {
          $850 = ($$0286$i$i>>>0)>(16777215);
          if ($850) {
           $$0295$i$i = 31;
           break;
          }
          $851 = (($848) + 1048320)|0;
          $852 = $851 >>> 16;
          $853 = $852 & 8;
          $854 = $848 << $853;
          $855 = (($854) + 520192)|0;
          $856 = $855 >>> 16;
          $857 = $856 & 4;
          $858 = $857 | $853;
          $859 = $854 << $857;
          $860 = (($859) + 245760)|0;
          $861 = $860 >>> 16;
          $862 = $861 & 2;
          $863 = $858 | $862;
          $864 = (14 - ($863))|0;
          $865 = $859 << $862;
          $866 = $865 >>> 15;
          $867 = (($864) + ($866))|0;
          $868 = $867 << 1;
          $869 = (($867) + 7)|0;
          $870 = $$0286$i$i >>> $869;
          $871 = $870 & 1;
          $872 = $871 | $868;
          $$0295$i$i = $872;
         }
        } while(0);
        $873 = (20112 + ($$0295$i$i<<2)|0);
        $874 = ((($718)) + 28|0);
        HEAP32[$874>>2] = $$0295$i$i;
        $875 = ((($718)) + 16|0);
        $876 = ((($875)) + 4|0);
        HEAP32[$876>>2] = 0;
        HEAP32[$875>>2] = 0;
        $877 = HEAP32[(19812)>>2]|0;
        $878 = 1 << $$0295$i$i;
        $879 = $877 & $878;
        $880 = ($879|0)==(0);
        if ($880) {
         $881 = $877 | $878;
         HEAP32[(19812)>>2] = $881;
         HEAP32[$873>>2] = $718;
         $882 = ((($718)) + 24|0);
         HEAP32[$882>>2] = $873;
         $883 = ((($718)) + 12|0);
         HEAP32[$883>>2] = $718;
         $884 = ((($718)) + 8|0);
         HEAP32[$884>>2] = $718;
         break;
        }
        $885 = HEAP32[$873>>2]|0;
        $886 = ($$0295$i$i|0)==(31);
        $887 = $$0295$i$i >>> 1;
        $888 = (25 - ($887))|0;
        $889 = $886 ? 0 : $888;
        $890 = $$0286$i$i << $889;
        $$0287$i$i = $890;$$0288$i$i = $885;
        while(1) {
         $891 = ((($$0288$i$i)) + 4|0);
         $892 = HEAP32[$891>>2]|0;
         $893 = $892 & -8;
         $894 = ($893|0)==($$0286$i$i|0);
         if ($894) {
          label = 278;
          break;
         }
         $895 = $$0287$i$i >>> 31;
         $896 = (((($$0288$i$i)) + 16|0) + ($895<<2)|0);
         $897 = $$0287$i$i << 1;
         $898 = HEAP32[$896>>2]|0;
         $899 = ($898|0)==(0|0);
         if ($899) {
          label = 275;
          break;
         } else {
          $$0287$i$i = $897;$$0288$i$i = $898;
         }
        }
        if ((label|0) == 275) {
         $900 = HEAP32[(19824)>>2]|0;
         $901 = ($896>>>0)<($900>>>0);
         if ($901) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$896>>2] = $718;
          $902 = ((($718)) + 24|0);
          HEAP32[$902>>2] = $$0288$i$i;
          $903 = ((($718)) + 12|0);
          HEAP32[$903>>2] = $718;
          $904 = ((($718)) + 8|0);
          HEAP32[$904>>2] = $718;
          break;
         }
        }
        else if ((label|0) == 278) {
         $905 = ((($$0288$i$i)) + 8|0);
         $906 = HEAP32[$905>>2]|0;
         $907 = HEAP32[(19824)>>2]|0;
         $908 = ($906>>>0)>=($907>>>0);
         $not$$i22$i = ($$0288$i$i>>>0)>=($907>>>0);
         $909 = $908 & $not$$i22$i;
         if ($909) {
          $910 = ((($906)) + 12|0);
          HEAP32[$910>>2] = $718;
          HEAP32[$905>>2] = $718;
          $911 = ((($718)) + 8|0);
          HEAP32[$911>>2] = $906;
          $912 = ((($718)) + 12|0);
          HEAP32[$912>>2] = $$0288$i$i;
          $913 = ((($718)) + 24|0);
          HEAP32[$913>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $1044 = ((($706)) + 8|0);
      $$0 = $1044;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0$i$i$i = (20256);
     }
    }
    while(1) {
     $914 = HEAP32[$$0$i$i$i>>2]|0;
     $915 = ($914>>>0)>($627>>>0);
     if (!($915)) {
      $916 = ((($$0$i$i$i)) + 4|0);
      $917 = HEAP32[$916>>2]|0;
      $918 = (($914) + ($917)|0);
      $919 = ($918>>>0)>($627>>>0);
      if ($919) {
       break;
      }
     }
     $920 = ((($$0$i$i$i)) + 8|0);
     $921 = HEAP32[$920>>2]|0;
     $$0$i$i$i = $921;
    }
    $922 = ((($918)) + -47|0);
    $923 = ((($922)) + 8|0);
    $924 = $923;
    $925 = $924 & 7;
    $926 = ($925|0)==(0);
    $927 = (0 - ($924))|0;
    $928 = $927 & 7;
    $929 = $926 ? 0 : $928;
    $930 = (($922) + ($929)|0);
    $931 = ((($627)) + 16|0);
    $932 = ($930>>>0)<($931>>>0);
    $933 = $932 ? $627 : $930;
    $934 = ((($933)) + 8|0);
    $935 = ((($933)) + 24|0);
    $936 = (($$723947$i) + -40)|0;
    $937 = ((($$748$i)) + 8|0);
    $938 = $937;
    $939 = $938 & 7;
    $940 = ($939|0)==(0);
    $941 = (0 - ($938))|0;
    $942 = $941 & 7;
    $943 = $940 ? 0 : $942;
    $944 = (($$748$i) + ($943)|0);
    $945 = (($936) - ($943))|0;
    HEAP32[(19832)>>2] = $944;
    HEAP32[(19820)>>2] = $945;
    $946 = $945 | 1;
    $947 = ((($944)) + 4|0);
    HEAP32[$947>>2] = $946;
    $948 = (($944) + ($945)|0);
    $949 = ((($948)) + 4|0);
    HEAP32[$949>>2] = 40;
    $950 = HEAP32[(20296)>>2]|0;
    HEAP32[(19836)>>2] = $950;
    $951 = ((($933)) + 4|0);
    HEAP32[$951>>2] = 27;
    ;HEAP32[$934>>2]=HEAP32[(20256)>>2]|0;HEAP32[$934+4>>2]=HEAP32[(20256)+4>>2]|0;HEAP32[$934+8>>2]=HEAP32[(20256)+8>>2]|0;HEAP32[$934+12>>2]=HEAP32[(20256)+12>>2]|0;
    HEAP32[(20256)>>2] = $$748$i;
    HEAP32[(20260)>>2] = $$723947$i;
    HEAP32[(20268)>>2] = 0;
    HEAP32[(20264)>>2] = $934;
    $$0$i$i = $935;
    while(1) {
     $952 = ((($$0$i$i)) + 4|0);
     HEAP32[$952>>2] = 7;
     $953 = ((($952)) + 4|0);
     $954 = ($953>>>0)<($918>>>0);
     if ($954) {
      $$0$i$i = $952;
     } else {
      break;
     }
    }
    $955 = ($933|0)==($627|0);
    if (!($955)) {
     $956 = $933;
     $957 = $627;
     $958 = (($956) - ($957))|0;
     $959 = HEAP32[$951>>2]|0;
     $960 = $959 & -2;
     HEAP32[$951>>2] = $960;
     $961 = $958 | 1;
     $962 = ((($627)) + 4|0);
     HEAP32[$962>>2] = $961;
     HEAP32[$933>>2] = $958;
     $963 = $958 >>> 3;
     $964 = ($958>>>0)<(256);
     if ($964) {
      $965 = $963 << 1;
      $966 = (19848 + ($965<<2)|0);
      $967 = HEAP32[4952]|0;
      $968 = 1 << $963;
      $969 = $967 & $968;
      $970 = ($969|0)==(0);
      if ($970) {
       $971 = $967 | $968;
       HEAP32[4952] = $971;
       $$pre$i$i = ((($966)) + 8|0);
       $$0211$i$i = $966;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $972 = ((($966)) + 8|0);
       $973 = HEAP32[$972>>2]|0;
       $974 = HEAP32[(19824)>>2]|0;
       $975 = ($973>>>0)<($974>>>0);
       if ($975) {
        _abort();
        // unreachable;
       } else {
        $$0211$i$i = $973;$$pre$phi$i$iZ2D = $972;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $627;
      $976 = ((($$0211$i$i)) + 12|0);
      HEAP32[$976>>2] = $627;
      $977 = ((($627)) + 8|0);
      HEAP32[$977>>2] = $$0211$i$i;
      $978 = ((($627)) + 12|0);
      HEAP32[$978>>2] = $966;
      break;
     }
     $979 = $958 >>> 8;
     $980 = ($979|0)==(0);
     if ($980) {
      $$0212$i$i = 0;
     } else {
      $981 = ($958>>>0)>(16777215);
      if ($981) {
       $$0212$i$i = 31;
      } else {
       $982 = (($979) + 1048320)|0;
       $983 = $982 >>> 16;
       $984 = $983 & 8;
       $985 = $979 << $984;
       $986 = (($985) + 520192)|0;
       $987 = $986 >>> 16;
       $988 = $987 & 4;
       $989 = $988 | $984;
       $990 = $985 << $988;
       $991 = (($990) + 245760)|0;
       $992 = $991 >>> 16;
       $993 = $992 & 2;
       $994 = $989 | $993;
       $995 = (14 - ($994))|0;
       $996 = $990 << $993;
       $997 = $996 >>> 15;
       $998 = (($995) + ($997))|0;
       $999 = $998 << 1;
       $1000 = (($998) + 7)|0;
       $1001 = $958 >>> $1000;
       $1002 = $1001 & 1;
       $1003 = $1002 | $999;
       $$0212$i$i = $1003;
      }
     }
     $1004 = (20112 + ($$0212$i$i<<2)|0);
     $1005 = ((($627)) + 28|0);
     HEAP32[$1005>>2] = $$0212$i$i;
     $1006 = ((($627)) + 20|0);
     HEAP32[$1006>>2] = 0;
     HEAP32[$931>>2] = 0;
     $1007 = HEAP32[(19812)>>2]|0;
     $1008 = 1 << $$0212$i$i;
     $1009 = $1007 & $1008;
     $1010 = ($1009|0)==(0);
     if ($1010) {
      $1011 = $1007 | $1008;
      HEAP32[(19812)>>2] = $1011;
      HEAP32[$1004>>2] = $627;
      $1012 = ((($627)) + 24|0);
      HEAP32[$1012>>2] = $1004;
      $1013 = ((($627)) + 12|0);
      HEAP32[$1013>>2] = $627;
      $1014 = ((($627)) + 8|0);
      HEAP32[$1014>>2] = $627;
      break;
     }
     $1015 = HEAP32[$1004>>2]|0;
     $1016 = ($$0212$i$i|0)==(31);
     $1017 = $$0212$i$i >>> 1;
     $1018 = (25 - ($1017))|0;
     $1019 = $1016 ? 0 : $1018;
     $1020 = $958 << $1019;
     $$0206$i$i = $1020;$$0207$i$i = $1015;
     while(1) {
      $1021 = ((($$0207$i$i)) + 4|0);
      $1022 = HEAP32[$1021>>2]|0;
      $1023 = $1022 & -8;
      $1024 = ($1023|0)==($958|0);
      if ($1024) {
       label = 304;
       break;
      }
      $1025 = $$0206$i$i >>> 31;
      $1026 = (((($$0207$i$i)) + 16|0) + ($1025<<2)|0);
      $1027 = $$0206$i$i << 1;
      $1028 = HEAP32[$1026>>2]|0;
      $1029 = ($1028|0)==(0|0);
      if ($1029) {
       label = 301;
       break;
      } else {
       $$0206$i$i = $1027;$$0207$i$i = $1028;
      }
     }
     if ((label|0) == 301) {
      $1030 = HEAP32[(19824)>>2]|0;
      $1031 = ($1026>>>0)<($1030>>>0);
      if ($1031) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$1026>>2] = $627;
       $1032 = ((($627)) + 24|0);
       HEAP32[$1032>>2] = $$0207$i$i;
       $1033 = ((($627)) + 12|0);
       HEAP32[$1033>>2] = $627;
       $1034 = ((($627)) + 8|0);
       HEAP32[$1034>>2] = $627;
       break;
      }
     }
     else if ((label|0) == 304) {
      $1035 = ((($$0207$i$i)) + 8|0);
      $1036 = HEAP32[$1035>>2]|0;
      $1037 = HEAP32[(19824)>>2]|0;
      $1038 = ($1036>>>0)>=($1037>>>0);
      $not$$i$i = ($$0207$i$i>>>0)>=($1037>>>0);
      $1039 = $1038 & $not$$i$i;
      if ($1039) {
       $1040 = ((($1036)) + 12|0);
       HEAP32[$1040>>2] = $627;
       HEAP32[$1035>>2] = $627;
       $1041 = ((($627)) + 8|0);
       HEAP32[$1041>>2] = $1036;
       $1042 = ((($627)) + 12|0);
       HEAP32[$1042>>2] = $$0207$i$i;
       $1043 = ((($627)) + 24|0);
       HEAP32[$1043>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $1045 = HEAP32[(19820)>>2]|0;
  $1046 = ($1045>>>0)>($$0197>>>0);
  if ($1046) {
   $1047 = (($1045) - ($$0197))|0;
   HEAP32[(19820)>>2] = $1047;
   $1048 = HEAP32[(19832)>>2]|0;
   $1049 = (($1048) + ($$0197)|0);
   HEAP32[(19832)>>2] = $1049;
   $1050 = $1047 | 1;
   $1051 = ((($1049)) + 4|0);
   HEAP32[$1051>>2] = $1050;
   $1052 = $$0197 | 3;
   $1053 = ((($1048)) + 4|0);
   HEAP32[$1053>>2] = $1052;
   $1054 = ((($1048)) + 8|0);
   $$0 = $1054;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $1055 = (___errno_location()|0);
 HEAP32[$1055>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0211$i = 0, $$0211$in$i = 0, $$0381 = 0, $$0382 = 0, $$0394 = 0, $$0401 = 0, $$1 = 0, $$1380 = 0, $$1385 = 0, $$1388 = 0, $$1396 = 0, $$1400 = 0, $$2 = 0, $$3 = 0, $$3398 = 0, $$pre = 0, $$pre$phi439Z2D = 0, $$pre$phi441Z2D = 0, $$pre$phiZ2D = 0, $$pre438 = 0;
 var $$pre440 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $cond418 = 0, $cond419 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(19824)>>2]|0;
 $4 = ($2>>>0)<($3>>>0);
 if ($4) {
  _abort();
  // unreachable;
 }
 $5 = ((($0)) + -4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 & 3;
 $8 = ($7|0)==(1);
 if ($8) {
  _abort();
  // unreachable;
 }
 $9 = $6 & -8;
 $10 = (($2) + ($9)|0);
 $11 = $6 & 1;
 $12 = ($11|0)==(0);
 do {
  if ($12) {
   $13 = HEAP32[$2>>2]|0;
   $14 = ($7|0)==(0);
   if ($14) {
    return;
   }
   $15 = (0 - ($13))|0;
   $16 = (($2) + ($15)|0);
   $17 = (($13) + ($9))|0;
   $18 = ($16>>>0)<($3>>>0);
   if ($18) {
    _abort();
    // unreachable;
   }
   $19 = HEAP32[(19828)>>2]|0;
   $20 = ($16|0)==($19|0);
   if ($20) {
    $105 = ((($10)) + 4|0);
    $106 = HEAP32[$105>>2]|0;
    $107 = $106 & 3;
    $108 = ($107|0)==(3);
    if (!($108)) {
     $$1 = $16;$$1380 = $17;
     break;
    }
    HEAP32[(19816)>>2] = $17;
    $109 = $106 & -2;
    HEAP32[$105>>2] = $109;
    $110 = $17 | 1;
    $111 = ((($16)) + 4|0);
    HEAP32[$111>>2] = $110;
    $112 = (($16) + ($17)|0);
    HEAP32[$112>>2] = $17;
    return;
   }
   $21 = $13 >>> 3;
   $22 = ($13>>>0)<(256);
   if ($22) {
    $23 = ((($16)) + 8|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ((($16)) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = $21 << 1;
    $28 = (19848 + ($27<<2)|0);
    $29 = ($24|0)==($28|0);
    if (!($29)) {
     $30 = ($24>>>0)<($3>>>0);
     if ($30) {
      _abort();
      // unreachable;
     }
     $31 = ((($24)) + 12|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = ($32|0)==($16|0);
     if (!($33)) {
      _abort();
      // unreachable;
     }
    }
    $34 = ($26|0)==($24|0);
    if ($34) {
     $35 = 1 << $21;
     $36 = $35 ^ -1;
     $37 = HEAP32[4952]|0;
     $38 = $37 & $36;
     HEAP32[4952] = $38;
     $$1 = $16;$$1380 = $17;
     break;
    }
    $39 = ($26|0)==($28|0);
    if ($39) {
     $$pre440 = ((($26)) + 8|0);
     $$pre$phi441Z2D = $$pre440;
    } else {
     $40 = ($26>>>0)<($3>>>0);
     if ($40) {
      _abort();
      // unreachable;
     }
     $41 = ((($26)) + 8|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = ($42|0)==($16|0);
     if ($43) {
      $$pre$phi441Z2D = $41;
     } else {
      _abort();
      // unreachable;
     }
    }
    $44 = ((($24)) + 12|0);
    HEAP32[$44>>2] = $26;
    HEAP32[$$pre$phi441Z2D>>2] = $24;
    $$1 = $16;$$1380 = $17;
    break;
   }
   $45 = ((($16)) + 24|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ((($16)) + 12|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = ($48|0)==($16|0);
   do {
    if ($49) {
     $59 = ((($16)) + 16|0);
     $60 = ((($59)) + 4|0);
     $61 = HEAP32[$60>>2]|0;
     $62 = ($61|0)==(0|0);
     if ($62) {
      $63 = HEAP32[$59>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       $$3 = 0;
       break;
      } else {
       $$1385 = $63;$$1388 = $59;
      }
     } else {
      $$1385 = $61;$$1388 = $60;
     }
     while(1) {
      $65 = ((($$1385)) + 20|0);
      $66 = HEAP32[$65>>2]|0;
      $67 = ($66|0)==(0|0);
      if (!($67)) {
       $$1385 = $66;$$1388 = $65;
       continue;
      }
      $68 = ((($$1385)) + 16|0);
      $69 = HEAP32[$68>>2]|0;
      $70 = ($69|0)==(0|0);
      if ($70) {
       break;
      } else {
       $$1385 = $69;$$1388 = $68;
      }
     }
     $71 = ($$1388>>>0)<($3>>>0);
     if ($71) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1388>>2] = 0;
      $$3 = $$1385;
      break;
     }
    } else {
     $50 = ((($16)) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($51>>>0)<($3>>>0);
     if ($52) {
      _abort();
      // unreachable;
     }
     $53 = ((($51)) + 12|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = ($54|0)==($16|0);
     if (!($55)) {
      _abort();
      // unreachable;
     }
     $56 = ((($48)) + 8|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = ($57|0)==($16|0);
     if ($58) {
      HEAP32[$53>>2] = $48;
      HEAP32[$56>>2] = $51;
      $$3 = $48;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $72 = ($46|0)==(0|0);
   if ($72) {
    $$1 = $16;$$1380 = $17;
   } else {
    $73 = ((($16)) + 28|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = (20112 + ($74<<2)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = ($16|0)==($76|0);
    if ($77) {
     HEAP32[$75>>2] = $$3;
     $cond418 = ($$3|0)==(0|0);
     if ($cond418) {
      $78 = 1 << $74;
      $79 = $78 ^ -1;
      $80 = HEAP32[(19812)>>2]|0;
      $81 = $80 & $79;
      HEAP32[(19812)>>2] = $81;
      $$1 = $16;$$1380 = $17;
      break;
     }
    } else {
     $82 = HEAP32[(19824)>>2]|0;
     $83 = ($46>>>0)<($82>>>0);
     if ($83) {
      _abort();
      // unreachable;
     }
     $84 = ((($46)) + 16|0);
     $85 = HEAP32[$84>>2]|0;
     $86 = ($85|0)==($16|0);
     if ($86) {
      HEAP32[$84>>2] = $$3;
     } else {
      $87 = ((($46)) + 20|0);
      HEAP32[$87>>2] = $$3;
     }
     $88 = ($$3|0)==(0|0);
     if ($88) {
      $$1 = $16;$$1380 = $17;
      break;
     }
    }
    $89 = HEAP32[(19824)>>2]|0;
    $90 = ($$3>>>0)<($89>>>0);
    if ($90) {
     _abort();
     // unreachable;
    }
    $91 = ((($$3)) + 24|0);
    HEAP32[$91>>2] = $46;
    $92 = ((($16)) + 16|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = ($93|0)==(0|0);
    do {
     if (!($94)) {
      $95 = ($93>>>0)<($89>>>0);
      if ($95) {
       _abort();
       // unreachable;
      } else {
       $96 = ((($$3)) + 16|0);
       HEAP32[$96>>2] = $93;
       $97 = ((($93)) + 24|0);
       HEAP32[$97>>2] = $$3;
       break;
      }
     }
    } while(0);
    $98 = ((($92)) + 4|0);
    $99 = HEAP32[$98>>2]|0;
    $100 = ($99|0)==(0|0);
    if ($100) {
     $$1 = $16;$$1380 = $17;
    } else {
     $101 = HEAP32[(19824)>>2]|0;
     $102 = ($99>>>0)<($101>>>0);
     if ($102) {
      _abort();
      // unreachable;
     } else {
      $103 = ((($$3)) + 20|0);
      HEAP32[$103>>2] = $99;
      $104 = ((($99)) + 24|0);
      HEAP32[$104>>2] = $$3;
      $$1 = $16;$$1380 = $17;
      break;
     }
    }
   }
  } else {
   $$1 = $2;$$1380 = $9;
  }
 } while(0);
 $113 = ($$1>>>0)<($10>>>0);
 if (!($113)) {
  _abort();
  // unreachable;
 }
 $114 = ((($10)) + 4|0);
 $115 = HEAP32[$114>>2]|0;
 $116 = $115 & 1;
 $117 = ($116|0)==(0);
 if ($117) {
  _abort();
  // unreachable;
 }
 $118 = $115 & 2;
 $119 = ($118|0)==(0);
 if ($119) {
  $120 = HEAP32[(19832)>>2]|0;
  $121 = ($10|0)==($120|0);
  if ($121) {
   $122 = HEAP32[(19820)>>2]|0;
   $123 = (($122) + ($$1380))|0;
   HEAP32[(19820)>>2] = $123;
   HEAP32[(19832)>>2] = $$1;
   $124 = $123 | 1;
   $125 = ((($$1)) + 4|0);
   HEAP32[$125>>2] = $124;
   $126 = HEAP32[(19828)>>2]|0;
   $127 = ($$1|0)==($126|0);
   if (!($127)) {
    return;
   }
   HEAP32[(19828)>>2] = 0;
   HEAP32[(19816)>>2] = 0;
   return;
  }
  $128 = HEAP32[(19828)>>2]|0;
  $129 = ($10|0)==($128|0);
  if ($129) {
   $130 = HEAP32[(19816)>>2]|0;
   $131 = (($130) + ($$1380))|0;
   HEAP32[(19816)>>2] = $131;
   HEAP32[(19828)>>2] = $$1;
   $132 = $131 | 1;
   $133 = ((($$1)) + 4|0);
   HEAP32[$133>>2] = $132;
   $134 = (($$1) + ($131)|0);
   HEAP32[$134>>2] = $131;
   return;
  }
  $135 = $115 & -8;
  $136 = (($135) + ($$1380))|0;
  $137 = $115 >>> 3;
  $138 = ($115>>>0)<(256);
  do {
   if ($138) {
    $139 = ((($10)) + 8|0);
    $140 = HEAP32[$139>>2]|0;
    $141 = ((($10)) + 12|0);
    $142 = HEAP32[$141>>2]|0;
    $143 = $137 << 1;
    $144 = (19848 + ($143<<2)|0);
    $145 = ($140|0)==($144|0);
    if (!($145)) {
     $146 = HEAP32[(19824)>>2]|0;
     $147 = ($140>>>0)<($146>>>0);
     if ($147) {
      _abort();
      // unreachable;
     }
     $148 = ((($140)) + 12|0);
     $149 = HEAP32[$148>>2]|0;
     $150 = ($149|0)==($10|0);
     if (!($150)) {
      _abort();
      // unreachable;
     }
    }
    $151 = ($142|0)==($140|0);
    if ($151) {
     $152 = 1 << $137;
     $153 = $152 ^ -1;
     $154 = HEAP32[4952]|0;
     $155 = $154 & $153;
     HEAP32[4952] = $155;
     break;
    }
    $156 = ($142|0)==($144|0);
    if ($156) {
     $$pre438 = ((($142)) + 8|0);
     $$pre$phi439Z2D = $$pre438;
    } else {
     $157 = HEAP32[(19824)>>2]|0;
     $158 = ($142>>>0)<($157>>>0);
     if ($158) {
      _abort();
      // unreachable;
     }
     $159 = ((($142)) + 8|0);
     $160 = HEAP32[$159>>2]|0;
     $161 = ($160|0)==($10|0);
     if ($161) {
      $$pre$phi439Z2D = $159;
     } else {
      _abort();
      // unreachable;
     }
    }
    $162 = ((($140)) + 12|0);
    HEAP32[$162>>2] = $142;
    HEAP32[$$pre$phi439Z2D>>2] = $140;
   } else {
    $163 = ((($10)) + 24|0);
    $164 = HEAP32[$163>>2]|0;
    $165 = ((($10)) + 12|0);
    $166 = HEAP32[$165>>2]|0;
    $167 = ($166|0)==($10|0);
    do {
     if ($167) {
      $178 = ((($10)) + 16|0);
      $179 = ((($178)) + 4|0);
      $180 = HEAP32[$179>>2]|0;
      $181 = ($180|0)==(0|0);
      if ($181) {
       $182 = HEAP32[$178>>2]|0;
       $183 = ($182|0)==(0|0);
       if ($183) {
        $$3398 = 0;
        break;
       } else {
        $$1396 = $182;$$1400 = $178;
       }
      } else {
       $$1396 = $180;$$1400 = $179;
      }
      while(1) {
       $184 = ((($$1396)) + 20|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = ($185|0)==(0|0);
       if (!($186)) {
        $$1396 = $185;$$1400 = $184;
        continue;
       }
       $187 = ((($$1396)) + 16|0);
       $188 = HEAP32[$187>>2]|0;
       $189 = ($188|0)==(0|0);
       if ($189) {
        break;
       } else {
        $$1396 = $188;$$1400 = $187;
       }
      }
      $190 = HEAP32[(19824)>>2]|0;
      $191 = ($$1400>>>0)<($190>>>0);
      if ($191) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$1400>>2] = 0;
       $$3398 = $$1396;
       break;
      }
     } else {
      $168 = ((($10)) + 8|0);
      $169 = HEAP32[$168>>2]|0;
      $170 = HEAP32[(19824)>>2]|0;
      $171 = ($169>>>0)<($170>>>0);
      if ($171) {
       _abort();
       // unreachable;
      }
      $172 = ((($169)) + 12|0);
      $173 = HEAP32[$172>>2]|0;
      $174 = ($173|0)==($10|0);
      if (!($174)) {
       _abort();
       // unreachable;
      }
      $175 = ((($166)) + 8|0);
      $176 = HEAP32[$175>>2]|0;
      $177 = ($176|0)==($10|0);
      if ($177) {
       HEAP32[$172>>2] = $166;
       HEAP32[$175>>2] = $169;
       $$3398 = $166;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $192 = ($164|0)==(0|0);
    if (!($192)) {
     $193 = ((($10)) + 28|0);
     $194 = HEAP32[$193>>2]|0;
     $195 = (20112 + ($194<<2)|0);
     $196 = HEAP32[$195>>2]|0;
     $197 = ($10|0)==($196|0);
     if ($197) {
      HEAP32[$195>>2] = $$3398;
      $cond419 = ($$3398|0)==(0|0);
      if ($cond419) {
       $198 = 1 << $194;
       $199 = $198 ^ -1;
       $200 = HEAP32[(19812)>>2]|0;
       $201 = $200 & $199;
       HEAP32[(19812)>>2] = $201;
       break;
      }
     } else {
      $202 = HEAP32[(19824)>>2]|0;
      $203 = ($164>>>0)<($202>>>0);
      if ($203) {
       _abort();
       // unreachable;
      }
      $204 = ((($164)) + 16|0);
      $205 = HEAP32[$204>>2]|0;
      $206 = ($205|0)==($10|0);
      if ($206) {
       HEAP32[$204>>2] = $$3398;
      } else {
       $207 = ((($164)) + 20|0);
       HEAP32[$207>>2] = $$3398;
      }
      $208 = ($$3398|0)==(0|0);
      if ($208) {
       break;
      }
     }
     $209 = HEAP32[(19824)>>2]|0;
     $210 = ($$3398>>>0)<($209>>>0);
     if ($210) {
      _abort();
      // unreachable;
     }
     $211 = ((($$3398)) + 24|0);
     HEAP32[$211>>2] = $164;
     $212 = ((($10)) + 16|0);
     $213 = HEAP32[$212>>2]|0;
     $214 = ($213|0)==(0|0);
     do {
      if (!($214)) {
       $215 = ($213>>>0)<($209>>>0);
       if ($215) {
        _abort();
        // unreachable;
       } else {
        $216 = ((($$3398)) + 16|0);
        HEAP32[$216>>2] = $213;
        $217 = ((($213)) + 24|0);
        HEAP32[$217>>2] = $$3398;
        break;
       }
      }
     } while(0);
     $218 = ((($212)) + 4|0);
     $219 = HEAP32[$218>>2]|0;
     $220 = ($219|0)==(0|0);
     if (!($220)) {
      $221 = HEAP32[(19824)>>2]|0;
      $222 = ($219>>>0)<($221>>>0);
      if ($222) {
       _abort();
       // unreachable;
      } else {
       $223 = ((($$3398)) + 20|0);
       HEAP32[$223>>2] = $219;
       $224 = ((($219)) + 24|0);
       HEAP32[$224>>2] = $$3398;
       break;
      }
     }
    }
   }
  } while(0);
  $225 = $136 | 1;
  $226 = ((($$1)) + 4|0);
  HEAP32[$226>>2] = $225;
  $227 = (($$1) + ($136)|0);
  HEAP32[$227>>2] = $136;
  $228 = HEAP32[(19828)>>2]|0;
  $229 = ($$1|0)==($228|0);
  if ($229) {
   HEAP32[(19816)>>2] = $136;
   return;
  } else {
   $$2 = $136;
  }
 } else {
  $230 = $115 & -2;
  HEAP32[$114>>2] = $230;
  $231 = $$1380 | 1;
  $232 = ((($$1)) + 4|0);
  HEAP32[$232>>2] = $231;
  $233 = (($$1) + ($$1380)|0);
  HEAP32[$233>>2] = $$1380;
  $$2 = $$1380;
 }
 $234 = $$2 >>> 3;
 $235 = ($$2>>>0)<(256);
 if ($235) {
  $236 = $234 << 1;
  $237 = (19848 + ($236<<2)|0);
  $238 = HEAP32[4952]|0;
  $239 = 1 << $234;
  $240 = $238 & $239;
  $241 = ($240|0)==(0);
  if ($241) {
   $242 = $238 | $239;
   HEAP32[4952] = $242;
   $$pre = ((($237)) + 8|0);
   $$0401 = $237;$$pre$phiZ2D = $$pre;
  } else {
   $243 = ((($237)) + 8|0);
   $244 = HEAP32[$243>>2]|0;
   $245 = HEAP32[(19824)>>2]|0;
   $246 = ($244>>>0)<($245>>>0);
   if ($246) {
    _abort();
    // unreachable;
   } else {
    $$0401 = $244;$$pre$phiZ2D = $243;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $247 = ((($$0401)) + 12|0);
  HEAP32[$247>>2] = $$1;
  $248 = ((($$1)) + 8|0);
  HEAP32[$248>>2] = $$0401;
  $249 = ((($$1)) + 12|0);
  HEAP32[$249>>2] = $237;
  return;
 }
 $250 = $$2 >>> 8;
 $251 = ($250|0)==(0);
 if ($251) {
  $$0394 = 0;
 } else {
  $252 = ($$2>>>0)>(16777215);
  if ($252) {
   $$0394 = 31;
  } else {
   $253 = (($250) + 1048320)|0;
   $254 = $253 >>> 16;
   $255 = $254 & 8;
   $256 = $250 << $255;
   $257 = (($256) + 520192)|0;
   $258 = $257 >>> 16;
   $259 = $258 & 4;
   $260 = $259 | $255;
   $261 = $256 << $259;
   $262 = (($261) + 245760)|0;
   $263 = $262 >>> 16;
   $264 = $263 & 2;
   $265 = $260 | $264;
   $266 = (14 - ($265))|0;
   $267 = $261 << $264;
   $268 = $267 >>> 15;
   $269 = (($266) + ($268))|0;
   $270 = $269 << 1;
   $271 = (($269) + 7)|0;
   $272 = $$2 >>> $271;
   $273 = $272 & 1;
   $274 = $273 | $270;
   $$0394 = $274;
  }
 }
 $275 = (20112 + ($$0394<<2)|0);
 $276 = ((($$1)) + 28|0);
 HEAP32[$276>>2] = $$0394;
 $277 = ((($$1)) + 16|0);
 $278 = ((($$1)) + 20|0);
 HEAP32[$278>>2] = 0;
 HEAP32[$277>>2] = 0;
 $279 = HEAP32[(19812)>>2]|0;
 $280 = 1 << $$0394;
 $281 = $279 & $280;
 $282 = ($281|0)==(0);
 do {
  if ($282) {
   $283 = $279 | $280;
   HEAP32[(19812)>>2] = $283;
   HEAP32[$275>>2] = $$1;
   $284 = ((($$1)) + 24|0);
   HEAP32[$284>>2] = $275;
   $285 = ((($$1)) + 12|0);
   HEAP32[$285>>2] = $$1;
   $286 = ((($$1)) + 8|0);
   HEAP32[$286>>2] = $$1;
  } else {
   $287 = HEAP32[$275>>2]|0;
   $288 = ($$0394|0)==(31);
   $289 = $$0394 >>> 1;
   $290 = (25 - ($289))|0;
   $291 = $288 ? 0 : $290;
   $292 = $$2 << $291;
   $$0381 = $292;$$0382 = $287;
   while(1) {
    $293 = ((($$0382)) + 4|0);
    $294 = HEAP32[$293>>2]|0;
    $295 = $294 & -8;
    $296 = ($295|0)==($$2|0);
    if ($296) {
     label = 130;
     break;
    }
    $297 = $$0381 >>> 31;
    $298 = (((($$0382)) + 16|0) + ($297<<2)|0);
    $299 = $$0381 << 1;
    $300 = HEAP32[$298>>2]|0;
    $301 = ($300|0)==(0|0);
    if ($301) {
     label = 127;
     break;
    } else {
     $$0381 = $299;$$0382 = $300;
    }
   }
   if ((label|0) == 127) {
    $302 = HEAP32[(19824)>>2]|0;
    $303 = ($298>>>0)<($302>>>0);
    if ($303) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$298>>2] = $$1;
     $304 = ((($$1)) + 24|0);
     HEAP32[$304>>2] = $$0382;
     $305 = ((($$1)) + 12|0);
     HEAP32[$305>>2] = $$1;
     $306 = ((($$1)) + 8|0);
     HEAP32[$306>>2] = $$1;
     break;
    }
   }
   else if ((label|0) == 130) {
    $307 = ((($$0382)) + 8|0);
    $308 = HEAP32[$307>>2]|0;
    $309 = HEAP32[(19824)>>2]|0;
    $310 = ($308>>>0)>=($309>>>0);
    $not$ = ($$0382>>>0)>=($309>>>0);
    $311 = $310 & $not$;
    if ($311) {
     $312 = ((($308)) + 12|0);
     HEAP32[$312>>2] = $$1;
     HEAP32[$307>>2] = $$1;
     $313 = ((($$1)) + 8|0);
     HEAP32[$313>>2] = $308;
     $314 = ((($$1)) + 12|0);
     HEAP32[$314>>2] = $$0382;
     $315 = ((($$1)) + 24|0);
     HEAP32[$315>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $316 = HEAP32[(19840)>>2]|0;
 $317 = (($316) + -1)|0;
 HEAP32[(19840)>>2] = $317;
 $318 = ($317|0)==(0);
 if ($318) {
  $$0211$in$i = (20264);
 } else {
  return;
 }
 while(1) {
  $$0211$i = HEAP32[$$0211$in$i>>2]|0;
  $319 = ($$0211$i|0)==(0|0);
  $320 = ((($$0211$i)) + 8|0);
  if ($319) {
   break;
  } else {
   $$0211$in$i = $320;
  }
 }
 HEAP32[(19840)>>2] = -1;
 return;
}
function _realloc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 if ($2) {
  $3 = (_malloc($1)|0);
  $$1 = $3;
  return ($$1|0);
 }
 $4 = ($1>>>0)>(4294967231);
 if ($4) {
  $5 = (___errno_location()|0);
  HEAP32[$5>>2] = 12;
  $$1 = 0;
  return ($$1|0);
 }
 $6 = ($1>>>0)<(11);
 $7 = (($1) + 11)|0;
 $8 = $7 & -8;
 $9 = $6 ? 16 : $8;
 $10 = ((($0)) + -8|0);
 $11 = (_try_realloc_chunk($10,$9)|0);
 $12 = ($11|0)==(0|0);
 if (!($12)) {
  $13 = ((($11)) + 8|0);
  $$1 = $13;
  return ($$1|0);
 }
 $14 = (_malloc($1)|0);
 $15 = ($14|0)==(0|0);
 if ($15) {
  $$1 = 0;
  return ($$1|0);
 }
 $16 = ((($0)) + -4|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = $17 & -8;
 $19 = $17 & 3;
 $20 = ($19|0)==(0);
 $21 = $20 ? 8 : 4;
 $22 = (($18) - ($21))|0;
 $23 = ($22>>>0)<($1>>>0);
 $24 = $23 ? $22 : $1;
 _memcpy(($14|0),($0|0),($24|0))|0;
 _free($0);
 $$1 = $14;
 return ($$1|0);
}
function _try_realloc_chunk($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$1271 = 0, $$1274 = 0, $$2 = 0, $$3 = 0, $$pre = 0, $$pre$phiZ2D = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0;
 var $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0;
 var $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0;
 var $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0;
 var $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $cond = 0, $notlhs = 0, $notrhs = 0, $or$cond$not = 0, $or$cond3 = 0, $storemerge = 0, $storemerge1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($0)) + 4|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = $3 & -8;
 $5 = (($0) + ($4)|0);
 $6 = HEAP32[(19824)>>2]|0;
 $7 = $3 & 3;
 $notlhs = ($0>>>0)>=($6>>>0);
 $notrhs = ($7|0)!=(1);
 $or$cond$not = $notrhs & $notlhs;
 $8 = ($0>>>0)<($5>>>0);
 $or$cond3 = $or$cond$not & $8;
 if (!($or$cond3)) {
  _abort();
  // unreachable;
 }
 $9 = ((($5)) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = $10 & 1;
 $12 = ($11|0)==(0);
 if ($12) {
  _abort();
  // unreachable;
 }
 $13 = ($7|0)==(0);
 if ($13) {
  $14 = ($1>>>0)<(256);
  if ($14) {
   $$2 = 0;
   return ($$2|0);
  }
  $15 = (($1) + 4)|0;
  $16 = ($4>>>0)<($15>>>0);
  if (!($16)) {
   $17 = (($4) - ($1))|0;
   $18 = HEAP32[(20288)>>2]|0;
   $19 = $18 << 1;
   $20 = ($17>>>0)>($19>>>0);
   if (!($20)) {
    $$2 = $0;
    return ($$2|0);
   }
  }
  $$2 = 0;
  return ($$2|0);
 }
 $21 = ($4>>>0)<($1>>>0);
 if (!($21)) {
  $22 = (($4) - ($1))|0;
  $23 = ($22>>>0)>(15);
  if (!($23)) {
   $$2 = $0;
   return ($$2|0);
  }
  $24 = (($0) + ($1)|0);
  $25 = $3 & 1;
  $26 = $25 | $1;
  $27 = $26 | 2;
  HEAP32[$2>>2] = $27;
  $28 = ((($24)) + 4|0);
  $29 = $22 | 3;
  HEAP32[$28>>2] = $29;
  $30 = (($24) + ($22)|0);
  $31 = ((($30)) + 4|0);
  $32 = HEAP32[$31>>2]|0;
  $33 = $32 | 1;
  HEAP32[$31>>2] = $33;
  _dispose_chunk($24,$22);
  $$2 = $0;
  return ($$2|0);
 }
 $34 = HEAP32[(19832)>>2]|0;
 $35 = ($5|0)==($34|0);
 if ($35) {
  $36 = HEAP32[(19820)>>2]|0;
  $37 = (($36) + ($4))|0;
  $38 = ($37>>>0)>($1>>>0);
  if (!($38)) {
   $$2 = 0;
   return ($$2|0);
  }
  $39 = (($37) - ($1))|0;
  $40 = (($0) + ($1)|0);
  $41 = $3 & 1;
  $42 = $41 | $1;
  $43 = $42 | 2;
  HEAP32[$2>>2] = $43;
  $44 = ((($40)) + 4|0);
  $45 = $39 | 1;
  HEAP32[$44>>2] = $45;
  HEAP32[(19832)>>2] = $40;
  HEAP32[(19820)>>2] = $39;
  $$2 = $0;
  return ($$2|0);
 }
 $46 = HEAP32[(19828)>>2]|0;
 $47 = ($5|0)==($46|0);
 if ($47) {
  $48 = HEAP32[(19816)>>2]|0;
  $49 = (($48) + ($4))|0;
  $50 = ($49>>>0)<($1>>>0);
  if ($50) {
   $$2 = 0;
   return ($$2|0);
  }
  $51 = (($49) - ($1))|0;
  $52 = ($51>>>0)>(15);
  if ($52) {
   $53 = (($0) + ($1)|0);
   $54 = (($53) + ($51)|0);
   $55 = $3 & 1;
   $56 = $55 | $1;
   $57 = $56 | 2;
   HEAP32[$2>>2] = $57;
   $58 = ((($53)) + 4|0);
   $59 = $51 | 1;
   HEAP32[$58>>2] = $59;
   HEAP32[$54>>2] = $51;
   $60 = ((($54)) + 4|0);
   $61 = HEAP32[$60>>2]|0;
   $62 = $61 & -2;
   HEAP32[$60>>2] = $62;
   $storemerge = $53;$storemerge1 = $51;
  } else {
   $63 = $3 & 1;
   $64 = $63 | $49;
   $65 = $64 | 2;
   HEAP32[$2>>2] = $65;
   $66 = (($0) + ($49)|0);
   $67 = ((($66)) + 4|0);
   $68 = HEAP32[$67>>2]|0;
   $69 = $68 | 1;
   HEAP32[$67>>2] = $69;
   $storemerge = 0;$storemerge1 = 0;
  }
  HEAP32[(19816)>>2] = $storemerge1;
  HEAP32[(19828)>>2] = $storemerge;
  $$2 = $0;
  return ($$2|0);
 }
 $70 = $10 & 2;
 $71 = ($70|0)==(0);
 if (!($71)) {
  $$2 = 0;
  return ($$2|0);
 }
 $72 = $10 & -8;
 $73 = (($72) + ($4))|0;
 $74 = ($73>>>0)<($1>>>0);
 if ($74) {
  $$2 = 0;
  return ($$2|0);
 }
 $75 = (($73) - ($1))|0;
 $76 = $10 >>> 3;
 $77 = ($10>>>0)<(256);
 do {
  if ($77) {
   $78 = ((($5)) + 8|0);
   $79 = HEAP32[$78>>2]|0;
   $80 = ((($5)) + 12|0);
   $81 = HEAP32[$80>>2]|0;
   $82 = $76 << 1;
   $83 = (19848 + ($82<<2)|0);
   $84 = ($79|0)==($83|0);
   if (!($84)) {
    $85 = ($79>>>0)<($6>>>0);
    if ($85) {
     _abort();
     // unreachable;
    }
    $86 = ((($79)) + 12|0);
    $87 = HEAP32[$86>>2]|0;
    $88 = ($87|0)==($5|0);
    if (!($88)) {
     _abort();
     // unreachable;
    }
   }
   $89 = ($81|0)==($79|0);
   if ($89) {
    $90 = 1 << $76;
    $91 = $90 ^ -1;
    $92 = HEAP32[4952]|0;
    $93 = $92 & $91;
    HEAP32[4952] = $93;
    break;
   }
   $94 = ($81|0)==($83|0);
   if ($94) {
    $$pre = ((($81)) + 8|0);
    $$pre$phiZ2D = $$pre;
   } else {
    $95 = ($81>>>0)<($6>>>0);
    if ($95) {
     _abort();
     // unreachable;
    }
    $96 = ((($81)) + 8|0);
    $97 = HEAP32[$96>>2]|0;
    $98 = ($97|0)==($5|0);
    if ($98) {
     $$pre$phiZ2D = $96;
    } else {
     _abort();
     // unreachable;
    }
   }
   $99 = ((($79)) + 12|0);
   HEAP32[$99>>2] = $81;
   HEAP32[$$pre$phiZ2D>>2] = $79;
  } else {
   $100 = ((($5)) + 24|0);
   $101 = HEAP32[$100>>2]|0;
   $102 = ((($5)) + 12|0);
   $103 = HEAP32[$102>>2]|0;
   $104 = ($103|0)==($5|0);
   do {
    if ($104) {
     $114 = ((($5)) + 16|0);
     $115 = ((($114)) + 4|0);
     $116 = HEAP32[$115>>2]|0;
     $117 = ($116|0)==(0|0);
     if ($117) {
      $118 = HEAP32[$114>>2]|0;
      $119 = ($118|0)==(0|0);
      if ($119) {
       $$3 = 0;
       break;
      } else {
       $$1271 = $118;$$1274 = $114;
      }
     } else {
      $$1271 = $116;$$1274 = $115;
     }
     while(1) {
      $120 = ((($$1271)) + 20|0);
      $121 = HEAP32[$120>>2]|0;
      $122 = ($121|0)==(0|0);
      if (!($122)) {
       $$1271 = $121;$$1274 = $120;
       continue;
      }
      $123 = ((($$1271)) + 16|0);
      $124 = HEAP32[$123>>2]|0;
      $125 = ($124|0)==(0|0);
      if ($125) {
       break;
      } else {
       $$1271 = $124;$$1274 = $123;
      }
     }
     $126 = ($$1274>>>0)<($6>>>0);
     if ($126) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1274>>2] = 0;
      $$3 = $$1271;
      break;
     }
    } else {
     $105 = ((($5)) + 8|0);
     $106 = HEAP32[$105>>2]|0;
     $107 = ($106>>>0)<($6>>>0);
     if ($107) {
      _abort();
      // unreachable;
     }
     $108 = ((($106)) + 12|0);
     $109 = HEAP32[$108>>2]|0;
     $110 = ($109|0)==($5|0);
     if (!($110)) {
      _abort();
      // unreachable;
     }
     $111 = ((($103)) + 8|0);
     $112 = HEAP32[$111>>2]|0;
     $113 = ($112|0)==($5|0);
     if ($113) {
      HEAP32[$108>>2] = $103;
      HEAP32[$111>>2] = $106;
      $$3 = $103;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $127 = ($101|0)==(0|0);
   if (!($127)) {
    $128 = ((($5)) + 28|0);
    $129 = HEAP32[$128>>2]|0;
    $130 = (20112 + ($129<<2)|0);
    $131 = HEAP32[$130>>2]|0;
    $132 = ($5|0)==($131|0);
    if ($132) {
     HEAP32[$130>>2] = $$3;
     $cond = ($$3|0)==(0|0);
     if ($cond) {
      $133 = 1 << $129;
      $134 = $133 ^ -1;
      $135 = HEAP32[(19812)>>2]|0;
      $136 = $135 & $134;
      HEAP32[(19812)>>2] = $136;
      break;
     }
    } else {
     $137 = HEAP32[(19824)>>2]|0;
     $138 = ($101>>>0)<($137>>>0);
     if ($138) {
      _abort();
      // unreachable;
     }
     $139 = ((($101)) + 16|0);
     $140 = HEAP32[$139>>2]|0;
     $141 = ($140|0)==($5|0);
     if ($141) {
      HEAP32[$139>>2] = $$3;
     } else {
      $142 = ((($101)) + 20|0);
      HEAP32[$142>>2] = $$3;
     }
     $143 = ($$3|0)==(0|0);
     if ($143) {
      break;
     }
    }
    $144 = HEAP32[(19824)>>2]|0;
    $145 = ($$3>>>0)<($144>>>0);
    if ($145) {
     _abort();
     // unreachable;
    }
    $146 = ((($$3)) + 24|0);
    HEAP32[$146>>2] = $101;
    $147 = ((($5)) + 16|0);
    $148 = HEAP32[$147>>2]|0;
    $149 = ($148|0)==(0|0);
    do {
     if (!($149)) {
      $150 = ($148>>>0)<($144>>>0);
      if ($150) {
       _abort();
       // unreachable;
      } else {
       $151 = ((($$3)) + 16|0);
       HEAP32[$151>>2] = $148;
       $152 = ((($148)) + 24|0);
       HEAP32[$152>>2] = $$3;
       break;
      }
     }
    } while(0);
    $153 = ((($147)) + 4|0);
    $154 = HEAP32[$153>>2]|0;
    $155 = ($154|0)==(0|0);
    if (!($155)) {
     $156 = HEAP32[(19824)>>2]|0;
     $157 = ($154>>>0)<($156>>>0);
     if ($157) {
      _abort();
      // unreachable;
     } else {
      $158 = ((($$3)) + 20|0);
      HEAP32[$158>>2] = $154;
      $159 = ((($154)) + 24|0);
      HEAP32[$159>>2] = $$3;
      break;
     }
    }
   }
  }
 } while(0);
 $160 = ($75>>>0)<(16);
 if ($160) {
  $161 = $3 & 1;
  $162 = $73 | $161;
  $163 = $162 | 2;
  HEAP32[$2>>2] = $163;
  $164 = (($0) + ($73)|0);
  $165 = ((($164)) + 4|0);
  $166 = HEAP32[$165>>2]|0;
  $167 = $166 | 1;
  HEAP32[$165>>2] = $167;
  $$2 = $0;
  return ($$2|0);
 } else {
  $168 = (($0) + ($1)|0);
  $169 = $3 & 1;
  $170 = $169 | $1;
  $171 = $170 | 2;
  HEAP32[$2>>2] = $171;
  $172 = ((($168)) + 4|0);
  $173 = $75 | 3;
  HEAP32[$172>>2] = $173;
  $174 = (($168) + ($75)|0);
  $175 = ((($174)) + 4|0);
  $176 = HEAP32[$175>>2]|0;
  $177 = $176 | 1;
  HEAP32[$175>>2] = $177;
  _dispose_chunk($168,$75);
  $$2 = $0;
  return ($$2|0);
 }
 return (0)|0;
}
function _dispose_chunk($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0417 = 0, $$0418 = 0, $$0429 = 0, $$0436 = 0, $$1 = 0, $$1416 = 0, $$1424 = 0, $$1427 = 0, $$1431 = 0, $$1435 = 0, $$2 = 0, $$3 = 0, $$3433 = 0, $$pre = 0, $$pre$phi22Z2D = 0, $$pre$phi24Z2D = 0, $$pre$phiZ2D = 0, $$pre21 = 0, $$pre23 = 0, $10 = 0;
 var $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0;
 var $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0;
 var $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0;
 var $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0;
 var $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0;
 var $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0;
 var $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0;
 var $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond = 0, $cond16 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (($0) + ($1)|0);
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = $4 & 1;
 $6 = ($5|0)==(0);
 do {
  if ($6) {
   $7 = HEAP32[$0>>2]|0;
   $8 = $4 & 3;
   $9 = ($8|0)==(0);
   if ($9) {
    return;
   }
   $10 = (0 - ($7))|0;
   $11 = (($0) + ($10)|0);
   $12 = (($7) + ($1))|0;
   $13 = HEAP32[(19824)>>2]|0;
   $14 = ($11>>>0)<($13>>>0);
   if ($14) {
    _abort();
    // unreachable;
   }
   $15 = HEAP32[(19828)>>2]|0;
   $16 = ($11|0)==($15|0);
   if ($16) {
    $101 = ((($2)) + 4|0);
    $102 = HEAP32[$101>>2]|0;
    $103 = $102 & 3;
    $104 = ($103|0)==(3);
    if (!($104)) {
     $$1 = $11;$$1416 = $12;
     break;
    }
    HEAP32[(19816)>>2] = $12;
    $105 = $102 & -2;
    HEAP32[$101>>2] = $105;
    $106 = $12 | 1;
    $107 = ((($11)) + 4|0);
    HEAP32[$107>>2] = $106;
    $108 = (($11) + ($12)|0);
    HEAP32[$108>>2] = $12;
    return;
   }
   $17 = $7 >>> 3;
   $18 = ($7>>>0)<(256);
   if ($18) {
    $19 = ((($11)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ((($11)) + 12|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = $17 << 1;
    $24 = (19848 + ($23<<2)|0);
    $25 = ($20|0)==($24|0);
    if (!($25)) {
     $26 = ($20>>>0)<($13>>>0);
     if ($26) {
      _abort();
      // unreachable;
     }
     $27 = ((($20)) + 12|0);
     $28 = HEAP32[$27>>2]|0;
     $29 = ($28|0)==($11|0);
     if (!($29)) {
      _abort();
      // unreachable;
     }
    }
    $30 = ($22|0)==($20|0);
    if ($30) {
     $31 = 1 << $17;
     $32 = $31 ^ -1;
     $33 = HEAP32[4952]|0;
     $34 = $33 & $32;
     HEAP32[4952] = $34;
     $$1 = $11;$$1416 = $12;
     break;
    }
    $35 = ($22|0)==($24|0);
    if ($35) {
     $$pre23 = ((($22)) + 8|0);
     $$pre$phi24Z2D = $$pre23;
    } else {
     $36 = ($22>>>0)<($13>>>0);
     if ($36) {
      _abort();
      // unreachable;
     }
     $37 = ((($22)) + 8|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = ($38|0)==($11|0);
     if ($39) {
      $$pre$phi24Z2D = $37;
     } else {
      _abort();
      // unreachable;
     }
    }
    $40 = ((($20)) + 12|0);
    HEAP32[$40>>2] = $22;
    HEAP32[$$pre$phi24Z2D>>2] = $20;
    $$1 = $11;$$1416 = $12;
    break;
   }
   $41 = ((($11)) + 24|0);
   $42 = HEAP32[$41>>2]|0;
   $43 = ((($11)) + 12|0);
   $44 = HEAP32[$43>>2]|0;
   $45 = ($44|0)==($11|0);
   do {
    if ($45) {
     $55 = ((($11)) + 16|0);
     $56 = ((($55)) + 4|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = ($57|0)==(0|0);
     if ($58) {
      $59 = HEAP32[$55>>2]|0;
      $60 = ($59|0)==(0|0);
      if ($60) {
       $$3 = 0;
       break;
      } else {
       $$1424 = $59;$$1427 = $55;
      }
     } else {
      $$1424 = $57;$$1427 = $56;
     }
     while(1) {
      $61 = ((($$1424)) + 20|0);
      $62 = HEAP32[$61>>2]|0;
      $63 = ($62|0)==(0|0);
      if (!($63)) {
       $$1424 = $62;$$1427 = $61;
       continue;
      }
      $64 = ((($$1424)) + 16|0);
      $65 = HEAP32[$64>>2]|0;
      $66 = ($65|0)==(0|0);
      if ($66) {
       break;
      } else {
       $$1424 = $65;$$1427 = $64;
      }
     }
     $67 = ($$1427>>>0)<($13>>>0);
     if ($67) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1427>>2] = 0;
      $$3 = $$1424;
      break;
     }
    } else {
     $46 = ((($11)) + 8|0);
     $47 = HEAP32[$46>>2]|0;
     $48 = ($47>>>0)<($13>>>0);
     if ($48) {
      _abort();
      // unreachable;
     }
     $49 = ((($47)) + 12|0);
     $50 = HEAP32[$49>>2]|0;
     $51 = ($50|0)==($11|0);
     if (!($51)) {
      _abort();
      // unreachable;
     }
     $52 = ((($44)) + 8|0);
     $53 = HEAP32[$52>>2]|0;
     $54 = ($53|0)==($11|0);
     if ($54) {
      HEAP32[$49>>2] = $44;
      HEAP32[$52>>2] = $47;
      $$3 = $44;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $68 = ($42|0)==(0|0);
   if ($68) {
    $$1 = $11;$$1416 = $12;
   } else {
    $69 = ((($11)) + 28|0);
    $70 = HEAP32[$69>>2]|0;
    $71 = (20112 + ($70<<2)|0);
    $72 = HEAP32[$71>>2]|0;
    $73 = ($11|0)==($72|0);
    if ($73) {
     HEAP32[$71>>2] = $$3;
     $cond = ($$3|0)==(0|0);
     if ($cond) {
      $74 = 1 << $70;
      $75 = $74 ^ -1;
      $76 = HEAP32[(19812)>>2]|0;
      $77 = $76 & $75;
      HEAP32[(19812)>>2] = $77;
      $$1 = $11;$$1416 = $12;
      break;
     }
    } else {
     $78 = HEAP32[(19824)>>2]|0;
     $79 = ($42>>>0)<($78>>>0);
     if ($79) {
      _abort();
      // unreachable;
     }
     $80 = ((($42)) + 16|0);
     $81 = HEAP32[$80>>2]|0;
     $82 = ($81|0)==($11|0);
     if ($82) {
      HEAP32[$80>>2] = $$3;
     } else {
      $83 = ((($42)) + 20|0);
      HEAP32[$83>>2] = $$3;
     }
     $84 = ($$3|0)==(0|0);
     if ($84) {
      $$1 = $11;$$1416 = $12;
      break;
     }
    }
    $85 = HEAP32[(19824)>>2]|0;
    $86 = ($$3>>>0)<($85>>>0);
    if ($86) {
     _abort();
     // unreachable;
    }
    $87 = ((($$3)) + 24|0);
    HEAP32[$87>>2] = $42;
    $88 = ((($11)) + 16|0);
    $89 = HEAP32[$88>>2]|0;
    $90 = ($89|0)==(0|0);
    do {
     if (!($90)) {
      $91 = ($89>>>0)<($85>>>0);
      if ($91) {
       _abort();
       // unreachable;
      } else {
       $92 = ((($$3)) + 16|0);
       HEAP32[$92>>2] = $89;
       $93 = ((($89)) + 24|0);
       HEAP32[$93>>2] = $$3;
       break;
      }
     }
    } while(0);
    $94 = ((($88)) + 4|0);
    $95 = HEAP32[$94>>2]|0;
    $96 = ($95|0)==(0|0);
    if ($96) {
     $$1 = $11;$$1416 = $12;
    } else {
     $97 = HEAP32[(19824)>>2]|0;
     $98 = ($95>>>0)<($97>>>0);
     if ($98) {
      _abort();
      // unreachable;
     } else {
      $99 = ((($$3)) + 20|0);
      HEAP32[$99>>2] = $95;
      $100 = ((($95)) + 24|0);
      HEAP32[$100>>2] = $$3;
      $$1 = $11;$$1416 = $12;
      break;
     }
    }
   }
  } else {
   $$1 = $0;$$1416 = $1;
  }
 } while(0);
 $109 = HEAP32[(19824)>>2]|0;
 $110 = ($2>>>0)<($109>>>0);
 if ($110) {
  _abort();
  // unreachable;
 }
 $111 = ((($2)) + 4|0);
 $112 = HEAP32[$111>>2]|0;
 $113 = $112 & 2;
 $114 = ($113|0)==(0);
 if ($114) {
  $115 = HEAP32[(19832)>>2]|0;
  $116 = ($2|0)==($115|0);
  if ($116) {
   $117 = HEAP32[(19820)>>2]|0;
   $118 = (($117) + ($$1416))|0;
   HEAP32[(19820)>>2] = $118;
   HEAP32[(19832)>>2] = $$1;
   $119 = $118 | 1;
   $120 = ((($$1)) + 4|0);
   HEAP32[$120>>2] = $119;
   $121 = HEAP32[(19828)>>2]|0;
   $122 = ($$1|0)==($121|0);
   if (!($122)) {
    return;
   }
   HEAP32[(19828)>>2] = 0;
   HEAP32[(19816)>>2] = 0;
   return;
  }
  $123 = HEAP32[(19828)>>2]|0;
  $124 = ($2|0)==($123|0);
  if ($124) {
   $125 = HEAP32[(19816)>>2]|0;
   $126 = (($125) + ($$1416))|0;
   HEAP32[(19816)>>2] = $126;
   HEAP32[(19828)>>2] = $$1;
   $127 = $126 | 1;
   $128 = ((($$1)) + 4|0);
   HEAP32[$128>>2] = $127;
   $129 = (($$1) + ($126)|0);
   HEAP32[$129>>2] = $126;
   return;
  }
  $130 = $112 & -8;
  $131 = (($130) + ($$1416))|0;
  $132 = $112 >>> 3;
  $133 = ($112>>>0)<(256);
  do {
   if ($133) {
    $134 = ((($2)) + 8|0);
    $135 = HEAP32[$134>>2]|0;
    $136 = ((($2)) + 12|0);
    $137 = HEAP32[$136>>2]|0;
    $138 = $132 << 1;
    $139 = (19848 + ($138<<2)|0);
    $140 = ($135|0)==($139|0);
    if (!($140)) {
     $141 = ($135>>>0)<($109>>>0);
     if ($141) {
      _abort();
      // unreachable;
     }
     $142 = ((($135)) + 12|0);
     $143 = HEAP32[$142>>2]|0;
     $144 = ($143|0)==($2|0);
     if (!($144)) {
      _abort();
      // unreachable;
     }
    }
    $145 = ($137|0)==($135|0);
    if ($145) {
     $146 = 1 << $132;
     $147 = $146 ^ -1;
     $148 = HEAP32[4952]|0;
     $149 = $148 & $147;
     HEAP32[4952] = $149;
     break;
    }
    $150 = ($137|0)==($139|0);
    if ($150) {
     $$pre21 = ((($137)) + 8|0);
     $$pre$phi22Z2D = $$pre21;
    } else {
     $151 = ($137>>>0)<($109>>>0);
     if ($151) {
      _abort();
      // unreachable;
     }
     $152 = ((($137)) + 8|0);
     $153 = HEAP32[$152>>2]|0;
     $154 = ($153|0)==($2|0);
     if ($154) {
      $$pre$phi22Z2D = $152;
     } else {
      _abort();
      // unreachable;
     }
    }
    $155 = ((($135)) + 12|0);
    HEAP32[$155>>2] = $137;
    HEAP32[$$pre$phi22Z2D>>2] = $135;
   } else {
    $156 = ((($2)) + 24|0);
    $157 = HEAP32[$156>>2]|0;
    $158 = ((($2)) + 12|0);
    $159 = HEAP32[$158>>2]|0;
    $160 = ($159|0)==($2|0);
    do {
     if ($160) {
      $170 = ((($2)) + 16|0);
      $171 = ((($170)) + 4|0);
      $172 = HEAP32[$171>>2]|0;
      $173 = ($172|0)==(0|0);
      if ($173) {
       $174 = HEAP32[$170>>2]|0;
       $175 = ($174|0)==(0|0);
       if ($175) {
        $$3433 = 0;
        break;
       } else {
        $$1431 = $174;$$1435 = $170;
       }
      } else {
       $$1431 = $172;$$1435 = $171;
      }
      while(1) {
       $176 = ((($$1431)) + 20|0);
       $177 = HEAP32[$176>>2]|0;
       $178 = ($177|0)==(0|0);
       if (!($178)) {
        $$1431 = $177;$$1435 = $176;
        continue;
       }
       $179 = ((($$1431)) + 16|0);
       $180 = HEAP32[$179>>2]|0;
       $181 = ($180|0)==(0|0);
       if ($181) {
        break;
       } else {
        $$1431 = $180;$$1435 = $179;
       }
      }
      $182 = ($$1435>>>0)<($109>>>0);
      if ($182) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$1435>>2] = 0;
       $$3433 = $$1431;
       break;
      }
     } else {
      $161 = ((($2)) + 8|0);
      $162 = HEAP32[$161>>2]|0;
      $163 = ($162>>>0)<($109>>>0);
      if ($163) {
       _abort();
       // unreachable;
      }
      $164 = ((($162)) + 12|0);
      $165 = HEAP32[$164>>2]|0;
      $166 = ($165|0)==($2|0);
      if (!($166)) {
       _abort();
       // unreachable;
      }
      $167 = ((($159)) + 8|0);
      $168 = HEAP32[$167>>2]|0;
      $169 = ($168|0)==($2|0);
      if ($169) {
       HEAP32[$164>>2] = $159;
       HEAP32[$167>>2] = $162;
       $$3433 = $159;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $183 = ($157|0)==(0|0);
    if (!($183)) {
     $184 = ((($2)) + 28|0);
     $185 = HEAP32[$184>>2]|0;
     $186 = (20112 + ($185<<2)|0);
     $187 = HEAP32[$186>>2]|0;
     $188 = ($2|0)==($187|0);
     if ($188) {
      HEAP32[$186>>2] = $$3433;
      $cond16 = ($$3433|0)==(0|0);
      if ($cond16) {
       $189 = 1 << $185;
       $190 = $189 ^ -1;
       $191 = HEAP32[(19812)>>2]|0;
       $192 = $191 & $190;
       HEAP32[(19812)>>2] = $192;
       break;
      }
     } else {
      $193 = HEAP32[(19824)>>2]|0;
      $194 = ($157>>>0)<($193>>>0);
      if ($194) {
       _abort();
       // unreachable;
      }
      $195 = ((($157)) + 16|0);
      $196 = HEAP32[$195>>2]|0;
      $197 = ($196|0)==($2|0);
      if ($197) {
       HEAP32[$195>>2] = $$3433;
      } else {
       $198 = ((($157)) + 20|0);
       HEAP32[$198>>2] = $$3433;
      }
      $199 = ($$3433|0)==(0|0);
      if ($199) {
       break;
      }
     }
     $200 = HEAP32[(19824)>>2]|0;
     $201 = ($$3433>>>0)<($200>>>0);
     if ($201) {
      _abort();
      // unreachable;
     }
     $202 = ((($$3433)) + 24|0);
     HEAP32[$202>>2] = $157;
     $203 = ((($2)) + 16|0);
     $204 = HEAP32[$203>>2]|0;
     $205 = ($204|0)==(0|0);
     do {
      if (!($205)) {
       $206 = ($204>>>0)<($200>>>0);
       if ($206) {
        _abort();
        // unreachable;
       } else {
        $207 = ((($$3433)) + 16|0);
        HEAP32[$207>>2] = $204;
        $208 = ((($204)) + 24|0);
        HEAP32[$208>>2] = $$3433;
        break;
       }
      }
     } while(0);
     $209 = ((($203)) + 4|0);
     $210 = HEAP32[$209>>2]|0;
     $211 = ($210|0)==(0|0);
     if (!($211)) {
      $212 = HEAP32[(19824)>>2]|0;
      $213 = ($210>>>0)<($212>>>0);
      if ($213) {
       _abort();
       // unreachable;
      } else {
       $214 = ((($$3433)) + 20|0);
       HEAP32[$214>>2] = $210;
       $215 = ((($210)) + 24|0);
       HEAP32[$215>>2] = $$3433;
       break;
      }
     }
    }
   }
  } while(0);
  $216 = $131 | 1;
  $217 = ((($$1)) + 4|0);
  HEAP32[$217>>2] = $216;
  $218 = (($$1) + ($131)|0);
  HEAP32[$218>>2] = $131;
  $219 = HEAP32[(19828)>>2]|0;
  $220 = ($$1|0)==($219|0);
  if ($220) {
   HEAP32[(19816)>>2] = $131;
   return;
  } else {
   $$2 = $131;
  }
 } else {
  $221 = $112 & -2;
  HEAP32[$111>>2] = $221;
  $222 = $$1416 | 1;
  $223 = ((($$1)) + 4|0);
  HEAP32[$223>>2] = $222;
  $224 = (($$1) + ($$1416)|0);
  HEAP32[$224>>2] = $$1416;
  $$2 = $$1416;
 }
 $225 = $$2 >>> 3;
 $226 = ($$2>>>0)<(256);
 if ($226) {
  $227 = $225 << 1;
  $228 = (19848 + ($227<<2)|0);
  $229 = HEAP32[4952]|0;
  $230 = 1 << $225;
  $231 = $229 & $230;
  $232 = ($231|0)==(0);
  if ($232) {
   $233 = $229 | $230;
   HEAP32[4952] = $233;
   $$pre = ((($228)) + 8|0);
   $$0436 = $228;$$pre$phiZ2D = $$pre;
  } else {
   $234 = ((($228)) + 8|0);
   $235 = HEAP32[$234>>2]|0;
   $236 = HEAP32[(19824)>>2]|0;
   $237 = ($235>>>0)<($236>>>0);
   if ($237) {
    _abort();
    // unreachable;
   } else {
    $$0436 = $235;$$pre$phiZ2D = $234;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $238 = ((($$0436)) + 12|0);
  HEAP32[$238>>2] = $$1;
  $239 = ((($$1)) + 8|0);
  HEAP32[$239>>2] = $$0436;
  $240 = ((($$1)) + 12|0);
  HEAP32[$240>>2] = $228;
  return;
 }
 $241 = $$2 >>> 8;
 $242 = ($241|0)==(0);
 if ($242) {
  $$0429 = 0;
 } else {
  $243 = ($$2>>>0)>(16777215);
  if ($243) {
   $$0429 = 31;
  } else {
   $244 = (($241) + 1048320)|0;
   $245 = $244 >>> 16;
   $246 = $245 & 8;
   $247 = $241 << $246;
   $248 = (($247) + 520192)|0;
   $249 = $248 >>> 16;
   $250 = $249 & 4;
   $251 = $250 | $246;
   $252 = $247 << $250;
   $253 = (($252) + 245760)|0;
   $254 = $253 >>> 16;
   $255 = $254 & 2;
   $256 = $251 | $255;
   $257 = (14 - ($256))|0;
   $258 = $252 << $255;
   $259 = $258 >>> 15;
   $260 = (($257) + ($259))|0;
   $261 = $260 << 1;
   $262 = (($260) + 7)|0;
   $263 = $$2 >>> $262;
   $264 = $263 & 1;
   $265 = $264 | $261;
   $$0429 = $265;
  }
 }
 $266 = (20112 + ($$0429<<2)|0);
 $267 = ((($$1)) + 28|0);
 HEAP32[$267>>2] = $$0429;
 $268 = ((($$1)) + 16|0);
 $269 = ((($$1)) + 20|0);
 HEAP32[$269>>2] = 0;
 HEAP32[$268>>2] = 0;
 $270 = HEAP32[(19812)>>2]|0;
 $271 = 1 << $$0429;
 $272 = $270 & $271;
 $273 = ($272|0)==(0);
 if ($273) {
  $274 = $270 | $271;
  HEAP32[(19812)>>2] = $274;
  HEAP32[$266>>2] = $$1;
  $275 = ((($$1)) + 24|0);
  HEAP32[$275>>2] = $266;
  $276 = ((($$1)) + 12|0);
  HEAP32[$276>>2] = $$1;
  $277 = ((($$1)) + 8|0);
  HEAP32[$277>>2] = $$1;
  return;
 }
 $278 = HEAP32[$266>>2]|0;
 $279 = ($$0429|0)==(31);
 $280 = $$0429 >>> 1;
 $281 = (25 - ($280))|0;
 $282 = $279 ? 0 : $281;
 $283 = $$2 << $282;
 $$0417 = $283;$$0418 = $278;
 while(1) {
  $284 = ((($$0418)) + 4|0);
  $285 = HEAP32[$284>>2]|0;
  $286 = $285 & -8;
  $287 = ($286|0)==($$2|0);
  if ($287) {
   label = 127;
   break;
  }
  $288 = $$0417 >>> 31;
  $289 = (((($$0418)) + 16|0) + ($288<<2)|0);
  $290 = $$0417 << 1;
  $291 = HEAP32[$289>>2]|0;
  $292 = ($291|0)==(0|0);
  if ($292) {
   label = 124;
   break;
  } else {
   $$0417 = $290;$$0418 = $291;
  }
 }
 if ((label|0) == 124) {
  $293 = HEAP32[(19824)>>2]|0;
  $294 = ($289>>>0)<($293>>>0);
  if ($294) {
   _abort();
   // unreachable;
  }
  HEAP32[$289>>2] = $$1;
  $295 = ((($$1)) + 24|0);
  HEAP32[$295>>2] = $$0418;
  $296 = ((($$1)) + 12|0);
  HEAP32[$296>>2] = $$1;
  $297 = ((($$1)) + 8|0);
  HEAP32[$297>>2] = $$1;
  return;
 }
 else if ((label|0) == 127) {
  $298 = ((($$0418)) + 8|0);
  $299 = HEAP32[$298>>2]|0;
  $300 = HEAP32[(19824)>>2]|0;
  $301 = ($299>>>0)>=($300>>>0);
  $not$ = ($$0418>>>0)>=($300>>>0);
  $302 = $301 & $not$;
  if (!($302)) {
   _abort();
   // unreachable;
  }
  $303 = ((($299)) + 12|0);
  HEAP32[$303>>2] = $$1;
  HEAP32[$298>>2] = $$1;
  $304 = ((($$1)) + 8|0);
  HEAP32[$304>>2] = $299;
  $305 = ((($$1)) + 12|0);
  HEAP32[$305>>2] = $$0418;
  $306 = ((($$1)) + 24|0);
  HEAP32[$306>>2] = 0;
  return;
 }
}
function runPostSets() {
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
    stop = (ptr + num)|0;
    if ((num|0) >= 20) {
      // This is unaligned, but quite large, so work hard to get to aligned settings
      value = value & 0xff;
      unaligned = ptr & 3;
      value4 = value | (value << 8) | (value << 16) | (value << 24);
      stop4 = stop & ~3;
      if (unaligned) {
        unaligned = (ptr + 4 - unaligned)|0;
        while ((ptr|0) < (unaligned|0)) { // no need to check for stop, since we have large num
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
      }
      while ((ptr|0) < (stop4|0)) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    while ((ptr|0) < (stop|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (ptr-num)|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    $rem = $rem | 0;
    var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
    $n_sroa_0_0_extract_trunc = $a$0;
    $n_sroa_1_4_extract_shift$0 = $a$1;
    $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
    $d_sroa_0_0_extract_trunc = $b$0;
    $d_sroa_1_4_extract_shift$0 = $b$1;
    $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
    if (($n_sroa_1_4_extract_trunc | 0) == 0) {
      $4 = ($rem | 0) != 0;
      if (($d_sroa_1_4_extract_trunc | 0) == 0) {
        if ($4) {
          HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$4) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
    $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
    do {
      if (($d_sroa_0_0_extract_trunc | 0) == 0) {
        if ($17) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
            HEAP32[$rem + 4 >> 2] = 0;
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        if (($n_sroa_0_0_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0;
            HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
        if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0 | $a$0 & -1;
            HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
          }
          $_0$1 = 0;
          $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($51 >>> 0 <= 30) {
          $57 = $51 + 1 | 0;
          $58 = 31 - $51 | 0;
          $sr_1_ph = $57;
          $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$17) {
          $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
          $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          if ($119 >>> 0 <= 31) {
            $125 = $119 + 1 | 0;
            $126 = 31 - $119 | 0;
            $130 = $119 - 31 >> 31;
            $sr_1_ph = $125;
            $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
            $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
            $q_sroa_0_1_ph = 0;
            $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
            break;
          }
          if (($rem | 0) == 0) {
            $_0$1 = 0;
            $_0$0 = 0;
            return (tempRet0 = $_0$1, $_0$0) | 0;
          }
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
        if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
          $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
          $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          $89 = 64 - $88 | 0;
          $91 = 32 - $88 | 0;
          $92 = $91 >> 31;
          $95 = $88 - 32 | 0;
          $105 = $95 >> 31;
          $sr_1_ph = $88;
          $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
          $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
          $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
          $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
          break;
        }
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
          HEAP32[$rem + 4 >> 2] = 0;
        }
        if (($d_sroa_0_0_extract_trunc | 0) == 1) {
          $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$0 = 0 | $a$0 & -1;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        } else {
          $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
          $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
          $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
      }
    } while (0);
    if (($sr_1_ph | 0) == 0) {
      $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
      $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
      $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
      $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = 0;
    } else {
      $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
      $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
      $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
      $137$1 = tempRet0;
      $q_sroa_1_1198 = $q_sroa_1_1_ph;
      $q_sroa_0_1199 = $q_sroa_0_1_ph;
      $r_sroa_1_1200 = $r_sroa_1_1_ph;
      $r_sroa_0_1201 = $r_sroa_0_1_ph;
      $sr_1202 = $sr_1_ph;
      $carry_0203 = 0;
      while (1) {
        $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
        $149 = $carry_0203 | $q_sroa_0_1199 << 1;
        $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
        $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
        _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
        $150$1 = tempRet0;
        $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
        $152 = $151$0 & 1;
        $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
        $r_sroa_0_0_extract_trunc = $154$0;
        $r_sroa_1_4_extract_trunc = tempRet0;
        $155 = $sr_1202 - 1 | 0;
        if (($155 | 0) == 0) {
          break;
        } else {
          $q_sroa_1_1198 = $147;
          $q_sroa_0_1199 = $149;
          $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
          $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
          $sr_1202 = $155;
          $carry_0203 = $152;
        }
      }
      $q_sroa_1_1_lcssa = $147;
      $q_sroa_0_1_lcssa = $149;
      $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
      $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = $152;
    }
    $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
    $q_sroa_0_0_insert_ext75$1 = 0;
    $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
    if (($rem | 0) != 0) {
      HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
      HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
    }
    $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
    $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $1$0 = 0;
    $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
    return $1$0 | 0;
}
function ___muldsi3($a, $b) {
    $a = $a | 0;
    $b = $b | 0;
    var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
    $1 = $a & 65535;
    $2 = $b & 65535;
    $3 = Math_imul($2, $1) | 0;
    $6 = $a >>> 16;
    $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
    $11 = $b >>> 16;
    $12 = Math_imul($11, $1) | 0;
    return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
    $x_sroa_0_0_extract_trunc = $a$0;
    $y_sroa_0_0_extract_trunc = $b$0;
    $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
    $1$1 = tempRet0;
    $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
    return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $rem = 0, __stackBase__ = 0;
    __stackBase__ = STACKTOP;
    STACKTOP = STACKTOP + 16 | 0;
    $rem = __stackBase__ | 0;
    ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
    STACKTOP = __stackBase__;
    return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if ((num|0) >= 4096) return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    ret = dest|0;
    if ((dest&3) == (src&3)) {
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      while ((num|0) >= 4) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
        num = (num-4)|0;
      }
    }
    while ((num|0) > 0) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
      num = (num-1)|0;
    }
    return ret|0;
}
function _pthread_self() {
    return 0;
}

  
function dynCall_i(index) {
  index = index|0;
  
  return FUNCTION_TABLE_i[index&63]()|0;
}


function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&15](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}


function dynCall_vii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  FUNCTION_TABLE_vii[index&7](a1|0,a2|0);
}


function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&15](a1|0);
}

function b0() {
 ; abort(0);return 0;
}
function b1(p0) {
 p0 = p0|0; abort(1);return 0;
}
function b2(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(2);return 0;
}
function b3(p0,p1) {
 p0 = p0|0;p1 = p1|0; abort(3);
}
function b4(p0) {
 p0 = p0|0; abort(4);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_i = [b0,_po_initmem,_po_to,_po_byte,_po_16,_po_be16,_po_le16,_po_24,_po_be24,_po_le24,_po_32,_po_be32,_po_le32,_obsolete_po_cbm,_po_convtab,_po_text,_po_raw,_po_pet,_po_scr,_po_scrxor,_po_binary,_po_fill,_po_align,_po_pseudopc,_obsolete_po_realpc,_po_cpu,_po_al,_po_as,_po_rl
,_po_rs,_po_address,_po_set,_po_symbollist,_po_zone,_obsolete_po_subzone,_po_source,_po_if,_po_ifdef,_po_ifndef,_po_for,_po_do,_po_macro,_po_warn,_po_error,_po_serious,_po_endoffile,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,b0,b0];
var FUNCTION_TABLE_ii = [b1,_keyword_is_6502mnemo,_keyword_is_6510mnemo,_keyword_is_c64dtv2mnemo,_keyword_is_65c02mnemo,_keyword_is_65816mnemo,_encoderfn_raw,_encoderfn_pet,_encoderfn_scr,_encoderfn_file,___stdio_close,_short_option,_long_option,b1,b1,b1];
var FUNCTION_TABLE_iiii = [b2,___stdio_write,___stdio_seek,___stdout_write,_sn_write,___stdio_read,b2,b2];
var FUNCTION_TABLE_vii = [b3,_dump_one_symbol,_dump_vice_unusednonaddress,_dump_vice_usednonaddress,_dump_vice_address,b3,b3,b3];
var FUNCTION_TABLE_vi = [b4,_Throw_error,_no_output,_real_output,_output_le16,_output_be16,_output_le24,_output_be24,_output_le32,_output_be32,_Throw_warning,_Throw_serious_error,_cleanup_88,_cleanup,b4,b4];

  return { ___muldsi3: ___muldsi3, _i64Subtract: _i64Subtract, _free: _free, _main: _main, _i64Add: _i64Add, _pthread_self: _pthread_self, _memset: _memset, _llvm_cttz_i32: _llvm_cttz_i32, _malloc: _malloc, _memcpy: _memcpy, ___muldi3: ___muldi3, _bitshift64Shl: _bitshift64Shl, _bitshift64Lshr: _bitshift64Lshr, ___udivdi3: ___udivdi3, ___uremdi3: ___uremdi3, ___errno_location: ___errno_location, ___udivmoddi4: ___udivmoddi4, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_i: dynCall_i, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_vii: dynCall_vii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var ___muldsi3 = Module["___muldsi3"] = asm["___muldsi3"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _free = Module["_free"] = asm["_free"];
var _main = Module["_main"] = asm["_main"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var ___udivmoddi4 = Module["___udivmoddi4"] = asm["___udivmoddi4"];
var _pthread_self = Module["_pthread_self"] = asm["_pthread_self"];
var _memset = Module["_memset"] = asm["_memset"];
var _llvm_cttz_i32 = Module["_llvm_cttz_i32"] = asm["_llvm_cttz_i32"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===

Module["FS"] = FS;



function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}




  return Module;
};
