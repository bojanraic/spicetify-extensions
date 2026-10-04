(function(){'use strict';function q(){return typeof Spicetify<"u"?Spicetify.Platform:void 0}function xe(){return typeof Spicetify<"u"&&!!Spicetify.React&&!!Spicetify.ReactJSX&&!!Spicetify.ReactDOM}async function ie(e={}){let{api:t="FeedbackAPI",timeoutMs:o=15e3,intervalMs:i=100,react:p=false}=e,y=Date.now()+o,l=()=>!!q()?.[t]&&document.readyState==="complete"&&(!p||xe());for(;!l();){if(Date.now()>y)throw new Error(`Spicetify not ready (Platform.${t}${p?" + React":""})`);await new Promise(c=>setTimeout(c,i));}}function se(e,t){let o=document.getElementById(e);return o||(o=document.createElement("style"),o.id=e,document.head.appendChild(o)),o.textContent!==t&&(o.textContent=t),o}var n=Spicetify.React,R=Spicetify.ReactDOM,u=Spicetify.Player,Pe=3e3,A=500,g="focus-mode-active",k="focus-mode-controls-visible",N="focus-mode-",C=`${N}album-art`,$=`${N}player-controls`,b=`${N}track-info`,j=`${N}react-root`,Le="Focus Mode",de="focus-mode-styles",Te="e-9800-button__icon-wrapper",Ie="e-9800-icon e-9800-baseline",Ae={background:"rgba(255, 255, 255, 0.1)",color:"white",border:"none",borderRadius:"50%",padding:"8px",minWidth:"32px",minHeight:"32px",width:"32px",height:"32px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"},Y={APP_CONTENT:"body .Root__top-bar, body .Root__nav-bar, body .Root__main-view, body .Root__now-playing-bar, body .Root__right-sidebar",EXTRA_ELEMENTS:".main-nowPlayingView-section, .main-trackInfo-container, .main-trackList-trackList"},f=false,E=null,M=null,S=false,w=null,m=null,d=null,G=false,_=false,F=false,x=null,B=null,V=null,z=null,X=null;function Ce(e){return !e||!e.startsWith("spotify:image:")?null:`https://i.scdn.co/image/${e.substring(14)}`}function $e(){return `
    body.${g} ${Y.APP_CONTENT} {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition: opacity ${A}ms ease, visibility ${A}ms ease;
    }
    body.${g} ${Y.EXTRA_ELEMENTS} { display: none !important; }
    body.${g} { overflow: hidden !important; }

    #${j} {
      display: none;
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9998; background-color: #000; pointer-events: none; cursor: none;
    }
    body.${g} #${j} { display: block; pointer-events: auto; }

    #${C} {
      display: block; position: absolute; top: 0; left: 0;
      width: 100%; height: 100%; object-fit: contain; margin: 0; padding: 0; border: none;
    }

    #${$} {
      position: absolute; bottom: 0; left: 0; width: 100%; z-index: 10000;
      background: rgba(0, 0, 0, 0.7); padding: 16px 0; pointer-events: auto; opacity: 0;
      transition: opacity ${A}ms ease !important;
      display: flex; justify-content: center; cursor: auto !important;
    }
    body.${g}.${k} #${$} { opacity: 1 !important; }

    #${b} {
      position: absolute; top: 0; left: 0; width: 100%; text-align: center; z-index: 10000;
      pointer-events: none; opacity: 0; transition: opacity ${A}ms ease !important;
      background: rgba(0, 0, 0, 0.7); padding: 16px; color: white; cursor: none;
    }
    body.${g}.${k} #${b} { opacity: 1 !important; cursor: auto !important; }
    #${b} .track-title { font-size: 1.2em; font-weight: bold; }
    #${b} .track-artist { font-size: 1em; opacity: 0.8; }
    #${b} .track-album { font-size: 0.9em; opacity: 0.7; font-style: italic; }

    #fad-lyrics-plus-container.lyrics-overlay-container {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999;
      background: rgba(0, 0, 0, 0.7); overflow-y: auto; pointer-events: none; opacity: 0;
      transition: opacity ${A}ms ease;
    }
    #fad-lyrics-plus-container.lyrics-overlay-container > * { pointer-events: auto; }
    body.focus-mode-lyrics-active #fad-lyrics-plus-container.lyrics-overlay-container { opacity: 1; }
    #${b} { z-index: 10000; }
    #${$} { z-index: 10000; }
    body.focus-mode-lyrics-active #fad-lyrics-plus-container .lyrics-config-button-container { display: none !important; }

    #focus-mode-progress-bar {
      -webkit-appearance: none; appearance: none; flex-grow: 1; height: 4px; border-radius: 2px;
      cursor: pointer; outline: none;
      background: linear-gradient(to right, #fff var(--progress-percent, 0%), rgba(255,255,255,0.3) var(--progress-percent, 0%));
    }
    #focus-mode-progress-bar::-webkit-slider-thumb,
    .focus-mode-volume-slider::-webkit-slider-thumb,
    .focus-mode-dim-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 12px; height: 12px; background: #fff; border-radius: 50%; cursor: pointer;
    }
    #focus-mode-progress-bar::-moz-range-thumb,
    .focus-mode-volume-slider::-moz-range-thumb,
    .focus-mode-dim-slider::-moz-range-thumb {
      width: 12px; height: 12px; background: #fff; border-radius: 50%; border: none; cursor: pointer;
    }
    .focus-mode-volume-slider {
      -webkit-appearance: none; appearance: none; flex-grow: 1; height: 4px; border-radius: 2px; cursor: pointer; outline: none;
      background: linear-gradient(to right, #fff var(--volume-percent, 0%), rgba(255,255,255,0.3) var(--volume-percent, 0%));
    }
    .focus-mode-dim-slider {
      -webkit-appearance: none; appearance: none; flex-grow: 1; height: 4px; border-radius: 2px; cursor: pointer; outline: none;
      background: linear-gradient(to right, #fff var(--dim-percent, 25%), rgba(255,255,255,0.3) var(--dim-percent, 25%));
    }
  `}function h(e){if(isNaN(e)||e<0)return "0:00";let t=Math.floor(e/1e3),o=Math.floor(t/60),i=t%60;return `${o}:${i<10?"0":""}${i}`}async function Re(){try{if(!Spicetify.Player.data?.item?.uri)return !1;if(u.getLyrics)try{let o=await u.getLyrics();if(o?.lines&&o.lines.length>0)return !0}catch{}let t=E;if(t?.has_lyrics==="true"||t?.lyrics==="true"||t?.lyrics_id)return !0}catch{return  false}return  false}function me(){let e=Spicetify.Player.data?.item;if(!e){E=null,M=null,_=false;return}let t=e.metadata;if(!t){E={uri:e.uri},M=null,_=false;return}E=t,M=t.image_xlarge_url||t.image_large_url||t.image_url||null,Re().then(o=>{_=o,P();}).catch(()=>{_=false,P();});}function P(){if(!(!f||!d||!n||!R||!X))try{R.render(n.createElement(X,{trackData:E,albumArtUrl:M,controlsVisible:S}),d);}catch{Spicetify.showNotification?.("Error rendering Focus Mode UI. Check console.",true);}}function Ne(){if(d&&R)try{R.unmountComponentAtNode(d);}catch{}}function W(){f&&(S||(S=true,document.body.classList.add(k)),w&&clearTimeout(w),w=setTimeout(()=>{S=false,document.body.classList.remove(k),w=null;},Pe));}function le(e){let t=document.getElementById(C);if(!t)return;let o=parseFloat(t.style.opacity||"0.25"),i=Math.max(0,Math.min(1,o+e));t.style.opacity=String(i),z?.(i);}function fe(e){if(f)switch(e.key.toLowerCase()){case "escape":H();break;case " ":Spicetify.Player.togglePlay(),e.preventDefault();break;case "arrowleft":Spicetify.Player.back(),e.preventDefault();break;case "arrowright":Spicetify.Player.next(),e.preventDefault();break;case "arrowup":{let t=Math.min(1,Spicetify.Player.getVolume()+.05);Spicetify.Player.setVolume(t),B?.(t),V?.(t),e.preventDefault();break}case "arrowdown":{let t=Math.max(0,Spicetify.Player.getVolume()-.05);Spicetify.Player.setVolume(t),B?.(t),V?.(t),e.preventDefault();break}case "+":case "=":le(.05),e.preventDefault();break;case "-":le(-0.05),e.preventDefault();break;case "l":Oe(),e.preventDefault();break;}}function pe(e){let t=e.target;f&&!t?.closest(`#${$}`)&&!t?.closest(`#${b}`)&&m&&!m.element.contains(t)&&H();}function ce(){setTimeout(()=>{me(),f&&P();},100);}function ue(e){}async function Oe(){if(!_){Spicetify.showNotification?.("Lyrics not available for this track.");return}F=!F,F?(x=Spicetify.Platform.History.location.pathname,x!=="/lyrics-plus"&&Spicetify.Platform.History.push("/lyrics-plus"),setTimeout(()=>{window.addEventListener("lyrics-plus-update",ue),window.dispatchEvent(new Event("fad-request")),document.body.classList.add("focus-mode-lyrics-active"),P();},200)):(window.removeEventListener("lyrics-plus-update",ue),x&&x!=="/lyrics-plus"&&Spicetify.Platform.History.push(x),x=null,document.body.classList.remove("focus-mode-lyrics-active"),P());}async function De(){if(!f){if(G=!!document.fullscreenElement,!G&&document.documentElement.requestFullscreen)try{await document.documentElement.requestFullscreen();}catch{}se(de,$e()),f=true,m&&(m.active=true),document.body.classList.add(g),me(),d||(d=document.createElement("div"),d.id=j,document.body.appendChild(d)),S=false,document.body.classList.remove(k),P(),document.addEventListener("mousemove",W),document.addEventListener("keydown",fe),document.addEventListener("click",pe),W();}}function H(){if(!f){S=false,m&&(m.active=false);return}if(!G&&document.fullscreenElement&&document.exitFullscreen)try{document.exitFullscreen();}catch{}document.removeEventListener("mousemove",W),document.removeEventListener("keydown",fe),document.removeEventListener("click",pe),w&&(clearTimeout(w),w=null),Ne(),document.body.classList.remove(g),document.body.classList.remove(k),document.querySelectorAll(Y.APP_CONTENT).forEach(e=>{e.style.opacity="1",e.style.visibility="visible",e.style.pointerEvents="auto",e.style.display="";}),f=false,S=false,m&&(m.active=false),d&&(d.remove(),d=null),document.getElementById(de)?.remove(),E=null,M=null;}function Fe(){if(!Spicetify?.Playbar?.Button)return;let t=`
    <span class="${Te}" aria-hidden="true">
      <svg role="img" height="16" width="16" aria-hidden="true" viewBox="0 0 128 128" fill="currentColor" class="${Ie}">
        
    <rect x="32" y="32" width="64" height="64" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M32 48 L32 32 L48 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M96 48 L96 32 L80 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 80 L32 96 L48 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M96 80 L96 96 L80 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="64" cy="64" r="12" fill="currentColor"/>
  
      </svg>
    </span>
  `;m=new Spicetify.Playbar.Button(Le,t,()=>{f?H():De();},false);try{m.register();}catch{}}var Be=e=>new Promise(t=>setTimeout(t,e));async function Ve(){for(await ie({api:"FeedbackAPI",react:true});!(Spicetify.Playbar?.Button&&Spicetify.Player?.addEventListener);)await Be(100);n=Spicetify.React,R=Spicetify.ReactDOM;let e=Spicetify.SVGIcons,t=i=>{let{icon:p,onClick:y,className:l="",style:c={}}=i,v=e[p];return v?n.createElement("button",{className:`focus-mode-control-button ${l}`,onClick:y,style:{...Ae,...c}},n.createElement("svg",{width:16,height:16,viewBox:"0 0 16 16",fill:"currentColor",dangerouslySetInnerHTML:{__html:v}})):null},o=()=>{let[i,p]=n.useState(Spicetify.Player.isPlaying()),[,y]=n.useState(Spicetify.Player.getVolume()),[l,c]=n.useState(Spicetify.Player.getVolume()),[v,J]=n.useState(.25),[U,O]=n.useState(0),[L,K]=n.useState(Spicetify.Player.data?.item?.duration?.milliseconds||Spicetify.Player.getDuration()||0),[ye,D]=n.useState("0:00"),[ge,Q]=n.useState(h(L)),[be,ve]=n.useState(false),Z=n.useRef(null),ee=n.useRef(null),te=(r,a,s)=>{r&&r.style.setProperty(a,`${s*100}%`);};n.useEffect(()=>te(Z.current,"--volume-percent",l),[l]),n.useEffect(()=>te(ee.current,"--dim-percent",v),[v]),n.useEffect(()=>(B=y,V=c,z=J,()=>{B=null,V=null,z=null;}),[]),n.useEffect(()=>{let r=s=>{let T=typeof s?.data=="number"?s.data:0;y(T),c(T);};u.addEventListener("onvolumechange",r);let a=Spicetify.Player.getVolume();return y(a),c(a),()=>u.removeEventListener("onvolumechange",r)},[]),n.useEffect(()=>{let r=()=>p(Spicetify.Player.isPlaying());return u.addEventListener("onplaypause",r),r(),()=>u.removeEventListener("onplaypause",r)},[]),n.useEffect(()=>{let r=I=>{let oe=typeof I?.data=="number"?I.data:0,re=L||Spicetify.Player.getDuration();re>0&&(O(Math.min(1,Math.max(0,oe/re))),D(h(oe)));},a=()=>{setTimeout(()=>{let I=Spicetify.Player.data?.item?.duration?.milliseconds||Spicetify.Player.getDuration()||0;K(I),Q(h(I)),O(0),D("0:00");},100);},s=Spicetify.Player.data?.item?.duration?.milliseconds||Spicetify.Player.getDuration()||0;K(s),Q(h(s));let T=Spicetify.Player.getProgress();return s>0&&(O(Math.min(1,Math.max(0,T/s))),D(h(T))),u.addEventListener("onprogress",r),u.addEventListener("songchange",a),()=>{u.removeEventListener("onprogress",r),u.removeEventListener("songchange",a);}},[]),n.useEffect(()=>{let r=document.getElementById(C);r&&(r.style.opacity=String(v));},[]);let he=r=>{let a=parseFloat(r.target.value);c(a),Spicetify.Player.setVolume(a);},we=r=>{let a=parseFloat(r.target.value);J(a);let s=document.getElementById(C);s&&(s.style.opacity=String(a));},Ee=r=>{let a=parseFloat(r.target.value);O(a);let s=a*L;D(h(s)),isFinite(s)&&Spicetify.Player.seek(s);},Se=()=>ve(r=>!r),ne=ge;if(be){let r=Math.max(0,L-U*L);ne="-"+h(r);}return n.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",gap:"10px"}},n.createElement("div",{style:{display:"flex",alignItems:"center",width:"80%",maxWidth:"500px",gap:"8px"}},n.createElement("span",{id:"focus-mode-current-time",style:{fontSize:"0.8em",minWidth:"35px",textAlign:"right"}},ye),n.createElement("input",{type:"range",min:0,max:1,step:.001,value:U,onChange:Ee,id:"focus-mode-progress-bar",style:{flexGrow:1,cursor:"pointer",height:"4px","--progress-percent":`${U*100}%`}}),n.createElement("span",{id:"focus-mode-duration",style:{fontSize:"0.8em",minWidth:"35px",textAlign:"left",cursor:"pointer",userSelect:"none"},onClick:Se},ne)),n.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",gap:"15px",width:"100%",padding:"0 20px"}},n.createElement("div",{style:{display:"flex",alignItems:"center",gap:"5px",flexBasis:"150px"}},n.createElement("svg",{width:16,height:16,viewBox:"0 0 16 16",fill:"currentColor",dangerouslySetInnerHTML:{__html:e.brightness||e.search}}),n.createElement("input",{type:"range",min:0,max:1,step:.01,value:v,onChange:we,ref:ee,style:{flexGrow:1,cursor:"pointer"},className:"focus-mode-dim-slider"})),n.createElement(t,{icon:"skip-back",onClick:Spicetify.Player.back}),n.createElement(t,{icon:i?"pause":"play",onClick:Spicetify.Player.togglePlay,style:{transform:"scale(1.1)"}}),n.createElement(t,{icon:"skip-forward",onClick:Spicetify.Player.next}),n.createElement("div",{style:{display:"flex",alignItems:"center",gap:"5px",flexBasis:"150px"}},n.createElement("svg",{width:16,height:16,viewBox:"0 0 16 16",fill:"currentColor",dangerouslySetInnerHTML:{__html:l>.5?e.volume:l>0?e["volume-low"]:e["volume-off"]}}),n.createElement("input",{type:"range",min:0,max:1,step:.01,value:l,onChange:he,ref:Z,className:"focus-mode-volume-slider"}))))};X=i=>{let p=Ce(i.albumArtUrl),y=i.trackData?.title||"Loading...",l=i.trackData?.artist_name||"",c=i.trackData?.album_title||"";return n.createElement("div",{id:N+"content"},p&&n.createElement("img",{id:C,src:p,alt:"Album Art"}),n.createElement("div",{id:"fad-lyrics-plus-container",className:"lyrics-overlay-container"}),n.createElement("div",{id:b},n.createElement("div",{className:"track-title"},y),n.createElement("div",{className:"track-artist"},l),c&&n.createElement("div",{className:"track-album"},c)),n.createElement("div",{id:$},n.createElement(o,null)))},H(),E=null,M=null,_=false,F=false,Fe(),u.addEventListener("songchange",ce),setTimeout(ce,500);}Ve();})();