/**
 * 智环引诊 - 应急管理页面逻辑
 * 对接后端: /admin/api/emergency/*
 */

var currentAlarmId = null;
var alarmList = [];

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        var date = new Date();
        var timeString = date.toISOString().replace('T', ' ').substring(0, 19);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // 弹窗关闭事件
    document.getElementById('patientModal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });

    // ★ 加载警报列表
    await loadAlarms();
});

// ===================== 数据加载 =====================

async function loadAlarms(params) {
    try {
        const res = await adminApi.getEmergencyAlarms(params || { current: 1, size: 50 });
        if (res.code === 200 && res.data) {
            alarmList = res.data.records || [];
            console.log('[应急] 已加载警报:', alarmList.length);
        }
    } catch (e) {
        console.warn('[应急] 加载警报失败:', e.message);
    }
}

// ===================== 写操作 =====================

function showPatientDetail(name, alarmId) {
    currentAlarmId = alarmId;
    document.getElementById('patientName').textContent = name;
    document.getElementById('patientModal').classList.add('show');
}

function closeModal() {
    document.getElementById('patientModal').classList.remove('show');
    currentAlarmId = null;
}

async function handleAlarmDirect(alarmId) {
    var alarmItem = document.getElementById('alarm-' + alarmId);
    if (!alarmItem) return;

    var actionBtn = alarmItem.querySelector('.alarm-btn.success');
    if (!actionBtn || actionBtn.textContent === '已处理') return;

    actionBtn.innerHTML = '处理中...';
    actionBtn.disabled = true;

    try {
        const res = await adminApi.handleAlarm(alarmId, '控制中心应急处理');
        if (res.code === 200) {
            actionBtn.innerHTML = '已处理';
            actionBtn.style.background = '#4caf50';
            alarmItem.classList.remove('danger');
            alarmItem.classList.add('success');
            console.log('[应急] 警报已处理:', alarmId);
        }
    } catch (e) {
        console.error('[应急] 处理警报失败:', e.message);
        alert('处理失败: ' + e.message);
        actionBtn.innerHTML = '处理';
        actionBtn.disabled = false;
    }
}

async function handlePatient() {
    var modalBtn = event.target;
    modalBtn.innerHTML = '处理中...';
    modalBtn.disabled = true;

    try {
        const res = await adminApi.handleAlarm(currentAlarmId, '控制中心应急处理');
        if (res.code === 200) {
            modalBtn.innerHTML = '已处理';
            if (currentAlarmId) {
                var alarmItem = document.getElementById('alarm-' + currentAlarmId);
                if (alarmItem) {
                    var actionBtn = alarmItem.querySelector('.alarm-btn.success');
                    if (actionBtn) {
                        actionBtn.innerHTML = '已处理';
                        actionBtn.style.background = '#4caf50';
                    }
                    alarmItem.classList.remove('danger');
                    alarmItem.classList.add('success');
                }
            }
            alert('处理成功 ✅');
            closeModal();
        }
    } catch (e) {
        console.error('[应急] 处理失败:', e.message);
        alert('处理失败: ' + e.message);
        modalBtn.innerHTML = '立即处理';
        modalBtn.disabled = false;
    }
}

async function triagePatient() {
    var btn = event.target;
    btn.innerHTML = '分流中...';
    btn.disabled = true;

    try {
        // 需要从当前警报中获取科室信息
        var dept = prompt('请输入分流目标科室名称:');
        if (!dept) { btn.innerHTML = '分流处理'; btn.disabled = false; return; }
        const res = await adminApi.triageDept(dept, 1);
        if (res.code === 200) {
            btn.innerHTML = '已分流';
            btn.style.background = '#4caf50';
            alert('分流处理完成 ✅');
        }
    } catch (e) {
        console.error('[应急] 分流失败:', e.message);
        alert('分流失败: ' + e.message);
        btn.innerHTML = '分流处理';
        btn.disabled = false;
    }
}

async function ignoreAlert() {
    var btn = event.target;
    try {
        await adminApi.ignoreAlarm(currentAlarmId);
        btn.innerHTML = '已忽略';
        btn.style.background = '#6c757d';
        alert('已忽略此警报 ✅');
    } catch (e) {
        console.error('[应急] 忽略警报失败:', e.message);
    }
}

async function postponeAlert() {
    var btn = event.target;
    var until = prompt('延后到何时？(格式: 2026-07-12 18:00):');
    if (!until) return;
    try {
        await adminApi.postponeAlarm(currentAlarmId, until);
        btn.innerHTML = '已延后';
        btn.style.background = '#ff9800';
        alert('已延后处理 ✅');
    } catch (e) {
        console.error('[应急] 延后警报失败:', e.message);
    }
}

async function closeAlert() {
    var btn = event.target;
    try {
        await adminApi.closeAlarm(currentAlarmId);
        btn.innerHTML = '已关闭';
        btn.style.background = '#6c757d';
        alert('警报已关闭 ✅');
    } catch (e) {
        console.error('[应急] 关闭警报失败:', e.message);
    }
}

async function assignMaintenance() {
    var btn = event.target;
    btn.innerHTML = '安排中...';
    btn.disabled = true;
    var note = prompt('维护说明:') || '控制中心安排维护';
    try {
        const res = await adminApi.createMaintenance(currentAlarmId, note);
        if (res.code === 200) {
            btn.innerHTML = '已安排';
            btn.style.background = '#4caf50';
            alert('已安排维护人员 ✅');
        }
    } catch (e) {
        console.error('[应急] 安排维护失败:', e.message);
        alert('安排失败: ' + e.message);
        btn.innerHTML = '安排维护';
        btn.disabled = false;
    }
}

async function emergencyBroadcast() {
    var btn = event.target;
    var content = prompt('请输入广播内容:');
    if (!content) return;
    btn.innerHTML = '广播中...';
    btn.disabled = true;
    try {
        const res = await adminApi.broadcastEmergency(content);
        if (res.code === 200) {
            alert('紧急广播已发送 ✅');
        }
    } catch (e) {
        console.error('[应急] 广播失败:', e.message);
        alert('广播失败: ' + e.message);
    } finally {
        btn.innerHTML = '紧急广播';
        btn.disabled = false;
    }
}

async function exportRecords() {
    var btn = event.target;
    btn.innerHTML = '导出中...';
    btn.disabled = true;
    try {
        const blob = await adminApi.exportEmergencyRecords();
        // 触发浏览器下载
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'emergency_records.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        alert('记录导出成功 ✅');
    } catch (e) {
        console.error('[应急] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        btn.innerHTML = '导出记录';
        btn.disabled = false;
    }
}

function goToAlarmList() {
    window.location.href = 'alarm-list.html';
}
