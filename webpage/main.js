// Create new module worker, to handle the compilation side of things.
// Note it is of type "module" this is generally supported in browser.
const LLVMworker = new Worker('worker.js', {type:'module'});

LLVMworker.onerror = function (event) {
    console.error('Worker error:', event);
  };
  
LLVMworker.onmessage = function (event) {
    // Handle messages from the worker
};