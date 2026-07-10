function saveSettings() {
    const btn = event.target;
    btn.innerHTML = '保存中...';
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = '保存设置';
        btn.disabled = false;
        alert('设置已保存！');
    }, 1000);
}

function restoreDefaults() {
    if (confirm('确定要恢复默认设置吗？')) {
        const btn = event.target;
        btn.innerHTML = '恢复中...';
        btn.disabled = true;
        setTimeout(() => {
            btn.innerHTML = '恢复默认';
            btn.disabled = false;
            alert('已恢复默认设置！');
        }, 1000);
    }
}

function addSubstation() {
    alert('添加子站功能已触发');
}

function restartServer(name) {
    if (confirm(`确定要重启 ${name} 吗？`)) {
        const btn = event.target;
        btn.innerHTML = '重启中...';
        btn.disabled = true;
        setTimeout(() => {
            btn.innerHTML = '重启';
            btn.disabled = false;
            alert(`${name} 已重启！`);
        }, 2000);
    }
}

function editServer(name) {
    alert(`编辑 ${name} 功能已触发`);
}

function deleteServer(name) {
    if (confirm(`确定要删除 ${name} 吗？此操作不可恢复！`)) {
        const btn = event.target;
        btn.innerHTML = '删除中...';
        btn.disabled = true;
        setTimeout(() => {
            btn.parentElement.parentElement.remove();
            alert(`${name} 已删除！`);
        }, 1000);
    }
}

function backupNow() {
    const btn = event.target;
    btn.innerHTML = '备份中...';
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = '立即备份';
        btn.disabled = false;
        alert('备份成功！');
    }, 2000);
}

function restoreBackup() {
    if (confirm('确定要恢复备份吗？这将覆盖当前数据！')) {
        const btn = event.target;
        btn.innerHTML = '恢复中...';
        btn.disabled = true;
        setTimeout(() => {
            btn.innerHTML = '恢复备份';
            btn.disabled = false;
            alert('备份恢复成功！');
        }, 2000);
    }
}

window.addEventListener('load', function() {
    document.querySelector('.btn.success').addEventListener('click', saveSettings);
    document.querySelector('.btn.danger').addEventListener('click', restoreDefaults);
    
    document.querySelector('.table-container + .btn').addEventListener('click', addSubstation);
    
    const tableBtns = document.querySelectorAll('.btn-sm');
    tableBtns.forEach(btn => {
        if (btn.textContent === '重启') {
            btn.addEventListener('click', function() {
                const name = this.parentElement.parentElement.querySelector('td:first-child').textContent;
                restartServer(name);
            });
        } else if (btn.textContent === '编辑') {
            btn.addEventListener('click', function() {
                const name = this.parentElement.parentElement.querySelector('td:first-child').textContent;
                editServer(name);
            });
        } else if (btn.classList.contains('danger') || btn.textContent === '删除') {
            btn.addEventListener('click', function() {
                const name = this.parentElement.parentElement.querySelector('td:first-child').textContent;
                deleteServer(name);
            });
        }
    });
    
    const backupBtns = document.querySelectorAll('.backup-section .btn');
    backupBtns.forEach(btn => {
        if (btn.textContent.includes('备份')) {
            btn.addEventListener('click', backupNow);
        } else if (btn.textContent.includes('恢复')) {
            btn.addEventListener('click', restoreBackup);
        }
    });
});