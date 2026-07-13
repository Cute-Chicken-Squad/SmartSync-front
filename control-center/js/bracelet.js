// 手环管理页面逻辑 - 导诊台场景

// 全局变量
let currentStep = 1;
let currentPage = 1;
let pageSize = 10;
let totalPatients = 0;
let patientData = null;
let selectedPatientId = null;

// 科室名称映射
const deptMap = {
    internal: '内科',
    surgery: '外科',
    cardiology: '心内科',
    endocrinology: '内分泌科',
    gastroenterology: '消化内科',
    ent: '耳鼻喉科',
    dermatology: '皮肤科',
    pediatrics: '儿科',
    tcm: '中医科'
};

// 科室任务队列配置
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

// 模拟数据 - 已分配手环列表
let assignedBracelets = [
    { id: 1, name: '王大爷', maskedId: 'PAT-7A3B-9C2D', braceletId: 'ABC123456789', dept: '心内科', deptCode: 'cardiology', bindTime: '2026-06-17 08:15', status: 'active' },
    { id: 2, name: '李女士', maskedId: 'PAT-2E8F-4D1A', braceletId: 'DEF234567890', dept: '内分泌科', deptCode: 'endocrinology', bindTime: '2026-06-17 09:30', status: 'active' },
    { id: 3, name: '张先生', maskedId: 'PAT-5B1C-7E3F', braceletId: 'GHI345678901', dept: '消化内科', deptCode: 'gastroenterology', bindTime: '2026-06-17 10:45', status: 'active' },
    { id: 4, name: '赵阿姨', maskedId: 'PAT-9D4A-2B8E', braceletId: 'JKL456789012', dept: '内科', deptCode: 'internal', bindTime: '2026-06-17 11:20', status: 'active' },
    { id: 5, name: '孙大爷', maskedId: 'PAT-1F7C-5A3D', braceletId: 'MNO567890123', dept: '外科', deptCode: 'surgery', bindTime: '2026-06-17 12:00', status: 'active' },
    { id: 6, name: '周女士', maskedId: 'PAT-6E2B-8F4C', braceletId: 'PQR678901234', dept: '皮肤科', deptCode: 'dermatology', bindTime: '2026-06-17 13:15', status: 'active' },
    { id: 7, name: '吴先生', maskedId: 'PAT-3A9D-1E7B', braceletId: 'STU789012345', dept: '耳鼻喉科', deptCode: 'ent', bindTime: '2026-06-17 14:00', status: 'active' },
    { id: 8, name: '郑阿姨', maskedId: 'PAT-8C5F-3A2E', braceletId: 'VWX890123456', dept: '中医科', deptCode: 'tcm', bindTime: '2026-06-16 15:30', status: 'inactive' },
];

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    updateDateTime();
    loadPatientList();
    updateSummaryStats();
});

// 更新时间显示
function updateDateTime() {
    setInterval(() => {
        const date = new Date();
        const timeString = date.toISOString().replace('T', ' ').substring(0, 19);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);
}

// 更新汇总统计（API 优先，失败时本地计算降级）
async function updateSummaryStats() {
    try {
        await loadBraceletSummary();
    } catch (e) {
        // 降级：本地计算
        const total = 156;
        const bound = assignedBracelets.filter(p => p.status === 'active').length;
        const available = total - bound;
        const todayAssigned = assignedBracelets.filter(p => p.bindTime && p.bindTime.startsWith(new Date().toISOString().substring(0, 10))).length;
        document.getElementById('totalBracelets').textContent = total;
        document.getElementById('boundBracelets').textContent = bound;
        document.getElementById('availableBracelets').textContent = available;
        document.getElementById('todayAssigned').textContent = todayAssigned;
    }
}

// 播放滴声（Web Audio API）
function playBeepSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.15);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
        console.log('音频播放失败:', e);
    }
}

// 模拟身份证读卡
function simulateIdRead() {
    const btn = event.target;
    btn.innerHTML = '读取中...';
    btn.disabled = true;

    setTimeout(() => {
        // 随机生成患者信息
        const names = ['张伟', '李娜', '王芳', '刘洋', '陈明', '杨静', '赵磊', '黄丽'];
        const name = names[Math.floor(Math.random() * names.length)];
        const gender = Math.random() > 0.5 ? '1' : '2';
        const age = Math.floor(Math.random() * 60) + 20;
        const idCardNo = generateIdCard(gender, age);
        const phone = '1' + (Math.floor(Math.random() * 9) + 3) + String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');

        document.getElementById('patientName').value = name;
        document.getElementById('idCardNo').value = idCardNo;
        document.getElementById('gender').value = gender;
        document.getElementById('age').value = age;
        document.getElementById('phone').value = phone;

        btn.innerHTML = '模拟读卡';
        btn.disabled = false;
    }, 800);
}

// 生成随机身份证号
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

// 生成脱敏ID
function generateMaskedId() {
    const chars = '0123456789ABCDEF';
    let part1 = '', part2 = '';
    for (let i = 0; i < 4; i++) {
        part1 += chars.charAt(Math.floor(Math.random() * chars.length));
        part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'PAT-' + part1 + '-' + part2;
}

// 生成手环ID
function generateBraceletId() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 步骤切换
function goToStep1() {
    currentStep = 1;
    updateStepIndicator();
    document.getElementById('step1Content').classList.remove('hidden');
    document.getElementById('step2Content').classList.add('hidden');
    document.getElementById('step3Content').classList.add('hidden');
    document.getElementById('cardTitle').textContent = '患者信息登记';
    document.getElementById('assignStatus').textContent = '待录入';
    document.getElementById('assignStatus').classList.remove('active');
}

function goToStep2() {
    const name = document.getElementById('patientName').value.trim();
    const idCardNo = document.getElementById('idCardNo').value.trim();
    const targetDept = document.getElementById('targetDept').value;

    if (!name) {
        alert('请输入患者姓名');
        return;
    }
    if (!idCardNo || !validateIdCard(idCardNo)) {
        alert('请输入正确的18位身份证号');
        return;
    }
    if (!targetDept) {
        alert('请选择目标科室');
        return;
    }

    patientData = {
        name: name,
        idCardNo: idCardNo,
        gender: document.getElementById('gender').value,
        age: document.getElementById('age').value,
        phone: document.getElementById('phone').value,
        insuranceNo: document.getElementById('insuranceNo').value,
        medicalHistory: document.getElementById('medicalHistory').value,
        emergencyContactName: document.getElementById('emergencyContactName').value,
        emergencyContactPhone: document.getElementById('emergencyContactPhone').value,
        targetDept: targetDept,
        deptName: deptMap[targetDept]
    };

    updatePatientPreview();
    resetDeviceScreen();

    currentStep = 2;
    updateStepIndicator();
    document.getElementById('step1Content').classList.add('hidden');
    document.getElementById('step2Content').classList.remove('hidden');
    document.getElementById('step3Content').classList.add('hidden');
    document.getElementById('cardTitle').textContent = '手环绑定';
    document.getElementById('assignStatus').textContent = '待绑定';
    document.getElementById('assignStatus').classList.add('active');
}

function goToStep3(braceletId) {
    const maskedId = generateMaskedId();
    patientData.braceletId = braceletId;
    patientData.maskedId = maskedId;
    patientData.bindTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 显示结果
    document.getElementById('resultMaskedId').textContent = maskedId;
    document.getElementById('resultName').textContent = patientData.name;
    document.getElementById('resultDept').textContent = patientData.deptName;
    document.getElementById('resultBraceletId').textContent = braceletId;
    document.getElementById('resultTime').textContent = patientData.bindTime;

    // 生成任务队列
    renderTaskQueue(patientData.targetDept);

    // 生成条形码
    generateBarcode(maskedId);

    currentStep = 3;
    updateStepIndicator();
    document.getElementById('step1Content').classList.add('hidden');
    document.getElementById('step2Content').classList.add('hidden');
    document.getElementById('step3Content').classList.remove('hidden');
    document.getElementById('cardTitle').textContent = '绑定完成';
    document.getElementById('assignStatus').textContent = '已完成';
    document.getElementById('assignStatus').classList.add('active');

    // ★ 写入后端数据库
    createPatientApi({
        name: patientData.name,
        idCardNo: patientData.idCardNo,
        gender: patientData.gender,
        age: patientData.age,
        phone: patientData.phone,
        insuranceNo: patientData.insuranceNo,
        medicalHistory: patientData.medicalHistory,
        emergencyContactName: patientData.emergencyContactName,
        emergencyContactPhone: patientData.emergencyContactPhone,
        dept: patientData.targetDept,
        deptName: patientData.deptName,
        braceletId: braceletId,
        maskedId: maskedId,
        bindTime: patientData.bindTime,
    }).then(result => {
        if (result) {
            console.log('[手环] 患者已写入后端:', patientData.name, result);
            // 添加到本地列表
            addPatientToList(patientData);
            updateSummaryStats();
        } else {
            console.warn('[手环] 后端写入失败，仅本地保存');
            addPatientToList(patientData);
            updateSummaryStats();
        }
    });
}

// 渲染任务队列
function renderTaskQueue(deptCode) {
    const queue = taskQueueMap[deptCode] || taskQueueMap.internal;
    const container = document.getElementById('resultTaskQueue');
    container.innerHTML = '';

    queue.forEach((task, index) => {
        const item = document.createElement('div');
        item.className = 'task-item' + (index === 0 ? ' active' : '');
        item.innerHTML = `
            <div class="task-number">${index + 1}</div>
            <div class="task-name">${task.name}</div>
            <div class="task-location">${task.location}</div>
        `;
        container.appendChild(item);
    });
}

// 生成条形码
function generateBarcode(text) {
    const container = document.getElementById('barcodeLines');
    container.innerHTML = '';

    const seed = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    for (let i = 0; i < 40; i++) {
        const line = document.createElement('div');
        line.className = 'barcode-line';
        const height = Math.floor((Math.sin(seed + i * 0.7) + 1) * 12 + 4);
        const width = Math.random() > 0.5 ? 2 : 3;
        line.style.height = height + 'px';
        line.style.width = width + 'px';
        container.appendChild(line);
    }

    document.getElementById('barcodeText').textContent = text;
}

// 更新步骤指示器
function updateStepIndicator() {
    const steps = document.querySelectorAll('.steps-indicator .step');
    const lines = document.querySelectorAll('.steps-indicator .step-line');

    steps.forEach((step) => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum < currentStep) {
            step.classList.add('completed');
        } else if (stepNum === currentStep) {
            step.classList.add('active');
        }
    });

    lines.forEach((line, index) => {
        line.classList.remove('active');
        if (index < currentStep - 1) {
            line.classList.add('active');
        }
    });
}

// 更新患者预览
function updatePatientPreview() {
    document.getElementById('previewName').textContent = patientData.name;
    document.getElementById('previewIdCard').textContent = maskIdCard(patientData.idCardNo);
    document.getElementById('previewGender').textContent = patientData.gender === '1' ? '男' : (patientData.gender === '2' ? '女' : '-');
    document.getElementById('previewAge').textContent = patientData.age || '-';
    document.getElementById('previewPhone').textContent = patientData.phone || '-';
    document.getElementById('previewDept').textContent = patientData.deptName;
}

// 重置设备屏幕
function resetDeviceScreen() {
    document.getElementById('deviceStatus').textContent = '等待中...';
    document.getElementById('deviceStatus').className = 'device-status';
    document.querySelector('.light-dot').className = 'light-dot';
    document.querySelector('.light-label').textContent = '就绪';
    document.getElementById('soundWave').classList.add('hidden');

    document.getElementById('screenContent').innerHTML = `
        <div class="screen-waiting">
            <div class="nfc-icon">
                <div class="nfc-ring"></div>
                <div class="nfc-ring delay"></div>
                <div class="nfc-center"></div>
            </div>
            <p>请将手环靠近感应区</p>
        </div>
    `;

    const bindBtn = document.getElementById('bindBtn');
    bindBtn.disabled = false;
    bindBtn.innerHTML = '<span class="btn-icon"></span>模拟手环靠近';
}

// 开始绑定（模拟手环靠近）
function startBind() {
    const bindBtn = document.getElementById('bindBtn');
    bindBtn.disabled = true;
    bindBtn.innerHTML = '绑定中...';

    // 更新设备状态
    document.getElementById('deviceStatus').textContent = '正在写入...';
    document.getElementById('deviceStatus').className = 'device-status scanning';
    document.querySelector('.light-dot').className = 'light-dot scanning';
    document.querySelector('.light-label').textContent = '写入中';

    // 1.5秒后完成
    setTimeout(() => {
        const braceletId = generateBraceletId();

        // 播放滴声
        playBeepSound();

        // 显示声波动画
        document.getElementById('soundWave').classList.remove('hidden');

        // 更新屏幕内容
        document.getElementById('screenContent').innerHTML = `
            <div class="screen-success">
                <div class="success-text">✓ 写入成功</div>
                <div class="bracelet-id-text">${braceletId}</div>
            </div>
        `;

        // 更新设备状态
        document.getElementById('deviceStatus').textContent = '写入完成';
        document.getElementById('deviceStatus').className = 'device-status success';
        document.querySelector('.light-dot').className = 'light-dot success';
        document.querySelector('.light-label').textContent = '完成';

        // 0.8秒后跳转到步骤3
        setTimeout(() => {
            goToStep3(braceletId);
        }, 800);
    }, 1500);
}

// 手动输入手环ID
function manualInputBraceletId() {
    document.getElementById('manualModal').classList.add('show');
}

function closeManualModal() {
    document.getElementById('manualModal').classList.remove('show');
    document.getElementById('manualBraceletId').value = '';
}

function confirmManualBind() {
    const braceletId = document.getElementById('manualBraceletId').value.trim().toUpperCase();

    if (!braceletId || braceletId.length !== 12 || !/^[0-9A-V]{12}$/.test(braceletId)) {
        alert('请输入正确的12位手环ID（大写字母A-V和数字）');
        return;
    }

    if (assignedBracelets.some(p => p.braceletId === braceletId && p.status === 'active')) {
        alert('该手环ID已被绑定，请使用其他手环');
        return;
    }

    closeManualModal();
    goToStep3(braceletId);
}

// 重置表单
function resetForm() {
    document.getElementById('patientForm').reset();
    patientData = null;
    goToStep1();
}

// 打印小票
function printTicket() {
    alert('小票打印中...\n\n患者：' + patientData.name + '\n脱敏ID：' + patientData.maskedId + '\n科室：' + patientData.deptName + '\n手环：' + patientData.braceletId);
}

// 加载患者列表（API 优先）
async function loadPatientList() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    // 尝试从 API 加载
    try {
        const data = await fetchPatientsApi(currentPage, pageSize, searchTerm);
        if (data && data.records) {
            // 将 API 数据映射到本地格式
            assignedBracelets = data.records.map(r => ({
                id: r.id,
                name: r.name,
                maskedId: r.maskedId || r.idCardNo,
                braceletId: r.braceletId || '',
                dept: r.deptName || r.dept || '',
                deptCode: r.dept || '',
                bindTime: r.bindTime || r.createdAt || '',
                status: r.status === 1 || r.status === 'active' ? 'active' : 'inactive',
            }));
            totalPatients = data.total || assignedBracelets.length;
            renderPatientTable(searchTerm);
            updatePageInfo();
            return;
        }
    } catch (e) {
        console.warn('[手环] API 加载列表失败，使用本地数据:', e.message);
    }

    // 降级：本地过滤
    renderPatientTable(searchTerm);
    updatePageInfo();
}

/** 渲染患者表格 */
function renderPatientTable(searchTerm) {
    const tbody = document.getElementById('patientList');
    let filteredList = assignedBracelets;
    if (searchTerm) {
        filteredList = assignedBracelets.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            (p.braceletId || '').toLowerCase().includes(searchTerm) ||
            (p.maskedId || '').toLowerCase().includes(searchTerm)
        );
    }

    totalPatients = filteredList.length;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filteredList.slice(startIndex, endIndex);

    tbody.innerHTML = '';

    pageData.forEach(patient => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${patient.name}</td>
            <td><span class="masked-id-text">${patient.maskedId}</span></td>
            <td><span class="dept-tag-sm">${patient.dept}</span></td>
            <td><span class="bracelet-id-text">${patient.braceletId}</span></td>
            <td><span class="status-badge ${patient.status}">${patient.status === 'active' ? '已绑定' : '已解绑'}</span></td>
            <td>
                <button class="btn-sm" onclick="showDetailModalById(${patient.id})">详情</button>
                <button class="btn-sm danger" onclick="showUnbindModal(${patient.id})" ${patient.status === 'inactive' ? 'disabled' : ''}>解绑</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 搜索患者
function searchPatients() {
    currentPage = 1;
    loadPatientList();
}

// 分页
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadPatientList();
    }
}

function nextPage() {
    const maxPage = Math.ceil(totalPatients / pageSize);
    if (currentPage < maxPage) {
        currentPage++;
        loadPatientList();
    }
}

function updatePageInfo() {
    const maxPage = Math.ceil(totalPatients / pageSize) || 1;
    document.getElementById('pageInfo').textContent = `第 ${currentPage} 页 / 共 ${maxPage} 页`;
}

// 添加患者到列表
function addPatientToList(data) {
    const newPatient = {
        id: assignedBracelets.length + 1,
        name: data.name,
        maskedId: data.maskedId,
        braceletId: data.braceletId,
        dept: data.deptName,
        deptCode: data.targetDept,
        bindTime: data.bindTime,
        status: 'active'
    };
    assignedBracelets.unshift(newPatient);
    loadPatientList();
}

// 显示解绑弹窗
function showUnbindModal(patientId) {
    selectedPatientId = patientId;
    const patient = assignedBracelets.find(p => p.id === patientId);
    document.getElementById('unbindBraceletId').textContent = patient.braceletId;
    document.getElementById('unbindModal').classList.add('show');
}

function closeUnbindModal() {
    document.getElementById('unbindModal').classList.remove('show');
    selectedPatientId = null;
}

async function confirmUnbind() {
    if (selectedPatientId) {
        const patient = assignedBracelets.find(p => p.id === selectedPatientId);
        if (patient) {
            // ★ 调用后端 API 删除/解绑
            const ok = await deletePatientApi(selectedPatientId);
            if (ok) {
                patient.status = 'inactive';
                console.log('[手环] 已通过 API 解绑:', patient.name);
            } else {
                // API 失败也本地标记（降级）
                patient.status = 'inactive';
                console.warn('[手环] API 解绑失败，仅本地标记');
            }
            loadPatientList();
            updateSummaryStats();
        }
    }
    closeUnbindModal();
    alert('手环已解绑');
}

// 显示详情弹窗
function showDetailModalById(patientId) {
    const patient = assignedBracelets.find(p => p.id === patientId);
    if (patient) {
        showDetailModal(patient);
    }
}

function showDetailModal(patient) {
    const tasks = taskQueueMap[patient.deptCode] || taskQueueMap.internal;
    const taskListHtml = tasks.map((task, i) => `
        <div class="task-item ${i === 0 ? 'active' : ''}">
            <div class="task-number">${i + 1}</div>
            <div class="task-name">${task.name}</div>
            <div class="task-location">${task.location}</div>
        </div>
    `).join('');

    const content = document.getElementById('detailContent');
    content.innerHTML = `
        <div class="detail-grid">
            <div class="detail-section">
                <h5>基本信息</h5>
                <div class="detail-item">
                    <span class="detail-label">姓名</span>
                    <span class="detail-value">${patient.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">脱敏ID</span>
                    <span class="detail-value" style="color: #5c7cfa; font-family: monospace;">${patient.maskedId}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">目标科室</span>
                    <span class="detail-value">${patient.dept}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">手环ID</span>
                    <span class="detail-value" style="font-family: monospace;">${patient.braceletId}</span>
                </div>
            </div>
            <div class="detail-section">
                <h5>绑定信息</h5>
                <div class="detail-item">
                    <span class="detail-label">绑定时间</span>
                    <span class="detail-value">${patient.bindTime}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">状态</span>
                    <span class="detail-value">${patient.status === 'active' ? '已绑定' : '已解绑'}</span>
                </div>
            </div>
            <div class="detail-section full" style="grid-column: 1 / -1;">
                <h5>任务队列</h5>
                <div class="task-queue" style="margin-top: 8px;">
                    ${taskListHtml}
                </div>
            </div>
        </div>
    `;
    document.getElementById('detailModal').classList.add('show');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
}

// 验证身份证号
function validateIdCard(idCard) {
    return /^\d{17}[\dXx]$/.test(idCard);
}

// 隐藏身份证中间部分
function maskIdCard(idCard) {
    if (!idCard || idCard.length < 18) return idCard;
    return idCard.substring(0, 6) + '********' + idCard.substring(14);
}

// ===================== API 对接层 =====================

/** 创建患者 → POST /api/patient */
async function createPatientApi(data) {
    try {
        const res = await businessApi.createPatient(data);
        if (res.code === 200) return res.data;
        console.warn('创建患者返回非 200:', res);
        return null;
    } catch (error) {
        console.error('创建患者失败:', error);
        return null;
    }
}

/** 更新患者 → PUT /api/patient/:id */
async function updatePatientApi(id, data) {
    try {
        const res = await businessApi.updatePatient(id, data);
        return res.code === 200;
    } catch (error) {
        console.error('更新患者失败:', error);
        return false;
    }
}

/** 分页查询患者 → GET /api/patient/page */
async function fetchPatientsApi(current, size, keyword) {
    try {
        const res = await businessApi.getPatientPage({ current, size, keyword: keyword || '' });
        if (res.code === 200) return res.data;
        console.warn('获取患者列表返回非 200:', res);
        return null;
    } catch (error) {
        console.error('获取患者列表失败:', error);
        return null;
    }
}

/** 加载手环库存概览 → GET /api/bracelet/summary */
async function loadBraceletSummary() {
    try {
        const res = await businessApi.getBraceletSummary();
        if (res.code === 200 && res.data) {
            document.getElementById('totalBracelets').textContent = res.data.totalBracelets || 0;
            document.getElementById('boundBracelets').textContent = res.data.boundCount || 0;
            document.getElementById('availableBracelets').textContent = res.data.availableCount || 0;
            document.getElementById('todayAssigned').textContent = res.data.todayIssued || 0;
        }
    } catch (e) {
        console.warn('获取手环概览失败，使用本地计算:', e.message);
        updateSummaryStats();
    }
}

/** 删除/解绑患者 → DELETE /api/patient/:id */
async function deletePatientApi(id) {
    try {
        const res = await businessApi.deletePatient(id);
        return res.code === 200;
    } catch (error) {
        console.error('删除患者失败:', error);
        return false;
    }
}