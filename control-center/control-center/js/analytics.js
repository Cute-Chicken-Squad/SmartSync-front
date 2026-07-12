/**
 * 智环引诊 - 数据分析台
 * 对接后端: /admin/api/analytics/*
 */

// 日期更新
const date = new Date();
const el = document.getElementById('dateInfo');
if (el) el.textContent = date.toISOString().split('T')[0];

// ===================== 综合详情 =====================

async function loadDetail() {
    try {
        const res = await adminApi.getAnalyticsDetail();
        if (res.code === 200 && res.data) {
            const d = res.data;
            updateStatValue('totalVisits', d.totalVisits);
            updateStatValue('queuedVisits', d.queuedVisits);
            updateStatValue('inProgressVisits', d.inProgressVisits);
            updateStatValue('finishedVisits', d.finishedVisits);
            updateStatValue('avgSatisfaction', d.averageSatisfaction ? Number(d.averageSatisfaction).toFixed(1) : '--');
            if (d.busiestDept) updateStatLabel('busiestDept', d.busiestDept);
            if (d.pendingAlarms != null) updateStatValue('pendingAlarms', d.pendingAlarms);
        }
    } catch (e) { console.error('[Analytics] 详情:', e); }
}

function updateStatValue(id, val) {
    const el = document.getElementById(id) || document.querySelector(`[data-stat="${id}"]`);
    if (!el) {
        // 尝试查找包含该文本的元素
        const allStats = document.querySelectorAll('.stat-value, .kpi-value');
        allStats.forEach(s => {
            if (s.parentElement?.textContent?.includes(id)) {
                s.textContent = val != null ? val : '--';
            }
        });
        return;
    }
    el.textContent = val != null ? val : '--';
}

function updateStatLabel(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ===================== 月度趋势 =====================

async function loadMonthlyTrend() {
    try {
        const res = await adminApi.getMonthlyTrend();
        if (res.code === 200 && res.data && Array.isArray(res.data)) {
            renderTrendChart(res.data);
        }
    } catch (e) { console.error('[Analytics] 月度趋势:', e); }
}

function renderTrendChart(data) {
    const container = document.querySelector('.trend-chart canvas');
    if (!container && !document.querySelector('.chart-area')) return;

    // 使用简单的 SVG 渲染柱状图
    const chartArea = document.querySelector('.chart-area') || document.querySelector('.trend-chart');
    if (!chartArea) return;

    const maxVal = Math.max(...data.map(d => d.visitCount || 0), 1);
    const months = data.map(d => d.month?.substring(5) || '');

    chartArea.innerHTML = `
        <div class="bar-chart" style="display:flex;align-items:flex-end;gap:8px;height:200px;padding:0 20px;">
            ${data.map((d, i) => `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
                    <span style="font-size:10px;color:#666;margin-bottom:2px;">${d.visitCount || 0}</span>
                    <div style="width:100%;max-width:40px;background:#4285f4;border-radius:4px 4px 0 0;height:${((d.visitCount||0)/maxVal*160)}px;min-height:4px;"></div>
                    <span style="font-size:10px;color:#999;margin-top:4px;">${months[i]}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ===================== 科室排行 =====================

async function loadDeptRanking() {
    try {
        const res = await adminApi.getDeptRanking();
        if (res.code === 200 && res.data && Array.isArray(res.data)) {
            renderDeptRanking(res.data);
        }
    } catch (e) { console.error('[Analytics] 科室排行:', e); }
}

function renderDeptRanking(depts) {
    const tbody = document.querySelector('.ranking-table tbody, .data-table tbody');
    if (!tbody || !depts.length) return;
    tbody.innerHTML = depts.slice(0, 10).map((d, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${escHtml(d.deptName)}</td>
            <td>${d.visitCount ?? '--'}</td>
        </tr>
    `).join('');
}

// ===================== 满意度分布 =====================

async function loadSatisfaction() {
    try {
        const res = await adminApi.getSatisfaction();
        if (res.code === 200 && res.data && Array.isArray(res.data)) {
            renderSatisfaction(res.data);
        }
    } catch (e) { console.error('[Analytics] 满意度:', e); }
}

function renderSatisfaction(data) {
    const container = document.querySelector('.satisfaction-chart');
    if (!container) return;
    const maxCount = Math.max(...data.map(d => d.count || 0), 1);
    container.innerHTML = data.map(d => `
        <div style="display:flex;align-items:center;margin-bottom:10px;gap:8px;">
            <span style="width:20px;font-size:12px;">${d.score}分</span>
            <div style="flex:1;height:20px;background:#e9ecef;border-radius:10px;overflow:hidden;">
                <div style="width:${(d.count/maxCount*100)}%;height:100%;background:#4285f4;border-radius:10px;"></div>
            </div>
            <span style="font-size:12px;color:#666;min-width:50px;">${d.count || 0} (${d.percentage || 0}%)</span>
        </div>
    `).join('');
}

// ===================== 查询与导出 =====================

async function queryData() {
    const btn = event?.target;
    const type = document.querySelector('#queryType')?.value || 'source';
    const startDate = document.querySelector('#startDate')?.value;
    const endDate = document.querySelector('#endDate')?.value;
    if (btn) { btn.innerHTML = '查询中...'; btn.disabled = true; }
    try {
        const params = { type };
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const res = await adminApi.queryAnalytics(params);
        if (res.code === 200 && res.data) {
            renderQueryResult(res.data);
        }
    } catch (e) { alert('查询失败: ' + e.message); }
    finally { if (btn) { btn.innerHTML = '查询'; btn.disabled = false; } }
}

function renderQueryResult(data) {
    const container = document.querySelector('.query-result');
    if (!container) return;
    container.innerHTML = `
        <div style="margin-bottom:8px;font-size:13px;color:#666;">类型: ${data.type || '--'} | 总计: ${data.total || 0}</div>
        ${(data.items || []).map(i => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;">
                <span>${escHtml(i.label)}</span>
                <span>${i.count} (${i.percentage || 0}%)</span>
            </div>
        `).join('')}
    `;
}

async function exportReport() {
    const btn = event?.target;
    if (btn) { btn.innerHTML = '导出中...'; btn.disabled = true; }
    try {
        const type = document.querySelector('#queryType')?.value || 'source';
        const startDate = document.querySelector('#startDate')?.value;
        const endDate = document.querySelector('#endDate')?.value;
        const params = { type };
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const blob = await adminApi.exportAnalytics(params);
        downloadBlob(blob, `分析报表_${new Date().toISOString().substring(0, 10)}.csv`);
    } catch (e) { alert('导出失败: ' + e.message); }
    finally { if (btn) { btn.innerHTML = '导出报表'; btn.disabled = false; } }
}

// ===================== 辅助 =====================

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function loadAnalyticsData() {
    loadDetail();
    loadMonthlyTrend();
    loadDeptRanking();
    loadSatisfaction();
}

// ===================== 初始化 =====================

window.addEventListener('load', async () => {
    const loggedIn = await initAuth();
    if (!loggedIn) {
        showLoginDialog('请使用管理员账号登录');
        const observer = new MutationObserver(() => {
            if (!document.getElementById('loginOverlay')) { observer.disconnect(); loadAnalyticsData(); }
        });
        observer.observe(document.body, { childList: true });
        return;
    }
    loadAnalyticsData();

    // 绑定导出和查询按钮
    const exportBtn = document.querySelector('.btn.success, .btn-export');
    if (exportBtn) exportBtn.addEventListener('click', exportReport);
    const queryBtn = document.querySelector('.filter-bar .btn:last-child, .btn-query');
    if (queryBtn) queryBtn.addEventListener('click', queryData);
});
