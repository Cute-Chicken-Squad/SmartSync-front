// 子站逻辑 - 患者交互

// 全局状态
let currentState = 'idle'; // idle | reading | task | confirm | updated
let currentPatient = null;
let isRecording = false;
let recognitionTimer = null;

// 模拟患者数据（从localStorage读取，无则使用默认）
function loadCurrentPatient() {
    const data = localStorage.getItem('currentSubStationPatient');
    if (data) {
        return JSON.parse(data);
    }
    return {
        name: '王大爷',
        maskedId: 'PAT-7A3B-9C2D',
        dept: '心内科',
        currentTask: '前往内科',
        nextTask: '内科',
        eta: '2 分钟',
        taskQueue: ['前往内科', '内科问诊', '心电图检查', '缴费结算'],
        stationId: 'A-08',
        stationLocation: '1F-电梯厅'
    };
}

// 模拟触发：5秒后自动进入识别状态模拟患者靠近
function initStation() {
    updateClock();
    setInterval(updateClock, 1000);

    // 自动演示模式：每15秒演示一次完整流程
    startAutoDemo();
}

// 时钟更新
function updateClock() {
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 8);
    document.getElementById('clock').textContent = timeStr;
}

// 切换状态面板
function switchState(state) {
    currentState = state;
    document.querySelectorAll('.state-panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(state + 'Panel');
    if (target) {
        target.classList.add('active');
    }
}

// 模拟手环靠近（开始识别）
function simulateBraceletTap() {
    if (currentState !== 'idle') return;

    switchState('reading');

    setTimeout(() => {
        currentPatient = loadCurrentPatient();
        displayPatientTask(currentPatient);
        switchState('task');
    }, 1500);
}

// 显示患者任务
function displayPatientTask(patient) {
    document.getElementById('patientName').textContent = patient.name;
    document.getElementById('patientMaskedId').textContent = patient.maskedId;
    document.getElementById('patientDept').textContent = patient.dept;
    document.getElementById('patientAvatar').textContent = patient.name.charAt(0);
    document.getElementById('directionDest').textContent = patient.nextTask;
    document.getElementById('etaValue').textContent = patient.eta;
    document.getElementById('stationLocation').textContent = patient.stationLocation;

    // 重置任务卡片样式
    const nextTask = document.getElementById('nextTask');
    nextTask.classList.remove('updated');

    // 重置语音输入
    document.getElementById('recognizedText').classList.add('hidden');
    document.getElementById('voiceWave').classList.add('hidden');
    document.getElementById('voiceHint').innerHTML = '<span class="voice-icon"></span><span>点击麦克风说话</span>';
}

// 切换语音输入
function toggleMic() {
    const micBtn = document.getElementById('micBtn');
    const voiceWave = document.getElementById('voiceWave');
    const voiceHint = document.getElementById('voiceHint');
    const recognizedText = document.getElementById('recognizedText');

    if (!isRecording) {
        isRecording = true;
        micBtn.classList.add('recording');
        voiceHint.innerHTML = '<span class="voice-icon"></span><span>正在聆听...</span>';
        voiceWave.classList.remove('hidden');

        // 模拟语音识别：2.5秒后识别出"我想去洗手间"
        recognitionTimer = setTimeout(() => {
            recognizedText.textContent = '"我想去洗手间"';
            recognizedText.classList.remove('hidden');
            voiceWave.classList.add('hidden');
            voiceHint.innerHTML = '<span class="voice-icon"></span><span>识别成功</span>';

            // 0.8秒后弹出确认窗口
            setTimeout(() => {
                stopRecording();
                showConfirm();
            }, 800);
        }, 2500);
    } else {
        stopRecording();
    }
}

function stopRecording() {
    isRecording = false;
    document.getElementById('micBtn').classList.remove('recording');
    document.getElementById('voiceWave').classList.add('hidden');
    if (recognitionTimer) {
        clearTimeout(recognitionTimer);
        recognitionTimer = null;
    }
}

// 显示确认弹窗
function showConfirm() {
    document.getElementById('confirmTitle').textContent = '是否确认前往洗手间？';
    switchState('confirm');
}

// 确认/取消响应
function respondConfirm(confirmed) {
    if (confirmed) {
        // 更新任务：插入新任务"前往洗手间"
        const oldTask = currentPatient.nextTask;
        const newTask = '洗手间';

        // 通知总站：插入新任务
        notifyControlCenter({
            type: 'INSERT_TASK',
            patientId: currentPatient.maskedId,
            patientName: currentPatient.name,
            stationId: 'A-08',
            stationLocation: currentPatient.stationLocation,
            oldTask: oldTask,
            newTask: newTask,
            timestamp: new Date().toISOString()
        });

        // 更新本地数据
        currentPatient.nextTask = newTask;
        currentPatient.eta = '1 分钟';
        localStorage.setItem('currentSubStationPatient', JSON.stringify(currentPatient));

        // 显示已更新状态
        document.getElementById('updatedDest').textContent = newTask;
        switchState('updated');

        // 4秒后返回任务展示
        setTimeout(() => {
            displayPatientTask(currentPatient);
            const nextTask = document.getElementById('nextTask');
            nextTask.classList.add('updated');
            switchState('task');
        }, 4000);
    } else {
        // 取消：保持原任务
        switchState('task');
    }
}

// 通知总站（通过 localStorage 事件）
function notifyControlCenter(event) {
    const events = JSON.parse(localStorage.getItem('controlCenterEvents') || '[]');
    events.unshift(event);
    // 只保留最近50条
    if (events.length > 50) events.pop();
    localStorage.setItem('controlCenterEvents', JSON.stringify(events));

    // 触发storage事件（同窗口内的页面需要手动dispatch）
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'controlCenterEvents',
        newValue: JSON.stringify(events)
    }));
}

// 自动演示模式
function startAutoDemo() {
    // 首次进入3秒后模拟患者靠近
    setTimeout(() => {
        if (currentState === 'idle') {
            simulateBraceletTap();
        }
    }, 3000);
}

// 手动触发识别（用于调试）
function manualTrigger() {
    simulateBraceletTap();
}

// 初始化
document.addEventListener('DOMContentLoaded', initStation);

// 页面失焦时重置语音状态
window.addEventListener('blur', () => {
    if (isRecording) stopRecording();
});