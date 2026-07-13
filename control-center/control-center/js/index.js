/**
 * 智环引诊 - 实时态势监控 Dashboard
 * 对接后端: GET /admin/api/dashboard/*
 */

// ===================== 实时时钟 =====================
setInterval(() => {
    const date = new Date();
    const timeString = date.toISOString().replace('T', ' ').substring(0, 19);
    const el = document.getElementById('dateInfo');
    if (el) el.textContent = timeString;
}, 1000);

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

/** 显示错误提示 */
function showError(context, err) {
    console.error(`[Dashboard] ${context}:`, err);
}

// ===================== KPI 指标 =====================

async function loadKpi() {
    try {
        const res = await adminApi.getKpi();
        if (res.code === 200 && res.data) {
            const d = res.data;
            updateKpiCard(0, fmtNum(d.todayVisits), null);
            updateKpiCard(1, fmtNum(d.currentOnsite), null);
            updateKpiCard(2, (d.deptUtilization != null ? Number(d.deptUtilization).toFixed(1) + '%' : '--'), null);
            updateKpiCard(3, fmtNum(d.pendingAlarms), d.pendingAlarms > 0 ? 'danger' : 'positive');

            // 更新手环统计（如果 DOM 中存在）
            updateBraceletStats(d.boundBracelets, d.availableBracelets);
        }
    } catch (e) { showError('KPI', e); }
}

function updateKpiCard(index, value, changeClass) {
    const cards = document.querySelectorAll('.kpi-card .kpi-value');
    if (cards[index]) cards[index].textContent = value;
}

function updateBraceletStats(bound, available) {
    const el = document.getElementById('braceletStats');
    if (el && bound != null) {
        el.textContent = '已绑定 ' + fmtNum(bound) + ' 个  |  可用 ' + fmtNum(available) + ' 个';
    }
}

// ===================== 科室负载排行 =====================

async function loadDeptLoad() {
    try {
        const res = await adminApi.getDeptLoad();
        if (res.code === 200 && res.data && Array.isArray(res.data)) {
            renderDeptLoad(res.data);
        }
    } catch (e) { showError('科室负载', e); }
}

function renderDeptLoad(depts) {
    const container = document.querySelector('.dept-list');
    if (!container) return;
    container.innerHTML = depts.slice(0, 5).map((d, i) => `
        <div class="dept-row">
            <div class="dept-name">${escHtml(d.deptName)}</div>
            <div class="dept-info">
                <span class="dept-count">${d.queueCount ?? '--'}</span>
                <div class="dept-bar">
                    <div class="dept-fill ${loadStatusClass(d.loadStatus)}" style="width:${Math.min(d.utilization || 0, 100)}%;"></div>
                </div>
                <span class="dept-percent">${d.utilization ?? 0}%</span>
            </div>
        </div>
    `).join('');
}

// ===================== 紧急警报 =====================

async function loadAlarms() {
    try {
        const res = await adminApi.getAlarms(5);
        if (res.code === 200 && res.data && Array.isArray(res.data)) {
            renderAlarms(res.data);
        }
    } catch (e) { showError('警报', e); }
}

function renderAlarms(alarms) {
    const container = document.querySelector('.alarm-list');
    if (!container) return;
    if (!alarms.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#868e96;">暂无警报</div>';
        return;
    }
    container.innerHTML = alarms.map((a, i) => `
        <div class="alarm-item" id="alarm-${a.id || i}">
            <div class="alarm-indicator ${a.level >= 3 ? 'urgent' : ''}"></div>
            <div class="alarm-content">
                <div class="alarm-time">${a.createdAt ? a.createdAt.substring(11, 16) : '--'}</div>
                <div class="alarm-location">${escHtml(a.location || '--')}</div>
                <div class="alarm-desc">${escHtml(a.description || a.type || '--')}</div>
            </div>
            <button class="alarm-btn ${a.level >= 3 ? 'urgent' : ''}" onclick="handleAlarmAction(${a.id})">立即处理</button>
        </div>
    `).join('');
}

// ===================== 患者来源分布 =====================

async function loadSourceDistribution() {
    try {
        const res = await adminApi.getSourceDistribution();
        if (res.code === 200 && res.data) {
            renderSourceDistribution(res.data);
        }
    } catch (e) { showError('来源分布', e); }
}

function renderSourceDistribution(data) {
    // data 格式可能是数组 [{label, count, percentage}] 或 {total, items}
    const items = Array.isArray(data) ? data : (data.items || []);
    if (!items.length) return;

    const legendContainer = document.querySelector('.source-legend');
    const pieContainer = document.querySelector('.source-pie');
    if (!legendContainer && !pieContainer) return;

    const colors = ['#5BA0E6', '#5BCFA0', '#F0D490', '#F0AFAF'];
    const total = items.reduce((s, i) => s + (i.count || 0), 0);

    // 更新饼图
    if (pieContainer) {
        let offset = 0;
        const circumference = 502;
        const circlesHtml = items.map((item, i) => {
            const pct = total > 0 ? (item.count / total) : 0;
            const dashLen = Math.max(pct * circumference, 0);
            const html = `<circle cx="100" cy="100" r="80" fill="none" stroke="${colors[i]}" stroke-width="25"
                stroke-dasharray="${dashLen} ${circumference}" stroke-dashoffset="-${offset}"
                transform="rotate(-90 100 100)" />`;
            offset += dashLen;
            return html;
        }).join('');
        pieContainer.querySelector('svg') && (pieContainer.querySelector('svg').innerHTML =
            pieContainer.querySelector('svg').innerHTML.replace(
                /<circle cx="100" cy="100" r="80"[^>]*\/?>/g, ''
            ) + circlesHtml);
    }

    // 更新图例
    if (legendContainer) {
        legendContainer.innerHTML = items.map((item, i) => `
            <div class="legend-item">
                <span class="legend-color" style="background:${colors[i]};"></span>
                <span class="legend-label">${escHtml(item.label)}</span>
                <span class="legend-value">${item.percentage ?? Math.round((item.count/total)*100)}%</span>
            </div>
        `).join('');
    }
}

// ===================== 流量趋势 =====================

async function loadTrafficTrend() {
    try {
        const res = await adminApi.getTrafficTrend();
        if (res.code === 200 && res.data && Array.isArray(res.data)) {
            renderTrafficTrend(res.data);
        }
    } catch (e) { showError('流量趋势', e); }
}

function renderTrafficTrend(data) {
    const svg = document.querySelector('.line-chart-svg');
    if (!svg || !data.length) return;

    const maxVal = Math.max(...data.map(d => d.visitCount || 0), 1);
    const w = 800, h = 200, padX = 50, padR = 30;
    const points = data.map((d, i) => {
        const x = padX + (i / Math.max(data.length - 1, 1)) * (w - padX - padR);
        const y = h - 20 - ((d.visitCount || 0) / maxVal) * (h - 60);
        return `${x},${y}`;
    });

    const polyline = points.join(' ');
    const fillPath = `M ${padX},${h - 20} L ${polyline} L ${points[points.length - 1].split(',')[0]},${h - 20} Z`;

    svg.innerHTML = `
        <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="rgba(66,133,244,0.3)" />
                <stop offset="100%" stop-color="rgba(66,133,244,0)" />
            </linearGradient>
        </defs>
        <path d="${polyline}" fill="none" stroke="#4285f4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${fillPath}" fill="url(#lineGradient)" />
        ${data.map((d, i) => {
            const [cx, cy] = points[i].split(',');
            return `<circle cx="${cx}" cy="${cy}" r="4" fill="#4285f4" />`;
        }).join('')}
    `;
}

// ===================== 系统运行状态 =====================

async function loadSystemStatus() {
    try {
        const res = await adminApi.getSystemStatus();
        if (res.code === 200 && res.data) {
            renderSystemStatus(res.data);
        }
    } catch (e) { showError('系统状态', e); }
}

function renderSystemStatus(data) {
    const summaryEl = document.querySelector('.system-status-summary span:last-child');
    if (summaryEl && data.status) {
        summaryEl.textContent = data.status === 'UP' ? '系统运行正常' : '系统异常';
    }
    // 更新边缘节点和设备状态 (API v2 新增字段)
    if (data.edgeNodes) {
        updateStatusItem('smartSubstations', data.edgeNodes.smartSubstations + '/' + (data.edgeNodes.smartSubstations || 0));
        updateStatusItem('lightGuideNodes', data.edgeNodes.lightGuideNodes + '/20');
        updateStatusItem('rfidSensorNodes', data.edgeNodes.rfidSensorNodes + '/6');
        updateStatusItem('onlineRate', (data.edgeNodes.onlineRate || 0) + '%');
    }
    if (data.deviceStatus) {
        updateStatusItem('nfcDevices', (data.deviceStatus.nfcDevices || 0) + '台');
        updateStatusItem('voiceDevices', (data.deviceStatus.voiceDevices || 0) + '台');
        updateStatusItem('pendingMaintenance', (data.deviceStatus.pendingMaintenance || 0) + '台');
    }
    if (data.terminalsOnline != null) {
        updateStatusItem('onlineTerminals', data.terminalsOnline + '/' + (data.terminalsOnline + (data.terminalsOffline || 0)));
    }
}

function updateStatusItem(key, value) {
    const el = document.querySelector(`[data-status="${key}"] .item-value`);
    if (el) el.textContent = value;
}

// ===================== 热力图 + 区域负载 =====================

async function loadHeatmap() {
    try {
        const res = await adminApi.getHeatmap();
        if (res.code === 200 && res.data && Array.isArray(res.data)) {
            renderAreaGrid(res.data);
        }
    } catch (e) { /* 接口可能未实现 */ }
}

function renderAreaGrid(heatmapPoints) {
    const container = document.querySelector('.area-grid');
    if (!container) return;

    // 聚合同名区域
    const groups = {};
    heatmapPoints.forEach(p => {
        const name = p.name || '未知区域';
        if (!groups[name]) groups[name] = { name, count: 0, intensity: 0, n: 0, type: p.type };
        groups[name].count += (p.intensity || 0) * 3;
        groups[name].intensity += p.intensity || 0;
        groups[name].n++;
    });

    const areas = Object.values(groups).map(g => ({
        name: g.name,
        count: Math.round(g.count),
        intensity: Math.round(g.intensity / g.n * 100),
        density: g.intensity / g.n > 0.7 ? 'high' : g.intensity / g.n > 0.4 ? 'medium' : 'low',
    }));

    // 按人数降序取前 6 个
    areas.sort((a, b) => b.count - a.count);
    const top = areas.slice(0, 6);

    container.innerHTML = top.map(a => `
        <div class="area-item">
            <div class="area-header">
                <span class="area-name">${escHtml(a.name)}</span>
                <span class="area-density ${a.density}">${a.density === 'high' ? '拥挤' : a.density === 'medium' ? '中等' : '畅通'}</span>
            </div>
            <div class="area-info">当前人数: ${a.count}人</div>
            <div class="area-bar">
                <div class="area-fill" style="width:${Math.min(a.intensity, 100)}%; background:${a.density === 'high' ? '#ff6b6b' : a.density === 'medium' ? '#fcc419' : '#51cf66'};"></div>
            </div>
        </div>
    `).join('');
}

// ===================== 数字孪生预览 =====================

async function loadTwinPreviewStats() {
    try {
        const [nodesRes, positionsRes] = await Promise.allSettled([
            adminApi.getDashboardNodes(),
            adminApi.getDigitalTwinPatientPositions(),
        ]);

        if (nodesRes.value?.code === 200 && nodesRes.value.data) {
            const nodes = Array.isArray(nodesRes.value.data) ? nodesRes.value.data : [];
            const onlineNodes = nodes.filter(n => n.status === 'online').length;
            updateTwinStat('previewSubOnline', onlineNodes + '/' + nodes.length);
        }

        if (positionsRes.value?.code === 200 && positionsRes.value.data) {
            const positions = Array.isArray(positionsRes.value.data) ? positionsRes.value.data : [];
            updateTwinStat('previewPatientCount', positions.length);
        }
    } catch (e) { /* 接口可能未实现 */ }
}

function updateTwinStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ===================== 警报处理 =====================

async function handleAlarmAction(alarmId) {
    try {
        await adminApi.handleAlarm(alarmId, '控制中心快速处理');
        // 重新加载警报列表
        loadAlarms();
        loadKpi();
    } catch (e) {
        alert('处理失败: ' + e.message);
    }
}

// 兼容旧版调用 (直接点击按钮)
function handleAlarm(index, event) {
    if (event) event.stopPropagation();
    const btn = event ? event.target : document.querySelector(`.alarm-btn`);
    if (btn) {
        btn.innerHTML = '处理中...';
        btn.disabled = true;
    }
    // 尝试从 DOM 中找到 alarm id
    const alarmItem = btn?.closest('.alarm-item');
    const alarmId = alarmItem?.id?.replace('alarm-', '');
    if (alarmId) {
        handleAlarmAction(Number(alarmId)).finally(() => {
            if (btn) { btn.innerHTML = '已处理'; btn.style.background = '#4caf50'; }
        });
    } else {
        setTimeout(() => {
            if (btn) { btn.innerHTML = '已处理'; btn.style.background = '#4caf50'; }
        }, 800);
    }
}

// ===================== 全局刷新 =====================

function refreshAllData() {
    loadKpi();
    loadDeptLoad();
    loadAlarms();
    loadSourceDistribution();
    loadTrafficTrend();
    loadSystemStatus();
    loadHeatmap();
    loadTwinPreviewStats();
}

function refreshData() {
    const btn = document.querySelector('.refresh-btn');
    if (btn) { btn.innerHTML = '刷新中...'; btn.disabled = true; }
    refreshAllData();
    setTimeout(() => {
        if (btn) { btn.innerHTML = '刷新'; btn.disabled = false; }
    }, 1500);
}

// ===================== HTML 转义 =====================

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===================== 页面初始化 =====================

window.addEventListener('load', async () => {
    // 检查登录状态
    const loggedIn = await initAuth();
    if (!loggedIn) {
        showLoginDialog('请使用管理员账号登录');
        // 监听登录成功事件（登录对话框关闭后刷新数据 + 启动警报监听）
        const observer = new MutationObserver(() => {
            if (!document.getElementById('loginOverlay')) {
                observer.disconnect();
                refreshAllData();
                if (typeof AlarmPopup !== 'undefined') AlarmPopup.start();
            }
        });
        observer.observe(document.body, { childList: true });
        return;
    }
    refreshAllData();
    // 启动警报弹窗监听
    if (typeof AlarmPopup !== 'undefined') AlarmPopup.start();
});
