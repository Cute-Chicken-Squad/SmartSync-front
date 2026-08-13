/**
 * 智环引诊 - 应急指挥台
 * 对接后端: /admin/api/emergency/*
 */

// 实时时钟
setInterval(() => {
    const date = new Date();
    const el = document.getElementById('dateInfo');
    if (el) el.textContent = date.toISOString().replace('T', ' ').substring(0, 19);
}, 1000);

let currentAlarmId = null;

// ===================== 警报列表 =====================

async function loadAlarms(params = {}) {
    try {
        const res = await adminApi.getEmergencyAlarms(params);
        if (res.code === 200 && res.data) {
            const records = res.data.records || (Array.isArray(res.data) ? res.data : []);
            renderAlarmList(records);
            if (res.data.total != null) updatePagination(res.data);
            // 更新计数标签
            updateAlarmCount(records.length, res.data.total);
            // 更新统计卡片
            updateStatsFromAlarms(records);
        }
    } catch (e) {
        console.error('[Emergency] 警报:', e);
        document.getElementById('alarmListContainer').innerHTML =
            '<div style="padding:20px;text-align:center;color:#D94848;">加载失败，请刷新重试</div>';
    }
}

function updateAlarmCount(shown, total) {
    const el = document.getElementById('alarmCountLabel');
    if (el) el.textContent = '共 ' + (total || shown) + ' 条警报';
}

function updateStatsFromAlarms(alarms) {
    const pending = alarms.filter(a => a.status === 'pending').length;
    const processing = alarms.filter(a => a.status === 'processing').length;
    const completed = alarms.filter(a => a.status === 'completed').length;
    setStatValue('statPending', pending);
    setStatValue('statProcessing', processing);
    setStatValue('statCompleted', completed);

    // 平均响应时间 — 从已完成警报计算
    const completedList = alarms.filter(a => a.status === 'completed' && a.createdAt && a.handledAt);
    if (completedList.length > 0) {
        let totalSec = 0;
        completedList.forEach(a => {
            const diff = (new Date(a.handledAt) - new Date(a.createdAt)) / 1000;
            totalSec += Math.max(0, diff);
        });
        const avgMin = totalSec / completedList.length / 60;
        setStatValue('statAvgTime', avgMin < 1 ? Math.round(avgMin * 60) + 's' : avgMin.toFixed(1) + 'min');
    } else {
        setStatValue('statAvgTime', '2.5min');
    }
}

function setStatValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function renderAlarmList(alarms) {
    const container = document.querySelector('.alarm-list, .data-table tbody');
    if (!container) return;

    const isTableBody = container.tagName === 'TBODY';

    if (!alarms.length) {
        container.innerHTML = isTableBody
            ? '<tr><td colspan="7" style="text-align:center;padding:20px;color:#868e96;">暂无警报</td></tr>'
            : '<div style="padding:20px;text-align:center;color:#868e96;">暂无警报</div>';
        return;
    }

    if (isTableBody) {
        container.innerHTML = alarms.map(a => `
            <tr id="alarm-${a.id}" class="${a.level >= 3 ? 'danger' : ''}">
                <td>${a.alarmCode || a.id}</td>
                <td>${alarmTypeLabel(a.type)}</td>
                <td>${a.level || '--'}</td>
                <td>${escHtml(a.location || '--')}</td>
                <td>${escHtml(a.patientName || '--')}</td>
                <td><span class="badge ${statusBadgeClass(a.status)}" id="status-${a.id}">${statusLabel(a.status)}</span></td>
                <td id="actions-${a.id}">${buildActionButtons(a)}</td>
            </tr>
        `).join('');
    } else {
        container.innerHTML = alarms.map(a => {
            const timeStr = a.createdAt ? a.createdAt.substring(11, 19) : '--:--:--';
            return `
            <div class="alarm-item${a.level >= 3 ? ' danger' : ''}" id="alarm-${a.id}">
                <div class="alarm-info">
                    <div class="alarm-content">
                        <div class="alarm-time">${timeStr}</div>
                        <div class="alarm-location">${escHtml(a.location || '--')}</div>
                        <div class="alarm-desc">${escHtml(alarmTypeLabel(a.type))} - ${escHtml(a.patientName || '未知患者')}</div>
                    </div>
                </div>
                <div class="alarm-actions" id="actions-${a.id}">${buildCardActions(a)}</div>
            </div>`;
        }).join('');
    }
}

function buildActionButtons(a) {
    if (a.status !== 'pending') return '';
    return `
        <button class="btn-sm btn-primary" onclick="showPatientDetail('${escHtml(a.patientName||'未知')}', ${a.id})">详情</button>
        <button class="btn-sm btn-success" id="handleBtn-${a.id}" onclick="handleAlarmDirect(${a.id})">处理</button>
        <button class="btn-sm" onclick="ignoreAlarmById(${a.id})">忽略</button>`;
}

function buildCardActions(a) {
    const detailBtn = `<button class="alarm-btn primary" onclick="showPatientDetail('${escHtml(a.patientName||'未知')}', ${a.id})">查看详情</button>`;
    if (a.status !== 'pending') return detailBtn;
    return detailBtn + `
        <button class="alarm-btn success" id="handleBtn-${a.id}" onclick="handleAlarmDirect(${a.id})">立即处理</button>
        <button class="alarm-btn secondary" onclick="ignoreAlarmById(${a.id})">忽略</button>`;
}

function updatePagination(pageData) {
    const paginationEl = document.querySelector('.pagination');
    if (!paginationEl) return;
    const totalPages = Math.ceil((pageData.total || 0) / (pageData.size || 10));
    paginationEl.innerHTML = `<span>共 ${pageData.total || 0} 条，第 ${pageData.current || 1}/${totalPages || 1} 页</span>`;
}

// ===================== 警报操作（即时更新状态） =====================

async function handleAlarmDirect(alarmId) {
    const btn = document.getElementById('handleBtn-' + alarmId);
    if (btn) { btn.textContent = '处理中...'; btn.disabled = true; }

    try {
        await adminApi.handleAlarm(alarmId, '控制中心应急处理');
        // 即时更新 UI，无需全量刷新
        updateAlarmStatus(alarmId, 'processing');
    } catch (e) {
        alert('处理失败: ' + e.message);
        if (btn) { btn.textContent = '处理'; btn.disabled = false; }
    }
}

async function ignoreAlarmById(alarmId) {
    const alarmItem = document.getElementById('alarm-' + alarmId);
    try {
        await adminApi.ignoreAlarm(alarmId);
        updateAlarmStatus(alarmId, 'ignored');
        if (alarmItem) alarmItem.style.opacity = '0.5';
    } catch (e) { alert('忽略失败: ' + e.message); }
}

/** 即时更新单个警报的状态显示 */
function updateAlarmStatus(alarmId, newStatus) {
    // 更新状态标签
    const statusEl = document.getElementById('status-' + alarmId);
    if (statusEl) {
        statusEl.textContent = statusLabel(newStatus);
        statusEl.className = 'badge ' + statusBadgeClass(newStatus);
        statusEl.style.transition = 'all 0.3s';
        statusEl.style.transform = 'scale(1.1)';
        setTimeout(() => { statusEl.style.transform = 'scale(1)'; }, 300);
    }

    // 更新操作按钮
    const actionsEl = document.getElementById('actions-' + alarmId);
    if (actionsEl) {
        if (newStatus === 'processing') {
            actionsEl.innerHTML = '<span style="font-size:12px;color:#E8992D;">处理中...</span>';
        } else if (newStatus === 'ignored') {
            actionsEl.innerHTML = '<span style="font-size:12px;color:#959BA3;">已忽略</span>';
        } else if (newStatus === 'completed') {
            actionsEl.innerHTML = '<span style="font-size:12px;color:#2D9F5C;">已完成</span>';
        }
    }

    // 更新行样式
    const alarmItem = document.getElementById('alarm-' + alarmId);
    if (alarmItem) {
        alarmItem.classList.remove('danger');
        if (newStatus === 'processing') alarmItem.classList.add('processing');
        if (newStatus === 'completed' || newStatus === 'ignored') {
            alarmItem.style.opacity = '0.6';
            alarmItem.style.transition = 'opacity 0.4s';
        }
    }

    // 更新统计 KPI
    updateAlarmStats();
}

/** 更新紧急情况页面的统计数字 */
async function updateAlarmStats() {
    try {
        const res = await adminApi.getEmergencyAlarms({ size: 50 });
        if (res.code === 200 && res.data) {
            const records = Array.isArray(res.data.records) ? res.data.records : (res.data || []);
            updateStatsFromAlarms(records);
            updateAlarmCount(records.length, res.data.total);
        }
    } catch (e) { /* ignore */ }
}

/** 加载今日处理记录 */
async function loadHistoryRecords() {
    try {
        const res = await adminApi.getEmergencyRecords();
        if (res.code === 200 && res.data) {
            const records = Array.isArray(res.data) ? res.data : (res.data.records || []);
            renderHistory(records);
        }
    } catch (e) {
        document.getElementById('historyTableBody').innerHTML =
            '<tr><td colspan="4" style="padding:20px;text-align:center;color:#959BA3;">暂无记录</td></tr>';
    }
}

function renderHistory(records) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px;text-align:center;color:#959BA3;">暂无记录</td></tr>';
        return;
    }
    tbody.innerHTML = records.map(r => `
        <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 10px;">${formatTime(r.createdAt || r.handledAt)}</td>
            <td style="padding: 10px;">${escHtml(r.location || '--')}</td>
            <td style="padding: 10px;">${alarmTypeLabel(r.type)}</td>
            <td style="padding: 10px; color: ${r.status === 'completed' ? '#2D9F5C' : '#E8992D'};">${statusLabel(r.status)}</td>
        </tr>
    `).join('');
}

function formatTime(isoStr) {
    if (!isoStr) return '--';
    try { return new Date(isoStr).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }); }
    catch { return isoStr.substring(11, 16) || isoStr; }
}

// ===================== 患者详情弹窗 =====================

async function showPatientDetail(name, alarmId) {
    currentAlarmId = alarmId;
    document.getElementById('patientName').textContent = name;
    try {
        const res = await adminApi.getAlarmDetail(alarmId);
        if (res.code === 200 && res.data) {
            const patient = res.data.patient || {};
            const alarm = res.data.alarm || {};
            const infoEl = document.querySelector('.patient-info-content');
            if (infoEl && patient) {
                infoEl.innerHTML = `
                    <p><strong>姓名:</strong> ${escHtml(patient.name || name)}</p>
                    <p><strong>年龄:</strong> ${patient.age || '--'}</p>
                    <p><strong>性别:</strong> ${patient.gender === 1 ? '男' : patient.gender === 2 ? '女' : '--'}</p>
                    <p><strong>科室:</strong> ${escHtml(patient.dept || '--')}</p>
                    <p><strong>位置:</strong> ${escHtml(patient.location || alarm.location || '--')}</p>
                    <p><strong>病史:</strong> ${escHtml(patient.medicalHistory || '无')}</p>
                `;
            }
            const termEl = document.querySelector('.terminal-info');
            if (termEl && res.data.terminalName) {
                termEl.textContent = '触发终端: ' + res.data.terminalName;
            }
        }
    } catch (e) { console.error('加载患者详情失败:', e); }
    document.getElementById('patientModal').classList.add('show');
}

function closeModal() {
    document.getElementById('patientModal').classList.remove('show');
    currentAlarmId = null;
}

// ===================== 紧急广播 =====================

async function emergencyBroadcast() {
    const btn = event?.target;
    const content = prompt('请输入紧急广播内容:');
    if (!content) return;
    if (btn) { btn.textContent = '广播中...'; btn.disabled = true; }
    try {
        await adminApi.broadcastEmergency(content);
        alert('紧急广播已发送！');
    } catch (e) {
        alert('广播发送失败: ' + e.message);
    } finally {
        if (btn) { btn.textContent = '紧急广播'; btn.disabled = false; }
    }
}

// ===================== 弹窗内操作按钮 =====================

async function handlePatient() {
    const btn = event?.target;
    if (btn) { btn.textContent = '处理中...'; btn.disabled = true; }
    try {
        if (currentAlarmId) {
            await adminApi.handleAlarm(currentAlarmId, '已处理');
            updateAlarmStatus(currentAlarmId, 'completed');
        }
        closeModal();
    } catch (e) {
        alert('处理失败: ' + e.message);
    } finally {
        if (btn) { btn.textContent = '已处理'; btn.disabled = false; }
    }
}

async function ignoreAlert() {
    if (!currentAlarmId) return;
    try { await adminApi.ignoreAlarm(currentAlarmId); updateAlarmStatus(currentAlarmId, 'ignored'); closeModal(); }
    catch (e) { alert('操作失败: ' + e.message); }
}

async function postponeAlert() {
    if (!currentAlarmId) return;
    const until = prompt('延后到 (格式: 2026-05-07T14:30:00):');
    if (!until) return;
    try { await adminApi.postponeAlarm(currentAlarmId, until); updateAlarmStatus(currentAlarmId, 'postponed'); closeModal(); }
    catch (e) { alert('操作失败: ' + e.message); }
}

async function closeAlert() {
    if (!currentAlarmId) return;
    try { await adminApi.closeAlarm(currentAlarmId); updateAlarmStatus(currentAlarmId, 'closed'); closeModal(); }
    catch (e) { alert('操作失败: ' + e.message); }
}

async function assignMaintenance() {
    if (!currentAlarmId) return;
    const note = prompt('维护备注:');
    if (!note) return;
    try { await adminApi.createMaintenance(currentAlarmId, note); updateAlarmStatus(currentAlarmId, 'processing'); closeModal(); }
    catch (e) { alert('操作失败: ' + e.message); }
}

async function triagePatient() {
    if (!currentAlarmId) return;
    try {
        const res = await adminApi.getAlarmDetail(currentAlarmId);
        if (res.code === 200 && res.data?.patient?.dept) {
            await adminApi.triageDept(res.data.patient.dept, 1);
            alert('分流处理完成！');
        } else {
            alert('无法获取患者科室信息');
        }
    } catch (e) { alert('分流失败: ' + e.message); }
}

// ===================== 导出 =====================

async function exportRecords() {
    const btn = event?.target;
    if (btn) { btn.textContent = '导出中...'; btn.disabled = true; }
    try {
        const blob = await adminApi.exportEmergencyRecords();
        downloadBlob(blob, `应急记录_${new Date().toISOString().substring(0, 10)}.csv`);
    } catch (e) {
        alert('导出失败: ' + e.message);
    } finally {
        if (btn) { btn.textContent = '导出记录'; btn.disabled = false; }
    }
}

// ===================== 辅助函数 =====================

function alarmTypeLabel(type) {
    const map = { emergency: '患者求助', wheelchair: '轮椅协助', maintenance: '患者求助', fall: '跌倒', vital: '生命体征', broadcast: '广播' };
    return map[type] || type || '--';
}

function statusBadgeClass(status) {
    const map = { pending: 'badge-danger', processing: 'badge-warning', completed: 'badge-success', ignored: 'badge-secondary', postponed: 'badge-warning', closed: 'badge-secondary' };
    return map[status] || 'badge-secondary';
}

function statusLabel(status) {
    const map = { pending: '待处理', processing: '处理中', completed: '已完成', ignored: '已忽略', postponed: '已延后', closed: '已关闭' };
    return map[status] || status || '--';
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function filterDesc(str) {
    if (!str) return '暂无';
    if (str.includes('子站终端重启任务') || str.includes('子站重启任务')) return '暂无';
    return str;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function goToAlarmList() { window.location.href = 'alarm-list.html'; }

// ===================== 初始化 =====================

window.addEventListener('load', async () => {
    const modal = document.getElementById('patientModal');
    if (modal) {
        modal.addEventListener('click', function(e) { if (e.target === this) closeModal(); });
    }

    const loggedIn = await initAuth();
    if (!loggedIn) {
        showLoginDialog('请使用管理员账号登录');
        const observer = new MutationObserver(() => {
            if (!document.getElementById('loginOverlay')) { observer.disconnect(); loadAlarms(); if (typeof AlarmRealtime !== 'undefined') AlarmRealtime.start(() => loadAlarms()); }
        });
        observer.observe(document.body, { childList: true });
        return;
    }
    loadAlarms();
    loadHistoryRecords();
    if (typeof AlarmRealtime !== 'undefined') AlarmRealtime.start(() => loadAlarms());
});
