
// buildworker - worker thread that runs builds. The worker build system
// replaces globals (fetch, XMLHttpRequest, window), so it must not run in the
// shared extension host.

import { parentPort, workerData } from 'worker_threads';
import { Rpc } from './rpc';
import { Builder, ProjectFileProvider, listPlatforms } from './buildcore';

export interface BuildArgs {
  /** echoed to the host's readFile handler, so it knows the project root */
  buildId: number;
  platform: string;
  mainPath: string;
  mainText: string;
  tool?: string;
}

const builder = new Builder(workerData.rootDir);

const rpc = new Rpc(parentPort, {
  build(args: BuildArgs) {
    var read = (rel: string) => rpc.call<Uint8Array | null>('readFile', args.buildId, rel);
    return builder.build({
      platform: args.platform,
      mainPath: args.mainPath,
      mainText: args.mainText,
      tool: args.tool,
      files: new ProjectFileProvider(read, builder.rootDir, args.platform),
    });
  },
  listPlatforms,
});
