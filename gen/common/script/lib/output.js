"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.file = exports.COutputFile = exports.OutputFile = void 0;
var DataType;
(function (DataType) {
    DataType[DataType["unknown"] = 0] = "unknown";
    DataType[DataType["u8"] = 1] = "u8";
    DataType[DataType["s8"] = 2] = "s8";
    DataType[DataType["u16"] = 3] = "u16";
    DataType[DataType["s16"] = 4] = "s16";
    DataType[DataType["u32"] = 5] = "u32";
    DataType[DataType["s32"] = 6] = "s32";
    DataType[DataType["f32"] = 7] = "f32";
    DataType[DataType["f64"] = 8] = "f64";
})(DataType || (DataType = {}));
;
function getArrayDataType(value) {
    if (value instanceof Uint8Array) {
        return DataType.u8;
    }
    else if (value instanceof Int8Array) {
        return DataType.s8;
    }
    else if (value instanceof Uint16Array) {
        return DataType.u16;
    }
    else if (value instanceof Int16Array) {
        return DataType.s16;
    }
    else if (value instanceof Uint32Array) {
        return DataType.u32;
    }
    else if (value instanceof Int32Array) {
        return DataType.s32;
    }
    else if (value instanceof Float32Array) {
        return DataType.f32;
    }
    else if (value instanceof Float64Array) {
        return DataType.f64;
    }
}
class OutputFile {
    constructor(path, decls) {
        this.path = path;
        this.decls = decls;
    }
    toString() {
        return Object.entries(this.decls).map(entry => this.declToText(entry[0], entry[1])).join('\n\n');
    }
}
exports.OutputFile = OutputFile;
class COutputFile extends OutputFile {
    toString() {
        return `#include <stdint.h>\n\n${super.toString()}\n`;
    }
    dataTypeToString(dtype) {
        switch (dtype) {
            case DataType.u8: return 'uint8_t';
            case DataType.s8: return 'int8_t';
            case DataType.u16: return 'uint16_t';
            case DataType.s16: return 'int16_t';
            case DataType.u32: return 'uint32_t';
            case DataType.s32: return 'int32_t';
            case DataType.f32: return 'float';
            case DataType.f64: return 'double';
            default:
                throw new Error('Cannot convert data type'); // TODO
        }
    }
    valueToString(value, atype) {
        // TODO: round, check value
        return value + "";
    }
    declToText(label, value) {
        if (Array.isArray(value) || value['BYTES_PER_ELEMENT']) {
            let atype = getArrayDataType(value);
            if (atype != null) {
                let dtypestr = this.dataTypeToString(atype);
                let dtext = value.map(elem => this.valueToString(elem, atype)).join(',');
                let len = value.length;
                return `${dtypestr} ${label}[${len}] = { ${dtext} };`;
            }
        }
        throw new Error(`Cannot convert array "${label}"`); // TODO
    }
}
exports.COutputFile = COutputFile;
// TODO: header file, auto-detect tool?
function file(path, decls) {
    return new COutputFile(path, decls);
}
exports.file = file;
//# sourceMappingURL=output.js.map