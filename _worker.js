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
  // Try multiple approaches for QQ Music playback
  // Approach 1: vkey.GetVkeyServer with different file formats
  const fileTypes = [
    { prefix: 'C400', ext: '.m4a' },
    { prefix: 'M500', ext: '.mp3' },
    { prefix: 'O400', ext: '.ogg' },
    { prefix: 'Q400', ext: '.flac' },
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
  // Approach 2: Try music.fcg with different module
  const d2 = await proxyPostJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
      param: { filename: ['C400' + mid + mid + '.m4a'], guid: '10000', songmid: [mid], songtype: [0], uin: '0', loginflag: 1, platform: '20' } },
    comm: { uin: '0', format: 'json', ct: 24, cv: 0, authst: '', tmeLoginType: 1 }
  });
  if (!d2._proxy_error) {
    const purl = d2.req_0?.data?.midurlinfo?.[0]?.purl;
    if (purl) return { url: (d2.req_0?.data?.sip?.[0] || '') + purl, platform: 'qq' };
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
  // Approach 1: m.kugou.com getSongInfo (mobile API)
  const d = await proxyGet('https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + h, 'https://m.kugou.com/', { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X)' });
  if (!d._proxy_error && d.url) return { url: d.url, bitrate: (d.bitRate || 128) + 'kbps', platform: 'kugou' };
  // Approach 2: trackercdn API
  const d2 = await proxyGet('http://trackercdnbj.kugou.com/i/v2/?cmd=23&pid=1&behavior=play&hash=' + h, 'https://m.kugou.com/');
  if (!d2._proxy_error && d2.url) return { url: d2.url, platform: 'kugou' };
  // Approach 3: try wwwapi with album_id if available
  const d3 = await proxyGet('https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=' + h + '&album_id=0&mid=1', 'https://www.kugou.com/');
  if (!d3._proxy_error && d3.data?.play_url) return { url: d3.data.play_url, platform: 'kugou' };
  return { url: null };
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
  // Need Secret header for playUrl - get token from kuwo.cn
  const playUrl = `https://www.kuwo.cn/api/v1/www/music/playUrl?mid=${songId}&type=music&httpsStatus=1&reqId=&plat=web_www&from=`;
  // Try with Secret header first
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
      const csrf = token.slice(0, 8);
      const d = await proxyGet(playUrl, 'https://www.kuwo.cn/', { 'Secret': secret, 'csrf': csrf, 'Cookie': 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324=' + token });
      if (d.data && d.data.url) return { url: d.data.url, platform: 'kuwo' };
    }
  } catch {}
  // Fallback: try without Secret
  const d = await kuwoRequest(playUrl);
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
  // Attempt 4: Direct static JSON (the 302 redirect target — stable fallback that needs no Secret)
  const d4 = await proxyGet('https://star.kuwo.cn/star/upload/999/805/getRcmPlayList.json', 'https://www.kuwo.cn/');
  if (!d4._proxy_error && d4.data?.data) {
    return d4.data.data.map(item => ({
      id: 'kwplaylist_' + item.id, title: item.name,
      cover_img_url: item.img || '', source: 'kuwo',
      source_url: 'https://www.kuwo.cn/playlist_detail/' + item.id,
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
  const tracks = d.musiclist.map(s => {
    // API returns both old fields (DC_TARGETID/NAME) and new fields (id/name)
    const songId = s.DC_TARGETID || s.id || s.tid || '';
    const title = s.FSONGNAME || s.NAME || s.name || '';
    const artist = s.FARTIST || s.ARTIST || s.artist || '';
    const album = s.FALBUM || s.ALBUM || s.album || '';
    const img = s.pic || s.img || s.albumpic || s.musicPic || '';
    return {
      id: 'kwtrack_' + songId, title: htmlDecode(title),
      artist: htmlDecode(artist), album: htmlDecode(album),
      source: 'kuwo', source_url: 'https://www.kuwo.cn/play_detail/' + songId,
      img_url: img, duration: parseInt(s.DURATION || s.duration || 0),
    };
  }).filter(t => t.id !== 'kwtrack_' && t.title);
  return { tracks, total: d.total || tracks.length };
}

// ─── Bilibili ───
// B站 blocks CF Workers IPs (-412). Route all B站 API calls through Vercel proxy.
const BILI_PROXY = 'https://bili-proxy-ten.vercel.app/api';

// Proxy B站 image URLs through /api/img to avoid CORS issues on hdslb.com
function biProxyImg(url) {
  if (!url || !url.includes('hdslb.com')) return url;
  return '/api/img?url=' + encodeURIComponent(url);
}

// Helper: call B站 via Vercel proxy (AWS IPs, not blocked by B站)
async function biProxy(action, params = {}) {
  const qs = Object.entries(params).filter(([,v]) => v !== '' && v !== undefined).map(([k,v]) => k + '=' + encodeURIComponent(String(v))).join('&');
  const url = BILI_PROXY + '?action=' + action + (qs ? '&' + qs : '');
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const t = await r.text();
    return JSON.parse(t);
  } catch (e) {
    return { _proxy_error: true, error: String(e) };
  }
}

function parseDur(s) { const p = (s || '').split(':'); return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : (p.length === 3 ? parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2]) : 0); }

// ── Search: via Vercel proxy ──
async function biSearch(kw, pg) {
  const d = await biProxy('search', { keyword: kw, page: pg || 1 });
  if (d._proxy_error || d.error) return { result: [], total: 0 };
  // Proxy returns results with avid/bvid fields
  if (d.result && d.result.length > 0) {
    return {
      result: d.result.map(x => ({
        id: x.id, title: x.title, artist: x.artist || '',
        artist_id: 'biartist_v_', source: 'bilibili',
        source_url: x.source_url || '', img_url: biProxyImg(x.img_url) || '',
        duration: x.duration || 0, avid: x.avid || '', bvid: x.bvid || '',
      })),
      total: d.total || d.result.length,
    };
  }
  return { result: [], total: 0 };
}

// ── Chart: via Vercel proxy ──
async function biChart() {
  const d = await biProxy('chart');
  if (Array.isArray(d) && d.length > 0) {
    // Proxy hdslb.com image URLs through /api/img
    return d.map(c => ({
      ...c,
      cover_img_url: biProxyImg(c.cover_img_url || ''),
    }));
  }
  // Fallback: hardcoded
  return [
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
}

// ── Bootstrap: via Vercel proxy ──
async function biBootstrap(tid, avid) {
  // Video tracks: bitrack_v_BVxxx or bitrack_v_BVxxx-cid
  if (tid.startsWith('bitrack_v_')) {
    const ip = tid.replace('bitrack_v_', '');
    const [bvidFromId, cidPart] = ip.split('-');
    let cid = cidPart;
    let viewBvid = bvidFromId;

    // Get video info (cid) via proxy if needed.
    // Prefer avid (reliable from mobile search API); bvid from avToBv may be wrong.
    // The view response returns the CORRECT bvid — use that for playurl.
    if (!cid) {
      const viewParams = avid ? { avid } : { bvid: bvidFromId };
      const info = await biProxy('view', viewParams);
      if (info.pages && info.pages.length > 0) {
        cid = info.pages[0].cid;
        if (info.bvid) viewBvid = info.bvid;
      }
    }
    if (!cid) return { url: null };

    // playurl works with bvid+cid (avid-only playurl fails on the proxy)
    const play = await biProxy('playurl', { bvid: viewBvid, cid });
    if (play.url) {
      // DASH/durl audio URLs from B站 need proxying (cross-origin + Referer防盗链)
      return { url: '/api/bili-audio?url=' + encodeURIComponent(play.url), platform: 'bilibili' };
    }
    return { url: null };
  }
  // Audio tracks: bitrack_12345 (B站音乐区)
  const songId = tid.replace('bitrack_', '');
  const d = await biProxy('audio_url', { sid: songId });
  if (d.url) return { url: d.url, platform: 'bilibili' };
  return { url: null };
}

// ── Playlist Tracks: via Vercel proxy ──
async function biPlaylistTracks(listId) {
  const d = await biProxy('playlist_tracks', { listId });
  if (d.tracks) return { tracks: d.tracks, total: d.total || d.tracks.length };
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
  if (d._proxy_error) return { tracks: [], total: 0 };
  // API returns songs in d.list (not d.data)
  const songs = Array.isArray(d.list) ? d.list : (Array.isArray(d.data) ? d.data : (d.data?.songList || d.data?.items || []));
  const tracks = songs.map(x => ({
    id: 'mgtrack_' + x.copyrightId, title: x.songName || x.name || '',
    artist: x.singerList?.[0]?.name || x.singer || '',
    album: x.albumId !== 1 ? (x.album || '') : '', source: 'migu',
    source_url: 'https://music.migu.cn/v3/music/song/' + x.copyrightId,
    img_url: x.img1 || x.img || (x.albumImgs?.[0]?.img || ''),
    duration: 0,
    song_id: x.songId, content_id: x.contentId, quality: x.toneControl,
  }));
  return { tracks, total: d.totalCount || d.data?.totalSize || tracks.length };
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
        if (p === 'bilibili') return biBootstrap(tid, url.searchParams.get('avid') || '');
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

    // Image proxy (B站 hdslb.com images need CORS proxy)
    if (url.pathname === '/api/img') {
      const imgUrl = url.searchParams.get('url');
      if (!imgUrl) return new Response('Missing url', { status: 400 });
      try {
        const r = await fetch(imgUrl, { headers: { 'Referer': 'https://www.bilibili.com/', 'User-Agent': UA } });
        const ct = r.headers.get('Content-Type') || 'image/jpeg';
        return new Response(r.body, { status: r.status, headers: { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' } });
      } catch (e) {
        return new Response('Proxy error', { status: 502 });
      }
    }

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

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
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
