/**
 * 主題初始化 — 必須在 React 掛載之前同步執行。
 *
 * ThemeProvider 是在 useEffect 裡才把 light/dark class 加到 <html>，
 * 也就是說首次繪製時一定是淺色，React 水合後才跳成深色 —— 深色模式使用者
 * 每次開啟頁面都會先被閃一下白光。在暗處投票時尤其刺眼。
 *
 * 為什麼是獨立檔案而不是 inline script：
 * 生產環境 nginx 的 CSP 是 `script-src 'self' 'wasm-unsafe-eval'`，沒有
 * 'unsafe-inline'。inline script 會被直接擋掉。同源的外部檔案才過得了。
 */
(function () {
  try {
    var mode = 'system';
    var raw = localStorage.getItem('savote-theme');
    if (raw) {
      var parsed = JSON.parse(raw);
      // zustand persist 的結構是 { state: { mode }, version }
      if (parsed && parsed.state && parsed.state.mode) mode = parsed.state.mode;
    }
    var effective =
      mode === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode;

    document.documentElement.classList.add(effective);
    document.documentElement.style.colorScheme = effective;
  } catch (e) {
    // 無痕模式、封鎖儲存、JSON 壞掉 —— 任何一種都退回系統偏好，
    // 絕不能讓這支腳本擋住頁面載入。
    try {
      var fallback = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.classList.add(fallback);
      document.documentElement.style.colorScheme = fallback;
    } catch (_) {}
  }
})();
