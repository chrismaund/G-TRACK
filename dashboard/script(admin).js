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

// =========================================================================
// AUTHENTICATION GUARD & SESSION PROTECTION (ADMIN)
// =========================================================================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        // No active Firebase session -> Redirect to login portal
        sessionStorage.clear();
        window.location.replace("../login/index.html");
        return;
    }

    try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            console.warn("Unauthorized access detected. Non-admin account trying to access Admin dashboard.");
            await auth.signOut();
            sessionStorage.clear();
            window.location.replace("../login/index.html");
        }
    } catch (err) {
        console.error("Auth verification error:", err);
    }
});

// =========================================================================
// SUPABASE CONFIGURATION & DATA MAPPERS
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

function mapInventoryItemToSupabase(item) {
    return {
        date: item.date || '',
        qty: parseInt(item.qty, 10) || 0,
        unit: item.unit || '',
        unit_cost: parseFloat(item.unitCost) || 0,
        total_cost: parseFloat(item.totalCost) || (parseInt(item.qty, 10) || 0) * (parseFloat(item.unitCost) || 0),
        article: item.article || '',
        description: item.description || '',
        property_no: item.propertyNo || '',
        location: item.location || '',
        accountable_person: item.accountablePerson || '',
        condition: item.condition || 'Serviceable',
        account: item.account || '',
        remarks: item.remarks || ''
    };
}

function mapSupabaseToRequest(row) {
    let displayName = row.user_email || row.user_name || 'employee@gso.com';
    if (row.user_email && row.user_name && row.user_name !== row.user_email) {
        displayName = `${row.user_name} (${row.user_email})`;
    }
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
        user: displayName,
        time: reqTime,
        status: (row.status || 'pending'),
        fulfilledTime: row.fulfilled_time || '',
        csvDataString: row.csv_data || ''
    };
}

// =========================================================================
// DOM SELECTORS & STATE MANAGEMENT
// =========================================================================
const addBtn = document.getElementById('add-article-btn');
const modal = document.getElementById('add-modal');
const modalTitle = modal ? modal.querySelector('h3') : null;
const cancelBtn = document.getElementById('cancel-add-btn');
const closeAddModalBtn = document.getElementById('close-add-modal');

// Delete Modal Selectors & Batch Delete Mode Selectors
const deleteModeBtn = document.getElementById('delete-mode-btn');
const cancelDeleteModeBtn = document.getElementById('cancel-delete-mode-btn');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const thCheckbox = document.getElementById('th-checkbox');
let isDeleteSelectionMode = false;
const selectedItemIds = new Set();

const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
let itemToDeleteId = null;

// Form & Table Bodies
const addForm = document.getElementById('add-item-form');
const tableBody = document.getElementById('inventory-body');

// Filters & Controls
const accountFilter = document.getElementById('account-filter');
const conditionFilter = document.getElementById('condition-filter');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');

// Dashboard Counters
const totalItemsEl = document.getElementById('total-items-count');
const serviceableItemsEl = document.getElementById('serviceable-items-count');
const unserviceableItemsEl = document.getElementById('unserviceable-items-count');
const totalQtyEl = document.getElementById('total-qty-count');
const totalValueEl = document.getElementById('total-value-count');

// Application State
let inventoryData = [];
let isEditMode = false;
let currentEditingId = null;
let currentPage = 1;
const ROWS_PER_PAGE = 20;
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageIndicator = document.getElementById('page-indicator');

// =========================================================================
// UTILITY FUNCTIONS (SANITIZATION & CSV GENERATION)
// =========================================================================

/**
 * Escapes HTML characters to prevent XSS attacks in injected template strings.
 * @param {string|number} str 
 * @returns {string} Safe text string
 */
function sanitizeText(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Generates a structured CSV payload from current inventory state.
 * @returns {string} Compiled CSV content
 */
function buildCSVString(customData = null) {
    const dataToExport = customData || inventoryData;
    const headers = ["Date", "Quantity", "Unit", "Unit Cost", "Article", "Description", "Property No", "Total Cost", "Location", "Accountable Person", "Condition", "Account Group", "Remarks"];
    const rows = dataToExport.map(item => [
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
    ]);

    return [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
}

// =========================================================================
// METRICS & TABLE RENDERERS
// =========================================================================
function calculateMetrics() {
    const totalArticles = inventoryData.length;
    const serviceableCount = inventoryData.filter(item => (item.condition || '').toUpperCase() === 'SERVICEABLE').length;
    const unserviceableCount = inventoryData.filter(item => {
        const cond = (item.condition || '').toUpperCase();
        return cond === 'UNSERVICEABLE' || cond === 'FOR DISPOSAL';
    }).length;
    
    const totalQuantity = inventoryData.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const totalValue = inventoryData.reduce((sum, item) => {
        const itemTotal = parseFloat(item.totalCost) || ((parseInt(item.qty, 10) || 0) * (parseFloat(item.unitCost) || 0));
        return sum + itemTotal;
    }, 0);

    if (totalItemsEl) totalItemsEl.textContent = totalArticles.toLocaleString();
    if (serviceableItemsEl) serviceableItemsEl.textContent = serviceableCount.toLocaleString();
    if (unserviceableItemsEl) unserviceableItemsEl.textContent = unserviceableCount.toLocaleString();
    if (totalQtyEl) totalQtyEl.textContent = totalQuantity.toLocaleString();
    if (totalValueEl) totalValueEl.textContent = `₱${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    renderHomeDashboard();
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
            <option value="Serviceable">Serviceable</option>
            <option value="Unserviceable">Unserviceable</option>
            <option value="For Disposal">For Disposal</option>
        `;
    }
}

// Ensure renderTable uses unified lower-case comparison and omni-field search
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
        
        // Omni-Field Deep Search across ALL information and attributes
        let matchesSearch = true;
        if (searchText) {
            const searchTerms = searchText.split(/\s+/).filter(Boolean);
            
            const qtyVal = String(item.qty || '');
            const unitCostNum = parseFloat(item.unitCost) || 0;
            const totalCostNum = parseFloat(item.totalCost) || ((parseInt(item.qty, 10) || 0) * unitCostNum);
            const formattedUnitCost = unitCostNum ? unitCostNum.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '';
            const formattedTotalCost = totalCostNum ? totalCostNum.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '';

            // Format date variants (month names, years, ISO)
            let dateVariants = String(item.date || '');
            if (item.date) {
                try {
                    const d = new Date(item.date);
                    if (!isNaN(d.getTime())) {
                        dateVariants += ` ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ${d.getFullYear()}`;
                    }
                } catch(e) {}
            }

            // Build comprehensive search text encompassing every single property
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

        return matchesAccount && matchesCondition && matchesSearch;
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
        tableBody.innerHTML = `<tr><td colspan="${isDeleteSelectionMode ? 15 : 14}" style="text-align: center; color: #94a3b8; padding: 20px;">No inventory records found.</td></tr>`;
        if (pageIndicator) pageIndicator.textContent = 'Page 1 of 1';
        if (prevPageBtn) prevPageBtn.disabled = true;
        if (nextPageBtn) nextPageBtn.disabled = true;
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
        const isChecked = selectedItemIds.has(item.id);

        const tr = document.createElement('tr');
        tr.style.animationDelay = `${Math.min(index * 0.02, 0.35)}s`;
        tr.innerHTML = `
            <td class="td-checkbox" style="display: ${isDeleteSelectionMode ? 'table-cell' : 'none'}; text-align: center; padding: 8px 6px;">
                <input type="checkbox" class="row-delete-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #ef4444;">
            </td>
            <td class="text-muted" title="${sanitizeText(item.date)}">${sanitizeText(item.date) || '-'}</td>
            <td class="font-bold" title="${qtyVal}">${qtyVal}</td>
            <td title="${sanitizeText(item.unit)}">${sanitizeText(item.unit) || '-'}</td>
            <td title="₱${unitCostVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}">₱${unitCostVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td class="font-bold article-cell" title="${sanitizeText(item.article)}">${sanitizeText(item.article) || '-'}</td>
            <td class="description-cell" title="${sanitizeText(item.description)}">${sanitizeText(item.description) || '-'}</td>
            <td class="text-muted" title="${sanitizeText(item.propertyNo)}">${sanitizeText(item.propertyNo) || '-'}</td>
            <td class="font-bold" title="₱${computedTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}">₱${computedTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td title="${sanitizeText(item.location)}">${sanitizeText(item.location) || '-'}</td>
            <td title="${sanitizeText(item.accountablePerson)}">${sanitizeText(item.accountablePerson) || '-'}</td>
            <td><span class="badge ${badgeClass}" title="${sanitizeText(item.condition)}">${sanitizeText(item.condition) || 'N/A'}</span></td>
            <td title="${sanitizeText(item.account)}">${sanitizeText(item.account) || '-'}</td>
            <td class="text-muted remarks-cell" title="${sanitizeText(item.remarks)}">${sanitizeText(item.remarks) || '-'}</td>
            <td class="actions-cell actions-cell-wrapper">
                <button class="action-btn edit-btn" onclick="openEditModal('${item.id}')" title="Edit Item">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tableBody.appendChild(fragment);

    if (selectAllCheckbox) {
        const visibleCheckboxes = document.querySelectorAll('.row-delete-checkbox');
        selectAllCheckbox.checked = visibleCheckboxes.length > 0 && Array.from(visibleCheckboxes).every(cb => cb.checked);
    }
    calculateMetrics();

    if (activeAdminView === 'analytics') {
        renderAnalyticsDashboard();
    }
}

// =========================================================================
// FORM & MODAL HANDLERS (RIGHT-SIDE SLIDING DRAWER)
// =========================================================================
function openModal() {
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        // Force reflow for smooth slide-in transition
        void modal.offsetWidth;
        modal.classList.add('open');
    }
}

function closeModal() {
    if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }, 300);
    }
    if (addForm) addForm.reset();
    isEditMode = false;
    currentEditingId = null;
    const toast = document.getElementById('add-success-toast');
    if (toast) toast.style.display = 'none';
}

if (addBtn) {
    addBtn.addEventListener('click', () => {
        isEditMode = false;
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus-circle" style="color: #38bdf8;"></i> Add New Property Item';
        const toast = document.getElementById('add-success-toast');
        if (toast) toast.style.display = 'none';
        if (addForm) addForm.reset();
        openModal();
    });
}

if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
if (closeAddModalBtn) closeAddModalBtn.addEventListener('click', closeModal);

// Form Submission with Continuous / Simultaneous Addition Support
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const qtyVal = parseInt(document.getElementById('add-qty')?.value, 10) || 0;
        const unitCostVal = parseFloat(document.getElementById('add-unit-cost')?.value) || 0;
        const totalCostVal = qtyVal * unitCostVal;

        const formData = {
            date: document.getElementById('add-date')?.value || '',
            qty: qtyVal,
            unit: document.getElementById('add-unit')?.value || '',
            unitCost: unitCostVal,
            article: document.getElementById('add-article')?.value || '',
            description: document.getElementById('add-description')?.value || '',
            propertyNo: document.getElementById('add-property')?.value || '',
            totalCost: totalCostVal,
            location: document.getElementById('add-location')?.value || '',
            accountablePerson: document.getElementById('add-accountable')?.value || '',
            condition: document.getElementById('add-condition')?.value || 'Serviceable',
            account: document.getElementById('add-account')?.value || '',
            remarks: document.getElementById('add-remarks')?.value || 'N/A'
        };

        const supabasePayload = mapInventoryItemToSupabase(formData);

        try {
            if (isEditMode && currentEditingId) {
                // Update Firebase
                await database.ref(`inventoryData/${currentEditingId}`).update(formData);
                // Update Supabase
                if (supabaseClient) {
                    await supabaseClient
                        .from('inventory')
                        .update(supabasePayload)
                        .eq('id', currentEditingId);
                }
                closeModal();
            } else {
                // Generate push key for Firebase
                const newRef = inventoryRef.push();
                const newId = newRef.key;
                formData.id = newId;

                await newRef.set(formData);

                // Insert into Supabase if available
                if (supabaseClient) {
                    await supabaseClient
                        .from('inventory')
                        .insert([supabasePayload]);
                }

                // Stay open for simultaneous / continuous additions
                if (addForm) addForm.reset();
                const toast = document.getElementById('add-success-toast');
                if (toast) {
                    toast.style.display = 'inline-flex';
                    setTimeout(() => { if (toast) toast.style.display = 'none'; }, 2500);
                }
                document.getElementById('add-date')?.focus();
            }

            if (supabaseClient) {
                fetchInventoryFromSupabase();
            }
        } catch (err) {
            console.error("Error saving record:", err);
            alert("Error saving record: " + (err.message || err));
        }
    });
}

window.openEditModal = function(id) {
    const item = inventoryData.find(i => i.id === id);
    if (!item) return;

    isEditMode = true;
    currentEditingId = id;
    if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit" style="color: #38bdf8;"></i> Modify Property Item';
    const toast = document.getElementById('add-success-toast');
    if (toast) toast.style.display = 'none';

    if (document.getElementById('add-date')) document.getElementById('add-date').value = item.date || '';
    if (document.getElementById('add-qty')) document.getElementById('add-qty').value = item.qty || 0;
    if (document.getElementById('add-unit')) document.getElementById('add-unit').value = item.unit || '';
    if (document.getElementById('add-unit-cost')) document.getElementById('add-unit-cost').value = item.unitCost || 0;
    if (document.getElementById('add-article')) document.getElementById('add-article').value = item.article || '';
    if (document.getElementById('add-description')) document.getElementById('add-description').value = item.description || '';
    if (document.getElementById('add-property')) document.getElementById('add-property').value = item.propertyNo || '';
    if (document.getElementById('add-location')) document.getElementById('add-location').value = item.location || '';
    if (document.getElementById('add-accountable')) document.getElementById('add-accountable').value = item.accountablePerson || '';
    if (document.getElementById('add-account')) document.getElementById('add-account').value = item.account || '';
    if (document.getElementById('add-condition')) document.getElementById('add-condition').value = item.condition || 'Serviceable';
    if (document.getElementById('add-remarks')) document.getElementById('add-remarks').value = item.remarks || '';

    openModal();
};

// =========================================================================
// DELETE CONFIRMATION POPOVER & BATCH DELETE MANAGEMENT
// =========================================================================
window.openDeletePopover = function(count) {
    const popover = document.getElementById('delete-popover');
    const titleEl = document.getElementById('delete-popover-title');
    const subtextEl = document.getElementById('delete-popover-subtext');
    
    if (popover) {
        if (titleEl) titleEl.textContent = count > 1 ? `Delete ${count} Articles?` : 'Delete Article?';
        if (subtextEl) {
            subtextEl.innerHTML = `Are you sure you want to delete <strong>${count}</strong> item${count > 1 ? 's' : ''}?<br><span style="color: #f87171; font-size: 11px;">This action cannot be undone.</span>`;
        }
        popover.classList.remove('hidden');
        popover.style.display = 'block';
    }
};

window.closeDeletePopover = function() {
    const popover = document.getElementById('delete-popover');
    if (popover) {
        popover.classList.add('hidden');
        popover.style.display = 'none';
    }
};

// Backwards compatibility alias
window.closeDeleteModal = window.closeDeletePopover;

window.executeBatchDelete = async function() {
    if (selectedItemIds.size === 0) {
        closeDeletePopover();
        return;
    }

    const idsToDelete = Array.from(selectedItemIds);
    const confirmBtn = document.getElementById('confirm-batch-delete-btn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    }

    if (supabaseClient) {
        try {
            await supabaseClient
                .from('inventory')
                .delete()
                .in('id', idsToDelete);
        } catch (err) {
            console.error("Error deleting items from Supabase:", err);
        }
    }

    // Always delete from Firebase Realtime DB too
    const promises = idsToDelete.map(id => database.ref(`inventoryData/${id}`).remove());
    Promise.all(promises).then(() => {
        closeDeletePopover();
        exitDeleteSelectionMode();
        if (supabaseClient) fetchInventoryFromSupabase();
    }).catch(err => {
        console.error("Error deleting items from Firebase:", err);
        closeDeletePopover();
        exitDeleteSelectionMode();
    }).finally(() => {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
        }
    });
};

function updateDeleteButtonLabel() {
    if (!deleteModeBtn) return;
    if (!isDeleteSelectionMode) {
        deleteModeBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
        deleteModeBtn.style.backgroundColor = '#dc2626';
    } else {
        deleteModeBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Confirm Delete (${selectedItemIds.size})`;
        deleteModeBtn.style.backgroundColor = selectedItemIds.size > 0 ? '#ef4444' : '#991b1b';
    }
}

function exitDeleteSelectionMode() {
    isDeleteSelectionMode = false;
    selectedItemIds.clear();
    closeDeletePopover();
    if (thCheckbox) thCheckbox.style.display = 'none';
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    if (cancelDeleteModeBtn) cancelDeleteModeBtn.style.display = 'none';
    updateDeleteButtonLabel();
    renderTable();
}

function enterDeleteSelectionMode() {
    isDeleteSelectionMode = true;
    selectedItemIds.clear();
    closeDeletePopover();
    if (thCheckbox) thCheckbox.style.display = 'table-cell';
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    if (cancelDeleteModeBtn) cancelDeleteModeBtn.style.display = 'inline-flex';
    updateDeleteButtonLabel();
    renderTable();
}

if (deleteModeBtn) {
    deleteModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isDeleteSelectionMode) {
            // First click: enter selection mode with checkboxes
            enterDeleteSelectionMode();
        } else {
            // Second click: open compact popover right beneath the delete button
            if (selectedItemIds.size === 0) {
                alert("Please select at least one item to delete by ticking the checkboxes.");
                return;
            }

            openDeletePopover(selectedItemIds.size);
        }
    });
}

if (cancelDeleteModeBtn) {
    cancelDeleteModeBtn.addEventListener('click', exitDeleteSelectionMode);
}

if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleCheckboxes = document.querySelectorAll('.row-delete-checkbox');
        visibleCheckboxes.forEach(cb => {
            cb.checked = isChecked;
            const id = cb.getAttribute('data-id');
            if (id) {
                if (isChecked) {
                    selectedItemIds.add(id);
                } else {
                    selectedItemIds.delete(id);
                }
            }
        });
        updateDeleteButtonLabel();
    });
}

// Event delegation for row checkboxes in tableBody
if (tableBody) {
    tableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('row-delete-checkbox')) {
            const id = e.target.getAttribute('data-id');
            if (id) {
                if (e.target.checked) {
                    selectedItemIds.add(id);
                } else {
                    selectedItemIds.delete(id);
                }
            }
            if (selectAllCheckbox) {
                const visibleCheckboxes = document.querySelectorAll('.row-delete-checkbox');
                selectAllCheckbox.checked = visibleCheckboxes.length > 0 && Array.from(visibleCheckboxes).every(cb => cb.checked);
            }
            updateDeleteButtonLabel();
        }
    });
}

window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
    const profilesModal = document.getElementById('profiles-modal');
    if (profilesModal && e.target === profilesModal) closeProfilesModal();
    
    // Close delete popover when clicking outside the delete button wrapper
    if (!e.target.closest('.delete-btn-wrapper')) {
        closeDeletePopover();
    }

    // Close any open kebab menu when clicking outside
    if (!e.target.closest('.kebab-menu-btn') && !e.target.closest('.kebab-dropdown-menu')) {
        window.closeAllKebabMenus();
    }
});

// Kebab Menu Controls with Smart Auto-Flipping
window.toggleKebabMenu = function(event, userId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const targetMenu = document.getElementById(`kebab-menu-${userId}`);
    const triggerBtn = event ? (event.currentTarget || event.target.closest('.kebab-menu-btn')) : null;
    const isAlreadyOpen = targetMenu && (targetMenu.style.display === 'flex');
    
    window.closeAllKebabMenus();
    
    if (targetMenu && !isAlreadyOpen) {
        if (triggerBtn) {
            const btnRect = triggerBtn.getBoundingClientRect();
            const scrollContainer = triggerBtn.closest('div[style*="overflow"]') || triggerBtn.closest('.modal-card') || document.body;
            const containerRect = scrollContainer.getBoundingClientRect();
            
            // Check if distance from button to bottom of container or viewport is less than 145px
            const distFromBottom = Math.min(containerRect.bottom - btnRect.bottom, window.innerHeight - btnRect.bottom);
            
            if (distFromBottom < 145) {
                targetMenu.style.top = 'auto';
                targetMenu.style.bottom = '36px';
            } else {
                targetMenu.style.top = '36px';
                targetMenu.style.bottom = 'auto';
            }
        }
        targetMenu.style.display = 'flex';
    }
};

window.closeAllKebabMenus = function() {
    const allMenus = document.querySelectorAll('.kebab-dropdown-menu');
    allMenus.forEach(menu => {
        menu.style.display = 'none';
    });
};

// User Profiles Left-Side Drawer Controls - Automatically closes sidebar upon opening
window.openProfilesModal = function() {
    if (typeof closeSidebarNavMenu === 'function') {
        closeSidebarNavMenu();
    }
    const profilesModal = document.getElementById('profiles-modal');
    if (profilesModal) {
        profilesModal.classList.remove('hidden');
        profilesModal.style.display = 'flex';
        setTimeout(() => {
            profilesModal.classList.add('open');
        }, 10);
    }
};

window.closeProfilesModal = function() {
    window.closeAllKebabMenus();
    const profilesModal = document.getElementById('profiles-modal');
    if (profilesModal) {
        profilesModal.classList.remove('open');
        setTimeout(() => {
            profilesModal.classList.add('hidden');
            profilesModal.style.display = 'none';
        }, 300);
    }
};

const profilesDrawerModal = document.getElementById('profiles-modal');
if (profilesDrawerModal) {
    profilesDrawerModal.addEventListener('click', (e) => {
        if (e.target === profilesDrawerModal) {
            window.closeProfilesModal();
        }
    });
}

// Permanently Delete User Account from Firestore
window.deleteUserAccount = function(userId, userEmail) {
    if (!userId || userId === 'undefined') {
        console.error("Invalid user ID passed to deleteUserAccount");
        return;
    }

    const displayName = userEmail ? `"${userEmail}"` : "this user account";
    if (confirm(`Are you sure you want to permanently delete ${displayName}?\nThis account will be permanently removed from the system and can no longer log in.`)) {
        db.collection("users").doc(userId).delete()
            .then(() => {
                console.log(`User account ${userId} permanently deleted.`);
            })
            .catch((error) => {
                console.error("Error deleting user account: ", error);
                alert("Error deleting user account: " + error.message);
            });
    }
};

// Ensure Firestore listener runs smoothly
// Ensure Firestore listener runs smoothly with date-ordered queue
function initUserProfilesListener() {
    if (typeof db === 'undefined') {
        console.error("Firestore instance 'db' is not initialized.");
        return;
    }

    // Listens to all user updates in real-time
    db.collection("users").onSnapshot((snapshot) => {
        const profilesTableBody = document.getElementById('profiles-table-body');
        const pendingBadge = document.getElementById('pending-users-badge');

        if (!profilesTableBody) {
            console.error("Target tbody element 'profiles-table-body' was not found in the DOM.");
            return;
        }

        profilesTableBody.innerHTML = '';
        let pendingCount = 0;

        if (snapshot.empty) {
            profilesTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 12px;">
                        <i class="far fa-user" style="font-size: 20px; display: block; margin-bottom: 8px; color: #475569;"></i>
                        No registered employee accounts found.
                    </td>
                </tr>
            `;
            if (pendingBadge) pendingBadge.style.display = 'none';
            return;
        }

        const employeeUsers = [];

        snapshot.forEach((doc) => {
            const user = doc.data();
            const userId = doc.id;

            // Standardize role and status checks (fallback to lowercase defaults)
            const userRole = (user.role || 'employee').toLowerCase();
            const userStatus = (user.status || 'pending').toLowerCase();

            // Filter for employee role manually to prevent query mismatch issues
            if (userRole !== 'employee') return;

            if (userStatus === 'pending') pendingCount++;

            // Extract numeric timestamp for accurate date queue sorting
            let createdTime = 0;
            if (user.createdAt) {
                try {
                    if (typeof user.createdAt.toDate === 'function') {
                        createdTime = user.createdAt.toDate().getTime();
                    } else if (user.createdAt.seconds) {
                        createdTime = user.createdAt.seconds * 1000 + (user.createdAt.nanoseconds ? user.createdAt.nanoseconds / 1000000 : 0);
                    } else {
                        const d = new Date(user.createdAt);
                        if (!isNaN(d.getTime())) {
                            createdTime = d.getTime();
                        }
                    }
                } catch (e) {
                    createdTime = 0;
                }
            }

            employeeUsers.push({
                id: userId,
                data: user,
                role: userRole,
                status: userStatus,
                createdTime: createdTime
            });
        });

        if (employeeUsers.length === 0) {
            profilesTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 12px;">
                        <i class="far fa-user" style="font-size: 20px; display: block; margin-bottom: 8px; color: #475569;"></i>
                        No registered employee accounts found.
                    </td>
                </tr>
            `;
            if (pendingBadge) pendingBadge.style.display = 'none';
            return;
        }

        // Sort queue strictly based on Date Created (Newest accounts at the very top)
        employeeUsers.sort((a, b) => b.createdTime - a.createdTime);

        employeeUsers.forEach((item) => {
            const user = item.data;
            const userId = item.id;
            const userStatus = item.status;

            // Status styling
            let statusBadge = '<span style="background: rgba(234, 179, 8, 0.15); color: #fef08a; border: 1px solid rgba(234, 179, 8, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">Pending</span>';
            if (userStatus === 'approved') statusBadge = '<span style="background: rgba(34, 197, 94, 0.15); color: #bbf7d0; border: 1px solid rgba(34, 197, 94, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">Approved</span>';
            if (userStatus === 'rejected') statusBadge = '<span style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">Rejected</span>';

            // Format Date Created string with date and time
            let dateCreatedStr = '-';
            if (item.createdTime > 0) {
                const d = new Date(item.createdTime);
                dateCreatedStr = d.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                }) + ', ' + d.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            }

            const deptName = user.department || 'N/A';
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(51, 65, 85, 0.6)';
            tr.innerHTML = `
                <td style="padding: 12px 14px; font-weight: 600; color: #f8fafc;">
                    <i class="far fa-user" style="color: #94a3b8; margin-right: 6px;"></i> ${sanitizeText(user.fullName || user.name || 'N/A')}
                </td>
                <td style="padding: 12px 14px; color: #cbd5e1;">${sanitizeText(user.email || 'N/A')}</td>
                <td style="padding: 12px 14px;">
                    <span style="display: inline-flex; align-items: center; gap: 5px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">
                        <i class="fas fa-building" style="font-size: 10px;"></i> ${sanitizeText(deptName)}
                    </span>
                </td>
                <td style="padding: 12px 14px;">${statusBadge}</td>
                <td style="padding: 12px 14px; color: #94a3b8; font-size: 11.5px;">
                    <i class="far fa-calendar-alt" style="margin-right: 4px; color: #64748b;"></i> ${sanitizeText(dateCreatedStr)}
                </td>
                <td style="padding: 12px 14px; text-align: center; position: relative;">
                    <button class="kebab-menu-btn" onclick="toggleKebabMenu(event, '${userId}')" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Actions">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div id="kebab-menu-${userId}" class="kebab-dropdown-menu" style="position: absolute; right: 14px; top: 40px; background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); z-index: 100; min-width: 145px; padding: 6px; display: none; flex-direction: column; gap: 4px; text-align: left;">
                        ${userStatus === 'pending' ? `
                            <button onclick="updateUserStatus('${userId}', 'approved'); closeAllKebabMenus();" class="kebab-item-btn" style="background: none; border: none; color: #4ade80; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; border-radius: 4px; transition: background 0.15s;">
                                <i class="fas fa-check-circle" style="width: 14px;"></i> Approve
                            </button>
                            <button onclick="updateUserStatus('${userId}', 'rejected'); closeAllKebabMenus();" class="kebab-item-btn" style="background: none; border: none; color: #fbbf24; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; border-radius: 4px; transition: background 0.15s;">
                                <i class="fas fa-ban" style="width: 14px;"></i> Reject
                            </button>
                        ` : `
                            <button onclick="updateUserStatus('${userId}', '${userStatus === 'approved' ? 'rejected' : 'approved'}'); closeAllKebabMenus();" class="kebab-item-btn" style="background: none; border: none; color: ${userStatus === 'approved' ? '#fbbf24' : '#4ade80'}; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; border-radius: 4px; transition: background 0.15s;">
                                <i class="fas ${userStatus === 'approved' ? 'fa-ban' : 'fa-check-circle'}" style="width: 14px;"></i> ${userStatus === 'approved' ? 'Revoke Approval' : 'Approve'}
                            </button>
                        `}
                        <button onclick="openAdminReassignModal('${userId}', '${sanitizeText(user.fullName || user.name || 'Staff')}', '${sanitizeText(user.email || '')}', '${sanitizeText(deptName)}', event); closeAllKebabMenus();" class="kebab-item-btn" style="background: none; border: none; color: #38bdf8; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; border-radius: 4px; transition: background 0.15s;">
                            <i class="fas fa-building" style="width: 14px;"></i> Reassign Dept
                        </button>
                        <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 2px 0;"></div>
                        <button onclick="deleteUserAccount('${userId}', '${sanitizeText(user.email)}'); closeAllKebabMenus();" class="kebab-item-btn" style="background: none; border: none; color: #f87171; padding: 7px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; border-radius: 4px; transition: background 0.15s;">
                            <i class="fas fa-trash-alt" style="width: 14px;"></i> Delete Account
                        </button>
                    </div>
                </td>
            `;
            profilesTableBody.appendChild(tr);
        });

        if (pendingBadge) {
            pendingBadge.textContent = pendingCount;
            pendingBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }
    }, (error) => {
        console.error("Firestore Listener Error:", error.message);
    });
}

// Call listener once DOM Content is Loaded
document.addEventListener('DOMContentLoaded', initUserProfilesListener);

// Function to Approve or Reject User Status
function updateUserStatus(userId, newStatus) {
    if (!userId || userId === 'undefined') {
        console.error("Invalid user ID passed to updateUserStatus");
        return;
    }

    db.collection("users").doc(userId).update({
        status: newStatus
    })
    .then(() => {
        console.log(`User status updated to ${newStatus}`);
    })
    .catch((error) => {
        console.error("Error updating user status: ", error);
    });
}

// =========================================================================
// ADMIN REASSIGN EMPLOYEE DEPARTMENT MODAL LOGIC
// =========================================================================
window.openAdminReassignModal = function(userId, userName, userEmail, currentDept, clickEvent) {
    const modal = document.getElementById('admin-reassign-modal');
    const userIdInput = document.getElementById('reassign-user-id');
    const nameEl = document.getElementById('reassign-staff-name');
    const emailEl = document.getElementById('reassign-staff-email');
    const currentDeptEl = document.getElementById('reassign-staff-current-dept');
    const alertBox = document.getElementById('admin-reassign-alert');
    const saveBtn = document.getElementById('save-reassign-btn');
    const modalCard = modal ? modal.querySelector('.modal-card') : null;

    if (userIdInput) userIdInput.value = userId;
    if (nameEl) nameEl.textContent = userName || 'Staff Member';
    if (emailEl) emailEl.textContent = userEmail || 'No Email';
    if (currentDeptEl) currentDeptEl.textContent = currentDept || 'None';
    if (alertBox) alertBox.style.display = 'none';

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Reassign Department';
    }

    // Highlight target row in the user profiles table
    const targetRow = clickEvent?.target?.closest('tr');
    document.querySelectorAll('#profiles-table-body tr').forEach(r => r.classList.remove('reassign-active-row'));
    if (targetRow) targetRow.classList.add('reassign-active-row');

    // Dynamically align card and triangular arrow connector to the clicked row
    if (modalCard && window.innerWidth >= 1200) {
        let rowCenter = 140;
        if (targetRow) {
            const rect = targetRow.getBoundingClientRect();
            rowCenter = rect.top + (rect.height / 2);
        } else if (clickEvent && clickEvent.clientY) {
            rowCenter = clickEvent.clientY;
        }

        // Align modal card so arrow is near the top or centered
        let targetTop = rowCenter - 42;
        targetTop = Math.max(25, Math.min(window.innerHeight - 460, targetTop));
        modalCard.style.top = `${targetTop}px`;

        const arrowOffset = Math.max(24, Math.min(380, rowCenter - targetTop - 9));
        modalCard.style.setProperty('--arrow-top', `${arrowOffset}px`);
    } else if (modalCard) {
        modalCard.style.top = '80px';
    }

    // Reset dropdown to current or placeholder
    window.selectAdminCustomDept('reassign-new-dept', 'adminReassignText', 'adminReassignTrigger', 'adminReassignDeptWrapper', currentDept || '', currentDept ? `${currentDept}` : 'Select Department');

    if (modal) {
        modal.classList.remove('hidden');
        // Force reflow for smooth sliding transition
        void modal.offsetWidth;
        modal.classList.add('open');
        document.body.classList.add('modal-open');
    }
};

window.closeAdminReassignModal = function() {
    const modal = document.getElementById('admin-reassign-modal');
    // Clear active row highlight
    document.querySelectorAll('#profiles-table-body tr').forEach(r => r.classList.remove('reassign-active-row'));

    if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
            if (!modal.classList.contains('open')) {
                modal.classList.add('hidden');
            }
        }, 350);
        // Only remove modal-open from body if profiles drawer is not open
        const profilesModal = document.getElementById('profiles-modal');
        if (!profilesModal || !profilesModal.classList.contains('open')) {
            document.body.classList.remove('modal-open');
        }
    }
};

window.toggleAdminCustomDropdown = function(event, wrapperId, searchInputId) {
    if (event) event.stopPropagation();
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const wasOpen = wrapper.classList.contains('open');
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

window.filterAdminDropdownOptions = function(query, listId) {
    const list = document.getElementById(listId);
    if (!list) return;

    const q = (query || '').toLowerCase().trim();
    const options = list.querySelectorAll('.custom-option');
    options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        opt.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
    });
};

window.selectAdminCustomDept = function(hiddenInputId, textSpanId, triggerId, wrapperId, value, label) {
    const hiddenInput = document.getElementById(hiddenInputId);
    const textSpan = document.getElementById(textSpanId);
    const trigger = document.getElementById(triggerId);
    const wrapper = document.getElementById(wrapperId);

    if (hiddenInput) {
        hiddenInput.value = value;
        hiddenInput.dispatchEvent(new Event('change'));
    }

    if (textSpan) {
        textSpan.textContent = label || value || 'Select Department';
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

window.saveAdminReassignedDept = async function(event) {
    event.preventDefault();
    const userId = document.getElementById('reassign-user-id')?.value;
    const newDept = document.getElementById('reassign-new-dept')?.value?.trim();
    const alertBox = document.getElementById('admin-reassign-alert');
    const saveBtn = document.getElementById('save-reassign-btn');

    if (!userId || !newDept) {
        if (alertBox) {
            alertBox.style.display = 'flex';
            alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
            alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            alertBox.style.color = '#f87171';
            alertBox.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Please select a municipal department.';
        }
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        await db.collection("users").doc(userId).update({
            department: newDept
        });

        if (alertBox) {
            alertBox.style.display = 'flex';
            alertBox.style.background = 'rgba(34, 197, 94, 0.15)';
            alertBox.style.border = '1px solid rgba(34, 197, 94, 0.3)';
            alertBox.style.color = '#4ade80';
            alertBox.innerHTML = `<i class="fas fa-check-circle"></i> Successfully reassigned department to ${newDept}!`;
        }

        setTimeout(() => {
            window.closeAdminReassignModal();
        }, 1200);

    } catch (err) {
        console.error("Error reassigning department:", err);
        if (alertBox) {
            alertBox.style.display = 'flex';
            alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
            alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            alertBox.style.color = '#f87171';
            alertBox.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${err.message || 'Could not update department.'}`;
        }
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-check"></i> Reassign Department';
        }
    }
};

// Document click listener to close custom dropdowns
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-select-wrapper.open').forEach(el => {
            el.classList.remove('open');
        });
    }
});

// =========================================================================
// PENDING REQUESTS & EQUIPMENT TRANSFER APPROVAL WORKFLOW
// =========================================================================
const pendingRequestsWrapper = document.getElementById('pending-requests-wrapper');
const pendingRequestsLog = document.getElementById('pending-requests-log');
const pendingRequestsBadge = document.getElementById('pending-requests-badge');

window.toggleRequestsStack = function(forceOpen) {
    if (sidebarDrawer && !sidebarDrawer.classList.contains('expanded')) {
        sidebarDrawer.classList.add('expanded');
        document.body.classList.add('sidebar-expanded');
        localStorage.setItem('gtrack_sidebar_expanded', 'true');
    }

    if (pendingRequestsWrapper) {
        if (forceOpen === true) {
            pendingRequestsWrapper.classList.add('open');
        } else {
            pendingRequestsWrapper.classList.toggle('open');
        }
    }
};

function initRequestsListener() {
    // 1. Listen for Equipment Transfer Requests
    database.ref('equipmentTransfers').on('value', (snapshot) => {
        renderAdminRequestsPanel();
    });

    // 2. Listen for Masterlist Requests
    database.ref('masterlistRequests').on('value', (snapshot) => {
        renderAdminRequestsPanel();
    });

    // 3. Listen for Department Transfer Requests
    database.ref('deptTransferRequests').on('value', (snapshot) => {
        renderAdminRequestsPanel();
    });
}

async function renderAdminRequestsPanel() {
    if (!pendingRequestsLog) return;

    try {
        const [transfersSnap, masterlistSnap, deptTransfersSnap] = await Promise.all([
            database.ref('equipmentTransfers').once('value'),
            database.ref('masterlistRequests').once('value'),
            database.ref('deptTransferRequests').once('value')
        ]);

        const allCards = [];
        let pendingCount = 0;

        // Process Equipment Transfers
        if (transfersSnap.exists()) {
            transfersSnap.forEach((child) => {
                const req = child.val();
                const reqId = child.key;
                if (req.status === 'Pending') pendingCount++;

                allCards.push({
                    id: reqId,
                    type: 'transfer',
                    data: req,
                    time: req.createdAt ? new Date(req.createdAt).getTime() : 0
                });
            });
        }

        // Process Department Transfer Requests
        if (deptTransfersSnap.exists()) {
            deptTransfersSnap.forEach((child) => {
                const req = child.val();
                const reqId = child.key;
                if (req.status === 'Pending') pendingCount++;

                allCards.push({
                    id: reqId,
                    type: 'dept_transfer',
                    data: req,
                    time: req.createdAt ? new Date(req.createdAt).getTime() : 0
                });
            });
        }

        // Process Masterlist Requests
        if (masterlistSnap.exists()) {
            masterlistSnap.forEach((child) => {
                const req = child.val();
                const reqId = child.key;
                if (req.status === 'Pending') pendingCount++;

                allCards.push({
                    id: reqId,
                    type: 'masterlist',
                    data: req,
                    time: req.requestedAt ? new Date(req.requestedAt).getTime() : 0
                });
            });
        }

        if (pendingRequestsBadge) {
            pendingRequestsBadge.textContent = pendingCount;
            pendingRequestsBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }

        if (allCards.length === 0) {
            pendingRequestsLog.innerHTML = `
                <div style="padding: 18px 12px; text-align: center; color: #64748b; font-size: 11.5px;">
                    <i class="far fa-bell-slash" style="font-size: 16px; display: block; margin-bottom: 6px;"></i>
                    No pending requests.
                </div>
            `;
            return;
        }

        allCards.sort((a, b) => b.time - a.time);

        pendingRequestsLog.innerHTML = '';
        allCards.forEach((item) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'history-item-card';
            cardEl.style.cssText = 'background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; font-size: 12px;';

            if (item.type === 'transfer') {
                const t = item.data;
                const isPending = t.status === 'Pending';
                cardEl.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: #38bdf8; font-size: 11.5px;">
                            <i class="fas fa-exchange-alt"></i> Equipment Transfer
                        </span>
                        <span style="font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px; ${isPending ? 'background: rgba(234,179,8,0.2); color: #fde047;' : (t.status === 'Approved' ? 'background: rgba(34,197,94,0.2); color: #86efac;' : 'background: rgba(239,68,68,0.2); color: #fca5a5;')}">
                            ${sanitizeText(t.status || 'Pending')}
                        </span>
                    </div>
                    <div style="font-weight: 600; color: #f8fafc; margin-bottom: 2px;">${sanitizeText(t.article || 'Equipment')}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Prop #: ${sanitizeText(t.propertyNo || '-')}</div>
                    <div style="background: rgba(0,0,0,0.25); border-radius: 4px; padding: 6px 8px; font-size: 11px; margin-bottom: 6px; color: #cbd5e1;">
                        <div><strong>From:</strong> ${sanitizeText(t.originLocation || '-')}</div>
                        <div><strong>To:</strong> <span style="color: #38bdf8; font-weight: 700;">${sanitizeText(t.targetDepartment || '-')}</span></div>
                        <div><strong>New Custodian:</strong> ${sanitizeText(t.newCustodian || '-')}</div>
                        <div style="margin-top: 2px; color: #94a3b8;"><em>"${sanitizeText(t.reason || '')}"</em></div>
                    </div>
                    ${isPending ? `
                        <div style="display: flex; gap: 6px; margin-top: 6px;">
                            <button onclick="approveEquipmentTransfer('${item.id}', '${t.itemId}', '${t.targetDepartment}', '${sanitizeText(t.newCustodian)}')" style="flex: 1; background: #0284c7; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button onclick="rejectEquipmentTransfer('${item.id}')" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
                                Reject
                            </button>
                        </div>
                    ` : ''}
                `;
            } else if (item.type === 'dept_transfer') {
                const d = item.data;
                const isPending = d.status === 'Pending';
                cardEl.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: #a855f7; font-size: 11.5px;">
                            <i class="fas fa-building"></i> Dept Transfer Request
                        </span>
                        <span style="font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px; ${isPending ? 'background: rgba(234,179,8,0.2); color: #fde047;' : (d.status === 'Approved' ? 'background: rgba(34,197,94,0.2); color: #86efac;' : 'background: rgba(239,68,68,0.2); color: #fca5a5;')}">
                            ${sanitizeText(d.status || 'Pending')}
                        </span>
                    </div>
                    <div style="font-weight: 600; color: #f8fafc; margin-bottom: 2px;">${sanitizeText(d.userName || 'Staff Member')}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${sanitizeText(d.userEmail || '')}</div>
                    <div style="background: rgba(0,0,0,0.25); border-radius: 4px; padding: 6px 8px; font-size: 11px; margin-bottom: 6px; color: #cbd5e1;">
                        <div><strong>Current Office:</strong> ${sanitizeText(d.originDepartment || '-')}</div>
                        <div><strong>Requested Office:</strong> <span style="color: #38bdf8; font-weight: 700;">${sanitizeText(d.targetDepartment || '-')}</span></div>
                    </div>
                    ${isPending ? `
                        <div style="display: flex; gap: 6px; margin-top: 6px;">
                            <button onclick="approveDeptTransfer('${item.id}', '${d.userId}', '${d.targetDepartment}')" style="flex: 1; background: #0284c7; color: #fff; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button onclick="rejectDeptTransfer('${item.id}')" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
                                Reject
                            </button>
                        </div>
                    ` : ''}
                `;
            } else {
                const m = item.data;
                const isPending = m.status === 'Pending' || m.status === 'pending';
                cardEl.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: #a78bfa; font-size: 11.5px;">
                            <i class="fas fa-file-export"></i> Masterlist Copy
                        </span>
                        <span style="font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px; ${isPending ? 'background: rgba(234,179,8,0.2); color: #fde047;' : 'background: rgba(34,197,94,0.2); color: #86efac;'}">
                            ${sanitizeText(m.status || 'Pending')}
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #cbd5e1;">Requested by: <strong>${sanitizeText(m.userName || m.user || 'Staff')}</strong></div>
                    <div style="font-size: 10.5px; color: #64748b;">${sanitizeText(m.time || '')}</div>
                `;
            }

            pendingRequestsLog.appendChild(cardEl);
        });

    } catch (e) {
        console.error("Error rendering admin requests panel:", e);
    }
}

window.approveDeptTransfer = async function(reqId, userId, targetDepartment) {
    if (!confirm(`Approve department transfer to ${targetDepartment}?`)) return;

    try {
        await database.ref(`deptTransferRequests/${reqId}`).update({
            status: 'Approved',
            approvedAt: new Date().toISOString()
        });

        if (userId) {
            await db.collection("users").doc(userId).update({
                department: targetDepartment
            });
        }
    } catch (err) {
        console.error("Error approving dept transfer:", err);
        alert("Error approving department transfer: " + err.message);
    }
};

window.rejectDeptTransfer = async function(reqId) {
    if (!confirm("Reject this department transfer request?")) return;

    try {
        await database.ref(`deptTransferRequests/${reqId}`).update({
            status: 'Rejected',
            rejectedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error rejecting dept transfer:", err);
        alert("Error rejecting department transfer: " + err.message);
    }
};

window.approveEquipmentTransfer = async function(transferId, itemId, newDept, newCustodian) {
    if (!confirm(`Approve transfer of this equipment to ${newDept} (Custodian: ${newCustodian})?`)) return;

    try {
        // 1. Update Inventory in Supabase
        if (supabaseClient && itemId) {
            try {
                await supabaseClient.from('inventory').update({
                    location: newDept,
                    accountable_person: newCustodian
                }).eq('id', itemId);
            } catch(err) {
                console.warn("Supabase item update fallback:", err);
            }
        }

        // 2. Update Inventory in Firebase Realtime Database
        if (itemId) {
            await database.ref(`inventoryData/${itemId}`).update({
                location: newDept,
                accountablePerson: newCustodian
            });
        }

        // 3. Update local array so UI updates instantly
        const localItem = inventoryData.find(i => String(i.id) === String(itemId));
        if (localItem) {
            localItem.location = newDept;
            localItem.accountablePerson = newCustodian;
        }

        // 4. Mark Transfer Request as Approved
        await database.ref(`equipmentTransfers/${transferId}`).update({
            status: 'Approved',
            approvedAt: new Date().toISOString()
        });

        alert(`Transfer approved! Equipment location updated to ${newDept}.`);
        renderTable();
        renderAdminRequestsPanel();

    } catch (err) {
        console.error("Error approving transfer:", err);
        alert("Could not approve transfer: " + err.message);
    }
};

window.rejectEquipmentTransfer = async function(transferId) {
    if (!confirm("Are you sure you want to reject this equipment transfer request?")) return;

    try {
        await database.ref(`equipmentTransfers/${transferId}`).update({
            status: 'Rejected',
            rejectedAt: new Date().toISOString()
        });
        renderAdminRequestsPanel();
    } catch (err) {
        alert("Error rejecting transfer: " + err.message);
    }
};

document.addEventListener('DOMContentLoaded', initRequestsListener);
// =========================================================================
// CSV EXPORT LOGIC
// =========================================================================
window.exportToCSV = function() {
    if (inventoryData.length === 0) {
        alert("No data available to export.");
        return;
    }

    const selectedAccount = accountFilter ? accountFilter.value || 'All Accounts' : 'All Accounts';
    const selectedCondition = conditionFilter ? conditionFilter.value || 'All Conditions' : 'All Conditions';
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let dataToExport = inventoryData;
    const isFiltered = (selectedAccount !== 'All Accounts' || selectedCondition !== 'All Conditions' || searchText.length > 0);

    if (isFiltered) {
        dataToExport = inventoryData.filter(item => {
            const matchesAccount = selectedAccount === 'All Accounts' || item.account === selectedAccount;
            const matchesCondition = selectedCondition === 'All Conditions' || 
                (item.condition || '').toLowerCase() === selectedCondition.toLowerCase();
            
            let matchesSearch = true;
            if (searchText) {
                const searchTerms = searchText.split(/\s+/).filter(Boolean);
                const searchBlob = [
                    item.article, item.description, item.propertyNo, item.location,
                    item.accountablePerson, item.condition, item.account, item.remarks,
                    item.unit, String(item.qty || ''), String(item.unitCost || ''), String(item.totalCost || '')
                ].map(v => String(v || '').toLowerCase()).join(" ");

                matchesSearch = searchTerms.every(term => searchBlob.includes(term));
            }
            return matchesAccount && matchesCondition && matchesSearch;
        });
    }

    const csvContent = buildCSVString(dataToExport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    
    const fileSuffix = isFiltered ? `Filtered_${new Date().toISOString().slice(0, 10)}` : `${new Date().toISOString().slice(0, 10)}`;
    downloadLink.setAttribute("href", url);
    downloadLink.setAttribute("download", `GSO_Inventory_Report_${fileSuffix}.csv`);
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
};

setupConditionDropdown();

// =========================================================================
// SUPABASE REALTIME SYNC, REQUEST TRACKER & AUTO-MIGRATION
// =========================================================================

async function fetchInventoryFromSupabase() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            console.warn("Supabase notice (using Firebase data):", error.message);
            return;
        }
        if (data && data.length > 0) {
            inventoryData = data.map(mapSupabaseToInventoryItem);
            updateAccountDropdown();
            renderTable();
        }
    } catch (err) {
        console.warn("Supabase fetch notice (using Firebase data):", err);
    }
}

// Auto-migration helper from Firebase to Supabase on startup
async function checkAndMigrateData() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('inventory').select('id').limit(1);
        if (error) {
            console.warn("Supabase initial check error:", error.message);
            return;
        }
        if (!data || data.length === 0) {
            console.log("Supabase inventory is empty. Migrating existing records from Firebase Realtime DB...");
            inventoryRef.once('value', async (snapshot) => {
                const fbData = snapshot.val();
                if (fbData) {
                    const toInsert = Object.keys(fbData).map(k => mapInventoryItemToSupabase(fbData[k]));
                    if (toInsert.length > 0) {
                        const { error: insErr } = await supabaseClient.from('inventory').insert(toInsert);
                        if (!insErr) {
                            console.log(`Successfully migrated ${toInsert.length} items from Firebase to Supabase!`);
                            fetchInventoryFromSupabase();
                        } else {
                            console.error("Migration insert error:", insErr);
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error("Migration error:", e);
    }
}

// 1. Instant Data Load from Firebase Realtime DB (Guarantees data is never empty)
inventoryRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const fbItems = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        if (fbItems.length > 0) {
            // Populate if Supabase hasn't loaded yet or if using Firebase directly
            if (inventoryData.length === 0 || !supabaseClient) {
                inventoryData = fbItems;
                updateAccountDropdown();
                renderTable();
            }
        }
    }
});

// 2. Initialize Supabase Listeners & Realtime Sync if configured
if (supabaseClient) {
    fetchInventoryFromSupabase();
    checkAndMigrateData();

    // Subscribe to public.inventory changes in Realtime
    supabaseClient
        .channel('public:inventory')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
            fetchInventoryFromSupabase();
        })
        .subscribe();
}

function updateClearSearchVisibility() {
    if (clearSearchBtn && searchInput) {
        clearSearchBtn.style.display = searchInput.value.length > 0 ? 'inline-flex' : 'none';
    }
}

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

// =========================================================================
// NAVIGATION, SIDEBAR & DELEGATED REQUEST NOTIFICATIONS
// =========================================================================
const hamburgerBtn = document.getElementById('hamburger-menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarDrawer = document.getElementById('sidebar-drawer');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarPrintBtn = document.getElementById('sidebar-print-btn');
const sidebarCsvBtn = document.getElementById('sidebar-csv-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');

// Initialize Sidebar state based on user preference
(function initSidebarState() {
    const isSavedExpanded = localStorage.getItem('gtrack_sidebar_expanded') === 'true';
    if (isSavedExpanded && window.innerWidth > 768 && sidebarDrawer) {
        sidebarDrawer.classList.add('expanded');
        document.body.classList.add('sidebar-expanded');
    }
})();

/**
 * Toggles the sidebar between collapsed (mini icon mode) and expanded (full mode).
 */
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

/**
 * Toggles the Pending Requests stacking card container.
 */
window.toggleRequestsStack = function(forceOpen) {
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

    const wrapper = document.getElementById('pending-requests-wrapper');
    if (wrapper) {
        if (forceOpen === true) {
            wrapper.classList.add('open');
        } else {
            wrapper.classList.toggle('open');
        }
    }
};

window.expandSidebarForRequests = function() {
    window.toggleRequestsStack();
};

function closeSidebarNavMenu() {
    if (window.innerWidth <= 768) {
        if (sidebarDrawer) sidebarDrawer.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    }
}

if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebarNavMenu);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarNavMenu);

if (sidebarPrintBtn) {
    sidebarPrintBtn.addEventListener('click', () => {
        closeSidebarNavMenu();
        window.print();
    });
}

if (sidebarCsvBtn) {
    sidebarCsvBtn.addEventListener('click', () => {
        closeSidebarNavMenu();
        exportToCSV();
    });
}

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

const pendingRequestsContainer = document.getElementById('pending-requests-log');

// Real-Time Request Tracker in Admin (Firebase Realtime DB)
if (requestsRef && pendingRequestsContainer) {
    requestsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        pendingRequestsContainer.innerHTML = ''; 
        
        const emptyStateHTML = `
            <div style="padding: 16px; border-radius: 8px; border: 1.5px dashed #334155; text-align: center; color: #94a3b8; font-size: 12px;">
                <i class="fas fa-check-circle" style="font-size: 18px; margin-bottom: 6px; display: block; color: #22c55e;"></i>
                No pending requests.
            </div>
        `;

        const pendingRequestsBadge = document.getElementById('pending-requests-badge');

        if (!data) {
            pendingRequestsContainer.innerHTML = emptyStateHTML;
            if (pendingRequestsBadge) pendingRequestsBadge.style.display = 'none';
            return;
        }

        const pendingList = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(req => (req.status || '').toUpperCase() === "PENDING")
            .reverse();

        if (pendingRequestsBadge) {
            pendingRequestsBadge.textContent = pendingList.length;
            pendingRequestsBadge.style.display = pendingList.length > 0 ? 'inline-block' : 'none';
        }

        if (pendingList.length === 0) {
            pendingRequestsContainer.innerHTML = emptyStateHTML;
            return;
        }

        const fragment = document.createDocumentFragment();

        pendingList.forEach(req => {
            const block = document.createElement('div');
            block.style.backgroundColor = '#1e293b';
            block.style.border = '1.5px solid #334155';
            block.style.borderRadius = '8px';
            block.style.padding = '12px 14px';
            block.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            block.style.display = 'flex';
            block.style.flexDirection = 'column';
            block.style.gap = '8px';

            block.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <span style="font-weight: 600; font-size: 11.5px; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;" title="${sanitizeText(req.user)}">
                        <i class="far fa-user" style="color: #94a3b8; margin-right: 4px;"></i> ${sanitizeText(req.user)}
                    </span>
                    <span style="font-size: 10.5px; color: #94a3b8; white-space: nowrap; flex-shrink: 0; font-variant-numeric: tabular-nums;">${sanitizeText(req.time)}</span>
                </div>
                <div style="display: flex; gap: 8px; width: 100%;">
                    <button class="approve-action-btn" data-id="${req.id}" style="flex: 1; background-color: #22703e; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: 700; font-size: 11px; cursor: pointer;">
                        Approve
                    </button>
                    <button class="reject-action-btn" data-id="${req.id}" style="flex: 1; background-color: #ef4444; color: white; border: none; padding: 6px; border-radius: 4px; font-weight: 700; font-size: 11px; cursor: pointer;">
                        Reject
                    </button>
                </div>
            `;
            fragment.appendChild(block);
        });

        pendingRequestsContainer.appendChild(fragment);
    });
}

// Setup Delegation Once for Pending Actions to Prevent Listener Memory Leaks
if (pendingRequestsContainer) {
    pendingRequestsContainer.addEventListener('click', (e) => {
        const approveBtn = e.target.closest('.approve-action-btn');
        const rejectBtn = e.target.closest('.reject-action-btn');

        if (approveBtn) {
            e.preventDefault();
            e.stopPropagation();
            const reqId = approveBtn.getAttribute('data-id');
            const compiledCSVString = buildCSVString();

            database.ref(`masterlistRequests/${reqId}`).update({
                status: "Completed",
                fulfilledTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                csvDataString: compiledCSVString
            }).catch(err => console.error("Error approving request:", err));

            if (supabaseClient) {
                supabaseClient.from('masterlist_requests').update({ status: "completed", updated_at: new Date().toISOString() }).eq('id', reqId).then(() => {}).catch(() => {});
            }
        }

        if (rejectBtn) {
            e.preventDefault();
            e.stopPropagation();
            const reqId = rejectBtn.getAttribute('data-id');
            database.ref(`masterlistRequests/${reqId}`).remove()
                .catch(err => console.error("Error rejecting request:", err));

            if (supabaseClient) {
                supabaseClient.from('masterlist_requests').delete().eq('id', reqId).then(() => {}).catch(() => {});
            }
        }
    });
}

// =========================================================================
// PRINT REPORT POPOVER & REPORT TEMPLATE GENERATION
// =========================================================================

/**
 * Toggles the print popover modal display.
 * @param {Event} [event] 
 */
function togglePrintPopover(event) {
    if (event) event.stopPropagation();
    const popover = document.getElementById('printPopover');
    if (popover) {
        popover.classList.toggle('hidden');
    }
}

// =========================================================================
// SIGN OUT CONFIRMATION POPOVER (ADMIN)
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

window.executeSignOut = async function() {
    try {
        if (typeof auth !== 'undefined' && auth && typeof auth.signOut === 'function') {
            await auth.signOut();
        }
    } catch (err) {
        console.warn("Sign out auth exception:", err);
    }
    sessionStorage.clear();
    window.location.href = '../login/index.html';
};

// Dismiss print popover and signout popover on outside click
document.addEventListener('click', function(event) {
    const popover = document.getElementById('printPopover');
    const btn = document.getElementById('btnPrint');
    if (popover && btn && !popover.contains(event.target) && !btn.contains(event.target)) {
        popover.classList.add('hidden');
    }

    const signoutPopover = document.getElementById('signout-popover');
    const signoutWrapper = document.querySelector('.sign-out-wrapper');
    if (signoutPopover && signoutWrapper && !signoutWrapper.contains(event.target)) {
        signoutPopover.classList.add('hidden');
    }
});

/**
 * Helper date parser for report period filters (e.g. "July 2026", "2026-07", "January 2026", etc.)
 */
function parseReportDateFilter(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const cleanStr = dateStr.trim().toLowerCase();
    if (cleanStr === '' || cleanStr === 'all' || cleanStr === 'all dates' || cleanStr === 'none') return null;

    const months = {
        'jan': 0, 'january': 0,
        'feb': 1, 'february': 1,
        'mar': 2, 'march': 2,
        'apr': 3, 'april': 3,
        'may': 4,
        'jun': 5, 'june': 5,
        'jul': 6, 'july': 6,
        'aug': 7, 'august': 7,
        'sep': 8, 'september': 8,
        'oct': 9, 'october': 9,
        'nov': 10, 'november': 10,
        'dec': 11, 'december': 11
    };

    // Match "Month YYYY" (e.g. "July 2026", "Jul 2026")
    const monthYearMatch = cleanStr.match(/^([a-z]+)\s*(\d{4})$/i);
    if (monthYearMatch) {
        const mName = monthYearMatch[1].toLowerCase();
        const year = parseInt(monthYearMatch[2], 10);
        if (months[mName] !== undefined) {
            return new Date(year, months[mName], 1, 0, 0, 0, 0);
        }
    }

    // Match "YYYY-MM" (e.g. "2026-07")
    const yearMonthMatch = cleanStr.match(/^(\d{4})[/-](\d{1,2})$/);
    if (yearMonthMatch) {
        const year = parseInt(yearMonthMatch[1], 10);
        const month = parseInt(yearMonthMatch[2], 10) - 1;
        return new Date(year, month, 1, 0, 0, 0, 0);
    }

    // Standard Date parser
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

/**
 * Reads popover parameters, generates report HTML dynamically, and launches window print.
 */
function executePrintReport() {
    const formatSelect = document.getElementById('reportFormatSelect');
    const selectedFormat = formatSelect ? formatSelect.value : 'format1';

    const asOfDateInput = document.getElementById('reportAsOfDate');
    const asOfDate = (asOfDateInput && asOfDateInput.value.trim() !== '') ? asOfDateInput.value.trim() : 'July 2026';
    const fund = document.getElementById('reportFund') ? document.getElementById('reportFund').value : 'GENERAL FUND';
    const officer = document.getElementById('reportAccountableOfficer') ? document.getElementById('reportAccountableOfficer').value : 'RIZALDO A. RICAFORT';
    const designation = document.getElementById('reportDesignation') ? document.getElementById('reportDesignation').value : 'MGDH I - GSO';
    
    // READ DATE OF ASSUMPTION FROM POPOVER INPUT
    const assumptionDateInput = document.getElementById('reportAssumptionDate');
    const assumptionDate = (assumptionDateInput && assumptionDateInput.value.trim() !== '') 
        ? assumptionDateInput.value.trim() 
        : 'April 17,2024';

    const accountGroup = (typeof accountFilter !== 'undefined' && accountFilter) ? accountFilter.value : 'All Accounts';

    const meta = {
        asOfDate: asOfDate,
        fund: fund,
        officer: officer,
        designation: designation,
        assumptionDate: assumptionDate,
        accountGroup: (accountGroup === 'All Accounts' || !accountGroup) ? 'OTHER PROPERTY, PLANT AND EQUIPMENT' : accountGroup.toUpperCase()
    };

    const printArea = document.getElementById('printArea');
    if (!printArea) {
        console.error("Print area container (#printArea) not found in DOM.");
        return;
    }

    // Source masterlist records
    const rawData = (typeof inventoryData !== 'undefined' && inventoryData.length > 0) ? inventoryData : [];
    
    // Filter by Date (e.g. from July 2026 to current)
    const filterStartDate = parseReportDateFilter(asOfDate);
    let dataToPrint = rawData;

    if (filterStartDate) {
        dataToPrint = dataToPrint.filter(item => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);
            if (!isNaN(itemDate.getTime())) {
                return itemDate >= filterStartDate;
            }
            const parsedItemDate = parseReportDateFilter(item.date);
            return parsedItemDate ? parsedItemDate >= filterStartDate : false;
        });
    }

    // Sort records chronologically (Oldest to Newest from starting period to current)
    dataToPrint.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01').getTime() || 0;
        const dateB = new Date(b.date || '1970-01-01').getTime() || 0;
        return dateA - dateB;
    });

    let reportHTML = '';
    if (selectedFormat === 'format1') {
        reportHTML = generateFormat1HTML(dataToPrint, meta);
    } else {
        reportHTML = generateFormat2HTML(dataToPrint, meta);
    }

    // 1. Inject generated HTML into print container
    printArea.innerHTML = reportHTML;

    // 2. Close the popover modal
    togglePrintPopover();

    // 3. Display print area & launch print preview cleanly
    printArea.style.display = 'block';

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            printArea.style.display = 'none';
        }, 500);
    }, 150);
}
/**
 * Builds HTML report string for Format 1 (Physical Count Card vs Count Balance)
 */
function generateFormat1HTML(items, meta) {
    let grandTotalValue = 0;
    let rowsHTML = '';

    // Add Item Rows directly without subheader breaks
    items.forEach((item) => {
        const qty = parseInt(item.qty, 10) || 1;
        const unitVal = parseFloat(item.unitCost) || 0;
        const totalVal = parseFloat(item.totalCost) || (qty * unitVal);
        grandTotalValue += totalVal;

        const conditionText = sanitizeText(item.remarks || item.condition || 'SERVICEABLE');

        rowsHTML += `
            <tr>
                <td style="border: 1px solid #000; padding: 4px; text-align: left;">${sanitizeText(item.article || '')} ${item.description ? sanitizeText(item.description) : ''}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${sanitizeText(item.date) || '—'}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${sanitizeText(item.propertyNo) || '—'}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${sanitizeText(item.unit) || 'UNIT'}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${qty}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right;">${unitVal.toFixed(2)}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${qty}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right;">${unitVal.toFixed(2)}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right;">${totalVal.toFixed(2)}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: left;">${sanitizeText(item.accountablePerson) || meta.officer}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: left;">${conditionText}</td>
            </tr>
        `;
    });

    return `
        <div style="font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px;">
            <div style="text-align: center; margin-bottom: 15px;">
                <h2 style="font-size: 13px; font-weight: bold; margin: 0 0 3px 0;">REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT</h2>
                <h3 style="font-size: 12px; font-weight: bold; margin: 0 0 2px 0;">${sanitizeText(meta.accountGroup || 'OTHER PROPERTY, PLANT AND EQUIPMENT')}</h3>
                <p style="font-size: 10px; font-style: italic; margin: 0 0 4px 0;">(Type of Property, Plant and Equipment)</p>
                <p style="margin: 0; font-size: 11px;">As of ${sanitizeText(meta.asOfDate)}</p>
            </div>
            
            <div style="margin-bottom: 15px; font-size: 11px; line-height: 1.4;">
                <div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 4px; margin-bottom: 10px;">
                    <span style="padding-top: 2px;">For which</span>

                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="border-bottom: 1px solid #000; font-weight: bold; padding: 0 8px;">${sanitizeText(meta.officer)}</span>
                        <small style="font-size: 8px; color: #000; margin-top: 1px;">(Name of Accountable Officer)</small>
                    </div>,

                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="border-bottom: 1px solid #000; font-weight: bold; padding: 0 8px;">${sanitizeText(meta.designation)}</span>
                        <small style="font-size: 8px; color: #000; margin-top: 1px;">(Official Designation)</small>
                    </div>,

                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="border-bottom: 1px solid #000; font-weight: bold; padding: 0 8px;">Pagbilao, Quezon</span>
                        <small style="font-size: 8px; color: #000; margin-top: 1px;">LGU</small>
                    </div>

                    <span style="padding-top: 2px;">is accountable, having assumed such accountability on</span>

                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="border-bottom: 1px solid #000; font-weight: bold; padding: 0 8px;">${sanitizeText(meta.assumptionDate || 'April 17,2024')}</span>
                        <small style="font-size: 8px; color: #000; margin-top: 1px;">Date of Assumption</small>
                    </div>
                </div>

                <p style="margin: 0; font-weight: bold;">${sanitizeText(meta.fund || 'GENERAL FUND')}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px;">
                <thead>
                    <tr style="background-color: #ffffff; text-align: center;">
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 22%;">ARTICLES/DESCRIPTION</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 8%;">Date Acquired</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 11%;">Property Number</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 6%;">Unit of Measure</th>
                        <th colspan="2" style="border: 1px solid #000; padding: 4px;">Balance per Card</th>
                        <th colspan="2" style="border: 1px solid #000; padding: 4px;">On Hand Per Count</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 9%;">Total Value</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 13%;">Accountable Person</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 11%;">Remarks</th>
                    </tr>
                    <tr style="background-color: #ffffff; text-align: center;">
                        <th style="border: 1px solid #000; padding: 4px; width: 5%;">Quantity</th>
                        <th style="border: 1px solid #000; padding: 4px; width: 5%;">Unit Value</th>
                        <th style="border: 1px solid #000; padding: 4px; width: 5%;">Quantity</th>
                        <th style="border: 1px solid #000; padding: 4px; width: 5%;">Unit Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML.length ? rowsHTML : `<tr><td colspan="11" style="border: 1px solid #000; padding: 14px; text-align: center; font-style: italic;">No inventory records found for period: ${sanitizeText(meta.asOfDate)} - Present.</td></tr>`}
                    
                    <tr>
                        <td colspan="8" style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: left;">Grand total</td>
                        <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: right;">${grandTotalValue.toFixed(2)}</td>
                        <td style="border: 1px solid #000; padding: 6px;"></td>
                        <td style="border: 1px solid #000; padding: 6px;"></td>
                    </tr>
                </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; text-align: center; font-size: 10px;">
                <div style="width: 30%;">
                    <p style="margin: 0 0 30px 0; text-align: left; font-weight: bold;">PREPARED BY:</p>
                    <div style="border-bottom: 1px solid #000; padding-bottom: 2px; font-weight: bold;">ERROLD JAMES J. DIGUIDIG</div>
                    <div style="margin-top: 2px;">RCCI</div>
                </div>
                <div style="width: 30%;">
                    <p style="margin: 0 0 30px 0; text-align: left; font-weight: bold;">RECOMMENDING APPROVAL:</p>
                    <div style="border-bottom: 1px solid #000; padding-bottom: 2px; font-weight: bold;">${sanitizeText(meta.officer)}</div>
                    <div style="margin-top: 2px;">${sanitizeText(meta.designation)}</div>
                </div>
                <div style="width: 30%;">
                    <p style="margin: 0 0 30px 0; text-align: left; font-weight: bold;">NOTED BY:</p>
                    <div style="border-bottom: 1px solid #000; padding-bottom: 2px; font-weight: bold;">ANGELICA P. TATLONGHARI</div>
                    <div style="margin-top: 2px;">Municipal Mayor</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Builds HTML report string for Format 2 (Equipment, Furniture & Location)
 */
function generateFormat2HTML(items, meta) {
    let rowsHTML = items.map((item) => {
        const costVal = parseFloat(item.unitCost) || parseFloat(item.totalCost) || 0;

        return `
            <tr>
                <td style="border: 1px solid #000; padding: 6px; text-align: left;">${sanitizeText(item.article) || '—'}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: left;">${sanitizeText(item.description) || '—'}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${sanitizeText(item.propertyNo) || '—'}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">₱${costVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: left;">${sanitizeText(item.location) || '—'}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: left;">${sanitizeText(item.accountablePerson) || meta.officer}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${sanitizeText(item.condition) || 'SERVICEABLE'}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: left;">${sanitizeText(item.remarks) || '—'}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${sanitizeText(item.account) || 'OFFICE EQUIPMENT'}</td>
            </tr>
        `;
    }).join('');

    return `
        <div style="font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="font-size: 14px; margin: 0 0 5px 0;">REPORT ON THE PHYSICAL COUNT OF EQUIPMENT, FURNITURES AND FIXTURES, AND OTHER PPE</h2>
                <p style="margin: 0;"><strong>OFFICE EQUIPMENT</strong><br>As of ${sanitizeText(meta.asOfDate)}</p>
            </div>
            
            <div style="margin-bottom: 20px; font-size: 11px; line-height: 1.2;">
                <p style="margin: 0 0 10px 0;"><strong>Fund Cluster:</strong> ${sanitizeText(meta.fund)}</p>
                
                <div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 6px;">
                    <span style="align-self: flex-start; padding-top: 2px;">For which</span>

                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="border-bottom: 1px solid #000; font-weight: bold; padding: 0 10px;">${sanitizeText(meta.officer)}</span>
                        <small style="font-size: 8px; color: #333; margin-top: 2px;">(Name of Accountable Officer)</small>
                    </div>,

                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="border-bottom: 1px solid #000; font-weight: bold; padding: 0 10px;">${sanitizeText(meta.designation)}</span>
                        <small style="font-size: 8px; color: #333; margin-top: 2px;">(Official Designation)</small>
                    </div>,

                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="border-bottom: 1px solid #000; font-weight: bold; padding: 0 10px;">Pagbilao, Quezon</span>
                        <small style="font-size: 8px; color: #333; margin-top: 2px;">LGU</small>
                    </div>

                    <span style="align-self: flex-start; padding-top: 2px;">is accountable.</span>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #f2f2f2; text-align: center;">
                        <th style="border: 1px solid #000; padding: 6px;">ARTICLE</th>
                        <th style="border: 1px solid #000; padding: 6px;">DESCRIPTION</th>
                        <th style="border: 1px solid #000; padding: 6px;">PROPERTY NO.</th>
                        <th style="border: 1px solid #000; padding: 6px;">COST</th>
                        <th style="border: 1px solid #000; padding: 6px;">LOCATION</th>
                        <th style="border: 1px solid #000; padding: 6px;">ACCOUNTABLE PERSON</th>
                        <th style="border: 1px solid #000; padding: 6px;">CONDITION</th>
                        <th style="border: 1px solid #000; padding: 6px;">REMARKS</th>
                        <th style="border: 1px solid #000; padding: 6px;">ACCOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML.length ? rowsHTML : `<tr><td colspan="9" style="border: 1px solid #000; padding: 14px; text-align: center; font-style: italic;">No inventory records found for period: ${sanitizeText(meta.asOfDate)} - Present.</td></tr>`}
                </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; text-align: center; font-size: 10px;">
                <div style="width: 22%;">
                    <p style="margin: 0 0 30px 0; text-align: left; font-weight: bold;">PREPARED BY:</p>
                    <div style="border-bottom: 1px solid #000; padding-bottom: 2px; font-weight: bold;">ERROLD JAMES J. DIGUIDIG</div>
                    <div style="margin-top: 2px;">RCCI</div>
                </div>
                <div style="width: 22%;">
                    <p style="margin: 0 0 30px 0; text-align: left; font-weight: bold;">CERTIFIED CORRECT:</p>
                    <div style="border-bottom: 1px solid #000; padding-bottom: 2px; font-weight: bold;">${sanitizeText(meta.officer)}</div>
                    <div style="margin-top: 2px;">${sanitizeText(meta.designation)}</div>
                </div>
                <div style="width: 22%;">
                    <p style="margin: 0 0 30px 0; text-align: left; font-weight: bold;">NOTED BY:</p>
                    <div style="border-bottom: 1px solid #000; padding-bottom: 2px; font-weight: bold;">ANGELICA P. TATLONGHARI</div>
                    <div style="margin-top: 2px;">Municipal Mayor</div>
                </div>
                <div style="width: 22%;">
                    <p style="margin: 0 0 30px 0; text-align: left; font-weight: bold;">VERIFIED BY:</p>
                    <div style="border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 14px;"></div>
                    <div style="margin-top: 2px;">COA Representative</div>
                </div>
            </div>
        </div>
    `;
}

// =========================================================================
// VIEW ROUTING, HOMEPAGE & ANALYTICS MODULE (ADMIN ONLY)
// =========================================================================

let activeAdminView = 'home'; // 'home' | 'masterlist' | 'analytics'
let conditionChartInstance = null;
let categoryValuationChartInstance = null;
let lifecycleAgingChartInstance = null;
let departmentAllocationChartInstance = null;

/**
 * Switches the active Admin view between Home, Masterlist Table, and Analytics Dashboard.
 * @param {'home'|'masterlist'|'analytics'} viewName 
 */
window.switchAdminView = function(viewName) {
    activeAdminView = viewName;
    const homeView = document.getElementById('home-view');
    const masterlistView = document.getElementById('masterlist-view');
    const analyticsView = document.getElementById('analytics-view');

    // Update active class on sidebar buttons
    const homeBtn = document.getElementById('sidebar-home-btn');
    const masterlistBtn = document.getElementById('sidebar-masterlist-btn');
    const analyticsBtn = document.getElementById('sidebar-analytics-btn');
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    const darkModeDivider = document.getElementById('dark-mode-divider');

    if (homeBtn) homeBtn.classList.toggle('active', viewName === 'home');
    if (masterlistBtn) masterlistBtn.classList.toggle('active', viewName === 'masterlist');
    if (analyticsBtn) analyticsBtn.classList.toggle('active', viewName === 'analytics');

    // Dark Mode toggle smoothly appears only when in the Masterlist interface
    const isMasterlist = (viewName === 'masterlist');
    if (darkModeBtn) {
        darkModeBtn.style.display = '';
        darkModeBtn.classList.toggle('theme-toggle-hidden', !isMasterlist);
    }
    if (darkModeDivider) {
        darkModeDivider.style.display = '';
        darkModeDivider.classList.toggle('theme-toggle-hidden', !isMasterlist);
    }

    // Hide all views first
    if (homeView) homeView.classList.add('hidden');
    if (masterlistView) masterlistView.classList.add('hidden');
    if (analyticsView) analyticsView.classList.add('hidden');

    if (viewName === 'analytics') {
        if (analyticsView) analyticsView.classList.remove('hidden');
        setTimeout(() => {
            renderAnalyticsDashboard();
        }, 30);
    } else if (viewName === 'masterlist') {
        if (masterlistView) masterlistView.classList.remove('hidden');
        setTimeout(() => {
            renderTable();
        }, 30);
    } else {
        // Default to Home View
        if (homeView) homeView.classList.remove('hidden');
        setTimeout(() => {
            renderHomeDashboard();
        }, 30);
    }
};

/**
 * Renders executive overview numbers on the Admin Homepage.
 */
window.renderHomeDashboard = function() {
    const homeTotalArticlesEl = document.getElementById('home-stat-total-articles');
    const homeServiceableEl = document.getElementById('home-stat-serviceable');
    const homeAlertsEl = document.getElementById('home-stat-alerts');
    const homeValuationEl = document.getElementById('home-stat-valuation');

    const totalArticles = inventoryData.length;
    const serviceableCount = inventoryData.filter(item => (item.condition || '').toUpperCase() === 'SERVICEABLE').length;
    const alertsCount = inventoryData.filter(item => {
        const cond = (item.condition || '').toUpperCase();
        return cond === 'UNSERVICEABLE' || cond === 'FOR DISPOSAL' || cond === 'DISPOSED' || cond.includes('REPAIR');
    }).length;

    const totalValuation = inventoryData.reduce((sum, item) => {
        const qtyVal = parseInt(item.qty, 10) || 1;
        const unitCostVal = parseFloat(item.unitCost) || 0;
        return sum + (parseFloat(item.totalCost) || (qtyVal * unitCostVal));
    }, 0);

    if (homeTotalArticlesEl) homeTotalArticlesEl.textContent = totalArticles.toLocaleString();
    if (homeServiceableEl) homeServiceableEl.textContent = serviceableCount.toLocaleString();
    if (homeAlertsEl) homeAlertsEl.textContent = alertsCount.toLocaleString();
    if (homeValuationEl) homeValuationEl.textContent = `₱${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};

/**
 * Parses an acquisition date string and calculates the item's age in years.
 * @param {string} dateStr 
 * @returns {number} Age in years (fractional or 0)
 */
function calculateItemAge(dateStr) {
    if (!dateStr) return 0;
    try {
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
            // Attempt to match 4 digit year
            const yearMatch = String(dateStr).match(/\b(19\d\d|20\d\d)\b/);
            if (yearMatch) {
                const year = parseInt(yearMatch[1], 10);
                return Math.max(0, new Date().getFullYear() - year);
            }
            return 0;
        }
        const diffMs = Date.now() - parsedDate.getTime();
        return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 365.25));
    } catch (e) {
        return 0;
    }
}

/**
 * Aggregates data and renders the complete Analytics & Predictive Insights Dashboard.
 */
window.renderAnalyticsDashboard = function() {
    if (activeAdminView !== 'analytics') return;
    const totalValuationEl = document.getElementById('kpi-total-valuation');
    const serviceableRateEl = document.getElementById('kpi-serviceable-rate');
    const serviceableRatioEl = document.getElementById('kpi-serviceable-ratio');
    const repairAlertsEl = document.getElementById('kpi-repair-alerts');
    const replacementBudgetEl = document.getElementById('kpi-replacement-budget');
    const advisoryTableBody = document.getElementById('advisory-table-body');

    const totalArticles = inventoryData.length;

    // 1. Compute Executive Metrics
    let totalValuation = 0;
    let serviceableCount = 0;
    let unserviceableCount = 0;
    let needsRepairCount = 0;
    let replacementBudget = 0;

    const conditionCounts = {
        'Serviceable': 0,
        'Needs Repair': 0,
        'Unserviceable': 0,
        'For Disposal': 0,
        'Other': 0
    };

    const categoryValuations = {};
    const categoryCounts = {};
    const departmentCounts = {};
    const lifecycleBuckets = {
        '< 1 Year (New)': 0,
        '1 - 3 Years (Optimal)': 0,
        '3 - 5 Years (Mid-Life)': 0,
        '5+ Years (Aging / EOL)': 0
    };

    const advisoryItems = [];

    inventoryData.forEach(item => {
        const qtyVal = parseInt(item.qty, 10) || 1;
        const unitCostVal = parseFloat(item.unitCost) || 0;
        const computedTotalCost = parseFloat(item.totalCost) || (qtyVal * unitCostVal);
        totalValuation += computedTotalCost;

        const condStr = (item.condition || '').trim();
        const condUpper = condStr.toUpperCase();

        // Categorize Condition
        if (condUpper === 'SERVICEABLE') {
            serviceableCount++;
            conditionCounts['Serviceable']++;
        } else if (condUpper.includes('REPAIR') || condUpper === 'NEEDS REPAIR') {
            needsRepairCount++;
            conditionCounts['Needs Repair']++;
            replacementBudget += (unitCostVal * qtyVal);
        } else if (condUpper === 'UNSERVICEABLE') {
            unserviceableCount++;
            conditionCounts['Unserviceable']++;
            replacementBudget += (unitCostVal * qtyVal);
        } else if (condUpper === 'FOR DISPOSAL' || condUpper === 'DISPOSED') {
            unserviceableCount++;
            conditionCounts['For Disposal']++;
            replacementBudget += (unitCostVal * qtyVal);
        } else {
            conditionCounts['Other']++;
        }

        // Account / Category Aggregation
        const accGroup = (item.account && item.account.trim() !== '') ? item.account.trim() : 'Other Equipment';
        categoryValuations[accGroup] = (categoryValuations[accGroup] || 0) + computedTotalCost;
        categoryCounts[accGroup] = (categoryCounts[accGroup] || 0) + qtyVal;

        // Department Allocation Aggregation
        const dept = (item.location && item.location.trim() !== '') ? item.location.trim() : 'GSO Warehouse / Unassigned';
        departmentCounts[dept] = (departmentCounts[dept] || 0) + qtyVal;

        // Predictive Lifecycle & Age Calculation
        const ageYears = calculateItemAge(item.date);
        if (ageYears < 1) {
            lifecycleBuckets['< 1 Year (New)']++;
        } else if (ageYears <= 3) {
            lifecycleBuckets['1 - 3 Years (Optimal)']++;
        } else if (ageYears <= 5) {
            lifecycleBuckets['3 - 5 Years (Mid-Life)']++;
        } else {
            lifecycleBuckets['5+ Years (Aging / EOL)']++;
            // If aging and not yet accounted in repair budget, add to forecasted replacement plan
            if (condUpper === 'SERVICEABLE') {
                replacementBudget += (unitCostVal * 0.5 * qtyVal); // 50% replacement allocation
            }
        }

        // Check for Predictive Maintenance / Replacement Advisory Table
        let priority = null;
        let actionText = null;
        let actionClass = null;

        if (condUpper === 'UNSERVICEABLE' || condUpper === 'FOR DISPOSAL' || condUpper === 'DISPOSED') {
            priority = 'HIGH';
            actionText = 'Budget for Disposal & Replacement';
            actionClass = 'action-replace';
        } else if (condUpper.includes('REPAIR') || condUpper === 'NEEDS REPAIR') {
            priority = 'HIGH';
            actionText = 'Schedule Immediate GSO Servicing';
            actionClass = 'action-repair';
        } else if (ageYears >= 5) {
            priority = 'MEDIUM';
            actionText = 'Lifecycle Assessment & Budget Plan';
            actionClass = 'action-replace';
        } else if (ageYears >= 3.5) {
            priority = 'LOW';
            actionText = 'Preventive Maintenance Inspection';
            actionClass = 'action-inspect';
        }

        if (priority) {
            advisoryItems.push({
                priority: priority,
                propertyNo: item.propertyNo || '—',
                article: item.article || 'Unnamed Item',
                description: item.description || '—',
                location: dept,
                condition: item.condition || 'N/A',
                age: ageYears > 0 ? `${ageYears.toFixed(1)} yrs` : 'Unknown',
                unitCost: unitCostVal,
                actionText: actionText,
                actionClass: actionClass
            });
        }
    });

    // Update KPI Card UI Elements with smooth number counting animation
    const serviceableRate = totalArticles > 0 ? Math.round((serviceableCount / totalArticles) * 100) : 0;
    const totalRepairAlerts = needsRepairCount + unserviceableCount;

    function animateNumberValue(el, targetNum, isCurrency = false, isPercent = false, duration = 800) {
        if (!el) return;
        const start = performance.now();
        function frame(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = targetNum * ease;
            if (isCurrency) {
                el.textContent = `₱${current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            } else if (isPercent) {
                el.textContent = `${Math.round(current)}%`;
            } else {
                el.textContent = Math.round(current).toLocaleString('en-US');
            }
            if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    if (totalValuationEl) animateNumberValue(totalValuationEl, totalValuation, true, false, 850);
    if (serviceableRateEl) animateNumberValue(serviceableRateEl, serviceableRate, false, true, 850);
    if (serviceableRatioEl) {
        serviceableRatioEl.innerHTML = `<i class="fas fa-check-circle text-success"></i> ${serviceableCount} of ${totalArticles} articles operational`;
    }
    if (repairAlertsEl) animateNumberValue(repairAlertsEl, totalRepairAlerts, false, false, 750);
    if (replacementBudgetEl) animateNumberValue(replacementBudgetEl, replacementBudget, true, false, 850);

    // 2. Render Chart.js Visualizations (Safely checking Chart availability)
    if (typeof Chart !== 'undefined') {
        renderConditionDoughnutChart(conditionCounts);
        renderCategoryValuationChart(categoryValuations);
        renderLifecycleAgingChart(lifecycleBuckets);
        renderDepartmentAllocationChart(departmentCounts);
    }

    // 3. Render Advisory Matrix Table
    if (advisoryTableBody) {
        advisoryTableBody.innerHTML = '';

        if (advisoryItems.length === 0) {
            advisoryTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #4ade80; padding: 24px; font-weight: 600;">
                        <i class="fas fa-circle-check" style="font-size: 18px; margin-right: 6px;"></i>
                        All inventory items are currently in optimal operating condition. No immediate repair or replacement alerts.
                    </td>
                </tr>
            `;
            return;
        }

        // Sort advisory: HIGH priority first, then MEDIUM, then LOW
        const priorityOrder = { 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
        advisoryItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        const fragment = document.createDocumentFragment();
        advisoryItems.slice(0, 15).forEach(adv => {
            const tr = document.createElement('tr');
            let priorityBadge = `<span class="priority-badge priority-low"><i class="fas fa-info-circle"></i> Low</span>`;
            if (adv.priority === 'HIGH') priorityBadge = `<span class="priority-badge priority-high"><i class="fas fa-exclamation-triangle"></i> High</span>`;
            if (adv.priority === 'MEDIUM') priorityBadge = `<span class="priority-badge priority-medium"><i class="fas fa-clock"></i> Medium</span>`;

            tr.innerHTML = `
                <td>${priorityBadge}</td>
                <td class="font-bold text-muted">${sanitizeText(adv.propertyNo)}</td>
                <td>
                    <div style="font-weight: 700; color: #f8fafc;">${sanitizeText(adv.article)}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${sanitizeText(adv.description)}</div>
                </td>
                <td>${sanitizeText(adv.location)}</td>
                <td><span style="font-weight: 600; color: #f1f5f9;">${sanitizeText(adv.condition)}</span></td>
                <td>${sanitizeText(adv.age)}</td>
                <td style="font-weight: 600;">₱${adv.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td>
                    <button type="button" onclick="inspectAdvisoryItem('${sanitizeText(adv.propertyNo)}')" class="action-tag ${adv.actionClass}" style="cursor: pointer; border: none; font-family: inherit; transition: all 0.2s ease;" title="Click to view and inspect this item in Masterlist">
                        <i class="fas fa-search-plus"></i> ${adv.actionText}
                    </button>
                </td>
            `;
            fragment.appendChild(tr);
        });

        advisoryTableBody.appendChild(fragment);
    }
};

window.inspectAdvisoryItem = function(propertyNo) {
    if (!propertyNo || propertyNo === '—' || propertyNo === '-') return;
    switchAdminView('masterlist');
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = propertyNo;
        currentPage = 1;
        renderTable();
    }
};

/**
 * Helper to ensure a fresh, unpolluted Canvas DOM element for smooth Chart.js animations.
 */
function getFreshCanvas(canvasId) {
    const oldCanvas = document.getElementById(canvasId);
    if (!oldCanvas) return null;
    const newCanvas = document.createElement('canvas');
    newCanvas.id = canvasId;
    if (oldCanvas.parentNode) {
        oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
    }
    return newCanvas;
}

/**
 * Chart 1: Equipment Condition & Serviceability Breakdown (Doughnut Chart)
 */
function renderConditionDoughnutChart(counts) {
    if (conditionChartInstance) {
        conditionChartInstance.destroy();
        conditionChartInstance = null;
    }

    const ctx = getFreshCanvas('conditionDoughnutChart');
    if (!ctx) return;

    const labels = Object.keys(counts).filter(k => counts[k] > 0);
    const data = labels.map(k => counts[k]);

    const colorMap = {
        'Serviceable': '#22c55e',
        'Needs Repair': '#f59e0b',
        'Unserviceable': '#ef4444',
        'For Disposal': '#dc2626',
        'Other': '#64748b'
    };

    const backgroundColors = labels.map(l => colorMap[l] || '#38bdf8');

    conditionChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                data: data.length ? data : [1],
                backgroundColor: backgroundColors.length ? backgroundColors : ['#334155'],
                borderWidth: 2,
                borderColor: '#121a2b',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 100,
            cutout: '68%',
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 800,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#cbd5e1',
                        font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
                        padding: 14,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10
                }
            }
        }
    });
}

/**
 * Chart 2: Account Group Valuation in ₱ (Bar Chart)
 */
function renderCategoryValuationChart(valuations) {
    if (categoryValuationChartInstance) {
        categoryValuationChartInstance.destroy();
        categoryValuationChartInstance = null;
    }

    const ctx = getFreshCanvas('categoryValuationChart');
    if (!ctx) return;

    const labels = Object.keys(valuations);
    const data = labels.map(k => valuations[k]);

    categoryValuationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Total Value (₱)',
                data: data.length ? data : [0],
                backgroundColor: 'rgba(56, 189, 248, 0.65)',
                borderColor: '#38bdf8',
                borderWidth: 1.5,
                borderRadius: 6,
                maxBarThickness: 45
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 100,
            animation: {
                duration: 750,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            return ` Value: ₱${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    min: 0,
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Plus Jakarta Sans', size: 10 },
                        callback: function(value) {
                            if (value >= 1000000) return '₱' + (value / 1000000).toFixed(1) + 'M';
                            if (value >= 1000) return '₱' + (value / 1000).toFixed(0) + 'K';
                            return '₱' + value;
                        }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
}

/**
 * Chart 3: Predictive Equipment Aging & Lifecycle Distribution (Bar Chart)
 */
function renderLifecycleAgingChart(buckets) {
    if (lifecycleAgingChartInstance) {
        lifecycleAgingChartInstance.destroy();
        lifecycleAgingChartInstance = null;
    }

    const ctx = getFreshCanvas('lifecycleAgingChart');
    if (!ctx) return;

    const labels = Object.keys(buckets);
    const data = labels.map(k => buckets[k]);

    lifecycleAgingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Equipment Count',
                data: data,
                backgroundColor: [
                    'rgba(34, 197, 94, 0.65)',
                    'rgba(56, 189, 248, 0.65)',
                    'rgba(245, 158, 11, 0.65)',
                    'rgba(239, 68, 68, 0.65)'
                ],
                borderColor: [
                    '#22c55e',
                    '#38bdf8',
                    '#f59e0b',
                    '#ef4444'
                ],
                borderWidth: 1.5,
                borderRadius: 6,
                maxBarThickness: 45
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 100,
            animation: {
                duration: 750,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.raw} items in this lifecycle stage`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    min: 0,
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 }, stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
}

/**
 * Chart 4: Department Asset Allocation (Horizontal Bar Chart)
 */
function renderDepartmentAllocationChart(departments) {
    if (departmentAllocationChartInstance) {
        departmentAllocationChartInstance.destroy();
        departmentAllocationChartInstance = null;
    }

    const ctx = getFreshCanvas('departmentAllocationChart');
    if (!ctx) return;

    const sortedDepts = Object.keys(departments).sort((a, b) => departments[b] - departments[a]).slice(0, 6);
    const data = sortedDepts.map(d => departments[d]);

    departmentAllocationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedDepts.length ? sortedDepts : ['No Department Assigned'],
            datasets: [{
                label: 'Quantity Assigned',
                data: data.length ? data : [0],
                backgroundColor: 'rgba(129, 140, 248, 0.65)',
                borderColor: '#818cf8',
                borderWidth: 1.5,
                borderRadius: 6,
                maxBarThickness: 24
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 100,
            animation: {
                duration: 750,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.raw} units allocated`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    min: 0,
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 }, stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    ticks: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 10.5, weight: '600' } },
                    grid: { display: false }
                }
            }
        }
    });
}

