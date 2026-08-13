/**
 * 智环引诊 - 子站终端模拟器页面逻辑
 * 对接后端: /api/substation/*
 * 数据写入: detect, voice, task/confirm
 */

const STATION_ID = 'A-08'; // 当前子站 ID

let currentState = 'idle';
let currentPatient = null;
let isRecording = false;
let recognitionTimer = null;

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', function () {
    updateClock();
    setInterval(updateClock, 1000);
    initStation();
});

function initStation() {
    // ★ 加载子站状态
    loadStationStatus();
    startAutoDemo();
}

async function loadStationStatus() {
    try {
        const res = await businessApi.substationStatus(STATION_ID);
        if (res.code === 200 && res.data) {
            console.log('[子站] 终端状态已加载:', res.data);
            if (res.data.location) {
                document.getElementById('stationLocation').textContent = res.data.location;
            }
        }
    } catch (e) {
        console.warn('[子站] 加载状态失败:', e.message);
    }
}

// ===================== 写操作 (API) =====================

/** 模拟手环靠近 → POST /api/substation/detect */
async function simulateBraceletTap() {
    if (currentState !== 'idle') return;
    switchState('reading');

    try {
        // ★ 调用后端 NFC 检测接口
        const res = await businessApi.substationDetect(STATION_ID, 'SIMULATED_NFC_ID');
        if (res.code === 200 && res.data) {
            currentPatient = {
                patientId: res.data.patientId || null,
                name: res.data.patientName || '未知患者',
                maskedId: res.data.maskedId || 'PAT-UNKNOWN',
                dept: res.data.dept || '',
                currentTask: res.data.currentTask || res.data.nextTask || '',
                nextTask: res.data.nextTask || res.data.destination || '',
                eta: res.data.eta || '2 分钟',
                taskQueue: [],
                stationId: STATION_ID,
                stationLocation: res.data.location || document.getElementById('stationLocation').textContent,
            };
            localStorage.setItem('currentSubStationPatient', JSON.stringify(currentPatient));
        }
    } catch (e) {
        console.warn('[子站] API 检测失败，使用本地会话:', e.message);
        // 降级：从 localStorage 读取
        currentPatient = loadCurrentPatient();
    }

    setTimeout(() => {
        if (!currentPatient) currentPatient = loadCurrentPatient();
        displayPatientTask(currentPatient);
        switchState('task');
    }, 800);
}

/** 语音识别 → POST /api/substation/voice */
async function startVoiceRecognition() {
    if (isRecording) return;
    isRecording = true;
    const micBtn = document.getElementById('micBtn');
    const voiceWave = document.getElementById('voiceWave');
    const voiceHint = document.getElementById('voiceHint');
    const recognizedText = document.getElementById('recognizedText');

    micBtn.classList.add('recording');
    voiceHint.innerHTML = '<span class="voice-icon"></span><span>正在聆听...</span>';
    voiceWave.classList.remove('hidden');

    // 模拟语音识别过程（实际应使用 Web Speech API）
    recognitionTimer = setTimeout(async () => {
        const simulatedText = '我想去洗手间';
        recognizedText.textContent = '"' + simulatedText + '"';
        recognizedText.classList.remove('hidden');
        voiceWave.classList.add('hidden');
        voiceHint.innerHTML = '<span class="voice-icon"></span><span>识别成功</span>';

        // ★ 发送语音文本到后端
        try {
            const res = await businessApi.substationVoice(STATION_ID, simulatedText);
            if (res.code === 200 && res.data) {
                console.log('[子站] 语音已处理:', res.data);
                if (res.data.reply) {
                    // 可以展示 AI 回复
                }
            }
        } catch (e) {
            console.warn('[子站] 语音 API 调用失败:', e.message);
        }

        setTimeout(() => {
            stopRecording();
            showConfirm();
        }, 800);
    }, 2500);
}

function toggleMic() {
    if (!isRecording) startVoiceRecognition();
    else stopRecording();
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

/** 确认/取消 → PUT /api/substation/task/confirm */
async function respondConfirm(confirmed) {
    if (confirmed) {
        const oldTask = currentPatient.nextTask;
        const newTask = '洗手间';

        // ★ 通知后端确认任务变更
        try {
            await businessApi.substationTaskConfirm(currentPatient.maskedId, true);
            console.log('[子站] 任务确认已发送到后端');
        } catch (e) {
            console.warn('[子站] 任务确认 API 失败:', e.message);
        }

        // 通知总站（localStorage 事件 + 后续可由 WebSocket 替代）
        notifyControlCenter({
            type: 'INSERT_TASK',
            patientId: currentPatient.maskedId,
            patientName: currentPatient.name,
            stationId: STATION_ID,
            stationLocation: currentPatient.stationLocation,
            oldTask: oldTask,
            newTask: newTask,
            timestamp: new Date().toISOString()
        });

        currentPatient.nextTask = newTask;
        currentPatient.eta = '1 分钟';
        localStorage.setItem('currentSubStationPatient', JSON.stringify(currentPatient));

        document.getElementById('updatedDest').textContent = newTask;
        switchState('updated');

        setTimeout(() => {
            displayPatientTask(currentPatient);
            const nextTask = document.getElementById('nextTask');
            nextTask.classList.add('updated');
            switchState('task');
        }, 4000);
    } else {
        switchState('task');
    }
}

// ===================== UI 辅助函数 =====================

function loadCurrentPatient() {
    const data = localStorage.getItem('currentSubStationPatient');
    if (data) return JSON.parse(data);
    return {
        name: '王大爷', maskedId: 'PAT-7A3B-9C2D', dept: '心内科',
        currentTask: '前往内科', nextTask: '内科', eta: '2 分钟',
        taskQueue: ['前往内科', '内科问诊', '心电图检查', '缴费结算'],
        stationId: STATION_ID, stationLocation: '1F-电梯厅'
    };
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toTimeString().substring(0, 8);
}

function switchState(state) {
    currentState = state;
    document.querySelectorAll('.state-panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(state + 'Panel');
    if (target) target.classList.add('active');
}

function displayPatientTask(patient) {
    document.getElementById('patientName').textContent = patient.name;
    document.getElementById('patientMaskedId').textContent = patient.maskedId;
    document.getElementById('patientDept').textContent = patient.dept;
    document.getElementById('patientAvatar').textContent = patient.name.charAt(0);
    document.getElementById('directionDest').textContent = patient.nextTask;
    document.getElementById('etaValue').textContent = patient.eta;
    document.getElementById('stationLocation').textContent = patient.stationLocation;
    const nextTask = document.getElementById('nextTask');
    nextTask.classList.remove('updated');
    document.getElementById('recognizedText').classList.add('hidden');
    document.getElementById('voiceWave').classList.add('hidden');
    document.getElementById('voiceHint').innerHTML = '<span class="voice-icon"></span><span>点击麦克风说话</span>';
}

function showConfirm() {
    document.getElementById('confirmTitle').textContent = '是否确认前往洗手间？';
    switchState('confirm');
}

function notifyControlCenter(event) {
    const events = JSON.parse(localStorage.getItem('controlCenterEvents') || '[]');
    events.unshift(event);
    if (events.length > 50) events.pop();
    localStorage.setItem('controlCenterEvents', JSON.stringify(events));
    window.dispatchEvent(new StorageEvent('storage', { key: 'controlCenterEvents', newValue: JSON.stringify(events) }));
}

function startAutoDemo() {
    setTimeout(() => { if (currentState === 'idle') simulateBraceletTap(); }, 3000);
}

function manualTrigger() { simulateBraceletTap(); }

window.addEventListener('blur', () => { if (isRecording) stopRecording(); });

// ===================== 紧急求助（写操作 → 后端 → 总站弹窗） =====================

/**
 * BigInt 安全获取一个精确的 patientId 字符串。
 * patientId 是 19 位数字，超出 JS Number.MAX_SAFE_INTEGER，JSON.parse 会舍入导致后端 404。
 * 后端接受字符串形式的 patientId，故从原始响应文本提取精确 id。
 */
async function getExactPatientId() {
    try {
        const token = TokenStore.getPatientToken() || TokenStore.getBizToken();
        const resp = await fetch('/api/patient/page?current=1&size=1', {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {},
        });
        const text = await resp.text();
        const m = text.match(/"records":\[\{"id":(\d{15,20})/);
        return m ? m[1] : null;
    } catch (e) {
        console.warn('[子站] 获取精确 patientId 失败:', e.message);
        return null;
    }
}

/**
 * 子站点击紧急求助 → POST /api/emergency → 总站 SSE 实时检测到新警报并弹窗
 */
async function sendEmergencyHelp() {
    const btn = document.getElementById('sosBtn');
    if (!btn) return;
    if (btn.disabled) return; // 防重复点击

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="sos-icon">⏳</span><span>发送中</span>';

    try {
        // 0) 确保认证就绪（管理端 token + 业务端终端 token，否则写操作会 401）
        await ensureAuth();

        // 1) 精确获取 patientId（BigInt 安全，字符串形式；后端要求必填）
        const patientId = await getExactPatientId();

        const location = (currentPatient && currentPatient.stationLocation)
            || document.getElementById('stationLocation').textContent
            || '1F-电梯厅';

        // 3) 真实写入后端
        const res = await businessApi.sendEmergency({
            patientId: patientId,
            location: location,
            type: 'emergency',
            description: '子站发起紧急求助',
        });

        console.log('[子站] 紧急求助已发送:', res);

        // 4) 本地广播（同机多标签页即时联动，双保险）
        notifyControlCenter({
            type: 'EMERGENCY_ALARM',
            patientId: patientId,
            patientName: (currentPatient && currentPatient.name) || '未知患者',
            location: location,
            stationId: STATION_ID,
            timestamp: new Date().toISOString(),
        });

        // 5) UI 反馈
        if (res && res.code === 200) {
            btn.innerHTML = '<span class="sos-icon">✓</span><span>已发送</span>';
            setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 2500);
        } else {
            throw new Error((res && res.message) || '后端返回异常');
        }
    } catch (e) {
        console.error('[子站] 紧急求助发送失败:', e.message);
        // 即使后端失败，也通过 localStorage 通知总站（演示兜底）
        notifyControlCenter({
            type: 'EMERGENCY_ALARM',
            patientName: (currentPatient && currentPatient.name) || '未知患者',
            location: document.getElementById('stationLocation').textContent || '1F-电梯厅',
            stationId: STATION_ID,
            timestamp: new Date().toISOString(),
            fallback: true,
        });
        btn.innerHTML = '<span class="sos-icon">!</span><span>重试</span>';
        setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 2000);
        alert('求助发送失败：' + e.message);
    }
}
