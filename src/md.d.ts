// Ambient types for files transformed by build/md-loader.mjs.
// Keeps `tsc` happy when TypeScript files import Markdown.
declare module '*.md' {
  const html: string;
  export default html;
}
