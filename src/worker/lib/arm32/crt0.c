
int entry();

__attribute__((weak, naked, noinline, noreturn)) void _start() {
    asm(".global __bss_start__, __bss_end__");
    asm("__bss_start__ = _edata");
    asm("__bss_end__ = _end");
    asm("mov sp, #0x100000"); // stack pointer
    entry();
    asm(".long 0xe7f000f0"); // udf #0
}

void _Exit(int ec) {
    asm(".long 0xe7f000f0"); // udf #0
}
