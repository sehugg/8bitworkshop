"use strict";
/**
 * Doc comment extraction shared across all tiers.
 * Extracts brief/detail/section from C-style comments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDocComment = extractDocComment;
exports.extractTrailingComment = extractTrailingComment;
/** Check if a comment line is a banner (decoration) */
function isBannerLine(line) {
    const stripped = line.trim();
    if (stripped.length === 0)
        return false;
    const nonBanner = stripped.replace(/[*\-=\/#]/g, '');
    return nonBanner.length === 0 || nonBanner.length / stripped.length < 0.2;
}
/** Extract section from a banner comment line */
function extractBannerSection(line) {
    let stripped = line.trim();
    stripped = stripped.replace(/^\s*\/\*\*?/, '').replace(/\*\/$/, '').replace(/^#\s?/, '').trim();
    if (/^[A-Z][A-Z0-9 _]*$/.test(stripped) && stripped.length <= 40) {
        return stripped;
    }
    return null;
}
/** Extract doc info from lines above position `lineNo` (1-based). */
function extractDocComment(lines, lineNo) {
    const docLines = [];
    let section = null;
    let i = lineNo - 2;
    // Skip blank lines immediately above
    while (i >= 0 && lines[i].trim() === '') {
        i--;
    }
    if (i < 0)
        return null;
    // Check for doc block (/** ... */)
    const docBlockRegex = /^\s*\/\*\*(.*)\*\/\s*$/;
    const docBlockMatch = lines[i].match(docBlockRegex);
    if (docBlockMatch) {
        docLines.push(docBlockMatch[1].trim());
        i--;
        while (i >= 0) {
            const m = lines[i].match(docBlockRegex);
            if (m) {
                docLines.unshift(m[1].trim());
                i--;
            }
            else {
                break;
            }
        }
    }
    else {
        // Collect plain comments above (no blank line between)
        let hasBlank = false;
        while (i >= 0 && !hasBlank) {
            const line = lines[i].trim();
            if (line === '') {
                hasBlank = true;
                break;
            }
            if (isBannerLine(line)) {
                const bannerSection = extractBannerSection(line);
                if (bannerSection) {
                    section = bannerSection;
                }
                i--;
                continue;
            }
            if (line.startsWith('//') || line.startsWith('/*')) {
                docLines.unshift(line);
                i--;
            }
            else {
                break;
            }
        }
        if (docLines.length === 0)
            return null;
    }
    return parseDocLines(docLines, section);
}
/** Parse collected comment lines into structured doc info */
function parseDocLines(lines, sectionOverride) {
    const cleaned = [];
    for (let line of lines) {
        // Strip leading //
        line = line.replace(/^\s*\/\/\s*/, '').trim();
        // Strip leading /* */ style
        line = line.replace(/^\s*\/\*/, '').replace(/\*\/\s*$/, '').trim();
        // Strip leading * (common in block comments)
        line = line.replace(/^\s*\*\s*/, '').trim();
        // Strip ;; decoration
        line = line.replace(/^;;\s/, '').trim();
        // Strip leading # decoration
        line = line.replace(/^#\s/, '').trim();
        // Collapse multiple spaces
        line = line.replace(/\s+/g, ' ').trim();
        if (line.length > 0) {
            cleaned.push(line);
        }
    }
    if (cleaned.length === 0)
        return null;
    let fullText = cleaned.join(' ');
    let brief;
    let detail;
    const periodSpaceIdx = fullText.indexOf('. ');
    if (periodSpaceIdx >= 0) {
        brief = fullText.substring(0, periodSpaceIdx + 1).trim();
        detail = fullText.substring(periodSpaceIdx + 2).trim();
    }
    else {
        brief = fullText;
    }
    const result = {
        brief: brief && brief.length > 0 ? brief : undefined,
        detail: detail && detail.length > 0 ? detail : undefined,
        section: sectionOverride || undefined
    };
    if (result.detail && result.brief && result.brief.endsWith('.')) {
        result.brief = result.brief.slice(0, -1);
    }
    if (!result.brief && !result.detail)
        return null;
    return result;
}
/** Extract doc info from a trailing comment on the same line */
function extractTrailingComment(line) {
    const trailingSlash = line.match(/\/\/\s*(.*)$/);
    if (trailingSlash && trailingSlash[1]) {
        return trailingSlash[1].trim();
    }
    const trailingBlock = line.match(/\/\*\s*(.*?)\*\/\s*$/);
    if (trailingBlock && trailingBlock[1]) {
        return trailingBlock[1].trim();
    }
    return undefined;
}
//# sourceMappingURL=doccomment.js.map