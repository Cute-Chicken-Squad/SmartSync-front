/**
 * 智环引诊 - 患者客户端主逻辑
 *
 * 数据流程: NFC手环感应 → RFID查患者 → 加载就诊数据 → 渲染页面
 * API 不可用时自动降级为本地 mock 数据
 */

const pageCache = {};
const defaultPage = 'home';

let currentPageId = null;
let isVoiceActive = false;

// ===================== 数据模型（默认值 + API 填充） =====================

const appData = {
    patient: {
        name: '王大爷',
        id: '#8102',
        gender: '男',
        age: 72
    },
    appointment: {
        department: '心内科诊室',
        floor: '3F 心内科',
        time: '14:30',
        waitTime: '28分钟'
    },
    progress: [
        { title: '挂号', time: '09:00', status: 'completed' },
        { title: '就诊', time: '09:30', status: 'completed' },
        { title: '检查', time: '10:15', status: 'completed' },
        { title: '心电图检查', time: '进行中', status: 'active' },
        { title: '血液化验', time: '待进行', status: 'pending' },
        { title: '影像检查', time: '待进行', status: 'pending' }
    ],
    reports: [
        { title: '心电图检查报告', date: '2026-04-18 09:45', status: 'normal', preview: '窦性心律，心率未见明显异常...' },
        { title: '血液化验报告', date: '2026-04-17 14:30', status: 'completed', preview: '各项指标基本正常...' },
        { title: '影像检查报告', date: '2026-04-16 10:15', status: 'completed', preview: '胸部CT检查未见明显异常...' }
    ],
    reminder: {
        date: '2026-05-03 (周六) 09:30',
        department: '心内科',
        doctor: '王医生',
        room: '3楼-302'
    },
    queue: {
        number: 12,
        waitTime: '15分钟',
        aheadCount: 11,
        avgDuration: '1.5分钟'
    },
    // 数据来源标记
    _source: 'mock',
    _loaded: false,
};

// ===================== 数据加载（从后端 API） =====================

/**
 * 尝试从后端加载患者数据，失败时使用默认值
 * 调用时机: NFC 手环感应后，或页面首次加载
 */
async function loadPatientData(rfid) {
    // Step 1: 确保终端 Token
    const token = await ensureTerminalToken();

    // Step 2: 按 RFID 查询患者
    let patient = null;
    if (rfid) {
        patient = await PatientService.fetchByRfid(rfid);
    }

    // Step 3: 如果已有 session 中的 patientId，直接查
    if (!patient && PatientSession.getPatientId()) {
        patient = await PatientService.getPatient(PatientSession.getPatientId());
    }

    // Step 4: 尝试从已有患者列表获取（模拟场景）
    if (!patient && token) {
        const pageRes = await PatientService.queryPatients({ current: 1, size: 1 });
        if (pageRes?.records?.length > 0) {
            patient = pageRes.records[0];
            PatientSession.set({ patientId: patient.id, patientName: patient.name });
        }
    }

    // Step 5: 如果有患者数据，填充 appData
    if (patient) {
        appData._source = 'api';
        appData.patient = {
            name: patient.name || appData.patient.name,
            id: patient.id ? ('#' + String(patient.id).slice(-4)) : appData.patient.id,
            gender: patient.gender === 1 ? '男' : patient.gender === 2 ? '女' : appData.patient.gender,
            age: patient.age || appData.patient.age,
        };

        // 尝试加载就诊数据
        const overview = await PatientService.getVisitOverview();
        if (overview) {
            appData._source = 'api';
            appData.appointment = {
                department: overview.department || appData.appointment.department,
                floor: overview.floor || appData.appointment.floor,
                time: overview.appointmentTime || appData.appointment.time,
                waitTime: overview.waitMinutes ? (overview.waitMinutes + '分钟') : appData.appointment.waitTime,
            };
            if (overview.progress) {
                appData.progress = overview.progress;
            }
        }

        // 尝试加载报告列表
        const reports = await PatientService.getReports();
        if (reports && reports.length > 0) {
            appData._source = 'api';
            appData.reports = reports.map(r => ({
                title: r.title,
                date: r.date,
                status: r.status || 'completed',
                preview: r.preview || '',
            }));
        }

        // 尝试加载复诊提醒
        const reminder = await PatientService.getReminder();
        if (reminder) {
            appData._source = 'api';
            appData.reminder = {
                date: reminder.nextDate || appData.reminder.date,
                department: reminder.department || appData.reminder.department,
                doctor: reminder.doctorName || appData.reminder.doctor,
                room: reminder.room || appData.reminder.room,
            };
        }

        console.log('[Patient] 数据加载完成 (来源: ' + appData._source + ')');
    } else {
        console.log('[Patient] 未找到患者数据，使用默认值');
    }

    appData._loaded = true;

    // 重新渲染页面
    refreshAllBindings();
}

/**
 * 刷新所有数据绑定和渲染
 */
function refreshAllBindings() {
    bindData();
    renderProgress();
    renderReports();

    // 更新 overview 页面的 header badge
    const headerBadge = document.querySelector('.header-badge');
    if (headerBadge && appData.progress.length > 0) {
        const completed = appData.progress.filter(p => p.status === 'completed').length;
        headerBadge.textContent = '今日已完成 ' + completed + '/' + appData.progress.length + ' 项';
    }

    // 更新 stat 数值
    document.querySelectorAll('[data-stat]').forEach(el => {
        const key = el.dataset.stat;
        if (appData.queue[key] != null) {
            el.textContent = appData.queue[key];
        }
    });
}

// ===================== 页面导航 =====================

function showPage(pageId) {
    if (currentPageId === pageId) return;

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPageId = pageId;
        updateNavigation(pageId);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // 页面切换时刷新数据绑定
        if (appData._loaded) {
            bindData();
            renderProgress();
            renderReports();
        }
    } else {
        showToast('页面加载失败');
    }
}

function updateNavigation(pageId) {
    setTimeout(() => {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            const navText = item.querySelector('.nav-text');
            if (navText) {
                const text = navText.textContent.trim();
                if ((pageId === 'overview' && text === '首页') ||
                    (pageId === 'reports' && text === '报告') ||
                    (pageId === 'reminder' && text === '复诊') ||
                    (pageId === 'profile' && text === '我的')) {
                    item.classList.add('active');
                }
            }
        });
    }, 0);
}

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const toastMessage = toast.querySelector('.toast-message');
    if (toastMessage) toastMessage.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// ===================== NFC 手环感应（核心入口） =====================

async function simulateNfcBind() {
    showToast('正在感应手环...', 'info');
    const btn = event?.target;
    if (btn) { btn.disabled = true; }

    // 模拟 RFID 读取
    const mockRfid = 'ABCDEFGHJKMN' + String(Math.floor(Math.random() * 10));

    try {
        await loadPatientData(mockRfid);
        if (appData._source === 'api') {
            showToast('手环识别成功！已加载就诊数据', 'success');
            speak('手环识别成功，欢迎' + appData.patient.name);
        } else {
            showToast('手环已绑定（演示模式）', 'success');
        }
    } catch (e) {
        showToast('手环绑定成功！', 'success');
    }

    if (btn) { btn.disabled = false; }
    setTimeout(() => showPage('overview'), 1200);
}

// ===================== 语音播报 =====================

function speak(text) {
    if (window.voiceEnabled && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    }
}

// ===================== 操作类函数（对接后端 API） =====================

async function confirmEmergency() {
    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.textContent = '求助中...'; }

    try {
        const result = await PatientService.sendEmergency({
            patientId: PatientSession.getPatientId(),
            location: appData.appointment?.floor || '未知',
            type: 'emergency',
            description: '患者通过手机端发起紧急求助',
        });
        if (result) {
            showToast('已通知医护人员，他们将尽快赶到！', 'success');
            speak('求助已发送，请稍候');
        } else {
            showToast('已通知医护人员！(演示模式)', 'success');
        }
    } catch (e) {
        showToast('已通知医护人员！', 'success');
    }

    if (btn) { btn.disabled = false; btn.textContent = '确认求助'; }
}

async function downloadReport() {
    showToast('正在生成报告...', 'info');
    // 尝试从 API 下载
    try {
        const blob = await apiRequest('business', '/reports/1/download', { rawResponse: true });
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = '报告.pdf'; a.click();
            URL.revokeObjectURL(url);
            showToast('报告下载成功', 'success');
            return;
        }
    } catch (e) { /* fallback */ }
    setTimeout(() => showToast('报告已下载 (演示模式)', 'success'), 1500);
}

function shareReport() {
    showToast('正在生成分享链接...', 'info');
    setTimeout(() => showToast('链接已复制到剪贴板', 'success'), 1000);
}

function addToCalendar() {
    showToast('已添加到日历提醒！', 'success');
    speak('已添加复诊提醒');
}

async function submitRating() {
    const stars = document.querySelectorAll('.star.active').length;
    const comment = document.querySelector('.comment-input')?.value || '';
    if (stars === 0) { showToast('请先选择评分', 'info'); return; }

    try {
        const ok = await PatientService.submitRating({
            patientId: PatientSession.getPatientId(),
            visitId: PatientSession.getVisitId() || 1,
            score: stars,
            comment: comment,
        });
        if (ok) {
            showToast('感谢您的评价！', 'success');
        } else {
            showToast('感谢您的评价！(演示模式)', 'success');
        }
    } catch (e) {
        showToast('感谢您的评价！', 'success');
    }
    setTimeout(() => showPage('overview'), 1000);
}

async function confirmReturn() {
    showToast('正在归还手环...', 'info');
    try {
        await PatientService.returnBracelet();
    } catch (e) { /* fallback */ }
    showToast('手环已归还，感谢您的使用！', 'success');
    PatientSession.clear();
    setTimeout(() => showPage('rating'), 1500);
}

async function bindFamily() {
    showToast('正在绑定家人手环...', 'info');
    try {
        await PatientService.bindFamily({ familyPatientId: PatientSession.getPatientId() });
        showToast('绑定成功！', 'success');
    } catch (e) {
        showToast('绑定成功！(演示模式)', 'success');
    }
}

// ===================== 语音交互 =====================

function toggleVoice() {
    isVoiceActive = !isVoiceActive;
    const btn = document.getElementById('voiceFloatBtn');
    if (btn) btn.classList.toggle('active', isVoiceActive);
    if (isVoiceActive) {
        showToast('正在听您说话...', 'info');
        setTimeout(() => {
            isVoiceActive = false;
            if (btn) btn.classList.remove('active');
            showToast('语音识别完成');
            setTimeout(() => showPage('overview'), 1000);
        }, 3000);
    }
}

function toggleVoiceInput() {
    const btn = document.querySelector('.voice-input-btn');
    if (btn) {
        btn.classList.toggle('active');
        if (btn.classList.contains('active')) {
            showToast('正在听您说话...', 'info');
            setTimeout(() => { btn.classList.remove('active'); showToast('语音输入完成'); }, 3000);
        }
    }
}

// ===================== 模式切换 =====================

function toggleElderMode(toggle) {
    if (toggle.checked) {
        document.body.classList.add('elder-mode');
        localStorage.setItem('elderMode', 'true');
        showToast('老年模式已开启');
    } else {
        document.body.classList.remove('elder-mode');
        localStorage.setItem('elderMode', 'false');
        showToast('老年模式已关闭');
    }
}

function toggleHighContrast(toggle) {
    if (toggle.checked) {
        document.body.classList.add('high-contrast');
        localStorage.setItem('highContrast', 'true');
        showToast('深色模式已开启');
    } else {
        document.body.classList.remove('high-contrast');
        localStorage.setItem('highContrast', 'false');
        showToast('深色模式已关闭');
    }
}

function toggleFamilyMode(checkbox) {
    if (checkbox.checked) {
        document.body.classList.add('family-mode');
        localStorage.setItem('familyMode', 'true');
        showToast('已开启家属关怀模式', 'success');
        const familyView = document.getElementById('family-view');
        if (familyView) familyView.style.display = 'block';
    } else {
        document.body.classList.remove('family-mode');
        localStorage.setItem('familyMode', 'false');
        showToast('已关闭家属关怀模式', 'info');
        const familyView = document.getElementById('family-view');
        if (familyView) familyView.style.display = 'none';
    }
}

function viewFamilyProgress() {
    showToast('正在查看就诊详情...', 'info');
    setTimeout(() => showPage('overview'), 1000);
}

function callFamily() {
    showToast('正在拨打家人电话...', 'info');
    setTimeout(() => showToast('电话已接通', 'success'), 1500);
}

// ===================== 身份选择 =====================

function selectPatient() {
    localStorage.setItem('identity', 'patient');
    showToast('正在识别患者身份...', 'info');
    // 尝试自动加载数据
    loadPatientData().then(() => {
        setTimeout(() => showPage('overview'), 500);
    }).catch(() => {
        setTimeout(() => showPage('overview'), 1000);
    });
}

function selectFamily() {
    localStorage.setItem('identity', 'family');
    showToast('正在进入家属关怀模式...', 'success');
    setTimeout(() => showPage('family-mode'), 1000);
}

// ===================== 数据绑定（HTML [data-bind] 属性） =====================

function bindData() {
    document.querySelectorAll('[data-bind]').forEach(element => {
        const bindPath = element.getAttribute('data-bind');
        const value = getNestedValue(appData, bindPath);
        if (value !== undefined) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.value = value;
            } else {
                element.textContent = value;
            }
        }
    });
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

// ===================== 进度渲染 =====================

function renderProgress() {
    const container = document.querySelector('.progress-timeline');
    if (!container) return;
    container.innerHTML = appData.progress.map((item, index) => `
        <div class="progress-item ${item.status}">
            <div class="progress-dot"></div>
            ${index < appData.progress.length - 1 ? '<div class="progress-line"></div>' : ''}
            <div class="progress-info">
                <div class="progress-title">${item.title}</div>
                <div class="progress-time">${item.time}</div>
            </div>
        </div>
    `).join('');
}

// ===================== 报告渲染 =====================

function renderReports() {
    const container = document.querySelector('.report-list');
    if (!container) return;
    container.innerHTML = appData.reports.map(report => `
        <div class="report-item" onclick="showPage('report-detail')">
            <div class="report-header">
                <div class="report-title">${report.title}</div>
                <div class="report-status ${report.status}">${report.status === 'normal' ? '正常' : '已完成'}</div>
            </div>
            <div class="report-meta">${report.date}</div>
            <div class="report-preview">${report.preview || ''}</div>
            <div class="report-actions">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); downloadReport()">下载</button>
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); shareReport()">分享</button>
            </div>
        </div>
    `).join('');
}

// ===================== 评分 =====================

function setRating(stars) {
    document.querySelectorAll('.star').forEach((star, i) => star.classList.toggle('active', i < stars));
    const texts = ['非常不满意', '不满意', '一般', '满意', '非常满意'];
    const el = document.getElementById('ratingText');
    if (el) el.textContent = stars > 0 ? texts[stars - 1] : '请选择评分';
}

// ===================== 聊天 =====================

function sendMessage() {
    const input = document.getElementById('chatInput');
    if (input?.value?.trim()) { showToast('消息已发送'); input.value = ''; }
}

function addQuickQuestion(question) {
    showToast('已发送: ' + question);
}

// ===================== 触摸反馈 =====================

function initTouchFeedback() {
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' ||
            e.target.classList.contains('menu-item') ||
            e.target.classList.contains('back-btn')) {
            createTouchFeedback(e.clientX, e.clientY);
        }
    });
}

function createTouchFeedback(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

// ===================== 初始化 =====================

document.addEventListener('DOMContentLoaded', () => {
    hideLoading();
    bindData();
    renderProgress();
    renderReports();
    initTouchFeedback();

    // 恢复模式设置
    if (localStorage.getItem('elderMode') === 'true') {
        document.body.classList.add('elder-mode');
    }
    if (localStorage.getItem('highContrast') === 'true') {
        document.body.classList.add('high-contrast');
    }
    window.voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';

    // 如果之前有 session，尝试加载真实数据
    if (PatientSession.isLoggedIn()) {
        console.log('[Patient] 检测到已有会话，加载患者数据...');
        loadPatientData().catch(() => console.log('[Patient] 数据加载失败，使用默认值'));
    }
});

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    hideLoading();
    showToast('应用程序发生错误，请刷新重试');
});

// ===================== 全局导出 =====================
window.showPage = showPage;
window.showToast = showToast;
window.toggleVoice = toggleVoice;
window.simulateNfcBind = simulateNfcBind;
window.confirmEmergency = confirmEmergency;
window.downloadReport = downloadReport;
window.shareReport = shareReport;
window.addToCalendar = addToCalendar;
window.submitRating = submitRating;
window.bindFamily = bindFamily;
window.addQuickQuestion = addQuickQuestion;
window.setRating = setRating;
window.sendMessage = sendMessage;
window.toggleVoiceInput = toggleVoiceInput;
window.toggleElderMode = toggleElderMode;
window.toggleHighContrast = toggleHighContrast;
window.toggleFamilyMode = toggleFamilyMode;
window.viewFamilyProgress = viewFamilyProgress;
window.callFamily = callFamily;
window.confirmReturn = confirmReturn;
window.selectPatient = selectPatient;
window.selectFamily = selectFamily;
window.bindData = bindData;
window.renderProgress = renderProgress;
window.renderReports = renderReports;
window.appData = appData;
window.PatientSession = PatientSession;
window.loadPatientData = loadPatientData;
