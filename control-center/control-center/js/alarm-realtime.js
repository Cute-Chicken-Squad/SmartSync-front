/**
 * 智环引诊 - 实时警报监控（总站弹窗）
 *
 * 实现方式（SSE 实时推送为主，轮询兜底，保证"子站求助 → 总站弹窗"真实落地）：
 *   1. SSE  GET /ws/emergency/alarms（text/event-stream，事件名 emergency-alarms）
 *      → 后端每 2 秒推送完整 pending 警报快照，按 alarmCode 去重识别新警报 → 弹窗
 *      → 需 Bearer token，EventSource 无法带自定义头，故用 fetch + ReadableStream 读取
 *   2. 轮询 GET /admin/api/emergency/alarms?status=pending（SSE 不可用时兜底）
 *   3. localStorage storage 事件（子站同机多标签页即时联动兜底）
 *
 * 依赖: api-config.js 中的 TokenStore.getAdminToken() / adminApi.getEmergencyAlarms()
 */

var AlarmRealtime = (function () {
    // 注入弹窗样式（自包含，任何页面引入即可用）
    (function injectStyles() {
        if (document.getElementById('alarm-popup-style')) return;
        var style = document.createElement('style');
        style.id = 'alarm-popup-style';
        style.textContent = [
            '.alarm-popup {',
            '  position: fixed; top: 76px; right: 24px; z-index: 99999;',
            '  width: 320px; background: #fff; border-radius: 12px;',
            '  box-shadow: 0 16px 48px rgba(0,0,0,0.16), 0 2px 8px rgba(224,49,49,0.12);',
            '  border: 1px solid #ffe3e3; overflow: hidden;',
            '  animation: alarmPopupIn 0.35s cubic-bezier(0.25,0.8,0.25,1);',
            '}',
            '.alarm-popup + .alarm-popup { margin-top: 12px; }',
            '@keyframes alarmPopupIn {',
            '  from { opacity: 0; transform: translateX(40px); }',
            '  to { opacity: 1; transform: translateX(0); }',
            '}',
            '.alarm-popup-head {',
            '  display: flex; align-items: center; gap: 8px; padding: 12px 16px;',
            '  background: linear-gradient(135deg, #fff5f5, #ffe9e9); border-bottom: 1px solid #ffe3e3;',
            '}',
            '.alarm-popup-dot { width: 8px; height: 8px; border-radius: 50%; background: #e03131;',
            '  box-shadow: 0 0 8px rgba(224,49,49,0.6); animation: alarmDotPulse 1.2s infinite; }',
            '@keyframes alarmDotPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }',
            '.alarm-popup-title { font-size: 14px; font-weight: 700; color: #c92a2a; flex: 1; }',
            '.alarm-popup-close { font-size: 20px; color: #adb5bd; cursor: pointer; line-height: 1;',
            '  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;',
            '  border-radius: 6px; }',
            '.alarm-popup-close:hover { background: #ffe3e3; color: #c92a2a; }',
            '.alarm-popup-body { padding: 14px 16px; }',
            '.alarm-popup-type { display: inline-block; padding: 3px 10px; border-radius: 4px;',
            '  background: #ffe3e3; color: #c92a2a; font-size: 12px; font-weight: 700; margin-bottom: 10px; }',
            '.alarm-popup-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }',
            '.alarm-popup-row .k { color: #868e96; }',
            '.alarm-popup-row .v { color: #212529; font-weight: 500; }',
            '.alarm-popup-row .v.mono { font-family: Consolas, monospace; color: #495057; }',
            '.alarm-popup-foot { padding: 12px 16px; border-top: 1px solid #f1f3f5; }',
            '.alarm-popup-btn { width: 100%; padding: 9px 0; border: none; border-radius: 6px;',
            '  background: #e03131; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;',
            '  transition: background 0.2s; }',
            '.alarm-popup-btn:hover { background: #c92a2a; }',
        ].join('\n');
        document.head.appendChild(style);
    })();

    // SSE 端点（直连 HTTPS 后端；CORS 已放行，Authorization 头走 fetch 流式读取）
    var SSE_URL = 'https://admin.ss.leeinx.com/ws/emergency/alarms';
    var POLL_INTERVAL = 3000;      // 轮询兜底间隔（3 秒）
    var MAX_SSE_RETRIES = 5;       // SSE 断线重连次数上限

    var seenAlarmCodes = {};       // alarmCode -> true（已见过的警报，避免重复弹窗）
    var pollTimer = null;          // 轮询定时器
    var sseController = null;      // 当前 SSE 的 AbortController
    var reconnectTimer = null;     // 重连定时器
    var started = false;
    var firstSnapshot = true;      // 首帧只登记、不弹窗
    var sseConnectedOnce = false;  // 是否曾成功连上 SSE
    var onNewAlarmCb = null;       // 额外回调（可选）

    // ===================== 启动 / 停止 =====================

    function start(cb) {
        if (cb) onNewAlarmCb = cb;
        if (started) return;
        started = true;

        // localStorage 跨标签页联动
        window.addEventListener('storage', onStorageEvent);

        // 优先 SSE 实时推送
        connectSse();

        console.log('[实时警报] 监控已启动（SSE 实时推送 + 轮询兜底）');
    }

    function stop() {
        started = false;
        if (sseController) { try { sseController.abort(); } catch (e) { /* ignore */ } sseController = null; }
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        stopPolling();
        window.removeEventListener('storage', onStorageEvent);
    }

    // ===================== SSE 实时推送 =====================

    function connectSse() {
        if (!started) return;
        var token = TokenStore.getAdminToken();
        if (!token) {
            console.warn('[实时警报] 无 admin token，回退轮询');
            onSseFailure('no-token');
            return;
        }

        var controller = new AbortController();
        sseController = controller;

        fetch(SSE_URL, {
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'text/event-stream' },
            signal: controller.signal,
            cache: 'no-store',
        }).then(function (resp) {
            if (resp.status !== 200 || !resp.body) {
                // 非 200（如 401/404）或无法流式读取 → SSE 不可用
                console.warn('[实时警报] SSE 不可用 (HTTP ' + resp.status + ')，回退轮询');
                onSseFailure('http-' + resp.status);
                return;
            }

            // SSE 连接成功
            sseConnectedOnce = true;
            stopPolling();
            console.log('[实时警报] SSE 已连接:', SSE_URL);

            var reader = resp.body.getReader();
            var decoder = new TextDecoder('utf-8');
            var buffer = '';

            function pump() {
                return reader.read().then(function (result) {
                    if (result.done) {
                        console.log('[实时警报] SSE 流已关闭，尝试重连');
                        onSseFailure('stream-end');
                        return;
                    }
                    buffer += decoder.decode(result.value, { stream: true }).replace(/\r\n/g, '\n');
                    var idx;
                    while ((idx = buffer.indexOf('\n\n')) !== -1) {
                        var block = buffer.slice(0, idx);
                        buffer = buffer.slice(idx + 2);
                        handleSseBlock(block);
                    }
                    return pump();
                }).catch(function (e) {
                    if (e && e.name === 'AbortError') return; // stop() 主动关闭
                    console.warn('[实时警报] SSE 读流异常:', e.message);
                    onSseFailure('read-error');
                });
            }
            return pump();
        }).catch(function (e) {
            if (e && e.name === 'AbortError') return; // stop() 主动关闭
            console.warn('[实时警报] SSE 连接失败:', e.message);
            onSseFailure('connect-error');
        });
    }

    // SSE 失败处理：曾连上过 → 重连；否则（或重连耗尽）→ 回退轮询
    function onSseFailure(reason) {
        if (!started) return;
        if (sseConnectedOnce && reason !== 'http-401' && reason !== 'http-404') {
            if (!window._sseRetries) window._sseRetries = 0;
            window._sseRetries++;
            if (window._sseRetries <= MAX_SSE_RETRIES) {
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(connectSse, 3000);
                return;
            }
        }
        window._sseRetries = 0;
        startPolling();
    }

    function handleSseBlock(block) {
        var eventName = '';
        var dataLines = [];
        var lines = block.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('event:') === 0) {
                eventName = line.slice(6).trim();
            } else if (line.indexOf('data:') === 0) {
                dataLines.push(line.slice(5).trim());
            }
        }
        if (eventName !== 'emergency-alarms' || !dataLines.length) return;
        try {
            var alarms = JSON.parse(dataLines.join('\n'));
            if (Array.isArray(alarms)) applySnapshot(alarms);
        } catch (e) { /* 数据块不完整时忽略，等下一帧 */ }
    }

    // 快照去重：按 alarmCode 识别新警报（SSE 与轮询共用）
    function applySnapshot(alarms) {
        var newAlarms = [];
        for (var i = 0; i < alarms.length; i++) {
            var a = alarms[i];
            var code = a.alarmCode || ('ALM-' + a.id);
            if (firstSnapshot) {
                seenAlarmCodes[code] = true;   // 首帧只登记
            } else if (!seenAlarmCodes[code]) {
                seenAlarmCodes[code] = true;
                newAlarms.push(a);
            }
        }

        if (firstSnapshot) {
            firstSnapshot = false;
            console.log('[实时警报] 首帧已登记 ' + alarms.length + ' 条待处理警报');
        }

        for (var j = 0; j < newAlarms.length; j++) {
            showPopup(newAlarms[j]);
        }
        if (newAlarms.length) {
            console.log('[实时警报] 检测到 ' + newAlarms.length + ' 条新警报');
        }
    }

    // ===================== 轮询兜底 =====================

    function startPolling() {
        if (pollTimer) return;
        console.log('[实时警报] 启动轮询兜底 (每 ' + (POLL_INTERVAL / 1000) + 's)');
        poll();
        pollTimer = setInterval(poll, POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    async function poll() {
        try {
            var res = await adminApi.getEmergencyAlarms({ status: 'pending', current: 1, size: 20 });
            if (res && res.code === 200 && res.data) {
                applySnapshot(res.data.records || []);
            }
        } catch (e) {
            console.warn('[实时警报] 轮询失败:', e.message);
        }
    }

    // ===================== localStorage 联动 =====================

    function onStorageEvent(e) {
        if (e.key !== 'controlCenterEvents') return;
        try {
            var events = JSON.parse(e.newValue || '[]');
            if (events.length && events[0] && events[0].type === 'EMERGENCY_ALARM') {
                showPopup({
                    type: 'emergency',
                    level: 4,
                    location: events[0].location || '--',
                    patientName: events[0].patientName || '未知患者',
                    createdAt: events[0].timestamp || new Date().toISOString(),
                    description: '子站发起紧急求助',
                    _local: true,
                });
            }
        } catch (err) { /* ignore */ }
    }

    // ===================== 弹窗 =====================

    function showPopup(alarm) {
        // 避免同一时刻刷屏：最多同时保留 3 个弹窗
        var existing = document.querySelectorAll('.alarm-popup');
        if (existing.length >= 3) {
            existing[0].remove();
        }

        var typeLabels = {
            'emergency': '紧急急救', 'vital': '体征异常', 'fall': '患者摔倒',
            'wheelchair': '轮椅协助', 'maintenance': '设备维护', 'broadcast': '广播通知',
        };
        var typeText = typeLabels[alarm.type] || alarm.type || '紧急求助';
        var location = alarm.location || '--';
        var patientName = alarm.patientName || '未知患者';
        var timeStr = (alarm.createdAt || '').substring(11, 19) || '--:--:--';

        var popup = document.createElement('div');
        popup.className = 'alarm-popup';
        popup.innerHTML = ''
            + '<div class="alarm-popup-head">'
            +   '<span class="alarm-popup-dot"></span>'
            +   '<span class="alarm-popup-title">紧急警报</span>'
            +   '<span class="alarm-popup-close" onclick="this.parentNode.parentNode.remove()">×</span>'
            + '</div>'
            + '<div class="alarm-popup-body">'
            +   '<div class="alarm-popup-type">' + escText(typeText) + '</div>'
            +   '<div class="alarm-popup-row"><span class="k">位置</span><span class="v">' + escText(location) + '</span></div>'
            +   '<div class="alarm-popup-row"><span class="k">患者</span><span class="v">' + escText(patientName) + '</span></div>'
            +   '<div class="alarm-popup-row"><span class="k">时间</span><span class="v mono">' + escText(timeStr) + '</span></div>'
            + '</div>'
            + '<div class="alarm-popup-foot">'
            +   '<button class="alarm-popup-btn" onclick="window.location.href=\'/control-center/control-center/html/emergency.html\'">立即处理</button>'
            + '</div>';

        document.body.appendChild(popup);

        // 触发声音
        playBeep();

        // 8 秒后自动消失
        setTimeout(function () {
            if (popup.parentNode) popup.remove();
        }, 8000);

        // 额外回调（供页面刷新列表）
        if (onNewAlarmCb) {
            try { onNewAlarmCb(alarm); } catch (e) { /* ignore */ }
        }
    }

    // ===================== 声音 =====================

    function playBeep() {
        try {
            var ctx = window._alarmAudioCtx || (window._alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)());
            var now = ctx.currentTime;
            // 双音警报（两声）
            [[880, 0], [660, 0.22]].forEach(function (t) {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = t[0];
                gain.gain.setValueAtTime(0.001, now + t[1]);
                gain.gain.exponentialRampToValueAtTime(0.35, now + t[1] + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, now + t[1] + 0.2);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + t[1]);
                osc.stop(now + t[1] + 0.22);
            });
        } catch (e) { /* 音频不可用时静默 */ }
    }

    // ===================== 工具 =====================

    function escText(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return {
        start: start,
        stop: stop,
        showPopup: showPopup,
        poll: poll,
    };
})();
