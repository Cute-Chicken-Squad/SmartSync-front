/**
 * 智环引诊 - 警报弹窗模块
 * 当检测到新警报时弹出醒目提示，不使用 emoji
 */

const AlarmPopup = {
    _overlay: null,
    _soundEnabled: true,
    _audioCtx: null,
    _knownAlarmIds: new Set(),
    _pollTimer: null,
    _pollInterval: 5000, // 每 5 秒轮询

    /**
     * 开始监听警报（页面加载后调用）
     */
    start() {
        this._knownAlarmIds.clear();
        // 首次延迟 5 秒后弹出
        setTimeout(() => {
            this._poll();
            this._pollTimer = setInterval(() => this._poll(), this._pollInterval);
        }, 5000);
        Logger.log('[AlarmPopup] 警报监听已启动 (5秒后首次检测)');
    },

    stop() {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    },

    async _poll() {
        try {
            let alarms;

            // 离线模式 — 使用模拟数据
            if (typeof API_OFFLINE !== 'undefined' && API_OFFLINE) {
                alarms = this._mockAlarms();
            } else {
                const res = await adminApi.getAlarms(10);
                if (res.code !== 200 || !res.data) return;
                alarms = Array.isArray(res.data) ? res.data : (res.data.records || []);
            }

            const pending = alarms.filter(a => a.status === 'pending');

            // 找出未知的新警报
            const newAlarms = pending.filter(a => !this._knownAlarmIds.has(a.id));
            if (newAlarms.length > 0) {
                newAlarms.forEach(a => this._knownAlarmIds.add(a.id));
                this._show(newAlarms);
            }

            // 同步：把已处理的从 known 中移除
            const activeIds = new Set(pending.map(a => a.id));
            this._knownAlarmIds.forEach(id => {
                if (!activeIds.has(id)) this._knownAlarmIds.delete(id);
            });
        } catch (e) { /* 静默失败 */ }
    },

    // ---- 渲染弹窗 ----
    _show(alarms) {
        // 已有弹窗显示中，不重复弹出
        if (this._overlay) return;

        const count = alarms.length;
        const topAlarm = alarms[0];
        const isStack = count > 1;

        const overlay = document.createElement('div');
        overlay.className = 'alarm-popup-overlay';
        overlay.innerHTML = this._buildHTML(alarms, isStack);
        document.body.appendChild(overlay);
        this._overlay = overlay;

        // 声音提示
        if (this._soundEnabled) this._beep(topAlarm.level >= 3 ? 'urgent' : 'normal');

        // 绑定事件
        this._bindEvents(overlay, alarms);

        // 点击遮罩关闭（低级别警报）
        if (topAlarm.level < 3) {
            overlay.addEventListener('click', (e) => { if (e.target === overlay) this._dismiss(overlay); });
        }
    },

    _buildHTML(alarms, isStack) {
        const count = alarms.length;
        const top = alarms[0];
        const level = top.level || 1;
        const levelLabel = level >= 4 ? 'I 级' : level === 3 ? 'II 级' : level === 2 ? 'III 级' : 'IV 级';

        let bodyHTML;
        if (isStack) {
            bodyHTML = `
                <div class="alarm-popup-stack">
                    ${alarms.map(a => `
                        <div class="alarm-popup-stack-item">
                            <div class="alarm-popup-stack-badge l${a.level || 1}"></div>
                            <div class="alarm-popup-stack-info">
                                <div class="alarm-popup-stack-title">${escHtml(a.location || '未知位置')} - ${escHtml(alarmTypeLabel(a.type))}</div>
                                <div class="alarm-popup-stack-meta">${escHtml(a.patientName || '未知患者')} &middot; ${escHtml(filterDesc(a.description))} &middot; ${this._formatTime(a.createdAt)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
        } else {
            // 子站信息：患者通过子站终端触发求助
            const terminalName = top.terminalName || top.terminalCode || '';
            const substationRow = terminalName ? `
                    <div class="alarm-popup-row full substation-row">
                        <span class="alarm-popup-label">触发子站</span>
                        <span class="alarm-popup-value">
                            <span class="substation-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="12" cy="12" r="4"/></svg>
                                ${escHtml(terminalName)}
                            </span>
                        </span>
                    </div>` : '';

            bodyHTML = `
                <div class="alarm-popup-rows">
                    <div class="alarm-popup-row">
                        <span class="alarm-popup-label">警报位置</span>
                        <span class="alarm-popup-value danger">${escHtml(top.location || '--')}</span>
                    </div>
                    ${substationRow}
                    <div class="alarm-popup-row">
                        <span class="alarm-popup-label">警报类型</span>
                        <span class="alarm-popup-value">${escHtml(alarmTypeLabel(top.type))}</span>
                    </div>
                    <div class="alarm-popup-row">
                        <span class="alarm-popup-label">关联患者</span>
                        <span class="alarm-popup-value">${escHtml(top.patientName || '--')}</span>
                    </div>
                    <div class="alarm-popup-row">
                        <span class="alarm-popup-label">触发时间</span>
                        <span class="alarm-popup-value">${this._formatTime(top.createdAt)}</span>
                    </div>
                    ${top.description ? `
                    <div class="alarm-popup-row full">
                        <span class="alarm-popup-label">详情描述</span>
                        <span class="alarm-popup-value">${escHtml(filterDesc(top.description))}</span>
                    </div>` : ''}
                </div>`;
        }

        return `
            <div class="alarm-popup">
                <div class="alarm-popup-header">
                    <div class="alarm-popup-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                    </div>
                    <div>
                        <div class="alarm-popup-title">${isStack ? '多条警报 (' + count + ')' : (top.terminalName ? '子站求助' : '紧急警报')}</div>
                        <div class="alarm-popup-subtitle">${isStack ? '请立即查看并处理' : (top.terminalName ? escHtml(top.terminalName) + ' 触发患者求助' : '检测到新的紧急事件')}</div>
                    </div>
                    <span class="alarm-popup-level l${level}">${levelLabel}</span>
                </div>
                <div class="alarm-popup-body">${bodyHTML}</div>
                <div class="alarm-popup-actions">
                    <span class="alarm-popup-sound-indicator${this._soundEnabled ? '' : ' muted'}" id="alarmSoundToggle" title="切换声音">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                        声音${this._soundEnabled ? '开' : '关'}
                    </span>
                    <button class="alarm-popup-btn-secondary alarm-popup-btn-ignore">暂不处理</button>
                    <button class="alarm-popup-btn-primary alarm-popup-btn-handle">立即处理</button>
                </div>
            </div>`;
    },

    _bindEvents(overlay, alarms) {
        const handleBtn = overlay.querySelector('.alarm-popup-btn-handle');
        const ignoreBtn = overlay.querySelector('.alarm-popup-btn-ignore');
        const soundToggle = overlay.querySelector('#alarmSoundToggle');

        handleBtn?.addEventListener('click', async () => {
            handleBtn.textContent = '处理中...'; handleBtn.disabled = true;
            try {
                for (const a of alarms) {
                    if (a.status === 'pending') await adminApi.handleAlarm(a.id, '弹窗快速处理');
                }
            } catch (e) { /* continue */ }
            this._dismiss(overlay);
            // 触发外部刷新
            if (typeof refreshAllData === 'function') refreshAllData();
            if (typeof loadAlarms === 'function') loadAlarms();
        });

        ignoreBtn?.addEventListener('click', () => this._dismiss(overlay));

        soundToggle?.addEventListener('click', () => {
            this._soundEnabled = !this._soundEnabled;
            soundToggle.classList.toggle('muted', !this._soundEnabled);
            soundToggle.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                声音${this._soundEnabled ? '开' : '关'}`;
        });
    },

    _dismiss(overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s';
        setTimeout(() => overlay.remove(), 200);
        if (this._overlay === overlay) this._overlay = null;
    },

    // ---- 离线模拟数据 ----
    _mockAlarms() {
        // 优先使用统一模拟数据中心 (mock-data.js)，保持各处数据一致
        if (typeof MOCK !== 'undefined' && MOCK.emergencyAlarms) {
            const records = MOCK.emergencyAlarms.records || [];
            return records.map(r => ({
                ...r,
                terminalName: (r.location || '').includes('1F') ? '门诊一层子站'
                    : (r.location || '').includes('2F') ? '门诊二层子站'
                    : (r.location || '').includes('3F') ? '门诊三层子站' : '',
                terminalCode: (r.location || '').includes('1F') ? 'SUB-1F-01'
                    : (r.location || '').includes('2F') ? 'SUB-2F-01'
                    : (r.location || '').includes('3F') ? 'SUB-3F-01' : '',
            }));
        }
        // 降级内置数据
        return [
            { id: 90001, alarmCode: 'ALM-001', type: 'emergency', level: 3, location: '2F-洗手间附近',
                patientName: '王大爷', status: 'pending', terminalName: '门诊二层子站', terminalCode: 'SUB-2F-01',
                description: '患者触发求助按钮，需要立即响应', createdAt: new Date().toISOString() },
            { id: 90002, alarmCode: 'ALM-002', type: 'wheelchair', level: 2, location: '1F-电梯厅',
                patientName: '李女士', status: 'pending', terminalName: '门诊一层子站', terminalCode: 'SUB-1F-01',
                description: '需要轮椅协助通行', createdAt: new Date(Date.now() - 120000).toISOString() },
            { id: 90003, alarmCode: 'ALM-003', type: 'maintenance', level: 1, location: '3F-检验科门口',
                patientName: '', status: 'pending', terminalName: '门诊三层子站', terminalCode: 'SUB-3F-01',
                description: '暂无', createdAt: new Date(Date.now() - 360000).toISOString() },
        ];
    },

    // ---- 声音提示 ----
    _beep(type) {
        try {
            if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = this._audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'urgent' ? 0.3 : 0.2));

            if (type === 'urgent') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            } else {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(660, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.2);
            }
        } catch (e) { /* 静默 */ }
    },

    _formatTime(isoStr) {
        if (!isoStr) return '--';
        try { return new Date(isoStr).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
        catch { return isoStr.substring(11, 19) || isoStr; }
    },
};

function alarmTypeLabel(type) {
    const map = {
        emergency: '患者求助', wheelchair: '轮椅协助', maintenance: '患者求助',
        fall: '跌倒检测', vital: '生命体征异常', broadcast: '通知广播',
        // 子站相关
        substation_offline: '子站离线', substation_error: '子站故障',
        substation_restart: '子站重启', substation_signal_weak: '子站信号弱',
        substation_battery_low: '子站电量低',
    };
    return map[type] || type || '未知类型';
}

/** 判断是否为子站相关警报 */
function isSubstationAlarm(type) {
    return type && (type.startsWith('substation_') || type === 'maintenance');
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/** 过滤后端自动生成的描述，显示为"暂无" */
function filterDesc(str) {
    if (!str) return '暂无';
    const skipPatterns = ['子站终端重启任务', '子站重启任务'];
    if (skipPatterns.some(p => str.includes(p))) return '暂无';
    return str;
}
