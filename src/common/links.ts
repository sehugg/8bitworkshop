/**
 * Links into the web IDE.
 *
 * The IDE lives at /latest/, which the web server proxies to the newest
 * build (see web/.htaccess), so these links always open the current IDE.
 * The trailing slash matters: /latest without it is a 404.
 */

export const IDE_BASE_URL = 'https://8bitworkshop.com/latest/';

/**
 * A link that opens the web IDE, e.g.
 * ideLink({platform: 'nes', file: 'game.c'}).
 * Parameter values are URL-encoded, and undefined ones are left out.
 */
export function ideLink(params: { [key: string]: string | undefined | null }): string {
  var query = Object.keys(params)
    .filter(key => params[key] != null)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key] as string))
    .join('&');
  return query ? IDE_BASE_URL + '?' + query : IDE_BASE_URL;
}

/**
 * The README.md a published project gets: a badge that opens the project in
 * the IDE, naming the platform, the repository, and the main file.
 */
export function githubReadme(name: string, platform: string, githubURL: string, mainFile: string): string {
  var link = ideLink({ platform: platform, githubURL: githubURL, file: mainFile });
  return `${encodeURIComponent(name)}\n=====\n\n[Open this project in 8bitworkshop](${link}).\n`;
}
