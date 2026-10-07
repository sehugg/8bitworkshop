import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { describe, it } from "mocha";
import { listPresets, PresetEntry } from "../../src/tools/buildpresets";
import { buildSourceFileMessage } from "../../src/tools/testlib";
import { CodeProject, ProjectFilesystem } from "../../src/ide/project";
import { PLATFORMS } from "../../src/common/emu";
import { bytesToFileData, getBasePlatform } from "../../src/common/util";
import { FileData, WorkerMessage } from "../../src/common/workertypes";

// The IDE (CodeProject) and the CLI (testlib) must send the worker the same
// build for the same source. For every preset, build the worker message both
// ways and compare them. Both go through src/common/projectcore.ts; this
// checks the parts that stay separate -- file lookup and tool selection.

// the IDE serves presets from presets/<base platform>/ (WebPresetsFileSystem)
class DiskPresetsFileSystem implements ProjectFilesystem {
  constructor(readonly dir: string) { }
  async getFileData(p: string): Promise<FileData> {
    const fp = path.join('presets', this.dir, p);
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) return null;
    return bytesToFileData(p, new Uint8Array(fs.readFileSync(fp)));
  }
  async setFileData(p: string, data: FileData) { }
  onFileSystemUpdate(cb: (p: string) => void) { }
}

async function ideMessage(e: PresetEntry, mainPath: string): Promise<WorkerMessage> {
  const dir = getBasePlatform(e.platform);
  const plat = new PLATFORMS[e.platform](null);
  const msgs: WorkerMessage[] = [];
  const worker = { postMessage: (m: WorkerMessage) => msgs.push(m) };
  const proj = new CodeProject(worker as any, e.platform, plat, new DiskPresetsFileSystem(dir));
  proj.filedata[mainPath] = fs.readFileSync(path.join('presets', e.preset), 'utf-8');
  proj.mainPath = mainPath;
  await proj.sendBuild();
  return msgs.find((m) => m.buildsteps);
}

// text stays readable in diffs; binary is reduced to length + FNV-1a so a
// text/binary mismatch or a corrupted decode shows up without dumping bytes
function dataFingerprint(d: FileData): string {
  if (typeof d === 'string') return d;
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) {
    h ^= d[i];
    h = Math.imul(h, 16777619);
  }
  return `bin:${d.length}:${(h >>> 0).toString(16)}`;
}

// reduce a message to what the worker acts on
function normalize(msg: WorkerMessage) {
  if (!msg) return null;
  return {
    updates: msg.updates.map((u) => ({ path: u.path, data: dataFingerprint(u.data) })),
    buildsteps: msg.buildsteps,
  };
}

describe('IDE/CLI build message parity', function () {
  this.timeout(120000);

  it('should build every preset the same way in the IDE and CLI', async () => {
    const presets = await listPresets();
    assert.ok(presets.length > 100, 'found ' + presets.length + ' presets');
    const diffs: string[] = [];
    for (const e of presets) {
      const dir = getBasePlatform(e.platform);
      const mainPath = e.buildAs || e.preset.substring(dir.length + 1);
      let ide: any, cli: any;
      try {
        ide = normalize(await ideMessage(e, mainPath));
        cli = normalize(await buildSourceFileMessage(null, e.platform, path.join('presets', e.preset), e.buildAs));
      } catch (err) {
        diffs.push(`${e.preset}: ${err}`);
        continue;
      }
      const dups = ide.updates.filter((u, i) => ide.updates.findIndex((o) => o.path === u.path) != i).map((u) => u.path);
      if (dups.length) diffs.push(`${e.preset}: sent twice: ${dups}`);
      try {
        assert.deepStrictEqual(cli, ide);
      } catch (err) {
        diffs.push(`${e.preset} (${e.platform}):\n  ide=${JSON.stringify(ide)}\n  cli=${JSON.stringify(cli)}`);
      }
    }
    assert.deepStrictEqual(diffs, []);
  });
});
