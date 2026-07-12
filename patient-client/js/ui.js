/**
 * 智环引诊 - 患者客户端 UI 工具库
 * 提供: 骨架屏 / 空状态 / 错误状态 / Toast 增强 / 页面过渡
 */

// ===================== 骨架屏 =====================

const Skeleton = {
    /**
     * 在目标容器中显示骨架屏
     * @param {string|Element} container - 容器选择器或元素
     * @param {'card'|'list'|'progress'|'text'|'kpi'} type - 骨架类型
     * @param {number} count - 重复数量 (list 类型)
     */
    show(container, type = 'card', count = 1) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;
        el.dataset.skeletonHtml = el.innerHTML; // 保存原始内容
        el.classList.add('skeleton-loading');
        el.innerHTML = Array(count).fill(0).map(() => this._template(type)).join('');
    },

    hide(container) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;
        el.classList.remove('skeleton-loading');
        if (el.dataset.skeletonHtml) {
            el.innerHTML = el.dataset.skeletonHtml;
            delete el.dataset.skeletonHtml;
        }
    },

    _template(type) {
        const t = {
            card: `<div class="sk-card"><div class="sk-line w60"></div><div class="sk-line w80"></div><div class="sk-line w40"></div></div>`,
            list: `<div class="sk-list-item"><div class="sk-avatar"></div><div class="sk-lines"><div class="sk-line w70"></div><div class="sk-line w50"></div></div></div>`,
            progress: `<div class="sk-progress"><div class="sk-step"></div><div class="sk-line"></div><div class="sk-step"></div><div class="sk-line"></div><div class="sk-step"></div><div class="sk-line"></div><div class="sk-step"></div></div>`,
            text: `<div class="sk-text"><div class="sk-line w90"></div><div class="sk-line w70"></div><div class="sk-line w50"></div></div>`,
            kpi: `<div class="sk-kpi"><div class="sk-line w40"></div><div class="sk-line w60 sk-line-lg"></div></div>`,
        };
        return t[type] || t.card;
    }
};

// ===================== 空状态 =====================

function showEmpty(container, { icon = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#959BA3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>', title = '暂无数据', desc = '', action = null } = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    el.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <div class="empty-title">${title}</div>
            ${desc ? `<div class="empty-desc">${desc}</div>` : ''}
            ${action ? `<button class="btn btn-primary btn-sm" onclick="${action}">点击刷新</button>` : ''}
        </div>
    `;
}

// ===================== 错误状态 =====================

function showError(container, { message = '加载失败', retry = null } = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    el.innerHTML = `
        <div class="error-state">
            <div class="error-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D94848" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <div class="error-title">${message}</div>
            ${retry ? `<button class="btn btn-secondary btn-sm" onclick="(${retry.toString()})()">重新加载</button>` : ''}
        </div>
    `;
}

// ===================== Toast 增强 =====================

const Toast = {
    _queue: [],
    _active: false,

    show(message, type = 'info', duration = 3000) {
        // 复用已有的 toast 元素
        const toast = document.getElementById('toast');
        if (!toast) {
            // 动态创建
            const el = document.createElement('div');
            el.id = 'toast';
            el.className = 'toast';
            el.innerHTML = '<span class="toast-message"></span>';
            document.body.appendChild(el);
            return this.show(message, type, duration);
        }
        const msgEl = toast.querySelector('.toast-message');
        if (!msgEl) return;
        msgEl.textContent = message;
        toast.className = 'toast toast-' + type;
        toast.classList.add('show');
        clearTimeout(this._timer);
        this._timer = setTimeout(() => toast.classList.remove('show'), duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); },
    loading(msg) {
        this.show((msg || '加载中...') + ' ⏳', 'info', 60000);
        return { close: () => this.hide() };
    },
    hide() {
        const toast = document.getElementById('toast');
        if (toast) toast.classList.remove('show');
    },
};

// ===================== 页面过渡动画 =====================

const PageTransition = {
    _animating: false,

    /** 带渐入动画的页面切换 */
    async go(pageId, duration = 250) {
        if (this._animating) return;
        this._animating = true;

        const current = document.querySelector('.page.active');
        const next = document.getElementById(pageId);

        if (!next) { this._animating = false; return; }
        if (current === next) { this._animating = false; return; }

        // 当前页滑出
        if (current) {
            current.style.transition = `opacity ${duration}ms, transform ${duration}ms`;
            current.style.opacity = '0';
            current.style.transform = 'translateY(-10px)';
        }

        await sleep(duration);

        // 切换 active
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        next.classList.add('active');
        next.style.opacity = '0';
        next.style.transform = 'translateY(10px)';

        // 强制回流
        next.offsetHeight;

        // 新页面滑入
        next.style.transition = `opacity ${duration}ms, transform ${duration}ms`;
        next.style.opacity = '1';
        next.style.transform = 'translateY(0)';

        if (current) {
            current.style.opacity = '';
            current.style.transform = '';
        }

        await sleep(duration);
        next.style.transition = '';
        this._animating = false;
    },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===================== 下拉刷新 =====================

function initPullToRefresh(containerSelector, onRefresh) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    let startY = 0, pulling = false;
    const indicator = document.createElement('div');
    indicator.className = 'pull-indicator';
    indicator.innerHTML = '<span>↓ 下拉刷新</span>';
    container.prepend(indicator);

    container.addEventListener('touchstart', e => {
        if (container.scrollTop > 0) return;
        startY = e.touches[0].clientY;
        pulling = true;
    }, { passive: true });

    container.addEventListener('touchmove', e => {
        if (!pulling) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0 && container.scrollTop <= 0) {
            indicator.style.height = Math.min(dy, 80) + 'px';
            indicator.querySelector('span').textContent = dy > 60 ? '松开刷新' : '↓ 下拉刷新';
        }
    }, { passive: true });

    container.addEventListener('touchend', async () => {
        if (!pulling) return;
        pulling = false;
        const h = parseInt(indicator.style.height) || 0;
        if (h > 60) {
            indicator.querySelector('span').textContent = '⏳ 刷新中...';
            try { await onRefresh(); } catch (e) { /* ignore */ }
        }
        indicator.style.height = '0';
    });
}

// ===================== 数字动画 =====================

function animateNumber(el, from, to, duration = 800) {
    const element = typeof el === 'string' ? document.querySelector(el) : el;
    if (!element) return;
    const start = performance.now();
    const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out
        const current = Math.round(from + (to - from) * eased);
        element.textContent = current.toLocaleString('zh-CN');
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ===================== 设备信息 =====================

const Device = {
    isMobile() { return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent); },
    isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); },
    isAndroid() { return /Android/i.test(navigator.userAgent); },
    hasTouch() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; },

    /** 触觉反馈 */
    haptic(style = 'light') {
        if (navigator.vibrate) {
            if (style === 'light') navigator.vibrate(10);
            else if (style === 'medium') navigator.vibrate(30);
            else if (style === 'heavy') navigator.vibrate([20, 50, 20]);
        }
    },
};

// ===================== 键盘适配 =====================

function initKeyboardAdapt() {
    if (!Device.isMobile()) return;
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            setTimeout(() => {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    });
}

// ===================== 网络状态监听 =====================

function initNetworkMonitor() {
    const updateStatus = () => {
        const offline = !navigator.onLine;
        document.body.classList.toggle('is-offline', offline);
        if (offline) {
            Toast.show('当前处于离线状态，显示缓存数据', 'warning', 5000);
        }
    };
    window.addEventListener('online', () => { updateStatus(); Toast.show('网络已恢复', 'success', 2000); });
    window.addEventListener('offline', () => updateStatus());
    updateStatus();
}

// ===================== 全局导出 =====================

window.Skeleton = Skeleton;
window.showEmpty = showEmpty;
window.showError = showError;
window.Toast = Toast;
window.PageTransition = PageTransition;
window.initPullToRefresh = initPullToRefresh;
window.animateNumber = animateNumber;
window.Device = Device;
window.initKeyboardAdapt = initKeyboardAdapt;
window.initNetworkMonitor = initNetworkMonitor;
