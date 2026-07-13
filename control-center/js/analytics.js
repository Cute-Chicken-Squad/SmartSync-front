/**
 * 智环引诊 - 数据分析页面逻辑
 * 对接后端: /admin/api/analytics/*
 * 数据写入: exportAnalytics, queryAnalytics
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 日期显示
    const date = new Date();
    const el = document.getElementById('dateInfo');
    if (el) el.textContent = date.toISOString().split('T')[0];

    // ★ 加载数据
    await Promise.all([
        loadAnalyticsDetail(),
        loadMonthlyTrend(),
        loadDeptRanking(),
        loadSatisfaction(),
    ]);

    // 绑定按钮事件
    const exportBtn = document.querySelector('.btn.success');
    const queryBtn = document.querySelector('.filter-bar .btn:last-child');
    if (exportBtn) exportBtn.addEventListener('click', exportReport);
    if (queryBtn) queryBtn.addEventListener('click', queryData);
});

// ===================== 数据加载 =====================

async function loadAnalyticsDetail() {
    try {
        const res = await adminApi.getAnalyticsDetail();
        if (res.code === 200 && res.data) {
            console.log('[分析] 综合详情已加载');
        }
    } catch (e) { console.warn('[分析] 综合详情加载失败:', e.message); }
}

async function loadMonthlyTrend() {
    try {
        const res = await adminApi.getMonthlyTrend();
        if (res.code === 200 && res.data) {
            console.log('[分析] 月度趋势已加载');
        }
    } catch (e) { console.warn('[分析] 月度趋势加载失败:', e.message); }
}

async function loadDeptRanking() {
    try {
        const res = await adminApi.getDeptRanking();
        if (res.code === 200 && res.data) {
            console.log('[分析] 科室排行已加载');
        }
    } catch (e) { console.warn('[分析] 科室排行加载失败:', e.message); }
}

async function loadSatisfaction() {
    try {
        const res = await adminApi.getSatisfaction();
        if (res.code === 200 && res.data) {
            console.log('[分析] 满意度已加载');
        }
    } catch (e) { console.warn('[分析] 满意度加载失败:', e.message); }
}

// ===================== 写操作 =====================

async function queryData() {
    const btn = event.target;
    btn.innerHTML = '查询中...';
    btn.disabled = true;
    try {
        // 收集筛选参数
        const params = {};
        const startDate = document.querySelector('[name="startDate"]')?.value;
        const endDate = document.querySelector('[name="endDate"]')?.value;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const res = await adminApi.queryAnalytics(params);
        if (res.code === 200) {
            console.log('[分析] 查询完成:', res.data);
            alert('查询完成 ✅');
        }
    } catch (e) {
        console.error('[分析] 查询失败:', e.message);
        alert('查询失败: ' + e.message);
    } finally {
        btn.innerHTML = '查询';
        btn.disabled = false;
    }
}

async function exportReport() {
    const btn = event.target;
    btn.innerHTML = '导出中...';
    btn.disabled = true;
    try {
        const params = {};
        const startDate = document.querySelector('[name="startDate"]')?.value;
        const endDate = document.querySelector('[name="endDate"]')?.value;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const blob = await adminApi.exportAnalytics(params);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analytics_report.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        alert('报表导出成功 ✅');
    } catch (e) {
        console.error('[分析] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        btn.innerHTML = '导出报表';
        btn.disabled = false;
    }
}
