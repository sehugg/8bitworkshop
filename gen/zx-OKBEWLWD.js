import{J as p,r as c}from"./chunk-YLYWUMYM.js";import{J as n,O as i}from"./chunk-ATS7PSQG.js";import"./chunk-5XVCUSSZ.js";var o=class extends c{constructor(){super(...arguments);this.numTotalScanlines=312;this.cpuCyclesPerLine=224;this.joymask0=0}reset(){super.reset(),this.exports.machine_exec(this.sys,2e6),this.romptr&&this.romlen&&this.exports.machine_load_rom(this.sys,this.romptr,this.romlen);for(var t=0;t<128;t++)this.setKeyInput(t,0,i.KeyUp)}advanceFrame(t){var a=this.probe!=null;a&&this.exports.machine_reset_probe_buffer();var s=super.advanceFrameClock(t,Math.floor(35e5/50));return a&&this.copyProbeData(),s}getCPUState(){this.exports.machine_save_cpu_state(this.sys,this.cpustateptr);var t=this.cpustatearr,a=t[9]+(t[8]<<8),s=t[10]+(t[11]<<8),e=t[12]+(t[13]<<8),r=t[14]+(t[15]<<8),x=t[24]+(t[25]<<8),l=t[26]+(t[27]<<8),u=t[28]+(t[29]<<8),m=t[34]+(t[35]<<8),d=t[36]+(t[37]<<8);return{PC:m,SP:x,AF:a,BC:r,DE:e,HL:s,IX:u,IY:l,IR:d,o:this.readConst(m)}}saveState(){return this.exports.machine_save_state(this.sys,this.stateptr),{c:this.getCPUState(),state:this.statearr.slice(0)}}loadState(t){this.statearr.set(t.state),this.exports.machine_load_state(this.sys,this.stateptr)}getVideoParams(){return{width:320,height:256,overscan:!0,videoFrequency:50}}setKeyInput(t,a,s){if(!(t==16||t==17||t==18||t==224)){var e=0,r=0;t==37&&(t=8,e=4),t==38&&(t=11,e=1),t==39&&(t=9,e=8),t==40&&(t=10,e=2),t==32&&(e=16),t==65&&(t=65,r=4),t==87&&(t=87,r=1),t==68&&(t=68,r=8),t==83&&(t=83,r=2),t==69&&(r=16),t==113&&(t=241),t==115&&(t=243),t==119&&(t=245),t==121&&(t=247),s&i.KeyDown?(this.exports.machine_key_down(this.sys,t),this.joymask0|=e):s&i.KeyUp&&(this.exports.machine_key_up(this.sys,t),this.joymask0&=~e),this.exports.zx_joystick(this.sys,this.joymask0,0)}}};var M=[{id:"hello.asm",name:"Hello World (ASM)"},{id:"bios.c",name:"BIOS Routines (C)"},{id:"cosmic.c",name:"Cosmic Impalas (C)"}],v={main:[{name:"BIOS",start:0,size:16384,type:"rom"},{name:"Screen RAM",start:16384,size:6144,type:"ram"},{name:"Color RAM",start:22528,size:768,type:"ram"},{name:"System RAM",start:23552,size:192,type:"ram"},{name:"User RAM",start:23755,size:65368-23755,type:"ram"}]},h=class extends p{newMachine(){return new o("zx")}getPresets(){return M}getDefaultExtension(){return".asm"}readAddress(t){return this.machine.readConst(t)}getMemoryMap(){return v}showHelp(){return"https://worldofspectrum.org/faq/reference/reference.htm"}};n.zx=h;
//# sourceMappingURL=zx-OKBEWLWD.js.map