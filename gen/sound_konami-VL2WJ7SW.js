import{E as w}from"./chunk-3NXXB3IA.js";import{$ as d,J as v,P as x,R as p,T as C,_ as P}from"./chunk-G7IBJTLG.js";import"./chunk-5XVCUSSZ.js";var y=[],A=function(R){this.__proto__=new w;var t,i,o,f,l,u,c,m,s,M=0,a=0,r,g=14318e3/8,b=1789750/1280,D=g/60,S=g/b;this.getPresets=function(){return y},this.start=function(){i=new p(1024),f={read:d([[0,16383,16383,function(e){return o?o[e]:null}],[16384,24575,1023,function(e){return i.mem[e]}]]),write:d([[16384,24575,1023,function(e,n){i.mem[e]=n}]]),isContended:function(){return!1}},l={read:function(e){if(e&64){if(a==15){var n=t.getTstates()/S&1;return n?255:0}return r.readRegister(a)&255}return 0},write:function(e,n){e&128&&(a=n&15),e&64&&r.writeRegisterAY(a,n&255)}},this.readAddress=f.read,t=this.newCPU(f,l),r=new PsgDeviceChannel,c=new MasterChannel,r.setMode(PsgDeviceChannel.MODE_SIGNED),r.setDevice(PsgDeviceChannel.DEVICE_AY_3_8910),c.addChannel(r),u=new AudioLooper(512),u.setChannel(c),m=new x(R,256,256),m.create(),m.setKeyboardEvents(function(e,n,T){var h=e-49;h>=0&&T&1&&(r.writeRegister(14,h),r.writeRegister(15,128),t.setIFF1(1),t.requestInterrupt(56))}),s=new C(60,()=>{if(!!this.isRunning()){var e=this.getDebugCallback(),n=t.getTstates()+D;if(e)for(;t.getTstates()<n;)e&&e()&&(e=null),t.runFrame(t.getTstates()+1);else t.runFrame(n)}})},this.loadROM=function(e,n){o=P(n,16384),t.reset()},this.loadState=function(e){t.loadState(e.c),i.mem.set(e.b)},this.saveState=function(){return{c:this.getCPUState(),b:i.mem.slice(0)}},this.getCPUState=function(){return t.saveState()},this.isRunning=function(){return s&&s.isRunning()},this.pause=function(){s.stop()},this.resume=function(){s.start(),u.activate()},this.reset=function(){t.reset(),this.getDebugCallback()||t.setTstates(0)}};v.sound_konami=A;
//# sourceMappingURL=sound_konami-VL2WJ7SW.js.map