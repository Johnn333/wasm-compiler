import FileSystem from "./modules/FileSystem.mjs";

import ClangProcess from "./modules/ClangProcess.mjs";
import LLDProcess from "./modules/LLDProcess.mjs";
import ObjCopyProcess from "./modules/ObjCopyProcess.mjs";

class LLVM {
    initialised = false;
    fileSystem = null;
    tools = {};

    constructor(){
        this.init();
    }

    async init() {
        // Store the FileSystem in the GlobalWorkerSpace, this is useful
        // for when Wasm modules invoke other Wasm modules.
        const fileSystem = await new FileSystem();
        this.fileSystem = fileSystem;

        // Populate FS with Wasm binaries and sync.
        await fileSystem.unpack("./wasm.tar.xz");
        await fileSystem.pull();

        // Create WebAssembly modules, using Emscripten generated files.
        // Wait for instantiation to complete.
        const tools = {
            // This order is semi-important to reduce max RAM usage.
            "llvm-objcopy": new ObjCopyProcess({FS: fileSystem.FS}),            
            "lld": new LLDProcess({FS: fileSystem.FS}),
            "clang": new ClangProcess({FS: fileSystem.FS}),
        };
        for (let tool in tools) {
            await tools[tool];
            // Remove WASM binary from FileSystem once instantiated
            fileSystem.delete("/wasm/"+tool+".wasm");
        };
        this.tools = tools;

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
        
        let process = null;
        switch (args[0]){
            case "clang"          : process = "clang";         break;
            case "clang++"        : process = "clang";         break;
            case "ld.lld"         : process = "lld";           break;
            case "llvm-objcopy"   : process = "llvm-objcopy";  break;
            default               : process = null;            return;          // If none of the above, Something went wrong.
        }

        return this.tools[process].exec(args, {
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