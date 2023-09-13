import FileSystem from "./modules/FileSystem.mjs";

import LlvmBoxProcess from "./modules/LlvmBoxProcess.mjs";

class LLVM {
    initialised = false;
    fileSystem = null;

    constructor(){
        this.init();
    }

    async init() {
        const fileSystem = await new FileSystem();
        this.fileSystem = fileSystem;

        // Populate FS with Wasm binaries and sync.
        await fileSystem.unpack("./wasm.tar.xz");
        await fileSystem.pull();

        const tools = {}
        this.tools = tools;
        
        // Create WebAssembly modules, using Emscripten generated files.
        // Wait for instantiation to complete.
        this.tools["llvm-box"] = new LlvmBoxProcess({FS: fileSystem.FS})
        await tools["llvm-box"];
        
        // Remove WASM binary from FileSystem once instantiated
        fileSystem.delete("/wasm/llvm-box.wasm");

        // Just a demo to show how files can be written to the FileSystem.
        fileSystem.mkdirTree('/working')
        await fileSystem.writeFile('/working/main.cpp',
                                    'int main() {return 0;}');
        await fileSystem.writeFile('/working/broken.cpp',
                                    'int main() {return 0}');

        // Run help command and log in console, to show functionality.
        console.log(this.run("clang --help"));
        console.log(this.run("ld.lld --help"));
        console.log(this.run("llvm-objcopy --help"));
        
        // Compile a very simple program, which just returns 0,
        console.log(this.run("clang++ --target=arm-none-eabi main.cpp -c -o main.o"));
        
        // Compile a broken program.
        console.log(this.run("clang++ --target=arm-none-eabi broken.cpp -c -o broken.o"));

        this.initialised = true;
    };

    run(args) {
        if((typeof args) === "string") args = args.split(/ +/g);

        return this.tools["llvm-box"].exec(args, {
            print: () => () => {},
            printErr: () => () => {},
            cwd: "/working"
        })
    };

    // chmod has to be applied to certain generated files to give us permission to read.
    async getHex(){
        this.fileSystem.FS.chmod("/working/MICROBIT.hex", 0o0444);
        return this.fileSystem.readFile("/working/MICROBIT.hex")
    };

    async saveFiles(files) {
        for (let f in files) {
            this.saveFile(f, files[f]);
        }
    }

    async saveFile(name, contents){
        await this.fileSystem.writeFile('/working/'+name,contents);
    };
}

const llvm = new LLVM();