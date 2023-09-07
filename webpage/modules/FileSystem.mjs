//Permission is hereby granted, free of charge, to any
//person obtaining a copy of this software and associated
//documentation files (the "Software"), to deal in the
//Software without restriction, including without
//limitation the rights to use, copy, modify, merge,
//publish, distribute, sublicense, and/or sell copies of
//the Software, and to permit persons to whom the Software
//is furnished to do so, subject to the following
//conditions:
//
//The above copyright notice and this permission notice
//shall be included in all copies or substantial portions
//of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
//ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
//TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
//PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
//SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
//OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
//IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//DEALINGS IN THE SOFTWARE.

//Modified from https://github.com/jprendes/emception

import EmProcess from "./EmProcess.mjs";
import BusyBoxModule from "./wasm/busybox_unstripped.mjs";

export default class FileSystem extends EmProcess {
    _cache = null;
    init = false;

    constructor({ cache = "/cache", ...opts } = {}) {
        super(BusyBoxModule, { ...opts });
        this.#init(cache, opts);
    }

    #init = async () => {
        await this;
        this.init = true;
    }

    async unpack(...paths) {
        return Promise.all(paths.flat().map(async (path) => {
            let file = await fetch(path);
            let buffer = new Uint8Array(await file.arrayBuffer());

            if (path.endsWith(".xz")) {
                // it's an xz file, decompress it
                await this.FS.writeFile("/tmp/archive.tar.xz", buffer);
                buffer = null;

                // Ensure initialisation has happened (should await on wasm module here, but this can be difficult)
                while (this.init===false) {await new Promise(r => setTimeout(r, 10))};
                
                // Use the "-k" flag to keep the compressed archive so we can remove ourselves.
                await this.exec(["busybox", "xz", "-k", "-d", "archive.tar.xz"], { cwd: "/tmp/" });
                await this.delete("/tmp/archive.tar.xz");
            } else {
                await this.FS.writeFile("/tmp/archive.tar", buffer);
            }
            await this.exec(["busybox", "tar", "xvf", "/tmp/archive.tar"], { cwd: "/" });
            await this.delete("/tmp/archive.tar");
        }));
    }

    exists(path) {
        return this.analyzePath(path).exists;
    }
    analyzePath(...args) {
        return this.FS.analyzePath(...args)
    }
    mkdirTree(...args) {
        return this.FS.mkdirTree(...args)
    }
    mkdir(...args) {
        return this.FS.mkdir(...args)
    }
    unlink(...args) {
        return this.FS.unlink(...args)
    }
    // Unlinking a File doesnt always mean its garbage collected. If we are done with it delete contents.
    delete(...args){
        this.FS.analyzePath(...args).object.contents = null;
        return this.FS.unlink(...args)
    }
    readFile(...args) {
        return this.FS.readFile(...args)
    }
    writeFile(...args) {
        return this.FS.writeFile(...args)
    }

    pull() {
        return new Promise((resolve, reject) => this.FS.syncfs(true, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        }));
    }

    push() {
        return new Promise((resolve, reject) => this.FS.syncfs(false, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        }));
    }
};
