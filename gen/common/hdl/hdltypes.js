"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HDLFile = void 0;
exports.isLogicType = isLogicType;
exports.isArrayType = isArrayType;
exports.hasDataType = hasDataType;
exports.isVarDecl = isVarDecl;
exports.isConstExpr = isConstExpr;
exports.isBigConstExpr = isBigConstExpr;
exports.isVarRef = isVarRef;
exports.isUnop = isUnop;
exports.isBinop = isBinop;
exports.isTriop = isTriop;
exports.isWhileop = isWhileop;
exports.isBlock = isBlock;
exports.isFuncCall = isFuncCall;
exports.isArrayItem = isArrayItem;
function isLogicType(arg) {
    return typeof arg.left === 'number' && typeof arg.right === 'number';
}
function isArrayType(arg) {
    return arg.subtype != null && arg.low != null && arg.high != null
        && typeof arg.low.cvalue === 'number' && typeof arg.high.cvalue === 'number';
}
class HDLFile {
}
exports.HDLFile = HDLFile;
function hasDataType(arg) {
    return typeof arg.dtype === 'object';
}
function isVarDecl(arg) {
    return typeof arg.isParam !== 'undefined';
}
function isConstExpr(arg) {
    return typeof arg.cvalue === 'number';
}
function isBigConstExpr(arg) {
    return typeof arg.bigvalue === 'bigint';
}
function isVarRef(arg) {
    return arg.refname != null;
}
function isUnop(arg) {
    return arg.op != null && arg.left != null && arg.right == null;
}
function isBinop(arg) {
    return arg.op != null && arg.left != null && arg.right != null && arg.cond == null;
}
function isTriop(arg) {
    return arg.op != null && arg.cond != null;
}
function isWhileop(arg) {
    return arg.op === 'while' && arg.loopcond != null;
}
function isBlock(arg) {
    return arg.blocktype != null;
}
function isFuncCall(arg) {
    return typeof arg.funcname === 'string';
}
function isArrayItem(arg) {
    return typeof arg.index === 'number' && arg.expr != null;
}
//# sourceMappingURL=hdltypes.js.map