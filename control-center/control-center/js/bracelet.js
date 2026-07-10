/**
 * 智环引诊 - 手环管理 / 导诊台
 * 对接后端: /api/patient/* (业务端)
 * 管理端患者列表: 本地数据 + API 同步
 */

let currentStep = 1;
let currentPage = 1;
let pageSize = 10;
let totalPatients = 0;
let patientData = null;
let selectedPatientId = null;

const deptMap = {
    internal: '内科', surgery: '外科', cardiology: '心内科',
    endocrinology: '内分泌科', gastroenterology: '消化内科',
    ent: '耳鼻喉科', dermatology: '皮肤科', pediatrics: '儿科', tcm: '中医科'
};

const taskQueueMap = {
    internal: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '内科候诊区' },
        { name: '医生问诊', location: '内科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' }
    ],
    surgery: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '外科候诊区' },
        { name: '医生问诊', location: '外科诊室' },
        { name: '术前检查', location: '检验科' },
        { name: '缴费结算', location: '收费处' }
    ],
    cardiology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '心电图检查', location: '心电图室' },
        { name: '医生问诊', location: '心内科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' }
    ],
    endocrinology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '血糖检测', location: '检验科' },
        { name: '医生问诊', location: '内分泌科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' }
    ],
    gastroenterology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '消化内科候诊区' },
        { name: '医生问诊', location: '消化内科诊室' },
        { name: '胃镜检查预约', location: '内镜中心' },
        { name: '缴费结算', location: '收费处' }
    ],
    ent: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '耳鼻喉科候诊区' },
        { name: '医生问诊', location: '耳鼻喉科诊室' },
        { name: '听力检查', location: '听力室' },
        { name: '缴费取药', location: '收费处/药房' }
    ],
    dermatology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '皮肤科候诊区' },
        { name: '医生问诊', location: '皮肤科诊室' },
        { name: '皮肤检测', location: '皮肤检测室' },
        { name: '缴费取药', location: '收费处/药房' }
    ],
    pediatrics: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '儿科候诊区' },
        { name: '医生问诊', location: '儿科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' }
    ],
    tcm: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '中医科候诊区' },
        { name: '中医问诊', location: '中医科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药/针灸', location: '中药房/理疗室' }
    ]
};

// 本地缓存（API 不可用时的后备）
let assignedBracelets = [];

// ===================== API 封装 =====================

async function apiCreatePatient(data) {
    return businessApi.createPatient(data);
}

async function apiFetchPatients(params) {
    try {
        return await businessApi.getPatientPage(params);
    } catch (e) {
        console.warn('[Bracelet] 患者列表 API 不可用，使用本地数据:', e.message);
        return null;
    }
}

async function apiFetchPatientByRfid(rfid) {
    try {
        return await businessApi.fetchPatientByRfid(rfid);
    } catch (e) { return null; }
}

// ===================== 初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    updateDateTime();
    updateSummaryStats();
    await loadPatientList();
});

function updateDateTime() {
    setInterval(() => {
        const date = new Date();
        const el = document.getElementById('dateInfo');
        if (el) el.textContent = date.toISOString().replace('T', ' ').substring(0, 19);
    }, 1000);
}

// ===================== 患者列表（对接真实 API） =====================

async function loadPatientList() {
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const params = { current: currentPage, size: pageSize };
    if (searchTerm) params.keyword = searchTerm;

    const res = await apiFetchPatients(params);
    if (res && res.code === 200 && res.data) {
        const records = res.data.records || [];
        totalPatients = res.data.total || records.length;
        renderPatientTable(records);
    } else {
        // 使用本地缓存作为后备
        let filtered = assignedBracelets;
        if (searchTerm) {
            filtered = assignedBracelets.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                (p.braceletId || '').toLowerCase().includes(searchTerm) ||
                (p.maskedId || '').toLowerCase().includes(searchTerm)
            );
        }
        totalPatients = filtered.length;
        const start = (currentPage - 1) * pageSize;
        renderPatientTable(filtered.slice(start, start + pageSize));
    }
    updatePageInfo();
}

function renderPatientTable(patients) {
    const tbody = document.getElementById('patientList');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!patients.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#868e96;">暂无患者数据</td></tr>';
        return;
    }

    patients.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escHtml(p.name)}</td>
            <td><span class="masked-id-text">${escHtml(p.rfidUuid || p.maskedId || '--')}</span></td>
            <td><span class="dept-tag-sm">${escHtml(p.dept || '--')}</span></td>
            <td><span class="bracelet-id-text">${escHtml(p.rfidUuid || p.braceletId || '--')}</span></td>
            <td><span class="status-badge active">已绑定</span></td>
            <td>
                <button class="btn-sm" onclick="showDetailModalById(${p.id})">详情</button>
                <button class="btn-sm danger" onclick="showUnbindModal(${p.id})">解绑</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function searchPatients() {
    currentPage = 1;
    loadPatientList();
}

function prevPage() { if (currentPage > 1) { currentPage--; loadPatientList(); } }
function nextPage() {
    const maxPage = Math.ceil(totalPatients / pageSize) || 1;
    if (currentPage < maxPage) { currentPage++; loadPatientList(); }
}
function updatePageInfo() {
    const maxPage = Math.ceil(totalPatients / pageSize) || 1;
    const el = document.getElementById('pageInfo');
    if (el) el.textContent = `第 ${currentPage} 页 / 共 ${maxPage} 页`;
}

async function addPatientToList(data) {
    try {
        const apiData = {
            name: data.name,
            idCardNo: data.idCardNo,
            gender: parseInt(data.gender) || 0,
            age: parseInt(data.age) || 0,
            phone: data.phone,
            insuranceNo: data.insuranceNo,
            medicalHistory: data.medicalHistory,
            emergencyContactName: data.emergencyContactName,
            emergencyContactPhone: data.emergencyContactPhone,
            rfidUuid: data.braceletId,
        };
        await apiCreatePatient(apiData);
    } catch (e) { console.warn('[Bracelet] 创建患者 API 失败:', e.message); }

    // 更新本地缓存
    const newPatient = {
        id: assignedBracelets.length + 1,
        name: data.name, maskedId: data.maskedId,
        braceletId: data.braceletId, dept: data.deptName,
        deptCode: data.targetDept, bindTime: data.bindTime, status: 'active'
    };
    assignedBracelets.unshift(newPatient);
    loadPatientList();
}

function updateSummaryStats() {
    const total = 156;
    const bound = assignedBracelets.filter(p => p.status === 'active').length;
    const available = total - bound;
    const today = new Date().toISOString().substring(0, 10);
    const todayAssigned = assignedBracelets.filter(p => p.bindTime && p.bindTime.startsWith(today)).length;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('totalBracelets', total);
    setVal('boundBracelets', bound);
    setVal('availableBracelets', available);
    setVal('todayAssigned', todayAssigned);
}

// ===================== 3步流程 =====================

function goToStep1() {
    currentStep = 1;
    updateStepIndicator();
    toggleSteps('step1Content', 'step2Content', 'step3Content');
    const el = document.getElementById('cardTitle'); if (el) el.textContent = '患者信息登记';
    const status = document.getElementById('assignStatus');
    if (status) { status.textContent = '待录入'; status.classList.remove('active'); }
}

function goToStep2() {
    const name = document.getElementById('patientName').value.trim();
    const idCardNo = document.getElementById('idCardNo').value.trim();
    const targetDept = document.getElementById('targetDept').value;
    if (!name) { alert('请输入患者姓名'); return; }
    if (!idCardNo || !validateIdCard(idCardNo)) { alert('请输入正确的18位身份证号'); return; }
    if (!targetDept) { alert('请选择目标科室'); return; }

    patientData = {
        name, idCardNo,
        gender: document.getElementById('gender').value,
        age: document.getElementById('age').value,
        phone: document.getElementById('phone').value,
        insuranceNo: document.getElementById('insuranceNo').value,
        medicalHistory: document.getElementById('medicalHistory').value,
        emergencyContactName: document.getElementById('emergencyContactName').value,
        emergencyContactPhone: document.getElementById('emergencyContactPhone').value,
        targetDept, deptName: deptMap[targetDept]
    };

    updatePatientPreview();
    resetDeviceScreen();
    currentStep = 2;
    updateStepIndicator();
    toggleSteps('step2Content', 'step1Content', 'step3Content');
    const el = document.getElementById('cardTitle'); if (el) el.textContent = '手环绑定';
    const status = document.getElementById('assignStatus');
    if (status) { status.textContent = '待绑定'; status.classList.add('active'); }
}

function goToStep3(braceletId) {
    const maskedId = generateMaskedId();
    patientData.braceletId = braceletId;
    patientData.maskedId = maskedId;
    patientData.bindTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('resultMaskedId', maskedId);
    setText('resultName', patientData.name);
    setText('resultDept', patientData.deptName);
    setText('resultBraceletId', braceletId);
    setText('resultTime', patientData.bindTime);

    renderTaskQueue(patientData.targetDept);
    generateBarcode(maskedId);

    currentStep = 3;
    updateStepIndicator();
    toggleSteps('step3Content', 'step1Content', 'step2Content');
    const el = document.getElementById('cardTitle'); if (el) el.textContent = '绑定完成';
    const status = document.getElementById('assignStatus');
    if (status) { status.textContent = '已完成'; status.classList.add('active'); }

    addPatientToList(patientData);
    updateSummaryStats();
}

function toggleSteps(show, hide1, hide2) {
    [show, hide1, hide2].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList[id === show ? 'remove' : 'add']('hidden');
    });
}

// ===================== UI 辅助函数 =====================

function simulateIdRead() {
    const btn = event.target;
    btn.innerHTML = '读取中...'; btn.disabled = true;
    setTimeout(() => {
        const names = ['张伟', '李娜', '王芳', '刘洋', '陈明', '杨静', '赵磊', '黄丽'];
        const name = names[Math.floor(Math.random() * names.length)];
        const gender = Math.random() > 0.5 ? '1' : '2';
        const age = Math.floor(Math.random() * 60) + 20;
        const idCardNo = generateIdCard(gender, age);
        const phone = '1' + (Math.floor(Math.random() * 9) + 3) + String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');

        const setField = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setField('patientName', name); setField('idCardNo', idCardNo);
        setField('gender', gender); setField('age', age); setField('phone', phone);
        btn.innerHTML = '模拟读卡'; btn.disabled = false;
    }, 800);
}

function generateIdCard(gender, age) {
    const prefix = '110101';
    const year = new Date().getFullYear() - age;
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 999)).padStart(3, '0');
    const code = prefix + String(year) + month + day + seq;
    const last = gender === '1' ? (Math.floor(Math.random() * 5) * 2 + 1) : (Math.floor(Math.random() * 5) * 2);
    return code + last;
}

function generateMaskedId() {
    const chars = '0123456789ABCDEF';
    let p1 = '', p2 = '';
    for (let i = 0; i < 4; i++) { p1 += chars[Math.floor(Math.random() * 16)]; p2 += chars[Math.floor(Math.random() * 16)]; }
    return 'PAT-' + p1 + '-' + p2;
}

function generateBraceletId() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
    let r = '';
    for (let i = 0; i < 12; i++) r += chars[Math.floor(Math.random() * 32)];
    return r;
}

function updatePatientPreview() {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
    setText('previewName', patientData.name);
    setText('previewIdCard', maskIdCard(patientData.idCardNo));
    setText('previewGender', patientData.gender === '1' ? '男' : patientData.gender === '2' ? '女' : '-');
    setText('previewAge', patientData.age);
    setText('previewPhone', patientData.phone);
    setText('previewDept', patientData.deptName);
}

function renderTaskQueue(deptCode) {
    const queue = taskQueueMap[deptCode] || taskQueueMap.internal;
    const container = document.getElementById('resultTaskQueue');
    if (!container) return;
    container.innerHTML = queue.map((task, i) => `
        <div class="task-item${i === 0 ? ' active' : ''}">
            <div class="task-number">${i + 1}</div>
            <div class="task-name">${task.name}</div>
            <div class="task-location">${task.location}</div>
        </div>
    `).join('');
}

function startBind() {
    const btn = document.getElementById('bindBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '绑定中...'; }
    const setEl = (id, text, cls) => {
        const el = document.getElementById(id); if (el) { el.textContent = text; if (cls) el.className = cls; }
    };
    setEl('deviceStatus', '正在写入...', 'device-status scanning');
    const dot = document.querySelector('.light-dot'); if (dot) dot.className = 'light-dot scanning';
    const label = document.querySelector('.light-label'); if (label) label.textContent = '写入中';

    setTimeout(() => {
        const braceletId = generateBraceletId();
        playBeepSound();
        const wave = document.getElementById('soundWave'); if (wave) wave.classList.remove('hidden');
        const screen = document.getElementById('screenContent');
        if (screen) screen.innerHTML = `<div class="screen-success"><div class="success-text">✓ 写入成功</div><div class="bracelet-id-text">${braceletId}</div></div>`;
        setEl('deviceStatus', '写入完成', 'device-status success');
        if (dot) dot.className = 'light-dot success';
        if (label) label.textContent = '完成';
        setTimeout(() => goToStep3(braceletId), 800);
    }, 1500);
}

function manualInputBraceletId() {
    const modal = document.getElementById('manualModal'); if (modal) modal.classList.add('show');
}
function closeManualModal() {
    const modal = document.getElementById('manualModal'); if (modal) modal.classList.remove('show');
    const input = document.getElementById('manualBraceletId'); if (input) input.value = '';
}
function confirmManualBind() {
    const input = document.getElementById('manualBraceletId');
    const braceletId = input?.value?.trim().toUpperCase() || '';
    if (!braceletId || braceletId.length !== 12 || !/^[0-9A-V]{12}$/.test(braceletId)) {
        alert('请输入正确的12位手环ID（大写字母A-V和数字）'); return;
    }
    if (assignedBracelets.some(p => p.braceletId === braceletId && p.status === 'active')) {
        alert('该手环ID已被绑定'); return;
    }
    closeManualModal();
    goToStep3(braceletId);
}

function resetDeviceScreen() {
    const setEl = (id, text, cls) => {
        const el = document.getElementById(id); if (el) { el.textContent = text; if (cls) el.className = cls; }
    };
    setEl('deviceStatus', '等待中...', 'device-status');
    const dot = document.querySelector('.light-dot'); if (dot) dot.className = 'light-dot';
    const label = document.querySelector('.light-label'); if (label) label.textContent = '就绪';
    const wave = document.getElementById('soundWave'); if (wave) wave.classList.add('hidden');
    const screen = document.getElementById('screenContent');
    if (screen) screen.innerHTML = `<div class="screen-waiting"><div class="nfc-icon"><div class="nfc-ring"></div><div class="nfc-ring delay"></div><div class="nfc-center"></div></div><p>请将手环靠近感应区</p></div>`;
    const btn = document.getElementById('bindBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-icon"></span>模拟手环靠近'; }
}

// ===================== 详情/解绑弹窗 =====================

function showDetailModalById(patientId) {
    const patient = assignedBracelets.find(p => p.id === patientId);
    if (patient) showDetailModal(patient);
}

function showDetailModal(patient) {
    const tasks = taskQueueMap[patient.deptCode] || taskQueueMap.internal;
    const content = document.getElementById('detailContent');
    if (!content) return;
    content.innerHTML = `
        <div class="detail-grid">
            <div class="detail-section">
                <h5>基本信息</h5>
                <p><span class="detail-label">姓名:</span> ${escHtml(patient.name)}</p>
                <p><span class="detail-label">脱敏ID:</span> ${escHtml(patient.maskedId)}</p>
                <p><span class="detail-label">科室:</span> ${escHtml(patient.dept)}</p>
                <p><span class="detail-label">手环ID:</span> ${escHtml(patient.braceletId)}</p>
            </div>
            <div class="detail-section">
                <h5>绑定信息</h5>
                <p><span class="detail-label">绑定时间:</span> ${patient.bindTime || '--'}</p>
                <p><span class="detail-label">状态:</span> ${patient.status === 'active' ? '已绑定' : '已解绑'}</p>
            </div>
            <div class="detail-section full">
                <h5>任务队列</h5>
                ${tasks.map((t, i) => `<div class="task-item${i===0?' active':''}"><span>${i+1}. ${t.name}</span> <small>${t.location}</small></div>`).join('')}
            </div>
        </div>`;
    const modal = document.getElementById('detailModal'); if (modal) modal.classList.add('show');
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal'); if (modal) modal.classList.remove('show');
}

function showUnbindModal(patientId) {
    selectedPatientId = patientId;
    const patient = assignedBracelets.find(p => p.id === patientId);
    const el = document.getElementById('unbindBraceletId'); if (el && patient) el.textContent = patient.braceletId;
    const modal = document.getElementById('unbindModal'); if (modal) modal.classList.add('show');
}

function closeUnbindModal() {
    const modal = document.getElementById('unbindModal'); if (modal) modal.classList.remove('show');
    selectedPatientId = null;
}

async function confirmUnbind() {
    if (selectedPatientId) {
        try {
            await businessApi.deletePatient(selectedPatientId);
        } catch (e) { console.warn('解绑 API 失败:', e.message); }
        const patient = assignedBracelets.find(p => p.id === selectedPatientId);
        if (patient) patient.status = 'inactive';
        loadPatientList();
        updateSummaryStats();
    }
    closeUnbindModal();
}

// ===================== 辅助 =====================

function playBeepSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
}

function validateIdCard(idCard) { return /^\d{17}[\dXx]$/.test(idCard); }
function maskIdCard(idCard) { return idCard && idCard.length >= 18 ? idCard.substring(0, 6) + '********' + idCard.substring(14) : idCard; }
function generateBarcode(text) {
    const container = document.getElementById('barcodeLines'); if (!container) return;
    const seed = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    container.innerHTML = Array.from({ length: 40 }, (_, i) => {
        const h = Math.floor((Math.sin(seed + i * 0.7) + 1) * 12 + 4);
        return `<div class="barcode-line" style="height:${h}px;width:${Math.random()>0.5?2:3}px;"></div>`;
    }).join('');
    const el = document.getElementById('barcodeText'); if (el) el.textContent = text;
}

function updateStepIndicator() {
    document.querySelectorAll('.steps-indicator .step').forEach(s => {
        const n = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (n < currentStep) s.classList.add('completed');
        else if (n === currentStep) s.classList.add('active');
    });
    document.querySelectorAll('.steps-indicator .step-line').forEach((l, i) => {
        l.classList.toggle('active', i < currentStep - 1);
    });
}

function resetForm() {
    const form = document.getElementById('patientForm'); if (form) form.reset();
    patientData = null;
    goToStep1();
}
function printTicket() {
    if (patientData) alert(`小票打印中...\n患者：${patientData.name}\n脱敏ID：${patientData.maskedId}\n科室：${patientData.deptName}\n手环：${patientData.braceletId}`);
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
