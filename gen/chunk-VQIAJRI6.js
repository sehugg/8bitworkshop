import{a as Ur}from"./chunk-T6VURU5O.js";import{d as uo}from"./chunk-VSC4MAII.js";var qo=uo((Ha,Go)=>{"use strict";function Eo(n,e){(e==null||e>n.length)&&(e=n.length);for(var r=0,a=Array(e);r<e;r++)a[r]=n[r];return a}function Jr(n){if(Array.isArray(n))return n}function Qr(n,e){var r=n==null?null:typeof Symbol!="undefined"&&n[Symbol.iterator]||n["@@iterator"];if(r!=null){var a,i,h,g,k=[],b=!0,R=!1;try{if(h=(r=r.call(n)).next,e!==0)for(;!(b=(a=h.call(r)).done)&&(k.push(a.value),k.length!==e);b=!0);}catch(M){R=!0,i=M}finally{try{if(!b&&r.return!=null&&(g=r.return(),Object(g)!==g))return}finally{if(R)throw i}}return k}}function td(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function ed(n,e){return Jr(n)||Qr(n,e)||nd(n,e)||td()}function nd(n,e){if(n){if(typeof n=="string")return Eo(n,e);var r={}.toString.call(n).slice(8,-1);return r==="Object"&&n.constructor&&(r=n.constructor.name),r==="Map"||r==="Set"?Array.from(n):r==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?Eo(n,e):void 0}}var Fo=Object.entries,Ao=Object.setPrototypeOf,od=Object.isFrozen,rd=Object.getPrototypeOf,dd=Object.getOwnPropertyDescriptor,rt=Object.freeze,st=Object.seal,De=Object.create,Uo=typeof Reflect!="undefined"&&Reflect,Xn=Uo.apply,Zn=Uo.construct;rt||(rt=function(e){return e});st||(st=function(e){return e});Xn||(Xn=function(e,r){for(var a=arguments.length,i=new Array(a>2?a-2:0),h=2;h<a;h++)i[h-2]=arguments[h];return e.apply(r,i)});Zn||(Zn=function(e){for(var r=arguments.length,a=new Array(r>1?r-1:0),i=1;i<r;i++)a[i-1]=arguments[i];return new e(...a)});var ke=J(Array.prototype.forEach),ad=J(Array.prototype.lastIndexOf),_o=J(Array.prototype.pop),hn=J(Array.prototype.push),sd=J(Array.prototype.splice),Pe=Array.isArray,mn=J(String.prototype.toLowerCase),Wn=J(String.prototype.toString),xo=J(String.prototype.match),pn=J(String.prototype.replace),ko=J(String.prototype.indexOf),id=J(String.prototype.trim),cd=J(Number.prototype.toString),ld=J(Boolean.prototype.toString),Ro=typeof BigInt=="undefined"?null:J(BigInt.prototype.toString),Co=typeof Symbol=="undefined"?null:J(Symbol.prototype.toString),wt=J(Object.prototype.hasOwnProperty),un=J(Object.prototype.toString),ut=J(RegExp.prototype.test),xe=hd(TypeError);function J(n){return function(e){e instanceof RegExp&&(e.lastIndex=0);for(var r=arguments.length,a=new Array(r>1?r-1:0),i=1;i<r;i++)a[i-1]=arguments[i];return Xn(n,e,a)}}function hd(n){return function(){for(var e=arguments.length,r=new Array(e),a=0;a<e;a++)r[a]=arguments[a];return Zn(n,r)}}function L(n,e){let r=arguments.length>2&&arguments[2]!==void 0?arguments[2]:mn;if(Ao&&Ao(n,null),!Pe(e))return n;let a=e.length;for(;a--;){let i=e[a];if(typeof i=="string"){let h=r(i);h!==i&&(od(e)||(e[a]=h),i=h)}n[i]=!0}return n}function pd(n){for(let e=0;e<n.length;e++)wt(n,e)||(n[e]=null);return n}function Mt(n){let e=De(null);for(let a of Fo(n)){var r=ed(a,2);let i=r[0],h=r[1];wt(n,i)&&(Pe(h)?e[i]=pd(h):h&&typeof h=="object"&&h.constructor===Object?e[i]=Mt(h):e[i]=h)}return e}function ud(n){switch(typeof n){case"string":return n;case"number":return cd(n);case"boolean":return ld(n);case"bigint":return Ro?Ro(n):"0";case"symbol":return Co?Co(n):"Symbol()";case"undefined":return un(n);case"function":case"object":{if(n===null)return un(n);let e=n,r=Dt(e,"toString");if(typeof r=="function"){let a=r(e);return typeof a=="string"?a:un(a)}return un(n)}default:return un(n)}}function Dt(n,e){for(;n!==null;){let a=dd(n,e);if(a){if(a.get)return J(a.get);if(typeof a.value=="function")return J(a.value)}n=rd(n)}function r(){return null}return r}function md(n){try{return ut(n,""),!0}catch(e){return!1}}var Mo=rt(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),jn=rt(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),Vn=rt(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),fd=rt(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),Yn=rt(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),gd=rt(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),Oo=rt(["#text"]),Io=rt(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","command","commandfor","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns"]),$n=rt(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dominant-baseline","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","pointer-events","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-orientation","text-rendering","textlength","type","u1","u2","unicode","values","vector-effect","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),Do=rt(["accent","accentunder","align","bevelled","close","columnalign","columnlines","columnspacing","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lquote","lspace","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),Tn=rt(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),bd=st(/{{[\w\W]*|^[\w\W]*}}/g),yd=st(/<%[\w\W]*|^[\w\W]*%>/g),wd=st(/\${[\w\W]*/g),Td=st(/^data-[\-\w.\u00B7-\uFFFF]+$/),Sd=st(/^aria-[\-\w]+$/),Po=st(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),vd=st(/^(?:\w+script|data):/i),Ed=st(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),Ad=st(/^html$/i),_d=st(/^[a-z][.\w]*(-[.\w]+)+$/i),Lo=st(/<[/\w!]/g),zo=st(/<[/\w]/g),xd=st(/<\/no(script|embed|frames)/i),kd=st(/\/>/i),Ct={element:1,attribute:2,text:3,cdataSection:4,entityReference:5,entityNode:6,processingInstruction:7,comment:8,document:9,documentType:10,documentFragment:11,notation:12},Ho=["style","script","xmp","iframe","noembed","noframes","plaintext","noscript"],Rd=rt(L({},Ho)),Cd=(function(){let n={};return ke(Ho,e=>{n[e]=st(new RegExp("</"+e+"(?=[\\t\\n\\f\\r />])","i"))}),rt(n)})(),Md=function(){return typeof window=="undefined"?null:window},Od=function(e,r){if(typeof e!="object"||typeof e.createPolicy!="function")return null;let a=null,i="data-tt-policy-suffix";r&&r.hasAttribute(i)&&(a=r.getAttribute(i));let h="dompurify"+(a?"#"+a:"");try{return e.createPolicy(h,{createHTML(g){return g},createScriptURL(g){return g}})}catch(g){return console.warn("TrustedTypes policy "+h+" could not be created."),null}},No=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},re=function(e,r,a,i){return wt(e,r)&&Pe(e[r])?L(i.base?Mt(i.base):{},e[r],i.transform):a},Kn=function(e,r,a){let i=wt(e,r)?e[r]:void 0;return i&&typeof i=="object"?Mt(i):a()};function Bo(){let n=arguments.length>0&&arguments[0]!==void 0?arguments[0]:Md(),e=s=>Bo(s);if(e.version="3.4.15",e.removed=[],!n||!n.document||n.document.nodeType!==Ct.document||!n.Element)return e.isSupported=!1,e;let r=n.document,a=r,i=a.currentScript;n.DocumentFragment;let h=n.HTMLTemplateElement,g=n.Node,k=n.Element,b=n.NodeFilter,R=n.NamedNodeMap;R===void 0&&(n.NamedNodeMap||n.MozNamedAttrMap),n.HTMLFormElement;let M=n.DOMParser,B=n.trustedTypes,_=k.prototype,F=Dt(_,"cloneNode"),O=Dt(_,"remove"),Y=Dt(_,"removeAttributeNode"),Lt=Dt(_,"nextSibling"),Z=Dt(_,"childNodes"),at=Dt(_,"parentNode"),Ut=Dt(_,"shadowRoot"),I=Dt(_,"attributes"),w=g&&g.prototype?Dt(g.prototype,"nodeType"):null,C=g&&g.prototype?Dt(g.prototype,"nodeName"):null,D=g&&g.prototype?Dt(g.prototype,"ownerDocument"):null,tt=function(t){return w?w(t):t.nodeType},bt=function(t){return C?C(t):t.nodeName};if(typeof h=="function"){let s=r.createElement("template");s.content&&s.content.ownerDocument&&(r=s.content.ownerDocument)}let P,et="",j,ae=!1,ct=0,te=function(){if(ct>0)throw xe('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.')},pt=function(t){te(),ct++;try{return P.createHTML(t)}finally{ct--}},se=function(t){te(),ct++;try{return P.createScriptURL(t)}finally{ct--}},ie=function(){return ae||(j=Od(B,i),ae=!0),j},St=r,zt=St.implementation,ce=St.createNodeIterator,Ne=St.createDocumentFragment,qt=St.getElementsByTagName,ee=a.importNode,S=No();e.isSupported=typeof Fo=="function"&&typeof at=="function"&&zt&&zt.createHTMLDocument!==void 0;let Fe=bd,le=yd,Ht=wd,he=Td,Ue=Sd,Oe=vd,pe=Ed,Wt=_d,ue=Po,T=null,Bt=L({},[...Mo,...jn,...Vn,...Yn,...Oo]),E=null,jt=L({},[...Io,...$n,...Do,...Tn]),V=Object.seal(De(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),vt=null,ne=null,nt=Object.seal(De(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}})),me=!0,ft=!0,oe=!1,fe=!0,ot=!1,f=!0,p=!1,m=!1,y=null,q=null,G=!1,W=!1,lt=!1,yt=!1,Gt=!0,He=!1,Be="user-content-",ge=!0,be=!1,Et={},At=null,Ge=L({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","selectedcontent","style","svg","template","thead","title","video","xmp"]),qe=null,We=L({},["audio","video","img","source","image","track"]),je=null,Ve=L({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),Vt="http://www.w3.org/1998/Math/MathML",Yt="http://www.w3.org/2000/svg",K="http://www.w3.org/1999/xhtml",_t=K,ye=!1,we=null,En=L({},[Vt,Yt,K],Wn),Ye=rt(["mi","mo","mn","ms","mtext"]),Te=L({},Ye),$e=rt(["annotation-xml"]),Se=L({},$e),An=L({},["title","style","font","a","script"]),Nt=null,_n=["application/xhtml+xml","text/html"],xn="text/html",x=null,xt=null,kn=r.createElement("form"),Ke=function(t){return t instanceof RegExp||t instanceof Function},ve=function(){let t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(xt&&xt===t)return;(!t||typeof t!="object")&&(t={}),t=Mt(t),Nt=_n.indexOf(t.PARSER_MEDIA_TYPE)===-1?xn:t.PARSER_MEDIA_TYPE,x=Nt==="application/xhtml+xml"?Wn:mn,T=re(t,"ALLOWED_TAGS",Bt,{transform:x}),E=re(t,"ALLOWED_ATTR",jt,{transform:x}),we=re(t,"ALLOWED_NAMESPACES",En,{transform:Wn}),je=re(t,"ADD_URI_SAFE_ATTR",Ve,{transform:x,base:Ve}),qe=re(t,"ADD_DATA_URI_TAGS",We,{transform:x,base:We}),At=re(t,"FORBID_CONTENTS",Ge,{transform:x}),vt=re(t,"FORBID_TAGS",Mt({}),{transform:x}),ne=re(t,"FORBID_ATTR",Mt({}),{transform:x}),Et=wt(t,"USE_PROFILES")?t.USE_PROFILES&&typeof t.USE_PROFILES=="object"?Mt(t.USE_PROFILES):t.USE_PROFILES:!1,me=t.ALLOW_ARIA_ATTR!==!1,ft=t.ALLOW_DATA_ATTR!==!1,oe=t.ALLOW_UNKNOWN_PROTOCOLS||!1,fe=t.ALLOW_SELF_CLOSE_IN_ATTR!==!1,ot=t.SAFE_FOR_TEMPLATES||!1,f=t.SAFE_FOR_XML!==!1,p=t.WHOLE_DOCUMENT||!1,W=t.RETURN_DOM||!1,lt=t.RETURN_DOM_FRAGMENT||!1,yt=t.RETURN_TRUSTED_TYPE||!1,G=t.FORCE_BODY||!1,Gt=t.SANITIZE_DOM!==!1,He=t.SANITIZE_NAMED_PROPS||!1,ge=t.KEEP_CONTENT!==!1,be=t.IN_PLACE||!1,ue=md(t.ALLOWED_URI_REGEXP)?t.ALLOWED_URI_REGEXP:Po,_t=typeof t.NAMESPACE=="string"?t.NAMESPACE:K,Te=Kn(t,"MATHML_TEXT_INTEGRATION_POINTS",()=>L({},Ye)),Se=Kn(t,"HTML_INTEGRATION_POINTS",()=>L({},$e));let o=Kn(t,"CUSTOM_ELEMENT_HANDLING",()=>De(null));if(V=De(null),wt(o,"tagNameCheck")&&Ke(o.tagNameCheck)&&(V.tagNameCheck=o.tagNameCheck),wt(o,"attributeNameCheck")&&Ke(o.attributeNameCheck)&&(V.attributeNameCheck=o.attributeNameCheck),wt(o,"allowCustomizedBuiltInElements")&&typeof o.allowCustomizedBuiltInElements=="boolean"&&(V.allowCustomizedBuiltInElements=o.allowCustomizedBuiltInElements),st(V),ot&&(ft=!1),lt&&(W=!0),Et&&(T=L({},Oo),E=De(null),Et.html===!0&&(L(T,Mo),L(E,Io)),Et.svg===!0&&(L(T,jn),L(E,$n),L(E,Tn)),Et.svgFilters===!0&&(L(T,Vn),L(E,$n),L(E,Tn)),Et.mathMl===!0&&(L(T,Yn),L(E,Do),L(E,Tn))),nt.tagCheck=null,nt.attributeCheck=null,wt(t,"ADD_TAGS")&&(typeof t.ADD_TAGS=="function"?nt.tagCheck=t.ADD_TAGS:Pe(t.ADD_TAGS)&&(T===Bt&&(T=Mt(T)),L(T,t.ADD_TAGS,x))),wt(t,"ADD_ATTR")&&(typeof t.ADD_ATTR=="function"?nt.attributeCheck=t.ADD_ATTR:Pe(t.ADD_ATTR)&&(E===jt&&(E=Mt(E)),L(E,t.ADD_ATTR,x))),wt(t,"ADD_FORBID_CONTENTS")&&Pe(t.ADD_FORBID_CONTENTS)&&(At===Ge&&(At=Mt(At)),L(At,t.ADD_FORBID_CONTENTS,x)),ge&&(T["#text"]=!0),p&&L(T,["html","head","body"]),T.table&&(L(T,["tbody"]),delete vt.tbody),t.TRUSTED_TYPES_POLICY){if(typeof t.TRUSTED_TYPES_POLICY.createHTML!="function")throw xe('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof t.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw xe('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');let d=P;P=t.TRUSTED_TYPES_POLICY;try{et=pt("")}catch(c){throw P=d,c}}else t.TRUSTED_TYPES_POLICY===null?(P=void 0,et=""):(P===void 0&&(P=ie()),P&&typeof et=="string"&&(et=pt("")));rt&&rt(t),xt=t},Xe=L({},[...jn,...Vn,...fd]),Ze=L({},[...Yn,...gd]),Rn=function(t,o,d){return o.namespaceURI===K?t==="svg":o.namespaceURI===Vt?t==="svg"&&(d==="annotation-xml"||Te[d]):!!Xe[t]},Cn=function(t,o,d){return o.namespaceURI===K?t==="math":o.namespaceURI===Yt?t==="math"&&Se[d]:!!Ze[t]},Mn=function(t,o,d){return o.namespaceURI===Yt&&!Se[d]||o.namespaceURI===Vt&&!Te[d]?!1:!Ze[t]&&(An[t]||!Xe[t])},On=function(t){let o=at(t);(!o||!o.tagName)&&(o={namespaceURI:_t,tagName:"template"});let d=mn(t.tagName),c=mn(o.tagName);return we[t.namespaceURI]?t.namespaceURI===Yt?Rn(d,o,c):t.namespaceURI===Vt?Cn(d,o,c):t.namespaceURI===K?Mn(d,o,c):!!(Nt==="application/xhtml+xml"&&we[t.namespaceURI]):!1},ht=function(t){hn(e.removed,{element:t});try{at(t).removeChild(t)}catch(o){if(O(t),!at(t))throw xe("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place")}},Je=function(t,o,d){try{Y(t,o)}catch(c){try{t.removeAttribute(d)}catch(l){}}},$t=function(t){Kt(t);let o=Z(t);if(o){let c=[];ke(o,l=>{hn(c,l)}),ke(c,l=>{try{O(l)}catch(u){}})}let d=I(t);if(d)for(let c=d.length-1;c>=0;--c){let l=d[c],u=l&&l.name;typeof u=="string"&&Je(t,l,u)}},gt=function(t,o,d){if(!d)try{d=o.getAttributeNode(t)}catch(c){d=null}hn(e.removed,{attribute:d||null,from:o});try{d?Y(o,d):o.removeAttribute(t)}catch(c){try{o.removeAttribute(t)}catch(l){}}if(t==="is")if(W||lt)try{ht(o)}catch(c){}else try{o.setAttribute(t,"")}catch(c){}},In=function(t){let o=I(t);if(o)for(let d=o.length-1;d>=0;--d){let c=o[d],l=c&&c.name;typeof l!="string"||E[x(l)]||Je(t,c,l)}},Kt=function(t){let o=[t];for(;o.length>0;){let d=o.pop();tt(d)===Ct.element&&In(d);let l=Z(d);if(l)for(let u=l.length-1;u>=0;--u)o.push(l[u])}},Qe=function(t,o){return f?t==="patchsrc"?!0:t==="for"&&o!=="label"&&o!=="output":!1},Dn=function(t){if(!f)return;let o=[t];for(;o.length>0;){let d=o.pop(),c=tt(d);if(c===Ct.processingInstruction||c===Ct.comment&&ut(zo,d.data)){try{O(d)}catch(u){}continue}if(c===Ct.element){let u=d,v=x(bt(d));try{u.hasAttribute&&u.hasAttribute("patchsrc")&&u.removeAttribute("patchsrc"),u.hasAttribute&&u.hasAttribute("for")&&Qe("for",v)&&u.removeAttribute("for")}catch(A){}}let l=Z(d);if(l)for(let u=l.length-1;u>=0;--u)o.push(l[u])}},tn=function(t){let o=null,d=null;if(G)t="<remove></remove>"+t;else{let u=xo(t,/^[\r\n\t ]+/);d=u&&u[0]}Nt==="application/xhtml+xml"&&_t===K&&(t='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+t+"</body></html>");let c=P?pt(t):t;if(_t===K)try{o=new M().parseFromString(c,Nt)}catch(u){}if(!o||!o.documentElement){o=zt.createDocument(_t,"template",null);try{o.documentElement.innerHTML=ye?et:c}catch(u){}}let l=o.body||o.documentElement;return t&&d&&l.insertBefore(r.createTextNode(d),l.childNodes[0]||null),_t===K?qt.call(o,p?"html":"body")[0]:p?o.documentElement:l},en=function(t){let o=D?D(t):t.ownerDocument;return ce.call(o||t,t,b.SHOW_ELEMENT|b.SHOW_COMMENT|b.SHOW_TEXT|b.SHOW_PROCESSING_INSTRUCTION|b.SHOW_CDATA_SECTION,null)},Xt=function(t){return t=pn(t,Fe," "),t=pn(t,le," "),t=pn(t,Ht," "),t},Ee=function(t){var o;t.normalize();let d=D?D(t):t.ownerDocument,c=ce.call(d||t,t,b.SHOW_TEXT|b.SHOW_COMMENT|b.SHOW_CDATA_SECTION|b.SHOW_PROCESSING_INSTRUCTION,null),l=c.nextNode();for(;l;)l.data=Xt(l.data),l=c.nextNode();let u=(o=t.querySelectorAll)===null||o===void 0?void 0:o.call(t,"template");u&&ke(u,v=>{kt(v.content)&&Ee(v.content)})},Zt=function(t){let o=C?C(t):null;return typeof o!="string"||x(o)!=="form"?!1:typeof t.nodeName!="string"||typeof t.textContent!="string"||typeof t.removeChild!="function"||t.attributes!==I(t)||typeof t.removeAttribute!="function"||typeof t.removeAttributeNode!="function"||typeof t.getAttributeNode!="function"||typeof t.setAttribute!="function"||typeof t.namespaceURI!="string"||typeof t.insertBefore!="function"||typeof t.hasChildNodes!="function"||t.nodeType!==w(t)||t.childNodes!==Z(t)},kt=function(t){if(!w||typeof t!="object"||t===null)return!1;try{return w(t)===Ct.documentFragment}catch(o){return!1}},Ft=function(t){if(!w||typeof t!="object"||t===null)return!1;try{return typeof w(t)=="number"}catch(o){return!1}};function X(s,t,o){s.length!==0&&ke(s,d=>{d.call(e,t,o,xt)})}let Pn=function(t,o){return!!(f&&t.hasChildNodes()&&!Ft(t.firstElementChild)&&ut(Lo,t.textContent)&&ut(Lo,t.innerHTML)||f&&t.namespaceURI===K&&Rd[o]&&(Ft(t.firstElementChild)||typeof t.textContent=="string"&&ut(Cd[o],t.textContent))||t.nodeType===Ct.processingInstruction||f&&t.nodeType===Ct.comment&&ut(zo,t.data))},Jt=function(t,o){if(t instanceof RegExp)return ut(t,o);if(t instanceof Function){for(var d=arguments.length,c=new Array(d>2?d-2:0),l=2;l<d;l++)c[l-2]=arguments[l];return!!t(o,...c)}return!1},Ln=function(t,o,d){if(!vt[o]&&an(o)&&Jt(V.tagNameCheck,o))return!1;if(ge&&!At[o]){let c=at(t),l=Z(t);if(l&&c){let u=l.length;for(let v=u-1;v>=0;--v){let A=t===d?F(l[v],!0):l[v];c.insertBefore(A,Lt(t))}}}return ht(t),!0},nn=function(t,o,d,c){return t.length===0?o:o===d||o===c?Mt(o):o},on=function(t,o){return t===o||at(t)!==null?!1:(be&&Kt(t),!0)},rn=function(t,o){if(X(S.beforeSanitizeElements,t,null),on(t,o))return!0;if(Zt(t))return ht(t),!0;let d=x(bt(t));if(T=nn(S.uponSanitizeElement,T,Bt,y),X(S.uponSanitizeElement,t,{tagName:d,allowedTags:T}),on(t,o))return!0;if(Pn(t,d))return ht(t),!0;if(vt[d]||!(nt.tagCheck instanceof Function&&nt.tagCheck(d))&&!T[d]){let l=Ln(t,d,o);return l===!1&&X(S.afterSanitizeElements,t,null),l}if(tt(t)===Ct.element&&!On(t)||(d==="noscript"||d==="noembed"||d==="noframes")&&ut(xd,t.innerHTML))return ht(t),!0;if(ot&&t.nodeType===Ct.text){let l=Xt(t.textContent);t.textContent!==l&&(hn(e.removed,{element:t.cloneNode()}),t.textContent=l)}return X(S.afterSanitizeElements,t,null),!1},dn=function(t,o,d){if(ne[o]||Qe(o,t)||Gt&&(o==="id"||o==="name")&&(d in r||d in kn))return!1;let c=E[o]||nt.attributeCheck instanceof Function&&nt.attributeCheck(o,t);return ft&&ut(he,o)||me&&ut(Ue,o)?!0:c?je[o]||ut(ue,pn(d,pe,""))||(o==="src"||o==="xlink:href"||o==="href")&&t!=="script"&&ko(d,"data:")===0&&qe[t]||oe&&!ut(Oe,pn(d,pe,""))?!0:!d:an(t)&&Jt(V.tagNameCheck,t)&&Jt(V.attributeNameCheck,o,t)||o==="is"&&V.allowCustomizedBuiltInElements&&Jt(V.tagNameCheck,d)},zn=L({},["annotation-xml","color-profile","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","missing-glyph"]),an=function(t){return!zn[mn(t)]&&ut(Wt,t)},Nn=function(t,o,d,c){if(P&&typeof B=="object"&&typeof B.getAttributeType=="function"&&!d)switch(B.getAttributeType(t,o)){case"TrustedHTML":return pt(c);case"TrustedScriptURL":return se(c)}return c},Fn=function(t,o,d,c){try{return d?t.setAttributeNS(d,o,c):t.setAttribute(o,c),Zt(t)?(ht(t),!1):!0}catch(l){return gt(o,t),!1}},sn=function(t){X(S.beforeSanitizeAttributes,t,null);let o=t.attributes;if(!o||Zt(t))return;E=nn(S.uponSanitizeAttribute,E,jt,q);let d={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:E,forceKeepAttr:void 0},c=o.length,l=x(t.nodeName);for(;c--;){let u=o[c],v=u.name,A=u.namespaceURI,U=u.value,H=x(v),_e=U,N=v==="value"?_e:id(_e),cn=!1;if(d.attrName=H,d.attrValue=N,d.keepAttr=!0,d.forceKeepAttr=void 0,X(S.uponSanitizeAttribute,t,d),N=d.attrValue,He&&(H==="id"||H==="name")&&ko(N,Be)!==0&&(gt(v,t,u),N=Be+N,cn=!0),f&&ut(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,N)){gt(v,t,u);continue}if(H==="attributename"&&xo(N,"href")){gt(v,t,u);continue}if(!d.forceKeepAttr){if(!d.keepAttr){gt(v,t,u);continue}if(!fe&&ut(kd,N)){gt(v,t,u);continue}if(ot&&(N=Xt(N)),!dn(l,H,N)){gt(v,t,u);continue}N=Nn(l,H,A,N),N!==_e&&Fn(t,v,A,N)&&cn&&_o(e.removed)}}X(S.afterSanitizeAttributes,t,null)},Qt=function(t){let o=null,d=en(t);for(X(S.beforeSanitizeShadowDOM,t,null);o=d.nextNode();)if(X(S.uponSanitizeShadowNode,o,null),rn(o,t),sn(o),kt(o.content)&&Qt(o.content),tt(o)===Ct.element){let c=Ut(o);kt(c)&&(Ae(c),Qt(c))}X(S.afterSanitizeShadowDOM,t,null)},Ae=function(t){let o=[{node:t,shadow:null}];for(;o.length>0;){let d=o.pop();if(d.shadow){Qt(d.shadow);continue}let c=d.node,u=tt(c)===Ct.element,v=Z(c);if(v)for(let A=v.length-1;A>=0;--A)o.push({node:v[A],shadow:null});if(u){let A=C?C(c):null;if(typeof A=="string"&&x(A)==="template"){let U=c.content;kt(U)&&o.push({node:U,shadow:null})}}if(u){let A=Ut(c);kt(A)&&o.push({node:null,shadow:A},{node:A,shadow:null})}}};return e.sanitize=function(s){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},o=null,d=null,c=null,l=null;if(ye=!s,ye&&(s="<!-->"),typeof s!="string"&&!Ft(s)&&(s=ud(s),typeof s!="string"))throw xe("dirty is not a string, aborting");if(!e.isSupported)return s;m?(T=y,E=q):ve(t),(S.uponSanitizeElement.length>0||S.uponSanitizeAttribute.length>0)&&(T=Mt(T)),S.uponSanitizeAttribute.length>0&&(E=Mt(E)),e.removed=[];let u=be&&typeof s!="string"&&Ft(s);if(u){Dn(s);let U=bt(s);if(typeof U=="string"){let H=x(U);if(!T[H]||vt[H])throw $t(s),xe("root node is forbidden and cannot be sanitized in-place")}if(Zt(s))throw $t(s),xe("root node is clobbered and cannot be sanitized in-place");try{Ae(s)}catch(H){throw $t(s),H}}else if(Ft(s))o=tn("<!---->"),d=o.ownerDocument.importNode(s,!0),d.nodeType===Ct.element&&d.nodeName==="BODY"||d.nodeName==="HTML"?o=d:o.appendChild(d),Ae(o);else{if(!W&&!ot&&!p&&s.indexOf("<")===-1)return P&&yt?pt(s):s;if(o=tn(s),!o)return W?null:yt?et:""}o&&G&&ht(o.firstChild);let v=u?s:o;try{let U=en(v);for(;c=U.nextNode();)rn(c,v),sn(c),kt(c.content)&&Qt(c.content)}catch(U){throw u&&($t(s),ke(e.removed,H=>{H.element&&Kt(H.element)})),U}if(u)return ke(e.removed,U=>{U.element&&Kt(U.element)}),ot&&Ee(s),s;if(W){if(ot&&Ee(o),lt)for(l=Ne.call(o.ownerDocument);o.firstChild;)l.appendChild(o.firstChild);else l=o;return(E.shadowroot||E.shadowrootmode)&&(l=ee.call(a,l,!0)),l}let A=p?o.outerHTML:o.innerHTML;return p&&T["!doctype"]&&o.ownerDocument&&o.ownerDocument.doctype&&o.ownerDocument.doctype.name&&ut(Ad,o.ownerDocument.doctype.name)&&(A="<!DOCTYPE "+o.ownerDocument.doctype.name+`>
`+A),ot&&(A=Xt(A)),P&&yt?pt(A):A},e.setConfig=function(){let s=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};ve(s),m=!0,y=T,q=E},e.clearConfig=function(){xt=null,m=!1,y=null,q=null,P=j,et=""},e.isValidAttribute=function(s,t,o){xt||ve({});let d=x(s),c=x(t);return dn(d,c,o)},e.addHook=function(s,t){typeof t=="function"&&wt(S,s)&&hn(S[s],t)},e.removeHook=function(s,t){if(wt(S,s)){if(t!==void 0){let o=ad(S[s],t);return o===-1?void 0:sd(S[s],o,1)[0]}return _o(S[s])}},e.removeHooks=function(s){wt(S,s)&&(S[s]=[])},e.removeAllHooks=function(){S=No()},e}var Id=Bo();Go.exports=Id});var Wd=uo((no,oo)=>{(function(n,e){typeof no=="object"&&typeof oo!="undefined"?oo.exports=e():typeof define=="function"&&define.amd?define(e):(n=typeof globalThis!="undefined"?globalThis:n||self,n.Split=e())})(no,(function(){"use strict";var n=typeof window!="undefined"?window:null,e=n===null,r=e?void 0:n.document,a="addEventListener",i="removeEventListener",h="getBoundingClientRect",g="_a",k="_b",b="_c",R="horizontal",M=function(){return!1},B=e?"calc":["","-webkit-","-moz-","-o-"].filter(function(I){var w=r.createElement("div");return w.style.cssText="width:"+I+"calc(9px)",!!w.style.length}).shift()+"calc",_=function(I){return typeof I=="string"||I instanceof String},F=function(I){if(_(I)){var w=r.querySelector(I);if(!w)throw new Error("Selector "+I+" did not match a DOM element");return w}return I},O=function(I,w,C){var D=I[w];return D!==void 0?D:C},Y=function(I,w,C,D){if(w){if(D==="end")return 0;if(D==="center")return I/2}else if(C){if(D==="start")return 0;if(D==="center")return I/2}return I},Lt=function(I,w){var C=r.createElement("div");return C.className="gutter gutter-"+w,C},Z=function(I,w,C){var D={};return _(w)?D[I]=w:D[I]=B+"("+w+"% - "+C+"px)",D},at=function(I,w){var C;return C={},C[I]=w+"px",C},Ut=function(I,w){if(w===void 0&&(w={}),e)return{};var C=I,D,tt,bt,P,et,j;Array.from&&(C=Array.from(C));var ae=F(C[0]),ct=ae.parentNode,te=getComputedStyle?getComputedStyle(ct):null,pt=te?te.flexDirection:null,se=O(w,"sizes")||C.map(function(){return 100/C.length}),ie=O(w,"minSize",100),St=Array.isArray(ie)?ie:C.map(function(){return ie}),zt=O(w,"maxSize",1/0),ce=Array.isArray(zt)?zt:C.map(function(){return zt}),Ne=O(w,"expandToMin",!1),qt=O(w,"gutterSize",10),ee=O(w,"gutterAlign","center"),S=O(w,"snapOffset",30),Fe=Array.isArray(S)?S:C.map(function(){return S}),le=O(w,"dragInterval",1),Ht=O(w,"direction",R),he=O(w,"cursor",Ht===R?"col-resize":"row-resize"),Ue=O(w,"gutter",Lt),Oe=O(w,"elementStyle",Z),pe=O(w,"gutterStyle",at);Ht===R?(D="width",tt="clientX",bt="left",P="right",et="clientWidth"):Ht==="vertical"&&(D="height",tt="clientY",bt="top",P="bottom",et="clientHeight");function Wt(f,p,m,y){var q=Oe(D,p,m,y);Object.keys(q).forEach(function(G){f.style[G]=q[G]})}function ue(f,p,m){var y=pe(D,p,m);Object.keys(y).forEach(function(q){f.style[q]=y[q]})}function T(){return j.map(function(f){return f.size})}function Bt(f){return"touches"in f?f.touches[0][tt]:f[tt]}function E(f){var p=j[this.a],m=j[this.b],y=p.size+m.size;p.size=f/this.size*y,m.size=y-f/this.size*y,Wt(p.element,p.size,this[k],p.i),Wt(m.element,m.size,this[b],m.i)}function jt(f){var p,m=j[this.a],y=j[this.b];this.dragging&&(p=Bt(f)-this.start+(this[k]-this.dragOffset),le>1&&(p=Math.round(p/le)*le),p<=m.minSize+m.snapOffset+this[k]?p=m.minSize+this[k]:p>=this.size-(y.minSize+y.snapOffset+this[b])&&(p=this.size-(y.minSize+this[b])),p>=m.maxSize-m.snapOffset+this[k]?p=m.maxSize+this[k]:p<=this.size-(y.maxSize-y.snapOffset+this[b])&&(p=this.size-(y.maxSize+this[b])),E.call(this,p),O(w,"onDrag",M)(T()))}function V(){var f=j[this.a].element,p=j[this.b].element,m=f[h](),y=p[h]();this.size=m[D]+y[D]+this[k]+this[b],this.start=m[bt],this.end=m[P]}function vt(f){if(!getComputedStyle)return null;var p=getComputedStyle(f);if(!p)return null;var m=f[et];return m===0?null:(Ht===R?m-=parseFloat(p.paddingLeft)+parseFloat(p.paddingRight):m-=parseFloat(p.paddingTop)+parseFloat(p.paddingBottom),m)}function ne(f){var p=vt(ct);if(p===null||St.reduce(function(G,W){return G+W},0)>p)return f;var m=0,y=[],q=f.map(function(G,W){var lt=p*G/100,yt=Y(qt,W===0,W===f.length-1,ee),Gt=St[W]+yt;return lt<Gt?(m+=Gt-lt,y.push(0),Gt):(y.push(lt-Gt),lt)});return m===0?f:q.map(function(G,W){var lt=G;if(m>0&&y[W]-m>0){var yt=Math.min(m,y[W]-m);m-=yt,lt=G-yt}return lt/p*100})}function nt(){var f=this,p=j[f.a].element,m=j[f.b].element;f.dragging&&O(w,"onDragEnd",M)(T()),f.dragging=!1,n[i]("mouseup",f.stop),n[i]("touchend",f.stop),n[i]("touchcancel",f.stop),n[i]("mousemove",f.move),n[i]("touchmove",f.move),f.stop=null,f.move=null,p[i]("selectstart",M),p[i]("dragstart",M),m[i]("selectstart",M),m[i]("dragstart",M),p.style.userSelect="",p.style.webkitUserSelect="",p.style.MozUserSelect="",p.style.pointerEvents="",m.style.userSelect="",m.style.webkitUserSelect="",m.style.MozUserSelect="",m.style.pointerEvents="",f.gutter.style.cursor="",f.parent.style.cursor="",r.body.style.cursor=""}function me(f){if(!("button"in f&&f.button!==0)){var p=this,m=j[p.a].element,y=j[p.b].element;p.dragging||O(w,"onDragStart",M)(T()),f.preventDefault(),p.dragging=!0,p.move=jt.bind(p),p.stop=nt.bind(p),n[a]("mouseup",p.stop),n[a]("touchend",p.stop),n[a]("touchcancel",p.stop),n[a]("mousemove",p.move),n[a]("touchmove",p.move),m[a]("selectstart",M),m[a]("dragstart",M),y[a]("selectstart",M),y[a]("dragstart",M),m.style.userSelect="none",m.style.webkitUserSelect="none",m.style.MozUserSelect="none",m.style.pointerEvents="none",y.style.userSelect="none",y.style.webkitUserSelect="none",y.style.MozUserSelect="none",y.style.pointerEvents="none",p.gutter.style.cursor=he,p.parent.style.cursor=he,r.body.style.cursor=he,V.call(p),p.dragOffset=Bt(f)-p.end}}se=ne(se);var ft=[];j=C.map(function(f,p){var m={element:F(f),size:se[p],minSize:St[p],maxSize:ce[p],snapOffset:Fe[p],i:p},y;if(p>0&&(y={a:p-1,b:p,dragging:!1,direction:Ht,parent:ct},y[k]=Y(qt,p-1===0,!1,ee),y[b]=Y(qt,!1,p===C.length-1,ee),pt==="row-reverse"||pt==="column-reverse")){var q=y.a;y.a=y.b,y.b=q}if(p>0){var G=Ue(p,Ht,m.element);ue(G,qt,p),y[g]=me.bind(y),G[a]("mousedown",y[g]),G[a]("touchstart",y[g]),ct.insertBefore(G,m.element),y.gutter=G}return Wt(m.element,m.size,Y(qt,p===0,p===C.length-1,ee),p),p>0&&ft.push(y),m});function oe(f){var p=f.i===ft.length,m=p?ft[f.i-1]:ft[f.i];V.call(m);var y=p?m.size-f.minSize-m[b]:f.minSize+m[k];E.call(m,y)}j.forEach(function(f){var p=f.element[h]()[D];p<f.minSize&&(Ne?oe(f):f.minSize=p)});function fe(f){var p=ne(f);p.forEach(function(m,y){if(y>0){var q=ft[y-1],G=j[q.a],W=j[q.b];G.size=p[y-1],W.size=m,Wt(G.element,G.size,q[k],G.i),Wt(W.element,W.size,q[b],W.i)}})}function ot(f,p){ft.forEach(function(m){if(p!==!0?m.parent.removeChild(m.gutter):(m.gutter[i]("mousedown",m[g]),m.gutter[i]("touchstart",m[g])),f!==!0){var y=Oe(D,m.a.size,m[k]);Object.keys(y).forEach(function(q){j[m.a].element.style[q]="",j[m.b].element.style[q]=""})}})}return{setSizes:fe,getSizes:T,collapse:function(p){oe(j[p])},destroy:ot,parent:ct,pairs:ft}};return Ut}))});var Hr={left:"arrowleft",right:"arrowright",up:"arrowup",down:"arrowdown"},Un=null;function Ie(){if(Un===null){var n=typeof navigator!="undefined"?navigator:null;Un=!!n&&/mac|iphone|ipad|ipod/i.test(n.platform||n.userAgent||"")}return Un}function Bn(n){var e=n.toLowerCase().split("+"),r=e.pop(),a={mod:!1,shift:!1,key:""};for(var i of e)if(i=="mod"||i=="ctrl"||i=="meta"||i=="cmd")a.mod=!0;else if(i=="shift")a.shift=!0;else return console.warn('Keyboard shortcut "'+n+'": unsupported modifier "'+i+'" (alt is layout-dependent), skipping'),null;r=Hr[r]||r;var h=/^[a-z]$/.test(r),g=/^f([1-9]|1[0-2])$/.test(r);return!h&&!g&&!/^[0-9]$/.test(r)&&!/^arrow/.test(r)?(console.warn('Keyboard shortcut "'+n+'": key "'+r+'" is layout-dependent (use a-z, 0-9, f1-f12), skipping'),null):a.shift&&!h&&!/^arrow/.test(r)?(console.warn('Keyboard shortcut "'+n+'": shift is only allowed with letters and arrows, skipping'),null):(a.key=r,a)}function Br(n,e){if(e.altKey)return!1;var r=Ie(),a=r?e.metaKey:e.ctrlKey,i=r?e.ctrlKey:e.metaKey;return n.mod!==a||i||n.shift!==e.shiftKey?!1:(e.key||"").toLowerCase()===n.key}var wn=class{constructor(){this.bindings=[];this.handler=e=>{if(!e.defaultPrevented)for(var r=0;r<this.bindings.length;r++){var a=this.bindings[r];if(Br(a.binding,e)){e.preventDefault(),e.stopPropagation(),a.fn(e);return}}}}bind(e,r){var a=Bn(e);a&&this.bindings.push({binding:a,fn:r})}unbindAll(){this.bindings=[]}attach(){window.addEventListener("keydown",this.handler)}detach(){window.removeEventListener("keydown",this.handler)}},Gr={mod:"Mod",cmd:"Mod",meta:"Mod",ctrl:"Ctrl",control:"Ctrl",shift:"Shift",alt:"Alt",option:"Alt"},Hn=null;function qr(){if(Hn===null){var n=typeof navigator!="undefined"?navigator:null;Hn=!!n&&/win/i.test(n.platform||n.userAgent||"")}return Hn}function mo(n){var e=n.split("-"),r=e.pop();r===""&&(r="-");var a=[];for(var i of e)if(i!==""){var h=Gr[i.toLowerCase()]||i;h=="Ctrl"&&!Ie()&&(h="Mod"),a.indexOf(h)<0&&a.push(h)}return a.sort(),a.concat([r.toLowerCase()]).join("-")}function Wr(n){var e=Ie()?n.mac:qr()?n.win:n.linux;return e||n.key}var _a=["Mod-Shift-a","Mod-Shift-d","Mod-Shift-e","Mod-Shift-f","Mod-Shift-g","Mod-Shift-h","Mod-Shift-i","Mod-Shift-j","Mod-Shift-k","Mod-Shift-l","Mod-Shift-r","Mod-Shift-x","Mod-Shift-y"];function xa(n,e){var r=e.map(mo);return n.filter(function(a){var i=Wr(a);return!i||r.indexOf(mo(i))<0})}var jr={shift:"\u21E7",ctrl:"\u2303",alt:"\u2325",meta:"\u2318",mod:"\u2318",cmd:"\u2318"},Vr={shift:"Shift",ctrl:"Ctrl",alt:"Alt",meta:"Win",mod:"Ctrl",cmd:"Cmd"},Yr={arrowleft:"\u2190",arrowright:"\u2192",arrowup:"\u2191",arrowdown:"\u2193",backspace:"\u232B",enter:"\u21A9",tab:"\u21E5",escape:"\u238B",space:"\u2423"};function qn(n){var e=n.toLowerCase().split("+"),r=e.pop(),a=Ie(),i=a?["shift","ctrl","alt","meta","mod","cmd"]:["mod","ctrl","shift","alt","meta","cmd"],h=i.filter(R=>e.indexOf(R)>=0);for(var g of e)h.indexOf(g)<0&&h.push(g);var k=h.map(R=>a?jr[R]||R:Vr[R]||R).join(a?"":"+"),b=/^[a-z][0-9]?$/.test(r)?r.toUpperCase():Yr[r]||(a?r:r.charAt(0).toUpperCase()+r.slice(1));return(k?k+(a?"":"+"):"")+b}var Gn=class{constructor(e){this.shortcutsSig="";this.status={};this.visible=!0;this.pendingShortcuts=!1;this.pendingStatus=!1;this.div=e,this.shortcutsZone=$(document.createElement("span")).addClass("shortcuts_zone"),this.statusZone=$(document.createElement("span")).addClass("status_zone"),$(e).append(this.shortcutsZone).append(this.statusZone)}setShortcuts(e){if(this.visible){var r=e.map(h=>h.key+""+h.label).join("");if(r!==this.shortcutsSig){if(ln){this.pendingShortcuts=!0;return}this.shortcutsSig=r,this.shortcutsZone.empty();for(var a of e){var i=$(document.createElement("span")).addClass("shortcut");i.append($(document.createElement("kbd")).text(qn(a.key))),i.append(document.createTextNode(" "+a.label)),a.fn&&fo(i,a.fn),this.shortcutsZone.append(i)}}}}setStatus(e,r){r?this.status[e]=r:delete this.status[e],this.renderStatus()}renderStatus(){if(this.visible){if(ln){this.pendingStatus=!0;return}this.statusZone.empty();for(var e of Object.keys(this.status)){var r=this.status[e],a=$(document.createElement("span")).addClass("status_item");r.cls&&a.addClass(r.cls),r.title&&a.prop("title",r.title),a.text(r.text),r.fn&&fo(a,r.fn),this.statusZone.append(a)}}}};function fo(n,e){n.addClass("clickable"),n.mousedown(r=>r.preventDefault()),n.click(e)}var ln=!1;function go(){Rt&&(Rt.pendingShortcuts&&(Rt.pendingShortcuts=!1,wo()),Rt.pendingStatus&&(Rt.pendingStatus=!1,Rt.renderStatus()))}function $r(){$(document).on("mousedown.shortcutbar",()=>{ln=!0}),$(document).on("mouseup.shortcutbar",()=>{ln=!1,go()}),$(window).on("blur.shortcutbar",()=>{ln=!1,go()})}var Rt=null;function Ca(n){Rt=new Gn(n),$r()}var bo=()=>[],yo=()=>[];function Ma(n){bo=n}function Oa(n){yo=n}function Ia(n){$(document.body).toggleClass("statusbar-hidden",!n),Rt&&(Rt.visible=n,n&&(Rt.shortcutsSig="",Rt.renderStatus(),wo()))}function wo(){if(Rt){var n=[...bo(),...yo()],e=document.activeElement;for(var r of To)e&&r.div.contains(e)&&(n=n.concat(r.fn()));Rt.setShortcuts(n.filter(a=>!Kr(a.key)))}}var To=[];function Da(n,e){To.push({div:n,fn:e})}function Kr(n){var e=n.toLowerCase();return!Ie()&&(e=="mod+shift+i"||e=="mod+shift+j"||e=="mod+shift+k"||e=="ctrl+alt+t"||e=="ctrl+alt+l")}function Xr(){return Ur()}function Zr(n){if(n._8bwPatched)return n;var e=n.stopCallback;return n.stopCallback=function(r,a,i,h){return r&&(r.ctrlKey||r.altKey||r.metaKey)?r.getModifierState&&r.getModifierState("AltGraph")?e.call(this,r,a,i,h):!1:e.call(this,r,a,i,h)},n._8bwPatched=!0,n}var So=class{constructor(e,r){this.boundkeys=[];let a=Zr(Xr());this.focusDiv=r,this.keybinder=new wn,this.keybinder.attach(),this.mousetrap=r?new a(r):a,this.span=$(document.createElement("span")).addClass("btn_toolbar"),e.appendChild(this.span[0]),this.newGroup()}destroy(){if(this.span&&(this.span.remove(),this.span=null),this.keybinder&&(this.keybinder.detach(),this.keybinder.unbindAll(),this.keybinder=null),this.mousetrap){for(var e of this.boundkeys)this.mousetrap.unbind(e);this.mousetrap=null}}newGroup(){return this.grp=$(document.createElement("span")).addClass("btn_group").appendTo(this.span).hide()}add(e,r,a,i){var h=null;return a&&(h=$(document.createElement("button")).addClass("btn"),a.startsWith("glyphicon")&&(a='<span class="glyphicon '+a+'" aria-hidden="true"></span>'),h.html(a),h.prop("title",e?r+" ("+qn(e)+")":r),h.click(i),this.grp.append(h).show()),e&&(!this.focusDiv&&Bn(e)?this.keybinder.bind(e,i):(this.mousetrap.bind(e,(g,k)=>(i(g,k),!1)),this.boundkeys.push(e))),h}};var Fa=window.matchMedia&&window.matchMedia("only screen and (max-width: 760px)").matches;function vo(n,e){var r=$(document.createElement("div"));return n&&r.appendTo(n),e&&r.addClass(e),r}var Wo={project:1.3,toolchain:1,docs:.7,debugger:.9},jo={func:1.2,macro:1.2,type:1.2,struct:1.2,enum:1.2,var:1.1,label:1.1,equate:1.1,proc:1.2,module:1.2,doc:.8,text:.3},Dd=4,Pd=1e3;function Jn(n){if(n){if(typeof n=="function")return n;if(typeof n.default=="function")return n.default;if(typeof n.MiniSearch=="function")return n.MiniSearch;if(typeof n.uFuzzy=="function")return n.uFuzzy}}var Sn=class{constructor(e=[]){this.records=[];this.nameHaystack=[];this.msIds=new Set;this.records=e,this.nameHaystack=e.map(r=>r.name),this.applySourceBoosts=!0,this.ufOptions={intraIns:2,interIns:2},this.msOptions={idField:"id",fields:["name","brief","detail"],storeFields:["id","name","kind","brief","detail","source","file","line","url"],tokenize:r=>r.split(/[^A-Za-z0-9_]+/).filter(a=>a.length>0)}}async init(){let e=await import("./uFuzzy-K7J24OJ4.js"),r=Jn(e);r&&(this.uf=new r(this.ufOptions));let a=await import("./es-CJMK4PHF.js"),i=Jn(a);if(i){this.ms=new i(this.msOptions);for(let h of this.records)this.addToMiniSearch(h)}}addToMiniSearch(e){if(!(!this.ms||typeof this.ms.add!="function")&&!this.msIds.has(e.id))try{this.ms.add(e),this.msIds.add(e.id)}catch(r){console.debug("MiniSearch add error:",r)}}pushRecords(e){this.records.push(...e),this.nameHaystack.push(...e.map(r=>r.name));for(let r of e)this.addToMiniSearch(r)}clear(){this.records=[],this.nameHaystack=[],this.msIds.clear(),this.ms&&typeof this.ms.removeAll=="function"&&this.ms.removeAll()}async setMiniSearch(e){let r=await import("./es-CJMK4PHF.js"),a=Jn(r);a&&(this.ms=new a(this.msOptions),this.ms.loadJS(e))}query(e,r){var g,k;if(this.records.length===0||!e)return[];let a=[];if(this.uf&&typeof this.uf.search=="function")try{let b=this.uf.search(this.nameHaystack,e),R=b==null?void 0:b[1],M=b==null?void 0:b[2],B=R==null?void 0:R.idx;if(B&&M)for(let _=0;_<M.length;_++){let F=M[_],O=B[F],Y=this.records[O];if(!Y)continue;let Z=this.baseScore(e,R,F)*Wo[Y.source]*((g=jo[Y.kind])!=null?g:1);a.push({record:Y,score:Z,ranges:(k=R.ranges)==null?void 0:k[F]})}}catch(b){console.debug("uFuzzy search error:",b)}if(this.ms&&typeof this.ms.search=="function"&&(e.length>=Dd||e.includes(" ")))try{let b=this.ms.search(e,{boost:{name:3,brief:1.5,detail:1},combineWith:"AND"});for(let R of b){let M=R;M&&!a.some(B=>B.record.id===M.id)&&a.push({record:M,score:(R.score||0)*Wo[M.source]*jo[R.kind]*1e3})}}catch(b){console.debug("MiniSearch error:",b)}a.sort((b,R)=>R.score-b.score);let i=new Set;return a.filter(b=>i.has(b.record.id)?!1:(i.add(b.record.id),!0)).slice(0,r)}baseScore(e,r,a){var O,Y,Lt,Z,at,Ut,I,w,C,D,tt,bt;let i=(Y=(O=r.chars)==null?void 0:O[a])!=null?Y:0,h=(Z=(Lt=r.interIns)==null?void 0:Lt[a])!=null?Z:0,g=(Ut=(at=r.intraIns)==null?void 0:at[a])!=null?Ut:0,k=(w=(I=r.start)==null?void 0:I[a])!=null?w:0,b=(D=(C=r.interLft2)==null?void 0:C[a])!=null?D:0,R=(bt=(tt=r.interRgt2)==null?void 0:tt[a])!=null?bt:0,M=i>=e.length,B=g===0&&h===0,_=k===0,F=Pd;return M&&B&&_?F=1e3:B&&_?F=980:M?F=950:F=900,F-=g*20,F-=h*10,F-=k*5,F-=R*3,F}};var Yo=()=>[];function $o(n){Yo=n}var Ld=/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;function zd(n){return n.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#(?:0*39|x27);/gi,"'").replace(/&nbsp;/g," ").replace(/&hellip;/g,"\u2026").replace(/&mdash;/g,"\u2014").replace(/&ndash;/g,"\u2013").replace(/&rsquo;|&lsquo;/g,"'").replace(/&rdquo;|&ldquo;/g,'"').replace(/&raquo;/g,"\xBB").replace(/&laquo;/g,"\xAB").replace(/&amp;/g,"&")}function Qn(n){return zd(n.replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim()}function Nd(n,e=180){let r=n.trim();if(!r)return;let i=r.slice(0,e).match(/^([\s\S]*?[.!?])(?:\s|$)/);return i?i[1]:r.length<=e?r:r.slice(0,e-1)+"\u2026"}function Fd(n){let e=[],r="#help/"+n.id,a=n.title||n.id,i=n.html||"",h=[],g=new RegExp(Ld.source,"gi"),k;for(;k=g.exec(i);)h.push({name:Qn(k[2]),start:k.index,end:g.lastIndex});let b=(_,F,O)=>{if(!F)return;let Y=Nd(O),Lt=Y&&O.startsWith(Y)?O.slice(Y.length).trim():O;e.push({id:`${n.id}:${_}`,name:F,kind:"doc",brief:Y,detail:Lt||void 0,source:"docs",file:a,url:r})},R=h.length?h[0].start:i.length,M=Qn(i.slice(0,R)),B=h.length&&h[0].start===0?h[0].name||n.title:n.title||n.id;b(0,B,M);for(let _=0;_<h.length;_++){if(_===0&&h[0].start===0)continue;let F=_+1<h.length?h[_+1].start:i.length;b(_+1,h[_].name,Qn(i.slice(h[_].end,F)))}return e}var Vo=class{constructor(){this.id="docs";this.kind="docs";this.index=null;this.readyPromise=null}async ready(){return this.readyPromise?this.readyPromise:(this.readyPromise=this.load(),this.readyPromise)}async load(){let e=Yo()||[];if(e.length===0)return;let r=[];for(let i of e)r.push(...Fd(i));if(r.length===0)return;let a=new Sn(r);await a.init(),this.index=a}async query(e,r){return await this.ready(),this.index?this.index.query(e,r):[]}};var Ko=`<h1>8bitworkshop IDE</h1>
<p>The 8bitworkshop IDE is a browser-based development environment for
micro computers and consoles.
The IDE compiles or assembles your source code
while you type, then the emulator runs your code.
This all happens locally in your web browser.</p>
<h2>Choosing a platform</h2>
<p>First, choose a hardware platform using the green <strong>Platform Selector</strong>
to the right of the main menu.
This reloads the IDE with the appropriate emulator and toolchain.</p>
<p>Each platform has several example programs that you can view and edit.
Use the <strong>Project Selector</strong> drop-down (next to the menu icon) to choose one.</p>
<h2>Editing files</h2>
<p>Edits are persisted in browser local storage and survive closing the
tab. To restore an example to its original state, choose
<strong>File \xBB Revert to Original\u2026</strong>. To start from scratch, choose
<strong>New Project\u2026</strong> and enter a filename (typically <code>.c</code> for C, or
<code>.asm</code> for assembly).</p>
<p>Each platform has its own virtual file system in the browser, so edits and
new files are only visible to the current platform.</p>
<p>See <a href="managing-files.md">Managing Files</a> for how to
export and import files, share playable links and videos, sync projects to GitHub, and pull projects from GitHub.</p>
<h2>Emulators</h2>
<p>Every platform includes a built-in emulator that runs your code on
simulated hardware. Click the emulator screen to give it keyboard focus.
The IDE shows the key bindings used by the current platform; some
platforms also support gamepads.</p>
<h2>Compilers</h2>
<p>C compilers and assemblers for most platforms run in the browser. Each
time you change the code it is recompiled automatically. Errors appear
in a list in the upper-right corner of the page; click the link beside
an error to jump to the offending source line.</p>
<p>If the build succeeds, the emulator restarts with the new ROM image, so
you see changes near-instantly.</p>
<p>See <a href="build-directives.md">Build Directives</a> for information on
multi-file projects, compiler/linker directives, and file extensions.</p>
<p>See <a href="toolchains.md">Toolchains &amp; Platforms</a> for the full list of tools and
the complete platform \xD7 extension \u2192 tool reference.</p>
<h2>Debugger</h2>
<p>The IDE includes a debugger for stepping through machine code, viewing
memory, and starting/stopping the program. The buttons at the top of the
screen perform these functions:</p>
<ul>
<li><strong>Reset:</strong> hard-reset the emulator, then single-step to the first
instruction.</li>
<li><strong>Pause:</strong> stop the emulator.</li>
<li><strong>Run:</strong> resume the emulator after pausing.</li>
<li><strong>Single Step:</strong> execute the next CPU instruction.</li>
<li><strong>Step Over:</strong> execute until the next source line, or step over a subroutine, then break.</li>
<li><strong>Next Frame/Interrupt:</strong> run until the next video frame starts, then
break.</li>
<li><strong>Run To Line:</strong> set a breakpoint on the current source line (or click
the gutter to the left of a line). The emulator stops when execution
reaches that instruction.</li>
<li><strong>Step Out of Subroutine:</strong> run until the current subroutine returns,
then break.</li>
<li><strong>Step Backwards:</strong> step back a single CPU instruction.</li>
</ul>
<p>Some platforms also offer:</p>
<ul>
<li><strong>Analyze Timing:</strong> perform a <em>flow analysis</em> of your code and compute
timing values for each instruction.</li>
<li><strong>Highlight Executed Lines:</strong> highlight lines of source code as they are executed by the emulator.</li>
<li><strong>Start Recording:</strong> enable the replay feature, which lets you rewind
the emulator and scroll to arbitrary frames and CPU cycles.</li>
</ul>
<p>When the IDE hits a breakpoint or a single-step, a debug window appears
in the lower-right showing the CPU state. Click the links at the bottom
of the window for more detail. See <a href="breakpoints.md">Breakpoints</a>.</p>
<h2>Sidebar windows</h2>
<p>The sidebar to the left of the editor lists every source file in your
project \u2014 the main file (shown in the pulldown), any included or linked
files, and any generated listings. Depending on the platform, additional
tools appear:</p>
<table>
<thead>
<tr>
<th>Window</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><a href="editor.md">Editor</a></td>
<td>Edit source files; read-only listings, headers, and binary views</td>
</tr>
<tr>
<td><a href="disasm.md">Disassembly</a></td>
<td>Disassemble the program around the program counter</td>
</tr>
<tr>
<td><a href="memory.md">Memory Browser</a></td>
<td>Hex dump of CPU memory</td>
</tr>
<tr>
<td><a href="memmap.md">Memory Map</a></td>
<td>Map of memory areas, linker segments and large variables</td>
</tr>
<tr>
<td><a href="vram.md">VRAM Browser</a></td>
<td>Hex dump of video memory (systems with a separate VDP)</td>
</tr>
<tr>
<td><a href="memprobe.md">Memory Probe</a></td>
<td>Heat map of memory read/write activity</td>
</tr>
<tr>
<td><a href="crtprobe.md">CRT Probe</a></td>
<td>Memory activity laid out by raster position</td>
</tr>
<tr>
<td><a href="probelog.md">Probe Log</a></td>
<td>Textual log of CPU/memory activity</td>
</tr>
<tr>
<td><a href="scanlineio.md">Scanline I/O</a></td>
<td>I/O and VRAM access per scanline</td>
</tr>
<tr>
<td><a href="symbols.md">Symbol Profiler</a></td>
<td>Read/write counts per symbol</td>
</tr>
<tr>
<td><a href="callstack.md">Call Stack</a></td>
<td>Call graph reconstructed from the stack</td>
</tr>
<tr>
<td><a href="debugtree.md">Debug Tree</a></td>
<td>Hierarchical view of platform debug info</td>
</tr>
<tr>
<td><a href="breakpoints.md">Breakpoints</a></td>
<td>Add and edit breakpoints</td>
</tr>
<tr>
<td><a href="asseteditor.md">Asset Editor</a></td>
<td>Edit bitmaps, tilemaps, and palettes embedded in source</td>
</tr>
</tbody>
</table>
<h2>Keyboard Shortcuts</h2>
<p><code>mod</code> below is <strong>Ctrl</strong> on Windows/Linux and <strong>Cmd</strong> on macOS.</p>
<table>
<thead>
<tr>
<th>Shortcut</th>
<th>Action</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>F1</code></td>
<td>Help for the active view</td>
</tr>
<tr>
<td><code>F8</code></td>
<td>Pause / resume</td>
</tr>
<tr>
<td><code>mod+Shift+F</code></td>
<td>Search symbols, files, and docs</td>
</tr>
<tr>
<td><code>mod+Shift+G</code></td>
<td>Go To Address</td>
</tr>
<tr>
<td><code>mod+Shift+R</code></td>
<td>Reset and run</td>
</tr>
<tr>
<td><code>mod+Shift+D</code></td>
<td>Reset and break</td>
</tr>
<tr>
<td><code>mod+Shift+L</code></td>
<td>Single step</td>
</tr>
<tr>
<td><code>mod+Shift+K</code></td>
<td>Step over</td>
</tr>
<tr>
<td><code>mod+Shift+I</code></td>
<td>Step out of subroutine</td>
</tr>
<tr>
<td><code>mod+Shift+J</code></td>
<td>Step backwards</td>
</tr>
<tr>
<td><code>mod+Shift+X</code></td>
<td>Next frame/interrupt</td>
</tr>
<tr>
<td><code>mod+Shift+A</code></td>
<td>Restart at cursor</td>
</tr>
<tr>
<td><code>mod+Shift+Y</code></td>
<td>Run to line</td>
</tr>
</tbody>
</table>
<p>The context-sensitive shortcuts are also shown as clickable chips in the
status bar at the bottom of the window (toggle it under
<strong>Settings \xBB Show keyboard shortcuts / status bar</strong>).</p>
<p>See <a href="editor.md">Editor</a> for editor-specific shortcuts.</p>
`;var Xo=`<h1>Editor</h1>
<p>The source editor is based on <a href="https://codemirror.net/">CodeMirror 6</a>.
Syntax highlighting is chosen from the toolchain that handles the file\u2019s
extension, so a <code>.c</code> file opens as C, a <code>.ca65</code> file as 6502 assembly,
and so on. Every edit triggers a rebuild; see the
<a href="index.md">IDE overview</a>.</p>
<h2>File windows</h2>
<p>The sidebar lists one entry per file in the project:</p>
<ul>
<li><strong>Source files</strong> \u2014 the main file and any file reached by an
<code>#include</code> or <code>//#link</code> directive. These open in the editable source
editor. See <a href="build-directives.md">Build Directives</a>.</li>
<li><strong>Listings</strong> \u2014 compiler/assembler listings (for example <code>.lst</code> or
symbol listings) generated by the build. These open read-only. The
view follows the program counter while debugging and supports <strong>Go To
Address</strong>.</li>
<li><strong>Toolchain headers</strong> \u2014 clicking the badge next to an <code>#include</code> line
opens the referenced header from the toolchain\u2019s bundled include
filesystem in a read-only viewer.</li>
<li><strong>Binary files</strong> \u2014 binary files open in a read-only hex dump.</li>
</ul>
<h2>Gutter</h2>
<p>For some platforms, the gutter shows additional information next to source lines:</p>
<ul>
<li><strong>Hex offset</strong> \u2013 The offset of a given source line.</li>
<li><strong>Code bytes</strong> \u2013 The bytes for a given assembly instruction.</li>
<li><strong>CPU Cycles</strong> \u2013 The number of CPU cycles for a given assembly instruction.</li>
<li>Click the hex offset (or the yellow arrow) to run and break on that line.</li>
<li>Click the red circle to toggle a breakpoint \u2014 see <a href="breakpoints.md">Breakpoints</a>.</li>
</ul>
<h2>Editor keyboard shortcuts</h2>
<h3>Editing</h3>
<table>
<thead>
<tr>
<th>Shortcut</th>
<th>Action</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>Tab</code></td>
<td>Insert spaces or a tab character (per settings) or indent selection</td>
</tr>
<tr>
<td><code>Shift+Tab</code></td>
<td>Unindent the current line or selection</td>
</tr>
<tr>
<td><code>mod+Z</code></td>
<td>Undo</td>
</tr>
<tr>
<td><code>mod+Shift+Z</code></td>
<td>Redo</td>
</tr>
<tr>
<td><code>mod+F</code></td>
<td>Find</td>
</tr>
<tr>
<td><code>mod+G</code></td>
<td>Find next match</td>
</tr>
<tr>
<td><code>mod+D</code></td>
<td>Select the next occurrence of the selection</td>
</tr>
<tr>
<td><code>mod+Shift+Backspace</code></td>
<td>Delete the current line</td>
</tr>
</tbody>
</table>
<p>The editor also inherits the standard <a href="https://codemirror.net/">CodeMirror 6</a> keymap,
including cursor/word movement and selection with the arrow keys, and cut/
copy/paste (<code>mod+X</code>, <code>mod+C</code>, <code>mod+V</code>).</p>
`;var Zo=`<h1>Disassembly</h1>
<p>The Disassembly window disassembles machine code around the current
program counter. It is available on platforms that expose both a
disassembler and a savable CPU state.</p>
<p>Each line shows:</p>
<table>
<thead>
<tr>
<th>Column</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td>Address</td>
<td>The 16-bit program counter for the instruction</td>
</tr>
<tr>
<td>Bytes</td>
<td>The raw opcode bytes (padded for alignment)</td>
</tr>
<tr>
<td>Mnemonic</td>
<td>The disassembled instruction</td>
</tr>
<tr>
<td>Comment</td>
<td>The symbol defined at that address, if any</td>
</tr>
</tbody>
</table>
<p>The view is centered on the program counter (PC). While debugging, it
follows the PC as you step. Symbol names are substituted for addresses
when a symbol map is available, so jumps and loads show labels instead
of raw hex.</p>
<h2>Navigating</h2>
<ul>
<li><strong>Go To Address</strong> re-centers the window on an address or symbol and
highlights it.</li>
<li>Addresses in the operand columns are linked to their symbols when the
map contains them.</li>
</ul>
<h2>Listing vs. disassembly</h2>
<p>The Disassembly window is generated live by the emulator\u2019s disassembler.
A compiler or assembler <em>listing</em> is a separate, read-only window built
from the tool\u2019s own output; see <a href="editor.md">Editor</a>. The listing follows
the program counter using the line-to-address map from the assembler,
which is more accurate for source-level navigation than the live
disassembly.</p>
`;var Jo=`<h1>Memory Browser</h1>
<p>The Memory Browser shows a hex dump of CPU memory. It is available on
platforms that implement <code>readAddress</code>.</p>
<p>The dump is laid out 16 bytes per row:</p>
<pre><code>0000  00 01 02 03 04 05 06 07  08 09 0a 0b 0c 0d 0e 0f
</code></pre>
<ul>
<li>Each row begins with the address of its first byte.</li>
<li>Rows are color-coded by the memory segment they fall into, using the
same segment data as the <a href="memmap.md">Memory Map</a>.</li>
<li>When the window opens it scrolls to the program\u2019s data segment.</li>
</ul>
<h2>Navigating</h2>
<ul>
<li><strong>Go To Address</strong> scrolls to an address or symbol and highlights the
row containing it.</li>
<li>Clicking a segment in the <a href="memmap.md">Memory Map</a> opens this
window and scrolls to that segment\u2019s start address.</li>
</ul>
`;var Qo=`<h1>Memory Map</h1>
<p>The Memory Map draws the program\u2019s memory layout as columns that share
one address axis. Each row starts at the address shown on the left, and
row height grows with the size of the range.</p>
<p>The window appears when the current project has segment information,
which most linker-based toolchains provide.</p>
<h2>Columns</h2>
<ul>
<li><strong>System</strong> shows the platform\u2019s native memory map (RAM, ROM, I/O).
Gaps between areas appear as dashed \u201Cunmapped\u201D bars, so the column
covers the whole address space.</li>
<li><strong>Segments</strong> shows the segments the linker produced. Free space
between segments appears as an empty bar.</li>
<li><strong>Objects</strong> shows large variables and arrays (16 bytes or more) in
RAM. Sizes come from the toolchain when it reports them (cc65, oscar64);
otherwise they are estimated from the distance to the next symbol.</li>
</ul>
<p>A column is hidden when it has nothing to show. Overlapping areas (for
example ROM and a language card) appear side by side, up to two per
column. Further overlaps fold into a neighboring bar, marked <code>+N</code>; its
tooltip lists them all.</p>
<ul>
<li>Hover a bar to see its start and end addresses and its size in bytes.
Estimated sizes are marked with <code>~</code>.</li>
</ul>
<h2>Navigating</h2>
<p>Click any bar to open the <a href="memory.md">Memory Browser</a> and
scroll it to that bar\u2019s start address.</p>
`;var tr=`<h1>VRAM Browser</h1>
<p>The VRAM Browser is a hex dump of video memory. It is available on
systems with a separate video chip and a <code>readVRAMAddress</code> implementation.</p>
<p>It behaves like the <a href="memory.md">Memory Browser</a> \u2014 16 bytes per
row \u2014 but reads through the platform\u2019s video-memory accessor instead of
CPU memory, and its rows are all shown with the <code>video</code> segment color.</p>
<p>The dump does not scroll to a data segment on open, since VRAM has no
linker segments.</p>
`;var er=`<h1>Memory Probe</h1>
<p>The Memory Probe is a heat map of memory activity. It is available on
platforms that implement <code>startProbing</code>.</p>
<p>The canvas is a 256\xD7256 grid of the 64K address space:</p>
<ul>
<li><strong>X</strong> is the low byte of the address.</li>
<li><strong>Y</strong> is the high byte.</li>
<li>The faint background shows a compressed view of current memory
contents, so the map is still readable before anything executes.</li>
</ul>
<p>Activity is drawn in color by operation type:</p>
<table>
<thead>
<tr>
<th>Color</th>
<th>Operation</th>
</tr>
</thead>
<tbody>
<tr>
<td>Green</td>
<td>Execute</td>
</tr>
<tr>
<td>Red</td>
<td>Memory read</td>
</tr>
<tr>
<td>Blue</td>
<td>Memory write</td>
</tr>
<tr>
<td>Teal</td>
<td>I/O read</td>
</tr>
<tr>
<td>Magenta</td>
<td>I/O write</td>
</tr>
<tr>
<td>Yellow</td>
<td>DMA/VRAM read</td>
</tr>
<tr>
<td>Light blue</td>
<td>DMA/VRAM write</td>
</tr>
<tr>
<td>Bright green</td>
<td>Interrupt</td>
</tr>
<tr>
<td>White</td>
<td>Illegal / error</td>
</tr>
<tr>
<td>Pink</td>
<td>Wait</td>
</tr>
</tbody>
</table>
<p>The view shows a complete frame, and might be incomplete during debugging.</p>
<h2>Tooltips</h2>
<p>Hovering the map shows the routines and operations that touched that
address, including the program counter that performed each access and
any associated value.</p>
`;var nr=`<h1>CRT Probe</h1>
<p>The CRT Probe shows memory and I/O activity laid out by <em>raster
position</em> instead of by address, so you can see what the CPU touches at
each point of the display sweep. It is available on platforms that
implement <code>startProbing</code>.</p>
<p>The canvas axes are:</p>
<ul>
<li><strong>X</strong> is the cycle within the scanline.</li>
<li><strong>Y</strong> is the scanline.</li>
</ul>
<p>Activity is color-coded:</p>
<table>
<thead>
<tr>
<th>Color</th>
<th>Operation</th>
</tr>
</thead>
<tbody>
<tr>
<td>Grey ramp</td>
<td>Execute (shade reflects stack depth, so call depth is visible)</td>
</tr>
<tr>
<td>Blue</td>
<td>Memory write</td>
</tr>
<tr>
<td>Cyan</td>
<td>VRAM write</td>
</tr>
<tr>
<td>Light blue</td>
<td>I/O write</td>
</tr>
<tr>
<td>Green</td>
<td>I/O read</td>
</tr>
<tr>
<td>Green fill</td>
<td>Wait</td>
</tr>
<tr>
<td>Pink</td>
<td>Interrupt</td>
</tr>
</tbody>
</table>
<p>Illegal operations and DMA reads are drawn in grey. Gaps in the trace
are filled with the previous color, so the display does not show false
black bands.</p>
<p>The view shows a complete frame, and might be incomplete during debugging.</p>
`;var or=`<h1>Probe Log</h1>
<p>The Probe Log is a chronological text view of CPU and memory activity
for a frame. It is available on platforms that implement <code>startProbing</code>.</p>
<p>Each line describes one clock tick:</p>
<pre><code>(row, col)  &lt;disassembled instruction&gt;  &lt;operations...&gt;
</code></pre>
<ul>
<li>The first pair is the scanline and cycle within the scanline.</li>
<li>The instruction column shows the disassembly of the code executing at
that clock.</li>
<li>The remaining columns list what the instruction did \u2014 reads, writes,
I/O and VRAM accesses, stack pushes and pops, and interrupts \u2014 with
addresses and, where relevant, values.</li>
</ul>
<p>Write operations are colored differently from reads so they stand out.</p>
<p>The view shows a complete frame, and might be incomplete during debugging.</p>
`;var rr=`<h1>Scanline I/O</h1>
<p>The Scanline I/O window shows the I/O and VRAM accesses made during each
scanline. It is available on platforms that implement <code>startProbing</code>.</p>
<p>Each row is one scanline:</p>
<ul>
<li>A leading scanline number.</li>
<li>One character column per CPU cycle. An access at that cycle is shown
as its device address in hex; cycles with no access are shown as <code>.</code>.</li>
<li>The horizontal-blank boundary is marked with <code>|</code>.</li>
<li>The symbol of the routine executing on that scanline is appended at the
end, when known.</li>
</ul>
<p>This makes it easy to see where per-scanline register writes (raster
effects) occur relative to the start of the visible line.</p>
<p>The view shows a complete frame, and might be incomplete during debugging.</p>
`;var dr=`<h1>Symbol Profiler</h1>
<p>The Symbol Profiler counts memory reads and writes per symbol over time.
It is available on platforms that implement <code>startProbing</code>.</p>
<p>Each row lists a symbol with two counters:</p>
<table>
<thead>
<tr>
<th>Column</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td>Symbol</td>
<td>The debug symbol covering that address</td>
</tr>
<tr>
<td>Reads</td>
<td>Number of memory reads at addresses belonging to the symbol</td>
</tr>
<tr>
<td>Writes</td>
<td>Number of memory writes</td>
</tr>
</tbody>
</table>
<p>Rows are color-coded:</p>
<ul>
<li><strong>Code</strong> (green) \u2014 the symbol\u2019s address was executed.</li>
<li><strong>I/O</strong> (teal) \u2014 the symbol covers an I/O address.</li>
<li><strong>Data</strong> (blue) \u2014 the symbol was only read or written.</li>
</ul>
<p>Counts are cumulative and the probe buffer is cleared each refresh, so
the numbers keep growing while you run and are reset when data is
collected again. Symbols from the debug map are listed even before they
are touched.</p>
`;var ar=`<h1>Call Stack</h1>
<p>The Call Stack window reconstructs the program\u2019s call graph from runtime
stack activity. It is available on platforms that implement
<code>startProbing</code>.</p>
<p>Each node represents a routine, and its children are the routines it
called. A node shows how many times it was called and (while expanded)
the scanline range where it ran. Because the tree is built from stack
pushes and pops plus the observed jump distances, it reflects what the
program actually did rather than what the source says.</p>
<p>Counts are cumulative: the tree keeps growing as the program runs. The
probe buffer is cleared on each refresh, and the graph resets when the
emulator is reset.</p>
<p>Expanding a node reveals its callees, so you can drill into a hot
routine and see where the time and calls are going.</p>
`;var sr=`<h1>Debug Tree</h1>
<p>The Debug Tree shows a hierarchical view of platform debug information.
It is available on platforms that implement <code>getDebugTree</code>.</p>
<p>The tree\u2019s shape is defined by the platform. Where the
<a href="callstack.md">Call Stack</a> reconstructs call flow from observed
execution, the Debug Tree exposes whatever structured state the machine
implements \u2014 device registers, internal tables, subsystem state \u2014 as an
expandable tree.</p>
<h2>How values are shown</h2>
<ul>
<li>Numbers are shown in decimal with their hex value.</li>
<li>Booleans and strings are shown as-is.</li>
<li>Byte arrays are shown as a short hex dump.</li>
<li>Objects and functions expand to their properties. Functions marked as
lazy are only called when the node is expanded.</li>
<li>Large arrays are split into <code>$offset</code> chunks on demand.</li>
<li>Maps are shown as their key/value pairs.</li>
</ul>
<p>Nodes collapse and expand on click. The tree refreshes with the emulator
while debugging.</p>
`;var ir=`<h1>Breakpoints</h1>
<p>The Breakpoints window lists every breakpoint in the project and lets you
add, edit, enable, or delete them. It is available on platforms that
implement <code>runEval</code> or <code>runToPC</code>.</p>
<h2>Kinds of breakpoints</h2>
<table>
<thead>
<tr>
<th>Kind</th>
<th>Created by</th>
<th>Identified by</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Source</strong></td>
<td>Clicking the editor gutter, or <strong>Run To Line</strong></td>
<td>file and line number</td>
</tr>
<tr>
<td><strong>Address</strong></td>
<td>Using the Breakpoints window</td>
<td>a symbol, <code>$hex</code>, or decimal address</td>
</tr>
</tbody>
</table>
<p>Source breakpoints are shown as red circles in the editor\u2019s gutter.</p>
<p>Address breakpoints are resolved against the debug symbol map, so a symbol from
a linker map works as well as a raw address.</p>
<p>A breakpoint that cannot be
resolved (for example a symbol that does not exist)
is shown with an error.</p>
<h2>Conditions</h2>
<p>A breakpoint can carry a condition expression. The breakpoint only
stops when the expression evaluates to a non-zero value.</p>
<p>Supported values:</p>
<table>
<thead>
<tr>
<th>Value</th>
<th>Example</th>
</tr>
</thead>
<tbody>
<tr>
<td>Decimal number</td>
<td><code>32</code></td>
</tr>
<tr>
<td>Hex number</td>
<td><code>$1a2f</code>, <code>0x1a2f</code></td>
</tr>
<tr>
<td>CPU register</td>
<td><code>PC</code>, <code>A</code>, <code>X</code>, <code>Y</code>, <code>SP</code>, \u2026</td>
</tr>
<tr>
<td>Debug symbol</td>
<td><code>mainloop</code></td>
</tr>
<tr>
<td>Memory byte</td>
<td><code>[$0200]</code> or <code>#mem[$0200]</code></td>
</tr>
<tr>
<td>Memory word</td>
<td><code>#mem16[$0200]</code> (little-endian)</td>
</tr>
<tr>
<td>Video RAM byte</td>
<td><code>#vram[$2000]</code></td>
</tr>
<tr>
<td>Video RAM word</td>
<td><code>#vram16[$2000]</code></td>
</tr>
<tr>
<td>Current scanline</td>
<td><code>#scanline</code></td>
</tr>
<tr>
<td>Current line clock</td>
<td><code>#lineclock</code></td>
</tr>
</tbody>
</table>
<p>Supported operators, in C-like precedence: <code>!</code> <code>~</code> <code>-</code> <code>+</code> (unary),
<code>*</code> <code>/</code> <code>%</code>, <code>+</code> <code>-</code>, <code>&lt;&lt;</code> <code>&gt;&gt;</code>, <code>&lt;</code> <code>&lt;=</code> <code>&gt;</code> <code>&gt;=</code>, <code>==</code> <code>!=</code>, <code>&amp;</code>,
<code>^</code>, <code>|</code>, <code>&amp;&amp;</code>, <code>||</code>, and parentheses. The whole expression is true
when it evaluates to a non-zero value.</p>
<p>For example, <code>A == $20 &amp;&amp; X &lt; 4</code> stops only when the accumulator holds
<code>$20</code> and the X register is less than 4. A raster condition such as
<code>#scanline == 222</code> stops only once the beam has reached scanline 222.</p>
<h2>Managing breakpoints</h2>
<ul>
<li><strong>Add</strong> \u2014 type an address or symbol and an optional condition, then
click <strong>Add</strong>. Adding the same address again updates that breakpoint
instead of creating a duplicate.</li>
<li><strong>Enable/disable</strong> \u2014 toggle the checkbox on the left. Disabled
breakpoints are dimmed.</li>
<li><strong>Edit</strong> \u2014 click the pencil to load a breakpoint into the form;
<strong>Save</strong> applies the change.</li>
<li><strong>Delete</strong> \u2014 click the trash icon.</li>
<li><strong>Go to Source</strong> \u2014 click a breakpoint\u2019s location to open the source file, or
the disassembly, at the breakpoint\u2019s address.</li>
</ul>
<p>Breakpoints are persisted in browser local storage, scoped to the
current platform and project file, so they survive a reload.</p>
`;var cr=`<h1>Asset Editor</h1>
<p>The Asset Editor finds <a href="asset-headers.md">asset headers</a> in your source \u2014 small JSON
descriptors inside comments \u2014 and turns the data block that follows into
an editable bitmap, tilemap, or palette. Edits are written straight back
into the source text, preserving the original number base and formatting
of each literal.</p>
<h2>Asset List</h2>
<p>Open the <strong>Asset Editor</strong> from the sidebar to see every editable asset in
your project in one scrolling list. Assets are grouped by file \u2014 a heading
with the filename, then each asset underneath, in the order it appears in
the source.</p>
<p>Each asset shows a <strong>line number</strong> you can click to jump to that spot in
the code (and highlight it), the <a href="asset-headers.md">Asset Header</a> as
written in the file, and the <strong>editor</strong> itself \u2014 a picture, a palette, or
a tilemap. If something is wrong with an asset, a red error message
appears in place of its editor.</p>
<p>Click an asset to start editing; the editor scrolls into view, and your
selection is saved in the address bar so you can bookmark or share it.
You don\u2019t need to understand the header format to edit graphics, but if
you want to add or change one, <a href="asset-headers.md">Asset Headers</a> explains
it.</p>
<h3>Editing images</h3>
<p>Assets with a width and height show a <strong>grid of thumbnails</strong> \u2014 one per
image. Click the one you want, and a large editor opens beside it.</p>
<p>To paint, just click and drag on the image. Pick a color from the row of
swatches below it (each labelled with its palette index). Starting a drag
on a pixel that\u2019s already the color you picked will erase instead of
paint.</p>
<p>The toolbar above the image has quick transforms: <strong>flip</strong> it
horizontally or vertically, <strong>rotate</strong> it, <strong>nudge</strong> it in any direction,
and <strong>copy/paste</strong> it. Copy and paste work between any two images in the
session, and they keep the palette indices intact, so a tile copied from
one asset still looks right in another even if the colors differ.</p>
<h3>Editing palettes</h3>
<p>Palettes are edited one color at a time. The palette appears as a small
table; click any cell to open a color picker. Small, indexed palettes show
a grid of swatches to choose from \u2014 hover over one to see its value and
hex color. Larger, direct-color palettes get color sliders instead. As you
change a color, the source code is updated right away.</p>
<p>If more than one palette in your project matches the image\u2019s color count,
a dropdown appears under the thumbnails.
Select a palette to preview it with your image.</p>
<h3>Viewing tilemaps</h3>
<p>NES nametable assets (<code>map:&quot;nesnt&quot;</code>) show the whole tilemap composited
from your project\u2019s graphics and palette, as a single preview.</p>
<h3>Undo and redo</h3>
<p>Use <code>Ctrl/Cmd+Z</code> to undo and <code>Ctrl/Cmd+Shift+Z</code> to redo your edits. The
history starts fresh each time you open the Asset Editor, so undo only
affects the changes you\u2019ve made in this session.</p>
`;var lr=`<h1>Managing Files</h1>
<h2>Importing and exporting files</h2>
<p>To save your files outside of the browser:</p>
<ol>
<li>Select <strong>Download</strong> from the menu.</li>
<li>Choose an option:
<ul>
<li><strong>Download Source File</strong> \u2014 download the active source file.</li>
<li><strong>Download ROM Image</strong> \u2014 download the compiled ROM, which can be
used in a standalone emulator.</li>
<li><strong>Download Project as ZIP</strong> \u2014 download the active project as a zip.</li>
<li><strong>Download All Changes as ZIP</strong> \u2014 download all files in the active
platform.</li>
<li><strong>Download Debug Symbols</strong> \u2014 download the debug symbol file
produced by the build for use in an external debugger. This option
is only available with certain toolchains like NES.</li>
</ul>
</li>
<li>Choose a location and save the file.</li>
</ol>
<p>To import source files back into the browser, select <strong>Upload</strong> from the
menu, choose the file, and click <strong>Open</strong>.</p>
<h2>Renaming, deleting, and adding files</h2>
<p>The <strong>File</strong> submenu acts on the file in the active editor window:</p>
<ul>
<li><strong>Revert to Original\u2026</strong> \u2014 restore the active example to its original
state, discarding your edits.</li>
<li><strong>Rename File\u2026</strong> \u2014 rename the active source file. If it is the main
file, the project reloads under the new name.</li>
<li><strong>Delete File\u2026</strong> \u2014 remove the active file from the project after
confirming.</li>
<li><strong>Add Include File\u2026</strong> \u2014 create a new file and add it to the main file
with the include directive appropriate for the platform\u2019s toolchain
(<code>#include</code> for C, <code>.include</code> for assembly, and so on).</li>
<li><strong>Add Linked File\u2026</strong> \u2014 create a new file and link it into the build
with a <code>//#link</code> or <code>;#link</code> directive.</li>
</ul>
<p>See <a href="build-directives.md">Build Directives</a> for how include and linked
files are referenced.</p>
<h2>Managing browser storage</h2>
<p>Browsers may occasionally delete local files.
Select <strong>File \xBB Request Local Storage Permissions</strong> to ask the
browser to keep your files permanently.</p>
<h2>Sharing projects</h2>
<p>You can share playable links and videos (seven-second animated GIFs) with
others. Playable links contain the project code inside the URL, so you
can share your work without storing it remotely. Some browsers may not
support the resulting URL length.</p>
<h3>Sharing a playable link</h3>
<ol>
<li>From the menu, select <strong>Share</strong>.</li>
<li>Select <strong>Share Playable Link\u2026</strong>.</li>
<li>Select <strong>Copy Direct Link</strong> to copy the link, or <strong>Copy IFRAME Tag</strong>
to copy an embeddable IFRAME snippet.</li>
<li>Click <strong>Close</strong>.</li>
</ol>
<h3>Recording a video</h3>
<ol>
<li>From the menu, select <strong>Share</strong>.</li>
<li>Select <strong>Record Video\u2026</strong>. The emulator background turns red while
recording.</li>
<li>When the preview appears, right-click it and choose <strong>Save Image
As\u2026</strong> to save the animated GIF.</li>
<li>Click <strong>Close</strong>.</li>
</ol>
<h3>Making a cassette audio file</h3>
<p>For platforms with cassette support, select <strong>Share \xBB Make Cassette
Audio\u2026</strong> to export the compiled program as an audio (WAV) file that can
be loaded from a real or emulated cassette drive. This option is hidden
on platforms that don\u2019t support it.</p>
<h2>Syncing with GitHub</h2>
<p>You can import projects from GitHub repositories, publish your projects,
and push/pull to repositories you have access to. When you publish or
push, the IDE uploads your code and a compiled ROM file.</p>
<h3>Connecting your account</h3>
<ol>
<li>From the menu, select <strong>Sync \xBB Sign in to GitHub\u2026</strong>.</li>
<li>Enter your GitHub username and password.</li>
</ol>
<p>To sign out, select <strong>Sync \xBB Log out</strong>.</p>
<h3>Importing a project</h3>
<ol>
<li>From the menu, select <strong>Sync</strong>, then <strong>Import Project from
GitHub\u2026</strong>.</li>
<li>Enter the repository URL (for example
<code>https://github.com/username/reponame</code>) and click <strong>Import Project</strong>.</li>
</ol>
<p>To leave the project, select <strong>Leave Repository</strong> from the Project
Selector drop-down. Imported repositories appear under <strong>Repositories</strong>
in the same drop-down.</p>
<h3>Deleting a local repository</h3>
<ol>
<li>Select the repository from the Project Selector drop-down.</li>
<li>Select <strong>Sync \xBB Delete Local Repository</strong>.</li>
<li>Type <strong>YES</strong> to confirm, then select <strong>OK</strong>.</li>
</ol>
<h3>Publishing a project</h3>
<ol>
<li>From the menu, select <strong>Sync \xBB Publish Project on GitHub\u2026</strong>.</li>
<li>Enter a project name and description.</li>
<li>Choose <strong>Public</strong> or <strong>Private</strong> visibility.</li>
<li>Select a license.</li>
<li>Click <strong>Upload Project</strong>. If you aren\u2019t signed in you\u2019ll be prompted
to connect first.</li>
</ol>
<h3>Pushing and pulling changes</h3>
<ul>
<li><strong>Push:</strong> select <strong>Sync \xBB Push Changes to Repository\u2026</strong>, enter a
commit message, then <strong>Push Changes</strong>.</li>
<li><strong>Pull:</strong> select <strong>Sync \xBB Pull Latest from Repository</strong>, then
<strong>OK</strong>. All local files are overwritten; there is no merge in the
browser.</li>
</ul>
`;var hr=`<h1>Build Directives</h1>
<p>A project can contain multiple files. The build system decides how each
file is used based on directives in your source, and each file\u2019s
extension selects the tool that compiles or assembles it.</p>
<h2>Projects with multiple files</h2>
<p>All files in a project must be referenced from the main project file with
one of these reference types:</p>
<ul>
<li><strong>Include file</strong> \u2014 a source file embedded in another using an
<code>#include</code> or similar directive.</li>
<li><strong>Linked file</strong> \u2014 a source file compiled/assembled and linked into the
project alongside the main file, using the <code>//#link</code> or <code>;#link</code>
directive. A binary file can be included in an assembly project with the
<code>incbin</code> directive.</li>
<li><strong>Resource file</strong> \u2014 a file that must be included in the project but is
neither included nor linked from the main file (for example it is
included from a non-main file). Use the <code>//#resource</code> or <code>;#resource</code>
directive.</li>
</ul>
<p>Here\u2019s a C example:</p>
<pre><code class="language-c">//#link &quot;lzg.c&quot;
#include &quot;lzg.h&quot;
</code></pre>
<p>If a file cannot be found, check the syntax. Often double quotes are
required, e.g. <code>#include &quot;file.inc&quot;</code>.</p>
<p>Only system files that are part of the compiler toolchain can be found
with the <code>&lt;foo.h&gt;</code> syntax.</p>
<p>Assembler files can include files using the <code>.include</code> or <code>.incbin</code>
directives:</p>
<pre><code>.segment &quot;CHARS&quot;
.incbin &quot;tileset.chr&quot;
</code></pre>
<h2>C preprocessor defines</h2>
<p>The preprocessor macro <code>__MAIN__</code> is defined when compiling the main C
file of a project. You can use this to run tests on your module files:</p>
<pre><code class="language-c">//#link &quot;file_needed_for_test.c&quot;
#ifdef __MAIN__
#include &quot;file_needed_for_test.h&quot;
void main() {
    test_my_module();
}
#endif
</code></pre>
<p>The macro <code>__8BITWORKSHOP__</code> is defined on all C files.</p>
<h2>Build directives</h2>
<p>Build directives are comment lines that tell the build system how to
compile, assemble, or link a project. They can appear in any source file
and are never seen by the toolchain:</p>
<ul>
<li>C, SDCC, and cmoc sources mark them with <code>//</code>.</li>
<li>Assembly sources mark them with <code>;</code>.</li>
</ul>
<p>The keyword follows the comment marker and a <code>#</code>, and the line must
begin with the comment (leading whitespace is allowed).</p>
<h3><code>//#symbol</code> \u2014 define a symbol</h3>
<p>Defines a preprocessor macro, an assembler symbol, or a linker symbol:</p>
<pre><code class="language-c">//#symbol [&lt;phase&gt;] NAME[=VALUE]
</code></pre>
<p>The optional <em>phase</em> is one of:</p>
<table>
<thead>
<tr>
<th>Phase</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>c</code>, <code>cc</code>, <code>compiler</code></td>
<td>C preprocessor define (default)</td>
</tr>
<tr>
<td><code>as</code>, <code>asm</code>, <code>assembler</code></td>
<td>assembler symbol</td>
</tr>
<tr>
<td><code>ld</code>, <code>link</code>, <code>linker</code></td>
<td>linker symbol</td>
</tr>
</tbody>
</table>
<p>A compiler define takes a text value (<code>cc65 -D</code>, <code>sdcc -D</code>). Assembler
and linker symbols take an integer expression:</p>
<pre><code class="language-c">//#symbol VERSION=3
//#symbol as START=$8000
//#symbol ld NES_MAPPER=4
</code></pre>
<p>A linker symbol defined by a source file replaces (rather than
duplicates) a symbol of the same name that the platform already defines,
so <code>//#symbol ld NES_MAPPER=...</code> can select a different mapper without
editing the platform defaults. Linker values must be integer
expressions; a text value is reported as a build error rather than
passed to the linker.</p>
<h3><code>//#flag</code> \u2014 pass a raw argument</h3>
<p>Passes arguments straight to one tool phase, with no interpretation:</p>
<pre><code class="language-c">//#flag &lt;phase&gt; &lt;arg&gt; [&lt;arg&gt; ...]
</code></pre>
<pre><code class="language-c">//#flag c -Osir
//#flag as --cpu 65c02
//#flag ld -m map.txt
</code></pre>
<p>Arguments may be quoted with single or double quotes when they contain
spaces. This is an escape hatch that the build system cannot validate.</p>
<h3><code>//#tooldef</code> \u2014 set a typed build parameter</h3>
<p>Sets a named build parameter that the build system understands:</p>
<pre><code class="language-c">//#tooldef &lt;phase&gt; NAME=VALUE
</code></pre>
<p>For the linker phase, the supported parameters are:</p>
<table>
<thead>
<tr>
<th>Name</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>cfgfile</code></td>
<td>linker configuration file to use (e.g. for CC65\u2019s ld65)</td>
</tr>
<tr>
<td><code>libargs</code></td>
<td>comma-separated list of library/symbol arguments</td>
</tr>
</tbody>
</table>
<pre><code class="language-c">//#tooldef ld cfgfile=apple2-hgr2.cfg
//#tooldef ld libargs=,nes.lib
</code></pre>
<h3>Commenting out a directive</h3>
<p>To disable a directive, break the marker; for example, use <code>////#</code> in C
or <code>;;#</code> in assembly. A directive that is already commented out is
deliberately <em>not</em> recognized.</p>
<h3>Legacy <code>#define</code> directives</h3>
<p>For backwards compatibility the build system still understands the older
<code>#define</code>-based forms:</p>
<table>
<thead>
<tr>
<th>Legacy form</th>
<th>Same as</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>#define CFGFILE &lt;file&gt;</code></td>
<td><code>//#tooldef ld cfgfile=&lt;file&gt;</code></td>
</tr>
<tr>
<td><code>#define LIBARGS &lt;a,b,...&gt;</code></td>
<td><code>//#tooldef ld libargs=&lt;a,b,...&gt;</code></td>
</tr>
<tr>
<td><code>#define NES_MAPPER &lt;n&gt;</code></td>
<td><code>//#symbol ld NES_MAPPER=&lt;n&gt;</code></td>
</tr>
<tr>
<td><code>#define CC65_FLAGS &lt;a,b,...&gt;</code></td>
<td><code>//#flag c &lt;a&gt; &lt;b&gt; ...</code></td>
</tr>
</tbody>
</table>
<p>These may be prefixed with <code>;</code> or <code>/</code> as well (for example <code>;#define</code>),
so they can appear in assembly sources. New code should prefer the
explicit <code>//#</code> directives above.</p>
<h2>CC65 custom config files</h2>
<p>CC65\u2019s linker is controlled with
<a href="https://www.cc65.org/doc/ld65-5.html">configuration files</a> that define
memory areas and the layout of the final binary or ROM.</p>
<p>Tell the linker to use a custom config file from your main C program:</p>
<pre><code class="language-c">//#tooldef ld cfgfile=apple2-hgr2.cfg
//#resource &quot;apple2-hgr2.cfg&quot;
</code></pre>
<p>The legacy form is also supported:</p>
<pre><code class="language-c">#define CFGFILE apple2-hgr2.cfg
//#resource &quot;apple2-hgr2.cfg&quot;
</code></pre>
<p>Note the lack of quotes around the file name.</p>
<h2>CC65 <code>#embed</code> directive</h2>
<p>You can include binary files directly in
CC65 <code>.c</code> files, a feature not available from the CC65 command line. For
example, given an uploaded file <code>image-c64.multi.lz4</code>:</p>
<pre><code class="language-c">const char image_c64_multi_lz4[] = {
#embed &quot;image-c64.multi.lz4&quot;
};
</code></pre>
<p>This creates a byte array named <code>image_c64_multi_lz4</code> with the contents
of the binary file.</p>
<p>The <code>#embed</code> directive is also supported in Oscar64 and Wiz files.</p>
<h2>SDCC <code>#pragma</code></h2>
<p>With SDCC, enable additional optimization by adding one of these lines to
the top of the file:</p>
<pre><code class="language-c">#pragma opt_code_size  // for smaller code
#pragma opt_code_speed // for faster code
</code></pre>
<p>Either pragma slows builds but produces faster and smaller code.</p>
<h3>Game Boy ROM banks</h3>
<p>On the Game Boy, <code>#pragma bank N</code> at the top of a file puts its code and
constant data in ROM bank <em>N</em>, which the CPU sees at <code>$4000-$7FFF</code>. Link
the file from your main file, and call its functions through <code>__banked</code>
prototypes. Each call switches to the function\u2019s bank and back again:</p>
<pre><code class="language-c">// bank1.c
#pragma bank 1
void say_hello(char* buf) __banked { ... }

// main.c
//#link &quot;bank1.c&quot;
//#symbol ld GB_MAPPER=0x19
void say_hello(char* buf) __banked;
</code></pre>
<p>The ROM grows to fit the highest bank, and the build writes the ROM size
into the header. If <code>GB_MAPPER</code> is still 0 (ROM only), the build selects
MBC5. A bank holds 16 KB; overflowing it is a build error. Banked data
can only be read while its bank is mapped, so copy it out from a
<code>__banked</code> function. See the <em>ROM Bank Switching</em> preset.</p>
<h2>File extensions</h2>
<p>The extension of your source file determines the tool used to assemble
or compile it. The current platform resolves extensions that several
tools share (<code>.c</code>, <code>.s</code>, <code>.bas</code>), so the mapping depends on both. Common
cases:</p>
<table>
<thead>
<tr>
<th>Extension</th>
<th>File type</th>
<th>Tool (platform)</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>.c</code></td>
<td>C source file</td>
<td>cc65 (6502), sdcc (Z80), cmoc (6809)</td>
</tr>
<tr>
<td><code>.cpp</code></td>
<td>C source file</td>
<td>Oscar64 (6502)</td>
</tr>
<tr>
<td><code>.s</code> <code>.ca65</code></td>
<td>Assembler file</td>
<td>ca65 (6502)</td>
</tr>
<tr>
<td><code>.s</code></td>
<td>Assembler file</td>
<td>sdasz80 (Z80)</td>
</tr>
<tr>
<td><code>.sgb</code></td>
<td>Assembler file</td>
<td>sdasgb (Game Boy)</td>
</tr>
<tr>
<td><code>.dasm</code> <code>.a</code></td>
<td>Assembler file</td>
<td>dasm (6502)</td>
</tr>
<tr>
<td><code>.z</code></td>
<td>Assembler file</td>
<td>zmac (Z80)</td>
</tr>
<tr>
<td><code>.bas</code></td>
<td>BASIC file</td>
<td>BASIC, batariBASIC (vcs), FastBASIC (atari8)</td>
</tr>
<tr>
<td><code>.bb</code></td>
<td>batariBASIC file</td>
<td>batariBASIC (vcs)</td>
</tr>
<tr>
<td><code>.v</code></td>
<td>Verilog file</td>
<td>Verilator</td>
</tr>
</tbody>
</table>
<p>See <a href="toolchains.md">Toolchains &amp; Platforms</a> for the full
platform \xD7 extension \u2192 tool table.</p>
`;var pr=`<!-- generated by \`npm run doctools\`; do not edit by hand -->
<h1>Toolchains &amp; Platforms</h1>
<p>A source file\u2019s <strong>extension</strong> picks a tool, and the <strong>platform</strong>
disambiguates extensions several tools share (<code>.c</code>, <code>.s</code>, <code>.bas</code>).</p>
<h2>Tools</h2>
<table>
<thead>
<tr>
<th>ID</th>
<th>Name</th>
<th>Kind</th>
<th>Arch</th>
<th>Version</th>
<th>Extensions</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>acme</code></td>
<td><a href="https://raw.githubusercontent.com/sehugg/acme/main/docs/QuickRef.txt">ACME</a></td>
<td>assembler</td>
<td>6502</td>
<td>0.97.1</td>
<td><code>.acme</code></td>
</tr>
<tr>
<td><code>armips</code></td>
<td>armips</td>
<td>assembler</td>
<td>arm32</td>
<td>0.11.0</td>
<td><code>.armips</code></td>
</tr>
<tr>
<td><code>armtcc</code></td>
<td>TCC (ARM)</td>
<td>compiler</td>
<td>arm32</td>
<td>\u2014</td>
<td><code>.c</code> <code>.s</code></td>
</tr>
<tr>
<td><code>armtcclink</code></td>
<td>TCC (ARM) link</td>
<td>linker</td>
<td>arm32</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>basic</code></td>
<td>BASIC</td>
<td>interpreter</td>
<td>\u2014</td>
<td>\u2014</td>
<td><code>.bas</code></td>
</tr>
<tr>
<td><code>bataribasic</code></td>
<td><a href="help/bataribasic/manual.html">batari Basic</a></td>
<td>compiler</td>
<td>6502</td>
<td>\u2014</td>
<td><code>.bb</code> <code>.bas</code></td>
</tr>
<tr>
<td><code>ca65</code></td>
<td><a href="https://cc65.github.io/doc/ca65.html">ca65</a></td>
<td>assembler</td>
<td>6502</td>
<td>2.19</td>
<td><code>.s</code> <code>.ca65</code> <code>.inc</code></td>
</tr>
<tr>
<td><code>cc2600</code></td>
<td><a href="https://github.com/steux/cc2600">CC2600</a></td>
<td>compiler</td>
<td>6502</td>
<td>0.4.5</td>
<td><code>.cc2600</code></td>
</tr>
<tr>
<td><code>cc65</code></td>
<td><a href="https://cc65.github.io/doc/cc65.html">cc65</a></td>
<td>compiler</td>
<td>6502</td>
<td>2.19</td>
<td><code>.c</code> <code>.h</code></td>
</tr>
<tr>
<td><code>cc7800</code></td>
<td><a href="https://github.com/steux/cc7800">CC7800</a></td>
<td>compiler</td>
<td>6502</td>
<td>0.2.28</td>
<td><code>.cc7800</code> <code>.c78</code></td>
</tr>
<tr>
<td><code>cmoc</code></td>
<td><a href="https://github.com/stahta01/cmoc/">CMOC</a></td>
<td>compiler</td>
<td>6809</td>
<td>0.1.67</td>
<td><code>.c</code> <code>.h</code></td>
</tr>
<tr>
<td><code>dasm</code></td>
<td><a href="https://raw.githubusercontent.com/dasm-assembler/dasm/refs/tags/v2.20.17/docs/dasm.txt">DASM</a></td>
<td>assembler</td>
<td>6502</td>
<td>2.20.17</td>
<td><code>.dasm</code></td>
</tr>
<tr>
<td><code>dialog</code></td>
<td><a href="https://linusakesson.net/dialog/docs/">Dialog</a></td>
<td>compiler</td>
<td>zmachine</td>
<td>1c/03-dev</td>
<td><code>.dg</code></td>
</tr>
<tr>
<td><code>ecs</code></td>
<td>ECS</td>
<td>assembler</td>
<td>6502</td>
<td>\u2014</td>
<td><code>.ecs</code></td>
</tr>
<tr>
<td><code>fastbasic</code></td>
<td><a href="https://github.com/dmsc/fastbasic/blob/v4.4/manual.md">FastBasic</a></td>
<td>compiler</td>
<td>6502</td>
<td>4.4</td>
<td><code>.bas</code> <code>.fb</code> <code>.fbi</code></td>
</tr>
<tr>
<td><code>inform6</code></td>
<td>Inform 6</td>
<td>compiler</td>
<td>zmachine</td>
<td>6.34</td>
<td><code>.inf</code></td>
</tr>
<tr>
<td><code>jsasm</code></td>
<td>JSASM</td>
<td>assembler</td>
<td>\u2014</td>
<td>\u2014</td>
<td><code>.asm</code></td>
</tr>
<tr>
<td><code>ld65</code></td>
<td>ld65</td>
<td>linker</td>
<td>6502</td>
<td>2.19</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>llvm-mos</code></td>
<td><a href="https://llvm-mos.org/wiki/Welcome">LLVM-MOS</a></td>
<td>compiler</td>
<td>6502</td>
<td>\u2014</td>
<td><code>.c</code> <code>.cpp</code> <code>.s</code> <code>.S</code> <code>.C</code></td>
</tr>
<tr>
<td><code>lwasm</code></td>
<td>LWASM</td>
<td>assembler</td>
<td>6809</td>
<td>4.17</td>
<td><code>.lwasm</code></td>
</tr>
<tr>
<td><code>lwlink</code></td>
<td>LWLINK</td>
<td>linker</td>
<td>6809</td>
<td>4.17</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>merlin32</code></td>
<td><a href="https://github.com/apple2accumulator/merlin32">Merlin 32</a></td>
<td>assembler</td>
<td>6502</td>
<td>1.1.10</td>
<td><code>.lnk</code></td>
</tr>
<tr>
<td><code>naken</code></td>
<td><a href="https://github.com/mikeakohn/naken_asm">Naken</a></td>
<td>assembler</td>
<td>\u2014</td>
<td>\u2014</td>
<td><code>.ns</code></td>
</tr>
<tr>
<td><code>nesasm</code></td>
<td><a href="https://github.com/camsaul/nesasm">NESASM</a></td>
<td>assembler</td>
<td>6502</td>
<td>3.1</td>
<td><code>.nesasm</code></td>
</tr>
<tr>
<td><code>oscar64</code></td>
<td><a href="https://github.com/drmortalwombat/oscar64/blob/v1.32.266/oscar64.md">Oscar64</a></td>
<td>compiler</td>
<td>6502</td>
<td>1.32.266</td>
<td><code>.c</code> <code>.cpp</code> <code>.cc</code> <code>.o64</code></td>
</tr>
<tr>
<td><code>remote</code></td>
<td>Remote build</td>
<td>remote</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>sccz80</code></td>
<td>sccz80</td>
<td>compiler</td>
<td>z80</td>
<td>\u2014</td>
<td><code>.scc</code></td>
</tr>
<tr>
<td><code>sdasgb</code></td>
<td>sdasgb</td>
<td>assembler</td>
<td>gbz80</td>
<td>\u2014</td>
<td><code>.sgb</code></td>
</tr>
<tr>
<td><code>sdasz80</code></td>
<td>sdasz80</td>
<td>assembler</td>
<td>z80</td>
<td>02.00</td>
<td><code>.s</code></td>
</tr>
<tr>
<td><code>sdcc</code></td>
<td><a href="http://sdcc.sourceforge.net/doc/sdccman.pdf">SDCC</a></td>
<td>compiler</td>
<td>z80</td>
<td>3.6.5</td>
<td><code>.c</code> <code>.h</code></td>
</tr>
<tr>
<td><code>sdldz80</code></td>
<td>sdldz80</td>
<td>linker</td>
<td>z80</td>
<td>03.00</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>silice</code></td>
<td><a href="https://github.com/sylefeb/Silice">Silice</a></td>
<td>hdl</td>
<td>verilog</td>
<td>0.1</td>
<td><code>.ice</code></td>
</tr>
<tr>
<td><code>smlrc</code></td>
<td><a href="https://github.com/alexfru/SmallerC/blob/master/v0100/doc/smlrc.md">SmallerC</a></td>
<td>compiler</td>
<td>x86</td>
<td>\u2014</td>
<td><code>.c</code></td>
</tr>
<tr>
<td><code>vasmarm</code></td>
<td>vasm (ARM)</td>
<td>assembler</td>
<td>arm32</td>
<td>1.8k</td>
<td><code>.vasm</code></td>
</tr>
<tr>
<td><code>verilator</code></td>
<td><a href="https://verilator.org/guide/4.205/">Verilator</a></td>
<td>hdl</td>
<td>verilog</td>
<td>4.205</td>
<td><code>.v</code></td>
</tr>
<tr>
<td><code>wiz</code></td>
<td><a href="https://github.com/wiz-lang/wiz/blob/master/readme.md#wiz">wiz</a></td>
<td>compiler</td>
<td>\u2014</td>
<td>0.1.2</td>
<td><code>.wiz</code></td>
</tr>
<tr>
<td><code>xa</code></td>
<td><a href="https://www.floodgap.com/retrotech/xa/">XA</a></td>
<td>assembler</td>
<td>6502</td>
<td>2.4.1</td>
<td><code>.xa</code></td>
</tr>
<tr>
<td><code>xasm6809</code></td>
<td>XASM6809</td>
<td>assembler</td>
<td>6809</td>
<td>\u2014</td>
<td><code>.xasm</code></td>
</tr>
<tr>
<td><code>yasm</code></td>
<td><a href="https://www.tortall.net/projects/yasm/manual/html/manual.html">YASM</a></td>
<td>assembler</td>
<td>x86</td>
<td>1.3.0</td>
<td><code>.asm</code></td>
</tr>
<tr>
<td><code>yosys</code></td>
<td>Yosys</td>
<td>hdl</td>
<td>verilog</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>zmac</code></td>
<td><a href="https://raw.githubusercontent.com/sehugg/zmac/master/doc.txt">zmac</a></td>
<td>assembler</td>
<td>z80</td>
<td>28jul2018</td>
<td><code>.z</code></td>
</tr>
</tbody>
</table>
<h2>Platforms</h2>
<p>Grouped by CPU family. The <strong>Default</strong> line lists the arch\u2019s
extension\u2192tool mapping; the table only shows what each platform
changes. <code>Memory</code> is the layout from <code>PLATFORM_PARAMS</code> (start+size).</p>
<h3>6502</h3>
<p><strong>Default</strong> (<code>kim1</code>): <code>.a</code>\u2192dasm \xB7 <code>.acme</code>\u2192acme \xB7 <code>.bb</code>\u2192bataribasic \xB7 <code>.c</code>\u2192cc65 \xB7 <code>.ca65</code>\u2192ca65 \xB7 <code>.cc</code>\u2192oscar64 \xB7 <code>.cpp</code>\u2192oscar64 \xB7 <code>.dasm</code>\u2192dasm \xB7 <code>.ecs</code>\u2192ecs \xB7 <code>.h</code>\u2192cc65 \xB7 <code>.o64</code>\u2192oscar64 \xB7 <code>.s</code>\u2192ca65 \xB7 <code>.wiz</code>\u2192wiz \xB7 <code>.xa</code>\u2192xa</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>apple2</code></td>
<td>\u2014</td>
<td><code>.lnk</code>\u2192merlin32</td>
<td><code>apple2.cfg</code></td>
<td><strong>APPLE2</strong></td>
</tr>
<tr>
<td><code>apple2-e</code></td>
<td><code>apple2</code></td>
<td><code>.lnk</code>\u2192merlin32</td>
<td><code>apple2.cfg</code></td>
<td><strong>APPLE2</strong></td>
</tr>
<tr>
<td><code>atari7800</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td><code>atari7800.cfg</code></td>
<td><strong>ATARI7800</strong></td>
</tr>
<tr>
<td><code>atari8-5200</code></td>
<td><code>atari8</code></td>
<td><code>.bas</code>\u2192fastbasic \xB7 <code>.fb</code>\u2192fastbasic \xB7 <code>.fbi</code>\u2192fastbasic</td>
<td><code>atari5200.cfg</code></td>
<td><strong>ATARI5200</strong></td>
</tr>
<tr>
<td><code>atari8-800</code></td>
<td><code>atari8</code></td>
<td><code>.bas</code>\u2192fastbasic \xB7 <code>.fb</code>\u2192fastbasic \xB7 <code>.fbi</code>\u2192fastbasic</td>
<td><code>atari-cart.cfg</code></td>
<td><strong>ATARI</strong></td>
</tr>
<tr>
<td><code>atari8-800xl</code></td>
<td><code>atari8</code></td>
<td><code>.bas</code>\u2192fastbasic \xB7 <code>.fb</code>\u2192fastbasic \xB7 <code>.fbi</code>\u2192fastbasic</td>
<td><code>atari-cart.cfg</code></td>
<td><strong>ATARI</strong></td>
</tr>
<tr>
<td><code>atari8-800xl.disk</code></td>
<td><code>atari8</code></td>
<td><code>.bas</code>\u2192fastbasic \xB7 <code>.fb</code>\u2192fastbasic \xB7 <code>.fbi</code>\u2192fastbasic</td>
<td><code>atari.cfg</code></td>
<td><strong>ATARI</strong></td>
</tr>
<tr>
<td><code>c64</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td><code>c64.cfg</code></td>
<td><strong>CBM</strong> <strong>C64</strong></td>
</tr>
<tr>
<td><code>devel-6502</code></td>
<td><code>devel</code></td>
<td>\u2014</td>
<td><code>devel-6502.cfg</code></td>
<td>\u2014</td>
</tr>
<tr>
<td><code>kim1</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>nes</code></td>
<td>\u2014</td>
<td><code>.nesasm</code>\u2192nesasm</td>
<td><code>neslib2.cfg</code></td>
<td><strong>NES</strong></td>
</tr>
<tr>
<td><code>vcs</code></td>
<td>\u2014</td>
<td><code>.bas</code>\u2192bataribasic \xB7 <code>.cc2600</code>\u2192cc2600</td>
<td><code>atari2600.cfg</code></td>
<td><strong>ATARI2600</strong></td>
</tr>
<tr>
<td><code>vector-ataricolor</code></td>
<td><code>vector</code></td>
<td>\u2014</td>
<td><code>vector-color.cfg</code></td>
<td><strong>VECTOR</strong></td>
</tr>
<tr>
<td><code>vic20</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td><code>vic20.cfg</code></td>
<td><strong>CBM</strong> <strong>VIC20</strong></td>
</tr>
</tbody>
</table>
<h3>6502 (HuC6280)</h3>
<p><strong>Default</strong> (<code>pce</code>): <code>.a</code>\u2192dasm \xB7 <code>.acme</code>\u2192acme \xB7 <code>.bb</code>\u2192bataribasic \xB7 <code>.c</code>\u2192cc65 \xB7 <code>.ca65</code>\u2192ca65 \xB7 <code>.cc</code>\u2192oscar64 \xB7 <code>.cpp</code>\u2192oscar64 \xB7 <code>.dasm</code>\u2192dasm \xB7 <code>.ecs</code>\u2192ecs \xB7 <code>.h</code>\u2192cc65 \xB7 <code>.o64</code>\u2192oscar64 \xB7 <code>.s</code>\u2192ca65 \xB7 <code>.wiz</code>\u2192wiz \xB7 <code>.xa</code>\u2192xa</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>pce</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td><code>pce.cfg</code></td>
<td><strong>PCE</strong></td>
</tr>
</tbody>
</table>
<h3>Z80</h3>
<p><strong>Default</strong> (<code>mw8080bw</code>): <code>.c</code>\u2192sdcc \xB7 <code>.h</code>\u2192sdcc \xB7 <code>.ns</code>\u2192naken \xB7 <code>.s</code>\u2192sdasz80 \xB7 <code>.scc</code>\u2192sccz80 \xB7 <code>.sgb</code>\u2192sdasgb \xB7 <code>.wiz</code>\u2192wiz \xB7 <code>.z</code>\u2192zmac</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>astrocade</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>astrocade-arcade</code></td>
<td><code>astrocade</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>astrocade-bios</code></td>
<td><code>astrocade</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>coleco</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>cpc</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>cpc.rslib</code></td>
<td><code>cpc</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>galaxian</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>galaxian-scramble</code></td>
<td><code>galaxian</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>mcr</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>msx</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>msx-libcv</code></td>
<td><code>msx</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>mw8080bw</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>pacman</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>sms-gg-libcv</code></td>
<td><code>sms</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>sms-sg1000-libcv</code></td>
<td><code>sms</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>sms-sms-libcv</code></td>
<td><code>sms</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>sound_williams-z80</code></td>
<td><code>sound_williams</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>vector-z80color</code></td>
<td><code>vector</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>vicdual</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>williams-z80</code></td>
<td><code>williams</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>zx</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
</tbody>
</table>
<h3>Game Boy (SM83)</h3>
<p><strong>Default</strong> (<code>gb</code>): <code>.c</code>\u2192sdcc \xB7 <code>.h</code>\u2192sdcc \xB7 <code>.ns</code>\u2192naken \xB7 <code>.s</code>\u2192sdasz80 \xB7 <code>.scc</code>\u2192sccz80 \xB7 <code>.sgb</code>\u2192sdasgb \xB7 <code>.wiz</code>\u2192wiz \xB7 <code>.z</code>\u2192zmac</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>gb</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>gb.color</code></td>
<td><code>gb</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
</tbody>
</table>
<h3>6809</h3>
<p><strong>Default</strong> (<code>vectrex</code>): <code>.c</code>\u2192cmoc \xB7 <code>.h</code>\u2192cmoc \xB7 <code>.lwasm</code>\u2192lwasm \xB7 <code>.xasm</code>\u2192xasm6809</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>vectrex</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>williams</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
<tr>
<td><code>williams-defender</code></td>
<td><code>williams</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
</tbody>
</table>
<h3>ARM32</h3>
<p><strong>Default</strong> (<code>arm32</code>): <code>.armips</code>\u2192armips \xB7 <code>.c</code>\u2192armtcc \xB7 <code>.s</code>\u2192armtcc \xB7 <code>.vasm</code>\u2192vasmarm</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>arm32</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td><strong>ARM</strong> DISABLE_UNIMPLEMENTED_LIBC_APIS PRINTF_ALIAS_STANDARD_FUNCTION_NAMES_SOFT</td>
</tr>
</tbody>
</table>
<h3>x86</h3>
<p><strong>Default</strong> (<code>x86</code>): <code>.asm</code>\u2192yasm \xB7 <code>.c</code>\u2192smlrc</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>x86</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
</tbody>
</table>
<h3>Verilog / HDL</h3>
<p><strong>Default</strong> (<code>verilog</code>): <code>.asm</code>\u2192jsasm \xB7 <code>.ice</code>\u2192silice \xB7 <code>.v</code>\u2192verilator</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>verilog</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
</tbody>
</table>
<h3>Z-machine</h3>
<p><strong>Default</strong> (<code>zmachine</code>): <code>.dg</code>\u2192dialog \xB7 <code>.inf</code>\u2192inform6</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>zmachine</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
</tbody>
</table>
<h3>BASIC</h3>
<p><strong>Default</strong> (<code>basic</code>): <code>.bas</code>\u2192basic</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Root</th>
<th>Overrides</th>
<th>cfgfile</th>
<th>defines</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>basic</code></td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
<td>\u2014</td>
</tr>
</tbody>
</table>
<h2>Platform \xD7 extension \u2192 tool</h2>
<p>The canonical extension mapping. Empty cells mean the extension is
not accepted on that platform.</p>
<h3>6502</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.a</code></th>
<th><code>.acme</code></th>
<th><code>.bas</code></th>
<th><code>.bb</code></th>
<th><code>.c</code></th>
<th><code>.ca65</code></th>
<th><code>.cc</code></th>
<th><code>.cc2600</code></th>
<th><code>.cpp</code></th>
<th><code>.dasm</code></th>
<th><code>.ecs</code></th>
<th><code>.fb</code></th>
<th><code>.fbi</code></th>
<th><code>.h</code></th>
<th><code>.lnk</code></th>
<th><code>.nesasm</code></th>
<th><code>.o64</code></th>
<th><code>.s</code></th>
<th><code>.wiz</code></th>
<th><code>.xa</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>apple2</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>merlin32</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>apple2-e</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>merlin32</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>atari7800</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>atari8-5200</code></td>
<td>dasm</td>
<td>acme</td>
<td>fastbasic</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>fastbasic</td>
<td>fastbasic</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>atari8-800</code></td>
<td>dasm</td>
<td>acme</td>
<td>fastbasic</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>fastbasic</td>
<td>fastbasic</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>atari8-800xl</code></td>
<td>dasm</td>
<td>acme</td>
<td>fastbasic</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>fastbasic</td>
<td>fastbasic</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>atari8-800xl.disk</code></td>
<td>dasm</td>
<td>acme</td>
<td>fastbasic</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>fastbasic</td>
<td>fastbasic</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>c64</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>devel-6502</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>kim1</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>nes</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>\xB7</td>
<td>nesasm</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>vcs</code></td>
<td>dasm</td>
<td>acme</td>
<td>bataribasic</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>cc2600</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>vector-ataricolor</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
<tr>
<td><code>vic20</code></td>
<td>dasm</td>
<td>acme</td>
<td>\xB7</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>\xB7</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>\xB7</td>
<td>\xB7</td>
<td>cc65</td>
<td>\xB7</td>
<td>\xB7</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
</tbody>
</table>
<h3>6502 (HuC6280)</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.a</code></th>
<th><code>.acme</code></th>
<th><code>.bb</code></th>
<th><code>.c</code></th>
<th><code>.ca65</code></th>
<th><code>.cc</code></th>
<th><code>.cpp</code></th>
<th><code>.dasm</code></th>
<th><code>.ecs</code></th>
<th><code>.h</code></th>
<th><code>.o64</code></th>
<th><code>.s</code></th>
<th><code>.wiz</code></th>
<th><code>.xa</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>pce</code></td>
<td>dasm</td>
<td>acme</td>
<td>bataribasic</td>
<td>cc65</td>
<td>ca65</td>
<td>oscar64</td>
<td>oscar64</td>
<td>dasm</td>
<td>ecs</td>
<td>cc65</td>
<td>oscar64</td>
<td>ca65</td>
<td>wiz</td>
<td>xa</td>
</tr>
</tbody>
</table>
<h3>Z80</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.c</code></th>
<th><code>.h</code></th>
<th><code>.ns</code></th>
<th><code>.s</code></th>
<th><code>.scc</code></th>
<th><code>.sgb</code></th>
<th><code>.wiz</code></th>
<th><code>.z</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>astrocade</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>astrocade-arcade</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>astrocade-bios</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>coleco</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>cpc</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>cpc.rslib</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>galaxian</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>galaxian-scramble</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>mcr</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>msx</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>msx-libcv</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>mw8080bw</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>pacman</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>sms-gg-libcv</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>sms-sg1000-libcv</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>sms-sms-libcv</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>sound_williams-z80</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>vector-z80color</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>vicdual</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>williams-z80</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>zx</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
</tbody>
</table>
<h3>Game Boy (SM83)</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.c</code></th>
<th><code>.h</code></th>
<th><code>.ns</code></th>
<th><code>.s</code></th>
<th><code>.scc</code></th>
<th><code>.sgb</code></th>
<th><code>.wiz</code></th>
<th><code>.z</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>gb</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
<tr>
<td><code>gb.color</code></td>
<td>sdcc</td>
<td>sdcc</td>
<td>naken</td>
<td>sdasz80</td>
<td>sccz80</td>
<td>sdasgb</td>
<td>wiz</td>
<td>zmac</td>
</tr>
</tbody>
</table>
<h3>6809</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.c</code></th>
<th><code>.h</code></th>
<th><code>.lwasm</code></th>
<th><code>.xasm</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>vectrex</code></td>
<td>cmoc</td>
<td>cmoc</td>
<td>lwasm</td>
<td>xasm6809</td>
</tr>
<tr>
<td><code>williams</code></td>
<td>cmoc</td>
<td>cmoc</td>
<td>lwasm</td>
<td>xasm6809</td>
</tr>
<tr>
<td><code>williams-defender</code></td>
<td>cmoc</td>
<td>cmoc</td>
<td>lwasm</td>
<td>xasm6809</td>
</tr>
</tbody>
</table>
<h3>ARM32</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.armips</code></th>
<th><code>.c</code></th>
<th><code>.s</code></th>
<th><code>.vasm</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>arm32</code></td>
<td>armips</td>
<td>armtcc</td>
<td>armtcc</td>
<td>vasmarm</td>
</tr>
</tbody>
</table>
<h3>x86</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.asm</code></th>
<th><code>.c</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>x86</code></td>
<td>yasm</td>
<td>smlrc</td>
</tr>
</tbody>
</table>
<h3>Verilog / HDL</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.asm</code></th>
<th><code>.ice</code></th>
<th><code>.v</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>verilog</code></td>
<td>jsasm</td>
<td>silice</td>
<td>verilator</td>
</tr>
</tbody>
</table>
<h3>Z-machine</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.dg</code></th>
<th><code>.inf</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>zmachine</code></td>
<td>dialog</td>
<td>inform6</td>
</tr>
</tbody>
</table>
<h3>BASIC</h3>
<table>
<thead>
<tr>
<th>Platform</th>
<th><code>.bas</code></th>
</tr>
</thead>
<tbody>
<tr>
<td><code>basic</code></td>
<td>basic</td>
</tr>
</tbody>
</table>
`;var ur=`<h1>Asset Header</h1>
<p>An <strong>asset header</strong> is a tiny note to the <a href="asseteditor.md">Asset Editor</a>
that tells it what a block of data means. It is just a JSON object inside
a comment, sitting right above the bytes:</p>
<pre><code class="language-c">/*{w:8,h:8,bpp:1,count:2,brev:1}*/
const byte tiles[] = { ... };
</code></pre>
<p>The Asset Editor scans that comment and reads the JSON inside.
It then knows how to convert the bytes inside the array to and from an image.</p>
<p>For example, the above comment represents two images, 8x8 pixels, 1 bit per pixel, most significant bit on the left.</p>
<h2>Header syntax</h2>
<p>A header is a comment containing a single JSON object, immediately
followed by a data block. The block ends at the next closing delimiter,
which depends on the language:</p>
<table>
<thead>
<tr>
<th>Language</th>
<th>Header</th>
<th>Data block ends at</th>
</tr>
</thead>
<tbody>
<tr>
<td>C / C++</td>
<td><code>/*{w:8,h:8}*/</code></td>
<td><code>;</code></td>
</tr>
<tr>
<td>Assembly</td>
<td><code>;;{w:8,h:8};;</code></td>
<td><code>;;</code></td>
</tr>
<tr>
<td>Verilog</td>
<td><code>/*{w:8,h:8}*/</code></td>
<td><code>end</code></td>
</tr>
</tbody>
</table>
<p><strong>Each number needs a radix prefix.</strong>
It recognizes <code>0xNN</code>, <code>$NN</code>, <code>#$NN</code>, <code>%0101</code>, <code>0b0101</code>, <code>8'hNN</code>, <code>8'b0101</code>,
and assembler <code>hex aabbcc\u2026</code> statements.
It remembers the notation you used and writes each number back the same way.
It does <em>not</em> recognize <strong>plain decimal</strong> numbers, so for example <code>{24,60,126,\u2026}</code> will be skipped.</p>
<p>Examples:</p>
<pre><code class="language-c">/*{w:8,h:8,bpp:1,count:2,brev:1}*/
const byte tiles[] = {
  0xff,0x81,0x81,0x81,0x81,0x81,0x81,0xff,
  0x18,0x3c,0x7e,0xff,0xff,0x7e,0x3c,0x18,
};
</code></pre>
<pre><code class="language-asm">;;{w:8,h:8,count:1,brev:1,flip:1};;
PlayerGfx:
       .byte $18,$3c,$7e,$ff
       hex ff7e3c18
;;
</code></pre>
<p>The JSON parser isn\u2019t strict, so you don\u2019t have to \u201Cquote\u201D keys \u2013
<code>w:8</code> and <code>&quot;w&quot;:8</code> mean the same thing.
String <em>values</em> still need their quotes, though: <code>pal:&quot;nes&quot;</code>, <code>comp:&quot;rletag&quot;</code>.</p>
<h3>Gotchas</h3>
<ul>
<li><strong>The first <code>;</code> wins.</strong> In C the block ends at the very next semicolon,
so the array declaration must be the only statement between the header
and that <code>;</code>. Anything else and the editor reads the wrong data.</li>
<li>Keys are case-sensitive and must be alphabetic.</li>
<li>A malformed header is reported inline in the Asset Editor tab, rather
than being silently ignored.</li>
</ul>
<h3>Read binary files with <code>#embed</code></h3>
<p>If the data block contains an <code>#embed</code> directive, the bytes are read
from that file instead of from the source text:</p>
<pre><code class="language-c">/*{w:24,h:21,bpp:1,brev:1,wpimg:64,count:1}*/
const char sprite[] = {
#embed &quot;sprite.bin&quot;
};
</code></pre>
<h3>Overlapping arrays</h3>
<p>The scanner decides where a data block ends from how the header starts,
not from the language of the file. A <code>/*{\u2026}*/</code> header always ends at the
next <code>;</code>. A <code>;;{\u2026};;</code> header always ends at the next <code>;;</code>.</p>
<p>So in an assembly file you can\u2019t stack two <code>;;</code> headers \u2014 the second one
looks like the end of the first. But you <em>can</em> drop a <code>/*{\u2026}*/</code> header in
the middle of a byte block; it will read up to the next <code>;</code>.</p>
<p><code>presets/nes/chr_generic.s</code> does this. One <code>;;</code> header describes all 256
CHR tiles, and a <code>/*{\u2026}*/</code> header near the end describes 15 of those same
bytes as 16\xD716 sprites. The ranges overlap on purpose, so the editor
shows the same data two ways. Just remember that any <code>;</code> inside the block
will cut it short.</p>
<h2>Field reference</h2>
<h3>Image fields</h3>
<p>These describe a bitmap or character set. Only <code>w</code> and <code>h</code> are required \u2014
everything else falls back to a sensible default.</p>
<table>
<thead>
<tr>
<th>Field</th>
<th>Default</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>w</code></td>
<td><em>required</em></td>
<td>Width in pixels</td>
</tr>
<tr>
<td><code>h</code></td>
<td><em>required</em></td>
<td>Height in pixels</td>
</tr>
<tr>
<td><code>count</code></td>
<td><code>1</code></td>
<td>Number of images</td>
</tr>
<tr>
<td><code>bpp</code></td>
<td><code>1</code></td>
<td>Bits per pixel</td>
</tr>
<tr>
<td><code>np</code></td>
<td><code>1</code></td>
<td>Number of bitplanes (colors = 2<sup>bpp\u02D9np</sup>)</td>
</tr>
<tr>
<td><code>bpw</code></td>
<td><code>8</code></td>
<td>Bits per word (8, 16, 32)</td>
</tr>
<tr>
<td><code>sl</code></td>
<td><code>ceil(w*bpp/bpw)</code></td>
<td>Words per scanline (stride)</td>
</tr>
<tr>
<td><code>wpimg</code></td>
<td><code>sl*h</code></td>
<td>Words per image (for padding)</td>
</tr>
<tr>
<td><code>pofs</code></td>
<td><code>sl*h*count</code></td>
<td>Distance between bitplanes, in words</td>
</tr>
<tr>
<td><code>skip</code></td>
<td><code>0</code></td>
<td>Words to skip at the start of the whole block</td>
</tr>
<tr>
<td><code>brev</code></td>
<td><code>false</code></td>
<td>MSB is the leftmost pixel</td>
</tr>
<tr>
<td><code>flip</code></td>
<td><code>false</code></td>
<td>Data is stored bottom row first</td>
</tr>
<tr>
<td><code>il</code></td>
<td><code>false</code></td>
<td>Interleave images row by row</td>
</tr>
<tr>
<td><code>remap</code></td>
<td>\u2014</td>
<td>Bit permutation applied to the word offset</td>
</tr>
<tr>
<td><code>reindex</code></td>
<td>\u2014</td>
<td>Per-column word/bit table</td>
</tr>
<tr>
<td><code>aspect</code></td>
<td><code>1</code></td>
<td>Pixel aspect ratio for display only</td>
</tr>
<tr>
<td><code>art</code></td>
<td><code>false</code></td>
<td>Apple II HGR artifact-color mode</td>
</tr>
<tr>
<td><code>palname</code></td>
<td>\u2014</td>
<td>Preferred palette name for preview</td>
</tr>
<tr>
<td><code>comp</code></td>
<td>\u2014</td>
<td><code>&quot;rletag&quot;</code> = RLE-compressed block</td>
</tr>
<tr>
<td><code>map</code></td>
<td>\u2014</td>
<td><code>&quot;nesnt&quot;</code> = NES nametable, not a bitmap</td>
</tr>
<tr>
<td><code>pacstrip</code></td>
<td>\u2014</td>
<td>Pac-Man/Namco vertical-strip layout</td>
</tr>
<tr>
<td><code>xform</code></td>
<td>\u2014</td>
<td>CSS transform. Parsed and stored but currently inert</td>
</tr>
</tbody>
</table>
<h3>Palette fields</h3>
<p>A block with <code>pal</code> and no <code>w</code>/<code>h</code> describes a palette instead of an image.</p>
<table>
<thead>
<tr>
<th>Field</th>
<th>Default</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>pal</code></td>
<td>\u2014</td>
<td>Palette decoding, see below</td>
</tr>
<tr>
<td><code>n</code></td>
<td>\u2014</td>
<td>Advisory entry count \u2014 the real count comes from the data</td>
</tr>
<tr>
<td><code>layout</code></td>
<td>\u2014</td>
<td>Grouped editor layout: <code>nes</code>, <code>astrocade</code>, <code>pacman</code>, <code>sms</code>, <code>gg</code></td>
</tr>
<tr>
<td><code>name</code></td>
<td><code>&quot;Palette N&quot;</code></td>
<td>Display name in the bitmap editor\u2019s palette dropdown</td>
</tr>
</tbody>
</table>
<p><code>pal</code> is either:</p>
<ul>
<li><strong>A number</strong> like <code>332</code> or <code>444</code> \u2014 the three digits are channel bit
widths, applied <strong>from the low bits upward</strong>. A positive value puts red
lowest (<code>pal:332</code> = RGB332, red in bits 0\u20132); a <strong>negative</strong> value puts
blue lowest (<code>pal:-332</code> = blue in bits 0\u20132, red in the top 2 bits).
The picker\u2019s color space is <code>1 &lt;&lt; (sum of digits)</code> entries, which is why
<code>pal:444</code> is a 4096-color chooser regardless of how many entries the
block holds.</li>
<li><strong>A name</strong>: <code>&quot;nes&quot;</code>, <code>&quot;vcs&quot;</code>, <code>&quot;c64&quot;</code>, <code>&quot;gb&quot;</code>, <code>&quot;ap2lores&quot;</code>,
<code>&quot;astrocade&quot;</code>, or <code>&quot;pacman&quot;</code>.
An unknown name reports an error.</li>
</ul>
<p>Bitmaps pick up their colors from palette blocks <strong>anywhere in the current
project</strong>, matched by entry count \u2014 a 4-color bitmap offers every 4-entry
palette (and every 4-entry slice named by a <code>layout</code>) in a dropdown.
Projects fall back to a default palette when no palette block matches.</p>
<pre><code class="language-c">/*{pal:&quot;nes&quot;,layout:&quot;nes&quot;}*/
const char PALETTE[8] = { 0x0F, 0x11,0x24,0x3C, 0x00, 0x01,0x15,0x25 };
</code></pre>
<p>SMS and Game Gear mode-4 palettes use <code>layout:&quot;sms&quot;</code> (or <code>&quot;gg&quot;</code>, the same
split): the first 16 entries are the background palette and the next 16 are
the sprite palette, matching the VDP\u2019s palette-select bit.</p>
<pre><code class="language-c">/*{pal:222,n:32,layout:&quot;sms&quot;}*/
const unsigned char PALETTE[32] = { ... };
</code></pre>
<p><code>bpw</code> applies to palette blocks too \u2014 PC Engine palettes are 16-bit
words, so their blocks carry <code>bpw:16</code> for correct parsing and write-back.</p>
<p>In Apple II artifact-color mode (<code>art:1</code>), the artifact column (high bit) is edited
separately and is left alone by the transforms.</p>
<h3>Palette names</h3>
<p>Give a palette a <code>name</code> in its header to label it in that dropdown, and
name a bitmap\u2019s preferred entry with <code>palname</code> so it opens with the matching
palette:</p>
<pre><code class="language-c">/*{pal:&quot;nes&quot;,layout:&quot;nes&quot;,name:&quot;Background&quot;}*/
const char BG_PALETTE[8] = { ... };
/*{pal:&quot;nes&quot;,layout:&quot;nes&quot;,name:&quot;Sprite&quot;}*/
const char SPR_PALETTE[8] = { ... };
/*{w:16,h:16,bpp:1,np:2,pofs:8,brev:1,palname:&quot;Sprite&quot;}*/
const char sprites[] = { ... };
</code></pre>
<p>Unnamed palettes are numbered in source order (<code>Palette 1</code>, <code>Palette 2</code>, \u2026)
and get a prefix when there are sub-palettes like on NES (<code>Palette 3: Background 0</code>).</p>
<h2>Bit order and planes</h2>
<p>Two questions decide how the bits turn into pixels.</p>
<p><strong>Where do bits start?</strong> <code>brev:1</code> means <strong>MSB is the leftmost pixel</strong> \u2014 the
usual arrangement for NES, Game Boy, TMS9918, VCS, and most tile-based
hardware. Without it, the LSB is leftmost (Apple II HGR, some bitmap
formats).</p>
<p><strong>How are colors decided?</strong> Most formats use one of these two:</p>
<ul>
<li><strong><code>bpp:N</code></strong> \u2014 the bits of one pixel are adjacent within a word. <code>bpp:4</code>
packs two 16-color pixels per byte.</li>
<li><strong><code>np:N</code></strong> \u2014 the bits of one pixel live in N separate words, <code>pofs</code>
apart. Plane <code>p</code> supplies bits <code>p*bpp</code>.</li>
</ul>
<p>Game Boy 2bpp is <code>bpp:1,np:2,pofs:1,sl:2</code> \u2014 planes interleaved every
other byte. NES 2bpp is <code>bpp:1,np:2,pofs:8</code> \u2014 plane 0 in bytes 0\u20137,
plane 1 in bytes 8\u201315.</p>
<h2>The address model</h2>
<p>Everything except the special modes below is described by one addressing
formula:</p>
<pre><code>bpw        = bpw   ?? 8                      // bits per word
sl         = sl    ?? ceil(w * bpp / bpw)    // words per scanline
wpimg      = wpimg ?? sl * h                 // words per image
pofs       = pofs  ?? sl * h * count         // distance between bitplanes
rowstride  = sl                              // (see il: below)

for each image n, for each row y:
    yp    = flip ? h-1-y : y
    ofs0  = n*wpimg + yp*rowstride
    shift = 0
    for each column x:
        ofs = remap(ofs0)                       // bit permutation
        for each plane p:
            word  = data[ofs + p*pofs + skip]
            bits  = brev ? word &gt;&gt; (bpw-shift-bpp) : word &gt;&gt; shift
            color |= (bits &amp; ((1&lt;&lt;bpp)-1)) &lt;&lt; (p*bpp)
        shift += bpp
        if shift &gt;= bpw:                        // move to next word in the row
            ofs0 += 1
            shift = 0
</code></pre>
<p>A few things to note:</p>
<ol>
<li><strong><code>remap</code> is applied to <code>ofs0</code> inside the <code>x</code> loop</strong>, after the
byte-advance. It therefore sees the byte index <em>within</em> a row as well
as the row and image index \u2014 which lets you describe
multi-tile-wide sprites.</li>
<li><strong><code>skip</code> is added last</strong>, after <code>remap</code> and after the plane offset. It
offsets the whole block, not each image.</li>
<li><strong><code>pofs</code> defaults to \u201Cone plane block after another\u201D</strong>
(<code>sl*h*count</code>). Set it explicitly for anything interleaved.</li>
<li>Total colors per pixel = <code>1 &lt;&lt; (bpp * np)</code>.</li>
</ol>
<h3><code>il</code> \u2014 row interleaving</h3>
<p><code>il:1</code> stores all <code>count</code> images as one wide block, row by row: <code>wpimg</code>
becomes <code>sl</code>, and <code>rowstride</code> becomes <code>sl*count</code>. Useful for character
sets stored as a single wide strip.</p>
<h2><code>remap</code> \u2014 matching hardware tile layouts</h2>
<p><code>remap</code> permutes the <strong>bits of the word offset</strong>.
It is useful for handling bitmaps in a
different order than row-major, or for rearranging sprite tiles.</p>
<p>Entry <code>i</code> of the array says which destination bit source bit <code>i</code> becomes:</p>
<pre><code>remap(ofs)  =  OR over i of:  bit i of ofs  \u2192  bit remap[i] of result
</code></pre>
<p>A <strong>negative</strong> entry <code>-n</code> maps source bit <code>i</code> to destination bit <code>n-1</code>
<strong>and inverts it</strong> \u2014 use it when the hardware stores the halves in the
opposite order.</p>
<h3>Worked example: NES 16\xD716 metasprite</h3>
<p>From <code>presets/nes/shoot2.c</code>:</p>
<pre><code class="language-c">/*{w:16,h:16,bpp:1,count:16,brev:1,np:2,pofs:8,remap:[5,0,1,2,4,6,7,8,9,10,11,12]}*/
</code></pre>
<p><code>sl</code> = 2, <code>wpimg</code> = 32, so the natural offset is <code>32n + 2y + xb</code>:</p>
<table>
<thead>
<tr>
<th>Source bit</th>
<th>Meaning</th>
<th>\u2192</th>
<th>Dest bit</th>
<th>Contributes</th>
</tr>
</thead>
<tbody>
<tr>
<td>0</td>
<td><code>xb</code> (left/right byte)</td>
<td>\u2192</td>
<td>5</td>
<td>32</td>
</tr>
<tr>
<td>1,2,3</td>
<td><code>y0,y1,y2</code></td>
<td>\u2192</td>
<td>0,1,2</td>
<td><code>y &amp; 7</code></td>
</tr>
<tr>
<td>4</td>
<td><code>y3</code> (top/bottom half)</td>
<td>\u2192</td>
<td>4</td>
<td>16</td>
</tr>
<tr>
<td>5+</td>
<td>image index <code>n</code></td>
<td>\u2192</td>
<td>6+</td>
<td>64\xB7n</td>
</tr>
</tbody>
</table>
<p>Physical offset = <code>64n + 32\xB7xb + 16\xB7y3 + (y&amp;7)</code>, plus <code>p*8</code> for the
plane. That is exactly NES CHR: four 16-byte tiles per metasprite in
8\xD716 sprite order \u2014 upper-left, lower-left, upper-right, lower-right.</p>
<h3>Worked example: Game Boy 16\xD716 metasprite</h3>
<p>From <code>presets/gb/pakupaku.c</code>:</p>
<pre><code class="language-c">/*{w:16,h:16,bpp:1,count:19,brev:1,np:2,pofs:1,sl:2,wpimg:64,remap:[5,1,2,3,4,0,6,7,8,9,10,11,12]}*/
</code></pre>
<p>Game Boy interleaves its two planes, so <code>pofs:1</code>: each plane gets one
byte per 8-pixel row, and <code>sl:2</code> covers both planes of that row. The
natural offset is therefore <code>64n + 2y + xb</code>, with <code>xb</code> in bit 0 and <code>y</code>
in bits 1\u20134.</p>
<p>The remap rearranges those bits as follows:</p>
<table>
<thead>
<tr>
<th>Source bit</th>
<th>Meaning</th>
<th>\u2192</th>
<th>Dest bit</th>
<th>Contributes</th>
</tr>
</thead>
<tbody>
<tr>
<td>0</td>
<td><code>xb</code> (left/right 8\xD78 tile)</td>
<td>\u2192</td>
<td>5</td>
<td>32</td>
</tr>
<tr>
<td>1,2,3</td>
<td><code>y0,y1,y2</code></td>
<td>\u2192</td>
<td>1,2,3</td>
<td><code>y &amp; 7</code></td>
</tr>
<tr>
<td>4</td>
<td><code>y3</code> (top/bottom half)</td>
<td>\u2192</td>
<td>4</td>
<td>16</td>
</tr>
<tr>
<td>5</td>
<td>unused</td>
<td>\u2192</td>
<td>0</td>
<td>\u2014</td>
</tr>
<tr>
<td>6+</td>
<td>image index <code>n</code></td>
<td>\u2192</td>
<td>6+</td>
<td>64\xB7n</td>
</tr>
</tbody>
</table>
<p>So the physical offset becomes <code>64n + 32\xB7xb + 16\xB7y3 + 2\xB7(y&amp;7)</code>, plus <code>p</code>
for the plane. That is upper-left, lower-left, upper-right, lower-right \u2014
the tile order pakupaku\u2019s OAM code expects. Bit 5 is unused only because
<code>y</code> never exceeds 15 here; mapping it to bit 0 keeps the remap a proper
permutation of the range.</p>
<h3><code>remap</code> must be a bijection</h3>
<p>In other words, if you do it in reverse, you get the original order back.</p>
<p>The size check computes the required data length as <code>max over n,i of remap(n*wpimg + i)</code> for <code>i</code> in <code>[0, wpimg)</code>, plus one. If your remap
isn\u2019t a permutation of that range, the maximum comes out wrong and you
get a spurious <em>\u201CExpected N values, found M\u201D</em> error. This is why the
Game Boy example above bothers to map the unused bit 5 down to bit 0
instead of leaving it alone \u2014 the mapping is never exercised during
decoding, but it keeps the range exact.</p>
<h3>Other patterns in the tree</h3>
<table>
<thead>
<tr>
<th>Format</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>remap:[0,1,2,4,5,6,7,8,9,10,11,12]</code></td>
<td>NES 8\xD78: doubles the image stride to 16 bytes so the two 8-byte planes fit</td>
</tr>
<tr>
<td><code>remap:[4,0,1,2,3,5,6,7,8,9]</code></td>
<td>TMS9918 16\xD716 sprite: UL, LL, UR, LR (ColecoVision, MSX)</td>
</tr>
<tr>
<td><code>remap:[-5,0,1,2,3,5,6,7,8,9]</code></td>
<td>Same, with the halves stored right-first</td>
</tr>
<tr>
<td><code>remap:[3,0,1,2,4,5,6,7,8,9,10]</code></td>
<td>Galaxian/Scramble 16\xD716 sprite</td>
</tr>
</tbody>
</table>
<h2><code>reindex</code></h2>
<p><code>reindex</code> throws out the shift/advance logic and replaces it with a plain
per-column table. For column <code>x</code>, <code>reindex[x % len]</code> is a <strong>bit index
within the row</strong>: <code>&gt;&gt; 3</code> gives the word offset added to the row base, <code>&amp; 7</code> gives the bit position (still subject to <code>brev</code>). Entry <code>15</code> therefore
means word 1, bit 7. Because it drives the offset directly, the automatic
<code>ofs0 += 1</code> advance is disabled.</p>
<p>It exists for hardware where pixel order within a row is not linear \u2014
notably VCS playfields, where the three playfield registers are not all
in the same bit order:</p>
<pre><code class="language-asm">;;{w:20,h:10,flip:1,reindex:[4,5,6,7,15,14,13,12,11,10,9,8,16,17,18,19]};;
</code></pre>
<h2>Special modes</h2>
<h3><code>comp:&quot;rletag&quot;</code></h3>
<p>The block is RLE-compressed: the first byte is the tag, a literal byte
sets the current value, and a tag byte is followed by a repeat count
(count 0 = end). Decompression happens before decoding, so the editor
shows the expanded image. Currently, these asset blocks are view-only.</p>
<h3><code>map:&quot;nesnt&quot;</code></h3>
<p>The block is an NES nametable, not a bitmap. <code>w</code>/<code>h</code> are in <strong>tiles</strong>
(default 32\xD730) and the block is rendered as a tilemap using the project\u2019s
CHR data, with a map editor instead of a pixel editor. Usually paired with
<code>comp:&quot;rletag&quot;</code>:</p>
<pre><code class="language-c">/*{w:32,h:30,bpp:8,comp:&quot;rletag&quot;,map:&quot;nesnt&quot;}*/
</code></pre>
<p>Currently, these asset blocks are view-only.</p>
<h3><code>pacstrip:1</code></h3>
<p>Pac-Man / Namco arcade layout: 8-byte vertical strips of 4 rows \xD7 8
columns, 2bpp packed as bit <code>y</code> plus bit <code>y+4</code>, X/Y mirrored within each
strip. Tiles (8\xD78) use 2 strips; sprites (16\xD716) use 8 strips in hardware
order. The mode implies 4 colors regardless of <code>bpp</code>.</p>
<pre><code class="language-c">/*{w:8,h:8,count:256,bpp:2,pacstrip:1}*/
/*{w:16,h:16,count:64,bpp:2,pacstrip:1}*/
</code></pre>
<h3><code>art:1</code></h3>
<p>Apple II HGR artifact color: bit 7 of each byte selects the color set, and
the editor shows a per-group palette toggle. The artifact bit is bit 0
when <code>brev</code> is set, bit 7 otherwise.</p>
<h2>Validation</h2>
<p>Before it creates an editor, the Asset Editor counts the parsed words
(these are bytes when <code>bpw</code> is 8) and checks them against the format:</p>
<pre><code>required = max(remap(n*wpimg + i))  +  planeExtent  +  1  +  skip
planeExtent = (np-1)*pofs, or 0 if that is smaller than wpimg
</code></pre>
<p>The <code>planeExtent</code> rule distinguishes the two plane layouts: when planes
are interleaved (<code>pofs &lt; wpimg</code>, Game Boy/SMS) the plane bytes are already
inside each image block; when planes are stored as separate blocks
(<code>pofs &gt;= wpimg</code>, NES) the extra plane is counted at the end.</p>
<p>A mismatch shows as <strong>\u201CExpected N value(s), found M\u201D</strong> in the Asset
Editor tab. When that happens, check things in this order:</p>
<ol>
<li><strong><code>found 0</code></strong> \u2014 the literals have no radix prefix, or the data block
ended early at a stray <code>;</code>.</li>
<li><code>count</code> \u2014 the most common culprit otherwise.</li>
<li><code>wpimg</code> \u2014 hardware often pads (C64 sprites are 24\xD721 bits in 64
bytes).</li>
<li><code>remap</code> \u2014 is it a bijection over <code>[0, wpimg)</code>?</li>
<li><code>pofs</code> \u2014 interleaved planes need it set explicitly.</li>
</ol>
<h2>Cookbook</h2>
<p>Some recipes you can copy and paste:</p>
<table>
<thead>
<tr>
<th>Platform</th>
<th>Header</th>
</tr>
</thead>
<tbody>
<tr>
<td>NES 8\xD78 CHR</td>
<td><code>/*{w:8,h:8,bpp:1,count:256,brev:1,np:2,pofs:8,remap:[0,1,2,4,5,6,7,8,9,10,11,12]}*/</code></td>
</tr>
<tr>
<td>NES 16\xD716 metasprite</td>
<td><code>/*{w:16,h:16,bpp:1,count:16,brev:1,np:2,pofs:8,remap:[5,0,1,2,4,6,7,8,9,10,11,12]}*/</code></td>
</tr>
<tr>
<td>NES palette</td>
<td><code>/*{pal:&quot;nes&quot;,layout:&quot;nes&quot;}*/</code></td>
</tr>
<tr>
<td>NES nametable</td>
<td><code>/*{w:32,h:30,bpp:8,comp:&quot;rletag&quot;,map:&quot;nesnt&quot;}*/</code></td>
</tr>
<tr>
<td>Game Boy 8\xD78 tile</td>
<td><code>/*{w:8,h:8,bpp:1,count:4,brev:1,np:2,pofs:1,sl:2}*/</code></td>
</tr>
<tr>
<td>Game Boy 16\xD716 metasprite</td>
<td><code>/*{w:16,h:16,bpp:1,count:19,brev:1,np:2,pofs:1,sl:2,wpimg:64,remap:[5,1,2,3,4,0,6,7,8,9,10,11,12]}*/</code></td>
</tr>
<tr>
<td>ColecoVision / MSX sprite</td>
<td><code>/*{w:16,h:16,brev:1,remap:[4,0,1,2,3,5,6,7,8,9],count:2}*/</code></td>
</tr>
<tr>
<td>ColecoVision layered 2-plane sprite</td>
<td><code>/*{w:16,h:16,remap:[-5,0,1,2,3,5,6,7,8,9],count:5,np:2}*/</code></td>
</tr>
<tr>
<td>C64 hires sprite</td>
<td><code>/*{w:24,h:21,bpp:1,brev:1,wpimg:64,aspect:1,count:3}*/</code></td>
</tr>
<tr>
<td>C64 multicolor sprite</td>
<td><code>/*{w:12,h:21,bpp:2,brev:1,wpimg:64,count:4,aspect:2}*/</code></td>
</tr>
<tr>
<td>VCS sprite</td>
<td><code>;;{w:8,h:16,brev:1,flip:1};;</code></td>
</tr>
<tr>
<td>VCS palette</td>
<td><code>;;{pal:&quot;vcs&quot;};;</code></td>
</tr>
<tr>
<td>Galaxian/Scramble tile ROM</td>
<td><code>/*{w:16,h:16,remap:[3,0,1,2,4,5,6,7,8,9,10],brev:1,np:2,pofs:2048,count:64}*/</code></td>
</tr>
<tr>
<td>Pac-Man tiles / sprites</td>
<td><code>/*{w:8,h:8,count:256,bpp:2,pacstrip:1}*/</code> \xB7 <code>/*{w:16,h:16,count:64,bpp:2,pacstrip:1}*/</code></td>
</tr>
<tr>
<td>Pac-Man color PROM</td>
<td><code>/*{pal:&quot;pacman&quot;,n:32}*/</code></td>
</tr>
<tr>
<td>SMS / Game Gear mode-4 palette</td>
<td><code>/*{pal:222,n:32,layout:&quot;sms&quot;}*/</code> (GG: <code>pal:444</code>)</td>
</tr>
<tr>
<td>Astrocade</td>
<td><code>/*{w:16,h:16,bpp:2,brev:1}*/</code> \xB7 <code>/*{pal:&quot;astrocade&quot;,layout:&quot;astrocade&quot;}*/</code></td>
</tr>
<tr>
<td>Williams</td>
<td><code>/*{w:16,h:16,bpp:4,brev:1}*/</code></td>
</tr>
<tr>
<td>PC Engine 16\xD716 sprite</td>
<td><code>/*{w:16,h:16,bpp:1,count:3,brev:1,np:4,pofs:16,sl:1,bpw:16,wpimg:64}*/</code></td>
</tr>
<tr>
<td>Apple II HGR</td>
<td><code>/*{w:8,h:8,bpp:1,count:96}*/</code> (LSB-first, no <code>brev</code>)</td>
</tr>
<tr>
<td>Verilog 16-bit words</td>
<td><code>/*{w:16,h:16,bpw:16,count:5}*/</code></td>
</tr>
</tbody>
</table>
`;var mr=`<h2>Embedding the IDE in a web page</h2>
<p>You can embed the IDE using an IFRAME element:</p>
<pre><code class="language-html">&lt;iframe src=&quot;https://8bitworkshop.com/redir.html?embed=1&amp;...&quot;&gt;&lt;/iframe&gt;
</code></pre>
<p>Query-string parameters:</p>
<table>
<thead>
<tr>
<th>Name</th>
<th>Value</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>embed</code></td>
<td>must be <code>1</code></td>
</tr>
<tr>
<td><code>platform</code></td>
<td>platform ID (for example <code>vcs</code>)</td>
</tr>
<tr>
<td><code>file0_name</code></td>
<td>name of the main file</td>
</tr>
<tr>
<td><code>file0_data</code></td>
<td>text content of the main file</td>
</tr>
<tr>
<td><code>highlight</code></td>
<td>(optional) line range to highlight (for example <code>2,4</code>)</td>
</tr>
</tbody>
</table>
<p>The IDE uses browser storage tied to the referrer URL, so each page
containing embeds is effectively sandboxed from the others.</p>
<p>Example using Bootstrap\u2019s <code>embed-responsive</code> class:</p>
<pre><code class="language-html">&lt;div class=&quot;embed-responsive embed-responsive-16by9&quot;&gt;
  &lt;iframe class=&quot;embed-responsive-item&quot; loading=&quot;lazy&quot;
    src=&quot;https://8bitworkshop.com/redir.html?embed=1&amp;platform=nes&amp;highlight=&amp;file0_name=testembed.dasm&amp;file0_data=...&quot;&gt;&lt;/iframe&gt;
&lt;/div&gt;
</code></pre>
`;var fr=`<h1>Waveform Viewer</h1>
<p>The Verilog platform shows a waveform trace below the emulator screen,
with one row per exposed signal. <strong>Click</strong> to give the waveform viewer
keyboard focus.</p>
<p>If the CRT is active, the waveform viewer is hidden by default, below the CRT frame.
You can <strong>click and drag</strong> its frame border up from the bottom of the screen.</p>
<h2>Which signals appear</h2>
<p>The trace shows every scalar/vector <code>logic</code> signal from the flattened
design: top-level ports and internal registers and wires from every
submodule, not just the top level. These are omitted:</p>
<ul>
<li>Non-logic types (arrays, memories)</li>
<li>Internal simulator temporaries (names starting with <code>__V</code>)</li>
<li>If the design drives video output (it has <code>vsync</code>, <code>hsync</code>, and <code>rgb</code>
signals), <code>clk</code> and <code>reset</code></li>
</ul>
<p>Multi-bit signals will display their hex or decimal values on top of the waveforms when zoomed in.</p>
<h2>Mouse actions</h2>
<ul>
<li><strong>Click</strong> on the trace to move the selection cursor to that clock.</li>
<li><strong>Click and drag</strong> to scrub through the trace.</li>
<li><strong>Scroll horizontally</strong> to pan left/right.</li>
<li>For input signals (other than <code>clk</code> or <code>reset</code>)  <strong>click</strong> its row to change its
value at the current clock.</li>
</ul>
`;var Ud=qo(),br=[{id:"index",title:"IDE Help",html:Ko},{id:"editor",title:"Editor",html:Xo},{id:"disasm",title:"Disassembly",html:Zo},{id:"memory",title:"Memory Browser",html:Jo},{id:"memmap",title:"Memory Map",html:Qo},{id:"vram",title:"VRAM Browser",html:tr},{id:"memprobe",title:"Memory Probe",html:er},{id:"crtprobe",title:"CRT Probe",html:nr},{id:"probelog",title:"Probe Log",html:or},{id:"scanlineio",title:"Scanline I/O",html:rr},{id:"symbols",title:"Symbol Profiler",html:dr},{id:"callstack",title:"Call Stack",html:ar},{id:"debugtree",title:"Debug Tree",html:sr},{id:"breakpoints",title:"Breakpoints",html:ir},{id:"asseteditor",title:"Asset Editor",html:cr},{id:"managing-files",title:"Managing Files",html:lr},{id:"build-directives",title:"Build Directives",html:hr},{id:"toolchains",title:"Toolchains & Platforms",html:pr},{id:"asset-headers",title:"Asset Headers",html:ur},{id:"embedding-ide",title:"Embedding the IDE",html:mr},{id:"verilog-waveform",title:"Waveform Viewer",html:fr}],to={};for(let n of br)to[n.id]=n;$o(()=>br);function eo(n){let e=n||"";return e.startsWith("#")&&(e=e.substring(1)),e.startsWith("help")&&(e=e.substring(4)),e.startsWith("/")&&(e=e.substring(1)),e.endsWith(".md")&&(e=e.substring(0,e.length-3)),e=e.replace(/^\.\//,""),to[e]?e:"index"}function Hd(n){return to[eo(n)]}var Bd={"#disasm":"disasm","#memory":"memory","#memmap":"memmap","#vram":"vram","#memprobe":"memprobe","#crtprobe":"crtprobe","#probelog":"probelog","#scanlineio":"scanlineio","#symbols":"symbols","#callstack":"callstack","#debugtree":"debugtree","#breakpoints":"breakpoints","#asseteditor":"asseteditor"};function Ls(n,e){return e?"editor":n&&Bd[n]||"index"}var yr=[];function zs(n,e){yr.push({div:n,id:e})}function Ns(){let n=document.activeElement;if(!n)return null;for(let e of yr)if(e.div.contains(n))return e.id;return null}function Gd(n){n.querySelectorAll("a[href]").forEach(r=>{let a=r.getAttribute("href");if(!a)return;if(/^[a-z][a-z0-9+.-]*:/i.test(a)){r.setAttribute("target","_blank"),r.setAttribute("rel","noopener noreferrer");return}if(a.startsWith("/")||a.startsWith("#"))return;let i=a.indexOf("#"),h=i>=0?a.substring(0,i):a;h.endsWith(".md")&&(r.setAttribute("href","#help/"+eo(h)),r.removeAttribute("target"))})}function qd(n,e){let r=Hd(e);n.innerHTML=Ud.sanitize(r.html),Gd(n)}var gr=class{constructor(e){this.id=eo(e||"index")}getPath(){return"#help/"+this.id}createDiv(e){return this.maindiv=vo(e,"vertical-scroll help-view"),qd(this.maindiv[0],this.id),this.maindiv[0]}refresh(e){}};function Re(n){var e=n&&n.w+"px"||"100%",r=n&&n.h+"px"||"100%",a=this.itemHeight=n.itemHeight;this.items=n.items,this.generatorFn=n.generatorFn,this.totalRows=n.totalRows||n.items&&n.items.length;var i=Re.createScroller(a*this.totalRows);this.container=Re.createContainer(e,r),this.container.appendChild(i);var h=Math.ceil(n.h/a);this.cachedItemsLen=h*3,this._renderChunk(this.container,0);var g=this,k,b=h*a,R=0;this.rmNodeInterval=setInterval(function(){if(Date.now()-R>100)for(var B=document.querySelectorAll('[data-rm="1"]'),_=0,F=B.length;_<F;_++)try{g.container.removeChild(B[_])}catch(O){}},300);function M(B){var _=B.target.scrollTop;if(!k||Math.abs(_-k)>b){var F=Math.floor(_/a)-h;g._renderChunk(g.container,F<0?0:F),k=_}R=Date.now(),B.preventDefault&&B.preventDefault()}this.container.addEventListener("scroll",M)}Re.prototype.createRow=function(n){var e;if(this.generatorFn)e=this.generatorFn(n);else if(this.items)if(typeof this.items[n]=="string"){var r=document.createTextNode(this.items[n]);e=document.createElement("div"),e.style.height=this.itemHeight+"px",e.appendChild(r)}else e=this.items[n];return e.classList.add("vrow"),e.setAttribute("data-index",""+n),e.style.position="absolute",e.style.top=n*this.itemHeight+"px",e};Re.prototype._renderChunk=function(n,e){var r=e+this.cachedItemsLen;r>this.totalRows&&(r=this.totalRows);for(var a=document.createDocumentFragment(),i=e;i<r;i++)a.appendChild(this.createRow(i));for(var h=1,g=n.childNodes.length;h<g;h++)n.childNodes[h].style.display="none",n.childNodes[h].setAttribute("data-rm","1");n.appendChild(a)};Re.createContainer=function(n,e){var r=document.createElement("div");return r.classList.add("vlist"),r.style.width=n,r.style.height=e,r.style.overflow="auto",r.style.position="relative",r.style.padding="0",r.style.border="1px solid black",r};Re.createScroller=function(n){var e=document.createElement("div");return e.style.opacity="0",e.style.position="absolute",e.style.top="0",e.style.left="0",e.style.width="1px",e.style.height=n+"px",e};Re.prototype.scrollToItem=function(n){this.container.scrollTop=this.itemHeight*n};function wr(n,e){(e==null||e>n.length)&&(e=n.length);for(var r=0,a=Array(e);r<e;r++)a[r]=n[r];return a}function jd(n){if(Array.isArray(n))return n}function Vd(n,e){var r=n==null?null:typeof Symbol!="undefined"&&n[Symbol.iterator]||n["@@iterator"];if(r!=null){var a,i,h,g,k=[],b=!0,R=!1;try{if(h=(r=r.call(n)).next,e!==0)for(;!(b=(a=h.call(r)).done)&&(k.push(a.value),k.length!==e);b=!0);}catch(M){R=!0,i=M}finally{try{if(!b&&r.return!=null&&(g=r.return(),Object(g)!==g))return}finally{if(R)throw i}}return k}}function Yd(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function $d(n,e){return jd(n)||Vd(n,e)||Kd(n,e)||Yd()}function Kd(n,e){if(n){if(typeof n=="string")return wr(n,e);var r={}.toString.call(n).slice(8,-1);return r==="Object"&&n.constructor&&(r=n.constructor.name),r==="Map"||r==="Set"?Array.from(n):r==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?wr(n,e):void 0}}var Pr=Object.entries,Tr=Object.setPrototypeOf,Xd=Object.isFrozen,Zd=Object.getPrototypeOf,Jd=Object.getOwnPropertyDescriptor,dt=Object.freeze,it=Object.seal,Le=Object.create,Lr=typeof Reflect!="undefined"&&Reflect,ho=Lr.apply,po=Lr.construct;dt||(dt=function(e){return e});it||(it=function(e){return e});ho||(ho=function(e,r){for(var a=arguments.length,i=new Array(a>2?a-2:0),h=2;h<a;h++)i[h-2]=arguments[h];return e.apply(r,i)});po||(po=function(e){for(var r=arguments.length,a=new Array(r>1?r-1:0),i=1;i<r;i++)a[i-1]=arguments[i];return new e(...a)});var Me=Q(Array.prototype.forEach),Qd=Q(Array.prototype.lastIndexOf),Sr=Q(Array.prototype.pop),fn=Q(Array.prototype.push),ta=Q(Array.prototype.splice),ze=Array.isArray,yn=Q(String.prototype.toLowerCase),ro=Q(String.prototype.toString),vr=Q(String.prototype.match),gn=Q(String.prototype.replace),Er=Q(String.prototype.indexOf),ea=Q(String.prototype.trim),na=Q(Number.prototype.toString),oa=Q(Boolean.prototype.toString),Ar=typeof BigInt=="undefined"?null:Q(BigInt.prototype.toString),_r=typeof Symbol=="undefined"?null:Q(Symbol.prototype.toString),Tt=Q(Object.prototype.hasOwnProperty),bn=Q(Object.prototype.toString),mt=Q(RegExp.prototype.test),Ce=ra(TypeError);function Q(n){return function(e){e instanceof RegExp&&(e.lastIndex=0);for(var r=arguments.length,a=new Array(r>1?r-1:0),i=1;i<r;i++)a[i-1]=arguments[i];return ho(n,e,a)}}function ra(n){return function(){for(var e=arguments.length,r=new Array(e),a=0;a<e;a++)r[a]=arguments[a];return po(n,r)}}function z(n,e){let r=arguments.length>2&&arguments[2]!==void 0?arguments[2]:yn;if(Tr&&Tr(n,null),!ze(e))return n;let a=e.length;for(;a--;){let i=e[a];if(typeof i=="string"){let h=r(i);h!==i&&(Xd(e)||(e[a]=h),i=h)}n[i]=!0}return n}function da(n){for(let e=0;e<n.length;e++)Tt(n,e)||(n[e]=null);return n}function It(n){let e=Le(null);for(let a of Pr(n)){var r=$d(a,2);let i=r[0],h=r[1];Tt(n,i)&&(ze(h)?e[i]=da(h):h&&typeof h=="object"&&h.constructor===Object?e[i]=It(h):e[i]=h)}return e}function aa(n){switch(typeof n){case"string":return n;case"number":return na(n);case"boolean":return oa(n);case"bigint":return Ar?Ar(n):"0";case"symbol":return _r?_r(n):"Symbol()";case"undefined":return bn(n);case"function":case"object":{if(n===null)return bn(n);let e=n,r=Pt(e,"toString");if(typeof r=="function"){let a=r(e);return typeof a=="string"?a:bn(a)}return bn(n)}default:return bn(n)}}function Pt(n,e){for(;n!==null;){let a=Jd(n,e);if(a){if(a.get)return Q(a.get);if(typeof a.value=="function")return Q(a.value)}n=Zd(n)}function r(){return null}return r}function sa(n){try{return mt(n,""),!0}catch(e){return!1}}var xr=dt(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),ao=dt(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),so=dt(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),ia=dt(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),io=dt(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),ca=dt(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),kr=dt(["#text"]),Rr=dt(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","command","commandfor","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns"]),co=dt(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dominant-baseline","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","pointer-events","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-orientation","text-rendering","textlength","type","u1","u2","unicode","values","vector-effect","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),Cr=dt(["accent","accentunder","align","bevelled","close","columnalign","columnlines","columnspacing","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lquote","lspace","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),vn=dt(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),la=it(/{{[\w\W]*|^[\w\W]*}}/g),ha=it(/<%[\w\W]*|^[\w\W]*%>/g),pa=it(/\${[\w\W]*/g),ua=it(/^data-[\-\w.\u00B7-\uFFFF]+$/),ma=it(/^aria-[\-\w]+$/),Mr=it(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),fa=it(/^(?:\w+script|data):/i),ga=it(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),ba=it(/^html$/i),ya=it(/^[a-z][.\w]*(-[.\w]+)+$/i),Or=it(/<[/\w!]/g),Ir=it(/<[/\w]/g),wa=it(/<\/no(script|embed|frames)/i),Ta=it(/\/>/i),Ot={element:1,attribute:2,text:3,cdataSection:4,entityReference:5,entityNode:6,processingInstruction:7,comment:8,document:9,documentType:10,documentFragment:11,notation:12},zr=["style","script","xmp","iframe","noembed","noframes","plaintext","noscript"],Sa=dt(z({},zr)),va=(function(){let n={};return Me(zr,e=>{n[e]=it(new RegExp("</"+e+"(?=[\\t\\n\\f\\r />])","i"))}),dt(n)})(),Ea=function(){return typeof window=="undefined"?null:window},Aa=function(e,r){if(typeof e!="object"||typeof e.createPolicy!="function")return null;let a=null,i="data-tt-policy-suffix";r&&r.hasAttribute(i)&&(a=r.getAttribute(i));let h="dompurify"+(a?"#"+a:"");try{return e.createPolicy(h,{createHTML(g){return g},createScriptURL(g){return g}})}catch(g){return console.warn("TrustedTypes policy "+h+" could not be created."),null}},Dr=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},de=function(e,r,a,i){return Tt(e,r)&&ze(e[r])?z(i.base?It(i.base):{},e[r],i.transform):a},lo=function(e,r,a){let i=Tt(e,r)?e[r]:void 0;return i&&typeof i=="object"?It(i):a()};function Nr(){let n=arguments.length>0&&arguments[0]!==void 0?arguments[0]:Ea(),e=s=>Nr(s);if(e.version="3.4.15",e.removed=[],!n||!n.document||n.document.nodeType!==Ot.document||!n.Element)return e.isSupported=!1,e;let r=n.document,a=r,i=a.currentScript;n.DocumentFragment;let h=n.HTMLTemplateElement,g=n.Node,k=n.Element,b=n.NodeFilter,R=n.NamedNodeMap;R===void 0&&(n.NamedNodeMap||n.MozNamedAttrMap),n.HTMLFormElement;let M=n.DOMParser,B=n.trustedTypes,_=k.prototype,F=Pt(_,"cloneNode"),O=Pt(_,"remove"),Y=Pt(_,"removeAttributeNode"),Lt=Pt(_,"nextSibling"),Z=Pt(_,"childNodes"),at=Pt(_,"parentNode"),Ut=Pt(_,"shadowRoot"),I=Pt(_,"attributes"),w=g&&g.prototype?Pt(g.prototype,"nodeType"):null,C=g&&g.prototype?Pt(g.prototype,"nodeName"):null,D=g&&g.prototype?Pt(g.prototype,"ownerDocument"):null,tt=function(t){return w?w(t):t.nodeType},bt=function(t){return C?C(t):t.nodeName};if(typeof h=="function"){let s=r.createElement("template");s.content&&s.content.ownerDocument&&(r=s.content.ownerDocument)}let P,et="",j,ae=!1,ct=0,te=function(){if(ct>0)throw Ce('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.')},pt=function(t){te(),ct++;try{return P.createHTML(t)}finally{ct--}},se=function(t){te(),ct++;try{return P.createScriptURL(t)}finally{ct--}},ie=function(){return ae||(j=Aa(B,i),ae=!0),j},St=r,zt=St.implementation,ce=St.createNodeIterator,Ne=St.createDocumentFragment,qt=St.getElementsByTagName,ee=a.importNode,S=Dr();e.isSupported=typeof Pr=="function"&&typeof at=="function"&&zt&&zt.createHTMLDocument!==void 0;let Fe=la,le=ha,Ht=pa,he=ua,Ue=ma,Oe=fa,pe=ga,Wt=ya,ue=Mr,T=null,Bt=z({},[...xr,...ao,...so,...io,...kr]),E=null,jt=z({},[...Rr,...co,...Cr,...vn]),V=Object.seal(Le(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),vt=null,ne=null,nt=Object.seal(Le(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}})),me=!0,ft=!0,oe=!1,fe=!0,ot=!1,f=!0,p=!1,m=!1,y=null,q=null,G=!1,W=!1,lt=!1,yt=!1,Gt=!0,He=!1,Be="user-content-",ge=!0,be=!1,Et={},At=null,Ge=z({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","selectedcontent","style","svg","template","thead","title","video","xmp"]),qe=null,We=z({},["audio","video","img","source","image","track"]),je=null,Ve=z({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),Vt="http://www.w3.org/1998/Math/MathML",Yt="http://www.w3.org/2000/svg",K="http://www.w3.org/1999/xhtml",_t=K,ye=!1,we=null,En=z({},[Vt,Yt,K],ro),Ye=dt(["mi","mo","mn","ms","mtext"]),Te=z({},Ye),$e=dt(["annotation-xml"]),Se=z({},$e),An=z({},["title","style","font","a","script"]),Nt=null,_n=["application/xhtml+xml","text/html"],xn="text/html",x=null,xt=null,kn=r.createElement("form"),Ke=function(t){return t instanceof RegExp||t instanceof Function},ve=function(){let t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(xt&&xt===t)return;(!t||typeof t!="object")&&(t={}),t=It(t),Nt=_n.indexOf(t.PARSER_MEDIA_TYPE)===-1?xn:t.PARSER_MEDIA_TYPE,x=Nt==="application/xhtml+xml"?ro:yn,T=de(t,"ALLOWED_TAGS",Bt,{transform:x}),E=de(t,"ALLOWED_ATTR",jt,{transform:x}),we=de(t,"ALLOWED_NAMESPACES",En,{transform:ro}),je=de(t,"ADD_URI_SAFE_ATTR",Ve,{transform:x,base:Ve}),qe=de(t,"ADD_DATA_URI_TAGS",We,{transform:x,base:We}),At=de(t,"FORBID_CONTENTS",Ge,{transform:x}),vt=de(t,"FORBID_TAGS",It({}),{transform:x}),ne=de(t,"FORBID_ATTR",It({}),{transform:x}),Et=Tt(t,"USE_PROFILES")?t.USE_PROFILES&&typeof t.USE_PROFILES=="object"?It(t.USE_PROFILES):t.USE_PROFILES:!1,me=t.ALLOW_ARIA_ATTR!==!1,ft=t.ALLOW_DATA_ATTR!==!1,oe=t.ALLOW_UNKNOWN_PROTOCOLS||!1,fe=t.ALLOW_SELF_CLOSE_IN_ATTR!==!1,ot=t.SAFE_FOR_TEMPLATES||!1,f=t.SAFE_FOR_XML!==!1,p=t.WHOLE_DOCUMENT||!1,W=t.RETURN_DOM||!1,lt=t.RETURN_DOM_FRAGMENT||!1,yt=t.RETURN_TRUSTED_TYPE||!1,G=t.FORCE_BODY||!1,Gt=t.SANITIZE_DOM!==!1,He=t.SANITIZE_NAMED_PROPS||!1,ge=t.KEEP_CONTENT!==!1,be=t.IN_PLACE||!1,ue=sa(t.ALLOWED_URI_REGEXP)?t.ALLOWED_URI_REGEXP:Mr,_t=typeof t.NAMESPACE=="string"?t.NAMESPACE:K,Te=lo(t,"MATHML_TEXT_INTEGRATION_POINTS",()=>z({},Ye)),Se=lo(t,"HTML_INTEGRATION_POINTS",()=>z({},$e));let o=lo(t,"CUSTOM_ELEMENT_HANDLING",()=>Le(null));if(V=Le(null),Tt(o,"tagNameCheck")&&Ke(o.tagNameCheck)&&(V.tagNameCheck=o.tagNameCheck),Tt(o,"attributeNameCheck")&&Ke(o.attributeNameCheck)&&(V.attributeNameCheck=o.attributeNameCheck),Tt(o,"allowCustomizedBuiltInElements")&&typeof o.allowCustomizedBuiltInElements=="boolean"&&(V.allowCustomizedBuiltInElements=o.allowCustomizedBuiltInElements),it(V),ot&&(ft=!1),lt&&(W=!0),Et&&(T=z({},kr),E=Le(null),Et.html===!0&&(z(T,xr),z(E,Rr)),Et.svg===!0&&(z(T,ao),z(E,co),z(E,vn)),Et.svgFilters===!0&&(z(T,so),z(E,co),z(E,vn)),Et.mathMl===!0&&(z(T,io),z(E,Cr),z(E,vn))),nt.tagCheck=null,nt.attributeCheck=null,Tt(t,"ADD_TAGS")&&(typeof t.ADD_TAGS=="function"?nt.tagCheck=t.ADD_TAGS:ze(t.ADD_TAGS)&&(T===Bt&&(T=It(T)),z(T,t.ADD_TAGS,x))),Tt(t,"ADD_ATTR")&&(typeof t.ADD_ATTR=="function"?nt.attributeCheck=t.ADD_ATTR:ze(t.ADD_ATTR)&&(E===jt&&(E=It(E)),z(E,t.ADD_ATTR,x))),Tt(t,"ADD_FORBID_CONTENTS")&&ze(t.ADD_FORBID_CONTENTS)&&(At===Ge&&(At=It(At)),z(At,t.ADD_FORBID_CONTENTS,x)),ge&&(T["#text"]=!0),p&&z(T,["html","head","body"]),T.table&&(z(T,["tbody"]),delete vt.tbody),t.TRUSTED_TYPES_POLICY){if(typeof t.TRUSTED_TYPES_POLICY.createHTML!="function")throw Ce('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof t.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw Ce('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');let d=P;P=t.TRUSTED_TYPES_POLICY;try{et=pt("")}catch(c){throw P=d,c}}else t.TRUSTED_TYPES_POLICY===null?(P=void 0,et=""):(P===void 0&&(P=ie()),P&&typeof et=="string"&&(et=pt("")));dt&&dt(t),xt=t},Xe=z({},[...ao,...so,...ia]),Ze=z({},[...io,...ca]),Rn=function(t,o,d){return o.namespaceURI===K?t==="svg":o.namespaceURI===Vt?t==="svg"&&(d==="annotation-xml"||Te[d]):!!Xe[t]},Cn=function(t,o,d){return o.namespaceURI===K?t==="math":o.namespaceURI===Yt?t==="math"&&Se[d]:!!Ze[t]},Mn=function(t,o,d){return o.namespaceURI===Yt&&!Se[d]||o.namespaceURI===Vt&&!Te[d]?!1:!Ze[t]&&(An[t]||!Xe[t])},On=function(t){let o=at(t);(!o||!o.tagName)&&(o={namespaceURI:_t,tagName:"template"});let d=yn(t.tagName),c=yn(o.tagName);return we[t.namespaceURI]?t.namespaceURI===Yt?Rn(d,o,c):t.namespaceURI===Vt?Cn(d,o,c):t.namespaceURI===K?Mn(d,o,c):!!(Nt==="application/xhtml+xml"&&we[t.namespaceURI]):!1},ht=function(t){fn(e.removed,{element:t});try{at(t).removeChild(t)}catch(o){if(O(t),!at(t))throw Ce("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place")}},Je=function(t,o,d){try{Y(t,o)}catch(c){try{t.removeAttribute(d)}catch(l){}}},$t=function(t){Kt(t);let o=Z(t);if(o){let c=[];Me(o,l=>{fn(c,l)}),Me(c,l=>{try{O(l)}catch(u){}})}let d=I(t);if(d)for(let c=d.length-1;c>=0;--c){let l=d[c],u=l&&l.name;typeof u=="string"&&Je(t,l,u)}},gt=function(t,o,d){if(!d)try{d=o.getAttributeNode(t)}catch(c){d=null}fn(e.removed,{attribute:d||null,from:o});try{d?Y(o,d):o.removeAttribute(t)}catch(c){try{o.removeAttribute(t)}catch(l){}}if(t==="is")if(W||lt)try{ht(o)}catch(c){}else try{o.setAttribute(t,"")}catch(c){}},In=function(t){let o=I(t);if(o)for(let d=o.length-1;d>=0;--d){let c=o[d],l=c&&c.name;typeof l!="string"||E[x(l)]||Je(t,c,l)}},Kt=function(t){let o=[t];for(;o.length>0;){let d=o.pop();tt(d)===Ot.element&&In(d);let l=Z(d);if(l)for(let u=l.length-1;u>=0;--u)o.push(l[u])}},Qe=function(t,o){return f?t==="patchsrc"?!0:t==="for"&&o!=="label"&&o!=="output":!1},Dn=function(t){if(!f)return;let o=[t];for(;o.length>0;){let d=o.pop(),c=tt(d);if(c===Ot.processingInstruction||c===Ot.comment&&mt(Ir,d.data)){try{O(d)}catch(u){}continue}if(c===Ot.element){let u=d,v=x(bt(d));try{u.hasAttribute&&u.hasAttribute("patchsrc")&&u.removeAttribute("patchsrc"),u.hasAttribute&&u.hasAttribute("for")&&Qe("for",v)&&u.removeAttribute("for")}catch(A){}}let l=Z(d);if(l)for(let u=l.length-1;u>=0;--u)o.push(l[u])}},tn=function(t){let o=null,d=null;if(G)t="<remove></remove>"+t;else{let u=vr(t,/^[\r\n\t ]+/);d=u&&u[0]}Nt==="application/xhtml+xml"&&_t===K&&(t='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+t+"</body></html>");let c=P?pt(t):t;if(_t===K)try{o=new M().parseFromString(c,Nt)}catch(u){}if(!o||!o.documentElement){o=zt.createDocument(_t,"template",null);try{o.documentElement.innerHTML=ye?et:c}catch(u){}}let l=o.body||o.documentElement;return t&&d&&l.insertBefore(r.createTextNode(d),l.childNodes[0]||null),_t===K?qt.call(o,p?"html":"body")[0]:p?o.documentElement:l},en=function(t){let o=D?D(t):t.ownerDocument;return ce.call(o||t,t,b.SHOW_ELEMENT|b.SHOW_COMMENT|b.SHOW_TEXT|b.SHOW_PROCESSING_INSTRUCTION|b.SHOW_CDATA_SECTION,null)},Xt=function(t){return t=gn(t,Fe," "),t=gn(t,le," "),t=gn(t,Ht," "),t},Ee=function(t){var o;t.normalize();let d=D?D(t):t.ownerDocument,c=ce.call(d||t,t,b.SHOW_TEXT|b.SHOW_COMMENT|b.SHOW_CDATA_SECTION|b.SHOW_PROCESSING_INSTRUCTION,null),l=c.nextNode();for(;l;)l.data=Xt(l.data),l=c.nextNode();let u=(o=t.querySelectorAll)===null||o===void 0?void 0:o.call(t,"template");u&&Me(u,v=>{kt(v.content)&&Ee(v.content)})},Zt=function(t){let o=C?C(t):null;return typeof o!="string"||x(o)!=="form"?!1:typeof t.nodeName!="string"||typeof t.textContent!="string"||typeof t.removeChild!="function"||t.attributes!==I(t)||typeof t.removeAttribute!="function"||typeof t.removeAttributeNode!="function"||typeof t.getAttributeNode!="function"||typeof t.setAttribute!="function"||typeof t.namespaceURI!="string"||typeof t.insertBefore!="function"||typeof t.hasChildNodes!="function"||t.nodeType!==w(t)||t.childNodes!==Z(t)},kt=function(t){if(!w||typeof t!="object"||t===null)return!1;try{return w(t)===Ot.documentFragment}catch(o){return!1}},Ft=function(t){if(!w||typeof t!="object"||t===null)return!1;try{return typeof w(t)=="number"}catch(o){return!1}};function X(s,t,o){s.length!==0&&Me(s,d=>{d.call(e,t,o,xt)})}let Pn=function(t,o){return!!(f&&t.hasChildNodes()&&!Ft(t.firstElementChild)&&mt(Or,t.textContent)&&mt(Or,t.innerHTML)||f&&t.namespaceURI===K&&Sa[o]&&(Ft(t.firstElementChild)||typeof t.textContent=="string"&&mt(va[o],t.textContent))||t.nodeType===Ot.processingInstruction||f&&t.nodeType===Ot.comment&&mt(Ir,t.data))},Jt=function(t,o){if(t instanceof RegExp)return mt(t,o);if(t instanceof Function){for(var d=arguments.length,c=new Array(d>2?d-2:0),l=2;l<d;l++)c[l-2]=arguments[l];return!!t(o,...c)}return!1},Ln=function(t,o,d){if(!vt[o]&&an(o)&&Jt(V.tagNameCheck,o))return!1;if(ge&&!At[o]){let c=at(t),l=Z(t);if(l&&c){let u=l.length;for(let v=u-1;v>=0;--v){let A=t===d?F(l[v],!0):l[v];c.insertBefore(A,Lt(t))}}}return ht(t),!0},nn=function(t,o,d,c){return t.length===0?o:o===d||o===c?It(o):o},on=function(t,o){return t===o||at(t)!==null?!1:(be&&Kt(t),!0)},rn=function(t,o){if(X(S.beforeSanitizeElements,t,null),on(t,o))return!0;if(Zt(t))return ht(t),!0;let d=x(bt(t));if(T=nn(S.uponSanitizeElement,T,Bt,y),X(S.uponSanitizeElement,t,{tagName:d,allowedTags:T}),on(t,o))return!0;if(Pn(t,d))return ht(t),!0;if(vt[d]||!(nt.tagCheck instanceof Function&&nt.tagCheck(d))&&!T[d]){let l=Ln(t,d,o);return l===!1&&X(S.afterSanitizeElements,t,null),l}if(tt(t)===Ot.element&&!On(t)||(d==="noscript"||d==="noembed"||d==="noframes")&&mt(wa,t.innerHTML))return ht(t),!0;if(ot&&t.nodeType===Ot.text){let l=Xt(t.textContent);t.textContent!==l&&(fn(e.removed,{element:t.cloneNode()}),t.textContent=l)}return X(S.afterSanitizeElements,t,null),!1},dn=function(t,o,d){if(ne[o]||Qe(o,t)||Gt&&(o==="id"||o==="name")&&(d in r||d in kn))return!1;let c=E[o]||nt.attributeCheck instanceof Function&&nt.attributeCheck(o,t);return ft&&mt(he,o)||me&&mt(Ue,o)?!0:c?je[o]||mt(ue,gn(d,pe,""))||(o==="src"||o==="xlink:href"||o==="href")&&t!=="script"&&Er(d,"data:")===0&&qe[t]||oe&&!mt(Oe,gn(d,pe,""))?!0:!d:an(t)&&Jt(V.tagNameCheck,t)&&Jt(V.attributeNameCheck,o,t)||o==="is"&&V.allowCustomizedBuiltInElements&&Jt(V.tagNameCheck,d)},zn=z({},["annotation-xml","color-profile","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","missing-glyph"]),an=function(t){return!zn[yn(t)]&&mt(Wt,t)},Nn=function(t,o,d,c){if(P&&typeof B=="object"&&typeof B.getAttributeType=="function"&&!d)switch(B.getAttributeType(t,o)){case"TrustedHTML":return pt(c);case"TrustedScriptURL":return se(c)}return c},Fn=function(t,o,d,c){try{return d?t.setAttributeNS(d,o,c):t.setAttribute(o,c),Zt(t)?(ht(t),!1):!0}catch(l){return gt(o,t),!1}},sn=function(t){X(S.beforeSanitizeAttributes,t,null);let o=t.attributes;if(!o||Zt(t))return;E=nn(S.uponSanitizeAttribute,E,jt,q);let d={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:E,forceKeepAttr:void 0},c=o.length,l=x(t.nodeName);for(;c--;){let u=o[c],v=u.name,A=u.namespaceURI,U=u.value,H=x(v),_e=U,N=v==="value"?_e:ea(_e),cn=!1;if(d.attrName=H,d.attrValue=N,d.keepAttr=!0,d.forceKeepAttr=void 0,X(S.uponSanitizeAttribute,t,d),N=d.attrValue,He&&(H==="id"||H==="name")&&Er(N,Be)!==0&&(gt(v,t,u),N=Be+N,cn=!0),f&&mt(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,N)){gt(v,t,u);continue}if(H==="attributename"&&vr(N,"href")){gt(v,t,u);continue}if(!d.forceKeepAttr){if(!d.keepAttr){gt(v,t,u);continue}if(!fe&&mt(Ta,N)){gt(v,t,u);continue}if(ot&&(N=Xt(N)),!dn(l,H,N)){gt(v,t,u);continue}N=Nn(l,H,A,N),N!==_e&&Fn(t,v,A,N)&&cn&&Sr(e.removed)}}X(S.afterSanitizeAttributes,t,null)},Qt=function(t){let o=null,d=en(t);for(X(S.beforeSanitizeShadowDOM,t,null);o=d.nextNode();)if(X(S.uponSanitizeShadowNode,o,null),rn(o,t),sn(o),kt(o.content)&&Qt(o.content),tt(o)===Ot.element){let c=Ut(o);kt(c)&&(Ae(c),Qt(c))}X(S.afterSanitizeShadowDOM,t,null)},Ae=function(t){let o=[{node:t,shadow:null}];for(;o.length>0;){let d=o.pop();if(d.shadow){Qt(d.shadow);continue}let c=d.node,u=tt(c)===Ot.element,v=Z(c);if(v)for(let A=v.length-1;A>=0;--A)o.push({node:v[A],shadow:null});if(u){let A=C?C(c):null;if(typeof A=="string"&&x(A)==="template"){let U=c.content;kt(U)&&o.push({node:U,shadow:null})}}if(u){let A=Ut(c);kt(A)&&o.push({node:null,shadow:A},{node:A,shadow:null})}}};return e.sanitize=function(s){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},o=null,d=null,c=null,l=null;if(ye=!s,ye&&(s="<!-->"),typeof s!="string"&&!Ft(s)&&(s=aa(s),typeof s!="string"))throw Ce("dirty is not a string, aborting");if(!e.isSupported)return s;m?(T=y,E=q):ve(t),(S.uponSanitizeElement.length>0||S.uponSanitizeAttribute.length>0)&&(T=It(T)),S.uponSanitizeAttribute.length>0&&(E=It(E)),e.removed=[];let u=be&&typeof s!="string"&&Ft(s);if(u){Dn(s);let U=bt(s);if(typeof U=="string"){let H=x(U);if(!T[H]||vt[H])throw $t(s),Ce("root node is forbidden and cannot be sanitized in-place")}if(Zt(s))throw $t(s),Ce("root node is clobbered and cannot be sanitized in-place");try{Ae(s)}catch(H){throw $t(s),H}}else if(Ft(s))o=tn("<!---->"),d=o.ownerDocument.importNode(s,!0),d.nodeType===Ot.element&&d.nodeName==="BODY"||d.nodeName==="HTML"?o=d:o.appendChild(d),Ae(o);else{if(!W&&!ot&&!p&&s.indexOf("<")===-1)return P&&yt?pt(s):s;if(o=tn(s),!o)return W?null:yt?et:""}o&&G&&ht(o.firstChild);let v=u?s:o;try{let U=en(v);for(;c=U.nextNode();)rn(c,v),sn(c),kt(c.content)&&Qt(c.content)}catch(U){throw u&&($t(s),Me(e.removed,H=>{H.element&&Kt(H.element)})),U}if(u)return Me(e.removed,U=>{U.element&&Kt(U.element)}),ot&&Ee(s),s;if(W){if(ot&&Ee(o),lt)for(l=Ne.call(o.ownerDocument);o.firstChild;)l.appendChild(o.firstChild);else l=o;return(E.shadowroot||E.shadowrootmode)&&(l=ee.call(a,l,!0)),l}let A=p?o.outerHTML:o.innerHTML;return p&&T["!doctype"]&&o.ownerDocument&&o.ownerDocument.doctype&&o.ownerDocument.doctype.name&&mt(ba,o.ownerDocument.doctype.name)&&(A="<!DOCTYPE "+o.ownerDocument.doctype.name+`>
`+A),ot&&(A=Xt(A)),P&&yt?pt(A):A},e.setConfig=function(){let s=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};ve(s),m=!0,y=T,q=E},e.clearConfig=function(){xt=null,m=!1,y=null,q=null,P=j,et=""},e.isValidAttribute=function(s,t,o){xt||ve({});let d=x(s),c=x(t);return dn(d,c,o)},e.addHook=function(s,t){typeof t=="function"&&Tt(S,s)&&fn(S[s],t)},e.removeHook=function(s,t){if(Tt(S,s)){if(t!==void 0){let o=Qd(S[s],t);return o===-1?void 0:ta(S[s],o,1)[0]}return Sr(S[s])}},e.removeHooks=function(s){Tt(S,s)&&(S[s]=[])},e.removeAllHooks=function(){S=Dr()},e}var Hs=Nr();export{_a as a,xa as b,Ca as c,Ma as d,Oa as e,Ia as f,wo as g,Da as h,So as i,Fa as j,vo as k,Sn as l,Vo as m,qo as n,br as o,Ls as p,zs as q,Ns as r,gr as s,Re as t,Hs as u,Wd as v};
/*! Bundled license information:

dompurify/dist/purify.cjs.js:
dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.15 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.15/LICENSE *)

split.js/dist/split.js:
  (*! Split.js - v1.6.5 *)
*/
//# sourceMappingURL=chunk-VQIAJRI6.js.map
