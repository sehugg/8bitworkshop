var PLASM = function(Module) {
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
if (!Module) Module = (typeof PLASM !== 'undefined' ? PLASM : null) || {};

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

STATICTOP = STATIC_BASE + 114416;
  /* global initializers */  __ATINIT__.push();
  

/* memory initializer */ allocate([1,0,0,0,220,12,0,0,226,12,0,0,232,12,0,0,196,180,1,0,255,255,255,255,255,255,255,255,40,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,224,182,1,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,156,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,2,0,0,0,232,182,1,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,156,0,0,0,20,1,0,0,9,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,2,0,0,0,240,186,1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,67,111,110,115,116,97,110,116,32,99,111,117,110,116,32,111,118,101,114,102,108,111,119,10,0,76,111,99,97,108,32,118,97,114,105,97,98,108,101,32,115,105,122,101,32,111,118,101,114,102,108,111,119,10,0,99,111,110,115,116,47,108,111,99,97,108,32,110,97,109,101,32,99,111,110,102,108,105,99,116,10,0,108,111,99,97,108,32,108,97,98,101,108,32,97,108,114,101,97,100,121,32,100,101,102,105,110,101,100,10,0,71,108,111,98,97,108,32,118,97,114,105,97,98,108,101,32,99,111,117,110,116,32,111,118,101,114,102,108,111,119,10,0,99,111,110,115,116,47,103,108,111,98,97,108,32,110,97,109,101,32,99,111,110,102,108,105,99,116,10,0,103,108,111,98,97,108,32,108,97,98,101,108,32,97,108,114,101,97,100,121,32,100,101,102,105,110,101,100,10,0,9,9,9,9,9,59,32,37,115,32,45,62,32,88,37,48,51,100,10,0,85,110,100,101,99,108,97,114,101,100,32,105,100,101,110,116,105,102,105,101,114,0,85,110,100,101,99,108,97,114,101,100,32,99,111,110,115,116,97,110,116,0,69,120,116,101,114,110,97,108,32,118,97,114,105,97,98,108,101,32,99,111,117,110,116,32,111,118,101,114,102,108,111,119,10,0,95,37,99,37,48,51,100,0,9,59,32,68,67,73,32,83,84,82,73,78,71,58,32,37,115,10,0,9,37,115,9,36,37,48,50,88,0,44,36,37,48,50,88,0,10,0,33,66,89,84,69,0,33,87,79,82,68,0,33,70,73,76,76,0,58,59,32,65,67,77,69,32,67,79,77,80,65,84,73,66,76,69,32,79,85,84,80,85,84,10,0,59,32,67,65,54,53,32,67,79,77,80,65,84,73,66,76,69,32,79,85,84,80,85,84,10,0,9,37,115,9,95,83,69,71,69,78,68,45,95,83,69,71,66,69,71,73,78,9,59,32,76,69,78,71,84,72,32,79,70,32,72,69,65,68,69,82,32,43,32,67,79,68,69,47,68,65,84,65,32,43,32,66,89,84,69,67,79,68,69,32,83,69,71,77,69,78,84,10,0,95,83,69,71,66,69,71,73,78,37,99,10,0,9,37,115,9,36,68,65,55,69,9,9,9,59,32,77,65,71,73,67,32,35,10,0,9,37,115,9,95,83,89,83,70,76,65,71,83,9,9,9,59,32,83,89,83,84,69,77,32,70,76,65,71,83,10,0,9,37,115,9,95,83,85,66,83,69,71,9,9,9,59,32,66,89,84,69,67,79,68,69,32,83,85,66,45,83,69,71,77,69,78,84,10,0,9,37,115,9,95,68,69,70,67,78,84,9,9,9,59,32,66,89,84,69,67,79,68,69,32,68,69,70,32,67,79,85,78,84,10,0,9,37,115,9,95,73,78,73,84,9,9,9,59,32,77,79,68,85,76,69,32,73,78,73,84,73,65,76,73,90,65,84,73,79,78,32,82,79,85,84,73,78,69,10,0,9,74,77,80,9,95,73,78,73,84,9,9,9,59,32,77,79,68,85,76,69,32,73,78,73,84,73,65,76,73,90,65,84,73,79,78,32,82,79,85,84,73,78,69,10,0,59,10,59,32,82,69,45,76,79,67,65,84,69,65,66,76,69,32,68,73,67,84,73,79,78,65,82,89,10,59,10,0,9,37,115,9,36,48,50,9,9,9,59,32,67,79,68,69,32,84,65,66,76,69,32,70,73,88,85,80,10,0,9,37,115,9,95,67,37,48,51,100,9,9,10,0,9,37,115,9,36,48,48,10,0,9,37,115,9,36,37,48,50,88,9,9,9,59,32,69,88,84,69,82,78,65,76,32,70,73,88,85,80,10,0,9,37,115,9,95,70,37,48,51,100,45,95,83,69,71,66,69,71,73,78,9,9,10,0,9,37,115,9,37,100,9,9,9,59,32,69,83,68,32,73,78,68,69,88,10,0,9,37,115,9,36,37,48,50,88,9,9,9,59,32,73,78,84,69,82,78,65,76,32,70,73,88,85,80,10,0,9,37,115,9,36,48,48,9,9,9,59,32,69,78,68,32,79,70,32,82,76,68,10,0,59,10,59,32,69,88,84,69,82,78,65,76,47,69,78,84,82,89,32,83,89,77,66,79,76,32,68,73,67,84,73,79,78,65,82,89,10,59,10,0,9,37,115,9,36,49,48,9,9,9,59,32,69,88,84,69,82,78,65,76,32,83,89,77,66,79,76,32,70,76,65,71,10,0,9,37,115,9,36,48,56,9,9,9,59,32,69,78,84,82,89,32,83,89,77,66,79,76,32,70,76,65,71,10,0,9,37,115,9,37,115,9,9,10,0,9,37,115,9,36,48,48,9,9,9,59,32,69,78,68,32,79,70,32,69,83,68,10,0,95,73,78,73,84,9,61,9,48,10,0,95,83,89,83,70,76,65,71,83,9,61,9,48,10,0,95,68,69,70,67,78,84,9,61,9,37,100,10,0,95,83,69,71,69,78,68,37,99,10,0,9,37,115,9,36,48,48,9,9,9,59,32,69,78,68,32,79,70,32,77,79,68,85,76,69,32,68,69,80,69,78,68,69,78,67,73,69,83,10,0,95,83,89,83,70,76,65,71,83,9,61,9,36,37,48,52,88,9,9,59,32,83,89,83,84,69,77,32,70,76,65,71,83,10,0,95,83,85,66,83,69,71,37,99,9,9,9,9,59,32,66,89,84,69,67,79,68,69,32,83,84,65,82,84,83,10,0,37,115,10,0,9,9,9,9,9,59,32,37,115,32,45,62,32,91,37,100,93,10,0,95,68,37,48,51,100,37,99,9,9,9,9,9,59,32,37,115,10,0,95,68,37,48,51,100,37,99,9,37,115,9,37,100,9,9,9,59,32,37,115,10,0,37,115,37,99,9,9,9,9,9,59,32,37,115,40,41,10,0,9,9,9,9,9,59,32,37,115,32,61,32,37,100,10,0,9,37,115,9,36,37,48,50,88,10,0,95,70,37,48,51,100,37,99,9,37,115,9,48,9,9,9,59,32,37,115,10,0,95,70,37,48,51,100,37,99,9,37,115,9,37,115,10,0,9,37,115,9,36,37,48,52,108,88,10,0,9,37,115,9,36,37,48,50,108,88,10,0,9,74,83,82,9,73,78,84,69,82,80,10,0,95,66,37,48,51,100,37,99,10,0,9,37,115,9,36,48,48,9,9,9,59,32,90,69,82,79,10,0,9,37,115,9,36,50,65,44,36,37,48,50,88,9,9,9,59,32,67,66,9,37,100,10,0,9,37,115,9,36,50,67,44,36,37,48,50,88,44,36,37,48,50,88,9,9,59,32,67,87,9,37,100,10,0,9,37,115,9,36,50,69,9,9,9,59,32,67,83,10,0,9,37,115,9,36,54,48,9,9,9,59,32,76,66,10,0,9,37,115,9,36,54,50,9,9,9,59,32,76,87,10,0,9,37,115,9,36,54,52,44,36,37,48,50,88,9,9,9,59,32,76,76,66,9,91,37,100,93,10,0,9,37,115,9,36,54,54,44,36,37,48,50,88,9,9,9,59,32,76,76,87,9,91,37,100,93,10,0,9,37,115,9,36,54,56,9,9,9,59,32,76,65,66,9,37,115,43,37,100,10,0,95,70,37,48,51,100,37,99,9,37,115,9,37,115,43,37,100,9,9,10,0,48,0,9,37,115,9,36,54,65,9,9,9,59,32,76,65,87,9,37,115,43,37,100,10,0,9,37,115,9,36,55,48,9,9,9,59,32,83,66,10,0,9,37,115,9,36,55,50,9,9,9,59,32,83,87,10,0,9,37,115,9,36,55,52,44,36,37,48,50,88,9,9,9,59,32,83,76,66,9,91,37,100,93,10,0,9,37,115,9,36,55,54,44,36,37,48,50,88,9,9,9,59,32,83,76,87,9,91,37,100,93,10,0,9,37,115,9,36,54,67,44,36,37,48,50,88,9,9,9,59,32,68,76,66,9,91,37,100,93,10,0,9,37,115,9,36,54,69,44,36,37,48,50,88,9,9,9,59,32,68,76,87,9,91,37,100,93,10,0,9,37,115,9,36,55,56,9,9,9,59,32,83,65,66,9,37,115,43,37,100,10,0,9,37,115,9,36,55,65,9,9,9,59,32,83,65,87,9,37,115,43,37,100,10,0,9,37,115,9,36,55,67,9,9,9,59,32,68,65,66,9,37,115,10,0,95,70,37,48,51,100,37,99,9,37,115,9,37,115,9,9,10,0,9,37,115,9,36,55,69,9,9,9,59,32,68,65,87,9,37,115,10,0,9,37,115,9,36,50,56,44,36,37,48,50,88,9,9,9,59,32,76,76,65,9,91,37,100,93,10,0,9,37,115,9,36,50,54,9,9,9,59,32,76,65,9,37,115,43,37,100,10,0,9,37,115,9,36,48,50,9,9,9,59,32,73,68,88,66,10,0,9,37,115,9,36,49,69,9,9,9,59,32,73,68,88,87,10,0,9,37,115,9,36,52,67,9,9,9,59,32,66,82,70,76,83,9,95,66,37,48,51,100,10,0,9,37,115,9,95,66,37,48,51,100,45,42,10,0,9,37,115,9,36,53,48,9,9,9,59,32,66,82,78,67,72,9,95,66,37,48,51,100,10,0,9,37,115,9,36,51,69,9,9,9,59,32,66,82,78,69,9,95,66,37,48,51,100,10,0,9,37,115,9,36,51,56,9,9,9,59,32,66,82,71,84,9,95,66,37,48,51,100,10,0,9,37,115,9,36,51,65,9,9,9,59,32,66,82,76,84,9,95,66,37,48,51,100,10,0,9,37,115,9,36,53,52,9,9,9,59,32,67,65,76,76,9,37,105,10,0,9,37,115,9,37,105,9,9,10,0,9,37,115,9,36,53,52,9,9,9,59,32,67,65,76,76,9,37,115,10,0,9,37,115,9,36,53,54,9,9,9,59,32,73,67,65,76,10,0,9,37,115,9,36,53,65,9,9,9,59,32,76,69,65,86,69,10,0,9,37,115,9,36,53,67,9,9,9,59,32,82,69,84,10,0,9,37,115,9,36,53,56,44,36,37,48,50,88,44,36,37,48,50,88,9,9,59,32,69,78,84,69,82,9,37,100,44,37,100,10,0,95,73,78,73,84,37,99,10,0,9,37,115,9,36,51,50,9,9,9,59,32,68,85,80,10,0,9,37,115,9,36,51,52,9,9,9,59,32,80,85,83,72,10,0,9,37,115,9,36,51,54,9,9,9,59,32,80,85,76,76,10,0,9,37,115,9,36,51,48,9,9,9,59,32,68,82,79,80,10,0,9,37,115,9,36,49,48,9,9,9,59,32,78,69,71,10,0,9,37,115,9,36,49,50,9,9,9,59,32,67,79,77,80,10,0,9,37,115,9,36,50,48,9,9,9,59,32,78,79,84,10,0,9,37,115,9,36,48,67,9,9,9,59,32,73,78,67,82,10,0,9,37,115,9,36,48,69,9,9,9,59,32,68,69,67,82,10,0,101,109,105,116,95,117,110,97,114,121,111,112,40,37,99,41,32,63,63,63,10,0,9,37,115,9,36,48,54,9,9,9,59,32,77,85,76,10,0,9,37,115,9,36,48,56,9,9,9,59,32,68,73,86,10,0,9,37,115,9,36,48,65,9,9,9,59,32,77,79,68,10,0,9,37,115,9,36,48,50,9,9,9,59,32,65,68,68,10,0,9,37,115,9,36,48,52,9,9,9,59,32,83,85,66,10,0,9,37,115,9,36,49,65,9,9,9,59,32,83,72,76,10,0,9,37,115,9,36,49,67,9,9,9,59,32,83,72,82,10,0,9,37,115,9,36,49,52,9,9,9,59,32,65,78,68,10,0,9,37,115,9,36,49,54,9,9,9,59,32,73,79,82,10,0,9,37,115,9,36,49,56,9,9,9,59,32,88,79,82,10,0,9,37,115,9,36,52,48,9,9,9,59,32,73,83,69,81,10,0,9,37,115,9,36,52,50,9,9,9,59,32,73,83,78,69,10,0,9,37,115,9,36,52,56,9,9,9,59,32,73,83,71,69,10,0,9,37,115,9,36,52,54,9,9,9,59,32,73,83,76,84,10,0,9,37,115,9,36,52,52,9,9,9,59,32,73,83,71,84,10,0,9,37,115,9,36,52,65,9,9,9,59,32,73,83,76,69,10,0,9,37,115,9,36,50,50,9,9,9,59,32,76,79,82,10,0,9,37,115,9,36,50,52,9,9,9,59,32,76,65,78,68,10,0,46,66,89,84,69,0,46,87,79,82,68,0,46,82,69,83,0,132,73,70,134,69,76,83,69,133,69,76,83,73,70,135,70,73,78,137,87,72,73,76,69,138,76,79,79,80,139,87,72,69,78,140,73,83,141,79,84,72,69,82,87,73,83,69,142,87,69,78,68,143,70,79,82,144,84,79,145,68,79,87,78,84,79,146,83,84,69,80,147,78,69,88,84,148,82,69,80,69,65,84,149,85,78,84,73,76,157,66,82,69,65,75,160,67,79,78,84,73,78,85,69,152,65,83,77,151,68,69,70,154,69,88,80,79,82,84,153,73,77,80,79,82,84,254,73,78,67,76,85,68,69,156,82,69,84,85,82,78,136,69,78,68,155,68,79,78,69,161,78,79,84,206,65,78,68,207,79,82,130,66,89,84,69,131,87,79,82,68,129,67,79,78,83,84,159,83,84,82,85,67,150,80,82,69,68,69,70,158,83,89,83,70,76,65,71,83,128,10,37,115,32,37,52,100,58,32,37,115,10,37,42,115,32,32,32,32,32,32,32,0,94,10,69,114,114,111,114,58,32,37,115,10,0,66,97,100,32,99,104,97,114,97,99,116,101,114,32,99,111,110,115,116,97,110,116,0,66,97,100,32,115,116,114,105,110,103,32,99,111,110,115,116,97,110,116,0,85,110,116,101,114,109,105,110,97,116,101,100,32,115,116,114,105,110,103,0,60,115,116,100,105,110,62,0,59,32,37,115,58,32,37,48,52,100,58,32,37,115,10,0,77,105,115,115,105,110,103,32,105,110,99,108,117,100,101,32,102,105,108,101,110,97,109,101,0,79,110,108,121,32,111,110,101,32,108,101,118,101,108,32,111,102,32,105,110,99,108,117,100,101,115,32,97,108,108,111,119,101,100,0,114,0,69,114,114,111,114,32,111,112,101,110,105,110,103,32,105,110,99,108,117,100,101,32,102,105,108,101,0,170,175,165,171,173,210,204,166,222,252,190,200,188,194,197,213,206,207,1,1,1,2,2,3,3,4,5,6,7,7,7,7,8,8,9,10,83,116,97,99,107,32,111,118,101,114,102,108,111,119,10,0,83,116,97,99,107,32,117,110,100,101,114,102,108,111,119,10,0,66,97,100,32,99,111,110,115,116,97,110,116,32,111,112,101,114,97,110,100,0,66,97,100,32,101,120,112,114,101,115,115,105,111,110,32,105,110,32,112,97,114,101,110,116,104,101,115,105,115,0,77,105,115,115,105,110,103,32,99,108,111,115,105,110,103,32,112,97,114,101,110,116,104,101,115,105,115,0,58,32,73,110,118,97,108,105,100,32,98,105,110,97,114,121,32,111,112,101,114,97,116,105,111,110,0,77,105,115,115,105,110,103,32,111,112,101,114,97,110,100,0,73,110,118,97,108,105,100,32,115,116,114,105,110,103,32,109,111,100,105,102,105,101,114,115,0,66,97,100,32,73,68,32,116,121,112,101,10,0,66,97,100,32,105,110,100,101,120,32,114,101,102,101,114,101,110,99,101,0,77,105,115,115,105,110,103,32,99,108,111,115,105,110,103,32,98,114,97,99,107,101,116,0,58,32,73,110,118,97,108,105,100,32,117,110,97,114,121,32,111,112,101,114,97,116,105,111,110,0,66,97,100,32,101,120,112,114,101,115,115,105,111,110,0,77,105,115,115,105,110,103,32,73,70,47,70,73,78,0,77,105,115,115,105,110,103,32,87,72,73,76,69,47,69,78,68,0,77,105,115,115,105,110,103,32,82,69,80,69,65,84,47,85,78,84,73,76,0,77,105,115,115,105,110,103,32,70,79,82,32,118,97,114,105,97,98,108,101,0,77,105,115,115,105,110,103,32,70,79,82,32,61,0,66,97,100,32,70,79,82,32,101,120,112,114,101,115,115,105,111,110,0,77,105,115,115,105,110,103,32,70,79,82,32,84,79,0,66,97,100,32,70,79,82,32,84,79,32,101,120,112,114,101,115,115,105,111,110,0,66,97,100,32,70,79,82,32,83,84,69,80,32,101,120,112,114,101,115,115,105,111,110,0,77,105,115,115,105,110,103,32,70,79,82,47,78,69,88,84,32,0,66,97,100,32,67,65,83,69,32,101,120,112,114,101,115,115,105,111,110,0,66,97,100,32,67,65,83,69,32,79,70,32,101,120,112,114,101,115,115,105,111,110,0,66,97,100,32,67,65,83,69,32,68,69,70,65,85,76,84,32,99,108,97,117,115,101,0,66,97,100,32,67,65,83,69,32,99,108,97,117,115,101,0,67,79,78,84,73,78,85,69,32,119,105,116,104,111,117,116,32,108,111,111,112,0,66,82,69,65,75,32,119,105,116,104,111,117,116,32,108,111,111,112,0,83,121,110,116,97,120,32,101,114,114,111,114,0,69,120,116,114,97,110,101,111,117,115,32,99,104,97,114,97,99,116,101,114,115,0,67,97,110,110,111,116,32,105,110,105,116,105,97,108,108,105,122,101,32,108,111,99,97,108,47,101,120,116,101,114,110,97,108,32,118,97,114,105,97,98,108,101,115,0,66,97,100,32,97,114,114,97,121,32,100,101,99,108,97,114,97,116,105,111,110,0,66,97,100,32,118,97,114,105,97,98,108,101,32,105,110,105,116,105,97,108,105,122,101,114,0,115,121,115,102,108,97,103,115,32,109,117,115,116,32,98,101,32,103,108,111,98,97,108,0,66,97,100,32,99,111,110,115,116,97,110,116,0,77,105,115,115,105,110,103,32,118,97,114,105,97,98,108,101,0,66,97,100,32,76,86,97,108,117,101,0,66,97,100,32,115,116,114,117,99,116,117,114,101,32,100,101,102,105,110,105,116,105,111,110,0,67,97,110,110,111,116,32,101,120,112,111,114,116,32,108,111,99,97,108,47,105,109,112,111,114,116,101,100,32,118,97,114,105,97,98,108,101,115,0,66,97,100,32,102,117,110,99,116,105,111,110,32,112,114,101,45,100,101,99,108,97,114,97,116,105,111,110,0,66,97,100,32,105,109,112,111,114,116,32,100,101,102,105,110,105,116,105,111,110,0,66,97,100,32,101,120,112,111,114,116,32,100,101,102,105,110,105,116,105,111,110,0,77,105,115,115,105,110,103,32,102,117,110,99,116,105,111,110,32,110,97,109,101,0,77,105,115,109,97,116,99,104,32,102,117,110,99,116,105,111,110,32,116,121,112,101,0,66,97,100,32,102,117,110,99,116,105,111,110,32,112,97,114,97,109,101,116,101,114,32,108,105,115,116,0,65,83,77,32,99,111,100,101,32,111,110,108,121,32,97,108,108,111,119,101,100,32,98,101,102,111,114,101,32,68,69,70,32,99,111,100,101,0,95,73,78,73,84,0,77,105,115,115,105,110,103,32,68,79,78,69,32,115,116,97,116,101,109,101,110,116,0,67,111,109,112,105,108,97,116,105,111,110,32,99,111,109,112,108,101,116,101,46,10,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,46,0,114,119,97,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





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
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;Module["FS_unlink"] = FS.unlink;;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });;
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); };
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);



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

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_vi": invoke_vi, "_pthread_cleanup_pop": _pthread_cleanup_pop, "___syscall221": ___syscall221, "___lock": ___lock, "_abort": _abort, "___setErrNo": ___setErrNo, "___syscall6": ___syscall6, "_sbrk": _sbrk, "___syscall140": ___syscall140, "___syscall5": ___syscall5, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "_exit": _exit, "_pthread_cleanup_push": _pthread_cleanup_push, "__exit": __exit, "___syscall145": ___syscall145, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
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
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_vi=env.invoke_vi;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var ___syscall221=env.___syscall221;
  var ___lock=env.___lock;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var ___syscall6=env.___syscall6;
  var _sbrk=env._sbrk;
  var ___syscall140=env.___syscall140;
  var ___syscall5=env.___syscall5;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var _exit=env._exit;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var __exit=env.__exit;
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

function _id_match($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp + 12|0;
 $4 = sp + 8|0;
 $5 = sp + 4|0;
 $6 = sp;
 HEAP32[$4>>2] = $0;
 HEAP32[$5>>2] = $1;
 HEAP32[$6>>2] = $2;
 $7 = HEAP32[$5>>2]|0;
 $8 = HEAP32[$6>>2]|0;
 $9 = HEAP8[$8>>0]|0;
 $10 = $9 << 24 >> 24;
 $11 = ($7|0)==($10|0);
 if (!($11)) {
  HEAP32[$3>>2] = 0;
  $29 = HEAP32[$3>>2]|0;
  STACKTOP = sp;return ($29|0);
 }
 $12 = HEAP32[$5>>2]|0;
 $13 = ($12|0)>(16);
 if ($13) {
  HEAP32[$5>>2] = 16;
 }
 while(1) {
  $14 = HEAP32[$5>>2]|0;
  $15 = (($14) + -1)|0;
  HEAP32[$5>>2] = $15;
  $16 = ($14|0)!=(0);
  if (!($16)) {
   label = 7;
   break;
  }
  $17 = HEAP32[$5>>2]|0;
  $18 = HEAP32[$4>>2]|0;
  $19 = (($18) + ($17)|0);
  $20 = HEAP8[$19>>0]|0;
  $21 = $20 << 24 >> 24;
  $22 = HEAP32[$5>>2]|0;
  $23 = (1 + ($22))|0;
  $24 = HEAP32[$6>>2]|0;
  $25 = (($24) + ($23)|0);
  $26 = HEAP8[$25>>0]|0;
  $27 = $26 << 24 >> 24;
  $28 = ($21|0)!=($27|0);
  if ($28) {
   label = 6;
   break;
  }
 }
 if ((label|0) == 6) {
  HEAP32[$3>>2] = 0;
  $29 = HEAP32[$3>>2]|0;
  STACKTOP = sp;return ($29|0);
 }
 else if ((label|0) == 7) {
  HEAP32[$3>>2] = 1;
  $29 = HEAP32[$3>>2]|0;
  STACKTOP = sp;return ($29|0);
 }
 return (0)|0;
}
function _idconst_lookup($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = 0;
 while(1) {
  $6 = HEAP32[$5>>2]|0;
  $7 = HEAP32[1817]|0;
  $8 = ($6|0)<($7|0);
  if (!($8)) {
   label = 6;
   break;
  }
  $9 = HEAP32[$3>>2]|0;
  $10 = HEAP32[$4>>2]|0;
  $11 = HEAP32[$5>>2]|0;
  $12 = (37860 + (($11*33)|0)|0);
  $13 = (_id_match($9,$10,$12)|0);
  $14 = ($13|0)!=(0);
  $15 = HEAP32[$5>>2]|0;
  if ($14) {
   label = 4;
   break;
  }
  $16 = (($15) + 1)|0;
  HEAP32[$5>>2] = $16;
 }
 if ((label|0) == 4) {
  HEAP32[$2>>2] = $15;
  $17 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 else if ((label|0) == 6) {
  HEAP32[$2>>2] = -1;
  $17 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 return (0)|0;
}
function _idlocal_lookup($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = 0;
 while(1) {
  $6 = HEAP32[$5>>2]|0;
  $7 = HEAP32[1818]|0;
  $8 = ($6|0)<($7|0);
  if (!($8)) {
   label = 6;
   break;
  }
  $9 = HEAP32[$3>>2]|0;
  $10 = HEAP32[$4>>2]|0;
  $11 = HEAP32[$5>>2]|0;
  $12 = (71652 + (($11*33)|0)|0);
  $13 = (_id_match($9,$10,$12)|0);
  $14 = ($13|0)!=(0);
  $15 = HEAP32[$5>>2]|0;
  if ($14) {
   label = 4;
   break;
  }
  $16 = (($15) + 1)|0;
  HEAP32[$5>>2] = $16;
 }
 if ((label|0) == 4) {
  HEAP32[$2>>2] = $15;
  $17 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 else if ((label|0) == 6) {
  HEAP32[$2>>2] = -1;
  $17 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 return (0)|0;
}
function _idglobal_lookup($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = 0;
 while(1) {
  $6 = HEAP32[$5>>2]|0;
  $7 = HEAP32[1819]|0;
  $8 = ($6|0)<($7|0);
  if (!($8)) {
   label = 6;
   break;
  }
  $9 = HEAP32[$3>>2]|0;
  $10 = HEAP32[$4>>2]|0;
  $11 = HEAP32[$5>>2]|0;
  $12 = (75876 + (($11*33)|0)|0);
  $13 = (_id_match($9,$10,$12)|0);
  $14 = ($13|0)!=(0);
  $15 = HEAP32[$5>>2]|0;
  if ($14) {
   label = 4;
   break;
  }
  $16 = (($15) + 1)|0;
  HEAP32[$5>>2] = $16;
 }
 if ((label|0) == 4) {
  HEAP32[$2>>2] = $15;
  $17 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 else if ((label|0) == 6) {
  HEAP32[$2>>2] = -1;
  $17 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 return (0)|0;
}
function _idconst_add($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = sp + 12|0;
 $5 = sp + 8|0;
 $6 = sp + 4|0;
 $7 = sp + 20|0;
 HEAP32[$4>>2] = $0;
 HEAP32[$5>>2] = $1;
 HEAP32[$6>>2] = $2;
 $8 = HEAP32[$5>>2]|0;
 $9 = HEAP32[$4>>2]|0;
 $10 = (($9) + ($8)|0);
 $11 = HEAP8[$10>>0]|0;
 HEAP8[$7>>0] = $11;
 $12 = HEAP32[1817]|0;
 $13 = ($12|0)>(1024);
 if ($13) {
  (_printf(500,$vararg_buffer)|0);
  HEAP32[$3>>2] = 0;
  $46 = HEAP32[$3>>2]|0;
  STACKTOP = sp;return ($46|0);
 }
 $14 = HEAP32[$5>>2]|0;
 $15 = HEAP32[$4>>2]|0;
 $16 = (($15) + ($14)|0);
 HEAP8[$16>>0] = 0;
 $17 = HEAP32[$4>>2]|0;
 $18 = HEAP32[$6>>2]|0;
 _emit_idconst($17,$18);
 $19 = HEAP8[$7>>0]|0;
 $20 = HEAP32[$5>>2]|0;
 $21 = HEAP32[$4>>2]|0;
 $22 = (($21) + ($20)|0);
 HEAP8[$22>>0] = $19;
 $23 = HEAP32[$5>>2]|0;
 $24 = $23&255;
 $25 = HEAP32[1817]|0;
 $26 = (37860 + (($25*33)|0)|0);
 HEAP8[$26>>0] = $24;
 $27 = HEAP32[$5>>2]|0;
 $28 = ($27|0)>(32);
 if ($28) {
  HEAP32[$5>>2] = 32;
 }
 while(1) {
  $29 = HEAP32[$5>>2]|0;
  $30 = (($29) + -1)|0;
  HEAP32[$5>>2] = $30;
  $31 = ($29|0)!=(0);
  if (!($31)) {
   break;
  }
  $32 = HEAP32[$5>>2]|0;
  $33 = HEAP32[$4>>2]|0;
  $34 = (($33) + ($32)|0);
  $35 = HEAP8[$34>>0]|0;
  $36 = HEAP32[$5>>2]|0;
  $37 = (1 + ($36))|0;
  $38 = HEAP32[1817]|0;
  $39 = (37860 + (($38*33)|0)|0);
  $40 = (($39) + ($37)|0);
  HEAP8[$40>>0] = $35;
 }
 $41 = HEAP32[$6>>2]|0;
 $42 = HEAP32[1817]|0;
 $43 = (7280 + ($42<<2)|0);
 HEAP32[$43>>2] = $41;
 $44 = HEAP32[1817]|0;
 $45 = (($44) + 1)|0;
 HEAP32[1817] = $45;
 HEAP32[$3>>2] = 1;
 $46 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($46|0);
}
function _emit_idconst($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $4 = HEAP32[$2>>2]|0;
 $5 = HEAP32[$3>>2]|0;
 HEAP32[$vararg_buffer>>2] = $4;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $5;
 (_printf(1814,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _idlocal_add($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $4 = sp + 20|0;
 $5 = sp + 16|0;
 $6 = sp + 12|0;
 $7 = sp + 8|0;
 $8 = sp + 4|0;
 $9 = sp + 24|0;
 HEAP32[$5>>2] = $0;
 HEAP32[$6>>2] = $1;
 HEAP32[$7>>2] = $2;
 HEAP32[$8>>2] = $3;
 $10 = HEAP32[$6>>2]|0;
 $11 = HEAP32[$5>>2]|0;
 $12 = (($11) + ($10)|0);
 $13 = HEAP8[$12>>0]|0;
 HEAP8[$9>>0] = $13;
 $14 = HEAP32[2844]|0;
 $15 = ($14|0)>(255);
 if ($15) {
  (_printf(525,$vararg_buffer)|0);
  HEAP32[$4>>2] = 0;
  $63 = HEAP32[$4>>2]|0;
  STACKTOP = sp;return ($63|0);
 }
 $16 = HEAP32[$5>>2]|0;
 $17 = HEAP32[$6>>2]|0;
 $18 = (_idconst_lookup($16,$17)|0);
 $19 = ($18|0)>(0);
 if ($19) {
  _parse_error(555);
  HEAP32[$4>>2] = 0;
  $63 = HEAP32[$4>>2]|0;
  STACKTOP = sp;return ($63|0);
 }
 $20 = HEAP32[$5>>2]|0;
 $21 = HEAP32[$6>>2]|0;
 $22 = (_idlocal_lookup($20,$21)|0);
 $23 = ($22|0)>(0);
 if ($23) {
  _parse_error(582);
  HEAP32[$4>>2] = 0;
  $63 = HEAP32[$4>>2]|0;
  STACKTOP = sp;return ($63|0);
 }
 $24 = HEAP32[$6>>2]|0;
 $25 = HEAP32[$5>>2]|0;
 $26 = (($25) + ($24)|0);
 HEAP8[$26>>0] = 0;
 $27 = HEAP32[$5>>2]|0;
 $28 = HEAP32[2844]|0;
 _emit_idlocal($27,$28);
 $29 = HEAP8[$9>>0]|0;
 $30 = HEAP32[$6>>2]|0;
 $31 = HEAP32[$5>>2]|0;
 $32 = (($31) + ($30)|0);
 HEAP8[$32>>0] = $29;
 $33 = HEAP32[$6>>2]|0;
 $34 = $33&255;
 $35 = HEAP32[1818]|0;
 $36 = (71652 + (($35*33)|0)|0);
 HEAP8[$36>>0] = $34;
 $37 = HEAP32[$6>>2]|0;
 $38 = ($37|0)>(32);
 if ($38) {
  HEAP32[$6>>2] = 32;
 }
 while(1) {
  $39 = HEAP32[$6>>2]|0;
  $40 = (($39) + -1)|0;
  HEAP32[$6>>2] = $40;
  $41 = ($39|0)!=(0);
  if (!($41)) {
   break;
  }
  $42 = HEAP32[$6>>2]|0;
  $43 = HEAP32[$5>>2]|0;
  $44 = (($43) + ($42)|0);
  $45 = HEAP8[$44>>0]|0;
  $46 = HEAP32[$6>>2]|0;
  $47 = (1 + ($46))|0;
  $48 = HEAP32[1818]|0;
  $49 = (71652 + (($48*33)|0)|0);
  $50 = (($49) + ($47)|0);
  HEAP8[$50>>0] = $45;
 }
 $51 = HEAP32[$7>>2]|0;
 $52 = $51 | 64;
 $53 = HEAP32[1818]|0;
 $54 = (11380 + ($53<<2)|0);
 HEAP32[$54>>2] = $52;
 $55 = HEAP32[2844]|0;
 $56 = HEAP32[1818]|0;
 $57 = (11892 + ($56<<2)|0);
 HEAP32[$57>>2] = $55;
 $58 = HEAP32[$8>>2]|0;
 $59 = HEAP32[2844]|0;
 $60 = (($59) + ($58))|0;
 HEAP32[2844] = $60;
 $61 = HEAP32[1818]|0;
 $62 = (($61) + 1)|0;
 HEAP32[1818] = $62;
 HEAP32[$4>>2] = 1;
 $63 = HEAP32[$4>>2]|0;
 STACKTOP = sp;return ($63|0);
}
function _emit_idlocal($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $4 = HEAP32[$2>>2]|0;
 $5 = HEAP32[$3>>2]|0;
 HEAP32[$vararg_buffer>>2] = $4;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $5;
 (_printf(1736,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _idglobal_add($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_ptr3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $4 = sp + 32|0;
 $5 = sp + 28|0;
 $6 = sp + 24|0;
 $7 = sp + 20|0;
 $8 = sp + 16|0;
 $9 = sp + 36|0;
 HEAP32[$5>>2] = $0;
 HEAP32[$6>>2] = $1;
 HEAP32[$7>>2] = $2;
 HEAP32[$8>>2] = $3;
 $10 = HEAP32[$6>>2]|0;
 $11 = HEAP32[$5>>2]|0;
 $12 = (($11) + ($10)|0);
 $13 = HEAP8[$12>>0]|0;
 HEAP8[$9>>0] = $13;
 $14 = HEAP32[1819]|0;
 $15 = ($14|0)>(1024);
 if ($15) {
  (_printf(611,$vararg_buffer)|0);
  HEAP32[$4>>2] = 0;
  $71 = HEAP32[$4>>2]|0;
  STACKTOP = sp;return ($71|0);
 }
 $16 = HEAP32[$5>>2]|0;
 $17 = HEAP32[$6>>2]|0;
 $18 = (_idconst_lookup($16,$17)|0);
 $19 = ($18|0)>(0);
 if ($19) {
  _parse_error(643);
  HEAP32[$4>>2] = 0;
  $71 = HEAP32[$4>>2]|0;
  STACKTOP = sp;return ($71|0);
 }
 $20 = HEAP32[$5>>2]|0;
 $21 = HEAP32[$6>>2]|0;
 $22 = (_idglobal_lookup($20,$21)|0);
 $23 = ($22|0)>(0);
 if ($23) {
  _parse_error(671);
  HEAP32[$4>>2] = 0;
  $71 = HEAP32[$4>>2]|0;
  STACKTOP = sp;return ($71|0);
 }
 $24 = HEAP32[$6>>2]|0;
 $25 = HEAP32[$5>>2]|0;
 $26 = (($25) + ($24)|0);
 HEAP8[$26>>0] = 0;
 $27 = HEAP8[$9>>0]|0;
 $28 = HEAP32[$6>>2]|0;
 $29 = HEAP32[$5>>2]|0;
 $30 = (($29) + ($28)|0);
 HEAP8[$30>>0] = $27;
 $31 = HEAP32[$6>>2]|0;
 $32 = $31&255;
 $33 = HEAP32[1819]|0;
 $34 = (75876 + (($33*33)|0)|0);
 HEAP8[$34>>0] = $32;
 $35 = HEAP32[$6>>2]|0;
 $36 = ($35|0)>(32);
 if ($36) {
  HEAP32[$6>>2] = 32;
 }
 while(1) {
  $37 = HEAP32[$6>>2]|0;
  $38 = (($37) + -1)|0;
  HEAP32[$6>>2] = $38;
  $39 = ($37|0)!=(0);
  if (!($39)) {
   break;
  }
  $40 = HEAP32[$6>>2]|0;
  $41 = HEAP32[$5>>2]|0;
  $42 = (($41) + ($40)|0);
  $43 = HEAP8[$42>>0]|0;
  $44 = HEAP32[$6>>2]|0;
  $45 = (1 + ($44))|0;
  $46 = HEAP32[1819]|0;
  $47 = (75876 + (($46*33)|0)|0);
  $48 = (($47) + ($45)|0);
  HEAP8[$48>>0] = $43;
 }
 $49 = HEAP32[$7>>2]|0;
 $50 = HEAP32[1819]|0;
 $51 = (12404 + ($50<<2)|0);
 HEAP32[$51>>2] = $49;
 $52 = HEAP32[$7>>2]|0;
 $53 = $52 & 128;
 $54 = ($53|0)!=(0);
 $55 = HEAP32[1819]|0;
 if ($54) {
  $63 = (75876 + (($55*33)|0)|0);
  $64 = ((($63)) + 1|0);
  $65 = HEAP32[5149]|0;
  HEAP32[$vararg_buffer1>>2] = $64;
  $vararg_ptr3 = ((($vararg_buffer1)) + 4|0);
  HEAP32[$vararg_ptr3>>2] = $65;
  (_printf(701,$vararg_buffer1)|0);
  $66 = HEAP32[5149]|0;
  $67 = (($66) + 1)|0;
  HEAP32[5149] = $67;
  $68 = HEAP32[1819]|0;
  $69 = (($68) + 1)|0;
  HEAP32[1819] = $69;
  $70 = (16500 + ($68<<2)|0);
  HEAP32[$70>>2] = $66;
 } else {
  $56 = HEAP32[$8>>2]|0;
  $57 = HEAP32[$5>>2]|0;
  _emit_idglobal($55,$56,$57);
  $58 = HEAP32[1819]|0;
  $59 = HEAP32[1819]|0;
  $60 = (16500 + ($59<<2)|0);
  HEAP32[$60>>2] = $58;
  $61 = HEAP32[1819]|0;
  $62 = (($61) + 1)|0;
  HEAP32[1819] = $62;
 }
 HEAP32[$4>>2] = 1;
 $71 = HEAP32[$4>>2]|0;
 STACKTOP = sp;return ($71|0);
}
function _emit_idglobal($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, $vararg_ptr8 = 0, $vararg_ptr9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 44|0;
 $4 = sp + 40|0;
 $5 = sp + 36|0;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $6 = HEAP32[$4>>2]|0;
 $7 = ($6|0)==(0);
 $8 = HEAP32[$3>>2]|0;
 $9 = HEAP8[861]|0;
 $10 = $9 << 24 >> 24;
 if ($7) {
  $11 = HEAP32[$5>>2]|0;
  HEAP32[$vararg_buffer>>2] = $8;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $10;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $11;
  (_printf(1755,$vararg_buffer)|0);
  STACKTOP = sp;return;
 } else {
  $12 = HEAP32[5]|0;
  $13 = HEAP32[$4>>2]|0;
  $14 = HEAP32[$5>>2]|0;
  HEAP32[$vararg_buffer3>>2] = $8;
  $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
  HEAP32[$vararg_ptr6>>2] = $10;
  $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
  HEAP32[$vararg_ptr7>>2] = $12;
  $vararg_ptr8 = ((($vararg_buffer3)) + 12|0);
  HEAP32[$vararg_ptr8>>2] = $13;
  $vararg_ptr9 = ((($vararg_buffer3)) + 16|0);
  HEAP32[$vararg_ptr9>>2] = $14;
  (_printf(1774,$vararg_buffer3)|0);
  STACKTOP = sp;return;
 }
}
function _id_add($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $4 = sp + 12|0;
 $5 = sp + 8|0;
 $6 = sp + 4|0;
 $7 = sp;
 HEAP32[$4>>2] = $0;
 HEAP32[$5>>2] = $1;
 HEAP32[$6>>2] = $2;
 HEAP32[$7>>2] = $3;
 $8 = HEAP32[$6>>2]|0;
 $9 = $8 & 64;
 $10 = ($9|0)!=(0);
 $11 = HEAP32[$4>>2]|0;
 $12 = HEAP32[$5>>2]|0;
 $13 = HEAP32[$6>>2]|0;
 $14 = HEAP32[$7>>2]|0;
 if ($10) {
  $15 = (_idlocal_add($11,$12,$13,$14)|0);
  $17 = $15;
  STACKTOP = sp;return ($17|0);
 } else {
  $16 = (_idglobal_add($11,$12,$13,$14)|0);
  $17 = $16;
  STACKTOP = sp;return ($17|0);
 }
 return (0)|0;
}
function _idfunc_add($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_ptr3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $4 = sp + 32|0;
 $5 = sp + 28|0;
 $6 = sp + 24|0;
 $7 = sp + 20|0;
 $8 = sp + 16|0;
 HEAP32[$5>>2] = $0;
 HEAP32[$6>>2] = $1;
 HEAP32[$7>>2] = $2;
 HEAP32[$8>>2] = $3;
 $9 = HEAP32[1819]|0;
 $10 = ($9|0)>(1024);
 if ($10) {
  (_printf(611,$vararg_buffer)|0);
  HEAP32[$4>>2] = 0;
  $44 = HEAP32[$4>>2]|0;
  STACKTOP = sp;return ($44|0);
 }
 $11 = HEAP32[$6>>2]|0;
 $12 = $11&255;
 $13 = HEAP32[1819]|0;
 $14 = (75876 + (($13*33)|0)|0);
 HEAP8[$14>>0] = $12;
 $15 = HEAP32[$6>>2]|0;
 $16 = ($15|0)>(32);
 if ($16) {
  HEAP32[$6>>2] = 32;
 }
 while(1) {
  $17 = HEAP32[$6>>2]|0;
  $18 = (($17) + -1)|0;
  HEAP32[$6>>2] = $18;
  $19 = ($17|0)!=(0);
  if (!($19)) {
   break;
  }
  $20 = HEAP32[$6>>2]|0;
  $21 = HEAP32[$5>>2]|0;
  $22 = (($21) + ($20)|0);
  $23 = HEAP8[$22>>0]|0;
  $24 = HEAP32[$6>>2]|0;
  $25 = (1 + ($24))|0;
  $26 = HEAP32[1819]|0;
  $27 = (75876 + (($26*33)|0)|0);
  $28 = (($27) + ($25)|0);
  HEAP8[$28>>0] = $23;
 }
 $29 = HEAP32[$7>>2]|0;
 $30 = HEAP32[1819]|0;
 $31 = (12404 + ($30<<2)|0);
 HEAP32[$31>>2] = $29;
 $32 = HEAP32[$8>>2]|0;
 $33 = HEAP32[1819]|0;
 $34 = (($33) + 1)|0;
 HEAP32[1819] = $34;
 $35 = (16500 + ($33<<2)|0);
 HEAP32[$35>>2] = $32;
 $36 = HEAP32[$7>>2]|0;
 $37 = $36 & 128;
 $38 = ($37|0)!=(0);
 if ($38) {
  $39 = HEAP32[1819]|0;
  $40 = (($39) - 1)|0;
  $41 = (75876 + (($40*33)|0)|0);
  $42 = ((($41)) + 1|0);
  $43 = HEAP32[$8>>2]|0;
  HEAP32[$vararg_buffer1>>2] = $42;
  $vararg_ptr3 = ((($vararg_buffer1)) + 4|0);
  HEAP32[$vararg_ptr3>>2] = $43;
  (_printf(701,$vararg_buffer1)|0);
 }
 HEAP32[$4>>2] = 1;
 $44 = HEAP32[$4>>2]|0;
 STACKTOP = sp;return ($44|0);
}
function _idfunc_set($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $4 = sp + 20|0;
 $5 = sp + 16|0;
 $6 = sp + 12|0;
 $7 = sp + 8|0;
 $8 = sp + 4|0;
 $9 = sp;
 HEAP32[$5>>2] = $0;
 HEAP32[$6>>2] = $1;
 HEAP32[$7>>2] = $2;
 HEAP32[$8>>2] = $3;
 $10 = HEAP32[$5>>2]|0;
 $11 = HEAP32[$6>>2]|0;
 $12 = (_idglobal_lookup($10,$11)|0);
 HEAP32[$9>>2] = $12;
 $13 = ($12|0)>=(0);
 if ($13) {
  $14 = HEAP32[$9>>2]|0;
  $15 = (12404 + ($14<<2)|0);
  $16 = HEAP32[$15>>2]|0;
  $17 = $16 & 8216;
  $18 = ($17|0)!=(0);
  if ($18) {
   $19 = HEAP32[$8>>2]|0;
   $20 = HEAP32[$9>>2]|0;
   $21 = (16500 + ($20<<2)|0);
   HEAP32[$21>>2] = $19;
   $22 = HEAP32[$7>>2]|0;
   $23 = HEAP32[$9>>2]|0;
   $24 = (12404 + ($23<<2)|0);
   HEAP32[$24>>2] = $22;
   $25 = HEAP32[$7>>2]|0;
   HEAP32[$4>>2] = $25;
   $26 = HEAP32[$4>>2]|0;
   STACKTOP = sp;return ($26|0);
  }
 }
 _parse_error(721);
 HEAP32[$4>>2] = 0;
 $26 = HEAP32[$4>>2]|0;
 STACKTOP = sp;return ($26|0);
}
function _idglobal_size($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $6 = HEAP32[$4>>2]|0;
 $7 = HEAP32[$5>>2]|0;
 $8 = ($6|0)>($7|0);
 $9 = HEAP32[$4>>2]|0;
 if ($8) {
  $10 = HEAP32[$5>>2]|0;
  $11 = (($9) - ($10))|0;
  (_emit_data(0,0,0,$11)|0);
  STACKTOP = sp;return;
 }
 $12 = ($9|0)!=(0);
 if (!($12)) {
  STACKTOP = sp;return;
 }
 $13 = HEAP32[$4>>2]|0;
 (_emit_data(0,0,0,$13)|0);
 STACKTOP = sp;return;
}
function _emit_data($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $9 = 0, $vararg_buffer = 0;
 var $vararg_buffer10 = 0, $vararg_buffer13 = 0, $vararg_buffer15 = 0, $vararg_buffer2 = 0, $vararg_buffer21 = 0, $vararg_buffer27 = 0, $vararg_buffer33 = 0, $vararg_buffer39 = 0, $vararg_buffer43 = 0, $vararg_buffer6 = 0, $vararg_ptr1 = 0, $vararg_ptr18 = 0, $vararg_ptr19 = 0, $vararg_ptr20 = 0, $vararg_ptr24 = 0, $vararg_ptr25 = 0, $vararg_ptr26 = 0, $vararg_ptr30 = 0, $vararg_ptr31 = 0, $vararg_ptr32 = 0;
 var $vararg_ptr36 = 0, $vararg_ptr37 = 0, $vararg_ptr38 = 0, $vararg_ptr42 = 0, $vararg_ptr46 = 0, $vararg_ptr5 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0;
 $vararg_buffer43 = sp + 112|0;
 $vararg_buffer39 = sp + 104|0;
 $vararg_buffer33 = sp + 88|0;
 $vararg_buffer27 = sp + 72|0;
 $vararg_buffer21 = sp + 56|0;
 $vararg_buffer15 = sp + 40|0;
 $vararg_buffer13 = sp + 32|0;
 $vararg_buffer10 = sp + 24|0;
 $vararg_buffer6 = sp + 16|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $4 = sp + 152|0;
 $5 = sp + 148|0;
 $6 = sp + 144|0;
 $7 = sp + 140|0;
 $8 = sp + 136|0;
 $9 = sp + 132|0;
 $10 = sp + 128|0;
 $11 = sp + 124|0;
 $12 = sp + 120|0;
 HEAP32[$4>>2] = $0;
 HEAP32[$5>>2] = $1;
 HEAP32[$6>>2] = $2;
 HEAP32[$7>>2] = $3;
 $13 = HEAP32[$5>>2]|0;
 $14 = ($13|0)==(0);
 if ($14) {
  $15 = HEAP32[$7>>2]|0;
  HEAP32[$8>>2] = $15;
  $16 = HEAP32[5]|0;
  $17 = HEAP32[$7>>2]|0;
  HEAP32[$vararg_buffer>>2] = $16;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $17;
  (_printf(1830,$vararg_buffer)|0);
  $82 = HEAP32[$8>>2]|0;
  STACKTOP = sp;return ($82|0);
 }
 $18 = HEAP32[$5>>2]|0;
 $19 = $18 & 1024;
 $20 = ($19|0)!=(0);
 if ($20) {
  $21 = HEAP32[$7>>2]|0;
  HEAP32[$8>>2] = $21;
  $22 = HEAP32[$6>>2]|0;
  $23 = $22;
  HEAP32[$10>>2] = $23;
  $24 = HEAP32[3]|0;
  $25 = HEAP32[$7>>2]|0;
  $26 = (($25) + -1)|0;
  HEAP32[$7>>2] = $26;
  HEAP32[$vararg_buffer2>>2] = $24;
  $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
  HEAP32[$vararg_ptr5>>2] = $26;
  (_printf(1830,$vararg_buffer2)|0);
  while(1) {
   $27 = HEAP32[$7>>2]|0;
   $28 = (($27) + -1)|0;
   HEAP32[$7>>2] = $28;
   $29 = ($27|0)>(0);
   if (!($29)) {
    break;
   }
   $30 = HEAP32[3]|0;
   $31 = HEAP32[$10>>2]|0;
   $32 = ((($31)) + 1|0);
   HEAP32[$10>>2] = $32;
   $33 = HEAP8[$31>>0]|0;
   $34 = $33 << 24 >> 24;
   HEAP32[$vararg_buffer6>>2] = $30;
   $vararg_ptr9 = ((($vararg_buffer6)) + 4|0);
   HEAP32[$vararg_ptr9>>2] = $34;
   (_printf(824,$vararg_buffer6)|0);
   HEAP32[$9>>2] = 0;
   while(1) {
    $35 = HEAP32[$9>>2]|0;
    $36 = ($35|0)<(7);
    if (!($36)) {
     break;
    }
    $37 = HEAP32[$7>>2]|0;
    $38 = (($37) + -1)|0;
    HEAP32[$7>>2] = $38;
    $39 = ($37|0)>(0);
    if (!($39)) {
     break;
    }
    $40 = HEAP32[$10>>2]|0;
    $41 = ((($40)) + 1|0);
    HEAP32[$10>>2] = $41;
    $42 = HEAP8[$40>>0]|0;
    $43 = $42 << 24 >> 24;
    HEAP32[$vararg_buffer10>>2] = $43;
    (_printf(834,$vararg_buffer10)|0);
    $44 = HEAP32[$9>>2]|0;
    $45 = (($44) + 1)|0;
    HEAP32[$9>>2] = $45;
   }
   (_printf(841,$vararg_buffer13)|0);
  }
  $82 = HEAP32[$8>>2]|0;
  STACKTOP = sp;return ($82|0);
 }
 $46 = HEAP32[$5>>2]|0;
 $47 = $46 & 8350;
 $48 = ($47|0)!=(0);
 $49 = HEAP32[$4>>2]|0;
 $50 = $49 & 2;
 $51 = ($50|0)!=(0);
 if (!($48)) {
  if ($51) {
   HEAP32[$8>>2] = 2;
   $76 = HEAP32[4]|0;
   $77 = HEAP32[$6>>2]|0;
   $78 = $77 & 65535;
   HEAP32[$vararg_buffer39>>2] = $76;
   $vararg_ptr42 = ((($vararg_buffer39)) + 4|0);
   HEAP32[$vararg_ptr42>>2] = $78;
   (_printf(1879,$vararg_buffer39)|0);
   $82 = HEAP32[$8>>2]|0;
   STACKTOP = sp;return ($82|0);
  } else {
   HEAP32[$8>>2] = 1;
   $79 = HEAP32[3]|0;
   $80 = HEAP32[$6>>2]|0;
   $81 = $80 & 255;
   HEAP32[$vararg_buffer43>>2] = $79;
   $vararg_ptr46 = ((($vararg_buffer43)) + 4|0);
   HEAP32[$vararg_ptr46>>2] = $81;
   (_printf(1891,$vararg_buffer43)|0);
   $82 = HEAP32[$8>>2]|0;
   STACKTOP = sp;return ($82|0);
  }
 }
 $52 = HEAP32[$6>>2]|0;
 $53 = HEAP32[$5>>2]|0;
 if ($51) {
  $54 = (_fixup_new($52,$53,128)|0);
  HEAP32[$11>>2] = $54;
  HEAP32[$8>>2] = 2;
  $55 = HEAP32[$5>>2]|0;
  $56 = $55 & 128;
  $57 = ($56|0)!=(0);
  $58 = HEAP32[$11>>2]|0;
  $59 = HEAP8[861]|0;
  $60 = $59 << 24 >> 24;
  $61 = HEAP32[4]|0;
  $62 = HEAP32[$6>>2]|0;
  $63 = HEAP32[$5>>2]|0;
  $64 = (_tag_string($62,$63)|0);
  if ($57) {
   HEAP32[$vararg_buffer15>>2] = $58;
   $vararg_ptr18 = ((($vararg_buffer15)) + 4|0);
   HEAP32[$vararg_ptr18>>2] = $60;
   $vararg_ptr19 = ((($vararg_buffer15)) + 8|0);
   HEAP32[$vararg_ptr19>>2] = $61;
   $vararg_ptr20 = ((($vararg_buffer15)) + 12|0);
   HEAP32[$vararg_ptr20>>2] = $64;
   (_printf(1841,$vararg_buffer15)|0);
   $82 = HEAP32[$8>>2]|0;
   STACKTOP = sp;return ($82|0);
  } else {
   HEAP32[$vararg_buffer21>>2] = $58;
   $vararg_ptr24 = ((($vararg_buffer21)) + 4|0);
   HEAP32[$vararg_ptr24>>2] = $60;
   $vararg_ptr25 = ((($vararg_buffer21)) + 8|0);
   HEAP32[$vararg_ptr25>>2] = $61;
   $vararg_ptr26 = ((($vararg_buffer21)) + 12|0);
   HEAP32[$vararg_ptr26>>2] = $64;
   (_printf(1863,$vararg_buffer21)|0);
   $82 = HEAP32[$8>>2]|0;
   STACKTOP = sp;return ($82|0);
  }
 } else {
  $65 = (_fixup_new($52,$53,0)|0);
  HEAP32[$12>>2] = $65;
  HEAP32[$8>>2] = 1;
  $66 = HEAP32[$5>>2]|0;
  $67 = $66 & 128;
  $68 = ($67|0)!=(0);
  $69 = HEAP32[$12>>2]|0;
  $70 = HEAP8[861]|0;
  $71 = $70 << 24 >> 24;
  $72 = HEAP32[3]|0;
  $73 = HEAP32[$6>>2]|0;
  $74 = HEAP32[$5>>2]|0;
  $75 = (_tag_string($73,$74)|0);
  if ($68) {
   HEAP32[$vararg_buffer27>>2] = $69;
   $vararg_ptr30 = ((($vararg_buffer27)) + 4|0);
   HEAP32[$vararg_ptr30>>2] = $71;
   $vararg_ptr31 = ((($vararg_buffer27)) + 8|0);
   HEAP32[$vararg_ptr31>>2] = $72;
   $vararg_ptr32 = ((($vararg_buffer27)) + 12|0);
   HEAP32[$vararg_ptr32>>2] = $75;
   (_printf(1841,$vararg_buffer27)|0);
   $82 = HEAP32[$8>>2]|0;
   STACKTOP = sp;return ($82|0);
  } else {
   HEAP32[$vararg_buffer33>>2] = $69;
   $vararg_ptr36 = ((($vararg_buffer33)) + 4|0);
   HEAP32[$vararg_ptr36>>2] = $71;
   $vararg_ptr37 = ((($vararg_buffer33)) + 8|0);
   HEAP32[$vararg_ptr37>>2] = $72;
   $vararg_ptr38 = ((($vararg_buffer33)) + 12|0);
   HEAP32[$vararg_ptr38>>2] = $75;
   (_printf(1863,$vararg_buffer33)|0);
   $82 = HEAP32[$8>>2]|0;
   STACKTOP = sp;return ($82|0);
  }
 }
 return (0)|0;
}
function _id_tag($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 $6 = HEAP32[$3>>2]|0;
 $7 = HEAP32[$4>>2]|0;
 $8 = (_idlocal_lookup($6,$7)|0);
 HEAP32[$5>>2] = $8;
 $9 = ($8|0)>=(0);
 if ($9) {
  $10 = HEAP32[$5>>2]|0;
  $11 = (11892 + ($10<<2)|0);
  $12 = HEAP32[$11>>2]|0;
  HEAP32[$2>>2] = $12;
  $20 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($20|0);
 }
 $13 = HEAP32[$3>>2]|0;
 $14 = HEAP32[$4>>2]|0;
 $15 = (_idglobal_lookup($13,$14)|0);
 HEAP32[$5>>2] = $15;
 $16 = ($15|0)>=(0);
 if ($16) {
  $17 = HEAP32[$5>>2]|0;
  $18 = (16500 + ($17<<2)|0);
  $19 = HEAP32[$18>>2]|0;
  HEAP32[$2>>2] = $19;
  $20 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($20|0);
 } else {
  HEAP32[$2>>2] = -1;
  $20 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($20|0);
 }
 return (0)|0;
}
function _id_const($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 $6 = HEAP32[$3>>2]|0;
 $7 = HEAP32[$4>>2]|0;
 $8 = (_idconst_lookup($6,$7)|0);
 HEAP32[$5>>2] = $8;
 $9 = ($8|0)>=(0);
 if ($9) {
  $10 = HEAP32[$5>>2]|0;
  $11 = (7280 + ($10<<2)|0);
  $12 = HEAP32[$11>>2]|0;
  HEAP32[$2>>2] = $12;
  $13 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($13|0);
 } else {
  _parse_error(743);
  HEAP32[$2>>2] = 0;
  $13 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($13|0);
 }
 return (0)|0;
}
function _id_type($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 $6 = HEAP32[$3>>2]|0;
 $7 = HEAP32[$4>>2]|0;
 $8 = (_idconst_lookup($6,$7)|0);
 HEAP32[$5>>2] = $8;
 $9 = ($8|0)>=(0);
 do {
  if ($9) {
   HEAP32[$2>>2] = 1;
  } else {
   $10 = HEAP32[$3>>2]|0;
   $11 = HEAP32[$4>>2]|0;
   $12 = (_idlocal_lookup($10,$11)|0);
   HEAP32[$5>>2] = $12;
   $13 = ($12|0)>=(0);
   if ($13) {
    $14 = HEAP32[$5>>2]|0;
    $15 = (11380 + ($14<<2)|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = $16 | 64;
    HEAP32[$2>>2] = $17;
    break;
   }
   $18 = HEAP32[$3>>2]|0;
   $19 = HEAP32[$4>>2]|0;
   $20 = (_idglobal_lookup($18,$19)|0);
   HEAP32[$5>>2] = $20;
   $21 = ($20|0)>=(0);
   if ($21) {
    $22 = HEAP32[$5>>2]|0;
    $23 = (12404 + ($22<<2)|0);
    $24 = HEAP32[$23>>2]|0;
    HEAP32[$2>>2] = $24;
    break;
   } else {
    _parse_error(721);
    HEAP32[$2>>2] = 0;
    break;
   }
  }
 } while(0);
 $25 = HEAP32[$2>>2]|0;
 STACKTOP = sp;return ($25|0);
}
function _tag_new($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp + 4|0;
 $2 = sp;
 HEAP32[$2>>2] = $0;
 $3 = HEAP32[$2>>2]|0;
 $4 = $3 & 128;
 $5 = ($4|0)!=(0);
 do {
  if ($5) {
   $6 = HEAP32[5149]|0;
   $7 = ($6|0)>(254);
   if ($7) {
    _parse_error(763);
   }
   $8 = HEAP32[5149]|0;
   $9 = (($8) + 1)|0;
   HEAP32[5149] = $9;
   HEAP32[$1>>2] = $8;
  } else {
   $10 = HEAP32[$2>>2]|0;
   $11 = $10 & 8192;
   $12 = ($11|0)!=(0);
   if ($12) {
    $13 = HEAP32[5150]|0;
    $14 = (($13) + 1)|0;
    HEAP32[5150] = $14;
    HEAP32[$1>>2] = $13;
    break;
   }
   $15 = HEAP32[$2>>2]|0;
   $16 = $15 & 8;
   $17 = ($16|0)!=(0);
   if ($17) {
    $18 = HEAP32[5151]|0;
    $19 = (($18) + 1)|0;
    HEAP32[5151] = $19;
    HEAP32[$1>>2] = $18;
    break;
   }
   $20 = HEAP32[$2>>2]|0;
   $21 = $20 & 16;
   $22 = ($21|0)!=(0);
   if ($22) {
    $23 = HEAP32[5152]|0;
    $24 = (($23) + 1)|0;
    HEAP32[5152] = $24;
    HEAP32[$1>>2] = $23;
    break;
   }
   $25 = HEAP32[$2>>2]|0;
   $26 = $25 & 32;
   $27 = ($26|0)!=(0);
   if ($27) {
    $28 = HEAP32[2]|0;
    $29 = (($28) + 1)|0;
    HEAP32[2] = $29;
    HEAP32[$1>>2] = $28;
    break;
   } else {
    $30 = HEAP32[1819]|0;
    $31 = (($30) + 1)|0;
    HEAP32[1819] = $31;
    HEAP32[$1>>2] = $30;
    break;
   }
  }
 } while(0);
 $32 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($32|0);
}
function _fixup_new($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $6 = HEAP32[$3>>2]|0;
 $7 = HEAP32[5153]|0;
 $8 = (20616 + ($7<<2)|0);
 HEAP32[$8>>2] = $6;
 $9 = HEAP32[$4>>2]|0;
 $10 = HEAP32[5153]|0;
 $11 = (28808 + ($10<<2)|0);
 HEAP32[$11>>2] = $9;
 $12 = HEAP32[$5>>2]|0;
 $13 = $12&255;
 $14 = HEAP32[5153]|0;
 $15 = (109668 + ($14)|0);
 HEAP8[$15>>0] = $13;
 $16 = HEAP32[5153]|0;
 $17 = (($16) + 1)|0;
 HEAP32[5153] = $17;
 STACKTOP = sp;return ($16|0);
}
function _supper($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp + 4|0;
 $2 = sp;
 HEAP32[$1>>2] = $0;
 HEAP32[$2>>2] = 0;
 while(1) {
  $3 = HEAP32[$2>>2]|0;
  $4 = HEAP32[$1>>2]|0;
  $5 = (($4) + ($3)|0);
  $6 = HEAP8[$5>>0]|0;
  $7 = ($6<<24>>24)!=(0);
  $8 = HEAP32[$2>>2]|0;
  if (!($7)) {
   break;
  }
  $9 = HEAP32[$1>>2]|0;
  $10 = (($9) + ($8)|0);
  $11 = HEAP8[$10>>0]|0;
  $12 = $11 << 24 >> 24;
  $13 = (_toupper($12)|0);
  $14 = $13&255;
  $15 = HEAP32[$2>>2]|0;
  $16 = (111716 + ($15)|0);
  HEAP8[$16>>0] = $14;
  $17 = HEAP32[$2>>2]|0;
  $18 = (($17) + 1)|0;
  HEAP32[$2>>2] = $18;
 }
 $19 = (111716 + ($8)|0);
 HEAP8[$19>>0] = 0;
 STACKTOP = sp;return (111716|0);
}
function _tag_string($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 16|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $5 = HEAP32[$3>>2]|0;
 $6 = $5 & 128;
 $7 = ($6|0)!=(0);
 do {
  if ($7) {
   HEAP8[$4>>0] = 88;
  } else {
   $8 = HEAP32[$3>>2]|0;
   $9 = $8 & 16;
   $10 = ($9|0)!=(0);
   if ($10) {
    HEAP8[$4>>0] = 67;
    break;
   }
   $11 = HEAP32[$3>>2]|0;
   $12 = $11 & 8;
   $13 = ($12|0)!=(0);
   if ($13) {
    HEAP8[$4>>0] = 65;
    break;
   }
   $14 = HEAP32[$3>>2]|0;
   $15 = $14 & 32;
   $16 = ($15|0)!=(0);
   if ($16) {
    HEAP8[$4>>0] = 66;
    break;
   }
   $17 = HEAP32[$3>>2]|0;
   $18 = $17 & 8192;
   $19 = ($18|0)!=(0);
   if ($19) {
    HEAP8[$4>>0] = 80;
    break;
   } else {
    HEAP8[$4>>0] = 68;
    break;
   }
  }
 } while(0);
 $20 = HEAP8[$4>>0]|0;
 $21 = $20 << 24 >> 24;
 $22 = HEAP32[$2>>2]|0;
 HEAP32[$vararg_buffer>>2] = $21;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $22;
 (_sprintf(111796,797,$vararg_buffer)|0);
 STACKTOP = sp;return (111796|0);
}
function _emit_dci($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer5 = 0, $vararg_buffer8 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer8 = sp + 24|0;
 $vararg_buffer5 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $2 = sp + 32|0;
 $3 = sp + 28|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) + -1)|0;
 HEAP32[$3>>2] = $5;
 $6 = ($4|0)!=(0);
 if (!($6)) {
  STACKTOP = sp;return;
 }
 $7 = HEAP32[$2>>2]|0;
 $8 = (_supper($7)|0);
 HEAP32[$vararg_buffer>>2] = $8;
 (_printf(805,$vararg_buffer)|0);
 $9 = HEAP32[3]|0;
 $10 = HEAP32[$2>>2]|0;
 $11 = ((($10)) + 1|0);
 HEAP32[$2>>2] = $11;
 $12 = HEAP8[$10>>0]|0;
 $13 = $12 << 24 >> 24;
 $14 = (_toupper($13)|0);
 $15 = HEAP32[$3>>2]|0;
 $16 = ($15|0)!=(0);
 $17 = $16 ? 128 : 0;
 $18 = $14 | $17;
 HEAP32[$vararg_buffer1>>2] = $9;
 $vararg_ptr4 = ((($vararg_buffer1)) + 4|0);
 HEAP32[$vararg_ptr4>>2] = $18;
 (_printf(824,$vararg_buffer1)|0);
 while(1) {
  $19 = HEAP32[$3>>2]|0;
  $20 = (($19) + -1)|0;
  HEAP32[$3>>2] = $20;
  $21 = ($19|0)!=(0);
  if (!($21)) {
   break;
  }
  $22 = HEAP32[$2>>2]|0;
  $23 = ((($22)) + 1|0);
  HEAP32[$2>>2] = $23;
  $24 = HEAP8[$22>>0]|0;
  $25 = $24 << 24 >> 24;
  $26 = (_toupper($25)|0);
  $27 = HEAP32[$3>>2]|0;
  $28 = ($27|0)!=(0);
  $29 = $28 ? 128 : 0;
  $30 = $26 | $29;
  HEAP32[$vararg_buffer5>>2] = $30;
  (_printf(834,$vararg_buffer5)|0);
 }
 (_printf(841,$vararg_buffer8)|0);
 STACKTOP = sp;return;
}
function _emit_flags($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[$1>>2]|0;
 HEAP32[9250] = $2;
 $3 = HEAP32[9250]|0;
 $4 = $3 & 1;
 $5 = ($4|0)!=(0);
 if (!($5)) {
  STACKTOP = sp;return;
 }
 HEAP32[3] = 843;
 HEAP32[4] = 849;
 HEAP32[5] = 855;
 HEAP8[861] = 32;
 STACKTOP = sp;return;
}
function _emit_header() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer11 = 0, $vararg_buffer14 = 0, $vararg_buffer17 = 0, $vararg_buffer20 = 0;
 var $vararg_buffer23 = 0, $vararg_buffer3 = 0, $vararg_buffer5 = 0, $vararg_buffer8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $vararg_buffer23 = sp + 72|0;
 $vararg_buffer20 = sp + 64|0;
 $vararg_buffer17 = sp + 56|0;
 $vararg_buffer14 = sp + 48|0;
 $vararg_buffer11 = sp + 40|0;
 $vararg_buffer8 = sp + 32|0;
 $vararg_buffer5 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = HEAP32[9250]|0;
 $1 = $0 & 1;
 $2 = ($1|0)!=(0);
 if ($2) {
  (_printf(862,$vararg_buffer)|0);
 } else {
  (_printf(888,$vararg_buffer1)|0);
 }
 $3 = HEAP32[9250]|0;
 $4 = $3 & 2;
 $5 = ($4|0)!=(0);
 if ($5) {
  $6 = HEAP32[4]|0;
  HEAP32[$vararg_buffer3>>2] = $6;
  (_printf(914,$vararg_buffer3)|0);
  $7 = HEAP8[861]|0;
  $8 = $7 << 24 >> 24;
  HEAP32[$vararg_buffer5>>2] = $8;
  (_printf(987,$vararg_buffer5)|0);
  $9 = HEAP32[4]|0;
  HEAP32[$vararg_buffer8>>2] = $9;
  (_printf(1000,$vararg_buffer8)|0);
  $10 = HEAP32[4]|0;
  HEAP32[$vararg_buffer11>>2] = $10;
  (_printf(1023,$vararg_buffer11)|0);
  $11 = HEAP32[4]|0;
  HEAP32[$vararg_buffer14>>2] = $11;
  (_printf(1055,$vararg_buffer14)|0);
  $12 = HEAP32[4]|0;
  HEAP32[$vararg_buffer17>>2] = $12;
  (_printf(1093,$vararg_buffer17)|0);
  $13 = HEAP32[4]|0;
  HEAP32[$vararg_buffer20>>2] = $13;
  (_printf(1129,$vararg_buffer20)|0);
  STACKTOP = sp;return;
 } else {
  (_printf(1174,$vararg_buffer23)|0);
  STACKTOP = sp;return;
 }
}
function _emit_rld() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer10 = 0, $vararg_buffer14 = 0, $vararg_buffer18 = 0, $vararg_buffer22 = 0, $vararg_buffer26 = 0, $vararg_buffer3 = 0, $vararg_buffer30 = 0;
 var $vararg_buffer33 = 0, $vararg_buffer7 = 0, $vararg_ptr13 = 0, $vararg_ptr17 = 0, $vararg_ptr21 = 0, $vararg_ptr25 = 0, $vararg_ptr29 = 0, $vararg_ptr6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0;
 $vararg_buffer33 = sp + 80|0;
 $vararg_buffer30 = sp + 72|0;
 $vararg_buffer26 = sp + 64|0;
 $vararg_buffer22 = sp + 56|0;
 $vararg_buffer18 = sp + 48|0;
 $vararg_buffer14 = sp + 40|0;
 $vararg_buffer10 = sp + 32|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = sp + 84|0;
 (_printf(1220,$vararg_buffer)|0);
 HEAP32[$0>>2] = 0;
 while(1) {
  $1 = HEAP32[$0>>2]|0;
  $2 = HEAP32[1819]|0;
  $3 = ($1|0)<($2|0);
  if (!($3)) {
   break;
  }
  $4 = HEAP32[$0>>2]|0;
  $5 = (12404 + ($4<<2)|0);
  $6 = HEAP32[$5>>2]|0;
  $7 = $6 & 128;
  $8 = ($7|0)!=(0);
  if (!($8)) {
   $9 = HEAP32[$0>>2]|0;
   $10 = (12404 + ($9<<2)|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = $11 & 16;
   $13 = ($12|0)!=(0);
   if ($13) {
    $14 = HEAP32[3]|0;
    HEAP32[$vararg_buffer1>>2] = $14;
    (_printf(1252,$vararg_buffer1)|0);
    $15 = HEAP32[4]|0;
    $16 = HEAP32[$0>>2]|0;
    $17 = (16500 + ($16<<2)|0);
    $18 = HEAP32[$17>>2]|0;
    HEAP32[$vararg_buffer3>>2] = $15;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $18;
    (_printf(1282,$vararg_buffer3)|0);
    $19 = HEAP32[3]|0;
    HEAP32[$vararg_buffer7>>2] = $19;
    (_printf(1296,$vararg_buffer7)|0);
   }
  }
  $20 = HEAP32[$0>>2]|0;
  $21 = (($20) + 1)|0;
  HEAP32[$0>>2] = $21;
 }
 HEAP32[$0>>2] = 0;
 while(1) {
  $22 = HEAP32[$0>>2]|0;
  $23 = HEAP32[5153]|0;
  $24 = ($22|0)<($23|0);
  if (!($24)) {
   break;
  }
  $25 = HEAP32[$0>>2]|0;
  $26 = (28808 + ($25<<2)|0);
  $27 = HEAP32[$26>>2]|0;
  $28 = $27 & 128;
  $29 = ($28|0)!=(0);
  $30 = HEAP32[3]|0;
  $31 = HEAP32[$0>>2]|0;
  $32 = (109668 + ($31)|0);
  $33 = HEAP8[$32>>0]|0;
  $34 = $33 << 24 >> 24;
  if ($29) {
   $35 = (17 + ($34))|0;
   $36 = $35 & 255;
   HEAP32[$vararg_buffer10>>2] = $30;
   $vararg_ptr13 = ((($vararg_buffer10)) + 4|0);
   HEAP32[$vararg_ptr13>>2] = $36;
   (_printf(1305,$vararg_buffer10)|0);
   $37 = HEAP32[4]|0;
   $38 = HEAP32[$0>>2]|0;
   HEAP32[$vararg_buffer14>>2] = $37;
   $vararg_ptr17 = ((($vararg_buffer14)) + 4|0);
   HEAP32[$vararg_ptr17>>2] = $38;
   (_printf(1335,$vararg_buffer14)|0);
   $39 = HEAP32[3]|0;
   $40 = HEAP32[$0>>2]|0;
   $41 = (20616 + ($40<<2)|0);
   $42 = HEAP32[$41>>2]|0;
   HEAP32[$vararg_buffer18>>2] = $39;
   $vararg_ptr21 = ((($vararg_buffer18)) + 4|0);
   HEAP32[$vararg_ptr21>>2] = $42;
   (_printf(1359,$vararg_buffer18)|0);
  } else {
   $43 = (1 + ($34))|0;
   $44 = $43 & 255;
   HEAP32[$vararg_buffer22>>2] = $30;
   $vararg_ptr25 = ((($vararg_buffer22)) + 4|0);
   HEAP32[$vararg_ptr25>>2] = $44;
   (_printf(1381,$vararg_buffer22)|0);
   $45 = HEAP32[4]|0;
   $46 = HEAP32[$0>>2]|0;
   HEAP32[$vararg_buffer26>>2] = $45;
   $vararg_ptr29 = ((($vararg_buffer26)) + 4|0);
   HEAP32[$vararg_ptr29>>2] = $46;
   (_printf(1335,$vararg_buffer26)|0);
   $47 = HEAP32[3]|0;
   HEAP32[$vararg_buffer30>>2] = $47;
   (_printf(1296,$vararg_buffer30)|0);
  }
  $48 = HEAP32[$0>>2]|0;
  $49 = (($48) + 1)|0;
  HEAP32[$0>>2] = $49;
 }
 $50 = HEAP32[3]|0;
 HEAP32[$vararg_buffer33>>2] = $50;
 (_printf(1411,$vararg_buffer33)|0);
 STACKTOP = sp;return;
}
function _emit_esd() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer10 = 0, $vararg_buffer14 = 0, $vararg_buffer3 = 0, $vararg_buffer7 = 0, $vararg_ptr13 = 0, $vararg_ptr6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer14 = sp + 40|0;
 $vararg_buffer10 = sp + 32|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = sp + 44|0;
 (_printf(1435,$vararg_buffer)|0);
 HEAP32[$0>>2] = 0;
 while(1) {
  $1 = HEAP32[$0>>2]|0;
  $2 = HEAP32[1819]|0;
  $3 = ($1|0)<($2|0);
  if (!($3)) {
   break;
  }
  $4 = HEAP32[$0>>2]|0;
  $5 = (12404 + ($4<<2)|0);
  $6 = HEAP32[$5>>2]|0;
  $7 = $6 & 128;
  $8 = ($7|0)!=(0);
  $9 = HEAP32[$0>>2]|0;
  if ($8) {
   $10 = (75876 + (($9*33)|0)|0);
   $11 = ((($10)) + 1|0);
   $12 = HEAP32[$0>>2]|0;
   $13 = (75876 + (($12*33)|0)|0);
   $14 = HEAP8[$13>>0]|0;
   $15 = $14 << 24 >> 24;
   _emit_dci($11,$15);
   $16 = HEAP32[3]|0;
   HEAP32[$vararg_buffer1>>2] = $16;
   (_printf(1475,$vararg_buffer1)|0);
   $17 = HEAP32[4]|0;
   $18 = HEAP32[$0>>2]|0;
   $19 = (16500 + ($18<<2)|0);
   $20 = HEAP32[$19>>2]|0;
   HEAP32[$vararg_buffer3>>2] = $17;
   $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
   HEAP32[$vararg_ptr6>>2] = $20;
   (_printf(1359,$vararg_buffer3)|0);
  } else {
   $21 = (12404 + ($9<<2)|0);
   $22 = HEAP32[$21>>2]|0;
   $23 = $22 & 4096;
   $24 = ($23|0)!=(0);
   if ($24) {
    $25 = HEAP32[$0>>2]|0;
    $26 = (75876 + (($25*33)|0)|0);
    $27 = ((($26)) + 1|0);
    $28 = HEAP32[$0>>2]|0;
    $29 = (75876 + (($28*33)|0)|0);
    $30 = HEAP8[$29>>0]|0;
    $31 = $30 << 24 >> 24;
    _emit_dci($27,$31);
    $32 = HEAP32[3]|0;
    HEAP32[$vararg_buffer7>>2] = $32;
    (_printf(1509,$vararg_buffer7)|0);
    $33 = HEAP32[4]|0;
    $34 = HEAP32[$0>>2]|0;
    $35 = (16500 + ($34<<2)|0);
    $36 = HEAP32[$35>>2]|0;
    $37 = HEAP32[$0>>2]|0;
    $38 = (12404 + ($37<<2)|0);
    $39 = HEAP32[$38>>2]|0;
    $40 = (_tag_string($36,$39)|0);
    HEAP32[$vararg_buffer10>>2] = $33;
    $vararg_ptr13 = ((($vararg_buffer10)) + 4|0);
    HEAP32[$vararg_ptr13>>2] = $40;
    (_printf(1540,$vararg_buffer10)|0);
   }
  }
  $41 = HEAP32[$0>>2]|0;
  $42 = (($41) + 1)|0;
  HEAP32[$0>>2] = $42;
 }
 $43 = HEAP32[3]|0;
 HEAP32[$vararg_buffer14>>2] = $43;
 (_printf(1550,$vararg_buffer14)|0);
 STACKTOP = sp;return;
}
function _emit_trailer() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer3 = 0, $vararg_buffer5 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer5 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = HEAP32[9250]|0;
 $1 = $0 & 8;
 $2 = ($1|0)!=(0);
 if (!($2)) {
  _emit_bytecode_seg();
 }
 $3 = HEAP32[9250]|0;
 $4 = $3 & 16;
 $5 = ($4|0)!=(0);
 if (!($5)) {
  (_printf(1574,$vararg_buffer)|0);
 }
 $6 = HEAP32[9250]|0;
 $7 = $6 & 32;
 $8 = ($7|0)!=(0);
 if (!($8)) {
  (_printf(1585,$vararg_buffer1)|0);
 }
 $9 = HEAP32[9250]|0;
 $10 = $9 & 2;
 $11 = ($10|0)!=(0);
 if (!($11)) {
  STACKTOP = sp;return;
 }
 $12 = HEAP32[5152]|0;
 HEAP32[$vararg_buffer3>>2] = $12;
 (_printf(1600,$vararg_buffer3)|0);
 $13 = HEAP8[861]|0;
 $14 = $13 << 24 >> 24;
 HEAP32[$vararg_buffer5>>2] = $14;
 (_printf(1614,$vararg_buffer5)|0);
 _emit_rld();
 _emit_esd();
 STACKTOP = sp;return;
}
function _emit_bytecode_seg() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[9250]|0;
 $1 = $0 & 2;
 $2 = ($1|0)!=(0);
 if ($2) {
  $3 = HEAP32[9250]|0;
  $4 = $3 & 8;
  $5 = ($4|0)!=(0);
  if (!($5)) {
   $6 = HEAP8[861]|0;
   $7 = $6 << 24 >> 24;
   HEAP32[$vararg_buffer>>2] = $7;
   (_printf(1700,$vararg_buffer)|0);
  }
 }
 $8 = HEAP32[9250]|0;
 $9 = $8 | 8;
 HEAP32[9250] = $9;
 STACKTOP = sp;return;
}
function _emit_moddep($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = sp + 8|0;
 $3 = sp + 4|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $4 = HEAP32[9250]|0;
 $5 = $4 & 2;
 $6 = ($5|0)!=(0);
 if (!($6)) {
  STACKTOP = sp;return;
 }
 $7 = HEAP32[$2>>2]|0;
 $8 = ($7|0)!=(0|0);
 if ($8) {
  $9 = HEAP32[$2>>2]|0;
  $10 = HEAP32[$3>>2]|0;
  _emit_dci($9,$10);
  STACKTOP = sp;return;
 } else {
  $11 = HEAP32[3]|0;
  HEAP32[$vararg_buffer>>2] = $11;
  (_printf(1625,$vararg_buffer)|0);
  STACKTOP = sp;return;
 }
}
function _emit_sysflags($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 4|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 (_printf(1665,$vararg_buffer)|0);
 $3 = HEAP32[9250]|0;
 $4 = $3 | 32;
 HEAP32[9250] = $4;
 STACKTOP = sp;return;
}
function _emit_asm($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 4|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 (_printf(1732,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_idfunc($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = sp + 16|0;
 $5 = sp + 12|0;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $6 = HEAP32[$3>>2]|0;
 $7 = HEAP32[$4>>2]|0;
 $8 = (_tag_string($6,$7)|0);
 $9 = HEAP8[861]|0;
 $10 = $9 << 24 >> 24;
 $11 = HEAP32[$5>>2]|0;
 HEAP32[$vararg_buffer>>2] = $8;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $10;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $11;
 (_printf(1797,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_def($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $or$cond = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = sp + 8|0;
 $3 = sp + 4|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $4 = HEAP32[9250]|0;
 $5 = $4 & 2;
 $6 = ($5|0)==(0);
 $7 = HEAP32[$3>>2]|0;
 $8 = ($7|0)!=(0);
 $or$cond = $6 & $8;
 if (!($or$cond)) {
  HEAP32[1818] = 0;
  HEAP32[2844] = 0;
  STACKTOP = sp;return;
 }
 (_printf(1903,$vararg_buffer)|0);
 HEAP32[1818] = 0;
 HEAP32[2844] = 0;
 STACKTOP = sp;return;
}
function _emit_codetag($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 8|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = HEAP8[861]|0;
 $4 = $3 << 24 >> 24;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $4;
 (_printf(1916,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_const($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_buffer7 = 0;
 var $vararg_ptr10 = 0, $vararg_ptr11 = 0, $vararg_ptr12 = 0, $vararg_ptr5 = 0, $vararg_ptr6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 40|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0);
 if ($3) {
  $4 = HEAP32[3]|0;
  HEAP32[$vararg_buffer>>2] = $4;
  (_printf(1926,$vararg_buffer)|0);
  STACKTOP = sp;return;
 }
 $5 = HEAP32[$1>>2]|0;
 $6 = ($5|0)>(0);
 $7 = HEAP32[$1>>2]|0;
 $8 = ($7|0)<(256);
 $or$cond = $6 & $8;
 $9 = HEAP32[3]|0;
 $10 = HEAP32[$1>>2]|0;
 if ($or$cond) {
  $11 = HEAP32[$1>>2]|0;
  HEAP32[$vararg_buffer2>>2] = $9;
  $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
  HEAP32[$vararg_ptr5>>2] = $10;
  $vararg_ptr6 = ((($vararg_buffer2)) + 8|0);
  HEAP32[$vararg_ptr6>>2] = $11;
  (_printf(1944,$vararg_buffer2)|0);
  STACKTOP = sp;return;
 } else {
  $12 = $10 & 255;
  $13 = HEAP32[$1>>2]|0;
  $14 = $13 >> 8;
  $15 = $14 & 255;
  $16 = HEAP32[$1>>2]|0;
  HEAP32[$vararg_buffer7>>2] = $9;
  $vararg_ptr10 = ((($vararg_buffer7)) + 4|0);
  HEAP32[$vararg_ptr10>>2] = $12;
  $vararg_ptr11 = ((($vararg_buffer7)) + 8|0);
  HEAP32[$vararg_ptr11>>2] = $15;
  $vararg_ptr12 = ((($vararg_buffer7)) + 12|0);
  HEAP32[$vararg_ptr12>>2] = $16;
  (_printf(1969,$vararg_buffer7)|0);
  STACKTOP = sp;return;
 }
}
function _emit_conststr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $2 = sp + 8|0;
 $3 = sp + 4|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $4 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $4;
 (_printf(1999,$vararg_buffer)|0);
 $5 = HEAP32[$2>>2]|0;
 $6 = HEAP32[$3>>2]|0;
 (_emit_data(0,1024,$5,$6)|0);
 STACKTOP = sp;return;
}
function _emit_lb() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2015,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_lw() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2031,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_llb($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 12|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $4;
 (_printf(2047,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_llw($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 12|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $4;
 (_printf(2075,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_lab($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, $vararg_ptr8 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 52|0;
 $4 = sp + 48|0;
 $5 = sp + 44|0;
 $6 = sp + 40|0;
 $7 = sp + 36|0;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $8 = HEAP32[$3>>2]|0;
 $9 = HEAP32[$5>>2]|0;
 $10 = (_fixup_new($8,$9,128)|0);
 HEAP32[$6>>2] = $10;
 $11 = HEAP32[$3>>2]|0;
 $12 = HEAP32[$5>>2]|0;
 $13 = (_tag_string($11,$12)|0);
 HEAP32[$7>>2] = $13;
 $14 = HEAP32[3]|0;
 $15 = HEAP32[$7>>2]|0;
 $16 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $16;
 (_printf(2103,$vararg_buffer)|0);
 $17 = HEAP32[$6>>2]|0;
 $18 = HEAP8[861]|0;
 $19 = $18 << 24 >> 24;
 $20 = HEAP32[4]|0;
 $21 = HEAP32[$5>>2]|0;
 $22 = $21 & 128;
 $23 = ($22|0)!=(0);
 $24 = HEAP32[$7>>2]|0;
 $25 = $23 ? 2147 : $24;
 $26 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer3>>2] = $17;
 $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
 HEAP32[$vararg_ptr6>>2] = $19;
 $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
 HEAP32[$vararg_ptr7>>2] = $20;
 $vararg_ptr8 = ((($vararg_buffer3)) + 12|0);
 HEAP32[$vararg_ptr8>>2] = $25;
 $vararg_ptr9 = ((($vararg_buffer3)) + 16|0);
 HEAP32[$vararg_ptr9>>2] = $26;
 (_printf(2126,$vararg_buffer3)|0);
 STACKTOP = sp;return;
}
function _emit_law($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, $vararg_ptr8 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 52|0;
 $4 = sp + 48|0;
 $5 = sp + 44|0;
 $6 = sp + 40|0;
 $7 = sp + 36|0;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $8 = HEAP32[$3>>2]|0;
 $9 = HEAP32[$5>>2]|0;
 $10 = (_fixup_new($8,$9,128)|0);
 HEAP32[$6>>2] = $10;
 $11 = HEAP32[$3>>2]|0;
 $12 = HEAP32[$5>>2]|0;
 $13 = (_tag_string($11,$12)|0);
 HEAP32[$7>>2] = $13;
 $14 = HEAP32[3]|0;
 $15 = HEAP32[$7>>2]|0;
 $16 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $16;
 (_printf(2149,$vararg_buffer)|0);
 $17 = HEAP32[$6>>2]|0;
 $18 = HEAP8[861]|0;
 $19 = $18 << 24 >> 24;
 $20 = HEAP32[4]|0;
 $21 = HEAP32[$5>>2]|0;
 $22 = $21 & 128;
 $23 = ($22|0)!=(0);
 $24 = HEAP32[$7>>2]|0;
 $25 = $23 ? 2147 : $24;
 $26 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer3>>2] = $17;
 $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
 HEAP32[$vararg_ptr6>>2] = $19;
 $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
 HEAP32[$vararg_ptr7>>2] = $20;
 $vararg_ptr8 = ((($vararg_buffer3)) + 12|0);
 HEAP32[$vararg_ptr8>>2] = $25;
 $vararg_ptr9 = ((($vararg_buffer3)) + 16|0);
 HEAP32[$vararg_ptr9>>2] = $26;
 (_printf(2126,$vararg_buffer3)|0);
 STACKTOP = sp;return;
}
function _emit_sb() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2172,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_sw() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2188,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_slb($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 12|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $4;
 (_printf(2204,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_slw($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 12|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $4;
 (_printf(2232,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_dlb($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 12|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $4;
 (_printf(2260,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_dlw($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 12|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $4;
 (_printf(2288,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_sab($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, $vararg_ptr8 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 52|0;
 $4 = sp + 48|0;
 $5 = sp + 44|0;
 $6 = sp + 40|0;
 $7 = sp + 36|0;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $8 = HEAP32[$3>>2]|0;
 $9 = HEAP32[$5>>2]|0;
 $10 = (_fixup_new($8,$9,128)|0);
 HEAP32[$6>>2] = $10;
 $11 = HEAP32[$3>>2]|0;
 $12 = HEAP32[$5>>2]|0;
 $13 = (_tag_string($11,$12)|0);
 HEAP32[$7>>2] = $13;
 $14 = HEAP32[3]|0;
 $15 = HEAP32[$7>>2]|0;
 $16 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $16;
 (_printf(2316,$vararg_buffer)|0);
 $17 = HEAP32[$6>>2]|0;
 $18 = HEAP8[861]|0;
 $19 = $18 << 24 >> 24;
 $20 = HEAP32[4]|0;
 $21 = HEAP32[$5>>2]|0;
 $22 = $21 & 128;
 $23 = ($22|0)!=(0);
 $24 = HEAP32[$7>>2]|0;
 $25 = $23 ? 2147 : $24;
 $26 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer3>>2] = $17;
 $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
 HEAP32[$vararg_ptr6>>2] = $19;
 $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
 HEAP32[$vararg_ptr7>>2] = $20;
 $vararg_ptr8 = ((($vararg_buffer3)) + 12|0);
 HEAP32[$vararg_ptr8>>2] = $25;
 $vararg_ptr9 = ((($vararg_buffer3)) + 16|0);
 HEAP32[$vararg_ptr9>>2] = $26;
 (_printf(2126,$vararg_buffer3)|0);
 STACKTOP = sp;return;
}
function _emit_saw($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, $vararg_ptr8 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 52|0;
 $4 = sp + 48|0;
 $5 = sp + 44|0;
 $6 = sp + 40|0;
 $7 = sp + 36|0;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $8 = HEAP32[$3>>2]|0;
 $9 = HEAP32[$5>>2]|0;
 $10 = (_fixup_new($8,$9,128)|0);
 HEAP32[$6>>2] = $10;
 $11 = HEAP32[$3>>2]|0;
 $12 = HEAP32[$5>>2]|0;
 $13 = (_tag_string($11,$12)|0);
 HEAP32[$7>>2] = $13;
 $14 = HEAP32[3]|0;
 $15 = HEAP32[$7>>2]|0;
 $16 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $16;
 (_printf(2339,$vararg_buffer)|0);
 $17 = HEAP32[$6>>2]|0;
 $18 = HEAP8[861]|0;
 $19 = $18 << 24 >> 24;
 $20 = HEAP32[4]|0;
 $21 = HEAP32[$5>>2]|0;
 $22 = $21 & 128;
 $23 = ($22|0)!=(0);
 $24 = HEAP32[$7>>2]|0;
 $25 = $23 ? 2147 : $24;
 $26 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer3>>2] = $17;
 $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
 HEAP32[$vararg_ptr6>>2] = $19;
 $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
 HEAP32[$vararg_ptr7>>2] = $20;
 $vararg_ptr8 = ((($vararg_buffer3)) + 12|0);
 HEAP32[$vararg_ptr8>>2] = $25;
 $vararg_ptr9 = ((($vararg_buffer3)) + 16|0);
 HEAP32[$vararg_ptr9>>2] = $26;
 (_printf(2126,$vararg_buffer3)|0);
 STACKTOP = sp;return;
}
function _emit_dab($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $2 = sp + 36|0;
 $3 = sp + 32|0;
 $4 = sp + 28|0;
 $5 = sp + 24|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $6 = HEAP32[$2>>2]|0;
 $7 = HEAP32[$3>>2]|0;
 $8 = (_fixup_new($6,$7,128)|0);
 HEAP32[$4>>2] = $8;
 $9 = HEAP32[$2>>2]|0;
 $10 = HEAP32[$3>>2]|0;
 $11 = (_tag_string($9,$10)|0);
 HEAP32[$5>>2] = $11;
 $12 = HEAP32[3]|0;
 $13 = HEAP32[$5>>2]|0;
 HEAP32[$vararg_buffer>>2] = $12;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $13;
 (_printf(2362,$vararg_buffer)|0);
 $14 = HEAP32[$4>>2]|0;
 $15 = HEAP8[861]|0;
 $16 = $15 << 24 >> 24;
 $17 = HEAP32[4]|0;
 $18 = HEAP32[$3>>2]|0;
 $19 = $18 & 128;
 $20 = ($19|0)!=(0);
 $21 = HEAP32[$5>>2]|0;
 $22 = $20 ? 2147 : $21;
 HEAP32[$vararg_buffer2>>2] = $14;
 $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
 HEAP32[$vararg_ptr5>>2] = $16;
 $vararg_ptr6 = ((($vararg_buffer2)) + 8|0);
 HEAP32[$vararg_ptr6>>2] = $17;
 $vararg_ptr7 = ((($vararg_buffer2)) + 12|0);
 HEAP32[$vararg_ptr7>>2] = $22;
 (_printf(2382,$vararg_buffer2)|0);
 STACKTOP = sp;return;
}
function _emit_daw($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $2 = sp + 36|0;
 $3 = sp + 32|0;
 $4 = sp + 28|0;
 $5 = sp + 24|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $6 = HEAP32[$2>>2]|0;
 $7 = HEAP32[$3>>2]|0;
 $8 = (_fixup_new($6,$7,128)|0);
 HEAP32[$4>>2] = $8;
 $9 = HEAP32[$2>>2]|0;
 $10 = HEAP32[$3>>2]|0;
 $11 = (_tag_string($9,$10)|0);
 HEAP32[$5>>2] = $11;
 $12 = HEAP32[3]|0;
 $13 = HEAP32[$5>>2]|0;
 HEAP32[$vararg_buffer>>2] = $12;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $13;
 (_printf(2400,$vararg_buffer)|0);
 $14 = HEAP32[$4>>2]|0;
 $15 = HEAP8[861]|0;
 $16 = $15 << 24 >> 24;
 $17 = HEAP32[4]|0;
 $18 = HEAP32[$3>>2]|0;
 $19 = $18 & 128;
 $20 = ($19|0)!=(0);
 $21 = HEAP32[$5>>2]|0;
 $22 = $20 ? 2147 : $21;
 HEAP32[$vararg_buffer2>>2] = $14;
 $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
 HEAP32[$vararg_ptr5>>2] = $16;
 $vararg_ptr6 = ((($vararg_buffer2)) + 8|0);
 HEAP32[$vararg_ptr6>>2] = $17;
 $vararg_ptr7 = ((($vararg_buffer2)) + 12|0);
 HEAP32[$vararg_ptr7>>2] = $22;
 (_printf(2382,$vararg_buffer2)|0);
 STACKTOP = sp;return;
}
function _emit_localaddr($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = sp + 12|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $4;
 (_printf(2420,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_globaladdr($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, $vararg_ptr8 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 52|0;
 $4 = sp + 48|0;
 $5 = sp + 44|0;
 $6 = sp + 40|0;
 $7 = sp + 36|0;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $8 = HEAP32[$3>>2]|0;
 $9 = HEAP32[$5>>2]|0;
 $10 = (_fixup_new($8,$9,128)|0);
 HEAP32[$6>>2] = $10;
 $11 = HEAP32[$3>>2]|0;
 $12 = HEAP32[$5>>2]|0;
 $13 = (_tag_string($11,$12)|0);
 HEAP32[$7>>2] = $13;
 $14 = HEAP32[3]|0;
 $15 = HEAP32[$7>>2]|0;
 $16 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $16;
 (_printf(2448,$vararg_buffer)|0);
 $17 = HEAP32[$6>>2]|0;
 $18 = HEAP8[861]|0;
 $19 = $18 << 24 >> 24;
 $20 = HEAP32[4]|0;
 $21 = HEAP32[$5>>2]|0;
 $22 = $21 & 128;
 $23 = ($22|0)!=(0);
 $24 = HEAP32[$7>>2]|0;
 $25 = $23 ? 2147 : $24;
 $26 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer3>>2] = $17;
 $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
 HEAP32[$vararg_ptr6>>2] = $19;
 $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
 HEAP32[$vararg_ptr7>>2] = $20;
 $vararg_ptr8 = ((($vararg_buffer3)) + 12|0);
 HEAP32[$vararg_ptr8>>2] = $25;
 $vararg_ptr9 = ((($vararg_buffer3)) + 16|0);
 HEAP32[$vararg_ptr9>>2] = $26;
 (_printf(2126,$vararg_buffer3)|0);
 STACKTOP = sp;return;
}
function _emit_indexbyte() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2470,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_indexword() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2488,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_brfls($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 16|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 (_printf(2506,$vararg_buffer)|0);
 $4 = HEAP32[4]|0;
 $5 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer2>>2] = $4;
 $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
 HEAP32[$vararg_ptr5>>2] = $5;
 (_printf(2532,$vararg_buffer2)|0);
 STACKTOP = sp;return;
}
function _emit_brnch($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 16|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 (_printf(2546,$vararg_buffer)|0);
 $4 = HEAP32[4]|0;
 $5 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer2>>2] = $4;
 $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
 HEAP32[$vararg_ptr5>>2] = $5;
 (_printf(2532,$vararg_buffer2)|0);
 STACKTOP = sp;return;
}
function _emit_brne($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 16|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 (_printf(2572,$vararg_buffer)|0);
 $4 = HEAP32[4]|0;
 $5 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer2>>2] = $4;
 $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
 HEAP32[$vararg_ptr5>>2] = $5;
 (_printf(2532,$vararg_buffer2)|0);
 STACKTOP = sp;return;
}
function _emit_brgt($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 16|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 (_printf(2597,$vararg_buffer)|0);
 $4 = HEAP32[4]|0;
 $5 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer2>>2] = $4;
 $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
 HEAP32[$vararg_ptr5>>2] = $5;
 (_printf(2532,$vararg_buffer2)|0);
 STACKTOP = sp;return;
}
function _emit_brlt($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, $vararg_buffer2 = 0, $vararg_ptr1 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 16|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[3]|0;
 $3 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $3;
 (_printf(2622,$vararg_buffer)|0);
 $4 = HEAP32[4]|0;
 $5 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer2>>2] = $4;
 $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
 HEAP32[$vararg_ptr5>>2] = $5;
 (_printf(2532,$vararg_buffer2)|0);
 STACKTOP = sp;return;
}
function _emit_call($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer10 = 0, $vararg_buffer2 = 0, $vararg_buffer6 = 0, $vararg_ptr1 = 0, $vararg_ptr13 = 0, $vararg_ptr14 = 0, $vararg_ptr15 = 0, $vararg_ptr5 = 0, $vararg_ptr9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $vararg_buffer10 = sp + 24|0;
 $vararg_buffer6 = sp + 16|0;
 $vararg_buffer2 = sp + 8|0;
 $vararg_buffer = sp;
 $2 = sp + 52|0;
 $3 = sp + 48|0;
 $4 = sp + 44|0;
 $5 = sp + 40|0;
 HEAP32[$2>>2] = $0;
 HEAP32[$3>>2] = $1;
 $6 = HEAP32[$3>>2]|0;
 $7 = ($6|0)==(1);
 if ($7) {
  $8 = HEAP32[3]|0;
  $9 = HEAP32[$2>>2]|0;
  HEAP32[$vararg_buffer>>2] = $8;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $9;
  (_printf(2647,$vararg_buffer)|0);
  $10 = HEAP32[4]|0;
  $11 = HEAP32[$2>>2]|0;
  HEAP32[$vararg_buffer2>>2] = $10;
  $vararg_ptr5 = ((($vararg_buffer2)) + 4|0);
  HEAP32[$vararg_ptr5>>2] = $11;
  (_printf(2668,$vararg_buffer2)|0);
  STACKTOP = sp;return;
 } else {
  $12 = HEAP32[$2>>2]|0;
  $13 = HEAP32[$3>>2]|0;
  $14 = (_fixup_new($12,$13,128)|0);
  HEAP32[$4>>2] = $14;
  $15 = HEAP32[$2>>2]|0;
  $16 = HEAP32[$3>>2]|0;
  $17 = (_tag_string($15,$16)|0);
  HEAP32[$5>>2] = $17;
  $18 = HEAP32[3]|0;
  $19 = HEAP32[$5>>2]|0;
  HEAP32[$vararg_buffer6>>2] = $18;
  $vararg_ptr9 = ((($vararg_buffer6)) + 4|0);
  HEAP32[$vararg_ptr9>>2] = $19;
  (_printf(2678,$vararg_buffer6)|0);
  $20 = HEAP32[$4>>2]|0;
  $21 = HEAP8[861]|0;
  $22 = $21 << 24 >> 24;
  $23 = HEAP32[4]|0;
  $24 = HEAP32[$3>>2]|0;
  $25 = $24 & 128;
  $26 = ($25|0)!=(0);
  $27 = HEAP32[$5>>2]|0;
  $28 = $26 ? 2147 : $27;
  HEAP32[$vararg_buffer10>>2] = $20;
  $vararg_ptr13 = ((($vararg_buffer10)) + 4|0);
  HEAP32[$vararg_ptr13>>2] = $22;
  $vararg_ptr14 = ((($vararg_buffer10)) + 8|0);
  HEAP32[$vararg_ptr14>>2] = $23;
  $vararg_ptr15 = ((($vararg_buffer10)) + 12|0);
  HEAP32[$vararg_ptr15>>2] = $28;
  (_printf(2382,$vararg_buffer10)|0);
  STACKTOP = sp;return;
 }
}
function _emit_ical() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2699,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_leave() {
 var $0 = 0, $1 = 0, $2 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $0 = HEAP32[2844]|0;
 $1 = ($0|0)!=(0);
 $2 = HEAP32[3]|0;
 if ($1) {
  HEAP32[$vararg_buffer>>2] = $2;
  (_printf(2717,$vararg_buffer)|0);
  STACKTOP = sp;return;
 } else {
  HEAP32[$vararg_buffer1>>2] = $2;
  (_printf(2736,$vararg_buffer1)|0);
  STACKTOP = sp;return;
 }
}
function _emit_ret() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2736,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_enter($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $1 = sp + 20|0;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[2844]|0;
 $3 = ($2|0)!=(0);
 if (!($3)) {
  STACKTOP = sp;return;
 }
 $4 = HEAP32[3]|0;
 $5 = HEAP32[2844]|0;
 $6 = HEAP32[$1>>2]|0;
 $7 = HEAP32[2844]|0;
 $8 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $4;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $5;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $6;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $7;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $8;
 (_printf(2753,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_start() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP8[861]|0;
 $1 = $0 << 24 >> 24;
 HEAP32[$vararg_buffer>>2] = $1;
 (_printf(2789,$vararg_buffer)|0);
 $2 = HEAP32[9250]|0;
 $3 = $2 | 16;
 HEAP32[9250] = $3;
 $4 = HEAP32[5152]|0;
 $5 = (($4) + 1)|0;
 HEAP32[5152] = $5;
 STACKTOP = sp;return;
}
function _emit_dup() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2798,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_push() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2815,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_pull() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2833,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_drop() {
 var $0 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = HEAP32[3]|0;
 HEAP32[$vararg_buffer>>2] = $0;
 (_printf(2851,$vararg_buffer)|0);
 STACKTOP = sp;return;
}
function _emit_unaryop($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer10 = 0, $vararg_buffer13 = 0, $vararg_buffer4 = 0, $vararg_buffer7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $vararg_buffer13 = sp + 40|0;
 $vararg_buffer10 = sp + 32|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer4 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 48|0;
 $2 = sp + 44|0;
 HEAP32[$2>>2] = $0;
 $3 = HEAP32[$2>>2]|0;
 switch ($3|0) {
 case 173:  {
  $4 = HEAP32[3]|0;
  HEAP32[$vararg_buffer>>2] = $4;
  (_printf(2869,$vararg_buffer)|0);
  break;
 }
 case 254:  {
  $5 = HEAP32[3]|0;
  HEAP32[$vararg_buffer1>>2] = $5;
  (_printf(2886,$vararg_buffer1)|0);
  break;
 }
 case 161:  {
  $6 = HEAP32[3]|0;
  HEAP32[$vararg_buffer4>>2] = $6;
  (_printf(2904,$vararg_buffer4)|0);
  break;
 }
 case 208:  {
  $7 = HEAP32[3]|0;
  HEAP32[$vararg_buffer7>>2] = $7;
  (_printf(2921,$vararg_buffer7)|0);
  break;
 }
 case 203:  {
  $8 = HEAP32[3]|0;
  HEAP32[$vararg_buffer10>>2] = $8;
  (_printf(2939,$vararg_buffer10)|0);
  break;
 }
 case 222:  {
  _emit_lb();
  break;
 }
 case 170:  {
  _emit_lw();
  break;
 }
 default: {
  $9 = HEAP32[$2>>2]|0;
  $10 = $9 & 127;
  HEAP32[$vararg_buffer13>>2] = $10;
  (_printf(2957,$vararg_buffer13)|0);
  HEAP32[$1>>2] = 0;
  $11 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($11|0);
 }
 }
 HEAP32[$1>>2] = 1;
 $11 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($11|0);
}
function _emit_op($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer10 = 0, $vararg_buffer13 = 0, $vararg_buffer16 = 0, $vararg_buffer19 = 0, $vararg_buffer22 = 0, $vararg_buffer25 = 0, $vararg_buffer28 = 0, $vararg_buffer31 = 0, $vararg_buffer34 = 0, $vararg_buffer37 = 0, $vararg_buffer4 = 0, $vararg_buffer40 = 0, $vararg_buffer43 = 0, $vararg_buffer46 = 0, $vararg_buffer49 = 0;
 var $vararg_buffer7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0;
 $vararg_buffer49 = sp + 136|0;
 $vararg_buffer46 = sp + 128|0;
 $vararg_buffer43 = sp + 120|0;
 $vararg_buffer40 = sp + 112|0;
 $vararg_buffer37 = sp + 104|0;
 $vararg_buffer34 = sp + 96|0;
 $vararg_buffer31 = sp + 88|0;
 $vararg_buffer28 = sp + 80|0;
 $vararg_buffer25 = sp + 72|0;
 $vararg_buffer22 = sp + 64|0;
 $vararg_buffer19 = sp + 56|0;
 $vararg_buffer16 = sp + 48|0;
 $vararg_buffer13 = sp + 40|0;
 $vararg_buffer10 = sp + 32|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer4 = sp + 16|0;
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $1 = sp + 140|0;
 $2 = sp + 144|0;
 HEAP8[$2>>0] = $0;
 $3 = HEAP8[$2>>0]|0;
 $4 = $3&255;
 do {
  switch ($4|0) {
  case 170:  {
   $5 = HEAP32[3]|0;
   HEAP32[$vararg_buffer>>2] = $5;
   (_printf(2979,$vararg_buffer)|0);
   break;
  }
  case 175:  {
   $6 = HEAP32[3]|0;
   HEAP32[$vararg_buffer1>>2] = $6;
   (_printf(2996,$vararg_buffer1)|0);
   break;
  }
  case 165:  {
   $7 = HEAP32[3]|0;
   HEAP32[$vararg_buffer4>>2] = $7;
   (_printf(3013,$vararg_buffer4)|0);
   break;
  }
  case 171:  {
   $8 = HEAP32[3]|0;
   HEAP32[$vararg_buffer7>>2] = $8;
   (_printf(3030,$vararg_buffer7)|0);
   break;
  }
  case 173:  {
   $9 = HEAP32[3]|0;
   HEAP32[$vararg_buffer10>>2] = $9;
   (_printf(3047,$vararg_buffer10)|0);
   break;
  }
  case 204:  {
   $10 = HEAP32[3]|0;
   HEAP32[$vararg_buffer13>>2] = $10;
   (_printf(3064,$vararg_buffer13)|0);
   break;
  }
  case 210:  {
   $11 = HEAP32[3]|0;
   HEAP32[$vararg_buffer16>>2] = $11;
   (_printf(3081,$vararg_buffer16)|0);
   break;
  }
  case 166:  {
   $12 = HEAP32[3]|0;
   HEAP32[$vararg_buffer19>>2] = $12;
   (_printf(3098,$vararg_buffer19)|0);
   break;
  }
  case 252:  {
   $13 = HEAP32[3]|0;
   HEAP32[$vararg_buffer22>>2] = $13;
   (_printf(3115,$vararg_buffer22)|0);
   break;
  }
  case 222:  {
   $14 = HEAP32[3]|0;
   HEAP32[$vararg_buffer25>>2] = $14;
   (_printf(3132,$vararg_buffer25)|0);
   break;
  }
  case 197:  {
   $15 = HEAP32[3]|0;
   HEAP32[$vararg_buffer28>>2] = $15;
   (_printf(3149,$vararg_buffer28)|0);
   break;
  }
  case 213:  {
   $16 = HEAP32[3]|0;
   HEAP32[$vararg_buffer31>>2] = $16;
   (_printf(3167,$vararg_buffer31)|0);
   break;
  }
  case 200:  {
   $17 = HEAP32[3]|0;
   HEAP32[$vararg_buffer34>>2] = $17;
   (_printf(3185,$vararg_buffer34)|0);
   break;
  }
  case 188:  {
   $18 = HEAP32[3]|0;
   HEAP32[$vararg_buffer37>>2] = $18;
   (_printf(3203,$vararg_buffer37)|0);
   break;
  }
  case 190:  {
   $19 = HEAP32[3]|0;
   HEAP32[$vararg_buffer40>>2] = $19;
   (_printf(3221,$vararg_buffer40)|0);
   break;
  }
  case 194:  {
   $20 = HEAP32[3]|0;
   HEAP32[$vararg_buffer43>>2] = $20;
   (_printf(3239,$vararg_buffer43)|0);
   break;
  }
  case 207:  {
   $21 = HEAP32[3]|0;
   HEAP32[$vararg_buffer46>>2] = $21;
   (_printf(3257,$vararg_buffer46)|0);
   break;
  }
  case 206:  {
   $22 = HEAP32[3]|0;
   HEAP32[$vararg_buffer49>>2] = $22;
   (_printf(3274,$vararg_buffer49)|0);
   break;
  }
  case 172:  {
   break;
  }
  default: {
   HEAP32[$1>>2] = 0;
   $23 = HEAP32[$1>>2]|0;
   STACKTOP = sp;return ($23|0);
  }
  }
 } while(0);
 HEAP32[$1>>2] = 1;
 $23 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($23|0);
}
function _parse_error($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer5 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer5 = sp + 24|0;
 $vararg_buffer = sp;
 $1 = sp + 32|0;
 $2 = sp + 28|0;
 HEAP32[$1>>2] = $0;
 $3 = HEAP32[9253]|0;
 HEAP32[$2>>2] = $3;
 $4 = HEAP32[9]|0;
 $5 = HEAP32[9254]|0;
 $6 = HEAP32[9251]|0;
 $7 = HEAP32[9253]|0;
 $8 = HEAP32[9254]|0;
 $9 = (_strlen($8)|0);
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $6;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $7;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $9;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = 111812;
 (_fprintf($4,3509,$vararg_buffer)|0);
 $10 = HEAP32[9253]|0;
 HEAP32[$2>>2] = $10;
 while(1) {
  $11 = HEAP32[$2>>2]|0;
  $12 = HEAP32[9255]|0;
  $13 = ($11|0)!=($12|0);
  if (!($13)) {
   break;
  }
  $14 = HEAP32[$2>>2]|0;
  $15 = HEAP8[$14>>0]|0;
  $16 = $15 << 24 >> 24;
  $17 = ($16|0)==(9);
  $18 = $17 ? 9 : 32;
  $19 = HEAP32[9]|0;
  (_putc($18,$19)|0);
  $20 = HEAP32[$2>>2]|0;
  $21 = ((($20)) + 1|0);
  HEAP32[$2>>2] = $21;
 }
 $22 = HEAP32[9]|0;
 $23 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer5>>2] = $23;
 (_fprintf($22,3532,$vararg_buffer5)|0);
 _exit(1);
 // unreachable;
}
function _hexdigit($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 $2 = sp + 4|0;
 HEAP8[$2>>0] = $0;
 $3 = HEAP8[$2>>0]|0;
 $4 = $3 << 24 >> 24;
 $5 = (_toupper($4)|0);
 $6 = $5&255;
 HEAP8[$2>>0] = $6;
 $7 = HEAP8[$2>>0]|0;
 $8 = $7 << 24 >> 24;
 $9 = ($8|0)>=(48);
 if ($9) {
  $10 = HEAP8[$2>>0]|0;
  $11 = $10 << 24 >> 24;
  $12 = ($11|0)<=(57);
  if ($12) {
   $13 = HEAP8[$2>>0]|0;
   $14 = $13 << 24 >> 24;
   $15 = (($14) - 48)|0;
   HEAP32[$1>>2] = $15;
   $26 = HEAP32[$1>>2]|0;
   STACKTOP = sp;return ($26|0);
  }
 }
 $16 = HEAP8[$2>>0]|0;
 $17 = $16 << 24 >> 24;
 $18 = ($17|0)>=(65);
 if ($18) {
  $19 = HEAP8[$2>>0]|0;
  $20 = $19 << 24 >> 24;
  $21 = ($20|0)<=(70);
  if ($21) {
   $22 = HEAP8[$2>>0]|0;
   $23 = $22 << 24 >> 24;
   $24 = (($23) - 65)|0;
   $25 = (($24) + 10)|0;
   HEAP32[$1>>2] = $25;
   $26 = HEAP32[$1>>2]|0;
   STACKTOP = sp;return ($26|0);
  }
 }
 HEAP32[$1>>2] = -1;
 $26 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($26|0);
}
function _scan() {
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
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
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0;
 var $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0;
 var $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0;
 var $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp + 16|0;
 $1 = sp + 12|0;
 $2 = sp + 8|0;
 $3 = sp + 4|0;
 $4 = sp;
 while(1) {
  $5 = HEAP32[6]|0;
  $6 = HEAP8[$5>>0]|0;
  $7 = $6 << 24 >> 24;
  $8 = ($7|0)!=(0);
  if ($8) {
   $9 = HEAP32[6]|0;
   $10 = HEAP8[$9>>0]|0;
   $11 = $10 << 24 >> 24;
   $12 = ($11|0)==(32);
   if ($12) {
    $382 = 1;
   } else {
    $13 = HEAP32[6]|0;
    $14 = HEAP8[$13>>0]|0;
    $15 = $14 << 24 >> 24;
    $16 = ($15|0)==(9);
    $382 = $16;
   }
  } else {
   $382 = 0;
  }
  $17 = HEAP32[6]|0;
  if (!($382)) {
   break;
  }
  $18 = ((($17)) + 1|0);
  HEAP32[6] = $18;
 }
 HEAP32[9255] = $17;
 $19 = HEAP8[111813]|0;
 $20 = $19&255;
 $21 = ($20|0)==(255);
 L9: do {
  if (!($21)) {
   $22 = HEAP32[6]|0;
   $23 = HEAP8[$22>>0]|0;
   $24 = $23 << 24 >> 24;
   $25 = ($24|0)==(0);
   if (!($25)) {
    $26 = HEAP32[6]|0;
    $27 = HEAP8[$26>>0]|0;
    $28 = $27 << 24 >> 24;
    $29 = ($28|0)==(10);
    if (!($29)) {
     $30 = HEAP32[6]|0;
     $31 = HEAP8[$30>>0]|0;
     $32 = $31 << 24 >> 24;
     $33 = ($32|0)==(59);
     if (!($33)) {
      $34 = HEAP32[6]|0;
      $35 = HEAP8[$34>>0]|0;
      $36 = $35 << 24 >> 24;
      $37 = ($36|0)>=(97);
      if ($37) {
       $38 = HEAP32[6]|0;
       $39 = HEAP8[$38>>0]|0;
       $40 = $39 << 24 >> 24;
       $41 = ($40|0)<=(122);
       if (!($41)) {
        label = 14;
       }
      } else {
       label = 14;
      }
      do {
       if ((label|0) == 14) {
        $42 = HEAP32[6]|0;
        $43 = HEAP8[$42>>0]|0;
        $44 = $43 << 24 >> 24;
        $45 = ($44|0)>=(65);
        if ($45) {
         $46 = HEAP32[6]|0;
         $47 = HEAP8[$46>>0]|0;
         $48 = $47 << 24 >> 24;
         $49 = ($48|0)<=(90);
         if ($49) {
          break;
         }
        }
        $50 = HEAP32[6]|0;
        $51 = HEAP8[$50>>0]|0;
        $52 = $51 << 24 >> 24;
        $53 = ($52|0)==(95);
        if (!($53)) {
         $138 = HEAP32[6]|0;
         $139 = HEAP8[$138>>0]|0;
         $140 = $139 << 24 >> 24;
         $141 = ($140|0)>=(48);
         if ($141) {
          $142 = HEAP32[6]|0;
          $143 = HEAP8[$142>>0]|0;
          $144 = $143 << 24 >> 24;
          $145 = ($144|0)<=(57);
          if ($145) {
           HEAP32[9257] = 0;
           while(1) {
            $146 = HEAP32[6]|0;
            $147 = HEAP8[$146>>0]|0;
            $148 = $147 << 24 >> 24;
            $149 = ($148|0)>=(48);
            if (!($149)) {
             break;
            }
            $150 = HEAP32[6]|0;
            $151 = HEAP8[$150>>0]|0;
            $152 = $151 << 24 >> 24;
            $153 = ($152|0)<=(57);
            if (!($153)) {
             break;
            }
            $154 = HEAP32[9257]|0;
            $155 = ($154*10)|0;
            $156 = HEAP32[6]|0;
            $157 = HEAP8[$156>>0]|0;
            $158 = $157 << 24 >> 24;
            $159 = (($155) + ($158))|0;
            $160 = (($159) - 48)|0;
            HEAP32[9257] = $160;
            $161 = HEAP32[6]|0;
            $162 = ((($161)) + 1|0);
            HEAP32[6] = $162;
           }
           HEAP8[111813] = -38;
           break L9;
          }
         }
         $163 = HEAP32[6]|0;
         $164 = HEAP8[$163>>0]|0;
         $165 = $164 << 24 >> 24;
         $166 = ($165|0)==(36);
         if ($166) {
          HEAP32[9257] = 0;
          while(1) {
           $167 = HEAP32[6]|0;
           $168 = ((($167)) + 1|0);
           HEAP32[6] = $168;
           $169 = ($167|0)!=(0|0);
           if (!($169)) {
            break;
           }
           $170 = HEAP32[6]|0;
           $171 = HEAP8[$170>>0]|0;
           $172 = (_hexdigit($171)|0);
           $173 = ($172|0)>=(0);
           if (!($173)) {
            break;
           }
           $174 = HEAP32[9257]|0;
           $175 = $174<<4;
           $176 = HEAP32[6]|0;
           $177 = HEAP8[$176>>0]|0;
           $178 = (_hexdigit($177)|0);
           $179 = (($175) + ($178))|0;
           HEAP32[9257] = $179;
          }
          HEAP8[111813] = -38;
          break L9;
         }
         $180 = HEAP32[6]|0;
         $181 = HEAP8[$180>>0]|0;
         $182 = $181 << 24 >> 24;
         $183 = ($182|0)==(39);
         if ($183) {
          HEAP8[111813] = -39;
          $184 = HEAP32[6]|0;
          $185 = ((($184)) + 1|0);
          $186 = HEAP8[$185>>0]|0;
          $187 = $186 << 24 >> 24;
          $188 = ($187|0)!=(92);
          $189 = HEAP32[6]|0;
          if ($188) {
           $190 = ((($189)) + 1|0);
           $191 = HEAP8[$190>>0]|0;
           $192 = $191 << 24 >> 24;
           HEAP32[9257] = $192;
           $193 = HEAP32[6]|0;
           $194 = ((($193)) + 2|0);
           $195 = HEAP8[$194>>0]|0;
           $196 = $195 << 24 >> 24;
           $197 = ($196|0)!=(39);
           if (!($197)) {
            $198 = HEAP32[6]|0;
            $199 = ((($198)) + 3|0);
            HEAP32[6] = $199;
            break L9;
           }
           _parse_error(3545);
           HEAP8[$0>>0] = -1;
           $381 = HEAP8[$0>>0]|0;
           STACKTOP = sp;return ($381|0);
          }
          $200 = ((($189)) + 2|0);
          $201 = HEAP8[$200>>0]|0;
          $202 = $201 << 24 >> 24;
          switch ($202|0) {
          case 110:  {
           HEAP32[9257] = 13;
           break;
          }
          case 114:  {
           HEAP32[9257] = 10;
           break;
          }
          case 116:  {
           HEAP32[9257] = 9;
           break;
          }
          case 39:  {
           HEAP32[9257] = 39;
           break;
          }
          case 92:  {
           HEAP32[9257] = 92;
           break;
          }
          case 48:  {
           HEAP32[9257] = 0;
           break;
          }
          default: {
           _parse_error(3545);
           HEAP8[$0>>0] = -1;
           $381 = HEAP8[$0>>0]|0;
           STACKTOP = sp;return ($381|0);
          }
          }
          $203 = HEAP32[6]|0;
          $204 = ((($203)) + 3|0);
          $205 = HEAP8[$204>>0]|0;
          $206 = $205 << 24 >> 24;
          $207 = ($206|0)!=(39);
          if (!($207)) {
           $208 = HEAP32[6]|0;
           $209 = ((($208)) + 4|0);
           HEAP32[6] = $209;
           break L9;
          }
          _parse_error(3545);
          HEAP8[$0>>0] = -1;
          $381 = HEAP8[$0>>0]|0;
          STACKTOP = sp;return ($381|0);
         }
         $210 = HEAP32[6]|0;
         $211 = HEAP8[$210>>0]|0;
         $212 = $211 << 24 >> 24;
         $213 = ($212|0)==(34);
         if ($213) {
          HEAP8[111813] = -45;
          $214 = HEAP32[6]|0;
          $215 = ((($214)) + 1|0);
          HEAP32[6] = $215;
          $216 = $215;
          HEAP32[9257] = $216;
          L66: while(1) {
           $217 = HEAP32[6]|0;
           $218 = HEAP8[$217>>0]|0;
           $219 = $218 << 24 >> 24;
           $220 = ($219|0)!=(0);
           if ($220) {
            $221 = HEAP32[6]|0;
            $222 = HEAP8[$221>>0]|0;
            $223 = $222 << 24 >> 24;
            $224 = ($223|0)!=(34);
            $383 = $224;
           } else {
            $383 = 0;
           }
           $225 = HEAP32[6]|0;
           if (!($383)) {
            label = 87;
            break;
           }
           $226 = HEAP8[$225>>0]|0;
           $227 = $226 << 24 >> 24;
           $228 = ($227|0)==(92);
           L72: do {
            if ($228) {
             HEAP32[$4>>2] = 1;
             $229 = HEAP32[6]|0;
             $230 = ((($229)) + 1|0);
             $231 = HEAP8[$230>>0]|0;
             $232 = $231 << 24 >> 24;
             switch ($232|0) {
             case 110:  {
              $233 = HEAP32[6]|0;
              HEAP8[$233>>0] = 13;
              break;
             }
             case 114:  {
              $234 = HEAP32[6]|0;
              HEAP8[$234>>0] = 10;
              break;
             }
             case 116:  {
              $235 = HEAP32[6]|0;
              HEAP8[$235>>0] = 9;
              break;
             }
             case 39:  {
              $236 = HEAP32[6]|0;
              HEAP8[$236>>0] = 39;
              break;
             }
             case 34:  {
              $237 = HEAP32[6]|0;
              HEAP8[$237>>0] = 34;
              break;
             }
             case 92:  {
              $238 = HEAP32[6]|0;
              HEAP8[$238>>0] = 92;
              break;
             }
             case 48:  {
              $239 = HEAP32[6]|0;
              HEAP8[$239>>0] = 0;
              break;
             }
             case 36:  {
              $240 = HEAP32[6]|0;
              $241 = ((($240)) + 2|0);
              $242 = HEAP8[$241>>0]|0;
              $243 = (_hexdigit($242)|0);
              $244 = ($243|0)<(0);
              if ($244) {
               label = 80;
               break L66;
              }
              $245 = HEAP32[6]|0;
              $246 = ((($245)) + 3|0);
              $247 = HEAP8[$246>>0]|0;
              $248 = (_hexdigit($247)|0);
              $249 = ($248|0)<(0);
              if ($249) {
               label = 80;
               break L66;
              }
              $250 = HEAP32[6]|0;
              $251 = ((($250)) + 2|0);
              $252 = HEAP8[$251>>0]|0;
              $253 = (_hexdigit($252)|0);
              $254 = $253<<4;
              $255 = HEAP32[6]|0;
              $256 = ((($255)) + 3|0);
              $257 = HEAP8[$256>>0]|0;
              $258 = (_hexdigit($257)|0);
              $259 = (($254) + ($258))|0;
              $260 = $259&255;
              $261 = HEAP32[6]|0;
              HEAP8[$261>>0] = $260;
              HEAP32[$4>>2] = 3;
              break;
             }
             default: {
              label = 82;
              break L66;
             }
             }
             $262 = HEAP32[6]|0;
             $263 = ((($262)) + 1|0);
             HEAP32[$3>>2] = $263;
             while(1) {
              $264 = HEAP32[$3>>2]|0;
              $265 = HEAP8[$264>>0]|0;
              $266 = ($265<<24>>24)!=(0);
              if (!($266)) {
               break L72;
              }
              $267 = HEAP32[$4>>2]|0;
              $268 = HEAP32[$3>>2]|0;
              $269 = (($268) + ($267)|0);
              $270 = HEAP8[$269>>0]|0;
              $271 = HEAP32[$3>>2]|0;
              HEAP8[$271>>0] = $270;
              $272 = HEAP32[$3>>2]|0;
              $273 = ((($272)) + 1|0);
              HEAP32[$3>>2] = $273;
             }
            }
           } while(0);
           $274 = HEAP32[6]|0;
           $275 = ((($274)) + 1|0);
           HEAP32[6] = $275;
          }
          if ((label|0) == 80) {
           _parse_error(3568);
           HEAP8[$0>>0] = -1;
           $381 = HEAP8[$0>>0]|0;
           STACKTOP = sp;return ($381|0);
          }
          else if ((label|0) == 82) {
           _parse_error(3568);
           HEAP8[$0>>0] = -1;
           $381 = HEAP8[$0>>0]|0;
           STACKTOP = sp;return ($381|0);
          }
          else if ((label|0) == 87) {
           $276 = ((($225)) + 1|0);
           HEAP32[6] = $276;
           $277 = HEAP8[$225>>0]|0;
           $278 = ($277<<24>>24)!=(0);
           if ($278) {
            break L9;
           }
           _parse_error(3588);
           HEAP8[$0>>0] = -1;
           $381 = HEAP8[$0>>0]|0;
           STACKTOP = sp;return ($381|0);
          }
         }
         $279 = HEAP32[6]|0;
         $280 = HEAP8[$279>>0]|0;
         $281 = $280 << 24 >> 24;
         switch ($281|0) {
         case 62:  {
          $282 = HEAP32[6]|0;
          $283 = ((($282)) + 1|0);
          $284 = HEAP8[$283>>0]|0;
          $285 = $284 << 24 >> 24;
          $286 = ($285|0)==(62);
          if ($286) {
           HEAP8[111813] = -46;
           $287 = HEAP32[6]|0;
           $288 = ((($287)) + 2|0);
           HEAP32[6] = $288;
           break L9;
          }
          $289 = HEAP32[6]|0;
          $290 = ((($289)) + 1|0);
          $291 = HEAP8[$290>>0]|0;
          $292 = $291 << 24 >> 24;
          $293 = ($292|0)==(61);
          if ($293) {
           HEAP8[111813] = -56;
           $294 = HEAP32[6]|0;
           $295 = ((($294)) + 2|0);
           HEAP32[6] = $295;
           break L9;
          } else {
           HEAP8[111813] = -66;
           $296 = HEAP32[6]|0;
           $297 = ((($296)) + 1|0);
           HEAP32[6] = $297;
           break L9;
          }
          break;
         }
         case 60:  {
          $298 = HEAP32[6]|0;
          $299 = ((($298)) + 1|0);
          $300 = HEAP8[$299>>0]|0;
          $301 = $300 << 24 >> 24;
          $302 = ($301|0)==(60);
          if ($302) {
           HEAP8[111813] = -52;
           $303 = HEAP32[6]|0;
           $304 = ((($303)) + 2|0);
           HEAP32[6] = $304;
           break L9;
          }
          $305 = HEAP32[6]|0;
          $306 = ((($305)) + 1|0);
          $307 = HEAP8[$306>>0]|0;
          $308 = $307 << 24 >> 24;
          $309 = ($308|0)==(61);
          if ($309) {
           HEAP8[111813] = -62;
           $310 = HEAP32[6]|0;
           $311 = ((($310)) + 2|0);
           HEAP32[6] = $311;
           break L9;
          }
          $312 = HEAP32[6]|0;
          $313 = ((($312)) + 1|0);
          $314 = HEAP8[$313>>0]|0;
          $315 = $314 << 24 >> 24;
          $316 = ($315|0)==(62);
          if ($316) {
           HEAP8[111813] = -43;
           $317 = HEAP32[6]|0;
           $318 = ((($317)) + 2|0);
           HEAP32[6] = $318;
           break L9;
          } else {
           HEAP8[111813] = -68;
           $319 = HEAP32[6]|0;
           $320 = ((($319)) + 1|0);
           HEAP32[6] = $320;
           break L9;
          }
          break;
         }
         case 61:  {
          $321 = HEAP32[6]|0;
          $322 = ((($321)) + 1|0);
          $323 = HEAP8[$322>>0]|0;
          $324 = $323 << 24 >> 24;
          $325 = ($324|0)==(61);
          if ($325) {
           HEAP8[111813] = -59;
           $326 = HEAP32[6]|0;
           $327 = ((($326)) + 2|0);
           HEAP32[6] = $327;
           break L9;
          }
          $328 = HEAP32[6]|0;
          $329 = ((($328)) + 1|0);
          $330 = HEAP8[$329>>0]|0;
          $331 = $330 << 24 >> 24;
          $332 = ($331|0)==(62);
          if ($332) {
           HEAP8[111813] = -9;
           $333 = HEAP32[6]|0;
           $334 = ((($333)) + 2|0);
           HEAP32[6] = $334;
           break L9;
          } else {
           HEAP8[111813] = -67;
           $335 = HEAP32[6]|0;
           $336 = ((($335)) + 1|0);
           HEAP32[6] = $336;
           break L9;
          }
          break;
         }
         case 43:  {
          $337 = HEAP32[6]|0;
          $338 = ((($337)) + 1|0);
          $339 = HEAP8[$338>>0]|0;
          $340 = $339 << 24 >> 24;
          $341 = ($340|0)==(43);
          if ($341) {
           HEAP8[111813] = -48;
           $342 = HEAP32[6]|0;
           $343 = ((($342)) + 2|0);
           HEAP32[6] = $343;
           break L9;
          } else {
           HEAP8[111813] = -85;
           $344 = HEAP32[6]|0;
           $345 = ((($344)) + 1|0);
           HEAP32[6] = $345;
           break L9;
          }
          break;
         }
         case 45:  {
          $346 = HEAP32[6]|0;
          $347 = ((($346)) + 1|0);
          $348 = HEAP8[$347>>0]|0;
          $349 = $348 << 24 >> 24;
          $350 = ($349|0)==(45);
          if ($350) {
           HEAP8[111813] = -53;
           $351 = HEAP32[6]|0;
           $352 = ((($351)) + 2|0);
           HEAP32[6] = $352;
           break L9;
          }
          $353 = HEAP32[6]|0;
          $354 = ((($353)) + 1|0);
          $355 = HEAP8[$354>>0]|0;
          $356 = $355 << 24 >> 24;
          $357 = ($356|0)==(62);
          if ($357) {
           HEAP8[111813] = -30;
           $358 = HEAP32[6]|0;
           $359 = ((($358)) + 2|0);
           HEAP32[6] = $359;
           break L9;
          } else {
           HEAP8[111813] = -83;
           $360 = HEAP32[6]|0;
           $361 = ((($360)) + 1|0);
           HEAP32[6] = $361;
           break L9;
          }
          break;
         }
         case 47:  {
          $362 = HEAP32[6]|0;
          $363 = ((($362)) + 1|0);
          $364 = HEAP8[$363>>0]|0;
          $365 = $364 << 24 >> 24;
          $366 = ($365|0)==(47);
          if ($366) {
           HEAP8[111813] = -128;
           break L9;
          } else {
           HEAP8[111813] = -81;
           $367 = HEAP32[6]|0;
           $368 = ((($367)) + 1|0);
           HEAP32[6] = $368;
           break L9;
          }
          break;
         }
         default: {
          $369 = HEAP32[6]|0;
          $370 = ((($369)) + 1|0);
          HEAP32[6] = $370;
          $371 = HEAP8[$369>>0]|0;
          $372 = $371 << 24 >> 24;
          $373 = 128 | $372;
          $374 = $373&255;
          HEAP8[111813] = $374;
          break L9;
         }
         }
        }
       }
      } while(0);
      HEAP32[$1>>2] = 0;
      HEAP32[$2>>2] = 0;
      while(1) {
       $54 = HEAP32[6]|0;
       $55 = ((($54)) + 1|0);
       HEAP32[6] = $55;
       $56 = HEAP32[6]|0;
       $57 = HEAP8[$56>>0]|0;
       $58 = $57 << 24 >> 24;
       $59 = ($58|0)>=(97);
       if ($59) {
        $60 = HEAP32[6]|0;
        $61 = HEAP8[$60>>0]|0;
        $62 = $61 << 24 >> 24;
        $63 = ($62|0)<=(122);
        if ($63) {
         continue;
        }
       }
       $64 = HEAP32[6]|0;
       $65 = HEAP8[$64>>0]|0;
       $66 = $65 << 24 >> 24;
       $67 = ($66|0)>=(65);
       if ($67) {
        $68 = HEAP32[6]|0;
        $69 = HEAP8[$68>>0]|0;
        $70 = $69 << 24 >> 24;
        $71 = ($70|0)<=(90);
        if ($71) {
         continue;
        }
       }
       $72 = HEAP32[6]|0;
       $73 = HEAP8[$72>>0]|0;
       $74 = $73 << 24 >> 24;
       $75 = ($74|0)==(95);
       if ($75) {
        continue;
       }
       $76 = HEAP32[6]|0;
       $77 = HEAP8[$76>>0]|0;
       $78 = $77 << 24 >> 24;
       $79 = ($78|0)>=(48);
       if (!($79)) {
        break;
       }
       $80 = HEAP32[6]|0;
       $81 = HEAP8[$80>>0]|0;
       $82 = $81 << 24 >> 24;
       $83 = ($82|0)<=(57);
       if (!($83)) {
        break;
       }
      }
      HEAP8[111813] = -42;
      $84 = HEAP32[6]|0;
      $85 = HEAP32[9255]|0;
      $86 = $84;
      $87 = $85;
      $88 = (($86) - ($87))|0;
      HEAP32[9256] = $88;
      L152: while(1) {
       $89 = HEAP32[$1>>2]|0;
       $90 = (3309 + ($89)|0);
       $91 = HEAP8[$90>>0]|0;
       $92 = $91&255;
       $93 = ($92|0)!=(128);
       if (!($93)) {
        break L9;
       }
       while(1) {
        $94 = HEAP32[$1>>2]|0;
        $95 = (($94) + 1)|0;
        $96 = HEAP32[$2>>2]|0;
        $97 = (($95) + ($96))|0;
        $98 = (3309 + ($97)|0);
        $99 = HEAP8[$98>>0]|0;
        $100 = $99&255;
        $101 = HEAP32[$2>>2]|0;
        $102 = HEAP32[9255]|0;
        $103 = (($102) + ($101)|0);
        $104 = HEAP8[$103>>0]|0;
        $105 = $104 << 24 >> 24;
        $106 = (_toupper($105)|0);
        $107 = ($100|0)==($106|0);
        if (!($107)) {
         break;
        }
        $108 = HEAP32[$2>>2]|0;
        $109 = (($108) + 1)|0;
        HEAP32[$2>>2] = $109;
       }
       $110 = HEAP32[$1>>2]|0;
       $111 = (($110) + 1)|0;
       $112 = HEAP32[$2>>2]|0;
       $113 = (($111) + ($112))|0;
       $114 = (3309 + ($113)|0);
       $115 = HEAP8[$114>>0]|0;
       $116 = $115&255;
       $117 = 128 & $116;
       $118 = ($117|0)!=(0);
       if ($118) {
        $119 = HEAP32[$2>>2]|0;
        $120 = HEAP32[9256]|0;
        $121 = ($119|0)==($120|0);
        if ($121) {
         break;
        }
       }
       $125 = HEAP32[$2>>2]|0;
       $126 = (($125) + 1)|0;
       $127 = HEAP32[$1>>2]|0;
       $128 = (($127) + ($126))|0;
       HEAP32[$1>>2] = $128;
       HEAP32[$2>>2] = 0;
       while(1) {
        $129 = HEAP32[$1>>2]|0;
        $130 = (3309 + ($129)|0);
        $131 = HEAP8[$130>>0]|0;
        $132 = $131&255;
        $133 = 128 & $132;
        $134 = ($133|0)!=(0);
        $135 = $134 ^ 1;
        if (!($135)) {
         continue L152;
        }
        $136 = HEAP32[$1>>2]|0;
        $137 = (($136) + 1)|0;
        HEAP32[$1>>2] = $137;
       }
      }
      $122 = HEAP32[$1>>2]|0;
      $123 = (3309 + ($122)|0);
      $124 = HEAP8[$123>>0]|0;
      HEAP8[111813] = $124;
      break;
     }
    }
   }
   HEAP8[111813] = -128;
  }
 } while(0);
 $375 = HEAP32[6]|0;
 $376 = HEAP32[9255]|0;
 $377 = $375;
 $378 = $376;
 $379 = (($377) - ($378))|0;
 HEAP32[9256] = $379;
 $380 = HEAP8[111813]|0;
 HEAP8[$0>>0] = $380;
 $381 = HEAP8[$0>>0]|0;
 STACKTOP = sp;return ($381|0);
}
function _scan_rewind($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[$1>>2]|0;
 HEAP32[6] = $2;
 STACKTOP = sp;return;
}
function _scan_lookahead() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp + 16|0;
 $1 = sp + 12|0;
 $2 = sp + 8|0;
 $3 = sp + 4|0;
 $4 = sp;
 $5 = HEAP32[6]|0;
 HEAP32[$0>>2] = $5;
 $6 = HEAP32[9255]|0;
 HEAP32[$1>>2] = $6;
 $7 = HEAP8[111813]|0;
 $8 = $7&255;
 HEAP32[$2>>2] = $8;
 $9 = HEAP32[9256]|0;
 HEAP32[$3>>2] = $9;
 $10 = (_scan()|0);
 $11 = $10&255;
 HEAP32[$4>>2] = $11;
 $12 = HEAP32[$0>>2]|0;
 HEAP32[6] = $12;
 $13 = HEAP32[$1>>2]|0;
 HEAP32[9255] = $13;
 $14 = HEAP32[$2>>2]|0;
 $15 = $14&255;
 HEAP8[111813] = $15;
 $16 = HEAP32[$3>>2]|0;
 HEAP32[9256] = $16;
 $17 = HEAP32[$4>>2]|0;
 STACKTOP = sp;return ($17|0);
}
function _next_line() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $0 = sp + 20|0;
 $1 = sp + 16|0;
 $2 = sp + 24|0;
 $3 = sp + 12|0;
 $4 = HEAP32[9258]|0;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $6 = HEAP32[68]|0;
  HEAP32[9258] = $6;
  HEAP32[9254] = 3608;
 }
 $7 = HEAP32[6]|0;
 $8 = HEAP8[$7>>0]|0;
 $9 = $8 << 24 >> 24;
 $10 = ($9|0)==(59);
 if ($10) {
  $11 = HEAP32[6]|0;
  $12 = ((($11)) + 1|0);
  HEAP32[6] = $12;
  HEAP32[9253] = $12;
  HEAP8[111813] = -128;
 } else {
  HEAP32[9253] = 111814;
  HEAP32[6] = 111814;
  $13 = HEAP32[9258]|0;
  $14 = (_fgets(111814,512,$13)|0);
  $15 = ($14|0)==(0|0);
  do {
   if ($15) {
    HEAP8[111814] = 0;
    $16 = HEAP32[9252]|0;
    $17 = ($16|0)!=(0|0);
    if ($17) {
     $18 = HEAP32[9258]|0;
     (_fclose($18)|0);
     $19 = HEAP32[9254]|0;
     _free($19);
     $20 = HEAP32[9252]|0;
     HEAP32[9258] = $20;
     $21 = HEAP32[9259]|0;
     HEAP32[9254] = $21;
     $22 = HEAP32[9260]|0;
     $23 = (($22) - 1)|0;
     HEAP32[9251] = $23;
     HEAP32[9252] = 0;
     break;
    }
    HEAP8[111813] = -1;
    HEAP32[$0>>2] = 255;
    $73 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($73|0);
   }
  } while(0);
  $24 = (_strlen(111814)|0);
  HEAP32[$1>>2] = $24;
  $25 = HEAP32[$1>>2]|0;
  $26 = ($25|0)>(0);
  if ($26) {
   $27 = HEAP32[$1>>2]|0;
   $28 = (($27) - 1)|0;
   $29 = (111814 + ($28)|0);
   $30 = HEAP8[$29>>0]|0;
   $31 = $30 << 24 >> 24;
   $32 = ($31|0)==(10);
   if ($32) {
    $33 = HEAP32[$1>>2]|0;
    $34 = (($33) - 1)|0;
    $35 = (111814 + ($34)|0);
    HEAP8[$35>>0] = 0;
   }
  }
  $36 = HEAP32[9251]|0;
  $37 = (($36) + 1)|0;
  HEAP32[9251] = $37;
  HEAP8[111813] = -128;
  $38 = HEAP32[9254]|0;
  $39 = HEAP32[9251]|0;
  HEAP32[$vararg_buffer>>2] = $38;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = $39;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = 111814;
  (_printf(3616,$vararg_buffer)|0);
 }
 $40 = (_scan()|0);
 HEAP8[$2>>0] = $40;
 $41 = HEAP8[$2>>0]|0;
 $42 = $41&255;
 $43 = ($42|0)==(254);
 if (!($43)) {
  $71 = HEAP8[$2>>0]|0;
  $72 = $71&255;
  HEAP32[$0>>2] = $72;
  $73 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($73|0);
 }
 $44 = (_scan()|0);
 HEAP8[$2>>0] = $44;
 $45 = HEAP8[$2>>0]|0;
 $46 = $45&255;
 $47 = ($46|0)!=(211);
 if ($47) {
  _parse_error(3632);
  HEAP8[111813] = -1;
  HEAP32[$0>>2] = 255;
  $73 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($73|0);
 }
 $48 = HEAP32[9252]|0;
 $49 = ($48|0)!=(0|0);
 if ($49) {
  _parse_error(3657);
  HEAP8[111813] = -1;
  HEAP32[$0>>2] = 255;
  $73 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($73|0);
 }
 $50 = HEAP32[9258]|0;
 HEAP32[9252] = $50;
 $51 = HEAP32[9254]|0;
 HEAP32[9259] = $51;
 $52 = HEAP32[9251]|0;
 HEAP32[9260] = $52;
 $53 = HEAP32[9256]|0;
 $54 = (($53) - 1)|0;
 $55 = (_malloc($54)|0);
 HEAP32[$3>>2] = $55;
 $56 = HEAP32[$3>>2]|0;
 $57 = HEAP32[9257]|0;
 $58 = $57;
 $59 = HEAP32[9256]|0;
 $60 = (($59) - 2)|0;
 (_strncpy($56,$58,$60)|0);
 $61 = HEAP32[9256]|0;
 $62 = (($61) - 2)|0;
 $63 = HEAP32[$3>>2]|0;
 $64 = (($63) + ($62)|0);
 HEAP8[$64>>0] = 0;
 $65 = HEAP32[$3>>2]|0;
 $66 = (_fopen($65,3692)|0);
 HEAP32[9258] = $66;
 $67 = HEAP32[9258]|0;
 $68 = ($67|0)==(0|0);
 if ($68) {
  _parse_error(3694);
  HEAP8[111813] = -1;
  HEAP32[$0>>2] = 255;
  $73 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($73|0);
 } else {
  $69 = HEAP32[$3>>2]|0;
  HEAP32[9254] = $69;
  HEAP32[9251] = 0;
  $70 = (_next_line()|0);
  HEAP32[$0>>2] = $70;
  $73 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($73|0);
 }
 return (0)|0;
}
function _push_op($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 4|0;
 $3 = sp;
 HEAP8[$2>>0] = $0;
 HEAP32[$3>>2] = $1;
 $4 = HEAP32[7]|0;
 $5 = (($4) + 1)|0;
 HEAP32[7] = $5;
 $6 = ($5|0)==(16);
 if ($6) {
  _parse_error(3757);
  STACKTOP = sp;return;
 } else {
  $7 = HEAP8[$2>>0]|0;
  $8 = HEAP32[7]|0;
  $9 = (112326 + ($8)|0);
  HEAP8[$9>>0] = $7;
  $10 = HEAP32[$3>>2]|0;
  $11 = HEAP32[7]|0;
  $12 = (37060 + ($11<<2)|0);
  HEAP32[$12>>2] = $10;
  STACKTOP = sp;return;
 }
}
function _pop_op() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 $1 = HEAP32[7]|0;
 $2 = ($1|0)<(0);
 if ($2) {
  _parse_error(3773);
  HEAP8[$0>>0] = 0;
  $7 = HEAP8[$0>>0]|0;
  STACKTOP = sp;return ($7|0);
 } else {
  $3 = HEAP32[7]|0;
  $4 = (($3) + -1)|0;
  HEAP32[7] = $4;
  $5 = (112326 + ($3)|0);
  $6 = HEAP8[$5>>0]|0;
  HEAP8[$0>>0] = $6;
  $7 = HEAP8[$0>>0]|0;
  STACKTOP = sp;return ($7|0);
 }
 return (0)|0;
}
function _tos_op() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[7]|0;
 $1 = ($0|0)<(0);
 if ($1) {
  $7 = 0;
 } else {
  $2 = HEAP32[7]|0;
  $3 = (112326 + ($2)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $7 = $5;
 }
 $6 = $7&255;
 return ($6|0);
}
function _tos_op_prec($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 HEAP32[$1>>2] = $0;
 $2 = HEAP32[7]|0;
 $3 = HEAP32[$1>>2]|0;
 $4 = ($2|0)<=($3|0);
 if ($4) {
  $8 = 100;
  STACKTOP = sp;return ($8|0);
 }
 $5 = HEAP32[7]|0;
 $6 = (37060 + ($5<<2)|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = $7;
 STACKTOP = sp;return ($8|0);
}
function _push_val($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$5>>2] = $2;
 $6 = HEAP32[8]|0;
 $7 = (($6) + 1)|0;
 HEAP32[8] = $7;
 $8 = ($7|0)==(16);
 if ($8) {
  _parse_error(3757);
  STACKTOP = sp;return;
 } else {
  $9 = HEAP32[$3>>2]|0;
  $10 = HEAP32[8]|0;
  $11 = (37124 + ($10<<2)|0);
  HEAP32[$11>>2] = $9;
  $12 = HEAP32[$4>>2]|0;
  $13 = HEAP32[8]|0;
  $14 = (37188 + ($13<<2)|0);
  HEAP32[$14>>2] = $12;
  $15 = HEAP32[$5>>2]|0;
  $16 = HEAP32[8]|0;
  $17 = (37252 + ($16<<2)|0);
  HEAP32[$17>>2] = $15;
  STACKTOP = sp;return;
 }
}
function _pop_val($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp + 12|0;
 $4 = sp + 8|0;
 $5 = sp + 4|0;
 $6 = sp;
 HEAP32[$4>>2] = $0;
 HEAP32[$5>>2] = $1;
 HEAP32[$6>>2] = $2;
 $7 = HEAP32[8]|0;
 $8 = ($7|0)<(0);
 if ($8) {
  _parse_error(3773);
  HEAP32[$3>>2] = -1;
  $23 = HEAP32[$3>>2]|0;
  STACKTOP = sp;return ($23|0);
 } else {
  $9 = HEAP32[8]|0;
  $10 = (37124 + ($9<<2)|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = HEAP32[$4>>2]|0;
  HEAP32[$12>>2] = $11;
  $13 = HEAP32[8]|0;
  $14 = (37188 + ($13<<2)|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = HEAP32[$5>>2]|0;
  HEAP32[$16>>2] = $15;
  $17 = HEAP32[8]|0;
  $18 = (37252 + ($17<<2)|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = HEAP32[$6>>2]|0;
  HEAP32[$20>>2] = $19;
  $21 = HEAP32[8]|0;
  $22 = (($21) + -1)|0;
  HEAP32[8] = $22;
  HEAP32[$3>>2] = $21;
  $23 = HEAP32[$3>>2]|0;
  STACKTOP = sp;return ($23|0);
 }
 return (0)|0;
}
function _calc_op($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $1 = sp + 24|0;
 $2 = sp + 28|0;
 $3 = sp + 20|0;
 $4 = sp + 16|0;
 $5 = sp + 12|0;
 $6 = sp + 8|0;
 $7 = sp + 4|0;
 $8 = sp;
 HEAP8[$2>>0] = $0;
 $9 = (_pop_val($4,$6,$8)|0);
 $10 = ($9|0)!=(0);
 if (!($10)) {
  HEAP32[$1>>2] = 0;
  $56 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($56|0);
 }
 (_pop_val($3,$5,$7)|0);
 $11 = HEAP32[$7>>2]|0;
 $12 = ($11|0)!=(1);
 $13 = HEAP32[$8>>2]|0;
 $14 = ($13|0)!=(1);
 $or$cond = $12 | $14;
 if ($or$cond) {
  _parse_error(3790);
  HEAP32[$1>>2] = 0;
  $56 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($56|0);
 }
 $15 = HEAP8[$2>>0]|0;
 $16 = $15&255;
 do {
  switch ($16|0) {
  case 170:  {
   $17 = HEAP32[$4>>2]|0;
   $18 = HEAP32[$3>>2]|0;
   $19 = Math_imul($18, $17)|0;
   HEAP32[$3>>2] = $19;
   break;
  }
  case 175:  {
   $20 = HEAP32[$4>>2]|0;
   $21 = HEAP32[$3>>2]|0;
   $22 = (($21|0) / ($20|0))&-1;
   HEAP32[$3>>2] = $22;
   break;
  }
  case 165:  {
   $23 = HEAP32[$4>>2]|0;
   $24 = HEAP32[$3>>2]|0;
   $25 = (($24|0) % ($23|0))&-1;
   HEAP32[$3>>2] = $25;
   break;
  }
  case 171:  {
   $26 = HEAP32[$4>>2]|0;
   $27 = HEAP32[$3>>2]|0;
   $28 = (($27) + ($26))|0;
   HEAP32[$3>>2] = $28;
   break;
  }
  case 173:  {
   $29 = HEAP32[$4>>2]|0;
   $30 = HEAP32[$3>>2]|0;
   $31 = (($30) - ($29))|0;
   HEAP32[$3>>2] = $31;
   break;
  }
  case 204:  {
   $32 = HEAP32[$4>>2]|0;
   $33 = HEAP32[$3>>2]|0;
   $34 = $33 << $32;
   HEAP32[$3>>2] = $34;
   break;
  }
  case 210:  {
   $35 = HEAP32[$4>>2]|0;
   $36 = HEAP32[$3>>2]|0;
   $37 = $36 >> $35;
   HEAP32[$3>>2] = $37;
   break;
  }
  case 166:  {
   $38 = HEAP32[$4>>2]|0;
   $39 = HEAP32[$3>>2]|0;
   $40 = $39 & $38;
   HEAP32[$3>>2] = $40;
   break;
  }
  case 252:  {
   $41 = HEAP32[$4>>2]|0;
   $42 = HEAP32[$3>>2]|0;
   $43 = $42 | $41;
   HEAP32[$3>>2] = $43;
   break;
  }
  case 222:  {
   $44 = HEAP32[$4>>2]|0;
   $45 = HEAP32[$3>>2]|0;
   $46 = $45 ^ $44;
   HEAP32[$3>>2] = $46;
   break;
  }
  default: {
   HEAP32[$1>>2] = 0;
   $56 = HEAP32[$1>>2]|0;
   STACKTOP = sp;return ($56|0);
  }
  }
 } while(0);
 $47 = HEAP32[$5>>2]|0;
 $48 = HEAP32[$6>>2]|0;
 $49 = ($47|0)>($48|0);
 $50 = HEAP32[$5>>2]|0;
 $51 = HEAP32[$6>>2]|0;
 $52 = $49 ? $50 : $51;
 HEAP32[$5>>2] = $52;
 $53 = HEAP32[$3>>2]|0;
 $54 = HEAP32[$5>>2]|0;
 $55 = HEAP32[$7>>2]|0;
 _push_val($53,$54,$55);
 HEAP32[$1>>2] = 1;
 $56 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($56|0);
}
function _parse_constterm($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 $6 = (_scan()|0);
 $7 = $6&255;
 HEAP32[$5>>2] = $7;
 L1: do {
  switch ($7|0) {
  case 211: case 214: case 218: case 217:  {
   label = 7;
   break;
  }
  case 168:  {
   $8 = HEAP32[$3>>2]|0;
   $9 = HEAP32[$4>>2]|0;
   $10 = (_parse_constexpr($8,$9)|0);
   HEAP32[$5>>2] = $10;
   $11 = ($10|0)!=(0);
   if (!($11)) {
    _parse_error(3811);
    HEAP32[$2>>2] = 0;
    break L1;
   }
   $12 = HEAP8[111813]|0;
   $13 = $12&255;
   $14 = ($13|0)!=(169);
   if ($14) {
    _parse_error(3841);
    HEAP32[$2>>2] = 0;
   } else {
    label = 7;
   }
   break;
  }
  default: {
   HEAP32[$2>>2] = 0;
  }
  }
 } while(0);
 if ((label|0) == 7) {
  $15 = HEAP32[$5>>2]|0;
  HEAP32[$2>>2] = $15;
 }
 $16 = HEAP32[$2>>2]|0;
 STACKTOP = sp;return ($16|0);
}
function _parse_constexpr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $or$cond = 0, $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $2 = sp + 28|0;
 $3 = sp + 24|0;
 $4 = sp + 20|0;
 $5 = sp + 16|0;
 $6 = sp + 12|0;
 $7 = sp + 8|0;
 $8 = sp + 4|0;
 $9 = sp;
 HEAP32[$3>>2] = $0;
 HEAP32[$4>>2] = $1;
 HEAP32[$6>>2] = 0;
 $10 = HEAP32[7]|0;
 HEAP32[$7>>2] = $10;
 HEAP32[$9>>2] = 1;
 $11 = HEAP32[$3>>2]|0;
 HEAP32[$11>>2] = 0;
 $12 = HEAP32[$4>>2]|0;
 HEAP32[$12>>2] = 1;
 L1: while(1) {
  $13 = HEAP32[$6>>2]|0;
  HEAP32[$5>>2] = $13;
  HEAP32[$6>>2] = 0;
  $14 = (_parse_constval()|0);
  $15 = ($14|0)!=(0);
  L3: do {
   if ($15) {
    HEAP32[$6>>2] = 1;
    (_scan()|0);
    HEAP32[$8>>2] = 0;
    while(1) {
     $16 = HEAP32[$8>>2]|0;
     $17 = ($16>>>0)<(18);
     if (!($17)) {
      break L3;
     }
     $18 = HEAP8[111813]|0;
     $19 = $18&255;
     $20 = HEAP32[$8>>2]|0;
     $21 = (3721 + ($20)|0);
     $22 = HEAP8[$21>>0]|0;
     $23 = $22&255;
     $24 = ($19|0)==($23|0);
     if ($24) {
      break;
     }
     $40 = HEAP32[$8>>2]|0;
     $41 = (($40) + 1)|0;
     HEAP32[$8>>2] = $41;
    }
    HEAP32[$6>>2] = 2;
    $25 = HEAP32[$8>>2]|0;
    $26 = (3739 + ($25)|0);
    $27 = HEAP8[$26>>0]|0;
    $28 = $27&255;
    $29 = HEAP32[$7>>2]|0;
    $30 = (_tos_op_prec($29)|0);
    $31 = ($28|0)>=($30|0);
    if ($31) {
     $32 = (_pop_op()|0);
     $33 = (_calc_op($32)|0);
     $34 = ($33|0)!=(0);
     if (!($34)) {
      label = 8;
      break L1;
     }
    }
    $35 = HEAP8[111813]|0;
    $36 = HEAP32[$8>>2]|0;
    $37 = (3739 + ($36)|0);
    $38 = HEAP8[$37>>0]|0;
    $39 = $38&255;
    _push_op($35,$39);
   }
  } while(0);
  $42 = HEAP32[$6>>2]|0;
  $43 = ($42|0)==(2);
  if (!($43)) {
   break;
  }
 }
 if ((label|0) == 8) {
  _parse_error(3869);
  HEAP32[$2>>2] = 0;
  $61 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($61|0);
 }
 $44 = HEAP32[$6>>2]|0;
 $45 = ($44|0)==(0);
 $46 = HEAP32[$5>>2]|0;
 $47 = ($46|0)==(0);
 $or$cond = $45 & $47;
 if ($or$cond) {
  HEAP32[$2>>2] = 0;
  $61 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($61|0);
 }
 $48 = HEAP32[$6>>2]|0;
 $49 = ($48|0)==(0);
 $50 = HEAP32[$5>>2]|0;
 $51 = ($50|0)==(2);
 $or$cond3 = $49 & $51;
 if ($or$cond3) {
  _parse_error(3896);
  HEAP32[$2>>2] = 0;
  $61 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($61|0);
 }
 while(1) {
  $52 = HEAP32[$7>>2]|0;
  $53 = HEAP32[7]|0;
  $54 = ($52|0)<($53|0);
  if (!($54)) {
   label = 19;
   break;
  }
  $55 = (_pop_op()|0);
  $56 = (_calc_op($55)|0);
  $57 = ($56|0)!=(0);
  if (!($57)) {
   label = 18;
   break;
  }
 }
 if ((label|0) == 18) {
  _parse_error(3869);
  HEAP32[$2>>2] = 0;
  $61 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($61|0);
 }
 else if ((label|0) == 19) {
  $58 = HEAP32[$3>>2]|0;
  $59 = HEAP32[$4>>2]|0;
  (_pop_val($58,$59,$9)|0);
  $60 = HEAP32[$9>>2]|0;
  HEAP32[$2>>2] = $60;
  $61 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($61|0);
 }
 return (0)|0;
}
function _parse_constval() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp + 16|0;
 $1 = sp + 12|0;
 $2 = sp + 8|0;
 $3 = sp + 4|0;
 $4 = sp;
 HEAP32[$1>>2] = 0;
 HEAP32[$4>>2] = 0;
 HEAP32[$3>>2] = 1;
 L1: while(1) {
  $5 = (_parse_constterm($4,$3)|0);
  HEAP32[$2>>2] = $5;
  $6 = ($5|0)!=(0);
  $7 = $6 ^ 1;
  $8 = HEAP8[111813]|0;
  $9 = $8&255;
  if (!($7)) {
   break;
  }
  switch ($9|0) {
  case 171:  {
   continue L1;
   break;
  }
  case 173:  {
   $10 = HEAP32[$1>>2]|0;
   $11 = $10 | 1;
   HEAP32[$1>>2] = $11;
   continue L1;
   break;
  }
  case 254:  {
   $12 = HEAP32[$1>>2]|0;
   $13 = $12 | 2;
   HEAP32[$1>>2] = $13;
   continue L1;
   break;
  }
  case 161:  {
   $14 = HEAP32[$1>>2]|0;
   $15 = $14 | 4;
   HEAP32[$1>>2] = $15;
   continue L1;
   break;
  }
  case 192:  {
   $16 = HEAP32[$1>>2]|0;
   $17 = $16 | 8;
   HEAP32[$1>>2] = $17;
   continue L1;
   break;
  }
  default: {
   label = 8;
   break L1;
  }
  }
 }
 if ((label|0) == 8) {
  HEAP32[$0>>2] = 0;
  $65 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($65|0);
 }
 L13: do {
  switch ($9|0) {
  case 169:  {
   break;
  }
  case 211:  {
   $18 = HEAP32[9256]|0;
   $19 = (($18) - 1)|0;
   HEAP32[$3>>2] = $19;
   $20 = HEAP32[9257]|0;
   HEAP32[$4>>2] = $20;
   HEAP32[$2>>2] = 1024;
   $21 = HEAP32[$1>>2]|0;
   $22 = ($21|0)!=(0);
   if ($22) {
    _parse_error(3912);
    HEAP32[$0>>2] = 0;
    $65 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($65|0);
   }
   break;
  }
  case 217:  {
   HEAP32[$3>>2] = 1;
   $23 = HEAP32[9257]|0;
   HEAP32[$4>>2] = $23;
   HEAP32[$2>>2] = 1;
   break;
  }
  case 218:  {
   HEAP32[$3>>2] = 2;
   $24 = HEAP32[9257]|0;
   HEAP32[$4>>2] = $24;
   HEAP32[$2>>2] = 1;
   break;
  }
  case 214:  {
   HEAP32[$3>>2] = 2;
   $25 = HEAP32[9255]|0;
   $26 = HEAP32[9256]|0;
   $27 = (_id_type($25,$26)|0);
   HEAP32[$2>>2] = $27;
   $28 = HEAP32[$2>>2]|0;
   $29 = $28 & 1;
   $30 = ($29|0)!=(0);
   if ($30) {
    $31 = HEAP32[9255]|0;
    $32 = HEAP32[9256]|0;
    $33 = (_id_const($31,$32)|0);
    HEAP32[$4>>2] = $33;
    break L13;
   }
   $34 = HEAP32[$2>>2]|0;
   $35 = $34 & 8344;
   $36 = ($35|0)!=(0);
   if (!($36)) {
    $37 = HEAP32[$2>>2]|0;
    $38 = $37 & 8350;
    $39 = ($38|0)!=(0);
    $40 = HEAP32[$1>>2]|0;
    $41 = ($40|0)==(8);
    $or$cond = $39 & $41;
    if (!($or$cond)) {
     HEAP32[$0>>2] = 0;
     $65 = HEAP32[$0>>2]|0;
     STACKTOP = sp;return ($65|0);
    }
   }
   $42 = HEAP32[9255]|0;
   $43 = HEAP32[9256]|0;
   $44 = (_id_tag($42,$43)|0);
   HEAP32[$4>>2] = $44;
   break;
  }
  default: {
   HEAP32[$0>>2] = 0;
   $65 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($65|0);
  }
  }
 } while(0);
 $45 = HEAP32[$1>>2]|0;
 $46 = $45 & 1;
 $47 = ($46|0)!=(0);
 if ($47) {
  $48 = HEAP32[$4>>2]|0;
  $49 = (0 - ($48))|0;
  HEAP32[$4>>2] = $49;
 }
 $50 = HEAP32[$1>>2]|0;
 $51 = $50 & 2;
 $52 = ($51|0)!=(0);
 if ($52) {
  $53 = HEAP32[$4>>2]|0;
  $54 = $53 ^ -1;
  HEAP32[$4>>2] = $54;
 }
 $55 = HEAP32[$1>>2]|0;
 $56 = $55 & 4;
 $57 = ($56|0)!=(0);
 if ($57) {
  $58 = HEAP32[$4>>2]|0;
  $59 = ($58|0)!=(0);
  $60 = $59 ? 0 : -1;
  HEAP32[$4>>2] = $60;
 }
 $61 = HEAP32[$4>>2]|0;
 $62 = HEAP32[$3>>2]|0;
 $63 = HEAP32[$2>>2]|0;
 _push_val($61,$62,$63);
 $64 = HEAP32[$2>>2]|0;
 HEAP32[$0>>2] = $64;
 $65 = HEAP32[$0>>2]|0;
 STACKTOP = sp;return ($65|0);
}
function _parse_const($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp + 4|0;
 $2 = sp;
 HEAP32[$2>>2] = $0;
 $3 = (_scan()|0);
 $4 = $3&255;
 switch ($4|0) {
 case 218: case 217:  {
  $5 = HEAP32[9257]|0;
  $6 = HEAP32[$2>>2]|0;
  HEAP32[$6>>2] = $5;
  label = 6;
  break;
 }
 case 214:  {
  $7 = HEAP32[9255]|0;
  $8 = HEAP32[9256]|0;
  $9 = (_id_type($7,$8)|0);
  $10 = $9 & 1;
  $11 = ($10|0)!=(0);
  if ($11) {
   $12 = HEAP32[9255]|0;
   $13 = HEAP32[9256]|0;
   $14 = (_id_const($12,$13)|0);
   $15 = HEAP32[$2>>2]|0;
   HEAP32[$15>>2] = $14;
   label = 6;
  } else {
   label = 5;
  }
  break;
 }
 default: {
  label = 5;
 }
 }
 if ((label|0) == 5) {
  $16 = HEAP32[$2>>2]|0;
  HEAP32[$16>>2] = 0;
  HEAP32[$1>>2] = 0;
  $17 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 else if ((label|0) == 6) {
  HEAP32[$1>>2] = 1;
  $17 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($17|0);
 }
 return (0)|0;
}
function _parse_term() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 $1 = (_scan()|0);
 $2 = $1&255;
 L1: do {
  switch ($2|0) {
  case 211: case 214: case 218: case 217:  {
   label = 7;
   break;
  }
  case 168:  {
   $3 = (_parse_expr()|0);
   $4 = ($3|0)!=(0);
   if (!($4)) {
    _parse_error(3811);
    HEAP32[$0>>2] = 0;
    break L1;
   }
   $5 = HEAP8[111813]|0;
   $6 = $5&255;
   $7 = ($6|0)!=(169);
   if ($7) {
    _parse_error(3841);
    HEAP32[$0>>2] = 0;
   } else {
    label = 7;
   }
   break;
  }
  default: {
   HEAP32[$0>>2] = 0;
  }
  }
 } while(0);
 if ((label|0) == 7) {
  HEAP32[$0>>2] = 1;
 }
 $8 = HEAP32[$0>>2]|0;
 STACKTOP = sp;return ($8|0);
}
function _parse_expr() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp + 20|0;
 $1 = sp + 16|0;
 $2 = sp + 12|0;
 $3 = sp + 8|0;
 $4 = sp + 4|0;
 $5 = sp;
 HEAP32[$2>>2] = 0;
 $6 = HEAP32[7]|0;
 HEAP32[$3>>2] = $6;
 HEAP32[$5>>2] = 0;
 L1: while(1) {
  $7 = HEAP32[$2>>2]|0;
  HEAP32[$1>>2] = $7;
  HEAP32[$2>>2] = 0;
  $8 = (_parse_value(1)|0);
  $9 = ($8|0)!=(0);
  L3: do {
   if ($9) {
    HEAP32[$2>>2] = 1;
    HEAP32[$4>>2] = 0;
    while(1) {
     $10 = HEAP32[$4>>2]|0;
     $11 = ($10>>>0)<(18);
     if (!($11)) {
      break L3;
     }
     $12 = HEAP8[111813]|0;
     $13 = $12&255;
     $14 = HEAP32[$4>>2]|0;
     $15 = (3721 + ($14)|0);
     $16 = HEAP8[$15>>0]|0;
     $17 = $16&255;
     $18 = ($13|0)==($17|0);
     if ($18) {
      break;
     }
     $34 = HEAP32[$4>>2]|0;
     $35 = (($34) + 1)|0;
     HEAP32[$4>>2] = $35;
    }
    HEAP32[$2>>2] = 2;
    $19 = HEAP32[$4>>2]|0;
    $20 = (3739 + ($19)|0);
    $21 = HEAP8[$20>>0]|0;
    $22 = $21&255;
    $23 = HEAP32[$3>>2]|0;
    $24 = (_tos_op_prec($23)|0);
    $25 = ($22|0)>=($24|0);
    if ($25) {
     $26 = (_pop_op()|0);
     $27 = (_emit_op($26)|0);
     $28 = ($27|0)!=(0);
     if (!($28)) {
      label = 8;
      break L1;
     }
    }
    $29 = HEAP8[111813]|0;
    $30 = HEAP32[$4>>2]|0;
    $31 = (3739 + ($30)|0);
    $32 = HEAP8[$31>>0]|0;
    $33 = $32&255;
    _push_op($29,$33);
   }
  } while(0);
  $36 = HEAP32[$2>>2]|0;
  $37 = ($36|0)==(2);
  if (!($37)) {
   break;
  }
 }
 if ((label|0) == 8) {
  _parse_error(3869);
  HEAP32[$0>>2] = 0;
  $54 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($54|0);
 }
 $38 = HEAP32[$2>>2]|0;
 $39 = ($38|0)==(0);
 $40 = HEAP32[$1>>2]|0;
 $41 = ($40|0)==(2);
 $or$cond = $39 & $41;
 if ($or$cond) {
  _parse_error(3896);
  HEAP32[$0>>2] = 0;
  $54 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($54|0);
 }
 while(1) {
  $42 = HEAP32[$3>>2]|0;
  $43 = HEAP32[7]|0;
  $44 = ($42|0)<($43|0);
  if (!($44)) {
   label = 17;
   break;
  }
  $45 = (_pop_op()|0);
  $46 = (_emit_op($45)|0);
  $47 = ($46|0)!=(0);
  if (!($47)) {
   label = 16;
   break;
  }
 }
 if ((label|0) == 16) {
  _parse_error(3869);
  HEAP32[$0>>2] = 0;
  $54 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($54|0);
 }
 else if ((label|0) == 17) {
  $48 = HEAP32[$2>>2]|0;
  $49 = ($48|0)!=(0);
  $50 = HEAP32[$1>>2]|0;
  $51 = ($50|0)!=(0);
  $52 = $49 ? 1 : $51;
  $53 = $52&1;
  HEAP32[$0>>2] = $53;
  $54 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($54|0);
 }
 return (0)|0;
}
function _parse_value($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0;
 var $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0;
 var $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0;
 var $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0;
 var $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0;
 var $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0;
 var $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0;
 var $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0;
 var $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0;
 var $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0;
 var $333 = 0, $334 = 0, $335 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0;
 var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer = sp;
 $1 = sp + 44|0;
 $2 = sp + 40|0;
 $3 = sp + 36|0;
 $4 = sp + 32|0;
 $5 = sp + 28|0;
 $6 = sp + 24|0;
 $7 = sp + 20|0;
 $8 = sp + 16|0;
 $9 = sp + 12|0;
 $10 = sp + 8|0;
 $11 = sp + 4|0;
 HEAP32[$2>>2] = $0;
 $12 = HEAP32[$2>>2]|0;
 HEAP32[$4>>2] = $12;
 $13 = HEAP32[7]|0;
 HEAP32[$5>>2] = $13;
 HEAP32[$6>>2] = 0;
 HEAP32[$7>>2] = 0;
 HEAP32[$8>>2] = 0;
 L1: while(1) {
  $14 = (_parse_term()|0);
  $15 = ($14|0)!=(0);
  $16 = $15 ^ 1;
  $17 = HEAP8[111813]|0;
  $18 = $17&255;
  if (!($16)) {
   break;
  }
  switch ($18|0) {
  case 171:  {
   continue L1;
   break;
  }
  case 222:  {
   $19 = HEAP32[$4>>2]|0;
   $20 = ($19|0)!=(0);
   if ($20) {
    $21 = HEAP8[111813]|0;
    _push_op($21,0);
    continue L1;
   } else {
    $22 = HEAP32[$4>>2]|0;
    $23 = (($22) + 1)|0;
    HEAP32[$4>>2] = $23;
    $24 = HEAP32[$6>>2]|0;
    $25 = $24 | 512;
    HEAP32[$6>>2] = $25;
    continue L1;
   }
   break;
  }
  case 170:  {
   $26 = HEAP32[$4>>2]|0;
   $27 = ($26|0)!=(0);
   if ($27) {
    $28 = HEAP8[111813]|0;
    _push_op($28,0);
    continue L1;
   } else {
    $29 = HEAP32[$4>>2]|0;
    $30 = (($29) + 1)|0;
    HEAP32[$4>>2] = $30;
    $31 = HEAP32[$6>>2]|0;
    $32 = $31 | 256;
    HEAP32[$6>>2] = $32;
    continue L1;
   }
   break;
  }
  case 192:  {
   $33 = HEAP32[$4>>2]|0;
   $34 = (($33) + -1)|0;
   HEAP32[$4>>2] = $34;
   continue L1;
   break;
  }
  case 161: case 254: case 173:  {
   $35 = HEAP8[111813]|0;
   _push_op($35,0);
   continue L1;
   break;
  }
  default: {
   label = 12;
   break L1;
  }
  }
 }
 if ((label|0) == 12) {
  HEAP32[$1>>2] = 0;
  $335 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($335|0);
 }
 $36 = ($18|0)==(218);
 do {
  if ($36) {
   label = 15;
  } else {
   $37 = HEAP8[111813]|0;
   $38 = $37&255;
   $39 = ($38|0)==(217);
   if ($39) {
    label = 15;
   } else {
    $43 = HEAP8[111813]|0;
    $44 = $43&255;
    $45 = ($44|0)==(214);
    if (!($45)) {
     $68 = HEAP8[111813]|0;
     $69 = $68&255;
     $70 = ($69|0)==(169);
     if ($70) {
      HEAP32[$8>>2] = 1;
      break;
     }
     $71 = HEAP8[111813]|0;
     $72 = $71&255;
     $73 = ($72|0)==(211);
     if ($73) {
      $74 = HEAP32[9257]|0;
      $75 = HEAP32[9256]|0;
      $76 = (($75) - 1)|0;
      _emit_conststr($74,$76);
      (_scan()|0);
      HEAP32[$1>>2] = 2;
      $335 = HEAP32[$1>>2]|0;
      STACKTOP = sp;return ($335|0);
     } else {
      HEAP32[$1>>2] = 0;
      $335 = HEAP32[$1>>2]|0;
      STACKTOP = sp;return ($335|0);
     }
    }
    $46 = HEAP32[9255]|0;
    $47 = HEAP32[9256]|0;
    $48 = (_id_type($46,$47)|0);
    $49 = HEAP32[$6>>2]|0;
    $50 = $49 | $48;
    HEAP32[$6>>2] = $50;
    $51 = $50 & 1;
    $52 = ($51|0)!=(0);
    if ($52) {
     $53 = HEAP32[9255]|0;
     $54 = HEAP32[9256]|0;
     $55 = (_id_const($53,$54)|0);
     HEAP32[$7>>2] = $55;
     break;
    }
    $56 = HEAP32[$6>>2]|0;
    $57 = $56 & 6;
    $58 = ($57|0)!=(0);
    if ($58) {
     $59 = HEAP32[9255]|0;
     $60 = HEAP32[9256]|0;
     $61 = (_id_tag($59,$60)|0);
     HEAP32[$7>>2] = $61;
     break;
    }
    $62 = HEAP32[$6>>2]|0;
    $63 = $62 & 8216;
    $64 = ($63|0)!=(0);
    if ($64) {
     $65 = HEAP32[9255]|0;
     $66 = HEAP32[9256]|0;
     $67 = (_id_tag($65,$66)|0);
     HEAP32[$7>>2] = $67;
     break;
    }
    (_printf(3937,$vararg_buffer)|0);
    HEAP32[$1>>2] = 0;
    $335 = HEAP32[$1>>2]|0;
    STACKTOP = sp;return ($335|0);
   }
  }
 } while(0);
 if ((label|0) == 15) {
  $40 = HEAP32[9257]|0;
  HEAP32[$7>>2] = $40;
  $41 = HEAP32[$6>>2]|0;
  $42 = $41 | 1;
  HEAP32[$6>>2] = $42;
 }
 $77 = HEAP32[$6>>2]|0;
 $78 = $77 & 1;
 $79 = ($78|0)!=(0);
 L46: do {
  if ($79) {
   L47: while(1) {
    $80 = HEAP32[$5>>2]|0;
    $81 = HEAP32[7]|0;
    $82 = ($80|0)<($81|0);
    if (!($82)) {
     break L46;
    }
    $83 = (_tos_op()|0);
    $84 = $83&255;
    $85 = ($84|0)==(173);
    if (!($85)) {
     $86 = (_tos_op()|0);
     $87 = $86&255;
     $88 = ($87|0)==(254);
     if (!($88)) {
      $89 = (_tos_op()|0);
      $90 = $89&255;
      $91 = ($90|0)==(161);
      if (!($91)) {
       break L46;
      }
     }
    }
    $92 = (_pop_op()|0);
    $93 = $92&255;
    switch ($93|0) {
    case 173:  {
     $94 = HEAP32[$7>>2]|0;
     $95 = (0 - ($94))|0;
     HEAP32[$7>>2] = $95;
     continue L47;
     break;
    }
    case 254:  {
     $96 = HEAP32[$7>>2]|0;
     $97 = $96 ^ -1;
     HEAP32[$7>>2] = $97;
     continue L47;
     break;
    }
    case 161:  {
     $98 = HEAP32[$7>>2]|0;
     $99 = ($98|0)!=(0);
     $100 = $99 ? 0 : -1;
     HEAP32[$7>>2] = $100;
     continue L47;
     break;
    }
    default: {
     continue L47;
    }
    }
   }
  }
 } while(0);
 $101 = HEAP32[$6>>2]|0;
 $102 = $101 & -769;
 HEAP32[$9>>2] = $102;
 HEAP32[$10>>2] = 0;
 L59: while(1) {
  $103 = (_scan()|0);
  $104 = $103&255;
  $105 = ($104|0)==(168);
  if (!($105)) {
   $106 = HEAP8[111813]|0;
   $107 = $106&255;
   $108 = ($107|0)==(219);
   if (!($108)) {
    $109 = HEAP8[111813]|0;
    $110 = $109&255;
    $111 = ($110|0)==(226);
    if (!($111)) {
     $112 = HEAP8[111813]|0;
     $113 = $112&255;
     $114 = ($113|0)==(247);
     if (!($114)) {
      $115 = HEAP8[111813]|0;
      $116 = $115&255;
      $117 = ($116|0)==(174);
      if (!($117)) {
       $118 = HEAP8[111813]|0;
       $119 = $118&255;
       $120 = ($119|0)==(186);
       if (!($120)) {
        label = 124;
        break;
       }
      }
     }
    }
   }
  }
  $121 = HEAP8[111813]|0;
  $122 = $121&255;
  switch ($122|0) {
  case 168:  {
   $123 = HEAP32[$8>>2]|0;
   $124 = ($123|0)!=(0);
   if ($124) {
    $125 = HEAP32[$10>>2]|0;
    $126 = ($125|0)!=(0);
    if ($126) {
     $127 = HEAP32[$10>>2]|0;
     _emit_const($127);
     (_emit_op(-85)|0);
     HEAP32[$10>>2] = 0;
    }
    $128 = HEAP32[$9>>2]|0;
    $129 = $128 & 768;
    $130 = ($129|0)!=(0);
    do {
     if ($130) {
      $131 = HEAP32[$9>>2]|0;
      $132 = $131 & 512;
      $133 = ($132|0)!=(0);
      if ($133) {
       _emit_lb();
       break;
      } else {
       _emit_lw();
       break;
      }
     }
    } while(0);
    $134 = (_scan_lookahead()|0);
    $135 = ($134|0)!=(169);
    if ($135) {
     _emit_push();
    }
   }
   HEAP32[$3>>2] = 0;
   while(1) {
    $136 = (_parse_expr()|0);
    $137 = ($136|0)!=(0);
    if (!($137)) {
     break;
    }
    $138 = HEAP32[$3>>2]|0;
    $139 = (($138) + 1)|0;
    HEAP32[$3>>2] = $139;
    $140 = HEAP8[111813]|0;
    $141 = $140&255;
    $142 = ($141|0)!=(172);
    if ($142) {
     break;
    }
   }
   $143 = HEAP8[111813]|0;
   $144 = $143&255;
   $145 = ($144|0)!=(169);
   if ($145) {
    label = 59;
    break L59;
   }
   $146 = HEAP32[$9>>2]|0;
   $147 = $146 & 8217;
   $148 = ($147|0)!=(0);
   if ($148) {
    $149 = HEAP32[$7>>2]|0;
    $150 = HEAP32[$9>>2]|0;
    _emit_call($149,$150);
   } else {
    $151 = HEAP32[$8>>2]|0;
    $152 = ($151|0)!=(0);
    do {
     if ($152) {
      $167 = HEAP32[$3>>2]|0;
      $168 = ($167|0)!=(0);
      if ($168) {
       _emit_pull();
      }
     } else {
      $153 = HEAP32[$6>>2]|0;
      $154 = $153 & 1;
      $155 = ($154|0)!=(0);
      if ($155) {
       $156 = HEAP32[$7>>2]|0;
       _emit_const($156);
       break;
      }
      $157 = HEAP32[$6>>2]|0;
      $158 = $157 & 6;
      $159 = ($158|0)!=(0);
      if ($159) {
       $160 = HEAP32[$6>>2]|0;
       $161 = $160 & 64;
       $162 = ($161|0)!=(0);
       $163 = HEAP32[$7>>2]|0;
       $164 = HEAP32[$10>>2]|0;
       if ($162) {
        $165 = (($163) + ($164))|0;
        _emit_llw($165);
       } else {
        $166 = HEAP32[$6>>2]|0;
        _emit_law($163,$164,$166);
       }
       HEAP32[$10>>2] = 0;
      }
     }
    } while(0);
    _emit_ical();
   }
   HEAP32[$8>>2] = 1;
   HEAP32[$9>>2] = 0;
   continue L59;
   break;
  }
  case 219:  {
   $169 = HEAP32[$8>>2]|0;
   $170 = ($169|0)!=(0);
   if ($170) {
    $185 = HEAP32[$10>>2]|0;
    $186 = ($185|0)!=(0);
    if ($186) {
     $187 = HEAP32[$10>>2]|0;
     _emit_const($187);
     (_emit_op(-85)|0);
     HEAP32[$10>>2] = 0;
    }
   } else {
    $171 = HEAP32[$6>>2]|0;
    $172 = $171 & 1;
    $173 = ($172|0)!=(0);
    if ($173) {
     $174 = HEAP32[$7>>2]|0;
     _emit_const($174);
    } else {
     $175 = HEAP32[$6>>2]|0;
     $176 = $175 & 8350;
     $177 = ($176|0)!=(0);
     if (!($177)) {
      label = 82;
      break L59;
     }
     $178 = HEAP32[$6>>2]|0;
     $179 = $178 & 64;
     $180 = ($179|0)!=(0);
     $181 = HEAP32[$7>>2]|0;
     $182 = HEAP32[$10>>2]|0;
     if ($180) {
      $183 = (($181) + ($182))|0;
      _emit_localaddr($183);
     } else {
      $184 = HEAP32[$6>>2]|0;
      _emit_globaladdr($181,$182,$184);
     }
     HEAP32[$10>>2] = 0;
    }
    HEAP32[$8>>2] = 1;
   }
   while(1) {
    $188 = (_parse_expr()|0);
    $189 = ($188|0)!=(0);
    if (!($189)) {
     break;
    }
    $190 = HEAP8[111813]|0;
    $191 = $190&255;
    $192 = ($191|0)!=(172);
    if ($192) {
     break;
    }
    _emit_indexword();
    _emit_lw();
   }
   $193 = HEAP8[111813]|0;
   $194 = $193&255;
   $195 = ($194|0)!=(221);
   if ($195) {
    label = 90;
    break L59;
   }
   $196 = HEAP32[$9>>2]|0;
   $197 = $196 & 258;
   $198 = ($197|0)!=(0);
   if ($198) {
    _emit_indexword();
    HEAP32[$9>>2] = 256;
    continue L59;
   } else {
    _emit_indexbyte();
    HEAP32[$9>>2] = 512;
    continue L59;
   }
   break;
  }
  case 247: case 226:  {
   $199 = HEAP32[$8>>2]|0;
   $200 = ($199|0)!=(0);
   do {
    if ($200) {
     $218 = HEAP32[$10>>2]|0;
     $219 = ($218|0)!=(0);
     if ($219) {
      $220 = HEAP32[$10>>2]|0;
      _emit_const($220);
      (_emit_op(-85)|0);
     }
     $221 = HEAP32[$9>>2]|0;
     $222 = $221 & 768;
     $223 = ($222|0)!=(0);
     if ($223) {
      $224 = HEAP32[$9>>2]|0;
      $225 = $224 & 512;
      $226 = ($225|0)!=(0);
      if ($226) {
       _emit_lb();
       break;
      } else {
       _emit_lw();
       break;
      }
     }
    } else {
     $201 = HEAP32[$6>>2]|0;
     $202 = $201 & 1;
     $203 = ($202|0)!=(0);
     do {
      if ($203) {
       $204 = HEAP32[$7>>2]|0;
       _emit_const($204);
      } else {
       $205 = HEAP32[$6>>2]|0;
       $206 = $205 & 8350;
       $207 = ($206|0)!=(0);
       if ($207) {
        $208 = HEAP32[$6>>2]|0;
        $209 = $208 & 64;
        $210 = ($209|0)!=(0);
        $211 = HEAP32[$9>>2]|0;
        $212 = $211 & 4;
        $213 = ($212|0)!=(0);
        $214 = HEAP32[$7>>2]|0;
        $215 = HEAP32[$10>>2]|0;
        if ($210) {
         $216 = (($214) + ($215))|0;
         if ($213) {
          _emit_llb($216);
          break;
         } else {
          _emit_llw($216);
          break;
         }
        } else {
         $217 = HEAP32[$6>>2]|0;
         if ($213) {
          _emit_lab($214,$215,$217);
          break;
         } else {
          _emit_law($214,$215,$217);
          break;
         }
        }
       }
      }
     } while(0);
     HEAP32[$8>>2] = 1;
    }
   } while(0);
   HEAP32[$10>>2] = 0;
   $227 = HEAP8[111813]|0;
   $228 = $227&255;
   $229 = ($228|0)==(226);
   $230 = $229 ? 512 : 256;
   HEAP32[$9>>2] = $230;
   $231 = (_parse_const($10)|0);
   $232 = ($231|0)!=(0);
   if (!($232)) {
    $233 = HEAP32[9255]|0;
    _scan_rewind($233);
   }
   $234 = HEAP32[$10>>2]|0;
   $235 = ($234|0)!=(0);
   if (!($235)) {
    continue L59;
   }
   $236 = HEAP32[$10>>2]|0;
   _emit_const($236);
   (_emit_op(-85)|0);
   HEAP32[$10>>2] = 0;
   continue L59;
   break;
  }
  case 186: case 174:  {
   $237 = HEAP32[$9>>2]|0;
   $238 = $237 & 7;
   $239 = ($238|0)!=(0);
   $240 = HEAP8[111813]|0;
   $241 = $240&255;
   $242 = ($241|0)==(174);
   $243 = $242 ? 4 : 2;
   $244 = $242 ? 512 : 256;
   $245 = $239 ? $243 : $244;
   HEAP32[$9>>2] = $245;
   $246 = (_parse_const($11)|0);
   $247 = ($246|0)!=(0);
   if ($247) {
    $248 = HEAP32[$11>>2]|0;
    $249 = HEAP32[$10>>2]|0;
    $250 = (($249) + ($248))|0;
    HEAP32[$10>>2] = $250;
   } else {
    $251 = HEAP32[9255]|0;
    _scan_rewind($251);
   }
   $252 = HEAP32[$8>>2]|0;
   $253 = ($252|0)!=(0);
   if ($253) {
    continue L59;
   }
   $254 = HEAP32[$6>>2]|0;
   $255 = $254 & 1;
   $256 = ($255|0)!=(0);
   if ($256) {
    $257 = HEAP32[$10>>2]|0;
    $258 = HEAP32[$7>>2]|0;
    $259 = (($258) + ($257))|0;
    HEAP32[$7>>2] = $259;
    HEAP32[$10>>2] = 0;
    continue L59;
   }
   $260 = HEAP32[$6>>2]|0;
   $261 = $260 & 8216;
   $262 = ($261|0)!=(0);
   if (!($262)) {
    continue L59;
   }
   $263 = HEAP32[$7>>2]|0;
   $264 = HEAP32[$10>>2]|0;
   $265 = HEAP32[$6>>2]|0;
   _emit_globaladdr($263,$264,$265);
   HEAP32[$10>>2] = 0;
   HEAP32[$8>>2] = 1;
   continue L59;
   break;
  }
  default: {
   continue L59;
  }
  }
 }
 if ((label|0) == 59) {
  _parse_error(3841);
  HEAP32[$1>>2] = 0;
  $335 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($335|0);
 }
 else if ((label|0) == 82) {
  _parse_error(3950);
  HEAP32[$1>>2] = 0;
  $335 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($335|0);
 }
 else if ((label|0) == 90) {
  _parse_error(3970);
  HEAP32[$1>>2] = 0;
  $335 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($335|0);
 }
 else if ((label|0) == 124) {
  $266 = HEAP32[$8>>2]|0;
  $267 = ($266|0)!=(0);
  do {
   if ($267) {
    $268 = HEAP32[$10>>2]|0;
    $269 = ($268|0)!=(0);
    if ($269) {
     $270 = HEAP32[$10>>2]|0;
     _emit_const($270);
     (_emit_op(-85)|0);
     HEAP32[$10>>2] = 0;
    }
    $271 = HEAP32[$4>>2]|0;
    $272 = ($271|0)!=(0);
    if ($272) {
     $273 = HEAP32[$9>>2]|0;
     $274 = $273 & 512;
     $275 = ($274|0)!=(0);
     if ($275) {
      _emit_lb();
      break;
     }
     $276 = HEAP32[$9>>2]|0;
     $277 = $276 & 256;
     $278 = ($277|0)!=(0);
     if ($278) {
      _emit_lw();
     }
    }
   } else {
    $279 = HEAP32[$4>>2]|0;
    $280 = ($279|0)!=(0);
    $281 = HEAP32[$6>>2]|0;
    $282 = $281 & 1;
    $283 = ($282|0)!=(0);
    if (!($280)) {
     if ($283) {
      $309 = HEAP32[$7>>2]|0;
      _emit_const($309);
      break;
     }
     $310 = HEAP32[$6>>2]|0;
     $311 = $310 & 8350;
     $312 = ($311|0)!=(0);
     if (!($312)) {
      break;
     }
     $313 = HEAP32[$6>>2]|0;
     $314 = $313 & 64;
     $315 = ($314|0)!=(0);
     $316 = HEAP32[$7>>2]|0;
     $317 = HEAP32[$10>>2]|0;
     if ($315) {
      $318 = (($316) + ($317))|0;
      _emit_localaddr($318);
      break;
     } else {
      $319 = HEAP32[$9>>2]|0;
      _emit_globaladdr($316,$317,$319);
      break;
     }
    }
    if ($283) {
     $284 = HEAP32[$7>>2]|0;
     _emit_const($284);
     $285 = HEAP32[$9>>2]|0;
     $286 = $285 & 6;
     $287 = ($286|0)!=(0);
     if (!($287)) {
      break;
     }
     $288 = HEAP32[$9>>2]|0;
     $289 = $288 & 4;
     $290 = ($289|0)!=(0);
     if ($290) {
      _emit_lb();
      break;
     } else {
      _emit_lw();
      break;
     }
    }
    $291 = HEAP32[$6>>2]|0;
    $292 = $291 & 8216;
    $293 = ($292|0)!=(0);
    if ($293) {
     $294 = HEAP32[$7>>2]|0;
     $295 = HEAP32[$9>>2]|0;
     _emit_call($294,$295);
     break;
    }
    $296 = HEAP32[$6>>2]|0;
    $297 = $296 & 6;
    $298 = ($297|0)!=(0);
    if ($298) {
     $299 = HEAP32[$6>>2]|0;
     $300 = $299 & 64;
     $301 = ($300|0)!=(0);
     $302 = HEAP32[$9>>2]|0;
     $303 = $302 & 4;
     $304 = ($303|0)!=(0);
     $305 = HEAP32[$7>>2]|0;
     $306 = HEAP32[$10>>2]|0;
     if ($301) {
      $307 = (($305) + ($306))|0;
      if ($304) {
       _emit_llb($307);
       break;
      } else {
       _emit_llw($307);
       break;
      }
     } else {
      $308 = HEAP32[$9>>2]|0;
      if ($304) {
       _emit_lab($305,$306,$308);
       break;
      } else {
       _emit_law($305,$306,$308);
       break;
      }
     }
    }
   }
  } while(0);
  while(1) {
   $320 = HEAP32[$5>>2]|0;
   $321 = HEAP32[7]|0;
   $322 = ($320|0)<($321|0);
   if (!($322)) {
    break;
   }
   $323 = (_pop_op()|0);
   $324 = $323&255;
   $325 = (_emit_unaryop($324)|0);
   $326 = ($325|0)!=(0);
   if (!($326)) {
    label = 156;
    break;
   }
  }
  if ((label|0) == 156) {
   _parse_error(3994);
   HEAP32[$1>>2] = 0;
   $335 = HEAP32[$1>>2]|0;
   STACKTOP = sp;return ($335|0);
  }
  $327 = HEAP32[$6>>2]|0;
  $328 = $327 & 768;
  $329 = ($328|0)!=(0);
  if ($329) {
   $330 = HEAP32[$6>>2]|0;
   HEAP32[$9>>2] = $330;
  }
  $331 = HEAP32[$9>>2]|0;
  $332 = ($331|0)!=(0);
  $333 = HEAP32[$9>>2]|0;
  $334 = $332 ? $333 : 2;
  HEAP32[$1>>2] = $334;
  $335 = HEAP32[$1>>2]|0;
  STACKTOP = sp;return ($335|0);
 }
 return (0)|0;
}
function _parse_stmnt() {
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
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
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0;
 var $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0;
 var $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0;
 var $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0;
 var $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $0 = sp + 68|0;
 $1 = sp + 64|0;
 $2 = sp + 60|0;
 $3 = sp + 56|0;
 $4 = sp + 52|0;
 $5 = sp + 48|0;
 $6 = sp + 44|0;
 $7 = sp + 40|0;
 $8 = sp + 36|0;
 $9 = sp + 32|0;
 $10 = sp + 28|0;
 $11 = sp + 24|0;
 $12 = sp + 20|0;
 $13 = sp + 16|0;
 $14 = sp + 12|0;
 $15 = sp + 8|0;
 $16 = sp + 4|0;
 $17 = sp;
 $18 = HEAP8[111813]|0;
 $19 = $18&255;
 $20 = ($19|0)!=(136);
 if ($20) {
  $21 = HEAP8[111813]|0;
  $22 = $21&255;
  $23 = ($22|0)!=(155);
  if ($23) {
   $24 = HEAP8[111813]|0;
   $25 = $24&255;
   $26 = ($25|0)!=(140);
   if ($26) {
    $27 = HEAP8[111813]|0;
    $28 = $27&255;
    $29 = ($28|0)!=(141);
    if ($29) {
     $30 = HEAP8[111813]|0;
     HEAP8[112342] = $30;
    }
   }
  }
 }
 $31 = HEAP8[111813]|0;
 $32 = $31&255;
 L7: do {
  switch ($32|0) {
  case 132:  {
   $33 = (_parse_expr()|0);
   $34 = ($33|0)!=(0);
   if (!($34)) {
    _parse_error(4020);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $35 = (_tag_new(32)|0);
   HEAP32[$3>>2] = $35;
   $36 = (_tag_new(32)|0);
   HEAP32[$4>>2] = $36;
   $37 = HEAP32[$3>>2]|0;
   _emit_brfls($37);
   (_scan()|0);
   while(1) {
    while(1) {
     $38 = (_parse_stmnt()|0);
     $39 = ($38|0)!=(0);
     if (!($39)) {
      break;
     }
     (_next_line()|0);
    }
    $40 = HEAP8[111813]|0;
    $41 = $40&255;
    $42 = ($41|0)!=(133);
    if ($42) {
     break;
    }
    $43 = HEAP32[$4>>2]|0;
    _emit_brnch($43);
    $44 = HEAP32[$3>>2]|0;
    _emit_codetag($44);
    $45 = (_parse_expr()|0);
    $46 = ($45|0)!=(0);
    if (!($46)) {
     label = 15;
     break;
    }
    $47 = (_tag_new(32)|0);
    HEAP32[$3>>2] = $47;
    $48 = HEAP32[$3>>2]|0;
    _emit_brfls($48);
   }
   if ((label|0) == 15) {
    _parse_error(4020);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $49 = HEAP8[111813]|0;
   $50 = $49&255;
   $51 = ($50|0)==(134);
   if ($51) {
    $52 = HEAP32[$4>>2]|0;
    _emit_brnch($52);
    $53 = HEAP32[$3>>2]|0;
    _emit_codetag($53);
    (_scan()|0);
    while(1) {
     $54 = (_parse_stmnt()|0);
     $55 = ($54|0)!=(0);
     if (!($55)) {
      break;
     }
     (_next_line()|0);
    }
    $56 = HEAP32[$4>>2]|0;
    _emit_codetag($56);
   } else {
    $57 = HEAP32[$3>>2]|0;
    _emit_codetag($57);
    $58 = HEAP32[$4>>2]|0;
    _emit_codetag($58);
   }
   $59 = HEAP8[111813]|0;
   $60 = $59&255;
   $61 = ($60|0)!=(135);
   if ($61) {
    _parse_error(4035);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   break;
  }
  case 137:  {
   $62 = (_tag_new(32)|0);
   HEAP32[$5>>2] = $62;
   $63 = (_tag_new(32)|0);
   HEAP32[$6>>2] = $63;
   $64 = HEAP32[9263]|0;
   HEAP32[$2>>2] = $64;
   $65 = HEAP32[$5>>2]|0;
   HEAP32[9263] = $65;
   $66 = HEAP32[9262]|0;
   HEAP32[$1>>2] = $66;
   $67 = HEAP32[$6>>2]|0;
   HEAP32[9262] = $67;
   $68 = HEAP32[$5>>2]|0;
   _emit_codetag($68);
   $69 = (_parse_expr()|0);
   $70 = ($69|0)!=(0);
   if (!($70)) {
    _parse_error(4020);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $71 = HEAP32[$6>>2]|0;
   _emit_brfls($71);
   while(1) {
    $72 = (_parse_stmnt()|0);
    $73 = ($72|0)!=(0);
    if (!($73)) {
     break;
    }
    (_next_line()|0);
   }
   $74 = HEAP8[111813]|0;
   $75 = $74&255;
   $76 = ($75|0)!=(138);
   if (!($76)) {
    $77 = HEAP32[$5>>2]|0;
    _emit_brnch($77);
    $78 = HEAP32[$6>>2]|0;
    _emit_codetag($78);
    $79 = HEAP32[$1>>2]|0;
    HEAP32[9262] = $79;
    $80 = HEAP32[$2>>2]|0;
    HEAP32[9263] = $80;
    break L7;
   }
   _parse_error(4050);
   HEAP32[$0>>2] = 0;
   $347 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($347|0);
   break;
  }
  case 148:  {
   $81 = HEAP32[9262]|0;
   HEAP32[$1>>2] = $81;
   $82 = (_tag_new(32)|0);
   HEAP32[9262] = $82;
   $83 = (_tag_new(32)|0);
   HEAP32[$7>>2] = $83;
   $84 = HEAP32[9263]|0;
   HEAP32[$2>>2] = $84;
   $85 = (_tag_new(32)|0);
   HEAP32[9263] = $85;
   $86 = HEAP32[$7>>2]|0;
   _emit_codetag($86);
   (_scan()|0);
   while(1) {
    $87 = (_parse_stmnt()|0);
    $88 = ($87|0)!=(0);
    if (!($88)) {
     break;
    }
    (_next_line()|0);
   }
   $89 = HEAP8[111813]|0;
   $90 = $89&255;
   $91 = ($90|0)!=(149);
   if ($91) {
    _parse_error(4068);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $92 = HEAP32[9263]|0;
   _emit_codetag($92);
   $93 = HEAP32[$2>>2]|0;
   HEAP32[9263] = $93;
   $94 = (_parse_expr()|0);
   $95 = ($94|0)!=(0);
   if ($95) {
    $96 = HEAP32[$7>>2]|0;
    _emit_brfls($96);
    $97 = HEAP32[9262]|0;
    _emit_codetag($97);
    $98 = HEAP32[$1>>2]|0;
    HEAP32[9262] = $98;
    break L7;
   }
   _parse_error(4020);
   HEAP32[$0>>2] = 0;
   $347 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($347|0);
   break;
  }
  case 143:  {
   $99 = HEAP32[9264]|0;
   $100 = (($99) + 1)|0;
   HEAP32[9264] = $100;
   $101 = HEAP32[9262]|0;
   HEAP32[$1>>2] = $101;
   $102 = (_tag_new(32)|0);
   HEAP32[9262] = $102;
   $103 = (_tag_new(32)|0);
   HEAP32[$8>>2] = $103;
   $104 = HEAP32[9263]|0;
   HEAP32[$2>>2] = $104;
   $105 = HEAP32[$8>>2]|0;
   HEAP32[9263] = $105;
   $106 = (_scan()|0);
   $107 = $106&255;
   $108 = ($107|0)!=(214);
   if ($108) {
    _parse_error(4089);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $109 = HEAP32[9255]|0;
   $110 = HEAP32[9256]|0;
   $111 = (_id_type($109,$110)|0);
   HEAP32[$11>>2] = $111;
   $112 = HEAP32[9255]|0;
   $113 = HEAP32[9256]|0;
   $114 = (_id_tag($112,$113)|0);
   HEAP32[$12>>2] = $114;
   $115 = (_scan()|0);
   $116 = $115&255;
   $117 = ($116|0)!=(189);
   if ($117) {
    _parse_error(4110);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $118 = (_parse_expr()|0);
   $119 = ($118|0)!=(0);
   if (!($119)) {
    _parse_error(4124);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $120 = HEAP32[$8>>2]|0;
   _emit_codetag($120);
   $121 = HEAP32[$11>>2]|0;
   $122 = $121 & 64;
   $123 = ($122|0)!=(0);
   $124 = HEAP32[$11>>2]|0;
   $125 = $124 & 4;
   $126 = ($125|0)!=(0);
   $127 = HEAP32[$12>>2]|0;
   do {
    if ($123) {
     if ($126) {
      _emit_dlb($127);
      break;
     } else {
      _emit_dlw($127);
      break;
     }
    } else {
     $128 = HEAP32[$11>>2]|0;
     if ($126) {
      _emit_dab($127,$128);
      break;
     } else {
      _emit_daw($127,$128);
      break;
     }
    }
   } while(0);
   $129 = HEAP8[111813]|0;
   $130 = $129&255;
   $131 = ($130|0)==(144);
   do {
    if ($131) {
     HEAP32[$13>>2] = 1;
    } else {
     $132 = HEAP8[111813]|0;
     $133 = $132&255;
     $134 = ($133|0)==(145);
     if ($134) {
      HEAP32[$13>>2] = -1;
      break;
     }
     _parse_error(4143);
     HEAP32[$0>>2] = 0;
     $347 = HEAP32[$0>>2]|0;
     STACKTOP = sp;return ($347|0);
    }
   } while(0);
   $135 = (_parse_expr()|0);
   $136 = ($135|0)!=(0);
   if (!($136)) {
    _parse_error(4158);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $137 = HEAP32[$13>>2]|0;
   $138 = ($137|0)>(0);
   $139 = HEAP32[9262]|0;
   if ($138) {
    _emit_brgt($139);
   } else {
    _emit_brlt($139);
   }
   $140 = HEAP8[111813]|0;
   $141 = $140&255;
   $142 = ($141|0)==(146);
   do {
    if ($142) {
     $143 = (_parse_expr()|0);
     $144 = ($143|0)!=(0);
     if ($144) {
      $145 = HEAP32[$13>>2]|0;
      $146 = ($145|0)>(0);
      $147 = $146 ? 171 : 173;
      $148 = $147&255;
      (_emit_op($148)|0);
      break;
     }
     _parse_error(4180);
     HEAP32[$0>>2] = 0;
     $347 = HEAP32[$0>>2]|0;
     STACKTOP = sp;return ($347|0);
    } else {
     $149 = HEAP32[$13>>2]|0;
     $150 = ($149|0)>(0);
     $151 = $150 ? 208 : 203;
     (_emit_unaryop($151)|0);
    }
   } while(0);
   while(1) {
    $152 = (_parse_stmnt()|0);
    $153 = ($152|0)!=(0);
    if (!($153)) {
     break;
    }
    (_next_line()|0);
   }
   $154 = HEAP8[111813]|0;
   $155 = $154&255;
   $156 = ($155|0)!=(147);
   if (!($156)) {
    $157 = HEAP32[$8>>2]|0;
    _emit_brnch($157);
    $158 = HEAP32[$2>>2]|0;
    HEAP32[9263] = $158;
    $159 = HEAP32[9262]|0;
    _emit_codetag($159);
    _emit_drop();
    $160 = HEAP32[$1>>2]|0;
    HEAP32[9262] = $160;
    $161 = HEAP32[9264]|0;
    $162 = (($161) + -1)|0;
    HEAP32[9264] = $162;
    break L7;
   }
   _parse_error(4204);
   HEAP32[$0>>2] = 0;
   $347 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($347|0);
   break;
  }
  case 139:  {
   $163 = HEAP32[9264]|0;
   $164 = (($163) + 1)|0;
   HEAP32[9264] = $164;
   $165 = HEAP32[9262]|0;
   HEAP32[$1>>2] = $165;
   $166 = (_tag_new(32)|0);
   HEAP32[9262] = $166;
   $167 = (_tag_new(32)|0);
   HEAP32[$9>>2] = $167;
   $168 = (_tag_new(32)|0);
   HEAP32[$10>>2] = $168;
   $169 = (_parse_expr()|0);
   $170 = ($169|0)!=(0);
   if (!($170)) {
    _parse_error(4222);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   (_next_line()|0);
   while(1) {
    $171 = HEAP8[111813]|0;
    $172 = $171&255;
    $173 = ($172|0)!=(142);
    if (!($173)) {
     label = 96;
     break;
    }
    $174 = HEAP8[111813]|0;
    $175 = $174&255;
    $176 = ($175|0)==(140);
    if ($176) {
     $177 = (_parse_expr()|0);
     $178 = ($177|0)!=(0);
     if (!($178)) {
      label = 80;
      break;
     }
     $179 = HEAP32[$9>>2]|0;
     _emit_brne($179);
     $180 = HEAP32[$10>>2]|0;
     _emit_codetag($180);
     while(1) {
      $181 = (_parse_stmnt()|0);
      $182 = ($181|0)!=(0);
      if (!($182)) {
       break;
      }
      (_next_line()|0);
     }
     $183 = (_tag_new(32)|0);
     HEAP32[$10>>2] = $183;
     $184 = HEAP8[112342]|0;
     $185 = $184&255;
     $186 = ($185|0)!=(157);
     if ($186) {
      $187 = HEAP32[$10>>2]|0;
      _emit_brnch($187);
     }
     $188 = HEAP32[$9>>2]|0;
     _emit_codetag($188);
     $189 = (_tag_new(32)|0);
     HEAP32[$9>>2] = $189;
     continue;
    } else {
     $190 = HEAP8[111813]|0;
     $191 = $190&255;
     $192 = ($191|0)==(141);
     if (!($192)) {
      $199 = HEAP8[111813]|0;
      $200 = $199&255;
      $201 = ($200|0)==(128);
      if (!($201)) {
       label = 95;
       break;
      }
      (_next_line()|0);
      continue;
     }
     $193 = HEAP32[$10>>2]|0;
     _emit_codetag($193);
     HEAP32[$10>>2] = 0;
     (_scan()|0);
     while(1) {
      $194 = (_parse_stmnt()|0);
      $195 = ($194|0)!=(0);
      if (!($195)) {
       break;
      }
      (_next_line()|0);
     }
     $196 = HEAP8[111813]|0;
     $197 = $196&255;
     $198 = ($197|0)!=(142);
     if ($198) {
      label = 92;
      break;
     } else {
      continue;
     }
    }
   }
   if ((label|0) == 80) {
    _parse_error(4242);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   else if ((label|0) == 92) {
    _parse_error(4265);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   else if ((label|0) == 95) {
    _parse_error(4289);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   else if ((label|0) == 96) {
    $202 = HEAP32[$10>>2]|0;
    $203 = ($202|0)!=(0);
    if ($203) {
     $204 = HEAP32[$10>>2]|0;
     _emit_codetag($204);
    }
    $205 = HEAP32[9262]|0;
    _emit_codetag($205);
    _emit_drop();
    $206 = HEAP32[$1>>2]|0;
    HEAP32[9262] = $206;
    $207 = HEAP32[9264]|0;
    $208 = (($207) + -1)|0;
    HEAP32[9264] = $208;
    break L7;
   }
   break;
  }
  case 160:  {
   $209 = HEAP32[9263]|0;
   $210 = ($209|0)!=(0);
   if ($210) {
    $211 = HEAP32[9263]|0;
    _emit_brnch($211);
    break L7;
   }
   _parse_error(4305);
   HEAP32[$0>>2] = 0;
   $347 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($347|0);
   break;
  }
  case 157:  {
   $212 = HEAP32[9262]|0;
   $213 = ($212|0)!=(0);
   if ($213) {
    $214 = HEAP32[9262]|0;
    _emit_brnch($214);
    break L7;
   }
   _parse_error(4327);
   HEAP32[$0>>2] = 0;
   $347 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($347|0);
   break;
  }
  case 156:  {
   $215 = HEAP32[9261]|0;
   $216 = ($215|0)!=(0);
   if (!($216)) {
    $224 = (_parse_expr()|0);
    $225 = ($224|0)!=(0);
    if (!($225)) {
     _emit_const(0);
    }
    _emit_ret();
    break L7;
   }
   HEAP32[$15>>2] = 0;
   while(1) {
    $217 = HEAP32[$15>>2]|0;
    $218 = HEAP32[9264]|0;
    $219 = ($217|0)<($218|0);
    if (!($219)) {
     break;
    }
    _emit_drop();
    $220 = HEAP32[$15>>2]|0;
    $221 = (($220) + 1)|0;
    HEAP32[$15>>2] = $221;
   }
   $222 = (_parse_expr()|0);
   $223 = ($222|0)!=(0);
   if (!($223)) {
    _emit_const(0);
   }
   _emit_leave();
   break;
  }
  case 187: case 128:  {
   HEAP32[$0>>2] = 1;
   $347 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($347|0);
   break;
  }
  case 151: case 155: case 136: case 142: case 141: case 140: case 147: case 149: case 138: case 135: case 133: case 134:  {
   HEAP32[$0>>2] = 0;
   $347 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($347|0);
   break;
  }
  case 214:  {
   $226 = HEAP32[9255]|0;
   HEAP32[$14>>2] = $226;
   $227 = HEAP32[9255]|0;
   $228 = HEAP32[9256]|0;
   $229 = (_id_type($227,$228)|0);
   HEAP32[$11>>2] = $229;
   $230 = HEAP32[9255]|0;
   $231 = HEAP32[9256]|0;
   $232 = (_id_tag($230,$231)|0);
   HEAP32[$12>>2] = $232;
   $233 = HEAP32[$11>>2]|0;
   $234 = $233 & 6;
   $235 = ($234|0)!=(0);
   $236 = HEAP32[$11>>2]|0;
   do {
    if ($235) {
     HEAP32[$16>>2] = $236;
     HEAP32[$17>>2] = 0;
     $237 = (_scan()|0);
     $238 = $237&255;
     $239 = ($238|0)==(174);
     if ($239) {
      label = 120;
     } else {
      $240 = HEAP8[111813]|0;
      $241 = $240&255;
      $242 = ($241|0)==(186);
      if ($242) {
       label = 120;
      }
     }
     do {
      if ((label|0) == 120) {
       $243 = HEAP8[111813]|0;
       $244 = $243&255;
       $245 = ($244|0)==(174);
       $246 = $245 ? 4 : 2;
       HEAP32[$16>>2] = $246;
       $247 = (_parse_const($17)|0);
       $248 = ($247|0)!=(0);
       if ($248) {
        (_scan()|0);
        break;
       } else {
        HEAP8[111813] = -42;
        break;
       }
      }
     } while(0);
     $249 = HEAP8[111813]|0;
     $250 = $249&255;
     $251 = ($250|0)==(189);
     if (!($251)) {
      $264 = HEAP8[111813]|0;
      $265 = $264&255;
      $266 = ($265|0)==(208);
      if (!($266)) {
       $267 = HEAP8[111813]|0;
       $268 = $267&255;
       $269 = ($268|0)==(203);
       if (!($269)) {
        break;
       }
      }
      $270 = HEAP32[$11>>2]|0;
      $271 = $270 & 64;
      $272 = ($271|0)!=(0);
      $273 = HEAP32[$16>>2]|0;
      $274 = $273 & 4;
      $275 = ($274|0)!=(0);
      $276 = HEAP32[$12>>2]|0;
      $277 = HEAP32[$17>>2]|0;
      if ($272) {
       $278 = (($276) + ($277))|0;
       if ($275) {
        _emit_llb($278);
        $279 = HEAP8[111813]|0;
        $280 = $279&255;
        (_emit_unaryop($280)|0);
        $281 = HEAP32[$12>>2]|0;
        $282 = HEAP32[$17>>2]|0;
        $283 = (($281) + ($282))|0;
        _emit_slb($283);
        break L7;
       } else {
        _emit_llw($278);
        $284 = HEAP8[111813]|0;
        $285 = $284&255;
        (_emit_unaryop($285)|0);
        $286 = HEAP32[$12>>2]|0;
        $287 = HEAP32[$17>>2]|0;
        $288 = (($286) + ($287))|0;
        _emit_slw($288);
        break L7;
       }
      } else {
       $289 = HEAP32[$11>>2]|0;
       if ($275) {
        _emit_lab($276,$277,$289);
        $290 = HEAP8[111813]|0;
        $291 = $290&255;
        (_emit_unaryop($291)|0);
        $292 = HEAP32[$12>>2]|0;
        $293 = HEAP32[$17>>2]|0;
        $294 = HEAP32[$11>>2]|0;
        _emit_sab($292,$293,$294);
        break L7;
       } else {
        _emit_law($276,$277,$289);
        $295 = HEAP8[111813]|0;
        $296 = $295&255;
        (_emit_unaryop($296)|0);
        $297 = HEAP32[$12>>2]|0;
        $298 = HEAP32[$17>>2]|0;
        $299 = HEAP32[$11>>2]|0;
        _emit_saw($297,$298,$299);
        break L7;
       }
      }
     }
     $252 = (_parse_expr()|0);
     $253 = ($252|0)!=(0);
     if (!($253)) {
      _parse_error(4020);
      HEAP32[$0>>2] = 0;
      $347 = HEAP32[$0>>2]|0;
      STACKTOP = sp;return ($347|0);
     }
     $254 = HEAP32[$11>>2]|0;
     $255 = $254 & 64;
     $256 = ($255|0)!=(0);
     $257 = HEAP32[$16>>2]|0;
     $258 = $257 & 4;
     $259 = ($258|0)!=(0);
     $260 = HEAP32[$12>>2]|0;
     $261 = HEAP32[$17>>2]|0;
     if ($256) {
      $262 = (($260) + ($261))|0;
      if ($259) {
       _emit_slb($262);
       break L7;
      } else {
       _emit_slw($262);
       break L7;
      }
     } else {
      $263 = HEAP32[$11>>2]|0;
      if ($259) {
       _emit_sab($260,$261,$263);
       break L7;
      } else {
       _emit_saw($260,$261,$263);
       break L7;
      }
     }
    } else {
     $300 = $236 & 8216;
     $301 = ($300|0)!=(0);
     if ($301) {
      $302 = (_scan()|0);
      $303 = $302&255;
      $304 = ($303|0)==(128);
      if ($304) {
       $305 = HEAP32[$12>>2]|0;
       $306 = HEAP32[$11>>2]|0;
       _emit_call($305,$306);
       _emit_drop();
       break L7;
      }
     }
    }
   } while(0);
   $307 = HEAP32[$14>>2]|0;
   HEAP32[9255] = $307;
   label = 146;
   break;
  }
  default: {
   label = 146;
  }
  }
 } while(0);
 do {
  if ((label|0) == 146) {
   $308 = HEAP32[9255]|0;
   _scan_rewind($308);
   $309 = (_parse_value(0)|0);
   HEAP32[$11>>2] = $309;
   $310 = ($309|0)!=(0);
   if (!($310)) {
    _parse_error(4346);
    HEAP32[$0>>2] = 0;
    $347 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($347|0);
   }
   $311 = HEAP8[111813]|0;
   $312 = $311&255;
   $313 = ($312|0)==(189);
   if ($313) {
    $314 = (_parse_expr()|0);
    $315 = ($314|0)!=(0);
    if (!($315)) {
     _parse_error(4020);
     HEAP32[$0>>2] = 0;
     $347 = HEAP32[$0>>2]|0;
     STACKTOP = sp;return ($347|0);
    }
    $316 = HEAP32[$11>>2]|0;
    $317 = $316 & 64;
    $318 = ($317|0)!=(0);
    $319 = HEAP32[$11>>2]|0;
    $320 = $319 & 516;
    $321 = ($320|0)!=(0);
    if ($318) {
     if ($321) {
      _emit_sb();
      break;
     } else {
      _emit_sw();
      break;
     }
    } else {
     if ($321) {
      _emit_sb();
      break;
     } else {
      _emit_sw();
      break;
     }
    }
   } else {
    $322 = HEAP8[111813]|0;
    $323 = $322&255;
    $324 = ($323|0)==(208);
    if (!($324)) {
     $325 = HEAP8[111813]|0;
     $326 = $325&255;
     $327 = ($326|0)==(203);
     if (!($327)) {
      $335 = HEAP32[$11>>2]|0;
      $336 = $335 & 512;
      $337 = ($336|0)!=(0);
      if ($337) {
       _emit_lb();
      } else {
       $338 = HEAP32[$11>>2]|0;
       $339 = $338 & 256;
       $340 = ($339|0)!=(0);
       if ($340) {
        _emit_lw();
       }
      }
      _emit_drop();
      break;
     }
    }
    $328 = HEAP32[$11>>2]|0;
    $329 = $328 & 516;
    $330 = ($329|0)!=(0);
    _emit_dup();
    if ($330) {
     _emit_lb();
     $331 = HEAP8[111813]|0;
     $332 = $331&255;
     (_emit_unaryop($332)|0);
     _emit_sb();
     break;
    } else {
     _emit_lw();
     $333 = HEAP8[111813]|0;
     $334 = $333&255;
     (_emit_unaryop($334)|0);
     _emit_sw();
     break;
    }
   }
  }
 } while(0);
 $341 = (_scan()|0);
 $342 = $341&255;
 $343 = ($342|0)!=(128);
 if ($343) {
  $344 = HEAP8[111813]|0;
  $345 = $344&255;
  $346 = ($345|0)!=(187);
  if ($346) {
   _parse_error(4359);
   HEAP32[$0>>2] = 0;
   $347 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($347|0);
  }
 }
 HEAP32[$0>>2] = 1;
 $347 = HEAP32[$0>>2]|0;
 STACKTOP = sp;return ($347|0);
}
function _parse_var($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $1 = sp + 32|0;
 $2 = sp + 28|0;
 $3 = sp + 24|0;
 $4 = sp + 20|0;
 $5 = sp + 16|0;
 $6 = sp + 12|0;
 $7 = sp + 8|0;
 $8 = sp + 4|0;
 $9 = sp;
 HEAP32[$2>>2] = $0;
 HEAP32[$8>>2] = 0;
 HEAP32[$9>>2] = 1;
 $10 = (_scan()|0);
 $11 = $10&255;
 $12 = ($11|0)==(219);
 do {
  if ($12) {
   HEAP32[$9>>2] = 0;
   (_parse_constexpr($9,$6)|0);
   $13 = HEAP8[111813]|0;
   $14 = $13&255;
   $15 = ($14|0)!=(221);
   if (!($15)) {
    (_scan()|0);
    break;
   }
   _parse_error(3970);
   HEAP32[$1>>2] = 0;
   $73 = HEAP32[$1>>2]|0;
   STACKTOP = sp;return ($73|0);
  }
 } while(0);
 $16 = HEAP8[111813]|0;
 $17 = $16&255;
 $18 = ($17|0)==(214);
 do {
  if ($18) {
   $19 = HEAP32[9255]|0;
   HEAP32[$3>>2] = $19;
   $20 = HEAP32[9256]|0;
   HEAP32[$8>>2] = $20;
   $21 = (_scan()|0);
   $22 = $21&255;
   $23 = ($22|0)==(219);
   if ($23) {
    HEAP32[$9>>2] = 0;
    (_parse_constexpr($9,$6)|0);
    $24 = HEAP8[111813]|0;
    $25 = $24&255;
    $26 = ($25|0)!=(221);
    if (!($26)) {
     (_scan()|0);
     break;
    }
    _parse_error(3970);
    HEAP32[$1>>2] = 0;
    $73 = HEAP32[$1>>2]|0;
    STACKTOP = sp;return ($73|0);
   }
  }
 } while(0);
 $27 = HEAP32[$2>>2]|0;
 $28 = $27 & 2;
 $29 = ($28|0)!=(0);
 if ($29) {
  $30 = HEAP32[$9>>2]|0;
  $31 = $30<<1;
  HEAP32[$9>>2] = $31;
 }
 $32 = HEAP8[111813]|0;
 $33 = $32&255;
 $34 = ($33|0)==(189);
 do {
  if ($34) {
   $35 = HEAP32[$2>>2]|0;
   $36 = $35 & 192;
   $37 = ($36|0)!=(0);
   if ($37) {
    _parse_error(4381);
    HEAP32[$1>>2] = 0;
    $73 = HEAP32[$1>>2]|0;
    STACKTOP = sp;return ($73|0);
   }
   $38 = HEAP32[$8>>2]|0;
   $39 = ($38|0)!=(0);
   if ($39) {
    $40 = HEAP32[$3>>2]|0;
    $41 = HEAP32[$8>>2]|0;
    $42 = HEAP32[$2>>2]|0;
    (_idglobal_add($40,$41,$42,0)|0);
   }
   $43 = (_parse_constexpr($4,$6)|0);
   HEAP32[$5>>2] = $43;
   $44 = ($43|0)!=(0);
   if (!($44)) {
    _parse_error(4447);
    HEAP32[$1>>2] = 0;
    $73 = HEAP32[$1>>2]|0;
    STACKTOP = sp;return ($73|0);
   }
   $45 = HEAP32[$2>>2]|0;
   $46 = HEAP32[$5>>2]|0;
   $47 = HEAP32[$4>>2]|0;
   $48 = HEAP32[$6>>2]|0;
   $49 = (_emit_data($45,$46,$47,$48)|0);
   HEAP32[$7>>2] = $49;
   while(1) {
    $50 = HEAP8[111813]|0;
    $51 = $50&255;
    $52 = ($51|0)==(172);
    if (!($52)) {
     label = 23;
     break;
    }
    $53 = (_parse_constexpr($4,$6)|0);
    HEAP32[$5>>2] = $53;
    $54 = ($53|0)!=(0);
    if (!($54)) {
     label = 22;
     break;
    }
    $55 = HEAP32[$2>>2]|0;
    $56 = HEAP32[$5>>2]|0;
    $57 = HEAP32[$4>>2]|0;
    $58 = HEAP32[$6>>2]|0;
    $59 = (_emit_data($55,$56,$57,$58)|0);
    $60 = HEAP32[$7>>2]|0;
    $61 = (($60) + ($59))|0;
    HEAP32[$7>>2] = $61;
   }
   if ((label|0) == 22) {
    _parse_error(4425);
    HEAP32[$1>>2] = 0;
    $73 = HEAP32[$1>>2]|0;
    STACKTOP = sp;return ($73|0);
   }
   else if ((label|0) == 23) {
    $62 = HEAP32[$9>>2]|0;
    $63 = HEAP32[$7>>2]|0;
    $64 = ($62|0)>($63|0);
    if (!($64)) {
     break;
    }
    $65 = HEAP32[$9>>2]|0;
    $66 = HEAP32[$7>>2]|0;
    _idglobal_size(768,$65,$66);
    break;
   }
  } else {
   $67 = HEAP32[$8>>2]|0;
   $68 = ($67|0)!=(0);
   if ($68) {
    $69 = HEAP32[$3>>2]|0;
    $70 = HEAP32[$8>>2]|0;
    $71 = HEAP32[$2>>2]|0;
    $72 = HEAP32[$9>>2]|0;
    (_id_add($69,$70,$71,$72)|0);
   }
  }
 } while(0);
 HEAP32[$1>>2] = 1;
 $73 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($73|0);
}
function _parse_struc() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0;
 $0 = sp + 28|0;
 $1 = sp + 24|0;
 $2 = sp + 20|0;
 $3 = sp + 16|0;
 $4 = sp + 12|0;
 $5 = sp + 8|0;
 $6 = sp + 32|0;
 $7 = sp + 4|0;
 $8 = sp;
 HEAP32[$4>>2] = 0;
 HEAP32[$7>>2] = 0;
 HEAP32[$8>>2] = 0;
 $9 = (_scan()|0);
 $10 = $9&255;
 $11 = ($10|0)==(214);
 L1: do {
  if ($11) {
   $12 = HEAP32[9256]|0;
   HEAP32[$8>>2] = $12;
   HEAP32[$7>>2] = 0;
   while(1) {
    $13 = HEAP32[$7>>2]|0;
    $14 = HEAP32[$8>>2]|0;
    $15 = ($13|0)<($14|0);
    if (!($15)) {
     break L1;
    }
    $16 = HEAP32[$7>>2]|0;
    $17 = HEAP32[9255]|0;
    $18 = (($17) + ($16)|0);
    $19 = HEAP8[$18>>0]|0;
    $20 = HEAP32[$7>>2]|0;
    $21 = (($6) + ($20)|0);
    HEAP8[$21>>0] = $19;
    $22 = HEAP32[$7>>2]|0;
    $23 = (($22) + 1)|0;
    HEAP32[$7>>2] = $23;
   }
  }
 } while(0);
 L6: while(1) {
  $24 = (_next_line()|0);
  $25 = ($24|0)==(130);
  if (!($25)) {
   $26 = HEAP8[111813]|0;
   $27 = $26&255;
   $28 = ($27|0)==(131);
   if (!($28)) {
    $29 = HEAP8[111813]|0;
    $30 = $29&255;
    $31 = ($30|0)==(128);
    if (!($31)) {
     label = 26;
     break;
    }
   }
  }
  $32 = HEAP8[111813]|0;
  $33 = $32&255;
  $34 = ($33|0)==(128);
  if ($34) {
   continue;
  }
  HEAP32[$1>>2] = 1;
  $35 = HEAP8[111813]|0;
  $36 = $35&255;
  $37 = ($36|0)==(130);
  $38 = $37 ? 4 : 2;
  HEAP32[$2>>2] = $38;
  $39 = (_scan()|0);
  $40 = $39&255;
  $41 = ($40|0)==(219);
  if ($41) {
   HEAP32[$1>>2] = 0;
   (_parse_constexpr($1,$3)|0);
   $42 = HEAP8[111813]|0;
   $43 = $42&255;
   $44 = ($43|0)!=(221);
   if ($44) {
    label = 11;
    break;
   }
   (_scan()|0);
  }
  while(1) {
   HEAP32[$7>>2] = 0;
   $45 = HEAP8[111813]|0;
   $46 = $45&255;
   $47 = ($46|0)==(214);
   if ($47) {
    $48 = HEAP32[9255]|0;
    HEAP32[$5>>2] = $48;
    $49 = HEAP32[9256]|0;
    HEAP32[$7>>2] = $49;
    $50 = (_scan()|0);
    $51 = $50&255;
    $52 = ($51|0)==(219);
    if ($52) {
     HEAP32[$1>>2] = 0;
     (_parse_constexpr($1,$3)|0);
     $53 = HEAP8[111813]|0;
     $54 = $53&255;
     $55 = ($54|0)!=(221);
     if ($55) {
      label = 16;
      break L6;
     }
     (_scan()|0);
    }
   }
   $56 = HEAP32[$2>>2]|0;
   $57 = $56 & 2;
   $58 = ($57|0)!=(0);
   if ($58) {
    $59 = HEAP32[$1>>2]|0;
    $60 = $59<<1;
    HEAP32[$1>>2] = $60;
   }
   $61 = HEAP32[$7>>2]|0;
   $62 = ($61|0)!=(0);
   if ($62) {
    $63 = HEAP32[$5>>2]|0;
    $64 = HEAP32[$7>>2]|0;
    $65 = HEAP32[$4>>2]|0;
    (_idconst_add($63,$64,$65)|0);
   }
   $66 = HEAP32[$1>>2]|0;
   $67 = HEAP32[$4>>2]|0;
   $68 = (($67) + ($66))|0;
   HEAP32[$4>>2] = $68;
   $69 = HEAP8[111813]|0;
   $70 = $69&255;
   $71 = ($70|0)==(172);
   if (!($71)) {
    break;
   }
  }
  $72 = HEAP8[111813]|0;
  $73 = $72&255;
  $74 = ($73|0)!=(128);
  if (!($74)) {
   continue;
  }
  $75 = HEAP8[111813]|0;
  $76 = $75&255;
  $77 = ($76|0)!=(187);
  if ($77) {
   label = 25;
   break;
  }
 }
 if ((label|0) == 11) {
  _parse_error(3970);
  HEAP32[$0>>2] = 0;
  $86 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($86|0);
 }
 else if ((label|0) == 16) {
  _parse_error(3970);
  HEAP32[$0>>2] = 0;
  $86 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($86|0);
 }
 else if ((label|0) == 25) {
  HEAP32[$0>>2] = 0;
  $86 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($86|0);
 }
 else if ((label|0) == 26) {
  $78 = HEAP32[$8>>2]|0;
  $79 = ($78|0)!=(0);
  if ($79) {
   $80 = HEAP32[$8>>2]|0;
   $81 = HEAP32[$4>>2]|0;
   (_idconst_add($6,$80,$81)|0);
  }
  $82 = HEAP8[111813]|0;
  $83 = $82&255;
  $84 = ($83|0)==(136);
  $85 = $84&1;
  HEAP32[$0>>2] = $85;
  $86 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($86|0);
 }
 return (0)|0;
}
function _parse_vars($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $1 = sp + 20|0;
 $2 = sp + 16|0;
 $3 = sp + 12|0;
 $4 = sp + 8|0;
 $5 = sp + 4|0;
 $6 = sp;
 HEAP32[$2>>2] = $0;
 $7 = HEAP8[111813]|0;
 $8 = $7&255;
 L1: do {
  switch ($8|0) {
  case 158:  {
   $9 = HEAP32[$2>>2]|0;
   $10 = $9 & 192;
   $11 = ($10|0)!=(0);
   if ($11) {
    _parse_error(4472);
    HEAP32[$1>>2] = 0;
    break L1;
   }
   $12 = (_parse_constexpr($3,$5)|0);
   $13 = ($12|0)!=(0);
   if ($13) {
    $14 = HEAP32[$3>>2]|0;
    _emit_sysflags($14);
    label = 35;
    break L1;
   } else {
    _parse_error(4496);
    HEAP32[$1>>2] = 0;
    break L1;
   }
   break;
  }
  case 129:  {
   $15 = (_scan()|0);
   $16 = $15&255;
   $17 = ($16|0)!=(214);
   if ($17) {
    _parse_error(4509);
    HEAP32[$1>>2] = 0;
    break L1;
   }
   $18 = HEAP32[9255]|0;
   HEAP32[$6>>2] = $18;
   $19 = HEAP32[9256]|0;
   HEAP32[$4>>2] = $19;
   $20 = (_scan()|0);
   $21 = $20&255;
   $22 = ($21|0)!=(189);
   if ($22) {
    _parse_error(4526);
    HEAP32[$1>>2] = 0;
    break L1;
   }
   $23 = (_parse_constexpr($3,$5)|0);
   $24 = ($23|0)!=(0);
   if ($24) {
    $25 = HEAP32[$6>>2]|0;
    $26 = HEAP32[$4>>2]|0;
    $27 = HEAP32[$3>>2]|0;
    (_idconst_add($25,$26,$27)|0);
    label = 35;
    break L1;
   } else {
    _parse_error(4496);
    HEAP32[$1>>2] = 0;
    break L1;
   }
   break;
  }
  case 159:  {
   $28 = (_parse_struc()|0);
   $29 = ($28|0)!=(0);
   if ($29) {
    label = 35;
   } else {
    _parse_error(4537);
    HEAP32[$1>>2] = 0;
   }
   break;
  }
  case 154:  {
   $30 = HEAP32[$2>>2]|0;
   $31 = $30 & 192;
   $32 = ($31|0)!=(0);
   if ($32) {
    _parse_error(4562);
    HEAP32[$1>>2] = 0;
    break L1;
   }
   HEAP32[$2>>2] = 4096;
   $33 = HEAP32[9255]|0;
   HEAP32[$6>>2] = $33;
   $34 = (_scan()|0);
   $35 = $34&255;
   $36 = ($35|0)!=(130);
   if ($36) {
    $37 = HEAP8[111813]|0;
    $38 = $37&255;
    $39 = ($38|0)!=(131);
    if ($39) {
     $40 = HEAP32[$6>>2]|0;
     _scan_rewind($40);
     (_scan()|0);
     HEAP32[$1>>2] = 0;
    } else {
     label = 21;
    }
   } else {
    label = 21;
   }
   break;
  }
  case 131: case 130:  {
   label = 21;
   break;
  }
  case 150:  {
   $56 = (_scan()|0);
   $57 = $56&255;
   $58 = ($57|0)==(214);
   if (!($58)) {
    _parse_error(4601);
    HEAP32[$1>>2] = 0;
    break L1;
   }
   $59 = HEAP32[$2>>2]|0;
   $60 = $59 | 8192;
   HEAP32[$2>>2] = $60;
   $61 = HEAP32[9255]|0;
   HEAP32[$6>>2] = $61;
   $62 = HEAP32[9256]|0;
   HEAP32[$4>>2] = $62;
   $63 = HEAP32[9255]|0;
   $64 = HEAP32[9256]|0;
   $65 = HEAP32[$2>>2]|0;
   $66 = HEAP32[$2>>2]|0;
   $67 = (_tag_new($66)|0);
   (_idfunc_add($63,$64,$65,$67)|0);
   while(1) {
    $68 = (_scan()|0);
    $69 = $68&255;
    $70 = ($69|0)==(172);
    if (!($70)) {
     label = 33;
     break L1;
    }
    $71 = (_scan()|0);
    $72 = $71&255;
    $73 = ($72|0)==(214);
    if (!($73)) {
     break;
    }
    $74 = HEAP32[9255]|0;
    HEAP32[$6>>2] = $74;
    $75 = HEAP32[9256]|0;
    HEAP32[$4>>2] = $75;
    $76 = HEAP32[9255]|0;
    $77 = HEAP32[9256]|0;
    $78 = HEAP32[$2>>2]|0;
    $79 = HEAP32[$2>>2]|0;
    $80 = (_tag_new($79)|0);
    (_idfunc_add($76,$77,$78,$80)|0);
   }
   _parse_error(4601);
   HEAP32[$1>>2] = 0;
   break;
  }
  case 187: case 128:  {
   label = 33;
   break;
  }
  default: {
   HEAP32[$1>>2] = 0;
  }
  }
 } while(0);
 L37: do {
  if ((label|0) == 21) {
   $41 = HEAP8[111813]|0;
   $42 = $41&255;
   $43 = ($42|0)==(130);
   $44 = $43 ? 4 : 2;
   $45 = HEAP32[$2>>2]|0;
   $46 = $45 | $44;
   HEAP32[$2>>2] = $46;
   $47 = HEAP32[$2>>2]|0;
   $48 = (_parse_var($47)|0);
   $49 = ($48|0)!=(0);
   if (!($49)) {
    HEAP32[$1>>2] = 0;
    break;
   }
   while(1) {
    $50 = HEAP8[111813]|0;
    $51 = $50&255;
    $52 = ($51|0)==(172);
    if (!($52)) {
     label = 35;
     break L37;
    }
    $53 = HEAP32[$2>>2]|0;
    $54 = (_parse_var($53)|0);
    $55 = ($54|0)!=(0);
    if (!($55)) {
     break;
    }
   }
   HEAP32[$1>>2] = 0;
  }
  else if ((label|0) == 33) {
   HEAP32[$1>>2] = 1;
  }
 } while(0);
 if ((label|0) == 35) {
  HEAP32[$1>>2] = 1;
 }
 $81 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($81|0);
}
function _parse_mods() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 $1 = HEAP8[111813]|0;
 $2 = $1&255;
 $3 = ($2|0)==(153);
 do {
  if ($3) {
   $4 = (_scan()|0);
   $5 = $4&255;
   $6 = ($5|0)!=(214);
   if ($6) {
    _parse_error(4630);
    HEAP32[$0>>2] = 0;
    break;
   }
   $7 = HEAP32[9255]|0;
   $8 = HEAP32[9256]|0;
   _emit_moddep($7,$8);
   (_scan()|0);
   while(1) {
    $9 = (_parse_vars(128)|0);
    $10 = ($9|0)!=(0);
    if (!($10)) {
     break;
    }
    (_next_line()|0);
   }
   $11 = HEAP8[111813]|0;
   $12 = $11&255;
   $13 = ($12|0)!=(136);
   if ($13) {
    _parse_error(4346);
    HEAP32[$0>>2] = 0;
    break;
   }
   $14 = (_scan()|0);
   $15 = $14&255;
   $16 = ($15|0)!=(128);
   if ($16) {
    $17 = HEAP8[111813]|0;
    $18 = $17&255;
    $19 = ($18|0)!=(187);
    if ($19) {
     _parse_error(4359);
     HEAP32[$0>>2] = 0;
    } else {
     label = 12;
    }
   } else {
    label = 12;
   }
  } else {
   label = 12;
  }
 } while(0);
 do {
  if ((label|0) == 12) {
   $20 = HEAP8[111813]|0;
   $21 = $20&255;
   $22 = ($21|0)==(128);
   if (!($22)) {
    $23 = HEAP8[111813]|0;
    $24 = $23&255;
    $25 = ($24|0)==(187);
    if (!($25)) {
     _emit_moddep(0,0);
     HEAP32[$0>>2] = 0;
     break;
    }
   }
   HEAP32[$0>>2] = 1;
  }
 } while(0);
 $26 = HEAP32[$0>>2]|0;
 STACKTOP = sp;return ($26|0);
}
function _parse_defs() {
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $0 = sp + 12|0;
 $1 = sp + 16|0;
 $2 = sp + 8|0;
 $3 = sp + 4|0;
 $4 = sp;
 HEAP32[$4>>2] = 0;
 $5 = HEAP8[111813]|0;
 $6 = $5&255;
 $7 = ($6|0)==(154);
 if ($7) {
  $8 = (_scan()|0);
  $9 = $8&255;
  $10 = ($9|0)!=(151);
  if ($10) {
   $11 = HEAP8[111813]|0;
   $12 = $11&255;
   $13 = ($12|0)!=(152);
   if ($13) {
    _parse_error(4652);
    HEAP32[$0>>2] = 0;
    $179 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($179|0);
   }
  }
  HEAP32[$4>>2] = 4096;
 }
 $14 = HEAP8[111813]|0;
 $15 = $14&255;
 $16 = ($15|0)==(151);
 if ($16) {
  $17 = (_scan()|0);
  $18 = $17&255;
  $19 = ($18|0)!=(214);
  if ($19) {
   _parse_error(4674);
   HEAP32[$0>>2] = 0;
   $179 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($179|0);
  }
  _emit_bytecode_seg();
  HEAP8[112343] = 1;
  HEAP32[$3>>2] = 0;
  HEAP32[9261] = 1;
  $20 = HEAP32[$4>>2]|0;
  $21 = $20 | 16;
  HEAP32[$4>>2] = $21;
  $22 = HEAP32[9255]|0;
  $23 = HEAP32[9256]|0;
  $24 = (_idglobal_lookup($22,$23)|0);
  $25 = ($24|0)>=(0);
  do {
   if ($25) {
    $26 = HEAP32[9255]|0;
    $27 = HEAP32[9256]|0;
    $28 = (_id_type($26,$27)|0);
    $29 = $28 & 8192;
    $30 = ($29|0)!=(0);
    if ($30) {
     $31 = HEAP32[9255]|0;
     $32 = HEAP32[9256]|0;
     $33 = (_id_tag($31,$32)|0);
     $34 = HEAP32[9255]|0;
     _emit_idfunc($33,8192,$34);
     $35 = HEAP32[$4>>2]|0;
     $36 = (_tag_new($35)|0);
     HEAP32[$2>>2] = $36;
     $37 = HEAP32[9255]|0;
     $38 = HEAP32[9256]|0;
     $39 = HEAP32[$4>>2]|0;
     $40 = HEAP32[$2>>2]|0;
     (_idfunc_set($37,$38,$39,$40)|0);
     break;
    }
    _parse_error(4696);
    HEAP32[$0>>2] = 0;
    $179 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($179|0);
   } else {
    $41 = HEAP32[$4>>2]|0;
    $42 = (_tag_new($41)|0);
    HEAP32[$2>>2] = $42;
    $43 = HEAP32[9255]|0;
    $44 = HEAP32[9256]|0;
    $45 = HEAP32[$4>>2]|0;
    $46 = HEAP32[$2>>2]|0;
    (_idfunc_add($43,$44,$45,$46)|0);
   }
  } while(0);
  $47 = HEAP32[9256]|0;
  $48 = HEAP32[9255]|0;
  $49 = (($48) + ($47)|0);
  $50 = HEAP8[$49>>0]|0;
  HEAP8[$1>>0] = $50;
  $51 = HEAP32[9256]|0;
  $52 = HEAP32[9255]|0;
  $53 = (($52) + ($51)|0);
  HEAP8[$53>>0] = 0;
  $54 = HEAP32[$2>>2]|0;
  $55 = HEAP32[$4>>2]|0;
  $56 = HEAP32[9255]|0;
  _emit_idfunc($54,$55,$56);
  $57 = HEAP32[9255]|0;
  _emit_def($57,1);
  $58 = HEAP8[$1>>0]|0;
  $59 = HEAP32[9256]|0;
  $60 = HEAP32[9255]|0;
  $61 = (($60) + ($59)|0);
  HEAP8[$61>>0] = $58;
  $62 = (_scan()|0);
  $63 = $62&255;
  $64 = ($63|0)==(168);
  do {
   if ($64) {
    while(1) {
     $65 = (_scan()|0);
     $66 = $65&255;
     $67 = ($66|0)==(214);
     if ($67) {
      $68 = HEAP32[$3>>2]|0;
      $69 = (($68) + 1)|0;
      HEAP32[$3>>2] = $69;
      $70 = HEAP32[9255]|0;
      $71 = HEAP32[9256]|0;
      (_idlocal_add($70,$71,2,2)|0);
      (_scan()|0);
     }
     $72 = HEAP8[111813]|0;
     $73 = $72&255;
     $74 = ($73|0)==(172);
     if (!($74)) {
      break;
     }
    }
    $75 = HEAP8[111813]|0;
    $76 = $75&255;
    $77 = ($76|0)!=(169);
    if (!($77)) {
     (_scan()|0);
     break;
    }
    _parse_error(4719);
    HEAP32[$0>>2] = 0;
    $179 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($179|0);
   }
  } while(0);
  while(1) {
   $78 = (_parse_vars(64)|0);
   $79 = ($78|0)!=(0);
   if (!($79)) {
    break;
   }
   (_next_line()|0);
  }
  $80 = HEAP32[$3>>2]|0;
  _emit_enter($80);
  HEAP8[112342] = 0;
  while(1) {
   $81 = (_parse_stmnt()|0);
   $82 = ($81|0)!=(0);
   if (!($82)) {
    break;
   }
   (_next_line()|0);
  }
  HEAP32[9261] = 0;
  $83 = HEAP8[111813]|0;
  $84 = $83&255;
  $85 = ($84|0)!=(136);
  if ($85) {
   _parse_error(4346);
   HEAP32[$0>>2] = 0;
   $179 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($179|0);
  }
  $86 = (_scan()|0);
  $87 = $86&255;
  $88 = ($87|0)!=(128);
  if ($88) {
   $89 = HEAP8[111813]|0;
   $90 = $89&255;
   $91 = ($90|0)!=(187);
   if ($91) {
    _parse_error(4359);
    HEAP32[$0>>2] = 0;
    $179 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($179|0);
   }
  }
  $92 = HEAP8[112342]|0;
  $93 = $92&255;
  $94 = ($93|0)!=(156);
  if ($94) {
   _emit_const(0);
   _emit_leave();
  }
  HEAP32[$0>>2] = 1;
  $179 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($179|0);
 }
 $95 = HEAP8[111813]|0;
 $96 = $95&255;
 $97 = ($96|0)==(152);
 if (!($97)) {
  $173 = HEAP8[111813]|0;
  $174 = $173&255;
  $175 = ($174|0)==(128);
  if (!($175)) {
   $176 = HEAP8[111813]|0;
   $177 = $176&255;
   $178 = ($177|0)==(187);
   if (!($178)) {
    HEAP32[$0>>2] = 0;
    $179 = HEAP32[$0>>2]|0;
    STACKTOP = sp;return ($179|0);
   }
  }
  HEAP32[$0>>2] = 1;
  $179 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($179|0);
 }
 $98 = (_scan()|0);
 $99 = $98&255;
 $100 = ($99|0)!=(214);
 if ($100) {
  _parse_error(4674);
  HEAP32[$0>>2] = 0;
  $179 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($179|0);
 }
 $101 = HEAP8[112343]|0;
 $102 = ($101<<24>>24)!=(0);
 if ($102) {
  _parse_error(4747);
  HEAP32[$0>>2] = 0;
  $179 = HEAP32[$0>>2]|0;
  STACKTOP = sp;return ($179|0);
 }
 HEAP32[$3>>2] = 0;
 HEAP32[9261] = 1;
 $103 = HEAP32[$4>>2]|0;
 $104 = $103 | 8;
 HEAP32[$4>>2] = $104;
 $105 = HEAP32[9255]|0;
 $106 = HEAP32[9256]|0;
 $107 = (_idglobal_lookup($105,$106)|0);
 $108 = ($107|0)>=(0);
 do {
  if ($108) {
   $109 = HEAP32[9255]|0;
   $110 = HEAP32[9256]|0;
   $111 = (_id_type($109,$110)|0);
   $112 = $111 & 8192;
   $113 = ($112|0)!=(0);
   if ($113) {
    $114 = HEAP32[9255]|0;
    $115 = HEAP32[9256]|0;
    $116 = (_id_tag($114,$115)|0);
    $117 = HEAP32[9255]|0;
    _emit_idfunc($116,8192,$117);
    $118 = HEAP32[$4>>2]|0;
    $119 = (_tag_new($118)|0);
    HEAP32[$2>>2] = $119;
    $120 = HEAP32[9255]|0;
    $121 = HEAP32[9256]|0;
    $122 = HEAP32[$4>>2]|0;
    $123 = HEAP32[$2>>2]|0;
    (_idfunc_set($120,$121,$122,$123)|0);
    break;
   }
   _parse_error(4696);
   HEAP32[$0>>2] = 0;
   $179 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($179|0);
  } else {
   $124 = HEAP32[$4>>2]|0;
   $125 = (_tag_new($124)|0);
   HEAP32[$2>>2] = $125;
   $126 = HEAP32[9255]|0;
   $127 = HEAP32[9256]|0;
   $128 = HEAP32[$4>>2]|0;
   $129 = HEAP32[$2>>2]|0;
   (_idfunc_add($126,$127,$128,$129)|0);
  }
 } while(0);
 $130 = HEAP32[9256]|0;
 $131 = HEAP32[9255]|0;
 $132 = (($131) + ($130)|0);
 $133 = HEAP8[$132>>0]|0;
 HEAP8[$1>>0] = $133;
 $134 = HEAP32[9256]|0;
 $135 = HEAP32[9255]|0;
 $136 = (($135) + ($134)|0);
 HEAP8[$136>>0] = 0;
 $137 = HEAP32[$2>>2]|0;
 $138 = HEAP32[$4>>2]|0;
 $139 = HEAP32[9255]|0;
 _emit_idfunc($137,$138,$139);
 $140 = HEAP32[9255]|0;
 _emit_def($140,0);
 $141 = HEAP8[$1>>0]|0;
 $142 = HEAP32[9256]|0;
 $143 = HEAP32[9255]|0;
 $144 = (($143) + ($142)|0);
 HEAP8[$144>>0] = $141;
 $145 = (_scan()|0);
 $146 = $145&255;
 $147 = ($146|0)==(168);
 do {
  if ($147) {
   while(1) {
    $148 = (_scan()|0);
    $149 = $148&255;
    $150 = ($149|0)==(214);
    if ($150) {
     $151 = HEAP32[$3>>2]|0;
     $152 = (($151) + 1)|0;
     HEAP32[$3>>2] = $152;
     $153 = HEAP32[9255]|0;
     $154 = HEAP32[9256]|0;
     (_idlocal_add($153,$154,2,2)|0);
     (_scan()|0);
    }
    $155 = HEAP8[111813]|0;
    $156 = $155&255;
    $157 = ($156|0)==(172);
    if (!($157)) {
     break;
    }
   }
   $158 = HEAP8[111813]|0;
   $159 = $158&255;
   $160 = ($159|0)!=(169);
   if (!($160)) {
    (_scan()|0);
    break;
   }
   _parse_error(4719);
   HEAP32[$0>>2] = 0;
   $179 = HEAP32[$0>>2]|0;
   STACKTOP = sp;return ($179|0);
  }
 } while(0);
 while(1) {
  $161 = HEAP8[111813]|0;
  $162 = $161&255;
  $163 = ($162|0)==(128);
  if ($163) {
   label = 53;
  } else {
   $164 = HEAP8[111813]|0;
   $165 = $164&255;
   $166 = ($165|0)==(187);
   if ($166) {
    label = 53;
   } else {
    $167 = HEAP8[111813]|0;
    $168 = $167&255;
    $169 = ($168|0)!=(136);
    if ($169) {
     _emit_asm(111814);
     (_next_line()|0);
    }
   }
  }
  if ((label|0) == 53) {
   label = 0;
   (_next_line()|0);
  }
  $170 = HEAP8[111813]|0;
  $171 = $170&255;
  $172 = ($171|0)!=(136);
  if (!($172)) {
   break;
  }
 }
 HEAP32[$0>>2] = 1;
 $179 = HEAP32[$0>>2]|0;
 STACKTOP = sp;return ($179|0);
}
function _parse_module() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _emit_header();
 $0 = (_next_line()|0);
 $1 = ($0|0)!=(0);
 if (!($1)) {
  _emit_trailer();
  return 0;
 }
 while(1) {
  $2 = (_parse_mods()|0);
  $3 = ($2|0)!=(0);
  if (!($3)) {
   break;
  }
  (_next_line()|0);
 }
 while(1) {
  $4 = (_parse_vars(0)|0);
  $5 = ($4|0)!=(0);
  if (!($5)) {
   break;
  }
  (_next_line()|0);
 }
 while(1) {
  $6 = (_parse_defs()|0);
  $7 = ($6|0)!=(0);
  if (!($7)) {
   break;
  }
  (_next_line()|0);
 }
 $8 = HEAP8[111813]|0;
 $9 = $8&255;
 $10 = ($9|0)!=(155);
 if (!($10)) {
  _emit_trailer();
  return 0;
 }
 $11 = HEAP8[111813]|0;
 $12 = $11&255;
 $13 = ($12|0)!=(255);
 if (!($13)) {
  _emit_trailer();
  return 0;
 }
 _emit_bytecode_seg();
 _emit_start();
 _emit_def(4785,1);
 HEAP8[112342] = 0;
 while(1) {
  $14 = (_parse_stmnt()|0);
  $15 = ($14|0)!=(0);
  if (!($15)) {
   break;
  }
  (_next_line()|0);
 }
 $16 = HEAP8[111813]|0;
 $17 = $16&255;
 $18 = ($17|0)!=(155);
 if ($18) {
  _parse_error(4791);
 }
 $19 = HEAP8[112342]|0;
 $20 = $19&255;
 $21 = ($20|0)!=(156);
 if (!($21)) {
  _emit_trailer();
  return 0;
 }
 _emit_const(0);
 _emit_ret();
 _emit_trailer();
 return 0;
}
function _main($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$lcssa = 0, $$01821 = 0, $$019 = 0, $$019$ph = 0, $$022 = 0, $$1$ph = 0, $$2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)>(1);
 if ($2) {
  $$01821 = 1;$$022 = 0;
  while(1) {
   $3 = (($1) + ($$01821<<2)|0);
   $4 = HEAP32[$3>>2]|0;
   $5 = HEAP8[$4>>0]|0;
   $6 = ($5<<24>>24)==(45);
   L4: do {
    if ($6) {
     $7 = HEAP32[$3>>2]|0;
     $$019$ph = 1;$$1$ph = $$022;
     while(1) {
      $$019 = $$019$ph;
      L8: while(1) {
       $8 = (($7) + ($$019)|0);
       $9 = HEAP8[$8>>0]|0;
       $10 = ($9<<24>>24)==(0);
       if ($10) {
        $$2 = $$1$ph;
        break L4;
       }
       $11 = (($$019) + 1)|0;
       $12 = $9 << 24 >> 24;
       switch ($12|0) {
       case 65:  {
        label = 7;
        break L8;
        break;
       }
       case 77:  {
        label = 8;
        break L8;
        break;
       }
       default: {
        $$019 = $11;
       }
       }
      }
      if ((label|0) == 7) {
       label = 0;
       $13 = $$1$ph | 1;
       $$019$ph = $11;$$1$ph = $13;
       continue;
      }
      else if ((label|0) == 8) {
       label = 0;
       $14 = $$1$ph | 2;
       $$019$ph = $11;$$1$ph = $14;
       continue;
      }
     }
    } else {
     $$2 = $$022;
    }
   } while(0);
   $15 = (($$01821) + 1)|0;
   $exitcond = ($15|0)==($0|0);
   if ($exitcond) {
    $$0$lcssa = $$2;
    break;
   } else {
    $$01821 = $15;$$022 = $$2;
   }
  }
 } else {
  $$0$lcssa = 0;
 }
 _emit_flags($$0$lcssa);
 $16 = (_parse_module()|0);
 $17 = ($16|0)==(0);
 if ($17) {
  return 0;
 }
 $18 = HEAP32[9]|0;
 (_fwrite(4814,22,1,$18)|0);
 return 0;
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
  $15 = HEAP32[9329]|0;
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
   _pthread_cleanup_push((1|0),($0|0));
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
 $0 = HEAP32[9329]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 37360;
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
 $14 = HEAP32[9329]|0;
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
  _pthread_cleanup_push((2|0),($0|0));
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
  $2 = (4837 + ($$015)|0);
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
   $$01113 = 4925;$$114 = 87;
   label = 5;
   break;
  } else {
   $$015 = $6;
  }
 }
 if ((label|0) == 2) {
  $1 = ($$015|0)==(0);
  if ($1) {
   $$011$lcssa = 4925;
  } else {
   $$01113 = 4925;$$114 = $$015;
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
  ___lock(((37344)|0));
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
  $17 = HEAP32[(37340)>>2]|0;
  $18 = ($17|0)==($0|0);
  if ($18) {
   HEAP32[(37340)>>2] = $15;
  }
  ___unlock(((37344)|0));
 }
 $19 = (_fflush($0)|0);
 $20 = ((($0)) + 12|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = (FUNCTION_TABLE_ii[$21 & 1]($0)|0);
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
   $8 = HEAP32[67]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $28 = 0;
   } else {
    $10 = HEAP32[67]|0;
    $11 = (_fflush($10)|0);
    $28 = $11;
   }
   ___lock(((37344)|0));
   $$02325 = HEAP32[(37340)>>2]|0;
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
   ___unlock(((37344)|0));
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
 $memchr = (_memchr(7263,$4,4)|0);
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
   HEAP32[$33>>2] = 4;
   $34 = ((($7)) + 36|0);
   HEAP32[$34>>2] = 1;
   $35 = ((($7)) + 40|0);
   HEAP32[$35>>2] = 2;
   $36 = ((($7)) + 12|0);
   HEAP32[$36>>2] = 1;
   $37 = HEAP32[(37320)>>2]|0;
   $38 = ($37|0)==(0);
   if ($38) {
    $39 = ((($7)) + 76|0);
    HEAP32[$39>>2] = -1;
   }
   ___lock(((37344)|0));
   $40 = HEAP32[(37340)>>2]|0;
   $41 = ((($7)) + 56|0);
   HEAP32[$41>>2] = $40;
   $42 = ($40|0)==(0);
   if (!($42)) {
    $$cast = $40;
    $43 = ((($$cast)) + 52|0);
    HEAP32[$43>>2] = $7;
   }
   HEAP32[(37340)>>2] = $7;
   ___unlock(((37344)|0));
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
 dest=$5; src=388; stop=dest+112|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
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
   $159 = ((6729 + (($$0252*58)|0)|0) + ($156)|0);
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
     $$0228 = $$0$lcssa$i300;$$1233 = 0;$$1238 = 7209;$$2256 = $$0254;$$4266 = $$1263$;
     label = 76;
    } else {
     $279 = $$0$lcssa$i300;
     $280 = (($15) - ($279))|0;
     $281 = ($$0254|0)>($280|0);
     $282 = (($280) + 1)|0;
     $$0254$ = $281 ? $$0254 : $282;
     $$0228 = $$0$lcssa$i300;$$1233 = 0;$$1238 = 7209;$$2256 = $$0254$;$$4266 = $$1263$;
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
     $$0232 = 1;$$0237 = 7209;$300 = $290;$301 = $291;
     label = 75;
     break L74;
    }
    $296 = $$1263$ & 2048;
    $297 = ($296|0)==(0);
    if ($297) {
     $298 = $$1263$ & 1;
     $299 = ($298|0)==(0);
     $$ = $299 ? 7209 : (7211);
     $$0232 = $298;$$0237 = $$;$300 = $285;$301 = $288;
     label = 75;
    } else {
     $$0232 = 1;$$0237 = (7210);$300 = $285;$301 = $288;
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
    $$0232 = 0;$$0237 = 7209;$300 = $190;$301 = $193;
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
    $$2 = $16;$$2234 = 0;$$2239 = 7209;$$2251 = $14;$$5 = 1;$$6268 = $187;
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
    $333 = $332 ? $331 : 7219;
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
     $$0471$i = $375;$$0520$i = 1;$$0522$i = 7226;
    } else {
     $376 = $$1263$ & 2048;
     $377 = ($376|0)==(0);
     $378 = $$1263$ & 1;
     if ($377) {
      $379 = ($378|0)==(0);
      $$$i = $379 ? (7227) : (7232);
      $$0471$i = $371;$$0520$i = $378;$$0522$i = $$$i;
     } else {
      $$0471$i = $371;$$0520$i = 1;$$0522$i = (7229);
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
        $448 = (7193 + ($447)|0);
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
          (___fwritex(7261,1,$0)|0);
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
            (___fwritex(7261,1,$0)|0);
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
      $390 = $389 ? 7245 : 7249;
      $391 = ($$0471$i != $$0471$i) | (0.0 != 0.0);
      $392 = $389 ? 7253 : 7257;
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
    $$2 = $$0321;$$2234 = 0;$$2239 = 7209;$$2251 = $14;$$5 = $$0254;$$6268 = $$1263$;
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
      $230 = (7193 + ($228)|0);
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
    $256 = (7209 + ($255)|0);
    $$332 = $or$cond282 ? 7209 : $256;
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
    $$2 = $$1;$$2234 = 0;$$2239 = 7209;$$2251 = $$1250;$$5 = $$3257;$$6268 = $187;
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
 $2 = HEAP32[38]|0;
 $3 = (_vfprintf($2,$0,$1)|0);
 STACKTOP = sp;return ($3|0);
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
 $memchr = (_memchr(7263,$3,4)|0);
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
function _fgets($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$06266 = 0, $$063 = 0, $$064 = 0, $$1 = 0, $$old2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0;
 var $or$cond3 = 0, $sext$mask = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($2)) + 76|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)>(-1);
 if ($5) {
  $6 = (___lockfile($2)|0);
  $15 = $6;
 } else {
  $15 = 0;
 }
 $7 = (($1) + -1)|0;
 $8 = ($1|0)<(2);
 if ($8) {
  $9 = ((($2)) + 74|0);
  $10 = HEAP8[$9>>0]|0;
  $11 = $10 << 24 >> 24;
  $12 = (($11) + 255)|0;
  $13 = $12 | $11;
  $14 = $13&255;
  HEAP8[$9>>0] = $14;
  $16 = ($15|0)==(0);
  if (!($16)) {
   ___unlockfile($2);
  }
  $17 = ($7|0)==(0);
  if ($17) {
   HEAP8[$0>>0] = 0;
   $$0 = $0;
  } else {
   $$0 = 0;
  }
 } else {
  $$old2 = ($7|0)==(0);
  L11: do {
   if ($$old2) {
    $$1 = $0;
    label = 17;
   } else {
    $18 = ((($2)) + 4|0);
    $19 = ((($2)) + 8|0);
    $$063 = $7;$$064 = $0;
    while(1) {
     $20 = HEAP32[$18>>2]|0;
     $21 = HEAP32[$19>>2]|0;
     $22 = $20;
     $23 = (($21) - ($22))|0;
     $24 = (_memchr($20,10,$23)|0);
     $25 = ($24|0)==(0|0);
     $26 = $24;
     $27 = (1 - ($22))|0;
     $28 = (($27) + ($26))|0;
     $29 = $25 ? $23 : $28;
     $30 = ($29>>>0)<($$063>>>0);
     $31 = $30 ? $29 : $$063;
     _memcpy(($$064|0),($20|0),($31|0))|0;
     $32 = HEAP32[$18>>2]|0;
     $33 = (($32) + ($31)|0);
     HEAP32[$18>>2] = $33;
     $34 = (($$064) + ($31)|0);
     $35 = (($$063) - ($31))|0;
     $36 = ($35|0)!=(0);
     $or$cond = $25 & $36;
     if (!($or$cond)) {
      $$1 = $34;
      label = 17;
      break L11;
     }
     $37 = HEAP32[$19>>2]|0;
     $38 = ($33>>>0)<($37>>>0);
     if ($38) {
      $39 = ((($33)) + 1|0);
      HEAP32[$18>>2] = $39;
      $40 = HEAP8[$33>>0]|0;
      $41 = $40&255;
      $50 = $41;
     } else {
      $42 = (___uflow($2)|0);
      $43 = ($42|0)<(0);
      if ($43) {
       break;
      } else {
       $50 = $42;
      }
     }
     $48 = (($35) + -1)|0;
     $49 = $50&255;
     $51 = ((($34)) + 1|0);
     HEAP8[$34>>0] = $49;
     $sext$mask = $50 & 255;
     $52 = ($sext$mask|0)!=(10);
     $53 = ($48|0)!=(0);
     $or$cond3 = $53 & $52;
     if ($or$cond3) {
      $$063 = $48;$$064 = $51;
     } else {
      $$1 = $51;
      label = 17;
      break L11;
     }
    }
    $44 = ($34|0)==($0|0);
    if ($44) {
     $$06266 = 0;
    } else {
     $45 = HEAP32[$2>>2]|0;
     $46 = $45 & 16;
     $47 = ($46|0)==(0);
     if ($47) {
      $$06266 = 0;
     } else {
      $$1 = $34;
      label = 17;
     }
    }
   }
  } while(0);
  if ((label|0) == 17) {
   $54 = ($0|0)==(0|0);
   if ($54) {
    $$06266 = 0;
   } else {
    HEAP8[$$1>>0] = 0;
    $$06266 = $0;
   }
  }
  $55 = ($15|0)==(0);
  if ($55) {
   $$0 = $$06266;
  } else {
   ___unlockfile($2);
   $$0 = $$06266;
  }
 }
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
function _strncpy($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 (___stpncpy($0,$1,$2)|0);
 return ($0|0);
}
function ___stpncpy($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$037$lcssa = 0, $$03753 = 0, $$038$lcssa = 0, $$038$lcssa79 = 0, $$03866 = 0, $$039$lcssa = 0, $$039$lcssa78 = 0, $$03965 = 0, $$041$lcssa = 0, $$041$lcssa77 = 0, $$04164 = 0, $$054 = 0, $$1$lcssa = 0, $$140$ph = 0, $$14046 = 0, $$142$ph = 0, $$14245 = 0, $$152 = 0, $$2$ph = 0;
 var $$243 = 0, $$247 = 0, $$3 = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $or$cond = 0, $or$cond63 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1;
 $4 = $0;
 $5 = $3 ^ $4;
 $6 = $5 & 3;
 $7 = ($6|0)==(0);
 do {
  if ($7) {
   $8 = $3 & 3;
   $9 = ($8|0)!=(0);
   $10 = ($2|0)!=(0);
   $or$cond63 = $10 & $9;
   L3: do {
    if ($or$cond63) {
     $$03866 = $2;$$03965 = $1;$$04164 = $0;
     while(1) {
      $11 = HEAP8[$$03965>>0]|0;
      HEAP8[$$04164>>0] = $11;
      $12 = ($11<<24>>24)==(0);
      if ($12) {
       $$038$lcssa79 = $$03866;$$039$lcssa78 = $$03965;$$041$lcssa77 = $$04164;
       break L3;
      }
      $13 = (($$03866) + -1)|0;
      $14 = ((($$03965)) + 1|0);
      $15 = ((($$04164)) + 1|0);
      $16 = $14;
      $17 = $16 & 3;
      $18 = ($17|0)!=(0);
      $19 = ($13|0)!=(0);
      $or$cond = $19 & $18;
      if ($or$cond) {
       $$03866 = $13;$$03965 = $14;$$04164 = $15;
      } else {
       $$038$lcssa = $13;$$039$lcssa = $14;$$041$lcssa = $15;$$lcssa = $19;
       label = 5;
       break;
      }
     }
    } else {
     $$038$lcssa = $2;$$039$lcssa = $1;$$041$lcssa = $0;$$lcssa = $10;
     label = 5;
    }
   } while(0);
   if ((label|0) == 5) {
    if ($$lcssa) {
     $$038$lcssa79 = $$038$lcssa;$$039$lcssa78 = $$039$lcssa;$$041$lcssa77 = $$041$lcssa;
    } else {
     $$243 = $$041$lcssa;$$3 = 0;
     break;
    }
   }
   $20 = HEAP8[$$039$lcssa78>>0]|0;
   $21 = ($20<<24>>24)==(0);
   if ($21) {
    $$243 = $$041$lcssa77;$$3 = $$038$lcssa79;
   } else {
    $22 = ($$038$lcssa79>>>0)>(3);
    L11: do {
     if ($22) {
      $$03753 = $$041$lcssa77;$$054 = $$039$lcssa78;$$152 = $$038$lcssa79;
      while(1) {
       $23 = HEAP32[$$054>>2]|0;
       $24 = (($23) + -16843009)|0;
       $25 = $23 & -2139062144;
       $26 = $25 ^ -2139062144;
       $27 = $26 & $24;
       $28 = ($27|0)==(0);
       if (!($28)) {
        $$0$lcssa = $$054;$$037$lcssa = $$03753;$$1$lcssa = $$152;
        break L11;
       }
       HEAP32[$$03753>>2] = $23;
       $29 = (($$152) + -4)|0;
       $30 = ((($$054)) + 4|0);
       $31 = ((($$03753)) + 4|0);
       $32 = ($29>>>0)>(3);
       if ($32) {
        $$03753 = $31;$$054 = $30;$$152 = $29;
       } else {
        $$0$lcssa = $30;$$037$lcssa = $31;$$1$lcssa = $29;
        break;
       }
      }
     } else {
      $$0$lcssa = $$039$lcssa78;$$037$lcssa = $$041$lcssa77;$$1$lcssa = $$038$lcssa79;
     }
    } while(0);
    $$140$ph = $$0$lcssa;$$142$ph = $$037$lcssa;$$2$ph = $$1$lcssa;
    label = 11;
   }
  } else {
   $$140$ph = $1;$$142$ph = $0;$$2$ph = $2;
   label = 11;
  }
 } while(0);
 L16: do {
  if ((label|0) == 11) {
   $33 = ($$2$ph|0)==(0);
   if ($33) {
    $$243 = $$142$ph;$$3 = 0;
   } else {
    $$14046 = $$140$ph;$$14245 = $$142$ph;$$247 = $$2$ph;
    while(1) {
     $34 = HEAP8[$$14046>>0]|0;
     HEAP8[$$14245>>0] = $34;
     $35 = ($34<<24>>24)==(0);
     if ($35) {
      $$243 = $$14245;$$3 = $$247;
      break L16;
     }
     $36 = (($$247) + -1)|0;
     $37 = ((($$14046)) + 1|0);
     $38 = ((($$14245)) + 1|0);
     $39 = ($36|0)==(0);
     if ($39) {
      $$243 = $38;$$3 = 0;
      break;
     } else {
      $$14046 = $37;$$14245 = $38;$$247 = $36;
     }
    }
   }
  }
 } while(0);
 _memset(($$243|0),0,($$3|0))|0;
 return ($$243|0);
}
function _toupper($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_islower($0)|0);
 $2 = ($1|0)==(0);
 $3 = $0 & 95;
 $$0 = $2 ? $0 : $3;
 return ($$0|0);
}
function _islower($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (($0) + -97)|0;
 $2 = ($1>>>0)<(26);
 $3 = $2&1;
 return ($3|0);
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
   $8 = HEAP32[9341]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (37404 + ($15<<2)|0);
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
      HEAP32[9341] = $24;
     } else {
      $25 = HEAP32[(37380)>>2]|0;
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
   $37 = HEAP32[(37372)>>2]|0;
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
     $69 = (37404 + ($68<<2)|0);
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
       HEAP32[9341] = $77;
       $98 = $77;
      } else {
       $78 = HEAP32[(37380)>>2]|0;
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
      $92 = HEAP32[(37384)>>2]|0;
      $93 = $37 >>> 3;
      $94 = $93 << 1;
      $95 = (37404 + ($94<<2)|0);
      $96 = 1 << $93;
      $97 = $98 & $96;
      $99 = ($97|0)==(0);
      if ($99) {
       $100 = $98 | $96;
       HEAP32[9341] = $100;
       $$pre = ((($95)) + 8|0);
       $$0199 = $95;$$pre$phiZ2D = $$pre;
      } else {
       $101 = ((($95)) + 8|0);
       $102 = HEAP32[$101>>2]|0;
       $103 = HEAP32[(37380)>>2]|0;
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
     HEAP32[(37372)>>2] = $84;
     HEAP32[(37384)>>2] = $87;
     $$0 = $72;
     STACKTOP = sp;return ($$0|0);
    }
    $108 = HEAP32[(37368)>>2]|0;
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
     $133 = (37668 + ($132<<2)|0);
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
     $151 = HEAP32[(37380)>>2]|0;
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
       $185 = (37668 + ($184<<2)|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($$0190$i|0)==($186|0);
       if ($187) {
        HEAP32[$185>>2] = $$3$i;
        $cond$i = ($$3$i|0)==(0|0);
        if ($cond$i) {
         $188 = 1 << $184;
         $189 = $188 ^ -1;
         $190 = $108 & $189;
         HEAP32[(37368)>>2] = $190;
         break;
        }
       } else {
        $191 = HEAP32[(37380)>>2]|0;
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
       $198 = HEAP32[(37380)>>2]|0;
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
        $210 = HEAP32[(37380)>>2]|0;
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
       $228 = HEAP32[(37384)>>2]|0;
       $229 = $37 >>> 3;
       $230 = $229 << 1;
       $231 = (37404 + ($230<<2)|0);
       $232 = 1 << $229;
       $233 = $8 & $232;
       $234 = ($233|0)==(0);
       if ($234) {
        $235 = $8 | $232;
        HEAP32[9341] = $235;
        $$pre$i = ((($231)) + 8|0);
        $$0187$i = $231;$$pre$phi$iZ2D = $$pre$i;
       } else {
        $236 = ((($231)) + 8|0);
        $237 = HEAP32[$236>>2]|0;
        $238 = HEAP32[(37380)>>2]|0;
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
      HEAP32[(37372)>>2] = $$0191$i;
      HEAP32[(37384)>>2] = $153;
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
    $247 = HEAP32[(37368)>>2]|0;
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
     $275 = (37668 + ($$0356$i<<2)|0);
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
       $329 = (37668 + ($328<<2)|0);
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
      $344 = HEAP32[(37372)>>2]|0;
      $345 = (($344) - ($246))|0;
      $346 = ($$4349$lcssa$i>>>0)<($345>>>0);
      if ($346) {
       $347 = HEAP32[(37380)>>2]|0;
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
         $381 = (37668 + ($380<<2)|0);
         $382 = HEAP32[$381>>2]|0;
         $383 = ($$4$lcssa$i|0)==($382|0);
         if ($383) {
          HEAP32[$381>>2] = $$3370$i;
          $cond$i204 = ($$3370$i|0)==(0|0);
          if ($cond$i204) {
           $384 = 1 << $380;
           $385 = $384 ^ -1;
           $386 = $247 & $385;
           HEAP32[(37368)>>2] = $386;
           $470 = $386;
           break;
          }
         } else {
          $387 = HEAP32[(37380)>>2]|0;
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
         $394 = HEAP32[(37380)>>2]|0;
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
          $406 = HEAP32[(37380)>>2]|0;
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
          $426 = (37404 + ($425<<2)|0);
          $427 = HEAP32[9341]|0;
          $428 = 1 << $423;
          $429 = $427 & $428;
          $430 = ($429|0)==(0);
          if ($430) {
           $431 = $427 | $428;
           HEAP32[9341] = $431;
           $$pre$i205 = ((($426)) + 8|0);
           $$0366$i = $426;$$pre$phi$i206Z2D = $$pre$i205;
          } else {
           $432 = ((($426)) + 8|0);
           $433 = HEAP32[$432>>2]|0;
           $434 = HEAP32[(37380)>>2]|0;
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
         $464 = (37668 + ($$0359$i<<2)|0);
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
          HEAP32[(37368)>>2] = $472;
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
          $491 = HEAP32[(37380)>>2]|0;
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
          $498 = HEAP32[(37380)>>2]|0;
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
 $506 = HEAP32[(37372)>>2]|0;
 $507 = ($506>>>0)<($$0197>>>0);
 if (!($507)) {
  $508 = (($506) - ($$0197))|0;
  $509 = HEAP32[(37384)>>2]|0;
  $510 = ($508>>>0)>(15);
  if ($510) {
   $511 = (($509) + ($$0197)|0);
   HEAP32[(37384)>>2] = $511;
   HEAP32[(37372)>>2] = $508;
   $512 = $508 | 1;
   $513 = ((($511)) + 4|0);
   HEAP32[$513>>2] = $512;
   $514 = (($511) + ($508)|0);
   HEAP32[$514>>2] = $508;
   $515 = $$0197 | 3;
   $516 = ((($509)) + 4|0);
   HEAP32[$516>>2] = $515;
  } else {
   HEAP32[(37372)>>2] = 0;
   HEAP32[(37384)>>2] = 0;
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
 $524 = HEAP32[(37376)>>2]|0;
 $525 = ($524>>>0)>($$0197>>>0);
 if ($525) {
  $526 = (($524) - ($$0197))|0;
  HEAP32[(37376)>>2] = $526;
  $527 = HEAP32[(37388)>>2]|0;
  $528 = (($527) + ($$0197)|0);
  HEAP32[(37388)>>2] = $528;
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
 $534 = HEAP32[9459]|0;
 $535 = ($534|0)==(0);
 if ($535) {
  HEAP32[(37844)>>2] = 4096;
  HEAP32[(37840)>>2] = 4096;
  HEAP32[(37848)>>2] = -1;
  HEAP32[(37852)>>2] = -1;
  HEAP32[(37856)>>2] = 0;
  HEAP32[(37808)>>2] = 0;
  $536 = $1;
  $537 = $536 & -16;
  $538 = $537 ^ 1431655768;
  HEAP32[$1>>2] = $538;
  HEAP32[9459] = $538;
  $542 = 4096;
 } else {
  $$pre$i208 = HEAP32[(37844)>>2]|0;
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
 $546 = HEAP32[(37804)>>2]|0;
 $547 = ($546|0)==(0);
 if (!($547)) {
  $548 = HEAP32[(37796)>>2]|0;
  $549 = (($548) + ($544))|0;
  $550 = ($549>>>0)<=($548>>>0);
  $551 = ($549>>>0)>($546>>>0);
  $or$cond1$i210 = $550 | $551;
  if ($or$cond1$i210) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $552 = HEAP32[(37808)>>2]|0;
 $553 = $552 & 4;
 $554 = ($553|0)==(0);
 L255: do {
  if ($554) {
   $555 = HEAP32[(37388)>>2]|0;
   $556 = ($555|0)==(0|0);
   L257: do {
    if ($556) {
     label = 172;
    } else {
     $$0$i17$i = (37812);
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
      $569 = HEAP32[(37840)>>2]|0;
      $570 = (($569) + -1)|0;
      $571 = $570 & $568;
      $572 = ($571|0)==(0);
      $573 = (($570) + ($568))|0;
      $574 = (0 - ($569))|0;
      $575 = $573 & $574;
      $576 = (($575) - ($568))|0;
      $577 = $572 ? 0 : $576;
      $$$i = (($577) + ($544))|0;
      $578 = HEAP32[(37796)>>2]|0;
      $579 = (($$$i) + ($578))|0;
      $580 = ($$$i>>>0)>($$0197>>>0);
      $581 = ($$$i>>>0)<(2147483647);
      $or$cond$i211 = $580 & $581;
      if ($or$cond$i211) {
       $582 = HEAP32[(37804)>>2]|0;
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
       $601 = HEAP32[(37844)>>2]|0;
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
   $611 = HEAP32[(37808)>>2]|0;
   $612 = $611 | 4;
   HEAP32[(37808)>>2] = $612;
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
  $623 = HEAP32[(37796)>>2]|0;
  $624 = (($623) + ($$723947$i))|0;
  HEAP32[(37796)>>2] = $624;
  $625 = HEAP32[(37800)>>2]|0;
  $626 = ($624>>>0)>($625>>>0);
  if ($626) {
   HEAP32[(37800)>>2] = $624;
  }
  $627 = HEAP32[(37388)>>2]|0;
  $628 = ($627|0)==(0|0);
  do {
   if ($628) {
    $629 = HEAP32[(37380)>>2]|0;
    $630 = ($629|0)==(0|0);
    $631 = ($$748$i>>>0)<($629>>>0);
    $or$cond12$i = $630 | $631;
    if ($or$cond12$i) {
     HEAP32[(37380)>>2] = $$748$i;
    }
    HEAP32[(37812)>>2] = $$748$i;
    HEAP32[(37816)>>2] = $$723947$i;
    HEAP32[(37824)>>2] = 0;
    $632 = HEAP32[9459]|0;
    HEAP32[(37400)>>2] = $632;
    HEAP32[(37396)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $633 = $$01$i$i << 1;
     $634 = (37404 + ($633<<2)|0);
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
    HEAP32[(37388)>>2] = $646;
    HEAP32[(37376)>>2] = $647;
    $648 = $647 | 1;
    $649 = ((($646)) + 4|0);
    HEAP32[$649>>2] = $648;
    $650 = (($646) + ($647)|0);
    $651 = ((($650)) + 4|0);
    HEAP32[$651>>2] = 40;
    $652 = HEAP32[(37852)>>2]|0;
    HEAP32[(37392)>>2] = $652;
   } else {
    $$024370$i = (37812);
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
       $668 = HEAP32[(37376)>>2]|0;
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
       HEAP32[(37388)>>2] = $676;
       HEAP32[(37376)>>2] = $678;
       $679 = $678 | 1;
       $680 = ((($676)) + 4|0);
       HEAP32[$680>>2] = $679;
       $681 = (($676) + ($678)|0);
       $682 = ((($681)) + 4|0);
       HEAP32[$682>>2] = 40;
       $683 = HEAP32[(37852)>>2]|0;
       HEAP32[(37392)>>2] = $683;
       break;
      }
     }
    }
    $684 = HEAP32[(37380)>>2]|0;
    $685 = ($$748$i>>>0)<($684>>>0);
    if ($685) {
     HEAP32[(37380)>>2] = $$748$i;
     $749 = $$748$i;
    } else {
     $749 = $684;
    }
    $686 = (($$748$i) + ($$723947$i)|0);
    $$124469$i = (37812);
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
      $$0$i$i$i = (37812);
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
        $723 = HEAP32[(37376)>>2]|0;
        $724 = (($723) + ($719))|0;
        HEAP32[(37376)>>2] = $724;
        HEAP32[(37388)>>2] = $718;
        $725 = $724 | 1;
        $726 = ((($718)) + 4|0);
        HEAP32[$726>>2] = $725;
       } else {
        $727 = HEAP32[(37384)>>2]|0;
        $728 = ($714|0)==($727|0);
        if ($728) {
         $729 = HEAP32[(37372)>>2]|0;
         $730 = (($729) + ($719))|0;
         HEAP32[(37372)>>2] = $730;
         HEAP32[(37384)>>2] = $718;
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
           $746 = (37404 + ($745<<2)|0);
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
            $756 = HEAP32[9341]|0;
            $757 = $756 & $755;
            HEAP32[9341] = $757;
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
           $794 = (37668 + ($793<<2)|0);
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
             $799 = HEAP32[(37368)>>2]|0;
             $800 = $799 & $798;
             HEAP32[(37368)>>2] = $800;
             break L326;
            } else {
             $801 = HEAP32[(37380)>>2]|0;
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
           $808 = HEAP32[(37380)>>2]|0;
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
           $820 = HEAP32[(37380)>>2]|0;
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
         $835 = (37404 + ($834<<2)|0);
         $836 = HEAP32[9341]|0;
         $837 = 1 << $832;
         $838 = $836 & $837;
         $839 = ($838|0)==(0);
         do {
          if ($839) {
           $840 = $836 | $837;
           HEAP32[9341] = $840;
           $$pre$i19$i = ((($835)) + 8|0);
           $$0294$i$i = $835;$$pre$phi$i20$iZ2D = $$pre$i19$i;
          } else {
           $841 = ((($835)) + 8|0);
           $842 = HEAP32[$841>>2]|0;
           $843 = HEAP32[(37380)>>2]|0;
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
        $873 = (37668 + ($$0295$i$i<<2)|0);
        $874 = ((($718)) + 28|0);
        HEAP32[$874>>2] = $$0295$i$i;
        $875 = ((($718)) + 16|0);
        $876 = ((($875)) + 4|0);
        HEAP32[$876>>2] = 0;
        HEAP32[$875>>2] = 0;
        $877 = HEAP32[(37368)>>2]|0;
        $878 = 1 << $$0295$i$i;
        $879 = $877 & $878;
        $880 = ($879|0)==(0);
        if ($880) {
         $881 = $877 | $878;
         HEAP32[(37368)>>2] = $881;
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
         $900 = HEAP32[(37380)>>2]|0;
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
         $907 = HEAP32[(37380)>>2]|0;
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
      $$0$i$i$i = (37812);
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
    HEAP32[(37388)>>2] = $944;
    HEAP32[(37376)>>2] = $945;
    $946 = $945 | 1;
    $947 = ((($944)) + 4|0);
    HEAP32[$947>>2] = $946;
    $948 = (($944) + ($945)|0);
    $949 = ((($948)) + 4|0);
    HEAP32[$949>>2] = 40;
    $950 = HEAP32[(37852)>>2]|0;
    HEAP32[(37392)>>2] = $950;
    $951 = ((($933)) + 4|0);
    HEAP32[$951>>2] = 27;
    ;HEAP32[$934>>2]=HEAP32[(37812)>>2]|0;HEAP32[$934+4>>2]=HEAP32[(37812)+4>>2]|0;HEAP32[$934+8>>2]=HEAP32[(37812)+8>>2]|0;HEAP32[$934+12>>2]=HEAP32[(37812)+12>>2]|0;
    HEAP32[(37812)>>2] = $$748$i;
    HEAP32[(37816)>>2] = $$723947$i;
    HEAP32[(37824)>>2] = 0;
    HEAP32[(37820)>>2] = $934;
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
      $966 = (37404 + ($965<<2)|0);
      $967 = HEAP32[9341]|0;
      $968 = 1 << $963;
      $969 = $967 & $968;
      $970 = ($969|0)==(0);
      if ($970) {
       $971 = $967 | $968;
       HEAP32[9341] = $971;
       $$pre$i$i = ((($966)) + 8|0);
       $$0211$i$i = $966;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $972 = ((($966)) + 8|0);
       $973 = HEAP32[$972>>2]|0;
       $974 = HEAP32[(37380)>>2]|0;
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
     $1004 = (37668 + ($$0212$i$i<<2)|0);
     $1005 = ((($627)) + 28|0);
     HEAP32[$1005>>2] = $$0212$i$i;
     $1006 = ((($627)) + 20|0);
     HEAP32[$1006>>2] = 0;
     HEAP32[$931>>2] = 0;
     $1007 = HEAP32[(37368)>>2]|0;
     $1008 = 1 << $$0212$i$i;
     $1009 = $1007 & $1008;
     $1010 = ($1009|0)==(0);
     if ($1010) {
      $1011 = $1007 | $1008;
      HEAP32[(37368)>>2] = $1011;
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
      $1030 = HEAP32[(37380)>>2]|0;
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
      $1037 = HEAP32[(37380)>>2]|0;
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
  $1045 = HEAP32[(37376)>>2]|0;
  $1046 = ($1045>>>0)>($$0197>>>0);
  if ($1046) {
   $1047 = (($1045) - ($$0197))|0;
   HEAP32[(37376)>>2] = $1047;
   $1048 = HEAP32[(37388)>>2]|0;
   $1049 = (($1048) + ($$0197)|0);
   HEAP32[(37388)>>2] = $1049;
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
 $3 = HEAP32[(37380)>>2]|0;
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
   $19 = HEAP32[(37384)>>2]|0;
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
    HEAP32[(37372)>>2] = $17;
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
    $28 = (37404 + ($27<<2)|0);
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
     $37 = HEAP32[9341]|0;
     $38 = $37 & $36;
     HEAP32[9341] = $38;
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
    $75 = (37668 + ($74<<2)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = ($16|0)==($76|0);
    if ($77) {
     HEAP32[$75>>2] = $$3;
     $cond418 = ($$3|0)==(0|0);
     if ($cond418) {
      $78 = 1 << $74;
      $79 = $78 ^ -1;
      $80 = HEAP32[(37368)>>2]|0;
      $81 = $80 & $79;
      HEAP32[(37368)>>2] = $81;
      $$1 = $16;$$1380 = $17;
      break;
     }
    } else {
     $82 = HEAP32[(37380)>>2]|0;
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
    $89 = HEAP32[(37380)>>2]|0;
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
     $101 = HEAP32[(37380)>>2]|0;
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
  $120 = HEAP32[(37388)>>2]|0;
  $121 = ($10|0)==($120|0);
  if ($121) {
   $122 = HEAP32[(37376)>>2]|0;
   $123 = (($122) + ($$1380))|0;
   HEAP32[(37376)>>2] = $123;
   HEAP32[(37388)>>2] = $$1;
   $124 = $123 | 1;
   $125 = ((($$1)) + 4|0);
   HEAP32[$125>>2] = $124;
   $126 = HEAP32[(37384)>>2]|0;
   $127 = ($$1|0)==($126|0);
   if (!($127)) {
    return;
   }
   HEAP32[(37384)>>2] = 0;
   HEAP32[(37372)>>2] = 0;
   return;
  }
  $128 = HEAP32[(37384)>>2]|0;
  $129 = ($10|0)==($128|0);
  if ($129) {
   $130 = HEAP32[(37372)>>2]|0;
   $131 = (($130) + ($$1380))|0;
   HEAP32[(37372)>>2] = $131;
   HEAP32[(37384)>>2] = $$1;
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
    $144 = (37404 + ($143<<2)|0);
    $145 = ($140|0)==($144|0);
    if (!($145)) {
     $146 = HEAP32[(37380)>>2]|0;
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
     $154 = HEAP32[9341]|0;
     $155 = $154 & $153;
     HEAP32[9341] = $155;
     break;
    }
    $156 = ($142|0)==($144|0);
    if ($156) {
     $$pre438 = ((($142)) + 8|0);
     $$pre$phi439Z2D = $$pre438;
    } else {
     $157 = HEAP32[(37380)>>2]|0;
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
      $190 = HEAP32[(37380)>>2]|0;
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
      $170 = HEAP32[(37380)>>2]|0;
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
     $195 = (37668 + ($194<<2)|0);
     $196 = HEAP32[$195>>2]|0;
     $197 = ($10|0)==($196|0);
     if ($197) {
      HEAP32[$195>>2] = $$3398;
      $cond419 = ($$3398|0)==(0|0);
      if ($cond419) {
       $198 = 1 << $194;
       $199 = $198 ^ -1;
       $200 = HEAP32[(37368)>>2]|0;
       $201 = $200 & $199;
       HEAP32[(37368)>>2] = $201;
       break;
      }
     } else {
      $202 = HEAP32[(37380)>>2]|0;
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
     $209 = HEAP32[(37380)>>2]|0;
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
      $221 = HEAP32[(37380)>>2]|0;
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
  $228 = HEAP32[(37384)>>2]|0;
  $229 = ($$1|0)==($228|0);
  if ($229) {
   HEAP32[(37372)>>2] = $136;
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
  $237 = (37404 + ($236<<2)|0);
  $238 = HEAP32[9341]|0;
  $239 = 1 << $234;
  $240 = $238 & $239;
  $241 = ($240|0)==(0);
  if ($241) {
   $242 = $238 | $239;
   HEAP32[9341] = $242;
   $$pre = ((($237)) + 8|0);
   $$0401 = $237;$$pre$phiZ2D = $$pre;
  } else {
   $243 = ((($237)) + 8|0);
   $244 = HEAP32[$243>>2]|0;
   $245 = HEAP32[(37380)>>2]|0;
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
 $275 = (37668 + ($$0394<<2)|0);
 $276 = ((($$1)) + 28|0);
 HEAP32[$276>>2] = $$0394;
 $277 = ((($$1)) + 16|0);
 $278 = ((($$1)) + 20|0);
 HEAP32[$278>>2] = 0;
 HEAP32[$277>>2] = 0;
 $279 = HEAP32[(37368)>>2]|0;
 $280 = 1 << $$0394;
 $281 = $279 & $280;
 $282 = ($281|0)==(0);
 do {
  if ($282) {
   $283 = $279 | $280;
   HEAP32[(37368)>>2] = $283;
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
    $302 = HEAP32[(37380)>>2]|0;
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
    $309 = HEAP32[(37380)>>2]|0;
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
 $316 = HEAP32[(37396)>>2]|0;
 $317 = (($316) + -1)|0;
 HEAP32[(37396)>>2] = $317;
 $318 = ($317|0)==(0);
 if ($318) {
  $$0211$in$i = (37820);
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
 HEAP32[(37396)>>2] = -1;
 return;
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

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}


function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&3](a1|0);
}

function b0(p0) {
 p0 = p0|0; abort(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(1);return 0;
}
function b2(p0) {
 p0 = p0|0; abort(2);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,___stdio_write,___stdio_seek,___stdout_write,___stdio_read,_sn_write,b1,b1];
var FUNCTION_TABLE_vi = [b2,_cleanup_88,_cleanup,b2];

  return { _i64Subtract: _i64Subtract, _free: _free, _main: _main, _i64Add: _i64Add, _pthread_self: _pthread_self, _memset: _memset, _llvm_cttz_i32: _llvm_cttz_i32, _malloc: _malloc, _memcpy: _memcpy, _bitshift64Shl: _bitshift64Shl, _bitshift64Lshr: _bitshift64Lshr, ___udivdi3: ___udivdi3, ___uremdi3: ___uremdi3, ___errno_location: ___errno_location, ___udivmoddi4: ___udivmoddi4, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, dynCall_vi: dynCall_vi };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

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
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
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
