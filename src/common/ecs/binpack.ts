
var debug = false;

export interface BoxConstraints {
    left?: number;
    top?: number;
    width: number;
    height: number;
    box?: PlacedBox;
    label?: string;
}

enum BoxPlacement {
    TopLeft=0, TopRight=1, BottomLeft=2, BottomRight=3
}

export interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface PlacedBox extends Box {
    bin: Bin;
    parents: Box[];
    place: BoxPlacement;
}

function boxesIntersect(a: Box, b: Box) : boolean {
    return !(b.left >= a.right || b.right <= a.left || b.top >= a.bottom || b.bottom <= a.top);
}

function boxesContain(a: Box, b: Box) : boolean {
    return b.left >= a.left && b.top >= a.top && b.right <= a.right && b.bottom <= a.bottom;
}

export class Bin {
    boxes: Box[] = [];
    free: Box[] = [];
    extents: Box = {left:0,top:0,right:0,bottom:0};

    constructor(public readonly binbounds: Box) {
        this.free.push(binbounds);
    }
    getBoxes(bounds: Box, limit: number, boxes?: Box[]) : Box[] {
        let result = [];
        if (!boxes) boxes = this.boxes;
        for (let box of boxes) {
            //console.log(bounds, box, boxesIntersect(bounds, box))
            if (boxesIntersect(bounds, box)) {
                result.push(box);
                if (result.length >= limit) break;
            }
        }
        return result;
    }
    fits(b: Box) {
        if (!boxesContain(this.binbounds, b)) {
            if (debug) console.log('out of bounds!', b.left,b.top,b.right,b.bottom);
            return false;
        }
        if (this.getBoxes(b, 1).length > 0) {
            if (debug) console.log('intersect!', b.left,b.top,b.right,b.bottom);
            return false;
        }
        return true;
    }
    bestFit(b: BoxConstraints) : Box | null {
        let bestscore = 0;
        let best = null;
        for (let f of this.free) {
            if (b.left != null && b.left < f.left) continue;
            if (b.left != null && b.left + b.width > f.right) continue;
            if (b.top != null && b.top < f.top) continue;
            if (b.top != null && b.top + b.height > f.bottom) continue;
            let dx = (f.right - f.left) - b.width;
            let dy = (f.bottom - f.top) - b.height;
            if (dx >= 0 && dy >= 0) {
                let score = 1 / (1 + dx + dy + f.left * 0.001);
                if (score > bestscore) {
                    best = f;
                    bestscore = score;
                    if (score == 1) break;
                }
            }
        }
        return best;
    }
    anyFit(b: BoxConstraints) : Box | null {
        let bestscore = 0;
        let best = null;
        for (let f of this.free) {
            let box : Box = { 
                left: b.left != null ? b.left : f.left, 
                right: f.left + b.width,
                top: b.top != null ? b.top : f.top,
                bottom: f.top + b.height };
            if (this.fits(box)) {
                let score = 1 / (1 + box.left + box.top);
                if (score > bestscore) {
                    best = f;
                    if (score == 1) break;
                }
            }
        }
        return best;
    }
    add(b: PlacedBox) {
        if (debug) console.log('add', b.left,b.top,b.right,b.bottom);
        if (!this.fits(b)) {
            //console.log('collided with', this.getBoxes(b, 1));
            throw new Error(`bad fit ${b.left} ${b.top} ${b.right} ${b.bottom}`)
        }
        // add box to list
        this.boxes.push(b);
        this.extents.right = Math.max(this.extents.right, b.right);
        this.extents.bottom = Math.max(this.extents.bottom, b.bottom);
        // delete bin
        for (let p of b.parents) {
            let i = this.free.indexOf(p);
            if (i < 0) throw new Error('cannot find parent');
            if (debug) console.log('removed',p.left,p.top,p.right,p.bottom);
            this.free.splice(i, 1);
            // split into new bins
            // make long columns
            this.addFree(p.left, p.top, b.left, p.bottom);
            this.addFree(b.right, p.top, p.right, p.bottom);
            // make top caps
            this.addFree(b.left, p.top, b.right, b.top);
            this.addFree(b.left, b.bottom, b.right, p.bottom);
        }
    }
    addFree(left: number, top: number, right: number, bottom: number) {
        if (bottom > top && right > left) {
            let b = { left, top, right, bottom };
            if (debug) console.log('free',b.left,b.top,b.right,b.bottom);
            this.free.push(b);
        }
        // TODO: merge free boxes?
    }
}

export class Packer {
    bins : Bin[] = [];
    boxes : BoxConstraints[] = [];
    defaultPlacement : BoxPlacement = BoxPlacement.TopLeft; //TODO

    pack() : boolean {
        for (let bc of this.boxes) {
            let box = this.bestPlacement(bc);
            if (!box) return false;
            box.bin.add(box);
            bc.box = box;
        }
        return true;
    }
    bestPlacement(b: BoxConstraints) : PlacedBox | null {
        for (let bin of this.bins) {
            let parent = bin.bestFit(b);
            let approx = false;
            if (!parent) {
                parent = bin.anyFit(b);
                approx = true;
                if (debug) console.log('anyfit',parent?.left,parent?.top);
            }
            if (parent) {
                let place = this.defaultPlacement;
                let box = {
                    left: parent.left,
                    top: parent.top,
                    right: parent.left + b.width,
                    bottom: parent.top + b.height
                };
                if (b.left != null) {
                    box.left = b.left;
                    box.right = b.left + b.width;
                }
                if (b.top != null) {
                    box.top = b.top;
                    box.bottom = b.top + b.height;
                }
                if (place == BoxPlacement.BottomLeft || place == BoxPlacement.BottomRight) {
                    let h = box.bottom - box.top;
                    box.top = parent.bottom - h;
                    box.bottom = parent.bottom;
                }
                if (place == BoxPlacement.TopRight || place == BoxPlacement.BottomRight) {
                    let w = box.right - box.left;
                    box.left = parent.right - w;
                    box.right = parent.right;
                }
                if (debug) console.log('place',b.label,box.left,box.top,box.right,box.bottom,parent?.left,parent?.top);
                let parents = [parent];
                // if approx match, might overlap multiple free boxes
                if (approx) parents = bin.getBoxes(box, 100, bin.free);
                return { parents, place, bin, ...box };
            }
        }
        if (debug) console.log('cannot place!',  b.left,b.top,b.width,b.height);
        return null;
    }
    toSVG() {
        let s = '';
        let r = {width:100,height:70}
        for (let bin of this.bins) {
            r.width = Math.max(r.width, bin.binbounds.right);
            r.height = Math.max(r.height, bin.binbounds.bottom);
        }
        s += `<svg viewBox="0 0 ${r.width} ${r.height}" xmlns="http://www.w3.org/2000/svg"><style><![CDATA[text {font: 1px sans-serif;}]]></style>`;
        for (let bin of this.bins) {
            let be = bin.extents;
            s += '<g>'
            s += `<rect width="${be.right-be.left}" height="${be.bottom-be.top}" stroke="black" stroke-width="0.5" fill="none"/>`;
            let textx = be.right+1;
            let texty = 0;
            for (let box of this.boxes) {
                let b = box.box;
                if (b) {
                    if (b.bin == bin) s += `<rect width="${b.right-b.left}" height="${b.bottom-b.top}" x="${b.left}" y="${b.top}" stroke="black" stroke-width="0.25" fill="#ccc"/>`;
                    if (b.top == texty) textx += 10; else textx = be.right+1;
                    texty = b.top;
                    if (box.label) s += `<text x="${textx}" y="${texty}" height="1">${box.label}</text>`;
                }
            }
            /*
            for (let b of bin.free) {
                s += `<rect width="${b.right-b.left}" height="${b.bottom-b.top}" x="${b.left}" y="${b.top}" stroke="red" stroke-width="0.1" fill="none"/>`;
            }
            */
            s += '</g>'
        }
        s += `</svg>`;
        return s;
    }
    toSVGUrl() {
        return `data:image/svg+xml;base64,${btoa(this.toSVG())}`;
    }
}
