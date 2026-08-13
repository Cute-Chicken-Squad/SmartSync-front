/**
 * 智环引诊 - 应急管理页面逻辑
 * 对接后端: /admin/api/emergency/*
 */

var currentAlarmId = null;
var alarmList = [];
var allAlarmRecords = [];  // 全部记录（含已完成/已忽略），用于统计

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        var date = new Date();
        var timeString = formatLocalDateTime(date);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // 弹窗关闭事件
    document.getElementById('patientModal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });

    // ★ 确保认证后再加载数据（写操作需要有效 token 才能持久化到后端数据库）
    await ensureAuth();
    await loadAlarms();
    await loadRecords();

    // ★ 启动实时警报监控（子站点击紧急求助 → 总站弹窗）
    if (typeof AlarmRealtime !== 'undefined') {
        AlarmRealtime.start(function () {
            // 新警报到达时刷新警报列表和统计
            loadAlarms();
            loadRecords();
        });
    }
});

// ===================== 数据加载 =====================

/**
 * 警报排序 —— 活跃警报按 等级↓ → 状态优先级 → 等待时间↑
 *
 * 排序规则：
 *   1. level  DESC  (5 特急 → 1 低)
 *   2. status ASC   (pending=0 → processing=1)  未处理优先于处理中
 *   3. createdAt ASC (同等级同状态，等待最久的排最前)
 */
function sortActiveAlarms(alarms) {
    var STATUS_ORDER = { pending: 0, processing: 1 };
    return alarms.sort(function(a, b) {
        var la = a.level || 0, lb = b.level || 0;
        if (la !== lb) return lb - la;                          // level DESC
        var sa = STATUS_ORDER[a.status] ?? 9, sb = STATUS_ORDER[b.status] ?? 9;
        if (sa !== sb) return sa - sb;                          // status priority
        return (a.createdAt || '').localeCompare(b.createdAt || ''); // time ASC — oldest first
    });
}

async function loadAlarms(params) {
    try {
        var res = await adminApi.getEmergencyAlarms(params || { current: 1, size: 50 });
        if (res.code === 200 && res.data) {
            allAlarmRecords = res.data.records || [];
            alarmList = sortActiveAlarms(allAlarmRecords.filter(function(a) {
                return a.status === 'pending' || a.status === 'processing';
            }));
            console.log('[应急] 已加载警报:', alarmList.length, '(共', allAlarmRecords.length, '条)');
            renderAlarmList();
            updateStats();
        }
    } catch (e) {
        console.warn('[应急] 加载警报失败:', e.message);
    }
}

async function loadRecords() {
    try {
        var res = await adminApi.getEmergencyRecords();
        if (res.code === 200 && res.data) {
            var records = Array.isArray(res.data) ? res.data : (res.data.records || []);
            console.log('[应急] 已加载处理记录:', records.length);
            renderHistoryTable(records);
        }
    } catch (e) {
        console.warn('[应急] 加载记录失败:', e.message);
    }
}

// ===================== 动态渲染 =====================

function renderAlarmList() {
    var container = document.querySelector('.alarm-list');
    if (!container) return;

    if (alarmList.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无警报</div>';
        return;
    }

    var levelMap = {
        5: { cls: 'danger', text: '特急' },
        4: { cls: 'danger', text: '紧急' },
        3: { cls: 'warning', text: '中等' },
        2: { cls: 'warning', text: '一般' },
        1: { cls: 'normal', text: '低' },
    };

    container.innerHTML = alarmList.map(function(a) {
        var lv = levelMap[a.level] || levelMap[3];
        var timeStr = (a.createdAt || '').substring(11, 19) || '--:--:--';
        var location = a.location || '--';
        var desc = a.description || a.alarmDesc || '--';
        var patientName = a.patientName || '';
        var alarmId = a.id;
        var alarmCls = a.level >= 4 ? 'danger' : (a.level >= 2 ? 'warning' : '');
        var isProcessing = a.status === 'processing';

        var actionsHtml = '';
        if (a.status === 'pending') {
            actionsHtml = '<button class="alarm-btn primary" onclick="showPatientDetail(\'' + (patientName || '未知') + '\', \'' + alarmId + '\')">查看详情</button>'
                + '<button class="alarm-btn success" onclick="handleAlarmDirect(\'' + alarmId + '\')">立即处理</button>';
        } else if (a.status === 'processing') {
            actionsHtml = '<button class="alarm-btn primary" onclick="showPatientDetail(\'' + (patientName || '未知') + '\', \'' + alarmId + '\')">查看详情</button>'
                + '<span style="font-size:12px;color:#ff9800;">处理中...</span>';
        } else {
            actionsHtml = '<button class="alarm-btn secondary" onclick="closeAlert()">关闭</button>';
        }

        return '<div class="alarm-item ' + alarmCls + (isProcessing ? ' processing' : '') + '" id="alarm-' + alarmId + '">'
            + '<div class="alarm-info"><div class="alarm-content">'
            + '<div class="alarm-time">' + timeStr + '</div>'
            + '<div class="alarm-location">' + location + '</div>'
            + '<div class="alarm-desc">' + (patientName ? patientName + ' - ' : '') + desc + '</div>'
            + '</div></div>'
            + '<div class="alarm-actions">' + actionsHtml + '</div>'
            + '</div>';
    }).join('');

    // 更新计数
    var countEl = document.getElementById('alarmCountLabel');
    if (countEl) countEl.textContent = '共 ' + alarmList.length + ' 条警报';
}

function updateStats() {
    var pendingCount = allAlarmRecords.filter(function(a) { return a.status === 'pending'; }).length;
    var processingCount = allAlarmRecords.filter(function(a) { return a.status === 'processing'; }).length;
    var completedCount = allAlarmRecords.filter(function(a) { return a.status === 'completed' || a.status === 'ignored'; }).length;

    var statCards = document.querySelectorAll('.stats-grid .stat-card .stat-value');
    if (statCards.length >= 4) {
        statCards[0].textContent = pendingCount;
        statCards[1].textContent = processingCount;
        statCards[2].textContent = completedCount;
        statCards[3].textContent = '3.2分钟';
    }
}

function renderHistoryTable(records) {
    var tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    var typeLabels = {
        '紧急急救': '紧急急救', '生命体征异常': '生命体征异常', '排队超时': '排队超时',
        '轮椅需求': '轮椅协助', '设备维护': '设备维护', '患者摔倒': '患者摔倒',
        '导引迷路': '导引服务', '情绪激动': '情绪安抚',
        'emergency': '紧急急救', 'wheelchair': '轮椅协助', 'vital': '生命体征异常',
        'maintenance': '设备维护', 'fall': '患者摔倒', 'queue': '排队超时',
        'broadcast': '广播通知',
    };

    var recentRecords = records.slice(0, 10);
    tbody.innerHTML = recentRecords.map(function(r) {
        var timeStr = (r.handledAt || r.createdAt || '').substring(11, 19) || '--:--';
        var location = (r.location || '--').replace(/^\d+F-/, '');
        var type = typeLabels[r.type] || r.type || '--';
        var statusText;
        var statusColor;
        if (r.status === 'completed' || r.status === 'closed') {
            statusText = '已处理'; statusColor = '#4caf50';
        } else if (r.status === 'processing') {
            statusText = '处理中'; statusColor = '#ff9800';
        } else if (r.status === 'ignored') {
            statusText = '已忽略'; statusColor = '#999';
        } else {
            statusText = '待处理'; statusColor = '#f44336';
        }
        return '<tr style="border-bottom: 1px solid #f0f0f0;">'
            + '<td style="padding:10px;">' + timeStr + '</td>'
            + '<td style="padding:10px;">' + location + '</td>'
            + '<td style="padding:10px;">' + type + '</td>'
            + '<td style="padding:10px;color:' + statusColor + ';">' + statusText + '</td>'
            + '</tr>';
    }).join('');
}

// ===================== 写操作 =====================

function showPatientDetail(name, alarmId) {
    currentAlarmId = alarmId;
    var alarm = alarmList.find(function(a) { return a.id === alarmId; });
    document.getElementById('patientName').textContent = name || (alarm ? alarm.patientName : '--');

    // 更新弹窗中的其他信息
    var detailRows = document.querySelectorAll('#patientModal .info-row');
    if (alarm && detailRows.length >= 4) {
        // 更新位置
        var locEl = detailRows[3] ? detailRows[3].querySelector('.info-value') : null;
        if (locEl && alarm.location) locEl.textContent = alarm.location;
        // 更新求助类型
        var typeEl = detailRows[4] ? detailRows[4].querySelector('.info-value') : null;
        if (typeEl && alarm.type) typeEl.textContent = alarm.type;
    }

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
    if (!actionBtn || actionBtn.disabled) return;

    actionBtn.innerHTML = '处理中...';
    actionBtn.disabled = true;

    try {
        // 一步完成: 接单 + 关闭 = 直接已处理
        var res1 = await adminApi.handleAlarm(alarmId, '控制中心应急处理');
        if (res1.code === 200) {
            await adminApi.closeAlarm(alarmId);
        }

        // 1) 从实时警报列表移除（带动画）
        alarmItem.style.opacity = '0';
        alarmItem.style.transform = 'translateX(100%)';
        alarmItem.style.transition = 'all 0.4s ease';

        var alarm = alarmList.find(function(a) { return a.id === alarmId; });
        var allAlarm = allAlarmRecords.find(function(a) { return a.id === alarmId; });

        setTimeout(function() {
            if (alarmItem.parentNode) alarmItem.parentNode.removeChild(alarmItem);
            var remaining = document.querySelectorAll('.alarm-list .alarm-item').length;
            if (remaining <= 1) {
                var container = document.querySelector('.alarm-list');
                if (container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无警报</div>';
            }
        }, 400);

        // 2) 更新本地数据状态为已处理
        if (alarm) { alarm.status = 'closed'; alarm.handlerName = '值班管理员'; alarm.handleNote = '控制中心应急处理'; alarm.handledAt = new Date().toISOString().replace('T',' ').substring(0,19); }
        if (allAlarm) { allAlarm.status = 'closed'; allAlarm.handlerName = '值班管理员'; allAlarm.handleNote = '控制中心应急处理'; allAlarm.handledAt = new Date().toISOString().replace('T',' ').substring(0,19); }

        // 3) 刷新统计 & 处理记录
        updateStats();
        loadRecords();

        // 4) 更新计数标签
        var countEl = document.getElementById('alarmCountLabel');
        var pendingProcessing = alarmList.filter(function(a) { return a.status === 'pending' || a.status === 'processing'; }).length;
        if (countEl) countEl.textContent = '共 ' + pendingProcessing + ' 条警报';

        console.log('[应急] 警报已处理:', alarmId);
    } catch (e) {
        console.error('[应急] 处理警报失败:', e.message);
        alert('处理失败: ' + e.message);
        actionBtn.innerHTML = '立即处理';
        actionBtn.disabled = false;
    }
}

async function handlePatient() {
    var modalBtn = document.querySelector('#patientModal .btn.success');
    if (!modalBtn) return;
    modalBtn.innerHTML = '处理中...';
    modalBtn.disabled = true;

    try {
        // 一步完成: 接单 + 关闭 = 直接已处理
        var res = await adminApi.handleAlarm(currentAlarmId, '控制中心应急处理');
        if (res.code === 200) {
            await adminApi.closeAlarm(currentAlarmId);
        }

        modalBtn.innerHTML = '已处理';

        // 从实时警报列表移除
        if (currentAlarmId) {
            var alarmItem = document.getElementById('alarm-' + currentAlarmId);
            if (alarmItem) {
                alarmItem.style.opacity = '0';
                alarmItem.style.transform = 'translateX(100%)';
                alarmItem.style.transition = 'all 0.4s ease';
                setTimeout(function() {
                    if (alarmItem.parentNode) alarmItem.parentNode.removeChild(alarmItem);
                }, 400);
            }
            var alarm = alarmList.find(function(a) { return a.id === currentAlarmId; });
            var allAlarm = allAlarmRecords.find(function(a) { return a.id === currentAlarmId; });
            if (alarm) { alarm.status = 'closed'; alarm.handlerName = '值班管理员'; alarm.handleNote = '控制中心应急处理'; alarm.handledAt = new Date().toISOString().replace('T',' ').substring(0,19); }
            if (allAlarm) { allAlarm.status = 'closed'; allAlarm.handlerName = '值班管理员'; allAlarm.handleNote = '控制中心应急处理'; allAlarm.handledAt = new Date().toISOString().replace('T',' ').substring(0,19); }
        }

        updateStats();
        loadRecords();
        closeModal();
        console.log('[应急] 已处理警报（弹窗）:', currentAlarmId);
    } catch (e) {
        console.error('[应急] 处理失败:', e.message);
        alert('处理失败: ' + e.message);
        modalBtn.innerHTML = '立即处理';
        modalBtn.disabled = false;
    }
}

async function triagePatient() {
    var btn = document.querySelector('.alarm-btn.primary[onclick*="triagePatient"]');
    if (!btn) return;
    btn.innerHTML = '分流中...';
    btn.disabled = true;

    try {
        var dept = prompt('请输入分流目标科室名称:');
        if (!dept) { btn.innerHTML = '分流处理'; btn.disabled = false; return; }
        var res = await adminApi.triageDept(dept, 1);
        if (res.code === 200) {
            btn.innerHTML = '已分流';
            btn.style.background = '#4caf50';
            alert('分流处理完成');
        }
    } catch (e) {
        console.error('[应急] 分流失败:', e.message);
        alert('分流失败: ' + e.message);
        btn.innerHTML = '分流处理';
        btn.disabled = false;
    }
}

async function ignoreAlert() {
    try {
        await adminApi.ignoreAlarm(currentAlarmId);
        alert('已忽略此警报');
        closeModal();
        setTimeout(function() { loadAlarms(); }, 500);
    } catch (e) {
        console.error('[应急] 忽略警报失败:', e.message);
    }
}

async function postponeAlert() {
    var until = prompt('延后到何时？(格式: 2026-08-12 18:00):');
    if (!until) return;
    try {
        await adminApi.postponeAlarm(currentAlarmId, until);
        alert('已延后处理');
    } catch (e) {
        console.error('[应急] 延后警报失败:', e.message);
    }
}

async function closeAlert() {
    try {
        await adminApi.closeAlarm(currentAlarmId);
        alert('警报已关闭');
        closeModal();
        setTimeout(function() { loadAlarms(); }, 500);
    } catch (e) {
        console.error('[应急] 关闭警报失败:', e.message);
    }
}

async function assignMaintenance() {
    var note = prompt('维护说明:') || '控制中心安排维护';
    try {
        var res = await adminApi.createMaintenance(currentAlarmId, note);
        if (res.code === 200) {
            alert('已安排维护人员');
        }
    } catch (e) {
        console.error('[应急] 安排维护失败:', e.message);
        alert('安排失败: ' + e.message);
    }
}

async function emergencyBroadcast() {
    var content = prompt('请输入广播内容:');
    if (!content) return;
    try {
        var res = await adminApi.broadcastEmergency(content);
        if (res.code === 200) {
            alert('紧急广播已发送');
        }
    } catch (e) {
        console.error('[应急] 广播失败:', e.message);
        alert('广播失败: ' + e.message);
    }
}

async function exportRecords(evt) {
    var btn = (evt && evt.target) || document.querySelector('#exportRecordsBtn');
    if (!btn) { console.error('[应急] 导出按钮未找到'); return; }
    btn.innerHTML = '导出中...';
    btn.disabled = true;
    try {
        var result = await adminApi.exportEmergencyRecords();
        var blob = result instanceof Blob ? result : (result instanceof Response ? await result.blob() : new Blob([JSON.stringify(result)], { type: 'text/csv' }));
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'emergency_records.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        alert('记录导出成功');
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
