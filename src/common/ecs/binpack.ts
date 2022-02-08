
var debug = true;

export interface BoxConstraints {
    left?: number;
    top?: number;
    width: number;
    height: number;
    box?: PlacedBox;
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
    parent: Box;
    place: BoxPlacement;
}

function boxesIntersect(a: Box, b: Box) : boolean {
    return !(b.left >= a.right || b.right <= a.left || b.top >= a.bottom || b.bottom <= a.top);
}

function getBoxPlacements(b: PlacedBox) {
    let posns : BoxPlacement[];
    let snugw = b.right - b.left == b.parent.right - b.parent.left;
    let snugh = b.bottom - b.top == b.parent.bottom - b.parent.top;
    if (snugw && snugh) {
        posns = [BoxPlacement.TopLeft];
    } else if (snugw && !snugh) {
        posns = [BoxPlacement.TopLeft, BoxPlacement.BottomLeft];
    } else if (!snugw && snugh) {
        posns = [BoxPlacement.TopLeft, BoxPlacement.TopRight];
    } else {
        posns = [BoxPlacement.TopLeft, BoxPlacement.TopRight,
            BoxPlacement.BottomLeft, BoxPlacement.BottomRight];
    }
    return posns;
}

export class Bin {
    boxes: Box[] = [];
    free: Box[] = [];

    constructor(public readonly binbounds: Box) {
        this.free.push(binbounds);
    }
    getBoxes(bounds: Box, limit: number) : Box[] {
        let result = [];
        for (let box of this.boxes) {
            //console.log(bounds, box, boxesIntersect(bounds, box))
            if (boxesIntersect(bounds, box)) {
                result.push(box);
                if (result.length >= limit) break;
            }
        }
        return result;
    }
    fits(b: Box) {
        if (!boxesIntersect(this.binbounds, b)) return false;
        if (this.getBoxes(b, 1).length > 0) return false;
        return true;
    }
    bestFit(b: Box) : Box | null {
        let bestscore = 0;
        let best = null;
        for (let f of this.free) {
            let dx = (f.right - f.left) - (b.right - b.left);
            let dy = (f.bottom - f.top) - (b.bottom - b.top);
            if (dx >= 0 && dy >= 0) {
                let score = 1 / (1 + dx + dy);
                if (score > bestscore) {
                    best = f;
                }
            }
        }
        return best;
    }
    add(b: PlacedBox) {
        if (debug) console.log('added',b.left,b.top,b.right,b.bottom);
        if (!this.fits(b)) {
            //console.log('collided with', this.getBoxes(b, 1));
            throw new Error(`bad fit ${b.left} ${b.top} ${b.right} ${b.bottom}`)
        }
        // add box to list
        this.boxes.push(b);
        // delete bin
        let i = this.free.indexOf(b.parent);
        if (i < 0) throw new Error('cannot find parent');
        if (debug) console.log('removed',b.parent.left,b.parent.top,b.parent.right,b.parent.bottom);
        this.free.splice(i, 1);
        // split into new bins
        switch (b.place) {
            case BoxPlacement.TopLeft:
                this.addFree( { top: b.top, left: b.right, bottom: b.bottom, right: b.parent.right } );
                this.addFree( { top: b.bottom, left: b.parent.left, bottom: b.parent.bottom, right: b.parent.right } );
                break;
            case BoxPlacement.TopRight:
                this.addFree( { top: b.top, left: b.parent.left, bottom: b.bottom, right: b.left } );
                this.addFree( { top: b.bottom, left: b.parent.left, bottom: b.parent.bottom, right: b.parent.right } );
                break;
            case BoxPlacement.BottomLeft:
                this.addFree( { top: b.parent.top, left: b.parent.left, bottom: b.top, right: b.parent.right } );
                this.addFree( { top: b.top, left: b.right, bottom: b.parent.bottom, right: b.parent.right } );
                break;
            case BoxPlacement.BottomRight:
                this.addFree( { top: b.parent.top, left: b.parent.left, bottom: b.top, right: b.parent.right } );
                this.addFree( { top: b.top, left: b.parent.left, bottom: b.parent.bottom, right: b.left } );
                break;
        }
    }
    addFree(b: Box) {
        if (b.bottom > b.top && b.right > b.left) {
            if (debug) console.log('free',b.left,b.top,b.right,b.bottom);
            this.free.push(b);
        }
        // TODO: merge free boxes
    }
}

export class Packer {
    bins : Bin[] = [];
    boxes : BoxConstraints[] = [];

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
        let left = b.left != null ? b.left : 0;
        let top = b.top != null ? b.top : 0;
        let right = left + b.width;
        let bottom = top + b.height;
        for (let bin of this.bins) {
            let place : BoxPlacement = BoxPlacement.TopLeft; //TODO
            let box = { left, top, right, bottom };
            let parent = bin.bestFit(box);
            if (parent) {
                box.left = parent.left;
                box.top = parent.top;
                box.right = parent.left + b.width;
                box.bottom = parent.top + b.height;
                /*
                if (place == BoxPlacement.BottomLeft || place == BoxPlacement.BottomRight) {
                    box.top = parent.bottom - (box.bottom - box.top);
                }
                if (place == BoxPlacement.TopRight || place == BoxPlacement.BottomRight) {
                    box.left = parent.right - (box.right - box.left);
                }
                */
                return { parent, place, bin, ...box };
            }
        }
        return null;
    }
}
