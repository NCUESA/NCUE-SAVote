import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

export interface NavItem {
    label: string;
    icon: React.ReactNode;
    activeIcon?: React.ReactNode;
    to: string;
    end?: boolean;
}

export interface NavigationProps {
    items: NavItem[];
    className?: string;
    orientation?: 'horizontal' | 'vertical'; // vertical = rail, horizontal = bottom bar
    onItemClick?: (to: string) => boolean; // return true to prevent default navigation
    /** 螢幕閱讀器用的導航區名稱 */
    label?: string;
}

/**
 * 導航
 *
 * 兩種形態共用同一套語彙：
 *   - 外層是一條「脫離邊緣的浮動玻璃膠囊」，內容從它下方捲過
 *   - 作用中的項目是一顆中性的高光膠囊（.nav-active），同時包住圖示與文字，
 *     圖示與文字改用主色
 *
 * 高光膠囊刻意不再掛一層 backdrop-filter：子元素取樣到的是父層已經合成過的
 * 結果，第二次模糊幾乎看不出差別，卻實打實多付一次 GPU 合成成本。
 */
export const Navigation: React.FC<NavigationProps> = ({
    items,
    className,
    orientation = 'horizontal',
    onItemClick,
    label,
}) => {
    const isBottomBar = orientation === 'horizontal';

    // 後台最多 7 個項目。固定平分 390px 時每格只剩 51px —— 文字被截斷、
    // 觸控目標遠低於 44px。超過 5 項就改成可橫向捲動，每格維持固定寬度。
    const isCrowded = items.length > 5;

    const renderItem = (item: NavItem) => (
        <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            onClick={(e) => {
                if (onItemClick && onItemClick(item.to)) {
                    e.preventDefault();
                }
            }}
            className={({ isActive }) =>
                cn(
                    'group relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl outline-none',
                    'transition-[background-color,border-color,box-shadow,color] duration-[var(--dur-control)] ease-[var(--ease-glass)]',
                    'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ring-offset)]',
                    isBottomBar
                        ? cn('shrink-0 px-2 py-2', isCrowded ? 'w-[76px]' : 'min-w-0 flex-1')
                        : 'w-full px-1 py-2',
                    // 作用中：中性高光膠囊，圖示與文字用主色（同 iOS 分頁列與
                    // Lodestar 的做法）。不再用染藍的透鏡 —— 那會和頁面上的
                    // 主要按鈕搶同一種藍的視覺重量。
                    isActive
                        ? 'nav-active'
                        : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-on-surface)]/[0.05] hover:text-[var(--color-on-surface)]',
                )
            }
        >
            {({ isActive }) => (
                <>
                    <span
                        aria-hidden="true"
                        className={cn(
                            'relative z-10 transition-transform duration-[var(--dur-control)] ease-[var(--ease-glass)]',
                            isActive ? 'scale-105' : 'group-hover:scale-105',
                        )}
                    >
                        {isActive && item.activeIcon ? item.activeIcon : item.icon}
                    </span>
                    <span
                        className={cn(
                            'relative z-10 px-0.5 text-center text-[11px] leading-tight',
                            isBottomBar
                                ? 'max-w-[72px] truncate'
                                : 'line-clamp-2 max-w-[68px] text-balance',
                            isActive ? 'font-bold tracking-tight' : 'font-medium opacity-85',
                        )}
                    >
                        {item.label}
                    </span>
                </>
            )}
        </NavLink>
    );

    if (isBottomBar) {
        return (
            // 外層只負責留白與安全區；真正的玻璃膠囊是裡面那層。
            // pointer-events-none 讓膠囊兩側的留白不會擋住底下的內容。
            <div
                className={cn(
                    'pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden',
                    'px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2',
                    className,
                )}
            >
                <div className="relative">
                    <nav
                        aria-label={label ?? '主要導航'}
                        className={cn(
                            'glass pointer-events-auto flex items-stretch gap-1 rounded-3xl p-1.5',
                            isCrowded && 'nav-scroll',
                        )}
                    >
                        {items.map(renderItem)}
                    </nav>

                    {/* 捲動提示放在膠囊外面的定位層，才不會跟著內容一起捲走 */}
                    {isCrowded && (
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-1.5 right-1.5 w-12 rounded-r-3xl bg-gradient-to-l from-[var(--color-surface-container-lowest)] via-[var(--color-surface-container-lowest)]/70 to-transparent"
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        // 桌機側邊 rail 同樣是浮動膠囊，而不是貼齊左緣的實心欄
        <nav
            aria-label={label ?? '主要導航（側邊）'}
            className={cn(
                'glass custom-scrollbar fixed bottom-4 left-3 top-[88px] z-30 hidden w-[84px] md:flex',
                'flex-col items-center gap-1 overflow-y-auto overscroll-contain rounded-3xl p-2',
                className,
            )}
        >
            {items.map(renderItem)}
        </nav>
    );
};
