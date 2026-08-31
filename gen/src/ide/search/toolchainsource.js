"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolchainSource = void 0;
const projectsource_1 = require("./projectsource");
const toolmeta_1 = require("../../common/toolmeta");
/**
 * ToolchainSource - dumb full-text search over the toolchain's bundled
 * header files, served by the worker's preload filesystem (same path the
 * HeaderView uses via readshared/listshared messages).
 *
 * Instead of a prebuilt symbol index (gen/symidx/*.json never shipped), we
 * lazily list files under the tool's include dirs and read their text from
 * the worker in small batches as the user types. Results are low-priority
 * text hits, ranked below project symbols in the unified service.
 */
// File extensions that plausibly contain text to search.
const SEARCHABLE_EXT = new Set(['h', 'hh', 'hpp', 'inc', 'asm', 'a65', 's', 'mac', 'defs', 'def', 'equ', 'i', 'm', 'c', 'bas', 'txt']);
// How many unread header files to fetch from the worker per query.
const BATCH_SIZE = 20;
class ToolchainSource {
    constructor() {
        this.id = 'toolchain';
        this.kind = 'toolchain';
        this.fsName = null;
        this.files = []; // all searchable files (sorted)
        this.loaded = new Map(); // path -> decoded text
        this.readyDone = false;
        this.loadIdx = 0; // next unread file index
        this.batchSize = BATCH_SIZE; // files fetched per query (overridable in tests)
    }
    async ready() {
        if (this.readyDone)
            return;
        this.readyDone = true;
        const project = (0, projectsource_1.getProject)();
        if (!project)
            return;
        let tool;
        try {
            tool = project.getToolForFilename ? project.getToolForFilename(project.mainPath) : '';
        }
        catch (e) {
            tool = '';
        }
        const fsName = (0, toolmeta_1.getSharedFileSystemName)(tool, project.platform_id);
        const dirs = (0, toolmeta_1.getIncludeDirs)(tool, project.platform_id);
        if (!fsName || !dirs.length)
            return;
        this.fsName = fsName;
        // List files under each include dir, e.g. /include, /asminc, /headers.
        const seen = new Set();
        for (const dir of dirs) {
            const files = await this.listFiles(dir);
            for (const f of files) {
                if (this.isSearchable(f) && !seen.has(f)) {
                    seen.add(f);
                    this.files.push(f);
                }
            }
        }
        this.files.sort();
    }
    isValid() {
        return this.fsName != null && this.files.length > 0;
    }
    /** Ask the worker to list files under a directory of the preload fs. */
    async listFiles(dir) {
        const project = (0, projectsource_1.getProject)();
        if (!project || !this.fsName || !project.queryWorker)
            return [];
        try {
            const msg = { preload_fs: this.fsName, listshared: dir, updates: [], buildsteps: [] };
            const result = await project.queryWorker(msg);
            const files = result && result.output;
            return Array.isArray(files) ? files : [];
        }
        catch (e) {
            console.debug('Toolchain list error:', e);
            return [];
        }
    }
    /** Read one file from the worker's preload fs, decoded as text. */
    async readFile(path) {
        const project = (0, projectsource_1.getProject)();
        if (!project || !this.fsName || !project.queryWorker)
            return null;
        try {
            const msg = { preload_fs: this.fsName, readshared: path, updates: [], buildsteps: [] };
            const result = await project.queryWorker(msg);
            const output = result && result.output;
            if (output instanceof Uint8Array && output.length > 0) {
                return new TextDecoder().decode(output);
            }
            return null;
        }
        catch (e) {
            console.debug('Toolchain read error:', e);
            return null;
        }
    }
    isSearchable(path) {
        const base = path.split('/').pop() || path;
        const dot = base.lastIndexOf('.');
        if (dot < 0)
            return true; // no extension: assume text
        return SEARCHABLE_EXT.has(base.substring(dot + 1).toLowerCase());
    }
    /**
     * Load the next batch of unread files (or finish a partially-loaded one).
     * Called per query so keystrokes incrementally widen the searchable corpus.
     */
    async ensureBatch() {
        const project = (0, projectsource_1.getProject)();
        if (!project || !project.queryWorker)
            return;
        while (this.loadIdx < this.files.length) {
            const batch = this.files.slice(this.loadIdx, this.loadIdx + this.batchSize);
            this.loadIdx += batch.length;
            const entries = await Promise.all(batch.map(async (path) => {
                const text = await this.readFile(path);
                return [path, text];
            }));
            for (const [path, text] of entries) {
                if (text != null)
                    this.loaded.set(path, text);
            }
            // Keep loading until we have at least one text file in the batch
            // (binary/skipped files shouldn't stall the palette), but never more
            // than once per query -- the next query pulls the next batch.
            if (this.loaded.size > 0 || this.loadIdx >= this.files.length)
                break;
        }
    }
    async query(needle, limit) {
        await this.ready();
        if (!this.isValid() || needle.length < 2)
            return [];
        await this.ensureBatch();
        return this.textQuery(needle, limit);
    }
    /** Low-priority dumb text search over the loaded header files. */
    textQuery(needle, limit) {
        if (needle.length < 2)
            return [];
        const needleLower = needle.toLowerCase();
        const hits = [];
        const MAX_PER_FILE = Math.max(limit, 5);
        for (const [path, text] of this.loaded) {
            const lines = text.split('\n');
            let fileCount = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineLower = line.toLowerCase();
                const col = lineLower.indexOf(needleLower);
                if (col >= 0) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    hits.push({
                        record: {
                            id: `toolchain:${path}:${i + 1}`,
                            name: trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed,
                            kind: 'text',
                            source: 'toolchain',
                            file: path,
                            line: i + 1,
                        },
                        // Same scoring shape as project fulltext: well below symbols,
                        // slight bonus for match near line start.
                        score: 200 + Math.max(0, 100 - col * 2),
                        ranges: [col, col + needle.length],
                    });
                    if (++fileCount >= MAX_PER_FILE)
                        break;
                }
            }
        }
        hits.sort((a, b) => b.score - a.score);
        return hits.slice(0, limit);
    }
    invalidate() {
        this.fsName = null;
        this.files = [];
        this.loaded.clear();
        this.readyDone = false;
        this.loadIdx = 0;
    }
}
exports.ToolchainSource = ToolchainSource;
//# sourceMappingURL=toolchainsource.js.map