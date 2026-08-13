/**
 * 数字孪生核心逻辑
 * 基于 Three.js 的医院院区数字孪生可视化系统
 */

// 全局变量
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

// 热力图配置
let heatmapConfig = {
    radius: 60,           // 热力点半径
    intensity: 0.8,       // 强度
    gradient: 'classic',  // 渐变样式
    animation: true,      // 动态效果
    speed: 0.02           // 动画速度
};

// 配置信息
const config = {
    imagePath: '/digital-twin/data/hospital_f1/floor_plan.jpg',
    nodesPath: '/digital-twin/data/hospital_f1/nodes_f1.json',
    apiBase: 'http://localhost:3000/api',
    scale: 100, // 米转像素的缩放因子
    imageWidth: 2000,
    imageHeight: 2000,
    nodeSize: 15,
    pathWidth: 3,
    // 建筑实际尺寸（米）
    buildingBounds: {
        minX: 330,  // DXF坐标最小X
        maxX: 400,  // DXF坐标最大X
        minY: -5,   // DXF坐标最小Y
        maxY: 50   // DXF坐标最大Y
    }
};

// 节点颜色配置
const nodeColors = {
    nurse_station: 0x4285f4,  // 蓝色 - 导诊台/护士站
    dept_entrance: 0x51cf66,   // 绿色 - 科室入口
    substation: 0xfcc419,      // 黄色 - 边缘子站
    emergency: 0xff6b6b,       // 红色 - 紧急区域
    service: 0x9b59b6,         // 紫色 - 服务区域
    default: 0x868e96          // 灰色 - 普通节点
};

// 真实节点数据（从文件加载）
let realNodes = [];
let realEdges = [];

/**
 * 初始化 Three.js 场景
 */
function init() {
    try {
        const container = document.getElementById('twin-canvas-container');

        // 创建场景
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f3f5);

        // 创建正交相机
        const aspect = container.clientWidth / container.clientHeight;
        const viewSize = 1500;
        camera = new THREE.OrthographicCamera(
            -viewSize * aspect, viewSize * aspect,
            viewSize, -viewSize,
            0.1, 1000
        );
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);

        // 创建渲染器
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // 初始化射线检测
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // 初始化组
        nodeGroup = new THREE.Group();
        pathGroup = new THREE.Group();
        heatmapGroup = new THREE.Group();
        scene.add(nodeGroup);
        scene.add(pathGroup);
        scene.add(heatmapGroup);

        // 加载底图
        loadFloorImage();

        // 加载节点数据（热力图会在节点数据加载后初始化）
        loadNodeData();

        // 绑定事件
        bindEvents();

        // 隐藏加载动画
        setTimeout(() => {
            document.getElementById('loading-overlay').style.display = 'none';
        }, 1000);

        // 开始渲染循环
        animate();
    } catch (error) {
        console.error('初始化失败:', error);
        document.getElementById('loading-overlay').innerHTML =
            '<p style="color: #ff6b6b;">初始化失败: ' + error.message + '</p>';
    }
}

/**
 * 加载楼层底图
 */
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
            document.getElementById('loading-overlay').innerHTML =
                '<p style="color: #ff6b6b;">加载底图失败，请检查图片路径</p>';
        }
    );
}

/**
 * 加载节点数据
 */
function loadNodeData() {
    fetch(config.nodesPath)
        .then(response => response.json())
        .then(data => {
            if (data.nodes && Array.isArray(data.nodes)) {
                realNodes = data.nodes;
                console.log('成功加载节点数据:', realNodes.length, '个节点');

                // 生成简单的路径连接
                generateSimplePaths();

                // 创建节点和路径
                createNodes();
                createPaths();

                // 初始化热力图
                initHeatmap();

                updateStats();
            }
        })
        .catch(error => {
            console.error('加载节点数据失败:', error);
            // 如果加载失败，使用示例数据
            console.log('使用示例节点数据');
            realNodes = [
                { id: 'node_01', name: '门诊大厅导诊台', type: 'nurse_station', x: 10, y: 8, crowd_level: 85, status: 'online' },
                { id: 'node_02', name: '放射科', type: 'dept_entrance', x: 15, y: 12, crowd_level: 52, status: 'online' },
                { id: 'node_03', name: '检验科', type: 'dept_entrance', x: 18, y: 8, crowd_level: 92, status: 'online' },
                { id: 'node_04', name: '电梯厅', type: 'substation', x: 22, y: 5, crowd_level: 35, status: 'online' },
                { id: 'node_05', name: '卫生间', type: 'emergency', x: 8, y: 10, crowd_level: 40, status: 'online' }
            ];
            realEdges = [
                { from: 'node_01', to: 'node_02', length_m: 10, crowd_factor: 1.0 },
                { from: 'node_01', to: 'node_03', length_m: 8, crowd_factor: 0.8 },
                { from: 'node_01', to: 'node_04', length_m: 12, crowd_factor: 0.9 },
                { from: 'node_01', to: 'node_05', length_m: 5, crowd_factor: 1.1 }
            ];
            createNodes();
            createPaths();

            // 初始化热力图
            initHeatmap();

            updateStats();
        });
}

/**
 * 生成简单的路径连接（基于节点位置）
 */
function generateSimplePaths() {
    realEdges = [];

    for (let i = 0; i < realNodes.length; i++) {
        for (let j = i + 1; j < realNodes.length; j++) {
            const node1 = realNodes[i];
            const node2 = realNodes[j];

            // 计算距离
            const dx = node2.x - node1.x;
            const dy = node2.y - node1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 如果距离在合理范围内，创建路径
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

    console.log('生成路径:', realEdges.length, '条');
}

/**
 * 创建地面网格
 */
function createFloorMesh() {
    const geometry = new THREE.PlaneGeometry(
        config.imageWidth,
        config.imageHeight
    );

    const material = new THREE.MeshBasicMaterial({
        map: floorTexture,
        transparent: true
    });

    floorMesh = new THREE.Mesh(geometry, material);
    floorMesh.position.set(0, 0, -1);
    scene.add(floorMesh);

    // 调整相机视图以适应图片
    camera.left = -config.imageWidth / 2;
    camera.right = config.imageWidth / 2;
    camera.top = config.imageHeight / 2;
    camera.bottom = -config.imageHeight / 2;
    camera.updateProjectionMatrix();
}

/**
 * 创建节点标记
 */
function createNodes() {
    nodeGroup.clear();

    realNodes.forEach(node => {
        const nodeMesh = createNodeMesh(node);
        nodeGroup.add(nodeMesh);
    });
}

/**
 * 创建单个节点
 */
function createNodeMesh(node) {
    const color = nodeColors[node.type] || nodeColors.default;

    // 创建圆形几何体
    const geometry = new THREE.CircleGeometry(config.nodeSize, 32);
    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);

    // 米坐标转像素坐标（再转世界坐标）
    const worldPos = meterToWorld(node.x, node.y);
    mesh.position.set(worldPos.x, worldPos.y, 0);

    // 添加标签
    const label = createLabel(node.name);
    label.position.set(worldPos.x, worldPos.y + config.nodeSize + 10, 1);
    mesh.add(label);

    // 存储节点数据
    mesh.userData = node;

    // 添加光晕效果
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

/**
 * 创建文本标签
 */
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

/**
 * 创建路径连线
 */
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

/**
 * 创建路径线段
 */
function createPathMesh(fromNode, toNode, edge) {
    const fromPos = meterToWorld(fromNode.x, fromNode.y);
    const toPos = meterToWorld(toNode.x, toNode.y);

    const points = [
        new THREE.Vector3(fromPos.x, fromPos.y, 0),
        new THREE.Vector3(toPos.x, toPos.y, 0)
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // 根据拥挤度设置颜色
    let color;
    if (edge.crowd_factor >= 1.2) {
        color = 0xff6b6b; // 红色 - 拥挤
    } else if (edge.crowd_factor >= 0.8) {
        color = 0xfcc419; // 黄色 - 中等
    } else {
        color = 0x51cf66; // 绿色 - 通畅
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

/**
 * 米坐标转世界坐标（用于DXF提取的数据）
 * 根据建筑边界进行坐标映射
 */
function meterToWorld(meterX, meterY) {
    const bounds = config.buildingBounds;

    // 计算DXF坐标在建筑边界内的相对位置（0-1）
    const relativeX = (meterX - bounds.minX) / (bounds.maxX - bounds.minX);
    const relativeY = (meterY - bounds.minY) / (bounds.maxY - bounds.minY);

    // 转换为像素坐标（考虑边距）
    const margin = 50; // 边距像素
    const pixelX = margin + relativeX * (config.imageWidth - 2 * margin);
    const pixelY = margin + relativeY * (config.imageHeight - 2 * margin);

    // 转换为Three.js世界坐标
    return {
        x: pixelX - config.imageWidth / 2,
        y: config.imageHeight / 2 - pixelY
    };
}

/**
 * 像素坐标转世界坐标（用于手动标注的数据）
 */
function pixelToWorld(pixelX, pixelY) {
    return {
        x: pixelX - config.imageWidth / 2,
        y: config.imageHeight / 2 - pixelY
    };
}

/**
 * 世界坐标转像素坐标
 */
function worldToPixel(worldX, worldY) {
    return {
        x: worldX / config.scale + config.imageWidth / 2,
        y: config.imageHeight / 2 - worldY / config.scale
    };
}

/**
 * 绑定事件监听
 */
function bindEvents() {
    const container = document.getElementById('twin-canvas-container');

    // 鼠标点击事件
    container.addEventListener('click', onMouseClick);

    // 鼠标移动事件
    container.addEventListener('mousemove', onMouseMove);

    // 鼠标滚轮缩放
    container.addEventListener('wheel', onMouseWheel);

    // 窗口大小调整
    window.addEventListener('resize', onWindowResize);

    // 控制按钮事件
    document.getElementById('toggleNodes').addEventListener('click', toggleNodes);
    document.getElementById('togglePaths').addEventListener('click', togglePaths);
    document.getElementById('toggleHeatmap').addEventListener('click', toggleHeatmap);
    document.getElementById('zoomIn').addEventListener('click', zoomIn);
    document.getElementById('zoomOut').addEventListener('click', zoomOut);
    document.getElementById('resetView').addEventListener('click', resetView);

    // 关闭节点信息面板
    document.getElementById('closeNodePanel').addEventListener('click', closeNodePanel);

    // 楼层切换按钮
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchFloor(e.target.dataset.floor);
        });
    });

    // 初始化按钮状态
    document.getElementById('toggleNodes').classList.add('active');
    document.getElementById('togglePaths').classList.add('active');
}

/**
 * 鼠标点击事件
 */
function onMouseClick(event) {
    updateMousePosition(event);
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(nodeGroup.children);

    if (intersects.length > 0) {
        const node = intersects[0].object.userData;
        showNodeInfo(node);
    }
}

/**
 * 鼠标移动事件
 */
function onMouseMove(event) {
    updateMousePosition(event);
}

/**
 * 更新鼠标位置
 */
function updateMousePosition(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

/**
 * 鼠标滚轮缩放
 */
function onMouseWheel(event) {
    event.preventDefault();

    const zoomSpeed = 0.1;
    if (event.deltaY < 0) {
        zoomIn();
    } else {
        zoomOut();
    }
}

/**
 * 窗口大小调整
 */
function onWindowResize() {
    const container = document.getElementById('twin-canvas-container');
    const aspect = container.clientWidth / container.clientHeight;

    camera.left = -config.imageWidth / 2 * zoomLevel;
    camera.right = config.imageWidth / 2 * zoomLevel;
    camera.top = config.imageHeight / 2 * zoomLevel;
    camera.bottom = -config.imageHeight / 2 * zoomLevel;
    camera.updateProjectionMatrix();

    renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * 显示节点信息
 */
function showNodeInfo(node) {
    const panel = document.getElementById('nodeInfoPanel');
    panel.style.display = 'block';

    document.getElementById('nodeName').textContent = node.name;
    document.getElementById('nodeId').textContent = node.id;
    document.getElementById('nodeType').textContent = getNodeTypeName(node.type);
    document.getElementById('nodeCoords').textContent =
        `(${node.pixel_x}, ${node.pixel_y})`;
    document.getElementById('nodePeopleCount').textContent =
        Math.floor(Math.random() * 50) + '人';
    document.getElementById('nodeCrowdLevel').textContent =
        node.crowd_level + '%';
    document.getElementById('nodeSubstationStatus').textContent =
        node.status === 'online' ? '在线' : '离线';
}

/**
 * 关闭节点信息面板
 */
function closeNodePanel() {
    document.getElementById('nodeInfoPanel').style.display = 'none';
}

/**
 * 获取节点类型名称
 */
function getNodeTypeName(type) {
    const typeMap = {
        'nurse_station': '导诊台/护士站',
        'dept_entrance': '科室入口',
        'substation': '边缘子站',
        'emergency': '紧急区域',
        'default': '普通节点'
    };
    return typeMap[type] || '未知';
}

/**
 * 切换节点显示
 */
function toggleNodes() {
    showNodes = !showNodes;
    nodeGroup.visible = showNodes;
    document.getElementById('toggleNodes').classList.toggle('active', showNodes);
}

/**
 * 切换路径显示
 */
function togglePaths() {
    showPaths = !showPaths;
    pathGroup.visible = showPaths;
    document.getElementById('togglePaths').classList.toggle('active', showPaths);
}

/**
 * 切换热力图显示
 */
function toggleHeatmap() {
    showHeatmap = !showHeatmap;
    heatmapGroup.visible = showHeatmap;
    document.getElementById('toggleHeatmap').classList.toggle('active', showHeatmap);
}

/**
 * 放大
 */
function zoomIn() {
    zoomLevel = Math.max(0.5, zoomLevel - 0.1);
    applyZoom();
}

/**
 * 缩小
 */
function zoomOut() {
    zoomLevel = Math.min(2, zoomLevel + 0.1);
    applyZoom();
}

/**
 * 应用缩放
 */
function applyZoom() {
    camera.left = -config.imageWidth / 2 * zoomLevel;
    camera.right = config.imageWidth / 2 * zoomLevel;
    camera.top = config.imageHeight / 2 * zoomLevel;
    camera.bottom = -config.imageHeight / 2 * zoomLevel;
    camera.updateProjectionMatrix();
}

/**
 * 重置视图
 */
function resetView() {
    zoomLevel = 1;
    camera.position.set(0, 0, 100);
    applyZoom();
}

/**
 * 切换楼层
 */
function switchFloor(floor) {
    currentFloor = floor;

    // 更新按钮状态
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.floor === floor);
    });

    // 更新标题
    document.getElementById('currentFloorTitle').textContent =
        `${floor} 层 - 门诊楼`;

    // 重新加载数据（这里可以加载不同楼层的JSON文件）
    // 暂时使用相同的数据
    createNodes();
    createPaths();
}

/**
 * 更新统计信息
 */
function updateStats() {
    // 模拟实时更新
    const onlineCount = realNodes.filter(n => n.status === 'online').length;
    const totalCount = realNodes.length;
    document.getElementById('onlineSubstations').textContent =
        `${onlineCount}/${totalCount}`;

    document.getElementById('activePatients').textContent =
        Math.floor(Math.random() * 100) + 120;

    document.getElementById('avgCrowd').textContent =
        Math.floor(Math.random() * 20) + 60 + '%';
}

/**
 * 渲染循环
 */
function animate() {
    requestAnimationFrame(animate);

    // 更新节点光晕动画
    nodeGroup.children.forEach(node => {
        if (node.children[1]) {
            const glowMesh = node.children[1];
            glowMesh.material.opacity = 0.2 + Math.sin(Date.now() * 0.003) * 0.1;
        }
    });

    renderer.render(scene, camera);
}

// 更新时间显示
setInterval(() => {
    const now = new Date();
    document.getElementById('currentTime').textContent =
        now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(/\//g, '-');
}, 1000);

// 模拟数据更新
setInterval(updateStats, 5000);

/* ========================================
 * 热力图系统
 * ======================================== */

// 热力图渐变配置
const heatmapGradients = {
    // 柔和渐变（舒适视觉）- 推荐
    soft: [
        { pos: 0.0, color: [200, 230, 200] },   // 淡绿色（极低）
        { pos: 0.3, color: [180, 220, 255] },   // 淡蓝色（低）
        { pos: 0.5, color: [255, 230, 180] },   // 淡橙色（中）
        { pos: 0.75, color: [255, 180, 180] },  // 淡红色（高）
        { pos: 1.0, color: [220, 100, 100] }    // 深红色（极高）
    ],
    // 经典渐变（柔和版）
    classic: [
        { pos: 0.0, color: [50, 200, 50] },     // 柔和绿色（低）
        { pos: 0.4, color: [200, 200, 50] },    // 柔和黄绿（中低）
        { pos: 0.6, color: [255, 200, 50] },    // 柔和黄色（中高）
        { pos: 0.8, color: [255, 120, 50] },    // 柔和橙色（高）
        { pos: 1.0, color: [200, 50, 50] }      // 柔和红色（极高）
    ],
    // 海洋渐变（清凉舒适）
    ocean: [
        { pos: 0.0, color: [200, 230, 255] },   // 淡蓝（极低）
        { pos: 0.3, color: [150, 200, 255] },   // 天蓝（低）
        { pos: 0.5, color: [100, 180, 255] },   // 蓝色（中）
        { pos: 0.75, color: [200, 150, 255] },  // 紫蓝（高）
        { pos: 1.0, color: [150, 100, 200] }    // 紫红（极高）
    ],
    // 暖色调渐变（温馨舒适）
    warm: [
        { pos: 0.0, color: [255, 240, 220] },   // 奶油色（极低）
        { pos: 0.3, color: [255, 220, 180] },   // 桃色（低）
        { pos: 0.5, color: [255, 180, 140] },   // 杏色（中）
        { pos: 0.75, color: [255, 140, 100] },  // 暖橙（高）
        { pos: 1.0, color: [200, 80, 80] }      // 砖红（极高）
    ],
    // 赛博朋克渐变（优化版）
    cyberpunk: [
        { pos: 0.0, color: [150, 255, 255] },   // 淡青色（低）
        { pos: 0.3, color: [200, 150, 255] },   // 淡紫（中）
        { pos: 0.6, color: [255, 200, 150] },   // 淡金（高）
        { pos: 1.0, color: [255, 100, 100] }     // 亮红（极高）
    ]
};

let heatmapData = [];
let heatmapUpdateInterval = null;

/**
 * 从模拟后端获取热力图数据
 */
async function fetchHeatmapData() {
    try {
        const response = await fetch(`${config.apiBase}/heatmap`);
        const result = await response.json();
        if (result.success && result.data) {
            heatmapData = result.data;
            console.log('成功获取热力图数据:', heatmapData.length, '个热力点');
            return true;
        }
    } catch (error) {
        console.error('获取热力图数据失败:', error);
    }
    return false;
}

/**
 * 初始化热力图
 */
function initHeatmap() {
    // 创建Canvas
    heatmapCanvas = document.createElement('canvas');
    heatmapCanvas.width = config.imageWidth;
    heatmapCanvas.height = config.imageHeight;

    // 创建纹理
    heatmapTexture = new THREE.CanvasTexture(heatmapCanvas);
    heatmapTexture.needsUpdate = true;

    // 创建热力图平面（降低曝光度）
    const geometry = new THREE.PlaneGeometry(config.imageWidth, config.imageHeight);
    const material = new THREE.MeshBasicMaterial({
        map: heatmapTexture,
        transparent: true,
        opacity: 0.4,  // 降低整体透明度
        blending: THREE.NormalBlending  // 取消叠加混合，避免过度曝光
    });

    const heatmapMesh = new THREE.Mesh(geometry, material);
    heatmapMesh.position.set(0, 0, -0.5); // 在地面下方
    heatmapGroup.add(heatmapMesh);

    // 初始生成
    generateHeatmap();
}

/**
 * 开始热力图更新
 */
function startHeatmapUpdate() {
    if (heatmapUpdateInterval) return;

    heatmapUpdateInterval = setInterval(async () => {
        if (showHeatmap) {
            await fetchHeatmapData();
            if (heatmapConfig.animation) {
                updateHeatmapWithAnimation();
            } else {
                generateHeatmap();
            }
        }
    }, 3000);
}

/**
 * 停止热力图更新
 */
function stopHeatmapUpdate() {
    if (heatmapUpdateInterval) {
        clearInterval(heatmapUpdateInterval);
        heatmapUpdateInterval = null;
    }
}

/**
 * 生成热力图（增强版）
 */
function generateHeatmap() {
    if (!heatmapCanvas) return;

    const ctx = heatmapCanvas.getContext('2d');
    const gradient = heatmapGradients[heatmapConfig.gradient];

    // 清除画布
    ctx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);

    // 使用后端获取的热力数据
    if (heatmapData.length > 0) {
        heatmapData.forEach(point => {
            const worldPos = meterToWorld(point.x, point.y);
            const pixelX = worldPos.x + config.imageWidth / 2;
            const pixelY = worldPos.y + config.imageHeight / 2;

            // 根据强度绘制热力点
            const intensity = (point.intensity || 50) / 100 * heatmapConfig.intensity;
            const radius = heatmapConfig.radius * (0.9 + Math.random() * 0.3);

            // 绘制热力点（增强版）
            drawHeatPoint(ctx, pixelX, pixelY, radius, intensity, gradient);
        });
    } else {
        // 备用：使用节点数据
        realNodes.forEach(node => {
            const worldPos = meterToWorld(node.x, node.y);
            const pixelX = worldPos.x + config.imageWidth / 2;
            const pixelY = worldPos.y + config.imageHeight / 2;

            const intensity = (node.crowd_level || 50) / 100 * heatmapConfig.intensity;
            drawHeatPoint(ctx, pixelX, pixelY, heatmapConfig.radius, intensity, gradient);
        });
    }

    // 应用高斯模糊使边缘更柔和
    applyGaussianBlur(ctx, heatmapCanvas.width, heatmapCanvas.height);

    // 更新纹理
    if (heatmapTexture) {
        heatmapTexture.needsUpdate = true;
    }
}

/**
 * 绘制单个热力点（降低曝光度版）
 */
function drawHeatPoint(ctx, x, y, radius, intensity, gradient) {
    // 限制强度范围并降低整体强度
    intensity = Math.max(0.05, Math.min(0.8, intensity * 0.6)); // 降低60%强度

    // 外层光晕（更柔和）
    const outerRadius = radius * 1.3;
    const outerGradient = ctx.createRadialGradient(x, y, radius * 0.4, x, y, outerRadius);

    gradient.forEach(stop => {
        const alpha = stop.pos * intensity * 0.1; // 降低外层强度
        outerGradient.addColorStop(stop.pos, `rgba(${stop.color[0]}, ${stop.color[1]}, ${stop.color[2]}, ${alpha})`);
    });

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    // 中层过渡（降低强度）
    const midRadius = radius * 1.05;
    const midGradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, midRadius);

    gradient.forEach(stop => {
        const alpha = stop.pos * intensity * 0.25; // 降低中层强度
        midGradient.addColorStop(stop.pos, `rgba(${stop.color[0]}, ${stop.color[1]}, ${stop.color[2]}, ${alpha})`);
    });

    ctx.fillStyle = midGradient;
    ctx.beginPath();
    ctx.arc(x, y, midRadius, 0, Math.PI * 2);
    ctx.fill();

    // 核心区域（降低强度）
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

    gradient.forEach(stop => {
        const alpha = stop.pos * intensity * 0.5 + 0.1 * (1 - stop.pos) * intensity; // 降低核心强度
        coreGradient.addColorStop(stop.pos, `rgba(${stop.color[0]}, ${stop.color[1]}, ${stop.color[2]}, ${alpha})`);
    });

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * 应用高斯模糊到热力图
 */
function applyGaussianBlur(ctx, width, height) {
    // 使用内置模糊滤镜
    ctx.filter = 'blur(4px)';
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = 'none';
}

/**
 * 更新热力图（带动画效果）
 */
let heatmapAnimationId = null;
let animationTime = 0;

function updateHeatmapWithAnimation() {
    if (!showHeatmap || !heatmapCanvas) return;

    animationTime += heatmapConfig.speed;

    const ctx = heatmapCanvas.getContext('2d');
    const gradient = heatmapGradients[heatmapConfig.gradient];

    // 清除画布
    ctx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);

    // 使用后端热力数据（带动画）
    if (heatmapData.length > 0) {
        heatmapData.forEach((point, index) => {
            const worldPos = meterToWorld(point.x, point.y);
            const pixelX = worldPos.x + config.imageWidth / 2;
            const pixelY = worldPos.y + config.imageHeight / 2;

            // 根据强度和动画计算（更平滑的动画）
            const baseIntensity = (point.intensity || 50) / 100 * heatmapConfig.intensity;
            const animatedIntensity = baseIntensity * (0.85 + 0.15 * Math.sin(animationTime * 0.5 + index * 0.3));

            // 动态半径（更柔和的变化）
            const animatedRadius = heatmapConfig.radius * (0.85 + 0.15 * Math.sin(animationTime * 0.8 + index * 0.4));

            // 绘制热力点（增强版）
            drawHeatPoint(ctx, pixelX, pixelY, animatedRadius, animatedIntensity, gradient);
        });
    } else {
        // 备用：使用节点数据
        realNodes.forEach((node, index) => {
            const worldPos = meterToWorld(node.x, node.y);
            const pixelX = worldPos.x + config.imageWidth / 2;
            const pixelY = worldPos.y + config.imageHeight / 2;

            const baseIntensity = (node.crowd_level || 50) / 100 * heatmapConfig.intensity;
            const animatedIntensity = baseIntensity * (0.85 + 0.15 * Math.sin(animationTime * 0.5 + index * 0.3));
            const animatedRadius = heatmapConfig.radius * (0.85 + 0.15 * Math.sin(animationTime * 0.8 + index * 0.4));

            drawHeatPoint(ctx, pixelX, pixelY, animatedRadius, animatedIntensity, gradient);
        });
    }

    // 应用高斯模糊使边缘更柔和
    applyGaussianBlur(ctx, heatmapCanvas.width, heatmapCanvas.height);

    // 更新纹理
    if (heatmapTexture) {
        heatmapTexture.needsUpdate = true;
    }

    // 继续动画（降低帧率以节省性能）
    if (showHeatmap && heatmapConfig.animation) {
        heatmapAnimationId = requestAnimationFrame(updateHeatmapWithAnimation);
    }
}

/**
 * 切换热力图显示
 */
function toggleHeatmap() {
    showHeatmap = !showHeatmap;
    heatmapGroup.visible = showHeatmap;
    document.getElementById('toggleHeatmap').classList.toggle('active', showHeatmap);

    if (showHeatmap) {
        // 首次获取数据
        fetchHeatmapData().then(() => {
            if (heatmapConfig.animation) {
                updateHeatmapWithAnimation();
            } else {
                generateHeatmap();
            }
        });
        // 启动定时更新
        startHeatmapUpdate();
    } else {
        // 停止动画
        if (heatmapAnimationId) {
            cancelAnimationFrame(heatmapAnimationId);
            heatmapAnimationId = null;
        }
        // 停止定时更新
        stopHeatmapUpdate();
    }
}

/**
 * 更新热力图参数
 */
function updateHeatmapParams(params) {
    Object.assign(heatmapConfig, params);

    // 更新UI显示
    if (params.radius !== undefined) {
        document.getElementById('heatmapRadius').value = params.radius;
        document.getElementById('heatmapRadiusValue').textContent = params.radius + 'px';
    }

    if (params.intensity !== undefined) {
        document.getElementById('heatmapIntensity').value = params.intensity * 100;
        document.getElementById('heatmapIntensityValue').textContent = Math.round(params.intensity * 100) + '%';
    }

    if (params.animation !== undefined) {
        document.getElementById('heatmapAnimation').checked = params.animation;
        document.getElementById('heatmapIndicator').style.display = params.animation ? 'flex' : 'none';
    }

    if (showHeatmap) {
        if (heatmapConfig.animation) {
            updateHeatmapWithAnimation();
        } else {
            generateHeatmap();
        }
    }
}

/**
 * 添加实时热力点（模拟实时数据）
 */
function addRealtimeHeatPoint(x, y, crowdLevel) {
    if (!showHeatmap) return;

    // 创建临时节点用于绘制
    const tempNode = {
        x: x,
        y: y,
        crowd_level: crowdLevel
    };

    // 绘制到热力图
    const ctx = heatmapCanvas.getContext('2d');
    const worldPos = meterToWorld(tempNode.x, tempNode.y);
    const pixelX = worldPos.x + config.imageWidth / 2;
    const pixelY = worldPos.y + config.imageHeight / 2;
    const intensity = crowdLevel / 100 * heatmapConfig.intensity;

    drawHeatPoint(ctx, pixelX, pixelY, heatmapConfig.radius, intensity, heatmapGradients[heatmapConfig.gradient]);

    if (heatmapTexture) {
        heatmapTexture.needsUpdate = true;
    }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);
