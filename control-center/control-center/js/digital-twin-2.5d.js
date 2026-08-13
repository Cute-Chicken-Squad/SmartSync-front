// ═══════════════════════════════════════════════════════════
// 智环引诊 - 2.5D 数字孪生引擎
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';

class OptimizedTwinEngine {
    constructor(containerId, options = {}) {
        const el = document.getElementById(containerId);
        if (!el) return;
        this.container = el;
        this.dataPath = options.dataPath || '/digital-twin/data/hospital_f1/';
        this.cadData = null;
        this.nodeData = null;
        this.floorTex = null;
        this.cadBounds = { min_x: 0, max_x: 140, min_y: 0, max_y: 90 };
        this.clickableObjects = [];
        this.zoomLevel = 1;
        this.selectedPatient = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isDragging = false;
        this._dragged = false;
        this.lastMouse = { x: 0, y: 0 };
        this._boot();
    }

    async _boot() {
        const W = this.container.clientWidth || 800;
        const H = this.container.clientHeight || 600;
        console.log('boot', W, H);

        // ── Scene ──
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe8eaef);

        // ── Renderer ──
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(W, H);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        // ── Light ──
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        this.scene.add(new THREE.DirectionalLight(0xffffff, 0.6)).position.set(100, -50, 150);

        // ── Data ──
        await this._load();

        // ── Camera ──
        this._cam();

        // ── Build ──
        this._build();

        // ── Events ──
        this._events();

        // ── Loop ──
        this._loop();
    }

    // ═══ Data ═══
    async _load() {
        try {
            const r = await fetch(this.dataPath + 'cad_twin_data.json');
            if (r.ok) {
                this.cadData = await r.json();
                this.cadBounds = this.cadData.metadata.bounds;
                console.log('CAD ok, walls:', this.cadData.walls?.length, 'depts:', this.cadData.departments?.length);
            }
        } catch (e) { console.warn('CAD fetch fail:', e.message); }
        // 底图参考纹理
        try {
            this.floorTex = await new Promise((res, rej) => {
                new THREE.TextureLoader().load(this.dataPath + 'floor_plan.jpg', res, undefined, () => rej());
            });
            this.floorTex.colorSpace = THREE.SRGBColorSpace;
            console.log('底图加载成功');
        } catch (e) { console.warn('底图加载跳过'); }
        try {
            const r = await fetch(this.dataPath + 'nodes_f1.json');
            if (r.ok) this.nodeData = await r.json();
        } catch (e) { /* ok */ }
        if (!this.cadData) {
            console.log('fallback');
            this._fb();
        }
    }

    _fb() {
        this.cadBounds = { min_x: 0, max_x: 140, min_y: 0, max_y: 90 };
        this.cadData = {
            metadata: { bounds: this.cadBounds },
            walls: this._fbWalls(),
            departments: [
                { name: '门诊大厅', x: 65, y: 15, color: '#3b82f6' },
                { name: '内科诊室', x: 15, y: 47, color: '#0ea5e9' },
                { name: '外科诊室', x: 50, y: 47, color: '#06b6d4' },
                { name: '儿科诊室', x: 82, y: 47, color: '#14b8a6' },
                { name: '放射科', x: 15, y: 62, color: '#6366f1' },
                { name: '检验科', x: 50, y: 62, color: '#34d399' },
                { name: '妇科诊室', x: 82, y: 62, color: '#8b5cf6' },
                { name: '药房', x: 118, y: 47, color: '#60a5fa' },
                { name: '心电图室', x: 15, y: 72, color: '#f59e0b' },
                { name: 'B超室', x: 50, y: 72, color: '#a78bfa' },
                { name: 'CT室', x: 82, y: 72, color: '#ef4444' },
                { name: '注射室', x: 118, y: 62, color: '#f97316' },
            ],
            patients: Array.from({ length: 30 }, (_, i) => ({
                id: 'p' + i, name: '患者' + (i + 1),
                gender: i % 2 ? '女' : '男', age: 25 + Math.random() * 55 | 0,
                type: ['门诊', '住院', '急诊'][i % 3],
                typeColor: ['#3b82f6', '#10b981', '#ef4444'][i % 3],
                x: 10 + Math.random() * 120, y: 12 + Math.random() * 72,
                status: ['待诊', '就诊中', '检查中'][i % 3],
                department: ['内科', '外科', '妇科'][i % 3],
                registrationTime: '0' + (8 + Math.random() * 8 | 0) + ':00'
            }))
        };
    }

    _fbWalls() {
        // 正交医院平面（约 140m × 90m）
        const W = [];
        const H = (x1, y, x2) => W.push({ start: [x1, y], end: [x2, y] });
        const V = (x, y1, y2) => W.push({ start: [x, y1], end: [x, y2] });
        // 外轮廓
        H(0, 5, 140); H(0, 85, 140); V(0, 5, 85); V(140, 5, 85);
        // 入口门洞（大厅两侧立柱）
        V(55, 5, 20); V(85, 5, 20);
        // 主走廊横轴
        H(0, 40, 140);
        // 纵向分隔
        V(30, 5, 85); V(65, 5, 40); V(65, 40, 85); V(100, 5, 85);
        // 上排诊室隔断
        H(0, 55, 30); H(30, 55, 65); H(65, 55, 100); H(100, 55, 140);
        H(0, 67, 30); H(30, 67, 65); H(65, 67, 100); H(100, 67, 140);
        H(0, 78, 30); H(30, 78, 65); H(65, 78, 100); H(100, 78, 140);
        // 下排房间
        H(0, 22, 30); H(100, 22, 140);
        H(0, 30, 30); H(100, 30, 140);
        return W;
    }

    // ═══ Camera — 2.5D 等距透视 ═══
    _cam() {
        const cw = this.cadBounds.max_x - this.cadBounds.min_x;
        const ch = this.cadBounds.max_y - this.cadBounds.min_y;
        const cx = (this.cadBounds.min_x + this.cadBounds.max_x) / 2;
        const cy = (this.cadBounds.min_y + this.cadBounds.max_y) / 2;
        const asp = this.container.clientWidth / (this.container.clientHeight || 1);

        const size = Math.max(cw, ch) * 0.6;
        this.camera = new THREE.OrthographicCamera(-size * asp, size * asp, size, -size, 0.1, 2000);

        // 2.5D: 相机略偏，制造深度感，同时保持建筑居中
        this.camera.position.set(cx + size * 0.15, cy - size * 0.25, size * 2.0);
        this.camera.lookAt(cx, cy, 0);
    }

    // ═══ Build ═══
    _build() {
        this._floor();
        this._outline();
        this._walls();
        this._depts();
        this._patients();
    }

    _outline() {
        const segs = this.cadData.building_outline || [];
        if (!segs.length) return;
        segs.forEach(s => {
            const dx = s.end[0] - s.start[0], dy = s.end[1] - s.start[1];
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.5) return;
            const mx = (s.start[0] + s.end[0]) / 2, my = (s.start[1] + s.end[1]) / 2;
            const ang = Math.atan2(dy, dx);
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(len, 0.80, 2.8),
                new THREE.MeshStandardMaterial({ color: 0x9aa0b0, roughness: 0.35, metalness: 0.15 })
            );
            body.position.set(mx, my, 1.4);
            body.rotation.set(0, 0, ang);
            body.castShadow = true; body.receiveShadow = true;
            const cap = new THREE.Mesh(
                new THREE.BoxGeometry(len + 0.10, 0.86, 0.12),
                new THREE.MeshStandardMaterial({ color: 0xb0b8c8, roughness: 0.2, metalness: 0.25 })
            );
            cap.position.z = 1.4; body.add(cap);
            this.scene.add(body);
        });
    }

    _floor() {
        const cw = this.cadBounds.max_x - this.cadBounds.min_x;
        const ch = this.cadBounds.max_y - this.cadBounds.min_y;
        const cx = (this.cadBounds.min_x + this.cadBounds.max_x) / 2;
        const cy = (this.cadBounds.min_y + this.cadBounds.max_y) / 2;

        // 底面（纯色底）
        const base = new THREE.Mesh(
            new THREE.PlaneGeometry(cw, ch),
            new THREE.MeshStandardMaterial({ color: 0xe8eaef, roughness: 0.85, metalness: 0.02 })
        );
        base.position.set(cx, cy, -0.12);
        base.receiveShadow = true;
        this.scene.add(base);

        // 底图参考层（半透明 map.jpg）
        if (this.floorTex) {
            const ref = new THREE.Mesh(
                new THREE.PlaneGeometry(cw, ch),
                new THREE.MeshBasicMaterial({ map: this.floorTex, transparent: true, opacity: 0.35, depthTest: true, depthWrite: false })
            );
            ref.position.set(cx, cy, -0.10);
            ref.renderOrder = 1;
            this.scene.add(ref);
        }

        // 网格
        const grid = new THREE.PolarGridHelper(Math.max(cw, ch) / 2, 30, 15, 64, 0xbec2ca, 0xcdd1d8);
        grid.position.set(cx, cy, -0.08);
        this.scene.add(grid);
    }

    _walls() {
        const raw = this.cadData.walls || [];

        // 保留 >= 2m 的结构墙段
        const structural = raw.filter(w => {
            return Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]) >= 2.0;
        });

        // 正交吸附
        const snapped = structural.map(w => this._snap(w));

        // 合并共线邻接段（允许更大间隙）
        const merged = this._mergeOrtho(snapped, 3.5);

        // 延伸闭合拐角（允许更大延伸距离）
        const connected = this._connectCorners(merged, 6.0);

        // 去重：移除重叠的墙段
        const deduped = this._dedupeWalls(connected);

        console.log('walls: ' + raw.length + ' → struct:' + structural.length +
            ' → merged:' + merged.length + ' → corners:' + connected.length + ' → final:' + deduped.length);

        deduped.forEach(w => {
            const dx = w.end[0] - w.start[0], dy = w.end[1] - w.start[1];
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1.0) return;
            const mx = (w.start[0] + w.end[0]) / 2;
            const my = (w.start[1] + w.end[1]) / 2;
            const isH = Math.abs(dy) < Math.abs(dx);
            const ang = isH ? 0 : Math.PI / 2;

            const wallH = 2.4, wallT = 0.60;
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(len, wallT, wallH),
                new THREE.MeshStandardMaterial({ color: 0xd8dbe3, roughness: 0.40, metalness: 0.10 })
            );
            body.position.set(mx, my, wallH / 2);
            body.rotation.set(0, 0, ang);
            body.castShadow = true; body.receiveShadow = true;
            body.userData = { type: 'wall' };

            const cap = new THREE.Mesh(
                new THREE.BoxGeometry(len + 0.08, wallT + 0.06, 0.10),
                new THREE.MeshStandardMaterial({ color: 0xeef0f5, roughness: 0.25, metalness: 0.18 })
            );
            cap.position.z = wallH; body.add(cap);

            this.scene.add(body);
            this.clickableObjects.push(body);
        });
    }

    _snap(w) {
        const dx = w.end[0] - w.start[0], dy = w.end[1] - w.start[1];
        const mx = (w.start[0] + w.end[0]) / 2, my = (w.start[1] + w.end[1]) / 2;
        if (Math.abs(dx) >= Math.abs(dy)) {
            return { start: [w.start[0], my], end: [w.end[0], my] };
        } else {
            return { start: [mx, w.start[1]], end: [mx, w.end[1]] };
        }
    }

    _mergeOrtho(arr, gap) {
        const H = [], V = [];
        arr.forEach(w => {
            (Math.abs(w.end[0] - w.start[0]) >= Math.abs(w.end[1] - w.start[1]) ? H : V).push(w);
        });
        const out = [];

        // 水平墙按 Y 分组
        const hMap = new Map();
        H.forEach(w => {
            const y = Math.round((w.start[1] + w.end[1]) / 2 * 4) / 4;
            if (!hMap.has(y)) hMap.set(y, []);
            hMap.get(y).push([Math.min(w.start[0], w.end[0]), Math.max(w.start[0], w.end[0])]);
        });
        for (const [y, segs] of hMap) {
            segs.sort((a, b) => a[0] - b[0]);
            const m = [];
            segs.forEach(s => {
                const last = m[m.length - 1];
                if (last && s[0] <= last[1] + gap) last[1] = Math.max(last[1], s[1]);
                else m.push([s[0], s[1]]);
            });
            m.forEach(s => { if (s[1] - s[0] >= 1.5) out.push({ start: [s[0], y], end: [s[1], y] }); });
        }

        // 垂直墙按 X 分组
        const vMap = new Map();
        V.forEach(w => {
            const x = Math.round((w.start[0] + w.end[0]) / 2 * 4) / 4;
            if (!vMap.has(x)) vMap.set(x, []);
            vMap.get(x).push([Math.min(w.start[1], w.end[1]), Math.max(w.start[1], w.end[1])]);
        });
        for (const [x, segs] of vMap) {
            segs.sort((a, b) => a[0] - b[0]);
            const m = [];
            segs.forEach(s => {
                const last = m[m.length - 1];
                if (last && s[0] <= last[1] + gap) last[1] = Math.max(last[1], s[1]);
                else m.push([s[0], s[1]]);
            });
            m.forEach(s => { if (s[1] - s[0] >= 1.5) out.push({ start: [x, s[0]], end: [x, s[1]] }); });
        }
        return out;
    }

    _connectCorners(walls, maxExtend) {
        const H = walls.filter(w => Math.abs(w.end[0] - w.start[0]) >= Math.abs(w.end[1] - w.start[1]));
        const V = walls.filter(w => Math.abs(w.end[0] - w.start[0]) < Math.abs(w.end[1] - w.start[1]));
        const result = [];

        H.forEach(h => {
            const y = (h.start[1] + h.end[1]) / 2;
            let x1 = Math.min(h.start[0], h.end[0]);
            let x2 = Math.max(h.start[0], h.end[0]);
            V.forEach(v => {
                const vx = (v.start[0] + v.end[0]) / 2;
                const vy1 = Math.min(v.start[1], v.end[1]) - 0.5;
                const vy2 = Math.max(v.start[1], v.end[1]) + 0.5;
                if (y < vy1 || y > vy2) return;
                if (vx <= x1 && x1 - vx < maxExtend) x1 = vx;
                if (vx >= x2 && vx - x2 < maxExtend) x2 = vx;
            });
            if (x2 - x1 >= 1.5) result.push({ start: [x1, y], end: [x2, y] });
        });

        V.forEach(v => {
            const x = (v.start[0] + v.end[0]) / 2;
            let y1 = Math.min(v.start[1], v.end[1]);
            let y2 = Math.max(v.start[1], v.end[1]);
            H.forEach(h => {
                const hy = (h.start[1] + h.end[1]) / 2;
                const hx1 = Math.min(h.start[0], h.end[0]) - 0.5;
                const hx2 = Math.max(h.start[0], h.end[0]) + 0.5;
                if (x < hx1 || x > hx2) return;
                if (hy <= y1 && y1 - hy < maxExtend) y1 = hy;
                if (hy >= y2 && hy - y2 < maxExtend) y2 = hy;
            });
            if (y2 - y1 >= 1.5) result.push({ start: [x, y1], end: [x, y2] });
        });

        return result;
    }

    // 移除重叠/重复墙段
    _dedupeWalls(walls) {
        const H = walls.filter(w => Math.abs(w.end[0] - w.start[0]) >= Math.abs(w.end[1] - w.start[1]));
        const V = walls.filter(w => Math.abs(w.end[0] - w.start[0]) < Math.abs(w.end[1] - w.start[1]));
        const out = [];
        // 水平去重：同 Y 且 X 范围重叠 80% 以上则合并
        const hMap = new Map();
        H.forEach(w => {
            const y = Math.round((w.start[1] + w.end[1]) / 2 * 10) / 10;
            const key = y;
            if (!hMap.has(key)) hMap.set(key, []);
            hMap.get(key).push([Math.min(w.start[0], w.end[0]), Math.max(w.start[0], w.end[0])]);
        });
        for (const [y, segs] of hMap) {
            segs.sort((a, b) => a[0] - b[0]);
            const m = [];
            segs.forEach(s => {
                const last = m[m.length - 1];
                // 如果重叠 > 60%，合并
                if (last) {
                    const overlap = Math.min(last[1], s[1]) - Math.max(last[0], s[0]);
                    const minLen = Math.min(last[1] - last[0], s[1] - s[0]);
                    if (overlap > minLen * 0.6 || s[0] <= last[1] + 1.0) {
                        last[1] = Math.max(last[1], s[1]);
                        return;
                    }
                }
                m.push([s[0], s[1]]);
            });
            m.forEach(s => { if (s[1] - s[0] >= 1.5) out.push({ start: [s[0], y], end: [s[1], y] }); });
        }
        // 垂直去重
        const vMap = new Map();
        V.forEach(w => {
            const x = Math.round((w.start[0] + w.end[0]) / 2 * 10) / 10;
            if (!vMap.has(x)) vMap.set(x, []);
            vMap.get(x).push([Math.min(w.start[1], w.end[1]), Math.max(w.start[1], w.end[1])]);
        });
        for (const [x, segs] of vMap) {
            segs.sort((a, b) => a[0] - b[0]);
            const m = [];
            segs.forEach(s => {
                const last = m[m.length - 1];
                if (last) {
                    const overlap = Math.min(last[1], s[1]) - Math.max(last[0], s[0]);
                    const minLen = Math.min(last[1] - last[0], s[1] - s[0]);
                    if (overlap > minLen * 0.6 || s[0] <= last[1] + 1.0) {
                        last[1] = Math.max(last[1], s[1]);
                        return;
                    }
                }
                m.push([s[0], s[1]]);
            });
            m.forEach(s => { if (s[1] - s[0] >= 1.5) out.push({ start: [x, s[0]], end: [x, s[1]] }); });
        }
        return out;
    }

    _depts() {
        const rooms = [];

        (this.cadData.departments || []).forEach(d => {
            const w = Math.max(d.w || 2, 1.5);
            const h = Math.max(d.h || 2, 1.5);
            rooms.push({
                name: d.name, x: d.x, y: d.y, w, h,
                color: d.color || this._deptColor(d.name), source: 'cad'
            });
        });

        if (this.nodeData?.nodes) {
            this.nodeData.nodes.forEach(n => {
                const x = n.real_x_m * 10 + 20;
                const y = n.real_y_m * 10 + 10;
                const dup = rooms.find(r => Math.abs(r.x - x) < 1.5 && Math.abs(r.y - y) < 1.5);
                if (!dup) {
                    rooms.push({
                        name: n.name, x, y, w: 3, h: 3,
                        color: this._deptColor(n.name),
                        source: 'node', type: n.type,
                        crowd: n.crowd_level, people: n.current_people
                    });
                }
            });
        }

        // 按面积排序，大的先放
        rooms.sort((a, b) => (b.w * b.h) - (a.w * a.h));

        const placed = [];

        rooms.forEach(d => {
            const H = 1.6;
            const color = d.color;
            let px = d.x, py = d.y;

            // 检查与已放置块的碰撞，微调位置
            let tries = 0;
            while (tries < 15) {
                const overlap = placed.find(p => {
                    const hw = (d.w + p.w) / 2 + 0.3;
                    const hh = (d.h + p.h) / 2 + 0.3;
                    return Math.abs(p.x - px) < hw && Math.abs(p.y - py) < hh;
                });
                if (!overlap) break;
                px += (Math.random() - 0.5) * (d.w * 0.6);
                py += (Math.random() - 0.5) * (d.h * 0.6);
                tries++;
            }

            placed.push({ x: px, y: py, w: d.w, h: d.h, data: d });

            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(d.w, d.h, H),
                new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.45 })
            );
            mesh.position.set(px, py, H / 2);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { type: 'department', data: d };

            const top = new THREE.Mesh(
                new THREE.BoxGeometry(d.w + 0.3, d.h + 0.3, 0.08),
                new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.40, transparent: true, opacity: 0.80 })
            );
            top.position.z = H; mesh.add(top);

            this.scene.add(mesh);
            this.clickableObjects.push(mesh);

            const labelText = d.people ? `${d.name} ${d.people}人` : d.name;
            this._label(labelText, px, py, H + 0.5, color);
        });

        console.log('科室/房间:', rooms.length);
    }

    _deptColor(n) {
        const m = {
            '门诊': '#3b82f6', '大厅': '#3b82f6', '导诊': '#3b82f6', '办': '#3b82f6',
            '内科': '#0ea5e9', '外科': '#06b6d4',
            '儿科': '#14b8a6', '儿童': '#14b8a6',
            '妇科': '#8b5cf6', '放射': '#6366f1', '影像': '#6366f1',
            '检验': '#34d399', '化验': '#34d399',
            '药': '#60a5fa', '房': '#60a5fa',
            '电梯': '#f59e0b', '消防': '#ef4444', '楼梯': '#f59e0b',
            '卫生': '#a78bfa', '急诊': '#ef4444', '护士': '#2563eb',
        };
        for (const [k, v] of Object.entries(m)) { if (n.includes(k)) return v; }
        return '#64748b';
    }

    _label(text, x, y, z, color) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // 测量文字宽度
        ctx.font = '500 20px Inter, PingFang SC, Microsoft YaHei, sans-serif';
        const metrics = ctx.measureText(text);
        const tw = metrics.width + 40;
        const th = 44;
        canvas.width = Math.max(128, Math.ceil(tw));
        canvas.height = th;

        // 背景
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.beginPath();
        ctx.roundRect(6, 4, canvas.width - 12, th - 8, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 色点
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(18, th / 2, 5, 0, Math.PI * 2);
        ctx.fill();

        // 文字
        ctx.fillStyle = '#1a1d28';
        ctx.font = '500 20px Inter, PingFang SC, Microsoft YaHei, sans-serif';
        ctx.fillText(text, 30, th / 2 + 7);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
        sprite.position.set(x, y, z);
        sprite.scale.set(canvas.width * 0.03, th * 0.03, 1);
        sprite.renderOrder = 999;
        this.scene.add(sprite);
    }

    _patients() {
        (this.cadData.patients || []).forEach(p => {
            const c = p.typeColor || '#3b82f6';
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.4, 0.04, 8, 16),
                new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6 })
            );
            ring.position.set(p.x, p.y, 0.1);
            ring.rotation.x = -Math.PI / 2;
            ring.userData = { ring: true };
            this.scene.add(ring);
            const core = new THREE.Mesh(
                new THREE.SphereGeometry(0.25, 12, 12),
                new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, metalness: 0.1, emissive: c, emissiveIntensity: 0.5 })
            );
            core.position.set(p.x, p.y, 2.5);
            core.userData = { type: 'patient', data: p, phase: Math.random() * Math.PI * 2, speed: 1.5 + Math.random() * 2, ring: ring };
            this.scene.add(core);
            this.clickableObjects.push(core);
        });
    }

    // ═══ Events ═══
    _events() {
        const c = this.renderer.domElement;
        c.addEventListener('pointerdown', e => { this.isDragging = true; this.lastMouse = { x: e.clientX, y: e.clientY }; this._dragged = false; });
        c.addEventListener('pointermove', e => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouse.x, dy = e.clientY - this.lastMouse.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this._dragged = true;
            this.camera.position.x -= dx * 0.1 * this.zoomLevel;
            this.camera.position.y += dy * 0.1 * this.zoomLevel;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        });
        c.addEventListener('pointerup', () => { this.isDragging = false; });
        c.addEventListener('wheel', e => {
            e.preventDefault();
            this.zoomLevel *= e.deltaY > 0 ? 1.08 : 0.92;
            this.zoomLevel = Math.max(0.05, Math.min(20, this.zoomLevel));
            this.camera.zoom = 1 / this.zoomLevel;
            this.camera.updateProjectionMatrix();
            const el = document.getElementById('zoomLevel');
            if (el) el.textContent = Math.round(100 / this.zoomLevel) + '%';
        }, { passive: false });
        window.addEventListener('resize', () => {
            const W = this.container.clientWidth, H = this.container.clientHeight;
            this.renderer.setSize(W, H);
            const cw = this.cadBounds.max_x - this.cadBounds.min_x;
            const ch = this.cadBounds.max_y - this.cadBounds.min_y;
            const asp = W / (H || 1);
            const size = Math.max(cw, ch) * 0.65;
            this.camera.left = -size * asp;
            this.camera.right = size * asp;
            this.camera.top = size;
            this.camera.bottom = -size;
            this.camera.updateProjectionMatrix();
        });
        // toolbar buttons
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        bind('zoomIn', () => { this.zoomLevel *= 0.85; this.camera.zoom = 1 / this.zoomLevel; this.camera.updateProjectionMatrix(); });
        bind('zoomOut', () => { this.zoomLevel *= 1.18; this.camera.zoom = 1 / this.zoomLevel; this.camera.updateProjectionMatrix(); });
        bind('resetView', () => { this.zoomLevel = 1; this._cam(); });
    }

    // ═══ Loop ═══
    _loop() {
        requestAnimationFrame(() => this._loop());
        const t = Date.now() * 0.0015;
        this.scene.children.forEach(c => {
            if (c.userData?.ring) {
                c.scale.setScalar(1 + Math.sin(t * 1.5 + (c.userData.phase || 0)) * 0.08);
                c.material.emissiveIntensity = 0.4 + Math.sin(t * 2 + (c.userData.phase || 0)) * 0.2;
            }
        });
        this.renderer.render(this.scene, this.camera);
    }
}

export { OptimizedTwinEngine };
