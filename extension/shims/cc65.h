/* Forced include for clangd/cpptools on cc65 code: hides cc65's
   keywords from a host C parser. Never passed to cc65 itself. */
#define __fastcall__
#define __cdecl__
#define __near__
#define __far__
#define __fastcall
#define __cdecl
#define __near
#define __far
#define __asm__(...) ((void)0)
#define asm(...) ((void)0)
/* pseudo-registers */
extern unsigned char __A__;
extern unsigned int __AX__;
extern unsigned long __EAX__;
