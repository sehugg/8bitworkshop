import{c as E}from"./chunk-RXPP3QYD.js";import{b as f}from"./chunk-7BAKXSVO.js";import{E as m,J as n,d as w,f as c}from"./chunk-YLYWUMYM.js";import{$ as t,J as o,V as e,Y as s,k as g,l as a}from"./chunk-ATS7PSQG.js";import"./chunk-5XVCUSSZ.js";var Q=s([[e.UP,0,1],[e.DOWN,0,4],[e.LEFT,0,8],[e.RIGHT,0,2],[e.A,0,64],[e.B,1,64],[e.P2_UP,2,1],[e.P2_DOWN,2,4],[e.P2_LEFT,2,8],[e.P2_RIGHT,2,2],[e.P2_A,2,64],[e.P2_B,3,64]]),r=class extends E{constructor(){super();this.defaultROMSize=32768;this.ram=new Uint8Array(1024);this.read=t([[0,8191,8191,A=>this.bios?this.bios[A]:0],[24576,32767,1023,A=>this.ram[A]],[32768,65535,32767,A=>this.rom?this.rom[A]:0]]);this.write=t([[24576,32767,1023,(A,B)=>{this.ram[A]=B}]]);this.init(this,this.newIOBus(),new c(new w)),this.bios=new g().decode(a(atob(l)))}getKeyboardMap(){return Q}vdpInterrupt(){this.probe.logInterrupt(0),this.cpu.NMI()}newIOBus(){return{read:A=>{switch(A&=255,A){case 252:return this.inputs[this.keypadMode?1:0]^255;case 255:return this.inputs[this.keypadMode?3:2]^255}return A>=160&&A<=191?A&1?this.vdp.readStatus():this.vdp.readData():0},write:(A,B)=>{switch(A&=255,B&=255,A>>4){case 8:case 9:this.keypadMode=!0;break;case 12:case 13:this.keypadMode=!1;break;case 10:case 11:return A&1?this.vdp.writeAddress(B):this.vdp.writeData(B);case 15:this.psg.setData(B);break}}}}loadState(A){super.loadState(A),this.keypadMode=A.kpm}saveState(){var A=super.saveState();return A.kpm=this.keypadMode,A}reset(){super.reset(),this.keypadMode=!1}},l=`
TFpHAAAgAAAAB7djQcnHAQEDBgcx/3MYawAAAMMMgAehB+EPB+USB+UVB+UYB+UbB+UeB+QHHAZm
IYA8igUCBYIAKgCAff5VIAl8/qogBCoKgOnHAwkfgICAAAMFT6CgB4LgByEH4WDAYMBABlggQIAg
B+HAwOCgYAMGKweBQAYxBphAQEAG+KBABnAGEuAGUAabB+QA4AflBkggIAYyB+FgoKCgwAZdwAY5
B+HABhAGYAfhIAZQoKDgIAMCcOCAwAaIYIDgoAZY4AMFOAYGBsgGIAZYAwJWBlAAQAMEcAYfQAZ4
BhoDA3gGBgaQBjgGGwYfoOCAAwLIB+EDA/DAoAchAwNggAaQwAMFmOCAByEH5QZ4AwKABligAwUw
4EBAQAZYICAgoAMCUAYuBpAGPwawoOAG4AfhAyNQQKCgBqDAoMADJECgoOADBGjgwAZYYIADBPgD
AlADBEigAwVooAMFCAMEQAYHAwRQBg8GUAMiEAMEoAMEcAMD6gaQICAGyAADJZgDJ4gDI7gAwGAD
I0CAwAME6AMC+QMCaCBgAwRwAGCgwAaIQOADA2AGJiAH4gZoAwPgA0M6ACAAAwX4gKDAAwPAAyLP
AwNgAwXwAyNJAwR+AwX4oMADRQBgAyOgAyJxB+PAYANDEOBAQAMDeAMF+AfhA0RQAyJBB+NAAwPI
BncGkOBgwAZQYECABrADQs8DAkjAQCBAA0QYAAMDUAcLOERsRFREOAA4fFR8RHw4AAAofHx8OBAA
ABA4B+MQODgQfHwDBQgQBhgAADAwB4H8/PzMzAeBAAB4SEh4BkiEtLSEBggcDDRISDAAOEREOBAG
eBgUEDBwYAAMNCw0LGxgAABUOGw4VAAAIDA4PDgwIAAIGDh4OBgIAwJXEAMCaCgHAgAoADxUVDQU
FBQAOEQwKBhEAwNwAAB4eAMGIAchfBAHAQAHggMEqBh8GAfBABAwfDAH4gAAQEBAfAAAKCh8KCgG
DxA4OHwGB3x8ODgGLwcHBg8GfgBsbEgGyQZnfCgAIDhAMAhwEABkZAgQIExMACBQUCBUSDQAMDAD
ZEsQIAcCEAAgAwJ5EAYMKDh8OCgGURB8AwdYBuV8AwdlAyIyBAgQAyKmOERMVGREOAAQMAZ4OAYI
BBggQHwH4jgEBhAIGChIfAgIAHxAQHgGSAYVeEQH4XwGeCAgAyNYBkgHgTwECAMiijAwAySSB+Mg
Bh5AIBAIAwR3B0EGBAZyAwNgAwLoOERcVFxABrhEfEREAHhERAdCBghAQEBEOAZIBwF4AwN4AyJA
B+RABlhcREQ8AAbvRAA4AwP4OAAEBwEDAohESFBgUEhEAyJ1AyN4RGxUBh9EAERkVEwGqAZGAwRY
AwVIREQDIlAGSEgGmEADA/gDI9YQEAMCYAaoB8MoBkhUBwEoB+EoECgGKAaOBiB4AwLpQHgAOAMj
kDgAAAMC9gQAADgIBwI4AAYlA0rv/DADRR0GGgQ8RDwABjQDA+gGCEQDAvgEBg4DAuAGSHhAAyJ4
IHgDInAAAAYQPAQ4QEBwSAcBAANEehgACAAYCAgISDBAQAMD+QaOBlAAAGhUVEQDAnQG6AMCSAMC
yAADI1p4QAMDSEQ8BAAAWCQgIHAGWEA4BAYYAwJnKAMCnAYuWANCUQME+AfiVHwGSEhIMAMDSAYY
OBBgAAB4CDBAeAMCoGAgIBgDAngHYzAICAwICDAAKFADRuhsRER8AwPeQEQ4EDBIAwVYDAMF4Ach
AyMIKAflMAflOCgH5AMkFxAwBiAGqAYgB+MGIAMFCAME8BAGgRgAIAMFCAYHKER8RAMCQGwH4gwA
fEB4A2KYAHgUfFA8ADxQUHxQUFwAOAAwSAOCOCgH5WAH5TgDBaBgB+UoAwXwAwL9BugH5AAQOEBA
OBAAGCQgeCAkXABEKBB8ByEAYFBQaFxISAAIFBA4EBBQIBgDBdADIyIQGAfhAwRgGAMGWFADI6kH
4khoWEgDBSY8AwUeeAMi8DADQiAAA2ISA6N2/AQEB6FASFA4RAgcB+IsVBwEBmADglsGEiRIJAZf
AEgkAyKuVACoB2SoBySo/FT8B2IDRDAHA/AHpQfjUFBQ0AdhAyK+8AfjAwYQ0BAGkAcGBhAGyNAQ
8AYkAAYCB+MGJgfjBngDBVgcBpAQEPwDZgwDBhAHggZIAwYYAwUOBpBQUFBcAwNYXAMjtQMC9wbI
3AboB6HcAwUYBpAGCAaQBhgGkBADBghQUAMGKAMDWAZCAwW7AwNQAwJoBpgDBXAGAnwG11ADB0AD
JiADBbgGoPwHBQZJB+LgBwUcBwUDBhQAADRISDQDY49wSEhwQHhIA4OpAAB8A8R6eEggECADwtEA
PANDTwNjYHAGWShQAwKHOBA4A8LZA0IIeAaZOEREKChsADBAIBA4BqkoA4KfA0KIVFQDIvg4QANi
FwAGaQNjr3gHIwZYEAAGEEAwCDBABgkHoTAIBlEIFANIAlAgBiAAfAdhAwJ3B0IGfwMDjgPmiAcB
A8SRHAYnBihQAwK9BwFgEAODTQPjNXgDAmgHHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8H
HwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBx8HHwcfBwM=`;var D=[{id:"text.c",name:"Text Mode"},{id:"hello.c",name:"Scrolling Text"},{id:"text32.c",name:"32-Column Color Text"},{id:"stars.c",name:"Scrolling Starfield"},{id:"cursorsmooth.c",name:"Moving Cursor"},{id:"simplemusic.c",name:"Simple Music"},{id:"musicplayer.c",name:"Multivoice Music"},{id:"mode2bitmap.c",name:"Mode 2 Bitmap"},{id:"mode2compressed.c",name:"Mode 2 Bitmap (LZG)"},{id:"lines.c",name:"Mode 2 Lines"},{id:"multicolor.c",name:"Multicolor Mode"},{id:"siegegame.c",name:"Siege Game"},{id:"shoot.c",name:"Solarian Game"},{id:"climber.c",name:"Climber Game"}],M=class extends n{constructor(){super(...arguments);this.getMemoryMap=function(){return{main:[{name:"BIOS",start:0,size:8192,type:"rom"},{name:"Cartridge Header",start:32768,size:256,type:"rom"}]}}}newMachine(){return new r}getPresets(){return D}getDefaultExtension(){return".c"}readAddress(A){return this.machine.read(A)}readVRAMAddress(A){return this.machine.readVRAMAddress(A)}showHelp(){return"https://8bitworkshop.com/docs/platforms/coleco/"}},h=class extends f{constructor(){super(...arguments);this.getToolForFilename=m}start(){this.startModule(this.mainElement,{jsfile:"mame8bitws.js",cfgfile:"coleco.cfg",biosfile:"coleco/313 10031-4005 73108a.u2",driver:"coleco",width:280*2,height:216*2,romfn:"/emulator/cart.rom",romsize:32768,preInit:function(A){}})}loadROM(A,B){this.loadROMFile(B),this.loadRegion(":coleco_cart:rom",B)}getPresets(){return D}getDefaultExtension(){return".c"}};o["coleco.mame"]=h;o.coleco=M;export{D as ColecoVision_PRESETS};
//# sourceMappingURL=coleco-D3NQZQT3.js.map
