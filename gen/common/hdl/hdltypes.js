"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isArrayItem = exports.isFuncCall = exports.isBlock = exports.isWhileop = exports.isTriop = exports.isBinop = exports.isUnop = exports.isVarRef = exports.isBigConstExpr = exports.isConstExpr = exports.isVarDecl = exports.hasDataType = exports.HDLFile = exports.isArrayType = exports.isLogicType = void 0;
function isLogicType(arg) {
    return typeof arg.left === 'number' && typeof arg.right === 'number';
}
exports.isLogicType = isLogicType;
function isArrayType(arg) {
    return arg.subtype != null && arg.low != null && arg.high != null
        && typeof arg.low.cvalue === 'number' && typeof arg.high.cvalue === 'number';
}
exports.isArrayType = isArrayType;
class HDLFile {
}
exports.HDLFile = HDLFile;
function hasDataType(arg) {
    return typeof arg.dtype === 'object';
}
exports.hasDataType = hasDataType;
function isVarDecl(arg) {
    return typeof arg.isParam !== 'undefined';
}
exports.isVarDecl = isVarDecl;
function isConstExpr(arg) {
    return typeof arg.cvalue === 'number';
}
exports.isConstExpr = isConstExpr;
function isBigConstExpr(arg) {
    return typeof arg.bigvalue === 'bigint';
}
exports.isBigConstExpr = isBigConstExpr;
function isVarRef(arg) {
    return arg.refname != null;
}
exports.isVarRef = isVarRef;
function isUnop(arg) {
    return arg.op != null && arg.left != null && arg.right == null;
}
exports.isUnop = isUnop;
function isBinop(arg) {
    return arg.op != null && arg.left != null && arg.right != null && arg.cond == null;
}
exports.isBinop = isBinop;
function isTriop(arg) {
    return arg.op != null && arg.cond != null;
}
exports.isTriop = isTriop;
function isWhileop(arg) {
    return arg.op === 'while' && arg.loopcond != null;
}
exports.isWhileop = isWhileop;
function isBlock(arg) {
    return arg.blocktype != null;
}
exports.isBlock = isBlock;
function isFuncCall(arg) {
    return typeof arg.funcname === 'string';
}
exports.isFuncCall = isFuncCall;
function isArrayItem(arg) {
    return typeof arg.index === 'number' && arg.expr != null;
}
exports.isArrayItem = isArrayItem;
//# sourceMappingURL=hdltypes.js.map