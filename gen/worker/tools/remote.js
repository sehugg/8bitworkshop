"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRemote = void 0;
const util_1 = require("../../common/util");
const workertypes_1 = require("../../common/workertypes");
const workermain_1 = require("../workermain");
// TODO: are we running from 8bitworkshop.com in this worker?
const REMOTE_URL = "http://localhost:3009/build";
// create random UID
const sessionID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
// TODO: #include links but #link doesnt link
async function buildRemote(step) {
    (0, workermain_1.gatherFiles)(step); // TODO?
    var binpath = "a.out"; // TODO?
    if ((0, workermain_1.staleFiles)(step, [binpath])) {
        // grab files from store
        let updates = [];
        for (var i = 0; i < step.files.length; i++) {
            let path = step.files[i];
            let entry = workermain_1.store.workfs[path];
            // convert to base64
            let data = typeof entry.data === 'string' ? entry.data : btoa((0, util_1.byteArrayToString)(entry.data));
            updates.push({ path, data });
        }
        // build the command
        let cmd = { buildStep: step, updates, sessionID };
        // do a POST to the remote server, sending step as JSON
        console.log('POST', cmd);
        let result = await fetch(REMOTE_URL, {
            method: "POST",
            mode: "cors",
            body: JSON.stringify(cmd),
            headers: {
                "Content-Type": "application/json"
            }
        });
        // return the result as JSON
        let json = await result.json();
        // parse the result as JSON
        if ((0, workertypes_1.isUnchanged)(json))
            return json;
        if ((0, workertypes_1.isErrorResult)(json))
            return json;
        if ((0, workertypes_1.isOutputResult)(json)) {
            json.output = (0, util_1.stringToByteArray)(atob(json.output));
            return json;
        }
        throw new Error(`Unexpected result from remote build: ${JSON.stringify(json)}`);
    }
}
exports.buildRemote = buildRemote;
//# sourceMappingURL=remote.js.map