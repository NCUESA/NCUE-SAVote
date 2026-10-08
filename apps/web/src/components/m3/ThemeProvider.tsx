import { useEffect } from 'react';
import { useThemeStore } from '../../stores/themeStore';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** 把主題套到 <html>，只在真的有變化時才動 DOM */
const applyTheme = (effective: 'light' | 'dark') => {
  const root = document.documentElement;
  if (root.classList.contains(effective)) return;
  root.classList.remove('light', 'dark');
  root.classList.add(effective);
  // 讓原生控件（捲軸、日期選擇器、下拉選單）跟著走
  root.style.colorScheme = effective;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { mode, setComputedMode } = useThemeStore();

  useEffect(() => {
    // public/theme-init.js 已經在首次繪製前套好了，這裡是為了之後的切換。
    // applyTheme 會先比對目前的 class，相同就不碰 DOM —— 原本是無條件
    // remove 再 add，等於每次都讓瀏覽器重算一次樣式。
    const media = window.matchMedia(DARK_QUERY);
    const resolve = (): 'light' | 'dark' =>
      mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;

    const effective = resolve();
    applyTheme(effective);
    setComputedMode(effective);

    if (mode !== 'system') return;

    const onChange = () => {
      const next = resolve();
      applyTheme(next);
      setComputedMode(next);
    };

    // Safari < 14 沒有 addEventListener，只有已棄用的 addListener
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, [mode, setComputedMode]);

  return <>{children}</>;
};
