# 顶点音乐 维护记录

## v3.6.3 - 2026-10-18
### 响应式自适应布局优化（REQ-202609-0082）

**诊断结论：**
- 播放页 `.np-body` 使用固定 `gap:400px` + 左栏 `left:60px` 偏移，1024~1200px 区间横向空间被硬性占用，窄屏直接溢出/错位
- 首页歌单网格、详情头图、播放栏、我的页热力图等使用固定像素尺寸，切到手机/平板后比例失衡
- 播放页右栏高度由 JS 无条件按左栏同步，移动端堆叠布局被错误限高

**变更内容：**
- `style.css`：NowPlaying 改为流式 grid 两栏（`clamp()` 间距 + 自适应唱片尺寸），新增 900px 堆叠、640/480px 手机、短横屏（`max-height:560px` + landscape）断点
- `style.css`：首页歌单网格改用 `auto-fill + minmax(min(100%, clamp(...)))`；详情页、播放栏、歌曲列表、我的页、弹窗、Toast、热力图改为流式/安全区适配
- `style.css`：补充 `100dvh`、刘海屏 `safe-area-inset-left/right`、触摸设备操作按钮可见性、`prefers-reduced-motion`
- `app.js`：`syncNpHeights()` 仅在桌面两栏布局（≥901px 且 ≥561px 高）同步歌词列高度，窗口 resize/横竖屏切换自动复位
- `index.html`：静态资源版本号升级至 `v=3.6.3`，避免 CDN 旧缓存

**验证：** Playwright 覆盖 1920/1440/1180/1024/768/390/360/320 及 844×390 横屏，首页/歌单详情/播放页均无横向溢出、无控制台报错。

## v3.6.0 - 2026-06-17
### 对比 listen1 源码修复多平台播放

**诊断结论（对比 listen1 + 实测各平台上游 API）：**
- 网易云：正常（服务端 IP 可匿名取播放 URL）
- B站：搜索/歌单正常，**播放全失败**——view 接口用 bvid 失败（avToBv 算出的 bvid 不对），改用 avid 后 view 返回正确 bvid+cid，playurl 用该 bvid 成功
- QQ / 酷狗 / 酷我：免费歌能播，VIP 歌无源（与 listen1 匿名场景一致，非 IP 封锁）
- 咪咕：**歌单 0 首**（读错字段 d.data 应为 d.list）+ 播放缺 content_id 参数；播放本身受地区限制（440001），由网易云兜底接管

**变更内容：**
- `_worker.js` `biBootstrap`：接收 avid 参数，view 用 avid 取正确 bvid+cid，playurl 用 view 返回的 bvid
- `_worker.js` `mgPlaylistTracks`：字段映射修正（d.list、singer、albumImgs），歌单从 0 首恢复
- `_worker.js` router：bootstrap 透传 avid 参数
- `app.js` `resolveUrl`：按平台传 avid（B站）/ extra（咪咕 content_id+quality）
- `app.js` 新增 `neFallbackUrl`：非网易云平台无源时，自动搜网易云同名曲播放（标题精确匹配优先）
- NowPlaying 按钮：线性极简风格 + 3 秒无操作自动隐藏 + 下移 20px

**影响范围：** B站播放、咪咕歌单、所有非网易云平台的 VIP 歌播放（经兜底）

## v3.5.x - 2026-06-14
### NowPlaying 按钮优化 + Kuwo/B站 代理修复
- B站 API 经 Vercel 代理（bili-proxy-ten.vercel.app）绕过 CF IP 封锁
- B站图片 CORS 代理 /api/img
- Kuwo 歌单字段映射 + Secret header bootstrap
- NowPlaying 返回/全屏按钮线性化 + 自动隐藏
