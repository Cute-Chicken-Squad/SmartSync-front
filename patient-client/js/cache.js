/**
 * 智环引诊 - 前端数据缓存层
 *
 * 策略:
 *   - API 成功响应自动缓存到 localStorage
 *   - 离线时自动返回缓存数据
 *   - TTL 过期后后台刷新，但先返回旧数据 (stale-while-revalidate)
 */

const Cache = {
    _prefix: 'smartsync_cache_',
    _memory: new Map(), // 内存缓存，避免重复读 localStorage

    // 默认 TTL (毫秒)
    TTL: {
        PATIENT: 5 * 60 * 1000,       // 患者信息 5 分钟
        VISIT: 2 * 60 * 1000,         // 就诊数据 2 分钟
        QUEUE: 30 * 1000,             // 排队状态 30 秒 (实时性要求高)
        REPORTS: 10 * 60 * 1000,      // 报告 10 分钟
        STATIC: 60 * 60 * 1000,       // 静态数据 1 小时
    },

    _key(name) { return this._prefix + name; },

    /** 写入缓存 */
    set(name, data, ttl = this.TTL.STATIC) {
        const entry = { data, ts: Date.now(), ttl };
        // 内存
        this._memory.set(name, entry);
        // 持久化 (跳过过大的数据)
        try {
            const json = JSON.stringify(entry);
            if (json.length < 500000) { // 500KB 上限
                localStorage.setItem(this._key(name), json);
            }
        } catch (e) { /* localStorage 满，忽略 */ }
    },

    /** 读取缓存 (null = 未命中或已过期) */
    get(name) {
        // 先查内存
        let entry = this._memory.get(name);
        if (!entry) {
            // 再查 localStorage
            try {
                const raw = localStorage.getItem(this._key(name));
                if (raw) {
                    entry = JSON.parse(raw);
                    this._memory.set(name, entry);
                }
            } catch (e) { return null; }
        }
        if (!entry) return null;
        // 检查 TTL
        if (Date.now() - entry.ts > entry.ttl) {
            // 过期但保留 (stale)，调用者自行判断
            entry._stale = true;
        }
        return entry.data;
    },

    /** 删除缓存 */
    remove(name) {
        this._memory.delete(name);
        try { localStorage.removeItem(this._key(name)); } catch (e) { /* ignore */ }
    },

    /** 清除所有患者相关缓存 */
    clearPatient() {
        const keys = ['patient_info', 'visit_overview', 'visit_progress', 'queue_status', 'reports_list'];
        keys.forEach(k => this.remove(k));
    },

    /** 清除全部缓存 */
    clearAll() {
        this._memory.clear();
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this._prefix)) toRemove.push(key);
        }
        toRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    },

    /** 获取缓存统计 */
    stats() {
        let count = 0, size = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this._prefix)) {
                count++;
                size += (localStorage.getItem(key) || '').length;
            }
        }
        return { count, sizeKB: (size / 1024).toFixed(1) };
    },
};

// ===================== 数据管理器: API + 缓存 + 降级 =====================

/**
 * 通用数据加载器
 * 策略: 内存 → localStorage缓存 → API → mock
 *
 * @param {object} opts
 *   - cacheKey: 缓存键名
 *   - ttl: 缓存 TTL (毫秒)
 *   - fetcher: async () => data   (API 调用)
 *   - fallback: 降级数据 (API 失败时使用)
 *   - onLoading: (bool) => void   (加载状态回调)
 *   - onError: (err) => void      (错误回调)
 */
async function loadData(opts) {
    const { cacheKey, ttl = Cache.TTL.STATIC, fetcher, fallback, onLoading, onError } = opts;

    // 1. 检查内存/磁盘缓存
    const cached = cacheKey ? Cache.get(cacheKey) : null;
    if (cached && !cached._stale) {
        return cached; // 新鲜缓存，直接返回
    }

    // 2. stale-while-revalidate: 有旧缓存先返回，后台刷新
    if (cached && cached._stale && !fallback) {
        // 后台刷新
        fetcher().then(fresh => {
            if (fresh) Cache.set(cacheKey, fresh, ttl);
        }).catch(() => {});
        return cached;
    }

    // 3. 调用 API
    if (onLoading) onLoading(true);
    try {
        const data = await fetcher();
        if (data) {
            if (cacheKey) Cache.set(cacheKey, data, ttl);
            if (onLoading) onLoading(false);
            return data;
        }
    } catch (err) {
        console.warn('[Cache] API 失败:', cacheKey, err.message);
        if (onError) onError(err);
    }
    if (onLoading) onLoading(false);

    // 4. 降级: 返回过期缓存
    if (cached) return cached;

    // 5. 最终降级: 返回 fallback 数据
    return fallback || null;
}

/**
 * 批量预加载常用数据
 */
async function preloadPatientData(patientId) {
    const tasks = [
        loadData({
            cacheKey: 'patient_info_' + patientId,
            ttl: Cache.TTL.PATIENT,
            fetcher: () => PatientService.getPatient(patientId),
            fallback: appData.patient,
        }).then(d => { if (d) Object.assign(appData.patient, { name: d.name, id: '#' + String(d.id).slice(-4), gender: d.gender === 1 ? '男' : '女', age: d.age }); }),

        loadData({
            cacheKey: 'visit_overview_' + patientId,
            ttl: Cache.TTL.VISIT,
            fetcher: () => PatientService.getVisitOverview(),
            fallback: appData.appointment,
        }).then(d => { if (d) Object.assign(appData.appointment, d); }),
    ];

    await Promise.allSettled(tasks);
    appData._loaded = true;
    appData._source = 'api';
}

// 全局导出
window.Cache = Cache;
window.loadData = loadData;
window.preloadPatientData = preloadPatientData;

console.log('[智环引诊] 缓存层已加载, 当前缓存:', Cache.stats());
