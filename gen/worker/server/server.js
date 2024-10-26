"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const buildenv_1 = require("./buildenv");
/*
## Tool Server (not yet used)

```sh
npm run server
xattr -dr com.apple.quarantine llvm-mos/bin/* # macOS only
curl http://localhost:3009/test
go to: http://localhost:8000/?platform=c64&file=hello.c&tool=llvm-mos
```
*/
////////////////////
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: 1024 * 1024 })); // limit 1 MB
app.get('/info', (req, res) => {
    // send a list of supported tools
    res.json({ tools: buildenv_1.TOOLS });
});
app.get('/test1', async (req, res, next) => {
    // quick test of the build
    try {
        const updates = [{ path: 'test.c', data: 'int main() { return 0; }' }];
        const buildStep = { tool: 'llvm-mos', platform: 'c64', files: ['test.c'] };
        const env = new buildenv_1.ServerBuildEnv(SERVER_ROOT, 'test', buildenv_1.TOOLS[0]);
        const result = await env.compileAndLink(buildStep, updates);
        res.json(result);
    }
    catch (err) {
        return next(err);
    }
});
app.get('/test2', async (req, res, next) => {
    // quick test of the build
    try {
        const updates = [{ path: 'test.c', data: 'int main() { return 0; }' }];
        const buildStep = { tool: 'oscar64', platform: 'c64', files: ['test.c'] };
        const env = new buildenv_1.ServerBuildEnv(SERVER_ROOT, 'test', buildenv_1.TOOLS[1]);
        const result = await env.compileAndLink(buildStep, updates);
        res.json(result);
    }
    catch (err) {
        return next(err);
    }
});
app.post('/build', async (req, res, next) => {
    try {
        const updates = req.body.updates;
        const buildStep = req.body.buildStep;
        const sessionID = req.body.sessionID;
        const bestTool = (0, buildenv_1.findBestTool)(buildStep);
        const env = new buildenv_1.ServerBuildEnv(SERVER_ROOT, sessionID, bestTool);
        const result = await env.compileAndLink(buildStep, updates);
        res.json(result);
    }
    catch (err) {
        return next(err);
    }
});
// Catch errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
// Start the server
const port = 3009;
/*{
    origin: [`http://localhost:${port}`, 'http://localhost:8000']
}));*/
const SERVER_ROOT = process.env['_8BITWS_SERVER_ROOT'] || path_1.default.resolve('./server-root');
const SESSION_ROOT = path_1.default.join(SERVER_ROOT, 'sessions');
if (!fs_1.default.existsSync(SESSION_ROOT)) {
    fs_1.default.mkdirSync(SESSION_ROOT);
}
process.chdir(SESSION_ROOT);
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
//# sourceMappingURL=server.js.map