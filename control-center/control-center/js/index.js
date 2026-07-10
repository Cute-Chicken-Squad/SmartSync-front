setInterval(() => {
    const date = new Date();
    const timeString = date.toISOString().replace('T', ' ').substring(0, 19);
    document.getElementById('dateInfo').textContent = timeString;
}, 1000);

function refreshData() {
    const btn = document.querySelector('.refresh-btn');
    btn.innerHTML = '刷新中...';
    setTimeout(() => {
        btn.innerHTML = '刷新';
        updateAlarmStatus();
        alert('数据已刷新');
    }, 1000);
}

function updateAlarmStatus() {
    const alarmCard = document.getElementById('alarmCard');
    const alarmValue = document.getElementById('alarmValue');
    const alarmStatus = document.getElementById('alarmStatus');

    const count = parseInt(alarmValue.textContent);

    if (count === 0) {
        alarmCard.classList.remove('alarm');
        alarmStatus.textContent = '正常';
        alarmStatus.className = 'kpi-change positive';
    } else {
        alarmCard.classList.add('alarm');
        alarmStatus.innerHTML = '<span>!</span>待处理';
        alarmStatus.className = 'kpi-change danger';
    }
}

function handleAlarm(id, event) {
    event.stopPropagation();
    const btn = event.target;
    btn.innerHTML = '处理中...';
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = '已处理';
        btn.style.background = '#4caf50';
        alert('警报已处理');
    }, 800);
}

window.addEventListener('load', function () {
    updateAlarmStatus();
    const alarmBtns = document.querySelectorAll('.alarm-btn');
    alarmBtns.forEach((btn, index) => {
        btn.addEventListener('click', (event) => handleAlarm(index, event));
    });
});