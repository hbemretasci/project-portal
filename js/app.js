// State Management
const STATE = {
    projects: [],
    departments: [],
    functionMap: {}, // dept -> Set of functions
    deptDevamCount: {}, // dept -> count of 'Devam Ediyor'
    statuses: {
        'Başlamadı': { color: 'var(--color-baslamadi)', count: 0 },
        'Devam Ediyor': { color: 'var(--color-devam)', count: 0 },
        'Tamamlandı': { color: 'var(--color-tamam)', count: 0 },
        'Takip': { color: 'var(--color-takip)', count: 0 },
        'İptal': { color: 'var(--color-iptal)', count: 0 }
    },
    activeDepartment: null,
    activeFunction: null,
    chartLoaded: false
};

// Icon mapping for specific departments
const DEPT_ICONS = {
    "Talep Yönetimi": "inbox",
    "Planlama": "calendar",
    "Lojistik": "truck",
    "Kale Nakliyat": "package",
    "Satınalma": "shopping-cart",
    "Dijital Dönüşüm": "cpu"
};

// Color mapping for departments
const DEPT_COLORS = {
    "Talep Yönetimi": "#46B1E1",
    "Planlama": "#E97132",
    "Lojistik": "#3B7D23",
    "Kale Nakliyat": "#F02C2C",
    "Satınalma": "#4E63A8",
    "Dijital Dönüşüm": "#747474"
};

const getBadgeClass = (statusStr) => {
    if (!statusStr) return 'badge-başlamadı';
    const s = statusStr.toLowerCase();
    if (s.includes('başlama')) return 'badge-başlamadı';
    if (s.includes('devam')) return 'badge-devam';
    if (s.includes('tamam')) return 'badge-tamamlandı';
    if (s.includes('takip')) return 'badge-takip';
    if (s.includes('iptal')) return 'badge-i̇ptal';
    return 'badge-başlamadı';
};

// Initialize Application
async function init() {
    // Load chart lib asynchronously
    google.charts.load('current', {'packages':['gantt']});
    google.charts.setOnLoadCallback(() => { STATE.chartLoaded = true; });

    try {
        await loadExcelData();
    } catch(e) {
        console.error("Failed to load or parse Excel:", e);
        alert("Excel dosyası yüklenemedi. dataset/SCM Project Portal Data.xlsx dosyasının mevcut olduğundan emin olun.");
    }
    
    renderSidebar();
    renderHeaderStats(null, 'overview-header-stats');
    renderOverview();
    
    // Initialize icons
    lucide.createIcons();
}

async function loadExcelData() {
    // Fetch local file
    const response = await fetch('dataset/SCM Project Portal Data.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    
    // Parse using SheetJS
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    
    // We assume data is on the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    parseData(jsonData);
}

function parseData(data) {
    STATE.projects = data;
    
    const dSet = new Set();
    
    data.forEach(row => {
        // Safe access ignoring undefined
        const dept = row.department ? row.department.trim() : "Bilinmeyen Departman";
        const func = row.function ? row.function.trim() : "Genel";
        const status = row.project_status ? row.project_status.trim() : "Başlamadı";
        
        // Departments tracking
        dSet.add(dept);
        
        // Functions tracking
        if (!STATE.functionMap[dept]) STATE.functionMap[dept] = new Set();
        STATE.functionMap[dept].add(func);
        
        // Status tracking
        let matchedStatus = Object.keys(STATE.statuses).find(k => status.toLowerCase().includes(k.toLowerCase()));
        if (matchedStatus) {
            STATE.statuses[matchedStatus].count++;
        }
        
        // Devam Ediyor counter for department
        if (!STATE.deptDevamCount[dept]) STATE.deptDevamCount[dept] = 0;
        if (status.toLowerCase().includes('devam')) {
            STATE.deptDevamCount[dept]++;
        }
    });

    STATE.departments = Array.from(dSet).sort();
}

// === RENDERERS ===

function renderSidebar() {
    const list = document.getElementById('nav-list');
    let html = `
        <li class="nav-item active" id="nav-home" onclick="goHome()">
            <i data-lucide="layout-dashboard"></i> Ana Sayfa
        </li>
    `;
    
    STATE.departments.forEach(dept => {
        const iconName = DEPT_ICONS[dept] || "briefcase";
        const color = DEPT_COLORS[dept] || "var(--text-muted)";
        html += `
            <li class="nav-item" id="nav-dept-${sanitizeId(dept)}" onclick="goToDepartment('${dept}')">
                <i data-lucide="${iconName}" style="color: ${color};"></i> ${dept}
            </li>
        `;
    });
    
    list.innerHTML = html;
}

function renderHeaderStats(departmentFilter = null, containerId = null) {
    let counts = {
        'Başlamadı': 0,
        'Devam Ediyor': 0,
        'Tamamlandı': 0,
        'Takip': 0,
        'İptal': 0
    };
    
    if (departmentFilter) {
        // Calculate dynamic counts for a specific department
        STATE.projects.forEach(row => {
            const rowDept = row.department ? row.department.trim() : "Bilinmeyen Departman";
            if (rowDept === departmentFilter) {
                const status = row.project_status ? row.project_status.trim() : "Başlamadı";
                const matchedStatus = Object.keys(counts).find(k => status.toLowerCase().includes(k.toLowerCase()));
                if (matchedStatus) {
                    counts[matchedStatus]++;
                }
            }
        });
    } else {
        // Global counts
        Object.keys(counts).forEach(k => {
            counts[k] = STATE.statuses[k].count;
        });
    }

    let html = '';
    
    Object.keys(counts).forEach(status => {
        const info = STATE.statuses[status];
        const countValue = counts[status];
        
        // Pad single digit numbers with zero
        const countStr = countValue.toString().padStart(2, '0');
        // Upper case Turkish correctly
        const statusUpper = status.toLocaleUpperCase('tr-TR');
        
        html += `
            <div class="stat-item" style="border-left-color: ${info.color};">
                <span class="stat-label" style="color: ${info.color}">${statusUpper}</span>
                <div class="stat-count" style="color: ${info.color}">${countStr}</div>
            </div>
        `;
    });
    
    if (containerId) {
        const cont = document.getElementById(containerId);
        if (cont) cont.innerHTML = html;
    } else {
        document.querySelectorAll('.header-stats-container').forEach(container => {
            container.innerHTML = html;
        });
    }
}

function renderOverview() {
    const container = document.getElementById('overview-grid');
    let html = '';
    
    STATE.departments.forEach(dept => {
        const iconName = DEPT_ICONS[dept] || "briefcase";
        const color = DEPT_COLORS[dept] || "var(--accent-blue)";
        const count = STATE.deptDevamCount[dept] || 0;
        
        // 1a suffix roughly adds 10% opacity in hex
        html += `
            <div class="tile" onclick="goToDepartment('${dept}')" style="border-top-color: ${color}; border-top-width: 4px;">
                <div class="tile-icon-wrapper" style="color: ${color}; background-color: ${color}1a;">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="tile-counter">
                    <span class="tile-counter-num">${count}</span>
                    <span class="tile-counter-label">Devam Eden</span>
                </div>
                <div class="tile-title" style="color: ${color};">${dept}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// === NAVIGATION ===

function goHome() {
    document.getElementById('page-overview').classList.add('page-active');
    document.getElementById('page-department').classList.remove('page-active');
    
    // Update nav active states
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-home').classList.add('active');
    
    STATE.activeDepartment = null;
    STATE.activeFunction = null;
}

function goToDepartment(dept) {
    STATE.activeDepartment = dept;
    STATE.activeFunction = null; // reset
    
    // Update View
    document.getElementById('page-overview').classList.remove('page-active');
    document.getElementById('page-department').classList.add('page-active');
    
    // Update nav active states
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navId = `nav-dept-${sanitizeId(dept)}`;
    if (document.getElementById(navId)) document.getElementById(navId).classList.add('active');
    
    // Set text headers
    const titleEl = document.getElementById('dept-title');
    titleEl.textContent = dept;
    const color = DEPT_COLORS[dept] || "var(--text-dark)";
    titleEl.style.color = color;
    const count = STATE.deptDevamCount[dept] || 0;
    document.getElementById('dept-subtitle').textContent = `Toplam ${count} devam eden projesi bulunuyor.`;

    // Render department specific stats
    renderHeaderStats(dept, 'dept-header-stats');

    renderFunctionsTabs();
}

function renderFunctionsTabs() {
    const container = document.getElementById('functions-tabs');
    const funcs = Array.from(STATE.functionMap[STATE.activeDepartment] || []);
    funcs.sort();
    
    if (funcs.length > 0 && !STATE.activeFunction) {
        STATE.activeFunction = funcs[0]; // default select first
    }
    
    let html = '';
    funcs.forEach(f => {
        const activeCls = (f === STATE.activeFunction) ? 'active' : '';
        html += `<button class="tab-btn ${activeCls}" onclick="setFunction('${f}')">${f}</button>`;
    });
    
    container.innerHTML = html;
    
    // Render the actual content inside functions
    renderDepartmentContent();
}

function setFunction(func) {
    STATE.activeFunction = func;
    // Visually update fast
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.textContent === func) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    
    renderDepartmentContent();
}

function renderDepartmentContent() {
    // Filter projects
    const filtered = STATE.projects.filter(p => {
        const pd = p.department ? p.department.trim() : "Bilinmeyen Departman";
        const pf = p.function ? p.function.trim() : "Genel";
        return pd === STATE.activeDepartment && pf === STATE.activeFunction;
    });
    
    // 1. Render List
    const listHtml = filtered.map(p => {
        const start = p.start_date instanceof Date ? p.start_date.toLocaleDateString('tr-TR') : p.start_date || '-';
        const end = p.end_date instanceof Date ? p.end_date.toLocaleDateString('tr-TR') : p.end_date || '-';
        const st = p.project_status || 'Başlamadı';

        const match = Object.keys(STATE.statuses).find(k => st.toLowerCase().includes(k.toLowerCase()));
        const titleColor = match ? STATE.statuses[match].color : 'var(--text-dark)';
        
        return `
            <div class="project-item">
                <div class="project-group">
                    <span>${p.project_group || 'Genel Grup'}</span>
                    ${p.digital_initiative ? `<span class="meta-initiative">${p.digital_initiative}</span>` : ''}
                </div>
                <div class="project-name" style="color: ${titleColor};">
                    ${p.project_name || 'İsimsiz Proje'}
                    <button class="btn-detail" onclick="openProjectModal('${encodeURIComponent(p.project_name || '')}')"><i data-lucide="info"></i> Detay</button>
                </div>
                <div class="project-meta">
                    <span class="badge ${getBadgeClass(st)}">${st}</span>
                    <div class="meta-date">
                        <i data-lucide="calendar"></i> ${start} - ${end}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('project-list').innerHTML = listHtml || '<p style="color:var(--text-muted)">Proje bulunamadı.</p>';
    
    // 2. Render Gantt
    renderGantt(filtered);
    
    // Re-bind lucide icons on dynamically created HTML
    lucide.createIcons();
}

function renderGantt(projects) {
    const ganttContainer = document.getElementById('gantt_chart');
    const emptyMsg = document.getElementById('gantt_empty');
    
    if(!STATE.chartLoaded) {
        ganttContainer.style.display = 'none';
        emptyMsg.style.display = 'flex';
        emptyMsg.innerHTML = "Grafik Yükleniyor...";
        return;
    }

    // Filter down to allowed statuses
    const allowedStatuses = ['başlamadı', 'devam', 'tamam'];
    const ganttProjects = projects.filter(p => {
        const st = (p.project_status || '').toLowerCase();
        return allowedStatuses.some(kw => st.includes(kw));
    });

    if (ganttProjects.length === 0) {
        ganttContainer.style.display = 'none';
        emptyMsg.style.display = 'flex';
        emptyMsg.innerHTML = `<div style="text-align: center;">
            <p>Bu görünüm için geçerli tarihli proje bulunamadı.</p>
        </div>`;
        return;
    }

    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Task ID');
    data.addColumn('string', 'Task Name');
    data.addColumn('string', 'Resource');
    data.addColumn('date', 'Start Date');
    data.addColumn('date', 'End Date');
    data.addColumn('number', 'Duration');
    data.addColumn('number', 'Percent Complete');
    data.addColumn('string', 'Dependencies');

    let validRows = 0;
    
    ganttProjects.forEach((p, idx) => {
        let sDate = (p.start_date instanceof Date) ? p.start_date : new Date(p.start_date);
        let eDate = (p.end_date instanceof Date) ? p.end_date : new Date(p.end_date);
        
        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return;
        
        if (eDate.getTime() < sDate.getTime()) {
            eDate = new Date(sDate.getTime() + 86400000); // add 1 day fallback
        }
        
        let percentage = p.project_status && p.project_status.toLowerCase().includes('tamam') ? 100 : 
                         p.project_status && p.project_status.toLowerCase().includes('devam') ? 50 : 0;

        let pName = p.project_name || 'İsimsiz';
                         
        data.addRow([
            'Project_' + idx,
            pName,
            p.project_group || 'Genel',
            sDate,
            eDate,
            null,
            percentage, 
            null
        ]);
        validRows++;
    });

    ganttContainer.style.display = 'block';
    emptyMsg.style.display = 'none';

    // Calculate dynamic height based on row count
    const dynamicHeight = Math.max(400, validRows * 42 + 60);

    const options = {
        height: dynamicHeight,
        gantt: {
            trackHeight: 30,
            labelStyle: { fontName: 'Inter', fontSize: 13 },
            barCornerRadius: 4,
            innerGridHorizLine: { stroke: '#e2e8f0', strokeWidth: 1 },
            innerGridTrack: { fill: '#f8fafc' },
            innerGridDarkTrack: { fill: '#f1f5f9' },
            shadowEnabled: false
        }
    };

    const chart = new google.visualization.Gantt(ganttContainer);

    chart.draw(data, options);
}

// Utils
function sanitizeId(str) {
    if (!str) return 'unknown';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// Window resize listener to redraw chart responsively
window.addEventListener('resize', () => {
    if(STATE.activeDepartment && STATE.activeFunction) {
        renderDepartmentContent();
    }
});

// === MODAL LOGIC ===
function openProjectModal(encodedName) {
    const rawName = decodeURIComponent(encodedName);
    const p = STATE.projects.find(pr => pr.project_name === rawName);
    if (!p) return;

    document.getElementById('modal-title').textContent = p.project_name || 'İsimsiz Proje';
    document.getElementById('modal-meta').textContent = `${p.project_group || 'Genel'} | ${p.start_date instanceof Date ? p.start_date.toLocaleDateString('tr-TR') : p.start_date || '-'} - ${p.end_date instanceof Date ? p.end_date.toLocaleDateString('tr-TR') : p.end_date || '-'}`;
    
    // Desc
    document.getElementById('modal-desc').textContent = p.project_desc || 'Bu proje için açıklama girilmemiştir.';
    
    // Lists Parser
    const parseList = (str) => {
        if (!str) return '<div class="empty-data">Kayıtlı adım bulunamadı.</div>';
        const items = str.toString().split('\n').map(s => s.trim().replace(/^[-•*]\s*/, '').trim()).filter(s => s.length > 0);
        if (items.length === 0) return '<div class="empty-data">Kayıtlı adım bulunamadı.</div>';
        return '<ul>' + items.map(itm => `<li>${itm}</li>`).join('') + '</ul>';
    };

    document.getElementById('modal-done').innerHTML = parseList(p.done_list);
    document.getElementById('modal-todo').innerHTML = parseList(p.todo_list);
    
    document.getElementById('project-modal').classList.add('active');
    lucide.createIcons(); // refresh icons inside modal if needed
}

function closeProjectModal() {
    document.getElementById('project-modal').classList.remove('active');
}

// Boot
window.onload = init;
