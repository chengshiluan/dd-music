// 顶点音乐 DD Music - API Proxy Worker v3.1 (D1)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const REF = {
  'music.163.com': 'https://music.163.com/',
  'y.qq.com': 'https://y.qq.com/',
  'kugou.com': 'https://www.kugou.com/',
  'kuwo.cn': 'https://www.kuwo.cn/',
  'bilibili.com': 'https://www.bilibili.com/',
  'migu.cn': 'https://music.migu.cn/',
};

function refFor(h) { for (const [k, v] of Object.entries(REF)) if (h.includes(k)) return v; return ''; }

async function proxyGet(url, referer, extraHeaders) {
  const h = { 'User-Agent': UA, 'Accept': 'application/json, */*', 'Accept-Encoding': 'gzip, deflate' };
  if (referer) h['Referer'] = referer;
  if (extraHeaders) Object.assign(h, extraHeaders);
  const r = await fetch(url, { headers: h, redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch {
    return { _proxy_error: true, status: r.status, body: t.slice(0, 500) };
  }
}

async function proxyPost(url, body, referer, extraHeaders) {
  const u = new URL(url);
  const h = { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': '*/*' };
  if (referer || refFor(u.hostname)) h['Referer'] = referer || refFor(u.hostname);
  if (extraHeaders) Object.assign(h, extraHeaders);
  const r = await fetch(url, { method: 'POST', headers: h, body, redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch {
    return { _proxy_error: true, status: r.status, body: t.slice(0, 500) };
  }
}

async function proxyPostJson(url, data, referer) {
  const u = new URL(url);
  const h = { 'User-Agent': UA, 'Content-Type': 'application/json', 'Referer': referer || refFor(u.hostname) || 'https://y.qq.com/' };
  const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(data), redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch {
    return { _proxy_error: true, status: r.status, body: t.slice(0, 500) };
  }
}

function htmlDecode(str) {
  if (!str) return '';
  const entities = [['amp','&'],['apos',"'"],['lt','<'],['gt','>'],['nbsp',' '],['quot','"'],['#39',"'"]];
  let text = str;
  for (const [entity, char] of entities) text = text.replace(new RegExp(`&${entity};`, 'g'), char);
  return text;
}

// ─── MD5 (for B站 app signing & Wbi signing) ───
function md5(str) {
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  function cmn(q, a, b, x, s, t) { return add32(add32(add32(a, q), add32(x, t)), s); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function cycle(x, k) {
    var a=x[0],b=x[1],c=x[2],d=x[3];
    a=ff(a,b,c,d,k[0],7,-680876936);d=ff(d,a,b,c,k[1],12,-389564586);c=ff(c,d,a,b,k[2],17,606105819);b=ff(b,c,d,a,k[3],22,-1044525330);
    a=ff(a,b,c,d,k[4],7,-176418897);d=ff(d,a,b,c,k[5],12,1200080426);c=ff(c,d,a,b,k[6],17,-1473231341);b=ff(b,c,d,a,k[7],22,-45705983);
    a=ff(a,b,c,d,k[8],7,1732584194);d=ff(d,a,b,c,k[9],12,-1926607734);c=ff(c,d,a,b,k[10],17,-378558);b=ff(b,c,d,a,k[11],22,-2022584463);
    a=ff(a,b,c,d,k[12],7,1839030562);d=ff(d,a,b,c,k[13],12,-35309556);c=ff(c,d,a,b,k[14],17,-1530992060);b=ff(b,c,d,a,k[15],22,1272893353);
    a=gg(a,b,c,d,k[1],5,-165796510);d=gg(d,a,b,c,k[6],9,-1069501632);c=gg(c,d,a,b,k[11],14,643717713);b=gg(b,c,d,a,k[0],20,-373897302);
    a=gg(a,b,c,d,k[5],5,-701558691);d=gg(d,a,b,c,k[10],9,38016083);c=gg(c,d,a,b,k[15],14,-660478335);b=gg(b,c,d,a,k[4],20,-405537848);
    a=gg(a,b,c,d,k[9],5,568446438);d=gg(d,a,b,c,k[14],9,-1019803690);c=gg(c,d,a,b,k[3],14,-187363961);b=gg(b,c,d,a,k[8],20,1163531501);
    a=gg(a,b,c,d,k[13],5,-1444681467);d=gg(d,a,b,c,k[2],9,-51403784);c=gg(c,d,a,b,k[7],14,1735328473);b=gg(b,c,d,a,k[12],20,-1926607734);
    a=hh(a,b,c,d,k[5],4,-378558);d=hh(d,a,b,c,k[8],11,-2022584463);c=hh(c,d,a,b,k[11],16,1839030562);b=hh(b,c,d,a,k[14],23,-35309556);
    a=hh(a,b,c,d,k[1],4,-1530992060);d=hh(d,a,b,c,k[4],11,1272893353);c=hh(c,d,a,b,k[7],16,-155497632);b=hh(b,c,d,a,k[10],23,-1094730640);
    a=hh(a,b,c,d,k[13],4,681279174);d=hh(d,a,b,c,k[0],11,-358537222);c=hh(c,d,a,b,k[3],16,-722521979);b=hh(b,c,d,a,k[6],23,76029189);
    a=hh(a,b,c,d,k[9],4,-640364487);d=hh(d,a,b,c,k[12],11,-421815835);c=hh(c,d,a,b,k[15],16,530742520);b=hh(b,c,d,a,k[2],23,-995338651);
    a=ii(a,b,c,d,k[0],6,-198630844);d=ii(d,a,b,c,k[7],10,1126891415);c=ii(c,d,a,b,k[14],15,-1416354905);b=ii(b,c,d,a,k[5],21,-57434055);
    a=ii(a,b,c,d,k[12],6,1700485571);d=ii(d,a,b,c,k[3],10,-1894986606);c=ii(c,d,a,b,k[10],15,-1051523);b=ii(b,c,d,a,k[1],21,-2054922799);
    a=ii(a,b,c,d,k[8],6,1873313359);d=ii(d,a,b,c,k[15],10,-30611744);c=ii(c,d,a,b,k[6],15,-1560194385);b=ii(b,c,d,a,k[13],21,1309151649);
    a=ii(a,b,c,d,k[4],6,-145523070);d=ii(d,a,b,c,k[11],10,-1120210379);c=ii(c,d,a,b,k[2],15,718787259);b=ii(b,c,d,a,k[9],21,-343485551);
    x[0]=add32(a,x[0]);x[1]=add32(b,x[1]);x[2]=add32(c,x[2]);x[3]=add32(d,x[3]);
  }
  function blk(s){var b=[],i;for(i=0;i<64;i+=4)b[i>>2]=s.charCodeAt(i)+(s.charCodeAt(i+1)<<8)+(s.charCodeAt(i+2)<<16)+(s.charCodeAt(i+3)<<24);return b;}
  var n=str.length,st=[1732584193,-271733879,-1732584194,271733878],i;
  for(i=64;i<=n;i+=64)cycle(st,blk(str.substring(i-64,i)));
  str=str.substring(i-64);var tl=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  for(i=0;i<str.length;i++)tl[i>>2]|=str.charCodeAt(i)<<(i%4<<3);
  tl[i>>2]|=0x80<<(i%4<<3);if(i>55){cycle(st,tl);for(i=0;i<16;i++)tl[i]=0;}
  tl[14]=n*8;cycle(st,tl);
  return('0000000'+(st[0]>>>0).toString(16)).slice(-8)+('0000000'+(st[1]>>>0).toString(16)).slice(-8)+('0000000'+(st[2]>>>0).toString(16)).slice(-8)+('0000000'+(st[3]>>>0).toString(16)).slice(-8);
}

// ─── Netease ───
async function neSearch(kw, pg, neCookie) {
  const offset = 20 * ((pg || 1) - 1);
  const hdr = neCookie ? { 'Cookie': neCookie } : undefined;
  const d = await proxyGet('https://music.163.com/api/cloudsearch/pc?s=' + encodeURIComponent(kw) + '&offset=' + offset + '&limit=20&type=1', 'https://music.163.com/', hdr);
  if (d._proxy_error) return d;
  const songs = d.result?.songs || [];
  return {
    result: songs.map(s => ({
      id: 'netrack_' + s.id, title: s.name,
      artist: s.ar?.[0]?.name || s.artists?.[0]?.name || '',
      artist_id: 'neartist_' + (s.ar?.[0]?.id || s.artists?.[0]?.id || ''),
      album: s.al?.name || s.album?.name || '',
      album_id: 'nealbum_' + (s.al?.id || s.album?.id || ''),
      source: 'netease', source_url: 'https://music.163.com/#/song?id=' + s.id,
      img_url: s.al?.picUrl || s.album?.picUrl || '',
      duration: Math.floor((s.dt || s.duration || 0) / 1000),
      disable: s.fee === 4 || s.fee === 1,
    })),
    total: d.result?.songCount || 0,
  };
}

async function neBootstrap(tid, neCookie) {
  const songId = tid.replace('netrack_', '');
  const outerUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
  const hdr = { 'User-Agent': UA, 'Referer': 'https://music.163.com/' };
  if (neCookie) hdr['Cookie'] = neCookie;
  try {
    const r = await fetch(outerUrl, {
      headers: hdr,
      redirect: 'manual',
    });
    const loc = r.headers.get('location');
    if (loc && !loc.includes('404') && !loc.includes('music.163.com/404')) {
      return { url: loc || outerUrl, platform: 'netease' };
    }
  } catch {}
  return { url: outerUrl, platform: 'netease' };
}

async function neChart(neCookie) {
  const hdr = neCookie ? { 'Cookie': neCookie } : undefined;
  const d = await proxyGet('https://music.163.com/api/toplist', 'https://music.163.com/', hdr);
  if (d._proxy_error || !d.list) return [];
  return d.list.slice(0, 10).map(item => ({
    id: 'neplaylist_' + item.id, title: item.name,
    cover_img_url: item.coverImgUrl, source: 'netease',
    source_url: 'https://music.163.com/#/playlist?id=' + item.id,
  }));
}

async function nePlaylistTracks(listId, offset, limit, neCookie) {
  const pid = listId.replace('neplaylist_', '');
  const off = parseInt(offset) || 0;
  const lim = parseInt(limit) || 50;
  const hdr = neCookie ? { 'Cookie': neCookie } : undefined;
  // Use playlist/track/all for paginated track loading
  const url = 'https://music.163.com/api/v6/playlist/detail?id=' + pid + '&n=' + lim + '&s=0' + (off > 0 ? '&offset=' + off : '');
  const d = await proxyGet(url, 'https://music.163.com/', hdr);
  if (d._proxy_error || !d.playlist) return { tracks: [], total: 0, offset: off, limit: lim };
  const allTrackIds = d.playlist.trackIds || [];
  const total = allTrackIds.length || d.playlist.trackCount || 0;
  const tracks = (d.playlist.tracks || []).map(t => ({
    id: 'netrack_' + t.id, title: t.name,
    artist: t.ar?.[0]?.name || '', artist_id: 'neartist_' + (t.ar?.[0]?.id || ''),
    album: t.al?.name || '', album_id: 'nealbum_' + (t.al?.id || ''),
    source: 'netease', source_url: 'https://music.163.com/#/song?id=' + t.id,
    img_url: t.al?.picUrl || '', duration: Math.floor((t.dt || 0) / 1000),
    disable: t.fee === 4 || t.fee === 1,
  }));
  // If playlist/detail didn't return full tracks, try the track/all API for pagination
  if (tracks.length === 0 && allTrackIds.length > 0) {
    const trackAllUrl = 'https://music.163.com/api/playlist/track/all?id=' + pid + '&limit=' + lim + '&offset=' + off;
    const d2 = await proxyGet(trackAllUrl, 'https://music.163.com/', hdr);
    if (!d2._proxy_error && d2.songs) {
      const mapped = d2.songs.map(t => ({
        id: 'netrack_' + t.id, title: t.name,
        artist: t.ar?.[0]?.name || '', artist_id: 'neartist_' + (t.ar?.[0]?.id || ''),
        album: t.al?.name || '', album_id: 'nealbum_' + (t.al?.id || ''),
        source: 'netease', source_url: 'https://music.163.com/#/song?id=' + t.id,
        img_url: t.al?.picUrl || '', duration: Math.floor((t.dt || 0) / 1000),
        disable: t.fee === 4 || t.fee === 1,
      }));
      return { tracks: mapped, total, offset: off, limit: lim };
    }
  }
  return { tracks, total, offset: off, limit: lim };
}

const NE_CATEGORIES = ["华语", "流行", "摇滚", "民谣", "电子", "说唱", "R&B", "古风", "轻音乐", "ACG"];

async function neDiscover(neCookie) {
  const hdr = neCookie ? { 'Cookie': neCookie } : undefined;
  const results = await Promise.all(NE_CATEGORIES.map(async (cat) => {
    const d = await proxyGet(
      "https://music.163.com/api/playlist/list?cat=" + encodeURIComponent(cat) + "&offset=0&limit=12",
      "https://music.163.com/",
      hdr
    );
    if (d._proxy_error || !d.playlists) return { category: cat, playlists: [] };
    return {
      category: cat,
      playlists: d.playlists.map(item => ({
        id: "neplaylist_" + item.id, title: item.name,
        cover_img_url: item.coverImgUrl, source: "netease",
        playCount: item.playCount || 0,
        source_url: "https://music.163.com/#/playlist?id=" + item.id,
      }))
    };
  }));
  return results.filter(r => r.playlists.length > 0);
}

async function neLyric(trackId, neCookie) {
  const songId = trackId.replace('netrack_', '');
  const hdr = neCookie ? { 'Cookie': neCookie } : undefined;
  const d = await proxyGet('https://music.163.com/api/song/lyric?id=' + songId + '&lv=1', 'https://music.163.com/', hdr);
  if (d._proxy_error) return { lyric: '', tlyric: '' };
  return { lyric: d.lrc?.lyric || '', tlyric: d.tlyric?.lyric || '' };
}

async function neUserPlaylists(uid, cookie) {
  if (!uid || !cookie) return { playlists: [], error: 'missing uid or cookie' };
  const h = { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://music.163.com/', 'Cookie': cookie };
  const r = await fetch('https://music.163.com/api/user/playlist/?uid=' + uid + '&limit=30&offset=0', { headers: h, redirect: 'follow' });
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); } catch { return { playlists: [], error: 'parse failed' }; }
  if (d.code !== 200 || !d.playlist) return { playlists: [], error: 'api returned code ' + d.code };
  return {
    playlists: d.playlist.map(item => ({
      id: 'neplaylist_' + item.id, title: item.name,
      cover_img_url: item.coverImgUrl, source: 'netease',
      playCount: item.playCount || 0, trackCount: item.trackCount || 0,
      creator: item.creator?.nickname || '',
      source_url: 'https://music.163.com/#/playlist?id=' + item.id,
    }))
  };
}

async function neLoginCheck(cookie) {
  if (!cookie) return { ok: false, error: 'no cookie' };
  const h = { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://music.163.com/', 'Cookie': cookie };
  const r = await fetch('https://music.163.com/api/nuser/account/get', { headers: h, redirect: 'follow' });
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); } catch { return { ok: false, error: 'parse failed' }; }
  if (d.code === 200 && d.profile) {
    return { ok: true, uid: d.profile.userId, nickname: d.profile.nickname, avatar: d.profile.avatarUrl };
  }
  return { ok: false, error: 'cookie invalid' };
}

// ─── QQ Music ───
async function qqSearch(kw, pg) {
  const d = await proxyPostJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '19', cv: '1859', uin: '0' },
    req: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService',
      param: { grp: 1, num_per_page: 20, page_num: pg || 1, query: kw, search_type: 0 } }
  });
  if (d._proxy_error) return d;
  const s = d.req?.data?.body?.song?.list || [];
  return { result: s.map(x => qqFormat(x)), total: d.req?.data?.meta?.sum || 0 };
}

function qqFormat(x) {
  return {
    id: 'qqtrack_' + x.mid || x.songmid, title: htmlDecode(x.name || x.songname),
    artist: htmlDecode(x.singer?.[0]?.name || ''), artist_id: 'qqartist_' + (x.singer?.[0]?.mid || ''),
    album: htmlDecode(x.album?.name || x.albumname || ''), album_id: 'qqalbum_' + (x.album?.mid || x.albummid || ''),
    source: 'qq', source_url: 'https://y.qq.com/#type=song&mid=' + (x.mid || x.songmid),
    img_url: (x.album?.mid || x.albummid) ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${x.album?.mid || x.albummid}.jpg` : '',
    duration: x.interval || 0,
  };
}

async function qqBootstrap(tid) {
  const mid = tid.replace('qqtrack_', '');
  // Try M500 (128kbps mp3) first, then C400 (m4a) fallback
  const fileTypes = [
    { prefix: 'M500', ext: '.mp3' },
    { prefix: 'C400', ext: '.m4a' },
  ];
  for (const ft of fileTypes) {
    const filename = ft.prefix + mid + mid + ft.ext;
    const d = await proxyPostJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      req_1: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
        param: { filename: [filename], guid: '10000', songmid: [mid], songtype: [0], uin: '0', loginflag: 1, platform: '20' } },
      loginUin: '0', comm: { uin: '0', format: 'json', ct: 24, cv: 0 }
    });
    if (d._proxy_error) continue;
    const purl = d.req_1?.data?.midurlinfo?.[0]?.purl;
    if (purl) return { url: (d.req_1?.data?.sip?.[0] || '') + purl, platform: 'qq' };
  }
  return { url: null };
}

async function qqChart() {
  const d = await proxyGet('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?g_tk=5381&inCharset=utf-8&outCharset=utf-8&notice=0&format=json&uin=0&needNewCode=1&platform=h5', 'https://y.qq.com/');
  if (d._proxy_error || !d.data) return [];
  return (d.data?.topList || []).map(i => ({
    id: 'qqtoplist_' + i.id, title: i.topTitle, cover_img_url: i.picUrl,
    source: 'qq', source_url: 'https://y.qq.com/n/yqq/toplist/' + i.id + '.html',
  }));
}

async function qqToplistSongs(lid) {
  const tid = lid.replace('qqtoplist_', '');
  const ds = JSON.stringify({ comm: { cv: 1602, ct: 20 }, toplist: { module: 'musicToplist.ToplistInfoServer', method: 'GetDetail', param: { topid: Number(tid), num: 50, period: '' } } });
  const d = await proxyGet('https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&inCharset=utf8&outCharset=utf-8&platform=yqq.json&needNewCode=0&data=' + encodeURIComponent(ds), 'https://y.qq.com/');
  if (d._proxy_error) return { tracks: [], info: {} };
  const info = {
    id: 'qqtoplist_' + tid, title: d.toplist?.data?.data?.title || '',
    cover_img_url: d.toplist?.data?.data?.frontPicUrl || '',
    source_url: 'https://y.qq.com/n/yqq/toplist/' + tid + '.html',
  };
  const tracks = (d.toplist?.data?.songInfoList || []).map(x => qqFormat(x));
  return { tracks, info };
}

// ─── Kugou ───
async function kgSearch(kw, pg) {
  const d = await proxyGet('http://mobilecdnbj.kugou.com/api/v3/search/song?keyword=' + encodeURIComponent(kw) + '&page=' + (pg || 1) + '&pagesize=20', 'https://www.kugou.com/');
  if (d._proxy_error) return d;
  const lists = d.data?.info || [];
  return {
    result: lists.map(s => ({
      id: 'kgtrack_' + s.hash, title: s.songname || s.filename?.split('-')?.pop()?.trim() || '',
      artist: s.singername || s.filename?.split('-')?.[0]?.trim() || '',
      album: s.album_name || '', album_id: 'kgalbum_' + (s.album_id || ''),
      source: 'kugou', source_url: 'https://www.kugou.com/song/#hash=' + s.hash,
      img_url: s.album_img ? s.album_img.replace('{size}', '400') : '',
      duration: s.duration || 0,
    })),
    total: d.data?.total || 0,
  };
}

async function kgBootstrap(tid) {
  const h = tid.replace('kgtrack_', '');
  const d = await proxyGet('https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + h, 'https://m.kugou.com/', { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X)' });
  if (d._proxy_error) return { url: null };
  return d.url ? { url: d.url, bitrate: (d.bitRate || 128) + 'kbps', platform: 'kugou' } : { url: null };
}

async function kgChart() {
  const d = await proxyGet('http://mobilecdnbj.kugou.com/api/v3/rank/list?version=9108&ranktype=1', 'https://m.kugou.com/');
  if (d._proxy_error || !d.data?.info) return [];
  return d.data.info.slice(0, 20).map(item => ({
    id: 'kgrank_' + item.rankid, title: item.rankname,
    cover_img_url: item.imgurl ? item.imgurl.replace('{size}', '400') : (item.banner_9 || '').replace('{size}', '400'),
    source: 'kugou', source_url: 'https://m.kugou.com/rank/info/' + item.rankid,
  }));
}

async function kgPlaylistTracks(listId) {
  const rid = listId.replace('kgrank_', '').replace('kgplaylist_', '');
  const d = await proxyGet('http://mobilecdnbj.kugou.com/api/v3/rank/song?version=9108&rankid=' + rid + '&ranktype=1&page=1&pagesize=100', 'https://m.kugou.com/');
  if (d._proxy_error || !d.data?.info) return { tracks: [], total: 0 };
  const info = d.data.info;
  return {
    tracks: info.map(s => ({
      id: 'kgtrack_' + s.hash, title: s.songname || s.filename?.split('-')?.pop()?.trim() || '',
      artist: s.singername || s.filename?.split('-')?.[0]?.trim() || '',
      album: s.album_name || '', source: 'kugou',
      source_url: 'https://www.kugou.com/song/#hash=' + s.hash,
      img_url: s.album_img ? s.album_img.replace('{size}', '400') : '',
      duration: s.duration || 0,
    })),
    total: d.data?.total || info.length,
  };
}

// ─── Kuwo ───
async function kuwoRequest(url) {
  const headers = { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://www.kuwo.cn/', 'Cookie': 'Hm_Iuvt=1', 'csrf': '1' };
  const r = await fetch(url, { headers, redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { _proxy_error: true, status: r.status, body: t.slice(0, 500) }; }
}

async function kwSearch(kw, pg) {
  const pn = (pg || 1) - 1;
  const url = `https://www.kuwo.cn/search/searchMusicBykeyWord?vipver=1&client=kt&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1&show_copyright_off=1&pn=${pn}&rn=20&all=${encodeURIComponent(kw)}`;
  try {
    const d = await kuwoRequest(url);
    if (d._proxy_error) {
      const d2 = await proxyGet(url, 'https://www.kuwo.cn/', { 'csrf': '1', 'Cookie': 'Hm_Iuvt=1' });
      if (d2._proxy_error) return { result: [], total: 0 };
      return formatKuwoResults(d2);
    }
    return formatKuwoResults(d);
  } catch (e) { return { result: [], total: 0, error: e.message }; }
}

function formatKuwoResults(d) {
  const list = d.abslist || [];
  return { result: list.map(s => ({
    id: 'kwtrack_' + s.DC_TARGETID, title: htmlDecode(s.NAME),
    artist: htmlDecode(s.ARTIST), artist_id: 'kwartist_' + s.ARTISTID,
    album: htmlDecode(s.ALBUM), album_id: 'kwalbum_' + s.ALBUMID,
    source: 'kuwo', source_url: 'https://www.kuwo.cn/play_detail/' + s.DC_TARGETID,
    img_url: s.web_albumpic_short ? `https://img2.kuwo.cn/star/albumcover/${s.web_albumpic_short}` : '',
    duration: parseInt(s.DURATION || 0), lyric_url: s.DC_TARGETID,
  })), total: parseInt(d.HIT || d.TOTAL || 0) };
}

async function kwBootstrap(tid) {
  const songId = tid.replace('kwtrack_', '');
  const url = `https://www.kuwo.cn/api/v1/www/music/playUrl?mid=${songId}&type=music&httpsStatus=1&reqId=&plat=web_www&from=`;
  const d = await kuwoRequest(url);
  if (d._proxy_error) return { url: null };
  if (d.data && d.data.url) return { url: d.data.url, platform: 'kuwo' };
  return { url: null };
}

async function kwChart() {
  // Listen1's show_playlist uses plain axios.get without Secret header
  // Try without Secret first, then with Secret as fallback
  const chartUrl = 'https://www.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?pn=1&rn=20&order=hot&httpsStatus=1';
  // Attempt 1: No Secret header (Listen1 approach)
  let d = await proxyGet(chartUrl, 'https://www.kuwo.cn/', { 'csrf': '1', 'Cookie': 'Hm_Iuvt=1' });
  if (!d._proxy_error && d.data?.data) {
    return d.data.data.map(item => ({
      id: 'kwplaylist_' + item.id, title: item.name,
      cover_img_url: item.img || '', source: 'kuwo',
      source_url: 'https://www.kuwo.cn/playlist_detail/' + item.id,
    }));
  }
  // Attempt 2: With Secret header (from homepage token)
  try {
    const tokenResp = await fetch('https://www.kuwo.cn/', { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const setCookies = [];
    try { const vals = tokenResp.headers.getAll('set-cookie'); if (Array.isArray(vals)) setCookies.push(...vals); } catch {}
    const sc = tokenResp.headers.get('set-cookie');
    if (sc) setCookies.push(sc);
    let token = '';
    for (const c of setCookies) {
      const m = c.match(/Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324=([^;]+)/);
      if (m) { token = m[1]; break; }
    }
    if (token) {
      const secret = kwComputeSecret(token, 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324');
      d = await proxyGet(chartUrl, 'https://www.kuwo.cn/', { 'Secret': secret, 'csrf': token.slice(0,8), 'Cookie': 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324=' + token });
      if (!d._proxy_error && d.data?.data) {
        return d.data.data.map(item => ({
          id: 'kwplaylist_' + item.id, title: item.name,
          cover_img_url: item.img || '', source: 'kuwo',
          source_url: 'https://www.kuwo.cn/playlist_detail/' + item.id,
        }));
      }
    }
  } catch {}
  // Attempt 3: Search fallback
  const d3 = await proxyGet('https://www.kuwo.cn/api/www/search/searchPlayListBykeyWord?key=流行&pn=1&rn=20', 'https://www.kuwo.cn/', { 'csrf': '1', 'Cookie': 'Hm_Iuvt=1' });
  if (!d3._proxy_error && d3.data?.list) {
    return d3.data.list.map(item => ({
      id: 'kwplaylist_' + (item.id || item.pid || ''), title: item.name || '',
      cover_img_url: item.img || item.pic || '', source: 'kuwo',
      source_url: 'https://www.kuwo.cn/playlist_detail/' + (item.id || item.pid || ''),
    }));
  }
  return [];
}

// Kuwo Secret header computation (ported from Listen1)
function kwComputeSecret(t, e) {
  if (!e || e.length <= 0) return '';
  let n = '';
  for (let i = 0; i < e.length; i++) n += e.charCodeAt(i).toString();
  const r = Math.floor(n.length / 5);
  const o = parseInt(n.charAt(r) + n.charAt(2*r) + n.charAt(3*r) + n.charAt(4*r) + n.charAt(5*r));
  const l = Math.ceil(e.length / 2);
  const c = Math.pow(2, 31) - 1;
  if (o < 2) return '';
  let d = Math.floor(Math.random() * 1e8);
  n += d.toString();
  while (n.length > 10) n = (parseInt(n.substring(0, 10)) + parseInt(n.substring(10))).toString();
  n = (o * parseInt(n) + l) % c;
  let f = '';
  for (let i = 0; i < t.length; i++) {
    const v = parseInt(t.charCodeAt(i) ^ Math.floor((n / c) * 255));
    f += (v < 16 ? '0' : '') + v.toString(16);
    n = (o * n + l) % c;
  }
  let ds = d.toString(16);
  while (ds.length < 8) ds = '0' + ds;
  return f + ds;
}

async function kwPlaylistTracks(listId) {
  const pid = listId.replace('kwplaylist_', '');
  const url = 'https://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pn=0&rn=100&encode=utf-8&keyset=pl2012&pcmp4=1&pid=' + pid + '&vipver=MUSIC_9.0.2.0_W1&newver=1';
  const d = await proxyGet(url, 'https://www.kuwo.cn/');
  if (d._proxy_error || !d.musiclist) return { tracks: [], total: 0 };
  const tracks = d.musiclist.map(s => ({
    id: 'kwtrack_' + (s.DC_TARGETID || s.tid || ''), title: htmlDecode(s.FSONGNAME || s.NAME || ''),
    artist: htmlDecode(s.FARTIST || s.ARTIST || ''), album: htmlDecode(s.FALBUM || s.ALBUM || ''),
    source: 'kuwo', source_url: 'https://www.kuwo.cn/play_detail/' + (s.DC_TARGETID || s.tid || ''),
    img_url: s.pic || s.img || '', duration: parseInt(s.DURATION || 0),
  }));
  return { tracks, total: d.total || tracks.length };
}

// ─── Bilibili ───
// Multi-layer approach: Mobile API → Wbi-signed Web API → Hardcoded fallback
// B站 blocks CF Workers IPs (-412) on api.bilibili.com, so we try app.bilibili.com first

const BI_APPKEY = '1d8b6e7d45233936';
const BI_APPSEC = 'b5eb9084928aa2c0ac4e3bb4b0e8a926';

function biAppSign(params) {
  const ts = String(Math.floor(Date.now() / 1000));
  const all = { ...params, appkey: BI_APPKEY, build: '6400000', mobi_app: 'android', platform: 'android', ts };
  const sorted = Object.keys(all).sort().map(k => k + '=' + all[k]).join('');
  all.sign = md5(sorted + BI_APPSEC);
  return all;
}

async function biAppGet(path, params) {
  const signed = biAppSign(params);
  const qs = Object.keys(signed).map(k => k + '=' + encodeURIComponent(signed[k])).join('&');
  return proxyGet('https://app.bilibili.com' + path + '?' + qs, 'https://www.bilibili.com/');
}

// Wbi signing (for newer web API endpoints)
const WBI_MIXIN_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
let _wbiKeys = null, _wbiTs = 0;
async function biWbiKeys() {
  if (_wbiKeys && Date.now() - _wbiTs < 600000) return _wbiKeys; // cache 10 min
  const d = await proxyGet('https://api.bilibili.com/x/web-interface/nav', 'https://www.bilibili.com/');
  if (d._proxy_error || d.code === -412 || !d.data?.wbi_img) return null;
  const { img_url, sub_url } = d.data.wbi_img;
  const imgKey = img_url.split('/').pop().split('.')[0];
  const subKey = sub_url.split('/').pop().split('.')[0];
  const mixin = WBI_MIXIN_TAB.reduce((s, i) => s + (imgKey + subKey).charAt(i), '').slice(0, 32);
  _wbiKeys = mixin; _wbiTs = Date.now();
  return mixin;
}

async function biWbiGet(baseUrl, params) {
  const mixinKey = await biWbiKeys();
  if (!mixinKey) return { _proxy_error: true, _wbi_failed: true };
  const wts = Math.floor(Date.now() / 1000);
  const all = { ...params, wts };
  const chrFilter = /[!'()*]/g;
  const qs = Object.keys(all).sort().map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(all[k]).replace(chrFilter, ''))).join('&');
  const wRid = md5(qs + mixinKey);
  return proxyGet(baseUrl + '?' + qs + '&w_rid=' + wRid, 'https://www.bilibili.com/');
}

// Cookie helpers
let _biCookies = '', _biCookieTs = 0;
async function biGetCookies() {
  if (_biCookies && Date.now() - _biCookieTs < 1800000) return _biCookies;
  try {
    const r = await fetch('https://www.bilibili.com/', { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const allCookies = [];
    try { const vals = r.headers.getAll('set-cookie'); if (Array.isArray(vals)) allCookies.push(...vals); } catch {}
    const sc = r.headers.get('set-cookie'); if (sc) allCookies.push(sc);
    let buvid3 = '', bNut = '';
    for (const c of allCookies) {
      const m3 = c.match(/buvid3=([^;]+)/); if (m3) buvid3 = m3[1];
      const mn = c.match(/b_nut=([^;]+)/); if (mn) bNut = mn[1];
    }
    if (buvid3) { _biCookies = `buvid3=${buvid3}; b_nut=${bNut}; CURRENT_FNVAL=16`; _biCookieTs = Date.now(); }
  } catch {}
  if (!_biCookies) {
    const chars = 'ABCDEF0123456789';
    const seg = (n) => Array.from({length:n}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    _biCookies = `buvid3=${seg(8)}-${seg(4)}-${seg(4)}-${seg(4)}-${seg(12)}infoc; b_nut=${Math.floor(Date.now()/1000)}; CURRENT_FNVAL=16`;
    _biCookieTs = Date.now();
  }
  return _biCookies;
}

// Browser-like headers for web API (helps bypass some anti-bot checks)
const BI_WEB_HEADERS = {
  'Origin': 'https://www.bilibili.com',
  'Sec-Fetch-Site': 'same-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

function parseDur(s) { const p = (s || '').split(':'); return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : (p.length === 3 ? parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2]) : 0); }

function biFormat(x) {
  let imgUrl = x.pic || '';
  if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
  return {
    id: 'bitrack_v_' + x.bvid, title: (x.title || '').replace(/<em class="keyword">|<\/em>/g, ''),
    artist: x.author || '', artist_id: 'biartist_v_' + (x.mid || ''),
    source: 'bilibili', source_url: 'https://www.bilibili.com/' + x.bvid,
    img_url: imgUrl, duration: parseDur(x.duration),
  };
}

// ── Search: Mobile API → Wbi → Web API ──
async function biSearch(kw, pg) {
  // Layer 1: Mobile API
  const appResult = await biAppGet('/x/v2/search', { keyword: kw, pn: pg || 1, ps: 20, search_type: 'video' });
  if (!appResult._proxy_error && appResult.code === 0 && appResult.data?.result) {
    const items = Array.isArray(appResult.data.result) ? appResult.data.result : (appResult.data.result.items || []);
    return {
      result: items.filter(x => x.bvid).map(x => ({
        id: 'bitrack_v_' + x.bvid, title: (x.title || '').replace(/<[^>]+>/g, ''),
        artist: x.author || '', artist_id: 'biartist_v_' + (x.mid || ''),
        source: 'bilibili', source_url: 'https://www.bilibili.com/' + x.bvid,
        img_url: x.pic?.startsWith('//') ? 'https:' + x.pic : (x.pic || ''),
        duration: parseDur(x.duration),
      })),
      total: appResult.data.page?.numResults || appResult.data.numResults || items.length,
    };
  }
  // Layer 2: Wbi-signed web search
  const wbiResult = await biWbiGet('https://api.bilibili.com/x/web-interface/wbi/search/type', { keyword: kw, page: pg || 1, page_size: 20, search_type: 'video' });
  if (!wbiResult._proxy_error && wbiResult.code === 0 && wbiResult.data?.result) {
    return { result: wbiResult.data.result.map(x => biFormat(x)), total: wbiResult.data.numResults || 0 };
  }
  // Layer 3: Plain web API with cookies
  const ck = await biGetCookies();
  const d = await proxyGet('https://api.bilibili.com/x/web-interface/search/type?__refresh__=true&page=' + (pg || 1) + '&page_size=20&platform=pc&highlight=1&keyword=' + encodeURIComponent(kw) + '&search_type=video', 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
  if (d._proxy_error || d.code === -412) return { result: [], total: 0 };
  const s = d.data?.result || [];
  return { result: s.map(x => biFormat(x)), total: d.data?.numResults || 0 };
}

// ── Chart: Mobile API search → Web API → Hardcoded ──
const BI_HARDCODED_CHARTS = [
  { id: 'bipop_BV1jE42107rM', title: '2024年度热门音乐合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1jE42107rM' },
  { id: 'bipop_BV1GJ411x7h7', title: '华语经典歌曲100首', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1GJ411x7h7' },
  { id: 'bipop_BV1Nx411w7XV', title: '动漫OP合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1Nx411w7XV' },
  { id: 'bipop_BV1XW411M7Gz', title: 'V家名曲精选', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1XW411M7Gz' },
  { id: 'bipop_BV17W41147Va', title: '古风音乐大合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV17W41147Va' },
  { id: 'bipop_BV1Es411B7Dw', title: '翻唱歌曲合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1Es411B7Dw' },
  { id: 'bipop_BV1as411B7tN', title: '轻音乐纯音乐合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1as411B7tN' },
  { id: 'bipop_BV1vx411B7tW', title: '日文流行歌曲合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1vx411B7tW' },
  { id: 'bipop_BV1Rx411B7oL', title: '韩流K-Pop精选', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1Rx411B7oL' },
  { id: 'bipop_BV1Xx411B7GJ', title: '欧美流行音乐合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1Xx411B7GJ' },
  { id: 'bipop_BV1Wx411B7Mo', title: '民谣精选合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1Wx411B7Mo' },
  { id: 'bipop_BV1bx411B7Uo', title: '电子音乐精选', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1bx411B7Uo' },
  { id: 'bipop_BV1nx411c7VJ', title: '摇滚音乐合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1nx411c7VJ' },
  { id: 'bipop_BV1ex411j7oV', title: 'R&B/Soul精选', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1ex411j7oV' },
  { id: 'bipop_BV1kx411B7VT', title: '嘻哈说唱合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1kx411B7VT' },
  { id: 'bipop_BV1fx411B7rW', title: 'ACG神曲合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1fx411B7rW' },
  { id: 'bipop_BV1dx411B7fZ', title: '抖音热门歌曲合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1dx411B7fZ' },
  { id: 'bipop_BV1Zx411B7XL', title: '粤语经典合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1Zx411B7XL' },
  { id: 'bipop_BV1fx411B7XL', title: '影视OST合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1fx411B7XL' },
  { id: 'bipop_BV1Vx411B7DL', title: '钢琴曲精选合集', cover_img_url: '', source: 'bilibili', source_url: 'https://www.bilibili.com/BV1Vx411B7DL' },
];

async function biChart() {
  // Layer 1: Audio music service (www.bilibili.com)
  const ck = await biGetCookies();
  const audioChart = await proxyGet('https://www.bilibili.com/audio/music-service-c/web/menu/hit?ps=20&pn=1', 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
  if (!audioChart._proxy_error && audioChart.code === 0 && audioChart.data?.data?.length) {
    return audioChart.data.data.map(item => ({
      id: 'biplaylist_' + item.menuId, title: item.title,
      cover_img_url: item.cover || '', source: 'bilibili',
      source_url: 'https://www.bilibili.com/audio/am' + item.menuId,
    }));
  }
  // Layer 2: Mobile API search for popular playlists
  const keywords = ['热门音乐', '经典歌曲合集', '动漫OP合集', '翻唱精选', '纯音乐合集', '古风音乐'];
  const results = [];
  for (const kw of keywords) {
    if (results.length >= 20) break;
    const d = await biAppGet('/x/v2/search', { keyword: kw, pn: 1, ps: 5, search_type: 'video' });
    if (d._proxy_error || d.code !== 0) continue;
    const items = Array.isArray(d.data?.result) ? d.data.result : (d.data?.result?.items || []);
    for (const x of items) {
      if (!x.bvid) continue;
      results.push({
        id: 'bipop_' + x.bvid, title: (x.title || '').replace(/<[^>]+>/g, ''),
        cover_img_url: x.pic?.startsWith('//') ? 'https:' + x.pic : (x.pic || ''),
        source: 'bilibili', source_url: 'https://www.bilibili.com/' + x.bvid,
      });
    }
  }
  if (results.length > 0) return results;
  // Layer 3: Web API search fallback
  for (const kw of keywords) {
    if (results.length >= 20) break;
    const d = await proxyGet('https://api.bilibili.com/x/web-interface/search/type?keyword=' + encodeURIComponent(kw) + '&search_type=video&page=1&page_size=5', 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
    if (d._proxy_error || d.code === -412) continue;
    const items = d.data?.result || [];
    for (const x of items) {
      results.push({
        id: 'bipop_' + x.bvid, title: (x.title || '').replace(/<em class="keyword">|<\/em>/g, ''),
        cover_img_url: x.pic?.startsWith('//') ? 'https:' + x.pic : (x.pic || ''),
        source: 'bilibili', source_url: 'https://www.bilibili.com/' + x.bvid,
      });
    }
  }
  if (results.length > 0) return results;
  // Layer 4: Hardcoded playlists
  return BI_HARDCODED_CHARTS;
}

// ── Bootstrap: Mobile API → Web API ──
async function biBootstrap(tid) {
  const ck = await biGetCookies();
  // Video tracks: bitrack_v_BVxxx or bitrack_v_BVxxx-cid
  if (tid.startsWith('bitrack_v_')) {
    const ip = tid.replace('bitrack_v_', '');
    const [bvid, cidPart] = ip.split('-');
    let cid = cidPart;

    // Try mobile API for video info first
    if (!cid) {
      const appInfo = await biAppGet('/x/v2/view', { bvid });
      if (!appInfo._proxy_error && appInfo.code === 0 && appInfo.data?.pages) {
        cid = appInfo.data.pages[0]?.cid;
      }
    }
    // Fallback: web API for video info
    if (!cid) {
      const info = await proxyGet('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
      if (info._proxy_error) return { url: null };
      cid = info.data?.pages?.[0]?.cid;
    }
    if (!cid) return { url: null };

    // Try mobile API playurl
    const appPlay = await biAppGet('/x/v2/playurl', { avid: '', bvid, cid: String(cid), qn: '64', fnval: '16', fourk: '1' });
    if (!appPlay._proxy_error && appPlay.code === 0) {
      // Dash audio
      if (appPlay.data?.dash?.audio?.[0]?.baseUrl) {
        return { url: '/api/bili-audio?url=' + encodeURIComponent(appPlay.data.dash.audio[0].baseUrl), platform: 'bilibili' };
      }
      // Durl fallback
      if (appPlay.data?.durl?.[0]?.url) {
        return { url: '/api/bili-audio?url=' + encodeURIComponent(appPlay.data.durl[0].url), platform: 'bilibili' };
      }
    }

    // Fallback: web API playurl with cookies
    const d = await proxyGet('https://api.bilibili.com/x/player/playurl?fnval=16&bvid=' + bvid + '&cid=' + cid, 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
    if (!d._proxy_error && d.data?.dash?.audio?.[0]?.baseUrl) {
      return { url: '/api/bili-audio?url=' + encodeURIComponent(d.data.dash.audio[0].baseUrl), platform: 'bilibili' };
    }
    const d2 = await proxyGet('https://api.bilibili.com/x/player/playurl?fnval=0&bvid=' + bvid + '&cid=' + cid, 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
    if (!d2._proxy_error && d2.data?.durl?.[0]?.url) {
      return { url: '/api/bili-audio?url=' + encodeURIComponent(d2.data.durl[0].url), platform: 'bilibili' };
    }
    return { url: null };
  }
  // Audio tracks: bitrack_12345 (B站音乐区)
  const songId = tid.replace('bitrack_', '');
  // Try web API for audio URL (audio CDN might not have -412)
  const d = await proxyGet('https://www.bilibili.com/audio/music-service-c/web/url?sid=' + songId, 'https://www.bilibili.com/', { 'Cookie': ck });
  if (!d._proxy_error && d.data?.cdns?.[0]) {
    let u = d.data.cdns[0];
    if (u.startsWith('//')) u = 'https:' + u;
    return { url: u, platform: 'bilibili' };
  }
  // Also try api.bilibili.com
  const d2 = await proxyGet('https://api.bilibili.com/audio/music-service-c/web/url?sid=' + songId, 'https://www.bilibili.com/', { 'Cookie': ck });
  if (!d2._proxy_error && d2.data?.cdns?.[0]) {
    let u = d2.data.cdns[0];
    if (u.startsWith('//')) u = 'https:' + u;
    return { url: u, platform: 'bilibili' };
  }
  return { url: null };
}

// ── Playlist Tracks: Mobile API → Web API ──
async function biPlaylistTracks(listId) {
  const ck = await biGetCookies();
  // Audio playlists: biplaylist_12345
  if (listId.startsWith('biplaylist_')) {
    const sid = listId.replace('biplaylist_', '');
    // Try www.bilibili.com audio service
    const d = await proxyGet('https://www.bilibili.com/audio/music-service-c/web/song/of-menu?pn=1&ps=100&sid=' + sid, 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
    if (!d._proxy_error && d.data?.data?.length) {
      const tracks = d.data.data.map(s => ({
        id: 'bitrack_' + s.id, title: s.title || '',
        artist: s.upName || s.author || '', source: 'bilibili',
        source_url: 'https://www.bilibili.com/audio/au' + s.id,
        img_url: s.cover || '', duration: parseInt(s.duration || 0),
      }));
      return { tracks, total: d.data?.totalSize || tracks.length };
    }
    // Fallback: api.bilibili.com
    const d2 = await proxyGet('https://api.bilibili.com/audio/music-service-c/web/song/of-menu?pn=1&ps=100&sid=' + sid, 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
    if (!d2._proxy_error && d2.data?.data?.length) {
      const tracks = d2.data.data.map(s => ({
        id: 'bitrack_' + s.id, title: s.title || '',
        artist: s.upName || s.author || '', source: 'bilibili',
        source_url: 'https://www.bilibili.com/audio/au' + s.id,
        img_url: s.cover || '', duration: parseInt(s.duration || 0),
      }));
      return { tracks, total: d2.data?.totalSize || tracks.length };
    }
  }
  // Popular video collections: bipop_BVxxx
  if (listId.startsWith('bipop_')) {
    const bvid = listId.replace('bipop_', '');
    // Try mobile API for video info
    const appInfo = await biAppGet('/x/v2/view', { bvid });
    if (!appInfo._proxy_error && appInfo.code === 0 && appInfo.data?.pages) {
      const pages = appInfo.data.pages;
      const tracks = pages.map(p => ({
        id: 'bitrack_v_' + bvid + '-' + p.cid, title: p.part || appInfo.data.title || '',
        artist: appInfo.data.owner?.name || '', source: 'bilibili',
        source_url: 'https://www.bilibili.com/' + bvid + '?p=' + p.page,
        img_url: (appInfo.data.pic || '').startsWith('//') ? 'https:' + appInfo.data.pic : (appInfo.data.pic || ''),
        duration: parseInt(p.duration || 0),
      }));
      return { tracks, total: tracks.length };
    }
    // Fallback: web API
    const info = await proxyGet('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, 'https://www.bilibili.com/', { 'Cookie': ck, ...BI_WEB_HEADERS });
    if (info._proxy_error || !info.data?.pages) return { tracks: [], total: 0 };
    const pages = info.data.pages;
    const tracks = pages.map(p => ({
      id: 'bitrack_v_' + bvid + '-' + p.cid, title: p.part || info.data.title || '',
      artist: info.data.owner?.name || '', source: 'bilibili',
      source_url: 'https://www.bilibili.com/' + bvid + '?p=' + p.page,
      img_url: (info.data.pic || '').startsWith('//') ? 'https:' + info.data.pic : (info.data.pic || ''),
      duration: parseInt(p.duration || 0),
    }));
    return { tracks, total: tracks.length };
  }
  return { tracks: [], total: 0 };
}

// ─── Migu ───
async function mgSearch(kw, pg) {
  const url = 'https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0?text=' + encodeURIComponent(kw) + '&pageNo=' + (pg || 1) + '&pageSize=20';
  const d = await proxyGet(url, 'https://music.migu.cn/', { 'channel': '0146951' });
  if (d._proxy_error) return d;
  const s = Array.isArray(d) ? d : (d.data || []);
  return { result: s.map(x => ({
    id: 'mgtrack_' + x.copyrightId, title: x.songName,
    artist: x.singerList?.[0]?.name || x.singer || '',
    artist_id: 'mgartist_' + (x.singerList?.[0]?.id || x.singerId || ''),
    album: x.albumId !== 1 ? x.album : '', album_id: x.albumId !== 1 ? 'mgalbum_' + x.albumId : '',
    source: 'migu', source_url: 'https://music.migu.cn/v3/music/song/' + x.copyrightId,
    img_url: x.img1 || '', duration: 0,
    song_id: x.songId, content_id: x.contentId, quality: x.toneControl,
  })), total: 1000 };
}

async function mgBootstrap(tid, extra) {
  const cid = tid.replace('mgtrack_', '');
  let cnt = '', tf = 'PQ';
  if (extra) { try { const ex = JSON.parse(extra); cnt = ex.content_id || ''; tf = ({ '110000': 'HQ', '111100': 'SQ', '111111': 'ZQ' })[ex.quality] || 'PQ'; } catch {} }
  const d = await proxyGet('https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=' + cid + '&contentId=' + cnt + '&toneFlag=' + tf, 'https://music.migu.cn/', { 'channel': '0146951', 'uid': '1234' });
  if (d._proxy_error) return { url: null };
  let u = d.data?.url;
  if (!u) return { url: null };
  if (u.startsWith('//')) u = 'https:' + u;
  return { url: u.replace(/\+/g, '%2B'), platform: 'migu' };
}

async function mgChart() {
  const d = await proxyGet('https://app.c.nf.migu.cn/MIGUM2.0/v2.0/content/getMusicData.do?count=20&start=1&templateVersion=5&type=1', 'https://music.migu.cn/', { 'channel': '0146951' });
  if (d._proxy_error || !d.data) return [];
  const cl = d.data.contentItemList || [];
  const result = [];
  for (const g of cl) {
    const items = g.itemList || g.contentList || [];
    for (const it of items) {
      const au = it.actionUrl || '';
      const m = au.match(/id=([0-9]+)/);
      if (m) {
        result.push({
          id: 'mgplaylist_' + m[1], title: it.title || '',
          cover_img_url: it.imageUrl || it.bigImageUrl || '', source: 'migu',
          source_url: 'https://music.migu.cn/v3/music/playlist/' + m[1],
        });
      }
      if (result.length >= 20) break;
    }
  }
  return result;
}

async function mgPlaylistTracks(listId) {
  const pid = listId.replace('mgplaylist_', '').replace('mgtoplist_', '');
  const d = await proxyGet('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=' + pid + '&pageNo=1&pageSize=100', 'https://music.migu.cn/', { 'channel': '0146951' });
  if (d._proxy_error || !d.data) return { tracks: [], total: 0 };
  const songs = Array.isArray(d.data) ? d.data : (d.data?.songList || d.data?.items || []);
  const tracks = songs.map(x => ({
    id: 'mgtrack_' + x.copyrightId, title: x.songName || x.name || '',
    artist: x.singerList?.[0]?.name || x.singer || '',
    album: x.albumId !== 1 ? (x.album || '') : '', source: 'migu',
    source_url: 'https://music.migu.cn/v3/music/song/' + x.copyrightId,
    img_url: x.img1 || x.img || '', duration: 0,
    song_id: x.songId, content_id: x.contentId, quality: x.toneControl,
  }));
  return { tracks, total: d.data?.totalSize || tracks.length };
}

// ─── GitHub OAuth ───
const GH_CLIENT_ID = 'Ov23ctkJECWXQUnMCtqo';
const GH_CLIENT_SECRET = '383de452c685dded6a147e3a5daabd5abc94b527';
const GH_REDIRECT = 'https://ddmusic.eu.cc/api/auth/callback/github';

async function githubOAuth(code) {
  // Step 1: Exchange code for access token
  const tokenR = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ client_id: GH_CLIENT_ID, client_secret: GH_CLIENT_SECRET, code: code }),
  });
  const tokenText = await tokenR.text();
  let d;
  try { d = JSON.parse(tokenText); } catch { return { ok: false, error: 'Token exchange parse error: ' + tokenText.slice(0, 100) }; }
  if (d.error) return { ok: false, error: d.error_description || d.error };
  const token = d.access_token;
  if (!token) return { ok: false, error: 'No access_token in response' };

  // Step 2: Get user info with token
  const userR = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': 'token ' + token, 'Accept': 'application/json', 'User-Agent': UA },
  });
  const userText = await userR.text();
  let user;
  try { user = JSON.parse(userText); } catch { return { ok: false, error: 'User API parse error: ' + userText.slice(0, 100) }; }
  if (user.message) return { ok: false, error: 'GitHub API error: ' + user.message };

  return {
    ok: true,
    token: token,
    id: user.id,
    login: user.login,
    name: user.name || user.login,
    avatar: user.avatar_url,
  };
}

// ─── D1 Share ───
async function dbCreateShare(db, platform, songId, title, artist, cover, shareUser) {
  if (!db) return null;
  // Dedup: same user + same song → return existing code
  const existing = await db.prepare('SELECT code FROM dd_share WHERE platform=? AND song_id=? AND share_user=?').bind(platform, songId, shareUser).first();
  if (existing) return existing.code;
  // Generate 10-char random code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 10; i++) code += chars[arr[i] % chars.length];
  await db.prepare(
    'INSERT INTO dd_share (code, platform, song_id, title, artist, cover, share_user, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(code, platform, songId, title || '', artist || '', cover || '', shareUser || '', Math.floor(Date.now() / 1000)).run();
  return code;
}

async function dbGetShare(db, code) {
  if (!db) return null;
  return await db.prepare('SELECT * FROM dd_share WHERE code=?').bind(code).first();
}

// ─── D1 Init (create tables if not exist) ───
async function dbInit(db) {
  if (!db) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS dd_share (code TEXT PRIMARY KEY, platform TEXT NOT NULL, song_id TEXT NOT NULL, title TEXT DEFAULT '', artist TEXT DEFAULT '', cover TEXT DEFAULT '', share_user TEXT DEFAULT '', created_at INTEGER DEFAULT 0)`).run();
}

// ─── D1 User Database ───
async function dbUpsertUser(db, ghData) {
  if (!db) return null;
  // Check if user exists
  const existing = await db.prepare('SELECT id FROM users WHERE github_id = ?').bind(ghData.id).first();
  if (existing) {
    await db.prepare(
      'UPDATE users SET github_login=?, github_name=?, github_avatar=?, github_token=?, updated_at=datetime(\'now\') WHERE github_id=?'
    ).bind(ghData.login, ghData.name, ghData.avatar, ghData.token, ghData.id).run();
    return existing.id;
  } else {
    const result = await db.prepare(
      'INSERT INTO users (github_id, github_login, github_name, github_avatar, github_token) VALUES (?, ?, ?, ?, ?)'
    ).bind(ghData.id, ghData.login, ghData.name, ghData.avatar, ghData.token).run();
    return result.meta?.last_row_id || null;
  }
}

async function dbGetUserByGithub(db, githubId) {
  if (!db) return null;
  return await db.prepare('SELECT * FROM users WHERE github_id = ?').bind(githubId).first();
}

async function dbUpdateNetease(db, userId, cookie, uid, nickname, avatar) {
  if (!db) return;
  await db.prepare(
    'UPDATE users SET netease_cookie=?, netease_uid=?, netease_nickname=?, netease_avatar=?, updated_at=datetime(\'now\') WHERE id=?'
  ).bind(cookie, uid, nickname, avatar, userId).run();
}

async function dbAddFavorite(db, userId, songId, title, artist, cover, source) {
  if (!db) return;
  await db.prepare(
    'INSERT OR IGNORE INTO favorites (user_id, song_id, song_title, song_artist, song_cover, song_source) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, songId, title, artist, cover, source).run();
}

async function dbRemoveFavorite(db, userId, songId) {
  if (!db) return;
  await db.prepare('DELETE FROM favorites WHERE user_id=? AND song_id=?').bind(userId, songId).run();
}

async function dbGetFavorites(db, userId) {
  if (!db) return [];
  const result = await db.prepare('SELECT * FROM favorites WHERE user_id=? ORDER BY created_at DESC').bind(userId).all();
  return result.results || [];
}

async function dbAddListenHistory(db, userId, songId, title, artist, source) {
  if (!db) return;
  await db.prepare(
    'INSERT INTO listen_history (user_id, song_id, song_title, song_artist, song_source) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, songId, title, artist, source).run();
}

async function dbGetListenHistory(db, userId, limit) {
  if (!db) return [];
  const result = await db.prepare('SELECT * FROM listen_history WHERE user_id=? ORDER BY listened_at DESC LIMIT ?').bind(userId, limit || 50).all();
  return result.results || [];
}

// ─── Router ───
async function apiRouter(url, env) {
  const a = url.searchParams.get('action'), p = url.searchParams.get('platform');
  const kw = url.searchParams.get('keyword'), tid = url.searchParams.get('trackId');
  const lid = url.searchParams.get('listId'), ex = url.searchParams.get('extra');
  const pg = parseInt(url.searchParams.get('page') || '1');
  const uid = url.searchParams.get('uid');
  const cookie = url.searchParams.get('cookie');
  const ghId = parseInt(url.searchParams.get('github_id') || '0');

  // Resolve NetEase cookie from D1 if user is logged in via GitHub
  let neCookie = cookie || '';
  if (p === 'netease' && ghId && !neCookie) {
    const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
    if (user && user.netease_cookie) neCookie = user.netease_cookie;
  }

  try {
    switch (a) {
      case 'search':
        if (p === 'netease') return neSearch(kw, pg, neCookie);
        if (p === 'qq') return qqSearch(kw, pg);
        if (p === 'kugou') return kgSearch(kw, pg);
        if (p === 'kuwo') return kwSearch(kw, pg);
        if (p === 'bilibili') return biSearch(kw, pg);
        if (p === 'migu') return mgSearch(kw, pg);
        return { result: [], total: 0 };

      case 'bootstrap':
        if (p === 'netease') return neBootstrap(tid, neCookie);
        if (p === 'qq') return qqBootstrap(tid);
        if (p === 'kugou') return kgBootstrap(tid);
        if (p === 'kuwo') return kwBootstrap(tid);
        if (p === 'bilibili') return biBootstrap(tid);
        if (p === 'migu') return mgBootstrap(tid, ex);
        return { url: null };

      case 'chart':
        if (p === 'netease') return lid ? nePlaylistTracks(lid, url.searchParams.get('offset'), url.searchParams.get('limit'), neCookie) : neChart(neCookie);
        if (p === 'qq') return lid ? qqToplistSongs(lid) : qqChart();
        if (p === 'bilibili') return lid ? biPlaylistTracks(lid) : biChart();
        if (p === 'kugou') return lid ? kgPlaylistTracks(lid) : kgChart();
        if (p === 'kuwo') return lid ? kwPlaylistTracks(lid) : kwChart();
        if (p === 'migu') return lid ? mgPlaylistTracks(lid) : mgChart();
        return [];

      case 'discover':
        if (p === 'netease') return neDiscover(neCookie);
        return [];

      case 'playlist':
        if (p === 'netease') return nePlaylistTracks(lid, url.searchParams.get('offset'), url.searchParams.get('limit'), neCookie);
        return { tracks: [], info: {} };

      case 'lyric':
        if (p === 'netease') return neLyric(tid, neCookie);
        return { lyric: '' };

      case 'login_check':
        if (p === 'netease') return neLoginCheck(cookie);
        return { ok: false, error: 'unsupported platform' };

      case 'user_playlist':
        if (p === 'netease') return neUserPlaylists(uid, cookie);
        return { playlists: [] };

      case 'oauth_url':
        return { url: 'https://github.com/login/oauth/authorize?client_id=' + GH_CLIENT_ID + '&redirect_uri=' + encodeURIComponent(GH_REDIRECT) + '&scope=user:email' };

      // ─── D1 User APIs ───
      case 'user_info': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        if (!ghId) return { ok: false, error: 'missing github_id' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        return { ok: true, user: { id: user.id, github_login: user.github_login, github_name: user.github_name, github_avatar: user.github_avatar, netease_uid: user.netease_uid, netease_nickname: user.netease_nickname, netease_avatar: user.netease_avatar, netease_logged_in: !!user.netease_cookie } };
      }

      case 'netease_bind': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        const neCookie = url.searchParams.get('ne_cookie') || '';
        if (!ghId || !neCookie) return { ok: false, error: 'missing params' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        const check = await neLoginCheck(neCookie);
        if (!check.ok) return { ok: false, error: check.error };
        await dbUpdateNetease(env?.dd_music_db, user.id, neCookie, String(check.uid), check.nickname, check.avatar || '');
        return { ok: true, uid: check.uid, nickname: check.nickname, avatar: check.avatar };
      }

      case 'favorite_add': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        const songId = url.searchParams.get('song_id') || '';
        if (!ghId || !songId) return { ok: false, error: 'missing params' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        await dbAddFavorite(env?.dd_music_db, user.id, songId, url.searchParams.get('song_title') || '', url.searchParams.get('song_artist') || '', url.searchParams.get('song_cover') || '', url.searchParams.get('song_source') || '');
        return { ok: true };
      }

      case 'favorite_remove': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        const songId = url.searchParams.get('song_id') || '';
        if (!ghId || !songId) return { ok: false, error: 'missing params' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        await dbRemoveFavorite(env?.dd_music_db, user.id, songId);
        return { ok: true };
      }

      case 'favorite_list': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        if (!ghId) return { ok: false, error: 'missing github_id' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        const favs = await dbGetFavorites(env?.dd_music_db, user.id);
        return { ok: true, favorites: favs };
      }

      case 'listen_record': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        const songId = url.searchParams.get('song_id') || '';
        if (!ghId || !songId) return { ok: false, error: 'missing params' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        await dbAddListenHistory(env?.dd_music_db, user.id, songId, url.searchParams.get('song_title') || '', url.searchParams.get('song_artist') || '', url.searchParams.get('song_source') || '');
        return { ok: true };
      }

      case 'listen_history': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        if (!ghId) return { ok: false, error: 'missing github_id' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        const history = await dbGetListenHistory(env?.dd_music_db, user.id, 50);
        return { ok: true, history: history };
      }

      case 'share_create': {
        const platform = url.searchParams.get('platform') || '';
        const songId = url.searchParams.get('song_id') || '';
        const shareUser = url.searchParams.get('share_user') || '';
        if (!platform || !songId) return { ok: false, error: 'missing platform or song_id' };
        const code = await dbCreateShare(env?.dd_music_db, platform, songId, url.searchParams.get('title') || '', url.searchParams.get('artist') || '', url.searchParams.get('cover') || '', shareUser);
        return { ok: true, code: code };
      }

      case 'share_get': {
        const code = url.searchParams.get('code') || '';
        if (!code) return { ok: false, error: 'missing code' };
        const share = await dbGetShare(env?.dd_music_db, code);
        if (!share) return { ok: false, error: 'not found' };
        return { ok: true, platform: share.platform, song_id: share.song_id, title: share.title, artist: share.artist, cover: share.cover, share_user: share.share_user };
      }

      default:
        return { error: 'unknown action: ' + a };
    }
  } catch (e) {
    return { error: e.message };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Bilibili audio proxy (video audio needs Referer header)
    if (url.pathname === '/api/bili-audio') {
      const audioUrl = url.searchParams.get('url');
      if (!audioUrl) return new Response('Missing url', { status: 400 });
      // Allow bilivideo.com (dash/durl) and other B站 CDN domains
      const allowedDomains = ['bilivideo.com', 'akamaized.net', 'biligc.com', 'szbdyd.com', 'mirrormg.com'];
      const isAllowed = allowedDomains.some(d => audioUrl.includes(d));
      if (!isAllowed) return new Response('Invalid url domain', { status: 400 });
      const proxyHeaders = { 'Referer': 'https://www.bilibili.com/', 'User-Agent': UA };
      const range = request.headers.get('Range');
      if (range) proxyHeaders['Range'] = range;
      try {
        const r = await fetch(audioUrl, { headers: proxyHeaders });
        const respHeaders = {
          'Content-Type': r.headers.get('Content-Type') || 'audio/mp4',
          'Access-Control-Allow-Origin': '*',
        };
        const cl = r.headers.get('Content-Length');
        if (cl) respHeaders['Content-Length'] = cl;
        const cr = r.headers.get('Content-Range');
        if (cr) respHeaders['Content-Range'] = cr;
        const ar = r.headers.get('Accept-Ranges');
        if (ar) respHeaders['Accept-Ranges'] = ar;
        return new Response(r.body, { status: r.status, headers: respHeaders });
      } catch (e) {
        return new Response('Proxy error: ' + e.message, { status: 502 });
      }
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' }
      });
    }

    // GitHub OAuth callback: /api/auth/callback/github?code=xxx
    if (url.pathname === '/api/auth/callback/github') {
      try {
        const code = url.searchParams.get('code');
        if (!code) return new Response('Missing code', { status: 400 });
        const result = await githubOAuth(code);
        if (result.ok && env?.dd_music_db) {
          await dbUpsertUser(env.dd_music_db, result);
        }
        // DUAL delivery: hash fragment + cookie (belt & suspenders)
        const redirectUrl = '/#oauth=' + encodeURIComponent(JSON.stringify(result));
        const headers = {
          'Location': new URL(redirectUrl, request.url).toString(),
          'Cache-Control': 'no-store',
        };
        // Set a cookie as backup - some browsers lose hash fragments on 302 redirect
        if (result.ok) {
          const cookieData = JSON.stringify({ok:true, t:result.token, l:result.login, n:result.name, a:result.avatar, i:String(result.id)});
          headers['Set-Cookie'] = 'dd_oauth=' + encodeURIComponent(cookieData) + '; Path=/; Max-Age=60; SameSite=Lax; Secure';
        }
        return new Response(null, { status: 302, headers });
      } catch (e) {
        return Response.redirect(new URL('/#oauth_error=' + encodeURIComponent(e.message), request.url).toString(), 302);
      }
    }

    if (url.pathname.startsWith('/api/')) {
      if (!env._shareInitDone) { await dbInit(env?.dd_music_db); if (env) env._shareInitDone = true; }
      const result = await apiRouter(url, env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
      });
    }

    // Static assets - no-cache HTML to prevent stale version references
    if (env?.ASSETS) {
      const resp = await env.ASSETS.fetch(request);
      if (url.pathname === '/' || url.pathname.endsWith('.html')) {
        const headers = new Headers(resp.headers);
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        headers.set('Pragma', 'no-cache');
        return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
      }
      return resp;
    }
    return new Response('Not found', { status: 404 });
  }
};
