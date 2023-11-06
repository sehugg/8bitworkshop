
import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WorkerBuildStep, WorkerFileUpdate } from '../../common/workertypes';
import { ServerBuildEnv, TOOLS, findBestTool } from './buildenv';

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

const app = express();

app.use(cors());

app.use(express.json({ limit: 1024*1024 })); // limit 1 MB

app.get('/info', (req: Request, res: Response) => {
    // send a list of supported tools
    res.json({ tools: TOOLS });
});

app.get('/test', async (req: Request, res: Response, next) => {
    // quick test of the build
    try {
        const updates: WorkerFileUpdate[] = [{ path: 'test.c', data: 'int main() { return 0; }' }];
        const buildStep: WorkerBuildStep = { tool: 'llvm-mos', platform: 'c64', files: ['test.c'] };
        const env = new ServerBuildEnv(SERVER_ROOT, 'test', TOOLS[0]);
        const result = await env.compileAndLink(buildStep, updates);
        res.json(result);
    } catch (err) {
        return next(err);
    }
});

app.post('/build', async (req: Request, res: Response, next) => {
    try {
        const updates: WorkerFileUpdate[] = req.body.updates;
        const buildStep: WorkerBuildStep = req.body.buildStep;
        const sessionID = req.body.sessionID;
        const bestTool = findBestTool(buildStep);
        const env = new ServerBuildEnv(SERVER_ROOT, sessionID, bestTool);
        const result = await env.compileAndLink(buildStep, updates);
        res.json(result);
    } catch (err) {
        return next(err);
    }
});

// Catch errors
app.use((err: Error, req: Request, res: Response, next: Function) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
const port = 3009;

/*{
    origin: [`http://localhost:${port}`, 'http://localhost:8000']
}));*/

const SERVER_ROOT = process.env['_8BITWS_SERVER_ROOT'] || path.resolve('./server-root');
const SESSION_ROOT = path.join(SERVER_ROOT, 'sessions');
if (!fs.existsSync(SESSION_ROOT)) {
    fs.mkdirSync(SESSION_ROOT);
}
process.chdir(SESSION_ROOT);

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
