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
            // 更新分页
            if (res.data.total != null) updatePagination(res.data);
        }
    } catch (e) { console.error('[Emergency] 警报:', e); }
}

function renderAlarmList(alarms) {
    const container = document.querySelector('.alarm-list, .data-table tbody');
    if (!container) return;

    if (!alarms.length) {
        container.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#868e96;">暂无警报</td></tr>';
        return;
    }

    container.innerHTML = alarms.map(a => `
        <tr id="alarm-${a.id}" class="${a.level >= 3 ? 'danger' : ''}">
            <td>${a.alarmCode || a.id}</td>
            <td>${alarmTypeLabel(a.type)}</td>
            <td>${a.level || '--'}</td>
            <td>${escHtml(a.location || '--')}</td>
            <td>${escHtml(a.patientName || '--')}</td>
            <td><span class="badge ${statusBadgeClass(a.status)}">${statusLabel(a.status)}</span></td>
            <td>
                <button class="btn-sm btn-primary" onclick="showPatientDetail('${escHtml(a.patientName||'未知')}', ${a.id})">详情</button>
                ${a.status === 'pending' ? `<button class="btn-sm btn-success" onclick="handleAlarmDirect(${a.id})">处理</button>` : ''}
                ${a.status === 'pending' ? `<button class="btn-sm" onclick="ignoreAlarmById(${a.id})">忽略</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function updatePagination(pageData) {
    // 简单分页展示
    const paginationEl = document.querySelector('.pagination');
    if (!paginationEl) return;
    const totalPages = Math.ceil((pageData.total || 0) / (pageData.size || 10));
    paginationEl.innerHTML = `
        <span>共 ${pageData.total || 0} 条，第 ${pageData.current || 1}/${totalPages || 1} 页</span>
    `;
}

// ===================== 警报操作 =====================

async function handleAlarmDirect(alarmId) {
    const alarmItem = document.getElementById('alarm-' + alarmId);
    try {
        await adminApi.handleAlarm(alarmId, '控制中心应急处理');
        if (alarmItem) {
            alarmItem.classList.remove('danger');
            alarmItem.classList.add('success');
        }
        loadAlarms();
    } catch (e) { alert('处理失败: ' + e.message); }
}

async function ignoreAlarmById(alarmId) {
    try {
        await adminApi.ignoreAlarm(alarmId);
        loadAlarms();
    } catch (e) { alert('忽略失败: ' + e.message); }
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
            // 填充患者信息
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
            // 更新终端信息
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
    if (btn) { btn.innerHTML = '广播中...'; btn.disabled = true; }
    try {
        await adminApi.broadcastEmergency(content);
        alert('紧急广播已发送！');
    } catch (e) {
        alert('广播发送失败: ' + e.message);
    } finally {
        if (btn) { btn.innerHTML = '紧急广播'; btn.disabled = false; }
    }
}

// ===================== 处理/忽略/延后/关闭 =====================

async function handlePatient() {
    const btn = event?.target;
    if (btn) { btn.innerHTML = '处理中...'; btn.disabled = true; }
    try {
        if (currentAlarmId) await adminApi.handleAlarm(currentAlarmId, '已处理');
        alert('处理成功！');
        closeModal();
        loadAlarms();
    } catch (e) {
        alert('处理失败: ' + e.message);
    } finally {
        if (btn) { btn.innerHTML = '已处理'; btn.disabled = false; }
    }
}

async function ignoreAlert() {
    if (!currentAlarmId) return;
    try { await adminApi.ignoreAlarm(currentAlarmId); alert('已忽略此警报'); closeModal(); loadAlarms(); }
    catch (e) { alert('操作失败: ' + e.message); }
}

async function postponeAlert() {
    if (!currentAlarmId) return;
    const until = prompt('延后到 (格式: 2026-05-07T14:30:00):');
    if (!until) return;
    try { await adminApi.postponeAlarm(currentAlarmId, until); alert('已延后处理'); closeModal(); loadAlarms(); }
    catch (e) { alert('操作失败: ' + e.message); }
}

async function closeAlert() {
    if (!currentAlarmId) return;
    try { await adminApi.closeAlarm(currentAlarmId); alert('警报已关闭'); closeModal(); loadAlarms(); }
    catch (e) { alert('操作失败: ' + e.message); }
}

async function assignMaintenance() {
    if (!currentAlarmId) return;
    const note = prompt('维护备注:');
    if (!note) return;
    try { await adminApi.createMaintenance(currentAlarmId, note); alert('已安排维护人员'); closeModal(); loadAlarms(); }
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
    if (btn) { btn.innerHTML = '导出中...'; btn.disabled = true; }
    try {
        const blob = await adminApi.exportEmergencyRecords();
        downloadBlob(blob, `应急记录_${new Date().toISOString().substring(0, 10)}.csv`);
    } catch (e) {
        alert('导出失败: ' + e.message);
    } finally {
        if (btn) { btn.innerHTML = '导出记录'; btn.disabled = false; }
    }
}

// ===================== 辅助函数 =====================

function alarmTypeLabel(type) {
    const map = { emergency: '紧急求助', wheelchair: '轮椅协助', maintenance: '设备维护', fall: '跌倒', vital: '生命体征', broadcast: '广播' };
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

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function goToAlarmList() { window.location.href = 'alarm-list.html'; }

// ===================== 初始化 =====================

window.addEventListener('load', async () => {
    // Modal 点击关闭
    const modal = document.getElementById('patientModal');
    if (modal) {
        modal.addEventListener('click', function(e) { if (e.target === this) closeModal(); });
    }

    const loggedIn = await initAuth();
    if (!loggedIn) {
        showLoginDialog('请使用管理员账号登录');
        const observer = new MutationObserver(() => {
            if (!document.getElementById('loginOverlay')) { observer.disconnect(); loadAlarms(); }
        });
        observer.observe(document.body, { childList: true });
        return;
    }
    loadAlarms();
});
