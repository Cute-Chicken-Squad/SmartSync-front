/**
 * 智环引诊 - 简易响应式状态管理
 *
 * 使用方式:
 *   store.set('patient.name', '新名字');           // 设置
 *   store.get('patient.name');                     // 获取
 *   store.watch('patient.name', (newVal, old) => {}); // 监听变化
 *   store.watch('*', (changes) => {});             // 监听全部变化
 */

const store = {
    _state: {},
    _watchers: {},
    _globalWatchers: [],

    /** 初始化状态 */
    init(initialState) {
        this._state = JSON.parse(JSON.stringify(initialState));
    },

    /** 获取值 (支持点路径) */
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this._state);
    },

    /** 设置值 (支持点路径) */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this._state);
        const oldValue = target[lastKey];
        target[lastKey] = value;

        // 通知监听器
        this._notify(path, value, oldValue);
        this._notifyGlobal(path, value, oldValue);

        return value;
    },

    /** 批量设置 */
    setAll(obj) {
        Object.entries(obj).forEach(([key, value]) => this.set(key, value));
    },

    /** 监听特定路径 */
    watch(path, callback) {
        if (!this._watchers[path]) this._watchers[path] = [];
        this._watchers[path].push(callback);
        return () => { // 返回取消监听函数
            this._watchers[path] = this._watchers[path].filter(cb => cb !== callback);
        };
    },

    /** 监听全部变化 */
    watchAll(callback) {
        this._globalWatchers.push(callback);
        return () => {
            this._globalWatchers = this._globalWatchers.filter(cb => cb !== callback);
        };
    },

    /** 获取完整状态 */
    getState() { return this._state; },

    _notify(path, newVal, oldVal) {
        (this._watchers[path] || []).forEach(cb => {
            try { cb(newVal, oldVal); } catch (e) { Logger.error('Store watcher error:', path, e); }
        });
        // 通知父路径
        const parts = path.split('.');
        while (parts.length > 1) {
            parts.pop();
            const parentPath = parts.join('.');
            (this._watchers[parentPath] || []).forEach(cb => {
                try { cb(this.get(parentPath), null); } catch (e) {}
            });
        }
    },

    _notifyGlobal(path, newVal, oldVal) {
        this._globalWatchers.forEach(cb => {
            try { cb([{ path, newVal, oldVal }]); } catch (e) {}
        });
    },
};

// 初始化 store 为 appData (在 main.js 加载后会调用 store.init(appData))
store.init({
    patient: { name: '', id: '', gender: '', age: 0 },
    appointment: { department: '', floor: '', time: '', waitTime: '' },
    progress: [],
    reports: [],
    reminder: { date: '', department: '', doctor: '', room: '' },
    queue: { number: 0, waitTime: '', aheadCount: 0, avgDuration: '' },
    _source: 'init',
    _loaded: false,
});

// 全局导出
window.store = store;
