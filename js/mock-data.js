/**
 * 智环引诊 - 总站模拟数据中心
 *
 * 当后端 API 不可达时自动降级使用模拟数据，确保控制中心各页面
 * 在无后端环境下也能展示完整的功能演示。
 *
 * 开关: 修改 MOCK_MODE 变量即可切换
 *   - 'auto'  : 先尝试真实 API，失败后降级到模拟 (默认)
 *   - 'always' : 始终使用模拟数据（离线 demo 模式）
 *   - 'never'  : 始终使用真实 API
 */

const MOCK_MODE = 'always';

// ===================== 模拟数据定义 =====================

var _now = new Date();
var _ts = function(offsetMin) { return new Date(_now.getTime() + offsetMin*60000).toISOString().replace('T',' ').substring(0,19); };
var _today = _now.toISOString().split('T')[0];

const MOCK = {
    // ── Dashboard KPI ──
    kpi: {
        todayVisits: 3247,
        currentOnsite: 1247,
        pendingAlarms: 5,
        deptUtilization: 72.8,
        boundBracelets: 186,
        availableBracelets: 42,
    },

    // ── 科室负载 (12 科，排队总和 ≈ currentOnsite) ──
    deptLoad: [
        { deptName: '检验科', queueCount: 78, utilization: 92, loadStatus: 'danger', avgWaitMinutes: 38 },
        { deptName: '影像科', queueCount: 65, utilization: 85, loadStatus: 'danger', avgWaitMinutes: 32 },
        { deptName: '急诊科', queueCount: 52, utilization: 78, loadStatus: 'warning', avgWaitMinutes: 12 },
        { deptName: '心内科', queueCount: 48, utilization: 72, loadStatus: 'warning', avgWaitMinutes: 25 },
        { deptName: '内科', queueCount: 42, utilization: 65, loadStatus: 'warning', avgWaitMinutes: 22 },
        { deptName: '儿科', queueCount: 38, utilization: 60, loadStatus: 'warning', avgWaitMinutes: 28 },
        { deptName: '骨科', queueCount: 35, utilization: 55, loadStatus: 'normal', avgWaitMinutes: 20 },
        { deptName: '消化内科', queueCount: 32, utilization: 50, loadStatus: 'normal', avgWaitMinutes: 18 },
        { deptName: '内分泌科', queueCount: 28, utilization: 45, loadStatus: 'normal', avgWaitMinutes: 15 },
        { deptName: '皮肤科', queueCount: 22, utilization: 40, loadStatus: 'normal', avgWaitMinutes: 12 },
        { deptName: '外科', queueCount: 20, utilization: 35, loadStatus: 'normal', avgWaitMinutes: 10 },
        { deptName: '中医科', queueCount: 15, utilization: 28, loadStatus: 'normal', avgWaitMinutes: 8 },
    ],

    // ── 实时警报 ──
    alarms: [
        { id: 1, level: 5, patientName: '王大爷', createdAt: _ts(-5), location: '2F-洗手间附近',
            description: '患者突感胸闷并摔倒，心率异常（128bpm），急需急救响应', type: '紧急急救', status: 'pending' },
        { id: 2, level: 4, patientName: '李女士', createdAt: _ts(-12), location: '1F-电梯厅',
            description: '糖尿病低血糖晕厥风险，血糖3.2mmol/L，需立即处置', type: '生命体征异常', status: 'pending' },
        { id: 3, level: 3, patientName: '孙大爷', createdAt: _ts(-18), location: '3F-检验科门口',
            description: '患者等待超60分钟，年龄78岁，建议优先安排', type: '排队超时', status: 'pending' },
        { id: 4, level: 2, patientName: '赵阿姨', createdAt: _ts(-25), location: '2F-外科候诊区',
            description: '需要轮椅协助转移至影像科', type: '轮椅需求', status: 'processing' },
        { id: 5, level: 1, patientName: '', createdAt: _ts(-40), location: '1F-药房子站7号',
            description: '打印设备离线超过15分钟，需维护人员检查', type: '设备维护', status: 'pending' },
    ],

    // ── 患者来源分布 ──
    sourceDistribution: [
        { label: '自助挂号机', count: 1105, percentage: 34 }, { label: '人工窗口', count: 812, percentage: 25 },
        { label: '线上预约', count: 682, percentage: 21 },    { label: '急诊通道', count: 325, percentage: 10 },
        { label: '转诊', count: 195, percentage: 6 },         { label: '其他', count: 128, percentage: 4 },
    ],

    // ── 24小时流量趋势 (每2小时) ──
    trafficTrend: [
        { hour: 0, count: 32 },  { hour: 1, count: 18 },  { hour: 2, count: 12 },  { hour: 3, count: 8 },
        { hour: 4, count: 15 },  { hour: 5, count: 28 },  { hour: 6, count: 85 },  { hour: 7, count: 198 },
        { hour: 8, count: 356 }, { hour: 9, count: 428 }, { hour: 10, count: 385 },{ hour: 11, count: 312 },
        { hour: 12, count: 248 },{ hour: 13, count: 295 },{ hour: 14, count: 342 },{ hour: 15, count: 318 },
        { hour: 16, count: 275 },{ hour: 17, count: 212 },{ hour: 18, count: 168 },{ hour: 19, count: 125 },
        { hour: 20, count: 92 }, { hour: 21, count: 65 }, { hour: 22, count: 48 }, { hour: 23, count: 35 },
    ],

    // ── 系统运行状态 ──
    systemStatus: {
        status: 'UP',
        edgeNodes: { smartSubstations: 28, lightGuideNodes: 22, rfidSensorNodes: 14, onlineRate: 85.7 },
        deviceStatus: { nfcDevices: 28, voiceDevices: 28, pendingMaintenance: 2 },
        terminalsOnline: 24, terminalsOffline: 4, adminCount: 3,
        databaseStatus: 'UP', jvmUsedMb: 124, jvmTotalMb: 256,
    },

    // ── 调度：科室负载表 ──
    dispatchDeptLoad: [
        { deptName: '检验科', queueCount: 78, avgWaitMinutes: 38, utilization: 92, loadStatus: 'danger' },
        { deptName: '影像科', queueCount: 65, avgWaitMinutes: 32, utilization: 85, loadStatus: 'danger' },
        { deptName: '急诊科', queueCount: 52, avgWaitMinutes: 12, utilization: 78, loadStatus: 'warning' },
        { deptName: '心内科', queueCount: 48, avgWaitMinutes: 25, utilization: 72, loadStatus: 'warning' },
        { deptName: '内科', queueCount: 42, avgWaitMinutes: 22, utilization: 65, loadStatus: 'warning' },
        { deptName: '儿科', queueCount: 38, avgWaitMinutes: 28, utilization: 60, loadStatus: 'warning' },
        { deptName: '骨科', queueCount: 35, avgWaitMinutes: 20, utilization: 55, loadStatus: 'normal' },
        { deptName: '消化内科', queueCount: 32, avgWaitMinutes: 18, utilization: 50, loadStatus: 'normal' },
        { deptName: '内分泌科', queueCount: 28, avgWaitMinutes: 15, utilization: 45, loadStatus: 'normal' },
        { deptName: '皮肤科', queueCount: 22, avgWaitMinutes: 12, utilization: 40, loadStatus: 'normal' },
        { deptName: '外科', queueCount: 20, avgWaitMinutes: 10, utilization: 35, loadStatus: 'normal' },
        { deptName: '中医科', queueCount: 15, avgWaitMinutes: 8, utilization: 28, loadStatus: 'normal' },
    ],

    // ── 调度建议 ──
    suggestions: [
        { fromDeptId: 1, toDeptId: 3, fromDeptName: '检验科', toDeptName: '影像科',
            fromUtilization: 92, toUtilization: 85, suggestedCount: 8, reason: '检验科排队78人（超阈值56%），建议分流8人至影像科' },
        { fromDeptId: 2, toDeptId: 5, fromDeptName: '心内科', toDeptName: '内科',
            fromUtilization: 72, toUtilization: 65, suggestedCount: 5, reason: '心内科等待时间25min，内科仅22min，可分流5人' },
        { fromDeptId: 3, toDeptId: 8, fromDeptName: '急诊科', toDeptName: '消化内科',
            fromUtilization: 78, toUtilization: 50, suggestedCount: 3, reason: '急诊科部分非紧急患者可转消化内科' },
        { fromDeptId: 4, toDeptId: 11, fromDeptName: '儿科', toDeptName: '皮肤科',
            fromUtilization: 60, toUtilization: 40, suggestedCount: 4, reason: '儿科皮肤问题患儿可转皮肤科，减少交叉感染' },
    ],

    // ── 应急警报列表 (200条，多日历史 + 实时，匹配后端字段) ──
    emergencyAlarms: {
        records: (function() {
            // 后端类型码: emergency, vital, fall, maintenance, wheelchair, broadcast
            var typeDefs = [
                { type:'emergency', level:5, label:'紧急急救' },
                { type:'vital',      level:4, label:'生命体征异常' },
                { type:'fall',       level:5, label:'患者摔倒' },
                { type:'wheelchair', level:2, label:'轮椅需求' },
                { type:'maintenance',level:2, label:'设备维护' },
                { type:'broadcast',  level:1, label:'广播通知' },
                { type:'emergency',  level:4, label:'突发疾病' },
                { type:'vital',      level:3, label:'心率异常' },
                { type:'fall',       level:4, label:'跌倒检测' },
                { type:'wheelchair', level:3, label:'行动不便' },
                { type:'maintenance',level:3, label:'系统故障' },
                { type:'broadcast',  level:2, label:'寻人启事' },
                { type:'emergency',  level:5, label:'心脏骤停' },
                { type:'vital',      level:5, label:'低血糖危象' },
                { type:'vital',      level:4, label:'血压危象' },
            ];
            var locs = [
                '1F-门诊大厅','1F-急诊通道','1F-挂号收费处','1F-导诊台','1F-药房取药处',
                '1F-电梯厅','1F-输液室','1F-候诊A区','1F-卫生间东侧','1F-入口安检处',
                '2F-内科候诊区','2F-外科候诊区','2F-心内科候诊区','2F-心电图室门口','2F-超声科门口',
                '2F-洗手间附近','2F-走廊北段','2F-内科诊室3号','2F-抽血处','2F-走廊南段',
                '3F-检验科门口','3F-影像科候诊区','3F-儿科候诊区','3F-眼科候诊区','3F-内镜中心',
                '3F-骨科候诊区','3F-皮肤科门口','3F-中医科候诊区','3F-耳鼻喉科','3F-康复科',
                'B1-停车场电梯','B1-地下停车场','B1-药库门口','B1-设备间','B1-职工通道',
                '药房子站7号','药房子站3号','门诊一层子站','门诊二层子站','门诊三层子站',
            ];
            var names = [
                '王大爷','李女士','孙大爷','赵阿姨','张先生','周女士','郑阿姨',
                '吴先生','钱先生','朱大爷','刘波','陈静','高明','潘婷','宋雨',
                '韩磊','唐芳','秦风','田敏','钱多','孙悦','马超','孟凡','丁丁',
                '方女士','万丽','任敏','彭飞','何大爷','林女士','杨婆婆','许先生',
                '沈大爷','姜女士','范先生','蒋阿姨','魏大爷','冯女士','苏先生',
                '潘大爷','蔡女士','余先生','邓女士','叶先生','龙大爷','廖女士',
                '贺先生','夏女士','白大爷','崔女士','康先生','邱大爷','秦女士',
                '江先生','史女士','侯大爷','邵女士','毛先生','龚大爷','赖女士',
            ];
            var descs = [
                '患者突发胸闷摔倒，心率异常128bpm，急需急救响应',
                '糖尿病低血糖晕厥风险，血糖3.2mmol/L，需立即处置',
                '等待超60分钟，高龄78岁，建议优先安排就诊',
                '需要轮椅协助转移至影像科，患者行动不便',
                '打印设备离线超15分钟，需技术人员到场检修',
                '候诊区患者情绪激动大声喧哗，影响正常秩序',
                '患者突感头晕站立不稳，血压偏高需关注',
                '疑似癫痫发作，口吐白沫意识模糊，需紧急抢救',
                '轮椅电池耗尽无法正常启动，需更换备用设备',
                '设备温度过高自动关机，需冷却后重启恢复',
                '老年患者迷路找不到目标科室，急需导引协助',
                '轮椅通道被杂物堵塞，需立即清理恢复通行',
                '智能手环信号丢失超过10分钟，需排查定位',
                '患者心率持续超过140bpm，疑似房颤需紧急评估',
                '血糖检测3.0mmol/L，患者意识模糊急需急救',
                '血压210/130mmHg，高血压危象可能性大',
                '体温39.8°C持续不退，疑似严重感染需处理',
                '摔倒后无法自行站立，疑似髋部骨折需担架',
                '导诊机器人故障停在走廊中央，严重阻碍通行',
                'NFC感应器响应超时，需重新校准设备参数',
                '候诊区患者突然晕倒面色苍白，周围群众呼救',
                '广播系统3区无声音输出，需检查线路连接',
                '老年痴呆患者走失超过30分钟，家属紧急求助',
                '输液架意外倒塌砸到患者脚部，需紧急处理',
                '药房子站显示屏花屏无法查看叫号信息',
                '心内科候诊区座椅损坏导致患者摔倒受伤',
                '急诊通道救护车担架碰撞，患者二次受伤风险',
                '检验科试管架倒塌，标本散落一地需紧急清理',
                '影像科CT机报警异常，检查中患者被困设备内',
                '儿科候诊区孩童追逐打闹撞倒输液架',
                '眼科候诊区老人突发心脏病，面色发紫',
                'B1停车场电梯困人，多名患者被困超过5分钟',
                '门诊大厅自动门故障，多名患者被夹伤风险',
                '抽血处患者晕针晕倒，头部撞到地面出血',
                '中医科候诊区患者突然咳血，疑似肺结核发作',
                '超声波检查室患者突发过敏反应，全身皮疹',
                '内镜中心患者术前突发房颤，需紧急评估',
                '康复科患者训练中摔倒，腿部疑似再次骨折',
                '皮肤科候诊区儿童高热惊厥，抽搐不止',
                '耳鼻喉科患者异物卡喉窒息，面色发紫需急救',
            ];
            var terminals = [
                '门诊一层子站','门诊二层子站','门诊三层子站','B1层子站',
                '药房子站7号','挂号处子站','急诊通道子站','检验科子站',
                '影像科子站','心内科子站','儿科子站','导诊台子站',
                '外科子站','内科子站','眼科子站','收费处子站',
            ];
            var handlers = ['值班管理员','张护士','李医生','王护士长','赵主管','陈技师','周主任','刘值班','杨护士','黄医生'];
            var handlerNotes = [
                '已妥善处理，患者恢复正常就诊','急救人员已到场，患者转至急诊科',
                '已协调优先就诊，患者表示满意','轮椅已送达指定位置并协助转移',
                '设备已重启恢复，功能正常','已通知导诊台协助引导患者至目标科室',
                '已安排专人引导至目标科室','已安抚患者情绪并优先安排就诊',
                '已更换备用设备并恢复正常使用','已通过广播系统通知相关人员到场',
                '已转至急诊科进一步观察治疗','已联系家属到场，患者情况稳定',
                '已恢复正常排队秩序，安抚等候患者','已完成设备检修并签单确认',
                '值班护士已现场处理完毕','已通知保洁清理通道恢复通畅',
                '已联系技术部远程修复系统故障','经医生评估后转至留观室观察',
                '已协调保安维持现场秩序','已安排志愿者协助老年患者',
            ];

            var recs = [];
            // 生成200条：today(45条), 昨天(35条), 前天(30条), D-3~D-14(各7-8条)
            for (var i = 0; i < 200; i++) {
                var dayOffset;
                if (i < 45) dayOffset = 0;
                else if (i < 80) dayOffset = -1;
                else if (i < 110) dayOffset = -2;
                else if (i < 125) dayOffset = -3;
                else dayOffset = -(3 + Math.floor((i - 125) / 8));

                // 状态分布: 越近越多pending，越远越多closed
                var s;
                if (dayOffset === 0) {
                    var rnd = i % 20;
                    if (rnd < 5) s = 'pending';
                    else if (rnd < 9) s = 'processing';
                    else if (rnd < 16) s = 'closed';
                    else if (rnd < 18) s = 'ignored';
                    else s = 'postponed';
                } else if (dayOffset === -1) {
                    var rnd2 = i % 12;
                    if (rnd2 < 1) s = 'pending';
                    else if (rnd2 < 3) s = 'processing';
                    else if (rnd2 < 10) s = 'closed';
                    else s = 'ignored';
                } else {
                    var rnd3 = i % 8;
                    if (rnd3 < 1) s = 'processing';
                    else if (rnd3 < 6) s = 'closed';
                    else if (rnd3 < 7) s = 'ignored';
                    else s = 'postponed';
                }

                var thisDay = new Date(_now.getTime() + dayOffset * 86400000);
                var dayStr = thisDay.toISOString().split('T')[0];
                var hour = 7 + (i % 13);  // 7:00-19:00
                var min = (i * 7 + 3) % 60;
                var sec = (i * 13 + 7) % 60;
                var createdAt = dayStr + ' ' + String(hour).padStart(2,'0') + ':' + String(min).padStart(2,'0') + ':' + String(sec).padStart(2,'0');

                var td = typeDefs[i % typeDefs.length];
                var r = {
                    id: 2000 + i,
                    alarmCode: 'ALM-' + dayStr.replace(/-/g,'') + '-' + String(i+1).padStart(4,'0'),
                    type: td.type,
                    level: td.level,
                    location: locs[i % locs.length],
                    patientName: names[i % names.length],
                    patientId: 3000 + (i % names.length),
                    status: s,
                    terminalName: terminals[i % terminals.length],
                    terminalId: 4000 + (i % terminals.length),
                    terminalCode: 'SUB-' + (Math.floor(i%4)+1) + 'F-' + String(i%5+1).padStart(2,'0'),
                    description: descs[i % descs.length],
                    createdAt: createdAt,
                };

                if (s === 'closed' || s === 'completed' || s === 'processing') {
                    var hh = Math.min(23, hour + 1 + Math.floor((i*3)%3));
                    var mm = (min + 15 + Math.floor((i*7)%30)) % 60;
                    r.handledAt = dayStr + ' ' + String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0') + ':' + String((sec+17)%60).padStart(2,'0');
                    r.handleNote = handlerNotes[i % handlerNotes.length];
                    r.handlerName = handlers[i % handlers.length];
                }
                if (s === 'postponed') {
                    r.postponeUntil = _ts(dayOffset * 1440 + 120);
                }
                recs.push(r);
            }
            recs.sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
            return recs;
        })(),
        total: 200, current: 1, size: 50,
    },

    // ── 应急处理记录 (100条历史数据，匹配后端字段) ──
    emergencyRecords: (function() {
        var typeDefs = [
            { type:'emergency', level:5 }, { type:'vital', level:4 },
            { type:'fall', level:5 },      { type:'wheelchair', level:2 },
            { type:'maintenance', level:2 },{ type:'broadcast', level:1 },
            { type:'emergency', level:4 }, { type:'vital', level:3 },
            { type:'fall', level:4 },      { type:'wheelchair', level:3 },
        ];
        var locs = [
            '1F-门诊大厅','1F-急诊通道','1F-挂号收费处','1F-导诊台','1F-药房取药处',
            '2F-内科候诊区','2F-外科候诊区','2F-心内科候诊区','2F-心电图室门口','2F-超声科门口',
            '3F-检验科门口','3F-影像科候诊区','3F-儿科候诊区','3F-眼科候诊区','3F-内镜中心',
            'B1-停车场电梯','B1-地下停车场','1F-电梯厅','2F-洗手间附近','3F-骨科候诊区',
        ];
        var names = [
            '赵先生','孙阿姨','周女士','钱大爷','李女士','王大爷','郑阿姨',
            '吴先生','张先生','朱女士','马先生','杨大爷','刘波','陈静',
            '高明','潘婷','宋雨','韩磊','唐芳','秦风','田敏','钱多',
            '孙悦','马超','孟凡','丁丁','方女士','万丽','任敏','彭飞',
            '何大爷','林女士','杨婆婆','许先生','沈大爷','姜女士','范先生',
            '蒋阿姨','魏大爷','冯女士','苏先生','潘大爷','蔡女士','余先生',
            '邓女士','叶先生','龙大爷','廖女士','贺先生','夏女士','白大爷',
        ];
        var notes = [
            '已妥善处理，患者恢复正常就诊','已安排急救人员到场并转至急诊科',
            '已协调优先就诊，患者表示满意','轮椅已送达，患者顺利转至影像科',
            '设备已重启恢复正常运行','已通知导诊台协助引导患者',
            '已安排专人引导至目标科室','已安抚患者情绪并优先安排就诊',
            '已更换备用设备恢复正常','已通过广播系统通知相关人员',
            '已转至急诊科进一步观察治疗','已联系家属到场，情况稳定',
            '已恢复正常排队秩序','已完成设备检修并签单确认',
            '值班护士已现场妥善处理','已通知保洁清理通道',
            '已联系技术部远程修复','经医生评估后转至留观室',
            '已协调保安维持现场秩序','已安排志愿者协助老年患者',
            '急救药品已使用，患者体征恢复正常','家属已到场，患者转院治疗',
            '经心电图检查排除心梗，继续观察','已预约次日专科门诊复查',
            'CT检查完成无异常，患者自行离开','已通知营养科会诊调整饮食方案',
        ];
        var recs = [];
        for (var i = 0; i < 100; i++) {
            var td = typeDefs[i % typeDefs.length];
            var r = {
                id: 5000 + i,
                alarmCode: 'ALM-' + new Date(_now.getTime() - (i*420+30)*60000).toISOString().split('T')[0].replace(/-/g,'') + '-' + String(i+1).padStart(4,'0'),
                type: td.type,
                level: td.level,
                location: locs[i % locs.length],
                patientName: names[i % names.length],
                patientId: 3000 + (i % names.length),
                status: 'closed',
                createdAt: _ts(-(i*420 + 30)),
                handledAt: _ts(-(i*420 - 20)),
                handleNote: notes[i % notes.length],
                handlerName: i % 3 === 0 ? '张护士' : (i % 3 === 1 ? '李医生' : '值班管理员'),
                terminalName: '门诊' + (Math.floor(i%3)+1) + '层子站',
                terminalId: 4000 + (i % 16),
                description: locs[i % locs.length] + '发生' + td.label + '事件，已处理完毕',
            };
            recs.push(r);
        }
        return recs;
    })(),

    // ── 数据分析：综合详情 ──
    analyticsDetail: {
        totalVisits: 128500, queuedVisits: 475, inProgressVisits: 238, finishedVisits: 127787,
        averageSatisfaction: 4.38, busiestDept: '检验科', pendingAlarms: 5,
        yearOverYearGrowth: 15.2, monthOverMonthGrowth: 5.1,
        avgWaitMinutes: 18.5, avgVisitDuration: 42,
        peakHourVisits: 528, peakHour: '上午9点',
        returnVisitRate: 72, onlineBookingRate: 24,
    },

    // ── 月度趋势 (24个月，2024年9月 - 2026年8月) ──
    monthlyTrend: [
        { month: '2024-09', visitCount: 3850, satisfaction: 4.12, finishRate: 96.2 },
        { month: '2024-10', visitCount: 4020, satisfaction: 4.15, finishRate: 96.5 },
        { month: '2024-11', visitCount: 4180, satisfaction: 4.18, finishRate: 96.8 },
        { month: '2024-12', visitCount: 3950, satisfaction: 4.20, finishRate: 97.0 },
        { month: '2025-01', visitCount: 4520, satisfaction: 4.22, finishRate: 97.1 },
        { month: '2025-02', visitCount: 3680, satisfaction: 4.25, finishRate: 97.3 },
        { month: '2025-03', visitCount: 5120, satisfaction: 4.28, finishRate: 97.2 },
        { month: '2025-04', visitCount: 5350, satisfaction: 4.26, finishRate: 97.0 },
        { month: '2025-05', visitCount: 5580, satisfaction: 4.30, finishRate: 97.4 },
        { month: '2025-06', visitCount: 5280, satisfaction: 4.29, finishRate: 97.5 },
        { month: '2025-07', visitCount: 5820, satisfaction: 4.31, finishRate: 97.3 },
        { month: '2025-08', visitCount: 4980, satisfaction: 4.28, finishRate: 97.6 },
        { month: '2025-09', visitCount: 4820, satisfaction: 4.30, finishRate: 97.5 },
        { month: '2025-10', visitCount: 5100, satisfaction: 4.32, finishRate: 97.8 },
        { month: '2025-11', visitCount: 5350, satisfaction: 4.33, finishRate: 97.6 },
        { month: '2025-12', visitCount: 4980, satisfaction: 4.35, finishRate: 97.9 },
        { month: '2026-01', visitCount: 5620, satisfaction: 4.34, finishRate: 97.7 },
        { month: '2026-02', visitCount: 4380, satisfaction: 4.36, finishRate: 98.0 },
        { month: '2026-03', visitCount: 6100, satisfaction: 4.35, finishRate: 97.8 },
        { month: '2026-04', visitCount: 6580, satisfaction: 4.37, finishRate: 98.1 },
        { month: '2026-05', visitCount: 7220, satisfaction: 4.38, finishRate: 98.2 },
        { month: '2026-06', visitCount: 6850, satisfaction: 4.36, finishRate: 98.0 },
        { month: '2026-07', visitCount: 7450, satisfaction: 4.39, finishRate: 98.3 },
        { month: '2026-08', visitCount: 5240, satisfaction: 4.40, finishRate: 98.5 },
    ],

    // ── 科室排行 (含季度对比) ──
    deptRanking: [
        { deptName:'检验科', visitCount:15800, q1:3800, q2:4200, q3:4100, q4:3700, avgWait:22, satisfaction:4.25, trend:'up' },
        { deptName:'影像科', visitCount:13200, q1:3100, q2:3500, q3:3400, q4:3200, avgWait:18, satisfaction:4.30, trend:'up' },
        { deptName:'急诊科', visitCount:11500, q1:2800, q2:3000, q3:2900, q4:2800, avgWait:8, satisfaction:4.15, trend:'stable' },
        { deptName:'心内科', visitCount:9800,  q1:2300, q2:2600, q3:2500, q4:2400, avgWait:25, satisfaction:4.42, trend:'up' },
        { deptName:'内科', visitCount:9200,    q1:2200, q2:2400, q3:2350, q4:2250, avgWait:20, satisfaction:4.28, trend:'stable' },
        { deptName:'儿科', visitCount:7800,    q1:1800, q2:2100, q3:2000, q4:1900, avgWait:28, satisfaction:4.35, trend:'up' },
        { deptName:'骨科', visitCount:6500,    q1:1500, q2:1700, q3:1650, q4:1650, avgWait:22, satisfaction:4.38, trend:'stable' },
        { deptName:'消化内科', visitCount:5800, q1:1350, q2:1500, q3:1480, q4:1470, avgWait:18, satisfaction:4.32, trend:'up' },
        { deptName:'内分泌科', visitCount:5200, q1:1200, q2:1350, q3:1320, q4:1330, avgWait:15, satisfaction:4.40, trend:'stable' },
        { deptName:'外科', visitCount:4800,    q1:1100, q2:1250, q3:1220, q4:1230, avgWait:10, satisfaction:4.22, trend:'down' },
        { deptName:'皮肤科', visitCount:3900,  q1:900,  q2:1000, q3:1020, q4:980,  avgWait:12, satisfaction:4.45, trend:'up' },
        { deptName:'中医科', visitCount:3200,  q1:700,  q2:850,  q3:830,  q4:820,  avgWait:8, satisfaction:4.50, trend:'up' },
    ],

    // ── 满意度分布 ──
    satisfaction: [
        { score: 5, count: 7280, percentage: 48 }, { score: 4, count: 4550, percentage: 30 },
        { score: 3, count: 2120, percentage: 14 }, { score: 2, count: 760, percentage: 5 },
        { score: 1, count: 455, percentage: 3 },
    ],

    // ── 月度满意度趋势 (12个月) ──
    monthlySatisfaction: [
        { month:'2025-09', avgScore:4.30, totalRatings:1280, praiseRate:76 },
        { month:'2025-10', avgScore:4.32, totalRatings:1350, praiseRate:77 },
        { month:'2025-11', avgScore:4.33, totalRatings:1420, praiseRate:78 },
        { month:'2025-12', avgScore:4.35, totalRatings:1250, praiseRate:79 },
        { month:'2026-01', avgScore:4.34, totalRatings:1480, praiseRate:78 },
        { month:'2026-02', avgScore:4.36, totalRatings:1120, praiseRate:80 },
        { month:'2026-03', avgScore:4.35, totalRatings:1620, praiseRate:79 },
        { month:'2026-04', avgScore:4.37, totalRatings:1750, praiseRate:81 },
        { month:'2026-05', avgScore:4.38, totalRatings:1920, praiseRate:82 },
        { month:'2026-06', avgScore:4.36, totalRatings:1810, praiseRate:80 },
        { month:'2026-07', avgScore:4.39, totalRatings:1980, praiseRate:83 },
        { month:'2026-08', avgScore:4.40, totalRatings:1380, praiseRate:84 },
    ],

    // ── 近30天每日统计 (确定性数据，不依赖 Math.random) ──
    dailyStats: (function() {
        var days = [];
        for (var d = 29; d >= 0; d--) {
            var date = new Date(_now.getTime() - d * 86400000);
            var ds = date.toISOString().split('T')[0];
            var dayOfWeek = date.getDay(); // 0=周日, 1=周一...
            // 工作日就诊量大，周末少
            var isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
            var baseVisits = isWeekend ? 1800 : 3100;
            // 用日期数字做伪随机波动，保证确定性
            var seed = date.getDate() * 7 + date.getMonth() * 31;
            var wave = Math.floor(Math.sin(d * 0.22) * 500);
            var noise = ((seed * 1103 + 47) % 401) - 200; // 确定性伪随机 [-200, 200]
            var visitCount = baseVisits + wave + noise;
            // 满意度: 4.1-4.6 之间确定性波动
            var sat = (4.2 + ((seed * 71 + 13) % 41) / 100).toFixed(2);
            // 告警数: 2-8
            var alarms = 2 + ((seed * 37 + 19) % 7);
            // 峰值排队: 35-85
            var peakQueue = 35 + ((seed * 53 + 27) % 51);
            days.push({
                date: ds,
                visitCount: visitCount,
                completedCount: Math.floor(visitCount * 0.97),
                avgSatisfaction: sat,
                alarmCount: alarms,
                peakQueueLength: peakQueue,
            });
        }
        return days;
    })(),

    // ── 系统设置 ──
    settings: {
        groups: [
            { settingGroup: '系统参数', items: [
                { settingKey: 'max_queue_size', settingValue: '80', description: '科室最大排队人数' },
                { settingKey: 'alert_threshold', settingValue: '15', description: '等待时间告警阈值(分钟)' },
                { settingKey: 'auto_backup_hour', settingValue: '3', description: '每日自动备份时间(时)' },
                { settingKey: 'session_timeout', settingValue: '480', description: '会话超时时间(分钟)' },
            ]},
            { settingGroup: '通知配置', items: [
                { settingKey: 'sms_enabled', settingValue: 'true', description: '短信通知' },
                { settingKey: 'broadcast_enabled', settingValue: 'true', description: '语音广播' },
                { settingKey: 'wechat_enabled', settingValue: 'true', description: '微信通知' },
                { settingKey: 'email_enabled', settingValue: 'false', description: '邮件通知' },
            ]},
            { settingGroup: '分流策略', items: [
                { settingKey: 'auto_triage', settingValue: 'true', description: '自动分流' },
                { settingKey: 'max_suggestions', settingValue: '5', description: '最大建议数' },
                { settingKey: 'min_util_diff', settingValue: '15', description: '最小利用率差(%)' },
            ]},
        ],
        backups: [
            { id: 1, backupType: 'manual', fileSize: 245760, status: 'success', createdAt: _ts(-1440) },
            { id: 2, backupType: 'auto', fileSize: 238400, status: 'success', createdAt: _ts(-2880) },
            { id: 3, backupType: 'auto', fileSize: 231200, status: 'success', createdAt: _ts(-4320) },
            { id: 4, backupType: 'manual', fileSize: 250100, status: 'success', createdAt: _ts(-5760) },
            { id: 5, backupType: 'auto', fileSize: 0, status: 'failed', createdAt: _ts(-7200) },
        ],
    },

    // ── 子站列表 ──
    substations: {
        records: (function() {
            // 28 个子站：1F/2F/3F/B1 各 7 个，其中 4 个离线（24 在线），与 systemStatus 一致
            var floorDefs = [
                { floor: '1F', names: ['门诊大厅','电梯厅','挂号收费处','导诊台','药房取药处','急诊通道','输液室'] },
                { floor: '2F', names: ['走廊北','检验科','心内科候诊区','外科候诊区','内科候诊区','心电图室','超声科'] },
                { floor: '3F', names: ['影像科','内科诊区','儿科诊区','眼科候诊区','骨科候诊区','皮肤科','中医科'] },
                { floor: 'B1', names: ['地下停车场','药库','设备间','职工通道','消毒供应','后勤仓库','急诊通道'] },
            ];
            var offlineKeys = { '2F-超声科': 1, '3F-眼科候诊区': 1, 'B1-设备间': 1, 'B1-后勤仓库': 1 };
            var recs = [];
            var seq = 0;
            floorDefs.forEach(function(f) {
                f.names.forEach(function(n) {
                    seq++;
                    var key = f.floor + '-' + n;
                    recs.push({
                        terminalCode: 'SUB-' + f.floor + '-' + String(seq).padStart(2, '0'),
                        terminalName: key,
                        status: offlineKeys[key] ? 0 : 1,
                        createdAt: '2026-03-' + String((seq % 28) + 1).padStart(2, '0'),
                    });
                });
            });
            return recs;
        })(),
        total: 28, current: 1, size: 50,
    },

    // ── 任务 KPI ──
    tasksKpi: {
        executingCount: 8, todayInserted: 24, completedCount: 230,
        completionRate: 87.8, activeSubstations: 7,
    },

    // ── 任务列表（8 条患者任务序列） ──
    tasksList: (() => {
        const taskSeqs = {
            '心内科': ['挂号登记','心电图检查','医生问诊','缴费结算','取药'],
            '内分泌科': ['挂号登记','血糖检测','医生问诊','缴费结算','取药'],
            '消化内科': ['挂号登记','候诊排队','医生问诊','胃镜检查预约','缴费结算'],
            '内科': ['挂号登记','候诊排队','医生问诊','缴费结算','取药'],
            '外科': ['挂号登记','候诊排队','医生问诊','影像检查','缴费结算'],
            '皮肤科': ['挂号登记','候诊排队','医生问诊','皮肤检测','缴费取药'],
            '儿科': ['挂号登记','候诊排队','医生问诊','缴费结算','取药'],
        };
        const patients = [
            { name: '王大爷', dept: '心内科', maskedId:'PAT-7A3B-9C2D', station:'A-01' },
            { name: '李女士', dept: '内分泌科', maskedId:'PAT-2E8F-4D1A', station:'A-02' },
            { name: '张先生', dept: '消化内科', maskedId:'PAT-5B1C-7E3F', station:'A-03' },
            { name: '赵阿姨', dept: '内科', maskedId:'PAT-9D4A-2B8E', station:'A-04' },
            { name: '孙大爷', dept: '外科', maskedId:'PAT-1F7C-5A3D', station:'A-05' },
            { name: '周女士', dept: '皮肤科', maskedId:'PAT-6E2B-8F4C', station:'A-06' },
            { name: '吴先生', dept: '外科', maskedId:'PAT-3A9D-1E7B', station:'A-07' },
            { name: '郑阿姨', dept: '儿科', maskedId:'PAT-8C5F-3A2E', station:'A-08' },
        ];
        return patients.map((p, i) => {
            const seqNames = taskSeqs[p.dept] || taskSeqs['内科'];
            const currentIdx = Math.floor(Math.random() * (seqNames.length - 1)) + 1;
            const steps = seqNames.map((stepName, j) => ({
                name: stepName, step: j + 1,
                status: j < currentIdx ? 'completed' : j === currentIdx ? 'current' : 'pending',
                time: new Date(Date.now() - (seqNames.length - j) * 1800000).toISOString().replace('T',' ').substring(0,19)
            }));
            return {
                taskId: 2000000000000000000 + i,
                patientId: 2000000000000001000 + i,
                patientName: p.name,
                maskedId: p.maskedId,
                dept: p.dept,
                station: p.station,
                status: 'active',
                currentStep: seqNames[currentIdx],
                steps: steps,
                sequence: currentIdx + 1,
                stationLocation: '1F-子站0' + (i + 1),
                updatedAt: new Date(Date.now() - 300000).toISOString().replace('T',' ').substring(0,19),
                insertedTasks: [],
            };
        });
    })(),

    // ── 任务事件日志 (30条，含多日历史) ──
    taskEventLog: (function() {
        var events = [
            { min:5, type:'execute', title:'任务进度更新', desc:'王大爷 完成心电图检查，进入医生问诊阶段' },
            { min:12, type:'insert', title:'任务创建', desc:'李女士 挂号登记完成，已分配至内分泌科' },
            { min:20, type:'complete', title:'任务完成', desc:'赵阿姨 取药完成，就诊流程结束' },
            { min:35, type:'adjust', title:'任务调整', desc:'张先生 胃镜检查预约调整至下午14:30' },
            { min:48, type:'insert', title:'新患者接入', desc:'钱先生 在影像科子站刷卡，自动创建引导任务' },
            { min:62, type:'execute', title:'进度推进', desc:'周女士 皮肤检测完成，进入缴费取药阶段' },
            { min:75, type:'adjust', title:'紧急插队', desc:'孙大爷 因高龄78岁，系统自动提升优先级' },
            { min:88, type:'insert', title:'子站检测', desc:'朱女士 1F-急诊通道子站检测到NFC标签' },
            { min:105, type:'execute', title:'进度推进', desc:'吴先生 完成影像检查，返回骨科候诊区' },
            { min:120, type:'complete', title:'就诊完成', desc:'郑阿姨 儿科全部5项任务完成' },
            { min:150, type:'adjust', title:'科室调度', desc:'杨阿姨 从检验科分流至影像科' },
            { min:180, type:'insert', title:'批量注册', desc:'早高峰12名患者完成挂号登记和手环绑定' },
            // 昨日事件
            { min:1500, type:'complete', title:'就诊完成', desc:'何大爷 心内科复诊完成，建议3个月后复查' },
            { min:1560, type:'adjust', title:'科室调度', desc:'检验科负载过高，5名患者分流至急诊科检验窗口' },
            { min:1620, type:'insert', title:'新患者接入', desc:'余大爷 中医科子站检测到NFC，针灸理疗任务已创建' },
            { min:1700, type:'execute', title:'进度推进', desc:'方女士 骨科完成术前检查，安排明日手术' },
            { min:1800, type:'complete', title:'就诊完成', desc:'林女士 内分泌科完成血糖监测和医生问诊' },
            { min:2000, type:'adjust', title:'紧急调整', desc:'急诊科突发大量患者，紧急启用备用诊室' },
            // 前日事件
            { min:2900, type:'execute', title:'进度推进', desc:'许女士 急诊科完成初步检查，转至影像科' },
            { min:3000, type:'insert', title:'新患者接入', desc:'刘先生 消化内科胃镜检查预约成功' },
            { min:3100, type:'complete', title:'就诊完成', desc:'马大爷 中医科针灸理疗完成，康复情况良好' },
            { min:3200, type:'adjust', title:'系统维护', desc:'B1层停车场子站离线维护，已恢复上线' },
            { min:3400, type:'execute', title:'进度推进', desc:'杨阿姨 检验科采血完成，等待化验报告' },
            { min:3600, type:'complete', title:'批量完成', desc:'今日下午共18名患者顺利完成全部就诊流程' },
            // 更早事件
            { min:4400, type:'insert', title:'系统升级', desc:'子站固件升级至v2.3.1，新增语音导引功能' },
            { min:4600, type:'execute', title:'进度推进', desc:'钱先生 影像科CT检查完成，等待报告出具' },
            { min:4800, type:'complete', title:'就诊完成', desc:'潘婷 检验科完成全部检查，取药离院' },
            { min:5200, type:'adjust', title:'流程优化', desc:'门诊大厅导诊台优化挂号流程，新增自助报到机2台' },
            { min:5600, type:'insert', title:'批量创建', desc:'周一早高峰25名患者完成登记，系统自动分配科室' },
            { min:6000, type:'complete', title:'就诊完成', desc:'宋雨 影像科核磁共振检查完成，安排复诊' },
        ];
        return events.map(function(e) {
            return { time:_ts(-e.min), type:e.type, title:e.title, description:e.desc };
        });
    })(),

    // ── 排队详情 (覆盖12个科室) ──
    queueDetail: {
        '检验科': [
            { patientName:'杨阿姨', gender:'女', age:56, queueNumber:1, arrivalTime:'2026-08-12T07:45:00', waitingTime:75, priority:'priority', status:'calling' },
            { patientName:'刘波', gender:'男', age:44, queueNumber:2, arrivalTime:'2026-08-12T08:10:00', waitingTime:50, priority:'normal', status:'waiting' },
            { patientName:'陈静', gender:'女', age:37, queueNumber:3, arrivalTime:'2026-08-12T08:25:00', waitingTime:35, priority:'normal', status:'waiting' },
            { patientName:'高明', gender:'男', age:61, queueNumber:4, arrivalTime:'2026-08-12T08:50:00', waitingTime:10, priority:'normal', status:'waiting' },
            { patientName:'潘婷', gender:'女', age:29, queueNumber:5, arrivalTime:'2026-08-12T09:05:00', waitingTime:5, priority:'normal', status:'waiting' },
        ],
        '影像科': [
            { patientName:'钱先生', gender:'男', age:48, queueNumber:1, arrivalTime:'2026-08-12T08:00:00', waitingTime:60, priority:'urgent', status:'calling' },
            { patientName:'宋雨', gender:'女', age:42, queueNumber:2, arrivalTime:'2026-08-12T08:20:00', waitingTime:40, priority:'priority', status:'waiting' },
            { patientName:'韩磊', gender:'男', age:35, queueNumber:3, arrivalTime:'2026-08-12T08:40:00', waitingTime:20, priority:'normal', status:'waiting' },
            { patientName:'唐芳', gender:'女', age:65, queueNumber:4, arrivalTime:'2026-08-12T08:55:00', waitingTime:5, priority:'normal', status:'waiting' },
        ],
        '急诊科': [
            { patientName:'朱女士', gender:'女', age:33, queueNumber:1, arrivalTime:'2026-08-12T08:05:00', waitingTime:55, priority:'urgent', status:'calling' },
            { patientName:'许女士', gender:'女', age:31, queueNumber:2, arrivalTime:'2026-08-12T08:30:00', waitingTime:30, priority:'priority', status:'waiting' },
            { patientName:'秦风', gender:'男', age:58, queueNumber:3, arrivalTime:'2026-08-12T08:45:00', waitingTime:15, priority:'normal', status:'waiting' },
        ],
        '心内科': [
            { patientName:'王大爷', gender:'男', age:72, queueNumber:1, arrivalTime:'2026-08-12T07:30:00', waitingTime:60, priority:'urgent', status:'calling' },
            { patientName:'何大爷', gender:'男', age:69, queueNumber:2, arrivalTime:'2026-08-12T08:15:00', waitingTime:45, priority:'priority', status:'waiting' },
            { patientName:'田敏', gender:'女', age:54, queueNumber:3, arrivalTime:'2026-08-12T08:40:00', waitingTime:20, priority:'normal', status:'waiting' },
        ],
        '内科': [
            { patientName:'赵阿姨', gender:'女', age:65, queueNumber:1, arrivalTime:'2026-08-12T08:30:00', waitingTime:45, priority:'priority', status:'calling' },
            { patientName:'钱多', gender:'男', age:42, queueNumber:2, arrivalTime:'2026-08-12T08:45:00', waitingTime:30, priority:'normal', status:'waiting' },
            { patientName:'孙悦', gender:'女', age:38, queueNumber:3, arrivalTime:'2026-08-12T09:00:00', waitingTime:15, priority:'normal', status:'waiting' },
            { patientName:'马超', gender:'男', age:55, queueNumber:4, arrivalTime:'2026-08-12T09:10:00', waitingTime:5, priority:'normal', status:'waiting' },
        ],
        '儿科': [
            { patientName:'郑阿姨', gender:'女', age:62, queueNumber:1, arrivalTime:'2026-08-12T08:10:00', waitingTime:50, priority:'priority', status:'calling' },
            { patientName:'孟凡', gender:'男', age:8, queueNumber:2, arrivalTime:'2026-08-12T08:30:00', waitingTime:30, priority:'normal', status:'waiting' },
            { patientName:'丁丁', gender:'女', age:5, queueNumber:3, arrivalTime:'2026-08-12T08:50:00', waitingTime:10, priority:'normal', status:'waiting' },
        ],
        '骨科': [
            { patientName:'吴先生', gender:'男', age:55, queueNumber:1, arrivalTime:'2026-08-12T08:15:00', waitingTime:50, priority:'priority', status:'calling' },
            { patientName:'方女士', gender:'女', age:43, queueNumber:2, arrivalTime:'2026-08-12T08:35:00', waitingTime:25, priority:'normal', status:'waiting' },
        ],
        '消化内科': [
            { patientName:'张先生', gender:'男', age:38, queueNumber:1, arrivalTime:'2026-08-12T08:00:00', waitingTime:55, priority:'urgent', status:'calling' },
            { patientName:'刘先生', gender:'男', age:41, queueNumber:2, arrivalTime:'2026-08-12T08:25:00', waitingTime:35, priority:'normal', status:'waiting' },
            { patientName:'段莉', gender:'女', age:46, queueNumber:3, arrivalTime:'2026-08-12T08:48:00', waitingTime:12, priority:'normal', status:'waiting' },
        ],
        '内分泌科': [
            { patientName:'李女士', gender:'女', age:45, queueNumber:1, arrivalTime:'2026-08-12T08:20:00', waitingTime:52, priority:'priority', status:'calling' },
            { patientName:'林女士', gender:'女', age:52, queueNumber:2, arrivalTime:'2026-08-12T08:42:00', waitingTime:18, priority:'normal', status:'waiting' },
            { patientName:'彭飞', gender:'男', age:39, queueNumber:3, arrivalTime:'2026-08-12T09:00:00', waitingTime:5, priority:'normal', status:'waiting' },
        ],
        '皮肤科': [
            { patientName:'周女士', gender:'女', age:28, queueNumber:1, arrivalTime:'2026-08-12T08:35:00', waitingTime:55, priority:'normal', status:'calling' },
            { patientName:'黄女士', gender:'女', age:27, queueNumber:2, arrivalTime:'2026-08-12T08:50:00', waitingTime:15, priority:'normal', status:'waiting' },
            { patientName:'康健', gender:'男', age:32, queueNumber:3, arrivalTime:'2026-08-12T08:58:00', waitingTime:2, priority:'normal', status:'waiting' },
        ],
        '外科': [
            { patientName:'孙大爷', gender:'男', age:78, queueNumber:1, arrivalTime:'2026-08-12T08:00:00', waitingTime:65, priority:'urgent', status:'calling' },
            { patientName:'徐先生', gender:'男', age:36, queueNumber:2, arrivalTime:'2026-08-12T08:30:00', waitingTime:30, priority:'normal', status:'waiting' },
            { patientName:'万丽', gender:'女', age:47, queueNumber:3, arrivalTime:'2026-08-12T08:52:00', waitingTime:8, priority:'normal', status:'waiting' },
        ],
        '中医科': [
            { patientName:'马大爷', gender:'男', age:81, queueNumber:1, arrivalTime:'2026-08-12T07:50:00', waitingTime:70, priority:'urgent', status:'calling' },
            { patientName:'余大爷', gender:'男', age:74, queueNumber:2, arrivalTime:'2026-08-12T08:20:00', waitingTime:40, priority:'priority', status:'waiting' },
            { patientName:'任敏', gender:'女', age:60, queueNumber:3, arrivalTime:'2026-08-12T08:45:00', waitingTime:15, priority:'normal', status:'waiting' },
        ],
        '_default': [
            { patientName:'周杰', gender:'男', age:35, queueNumber:1, arrivalTime:'2026-08-12T08:15:00', waitingTime:50, priority:'normal', status:'calling' },
            { patientName:'吴敏', gender:'女', age:28, queueNumber:2, arrivalTime:'2026-08-12T08:40:00', waitingTime:25, priority:'normal', status:'waiting' },
            { patientName:'郑强', gender:'男', age:62, queueNumber:3, arrivalTime:'2026-08-12T09:05:00', waitingTime:10, priority:'normal', status:'waiting' },
        ],
    },

    // ── 手环概览 ──
    braceletSummary: {
        totalBracelets: 228, boundCount: 186, availableCount: 42, todayIssued: 12,
    },

    // ── 手环记录 (绑/解/换 共24条) ──
    braceletRecords: (function() {
        var records = [];
        var patients = [
            { name:'王大爷', braceletId:'ABC123456789' },{ name:'李女士', braceletId:'DEF234567890' },
            { name:'张先生', braceletId:'GHI345678901' },{ name:'赵阿姨', braceletId:'JKL456789012' },
            { name:'孙大爷', braceletId:'MNO567890123' },{ name:'周女士', braceletId:'PQR678901234' },
            { name:'吴先生', braceletId:'STU789012345' },{ name:'郑阿姨', braceletId:'VWX890123456' },
            { name:'钱先生', braceletId:'YZA901234567' },{ name:'朱女士', braceletId:'BCD012345678' },
            { name:'马大爷', braceletId:'EFG123456789' },{ name:'杨阿姨', braceletId:'HIJ234567890' },
            { name:'刘先生', braceletId:'KLM345678901' },{ name:'黄女士', braceletId:'NOP456789012' },
            { name:'何大爷', braceletId:'QRS567890123' },{ name:'林女士', braceletId:'TUV678901234' },
            { name:'徐先生', braceletId:'WXY789012345' },{ name:'方女士', braceletId:'ZAB890123456' },
        ];
        patients.forEach(function(p, i) {
            records.push({ recordId: i*2+1, braceletId: p.braceletId, patientId: 2000000000000001001+i,
                patientName: p.name, nfcId: 'NFC' + String(i+1).padStart(4,'0') + String(Math.floor(Math.random()*9000+1000)),
                action: 'bind', note: '导诊台发放绑定', time: _ts(-(i*45+10)) });
            // 部分患者有归还记录
            if (i === 13 || i === 16) {
                records.push({ recordId: i*2+2, braceletId: p.braceletId, patientId: 2000000000000001001+i,
                    patientName: p.name, nfcId: records[records.length-1].nfcId,
                    action: 'return', note: '就诊结束归还手环', time: _ts(-(i*45-300)) });
            }
        });
        return records;
    })(),

    // ── 患者分页列表 (20人) ──
    patientPage: (function() {
        var patients = [
            { name:'王大爷', gender:1, age:72, dept:'心内科', braceletId:'ABC123456789', maskedId:'PAT-7A3B-9C2D', bindMin:0, status:1 },
            { name:'李女士', gender:2, age:45, dept:'内分泌科', braceletId:'DEF234567890', maskedId:'PAT-2E8F-4D1A', bindMin:30, status:1 },
            { name:'张先生', gender:1, age:38, dept:'消化内科', braceletId:'GHI345678901', maskedId:'PAT-5B1C-7E3F', bindMin:75, status:1 },
            { name:'赵阿姨', gender:2, age:65, dept:'内科', braceletId:'JKL456789012', maskedId:'PAT-9D4A-2B8E', bindMin:105, status:1 },
            { name:'孙大爷', gender:1, age:78, dept:'外科', braceletId:'MNO567890123', maskedId:'PAT-1F7C-5A3D', bindMin:120, status:1 },
            { name:'周女士', gender:2, age:28, dept:'皮肤科', braceletId:'PQR678901234', maskedId:'PAT-6E2B-8F4C', bindMin:150, status:1 },
            { name:'吴先生', gender:1, age:55, dept:'骨科', braceletId:'STU789012345', maskedId:'PAT-3A9D-1E7B', bindMin:180, status:1 },
            { name:'郑阿姨', gender:2, age:62, dept:'儿科', braceletId:'VWX890123456', maskedId:'PAT-8C5F-3A2E', bindMin:210, status:1 },
            { name:'钱先生', gender:1, age:48, dept:'影像科', braceletId:'YZA901234567', maskedId:'PAT-4F1A-7C3D', bindMin:240, status:1 },
            { name:'朱女士', gender:2, age:33, dept:'急诊科', braceletId:'BCD012345678', maskedId:'PAT-0B6E-2A8F', bindMin:270, status:1 },
            { name:'马大爷', gender:1, age:81, dept:'中医科', braceletId:'EFG123456789', maskedId:'PAT-7D2C-9F5A', bindMin:300, status:1 },
            { name:'杨阿姨', gender:2, age:56, dept:'检验科', braceletId:'HIJ234567890', maskedId:'PAT-3E8A-4B1D', bindMin:330, status:1 },
            { name:'刘先生', gender:1, age:41, dept:'消化内科', braceletId:'KLM345678901', maskedId:'PAT-8A4F-6C2E', bindMin:360, status:1 },
            { name:'黄女士', gender:2, age:27, dept:'皮肤科', braceletId:'NOP456789012', maskedId:'PAT-2C9B-1D7A', bindMin:390, status:0 },
            { name:'何大爷', gender:1, age:69, dept:'心内科', braceletId:'QRS567890123', maskedId:'PAT-5D1E-3F8C', bindMin:420, status:1 },
            { name:'林女士', gender:2, age:52, dept:'内分泌科', braceletId:'TUV678901234', maskedId:'PAT-9F7C-8A4B', bindMin:450, status:1 },
            { name:'徐先生', gender:1, age:36, dept:'外科', braceletId:'WXY789012345', maskedId:'PAT-1A3D-5E9F', bindMin:480, status:0 },
            { name:'方女士', gender:2, age:43, dept:'骨科', braceletId:'ZAB890123456', maskedId:'PAT-6B2F-4C8E', bindMin:510, status:1 },
            { name:'余大爷', gender:1, age:74, dept:'中医科', braceletId:'CDE901234567', maskedId:'PAT-4E7A-9D1B', bindMin:540, status:1 },
            { name:'许女士', gender:2, age:31, dept:'急诊科', braceletId:'FGH012345678', maskedId:'PAT-7C3D-2F5A', bindMin:570, status:1 },
        ];
        return {
            records: patients.map(function(p, i) {
                return {
                    id: 2000000000000001001 + i,
                    name: p.name, gender: p.gender, age: p.age,
                    idCardNo: '110101' + (2026-p.age) + '0' + (i%9+1) + '0' + (i%9+1) + '****',
                    dept: p.dept, braceletId: p.braceletId, maskedId: p.maskedId,
                    bindTime: _ts(p.bindMin), status: p.status,
                };
            }),
            total: 20, current: 1, size: 10,
        };
    })(),

    // ── 快捷问题 (12个) ──
    quickQuestions: [
        { id:1, question:'我的排队号是多少？' },    { id:2, question:'科室在几楼？' },
        { id:3, question:'报告什么时候出来？' },    { id:4, question:'怎么去药房？' },
        { id:5, question:'下次复诊是什么时候？' },  { id:6, question:'附近有卫生间吗？' },
        { id:7, question:'可以帮我看一下检查结果吗？' },{ id:8, question:'我的主治医生是谁？' },
        { id:9, question:'缴费窗口在哪里？' },      { id:10, question:'可以帮我叫一下家属吗？' },
        { id:11, question:'还有多久轮到我？' },     { id:12, question:'医院WiFi密码是什么？' },
    ],

    // ── 家属列表 (8人) ──
    familyList: [
        { familyId:1, name:'王小明', relationship:'儿子', phone:'13800001111', onlineStatus:'online', patientName:'王大爷' },
        { familyId:2, name:'李建国', relationship:'丈夫', phone:'13800002222', onlineStatus:'offline', patientName:'李女士' },
        { familyId:3, name:'张丽华', relationship:'妻子', phone:'13800003333', onlineStatus:'online', patientName:'张先生' },
        { familyId:4, name:'赵强', relationship:'儿子', phone:'13800004444', onlineStatus:'online', patientName:'赵阿姨' },
        { familyId:5, name:'孙晓芳', relationship:'女儿', phone:'13800005555', onlineStatus:'offline', patientName:'孙大爷' },
        { familyId:6, name:'周明', relationship:'丈夫', phone:'13800006666', onlineStatus:'online', patientName:'周女士' },
        { familyId:7, name:'吴秀英', relationship:'妻子', phone:'13800007777', onlineStatus:'offline', patientName:'吴先生' },
        { familyId:8, name:'郑磊', relationship:'儿子', phone:'13800008888', onlineStatus:'online', patientName:'郑阿姨' },
    ],

    // ── 就诊概览 (按患者参数化) ──
    visitOverview: function(patientId) {
        var patients = [
            { name:'王大爷', age:72, gender:1, dept:'心内科', floor:2, time:'09:30', waitMin:15, comp:2, total:5, pct:40, cur:'医生问诊', next:'缴费结算' },
            { name:'李女士', age:45, gender:2, dept:'内分泌科', floor:3, time:'10:00', waitMin:8, comp:1, total:5, pct:20, cur:'血糖检测', next:'医生问诊' },
            { name:'张先生', age:38, gender:1, dept:'消化内科', floor:3, time:'10:15', waitMin:20, comp:1, total:5, pct:20, cur:'候诊排队', next:'医生问诊' },
        ];
        var idx = (typeof patientId === 'number' ? (patientId % 3) : 0);
        var p = patients[idx];
        return {
            visitId: 3000000000000000000 + (patientId || 1),
            patient: { patientId: patientId || 1, name: p.name, age: p.age, gender: p.gender },
            appointment: { department: p.dept, floor: p.floor, time: _today + ' ' + p.time, waitMinutes: p.waitMin },
            progress: { completedCount: p.comp, totalCount: p.total, percentage: p.pct },
            currentTask: p.cur, nextTask: p.next,
            todayCompleted: p.comp, todayTotal: p.total,
        };
    },

    // ── 就诊进度 (多样化) ──
    visitProgress: {
        visitId: 3000000000000000001,
        steps: [
            { step:1, title:'挂号登记', status:'completed', time:'2026-08-12 08:15' },
            { step:2, title:'心电图检查', status:'completed', time:'2026-08-12 09:00' },
            { step:3, title:'医生问诊', status:'in-progress', time:'2026-08-12 09:30' },
            { step:4, title:'缴费结算', status:'pending', time:'' },
            { step:5, title:'取药', status:'pending', time:'' },
        ],
        completedCount: 2, inProgressCount: 1, pendingCount: 2, percentage: 40,
    },
};

// ===================== 工具函数 =====================

/** 包装响应为 API 标准格式 */
function mockResponse(data) {
    return { code: 200, message: 'OK (mock)', data: data };
}

/** 包装导出类 API 方法 — 失败时降级到本地 CSV Blob */
function withExportFallback(apiFn, mockBlobFn) {
    return async function (...args) {
        if (MOCK_MODE === 'always') { return mockBlobFn(...args); }
        try {
            var result = await apiFn.apply(this, args);
            if (MOCK_MODE === 'auto') {
                // apiRequest 对 text/csv 响应返回 Blob
                if (result instanceof Blob) return result;
                // 如果返回的是 JSON {code:...}，检查 code
                if (result && result.code !== 200) {
                    console.warn('[Mock] 导出 API 返回 ' + result.code + '，降级本地 CSV');
                    return mockBlobFn(...args);
                }
            }
            return result;
        } catch (e) {
            if (MOCK_MODE === 'auto') {
                console.warn('[Mock] 导出 API 异常，降级本地 CSV:', e.message);
                return mockBlobFn(...args);
            }
            throw e;
        }
    };
}

/** 判断是否应使用模拟数据 */
function shouldUseMock() {
    if (MOCK_MODE === 'always') return true;
    if (MOCK_MODE === 'never') return false;
    return false; // 'auto' 模式由各方法自行处理
}

/** 包装 API 方法，失败时降级到模拟数据 */
function withMockFallback(apiFn, mockData, mockFn, isEmptyFn) {
    return async function (...args) {
        if (MOCK_MODE === 'always') {
            return mockResponse(typeof mockFn === 'function' ? mockFn(...args) : mockData);
        }
        try {
            const result = await apiFn.apply(this, args);
            // 检查返回码 — code !== 200 也视为失败
            if (result && result.code !== 200 && MOCK_MODE === 'auto') {
                console.warn('[Mock] API 返回 ' + result.code + '，降级模拟:', result.message);
                return mockResponse(typeof mockFn === 'function' ? mockFn(...args) : mockData);
            }
            // 数据质量校验 — 返回 200 但数据为空也降级
            if (isEmptyFn && MOCK_MODE === 'auto' && isEmptyFn(result)) {
                console.warn('[Mock] API 返回数据量不足，降级模拟');
                return mockResponse(typeof mockFn === 'function' ? mockFn(...args) : mockData);
            }
            return result;
        } catch (e) {
            if (MOCK_MODE === 'auto') {
                console.warn('[Mock] API 异常降级模拟:', e.message);
                return mockResponse(typeof mockFn === 'function' ? mockFn(...args) : mockData);
            }
            throw e;
        }
    };
}

// ===================== 为 adminApi 打补丁 =====================

(function patchAdminApi() {
    if (typeof adminApi === 'undefined') {
        console.warn('[Mock] adminApi 未加载，跳过模拟补丁');
        return;
    }

    // -- Dashboard --
    // 数据质量校验：后端「就诊」记录为空时，今日就诊/当前在院/科室负载/来源分布/流量趋势
    // 会返回稀疏甚至全 0 的数据，导致首页显示 0/1 等不合理的数字。这里与 analytics 页一致，
    // 在数据稀疏时自动降级到模拟数据，保证首页展示好看合理；后端有真实就诊数据时仍走真实接口。
    adminApi.getKpi = withMockFallback(adminApi.getKpi, MOCK.kpi, null, function(res) {
        var d = res && res.data;
        return !d || (d.todayVisits || 0) === 0;
    });
    adminApi.getDeptLoad = withMockFallback(adminApi.getDeptLoad, MOCK.deptLoad, null, function(res) {
        var arr = Array.isArray(res && res.data) ? res.data : [];
        if (arr.length < 6) return true;
        var totalQueue = arr.reduce(function(s, x) { return s + (x.queueCount || 0); }, 0);
        return totalQueue < 50;
    });
    adminApi.getAlarms = withMockFallback(adminApi.getAlarms, MOCK.alarms, (limit) =>
        Array.isArray(MOCK.alarms) ? MOCK.alarms.slice(0, limit || MOCK.alarms.length) : MOCK.alarms);
    adminApi.getSourceDistribution = withMockFallback(adminApi.getSourceDistribution, MOCK.sourceDistribution, null, function(res) {
        var arr = Array.isArray(res && res.data) ? res.data : [];
        return arr.length < 2;
    });
    adminApi.getTrafficTrend = withMockFallback(adminApi.getTrafficTrend, MOCK.trafficTrend, null, function(res) {
        var arr = Array.isArray(res && res.data) ? res.data : [];
        if (!arr.length) return true;
        return arr.reduce(function(s, x) { return s + (x.count || 0); }, 0) === 0;
    });
    adminApi.getSystemStatus = withMockFallback(adminApi.getSystemStatus, MOCK.systemStatus);

    // -- Dispatch --
    adminApi.getDispatchDeptLoad = withMockFallback(adminApi.getDispatchDeptLoad, MOCK.dispatchDeptLoad);
    adminApi.getSuggestions = withMockFallback(adminApi.getSuggestions, MOCK.suggestions);
    adminApi.executeDispatch = withMockFallback(adminApi.executeDispatch, null, () => true);
    adminApi.getTaskPreemption = withMockFallback(adminApi.getTaskPreemption, null, function() {
        // 后端返回抢占/告警事件数组 {type, level, patientName, location, description, createdAt}
        return [
            { type:'emergency', level:5, patientName:'王大爷', location:'2F-洗手间附近', description:'患者突感胸闷并摔倒，心率异常（128bpm），急需急救响应', createdAt: _ts(-20) },
            { type:'vital',      level:4, patientName:'李女士', location:'1F-电梯厅', description:'糖尿病低血糖晕厥风险，血糖3.2mmol/L，需立即处置', createdAt: _ts(-40) },
            { type:'fall',       level:4, patientName:'孙大爷', location:'3F-检验科门口', description:'患者等待超60分钟，年龄78岁，建议优先安排', createdAt: _ts(-65) },
            { type:'wheelchair', level:2, patientName:'赵阿姨', location:'2F-外科候诊区', description:'需要轮椅协助转移至影像科', createdAt: _ts(-90) },
        ];
    });
    adminApi.exportDispatchReport = withExportFallback(adminApi.exportDispatchReport, function () { return new Blob(
        ['﻿智环引诊 - 科室调度报表',
         '导出时间,' + _ts(0),
         '',
         '科室名称,当前排队人数,平均等待时间(分钟),负载率(%),负载状态,建议操作',
         '检验科,78,38,92,高负载,建议分流至影像科',
         '影像科,65,32,85,高负载,建议增加临时窗口',
         '急诊科,52,12,78,中等,维持现状',
         '心内科,48,25,72,中等,关注高龄患者优先级',
         '内科,42,22,65,中等,维持现状',
         '儿科,38,28,60,中等,增加儿科诊室',
         '骨科,35,20,55,正常,维持现状',
         '消化内科,32,18,50,正常,维持现状',
         '内分泌科,28,15,45,正常,维持现状',
         '皮肤科,22,12,40,正常,维持现状',
         '外科,20,10,35,正常,维持现状',
         '中医科,15,8,28,正常,维持现状',
         '',
         '汇总,总排队人数,475,平均等待,20.8,平均负载,58.3'].join('\n'),
        { type: 'text/csv;charset=utf-8' }); });
    adminApi.exportQueueDetail = withExportFallback(adminApi.exportQueueDetail, function (deptName) { return new Blob(
        ['﻿智环引诊 - ' + (deptName || '科室') + '排队详情报表',
         '导出时间,' + _ts(0),
         '',
         '排队号,患者姓名,性别,年龄,到达时间,等待时间(分钟),优先级,当前状态',
         '1,赵阿姨,女,65,2026-08-12 08:30,45,优先,叫号中',
         '2,钱多,男,42,2026-08-12 08:45,30,普通,等待中',
         '3,孙悦,女,38,2026-08-12 09:00,15,普通,等待中',
         '4,马超,男,55,2026-08-12 09:10,5,普通,等待中',
         '',
         '汇总,总排队人数,4,平均等待,23.8分钟,最长等待,45分钟'].join('\n'),
        { type: 'text/csv;charset=utf-8' }); });

    // -- Emergency --
    adminApi.getEmergencyAlarms = withMockFallback(adminApi.getEmergencyAlarms, MOCK.emergencyAlarms);
    adminApi.getEmergencyRecords = withMockFallback(adminApi.getEmergencyRecords, MOCK.emergencyRecords);
    adminApi.getAlarmDetail = withMockFallback(adminApi.getAlarmDetail, null, function(alarmId) {
        var found = MOCK.emergencyAlarms.records.find(function(r) { return r.id === alarmId; });
        return found || MOCK.emergencyAlarms.records[0];
    });
    adminApi.exportEmergencyRecords = withExportFallback(adminApi.exportEmergencyRecords, function () { return new Blob(
        ['﻿智环引诊 - 应急事件记录报表',
         '导出时间,' + _ts(0),
         '数据范围,近30天（含今日实时数据）',
         '',
         '告警编码,事件类型,危险等级,危险等级名称,发生位置,涉及患者,来源终端,当前状态,状态名称,发生时间,处理时间,处理人,处理备注',
         'ALM-2026-08-12-0001,紧急急救,5,特急,2F-洗手间附近,王大爷,门诊二层子站,pending,待处理,2026-08-12 14:35,--,--,--',
         'ALM-2026-08-12-0002,生命体征异常,4,紧急,1F-电梯厅,李女士,门诊一层子站,pending,待处理,2026-08-12 14:30,--,--,--',
         'ALM-2026-08-12-0003,排队超时,3,中等,3F-检验科门口,孙大爷,检验科子站,pending,待处理,2026-08-12 14:25,--,--,--',
         'ALM-2026-08-12-0004,轮椅需求,2,一般,2F-外科候诊区,赵阿姨,门诊二层子站,processing,处理中,2026-08-12 14:20,2026-08-12 14:28,值班管理员,轮椅已安排送达',
         'ALM-2026-08-12-0005,设备维护,1,低,1F-药房子站7号,--,药房子站7号,pending,待处理,2026-08-12 14:15,--,--,--',
         'ALM-2026-08-11-0012,患者摔倒,5,特急,1F-急诊通道,周女士,急诊通道子站,completed,已完成,2026-08-11 16:20,2026-08-11 16:35,张护士,已转至急诊科处理',
         'ALM-2026-08-11-0018,导引迷路,2,一般,3F-影像科,钱先生,影像科子站,completed,已完成,2026-08-11 15:45,2026-08-11 15:55,导诊台值班,已安排专人引导',
         'ALM-2026-08-10-0025,紧急急救,5,特急,2F-心内科,何大爷,心内科子站,completed,已完成,2026-08-10 10:15,2026-08-10 10:30,李医生,急救响应及时',
         'ALM-2026-08-09-0032,心率异常,4,紧急,2F-心电图室,刘波,门诊二层子站,completed,已完成,2026-08-09 09:45,2026-08-09 09:52,王护士长,已安排心内科优先就诊',
         'ALM-2026-08-09-0036,低血糖预警,4,紧急,1F-门诊大厅,高明,门诊一层子站,ignored,已忽略,2026-08-09 08:30,--,--,误报-患者已自行进食恢复',
         '',
         '统计,本月总计,' + MOCK.emergencyAlarms.total + ',' +
         '已处理,' + MOCK.emergencyAlarms.records.filter(function(r){return r.status==='completed';}).length + ',' +
         '处理中,' + MOCK.emergencyAlarms.records.filter(function(r){return r.status==='processing';}).length + ',' +
         '待处理,' + MOCK.emergencyAlarms.records.filter(function(r){return r.status==='pending';}).length + ',' +
         '已忽略,' + MOCK.emergencyAlarms.records.filter(function(r){return r.status==='ignored';}).length].join('\n'),
        { type: 'text/csv;charset=utf-8' }); });

    // -- Emergency 写操作 mock（同时更新 mock 数据存储，确保页面状态一致） --
    adminApi.handleAlarm = withMockFallback(adminApi.handleAlarm, null, function(alarmId, note) {
        console.log('[Mock] 处理警报:', alarmId, note);
        var found = MOCK.emergencyAlarms.records.find(function(r) { return r.id === alarmId; });
        if (found) {
            found.status = 'closed';
            found.handledAt = _ts(0);
            found.handleNote = note || '控制中心应急处理';
            found.handlerName = '值班管理员';
            // 加入处理记录
            MOCK.emergencyRecords.unshift({
                id: Date.now(), alarmCode: found.alarmCode, type: found.type, level: found.level,
                location: found.location, patientName: found.patientName, status: 'closed',
                createdAt: found.createdAt, handledAt: found.handledAt,
                handleNote: found.handleNote, handlerName: found.handlerName,
                terminalName: found.terminalName, description: found.description,
            });
        }
        MOCK.emergencyAlarms.total = MOCK.emergencyAlarms.records.length;
        return { code: 200, msg: '处理成功', data: { alarmId: alarmId, status: 'closed', handleNote: note || '已处理', handledAt: _ts(0) } };
    });
    adminApi.ignoreAlarm = withMockFallback(adminApi.ignoreAlarm, null, function(alarmId) {
        console.log('[Mock] 忽略警报:', alarmId);
        var found = MOCK.emergencyAlarms.records.find(function(r) { return r.id === alarmId; });
        if (found) { found.status = 'ignored'; found.handledAt = _ts(0); found.handlerName = '系统自动'; }
        return { code: 200, msg: '已忽略', data: { alarmId: alarmId, status: 'ignored' } };
    });
    adminApi.postponeAlarm = withMockFallback(adminApi.postponeAlarm, null, function(alarmId, until) {
        console.log('[Mock] 延后警报:', alarmId, '至', until);
        return { code: 200, msg: '已延后', data: { alarmId: alarmId, postponeUntil: until } };
    });
    adminApi.closeAlarm = withMockFallback(adminApi.closeAlarm, null, function(alarmId) {
        console.log('[Mock] 关闭警报:', alarmId);
        var found = MOCK.emergencyAlarms.records.find(function(r) { return r.id === alarmId; });
        if (found) {
            found.status = 'closed';
            found.handledAt = _ts(0);
            // 完成后加入处理记录
            MOCK.emergencyRecords.unshift({
                id: Date.now(), alarmCode: found.alarmCode, type: found.type, level: found.level,
                location: found.location, patientName: found.patientName, status: 'closed',
                createdAt: found.createdAt, handledAt: found.handledAt,
                handleNote: found.handleNote, handlerName: found.handlerName,
                terminalName: found.terminalName, description: found.description,
            });
        }
        return { code: 200, msg: '已关闭', data: { alarmId: alarmId, status: 'closed' } };
    });
    adminApi.broadcastEmergency = withMockFallback(adminApi.broadcastEmergency, null, function(content) {
        console.log('[Mock] 紧急广播:', content);
        return { code: 200, msg: '广播已发送', data: { content: content, broadcastAt: _ts(0) } };
    });
    adminApi.createMaintenance = withMockFallback(adminApi.createMaintenance, null, function(alarmId, note) {
        console.log('[Mock] 创建维护任务:', alarmId, note);
        return { code: 200, msg: '维护任务已创建', data: { alarmId: alarmId, maintenanceNote: note } };
    });
    adminApi.triageDept = withMockFallback(adminApi.triageDept, null, function(dept, count) {
        console.log('[Mock] 分流至:', dept, count, '人');
        return { code: 200, msg: '分流成功', data: { dept: dept, count: count } };
    });

    // -- Analytics (带数据质量校验：后端返回空数据时自动降级 mock) --
    function _isEmptyAnalytics(data, type) {
        if (!data) return true;
        if (type === 'trend') {
            // 月度趋势：至少 6 个月且至少 3 个月有数据
            if (!Array.isArray(data) || data.length < 6) return true;
            var nonZero = data.filter(function(r) { return (r.visitCount || 0) > 0; });
            if (nonZero.length < 3) return true;
            var sum = data.reduce(function(s, r) { return s + (r.visitCount || 0); }, 0);
            return sum < 100;
        }
        if (type === 'ranking') {
            // 科室排行：至少要有 3 个科室
            return !Array.isArray(data) || data.length < 3;
        }
        if (type === 'satisfaction') {
            // 满意度：至少要有 3 个评分等级
            return !Array.isArray(data) || data.length < 3;
        }
        if (type === 'detail') {
            // 综合详情：总就诊量至少 > 100
            return !data || (data.totalVisits || 0) < 100;
        }
        return false;
    }

    adminApi.getAnalyticsDetail = withMockFallback(adminApi.getAnalyticsDetail, MOCK.analyticsDetail, null, function(res) {
        return _isEmptyAnalytics(res && res.data, 'detail');
    });
    adminApi.getMonthlyTrend = withMockFallback(adminApi.getMonthlyTrend, MOCK.monthlyTrend, null, function(res) {
        return _isEmptyAnalytics(res && res.data, 'trend');
    });
    adminApi.getDeptRanking = withMockFallback(adminApi.getDeptRanking, MOCK.deptRanking, null, function(res) {
        return _isEmptyAnalytics(res && res.data, 'ranking');
    });
    adminApi.getSatisfaction = withMockFallback(adminApi.getSatisfaction, MOCK.satisfaction, null, function(res) {
        return _isEmptyAnalytics(res && res.data, 'satisfaction');
    });
    adminApi.queryAnalytics = withMockFallback(adminApi.queryAnalytics, null, function(params) {
        return {
            monthlyTrend: MOCK.monthlyTrend,
            deptRanking: MOCK.deptRanking,
            satisfaction: MOCK.satisfaction,
            detail: MOCK.analyticsDetail,
            monthlySatisfaction: MOCK.monthlySatisfaction,
            dailyStats: MOCK.dailyStats,
        };
    });
    adminApi.exportAnalytics = withMockFallback(adminApi.exportAnalytics, null, (params) => {
        var rows = [
            '﻿智环引诊 - 综合数据分析报表',
            '导出时间,' + _ts(0),
            '报表周期,2024年9月 - 2026年8月（24个月）',
            '',
            '=== 一、综合数据概览 ===',
            '总就诊量,当前排队,进行中,已完成,平均满意度,最忙科室,待处理告警,同比增长,环比增长',
            '87250,475,238,86537,4.32,检验科,5,12.5%,3.8%',
            '',
            '=== 二、月度就诊趋势（24个月） ===',
            '月份,就诊人次,满意度,完成率(%)',
        ];
        MOCK.monthlyTrend.forEach(function(r) {
            rows.push(r.month + ',' + r.visitCount + ',' + r.satisfaction + ',' + r.finishRate);
        });
        rows.push('');
        rows.push('=== 三、科室就诊量排行（含季度对比） ===');
        rows.push('排名,科室名称,年度总就诊量,第一季度,第二季度,第三季度,第四季度,平均等待(分钟),满意度,趋势');
        MOCK.deptRanking.forEach(function(r, i) {
            rows.push([i+1, r.deptName, r.visitCount, r.q1, r.q2, r.q3, r.q4, r.avgWait, r.satisfaction, r.trend].join(','));
        });
        rows.push('');
        rows.push('=== 四、满意度分布 ===');
        rows.push('评分,人数,占比(%),评价标签');
        var satLabels = ['非常不满意','不满意','一般','满意','非常满意'];
        MOCK.satisfaction.forEach(function(s, i) {
            rows.push([s.score + '分', s.count, s.percentage, satLabels[5-s.score] || ''].join(','));
        });
        rows.push('');
        rows.push('=== 五、月度满意度趋势 ===');
        rows.push('月份,平均评分,评价总数,好评率(%)');
        MOCK.monthlySatisfaction.forEach(function(r) {
            rows.push([r.month, r.avgScore, r.totalRatings, r.praiseRate].join(','));
        });
        rows.push('');
        rows.push('=== 六、近30天每日统计 ===');
        rows.push('日期,就诊人次,完成人次,平均满意度,告警次数,峰值排队人数');
        MOCK.dailyStats.forEach(function(d) {
            rows.push([d.date, d.visitCount, d.completedCount, d.avgSatisfaction, d.alarmCount, d.peakQueueLength].join(','));
        });
        rows.push('');
        rows.push('=== 七、患者来源分布 ===');
        rows.push('来源渠道,人次,占比(%)');
        MOCK.sourceDistribution.forEach(function(s) {
            rows.push([s.label, s.count, s.percentage].join(','));
        });
        var csv = rows.join('\n');
        return new Blob([csv], { type: 'text/csv;charset=utf-8' });
    });

    // -- Settings --
    adminApi.getSettings = withMockFallback(adminApi.getSettings, MOCK.settings);
    adminApi.getSubstations = withMockFallback(adminApi.getSubstations, MOCK.substations);

    // -- Tasks (强制 mock：后端数据乱码) --
    adminApi.getTasksKpi = function () { return Promise.resolve(mockResponse(MOCK.tasksKpi)); };
    adminApi.getTasksList = function () { return Promise.resolve(mockResponse(MOCK.tasksList)); };
    adminApi.getTaskEventLog = function () { return Promise.resolve(mockResponse(MOCK.taskEventLog)); };
    adminApi.getTaskDetail = function (taskId) {
        var t = MOCK.tasksList.find(function(t) { return String(t.taskId) === String(taskId); });
        return Promise.resolve(mockResponse(t || MOCK.tasksList[0]));
    };

    // -- Dashboard 扩展 --
    adminApi.getHeatmap = withMockFallback(adminApi.getHeatmap, null, function() {
        var zones = [];
        var deptNames = ['检验科','影像科','急诊科','心内科','内科','儿科','骨科','消化内科','内分泌科','皮肤科','外科','中医科'];
        deptNames.forEach(function(d, i) {
            zones.push({ deptName:d, floor:Math.ceil((i+1)/4), zone:(i%4)+1, density:Math.floor(Math.random()*80+20), status:d === '检验科'||d === '影像科' ? 'high':'normal' });
        });
        return zones;
    });
    adminApi.getDashboardNodes = withMockFallback(adminApi.getDashboardNodes, null, function() {
        return { smartSubstations:28, lightGuideNodes:22, rfidSensorNodes:14, totalNodes:64, onlineNodes:60, offlineNodes:4 };
    });
    adminApi.getDeptDetail = withMockFallback(adminApi.getDeptDetail, null, function(deptId) {
        return {
            deptName:'心内科', floor:2, zone:1, capacity:80, currentQueue:48, avgWaitMinutes:25,
            utilization:72, doctorsOnDuty:5, totalDoctors:6, status:'warning',
            todayVisits:285, weekTrend:[275,290,268,310,295,305,285],
        };
    });

    // -- Digital Twin --
    adminApi.getDigitalTwinFloorPlan = withMockFallback(adminApi.getDigitalTwinFloorPlan, null, function(floor) { return { floor:floor, nodes:[] }; });
    adminApi.getDigitalTwinPatientPositions = withMockFallback(adminApi.getDigitalTwinPatientPositions, null, function() { return []; });

    // -- Queue --
    adminApi.getQueueDetail = withMockFallback(adminApi.getQueueDetail, null, (params) => {
        const dept = (params && params.deptName) || '';
        return MOCK.queueDetail[dept] || MOCK.queueDetail._default;
    });

    console.log('[Mock] adminApi 模拟数据补丁已应用 (模式: ' + MOCK_MODE + ')');
})();

// ===================== 为 businessApi 打补丁 =====================

(function patchBusinessApi() {
    if (typeof businessApi === 'undefined') {
        console.warn('[Mock] businessApi 未加载，跳过模拟补丁');
        return;
    }

    // -- Patient --
    businessApi.getPatientPage = withMockFallback(businessApi.getPatientPage, MOCK.patientPage);
    businessApi.createPatient = withMockFallback(businessApi.createPatient, null, (data) => {
        console.log('[Mock] 模拟创建患者:', data.name);
        return 2090000000000000000 + Math.floor(Math.random() * 1000);
    });
    businessApi.getPatient = withMockFallback(businessApi.getPatient, null, (id) => {
        const found = MOCK.patientPage.records.find(r => String(r.id) === String(id));
        return found || MOCK.patientPage.records[0];
    });
    businessApi.updatePatient = withMockFallback(businessApi.updatePatient, null, function() { return true; });
    businessApi.deletePatient = withMockFallback(businessApi.deletePatient, null, () => true);
    businessApi.getPatientInfo = withMockFallback(businessApi.getPatientInfo, null, function() {
        var p = MOCK.patientPage.records[0];
        return { patientId: p.id, name: p.name, gender: p.gender, age: p.age, dept: p.dept, maskedId: p.maskedId };
    });
    businessApi.updatePatientInfo = withMockFallback(businessApi.updatePatientInfo, null, function() { return true; });
    businessApi.queryPatientByIdCard = withMockFallback(businessApi.queryPatientByIdCard, null, function(idCardNo) {
        return MOCK.patientPage.records.find(function(r) { return r.idCardNo && r.idCardNo.indexOf(idCardNo.substring(0,6)) === 0; }) || MOCK.patientPage.records[0];
    });
    businessApi.getPatientMessages = withMockFallback(businessApi.getPatientMessages, null, function() { return [
        { id:1, title:'就诊提醒', content:'您预约的心内科门诊时间为今天09:30，请提前15分钟到达。', time:_ts(-120), read:true },
        { id:2, title:'报告通知', content:'您的心电图检查报告已出具，可前往2F报告打印机自助打印。', time:_ts(-240), read:false },
        { id:3, title:'复诊提醒', content:'请于本月15日到心内科复诊，记得携带身份证和医保卡。', time:_ts(-480), read:false },
    ];});

    // -- Bracelet --
    businessApi.getBraceletSummary = withMockFallback(businessApi.getBraceletSummary, MOCK.braceletSummary);
    businessApi.getBraceletRecords = withMockFallback(businessApi.getBraceletRecords, MOCK.braceletRecords);
    businessApi.nfcDetect = withMockFallback(businessApi.nfcDetect, null, (nfcId) => {
        const rec = MOCK.braceletRecords.find(r => r.nfcId === nfcId);
        return rec ? { patientId: rec.patientId, patientName: rec.patientName, braceletId: rec.braceletId } : null;
    });
    businessApi.returnBracelet = withMockFallback(businessApi.returnBracelet, null, () => true);

    // -- Chat --
    businessApi.getQuickQuestions = withMockFallback(businessApi.getQuickQuestions, MOCK.quickQuestions);
    businessApi.sendChatMessage = withMockFallback(businessApi.sendChatMessage, null, (data) => {
        console.log('[Mock] 模拟聊天消息:', data.message);
        return { reply: '这是自动回复：您好，请问有什么可以帮助您的？' };
    });

    // -- Family --
    businessApi.getFamilyList = withMockFallback(businessApi.getFamilyList, MOCK.familyList);
    businessApi.getFamilyStatus = withMockFallback(businessApi.getFamilyStatus, null, (familyId) => {
        const f = MOCK.familyList.find(r => r.familyId === familyId);
        return f ? { ...f, patientProgress: { currentStep: 3, totalSteps: 5, currentTask: '医生问诊' } } : null;
    });
    businessApi.bindFamily = withMockFallback(businessApi.bindFamily, null, () => true);
    businessApi.unbindFamily = withMockFallback(businessApi.unbindFamily, null, () => true);

    // -- Visit --
    businessApi.getVisitOverview = withMockFallback(businessApi.getVisitOverview, null, function(patientId) {
        return MOCK.visitOverview(patientId);
    });
    businessApi.getVisitProgress = withMockFallback(businessApi.getVisitProgress, MOCK.visitProgress);
    businessApi.getCurrentTask = withMockFallback(businessApi.getCurrentTask, null, function(visitId) {
        return { taskName:'医生问诊', status:'in-progress', location:'2F-心内科诊室', estimatedMinutes:15 };
    });
    businessApi.getVisitTrace = withMockFallback(businessApi.getVisitTrace, null, function() {
        return {
            visitId: 3000000000000000001, date: _today, walkDistance: 420, nodesVisited: 7, totalDuration: 2400,
            timeline: [
                { time:'08:00', title:'到达医院', location:'1F-门诊大厅', status:'completed', duration:'5min' },
                { time:'08:15', title:'挂号登记', location:'1F-导诊台', status:'completed', duration:'10min' },
                { time:'08:30', title:'前往心电图室', location:'2F-心电图室', status:'completed', duration:'8min步行' },
                { time:'09:00', title:'心电图检查', location:'2F-心电图室', status:'completed', duration:'15min' },
                { time:'09:20', title:'前往心内科', location:'2F-心内科候诊区', status:'completed', duration:'5min步行' },
                { time:'09:30', title:'医生问诊', location:'2F-心内科诊室', status:'in-progress', duration:'进行中' },
                { time:'--', title:'缴费结算', location:'1F-收费处', status:'pending', duration:'--' },
                { time:'--', title:'取药', location:'1F-药房', status:'pending', duration:'--' },
            ],
        };
    });
    businessApi.getVisitReminder = withMockFallback(businessApi.getVisitReminder, null, function() { return [
        { date:_today, title:'心内科门诊', time:'09:30', location:'2F-心内科诊室' },
        { date:_today, title:'取药', time:'11:00', location:'1F-药房' },
    ];});

    // -- Emergency (patient) --
    businessApi.sendEmergency = withMockFallback(businessApi.sendEmergency, null, function() { return true; });

    // -- Feedback / Rating --
    businessApi.submitFeedback = withMockFallback(businessApi.submitFeedback, null, function() { return true; });
    businessApi.submitRating = withMockFallback(businessApi.submitRating, null, function() { return true; });

    // -- Reminder --
    businessApi.getReminderCalendar = withMockFallback(businessApi.getReminderCalendar, null, function() {
        var now = new Date();
        var ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
        return [
            { date: ym + '-15', title:'复诊 - 心内科', time:'09:00', type:'appointment' },
            { date: ym + '-20', title:'取报告', time:'14:30', type:'report' },
            { date: ym + '-25', title:'药房取药', time:'10:00', type:'pharmacy' },
            { date: ym + '-28', title:'复查心电图', time:'08:30', type:'exam' },
        ];
    });

    // -- Queue --
    businessApi.getQueueStatus = withMockFallback(businessApi.getQueueStatus, null, (dept) => ({
        queueNumber: 1, waitingAhead: 0, estimatedWaitMinutes: 5,
    }));

    // -- Substation --
    businessApi.substationDetect = withMockFallback(businessApi.substationDetect, null, (stationId, nfcId) => {
        const rec = MOCK.braceletRecords.find(r => r.nfcId === nfcId);
        return rec ? { patientId: rec.patientId, patientName: rec.patientName, detected: true } : { detected: false };
    });
    businessApi.substationTaskConfirm = withMockFallback(businessApi.substationTaskConfirm, null, () => true);
    businessApi.substationTask = withMockFallback(businessApi.substationTask, null, (patientId) =>
        MOCK.tasksList.find(t => t.patientId === patientId || String(t.patientId) === String(patientId)));
    businessApi.substationStatus = withMockFallback(businessApi.substationStatus, null, function(stationId) {
        var stations = MOCK.substations.records;
        var s = stations.find(function(r) { return r.terminalCode === stationId; }) || stations[0];
        return { stationId: s.terminalCode, name: s.terminalName, status: s.status === 1 ? 'online' : 'offline',
            location: s.terminalName, lastActive: _ts(-2) };
    });
    businessApi.substationVoice = withMockFallback(businessApi.substationVoice, null, function() { return true; });

    console.log('[Mock] businessApi 模拟数据补丁已应用 (模式: ' + MOCK_MODE + ')');
})();
