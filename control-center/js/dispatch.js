/**
 * 智环引诊 - 调度管理页面逻辑
 * 对接后端: /admin/api/dispatch/*
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        var date = new Date();
        var timeString = formatLocalDateTime(date);
        var el = document.getElementById('dateInfo');
        if (el) el.textContent = timeString;
    }, 1000);

    // 绑定按钮 → 真实接口（移除内联假动画）
    var mainBtn = document.getElementById('mainTriageBtn');
    var gridBtn = document.getElementById('gridTriageBtn');
    var exportBtn = document.getElementById('exportBtn');
    if (mainBtn) mainBtn.addEventListener('click', executeTriage);
    if (gridBtn) gridBtn.addEventListener('click', executeTriage);
    if (exportBtn) exportBtn.addEventListener('click', exportReport);

    // ★ 确保认证后再加载数据（写操作需要有效 token 才能持久化到后端数据库）
    await ensureAuth();
    await loadDispatchData();
});

function loadDispatchData() {
    loadDeptLoadTable();
    loadSuggestions();
    loadTaskPreemption();
}

// ===================== 数据加载与渲染 =====================

async function loadDeptLoadTable() {
    try {
        const res = await adminApi.getDispatchDeptLoad();
        if (res.code === 200 && res.data) {
            renderDeptLoadTable(Array.isArray(res.data) ? res.data : (res.data.records || []));
        }
    } catch (e) {
        console.warn('[调度] 加载科室负载失败:', e.message);
    }
}

function renderDeptLoadTable(depts) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;
    if (!depts || !depts.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#868e96;padding:16px;">暂无科室负载数据</td></tr>';
        return;
    }
    tbody.innerHTML = depts.map(function (d) {
        return '<tr>' +
            '<td>' + escHtml(d.deptName) + '</td>' +
            '<td>' + (d.queueCount != null ? d.queueCount : '--') + '</td>' +
            '<td>' + (d.avgWaitMinutes != null ? d.avgWaitMinutes : '--') + ' 分钟</td>' +
            '<td><span class="status-badge ' + loadBadgeClass(d.loadStatus) + '">' + loadStatusLabel(d.loadStatus) + '</span></td>' +
            '<td>' +
                '<button class="btn-sm" onclick="triageDepartment(\'' + escHtml(d.deptName) + '\', event)">分流</button> ' +
                '<button class="btn-sm" onclick="viewDetail(\'' + escHtml(d.deptName) + '\')">查看</button>' +
            '</td>' +
            '</tr>';
    }).join('');
}

async function loadSuggestions() {
    try {
        const res = await adminApi.getSuggestions();
        if (res.code === 200) {
            renderSuggestions(Array.isArray(res.data) ? res.data : []);
        }
    } catch (e) {
        console.warn('[调度] 加载调度建议失败:', e.message);
    }
}

function renderSuggestions(suggestions) {
    const container = document.querySelector('.suggestions-list');
    if (!container) return;
    if (!suggestions.length) {
        container.innerHTML = '<div style="padding:12px;text-align:center;color:#868e96;">暂无分流建议，各科室负载均衡</div>';
        return;
    }
    container.innerHTML = suggestions.map(function (s) {
        return '<div class="suggestion-item" style="padding:10px;border-bottom:1px solid #eee;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                '<span><strong>' + escHtml(s.fromDeptName) + '</strong> (' + (s.fromUtilization || 0) + '%) → ' +
                '<strong>' + escHtml(s.toDeptName) + '</strong> (' + (s.toUtilization || 0) + '%)</span>' +
                '<button class="btn-sm" onclick="executeSuggestion(' + s.fromDeptId + ',' + s.toDeptId + ',' + s.suggestedCount + ',\'' + escHtml(s.reason || '') + '\')">执行 (' + s.suggestedCount + '人)</button>' +
            '</div>' +
            '<div style="font-size:12px;color:#868e96;margin-top:4px;">' + escHtml(s.reason || '') + '</div>' +
        '</div>';
    }).join('');
}

async function loadTaskPreemption() {
    try {
        const res = await adminApi.getTaskPreemption();
        if (res.code === 200) {
            renderPreemptionLog(Array.isArray(res.data) ? res.data : []);
        }
    } catch (e) {
        console.warn('[调度] 加载抢占事件失败:', e.message);
    }
}

function renderPreemptionLog(events) {
    const countEl = document.getElementById('preemptCount');
    if (countEl) countEl.textContent = events.length;

    const container = document.getElementById('preemptLogItems');
    if (!container) return;
    const top = events.slice(0, 8);
    container.innerHTML = top.map(function (e) {
        const time = (e.createdAt || '').substring(11, 16);
        return '<div class="log-item">' +
            '<span class="log-time">' + escHtml(time) + '</span>' +
            '<span class="log-type ' + preemptTypeClass(e.level) + '">' + preemptTypeLabel(e.type) + '</span>' +
            '<span class="log-desc">' + escHtml((e.patientName ? e.patientName + ' ' : '') + (e.description || e.location || '')) + '</span>' +
        '</div>';
    }).join('') || '<div class="log-item"><span class="log-desc">暂无抢占事件</span></div>';
}

function preemptTypeLabel(type) {
    if (type === 'fall') return '摔倒';
    if (type === 'vital') return '体征异常';
    if (type === 'emergency') return '紧急';
    if (type === 'wheelchair') return '轮椅';
    return type || '事件';
}

function preemptTypeClass(level) {
    if (level >= 4) return 'high';
    if (level >= 3) return 'warning';
    return 'normal';
}

// ===================== 写操作 =====================

async function executeTriage() {
    var btn = document.getElementById('mainTriageBtn') || document.getElementById('gridTriageBtn');
    if (btn) { btn.innerHTML = '执行中...'; btn.disabled = true; }

    try {
        const res = await adminApi.getSuggestions();
        if (res.code === 200 && res.data && res.data.length > 0) {
            const s = res.data[0];
            const result = await adminApi.executeDispatch({
                fromDeptId: s.fromDeptId,
                toDeptId: s.toDeptId,
                patientCount: s.suggestedCount,
                reason: s.reason || '智能分流',
            });
            if (result.code === 200) {
                alert('分流成功！实际分流 ' + ((result.data && result.data.actualCount) || s.suggestedCount) + ' 人');
            } else {
                alert('分流执行失败: ' + (result.message || ''));
            }
        } else {
            alert('暂无分流建议');
        }
    } catch (e) {
        console.error('[调度] 执行分流失败:', e.message);
        alert('执行失败: ' + e.message);
    } finally {
        if (btn) { btn.innerHTML = '执行分流'; btn.disabled = false; }
        loadDispatchData();
    }
}

async function executeSuggestion(fromDeptId, toDeptId, count, reason) {
    try {
        const res = await adminApi.executeDispatch({ fromDeptId: fromDeptId, toDeptId: toDeptId, patientCount: count, reason: reason || '' });
        if (res.code === 200) {
            alert('分流成功！实际分流 ' + ((res.data && res.data.actualCount) || count) + ' 人');
            loadDispatchData();
        } else {
            alert('执行失败: ' + (res.message || ''));
        }
    } catch (e) {
        alert('执行失败: ' + e.message);
    }
}

async function triageDepartment(deptName, event) {
    var btn = event?.target || document.activeElement;
    if (btn) { btn.innerHTML = '分流中...'; btn.disabled = true; }

    try {
        const res = await adminApi.triageDept(deptName, 2);
        if (res.code === 200) {
            if (btn) { btn.innerHTML = '已分流'; btn.style.background = '#4caf50'; }
            alert(deptName + ' 分流处理完成 ✅');
        } else {
            throw new Error(res.message || '分流失败');
        }
    } catch (e) {
        console.error('[调度] 分流失败:', e.message);
        alert(deptName + ' 分流失败: ' + e.message);
        if (btn) { btn.innerHTML = '分流'; btn.disabled = false; }
        return;
    } finally {
        loadDispatchData();
    }
}

async function exportReport() {
    var btn = document.getElementById('exportBtn');
    if (btn) { btn.innerHTML = '导出中...'; btn.disabled = true; }

    try {
        const blob = await adminApi.exportDispatchReport();
        downloadBlob(blob, '调度报表_' + new Date().toISOString().substring(0, 10) + '.csv');
        alert('报表导出成功');
    } catch (e) {
        console.error('[调度] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        if (btn) { btn.innerHTML = '导出报表'; btn.disabled = false; }
    }
}

function viewDetail(deptName) {
    window.location.href = 'queue-detail.html?dept=' + encodeURIComponent(deptName);
}

// ===================== 辅助函数 =====================

function loadBadgeClass(status) {
    if (status === 'danger') return 'danger';
    if (status === 'warning') return 'warning';
    return 'normal';
}

function loadStatusLabel(status) {
    if (status === 'danger') return '繁忙';
    if (status === 'warning') return '中等';
    return '正常';
}

function escHtml(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
