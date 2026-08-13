/**
 * 智环引诊 - 调度管理中心
 * 对接后端: /admin/api/dispatch/*
 */

// 实时时钟
setInterval(() => {
    const date = new Date();
    const el = document.getElementById('dateInfo');
    if (el) el.textContent = date.toISOString().replace('T', ' ').substring(0, 19);
}, 1000);

// ===================== 分流执行 =====================

async function executeTriage(event) {
    const btn = event?.currentTarget || document.getElementById('mainTriageBtn') || document.getElementById('gridTriageBtn');
    if (!btn) return;
    btn.innerHTML = '执行中...';
    btn.disabled = true;
    try {
        // 优先使用页面上的建议数据
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
                alert(`分流成功！实际分流 ${result.data?.actualCount || s.suggestedCount} 人`);
            }
        } else {
            alert('暂无分流建议');
        }
    } catch (e) {
        alert('分流执行失败: ' + e.message);
    } finally {
        btn.innerHTML = '执行分流';
        btn.disabled = false;
        loadDispatchData();
    }
}

// ===================== 科室分流 =====================

async function triageDepartment(deptName, event) {
    const btn = event?.target || document.activeElement;
    if (!btn) return;
    btn.innerHTML = '分流中...';
    btn.disabled = true;
    try {
        const res = await adminApi.triageDept(deptName, 2);
        if (res.code === 200) {
            btn.innerHTML = '已分流';
            btn.style.background = '#4caf50';
            alert(deptName + ' 分流处理完成！');
        }
    } catch (e) {
        alert(deptName + ' 分流失败: ' + e.message);
        btn.innerHTML = '分流';
        btn.style.background = '';
    } finally {
        btn.disabled = false;
        loadDispatchData();
    }
}

// ===================== 加载调度数据 =====================

async function loadDeptLoadTable() {
    try {
        const res = await adminApi.getDispatchDeptLoad();
        if (res.code === 200 && res.data) {
            renderDeptLoadTable(Array.isArray(res.data) ? res.data : (res.data.records || []));
        }
    } catch (e) { console.error('[Dispatch] 科室负载:', e); }
}

function renderDeptLoadTable(depts) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody || !depts.length) return;
    tbody.innerHTML = depts.map(d => `
        <tr>
            <td>${escHtml(d.deptName)}</td>
            <td>${d.queueCount ?? '--'}</td>
            <td>${d.avgWaitMinutes ?? '--'} 分钟</td>
            <td><span class="badge ${loadBadgeClass(d.loadStatus)}">${loadStatusLabel(d.loadStatus)}</span></td>
            <td>
                <button class="btn-sm btn-primary" onclick="triageDepartment('${escHtml(d.deptName)}', event)">分流</button>
                <button class="btn-sm" onclick="viewDetail('${escHtml(d.deptName)}')">详情</button>
            </td>
        </tr>
    `).join('');
}

// ===================== 加载调度建议 =====================

async function loadSuggestions() {
    try {
        const res = await adminApi.getSuggestions();
        if (res.code === 200 && res.data) {
            renderSuggestions(Array.isArray(res.data) ? res.data : []);
        }
    } catch (e) { console.error('[Dispatch] 建议:', e); }
}

function renderSuggestions(suggestions) {
    const container = document.querySelector('.suggestions-list');
    if (!container) return;
    if (!suggestions.length) {
        container.innerHTML = '<div style="padding:16px;text-align:center;color:#868e96;">暂无分流建议，各科室负载均衡</div>';
        return;
    }
    container.innerHTML = suggestions.map(s => `
        <div class="suggestion-item" style="padding:12px;border-bottom:1px solid #eee;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span><strong>${escHtml(s.fromDeptName)}</strong> (${s.fromUtilization}%) → <strong>${escHtml(s.toDeptName)}</strong> (${s.toUtilization}%)</span>
                <button class="btn-sm btn-primary" onclick="executeSuggestion(${s.fromDeptId},${s.toDeptId},${s.suggestedCount},'${escHtml(s.reason||'')}')">执行 (${s.suggestedCount}人)</button>
            </div>
            <div style="font-size:12px;color:#868e96;margin-top:4px;">${escHtml(s.reason || '')}</div>
        </div>
    `).join('');
}

async function loadTaskPreemption() {
    try {
        const res = await adminApi.getTaskPreemption();
        if (res.code === 200) {
            renderPreemptionLog(Array.isArray(res.data) ? res.data : []);
        }
    } catch (e) { console.error('[Dispatch] 抢占事件:', e); }
}

function renderPreemptionLog(events) {
    const countEl = document.getElementById('preemptCount');
    if (countEl) countEl.textContent = events.length;

    const container = document.getElementById('preemptLogItems');
    if (!container) return;
    const top = events.slice(0, 8);
    container.innerHTML = top.map(e => {
        const time = (e.createdAt || '').substring(11, 16);
        return `<div class="log-item">
            <span class="log-time">${escHtml(time)}</span>
            <span class="log-type ${preemptTypeClass(e.level)}">${preemptTypeLabel(e.type)}</span>
            <span class="log-desc">${escHtml((e.patientName ? e.patientName + ' ' : '') + (e.description || e.location || ''))}</span>
        </div>`;
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

async function executeSuggestion(fromDeptId, toDeptId, count, reason) {
    try {
        const res = await adminApi.executeDispatch({ fromDeptId, toDeptId, patientCount: count, reason });
        if (res.code === 200) {
            alert(`分流成功！实际分流 ${res.data?.actualCount || count} 人`);
            loadDispatchData();
        }
    } catch (e) { alert('执行失败: ' + e.message); }
}

// ===================== 导出报表 =====================

async function exportReport() {
    const btn = document.getElementById('exportBtn') || event?.target;
    if (btn) { btn.innerHTML = '导出中...'; btn.disabled = true; }
    try {
        const blob = await adminApi.exportDispatchReport();
        downloadBlob(blob, `调度报表_${new Date().toISOString().substring(0, 10)}.csv`);
    } catch (e) {
        alert('导出失败: ' + e.message);
    } finally {
        if (btn) { btn.innerHTML = '导出报表'; btn.disabled = false; }
    }
}

// ===================== 辅助函数 =====================

function viewDetail(deptName) {
    window.location.href = 'queue-detail.html?dept=' + encodeURIComponent(deptName);
}

function loadBadgeClass(status) {
    if (status === 'danger') return 'badge-danger';
    if (status === 'warning') return 'badge-warning';
    return 'badge-success';
}

function loadStatusLabel(status) {
    if (status === 'danger') return '高负载';
    if (status === 'warning') return '中等';
    return '正常';
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function loadDispatchData() {
    loadDeptLoadTable();
    loadSuggestions();
    loadTaskPreemption();
}

// ===================== 初始化 =====================

window.addEventListener('load', async () => {
    // 绑定按钮 → 真实接口（移除内联假动画）
    const mainBtn = document.getElementById('mainTriageBtn');
    const gridBtn = document.getElementById('gridTriageBtn');
    const exportBtn = document.getElementById('exportBtn');
    if (mainBtn) mainBtn.addEventListener('click', executeTriage);
    if (gridBtn) gridBtn.addEventListener('click', executeTriage);
    if (exportBtn) exportBtn.addEventListener('click', exportReport);

    const loggedIn = await initAuth();
    if (!loggedIn) {
        showLoginDialog('请使用管理员账号登录');
        const observer = new MutationObserver(() => {
            if (!document.getElementById('loginOverlay')) { observer.disconnect(); loadDispatchData(); }
        });
        observer.observe(document.body, { childList: true });
        return;
    }
    loadDispatchData();
});
