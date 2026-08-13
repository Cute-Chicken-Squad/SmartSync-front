/**
 * 智环引诊 - Dashboard 首页逻辑
 * 对接后端: /admin/api/dashboard/*
 * 数据写入: handleAlarmAction
 */

// ===================== 工具函数 =====================

/** 格式化数字，添加千分位 */
function fmtNum(n) {
    if (n == null) return '--';
    return Number(n).toLocaleString('zh-CN');
}

/** 获取负载状态 CSS 类 */
function loadStatusClass(status) {
    if (status === 'danger') return 'danger';
    if (status === 'warning') return 'warning';
    return 'normal';
}

/** HTML 转义 */
function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        const date = new Date();
        const timeString = formatLocalDateTime(date);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // ★ 确保认证后再加载数据（写操作需要有效 token 才能持久化到后端数据库）
    await ensureAuth();
    await refreshAllData();

    // ★ 启动实时警报监控（子站点击紧急求助 → 总站弹窗）
    if (typeof AlarmRealtime !== 'undefined') {
        AlarmRealtime.start(function () {
            // 新警报到达时刷新 KPI / 警报数据
            loadKpi();
            loadAlarms();
        });
    }
});

async function refreshAllData() {
    await Promise.all([
        loadKpi(),
        loadDeptLoad(),
        loadAlarms(),
        loadSourceDistribution(),
        loadTrafficTrend(),
        loadSystemStatus(),
    ]);
    console.log('[Dashboard] 数据已刷新');
}

// ===================== 数据加载 =====================

async function loadKpi() {
    try {
        const res = await adminApi.getKpi();
        if (res.code === 200 && res.data) {
            const d = res.data;
            // 卡片顺序: 0 今日就诊人数 / 1 当前在院人数 / 2 已绑定手环 / 3 警报数量
            updateKpiCard(0, fmtNum(d.todayVisits));
            updateKpiCard(1, fmtNum(d.currentOnsite));
            updateKpiCard(2, fmtNum(d.boundBracelets));
            updateKpiCard(3, fmtNum(d.pendingAlarms));
            updateBraceletChange(d.availableBracelets);
            updateAlarmStatus();
            console.log('[Dashboard] KPI 已加载');
        }
    } catch (e) { console.warn('[Dashboard] KPI 加载失败:', e.message); }
}

async function loadDeptLoad() {
    try {
        const res = await adminApi.getDeptLoad();
        if (res.code === 200 && res.data) {
            const depts = Array.isArray(res.data) ? res.data : [];
            renderDeptLoad(depts);
            console.log('[Dashboard] 科室负载已加载:', depts.length);
        }
    } catch (e) { console.warn('[Dashboard] 科室负载加载失败:', e.message); }
}

async function loadAlarms() {
    try {
        const res = await adminApi.getAlarms(5);
        if (res.code === 200 && res.data) {
            const alarms = Array.isArray(res.data) ? res.data : (res.data.records || []);
            renderAlarms(alarms);
            console.log('[Dashboard] 警报已加载:', alarms.length);
        }
    } catch (e) { console.warn('[Dashboard] 警报加载失败:', e.message); }
}

async function loadSourceDistribution() {
    try {
        const res = await adminApi.getSourceDistribution();
        if (res.code === 200 && res.data) {
            renderSourceDistribution(res.data);
            console.log('[Dashboard] 来源分布已加载');
        }
    } catch (e) { console.warn('[Dashboard] 来源分布加载失败:', e.message); }
}

async function loadTrafficTrend() {
    try {
        const res = await adminApi.getTrafficTrend();
        if (res.code === 200 && res.data) {
            renderTrafficTrend(res.data);
            console.log('[Dashboard] 流量趋势已加载');
        }
    } catch (e) { console.warn('[Dashboard] 流量趋势加载失败:', e.message); }
}

async function loadSystemStatus() {
    try {
        const res = await adminApi.getSystemStatus();
        if (res.code === 200 && res.data) {
            var s = res.data;
            // 兼容两种返回：直接是状态对象 {terminalsOnline,...}，或 {status:{...}}
            if (s && s.status && typeof s.status === 'object') s = s.status;
            renderSystemStatus(s);
            console.log('[Dashboard] 系统状态:', s);
        }
    } catch (e) { console.warn('[Dashboard] 系统状态加载失败:', e.message); }
}

function renderSystemStatus(s) {
    if (!s) return;
    var dev = s.deviceStatus || {};
    var set = function (id, val) { var el = document.getElementById(id); if (el && val != null) el.textContent = val; };
    if (s.terminalsOnline != null) set('sysSubOnline', s.terminalsOnline + '/' + (s.terminalsOnline + (s.terminalsOffline || 0)));
    if (s.terminalsOffline != null) set('sysSubOffline', s.terminalsOffline);
    if (dev.nfcDevices != null) set('sysNfcDevices', dev.nfcDevices + '台');
    if (dev.voiceDevices != null) set('sysVoiceDevices', dev.voiceDevices + '台');
    if (dev.pendingMaintenance != null) set('sysPendingMaintenance', dev.pendingMaintenance + '台');
}

// ===================== 渲染函数 =====================

function renderDeptLoad(depts) {
    const container = document.querySelector('.dept-list');
    if (!container) return;
    if (!depts.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#868e96;">暂无科室数据</div>';
        return;
    }
    container.innerHTML = depts.slice(0, 5).map((d) => `
        <div class="dept-row">
            <div class="dept-name">${escHtml(d.deptName)}</div>
            <div class="dept-info">
                <span class="dept-count">${d.queueCount ?? '--'}</span>
                <div class="dept-bar">
                    <div class="dept-fill ${loadStatusClass(d.loadStatus)}" style="width:${Math.min(d.utilization || 0, 100)}%;"></div>
                </div>
                <span class="dept-percent">${Math.round(d.utilization || 0)}%</span>
            </div>
        </div>
    `).join('');
}

function renderAlarms(alarms) {
    const container = document.querySelector('.alarm-list');
    if (!container) return;
    if (!alarms.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#868e96;">暂无警报</div>';
        return;
    }
    container.innerHTML = alarms.slice(0, 5).map((a) => `
        <div class="alarm-item">
            <div class="alarm-indicator ${a.level >= 3 ? 'urgent' : ''}"></div>
            <div class="alarm-content">
                <div class="alarm-time">${a.createdAt ? a.createdAt.substring(11, 16) : '--'}</div>
                <div class="alarm-location">${escHtml(a.location || '--')}</div>
                <div class="alarm-desc">${escHtml(a.description || a.type || '--')}</div>
            </div>
            <button class="alarm-btn ${a.level >= 3 ? 'urgent' : ''}" onclick="handleAlarmAction('${a.id}')">立即处理</button>
        </div>
    `).join('');
}

function renderSourceDistribution(data) {
    const pie = document.getElementById('sourcePie');
    const legend = document.getElementById('sourceLegend');
    if (!pie || !legend) return;

    const items = (Array.isArray(data) ? data : []).map((d) => ({
        name: d.label || d.source || '其他',
        count: d.count || 0,
        percentage: d.percentage || 0,
    }));
    if (!items.length) return;

    const colors = ['#5BA0E6', '#5BCFA0', '#F0D490', '#F0AFAF', '#B49BD9', '#F7A58F'];
    const total = items.reduce((s, x) => s + x.count, 0);
    const R = 80, SW = 25, C = 2 * Math.PI * R;

    // 环形图：按占比生成弧段
    let offset = 0;
    const segments = items.map((x, i) => {
        const len = (x.percentage / 100) * C;
        const seg = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="${SW}"
            stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 100 100)" />`;
        offset += len;
        return seg;
    }).join('');

    pie.innerHTML = `<svg width="200" height="200" viewBox="0 0 200 200">
        ${segments}
        <text x="100" y="96" text-anchor="middle" font-size="16" font-weight="500" fill="#495057">${fmtNum(total)}</text>
        <text x="100" y="116" text-anchor="middle" font-size="12" fill="#868e96">今日总量</text>
    </svg>`;

    legend.innerHTML = items.map((x, i) => `
        <div class="legend-item">
            <span class="legend-color" style="background: ${colors[i % colors.length]};"></span>
            <span class="legend-label">${escHtml(x.name)}</span>
            <span class="legend-value">${x.percentage}%</span>
        </div>
    `).join('');
}

function renderTrafficTrend(data) {
    const svg = document.getElementById('trafficChart');
    const yAxis = document.getElementById('trafficYAxis');
    if (!svg) return;

    const points = (Array.isArray(data) ? data : []).map((d) => ({ hour: d.hour, count: d.count || 0 }));
    if (!points.length) return;

    const W = 800, H = 200, PAD = 10;
    const rawMax = Math.max.apply(null, points.map((p) => p.count).concat([1]));
    const niceMax = Math.ceil(rawMax / 50) * 50;
    const stepX = (W - PAD * 2) / (points.length - 1 || 1);
    const x = (i) => PAD + i * stepX;
    const y = (c) => H - PAD - (c / niceMax) * (H - PAD * 2);

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${H - PAD} L ${x(0).toFixed(1)} ${H - PAD} Z`;

    const peak = points.reduce((a, b) => (a.count >= b.count ? a : b));
    const dots = points.map((p, i) =>
        (p === peak || i % 4 === 0) ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.count).toFixed(1)}" r="3" fill="#4285f4" />` : ''
    ).join('');

    svg.innerHTML = `
        <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="rgba(66, 133, 244, 0.3)" />
                <stop offset="100%" stop-color="rgba(66, 133, 244, 0)" />
            </linearGradient>
        </defs>
        <path d="${linePath}" fill="none" stroke="#4285f4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${areaPath}" fill="url(#lineGradient)" />
        ${dots}
    `;

    if (yAxis) {
        yAxis.innerHTML = [niceMax, Math.round(niceMax * 2 / 3), Math.round(niceMax / 3), 0]
            .map((v) => `<span>${v}</span>`).join('');
    }
}

// ===================== 写操作 =====================

async function handleAlarmAction(alarmId) {
    try {
        await adminApi.handleAlarm(alarmId, '控制中心快速处理');
        // 处理后刷新警报列表 + KPI
        loadAlarms();
        loadKpi();
    } catch (e) {
        alert('处理失败: ' + e.message);
    }
}

// 兼容旧版静态按钮（数据加载完成后会被 renderAlarms 替换为真实 ID）
function handleAlarm(index) {
    loadAlarms();
    loadKpi();
}

// ===================== UI 辅助 =====================

function refreshData() {
    const btn = document.querySelector('.refresh-btn');
    btn.innerHTML = '刷新中...';
    refreshAllData().then(() => {
        btn.innerHTML = '刷新';
    });
}

function updateAlarmStatus() {
    const alarmCard = document.getElementById('alarmCard');
    const alarmValue = document.getElementById('alarmValue');
    const alarmStatus = document.getElementById('alarmStatus');
    if (!alarmValue || !alarmStatus) return;

    const count = parseInt(alarmValue.textContent) || 0;
    if (count === 0) {
        if (alarmCard) alarmCard.classList.remove('alarm');
        alarmStatus.textContent = '正常';
        alarmStatus.className = 'kpi-change positive';
    } else {
        if (alarmCard) alarmCard.classList.add('alarm');
        alarmStatus.innerHTML = '<span>!</span>待处理';
        alarmStatus.className = 'kpi-change danger';
    }
}

function updateKpiElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/** 按索引更新 KPI 卡片数值（0 今日就诊 / 1 当前在院 / 2 已绑定手环 / 3 警报数量） */
function updateKpiCard(index, value) {
    const cards = document.querySelectorAll('.kpi-card .kpi-value');
    if (cards[index]) cards[index].textContent = value;
}

/** 更新手环卡片的副标题 "可用 N 个" */
function updateBraceletChange(available) {
    const el = document.querySelector('.bracelet-card .kpi-change');
    if (el && available != null) {
        el.innerHTML = '<span>可用</span>' + fmtNum(available) + ' 个';
    }
}
