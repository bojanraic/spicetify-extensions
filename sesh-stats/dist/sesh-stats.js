(function(){'use strict';function E(){return typeof Spicetify<"u"?Spicetify.Platform:void 0}function ee(){return typeof Spicetify<"u"&&!!Spicetify.React&&!!Spicetify.ReactJSX&&!!Spicetify.ReactDOM}async function I(e={}){let{api:n="FeedbackAPI",timeoutMs:t=15e3,intervalMs:s=100,react:i=false}=e,r=Date.now()+t,o=()=>!!E()?.[n]&&document.readyState==="complete"&&(!i||ee());for(;!o();){if(Date.now()>r)throw new Error(`Spicetify not ready (Platform.${n}${i?" + React":""})`);await new Promise(c=>setTimeout(c,s));}}function C(e,n){let t=n!==null&&typeof n=="object"&&!Array.isArray(n),s=()=>typeof structuredClone=="function"?structuredClone(n):JSON.parse(JSON.stringify(n));return {load(){try{let i=localStorage.getItem(e);if(i==null)return s();let r=JSON.parse(i);return t?{...n,...r}:r}catch{return s()}},save(i){localStorage.setItem(e,JSON.stringify(i));}}}function N(e,n){let t=document.getElementById(e);return t||(t=document.createElement("style"),t.id=e,document.head.appendChild(t)),t.textContent!==n&&(t.textContent=n),t}var re=3e4,oe=[10,25,50],B=()=>Spicetify.Player.data,q=Date.now(),H=0,d=false,w=0,A=0,j=new Set,z=0,F=0,g=null,b=null,$=false,Y=C("sesh-stats-history",{}),u={},D=0,a,h=false,v=false,P="7d",y=10;function ie(){u=Y.load();}function G(){Y.save(u);}function X(){return new Date().toISOString().slice(0,10)}function J(){let e=X();return u[e]||(u[e]={playbackMs:0,tracks:{},artists:{},albums:{}}),e}function L(){let e=U(),n=e-D;if(n<=0)return;let t=J();u[t].playbackMs+=n,D=e,G();}function ae(e){let n=u[J()];if(n.tracks[e.uri]||(n.tracks[e.uri]={name:e.name,artist:e.artist,album:e.album,imageUrl:e.imageUrl,count:0,ms:0}),e.imageUrl&&!n.tracks[e.uri].imageUrl&&(n.tracks[e.uri].imageUrl=e.imageUrl),n.tracks[e.uri].count++,n.tracks[e.uri].ms+=e.durationMs||0,e.artist){let t=e.artistUri||e.artist;n.artists[t]||(n.artists[t]={name:e.artist,uri:e.artistUri,imageUrl:e.imageUrl,count:0,ms:0}),e.imageUrl&&!n.artists[t].imageUrl&&(n.artists[t].imageUrl=e.imageUrl),n.artists[t].count++,n.artists[t].ms+=e.durationMs||0;}if(e.album){let t=e.albumUri||e.album;n.albums[t]||(n.albums[t]={name:e.album,uri:e.albumUri,artist:e.artist,imageUrl:e.imageUrl,count:0,ms:0}),e.imageUrl&&!n.albums[t].imageUrl&&(n.albums[t].imageUrl=e.imageUrl),n.albums[t].count++,n.albums[t].ms+=e.durationMs||0;}G();}function le(e){let n=new Date,t=new Date;if(e==="7d")t.setDate(n.getDate()-7);else if(e==="30d")t.setDate(n.getDate()-30);else if(e==="90d")t.setDate(n.getDate()-90);else return null;return t.toISOString().slice(0,10)}function ce(e){let n=le(e),t={playbackMs:0,tracks:{},artists:{},albums:{},dayCount:0};for(let[s,i]of Object.entries(u))if(!(n&&s<n)){t.playbackMs+=i.playbackMs||0,t.dayCount++;for(let[r,o]of Object.entries(i.tracks||{}))t.tracks[r]||(t.tracks[r]={name:o.name,artist:o.artist,album:o.album,imageUrl:o.imageUrl,count:0,ms:0}),o.imageUrl&&!t.tracks[r].imageUrl&&(t.tracks[r].imageUrl=o.imageUrl),t.tracks[r].count+=o.count,t.tracks[r].ms+=o.ms;for(let[r,o]of Object.entries(i.artists||{}))t.artists[r]||(t.artists[r]={name:o.name||r,uri:o.uri,imageUrl:o.imageUrl,count:0,ms:0}),o.imageUrl&&!t.artists[r].imageUrl&&(t.artists[r].imageUrl=o.imageUrl),t.artists[r].count+=o.count,t.artists[r].ms+=o.ms;for(let[r,o]of Object.entries(i.albums||{})){let c=o.name&&!o.name.startsWith("spotify:")?o.name:null;t.albums[r]||(t.albums[r]={name:c||o.name||r,uri:o.uri||(r.startsWith("spotify:")?r:null),artist:o.artist,imageUrl:o.imageUrl,count:0,ms:0}),(!t.albums[r].name||t.albums[r].name.startsWith("spotify:"))&&c&&(t.albums[r].name=c),o.imageUrl&&!t.albums[r].imageUrl&&(t.albums[r].imageUrl=o.imageUrl),t.albums[r].count+=o.count,t.albums[r].ms+=o.ms;}}return t}function T(e,n){return Object.entries(e).sort((t,s)=>s[1].count-t[1].count).slice(0,n)}function ue(){let e=new Blob([JSON.stringify(u,null,2)],{type:"application/json"}),n=URL.createObjectURL(e),t=document.createElement("a");t.href=n,t.download=`sesh-stats-${X()}.json`,t.click(),URL.revokeObjectURL(n);}function _(){let e=B();return e?.track?.uri?e.track.uri:e?.item?.uri?e.item.uri:Spicetify.Platform?.PlayerAPI?.getState?.()?.item?.uri||null}function V(){let e=B(),n=e?.track||e?.item,t=_();if(!t)return null;let s=n?.metadata||{};return {uri:t,name:s.title||n?.name||"Unknown",artist:s.artist_name||n?.artists?.[0]?.name||"Unknown",artistUri:s.artist_uri||n?.artists?.[0]?.uri||null,album:s.album_title||n?.album?.name||"Unknown",albumUri:s.album_uri||n?.album?.uri||null,imageUrl:s.image_url||s.image_large_url||s.image_xlarge_url||null,durationMs:parseInt(s.duration??"",10)||n?.duration?.milliseconds||0}}function de(){d||(d=true,w=Date.now(),b===null&&(b=Date.now()));}function pe(){d&&(d=false,H+=Date.now()-w,W());}function W(){if(!($||!g||b===null)&&Date.now()-b>=re){let e=V();e&&(ae(e),$=true,j.add(g));}}function me(){A++,z=A;let e=_();e&&(g&&g!==e&&F++,g=e,b=Date.now(),$=false,h&&p());}function ge(){W(),h&&fe();}function fe(){let e=a.querySelector("#sesh-playback-time"),n=a.querySelector("#sesh-session-duration");e&&(e.textContent=k(U())),n&&(n.textContent=k(Date.now()-q));}function k(e){let n=Math.floor(e/1e3%60),t=Math.floor(e/6e4%60);return `${Math.floor(e/36e5).toString().padStart(2,"0")}:${t.toString().padStart(2,"0")}:${n.toString().padStart(2,"0")}`}function be(e){let n=Math.floor(e/36e5),t=Math.floor(e%36e5/6e4);return n>0?`${n}h ${t}m`:`${t}m`}function U(){let e=H;try{d&&Spicetify.Player.isPlaying()&&(e+=Date.now()-w);}catch{}return e}function l(e){return (e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function he(){N("sesh-stats-styles",Le);}function K(){if(document.readyState!=="complete"){setTimeout(K,300);return}let e=()=>{let n=document.querySelector(".main-nowPlayingBar-extraControls");if(!n){setTimeout(e,300);return}let t=document.createElement("div");t.id="sesh-stats-container",t.style.cssText="display:inline-flex;align-items:center;";let s=document.createElement("button");s.className="sesh-stats-button Button-sc-1dqy6lx-0 Button-buttonTertiary-small-iconOnly-useBrowserDefaultFocusStyle",s.setAttribute("aria-label","Session Stats"),s.title="Session Stats",s.onclick=Te,s.innerHTML=`
      <span class="sesh-eq${d?"":" paused"}" id="sesh-eq-icon">
        <span></span><span></span><span></span><span></span>
      </span>`,setInterval(()=>{let i=s.querySelector("#sesh-eq-icon");i&&i.classList.toggle("paused",!d);},500),t.appendChild(s),n.insertBefore(t,n.firstChild);};e();}function ye(){let e=document.createElement("div");e.id="sesh-stats-backdrop",document.body.appendChild(e),e.addEventListener("click",f),a=document.createElement("div"),a.id="sesh-stats-overlay",p(),document.body.appendChild(a),document.addEventListener("keydown",n=>{n.key==="Escape"&&h&&f();});}function p(){if(!a)return;a.innerHTML=ve(),a.querySelector("#sesh-hero-close")?.addEventListener("click",f),a.querySelectorAll(".sesh-hero-link").forEach(t=>{t.addEventListener("click",s=>{s.stopPropagation(),R(t.dataset.uri),f();});}),a.querySelector("#sesh-history-toggle")?.addEventListener("click",t=>{t.stopPropagation(),v=!v,p();}),a.querySelector("#sesh-range")?.addEventListener("change",t=>{t.stopPropagation(),P=t.target.value,p();}),a.querySelector("#sesh-topn")?.addEventListener("change",t=>{t.stopPropagation(),y=parseInt(t.target.value,10),p();}),a.querySelector("#sesh-export")?.addEventListener("click",t=>{t.stopPropagation(),ue();}),M(),a.querySelectorAll(".sesh-link").forEach(t=>{t.addEventListener("click",s=>{s.stopPropagation(),R(t.dataset.uri),f();});});}function M(){let e=a.querySelector("#sesh-clear");e&&e.addEventListener("click",n=>{n.stopPropagation();let t=a.querySelector("#sesh-clear-wrap");t&&(t.innerHTML=`
      <span class="sesh-clear-confirm">
        <span style="color:var(--spice-subtext)">Clear all history?</span>
        <button class="sesh-clear-yes">Yes, clear</button>
        <button class="sesh-clear-no">Cancel</button>
      </span>`,t.querySelector(".sesh-clear-yes")?.addEventListener("click",s=>{s.stopPropagation(),Q(),p();}),t.querySelector(".sesh-clear-no")?.addEventListener("click",s=>{s.stopPropagation(),t.innerHTML='<button id="sesh-clear" class="sesh-btn-clear">Clear Stats</button>',M();}),setTimeout(()=>{t.querySelector(".sesh-clear-confirm")&&(t.innerHTML='<button id="sesh-clear" class="sesh-btn-clear">Clear Stats</button>',M());},5e3));});}function ve(){let e=V(),n=e?.imageUrl||"",t=e?l(e.name):"Nothing playing",s=e?l(e.artist):"";return `
    <div id="sesh-hero">
      <div id="sesh-hero-bg" style="background-image:url('${l(n)}')"></div>
      ${n?`<img id="sesh-hero-art" src="${l(n)}" alt="" ${e?.uri?`class="sesh-hero-link" data-uri="${e.uri}"`:""}>`:'<div id="sesh-hero-art"></div>'}
      <div id="sesh-hero-info">
        <div id="sesh-hero-label">Now Playing</div>
        <div id="sesh-hero-track" ${e?.uri?`class="sesh-hero-link" data-uri="${e.uri}"`:""}>${t}</div>
        <div id="sesh-hero-artist" ${e?.artistUri?`class="sesh-hero-link" data-uri="${e.artistUri}"`:""}>${s}</div>
      </div>
      <button id="sesh-hero-close" aria-label="Close">\xD7</button>
    </div>
    <div id="sesh-body">
      <div class="sesh-section-label">This Session</div>
      ${xe()}
      <button id="sesh-history-toggle" class="sesh-history-toggle" aria-expanded="${v}">
        <span class="sesh-chevron">${v?"\u25BE":"\u25B8"}</span> History
      </button>
      ${v?ke():""}
    </div>
  `}function xe(){let e=U(),n=Date.now()-q;return `
    <div class="sesh-summary">
      <div class="sesh-summary-card"><span class="val" id="sesh-playback-time">${k(e)}</span><span class="lbl">Playback Time</span></div>
      <div class="sesh-summary-card"><span class="val" id="sesh-session-duration">${k(n)}</span><span class="lbl">Session Duration</span></div>
      <div class="sesh-summary-card"><span class="val">${z}</span><span class="lbl">Tracks Started</span></div>
      <div class="sesh-summary-card"><span class="val">${F}</span><span class="lbl">Tracks Finished/Skipped</span></div>
      <div class="sesh-summary-card"><span class="val">${j.size}</span><span class="lbl">Unique Tracks (30s+)</span></div>
    </div>
  `}function ke(){let e=ce(P),n=T(e.tracks,y),t=T(e.artists,y),s=T(e.albums,y),i=e.dayCount>0,r=[["7d","Last 7 days"],["30d","Last 30 days"],["90d","Last 90 days"],["all","All time"]].map(([m,Z])=>`<option value="${m}" ${P===m?"selected":""}>${Z}</option>`).join(""),o=oe.map(m=>`<option value="${m}" ${y===m?"selected":""}>${m}</option>`).join(""),c=i?`
    <div class="sesh-summary">
      <div class="sesh-summary-card"><span class="val">${be(e.playbackMs)}</span><span class="lbl">Playback Time</span></div>
      <div class="sesh-summary-card"><span class="val">${e.dayCount}</span><span class="lbl">Days</span></div>
      <div class="sesh-summary-card"><span class="val">${Object.keys(e.tracks).length}</span><span class="lbl">Unique Tracks</span></div>
      <div class="sesh-summary-card"><span class="val">${Object.keys(e.artists).length}</span><span class="lbl">Artists</span></div>
      <div class="sesh-summary-card"><span class="val">${Object.keys(e.albums).length}</span><span class="lbl">Albums</span></div>
    </div>
  `:'<p class="sesh-empty">No history yet \u2014 stats save after 30s of playback.</p>',S=i?`
    <div class="sesh-top-grid">
      <div class="sesh-top-section"><h4>Top Tracks</h4>${we(n)}</div>
      <div class="sesh-top-section"><h4>Top Artists</h4>${Se(t)}</div>
      <div class="sesh-top-section"><h4>Top Albums</h4>${Ee(s)}</div>
    </div>
  `:"";return `
    <div class="sesh-controls">
      <select id="sesh-range" class="sesh-select">${r}</select>
      <label style="font-size:12px;color:var(--spice-subtext)">Top</label>
      <select id="sesh-topn" class="sesh-select">${o}</select>
      <button id="sesh-export" class="sesh-btn-export">Export JSON</button>
      <div id="sesh-clear-wrap">
        <button id="sesh-clear" class="sesh-btn-clear">Clear Stats</button>
      </div>
    </div>
    ${c}
    ${S}
  `}function R(e){if(!e)return;let n=e.split(":");n.length>=3&&Spicetify.Platform.History.push(`/${n[1]}/${n[2]}`);}function O(e,n){return e?`<img class="sesh-art" src="${l(e)}" style="${n?"border-radius:50%":""}" alt="">`:`<span class="sesh-art-placeholder" style="${n?"border-radius:50%":""}"></span>`}function we(e){return e.length?`<ul class="sesh-top-list">${e.map(([t,s],i)=>`
      <li>
        <span class="rank">${i+1}</span>
        ${O(s.imageUrl,false)}
        <span class="sesh-name-stack">
          <span class="name sesh-link" data-uri="${t}" title="${l(s.name)}">${l(s.name)}</span>
          <span class="sub" title="${l(s.artist)}">${l(s.artist)}</span>
        </span>
        <span class="cnt">${s.count}\xD7</span>
      </li>`).join("")}</ul>`:'<p class="sesh-empty">Nothing yet.</p>'}function Se(e){return e.length?`<ul class="sesh-top-list">${e.map(([t,s],i)=>{let r=s.name||t,o=s.uri?` data-uri="${s.uri}"`:"",c=s.uri?" sesh-link":"";return `
        <li>
          <span class="rank">${i+1}</span>
          ${O(s.imageUrl,true)}
          <span class="sesh-name-stack">
            <span class="name${c}"${o} title="${l(r)}">${l(r)}</span>
          </span>
          <span class="cnt">${s.count}\xD7</span>
        </li>`}).join("")}</ul>`:'<p class="sesh-empty">Nothing yet.</p>'}function Ee(e){return e.length?`<ul class="sesh-top-list">${e.map(([t,s],i)=>{let r=s.name&&!s.name.startsWith("spotify:")?s.name:"Unknown Album",o=s.uri||(t.startsWith("spotify:")?t:null),c=o?` data-uri="${o}"`:"",S=o?" sesh-link":"";return `
        <li>
          <span class="rank">${i+1}</span>
          ${O(s.imageUrl,false)}
          <span class="sesh-name-stack">
            <span class="name${S}"${c} title="${l(r)}">${l(r)}</span>
            <span class="sub" title="${l(s.artist)}">${l(s.artist)}</span>
          </span>
          <span class="cnt">${s.count}\xD7</span>
        </li>`}).join("")}</ul>`:'<p class="sesh-empty">Nothing yet.</p>'}function Te(){h?f():$e();}function $e(){L(),p(),a.classList.add("visible"),document.getElementById("sesh-stats-backdrop")?.classList.add("visible"),h=true;}function f(){a.classList.remove("visible"),document.getElementById("sesh-stats-backdrop")?.classList.remove("visible"),h=false;}function Q(){u={},localStorage.removeItem("sesh-stats-history");}async function Pe(){await I({api:"FeedbackAPI"}),ie(),he(),K(),ye(),Spicetify.Player.addEventListener("onplaypause",()=>{Spicetify.Player.isPlaying()?de():pe();}),Spicetify.Player.addEventListener("songchange",me);let e=_();if(e){g=e,b=Date.now();try{Spicetify.Player.isPlaying()&&(d=!0,w=Date.now());}catch{}}setInterval(ge,1e3),setInterval(L,6e4),window.addEventListener("beforeunload",L),window.seshStatsReset=Q;}var Le=`
      /* \u2500\u2500 Backdrop \u2500\u2500 */
      #sesh-stats-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); z-index: 9998; display: none; animation: seshFadeIn 0.25s ease; }
      #sesh-stats-backdrop.visible { display: block; }
      @keyframes seshFadeIn { from { opacity: 0; } to { opacity: 1; } }

      /* \u2500\u2500 Panel \u2500\u2500 */
      #sesh-stats-overlay { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); width: 80%; height: auto; max-height: 85vh; background: var(--spice-card); border-radius: 16px; color: var(--spice-text); font-size: 13px; z-index: 9999; box-shadow: 0 24px 64px rgba(0,0,0,0.8); display: none; overflow: hidden; box-sizing: border-box; flex-direction: column; }
      #sesh-stats-overlay.visible { display: flex; animation: seshSlideUp 0.25s cubic-bezier(0.16,1,0.3,1); }
      @keyframes seshSlideUp { from { opacity: 0; transform: translateX(-50%) translateY(24px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

      /* \u2500\u2500 Hero (now playing) \u2500\u2500 */
      #sesh-hero { position: relative; display: flex; align-items: center; gap: 20px; padding: 24px 24px 20px; flex-shrink: 0; overflow: hidden; }
      #sesh-hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(40px) brightness(0.35) saturate(1.4); transform: scale(1.2); z-index: 0; }
      #sesh-hero > * { position: relative; z-index: 1; }
      #sesh-hero-art { width: 80px; height: 80px; border-radius: 6px; object-fit: cover; box-shadow: 0 4px 20px rgba(0,0,0,0.5); flex-shrink: 0; background: var(--spice-button-disabled); transition: opacity 0.15s; }
      #sesh-hero-art.sesh-hero-link { cursor: pointer; }
      #sesh-hero-art.sesh-hero-link:hover { opacity: 0.8; }
      #sesh-hero-info { flex: 1; min-width: 0; }
      #sesh-hero-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
      #sesh-hero-track { font-size: 20px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; }
      #sesh-hero-artist { font-size: 13px; color: rgba(255,255,255,0.65); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sesh-hero-link { cursor: pointer; transition: opacity 0.15s; }
      .sesh-hero-link:hover { opacity: 0.75; text-decoration: underline; }
      #sesh-hero-close { background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.7); cursor: pointer; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; align-self: flex-start; }
      #sesh-hero-close:hover { background: rgba(255,255,255,0.2); color: #fff; }

      /* \u2500\u2500 Body (scrollable) \u2500\u2500 */
      #sesh-body { flex: 1; overflow-y: auto; padding: 20px 24px 24px; }
      #sesh-stats-overlay h2 { margin: 0 0 16px 0; font-size: 18px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; }
      .sesh-section-label { font-size: 12px; font-weight: 700; color: var(--spice-subtext); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
      .sesh-history-toggle { width: 100%; text-align: left; background: none; border: none; border-top: 1px solid var(--spice-button-disabled); margin-top: 4px; padding: 16px 0 12px; color: var(--spice-text); font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: color 0.15s; }
      .sesh-history-toggle:hover { color: var(--spice-button-active, #1db954); }
      .sesh-chevron { font-size: 12px; opacity: 0.7; }
      .sesh-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
      .sesh-select { background: var(--spice-button-disabled); border: none; color: var(--spice-text); padding: 5px 10px; border-radius: 20px; font-size: 12px; cursor: pointer; outline: none; }
      .sesh-btn-export { background: none; border: 1px solid var(--spice-button-disabled); color: var(--spice-subtext); padding: 5px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; margin-left: auto; transition: all 0.15s; }
      .sesh-btn-export:hover { border-color: var(--spice-text); color: var(--spice-text); }
      .sesh-btn-clear { background: none; border: 1px solid var(--spice-button-disabled); color: var(--spice-subtext); padding: 5px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; transition: all 0.15s; }
      .sesh-btn-clear:hover { border-color: #e24; color: #e24; }
      .sesh-btn-clear.confirming { border-color: #e24; color: #fff; background: #e24; }
      .sesh-clear-confirm { display: flex; align-items: center; gap: 6px; font-size: 12px; }
      .sesh-clear-confirm button { background: none; border: 1px solid currentColor; border-radius: 12px; padding: 3px 10px; font-size: 11px; cursor: pointer; transition: all 0.15s; }
      .sesh-clear-yes { color: #e24; }
      .sesh-clear-yes:hover { background: #e24 !important; color: #fff !important; }
      .sesh-clear-no { color: var(--spice-subtext); }
      .sesh-clear-no:hover { background: var(--spice-button-disabled) !important; color: var(--spice-text) !important; }
      .sesh-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px; }
      .sesh-summary-card { background: var(--spice-button-disabled); border-radius: 8px; padding: 12px; text-align: center; }
      .sesh-summary-card .val { font-size: 20px; font-weight: 700; display: block; }
      .sesh-summary-card .lbl { font-size: 11px; color: var(--spice-subtext); margin-top: 2px; display: block; }
      .sesh-top-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
      @media (max-width: 600px) { .sesh-top-grid { grid-template-columns: 1fr; } }
      .sesh-top-section h4 { margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: var(--spice-subtext); text-transform: uppercase; letter-spacing: 0.05em; }
      .sesh-top-list { list-style: none; margin: 0; padding: 0; }
      .sesh-top-list li { display: flex; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--spice-button-disabled); gap: 8px; }
      .sesh-top-list li:last-child { border-bottom: none; }
      .sesh-top-list .rank { color: var(--spice-subtext); font-size: 11px; min-width: 16px; }
      .sesh-top-list .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
      .sesh-top-list .sub { font-size: 11px; color: var(--spice-subtext); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sesh-top-list .cnt { font-size: 11px; color: var(--spice-subtext); white-space: nowrap; margin-left: auto; }
      .sesh-art { width: 36px; height: 36px; border-radius: 3px; object-fit: cover; flex-shrink: 0; background: var(--spice-button-disabled); }
      .sesh-art-placeholder { width: 36px; height: 36px; border-radius: 3px; flex-shrink: 0; background: var(--spice-button-disabled); }
      .sesh-name-stack { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      #sesh-stats-close { background: none; border: none; color: var(--spice-text); cursor: pointer; font-size: 20px; line-height: 1; padding: 0 4px; opacity: 0.6; transition: opacity 0.15s; }
      #sesh-stats-close:hover { opacity: 1; }
      .sesh-stats-button { background: none !important; border: none !important; color: var(--spice-text) !important; cursor: pointer !important; opacity: 0.7 !important; padding: 0 8px !important; transition: opacity 0.2s ease !important; height: 32px !important; display: flex !important; align-items: center !important; gap: 6px !important; }
      .sesh-stats-button:hover { opacity: 1 !important; }

      /* \u2500\u2500 Equalizer icon \u2500\u2500 */
      .sesh-eq { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
      .sesh-eq span { display: block; width: 3px; border-radius: 1px; background: currentColor; transform-origin: bottom; }
      .sesh-eq span:nth-child(1) { height: 40%; animation: seshBar1 0.9s ease-in-out infinite alternate; }
      .sesh-eq span:nth-child(2) { height: 90%; animation: seshBar2 0.7s ease-in-out infinite alternate; }
      .sesh-eq span:nth-child(3) { height: 60%; animation: seshBar3 1.1s ease-in-out infinite alternate; }
      .sesh-eq span:nth-child(4) { height: 75%; animation: seshBar1 0.8s ease-in-out infinite alternate; }
      .sesh-eq.paused span { animation-play-state: paused !important; }
      @keyframes seshBar1 { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
      @keyframes seshBar2 { from { transform: scaleY(0.5); } to { transform: scaleY(1); } }
      @keyframes seshBar3 { from { transform: scaleY(0.2); } to { transform: scaleY(0.9); } }
      .sesh-empty { color: var(--spice-subtext); font-size: 12px; padding: 8px 0; font-style: italic; }
      .sesh-link { cursor: pointer; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: transparent; transition: text-decoration-color 0.15s, color 0.15s; }
      .sesh-link:hover { color: var(--spice-button-active, #1db954); text-decoration-color: currentColor; }
`;Pe();})();