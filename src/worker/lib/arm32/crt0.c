
extern void _end;

void malloc_addblock(void* addr, int size);

int entry();

__attribute__((weak, naked, noinline, noreturn)) void _start() {
    // set bss segment symbols
    asm(".global __bss_start__, __bss_end__");
    asm("__bss_start__ = _edata");
    asm("__bss_end__ = _end");
    // set stack pointer
    asm("mov sp, #0x100000");
    // allocate heap block
    malloc_addblock(&_end, (void*)0xf0000 - &_end);
    // run main()
    entry();
    // wait for next video frame
    while (*(volatile int*)0x4000020 != 0) { }
    // halt cpu
    asm(".long 0xe7f000f0"); // udf #0
}

void _Exit(int ec) {
    asm(".long 0xe7f000f0"); // udf #0
}
