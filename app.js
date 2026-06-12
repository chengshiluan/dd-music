// === DD Music v3.4 - Bug fixes + new features ===
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let currentView='home', currentPlatform='netease', currentPlaylist=null, discoverData=[], playlists=[], songs=[], queue=[], currentIndex=-1, isPlaying=false, drawerOpen=false, nowPlayingOpen=false, currentSong=null, lyricLines=[], activeLyricIdx=-1, loopMode='none', favorites=[], playCounts={};
// Pagination state
let playlistTotal=0, playlistOffset=0, playlistLimit=50, playlistLoading=false, currentListId='', currentListPlatform='';

let userState = { netease:{cookie:'',uid:'',nickname:'',avatar:'',loggedIn:false}, github:{token:'',login:'',name:'',avatar:'',id:'',loggedIn:false} };
function loadUserState(){try{var s=localStorage.getItem('dd_music_user');if(s){var d=JSON.parse(s);if(d&&d.github)userState.github=d.github;if(d&&d.netease)userState.netease=d.netease}}catch{}}
function saveUserState(){try{localStorage.setItem('dd_music_user',JSON.stringify(userState))}catch{}}
loadUserState();

function loadFavorites(){try{var s=localStorage.getItem('dd_music_favorites');if(s)favorites=JSON.parse(s)}catch{}}
function saveFavorites(){try{localStorage.setItem('dd_music_favorites',JSON.stringify(favorites))}catch{}}
loadFavorites();

function loadPlayCounts(){try{var s=localStorage.getItem('dd_music_play_counts');if(s)playCounts=JSON.parse(s)}catch{}}
function savePlayCounts(){try{localStorage.setItem('dd_music_play_counts',JSON.stringify(playCounts))}catch{}}
loadPlayCounts();

const audio=$('#audio'); let volume=0.7; if(audio)audio.volume=volume;

// -- Theme --
let isDark=true;
function initTheme(){var s=localStorage.getItem('dd_music_theme');if(s==='light'){isDark=false;document.body.classList.add('light-theme')}updateThemeIcons()}
function toggleTheme(){isDark=!isDark;document.body.classList.toggle('light-theme',!isDark);localStorage.setItem('dd_music_theme',isDark?'dark':'light');updateThemeIcons()}
function updateThemeIcons(){var s=$('.icon-sun'),m=$('.icon-moon');if(s)s.style.display=isDark?'':'none';if(m)m.style.display=isDark?'none':''}
$('#btnTheme').addEventListener('click',toggleTheme); initTheme();

// -- API --
const API_BASE='/api/';
function apiUrl(p){return API_BASE+'?'+new URLSearchParams(p).toString()}
// Unified API cache (localStorage, max 100, LRU; skip playback URLs)
var API_CACHE_MAX=100;
var API_CACHE_NO=['bootstrap','oauth_url','login_check','netease_bind','favorite_add','favorite_remove','listen_record','share_create','share_get'];
function getApiCache(){try{var s=localStorage.getItem('dd_music_api_cache');if(s)return JSON.parse(s)}catch{};return{}}
function saveApiCache(cache){try{var keys=Object.keys(cache);if(keys.length>API_CACHE_MAX){keys.sort(function(a,b){return(cache[a]._ts||0)-(cache[b]._ts||0)});var remove=keys.slice(0,keys.length-API_CACHE_MAX);remove.forEach(function(k){delete cache[k]})}localStorage.setItem('dd_music_api_cache',JSON.stringify(cache))}catch{}}
function apiCacheKey(p){var parts=[];for(var k in p)parts.push(k+'='+p[k]);parts.sort();return parts.join('&')}
async function apiCall(p){if(p.platform==='netease'&&userState.github.loggedIn&&userState.github.id&&!p.github_id&&!p.cookie)p.github_id=userState.github.id;if(API_CACHE_NO.indexOf(p.action)<0){var ck=apiCacheKey(p);var cache=getApiCache();if(cache[ck]&&cache[ck].data){cache[ck]._ts=Date.now();saveApiCache(cache);return cache[ck].data}}var r=await fetch(apiUrl(p));if(!r.ok)throw new Error('API '+r.status);var d=await r.json();if(API_CACHE_NO.indexOf(p.action)<0){var ck=apiCacheKey(p);var cache=getApiCache();cache[ck]={data:d,_ts:Date.now()};saveApiCache(cache)}return d}

// -- Helpers --
function escHtml(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function https(u){return u?u.replace(/^http:/,'https:'):''}
function fmtTime(s){var m=Math.floor(s/60);return m+':'+String(Math.floor(s%60)).padStart(2,'0')}
function isFav(id){return favorites.some(function(f){return f.id===id})}
function isCurrentPlaying(id){return isPlaying&&currentSong&&(currentSong.id||'')===(id||'')}
function miniWaveHtml(){return'<div class="song-playing-wave"><span></span><span></span><span></span><span></span><span></span></div>'}
function qiWaveHtml(){return'<div class="qi-playing-wave"><span></span><span></span><span></span><span></span><span></span></div>'}
function getFrequentSongs(){var list=[];for(var id in playCounts){if(playCounts[id]>=10){var f=favorites.find(function(x){return x.id===id})||songs.find(function(x){return x.id===id});if(f)list.push({id:f.id,title:f.title||f.name||'',artist:f.artist||'',img_url:https(f.img_url||f.cover||''),source:f.source||'',count:playCounts[id]})}}list.sort(function(a,b){return b.count-a.count});return list}

// -- View switching --
function switchView(v){currentView=v;$('#viewHome').style.display=v==='home'?'':'none';$('#viewDetail').style.display=v==='detail'?'':'none';$('#viewSearch').style.display=v==='search'?'':'none';$('#viewMine').style.display=v==='mine'?'':'none';$('#breadcrumb').style.display=(v==='detail'||v==='search')?'':'none'}

// -- Drawer --
function openDrawer(){drawerOpen=true;$('#queueDrawer').classList.add('open');$('#drawerBackdrop').classList.add('open')}
function closeDrawer(){drawerOpen=false;$('#queueDrawer').classList.remove('open');$('#drawerBackdrop').classList.remove('open')}
$('#btnQueue').addEventListener('click',function(){drawerOpen?closeDrawer():openDrawer()});
$('#closeDrawer').addEventListener('click',closeDrawer);$('#drawerBackdrop').addEventListener('click',closeDrawer);

// -- Now Playing --
var _npResizeObserver=null;
function syncNpHeights(){
  var left=document.querySelector('.np-left');
  var right=document.querySelector('.np-right');
  if(left&&right){right.style.height=left.offsetHeight+'px'}
}
function openNowPlaying(){nowPlayingOpen=true;$('#nowPlaying').style.display='block';document.body.style.overflow='hidden';applySettings();syncNpHeights();if(!_npResizeObserver){_npResizeObserver=new ResizeObserver(function(){syncNpHeights()});_npResizeObserver.observe(document.querySelector('.np-left'))}if(currentSong){updateNowPlayingPage();loadLyric(currentSong);updateNpFavBtn()}else{$('#npTitle').textContent='顶点音乐';$('#npArtistTag').textContent='歌手：未知';$('#npAlbumTag').textContent='专辑：未知';$('#npPlatformTag').textContent='网易云';$('#npQualityTag').textContent='标准';$('#npLyrics').innerHTML='<div class="lyrics-placeholder">暂无歌词</div>'}npShowControls();startNpIdleTimer()}
function closeNowPlaying(){nowPlayingOpen=false;$('#nowPlaying').style.display='none';document.body.style.overflow='';activeLyricIdx=-1;stopNpIdleTimer()}
$('#playerCoverWrap').addEventListener('click',openNowPlaying);$('#npClose').addEventListener('click',closeNowPlaying);
// Fullscreen toggle
$('#npFullscreen').addEventListener('click',function(){if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(){})}else{document.exitFullscreen().catch(function(){})}});
// NP auto-hide controls after 3s idle
var npIdleTimer=null,npControlsVisible=true;
function npShowControls(){npControlsVisible=true;var c=$('#npControls');if(c)c.classList.remove('np-hidden');var b=$('#npBack'),fs=$('#npFullscreen');if(b)b.style.opacity='1';if(fs)fs.style.opacity='1'}
function npHideControls(){if(!npControlsVisible)return;npControlsVisible=false;var c=$('#npControls');if(c)c.classList.add('np-hidden');var b=$('#npBack'),fs=$('#npFullscreen');if(b)b.style.opacity='0';if(fs)fs.style.opacity='0'}
function startNpIdleTimer(){stopNpIdleTimer();npIdleTimer=setTimeout(function(){npHideControls()},3000)}
function stopNpIdleTimer(){if(npIdleTimer){clearTimeout(npIdleTimer);npIdleTimer=null}}
document.addEventListener('mousemove',function(){if(nowPlayingOpen){npShowControls();startNpIdleTimer()}});
document.addEventListener('touchstart',function(){if(nowPlayingOpen){npShowControls();startNpIdleTimer()}});
$('#nowPlaying').addEventListener('click',function(e){if(e.target.closest('.np-controls')||e.target.closest('.np-back')||e.target.closest('.np-fullscreen'))return;if(nowPlayingOpen){npShowControls();startNpIdleTimer()}});

function updateNowPlayingPage(){if(!currentSong)return;var t=currentSong.title||currentSong.name||'未知',a=currentSong.artist||'',al=currentSong.album||'',c=https(currentSong.img_url||currentSong.cover||'');$('#npTitle').textContent=t;$('#npArtistTag').textContent='歌手：'+(a||'未知');$('#npAlbumTag').textContent='专辑：'+(al||'未知');var pn={netease:'网易云',qq:'QQ音乐',kugou:'酷狗',kuwo:'酷我',bilibili:'B站',migu:'咪咕'};var src=currentSong.source||currentPlatform;$('#npPlatformTag').textContent=pn[src]||src;var q=currentSong.disable?'VIP':'标准';$('#npQualityTag').textContent=q;if(c){$('#npBg').style.backgroundImage='url('+c+')';$('#npLabel').style.backgroundImage='url('+c+')'}applySettings()}

// -- Lyric --
function parseLRC(t){if(!t)return[];var ls=t.split('\n'),r=[];ls.forEach(function(l){var m=l.trim().match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);if(m){var time=parseInt(m[1])*60+parseInt(m[2])+parseInt(m[3])/(m[3].length===2?100:1000);if(m[4].trim())r.push({time:time,text:m[4].trim()})}});r.sort(function(a,b){return a.time-b.time});return r}

async function loadLyric(song){var tid=song.id||'',p=song.source||currentPlatform;if(p==='mine')p='netease';$('#npLyrics').innerHTML='<div class="lyrics-placeholder">加载歌词...</div>';try{var d=await apiCall({action:'lyric',platform:p,trackId:tid});lyricLines=parseLRC(d.lyric||'');if(!lyricLines.length){$('#npLyrics').innerHTML='<div class="lyrics-placeholder">暂无歌词</div>';return}$('#npLyrics').innerHTML=lyricLines.map(function(l,i){return'<div class="lyric-line" data-idx="'+i+'">'+escHtml(l.text)+'</div>'}).join('')}catch(e){$('#npLyrics').innerHTML='<div class="lyrics-placeholder">歌词加载失败</div>'}}

function syncLyric(ct){if(!lyricLines.length||!nowPlayingOpen)return;var idx=-1;for(var i=lyricLines.length-1;i>=0;i--){if(ct>=lyricLines[i].time){idx=i;break}}if(idx===activeLyricIdx)return;activeLyricIdx=idx;var lines=$$('#npLyrics .lyric-line');lines.forEach(function(el,i){i===idx?el.classList.add('active'):el.classList.remove('active')});if(idx>=0&&lines[idx]){var c=$('#npLyrics');var lineEl=lines[idx];var cRect=c.getBoundingClientRect();var lRect=lineEl.getBoundingClientRect();var target=c.scrollTop+(lRect.top-cRect.top)-(cRect.height/2)+(lRect.height/2);if(target<0)target=0;c.scrollTo({top:target,behavior:'smooth'})}}

// -- Home --
async function loadHome(){var c=$('#discoverContainer');c.innerHTML='<div class="loading"><div class="spinner"></div><span>加载歌单...</span></div>';try{if(currentPlatform==='netease'){var d=await apiCall({action:'discover',platform:'netease'});discoverData=Array.isArray(d)?d:[];if(!discoverData.length){c.innerHTML='<div class="empty-hint">暂无推荐歌单</div>';return}c.innerHTML=discoverData.map(function(cat){return'<div class="category-section"><div class="category-header"><div class="category-name">'+escHtml(cat.category)+'</div></div><div class="playlist-grid">'+cat.playlists.map(function(p,i){var cv=https(p.cover_img_url||'');return'<div class="playlist-card" data-cat="'+escHtml(cat.category)+'" data-idx="'+i+'"><div class="card-cover"><img src="'+cv+'" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div><div class="card-title">'+escHtml(p.title||'')+'</div></div>'}).join('')+'</div></div>'}).join('')}else{var d=await apiCall({action:'chart',platform:currentPlatform});playlists=Array.isArray(d)?d:(d.playlists||d.list||[]);if(!playlists.length){c.innerHTML='<div class="empty-hint">该平台暂无推荐歌单</div>';return}c.innerHTML='<div class="category-section"><div class="category-header"><div class="category-name">推荐歌单</div></div><div class="playlist-grid">'+playlists.map(function(p,i){var cv=https(p.cover_img_url||p.cover||p.img||'');return'<div class="playlist-card" data-chart-idx="'+i+'"><div class="card-cover"><img src="'+cv+'" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div><div class="card-title">'+escHtml(p.title||p.name||'')+'</div></div>'}).join('')+'</div></div>'}bindPlaylistCards(c)}catch(e){c.innerHTML='<div class="empty-hint">加载失败</div>'}}

function bindPlaylistCards(c){c.querySelectorAll('.playlist-card[data-cat]').forEach(function(card){card.addEventListener('click',function(){var cat=discoverData.find(function(x){return x.category===card.dataset.cat});if(cat&&cat.playlists[parseInt(card.dataset.idx)])openPlaylist(cat.playlists[parseInt(card.dataset.idx)])})});c.querySelectorAll('.playlist-card[data-chart-idx]').forEach(function(card){card.addEventListener('click',function(){var i=parseInt(card.dataset.chartIdx);if(playlists[i])openPlaylist(playlists[i])})})}

// -- My Music Page (REDESIGNED v3.3) --
var mineActiveTab='favorites';
function renderMinePage(){
  var sb=$('#mineSidebar');
  var tabs=[{key:'mine',name:'Mine',icon:'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'},{key:'favorites',name:'收藏',icon:'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z'},{key:'playlists',name:'歌单',icon:'M4 6h16M4 12h16M4 18h10'},{key:'frequent',name:'最近',icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'},{key:'settings',name:'设置',icon:'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'},{key:'upload',name:'上传',icon:'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z'}];
  sb.innerHTML=tabs.map(function(t){return'<div class="mine-tab'+(mineActiveTab===t.key?' active':'')+'" data-tab="'+t.key+'"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="'+t.icon+'"/></svg><span>'+t.name+'</span></div>'}).join('');
  sb.querySelectorAll('.mine-tab').forEach(function(el){el.addEventListener('click',function(){sb.querySelectorAll('.mine-tab').forEach(function(e){e.classList.remove('active')});el.classList.add('active');mineActiveTab=el.dataset.tab;renderMineContent()})});
  renderMineContent();
}

function renderMineContent(){
  var c=$('#mineContent');
  if(mineActiveTab==='mine') renderMineInfo(c);
  else if(mineActiveTab==='favorites') renderFavorites(c);
  else if(mineActiveTab==='playlists') renderMyPlaylists(c);
  else if(mineActiveTab==='frequent') renderRecent(c);
  else if(mineActiveTab==='settings') renderSettings(c);
  else if(mineActiveTab==='upload') c.innerHTML='<div class="empty-hint"><p style="font-size:14px">功能暂未开放</p><p style="font-size:11px;color:var(--text3);margin-top:6px">上传功能即将上线</p></div>';
}

function renderMineInfo(c){
  if(!userState.github.loggedIn){c.innerHTML='<div class="empty-hint">请先登录</div>';return}
  var avatar=userState.github.avatar||'',name=userState.github.name||userState.github.login||'用户',login=userState.github.login||'';
  // Track distinct usage days
  var today=new Date();var dayKey=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  try{var daysSet=JSON.parse(localStorage.getItem('dd_music_days')||'[]');if(daysSet.indexOf(dayKey)<0){daysSet.push(dayKey);localStorage.setItem('dd_music_days',JSON.stringify(daysSet))}}catch{daysSet=[dayKey];localStorage.setItem('dd_music_days',JSON.stringify(daysSet))}
  var days=daysSet.length;
  // Estimate listening time from play counts
  var totalPlays=0;for(var id in playCounts)totalPlays+=playCounts[id];
  var listenMin=Math.round(totalPlays*3.5);
  var listenStr=listenMin>=60?Math.floor(listenMin/60)+'小时'+(listenMin%60)+'分钟':listenMin+'分钟';
  // Build heatmap HTML (52 weeks x 7 days)
  var heatmapHtml=buildHeatmap(daysSet);
  c.innerHTML='<div class="mine-info-card">'+
    '<div class="mine-logout-icon" id="btnLogout" title="退出登录"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg></div>'+
    '<div class="mine-avatar-wrap" id="mineAvatarWrap">'+(avatar?'<div class="login-avatar-fallback" style="width:80px;height:80px;font-size:32px">'+escHtml(name.charAt(0).toUpperCase())+'</div>':'<div class="mine-avatar-fallback" style="width:80px;height:80px;font-size:32px">'+escHtml(name.charAt(0).toUpperCase())+'</div>')+'</div>'+
    '<div class="mine-user-name">'+escHtml(name)+'</div>'+
    '<div class="mine-user-login">@'+escHtml(login)+'</div>'+
    '<div class="mine-stats">'+
      '<div class="mine-stat"><div class="mine-stat-val">'+days+'</div><div class="mine-stat-label">使用天数</div></div>'+
      '<div class="mine-stat"><div class="mine-stat-val">'+totalPlays+'</div><div class="mine-stat-label">播放次数</div></div>'+
      '<div class="mine-stat"><div class="mine-stat-val">'+listenStr+'</div><div class="mine-stat-label">听歌时长</div></div>'+
    '</div>'+
    '<div class="mine-heatmap">'+heatmapHtml+'</div>'+
  '</div>';
  var lo=$('#btnLogout');if(lo)lo.addEventListener('click',doLogout);
  if(avatar){var aw=$('#mineAvatarWrap');if(aw){var mi=new Image();mi.className='mine-avatar';mi.onload=function(){aw.innerHTML='';aw.appendChild(mi)};mi.onerror=function(){};mi.src=avatar}}
}

function doLogout(){
  userState.github={token:'',login:'',name:'',avatar:'',id:'',loggedIn:false};
  saveUserState();updateLoginBtn();showToast('已退出登录');
  if(currentView==='mine'){switchView('home');$$('#platformTabs .platform-tab').forEach(function(t){t.classList.remove('active')});var n=$('[data-platform="netease"]');if(n)n.classList.add('active');currentPlatform='netease';loadHome()}
}

function buildHeatmap(daysSet){
  var today=new Date();var cells='';
  for(var w=51;w>=0;w--){
    for(var d=0;d<7;d++){
      var cellDate=new Date(today);cellDate.setDate(cellDate.getDate()-(w*7+(6-d)));
      var key=cellDate.getFullYear()+'-'+String(cellDate.getMonth()+1).padStart(2,'0')+'-'+String(cellDate.getDate()).padStart(2,'0');
      var lvl=daysSet.indexOf(key)>=0?'l1':'';
      cells+='<div class="mine-heatmap-cell'+lvl+'" title="'+key+'"></div>';
    }
  }
  return'<div class="mine-heatmap-title">听歌活跃度（近一年）</div><div class="mine-heatmap-grid">'+cells+'</div>';
}

function renderFavorites(c){
  if(!favorites.length){c.innerHTML='<div class="empty-hint">还没有收藏歌曲</div>';return}
  var list=favorites.slice().sort(function(a,b){return(b.ts||0)-(a.ts||0)});
  songs=list;
  c.innerHTML='<div class="category-header"><div class="category-name">我的收藏</div></div><div class="song-list" id="favSongList"></div>';
  renderSongList($('#favSongList'),list,true);
}

function renderRecent(c){
  if(!userState.github.loggedIn){c.innerHTML='<div class="empty-hint"><p>请先登录</p><p style="font-size:11px;color:var(--text3);margin-top:6px">登录后可查看最近听歌记录</p></div>';return}
  var raw=[];try{raw=JSON.parse(localStorage.getItem('dd_music_listen_history')||'[]')}catch{}
  if(!raw.length){c.innerHTML='<div class="empty-hint">暂无听歌记录</div>';return}
  // Dedup: same song id only keeps latest record
  var seen={},unique=[];
  for(var i=raw.length-1;i>=0;i--){
    var r=raw[i],rid=r.id||'';
    if(!rid||seen[rid])continue;
    seen[rid]=true;
    var pn={netease:'网易云',qq:'QQ音乐',kugou:'酷狗',kuwo:'酷我',bilibili:'B站',migu:'咪咕'};
    unique.push({
      id:rid,
      title:r.title||'未知',
      artist:r.artist||'',
      album:r.album||'',
      source:r.source||'',
      sourceName:pn[r.source]||r.source||'',
      ts:r.ts||0
    });
    if(unique.length>=50)break;
  }
  unique.reverse();
  if(!unique.length){c.innerHTML='<div class="empty-hint">暂无听歌记录</div>';return}
  c.innerHTML='<div class="category-header"><div class="category-name">最近听歌</div></div><div class="song-list">';
  var html=unique.map(function(s,i){
    var cv='',fav=isFav(s.id);
    var tStr=s.ts?new Date(s.ts).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    var playing=isCurrentPlaying(s.id);
    return'<div class="song-item'+(playing?' playing':'')+'" data-recent-idx="'+i+'" data-song-id="'+escHtml(s.id)+'"><div class="song-idx">'+(playing?miniWaveHtml():(i+1))+'</div><div class="song-info"><div class="song-title">'+escHtml(s.title)+'</div><div class="song-sub">'+escHtml(s.artist)+(s.album?' · '+escHtml(s.album):'')+(s.sourceName?' · '+escHtml(s.sourceName):'')+' <span class="song-dur">'+tStr+'</span></div></div><div class="song-actions"><button class="btn-action btn-fav '+(fav?'active':'')+'" data-recent-idx="'+i+'" title="收藏"><svg viewBox="0 0 24 24" width="14" height="14" fill="'+(fav?'currentColor':'none')+'" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></button></div></div>';
  }).join('');
  var existing=c.innerHTML;
  c.innerHTML=existing+html+'</div>';
  c.querySelectorAll('.song-item[data-recent-idx]').forEach(function(item){
    var idx=parseInt(item.dataset.recentIdx);
    item.addEventListener('click',function(e){if(e.target.closest('.btn-action'))return;
      var s=unique[idx];
      var fakeSong={id:s.id,title:s.title,artist:s.artist,source:s.source};
      showAudioWave();resolveUrl(fakeSong).then(function(u){if(u){queue=[fakeSong];currentIndex=0;updateQueueUI();loadAndPlay(fakeSong,u)}else{hideAudioWave();showToast('暂无播放源')}}).catch(function(){hideAudioWave();showToast('播放失败')})
    });
    item.querySelector('.btn-fav').addEventListener('click',function(e){e.stopPropagation();toggleFavorite(unique[idx])});
  });
}

// -- Settings --
var settingsState={bgBlur:false,bgTransparent:false};
function loadSettings(){try{var s=localStorage.getItem('dd_music_settings');if(s)settingsState=JSON.parse(s)}catch{}}
function saveSettings(){try{localStorage.setItem('dd_music_settings',JSON.stringify(settingsState))}catch{}}
loadSettings();
function renderSettings(c){
  c.innerHTML='<div class="settings-page">'+
    '<div class="settings-section"><div class="settings-section-title">播放效果</div>'+
    '<div class="settings-item"><div class="settings-item-info"><div class="settings-item-name">背景虚化</div><div class="settings-item-desc">使用歌曲封面高斯模糊作为播放页背景</div></div>'+
    '<label class="toggle"><input type="checkbox" id="settingBgBlur"'+(settingsState.bgBlur?' checked':'')+'><span class="toggle-track"></span></label></div>'+
    '<div class="settings-item"><div class="settings-item-info"><div class="settings-item-name">背景透明</div><div class="settings-item-desc">开启后背景可透视，关闭为纯黑底</div></div>'+
    '<label class="toggle"><input type="checkbox" id="settingBgTransparent"'+(settingsState.bgTransparent?' checked':'')+'><span class="toggle-track"></span></label></div>'+
    '</div></div>';
  var blurInput=$('#settingBgBlur');
  if(blurInput)blurInput.addEventListener('change',function(){
    settingsState.bgBlur=blurInput.checked;
    saveSettings();applySettings();
  });
  var transInput=$('#settingBgTransparent');
  if(transInput)transInput.addEventListener('change',function(){
    settingsState.bgTransparent=transInput.checked;
    saveSettings();applySettings();
  });
  applySettings();
}
function applySettings(){
  var bg=$('#npBg'),backdrop=$('.np-backdrop');
  if(bg){
    if(settingsState.bgBlur){bg.classList.add('bg-visible','blur-enabled')}
    else{bg.classList.remove('blur-enabled');if(!settingsState.bgTransparent)bg.classList.remove('bg-visible')}
  }
  if(backdrop){
    if(settingsState.bgTransparent){backdrop.classList.add('translucent')}
    else{backdrop.classList.remove('translucent')}
  }
}

function renderMyPlaylists(c){
  var platforms=[{key:'netease',name:'网易云',color:'#D81E06'},{key:'qq',name:'QQ音乐',color:'#31c27c'},{key:'kugou',name:'酷狗',color:'#2e8bff'},{key:'kuwo',name:'酷我',color:'#ffcc00'},{key:'migu',name:'咪咕',color:'#e5004f'},{key:'bilibili',name:'B站',color:'#fb7299'}];
  c.innerHTML='<div class="mine-plat-tabs" id="minePlatTabs">'+platforms.map(function(p){var bound=userState[p.key]&&userState[p.key].loggedIn;return'<button class="mine-plat-tab'+(p.key==='netease'?' active':'')+'" data-pk="'+p.key+'" style="--pc:'+p.color+'"><span>'+p.name+'</span>'+(bound?'<span class="bound-dot"></span>':'')+'</button>'}).join('')+'</div><div class="mine-plat-content" id="minePlatContent"></div>';
  c.querySelectorAll('.mine-plat-tab').forEach(function(tab){tab.addEventListener('click',function(){c.querySelectorAll('.mine-plat-tab').forEach(function(t){t.classList.remove('active')});tab.classList.add('active');loadPlatformPlaylists(tab.dataset.pk)})});
  loadPlatformPlaylists('netease');
}

async function loadPlatformPlaylists(pk){
  var c=$('#minePlatContent');if(!c)return;
  if(pk!=='netease'){c.innerHTML='<div class="empty-hint"><p>功能暂未开放</p><p style="font-size:11px;color:var(--text3);margin-top:6px">该平台绑定即将上线</p></div>';return}
  if(!userState.netease.loggedIn||!userState.netease.cookie||!userState.netease.uid){
    c.innerHTML='<div class="empty-hint"><p>未绑定网易云账号</p><button class="btn-primary" style="width:auto;margin-top:12px" id="btnBindNetease">绑定账号</button></div>';
    var btn=$('#btnBindNetease');if(btn)btn.addEventListener('click',function(){openBindModal('netease')});
    return;
  }
  c.innerHTML='<div class="loading"><div class="spinner"></div><span>加载歌单...</span></div>';
  try{var d=await apiCall({action:'user_playlist',platform:'netease',uid:userState.netease.uid,cookie:userState.netease.cookie});var pls=d.playlists||[];if(!pls.length){c.innerHTML='<div class="empty-hint">暂无歌单</div>';return}c.innerHTML='<div class="playlist-grid">'+pls.map(function(p,i){var cv=https(p.cover_img_url||'');return'<div class="playlist-card" data-mine-idx="'+i+'"><div class="card-cover"><img src="'+cv+'" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div><div class="card-title">'+escHtml(p.title||'')+'</div></div>'}).join('')+'</div>';playlists=pls;c.querySelectorAll('.playlist-card[data-mine-idx]').forEach(function(card){card.addEventListener('click',function(){var i=parseInt(card.dataset.mineIdx);if(playlists[i])openPlaylist(playlists[i])})})}catch(e){c.innerHTML='<div class="empty-hint">加载失败</div>'}
}

// -- Bind Cookie Modal --
var bindPlatform='';
function openBindModal(platform){bindPlatform=platform;$('#bindModalTitle').textContent='绑定'+(platform==='netease'?'网易云':'平台');$('#bindModalHint').textContent=platform==='netease'?'粘贴你的网易云Cookie（从浏览器开发者工具获取 Music_u 值）':'';$('#bindCookieInput').value='';$('#bindStatus').innerHTML='';$('#bindModal').style.display=''}
$('#closeBindModal').addEventListener('click',function(){$('#bindModal').style.display='none'});
$('#bindModal').addEventListener('click',function(e){if(e.target===$('#bindModal'))$('#bindModal').style.display='none'});

$('#bindCookieBtn').addEventListener('click',async function(){
  var cookie=$('#bindCookieInput').value.trim();if(!cookie){$('#bindStatus').innerHTML='<div class="login-error">请输入Cookie</div>';return}
  $('#bindLoading').style.display='';
  try{if(bindPlatform==='netease'){
    var d=await apiCall({action:'login_check',platform:'netease',cookie:cookie});
    if(d.ok){userState.netease={cookie:cookie,uid:String(d.uid),nickname:d.nickname,avatar:https(d.avatar||''),loggedIn:true};saveUserState();
      if(userState.github.loggedIn)apiCall({action:'netease_bind',github_id:userState.github.id,ne_cookie:cookie}).catch(function(){})
      $('#bindStatus').innerHTML='<div class="login-success">✓ 绑定成功：'+escHtml(d.nickname)+'</div>';showToast('网易云绑定成功');setTimeout(function(){$('#bindModal').style.display='none';renderMinePage()},1000)
    }else{$('#bindStatus').innerHTML='<div class="login-error">✗ Cookie无效</div>'}
  }}catch(e){$('#bindStatus').innerHTML='<div class="login-error">✗ 验证失败</div>'}finally{$('#bindLoading').style.display='none'}
});

// -- Login button (v3.3: no popup, background-image for avatar) --
$('#btnLogin').addEventListener('click',function(){
  if(userState.github.loggedIn){switchView('mine');mineActiveTab='mine';renderMinePage();$$('#platformTabs .platform-tab').forEach(function(t){t.classList.remove('active')});var m=$('[data-platform="mine"]');if(m)m.classList.add('active')}
  else openLoginModal();
});

// -- Login (GitHub) --
function openLoginModal(){$('#loginModal').style.display=''}
$('#closeLoginModal').addEventListener('click',function(){$('#loginModal').style.display='none'});
$('#loginModal').addEventListener('click',function(e){if(e.target===$('#loginModal'))$('#loginModal').style.display='none'});
$('#ghLoginBtn').addEventListener('click',async function(){try{var d=await apiCall({action:'oauth_url'});if(d.url)window.location.href=d.url}catch(e){showToast('获取授权链接失败')}});

function checkOAuthCallback(){
  // Channel 1: hash fragment
  var h=location.hash;
  console.log('[DD] checkOAuth hash:', h ? h.substring(0,30) : '(empty)');
  if(h.startsWith('#oauth=')){
    try{var d=JSON.parse(decodeURIComponent(h.slice(7)));
      console.log('[DD] OAuth hash data ok:', d&&d.ok, 'login:', d&&d.login);
      if(d&&d.ok){
      userState.github={token:d.token||'',login:d.login||'',name:d.name||d.login||'',avatar:https(d.avatar||''),id:String(d.id||''),loggedIn:true};
      saveUserState();updateLoginBtn();showToast('✓ GitHub登录成功：'+userState.github.name);
      if(!localStorage.getItem('dd_music_first_login'))localStorage.setItem('dd_music_first_login',String(Date.now()));
      if(userState.github.id)apiCall({action:'listen_record',github_id:userState.github.id}).catch(function(){})
    }}catch(e){console.warn('[DD] OAuth hash parse error',e);showToast('OAuth解析失败')}
    history.replaceState(null,'','/');
    return;
  }
  if(h.startsWith('#oauth_error=')){showToast('登录失败: '+decodeURIComponent(h.slice(14)));history.replaceState(null,'','/');return}

  // Channel 2: cookie backup (some browsers lose hash on 302 redirect)
  try{
    var cookies=document.cookie;
    console.log('[DD] all cookies:', cookies || '(none)');
    var cArr=cookies.split(';');
    for(var i=0;i<cArr.length;i++){
      var c=cArr[i].trim();
      if(c.startsWith('dd_oauth=')){
        var val=JSON.parse(decodeURIComponent(c.slice(10)));
        console.log('[DD] OAuth cookie data ok:', val&&val.ok, 'login:', val&&val.l);
        if(val&&val.ok){
          userState.github={token:val.t||'',login:val.l||'',name:val.n||val.l||'',avatar:https(val.a||''),id:val.i||'',loggedIn:true};
          saveUserState();updateLoginBtn();showToast('✓ GitHub登录成功：'+userState.github.name);
          if(!localStorage.getItem('dd_music_first_login'))localStorage.setItem('dd_music_first_login',String(Date.now()));
          if(userState.github.id)apiCall({action:'listen_record',github_id:userState.github.id}).catch(function(){})
        }
        document.cookie='dd_oauth=; Path=/; Max-Age=0; SameSite=Lax; Secure';
        break;
      }
    }
  }catch(e){console.warn('[DD] OAuth cookie parse error',e)}
}

// Bulletproof avatar: preload image, then replace button content
// No background-image (CSS reset overrides it), no <img onerror> race condition
function updateLoginBtn(){
  var btn=$('#btnLogin');
  if(!btn){console.log('[DD] updateLoginBtn: btn NOT FOUND');return}
  if(userState.github.loggedIn){
    var name=userState.github.name||userState.github.login||'U';
    var initial=escHtml(name.charAt(0).toUpperCase());
    var av=userState.github.avatar;
    btn.title=name;
    console.log('[DD] updateLoginBtn: LOGGED IN name='+name+' avatar='+(av?av.substring(0,50):'(empty)'));
    if(av){
      btn.innerHTML='<div class="login-avatar-fallback">'+initial+'</div>';
      var img=new Image();
      img.onload=function(){console.log('[DD] Avatar loaded OK');btn.innerHTML='<img class="login-avatar-img" src="'+av+'" alt="">'};
      img.onerror=function(){console.log('[DD] Avatar load FAILED, using fallback');btn.innerHTML='<div class="login-avatar-fallback">'+initial+'</div>'};
      img.src=av;
    }else{
      console.log('[DD] No avatar URL, showing initial fallback');
      btn.innerHTML='<div class="login-avatar-fallback">'+initial+'</div>';
    }
  }else{
    console.log('[DD] updateLoginBtn: NOT logged in');
    btn.innerHTML='<svg class="icon-default" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    btn.title='登录';
  }
}

// -- Song Actions --
async function toggleFavorite(song){var id=song.id||'';if(!id)return;var idx=favorites.findIndex(function(f){return f.id===id});if(idx>=0){favorites.splice(idx,1);showToast('取消收藏');if(userState.github.loggedIn)apiCall({action:'favorite_remove',github_id:userState.github.id,song_id:id}).catch(function(){})}else{favorites.push({id:id,title:song.title||song.name||'',artist:song.artist||'',img_url:https(song.img_url||song.cover||''),source:song.source||currentPlatform,ts:Date.now()});showToast('已收藏');if(userState.github.loggedIn)apiCall({action:'favorite_add',github_id:userState.github.id,song_id:id,song_title:song.title||song.name||'',song_artist:song.artist||'',song_cover:https(song.img_url||song.cover||''),song_source:song.source||currentPlatform}).catch(function(){})}saveFavorites();if(nowPlayingOpen)updateNpFavBtn();updatePlayerFavBtn();if(currentView==='detail'){songs=currentPlaylist?songs:songs;renderSongList($('#songList'),songs,true)}else if(currentView==='search')renderSongList($('#searchList'),songs,true);else if(currentView==='mine')renderMineContent()}

async function downloadSong(song){var tid=song.id||'';if(!tid)return;showToast('获取下载链接...');try{var p=song.source||currentPlatform;if(p==='mine')p='netease';var d=await apiCall({action:'bootstrap',platform:p,trackId:tid});if(d.url){showToast('下载中...');try{var r=await fetch(d.url);if(r.ok){var b=await r.blob();var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download=(song.title||song.name||'music')+'.mp3';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u)},1000);showToast('下载完成')}else throw new Error('status')}catch(corsErr){var a=document.createElement('a');a.href=d.url;a.download=(song.title||song.name||'music')+'.mp3';a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);showToast('已打开下载链接')}}else showToast('暂无下载源')}catch(e){showToast('下载失败')}}

async function shareSong(song){var id=song.id||'',p=song.source||currentPlatform;if(!id){showToast('分享失败：歌曲ID缺失');return}try{var params={action:'share_create',platform:p,song_id:id,title:song.title||song.name||'',artist:song.artist||'',cover:https(song.img_url||song.cover||''),share_user:userState.github.loggedIn?userState.github.login:''};var d=await apiCall(params);console.log('[DD] share_create response:',JSON.stringify(d));if(d&&d.code){var u='https://ddmusic.eu.cc/#s='+d.code;navigator.clipboard.writeText(u).then(function(){showToast('链接已复制，打开即可播放')}).catch(function(){showToast('复制失败')})}else{showToast('分享失败：'+(d&&d.error?d.error:'未知错误'))}}catch(e){console.error('[DD] share error:',e);showToast('分享失败：'+e.message)}}

// -- Audio wave loading indicator --
var _audioWaveEl=null;
function showAudioWave(){
  if(_audioWaveEl)return;
  var w=document.createElement('div');w.className='audio-wave';
  w.innerHTML='<span></span><span></span><span></span><span></span><span></span>';
  document.body.appendChild(w);_audioWaveEl=w;
}
function hideAudioWave(){if(_audioWaveEl){_audioWaveEl.remove();_audioWaveEl=null}}

// -- Playlist detail with pagination --
async function openPlaylist(p){
  currentPlaylist=p;switchView('detail');
  $('#breadcrumbTitle').textContent=p.title||p.name||'歌单';
  var cv=https(p.cover_img_url||p.cover||p.img||p.picUrl||p.pic||''),nm=p.title||p.name||'未知歌单';
  $('#detailHeader').innerHTML='<div class="detail-cover"><img src="'+cv+'" alt=""></div><div class="detail-info"><div class="detail-name">'+escHtml(nm)+'</div><button class="btn-play-all" id="btnPlayAll">播放全部</button></div>';
  var list=$('#songList');
  list.innerHTML='<div class="loading"><div class="spinner"></div><span>加载歌曲...</span></div>';
  // Reset pagination
  songs=[];playlistOffset=0;playlistTotal=0;
  currentListId=p.id||p.listId||'';currentListPlatform=p.source||currentPlatform;
  if(currentListPlatform==='mine')currentListPlatform='netease';
  await loadPlaylistPage();
  var pa=$('#btnPlayAll');if(pa)pa.addEventListener('click',function(){playAll(songs)})
}

async function loadPlaylistPage(){
  if(playlistLoading)return;playlistLoading=true;
  var list=$('#songList');
  // Show loading at bottom if appending
  if(songs.length>0){
    var loader=document.createElement('div');loader.className='loading';loader.id='pageLoader';
    loader.innerHTML='<div class="spinner"></div><span>加载更多...</span>';
    list.appendChild(loader)
  }
  try{
    var d=await apiCall({action:'chart',platform:currentListPlatform,listId:currentListId,offset:playlistOffset,limit:playlistLimit});
    var newSongs=d.tracks||d.list||(Array.isArray(d)?d:[]);
    playlistTotal=d.total||newSongs.length;
    // Remove loader
    var loader=$('#pageLoader');if(loader)loader.remove();
    if(!newSongs.length&&songs.length===0){list.innerHTML='<div class="empty-hint">歌单内暂无歌曲</div>';playlistLoading=false;return}
    songs=songs.concat(newSongs);playlistOffset=songs.length;
    // Re-render full list
    list.innerHTML='';
    renderSongList(list,songs,true);
    // Add "load more" button if there are more songs
    if(playlistOffset<playlistTotal){
      var moreBtn=document.createElement('button');moreBtn.className='btn-load-more';moreBtn.id='btnLoadMore';
      moreBtn.textContent='加载更多 ('+playlistOffset+'/'+playlistTotal+')';
      list.appendChild(moreBtn);
      moreBtn.addEventListener('click',function(){loadPlaylistPage()})
    }
  }catch(e){
    var loader=$('#pageLoader');if(loader)loader.remove();
    if(songs.length===0)list.innerHTML='<div class="empty-hint">加载失败</div>';
    else showToast('加载更多失败')
  }
  playlistLoading=false
}

// FIX: renderSongList uses innerHTML= (REPLACE not APPEND)
function renderSongList(container,list,isMine){
  var html=list.map(function(s,i){var t=s.title||s.name||'未知',a=s.artist||s.artistsname||s.author||'',al=s.album||s.albumname||'',cv=https(s.img_url||s.cover||s.img||s.picUrl||(s.al&&s.al.picUrl)||''),dur=s.duration||0,fav=isFav(s.id||''),cnt=s.count||0,playing=isCurrentPlaying(s.id||'');return'<div class="song-item'+(playing?' playing':'')+'" data-idx="'+i+'" data-song-id="'+escHtml(s.id||'')+'"><div class="song-idx">'+(playing?miniWaveHtml():(i+1))+'</div><div class="song-cover"><img src="'+cv+'" alt="" loading="lazy"></div><div class="song-info"><div class="song-title">'+escHtml(t)+'</div><div class="song-sub">'+escHtml(a)+(al?' · '+escHtml(al):'')+(dur?' <span class="song-dur">'+fmtTime(dur)+'</span>':'')+(cnt?' <span class="song-cnt">'+cnt+'次</span>':'')+'</div></div><div class="song-actions"><button class="btn-action btn-fav '+(fav?'active':'')+'" data-idx="'+i+'" title="收藏"><svg viewBox="0 0 24 24" width="14" height="14" fill="'+(fav?'currentColor':'none')+'" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></button><button class="btn-action btn-add-queue" data-idx="'+i+'" title="加入队列"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button><button class="btn-action btn-download" data-idx="'+i+'" title="下载"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button><button class="btn-action btn-share" data-idx="'+i+'" title="分享"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg></button></div></div>'}).join('');
  var existing=container.innerHTML;
  // If container has category-header or detail-header, preserve it, replace the rest
  var headerMatch=existing.match(/^(<div class="category-header">.*?<\/div>)/s);
  container.innerHTML=(headerMatch?headerMatch[1]:'')+html;
  container.querySelectorAll('.song-item').forEach(function(item){var idx=parseInt(item.dataset.idx);item.addEventListener('click',function(e){if(e.target.closest('.btn-action'))return;playSongFromList(idx)});item.querySelector('.btn-fav').addEventListener('click',function(e){e.stopPropagation();toggleFavorite(list[idx])});item.querySelector('.btn-add-queue').addEventListener('click',function(e){e.stopPropagation();addToQueue(idx)});item.querySelector('.btn-download').addEventListener('click',function(e){e.stopPropagation();downloadSong(list[idx])});item.querySelector('.btn-share').addEventListener('click',function(e){e.stopPropagation();shareSong(list[idx])})});
}

// -- Search --
var searchTimer=null;
$('#searchInput').addEventListener('input',function(e){clearTimeout(searchTimer);var q=e.target.value.trim();if(!q){if(currentView==='search')switchView('home');return}searchTimer=setTimeout(function(){doSearch(q)},400)});
$('#searchInput').addEventListener('keydown',function(e){if(e.key==='Enter'){clearTimeout(searchTimer);var q=e.target.value.trim();if(q)doSearch(q)}});

var searchPlatform='netease';var searchKeyword='';
async function doSearch(q,plat){if(!q)return;searchKeyword=q;if(plat)searchPlatform=plat;switchView('search');$('#searchTitle').textContent='搜索：'+q;$('#breadcrumbTitle').textContent='搜索结果';updateSearchPlatTabs();var l=$('#searchList');l.innerHTML='<div class="loading"><div class="spinner"></div><span>搜索中...</span></div>';try{var d=await apiCall({action:'search',platform:searchPlatform,keyword:q});songs=d.result||d.list||d.tracks||(Array.isArray(d)?d:[]);if(!songs.length){l.innerHTML='<div class="empty-hint">未找到结果</div>';return}l.innerHTML='';renderSongList(l,songs,true)}catch(e){l.innerHTML='<div class="empty-hint">搜索失败</div>'}}
function updateSearchPlatTabs(){var tabs=document.querySelectorAll('.search-plat-tab');tabs.forEach(function(t){t.classList.toggle('active',t.dataset.platform===searchPlatform)})}
document.addEventListener('click',function(e){var t=e.target.closest('.search-plat-tab');if(!t)return;var p=t.dataset.platform;if(p===searchPlatform)return;searchPlatform=p;updateSearchPlatTabs();if(searchKeyword)doSearch(searchKeyword,p)});

// -- Playback --
async function playSongFromList(idx){var s=songs[idx];if(!s)return;currentIndex=idx;queue=songs.slice();updateQueueUI();showAudioWave();try{var u=await resolveUrl(s);if(u)loadAndPlay(s,u);else{hideAudioWave();showToast('暂无播放源')}}catch(e){hideAudioWave();showToast('播放失败')}}

async function playAll(list){if(!list.length)return;queue=list.slice();songs=list.slice();currentIndex=0;updateQueueUI();showAudioWave();try{var u=await resolveUrl(queue[0]);if(u)loadAndPlay(queue[0],u);else{hideAudioWave();showToast('暂无播放源')}}catch(e){hideAudioWave();showToast('播放失败')}}

async function resolveUrl(song){var tid=song.id||'';if(!tid)return null;var p=song.source||currentPlatform;if(p==='mine')p='netease';try{var d=await apiCall({action:'bootstrap',platform:p,trackId:tid});return d.url||null}catch(e){return null}}

function loadAndPlay(song,url){hideAudioWave();audio.src=url;audio.play().catch(function(e){console.warn('play blocked:',e)});isPlaying=true;currentSong=song;updatePlayBtn();updateNowPlaying(song);recordListen(song);updatePlayingIndicators()}

// -- Update playing indicators across all visible song lists --
function updatePlayingIndicators(){
  document.querySelectorAll('.song-item[data-song-id]').forEach(function(item){
    var id=item.dataset.songId,playing=isCurrentPlaying(id),idxDiv=item.querySelector('.song-idx');
    if(!idxDiv)return;
    if(playing){item.classList.add('playing');idxDiv.innerHTML=miniWaveHtml()}
    else{item.classList.remove('playing');var idx=parseInt(item.dataset.idx||item.dataset.recentIdx||'0');idxDiv.textContent=idx+1}
  });
  document.querySelectorAll('.queue-item[data-song-id]').forEach(function(item){
    var id=item.dataset.songId,playing=isCurrentPlaying(id),qiInfo=item.querySelector('.qi-info');
    if(playing){item.classList.add('playing');if(qiInfo&&!qiInfo.querySelector('.qi-playing-wave'))qiInfo.insertAdjacentHTML('afterbegin',qiWaveHtml())}
    else{item.classList.remove('playing');var w=qiInfo&&qiInfo.querySelector('.qi-playing-wave');if(w)w.remove()}
  })
}

function updateNowPlaying(song){currentSong=song;var t=song.title||song.name||'未知',a=song.artist||song.artistsname||song.author||'',cv=https(song.img_url||song.cover||song.img||song.picUrl||song.pic||(song.al&&song.al.picUrl)||'');$('#playerTitle').textContent=t;$('#playerArtist').textContent=a;var img=$('#playerCover'),logo=$('#playerCoverLogo');if(cv){img.src=cv;img.style.display='';logo.style.display='none'}else{img.style.display='none';logo.style.display=''}var pn={netease:'网易云',qq:'QQ音乐',kugou:'酷狗',kuwo:'酷我',bilibili:'B站',migu:'咪咕'};$('#platformBadge').textContent=pn[currentPlatform]||'';document.title=t+' - '+a+' | 顶点音乐';if(nowPlayingOpen)updateNowPlayingPage()}

function recordListen(song){try{var h=JSON.parse(localStorage.getItem('dd_music_listen_history')||'[]');h.push({id:song.id,title:song.title||song.name,artist:song.artist,album:song.album||'',source:song.source||currentPlatform,ts:Date.now()});if(h.length>500)h=h.slice(-500);localStorage.setItem('dd_music_listen_history',JSON.stringify(h))}catch{};var id=song.id||'';if(id){playCounts[id]=(playCounts[id]||0)+1;savePlayCounts();if(userState.github.loggedIn)apiCall({action:'listen_record',github_id:userState.github.id,song_id:id,song_title:song.title||song.name||'',song_artist:song.artist||'',song_source:song.source||currentPlatform}).catch(function(){})}}

function addToQueue(idx){var s=songs[idx];if(!s)return;queue.push(s);updateQueueUI();showToast('已加入队列')}
function removeFromQueue(idx){queue.splice(idx,1);if(currentIndex>=queue.length)currentIndex=queue.length-1;updateQueueUI()}

function updateQueueUI(){var l=$('#queueList');$('#queueCount').textContent=queue.length;var dot=$('#queueDot');queue.length>0?dot.classList.add('has-items'):dot.classList.remove('has-items');if(!queue.length){l.innerHTML='<div class="empty-hint">播放队列为空</div>';return}l.innerHTML=queue.map(function(s,i){var t=s.title||s.name||'未知',a=s.artist||'',cv=https(s.img_url||s.cover||s.img||s.picUrl||(s.al&&s.al.picUrl)||''),ac=i===currentIndex,playing=isCurrentPlaying(s.id||'');return'<div class="queue-item'+(ac?' active':'')+(playing?' playing':'')+'" data-idx="'+i+'" data-song-id="'+escHtml(s.id||'')+'"><div class="qi-cover"><img src="'+cv+'" alt="" loading="lazy"></div><div class="qi-info">'+(playing?qiWaveHtml():'')+'<span class="qi-title">'+escHtml(t)+'</span><span class="qi-artist">'+escHtml(a)+'</span></div><button class="qi-remove" data-idx="'+i+'"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>'}).join('');l.querySelectorAll('.queue-item').forEach(function(item){item.addEventListener('click',function(e){if(e.target.closest('.qi-remove')){removeFromQueue(parseInt(item.dataset.idx));return}currentIndex=parseInt(item.dataset.idx);var s=queue[currentIndex];resolveUrl(s).then(function(u){if(u)loadAndPlay(s,u)})})})}

// -- Loop --
$('#btnLoop').addEventListener('click',function(){if(loopMode==='none'){loopMode='one';audio.loop=true;showToast('单曲循环')}else if(loopMode==='one'){loopMode='all';audio.loop=false;showToast('列表循环')}else{loopMode='none';audio.loop=false;showToast('取消循环')}updateLoopIcon()});
// Player bar favorite button
$('#btnPlayerFav').addEventListener('click',function(){if(!currentSong)return;toggleFavorite(currentSong);updatePlayerFavBtn()});
function updatePlayerFavBtn(){var btn=$('#btnPlayerFav'),icon=$('#playerFavIcon');if(!btn||!currentSong)return;var fav=isFav(currentSong.id||'');if(fav){btn.classList.add('active');icon.setAttribute('fill','currentColor')}else{btn.classList.remove('active');icon.setAttribute('fill','none')}}
function updateLoopIcon(){var i=$('#loopIcon'),b=$('#btnLoop');b.classList.remove('loop-one','loop-all');if(loopMode==='one'){b.classList.add('loop-one');i.innerHTML='<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="12" y="15" text-anchor="middle" font-size="6" fill="currentColor" stroke="none">1</text>'}else if(loopMode==='all'){b.classList.add('loop-all');i.innerHTML='<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'}else{i.innerHTML='<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'}}

// -- Player controls --
$('#btnPlay').addEventListener('click',function(){if(!audio.src)return;if(isPlaying){audio.pause();isPlaying=false}else{audio.play().catch(function(){});isPlaying=true}updatePlayBtn()});
$('#btnPrev').addEventListener('click',function(){if(!queue.length)return;currentIndex=(currentIndex-1+queue.length)%queue.length;var s=queue[currentIndex];resolveUrl(s).then(function(u){if(u)loadAndPlay(s,u)})});
$('#btnNext').addEventListener('click',function(){if(!queue.length)return;if(loopMode!=='one')currentIndex=(currentIndex+1)%queue.length;var s=queue[currentIndex];resolveUrl(s).then(function(u){if(u)loadAndPlay(s,u)})});
$('#npPlay').addEventListener('click',function(){$('#btnPlay').click()});$('#npPrev').addEventListener('click',function(){$('#btnPrev').click()});$('#npNext').addEventListener('click',function(){$('#btnNext').click()});
$('#npProgressBar').addEventListener('click',function(e){if(!audio.duration)return;var r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration});
// NP action buttons
$('#npFav').addEventListener('click',function(){if(currentSong)toggleFavorite(currentSong);updateNpFavBtn()});
$('#npDownload').addEventListener('click',function(){if(currentSong)downloadSong(currentSong)});
$('#npShare').addEventListener('click',function(){if(currentSong)shareSong(currentSong)});
function updateNpFavBtn(){var btn=$('#npFav');if(!btn||!currentSong)return;var fav=isFav(currentSong.id||'');if(fav){btn.classList.add('active');btn.querySelector('svg').setAttribute('fill','currentColor')}else{btn.classList.remove('active');btn.querySelector('svg').setAttribute('fill','none')}}

function updatePlayBtn(){var i=$('#playIcon'),ni=$('#npPlayIcon'),cw=$('#playerCoverWrap');if(isPlaying){i.innerHTML='<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';ni.innerHTML='<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';$('#btnPlay').classList.add('playing');$('#npPlay').classList.add('playing');$('#player').classList.add('active');$('#npVinyl').classList.add('spinning');if(cw)cw.classList.add('spinning')}else{i.innerHTML='<path d="M8 5v14l11-7z"/>';ni.innerHTML='<path d="M8 5v14l11-7z"/>';$('#btnPlay').classList.remove('playing');$('#npPlay').classList.remove('playing');$('#player').classList.remove('active');$('#npVinyl').classList.remove('spinning');if(cw)cw.classList.remove('spinning')}updatePlayerFavBtn();updatePlayingIndicators()}

audio.addEventListener('timeupdate',function(){if(!audio.duration)return;var p=(audio.currentTime/audio.duration)*100;$('#progressFill').style.width=p+'%';$('#currentTime').textContent=fmtTime(audio.currentTime);$('#duration').textContent=fmtTime(audio.duration);if(nowPlayingOpen){$('#npProgressFill').style.width=p+'%';$('#npCurrentTime').textContent=fmtTime(audio.currentTime);$('#npDuration').textContent=fmtTime(audio.duration);syncLyric(audio.currentTime)}});
$('#progressBar').addEventListener('click',function(e){if(!audio.duration)return;var r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration});
$('#btnVolume').addEventListener('click',function(){audio.muted=!audio.muted;updateVolumeIcon()});
$('#volumeBar').addEventListener('click',function(e){var r=e.currentTarget.getBoundingClientRect();volume=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));audio.volume=volume;audio.muted=false;$('#volumeFill').style.width=(volume*100)+'%';updateVolumeIcon()});
function updateVolumeIcon(){var i=$('#volumeIcon');if(audio.muted||volume===0)i.innerHTML='<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.56-1.42 1.01-2.25 1.32v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';else i.innerHTML='<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>'}
audio.addEventListener('ended',function(){if(loopMode==='one')return;if(queue.length){if(loopMode==='all')currentIndex=(currentIndex+1)%queue.length;else{currentIndex++;if(currentIndex>=queue.length){isPlaying=false;updatePlayBtn();return}}var s=queue[currentIndex];resolveUrl(s).then(function(u){if(u)loadAndPlay(s,u)})}});
audio.addEventListener('error',function(){showToast('播放失败')});

function showToast(msg){var t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);requestAnimationFrame(function(){t.classList.add('show')});setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove()},300)},2500)}
$('#clearPlaylist').addEventListener('click',function(){queue=[];currentIndex=-1;updateQueueUI()});
$('#btnBack').addEventListener('click',function(){if(currentView!=='home'){switchView('home');$('#searchInput').value=''}});

$$('#platformTabs .platform-tab').forEach(function(tab){tab.addEventListener('click',function(){$$('#platformTabs .platform-tab').forEach(function(t){t.classList.remove('active')});tab.classList.add('active');currentPlatform=tab.dataset.platform;if(currentPlatform==='mine'){switchView('mine');renderMinePage()}else{switchView('home');loadHome()}})});

document.addEventListener('keydown',function(e){if(e.target.tagName==='INPUT')return;if(e.code==='Space'){e.preventDefault();$('#btnPlay').click()}if(e.code==='Escape'&&nowPlayingOpen)closeNowPlaying()});

checkOAuthCallback();
// Auto-play from shared link: #s=CODE (DB lookup) or #play=platform_id (legacy)
function showShareLoading(title,artist,cover){
  var el=document.createElement('div');el.className='share-loading';
  el.innerHTML='<div class="share-loading-cover">'+(cover?'<img src="'+cover+'" alt="">':'')+'</div>'+
    '<div class="share-loading-title">'+escHtml(title||'加载中...')+'</div>'+
    '<div class="share-loading-artist">'+escHtml(artist||'')+'</div>'+
    '<div class="share-loading-spinner"></div>';
  document.body.appendChild(el);return el;
}
(function(){
  var h=location.hash;
  if(h.startsWith('#s=')){
    var code=h.slice(3);
    history.replaceState(null,'','/');
    var loadingEl=showShareLoading('','',null);
    setTimeout(function(){
      apiCall({action:'share_get',code:code}).then(function(d){
        if(d&&d.ok){
          if(d.cover)loadingEl.querySelector('.share-loading-cover').innerHTML='<img src="'+d.cover+'" alt="">';
          loadingEl.querySelector('.share-loading-title').textContent=d.title||'未知歌曲';
          loadingEl.querySelector('.share-loading-artist').textContent=d.artist||'';
          var s={id:d.song_id,title:d.title||'',artist:d.artist||'',source:d.platform};
          if(d.cover) s.img_url=d.cover;
          resolveUrl(s).then(function(u){loadingEl.remove();if(u)loadAndPlay(s,u);else showToast('暂无播放源')}).catch(function(){loadingEl.remove();showToast('播放失败')})
        }else{loadingEl.remove();showToast('分享链接无效')}
      }).catch(function(){loadingEl.remove();showToast('分享链接无效')});
    },300);
  }else if(h.startsWith('#play=')){
    var parts=h.slice(6).split('_');
    var plat=parts[0]||'netease',tid=decodeURIComponent(parts.slice(1).join('_'));
    if(tid){
      history.replaceState(null,'/');
      setTimeout(function(){
        var fakeSong={id:tid,title:'',artist:'',source:plat};
        showAudioWave();
        resolveUrl(fakeSong).then(function(u){if(u)loadAndPlay(fakeSong,u);else{hideAudioWave();showToast('暂无播放源')}}).catch(function(){hideAudioWave();showToast('播放失败')});
      },800);
    }
  }
})();
// Debug: show login state on load
console.log('[DD] After checkOAuth: loggedIn='+userState.github.loggedIn+(userState.github.loggedIn?' name='+userState.github.name+' avatar='+(userState.github.avatar||'').substring(0,50):''));
showToast(userState.github.loggedIn?'已登录: '+userState.github.name:'未登录');
updateLoginBtn();loadHome();

// Safety net: re-apply avatar every 2s if login state doesn't match button appearance
// This catches: CDN cache serving old JS, race conditions, anything that overwrites the button
var _lastLoginState=userState.github.loggedIn;
setInterval(function(){
  if(userState.github.loggedIn!==_lastLoginState){
    _lastLoginState=userState.github.loggedIn;
    updateLoginBtn();
  }
  // Also check if button content got reset (e.g., by cached old code)
  var btn=$('#btnLogin');
  if(btn&&userState.github.loggedIn){
    var hasAvatar=btn.querySelector('.login-avatar-img')||btn.querySelector('.login-avatar-fallback');
    if(!hasAvatar){updateLoginBtn()}
  }
},2000);
