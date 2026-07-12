function simulateRingDetection() {
    showTouchHint('正在感应手环...');
    setTimeout(() => {
        showTouchHint('手环识别成功');
        setTimeout(() => {
            showPage('overview');
        }, 1000);
    }, 2000);
}

function toggleSeniorMode() {
    const container = document.querySelector('.container');
    const toggle = document.getElementById('seniorModeToggle');

    if (toggle.checked) {
        container.classList.add('senior-friendly');
        showTouchHint('适老化模式已开启');
    } else {
        container.classList.remove('senior-friendly');
        showTouchHint('适老化模式已关闭');
    }
}

function exportReport() {
    showTouchHint('正在生成报告...');
    setTimeout(() => {
        showTouchHint('报告生成成功，正在下载...');
        setTimeout(() => {
            showTouchHint('报告已下载到本地');
        }, 1000);
    }, 2000);
}

window.simulateRingDetection = simulateRingDetection;
window.toggleSeniorMode = toggleSeniorMode;
window.exportReport = exportReport;