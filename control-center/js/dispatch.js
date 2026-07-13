/**
 * 智环引诊 - 调度管理页面逻辑
 * 对接后端: /admin/api/dispatch/*
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        var date = new Date();
        var timeString = date.toISOString().replace('T', ' ').substring(0, 19);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // ★ 加载数据
    await loadDeptLoad();
    await loadSuggestions();
});

// ===================== 数据加载 =====================

async function loadDeptLoad() {
    try {
        const res = await adminApi.getDispatchDeptLoad();
        if (res.code === 200 && res.data) {
            console.log('[调度] 已加载科室负载:', res.data.length || 0);
        }
    } catch (e) {
        console.warn('[调度] 加载科室负载失败:', e.message);
    }
}

async function loadSuggestions() {
    try {
        const res = await adminApi.getSuggestions();
        if (res.code === 200 && res.data) {
            console.log('[调度] 已加载调度建议:', res.data.length || 0);
        }
    } catch (e) {
        console.warn('[调度] 加载调度建议失败:', e.message);
    }
}

// ===================== 写操作 =====================

async function executeTriage() {
    var btn = document.getElementById('mainTriageBtn') || event.target;
    btn.innerHTML = '执行中...';
    btn.disabled = true;

    try {
        // 从界面收集调度数据
        var fromDept = prompt('源科室 ID:') || '1';
        var toDept = prompt('目标科室 ID:') || '2';
        var count = parseInt(prompt('分流人数:') || '2');

        const res = await adminApi.executeDispatch({
            fromDeptId: fromDept,
            toDeptId: toDept,
            patientCount: count,
            reason: '控制中心手动分流',
        });
        if (res.code === 200) {
            alert('分流执行成功 ✅');
            await loadDeptLoad();
        }
    } catch (e) {
        console.error('[调度] 执行分流失败:', e.message);
        alert('执行失败: ' + e.message);
    } finally {
        btn.innerHTML = '执行分流';
        btn.disabled = false;
    }
}

async function triageDepartment(deptName) {
    var btn = event.target || document.activeElement;
    btn.innerHTML = '分流中...';
    btn.disabled = true;

    try {
        var count = parseInt(prompt(`从 ${deptName} 分流多少人?`, '2'));
        if (isNaN(count) || count < 1) { btn.innerHTML = '分流'; btn.disabled = false; return; }

        const res = await adminApi.triageDept(deptName, count);
        if (res.code === 200) {
            btn.innerHTML = '已分流';
            btn.style.background = '#4caf50';
            alert(`${deptName} 分流处理完成 ✅`);
            await loadDeptLoad();
        }
    } catch (e) {
        console.error('[调度] 分流失败:', e.message);
        alert('分流失败: ' + e.message);
        btn.innerHTML = '分流';
        btn.disabled = false;
    }
}

async function exportReport() {
    var btn = document.getElementById('exportBtn') || event.target;
    btn.innerHTML = '导出中...';
    btn.disabled = true;

    try {
        const blob = await adminApi.exportDispatchReport();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dispatch_report.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        alert('报表导出成功 ✅');
    } catch (e) {
        console.error('[调度] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        btn.innerHTML = '导出报表';
        btn.disabled = false;
    }
}

function viewDetail(deptName) {
    window.location.href = 'queue-detail.html?dept=' + encodeURIComponent(deptName);
}
