(()=>{const e="Watch on YouTube (Ad-Free)",t="ytv-button",o="www.youtube-nocookie.com",n="yt-video:settings",i="yt-video:cache:",c={useApiKey:!1,apiKey:"",showThumbnails:!0,autoplay:!0};let a={...c};const r={get(e){try{const t=localStorage.getItem(i+e);if(!t)return null;const{value:o,timestamp:n}=JSON.parse(t);return Date.now()-n>864e5?(localStorage.removeItem(i+e),null):o}catch(e){return console.warn("YT-Video: Error reading from cache:",e),null}},set(e,t){try{const o={value:t,timestamp:Date.now()};localStorage.setItem(i+e,JSON.stringify(o))}catch(e){console.warn("YT-Video: Error writing to cache:",e),"QuotaExceededError"===e.name&&this.cleanup()}},cleanup(){try{const e=[];for(let t=0;t<localStorage.length;t++){const o=localStorage.key(t);o.startsWith(i)&&e.push(o)}e.sort(((e,t)=>{const o=JSON.parse(localStorage.getItem(e)).timestamp;return JSON.parse(localStorage.getItem(t)).timestamp-o})),e.slice(100).forEach((e=>{localStorage.removeItem(e)}))}catch(e){console.warn("YT-Video: Error cleaning up cache:",e)}},getSearchKey(e){return"search:"+e.toLowerCase().trim()},getTrackKey(e){return`track:${e.artist}:${e.name}`.toLowerCase().trim()}};function s(){Spicetify.PopupModal.display({title:"YT Video Settings",content:`\n      <div style="display: flex; flex-direction: column; gap: 20px; padding: 24px; max-width: 600px; margin: 0 auto;">\n        <div style="display: flex; align-items: center; gap: 12px;">\n          <input type="checkbox" id="ytv-use-api-key" ${a.useApiKey?"checked":""} style="width: 18px; height: 18px;">\n          <label for="ytv-use-api-key" style="font-size: 16px;">Use YouTube API Key (for better search results)</label>\n        </div>\n        <div style="display: flex; flex-direction: column; gap: 12px;">\n          <label for="ytv-api-key" style="font-size: 16px;">YouTube API Key:</label>\n          <input type="text" id="ytv-api-key" value="${a.apiKey}" style="padding: 12px; border-radius: 4px; border: 1px solid #ccc; background: #282828; color: white; font-size: 14px;">\n          <a href="https://developers.google.com/youtube/v3/getting-started" target="_blank" style="color: #1DB954; font-size: 14px;">How to get a YouTube API Key</a>\n        </div>\n        <div style="display: flex; align-items: center; gap: 12px;">\n          <input type="checkbox" id="ytv-show-thumbnails" ${a.showThumbnails?"checked":""} style="width: 18px; height: 18px;">\n          <label for="ytv-show-thumbnails" style="font-size: 16px;">Show video thumbnails in search results</label>\n        </div>\n        <div style="display: flex; align-items: center; gap: 12px;">\n          <input type="checkbox" id="ytv-autoplay" ${a.autoplay?"checked":""} style="width: 18px; height: 18px;">\n          <label for="ytv-autoplay" style="font-size: 16px;">Autoplay videos</label>\n        </div>\n        <div style="display: flex; justify-content: flex-end; gap: 16px; margin-top: 16px;">\n          <button id="ytv-settings-cancel" style="background: #282828; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>\n          <button id="ytv-settings-save" style="background: #1DB954; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 14px;">Save Settings</button>\n        </div>\n      </div>\n    `,isLarge:!0}),setTimeout((()=>{const e=document.getElementById("ytv-use-api-key"),t=document.getElementById("ytv-api-key"),o=document.getElementById("ytv-show-thumbnails"),i=document.getElementById("ytv-autoplay"),c=document.getElementById("ytv-settings-cancel"),r=document.getElementById("ytv-settings-save");c&&c.addEventListener("click",(()=>{Spicetify.PopupModal.hide()})),r&&r.addEventListener("click",(()=>{a.useApiKey=e?.checked||!1,a.apiKey=t?.value||"",a.showThumbnails=o?.checked||!1,a.autoplay=i?.checked||!1,function(){try{localStorage.setItem(n,JSON.stringify(a)),console.debug("YT-Video: Saved settings:",a)}catch(e){console.error("YT-Video: Error saving settings:",e)}}(),Spicetify.PopupModal.hide(),Spicetify.showNotification("Settings saved")}))}),0)}async function l(e,t=null){for(let o=0;o<5;o++){const n=t instanceof Element?t.querySelector(e):document.querySelector(e);if(n)return console.debug(`YT-Video: Found element '${e}' on attempt ${o+1}`),n;await new Promise((e=>setTimeout(e,120)))}return console.warn(`YT-Video: Failed to find element '${e}' after 5 attempts`),null}function d(e){if(!e)return void Spicetify.showNotification("No track information available");if(a.useApiKey&&!a.apiKey)return Spicetify.showNotification("Please set your YouTube API key in settings"),void s();let t;const n=r.getTrackKey(e),i=r.get(n);if(i)return console.debug("YT-Video: Using cached video for track:",e),void showVideoPlayer(i.id.videoId,0,[i]);if(e.name&&e.artist)t=`${e.artist} - ${e.name} official video`;else if(!e.name&&e.artist)t=e.artist+" official video";else{if(!e.name||e.artist)return void Spicetify.showNotification("Insufficient track information");t=e.name+" full album"}const c=encodeURIComponent(t);Spicetify.showNotification(`Searching for "${t}" on YouTube...`),Spicetify.PopupModal.display({title:"YT Video Search",content:`\n      <div id="ytv-container" style="width: 100%; height: 80vh;">\n        <div id="ytv-search-bar" style="padding: 8px; display: flex; gap: 8px; align-items: center;">\n          <input type="text" id="ytv-search-input" value="${t}" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #ccc; background: #282828; color: white;">\n          <button id="ytv-search-button" style="background-color: #FF0000; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Search</button>\n          <button id="ytv-youtube-button" style="background: #282828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Open on YouTube</button>\n          <button id="ytv-settings-button" style="background: #282828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Settings</button>\n        </div>\n        <div id="ytv-content" style="height: calc(100% - 56px); position: relative;">\n          <div id="ytv-loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #121212;">\n            <div class="main-loadingSpinner-spinner"></div>\n          </div>\n        </div>\n      </div>\n    `,isLarge:!0}),setTimeout((()=>{const e=document.querySelector(".GenericModal");if(e){e.style.width="80vw",e.style.height="80vh",e.style.maxWidth="80vw",e.style.maxHeight="80vh",e.style.position="fixed",e.style.left="50%",e.style.top="50%",e.style.transform="translate(-50%, -50%)",e.style.zIndex="9999";const t=e.querySelector(".main-trackCreditsModal-mainSection");t&&(t.style.height="calc(80vh - 40px)",t.style.maxHeight="calc(80vh - 40px)",t.style.overflow="hidden");const o=e.querySelector(".main-embedWidgetGenerator-container");o&&(o.style.width="100%",o.style.height="100%",o.style.display="flex",o.style.flexDirection="column",o.style.overflow="hidden");const n=e.querySelector(".main-trackCreditsModal-header");if(n){n.style.padding="8px 16px",n.style.minHeight="40px",n.style.height="40px";const e=n.querySelector(".main-type-alto");e&&(e.style.fontSize="16px",e.style.overflow="hidden",e.style.textOverflow="ellipsis",e.style.whiteSpace="nowrap",e.style.maxWidth="calc(100% - 40px)")}const i=document.querySelector(".GenericModal__overlay");if(i){const e=i.onclick;i.onclick=t=>{t.target===i?e&&e(t):t.stopPropagation()}}const c=document.getElementById("ytv-container");c&&c.addEventListener("click",(e=>{e.stopPropagation()}))}}),100),setTimeout((()=>{const e=document.getElementById("ytv-search-input"),t=document.getElementById("ytv-search-button"),n=document.getElementById("ytv-youtube-button"),i=document.getElementById("ytv-settings-button"),l=document.getElementById("ytv-content"),d=(e,t=0,n=[])=>{console.debug("YT-Video: Showing video player for ID:",e),Spicetify.Player&&Spicetify.Player.isPlaying()&&(console.debug("YT-Video: Pausing Spotify playback before loading video"),Spicetify.Player.pause()),window.ytvCurrentState={videoId:e,videoIndex:t,videoList:n};const i=document.getElementById("ytv-search-bar");i&&(i.style.display="none");const c=document.querySelector(".main-trackCreditsModal-header");c&&(c.style.display="none"),l.style.height="100%";const r=document.querySelector(".GenericModal");if(r){r.style.padding="0",r.style.margin="0";const e=r.querySelector(".main-trackCreditsModal-mainSection");e&&(e.style.height="100%",e.style.maxHeight="100%",e.style.overflow="hidden",e.style.padding="0",e.style.margin="0");const t=r.querySelector(".main-embedWidgetGenerator-container");t&&(t.style.padding="0",t.style.margin="0");const o=r.querySelector(".main-trackCreditsModal-originalCredits");o&&(o.style.padding="0",o.style.margin="0");const n=document.querySelector(".GenericModal__overlay");n&&(n.style.padding="0")}l.innerHTML="";const s=document.createElement("div");s.id="ytv-player-container",s.style.width="100%",s.style.height="100%",s.style.position="relative",s.style.overflow="hidden",s.style.padding="0",s.style.margin="0",s.style.backgroundColor="#000";const p=document.createElement("iframe");p.id="ytv-player-iframe",p.style.width="100%",p.style.height="100%",p.style.border="none",p.style.padding="0",p.style.margin="0",p.style.display="block",p.style.position="absolute",p.style.top="0",p.style.left="0",p.style.right="0",p.style.bottom="0",p.loading="lazy",p.src=`https://${o}/embed/${e}?autoplay=${a.autoplay?"1":"0"}&rel=0&controls=1&enablejsapi=1&iv_load_policy=3`,p.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",p.allowFullscreen=!0;const f=document.createElement("button");f.id="ytv-back-button",f.innerHTML='\n        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">\n          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l-4.58 4.59z"/>\n        </svg>\n      ',f.style.position="absolute",f.style.top="50%",f.style.left="16px",f.style.transform="translateY(-50%)",f.style.backgroundColor="rgba(0, 0, 0, 0.8)",f.style.color="#ffffff",f.style.border="2px solid rgba(255, 255, 255, 0.3)",f.style.borderRadius="50%",f.style.width="48px",f.style.height="48px",f.style.cursor="pointer",f.style.zIndex="1000",f.style.display="flex",f.style.alignItems="center",f.style.justifyContent="center",f.style.boxShadow="0 2px 8px rgba(0, 0, 0, 0.5)",f.style.transition="all 0.2s ease",f.setAttribute("aria-label","Previous video"),f.setAttribute("title","Previous video");const y=document.createElement("button");y.id="ytv-forward-button",y.innerHTML='\n        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">\n          <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z"/>\n        </svg>\n      ',y.style.position="absolute",y.style.top="50%",y.style.right="16px",y.style.transform="translateY(-50%)",y.style.backgroundColor="rgba(0, 0, 0, 0.8)",y.style.color="#ffffff",y.style.border="2px solid rgba(255, 255, 255, 0.3)",y.style.borderRadius="50%",y.style.width="48px",y.style.height="48px",y.style.cursor="pointer",y.style.zIndex="1000",y.style.display="flex",y.style.alignItems="center",y.style.justifyContent="center",y.style.boxShadow="0 2px 8px rgba(0, 0, 0, 0.5)",y.style.transition="all 0.2s ease",y.setAttribute("aria-label","Next video"),y.setAttribute("title","Next video");const g=e=>{e.addEventListener("mouseover",(()=>{e.style.backgroundColor="rgba(255, 0, 0, 0.8)",e.style.borderColor="rgba(255, 255, 255, 0.5)",e.style.transform="translateY(-50%) scale(1.1)"})),e.addEventListener("mouseout",(()=>{e.style.backgroundColor="rgba(0, 0, 0, 0.8)",e.style.borderColor="rgba(255, 255, 255, 0.3)",e.style.transform="translateY(-50%) scale(1)"}))};g(f),g(y),f.addEventListener("click",(e=>{if(e.preventDefault(),e.stopPropagation(),window.ytvCurrentState&&window.ytvCurrentState.videoList&&window.ytvCurrentState.videoList.length>0){const{videoIndex:e,videoList:t}=window.ytvCurrentState;if(e>0){const o=e-1,n=t[o];d(n.id.videoId,o,t)}else{if(console.debug("YT-Video: At first video, going back to search"),i&&(i.style.display="flex"),c&&(c.style.display="flex"),l.style.height="calc(100% - 56px)",r){r.style.padding="";const e=r.querySelector(".main-trackCreditsModal-mainSection");e&&(e.style.height="calc(80vh - 60px)",e.style.maxHeight="calc(80vh - 60px)",e.style.padding="",e.style.margin="");const t=r.querySelector(".main-embedWidgetGenerator-container");t&&(t.style.padding="",t.style.margin="");const o=r.querySelector(".main-trackCreditsModal-originalCredits");o&&(o.style.padding="",o.style.margin="");const n=document.querySelector(".GenericModal__overlay");n&&(n.style.padding="")}u()}}else{if(console.debug("YT-Video: Back button clicked, returning to search"),i&&(i.style.display="flex"),c&&(c.style.display="flex"),l.style.height="calc(100% - 56px)",r){r.style.padding="";const e=r.querySelector(".main-trackCreditsModal-mainSection");e&&(e.style.height="calc(80vh - 60px)",e.style.maxHeight="calc(80vh - 60px)",e.style.padding="",e.style.margin="");const t=r.querySelector(".main-embedWidgetGenerator-container");t&&(t.style.padding="",t.style.margin="");const o=r.querySelector(".main-trackCreditsModal-originalCredits");o&&(o.style.padding="",o.style.margin="");const n=document.querySelector(".GenericModal__overlay");n&&(n.style.padding="")}u()}return!1})),y.addEventListener("click",(e=>{if(e.preventDefault(),e.stopPropagation(),window.ytvCurrentState&&window.ytvCurrentState.videoList&&window.ytvCurrentState.videoList.length>0){const{videoIndex:e,videoList:t}=window.ytvCurrentState;if(e<t.length-1){const o=e+1,n=t[o];d(n.id.videoId,o,t)}else{if(console.debug("YT-Video: At last video, going back to search"),i&&(i.style.display="flex"),c&&(c.style.display="flex"),l.style.height="calc(100% - 56px)",r){r.style.padding="";const e=r.querySelector(".main-trackCreditsModal-mainSection");e&&(e.style.height="calc(80vh - 60px)",e.style.maxHeight="calc(80vh - 60px)",e.style.padding="",e.style.margin="");const t=r.querySelector(".main-embedWidgetGenerator-container");t&&(t.style.padding="",t.style.margin="");const o=r.querySelector(".main-trackCreditsModal-originalCredits");o&&(o.style.padding="",o.style.margin="");const n=document.querySelector(".GenericModal__overlay");n&&(n.style.padding="")}u()}}else{if(console.debug("YT-Video: Forward button clicked, returning to search"),i&&(i.style.display="flex"),c&&(c.style.display="flex"),l.style.height="calc(100% - 56px)",r){r.style.padding="";const e=r.querySelector(".main-trackCreditsModal-mainSection");e&&(e.style.height="calc(80vh - 60px)",e.style.maxHeight="calc(80vh - 60px)",e.style.padding="",e.style.margin="");const t=r.querySelector(".main-embedWidgetGenerator-container");t&&(t.style.padding="",t.style.margin="");const o=r.querySelector(".main-trackCreditsModal-originalCredits");o&&(o.style.padding="",o.style.margin="");const n=document.querySelector(".GenericModal__overlay");n&&(n.style.padding="")}u()}return!1})),s.appendChild(p),s.appendChild(f),s.appendChild(y),l.appendChild(s),s.addEventListener("click",(e=>{e.stopPropagation()}))},u=()=>{const t=e.value.trim();console.debug("YT-Video: Performing search for:",t),a.useApiKey&&a.apiKey?(async e=>{console.debug("YT-Video: Showing API results for:",e),l.innerHTML='\n        <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #121212;">\n          <div class="main-loadingSpinner-spinner"></div>\n        </div>\n      ';try{const t=r.getSearchKey(e),o=r.get(t);let n;if(o)console.debug("YT-Video: Using cached results for:",e),n=o;else{const o=encodeURIComponent(e),i=await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${o}&type=video&maxResults=15&key=${a.apiKey}`);if(n=await i.json(),n.error)throw Error(n.error.message||"API Error");n.items&&n.items.length>0&&r.set(t,n)}if(!n.items||0===n.items.length)return void(l.innerHTML=`\n            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #121212; color: white; text-align: center; padding: 20px;">\n              <p>No results found for "${e}"</p>\n              <button onclick="window.open('https://www.youtube.com/results?search_query=${c}', '_blank')" \n                      style="background-color: #282828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 16px;">\n                Open Search on YouTube\n              </button>\n            </div>\n          `);window.ytvSearchResults=n.items;const i=document.createElement("div");i.id="ytv-results-container",i.style.width="100%",i.style.height="100%",i.style.overflow="auto",i.style.padding="16px",i.style.background="#121212";const s=document.createElement("div");s.style.display="grid",s.style.gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))",s.style.gap="16px",n.items.forEach(((e,t)=>{const o=document.createElement("div");if(o.className="ytv-result",o.dataset.videoId=e.id.videoId,o.dataset.videoIndex=t,o.style.cursor="pointer",o.style.transition="transform 0.2s",o.style.background="#333",o.style.borderRadius="4px",o.style.overflow="hidden",a.showThumbnails){const t=document.createElement("img");t.src=e.snippet.thumbnails.medium.url,t.style.width="100%",t.style.height="180px",t.style.objectFit="cover",o.appendChild(t)}else{const e=document.createElement("div");e.style.width="100%",e.style.height="180px",e.style.background="#222",e.style.display="flex",e.style.justifyContent="center",e.style.alignItems="center",e.innerHTML='\n              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#FF0000">\n                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>\n              </svg>\n            ',o.appendChild(e)}const i=document.createElement("div");i.style.padding="12px";const c=document.createElement("div");c.style.fontWeight="bold",c.style.marginBottom="4px",c.textContent=e.snippet.title,i.appendChild(c);const r=document.createElement("div");r.style.color="#b3b3b3",r.style.fontSize="14px",r.textContent=e.snippet.channelTitle,i.appendChild(r);const l=document.createElement("div");l.style.color="#b3b3b3",l.style.fontSize="12px",l.style.marginTop="4px",l.textContent=new Date(e.snippet.publishedAt).toLocaleDateString(),i.appendChild(l),o.appendChild(i),o.addEventListener("mouseover",(()=>{o.style.transform="scale(1.02)",o.style.boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"})),o.addEventListener("mouseout",(()=>{o.style.transform="scale(1)",o.style.boxShadow="none"})),o.addEventListener("click",(e=>{e.preventDefault(),e.stopPropagation();const t=o.dataset.videoId,i=parseInt(o.dataset.videoIndex,10);return console.debug("YT-Video: Result clicked, video ID:",t,"index:",i),d(t,i,n.items),!1})),s.appendChild(o)})),i.appendChild(s),l.innerHTML="",l.appendChild(i),i.addEventListener("click",(e=>{e.stopPropagation()}))}catch(e){console.error("YT-Video: Error fetching search results:",e),l.innerHTML=`\n          <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #121212; color: white; text-align: center; padding: 20px;">\n            <p>Error: ${e.message||"Failed to fetch search results"}</p>\n            <p style="margin-top: 8px; color: #b3b3b3;">Please check your API key in settings or try again later.</p>\n            <button onclick="window.open('https://www.youtube.com/results?search_query=${c}', '_blank')" \n                    style="background-color: #282828; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 16px;">\n              Open Search on YouTube\n            </button>\n          </div>\n        `}})(t):(e=>{console.debug("YT-Video: Showing embed results for:",e);const t=encodeURIComponent(e),n=document.createElement("div");n.style.width="100%",n.style.height="100%",n.style.position="relative";const i=document.createElement("iframe");i.style.width="100%",i.style.height="100%",i.style.border="none",i.loading="lazy",i.src=`https://${o}/embed/videoseries?autoplay=0&rel=0&iv_load_policy=3&fs=1&color=red&hl=en&list=search&playlist=${t}&enablejsapi=1`,i.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",i.allowFullscreen=!0,n.appendChild(i),l.innerHTML="",l.appendChild(n),n.addEventListener("click",(e=>{e.stopPropagation()}))})(t)};t&&t.addEventListener("click",(e=>(e.preventDefault(),e.stopPropagation(),u(),!1))),e&&(e.addEventListener("keypress",(e=>{if("Enter"===e.key)return e.preventDefault(),e.stopPropagation(),u(),!1})),e.addEventListener("click",(e=>{e.stopPropagation()}))),n&&n.addEventListener("click",(t=>{t.preventDefault(),t.stopPropagation();const o=e.value.trim();return window.open("https://www.youtube.com/results?search_query="+encodeURIComponent(o),"_blank"),!1})),i&&i.addEventListener("click",(e=>(e.preventDefault(),e.stopPropagation(),setTimeout((()=>{s()}),100),!1))),l&&l.addEventListener("click",(e=>{e.stopPropagation()})),u()}),100)}function u(){const e=function(){console.debug("YT-Video: Getting current track info");try{if(Spicetify.Player&&Spicetify.Player.data){const e=Spicetify.Player.data;if(e.track&&e.track.metadata){const t=e.track.metadata;return console.debug("YT-Video: Found track info using Player.data"),{name:t.title,artist:t.artist_name,album:t.album_title}}}try{if(Spicetify.Player&&"function"==typeof Spicetify.Player.getTrackInfo){const e=Spicetify.Player.getTrackInfo();if(e)return console.debug("YT-Video: Found track info using Player.getTrackInfo()"),{name:e.track,artist:e.artist,album:e.album}}}catch(e){console.debug("YT-Video: Error getting track info from Player.getTrackInfo():",e)}const e=document.querySelector(".main-nowPlayingWidget-nowPlaying .main-trackInfo-name"),t=document.querySelector(".main-nowPlayingWidget-nowPlaying .main-trackInfo-artists");if(e&&t)return console.debug("YT-Video: Found track info using DOM elements"),{name:e.textContent,artist:t.textContent,album:""};const o=document.querySelector("[data-testid='now-playing-widget'] .main-trackInfo-name"),n=document.querySelector("[data-testid='now-playing-widget'] .main-trackInfo-artists");if(o&&n)return console.debug("YT-Video: Found track info using alternative DOM selectors"),{name:o.textContent,artist:n.textContent,album:""};const i=document.title;if(i&&i.includes(" - ")&&!i.startsWith("Spotify")){const e=i.split(" - ");if(e.length>=2)return console.debug("YT-Video: Found track info using document title"),{name:e[0],artist:e[1].replace(" • Spotify",""),album:""}}return console.error("YT-Video: Could not find track info using any method"),null}catch(e){return console.error("YT-Video: Error getting current track info:",e),null}}();e?d(e):Spicetify.showNotification("No track information available")}async function p(){if(console.debug("YT-Video: Adding YouTube button"),document.querySelector("."+t))return console.debug("YT-Video: Button already exists"),!0;const o=function(){const o=document.createElement("button");return o.classList.add(t),o.setAttribute("title",e),o.setAttribute("aria-label",e),o.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">\n  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>\n</svg>',o.style.backgroundColor="transparent",o.style.border="none",o.style.color="#FF0000",o.style.cursor="pointer",o.style.padding="0",o.style.width="32px",o.style.height="32px",o.style.display="flex",o.style.alignItems="center",o.style.justifyContent="center",o.style.opacity="0.7",o.style.transition="opacity 0.2s ease-in-out",o.addEventListener("mouseover",(()=>{o.style.opacity="1"})),o.addEventListener("mouseout",(()=>{o.style.opacity="0.7"})),o.addEventListener("click",u),o}(),n=[".main-trackInfo-container",".main-nowPlayingBar-extraControls",".main-nowPlayingBar-right",".main-nowPlayingWidget-nowPlaying"];for(const e of n){const t=await l(e);if(t)return console.debug("YT-Video: Adding button to "+e),t.appendChild(o),!0}return console.debug("YT-Video: No suitable container found, adding to body"),o.style.position="fixed",o.style.bottom="80px",o.style.right="16px",o.style.zIndex="9999",document.body.appendChild(o),!0}(async e=>{for(;!e();)await new Promise((e=>setTimeout(e,120)));await async function(){console.debug("YT-Video: Initializing"),function(){try{const e=JSON.parse(localStorage.getItem(n));e?(a={...c,...e},console.debug("YT-Video: Loaded settings:",a)):console.debug("YT-Video: No saved settings found, using defaults")}catch(e){console.error("YT-Video: Error loading settings:",e),a={...c}}}(),r.cleanup(),await p(),Spicetify.ContextMenu?(new Spicetify.ContextMenu.Item("Play video",(async e=>{if(!e||!e.length)return void console.error("YT-Video: No URIs provided to context menu handler");Spicetify.Player.isPlaying()&&(console.debug("YT-Video: Pausing playback"),Spicetify.Player.pause());const t=e[0];console.debug("YT-Video: Context menu item clicked for URI:",t);const o=await async function(e){console.debug("YT-Video: Getting track info from URI:",e);try{if(e.includes("spotify:track:")){const t=e.split("spotify:track:")[1],o=await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/tracks/"+t);if(o&&o.name)return console.debug("YT-Video: Found track info from track URI"),{name:o.name,artist:o.artists?.[0]?.name||"",album:o.album?.name||""}}else if(e.includes("spotify:album:")){const t=e.split("spotify:album:")[1],o=await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/albums/"+t);if(o&&o.name)return console.debug("YT-Video: Found album info from album URI"),{name:o.name,artist:o.artists?.[0]?.name||"",album:o.name}}else if(e.includes("spotify:artist:")){const t=e.split("spotify:artist:")[1],o=await Spicetify.CosmosAsync.get("https://api.spotify.com/v1/artists/"+t);if(o&&o.name)return console.debug("YT-Video: Found artist info from artist URI"),{name:"",artist:o.name,album:""}}return console.error("YT-Video: Could not get track info from URI:",e),null}catch(e){return console.error("YT-Video: Error getting track info from URI:",e),null}}(t);d(o)}),(e=>{if(!e||!e.length)return!1;const t=e[0];return t.includes("spotify:track:")||t.includes("spotify:album:")||t.includes("spotify:artist:")}),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#FF0000" style="margin-right: 4px; vertical-align: -3px;">\n  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>\n</svg>').register(),console.debug("YT-Video: Added context menu items")):console.error("YT-Video: Spicetify.ContextMenu is not available"),Spicetify.Player.addEventListener("songchange",(async()=>{console.debug("YT-Video: Song changed, checking button"),document.querySelector("."+t)||(console.debug("YT-Video: Button not found, re-adding"),await p())})),Spicetify.Platform.History.listen((async()=>{console.debug("YT-Video: App navigation detected, checking button"),document.querySelector("."+t)||(console.debug("YT-Video: Button not found, re-adding"),await p())})),console.debug("YT-Video: Initialization complete")}()})((()=>{const e=Spicetify&&Spicetify.Platform&&Spicetify.Platform.FeedbackAPI&&"complete"===document.readyState;return e&&console.debug("YT-Video: Spicetify is ready"),e}))})();