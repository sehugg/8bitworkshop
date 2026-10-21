"use strict";
/**
 * Links into the web IDE.
 *
 * The IDE lives at /latest/, which the web server proxies to the newest
 * build (see web/.htaccess), so these links always open the current IDE.
 * The trailing slash matters: /latest without it is a 404.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDE_BASE_URL = void 0;
exports.ideLink = ideLink;
exports.githubReadme = githubReadme;
exports.IDE_BASE_URL = 'https://8bitworkshop.com/latest/';
/**
 * A link that opens the web IDE, e.g.
 * ideLink({platform: 'nes', file: 'game.c'}).
 * Parameter values are URL-encoded, and undefined ones are left out.
 */
function ideLink(params) {
    var query = Object.keys(params)
        .filter(key => params[key] != null)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
        .join('&');
    return query ? exports.IDE_BASE_URL + '?' + query : exports.IDE_BASE_URL;
}
/**
 * The README.md a published project gets: a badge that opens the project in
 * the IDE, naming the platform, the repository, and the main file.
 */
function githubReadme(name, platform, githubURL, mainFile) {
    var link = ideLink({ platform: platform, githubURL: githubURL, file: mainFile });
    return `${encodeURIComponent(name)}\n=====\n\n[Open this project in 8bitworkshop](${link}).\n`;
}
//# sourceMappingURL=links.js.map