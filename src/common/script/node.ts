
var lastTimestamp = 0;

function newTimestamp() {
    return ++lastTimestamp;
}

export type DependencySet = {[id:string] : ComputeNode | any}

export abstract class ComputeNode {
    private src_ts: number = newTimestamp();
    private result_ts: number = 0;
    private depends: DependencySet = {};
    private busy: Promise<void> = null;

    modified() {
        this.src_ts = newTimestamp();
    }

    isStale(ts: number) {
        return this.result_ts < ts;
    }

    setDependencies(depends: DependencySet) {
        this.depends = depends;
        // compute latest timestamp of all dependencies
        var ts = 0;
        for (let [key, dep] of Object.entries(this.depends)) {
            if (dep instanceof ComputeNode && dep.result_ts) {
                ts = Math.max(ts, dep.result_ts);
            } else {
                ts = newTimestamp();
            }
        }
        this.src_ts = ts;
    }

    getDependencies() {
        return this.depends;
    }

    async update() : Promise<void> {
        let maxts = 0;
        let dependsComputes = []
        for (let [key, dep] of Object.entries(this.depends)) {
            if (dep instanceof ComputeNode && dep.isStale(this.src_ts)) {
                dependsComputes.push(dep.compute());
            }
        }
        if (dependsComputes.length) {
            await Promise.all(dependsComputes);
            this.recompute(maxts);
        }
    }

    async recompute(ts: number) : Promise<void> {
        // are we currently waiting for a computation to finish?
        if (this.busy == null || ts > this.result_ts) {
            // wait for previous operation to finish (no-op if null)
            await this.busy;
            this.result_ts = ts;
            this.busy = this.compute();
        }
        await this.busy;
        this.busy = null;
    }

    abstract compute(): Promise<void>;
}

class ValueNode<T> extends ComputeNode {
    private value : T;

    constructor(value : T) {
        super();
        this.set(value);
    }

    get() : T {
        return this.value;
    }

    set(newValue : T) {
        this.value = newValue;
        this.modified();
    }

    async compute() { }
}

class ArrayNode<T> extends ValueNode<T> {
}

class IntegerNode extends ValueNode<number> {
}

abstract class BitmapNode extends ComputeNode {
    width: number;
    height: number;
}

class RGBABitmapNode extends BitmapNode {
    rgba: ArrayNode<Uint32Array>;

    compute(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

class IndexedBitmapNode extends BitmapNode {
    indices: ArrayNode<Uint8Array>;

    compute(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

class PaletteNode {
    colors: ArrayNode<Uint32Array>;

    compute(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

class PaletteMapNode extends ComputeNode {
    palette: PaletteNode;
    indices: ArrayNode<Uint8Array>;

    compute(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

function valueOf<T>(node : ValueNode<T>) : T {
    return node.get();
}

class TestNode extends ComputeNode {
    value : string;

    async compute() {
        await new Promise(r => setTimeout(r, 100));
        this.value = Object.values(this.getDependencies()).map(valueOf).join('');
    }

}

///

async function test() {
    var val1 = new ValueNode<number>(1234);
    var arr1 = new ValueNode<number[]>([1,2,3]);
    var join = new TestNode();
    join.setDependencies({a:val1, b:arr1});
    await join.update();
    console.log(join);
    val1.set(9999);
    join.update();
    val1.set(9989)
    await join.update();
    console.log(join);
}

test();
