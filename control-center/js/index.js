/**
 * 智环引诊 - Dashboard 首页逻辑
 * 对接后端: /admin/api/dashboard/*
 * 数据写入: handleAlarm
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        const date = new Date();
        const timeString = date.toISOString().replace('T', ' ').substring(0, 19);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // ★ 加载所有 Dashboard 数据
    await refreshAllData();
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
    updateAlarmStatus();
    console.log('[Dashboard] 数据已刷新');
}

// ===================== 数据加载 =====================

async function loadKpi() {
    try {
        const res = await adminApi.getKpi();
        if (res.code === 200 && res.data) {
            const d = res.data;
            updateKpiElement('todayVisits', d.todayVisits);
            updateKpiElement('currentOnsite', d.currentOnsite);
            updateKpiElement('deptUtilization', d.deptUtilization + '%');
            updateKpiElement('alarmValue', d.pendingAlarms);
            console.log('[Dashboard] KPI 已加载');
        }
    } catch (e) { console.warn('[Dashboard] KPI 加载失败:', e.message); }
}

async function loadDeptLoad() {
    try {
        const res = await adminApi.getDeptLoad();
        if (res.code === 200 && res.data) {
            console.log('[Dashboard] 科室负载已加载:', res.data.length || 0);
        }
    } catch (e) { console.warn('[Dashboard] 科室负载加载失败:', e.message); }
}

async function loadAlarms() {
    try {
        const res = await adminApi.getAlarms(5);
        if (res.code === 200 && res.data) {
            const alarms = Array.isArray(res.data) ? res.data : (res.data.records || []);
            console.log('[Dashboard] 警报已加载:', alarms.length);
        }
    } catch (e) { console.warn('[Dashboard] 警报加载失败:', e.message); }
}

async function loadSourceDistribution() {
    try {
        const res = await adminApi.getSourceDistribution();
        if (res.code === 200 && res.data) {
            console.log('[Dashboard] 来源分布已加载');
        }
    } catch (e) { console.warn('[Dashboard] 来源分布加载失败:', e.message); }
}

async function loadTrafficTrend() {
    try {
        const res = await adminApi.getTrafficTrend();
        if (res.code === 200 && res.data) {
            console.log('[Dashboard] 流量趋势已加载');
        }
    } catch (e) { console.warn('[Dashboard] 流量趋势加载失败:', e.message); }
}

async function loadSystemStatus() {
    try {
        const res = await adminApi.getSystemStatus();
        if (res.code === 200 && res.data) {
            const status = res.data.status || res.data;
            console.log('[Dashboard] 系统状态:', status);
        }
    } catch (e) { console.warn('[Dashboard] 系统状态加载失败:', e.message); }
}

// ===================== 写操作 =====================

async function handleAlarm(alarmId) {
    const btn = event.target;
    btn.innerHTML = '处理中...';
    btn.disabled = true;
    try {
        const res = await adminApi.handleAlarm(alarmId, '控制中心快速处理');
        if (res.code === 200) {
            btn.innerHTML = '已处理';
            btn.style.background = '#4caf50';
            console.log('[Dashboard] 警报已处理:', alarmId);
        }
    } catch (e) {
        console.error('[Dashboard] 处理警报失败:', e.message);
        alert('处理失败: ' + e.message);
        btn.innerHTML = '处理';
        btn.disabled = false;
    }
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
