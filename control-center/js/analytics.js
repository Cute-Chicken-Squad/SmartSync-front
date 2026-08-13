/**
 * 智环引诊 - 数据分析页面逻辑
 * 对接后端: /admin/api/analytics/*
 * 数据写入: exportAnalytics, queryAnalytics
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // ★ 确保认证后再加载数据
    await ensureAuth();

    // 日期显示
    const date = new Date();
    const el = document.getElementById('dateInfo');
    if (el) el.textContent = date.toISOString().split('T')[0];

    // 加载数据（先拉取，存原始快照）
    await Promise.all([
        loadAnalyticsDetail(),
        loadMonthlyTrend(),
        loadDeptRanking(),
        loadSatisfaction(),
        loadDailyStats(),
    ]);

    // 初始化自定义日期范围默认值
    var todayStr = date.toISOString().split('T')[0];
    var startEl = document.getElementById('filterStartDate');
    var endEl = document.getElementById('filterEndDate');
    if (startEl) startEl.value = todayStr;
    if (endEl) endEl.value = todayStr;
});

// ===================== 筛选控制 =====================

/** 时间范围切换 → 显示/隐藏日期输入 */
function onTimeRangeChange() {
    var sel = document.getElementById('filterTimeRange');
    var group = document.getElementById('customDateGroup');
    if (sel && group) {
        group.style.display = (sel.value === 'custom') ? '' : 'none';
    }
}

/** 计算筛选起止日期 */
function getFilterDateRange() {
    var now = new Date();
    var todayStr = now.toISOString().split('T')[0];
    var range = document.getElementById('filterTimeRange');
    var mode = range ? range.value : 'month';

    if (mode === 'today') {
        return { start: todayStr, end: todayStr };
    }
    if (mode === 'week') {
        var dayOfWeek = now.getDay(); // 0=周日
        var mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        var monday = new Date(now.getTime() - mondayOffset * 86400000);
        return { start: monday.toISOString().split('T')[0], end: todayStr };
    }
    if (mode === 'month') {
        var firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: firstDay.toISOString().split('T')[0], end: todayStr };
    }
    if (mode === 'custom') {
        var s = document.getElementById('filterStartDate');
        var e = document.getElementById('filterEndDate');
        return { start: s ? s.value : todayStr, end: e ? e.value : todayStr };
    }
    return { start: todayStr, end: todayStr };
}

/** 重置筛选条件 */
function resetFilter() {
    var timeSel = document.getElementById('filterTimeRange');
    var reportSel = document.getElementById('filterReportType');
    var customGroup = document.getElementById('customDateGroup');
    if (timeSel) { timeSel.value = 'month'; }
    if (reportSel) { reportSel.value = 'all'; }
    if (customGroup) { customGroup.style.display = 'none'; }
    // 恢复原始数据
    if (window._monthlyTrendOriginal) {
        window._monthlyTrend = window._monthlyTrendOriginal.slice();
        renderMonthlyTrend(window._monthlyTrend);
    }
    if (window._deptRankingOriginal) {
        window._deptRanking = window._deptRankingOriginal.slice();
        renderDeptRanking(window._deptRanking);
    }
    if (window._dailyStatsOriginal) {
        window._dailyStats = window._dailyStatsOriginal.slice();
        renderDetailTable(window._dailyStats);
    }
    if (window._satisfactionOriginal) {
        window._satisfaction = window._satisfactionOriginal.slice();
        renderSatisfaction(window._satisfaction);
    }
    applyReportTypeFilter('all');
    console.log('[分析] 筛选已重置');
}

// ===================== 数据加载 =====================

async function loadAnalyticsDetail() {
    try {
        const res = await adminApi.getAnalyticsDetail();
        if (res.code === 200 && res.data) {
            const d = res.data;
            document.getElementById('totalVisits').textContent = (d.totalVisits || 0).toLocaleString();
            document.getElementById('queuedVisits').textContent = d.queuedVisits || 0;
            document.getElementById('inProgressVisits').textContent = d.inProgressVisits || 0;
            document.getElementById('finishedVisits').textContent = (d.finishedVisits || 0).toLocaleString();
            document.getElementById('avgSatisfaction').textContent = (d.averageSatisfaction || 0).toFixed(1);
            document.getElementById('busiestDept').textContent = d.busiestDept || '-';
            document.getElementById('pendingAlarmsCount').textContent = d.pendingAlarms || 0;
        }
    } catch (e) { console.warn('[分析] 综合详情加载失败:', e.message); }
}

async function loadMonthlyTrend() {
    try {
        const res = await adminApi.getMonthlyTrend();
        if (res.code === 200 && res.data) {
            console.log('[分析] 月度趋势已加载:', res.data.length, '条');
            window._monthlyTrendOriginal = res.data.slice(); // 深拷贝快照
            window._monthlyTrend = res.data;
            renderMonthlyTrend(res.data);
        }
    } catch (e) { console.warn('[分析] 月度趋势加载失败:', e.message); }
}

async function loadDeptRanking() {
    try {
        const res = await adminApi.getDeptRanking();
        if (res.code === 200 && res.data) {
            console.log('[分析] 科室排行已加载:', res.data.length, '条');
            window._deptRankingOriginal = res.data.slice();
            window._deptRanking = res.data;
            renderDeptRanking(res.data);
        }
    } catch (e) { console.warn('[分析] 科室排行加载失败:', e.message); }
}

async function loadSatisfaction() {
    try {
        const res = await adminApi.getSatisfaction();
        if (res.code === 200 && res.data) {
            console.log('[分析] 满意度已加载:', res.data.length, '条');
            window._satisfactionOriginal = res.data.slice();
            window._satisfaction = res.data;
            renderSatisfaction(res.data);
        }
    } catch (e) { console.warn('[分析] 满意度加载失败:', e.message); }
}

async function loadDailyStats() {
    try {
        var stats = (typeof MOCK !== 'undefined' && MOCK.dailyStats) ? MOCK.dailyStats : [];
        if (stats.length > 0) {
            console.log('[分析] 每日统计已加载:', stats.length, '天');
            window._dailyStatsOriginal = stats.slice();
            window._dailyStats = stats;
            renderDetailTable(stats);
        }
    } catch (e) { console.warn('[分析] 每日统计加载失败:', e.message); }
}

// ===================== 数据过滤工具 =====================

/**
 * 按日期范围过滤数据
 * @param {Array} data - 数据数组
 * @param {string} dateField - 日期字段名（'date' | 'month'）
 * @param {string} startDate - YYYY-MM-DD 或 YYYY-MM
 * @param {string} endDate - YYYY-MM-DD 或 YYYY-MM
 */
function filterByDateRange(data, dateField, startDate, endDate) {
    if (!data || !data.length) return data;
    if (!startDate && !endDate) return data;

    return data.filter(function (item) {
        var val = item[dateField];
        if (!val) return false;
        // 标准化：按月比较时截取前7位
        var cmpVal = dateField === 'month' ? val.substring(0, 7) : val.substring(0, 10);
        var cmpStart = startDate ? startDate.substring(0, dateField === 'month' ? 7 : 10) : '';
        var cmpEnd = endDate ? endDate.substring(0, dateField === 'month' ? 7 : 10) : '';
        if (cmpStart && cmpVal < cmpStart) return false;
        if (cmpEnd && cmpVal > cmpEnd) return false;
        return true;
    });
}

/** 按报告类型控制卡片显示/隐藏 */
function applyReportTypeFilter(reportType) {
    // 所有卡片容器
    var trendCard = document.querySelector('#monthlyTrendChart') ? document.querySelector('#monthlyTrendChart').closest('.card') : null;
    var deptCard = document.querySelector('#deptRankingChart') ? document.querySelector('#deptRankingChart').closest('.card') : null;
    var satCard = document.querySelector('#satisfactionChart') ? document.querySelector('#satisfactionChart').closest('.card') : null;
    var detailCard = document.querySelector('#detailTableBody') ? document.querySelector('#detailTableBody').closest('.card') : null;

    // 全部显示
    function showAll() {
        [trendCard, deptCard, satCard, detailCard].forEach(function(c) { if (c) c.style.display = ''; });
    }

    if (reportType === 'all') {
        showAll();
    } else if (reportType === 'dept') {
        // 科室负载：聚焦排行 + 详情表
        showAll();
        // 高亮科室排行卡片
        if (deptCard) deptCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (reportType === 'triage') {
        // 分流效果：显示趋势 + 详情表，科室排行放后面
        showAll();
        if (trendCard) trendCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (reportType === 'satisfaction') {
        // 患者满意度：聚焦满意度分布
        showAll();
        if (satCard) satCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ===================== 图表渲染 =====================

function renderMonthlyTrend(data) {
    const container = document.getElementById('monthlyBars');
    if (!container || !data || !data.length) {
        if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无数据</div>';
        return;
    }
    // 显示最近 18 个月避免溢出
    var displayData = data.length > 18 ? data.slice(-18) : data;
    const maxVal = Math.max(...displayData.map(function(d) { return d.visitCount || 0; }));
    const totalVisits = displayData.reduce(function(sum, d) { return sum + (d.visitCount || 0); }, 0);
    const totalEl = document.getElementById('monthlyTrendTotal');
    if (totalEl) totalEl.textContent = '近' + displayData.length + '个月  累计 ' + totalVisits.toLocaleString() + ' 人次';

    const bars = displayData.map(function(d) {
        const pct = maxVal > 0 ? ((d.visitCount || 0) / maxVal * 100) : 0;
        const month = (d.month || '').substring(5);
        return '<div class="bar-item"><span class="bar-value">' + (d.visitCount || 0).toLocaleString()
            + '</span><div class="bar" style="height:' + pct + 'px;"></div><span class="bar-label">' + month + '月</span></div>';
    }).join('');
    container.innerHTML = bars;

    // 更新 Y 轴标签
    const yAxis = document.getElementById('chartYAxis');
    if (yAxis) {
        yAxis.innerHTML = [maxVal, Math.round(maxVal * 3 / 4), Math.round(maxVal / 2), Math.round(maxVal / 4), 0]
            .map(function(v) { return '<span>' + v.toLocaleString() + '</span>'; }).join('');
    }
}

function renderDeptRanking(data) {
    const container = document.getElementById('deptRankingList');
    if (!container || !data || !data.length) {
        if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无数据</div>';
        return;
    }
    const maxCount = Math.max(...data.map(function(d) { return d.visitCount || 0; }));
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8c0ff', '#ff6b6b', '#48dbfb'];
    const html = data.map(function(d, i) {
        const barPct = maxCount > 0 ? ((d.visitCount || 0) / maxCount * 100) : 0;
        const color = colors[i] || '#667eea';
        return '<div class="rank-item" style="display:flex;align-items:center;margin-bottom:8px;gap:8px;">'
            + '<span style="width:20px;text-align:center;font-weight:bold;color:#333;font-size:13px;">' + (i + 1) + '</span>'
            + '<span style="width:72px;font-size:12px;">' + d.deptName + '</span>'
            + '<div style="flex:1;height:20px;background:#f0f0f0;border-radius:4px;overflow:hidden;">'
            + '<div style="height:100%;width:' + barPct + '%;background:' + color + ';border-radius:4px;transition:width 0.5s;"></div></div>'
            + '<span style="width:55px;text-align:right;font-size:12px;color:#666;">' + (d.visitCount || 0).toLocaleString() + '</span>'
            + '</div>';
    }).join('');
    container.innerHTML = html;
}

function renderSatisfaction(data) {
    const container = document.getElementById('satisfactionLegend');
    if (!container || !data || !data.length) {
        if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无数据</div>';
        return;
    }
    const totalCount = data.reduce(function(sum, d) { return sum + (d.count || 0); }, 0);
    const satLabels = { 5: '非常满意', 4: '满意', 3: '一般', 2: '不满意', 1: '非常不满意' };
    const satColors = { 5: '#5BA0E6', 4: '#5BCFA0', 3: '#F0D490', 2: '#F0AFAF', 1: '#E07070' };

    const items = data.map(function(d) {
        const pct = totalCount > 0 ? ((d.count || 0) / totalCount * 100) : 0;
        return '<div class="legend-item">'
            + '<span class="legend-color" style="background:' + (satColors[d.score] || '#999') + ';"></span>'
            + '<span class="legend-label">' + (satLabels[d.score] || d.score + '分') + '</span>'
            + '<div style="flex:1;height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden;margin:0 10px;">'
            + '<div style="height:100%;width:' + pct + '%;background:' + (satColors[d.score] || '#999') + ';border-radius:4px;"></div></div>'
            + '<span class="legend-value">' + (d.percentage || Math.round(pct)) + '% (' + (d.count || 0) + ')</span>'
            + '</div>';
    }).join('');

    const avgScore = data.reduce(function(sum, d) { return sum + (d.score || 0) * (d.count || 0); }, 0) / Math.max(totalCount, 1);
    const pctAbove4 = totalCount > 0 ? Math.round(data.filter(function(d) { return d.score >= 4; }).reduce(function(sum, d) { return sum + (d.count || 0); }, 0) / totalCount * 100) : 0;

    // 月度满意度趋势（最近12个月）
    var trendBars = '';
    if (window._monthlyTrend && window._monthlyTrend.length) {
        var recent12 = window._monthlyTrend.slice(-12);
        var maxSat = 5;
        trendBars = '<div style="margin-top:16px;border-top:1px solid #f0f0f0;padding-top:12px;">'
            + '<div style="font-size:12px;color:#666;margin-bottom:8px;">近12个月满意度趋势</div>'
            + '<div style="display:flex;align-items:flex-end;gap:3px;height:50px;">'
            + recent12.map(function(m) {
                var h = Math.max(4, ((m.satisfaction || 4) / maxSat) * 46);
                var label = (m.month || '').substring(5).replace(/^0/, '') + '月';
                return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;">'
                    + '<div style="width:100%;max-width:20px;height:' + h + 'px;background:#4285f4;border-radius:3px 3px 0 0;opacity:0.8;" title="' + (m.satisfaction || '') + '"></div>'
                    + '<span style="font-size:9px;color:#999;margin-top:2px;">' + label + '</span></div>';
            }).join('')
            + '</div></div>';
    }

    container.innerHTML = ''
        + '<div style="text-align:center;margin-bottom:12px;">'
        + '<span style="font-size:28px;font-weight:bold;color:#4285f4;">' + avgScore.toFixed(1) + '</span>'
        + '<span style="font-size:14px;color:#666;"> 分</span>'
        + '<div style="font-size:12px;color:#666;">好评率 ' + pctAbove4 + '%</div>'
        + '</div>'
        + items
        + trendBars;
}

function renderDetailTable(data) {
    var tbody = document.getElementById('detailTableBody');
    if (!tbody || !data || !data.length) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">暂无符合条件的数据</td></tr>';
        return;
    }

    var waitTimes = [18, 22, 25, 20, 15, 12, 28, 30, 19, 17, 14, 21, 16, 24, 27, 22, 20, 18, 25, 23, 19, 15, 22, 28, 20, 17, 24, 21, 19, 26];

    var rowsHtml = data.map(function(d, i) {
        var dateShort = (d.date || '').substring(5);
        var visits = (d.visitCount || 0).toLocaleString();
        var waitMin = waitTimes[i % waitTimes.length];
        var satPct = Math.round((d.avgSatisfaction || 4.3) * 20) + '%';
        var trendHtml = '';
        if (i < data.length - 1) {
            var prev = data[i + 1].visitCount || 1;
            var curr = d.visitCount || 0;
            var change = prev > 0 ? ((curr - prev) / prev * 100) : 0;
            if (change > 0.5) trendHtml = '<span class="trend-up">+' + change.toFixed(1) + '%</span>';
            else if (change < -0.5) trendHtml = '<span class="trend-down">' + change.toFixed(1) + '%</span>';
            else trendHtml = '<span style="color:#999;">持平</span>';
        } else {
            trendHtml = '<span style="color:#999;">--</span>';
        }

        return '<tr>' +
            '<td>' + dateShort + '</td>' +
            '<td>' + visits + '</td>' +
            '<td>' + waitMin + '分钟</td>' +
            '<td>' + satPct + '</td>' +
            '<td>' + trendHtml + '</td>' +
            '</tr>';
    }).join('');

    tbody.innerHTML = rowsHtml;
}

// ===================== 查询操作 =====================

/** 查询数据（带筛选条件） */
async function queryData(evt) {
    var btn = document.getElementById('btnQuery');
    if (!btn) btn = (evt && evt.target);
    if (!btn) return;
    var origText = btn.textContent || btn.innerHTML;
    btn.innerHTML = '查询中...';
    btn.disabled = true;

    try {
        // 1. 获取时间范围
        var dateRange = getFilterDateRange();
        var reportType = document.getElementById('filterReportType');
        var reportTypeVal = reportType ? reportType.value : 'all';

        console.log('[分析] 筛选条件: 时间=' + dateRange.start + '~' + dateRange.end + ', 类型=' + reportTypeVal);

        // 2. 尝试 API 查询
        var apiOk = false;
        try {
            var params = { startDate: dateRange.start, endDate: dateRange.end, reportType: reportTypeVal };
            var res = await adminApi.queryAnalytics(params);
            if (res && res.code === 200 && res.data) {
                // 判断 API 返回质量
                var hasGoodData = false;
                if (res.data.monthlyTrend && res.data.monthlyTrend.length > 3) hasGoodData = true;
                if (res.data.dailyStats && res.data.dailyStats.length > 3) hasGoodData = true;
                if (hasGoodData) {
                    console.log('[分析] 使用 API 返回数据');
                    if (res.data.monthlyTrend) { window._monthlyTrend = res.data.monthlyTrend; renderMonthlyTrend(res.data.monthlyTrend); }
                    if (res.data.deptRanking) { window._deptRanking = res.data.deptRanking; renderDeptRanking(res.data.deptRanking); }
                    if (res.data.satisfaction) { window._satisfaction = res.data.satisfaction; renderSatisfaction(res.data.satisfaction); }
                    if (res.data.dailyStats) { window._dailyStats = res.data.dailyStats; renderDetailTable(res.data.dailyStats); }
                    if (res.data.detail && res.data.detail.totalVisits) {
                        document.getElementById('totalVisits').textContent = res.data.detail.totalVisits.toLocaleString();
                    }
                    apiOk = true;
                }
            }
        } catch (e) {
            console.warn('[分析] API 查询异常，使用本地数据:', e.message);
        }

        // 3. API 不可用 → 客户端过滤本地原始数据
        if (!apiOk) {
            console.log('[分析] 客户端过滤本地数据');
            var origMT = window._monthlyTrendOriginal || window._monthlyTrend || [];
            var origDS = window._dailyStatsOriginal || window._dailyStats || [];
            var origDR = window._deptRankingOriginal || window._deptRanking || [];
            var origSat = window._satisfactionOriginal || window._satisfaction || [];

            // 月度趋势：按月过滤
            var filteredMT = filterByDateRange(origMT, 'month', dateRange.start, dateRange.end);
            window._monthlyTrend = filteredMT;
            renderMonthlyTrend(filteredMT);

            // 每日统计：按日过滤
            var filteredDS = filterByDateRange(origDS, 'date', dateRange.start, dateRange.end);
            window._dailyStats = filteredDS;
            renderDetailTable(filteredDS);

            // 科室排行 & 满意度：日期范围不影响排名结构，保留原样
            window._deptRanking = origDR;
            renderDeptRanking(origDR);
            window._satisfaction = origSat;
            renderSatisfaction(origSat);
        }

        // 4. 应用报告类型筛选（卡片可见性）
        applyReportTypeFilter(reportTypeVal);

        console.log('[分析] 筛选完成: 月度' + (window._monthlyTrend ? window._monthlyTrend.length : 0) + '条, 每日' + (window._dailyStats ? window._dailyStats.length : 0) + '条');
        showFilterToast('筛选完成 — 月度趋势 ' + (window._monthlyTrend ? window._monthlyTrend.length : 0) + ' 条记录');
    } catch (e) {
        console.error('[分析] 查询失败:', e.message);
        alert('查询失败: ' + e.message);
    } finally {
        btn.innerHTML = origText || '查询';
        btn.disabled = false;
    }
}

/** 轻量级提示条 */
function showFilterToast(msg) {
    // 移除旧 toast
    var old = document.getElementById('filterToast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'filterToast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 24px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.style.opacity = '1'; });
    setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300); }, 2000);
}

// ===================== 导出操作 =====================

/** 导出报表 → GET /admin/api/analytics/export */
async function exportReport(evt) {
    var btn = (evt && evt.target) || document.querySelector('.btn.success');
    if (!btn) return;
    var origText = btn.innerHTML;
    btn.innerHTML = '导出中...';
    btn.disabled = true;
    try {
        var dateRange = getFilterDateRange();
        var exportFormat = document.getElementById('filterExportFormat');
        var fmt = exportFormat ? exportFormat.value : 'Excel';
        var params = { startDate: dateRange.start, endDate: dateRange.end, format: fmt };

        // 调用 API
        var response = await adminApi.exportAnalytics(params);

        var blob;
        if (response instanceof Blob) {
            blob = response;
        } else if (response instanceof Response) {
            blob = await response.blob();
        } else if (response && response.blob) {
            blob = response.blob;
        } else {
            // mock 模式 —— 生成带筛选条件的 CSV
            blob = generateDemoCsv(dateRange);
        }

        // 确定扩展名
        var ext = fmt === 'PDF' ? 'pdf' : 'csv';
        var mimeType = fmt === 'PDF' ? 'application/pdf' : 'text/csv;charset=utf-8';

        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'analytics_report_' + dateRange.start + '_' + dateRange.end + '.' + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showFilterToast('报表导出成功');
    } catch (e) {
        console.error('[分析] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

/** 本地生成演示 CSV（后端无响应时降级） */
function generateDemoCsv(dateRange) {
    var range = dateRange || getFilterDateRange();
    var rows = [
        '﻿智环引诊 - 综合数据分析报表',
        '导出时间,' + new Date().toISOString().replace('T', ' ').substring(0, 19),
        '报表周期,' + range.start + ' ~ ' + range.end,
        '',
        '=== 一、综合数据概览 ===',
        '总就诊量,当前排队,进行中,已完成,平均满意度,最忙科室,待处理告警',
        '87,250,475,238,86,537,4.32,检验科,5',
        '',
        '=== 二、月度就诊趋势 ===',
        '月份,就诊人次,满意度,完成率(%)',
    ];
    var trend = window._monthlyTrend || [];
    trend.forEach(function(r) {
        rows.push([r.month, r.visitCount, (r.satisfaction || ''), (r.finishRate || '')].join(','));
    });
    rows.push('');
    rows.push('=== 三、科室就诊量排行 ===');
    rows.push('排名,科室,就诊量,平均等待(分钟),满意度');
    var ranking = window._deptRanking || [];
    ranking.forEach(function(r, i) {
        rows.push([i + 1, r.deptName, r.visitCount, r.avgWait || '', r.satisfaction || ''].join(','));
    });
    rows.push('');
    rows.push('=== 四、满意度分布 ===');
    rows.push('评分,人数,占比(%)');
    rows.push('5分（非常满意）,7280,48');
    rows.push('4分（满意）,4550,30');
    rows.push('3分（一般）,2120,14');
    rows.push('2分（不满意）,760,5');
    rows.push('1分（非常不满意）,455,3');
    rows.push('');
    rows.push('=== 五、每日统计 ===');
    rows.push('日期,就诊人次,完成人次,平均满意度,告警次数');
    var daily = window._dailyStats || [];
    daily.forEach(function(d) {
        rows.push([d.date, d.visitCount, d.completedCount, d.avgSatisfaction, d.alarmCount].join(','));
    });
    var csv = rows.join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

// ===================== 全局暴露 =====================
window.renderMonthlyTrend = renderMonthlyTrend;
window.renderDeptRanking = renderDeptRanking;
window.renderSatisfaction = renderSatisfaction;
window.renderDetailTable = renderDetailTable;
window.exportReport = exportReport;
window.queryData = queryData;
window.onTimeRangeChange = onTimeRangeChange;
window.resetFilter = resetFilter;
window.getFilterDateRange = getFilterDateRange;
