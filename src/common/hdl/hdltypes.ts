import { SourceLocation } from "../workertypes";

export interface HDLModuleRunner {
    state: any; // live state or proxy object
    eval() : void;
    tick() : void;
    tick2(iters: number) : void;
    powercycle() : void;
    isFinished() : boolean;
    isStopped() : boolean;
    getGlobals() : {};
    saveState() : {};
    loadState(state: {}) : void;
    dispose() : void;
    getFileData : (filename : string) => string|Uint8Array;
}

export interface HDLModuleTrace extends HDLModuleRunner {
    trace: any;
    resetTrace() : void;
    nextTrace() : void;
}

///

export interface HDLLogicType extends HDLSourceObject {
    left: number;
    right: number;
    signed: boolean;
}

export interface HDLUnpackArray extends HDLSourceObject {
    subtype: HDLDataType;
    low: HDLConstant;
    high: HDLConstant;
}

export interface HDLNativeType extends HDLSourceObject {
    jstype: string;
}

export type HDLDataType = HDLLogicType | HDLUnpackArray | HDLNativeType;

export function isLogicType(arg:any): arg is HDLLogicType {
    return typeof arg.left === 'number' && typeof arg.right === 'number';
}

export function isArrayType(arg:any): arg is HDLUnpackArray {
    return arg.subtype != null && arg.low != null && arg.high != null
      && typeof arg.low.cvalue === 'number' && typeof arg.high.cvalue === 'number';
}

export class HDLFile {
    id: string;
    filename: string;
    isModule: boolean;
}

export interface HDLSourceLocation extends SourceLocation {
    hdlfile: HDLFile;
    end_line?: number;
}

export interface HDLSourceObject {
    $loc?: HDLSourceLocation;
}

export interface HDLDataTypeObject extends HDLSourceObject {
    dtype: HDLDataType;
}

export function hasDataType(arg: any) : arg is HDLDataTypeObject {
    return typeof arg.dtype === 'object';
}

export interface HDLModuleDef extends HDLSourceObject {
    name: string;
    origName: string;
    blocks: HDLBlock[];
    instances: HDLInstanceDef[];
    vardefs: { [id:string] : HDLVariableDef };
}

export interface HDLVariableDef extends HDLDataTypeObject {
    name: string;
    origName: string;
    isInput: boolean;
    isOutput: boolean;
    isParam: boolean;
    constValue?: HDLConstant;
    initValue?: HDLBlock;
}

export function isVarDecl(arg:any): arg is HDLVariableDef {
    return typeof arg.isParam !== 'undefined';
}

export interface HDLConstant extends HDLDataTypeObject {
    cvalue: number;
    bigvalue: bigint;
}

export function isConstExpr(arg:any): arg is HDLConstant {
    return typeof arg.cvalue === 'number';
}

export function isBigConstExpr(arg:any): arg is HDLConstant {
    return typeof arg.bigvalue === 'bigint';
}

export interface HDLHierarchyDef extends HDLSourceObject {
    name: string;
    module: HDLModuleDef;
    parent: HDLHierarchyDef;
    children: HDLHierarchyDef[];
}

export interface HDLInstanceDef extends HDLSourceObject {
    name: string;
    origName: string;
    module: HDLModuleDef;
    ports: HDLPort[];
}

export interface HDLVarRef extends HDLDataTypeObject {
    refname: string;
    //TODO? vardef: HDLVariableDef;
}

export function isVarRef(arg:any): arg is HDLVarRef {
    return arg.refname != null;
}

export interface HDLUnop extends HDLDataTypeObject {
    op: string;
    left: HDLExpr;
}

export interface HDLExtendop extends HDLUnop {
    width: number;
    widthminv: number;
}

export function isUnop(arg:any): arg is HDLUnop {
    return arg.op != null && arg.left != null && arg.right == null;
}

export interface HDLBinop extends HDLUnop {
    right: HDLExpr;
}

export function isBinop(arg:any): arg is HDLBinop {
    return arg.op != null && arg.left != null && arg.right != null && arg.cond == null;
}

export interface HDLTriop extends HDLBinop {
    cond: HDLExpr;
}

export function isTriop(arg:any): arg is HDLTriop {
    return arg.op != null && arg.cond != null;
}

export interface HDLWhileOp extends HDLDataTypeObject {
    op: 'while';
    precond: HDLExpr;
    loopcond: HDLExpr;
    body: HDLExpr;
    inc: HDLExpr;
}

export function isWhileop(arg:any): arg is HDLWhileOp {
    return arg.op === 'while' && arg.loopcond != null;
}

export interface HDLBlock extends HDLSourceObject {
    blocktype: string;
    name: string;
    exprs: HDLExpr[];
}

export function isBlock(arg:any): arg is HDLBlock {
    return arg.blocktype != null;
}

export interface HDLAlwaysBlock extends HDLBlock {
    senlist: HDLSensItem[];
}

export interface HDLSensItem extends HDLSourceObject {
    edgeType : "POS" | "NEG";
    expr: HDLExpr;
}

export interface HDLPort extends HDLSourceObject {
    name: string;
    expr: HDLExpr;
}

export interface HDLFuncCall extends HDLDataTypeObject {
    funcname: string;
    args: HDLExpr[];
}

export function isFuncCall(arg:any): arg is HDLFuncCall {
    return typeof arg.funcname === 'string';
}

export interface HDLArrayItem {
    index: number;
    expr: HDLExpr;
}

export function isArrayItem(arg:any): arg is HDLArrayItem {
    return typeof arg.index === 'number' && arg.expr != null;
}

export type HDLExpr = HDLVarRef | HDLUnop | HDLBinop | HDLTriop | HDLBlock | HDLVariableDef | HDLFuncCall | HDLConstant;

export interface HDLUnit {
    files: { [id: string]: HDLFile };
    dtypes: { [id: string]: HDLDataType };
    modules: { [id: string]: HDLModuleDef };
    hierarchies: { [id: string]: HDLHierarchyDef };
}

export type HDLValue = number | bigint | Uint8Array | Uint16Array | Uint32Array | HDLValue[];

