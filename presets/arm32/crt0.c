
int main();

void _start() {
    asm("mov sp, #0x100000"); // stack pointer
    main();
    asm(".long 0xdeadc0d3");
}

