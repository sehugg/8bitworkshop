
enum DataType {
    unknown,
    u8,
    s8,
    u16,
    s16,
    u32,
    s32,
    f32,
    f64,
};

function getArrayDataType(value: any) : DataType {
    if (value instanceof Uint8Array) {
        return DataType.u8;
    } else if (value instanceof Int8Array) {
        return DataType.s8;
    } else if (value instanceof Uint16Array) {
        return DataType.u16;
    } else if (value instanceof Int16Array) {
        return DataType.s16;
    } else if (value instanceof Uint32Array) {
        return DataType.u32;
    } else if (value instanceof Int32Array) {
        return DataType.s32;
    } else if (value instanceof Float32Array) {
        return DataType.f32;
    } else if (value instanceof Float64Array) {
        return DataType.f64;
    }
}

export abstract class OutputFile {
    constructor(
        public readonly path : string,
        public readonly decls : {}
    ) {
    }
    abstract declToText(label: string, value: any) : string;
    toString() : string {
        return Object.entries(this.decls).map(entry => this.declToText(entry[0],entry[1])).join('\n\n');
    }
}

export class COutputFile extends OutputFile {
    toString() : string {
        return `#include <stdint.h>\n\n${super.toString()}\n`;
    }
    dataTypeToString(dtype: DataType) {
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
    valueToString(value, atype: DataType) : string {
        // TODO: round, check value
        return value+"";
    }
    declToText(label: string, value: any) : string {
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

// TODO: header file, auto-detect tool?
export function file(path: string, decls: {}) {
    return new COutputFile(path, decls);
}
