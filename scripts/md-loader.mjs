// esbuild plugin: import Markdown files as rendered HTML strings.
//
//   import html from './doc/foo.md';
//
// Works in dev (--watch) and prod: esbuild watches the .md source, so edits
// trigger a rebuild. See scripts/build.mjs and the `esbuild` npm script.
import fs from 'node:fs';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,      // allow inline HTML in source docs
  linkify: true,   // turn bare URLs into links
  typographer: true,
});

export default {
  name: 'markdown',
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, (args) => {
      const source = fs.readFileSync(args.path, 'utf8');
      const html = md.render(source);
      return {
        contents: `export default ${JSON.stringify(html)};`,
        loader: 'js',
        // Watch this file for changes (matters in --watch mode).
        watchFiles: [args.path],
      };
    });
  },
};
