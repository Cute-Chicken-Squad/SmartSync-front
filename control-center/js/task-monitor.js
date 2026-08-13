/**
 * 智环引诊 - 任务序列监控页面逻辑
 * 对接后端: /admin/api/tasks/*
 * 数据写入: adjustTask, updateTaskStatus
 */

// 本地缓存（API 降级时使用）
let patientTasks = [];
let eventLogs = [];
let currentPatientForAdjust = null;
let tempSequence = [];

// 状态映射
const statusMap = { executing: '执行中', inserted: '已插入', paused: '已暂停' };

// ===================== 页面初始化 =====================

// 读取 URL 参数（从手环页面跳转过来时携带）
const urlParams = new URLSearchParams(window.location.search);
const TARGET_PATIENT_ID = urlParams.get('patientId');
const TARGET_PATIENT_NAME = urlParams.get('patientName');

document.addEventListener('DOMContentLoaded', async function () {
    updateDateTime();
    if (TARGET_PATIENT_NAME) {
        // 更新标题显示目标患者
        const h2 = document.querySelector('.header-left h2');
        if (h2) h2.textContent = '任务序列监控 - ' + decodeURIComponent(TARGET_PATIENT_NAME);
    }
    await Promise.all([loadTasksKpi(), loadTasksList(), loadEventLog()]);
    renderTaskList();
    renderEventLog();
    listenStorageEvents();
    setInterval(updateDateTime, 1000);

    // 自动打开目标患者的任务详情
    if (TARGET_PATIENT_ID) {
        setTimeout(() => {
            const patient = patientTasks.find(p => String(p.id) === String(TARGET_PATIENT_ID));
            if (patient) showTaskDetail(patient);
        }, 800);
    }
});

// ===================== 数据加载 (API) =====================

async function loadTasksKpi() {
    try {
        const res = await adminApi.getTasksKpi();
        if (res.code === 200 && res.data) {
            document.getElementById('executingCount').textContent = res.data.executingCount || 0;
            document.getElementById('insertCount').textContent = res.data.todayInserted || 0;
            document.getElementById('completedCount').textContent = res.data.completedCount || 0;
            document.getElementById('activeStations').textContent = res.data.activeSubstations || 0;
            console.log('[任务监控] KPI 已加载');
            return;
        }
    } catch (e) { console.warn('[任务监控] KPI 加载失败:', e.message); }
    updateKpiStats(); // 降级
}

async function loadTasksList(dept, status) {
    try {
        const params = {};
        if (dept) params.dept = dept;
        if (status) params.status = status;
        const res = await adminApi.getTasksList(params);
        if (res.code === 200 && res.data) {
            const raw = res.data.records || res.data || [];
            if (raw.length > 0) {
                patientTasks = raw.map(r => ({
                    id: r.taskId || r.id,
                    name: r.patientName || '',
                    maskedId: r.maskedId || '',
                    dept: r.dept || '',
                    station: r.station || '',
                    stationLocation: r.stationLocation || '',
                    sequence: r.steps || r.sequence || [],
                    currentTask: r.currentStep || r.currentTask || '',
                    currentStatus: r.status === 'pause' ? 'paused' : (r.status === 'inserted' ? 'inserted' : 'executing'),
                    lastUpdate: r.updatedAt || r.lastUpdate || '',
                    insertedTasks: r.insertedTasks || [],
                    changeLog: r.changeLog || [],
                }));
                console.log('[任务监控] 任务列表已加载:', patientTasks.length);
                renderTaskList();
                return;
            }
        }
    } catch (e) { console.warn('[任务监控] 任务列表加载失败:', e.message); }

    // 降级：从手环管理的患者列表构造任务序列
    console.log('[任务监控] 使用降级数据');
    patientTasks = buildFallbackTasks();
    renderTaskList();
}

/** 从已绑定手环患者生成任务序列（后端无数据时降级） */
function buildFallbackTasks() {
    // 从 localStorage 或页面传递的数据获取患者列表
    const stored = localStorage.getItem('smartsync_patients');
    const patients = stored ? JSON.parse(stored) : [
        { id: 1, name: '王大爷', maskedId: 'PAT-7A3B-9C2D', dept: '心内科', braceletId: 'ABC123456789', deptCode: 'cardiology' },
        { id: 2, name: '李女士', maskedId: 'PAT-2E8F-4D1A', dept: '内分泌科', braceletId: 'DEF234567890', deptCode: 'endocrinology' },
        { id: 3, name: '张先生', maskedId: 'PAT-5B1C-7E3F', dept: '消化内科', braceletId: 'GHI345678901', deptCode: 'gastroenterology' },
        { id: 4, name: '赵阿姨', maskedId: 'PAT-9D4A-2B8E', dept: '内科', braceletId: 'JKL456789012', deptCode: 'internal' },
        { id: 5, name: '孙大爷', maskedId: 'PAT-1F7C-5A3D', dept: '外科', braceletId: 'MNO567890123', deptCode: 'surgery' },
    ];

    const deptTasks = {
        internal:       [{name:'挂号登记'},{name:'候诊排队'},{name:'医生问诊'},{name:'缴费结算'},{name:'取药'}],
        surgery:        [{name:'挂号登记'},{name:'候诊排队'},{name:'医生问诊'},{name:'术前检查'},{name:'缴费结算'}],
        cardiology:     [{name:'挂号登记'},{name:'心电图检查'},{name:'医生问诊'},{name:'缴费结算'},{name:'取药'}],
        endocrinology:  [{name:'挂号登记'},{name:'血糖检测'},{name:'医生问诊'},{name:'缴费结算'},{name:'取药'}],
        gastroenterology:[{name:'挂号登记'},{name:'候诊排队'},{name:'医生问诊'},{name:'胃镜检查预约'},{name:'缴费结算'}],
    };

    return patients.map((p, i) => {
        const tasks = deptTasks[p.deptCode] || deptTasks.internal;
        const seq = tasks.map((t, j) => ({
            name: t.name,
            status: j === 0 ? 'completed' : j === 1 ? 'current' : 'pending',
        }));
        return {
            id: p.id,
            name: p.name,
            maskedId: p.maskedId,
            dept: p.dept,
            station: 'A-08',
            stationLocation: '1F-电梯厅',
            sequence: seq,
            currentTask: seq.find(s => s.status === 'current')?.name || seq[0]?.name || '',
            currentStatus: 'executing',
            lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
            insertedTasks: [],
        };
    });
}

async function loadEventLog() {
    try {
        const res = await adminApi.getTaskEventLog();
        if (res.code === 200 && res.data) {
            eventLogs = (res.data.records || res.data || []).map(e => ({
                time: e.time || e.createdAt || '',
                type: e.type || 'execute',
                title: e.title || e.description || '',
                desc: e.description || e.desc || '',
                patientId: e.patientId || e.taskId || '',
            }));
            console.log('[任务监控] 事件日志已加载:', eventLogs.length);
            return;
        }
    } catch (e) { console.warn('[任务监控] 事件日志加载失败:', e.message); }
}

// ===================== 写操作 (API) =====================

/** 保存任务调整 → PUT /admin/api/tasks/{taskId}/adjust */
async function saveTaskAdjustment() {
    if (!currentPatientForAdjust) return;

    const taskId = currentPatientForAdjust.id;
    const newSequence = tempSequence.map(s => s.name);

    try {
        const res = await adminApi.adjustTask(taskId, {
            action: 'reorder',
            newSequence: newSequence,
        });
        if (res.code === 200) {
            currentPatientForAdjust.sequence = tempSequence;
            currentPatientForAdjust.lastUpdate = new Date().toISOString().replace('T', ' ').substring(0, 19);

            // 重新确定当前任务
            const currentTask = tempSequence.find(t => t.status === 'current' || t.status === 'paused' || t.status === 'inserted');
            if (currentTask) {
                currentPatientForAdjust.currentTask = currentTask.name;
                currentPatientForAdjust.currentStatus = currentTask.status === 'paused' ? 'paused'
                    : currentTask.status === 'inserted' ? 'inserted' : 'executing';
            }

            renderTaskList();
            updateKpiStats();
            closeTaskAdjustModal();
            console.log('[任务监控] 任务调整已保存:', taskId);
            alert('任务调整已保存 ✅');
        } else {
            throw new Error(res.message || '保存失败');
        }
    } catch (e) {
        console.error('[任务监控] 保存调整失败:', e.message);
        alert('保存失败: ' + e.message);
    }
}

/** 暂停/恢复任务 → PUT /admin/api/tasks/{taskId}/status */
async function togglePauseTask() {
    if (!currentPatientForAdjust) return;

    const isPaused = currentPatientForAdjust.currentStatus === 'paused';
    const newStatus = isPaused ? 'resume' : 'pause';
    const taskId = currentPatientForAdjust.id;

    try {
        const res = await adminApi.updateTaskStatus(taskId, {
            status: newStatus,
            note: isPaused ? '控制中心恢复任务' : '控制中心暂停任务',
        });
        if (res.code === 200) {
            currentPatientForAdjust.currentStatus = isPaused ? 'executing' : 'paused';
            const currentTask = tempSequence.find(t => t.status === 'current');
            if (currentTask) {
                currentTask.status = isPaused ? 'current' : 'paused';
            }
            updatePauseButtons();
            renderAdjustSequenceList();
            console.log('[任务监控] 任务状态已更新:', taskId, newStatus);
        }
    } catch (e) {
        console.error('[任务监控] 更新状态失败:', e.message);
        alert('操作失败: ' + e.message);
    }
}

// ===================== 本地辅助函数（保留原有渲染逻辑） =====================

function updateDateTime() {
    const now = new Date();
    const timeStr = formatLocalDateTime(now);
    const el = document.getElementById('dateInfo');
    if (el) el.textContent = timeStr;
}

function updateKpiStats() {
    const executing = patientTasks.filter(p => p.currentStatus === 'executing').length;
    const inserted = patientTasks.filter(p => p.currentStatus === 'inserted').length;
    const completed = patientTasks.filter(p => p.sequence.length > 0 && p.sequence.every(s => s.status === 'completed')).length;
    document.getElementById('executingCount').textContent = executing;
    document.getElementById('insertCount').textContent = inserted;
    document.getElementById('completedCount').textContent = completed || 156;
    document.getElementById('activeStations').textContent = 24;
}

function refreshData() {
    loadTasksKpi();
    loadTasksList();
    loadEventLog();
    setTimeout(() => { renderTaskList(); renderEventLog(); }, 500);
}

// --- 以下保留原有的渲染 UI 逻辑（renderTaskList, renderEventLog, 弹窗等）---
// 原 task-monitor.js 的 UI 渲染代码保持不变，只替换了数据源

// 监听 localStorage 变化（接收子站事件）
function listenStorageEvents() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'controlCenterEvents') {
            try {
                const events = JSON.parse(e.newValue || '[]');
                if (events.length > 0) {
                    const latest = events[0];
                    if (latest.type === 'INSERT_TASK') handleInsertTask(latest);
                }
            } catch (err) { console.error('解析事件失败:', err); }
        }
    });
    simulateSubStationEvents();
}

function handleInsertTask(event) {
    const patient = patientTasks.find(p => p.maskedId === event.patientId);
    if (!patient) return;
    const oldIndex = patient.sequence.findIndex(s => s.name === event.oldTask);
    if (oldIndex === -1) return;
    patient.sequence.splice(oldIndex + 1, 0, { name: event.newTask, status: 'inserted' });
    patient.currentTask = event.newTask;
    patient.currentStatus = 'inserted';
    patient.lastUpdate = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (!patient.insertedTasks) patient.insertedTasks = [];
    patient.insertedTasks.push({ name: event.newTask, from: event.oldTask, at: patient.lastUpdate });
    addEventLog({
        time: patient.lastUpdate, type: 'insert', title: '任务插入',
        desc: `<strong>${patient.name}</strong> 在子站 <strong>${event.stationId}</strong> 插入任务：<span class="old-task">${event.oldTask}</span> → <span class="new-task">${event.newTask}</span>`,
        patientId: patient.id
    });
    renderTaskList();
    updateKpiStats();
}

function simulateSubStationEvents() {
    setInterval(() => {
        if (Math.random() > 0.7) {
            const executingTasks = patientTasks.filter(p => p.currentStatus === 'executing');
            if (executingTasks.length > 0) {
                const patient = executingTasks[Math.floor(Math.random() * executingTasks.length)];
                const currentIdx = patient.sequence.findIndex(s => s.status === 'current');
                if (currentIdx >= 0 && currentIdx < patient.sequence.length - 1) {
                    patient.sequence[currentIdx].status = 'completed';
                    const nextTask = patient.sequence[currentIdx + 1];
                    if (nextTask.status === 'pending') { nextTask.status = 'current'; patient.currentTask = nextTask.name; }
                    patient.lastUpdate = new Date().toISOString().replace('T', ' ').substring(0, 19);
                    renderTaskList();
                }
            }
        }
    }, 8000);
}

// ============== UI 渲染（保留原有完整逻辑） ==============
// 以下代码块来自原 task-monitor.js，保持不变以确保 UI 正常

function renderTaskList() {
    const container = document.getElementById('taskList');
    if (!container) return;
    const deptFilter = document.getElementById('deptFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    let filtered = patientTasks;
    if (deptFilter) filtered = filtered.filter(p => p.dept === deptFilter);
    if (statusFilter) filtered = filtered.filter(p => p.currentStatus === statusFilter);
    container.innerHTML = '';
    if (filtered.length === 0) { container.innerHTML = '<div class="empty-state">暂无符合条件的数据</div>'; return; }
    filtered.forEach(patient => {
        const card = document.createElement('div');
        const isTarget = TARGET_PATIENT_ID && String(patient.id) === String(TARGET_PATIENT_ID);
        card.className = 'task-item-card ' + patient.currentStatus + (isTarget ? ' target-highlight' : '');
        card.onclick = () => showTaskDetail(patient);
        if (isTarget) card.style.border = '2px solid #5c7cfa'; card.style.boxShadow = '0 0 12px rgba(92,124,250,0.3)';
        const seqHtml = patient.sequence.map((task, i) => {
            let cls = task.status === 'completed' ? 'completed' : task.status === 'current' ? 'current' : task.status === 'inserted' ? 'inserted' : '';
            return `<span class="seq-task ${cls}">${task.name}</span>${i < patient.sequence.length - 1 ? '<span class="seq-arrow">→</span>' : ''}`;
        }).join('');
        const changeHtml = patient.insertedTasks?.length ? `<div class="task-change-info"><span class="change-label">最新变更：</span><span class="change-old">${patient.insertedTasks[patient.insertedTasks.length - 1].from}</span><span class="change-arrow">→</span><span class="change-new">${patient.insertedTasks[patient.insertedTasks.length - 1].name}</span></div>` : '';
        card.innerHTML = `
            <div class="task-header"><div class="task-patient"><div class="task-avatar">${patient.name.charAt(0)}</div><div><div class="task-name">${patient.name}</div><div class="task-masked">${patient.maskedId}</div></div></div><div class="task-status-badge ${patient.currentStatus}">${statusMap[patient.currentStatus] || patient.currentStatus}</div></div>
            <div class="task-sequence">${seqHtml}</div>${changeHtml}
            <div class="task-footer"><div class="task-station"><span class="station-marker">LOC</span><span>${patient.stationLocation} · 子站 ${patient.station}</span></div><div class="task-time">${patient.lastUpdate}</div></div>`;
        container.appendChild(card);
    });
}

function renderEventLog() {
    const container = document.getElementById('eventLog');
    if (!container) return;
    container.innerHTML = '';
    if (eventLogs.length === 0) { container.innerHTML = '<div class="empty-state">暂无事件记录</div>'; return; }
    eventLogs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'event-item ' + log.type;
        item.innerHTML = `<div class="event-header"><div class="event-title"><span>${log.title}</span></div><span class="event-time">${log.time}</span></div><div class="event-desc">${log.desc}</div>`;
        container.appendChild(item);
    });
}

function addEventLog(log) {
    eventLogs.unshift(log);
    if (eventLogs.length > 50) eventLogs.pop();
    renderEventLog();
}

function filterTasks() { renderTaskList(); }
function clearLogs() { if (confirm('确定要清空所有事件日志吗？')) { eventLogs = []; renderEventLog(); } }

function showTaskDetail(patient) {
    currentPatientForAdjust = patient;
    const content = document.getElementById('taskDetailContent');
    if (!content) return;
    const seqHtml = patient.sequence.map(task => {
        let cls = task.status === 'completed' ? 'completed' : task.status === 'current' ? 'current' : task.status === 'inserted' ? 'inserted' : '';
        return `<span class="detail-seq-task ${cls}">${task.name}</span>`;
    }).join('<span style="color: #adb5bd; margin: 0 4px;">→</span>');
    const insertedHtml = patient.insertedTasks?.length ? `<div class="detail-section-title">任务变更记录</div>${patient.insertedTasks.map(t => `<div class="task-change-info"><span class="change-label">${t.at}</span><span class="change-old">${t.from}</span><span class="change-arrow">→</span><span class="change-new">${t.name}</span></div>`).join('')}` : '<div class="detail-section-title">暂无任务变更</div>';
    content.innerHTML = `<div class="detail-patient"><div class="detail-patient-name">${patient.name}</div><div class="detail-patient-id">${patient.maskedId} · ${patient.dept}</div></div><div class="detail-section-title">任务序列</div><div class="detail-sequence">${seqHtml}</div><div class="detail-meta"><div class="detail-meta-item"><span class="detail-meta-label">当前位置</span><span class="detail-meta-value">${patient.stationLocation}</span></div><div class="detail-meta-item"><span class="detail-meta-label">所在子站</span><span class="detail-meta-value">${patient.station}</span></div><div class="detail-meta-item"><span class="detail-meta-label">当前任务</span><span class="detail-meta-value" style="color: #5c7cfa;">${patient.currentTask}</span></div><div class="detail-meta-item"><span class="detail-meta-label">当前状态</span><span class="detail-meta-value">${statusMap[patient.currentStatus]}</span></div><div class="detail-meta-item"><span class="detail-meta-label">最后更新</span><span class="detail-meta-value" style="font-family: monospace;">${patient.lastUpdate}</span></div><div class="detail-meta-item"><span class="detail-meta-label">变更次数</span><span class="detail-meta-value">${patient.insertedTasks ? patient.insertedTasks.length : 0}</span></div></div>${insertedHtml}`;
    document.getElementById('taskDetailModal').classList.add('show');
}

function closeTaskDetail() { document.getElementById('taskDetailModal').classList.remove('show'); }

function openTaskAdjustModal() {
    closeTaskDetail();
    document.getElementById('taskAdjustModal').classList.add('show');
    refreshAdjustForm();
}

function closeTaskAdjustModal() { document.getElementById('taskAdjustModal').classList.remove('show'); tempSequence = []; }

function refreshAdjustForm() {
    if (!currentPatientForAdjust) return;
    tempSequence = JSON.parse(JSON.stringify(currentPatientForAdjust.sequence));
    renderAdjustSequenceList();
    updateSelectOptions();
    updatePauseButtons();
}

function renderAdjustSequenceList() {
    const container = document.getElementById('adjustSequenceList');
    if (!container) return;
    container.innerHTML = '';
    tempSequence.forEach((task, index) => {
        const item = document.createElement('div');
        item.className = 'adjust-sequence-item';
        if (task.status === 'current') item.classList.add('current');
        if (task.status === 'completed') item.classList.add('completed');
        if (task.status === 'inserted') item.classList.add('inserted');
        if (task.status === 'paused') item.classList.add('paused');
        item.innerHTML = `<div class="adjust-item-index">${index + 1}</div><div class="adjust-item-content"><div class="adjust-item-name">${task.name}</div><div class="adjust-item-status">${getStatusText(task.status)}</div></div><div class="adjust-item-actions"><button class="adjust-btn adjust-btn-up" onclick="moveTaskUp(${index})" ${index === 0 ? 'disabled' : ''}>↑</button><button class="adjust-btn adjust-btn-down" onclick="moveTaskDown(${index})" ${index === tempSequence.length - 1 ? 'disabled' : ''}>↓</button></div>`;
        container.appendChild(item);
    });
}

function getStatusText(status) {
    return { completed: '已完成', current: '执行中', inserted: '已插入', pending: '待执行', paused: '已暂停' }[status] || status;
}

function updateSelectOptions() {
    const moveFromTask = document.getElementById('moveFromTask');
    const moveToPosition = document.getElementById('moveToPosition');
    const deleteTask = document.getElementById('deleteTask');
    if (moveFromTask) {
        moveFromTask.innerHTML = '<option value="">选择要移动的任务</option>';
        tempSequence.forEach((task, index) => {
            if (task.status !== 'completed') {
                const opt = document.createElement('option'); opt.value = index; opt.textContent = task.name; moveFromTask.appendChild(opt);
            }
        });
    }
    if (moveToPosition) {
        moveToPosition.innerHTML = '<option value="-1">移到开头</option>';
        tempSequence.forEach((task, index) => {
            const opt = document.createElement('option'); opt.value = index; opt.textContent = `在"${task.name}"之后`; moveToPosition.appendChild(opt);
        });
    }
    if (deleteTask) {
        deleteTask.innerHTML = '<option value="">选择要删除的任务</option>';
        tempSequence.forEach((task, index) => {
            if (task.status !== 'completed' && task.status !== 'current') {
                const opt = document.createElement('option'); opt.value = index; opt.textContent = task.name; deleteTask.appendChild(opt);
            }
        });
    }
}

function updatePauseButtons() {
    const btnPause = document.getElementById('btnPauseTask');
    const btnResume = document.getElementById('btnResumeTask');
    if (btnPause && btnResume) {
        if (currentPatientForAdjust?.currentStatus === 'paused') {
            btnPause.style.display = 'none'; btnResume.style.display = 'inline-block';
        } else {
            btnPause.style.display = 'inline-block'; btnResume.style.display = 'none';
        }
    }
}

function moveTaskUp(index) {
    if (index <= 0) return;
    [tempSequence[index], tempSequence[index - 1]] = [tempSequence[index - 1], tempSequence[index]];
    renderAdjustSequenceList(); updateSelectOptions();
}

function moveTaskDown(index) {
    if (index >= tempSequence.length - 1) return;
    [tempSequence[index], tempSequence[index + 1]] = [tempSequence[index + 1], tempSequence[index]];
    renderAdjustSequenceList(); updateSelectOptions();
}

function insertNewTask() {
    const taskName = document.getElementById('newTaskName')?.value?.trim();
    const position = document.getElementById('insertPosition')?.value;
    if (!taskName) { alert('请输入任务名称'); return; }
    const currentIndex = tempSequence.findIndex(t => t.status === 'current');
    let insertIndex = currentIndex >= 0 ? (position === 'after' ? currentIndex + 1 : currentIndex) : tempSequence.length;
    tempSequence.splice(insertIndex, 0, { name: taskName, status: 'inserted' });
    document.getElementById('newTaskName').value = '';
    renderAdjustSequenceList(); updateSelectOptions();
    addEventLog({ time: new Date().toISOString().replace('T', ' ').substring(0, 19), type: 'insert', title: '任务插入（手动）', desc: `<strong>${currentPatientForAdjust.name}</strong> 插入任务：<span class="new-task">${taskName}</span>`, patientId: currentPatientForAdjust.id });
}

function moveTask() {
    const fromIndex = parseInt(document.getElementById('moveFromTask')?.value);
    const toPosition = parseInt(document.getElementById('moveToPosition')?.value);
    if (isNaN(fromIndex) || isNaN(toPosition)) { alert('请选择要移动的任务和目标位置'); return; }
    if (fromIndex === toPosition) return;
    const task = tempSequence.splice(fromIndex, 1)[0];
    let insertIndex = toPosition + 1;
    if (fromIndex < toPosition) insertIndex = toPosition;
    if (toPosition === -1) insertIndex = 0;
    tempSequence.splice(insertIndex, 0, task);
    document.getElementById('moveFromTask').value = ''; document.getElementById('moveToPosition').value = '';
    renderAdjustSequenceList(); updateSelectOptions();
    addEventLog({ time: new Date().toISOString().replace('T', ' ').substring(0, 19), type: 'insert', title: '任务顺序调整', desc: `<strong>${currentPatientForAdjust.name}</strong> 调整任务顺序：<strong>${task.name}</strong>`, patientId: currentPatientForAdjust.id });
}

function deleteSelectedTask() {
    const deleteIndex = parseInt(document.getElementById('deleteTask')?.value);
    if (isNaN(deleteIndex)) { alert('请选择要删除的任务'); return; }
    const task = tempSequence[deleteIndex];
    if (!confirm(`确定要删除任务"${task.name}"吗？`)) return;
    tempSequence.splice(deleteIndex, 1);
    document.getElementById('deleteTask').value = '';
    renderAdjustSequenceList(); updateSelectOptions();
    addEventLog({ time: new Date().toISOString().replace('T', ' ').substring(0, 19), type: 'complete', title: '任务删除（手动）', desc: `<strong>${currentPatientForAdjust.name}</strong> 删除任务：<span class="old-task">${task.name}</span>`, patientId: currentPatientForAdjust.id });
}
