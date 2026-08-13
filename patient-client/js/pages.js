/**
 * 智环引诊 - 页面管理模块
 * 解决: 底部导航重复 / 空状态缺失 / 页面过渡生硬
 */

// ===================== 底部导航（单例渲染） =====================

const BOTTOM_NAV_HTML = `
    <div class="bottom-nav" id="bottomNav">
        <div class="nav-item active" data-page="overview">
            <div class="nav-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="nav-text">首页</span>
        </div>
        <div class="nav-item" data-page="reports">
            <div class="nav-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="nav-text">报告</span>
        </div>
        <div class="nav-item" data-page="reminder">
            <div class="nav-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="nav-text">复诊</span>
        </div>
        <div class="nav-item" data-page="profile">
            <div class="nav-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="nav-text">我的</span>
        </div>
    </div>
`;

const BOTTOM_NAV_STYLE = `
    <style id="bottom-nav-style">
        .bottom-nav {
            position: fixed; bottom: 0;
            left: 50%; transform: translateX(-50%);
            width: 100%; max-width: 420px;
            display: flex; justify-content: space-around; align-items: center;
            background: var(--bg-primary, #fff);
            border-top: 1px solid var(--border-light, #EDF0F4);
            padding: 6px 0 calc(6px + env(safe-area-inset-bottom, 0));
            z-index: 1000;
            box-shadow: 0 -2px 12px rgba(27,58,75,0.05);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        .bottom-nav .nav-item {
            display: flex; flex-direction: column; align-items: center; gap: 2px;
            padding: 4px 12px; cursor: pointer; color: var(--text-muted, #959BA3);
            transition: color 0.2s; border: none; background: none;
            -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        }
        .bottom-nav .nav-item.active { color: var(--accent-color, #3B82C0); }
        .bottom-nav .nav-text { font-size: 11px; font-weight: 500; }
        .bottom-nav .nav-icon { display: flex; align-items: center; justify-content: center; }
        /* 老年模式底部导航增大 */
        body.elder-mode .bottom-nav { padding: 10px 0 calc(10px + env(safe-area-inset-bottom, 0)); }
        body.elder-mode .bottom-nav .nav-text { font-size: 14px; }
        body.elder-mode .bottom-nav .nav-icon svg { width: 28px; height: 28px; }
        /* 高对比度模式 */
        body.high-contrast .bottom-nav { border-top-color: var(--border-color); background: var(--bg-primary); }
    </style>
`;

/** 需要显示底部导航的页面 */
const NAV_PAGES = new Set(['overview', 'reports', 'reminder', 'profile']);

/** 渲染底部导航（仅首次调用） */
function ensureBottomNav() {
    const nav = document.getElementById('bottomNav');
    if (!nav) {
        // 备选：动态创建
        document.head.insertAdjacentHTML('beforeend', BOTTOM_NAV_STYLE);
        document.querySelector('.app-wrapper')?.insertAdjacentHTML('beforeend', BOTTOM_NAV_HTML);
        return;
    }

    // 防止重复绑定 (使用 data-bound 标记)
    if (nav.dataset.bound) return;
    nav.dataset.bound = '1';

    // 绑定点击事件
    nav.addEventListener('click', (e) => {
        const item = e.target.closest('.nav-item');
        if (!item) return;
        const pageId = item.dataset.page;
        if (pageId) {
            if (typeof Device !== 'undefined' && Device.haptic) Device.haptic('light');
            showPage(pageId);
        }
    });
}

/** 更新导航高亮 */
function updateNavHighlight(pageId) {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    nav.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });
}

// ===================== 页面空状态注入 =====================

const EMPTY_STATES = {
    reports: {
        icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#959BA3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', title: '暂无报告', desc: '就诊完成后，检查报告将显示在这里',
    },
    reminder: {
        icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#959BA3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', title: '暂无复诊计划', desc: '医生安排复诊后，提醒将显示在这里',
    },
    trace: {
        icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#959BA3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/></svg>', title: '暂无轨迹数据', desc: '就诊过程中的移动轨迹将显示在这里',
    },
    progress: {
        icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#959BA3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', title: '暂无进度', desc: '就诊开始后，进度将实时更新',
    },
    queue: {
        icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#959BA3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', title: '暂无排队信息', desc: '到达科室后将显示排队状态',
    },
    'family-mode': {
        icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#959BA3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', title: '未绑定家人', desc: '绑定家人手环后可查看他们的就诊状态',
    },
};

/**
 * 为容器添加空状态标记，数据为空时自动显示
 * 用法: <div class="page-content" data-empty="reports"></div>
 *        → 数据空时自动渲染空状态
 */
function initEmptyStates() {
    document.querySelectorAll('[data-empty]').forEach(el => {
        const key = el.dataset.empty;
        const state = EMPTY_STATES[key];
        if (!state) return;
        // 检查是否已有内容
        const hasContent = el.children.length > 0 && el.textContent.trim().length > 10;
        if (!hasContent) {
            el.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">${state.icon}</div>
                    <div class="empty-title">${state.title}</div>
                    <div class="empty-desc">${state.desc}</div>
                </div>`;
        }
    });
}

/**
 * 在指定容器注入空状态（供数据加载后调用）
 */
function injectEmptyState(container, pageName) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    const state = EMPTY_STATES[pageName];
    if (!state) return;
    el.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${state.icon}</div>
            <div class="empty-title">${state.title}</div>
            <div class="empty-desc">${state.desc}</div>
        </div>`;
}

// ===================== 页面过渡增强 =====================

let _transitioning = false;

/**
 * 带过渡动画的页面切换 (替代直接 showPage)
 */
async function navigateTo(pageId) {
    if (_transitioning || currentPageId === pageId) return;
    _transitioning = true;

    const current = document.querySelector('.page.active');
    const next = document.getElementById(pageId);
    if (!next) { _transitioning = false; return; }

    // 切换导航高亮
    updateNavHighlight(pageId);

    // 当前页淡出
    if (current) {
        current.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        current.style.opacity = '0';
        current.style.transform = 'scale(0.98)';
    }

    await new Promise(r => setTimeout(r, 200));

    // 切换
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    next.classList.add('active');
    next.style.opacity = '0';
    next.style.transform = 'scale(0.98)';
    next.offsetHeight; // force reflow
    next.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    next.style.opacity = '1';
    next.style.transform = 'scale(1)';

    window.scrollTo({ top: 0, behavior: 'instant' });
    currentPageId = pageId;

    // 检查空状态
    setTimeout(() => initEmptyStates(), 300);

    await new Promise(r => setTimeout(r, 250));

    if (current) { current.style.opacity = ''; current.style.transform = ''; }
    next.style.transition = '';
    _transitioning = false;
}

// ===================== 页面初始化 =====================

/** 首次加载时设置所有页面 */
function setupPages() {
    // 1. 渲染统一的底部导航
    ensureBottomNav();
    // 首页初始隐藏导航
    updateNavHighlight('home');

    // 2. 标记数据驱动的页面容器
    markDataContainers();

    // 3. 初始化空状态检查
    initEmptyStates();
}

/**
 * 自动标记需要空状态的容器
 */
function markDataContainers() {
    const mappings = {
        'report-list': 'reports',
        'reminder-card': 'reminder',
        'trace-map-container': 'trace',
        'progress-timeline': 'progress',
        'queue-card': 'queue',
    };

    Object.entries(mappings).forEach(([className, emptyKey]) => {
        const el = document.querySelector('.' + className);
        if (el && !el.dataset.empty) {
            el.dataset.empty = emptyKey;
        }
    });
}

// 全局导出
window.ensureBottomNav = ensureBottomNav;
window.updateNavHighlight = updateNavHighlight;
window.injectEmptyState = injectEmptyState;
window.initEmptyStates = initEmptyStates;
window.navigateTo = navigateTo;
window.setupPages = setupPages;
window.NAV_PAGES = NAV_PAGES;
window.EMPTY_STATES = EMPTY_STATES;

Logger.log('页面管理模块已加载');
