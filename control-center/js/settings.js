/**
 * 智环引诊 - 系统设置页面逻辑
 * 对接后端: /admin/api/settings/*
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    await loadSettings();
    await loadSubstations();

    // 绑定按钮事件
    const saveBtn = document.querySelector('.btn.success');
    const restoreBtn = document.querySelector('.btn.danger');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    if (restoreBtn) restoreBtn.addEventListener('click', restoreDefaults);

    // 子站操作按钮
    document.querySelectorAll('.btn-sm').forEach(btn => {
        const row = btn.closest('tr');
        if (!row) return;
        const nameCell = row.querySelector('td:first-child');
        const name = nameCell ? nameCell.textContent.trim() : '';
        if (btn.textContent.includes('重启')) {
            btn.addEventListener('click', () => restartServer(name));
        } else if (btn.textContent.includes('删除')) {
            btn.addEventListener('click', () => deleteServer(name));
        }
    });

    // 备份/恢复按钮
    const backupBtns = document.querySelectorAll('.backup-section .btn');
    backupBtns.forEach(btn => {
        if (btn.textContent.includes('备份')) btn.addEventListener('click', backupNow);
        else if (btn.textContent.includes('恢复')) btn.addEventListener('click', restoreBackup);
    });

    // 添加子站按钮
    const addBtn = document.querySelector('.table-container + .btn');
    if (addBtn) addBtn.addEventListener('click', addSubstation);
});

// ===================== 数据加载 =====================

async function loadSettings() {
    try {
        const res = await adminApi.getSettings();
        if (res.code === 200 && res.data) {
            console.log('[设置] 已加载系统设置');
            // 如果有 settings 表单，填充数据
            const groups = res.data.groups || [];
            groups.forEach(group => {
                (group.items || []).forEach(item => {
                    const el = document.querySelector(`[data-key="${item.settingKey}"]`);
                    if (el) el.value = item.settingValue;
                });
            });
        }
    } catch (e) {
        console.warn('[设置] 加载设置失败，使用默认值:', e.message);
    }
}

async function loadSubstations() {
    try {
        const res = await adminApi.getSubstations({ current: 1, size: 50 });
        if (res.code === 200 && res.data) {
            console.log('[设置] 已加载子站列表:', res.data.records?.length || 0);
            renderSubstationTable(res.data.records || []);
        }
    } catch (e) {
        console.warn('[设置] 加载子站列表失败:', e.message);
    }
}

function renderSubstationTable(records) {
    const tbody = document.querySelector('.table-container tbody');
    if (!tbody) return;

    tbody.innerHTML = records.map(r => `
        <tr>
            <td>${r.terminalCode || r.name || ''}</td>
            <td>${r.terminalName || r.location || ''}</td>
            <td><span class="status-badge ${r.status === 1 || r.status === 'online' ? 'active' : 'inactive'}">${r.status === 1 || r.status === 'online' ? '在线' : '离线'}</span></td>
            <td>${r.createdAt || r.updatedAt || ''}</td>
            <td>
                <button class="btn-sm" onclick="restartServer('${r.terminalCode || r.name}')">重启</button>
                <button class="btn-sm" style="background:#f44336;color:#fff;" onclick="deleteServer('${r.terminalCode || r.name}')">删除</button>
            </td>
        </tr>
    `).join('');
}

// ===================== 写操作 =====================

async function saveSettings() {
    const btn = event.target;
    btn.innerHTML = '保存中...';
    btn.disabled = true;
    try {
        // 收集表单数据
        const inputs = document.querySelectorAll('.settings-form input, .settings-form select');
        const items = [];
        inputs.forEach(input => {
            if (input.dataset.key) {
                items.push({ settingKey: input.dataset.key, settingValue: input.value });
            }
        });
        const res = await adminApi.saveSettings({ items });
        if (res.code === 200) {
            alert('设置已保存到后端 ✅');
            console.log('[设置] 保存成功');
        } else {
            throw new Error(res.message || '保存失败');
        }
    } catch (e) {
        console.error('[设置] 保存失败:', e.message);
        alert('保存失败: ' + e.message);
    } finally {
        btn.innerHTML = '保存设置';
        btn.disabled = false;
    }
}

async function restoreDefaults() {
    if (!confirm('确定要恢复默认设置吗？')) return;
    const btn = event.target;
    btn.innerHTML = '恢复中...';
    btn.disabled = true;
    try {
        const res = await adminApi.resetSettings();
        if (res.code === 200) {
            alert('已恢复默认设置 ✅');
            await loadSettings();
        }
    } catch (e) {
        console.error('[设置] 恢复默认失败:', e.message);
        alert('恢复失败: ' + e.message);
    } finally {
        btn.innerHTML = '恢复默认';
        btn.disabled = false;
    }
}

async function addSubstation() {
    const code = prompt('请输入子站编码 (如 SUB-2F-03):');
    if (!code) return;
    const name = prompt('请输入子站名称 (如 2F-心内科):');
    if (!name) return;
    const key = prompt('请输入通信密钥 (留空自动生成):') || generateKey();
    const mapNodeCode = prompt('请输入关联地图节点编码 (如 MAP-2F-03):');
    if (!mapNodeCode) return;

    try {
        const res = await adminApi.addSubstation({ terminalCode: code, terminalName: name, secretKey: key, mapNodeCode, status: 1 });
        if (res.code === 200) {
            alert(`子站 ${name} 已添加 ✅`);
            await loadSubstations();
        } else {
            throw new Error(res.message || '添加失败');
        }
    } catch (e) {
        console.error('[设置] 添加子站失败:', e.message);
        alert('添加失败: ' + e.message);
    }
}

async function restartServer(name) {
    if (!confirm(`确定要重启 ${name} 吗？`)) return;
    const btn = event.target;
    btn.innerHTML = '重启中...';
    btn.disabled = true;
    try {
        const res = await adminApi.restartSubstation(name);
        if (res.code === 200) {
            alert(`${name} 重启指令已发送 ✅`);
        }
    } catch (e) {
        console.error('[设置] 重启失败:', e.message);
        alert('重启失败: ' + e.message);
    } finally {
        btn.innerHTML = '重启';
        btn.disabled = false;
    }
}

async function deleteServer(name) {
    if (!confirm(`确定要删除 ${name} 吗？此操作不可恢复！`)) return;
    const btn = event.target;
    btn.innerHTML = '删除中...';
    btn.disabled = true;
    try {
        const res = await adminApi.deleteSubstation(name);
        if (res.code === 200) {
            alert(`${name} 已删除 ✅`);
            await loadSubstations();
        }
    } catch (e) {
        console.error('[设置] 删除失败:', e.message);
        alert('删除失败: ' + e.message);
    } finally {
        btn.innerHTML = '删除';
        btn.disabled = false;
    }
}

async function backupNow() {
    const btn = event.target;
    btn.innerHTML = '备份中...';
    btn.disabled = true;
    try {
        const res = await adminApi.backupNow();
        if (res.code === 200) {
            const time = new Date().toLocaleString();
            alert(`备份成功 ✅ (${time})`);
        }
    } catch (e) {
        console.error('[设置] 备份失败:', e.message);
        alert('备份失败: ' + e.message);
    } finally {
        btn.innerHTML = '立即备份';
        btn.disabled = false;
    }
}

async function restoreBackup() {
    if (!confirm('确定要恢复备份吗？这将覆盖当前数据！')) return;
    const btn = event.target;
    btn.innerHTML = '恢复中...';
    btn.disabled = true;
    try {
        // 先从 settings 数据中获取可用的 backupId
        const res = await adminApi.getSettings();
        const backups = res.data?.backups || [];
        if (backups.length === 0) {
            alert('没有可用的备份');
            btn.innerHTML = '恢复备份';
            btn.disabled = false;
            return;
        }
        const latestBackup = backups[0];
        const restoreRes = await adminApi.restoreBackup(latestBackup.id);
        if (restoreRes.code === 200) {
            alert('备份恢复成功 ✅');
            await loadSettings();
        }
    } catch (e) {
        console.error('[设置] 恢复备份失败:', e.message);
        alert('恢复失败: ' + e.message);
    } finally {
        btn.innerHTML = '恢复备份';
        btn.disabled = false;
    }
}

// ===================== 工具函数 =====================

function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
}
