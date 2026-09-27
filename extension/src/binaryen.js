// binaryen - build.mjs aliases the binaryen package to this module, which
// loads it from the worker's asset root: the repo's node_modules in
// development, or the downloaded verilog pack. Only the Verilog platform
// imports it, when it loads.
const path = require('path');
const { workerData } = require('worker_threads');

if (!workerData || !workerData.rootDir) throw new Error('binaryen: no asset root (load the Verilog platform in a worker)');
module.exports = require(path.join(workerData.rootDir, 'node_modules', 'binaryen', 'index.js'));
