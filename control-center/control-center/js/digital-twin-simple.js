/**
 * 数字孪生核心逻辑 - 简化版
 */

let scene, camera, renderer;
let floorTexture, floorMesh;
let nodeGroup, pathGroup, heatmapGroup;
let heatmapCanvas, heatmapTexture;
let raycaster, mouse;
let currentFloor = 'F1';
let showNodes = true;
let showPaths = true;
let showHeatmap = false;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let zoomLevel = 1;

let heatmapConfig = {
    radius: 60,
    intensity: 0.8,
    gradient: 'classic',
    animation: true,
    speed: 0.02
};

const config = {
    imagePath: '/digital-twin/data/hospital_f1/floor_plan.jpg',
    nodesPath: '/digital-twin/data/hospital_f1/nodes_f1.json',
    scale: 100,
    imageWidth: 2000,
    imageHeight: 2000,
    nodeSize: 15,
    pathWidth: 3,
    buildingBounds: {
        minX: 330,
        maxX: 400,
        minY: -5,
        maxY: 50
    }
};

const nodeColors = {
    nurse_station: 0x4285f4,
    dept_entrance: 0x51cf66,
    substation: 0xfcc419,
    emergency: 0xff6b6b,
    service: 0x9b59b6,
    default: 0x868e96
};

let realNodes = [];
let realEdges = [];

const heatmapGradients = {
    classic: [
        { pos: 0.0, color: [0, 255, 0] },
        { pos: 0.5, color: [255, 255, 0] },
        { pos: 1.0, color: [255, 0, 0] }
    ],
    fire: [
        { pos: 0.0, color: [0, 0, 139] },
        { pos: 0.25, color: [0, 255, 255] },
        { pos: 0.5, color: [255, 255, 0] },
        { pos: 0.75, color: [255, 165, 0] },
        { pos: 1.0, color: [255, 0, 0] }
    ],
    purple: [
        { pos: 0.0, color: [0, 0, 255] },
        { pos: 0.33, color: [138, 43, 226] },
        { pos: 0.66, color: [255, 105, 180] },
        { pos: 1.0, color: [255, 0, 0] }
    ],
    cyberpunk: [
        { pos: 0.0, color: [0, 255, 255] },
        { pos: 0.3, color: [255, 0, 255] },
        { pos: 0.6, color: [255, 255, 0] },
        { pos: 1.0, color: [255, 50, 50] }
    ]
};

function init() {
    try {
        const container = document.getElementById('twin-canvas-container');
        if (!container) {
            console.error('找不到canvas容器');
            return;
        }

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f3f5);

        const aspect = container.clientWidth / container.clientHeight;
        const viewSize = 1500;
        camera = new THREE.OrthographicCamera(
            -viewSize * aspect, viewSize * aspect,
            viewSize, -viewSize,
            0.1, 1000
        );
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        nodeGroup = new THREE.Group();
        pathGroup = new THREE.Group();
        heatmapGroup = new THREE.Group();
        scene.add(nodeGroup);
        scene.add(pathGroup);
        scene.add(heatmapGroup);

        loadFloorImage();
        loadNodeData();
        bindEvents();

        setTimeout(() => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'none';
        }, 1000);

        animate();
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

function loadFloorImage() {
    const loader = new THREE.TextureLoader();
    const encodedPath = encodeURI(config.imagePath);
    console.log('尝试加载底图:', encodedPath);

    loader.load(
        encodedPath,
        (texture) => {
            floorTexture = texture;
            createFloorMesh();
        },
        undefined,
        (error) => {
            console.error('加载底图失败:', error);
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.innerHTML = '<p style="color: #ff6b6b;">加载底图失败，请检查图片路径</p>';
        }
    );
}

function loadNodeData() {
    fetch(config.nodesPath)
        .then(response => response.json())
        .then(data => {
            if (data.nodes && Array.isArray(data.nodes)) {
                realNodes = data.nodes;
                console.log('成功加载节点数据:', realNodes.length, '个节点');
                generateSimplePaths();
                createNodes();
                createPaths();
                initHeatmap();
                updateStats();
            }
        })
        .catch(error => {
            console.error('加载节点数据失败:', error);
            realNodes = [
                { id: 'node_01', name: '门诊大厅导诊台', type: 'nurse_station', x: 10, y: 8, crowd_level: 85, status: 'online' },
                { id: 'node_02', name: '放射科', type: 'dept_entrance', x: 15, y: 12, crowd_level: 52, status: 'online' },
                { id: 'node_03', name: '检验科', type: 'dept_entrance', x: 18, y: 8, crowd_level: 92, status: 'online' }
            ];
            realEdges = [
                { from: 'node_01', to: 'node_02', length_m: 10, crowd_factor: 1.0 },
                { from: 'node_01', to: 'node_03', length_m: 8, crowd_factor: 0.8 }
            ];
            createNodes();
            createPaths();
            initHeatmap();
            updateStats();
        });
}

function generateSimplePaths() {
    realEdges = [];
    for (let i = 0; i < realNodes.length; i++) {
        for (let j = i + 1; j < realNodes.length; j++) {
            const node1 = realNodes[i];
            const node2 = realNodes[j];
            const dx = node2.x - node1.x;
            const dy = node2.y - node1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 20) {
                realEdges.push({
                    from: node1.id,
                    to: node2.id,
                    length_m: distance,
                    crowd_factor: 0.8 + Math.random() * 0.4
                });
            }
        }
    }
}

function createFloorMesh() {
    const geometry = new THREE.PlaneGeometry(config.imageWidth, config.imageHeight);
    const material = new THREE.MeshBasicMaterial({
        map: floorTexture,
        transparent: true
    });
    floorMesh = new THREE.Mesh(geometry, material);
    floorMesh.position.set(0, 0, -1);
    scene.add(floorMesh);

    camera.left = -config.imageWidth / 2;
    camera.right = config.imageWidth / 2;
    camera.top = config.imageHeight / 2;
    camera.bottom = -config.imageHeight / 2;
    camera.updateProjectionMatrix();
}

function createNodes() {
    nodeGroup.clear();
    realNodes.forEach(node => {
        const nodeMesh = createNodeMesh(node);
        nodeGroup.add(nodeMesh);
    });
}

function createNodeMesh(node) {
    const color = nodeColors[node.type] || nodeColors.default;
    const geometry = new THREE.CircleGeometry(config.nodeSize, 32);
    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    const worldPos = meterToWorld(node.x, node.y);
    mesh.position.set(worldPos.x, worldPos.y, 0);

    const label = createLabel(node.name);
    label.position.set(worldPos.x, worldPos.y + config.nodeSize + 10, 1);
    mesh.add(label);
    mesh.userData = node;

    const glowGeometry = new THREE.CircleGeometry(config.nodeSize + 5, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.position.z = -0.1;
    mesh.add(glowMesh);

    return mesh;
}

function createLabel(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 24px Arial';
    context.fillStyle = '#212529';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(100, 25, 1);
    return sprite;
}

function createPaths() {
    pathGroup.clear();
    realEdges.forEach(edge => {
        const fromNode = realNodes.find(n => n.id === edge.from);
        const toNode = realNodes.find(n => n.id === edge.to);
        if (fromNode && toNode) {
            const pathMesh = createPathMesh(fromNode, toNode, edge);
            pathGroup.add(pathMesh);
        }
    });
}

function createPathMesh(fromNode, toNode, edge) {
    const fromPos = meterToWorld(fromNode.x, fromNode.y);
    const toPos = meterToWorld(toNode.x, toNode.y);
    const points = [
        new THREE.Vector3(fromPos.x, fromPos.y, 0),
        new THREE.Vector3(toPos.x, toPos.y, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    let color;
    if (edge.crowd_factor >= 1.2) {
        color = 0xff6b6b;
    } else if (edge.crowd_factor >= 0.8) {
        color = 0xfcc419;
    } else {
        color = 0x51cf66;
    }
    const material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: config.pathWidth,
        transparent: true,
        opacity: 0.8
    });
    const line = new THREE.Line(geometry, material);
    line.userData = { from: fromNode, to: toNode, edge: edge };
    return line;
}

function meterToWorld(meterX, meterY) {
    const bounds = config.buildingBounds;
    const relativeX = (meterX - bounds.minX) / (bounds.maxX - bounds.minX);
    const relativeY = (meterY - bounds.minY) / (bounds.maxY - bounds.minY);
    const margin = 50;
    const pixelX = margin + relativeX * (config.imageWidth - 2 * margin);
    const pixelY = margin + relativeY * (config.imageHeight - 2 * margin);
    return {
        x: pixelX - config.imageWidth / 2,
        y: config.imageHeight / 2 - pixelY
    };
}

function pixelToWorld(pixelX, pixelY) {
    return {
        x: pixelX - config.imageWidth / 2,
        y: config.imageHeight / 2 - pixelY
    };
}

function initHeatmap() {
    if (realNodes.length === 0) {
        console.warn('没有节点数据，跳过热力图初始化');
        return;
    }
    heatmapCanvas = document.createElement('canvas');
    heatmapCanvas.width = config.imageWidth;
    heatmapCanvas.height = config.imageHeight;
    heatmapTexture = new THREE.CanvasTexture(heatmapCanvas);
    heatmapTexture.needsUpdate = true;
    const geometry = new THREE.PlaneGeometry(config.imageWidth, config.imageHeight);
    const material = new THREE.MeshBasicMaterial({
        map: heatmapTexture,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    const heatmapMesh = new THREE.Mesh(geometry, material);
    heatmapMesh.position.set(0, 0, -0.5);
    heatmapGroup.add(heatmapMesh);
    generateHeatmap();
}

function generateHeatmap() {
    if (!heatmapCanvas) return;
    const ctx = heatmapCanvas.getContext('2d');
    const gradient = heatmapGradients[heatmapConfig.gradient];
    ctx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);
    realNodes.forEach(node => {
        const worldPos = meterToWorld(node.x, node.y);
        const pixelX = worldPos.x + config.imageWidth / 2;
        const pixelY = worldPos.y + config.imageHeight / 2;
        const intensity = (node.crowd_level || 50) / 100 * heatmapConfig.intensity;
        drawHeatPoint(ctx, pixelX, pixelY, heatmapConfig.radius, intensity, gradient);
    });
    if (heatmapTexture) {
        heatmapTexture.needsUpdate = true;
    }
}

function drawHeatPoint(ctx, x, y, radius, intensity, gradient) {
    const radialGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.forEach(stop => {
        const alpha = stop.pos * intensity;
        radialGradient.addColorStop(stop.pos, `rgba(${stop.color[0]}, ${stop.color[1]}, ${stop.color[2]}, ${alpha})`);
    });
    ctx.fillStyle = radialGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function updateHeatmapWithAnimation() {
    if (!showHeatmap || !heatmapCanvas) return;
    const ctx = heatmapCanvas.getContext('2d');
    const gradient = heatmapGradients[heatmapConfig.gradient];
    ctx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);
    const time = Date.now() * 0.001;
    realNodes.forEach((node, index) => {
        const worldPos = meterToWorld(node.x, node.y);
        const pixelX = worldPos.x + config.imageWidth / 2;
        const pixelY = worldPos.y + config.imageHeight / 2;
        const baseIntensity = (node.crowd_level || 50) / 100 * heatmapConfig.intensity;
        const animatedIntensity = baseIntensity * (0.8 + 0.2 * Math.sin(time + index));
        const animatedRadius = heatmapConfig.radius * (0.9 + 0.1 * Math.sin(time * 1.5 + index));
        drawHeatPoint(ctx, pixelX, pixelY, animatedRadius, animatedIntensity, gradient);
    });
    if (heatmapTexture) {
        heatmapTexture.needsUpdate = true;
    }
    if (showHeatmap && heatmapConfig.animation) {
        requestAnimationFrame(updateHeatmapWithAnimation);
    }
}

function toggleHeatmap() {
    showHeatmap = !showHeatmap;
    heatmapGroup.visible = showHeatmap;
    const btn = document.getElementById('toggleHeatmap');
    if (btn) btn.classList.toggle('active', showHeatmap);
    if (showHeatmap) {
        if (heatmapConfig.animation) {
            updateHeatmapWithAnimation();
        } else {
            generateHeatmap();
        }
    }
}

function updateHeatmapParams(params) {
    Object.assign(heatmapConfig, params);
    if (params.radius !== undefined) {
        const radiusInput = document.getElementById('heatmapRadius');
        const radiusValue = document.getElementById('heatmapRadiusValue');
        if (radiusInput) radiusInput.value = params.radius;
        if (radiusValue) radiusValue.textContent = params.radius + 'px';
    }
    if (params.intensity !== undefined) {
        const intensityInput = document.getElementById('heatmapIntensity');
        const intensityValue = document.getElementById('heatmapIntensityValue');
        if (intensityInput) intensityInput.value = params.intensity * 100;
        if (intensityValue) intensityValue.textContent = Math.round(params.intensity * 100) + '%';
    }
    if (params.animation !== undefined) {
        const animationInput = document.getElementById('heatmapAnimation');
        const indicator = document.getElementById('heatmapIndicator');
        if (animationInput) animationInput.checked = params.animation;
        if (indicator) indicator.style.display = params.animation ? 'flex' : 'none';
    }
    if (showHeatmap) {
        if (heatmapConfig.animation) {
            updateHeatmapWithAnimation();
        } else {
            generateHeatmap();
        }
    }
}

function updateStats() {
    const onlineCount = realNodes.filter(n => n.status === 'online').length;
    const totalCount = realNodes.length;
    const onlineEl = document.getElementById('onlineSubstations');
    if (onlineEl) onlineEl.textContent = `${onlineCount}/${totalCount}`;
}

function bindEvents() {
    const container = document.getElementById('twin-canvas-container');
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        camera.position.x -= deltaX;
        camera.position.y += deltaY;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    container.addEventListener('mouseup', () => isDragging = false);
    container.addEventListener('mouseleave', () => isDragging = false);

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        zoomLevel *= zoomFactor;
        zoomLevel = Math.max(0.5, Math.min(3, zoomLevel));
        applyZoom();
    });

    container.addEventListener('click', (e) => onMouseClick(e));
}

function applyZoom() {
    const container = document.getElementById('twin-canvas-container');
    if (!container) return;
    const aspect = container.clientWidth / container.clientHeight;
    const viewSize = 1500 * zoomLevel;
    camera.left = -viewSize * aspect;
    camera.right = viewSize * aspect;
    camera.top = viewSize;
    camera.bottom = -viewSize;
    camera.updateProjectionMatrix();
}

function onMouseClick(event) {
    const container = document.getElementById('twin-canvas-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeGroup.children);
    if (intersects.length > 0) {
        const node = intersects[0].object.userData;
        showNodeInfo(node);
    } else {
        hideNodeInfo();
    }
}

function showNodeInfo(node) {
    let panel = document.querySelector('.node-info-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.className = 'node-info-panel';
        document.body.appendChild(panel);
    }
    panel.innerHTML = `
        <h3><span style="color: ${nodeColors[node.type] ? '#' + nodeColors[node.type].toString(16).padStart(6, '0') : 'gray'}">●</span> ${node.name}</h3>
        <div class="node-info-item">
            <div class="label">节点ID</div>
            <div class="value">${node.id}</div>
        </div>
        <div class="node-info-item">
            <div class="label">类型</div>
            <div class="value">${node.type}</div>
        </div>
        <div class="node-info-item">
            <div class="label">拥挤度</div>
            <div class="value">${node.crowd_level || 0}%</div>
        </div>
        <div class="node-info-item">
            <div class="label">状态</div>
            <div class="value">${node.status === 'online' ? '🟢 在线' : '🔴 离线'}</div>
        </div>
        <button class="node-info-close" onclick="hideNodeInfo()">✕</button>
    `;
    panel.style.display = 'block';
}

function hideNodeInfo() {
    const panel = document.querySelector('.node-info-panel');
    if (panel) panel.style.display = 'none';
}

function switchFloor(floor) {
    currentFloor = floor;
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.floor === floor);
    });
    loadNodeData();
}

function toggleNodes() {
    showNodes = !showNodes;
    nodeGroup.visible = showNodes;
    document.getElementById('toggleNodes').classList.toggle('active', showNodes);
}

function togglePaths() {
    showPaths = !showPaths;
    pathGroup.visible = showPaths;
    document.getElementById('togglePaths').classList.toggle('active', showPaths);
}

function resetView() {
    zoomLevel = 1;
    camera.position.set(0, 0, 100);
    applyZoom();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', init);
