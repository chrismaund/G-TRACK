/* global firebase, supabase */
/* eslint-disable no-undef */

// =========================================================================
// FIREBASE CONFIGURATION & INITIALIZATION
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyAfNAuQSyCS6fslTarSJUBZ_6w2Z7iRKjw",
    authDomain: "gso-gtrack.firebaseapp.com",
    databaseURL: "https://gso-gtrack-default-rtdb.firebaseio.com",
    projectId: "gso-gtrack",
    storageBucket: "gso-gtrack.firebasestorage.app",
    messagingSenderId: "599744539051",
    appId: "1:599744539051:web:ad84868be0c69328a60aee",
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();
const auth = firebase.auth();
const db = firebase.firestore();
const inventoryRef = database.ref('inventoryData');
const requestsRef = database.ref('masterlistRequests');

function sanitizeText(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let currentEmployeeEmail = "";
let currentEmployeeName = "";
let currentEmployeeUid = "";
let currentEmployeeCreatedAt = "";
let currentEmployeeDept = "";

// =========================================================================
// AUTHENTICATION GUARD & SESSION PROTECTION (EMPLOYEE)
// =========================================================================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        sessionStorage.clear();
        window.location.replace("../login/index.html");
        return;
    }

    currentEmployeeEmail = user.email || "";
    currentEmployeeUid = user.uid;

    try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (!userDoc.exists) {
            auth.signOut();
            window.location.replace("../login/index.html");
            return;
        }

        const userData = userDoc.data();
        if (userData.role !== 'employee') {
            auth.signOut();
            window.location.replace("../login/index.html");
            return;
        }

        if (userData.status === 'pending' || userData.status === 'rejected') {
            auth.signOut();
            window.location.replace("../login/index.html");
            return;
        }

        currentEmployeeName = userData.fullName || userData.name || user.email;
        currentEmployeeCreatedAt = userData.createdAt || "";
        currentEmployeeDept = userData.department || "Staff Access";

        // Update UI displays with employee info
        const nameEl = document.getElementById('emp-profile-name');
        const emailEl = document.getElementById('emp-profile-email');
        const heroNameEl = document.getElementById('emp-hero-name');
        const navbarEmailEl = document.querySelector('.navbar .user-email');

        if (nameEl) nameEl.textContent = currentEmployeeName;
        if (emailEl) emailEl.textContent = currentEmployeeDept;
        if (heroNameEl) heroNameEl.textContent = currentEmployeeName;
        if (navbarEmailEl) navbarEmailEl.textContent = `${currentEmployeeName} (${currentEmployeeDept})`;

        // Profile modal fields
        const modalFullname = document.getElementById('profile-name-input') || document.getElementById('profile-fullname');
        const modalEmail = document.getElementById('profile-email-input') || document.getElementById('profile-email-display');
        const modalDept = document.getElementById('profile-dept-input');
        const modalCreated = document.getElementById('profile-created-display');

        if (modalFullname) modalFullname.value = currentEmployeeName;
        if (modalEmail) {
            if (modalEmail.tagName === 'INPUT') modalEmail.value = currentEmployeeEmail;
            else modalEmail.textContent = currentEmployeeEmail;
        }
        if (modalDept) modalDept.value = currentEmployeeDept;
        if (modalCreated) modalCreated.textContent = currentEmployeeCreatedAt ? new Date(currentEmployeeCreatedAt).toLocaleDateString() : 'Active';

        renderHistory();
    } catch (e) {
        console.warn("Could not verify employee session:", e);
    }
});

// =========================================================================
// SUPABASE CONFIGURATION & DATA MAPPERS (EMPLOYEE)
// =========================================================================
const SUPABASE_URL = "https://mrmwmjbfnurukvfpwiij.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybXdtamJmbnVydWt2ZnB3aWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTYwNzksImV4cCI6MjEwMzMzMjA3OX0.Y-Uu0hiIjWPxpsG8uKS9Na_pjUUqS1IxpaUkZ7GeNZA";

const supabaseClient = (typeof window.supabase !== 'undefined') 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

function mapSupabaseToInventoryItem(row) {
    return {
        id: row.id,
        date: row.date || '',
        qty: parseInt(row.qty, 10) || 0,
        unit: row.unit || '',
        unitCost: parseFloat(row.unit_cost) || 0,
        totalCost: parseFloat(row.total_cost) || 0,
        article: row.article || '',
        description: row.description || '',
        propertyNo: row.property_no || '',
        location: row.location || '',
        accountablePerson: row.accountable_person || '',
        condition: row.condition || 'Serviceable',
        account: row.account || '',
        remarks: row.remarks || '',
        createdAt: row.created_at
    };
}

function mapSupabaseToRequest(row) {
    let reqTime = '';
    if (row.requested_at) {
        try {
            reqTime = new Date(row.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            reqTime = row.requested_at;
        }
    } else if (row.time) {
        reqTime = row.time;
    } else {
        reqTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return {
        id: row.id,
        user: row.user_email || row.user_name || 'employee@gso.com',
        userName: row.user_name || row.user_email || 'Employee',
        time: reqTime,
        status: (row.status || 'pending'),
        fulfilledTime: row.fulfilled_time || '',
        csvDataString: row.csv_data || ''
    };
}

/**
 * Builds structured CSV payload from current inventory data for download.
 */
function buildCSVString() {
    const headers = ["Date", "Quantity", "Unit", "Unit Cost", "Article", "Description", "Property No", "Total Cost", "Location", "Accountable Person", "Condition", "Account Group", "Remarks"];
    const rows = inventoryData.map(item => [
        `"${item.date || ''}"`,
        `"${item.qty || 0}"`,
        `"${item.unit || ''}"`,
        `"${item.unitCost || 0}"`,
        `"${(item.article || '').replace(/"/g, '""')}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`,
        `"${item.propertyNo || ''}"`,
        `"${item.totalCost || 0}"`,
        `"${item.location || ''}"`,
        `"${item.accountablePerson || ''}"`,
        `"${item.condition || ''}"`,
        `"${item.account || ''}"`,
        `"${(item.remarks || '').replace(/"/g, '""')}"`
    ].join(","));
    return [headers.join(","), ...rows].join("\r\n");
}

// =========================================================================
// DOM SELECTORS & STATE MANAGEMENT
// =========================================================================
const tableBody = document.getElementById('inventory-body');
const accountFilter = document.getElementById('account-filter');
const conditionFilter = document.getElementById('condition-filter');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');

const totalItemsEl = document.getElementById('total-items-count');
const serviceableItemsEl = document.getElementById('serviceable-items-count');
const unserviceableItemsEl = document.getElementById('unserviceable-items-count');
const totalQtyEl = document.getElementById('total-qty-count');

let inventoryData = [];
let currentPage = 1;
const ROWS_PER_PAGE = 20;
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageIndicator = document.getElementById('page-indicator');

let activeEmpView = 'home';

// =========================================================================
// METRICS & TABLE RENDERERS
// =========================================================================
function calculateMetrics() {
    const totalArticles = inventoryData.length;
    const serviceableCount = inventoryData.filter(item => 
        (item.condition || '').toUpperCase() === 'SERVICEABLE'
    ).length;
    const unserviceableCount = inventoryData.filter(item => {
        const cond = (item.condition || '').toUpperCase();
        return cond === 'UNSERVICEABLE' || cond === 'FOR DISPOSAL';
    }).length;
    const totalQuantity = inventoryData.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);

    if (totalItemsEl) totalItemsEl.textContent = totalArticles.toLocaleString();
    if (serviceableItemsEl) serviceableItemsEl.textContent = serviceableCount.toLocaleString();
    if (unserviceableItemsEl) unserviceableItemsEl.textContent = unserviceableCount.toLocaleString();
    if (totalQtyEl) totalQtyEl.textContent = totalQuantity.toLocaleString();

    // Update homepage quick stats
    const homeTotal = document.getElementById('emp-home-stat-total');
    const homeServiceable = document.getElementById('emp-home-stat-serviceable');
    const homeUnserviceable = document.getElementById('emp-home-stat-unserviceable');
    const homeQty = document.getElementById('emp-home-stat-qty');

    if (homeTotal) homeTotal.textContent = totalArticles.toLocaleString();
    if (homeServiceable) homeServiceable.textContent = serviceableCount.toLocaleString();
    if (homeUnserviceable) homeUnserviceable.textContent = unserviceableCount.toLocaleString();
    if (homeQty) homeQty.textContent = totalQuantity.toLocaleString();
}

function updateAccountDropdown() {
    const accounts = ['All Accounts', ...new Set(inventoryData.map(item => item.account).filter(Boolean))];
    const currentSelection = accountFilter ? accountFilter.value : 'All Accounts';

    if (accountFilter) {
        accountFilter.innerHTML = '';
        accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc;
            option.textContent = acc;
            accountFilter.appendChild(option);
        });

        if (accounts.includes(currentSelection)) {
            accountFilter.value = currentSelection;
        }
    }
}

function setupConditionDropdown() {
    if (conditionFilter) {
        conditionFilter.innerHTML = `
            <option value="All Conditions">All Conditions</option>
            <option value="SERVICEABLE">SERVICEABLE</option>
            <option value="UNSERVICEABLE">UNSERVICEABLE</option>
        `;
    }
}

/**
 * Normalizes a person's name by removing honorifics, titles, punctuation, and extra whitespace.
 */
function cleanPersonName(nameStr) {
    if (!nameStr) return '';
    return String(nameStr)
        .toLowerCase()
        .replace(/\b(hon|engr|dr|atty|mr|ms|mrs|capt|prof)\b\.?/gi, '')
        .replace(/[^a-z0-9\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Checks if a property item's accountable officer matches the active employee name.
 * Strictly verifies full person identity (both First and Last name) to avoid false positives with shared surnames.
 */
function isMatchingAccountablePerson(itemAccountablePerson, employeeName) {
    if (!itemAccountablePerson || !employeeName) return false;
    
    const cleanItem = cleanPersonName(itemAccountablePerson);
    const cleanEmp = cleanPersonName(employeeName);

    if (!cleanItem || !cleanEmp) return false;

    // 1. Direct exact match after normalization
    if (cleanItem === cleanEmp) return true;

    // 2. Tokenized word comparison
    const empTokens = cleanEmp.split(' ').filter(t => t.length >= 2);
    const itemTokens = cleanItem.split(' ').filter(t => t.length >= 2);

    if (empTokens.length === 0 || itemTokens.length === 0) return false;

    // Filter significant tokens (exclude single letter middle initials)
    const significantEmpTokens = empTokens.filter(t => t.length > 2);

    if (significantEmpTokens.length >= 2) {
        // Full name provided: MUST match ALL significant name components (e.g. both "Jocelyn" AND "Catalla")
        return significantEmpTokens.every(empToken => 
            itemTokens.some(itemToken => itemToken === empToken || itemToken.startsWith(empToken) || empToken.startsWith(itemToken))
        );
    } else if (empTokens.length >= 1) {
        // Single word name provided (e.g. only "Catalla" or only "Jocelyn")
        return itemTokens.includes(empTokens[0]);
    }

    return false;
}

function renderTable() {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const selectedAccount = accountFilter ? accountFilter.value || 'All Accounts' : 'All Accounts';
    const selectedCondition = conditionFilter ? conditionFilter.value || 'All Conditions' : 'All Conditions';
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredData = inventoryData.filter(item => {
        const matchesAccount = selectedAccount === 'All Accounts' || item.account === selectedAccount;
        
        // Unified Case-Insensitive Condition Check
        const itemCond = (item.condition || '').toLowerCase();
        const filterCond = selectedCondition.toLowerCase();
        const matchesCondition = selectedCondition === 'All Conditions' || itemCond === filterCond;
        
        // Dedicated "My Assigned Items" Filter
        let matchesMyAssignments = true;
        if (isMyAssignmentsActive) {
            matchesMyAssignments = isMatchingAccountablePerson(item.accountablePerson, currentEmployeeName);
        }

        // Omni-Field Deep Search across ALL information and attributes (including Accountable Officer)
        let matchesSearch = true;
        if (searchText) {
            const searchTerms = searchText.split(/\s+/).filter(Boolean);
            
            const qtyVal = String(item.qty || '');
            const unitCostNum = parseFloat(item.unitCost) || 0;
            const totalCostNum = parseFloat(item.totalCost) || ((parseInt(item.qty, 10) || 0) * unitCostNum);
            const formattedUnitCost = unitCostNum ? unitCostNum.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '';
            const formattedTotalCost = totalCostNum ? totalCostNum.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '';

            // Format date variants
            let dateVariants = String(item.date || '');
            if (item.date) {
                try {
                    const d = new Date(item.date);
                    if (!isNaN(d.getTime())) {
                        dateVariants += ` ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ${d.getFullYear()}`;
                    }
                } catch(e) {}
            }

            const searchBlob = [
                item.article,
                item.description,
                item.propertyNo,
                item.location,
                item.accountablePerson,
                item.condition,
                item.account,
                item.remarks,
                item.unit,
                qtyVal,
                String(item.unitCost || ''),
                formattedUnitCost,
                `₱${formattedUnitCost}`,
                `₱${item.unitCost || ''}`,
                String(item.totalCost || ''),
                formattedTotalCost,
                `₱${formattedTotalCost}`,
                `₱${item.totalCost || ''}`,
                dateVariants,
                ...Object.values(item).filter(v => typeof v === 'string' || typeof v === 'number')
            ].map(v => String(v || '').toLowerCase()).join(' ');

            matchesSearch = searchTerms.every(term => searchBlob.includes(term));
        }

        return matchesAccount && matchesCondition && matchesMyAssignments && matchesSearch;
    });

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    if (pageIndicator) {
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    if (prevPageBtn) {
        prevPageBtn.disabled = (currentPage <= 1);
    }
    if (nextPageBtn) {
        nextPageBtn.disabled = (currentPage >= totalPages);
    }

    if (filteredData.length === 0) {
        const noDataMessage = isMyAssignmentsActive
            ? `No property records assigned to <strong>"${sanitizeText(currentEmployeeName || 'you')}"</strong> found in the masterlist.`
            : `No inventory records found matching your search.`;

        tableBody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #94a3b8; padding: 24px 16px; font-size: 13px;">${noDataMessage}</td></tr>`;
        calculateMetrics();
        return;
    }

    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    const pageData = filteredData.slice(startIndex, endIndex);

    const fragment = document.createDocumentFragment();

    pageData.forEach((item, index) => {
        let badgeClass = 'serviceable-badge';
        const condUpper = (item.condition || '').toUpperCase();
        if (condUpper === 'UNSERVICEABLE') badgeClass = 'unserviceable-badge';
        if (condUpper === 'FOR DISPOSAL') badgeClass = 'disposal-badge';

        const qtyVal = parseInt(item.qty, 10) || 0;
        const unitCostVal = parseFloat(item.unitCost) || 0;
        const computedTotalCost = parseFloat(item.totalCost) || (qtyVal * unitCostVal);

        const isUserAssigned = isMatchingAccountablePerson(item.accountablePerson, currentEmployeeName);

        const tr = document.createElement('tr');
        tr.style.animationDelay = `${Math.min(index * 0.02, 0.35)}s`;
        if (isMyAssignmentsActive || isUserAssigned) {
            tr.style.borderLeft = '3px solid #38bdf8';
        }
        tr.innerHTML = `
            <td class="text-muted">${sanitizeText(item.date) || '-'}</td>
            <td class="font-bold">${qtyVal}</td>
            <td>${sanitizeText(item.unit) || '-'}</td>
            <td>₱${unitCostVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td class="font-bold article-cell">${sanitizeText(item.article) || '-'}</td>
            <td class="description-cell">${sanitizeText(item.description) || '-'}</td>
            <td class="text-muted">${sanitizeText(item.propertyNo) || '-'}</td>
            <td class="font-bold">₱${computedTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td>${sanitizeText(item.location) || '-'}</td>
            <td class="font-bold" style="${isUserAssigned ? 'color: #38bdf8;' : ''}">${sanitizeText(item.accountablePerson) || '-'}</td>
            <td><span class="badge ${badgeClass}">${sanitizeText(item.condition) || 'N/A'}</span></td>
            <td>${sanitizeText(item.account) || '-'}</td>
            <td class="text-muted">${sanitizeText(item.remarks) || '-'}</td>
            <td class="actions-cell actions-cell-wrapper" style="text-align: center;">
                <button class="action-btn edit-btn" onclick="openTransferModal('${item.id}')" title="Request Equipment Transfer">
                    <i class="fas fa-exchange-alt"></i>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tableBody.appendChild(fragment);
    calculateMetrics();
}

// =========================================================================
// VIEW NAVIGATION (HOME vs DIRECTORY)
// =========================================================================
/**
 * Switches the active Employee view between Home and Directory (Masterlist).
 * @param {'home'|'directory'} viewName 
 */
window.switchEmpView = function(viewName) {
    activeEmpView = viewName;
    const homeView = document.getElementById('home-view');
    const directoryView = document.getElementById('directory-view');

    // Update active class on sidebar buttons
    const homeBtn = document.getElementById('sidebar-home-btn');
    const directoryBtn = document.getElementById('sidebar-directory-btn');
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    const darkModeDivider = document.getElementById('dark-mode-divider');

    if (homeBtn) homeBtn.classList.toggle('active', viewName === 'home');
    if (directoryBtn) directoryBtn.classList.toggle('active', viewName === 'directory');

    // Dark Mode toggle smoothly appears only when in the Masterlist interface
    const isMasterlist = (viewName === 'directory');
    if (darkModeBtn) {
        darkModeBtn.style.display = '';
        darkModeBtn.classList.toggle('theme-toggle-hidden', !isMasterlist);
    }
    if (darkModeDivider) {
        darkModeDivider.style.display = '';
        darkModeDivider.classList.toggle('theme-toggle-hidden', !isMasterlist);
    }

    // Toggle views
    if (homeView) homeView.classList.toggle('hidden', viewName !== 'home');
    if (directoryView) directoryView.classList.toggle('hidden', viewName !== 'directory');

    if (viewName === 'directory') {
        setTimeout(() => {
            renderTable();
        }, 30);
    } else {
        setTimeout(() => {
            calculateMetrics();
        }, 30);
    }
};

// =========================================================================
// SIDEBAR COLLAPSE, EXPAND & MOBILE DRAWER CONTROLS
// =========================================================================
const hamburgerBtn = document.getElementById('hamburger-menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarDrawer = document.getElementById('sidebar-drawer');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const darkModeToggle = document.getElementById('dark-mode-toggle');

// Initialize Sidebar state based on user preference
(function initSidebarState() {
    const isSavedExpanded = localStorage.getItem('gtrack_sidebar_expanded') === 'true';
    if (isSavedExpanded && window.innerWidth > 768 && sidebarDrawer) {
        sidebarDrawer.classList.add('expanded');
        document.body.classList.add('sidebar-expanded');
    }
})();

window.toggleSidebar = function() {
    if (window.innerWidth <= 768) {
        if (sidebarDrawer) {
            sidebarDrawer.classList.toggle('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('show', sidebarDrawer.classList.contains('open'));
            }
        }
    } else {
        if (sidebarDrawer) {
            sidebarDrawer.classList.toggle('expanded');
            const isExpanded = sidebarDrawer.classList.contains('expanded');
            document.body.classList.toggle('sidebar-expanded', isExpanded);
            localStorage.setItem('gtrack_sidebar_expanded', isExpanded ? 'true' : 'false');
        }
    }
};

window.openSidebarNavMenu = function() {
    if (window.innerWidth <= 768) {
        if (sidebarDrawer) sidebarDrawer.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('show');
    } else {
        if (sidebarDrawer && !sidebarDrawer.classList.contains('expanded')) {
            sidebarDrawer.classList.add('expanded');
            document.body.classList.add('sidebar-expanded');
            localStorage.setItem('gtrack_sidebar_expanded', 'true');
        }
    }
};

window.closeSidebarNavMenu = function() {
    if (window.innerWidth <= 768) {
        if (sidebarDrawer) sidebarDrawer.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    }
};

if (hamburgerBtn) hamburgerBtn.addEventListener('click', window.openSidebarNavMenu);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', window.closeSidebarNavMenu);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', window.closeSidebarNavMenu);

// Initialize Dark Theme Mode from persistent LocalStorage
(function initThemeMode() {
    const savedTheme = localStorage.getItem('gtrack_theme_mode');
    const isDark = savedTheme === 'dark';
    if (isDark) {
        document.body.classList.add('dark-theme-mode');
    }
    if (darkModeToggle) {
        darkModeToggle.innerHTML = isDark
            ? `<i class="fas fa-sun"></i> <span class="sidebar-text">Light Mode</span>` 
            : `<i class="fas fa-moon"></i> <span class="sidebar-text">Dark Mode</span>`;
        darkModeToggle.title = isDark ? "Light Mode" : "Dark Mode";
    }
})();

if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme-mode');
        const isActive = document.body.classList.contains('dark-theme-mode');
        localStorage.setItem('gtrack_theme_mode', isActive ? 'dark' : 'light');
        darkModeToggle.innerHTML = isActive 
            ? `<i class="fas fa-sun"></i> <span class="sidebar-text">Light Mode</span>` 
            : `<i class="fas fa-moon"></i> <span class="sidebar-text">Dark Mode</span>`;
        darkModeToggle.title = isActive ? "Light Mode" : "Dark Mode";
    });
}

// =========================================================================
// REQUEST MASTERLIST COPY WORKFLOW (FIREBASE & SUPABASE)
// =========================================================================
const sidebarRequestBtn = document.getElementById('sidebar-request-btn');
const historyLogContainer = document.getElementById('request-history-log');
const historyQuickBtn = document.getElementById('sidebar-history-quick-btn');
const historyWrapper = document.getElementById('request-history-wrapper');
const historyBadge = document.getElementById('emp-history-badge');

window.toggleHistoryStack = function(forceOpen) {
    if (window.innerWidth <= 768) {
        if (sidebarDrawer) sidebarDrawer.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('show');
    } else {
        if (sidebarDrawer && !sidebarDrawer.classList.contains('expanded')) {
            sidebarDrawer.classList.add('expanded');
            document.body.classList.add('sidebar-expanded');
            localStorage.setItem('gtrack_sidebar_expanded', 'true');
        }
    }

    if (historyWrapper) {
        if (forceOpen === true) {
            historyWrapper.classList.add('open');
        } else {
            historyWrapper.classList.toggle('open');
        }
    }
};

window.sendMasterlistRequest = async function() {
    const userEmail = currentEmployeeEmail || "employee@gso.com";
    const userName = currentEmployeeName || "Employee";
    const reqTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newId = requestsRef.push().key;

    const newRequest = {
        user: userEmail,
        userName: userName,
        time: reqTime,
        status: "Pending",
        requestedAt: new Date().toISOString()
    };

    try {
        await database.ref(`masterlistRequests/${newId}`).set(newRequest);
        if (supabaseClient) {
            await supabaseClient.from('masterlist_requests').insert([{
                id: newId,
                user_email: userEmail,
                user_name: userName,
                status: 'pending',
                requested_at: new Date().toISOString()
            }]);
        }
        window.toggleHistoryStack(true);
    } catch (err) {
        console.error("Error submitting masterlist request:", err);
    }
};

if (sidebarRequestBtn) {
    sidebarRequestBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.sendMasterlistRequest();
    });
}

function renderHistory() {
    if (!historyLogContainer) return;

    requestsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        historyLogContainer.innerHTML = ''; 
        
        const emptyStateHTML = `
            <div style="padding: 16px; border-radius: 8px; border: 1.5px dashed #334155; text-align: center; color: #94a3b8; font-size: 12px;">
                <i class="far fa-folder-open" style="font-size: 18px; margin-bottom: 6px; display: block; color: #475569;"></i>
                No recent requests found.
            </div>
        `;

        if (!data) {
            historyLogContainer.innerHTML = emptyStateHTML;
            if (historyBadge) historyBadge.style.display = 'none';
            return;
        }

        const userEmail = currentEmployeeEmail || "employee@gso.com";
        const currentRequests = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(req => req.user === userEmail || req.userName === currentEmployeeName)
            .reverse();

        if (historyBadge) {
            historyBadge.textContent = currentRequests.length;
            historyBadge.style.display = currentRequests.length > 0 ? 'inline-block' : 'none';
        }

        if (currentRequests.length === 0) {
            historyLogContainer.innerHTML = emptyStateHTML;
            return;
        }

        const fragment = document.createDocumentFragment();

        currentRequests.forEach(req => {
            const block = document.createElement('div');
            block.style.backgroundColor = '#1e293b';
            block.style.border = '1.5px solid #334155';
            block.style.borderRadius = '8px';
            block.style.padding = '12px 14px';
            block.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            block.style.display = 'flex';
            block.style.flexDirection = 'column';
            block.style.gap = '8px';
            
            let statusContainer = '';

            if ((req.status || '').toUpperCase() === "PENDING") {
                statusContainer = `
                    <div style="display: flex; flex-direction: column; gap: 4px; background-color: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2); padding: 8px 10px; border-radius: 6px; width: 100%; box-sizing: border-box;">
                        <span style="color: #fef08a; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-clock"></i> Pending Approval
                        </span>
                        <span style="font-size: 10.5px; color: #cbd5e1; line-height: 1.3;">
                            Waiting for administrator authorization.
                        </span>
                    </div>
                `;
            } else if ((req.status || '').toUpperCase() === "COMPLETED") {
                statusContainer = `
                   <div style="display: flex; flex-direction: column; gap: 6px; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); padding: 8px 10px; border-radius: 6px; width: 100%; box-sizing: border-box;">
                        <span style="color: #bbf7d0; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-check-circle"></i> Ready for Download
                        </span>
                        <button class="dl-action-btn" data-id="${req.id}" style="width: 100%; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; border: none; padding: 6px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: opacity 0.2s;">
                            <i class="fas fa-cloud-download-alt"></i> Download CSV
                        </button>
                    </div>
                `;
            }

            block.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; font-size: 11px; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">
                        <i class="far fa-user" style="color: #94a3b8; margin-right: 4px;"></i> ${sanitizeText(req.userName || req.user)}
                    </span>
                    <span style="font-size: 10px; color: #94a3b8;">${sanitizeText(req.time)}</span>
                </div>
                <div style="display: flex; width: 100%;">
                    ${statusContainer}
                </div>
            `;

            fragment.appendChild(block);

            if ((req.status || '').toUpperCase() === "COMPLETED") {
                const triggerBtn = block.querySelector('.dl-action-btn');
                if (triggerBtn) {
                    triggerBtn.addEventListener('click', (e) => {
                        e.preventDefault();   
                        e.stopPropagation();

                        const csvContent = req.csvDataString || buildCSVString();
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const downloadLink = document.createElement("a");
                        downloadLink.setAttribute("href", url);
                        downloadLink.setAttribute("download", `GSO_Masterlist_Received_${req.id.slice(-4)}.csv`);
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                    });
                }
            }
        });

        historyLogContainer.appendChild(fragment);
    });
}

// Clear History Button handler (Direct spin-to-clear without alert popup)
const clearHistoryBtn = document.getElementById('clear-history-btn');
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const icon = clearHistoryBtn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        clearHistoryBtn.style.pointerEvents = 'none';

        try {
            const userEmail = currentEmployeeEmail || "employee@gso.com";
            const snapshot = await requestsRef.once('value');
            const data = snapshot.val();

            if (data) {
                const deletePromises = [];
                Object.keys(data).forEach((key) => {
                    if (data[key].user === userEmail || data[key].userName === currentEmployeeName) {
                        deletePromises.push(database.ref(`masterlistRequests/${key}`).remove());
                    }
                });

                if (supabaseClient) {
                    deletePromises.push(
                        supabaseClient
                            .from('masterlist_requests')
                            .delete()
                            .or(`user_email.eq.${userEmail},user_name.eq.${currentEmployeeName}`)
                    );
                }

                await Promise.all(deletePromises);
            }
        } catch (err) {
            console.error("Error clearing request history:", err);
        } finally {
            setTimeout(() => {
                if (icon) icon.classList.remove('fa-spin');
                clearHistoryBtn.style.pointerEvents = 'auto';
            }, 450);
        }
    });
}

// =========================================================================
// USER PROFILE MODAL & GOOGLE-ACCOUNT-STYLE PASSWORD / PROFILE MANAGEMENT
// =========================================================================

function showProfileAlert(type, message) {
    const successAlert = document.getElementById('profile-success-alert');
    const successText = document.getElementById('profile-success-text');
    const errorAlert = document.getElementById('profile-error-alert');
    const errorText = document.getElementById('profile-error-text');
    const legacyMsg = document.getElementById('profile-feedback-msg');

    if (type === 'success') {
        if (errorAlert) errorAlert.style.display = 'none';
        if (successAlert) {
            if (successText) successText.textContent = message;
            successAlert.style.display = 'flex';
        } else if (legacyMsg) {
            legacyMsg.textContent = message;
            legacyMsg.className = 'success-popup';
            legacyMsg.style.display = 'block';
        }
    } else {
        if (successAlert) successAlert.style.display = 'none';
        if (errorAlert) {
            if (errorText) errorText.textContent = message;
            errorAlert.style.display = 'flex';
        } else if (legacyMsg) {
            legacyMsg.textContent = message;
            legacyMsg.className = 'error-popup';
            legacyMsg.style.display = 'block';
        }
    }
}

function clearProfileAlerts() {
    const successAlert = document.getElementById('profile-success-alert');
    const errorAlert = document.getElementById('profile-error-alert');
    const legacyMsg = document.getElementById('profile-feedback-msg');
    if (successAlert) successAlert.style.display = 'none';
    if (errorAlert) errorAlert.style.display = 'none';
    if (legacyMsg) {
        legacyMsg.style.display = 'none';
        legacyMsg.textContent = '';
    }
}

window.openEmpProfileModal = function() {
    const modal = document.getElementById('emp-profile-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Force reflow so transition plays smoothly
        void modal.offsetWidth;
        modal.classList.add('open');
    }

    clearProfileAlerts();

    // Populate current values
    const nameInput = document.getElementById('profile-name-input') || document.getElementById('profile-fullname');
    const emailInput = document.getElementById('profile-email-input') || document.getElementById('profile-email-display');
    const oldPass = document.getElementById('profile-old-password');
    const newPass = document.getElementById('profile-new-password');
    const confPass = document.getElementById('profile-confirm-password');

    if (nameInput) nameInput.value = currentEmployeeName;
    if (emailInput) {
        if (emailInput.tagName === 'INPUT') emailInput.value = currentEmployeeEmail;
        else emailInput.textContent = currentEmployeeEmail;
    }
    if (window.selectCustomDept) {
        window.selectCustomDept('profile-dept-select', 'profileDeptText', 'profileDeptTrigger', 'profileDeptSelectWrapper', currentEmployeeDept || '', currentEmployeeDept ? `${currentEmployeeDept}` : 'Select Municipal Department');
    }
    if (oldPass) oldPass.value = '';
    if (newPass) newPass.value = '';
    if (confPass) confPass.value = '';
};

window.closeEmpProfileModal = function() {
    const modal = document.getElementById('emp-profile-modal');
    if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
            if (!modal.classList.contains('open')) {
                modal.classList.add('hidden');
            }
        }, 350);
    }
    clearProfileAlerts();
    const oldPass = document.getElementById('profile-old-password');
    const newPass = document.getElementById('profile-new-password');
    const confPass = document.getElementById('profile-confirm-password');
    if (oldPass) oldPass.value = '';
    if (newPass) newPass.value = '';
    if (confPass) confPass.value = '';
};

const profileForm = document.getElementById('emp-profile-form');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearProfileAlerts();

        const nameInput = document.getElementById('profile-name-input') || document.getElementById('profile-fullname');
        const deptSelect = document.getElementById('profile-dept-select');
        const oldPassInput = document.getElementById('profile-old-password');
        const newPassInput = document.getElementById('profile-new-password');
        const confPassInput = document.getElementById('profile-confirm-password');
        const saveBtn = document.getElementById('save-profile-btn');

        const newName = nameInput ? nameInput.value.trim() : '';
        const newDept = deptSelect ? deptSelect.value.trim() : '';
        const currentPassword = oldPassInput ? oldPassInput.value : '';
        const newPassword = newPassInput ? newPassInput.value : '';
        const confirmPassword = confPassInput ? confPassInput.value : '';

        // Validation 1: Legal Name is mandatory
        if (!newName) {
            showProfileAlert('error', "Full legal name cannot be left empty.");
            if (nameInput) nameInput.focus();
            return;
        }

        const isPasswordChangeAttempt = Boolean(currentPassword || newPassword || confirmPassword);

        // Validation 2: Google-style password validation rules
        if (isPasswordChangeAttempt) {
            if (!currentPassword) {
                showProfileAlert('error', "Please enter your current password to authorize changing your credentials.");
                if (oldPassInput) oldPassInput.focus();
                return;
            }

            if (!newPassword) {
                showProfileAlert('error', "Please enter your new password.");
                if (newPassInput) newPassInput.focus();
                return;
            }

            if (newPassword.length < 6) {
                showProfileAlert('error', "Password must be at least 6 characters long.");
                if (newPassInput) newPassInput.focus();
                return;
            }

            if (newPassword === currentPassword) {
                showProfileAlert('error', "Choose a password you haven't used before. New password cannot be the same as your current password.");
                if (newPassInput) newPassInput.focus();
                return;
            }

            if (newPassword !== confirmPassword) {
                showProfileAlert('error', "New passwords do not match. Please verify and confirm your new password.");
                if (confPassInput) confPassInput.focus();
                return;
            }
        }

        // Set Loading Button State
        const originalBtnHTML = saveBtn ? saveBtn.innerHTML : '<i class="fas fa-save"></i> Save Changes';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        }

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No authenticated session found. Please sign in again.");

            let passwordUpdated = false;
            let nameUpdated = false;
            let deptUpdated = false;

            // 1. If password change is requested, Re-authenticate with Firebase Auth (Google-style authorization)
            if (isPasswordChangeAttempt) {
                if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying password...';
                
                try {
                    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
                    await user.reauthenticateWithCredential(credential);
                } catch (reauthErr) {
                    if (reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential' || reauthErr.code === 'auth/user-mismatch') {
                        throw new Error("Incorrect current password. Please check your credentials and try again.");
                    } else if (reauthErr.code === 'auth/too-many-requests') {
                        throw new Error("Access temporarily locked due to many failed attempts. Please try again later.");
                    } else {
                        throw new Error(reauthErr.message || "Failed to verify current password.");
                    }
                }

                // Update password on Firebase Auth
                if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating password...';
                await user.updatePassword(newPassword);
                passwordUpdated = true;
            }

            // 2. If name changed, update Firestore Profile record
            const updatePayload = {};
            if (newName && newName !== currentEmployeeName) {
                updatePayload.fullName = newName;
                nameUpdated = true;
            }

            if (Object.keys(updatePayload).length > 0) {
                if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating profile...';
                await db.collection("users").doc(user.uid).update(updatePayload);
                if (nameUpdated) currentEmployeeName = newName;

                // Live-update displays
                const nameEl = document.getElementById('emp-profile-name');
                const heroNameEl = document.getElementById('emp-hero-name');
                const navbarEmailEl = document.querySelector('.navbar .user-email');

                if (nameEl) nameEl.textContent = currentEmployeeName;
                if (heroNameEl) heroNameEl.textContent = currentEmployeeName;
                if (navbarEmailEl) navbarEmailEl.textContent = `${currentEmployeeName} (${currentEmployeeDept || 'GSO'})`;
            }

            // 3. If department change is requested, queue a Department Transfer Request for Admin Approval
            let deptTransferRequested = false;
            if (newDept && newDept !== (currentEmployeeDept || '')) {
                if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting transfer request...';
                
                const transferReqRef = database.ref('deptTransferRequests').push();
                await transferReqRef.set({
                    id: transferReqRef.key,
                    userId: user.uid,
                    userName: currentEmployeeName || user.email,
                    userEmail: currentEmployeeEmail || user.email,
                    originDepartment: currentEmployeeDept || 'Not Assigned',
                    targetDepartment: newDept,
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                });
                deptTransferRequested = true;
            }

            // Success feedback
            if (oldPassInput) oldPassInput.value = '';
            if (newPassInput) newPassInput.value = '';
            if (confPassInput) confPassInput.value = '';

            let successMessage = "Profile updated successfully!";
            if (deptTransferRequested && nameUpdated && passwordUpdated) {
                successMessage = `Name and password updated, and your Department Transfer Request to ${newDept} has been sent for Admin approval!`;
            } else if (deptTransferRequested && nameUpdated) {
                successMessage = `Name updated, and your Department Transfer Request to ${newDept} has been sent for Admin approval!`;
            } else if (deptTransferRequested) {
                successMessage = `Your Department Transfer Request to ${newDept} has been submitted for Admin approval!`;
            } else if (passwordUpdated && nameUpdated) {
                successMessage = "Your profile name and password have been securely updated!";
            } else if (passwordUpdated) {
                successMessage = "Your password has been changed successfully!";
            } else if (nameUpdated) {
                successMessage = "Your full name has been updated successfully!";
            }

            showProfileAlert('success', successMessage);

            setTimeout(() => {
                window.closeEmpProfileModal();
            }, 1800);

        } catch (error) {
            console.error("Profile change error:", error);
            let displayError = error.message || "An unexpected error occurred.";
            if (error.code === 'auth/weak-password') {
                displayError = "The new password is too weak. Please use at least 6 characters with a combination of letters and numbers.";
            } else if (error.code === 'auth/requires-recent-login') {
                displayError = "Security timeout: Please sign out and sign in again before changing your password.";
            }
            showProfileAlert('error', displayError);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnHTML;
            }
        }
    });
}

// =========================================================================
// SIGN OUT POPOVER CONTROLS
// =========================================================================
window.toggleSignOutPopover = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const popover = document.getElementById('signout-popover');
    if (popover) {
        popover.classList.toggle('hidden');
    }
};

window.closeSignOutPopover = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const popover = document.getElementById('signout-popover');
    if (popover) {
        popover.classList.add('hidden');
    }
};

window.executeSignOut = function() {
    auth.signOut().then(() => {
        sessionStorage.clear();
        window.location.replace("../login/index.html");
    }).catch(err => {
        console.error("Sign out error:", err);
        window.location.replace("../login/index.html");
    });
};

document.addEventListener('click', (event) => {
    const popover = document.getElementById('signout-popover');
    const btn = document.getElementById('sidebar-signout-btn');
    if (popover && btn && !popover.contains(event.target) && !btn.contains(event.target)) {
        popover.classList.add('hidden');
    }
});

// =========================================================================
// SUPABASE / FIREBASE REALTIME INVENTORY DATA SYNC
// =========================================================================
async function fetchInventoryFromSupabase() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn("Supabase fetch notice (falling back to Firebase):", error.message);
            return;
        }

        if (data && data.length > 0) {
            inventoryData = data.map(mapSupabaseToInventoryItem);
            updateAccountDropdown();
            renderTable();
        }
    } catch (e) {
        console.warn("Supabase fetch exception (using Firebase):", e);
    }
}

// 1. Instant Data Load from Firebase Realtime DB (Guarantees data is never empty)
inventoryRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const fbItems = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        if (fbItems.length > 0) {
            if (inventoryData.length === 0 || !supabaseClient) {
                inventoryData = fbItems;
                updateAccountDropdown();
                renderTable();
            }
        }
    }
});

// 2. Initialize Supabase Realtime Sync
if (supabaseClient) {
    fetchInventoryFromSupabase();

    supabaseClient
        .channel('public:inventory_emp')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
            fetchInventoryFromSupabase();
        })
        .subscribe();
}

// Helper: Open Request History stack directly
window.openRequestHistory = function() {
    window.toggleHistoryStack(true);
};

// Helper: Toggle My Assigned Items filter
let isMyAssignmentsActive = false;
window.toggleMyAssignmentsFilter = function() {
    isMyAssignmentsActive = !isMyAssignmentsActive;
    const btn = document.getElementById('my-assignments-btn');
    const textEl = document.getElementById('my-assignments-text');

    if (btn) {
        if (isMyAssignmentsActive) {
            btn.style.background = '#38bdf8';
            btn.style.color = '#0b0f19';
            btn.style.borderColor = '#38bdf8';
            btn.style.boxShadow = '0 0 14px rgba(56, 189, 248, 0.4)';
            btn.style.fontWeight = '700';
        } else {
            btn.style.background = 'rgba(56, 189, 248, 0.12)';
            btn.style.color = '#38bdf8';
            btn.style.borderColor = 'rgba(56, 189, 248, 0.3)';
            btn.style.boxShadow = 'none';
            btn.style.fontWeight = '600';
        }
    }
    if (textEl) {
        textEl.textContent = isMyAssignmentsActive ? 'Showing My Items' : 'My Assigned Items';
    }

    currentPage = 1;
    renderTable();
};

// Helper: Save profile changes from modal form
window.saveEmpProfileChanges = function(event) {
    if (event) event.preventDefault();
    const form = document.getElementById('emp-profile-form');
    if (form) {
        const submitEvent = new Event('submit', { cancelable: true });
        form.dispatchEvent(submitEvent);
    }
};

function updateClearSearchVisibility() {
    if (clearSearchBtn && searchInput) {
        clearSearchBtn.style.display = searchInput.value.length > 0 ? 'inline-flex' : 'none';
    }
}

// Table Filter & Pagination Listeners
if (accountFilter) accountFilter.addEventListener('change', () => { currentPage = 1; renderTable(); });
if (conditionFilter) conditionFilter.addEventListener('change', () => { currentPage = 1; renderTable(); });
if (searchInput) {
    searchInput.addEventListener('input', () => {
        currentPage = 1;
        updateClearSearchVisibility();
        renderTable();
    });
}

if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        updateClearSearchVisibility();
        currentPage = 1;
        renderTable();
    });
}

if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });
}

if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
        currentPage++;
        renderTable();
    });
}

setupConditionDropdown();
renderHistory();

// =========================================================================
// CUSTOM SEARCHABLE DEPARTMENT DROPDOWN HELPERS
// =========================================================================
window.toggleCustomDropdown = function(event, wrapperId, searchInputId) {
    if (event) event.stopPropagation();
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const wasOpen = wrapper.classList.contains('open');

    // Close any other open custom dropdowns
    document.querySelectorAll('.custom-select-wrapper.open').forEach(el => {
        if (el !== wrapper) {
            el.classList.remove('open');
            el.classList.remove('drop-up');
        }
    });

    if (wasOpen) {
        wrapper.classList.remove('open');
        wrapper.classList.remove('drop-up');
    } else {
        // Calculate viewport space: if bottom space is tight, flip upwards!
        const trigger = wrapper.querySelector('.custom-select-trigger') || wrapper;
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const estimatedMenuHeight = 260;

        if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
            wrapper.classList.add('drop-up');
        } else {
            wrapper.classList.remove('drop-up');
        }

        wrapper.classList.add('open');
        
        // Reset search input and show all 28 options
        if (searchInputId) {
            const searchInput = document.getElementById(searchInputId);
            if (searchInput) {
                searchInput.value = '';
                setTimeout(() => searchInput.focus(), 60);
            }
        }

        const optionsList = wrapper.querySelector('.dept-options-list');
        if (optionsList) {
            optionsList.querySelectorAll('.custom-option').forEach(opt => {
                opt.style.display = 'flex';
            });
            optionsList.scrollTop = 0;
        }
    }
};

window.filterCustomDropdownOptions = function(query, listId) {
    const list = document.getElementById(listId);
    if (!list) return;

    const q = (query || '').toLowerCase().trim();
    const options = list.querySelectorAll('.custom-option');
    options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        opt.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
    });
};

window.selectCustomDept = function(hiddenInputId, textSpanId, triggerId, wrapperId, value, label) {
    const hiddenInput = document.getElementById(hiddenInputId);
    const textSpan = document.getElementById(textSpanId);
    const trigger = document.getElementById(triggerId);
    const wrapper = document.getElementById(wrapperId);

    if (hiddenInput) {
        hiddenInput.value = value;
        hiddenInput.dispatchEvent(new Event('change'));
    }

    if (textSpan) {
        textSpan.textContent = label || value || 'Select Municipal Department';
    }

    if (trigger) {
        if (value) trigger.classList.add('selected');
        else trigger.classList.remove('selected');
    }

    if (wrapper) {
        wrapper.classList.remove('open');
        wrapper.classList.remove('drop-up');
        
        // Clear search input and restore all options visibility for next open
        const searchInput = wrapper.querySelector('.dept-search-wrapper input');
        if (searchInput) searchInput.value = '';

        const optionsList = wrapper.querySelector('.dept-options-list');
        if (optionsList) {
            optionsList.querySelectorAll('.custom-option').forEach(opt => {
                opt.style.display = 'flex';
                if (opt.getAttribute('data-value') === value) {
                    opt.classList.add('selected');
                } else {
                    opt.classList.remove('selected');
                }
            });
        }
    }
};

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-select-wrapper.open').forEach(el => {
            el.classList.remove('open');
        });
    }
});

// =========================================================================
// EQUIPMENT TRANSFER REQUEST (PTR WORKFLOW - RIGHT-SLIDING DRAWER)
// =========================================================================
window.openTransferModal = function(itemId) {
    const item = inventoryData.find(i => String(i.id) === String(itemId));
    if (!item) {
        alert("Selected equipment record could not be found.");
        return;
    }

    const modal = document.getElementById('emp-transfer-modal');
    const itemIdInput = document.getElementById('transfer-item-id');
    const itemNameEl = document.getElementById('transfer-item-name');
    const itemDescEl = document.getElementById('transfer-item-desc');
    const itemPropNoEl = document.getElementById('transfer-item-propno');
    const itemCurLocEl = document.getElementById('transfer-item-curloc');
    const itemCustodianEl = document.getElementById('transfer-item-custodian');
    const conditionBadgeEl = document.getElementById('transfer-item-condition-badge');
    const newCustodianInput = document.getElementById('transfer-new-custodian');
    const reasonInput = document.getElementById('transfer-reason');
    const alertBox = document.getElementById('transfer-alert');

    if (itemIdInput) itemIdInput.value = item.id;
    if (itemNameEl) itemNameEl.textContent = item.article || 'Equipment Article';
    if (itemDescEl) itemDescEl.textContent = item.description || 'No additional description provided.';
    if (itemPropNoEl) itemPropNoEl.textContent = item.propertyNo || 'N/A';
    if (itemCurLocEl) itemCurLocEl.textContent = item.location || currentEmployeeDept || 'GSO';
    if (itemCustodianEl) itemCustodianEl.textContent = item.accountablePerson || currentEmployeeName || 'Not Assigned';
    
    if (conditionBadgeEl) {
        const cond = (item.condition || 'Serviceable').toUpperCase();
        conditionBadgeEl.textContent = item.condition || 'Serviceable';
        conditionBadgeEl.className = 'badge';
        if (cond === 'UNSERVICEABLE') {
            conditionBadgeEl.classList.add('unserviceable-badge');
        } else if (cond === 'FOR DISPOSAL') {
            conditionBadgeEl.classList.add('disposal-badge');
        } else {
            conditionBadgeEl.classList.add('serviceable-badge');
        }
    }

    // Reset custom select
    window.selectCustomDept('transfer-target-dept', 'transferDeptText', 'transferDeptTrigger', 'transferDeptSelectWrapper', '', 'Select Destination Department');
    
    if (newCustodianInput) newCustodianInput.value = '';
    if (reasonInput) reasonInput.value = '';
    if (alertBox) alertBox.style.display = 'none';

    if (modal) {
        modal.classList.remove('hidden');
        // Force reflow for smooth right-slide transition
        void modal.offsetWidth;
        modal.classList.add('open');
        document.body.classList.add('modal-open');
    }
};

window.closeTransferModal = function() {
    const modal = document.getElementById('emp-transfer-modal');
    if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
            if (!modal.classList.contains('open')) {
                modal.classList.add('hidden');
            }
        }, 350);
        document.body.classList.remove('modal-open');
    }
};

window.submitEquipmentTransfer = async function(event) {
    event.preventDefault();
    const itemId = document.getElementById('transfer-item-id')?.value;
    const targetDept = document.getElementById('transfer-target-dept')?.value;
    const newCustodian = document.getElementById('transfer-new-custodian')?.value?.trim();
    const reason = document.getElementById('transfer-reason')?.value?.trim();
    const alertBox = document.getElementById('transfer-alert');
    const submitBtn = document.getElementById('submit-transfer-btn');

    const item = inventoryData.find(i => String(i.id) === String(itemId));
    if (!item) {
        alert("Invalid item selected.");
        return;
    }

    if (!targetDept || !newCustodian || !reason) {
        if (alertBox) {
            alertBox.style.display = 'flex';
            alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
            alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            alertBox.style.color = '#f87171';
            alertBox.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Please fill in all required transfer fields.';
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    const transferId = database.ref('equipmentTransfers').push().key;
    const transferPayload = {
        id: transferId,
        itemId: item.id,
        article: item.article || '',
        description: item.description || '',
        propertyNo: item.propertyNo || '',
        originLocation: item.location || currentEmployeeDept || 'GSO',
        targetDepartment: targetDept,
        previousCustodian: item.accountablePerson || '',
        newCustodian: newCustodian,
        reason: reason,
        requestedByEmail: currentEmployeeEmail || 'employee@gso.com',
        requestedByName: currentEmployeeName || 'Employee',
        requesterDepartment: currentEmployeeDept || '',
        status: 'Pending',
        createdAt: new Date().toISOString()
    };

    try {
        await database.ref(`equipmentTransfers/${transferId}`).set(transferPayload);
        
        if (supabaseClient) {
            try {
                await supabaseClient.from('equipment_transfers').insert([transferPayload]);
            } catch(e) {
                console.warn("Supabase equipment_transfers mirror skipped:", e);
            }
        }

        if (alertBox) {
            alertBox.style.display = 'flex';
            alertBox.style.background = 'rgba(34, 197, 94, 0.15)';
            alertBox.style.border = '1px solid rgba(34, 197, 94, 0.3)';
            alertBox.style.color = '#4ade80';
            alertBox.innerHTML = '<i class="fas fa-check-circle"></i> Transfer request submitted successfully! Awaiting Admin approval.';
        }

        setTimeout(() => {
            window.closeTransferModal();
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Transfer Request';
            }
        }, 1500);

    } catch (err) {
        console.error("Failed to submit transfer request:", err);
        if (alertBox) {
            alertBox.style.display = 'flex';
            alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
            alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            alertBox.style.color = '#f87171';
            alertBox.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${err.message || 'Could not submit request.'}`;
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Transfer Request';
        }
    }
};