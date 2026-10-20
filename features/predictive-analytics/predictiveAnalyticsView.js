/**
 * =========================================================================
 * PREDICTIVE ANALYTICS VIEW CONTROLLER
 * Module: features/predictive-analytics/predictiveAnalyticsView.js
 * 
 * Objective:
 * Renders and controls the modular Predictive Lifespan Dashboard:
 * - 4 High-Level KPI Cards
 * - Degradation Curve with 80% & 95% Confidence Intervals
 * - Risk Distribution Breakdown Chart
 * - Time-to-Failure Gantt Timeline
 * - Searchable & Filterable Deep-Dive Equipment Table
 * - Explainable AI (XAI) Feature Importance Quick Drawer
 * =========================================================================
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['Chart', './predictiveAnalyticsService'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('chart.js'), require('./predictiveAnalyticsService'));
    } else {
        root.PredictiveAnalyticsModule = factory(root.Chart, root.PredictiveAnalyticsService);
    }
}(typeof self !== 'undefined' ? self : this, function (Chart, service) {
    'use strict';

    let degradationChartInstance = null;
    let riskChartInstance = null;
    let activeEquipmentId = "EQ-8801";
    let activeRiskFilter = "ALL";
    let activeCategoryFilter = "ALL";
    let searchQuery = "";
    let mountContainer = null;

    /**
     * Helper to format currency in PHP (₱).
     */
    function formatPHP(amount) {
        return '₱' + Number(amount || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Builds the complete dashboard template.
     */
    function buildDashboardTemplate() {
        return `
        <div class="pa-dashboard-container" id="pa-dashboard-root">
            <!-- Header Section -->
            <header class="pa-header">
                <div class="pa-header-title-box">
                    <div class="pa-header-icon">
                        <i class="fas fa-brain"></i>
                    </div>
                    <div>
                        <h2 class="pa-header-title">
                            Predictive Lifespan & Telemetry
                            <span class="pa-header-badge">ML Active</span>
                        </h2>
                        <p class="pa-header-subtitle">
                            Continuous remaining useful life (RUL) modeling, failure risk tiering, and prescriptive maintenance windows.
                        </p>
                    </div>
                </div>
                <div class="pa-header-actions">
                    <button type="button" class="pa-btn" id="pa-refresh-btn" title="Refresh Telemetry">
                        <i class="fas fa-arrows-rotate"></i> Sync Telemetry
                    </button>
                    <button type="button" class="pa-btn pa-btn-primary" id="pa-export-report-btn" title="Export Prognostics Report">
                        <i class="fas fa-file-waveform"></i> Prognostics Report
                    </button>
                </div>
            </header>

            <!-- 1. High-Level Metrics (4 KPI Cards) -->
            <section class="pa-kpi-grid">
                <!-- Fleet Health Index / Avg RUL -->
                <div class="pa-kpi-card pa-kpi-card-health">
                    <div class="pa-kpi-top">
                        <span class="pa-kpi-label">Fleet Health Index</span>
                        <div class="pa-kpi-icon-pill"><i class="fas fa-shield-heart"></i></div>
                    </div>
                    <div class="pa-kpi-value-row">
                        <span class="pa-kpi-value" id="pa-kpi-health-index">--%</span>
                        <span class="pa-kpi-badge pa-badge-green" id="pa-kpi-rul-badge">Avg RUL: -- mo</span>
                    </div>
                    <p class="pa-kpi-subtext" id="pa-kpi-health-sub">Fleet operational viability score</p>
                </div>

                <!-- High-Risk Equipment Count (<= 30 Days) -->
                <div class="pa-kpi-card pa-kpi-card-risk">
                    <div class="pa-kpi-top">
                        <span class="pa-kpi-label">High-Risk Equipment</span>
                        <div class="pa-kpi-icon-pill"><i class="fas fa-triangle-exclamation"></i></div>
                    </div>
                    <div class="pa-kpi-value-row">
                        <span class="pa-kpi-value text-danger" id="pa-kpi-high-risk-count">0</span>
                        <span class="pa-kpi-badge pa-badge-red">&le; 30 Days to Fail</span>
                    </div>
                    <p class="pa-kpi-subtext">Immediate overhaul required to prevent shutdown</p>
                </div>

                <!-- Scheduled vs Predicted Backlog -->
                <div class="pa-kpi-card pa-kpi-card-backlog">
                    <div class="pa-kpi-top">
                        <span class="pa-kpi-label">Maintenance Backlog</span>
                        <div class="pa-kpi-icon-pill"><i class="fas fa-clock-rotate-left"></i></div>
                    </div>
                    <div class="pa-kpi-value-row">
                        <span class="pa-kpi-value" id="pa-kpi-backlog-ratio">0 / 0</span>
                        <span class="pa-kpi-badge pa-badge-amber" id="pa-kpi-backlog-gap">0 Unaddressed</span>
                    </div>
                    <p class="pa-kpi-subtext">Scheduled work orders vs. ML predicted needs</p>
                </div>

                <!-- Potential Cost Avoidance -->
                <div class="pa-kpi-card pa-kpi-card-savings">
                    <div class="pa-kpi-top">
                        <span class="pa-kpi-label">Potential Cost Avoidance</span>
                        <div class="pa-kpi-icon-pill"><i class="fas fa-piggy-bank"></i></div>
                    </div>
                    <div class="pa-kpi-value-row">
                        <span class="pa-kpi-value" id="pa-kpi-cost-avoidance">₱0.00</span>
                        <span class="pa-kpi-badge pa-badge-blue">Net Savings</span>
                    </div>
                    <p class="pa-kpi-subtext">Proactive maintenance vs. catastrophic failures</p>
                </div>
            </section>

            <!-- 2. Predictive Visualizations Grid -->
            <section class="pa-visuals-grid">
                <!-- Visual 1: Degradation Curve with Confidence Intervals -->
                <div class="pa-card">
                    <div class="pa-card-header">
                        <div class="pa-card-title-group">
                            <h4><i class="fas fa-chart-line" style="color: #38bdf8;"></i> Asset Lifespan Degradation Curve</h4>
                            <p>Historical degradation alongside predicted RUL trajectory with 80% &amp; 95% confidence intervals</p>
                        </div>
                        <div class="pa-card-controls">
                            <label for="pa-asset-selector" style="font-size: 11px; color: #94a3b8; font-weight: 600;">Equipment:</label>
                            <select id="pa-asset-selector" class="pa-select">
                                <!-- Populated dynamically -->
                            </select>
                        </div>
                    </div>
                    <div class="pa-chart-wrapper">
                        <canvas id="pa-degradation-canvas"></canvas>
                    </div>
                    <div class="pa-ci-legend">
                        <div class="pa-ci-item">
                            <span class="pa-ci-dot" style="background: #38bdf8;"></span>
                            <span>Historical Telemetry</span>
                        </div>
                        <div class="pa-ci-item">
                            <span class="pa-ci-dot" style="background: #ef4444;"></span>
                            <span>Predicted RUL</span>
                        </div>
                        <div class="pa-ci-item">
                            <span class="pa-ci-dot" style="background: rgba(245, 158, 11, 0.4);"></span>
                            <span>80% CI</span>
                        </div>
                        <div class="pa-ci-item">
                            <span class="pa-ci-dot" style="background: rgba(239, 68, 68, 0.25);"></span>
                            <span>95% CI</span>
                        </div>
                        <div class="pa-ci-item">
                            <span class="pa-ci-dot" style="border: 1px dashed #94a3b8; background: transparent;"></span>
                            <span>Critical Threshold (20%)</span>
                        </div>
                    </div>
                </div>

                <!-- Visual 2: Risk Distribution Breakdown -->
                <div class="pa-card">
                    <div class="pa-card-header">
                        <div class="pa-card-title-group">
                            <h4><i class="fas fa-chart-pie" style="color: #10b981;"></i> Risk Distribution Breakdown</h4>
                            <p>Fleet visual tiering by failure probability</p>
                        </div>
                    </div>
                    <div class="pa-chart-wrapper">
                        <canvas id="pa-risk-canvas"></canvas>
                    </div>
                </div>
            </section>

            <!-- Visual 3: Time-to-Failure Timeline (Gantt View) -->
            <section class="pa-card pa-timeline-card">
                <div class="pa-card-header">
                    <div class="pa-card-title-group">
                        <h4><i class="fas fa-timeline" style="color: #f59e0b;"></i> Time-to-Failure Horizon &amp; Maintenance Timeline</h4>
                        <p>Predicted end-of-life and overhaul deadlines grouped by operational horizon</p>
                    </div>
                </div>
                <div class="pa-timeline-buckets-grid" id="pa-timeline-container">
                    <!-- Populated dynamically -->
                </div>
            </section>

            <!-- 3. Equipment Deep-Dive / Detail Table -->
            <section class="pa-card pa-table-section">
                <div class="pa-card-header">
                    <div class="pa-card-title-group">
                        <h4><i class="fas fa-microchip" style="color: #38bdf8;"></i> Equipment Telemetry Deep-Dive</h4>
                        <p>Real-time operating telemetry, wear level indicators, and ML-recommended actions</p>
                    </div>
                </div>

                <!-- Toolbar (Search & Filter Pills) -->
                <div class="pa-table-toolbar">
                    <div class="pa-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="pa-table-search" class="pa-search-input" placeholder="Search equipment by ID, name, or location...">
                    </div>
                    <div class="pa-filter-pills" id="pa-risk-filter-pills">
                        <button type="button" class="pa-filter-pill active" data-risk="ALL">All Risk Tiers</button>
                        <button type="button" class="pa-filter-pill pill-critical" data-risk="Critical">Critical (&le; 30d)</button>
                        <button type="button" class="pa-filter-pill pill-watchlist" data-risk="Watchlist">Watchlist (31-90d)</button>
                        <button type="button" class="pa-filter-pill pill-normal" data-risk="Normal">Normal (&gt; 90d)</button>
                    </div>
                </div>

                <!-- Table Container -->
                <div class="pa-table-responsive">
                    <table class="pa-table">
                        <thead>
                            <tr>
                                <th>Equipment ID</th>
                                <th>Name &amp; Description</th>
                                <th>Category</th>
                                <th>Operating Telemetry</th>
                                <th>Wear Level</th>
                                <th>Predicted Failure</th>
                                <th>Risk Badge</th>
                                <th>Recommended Action</th>
                                <th>Explainability</th>
                            </tr>
                        </thead>
                        <tbody id="pa-table-body">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </section>
        </div>

        <!-- 4. Feature Importance (Explainable AI / XAI) Quick Drawer -->
        <div class="pa-drawer-backdrop" id="pa-drawer-backdrop"></div>
        <aside class="pa-drawer" id="pa-drawer">
            <div class="pa-drawer-header">
                <div>
                    <h3 class="pa-drawer-header-title" id="pa-drawer-title">Equipment ML Diagnostic</h3>
                    <p class="pa-drawer-header-sub" id="pa-drawer-subtitle">Feature importance &amp; root cause drivers</p>
                </div>
                <button type="button" class="pa-drawer-close" id="pa-drawer-close-btn" title="Close Drawer">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="pa-drawer-body" id="pa-drawer-body">
                <!-- Populated dynamically -->
            </div>
        </aside>
        `;
    }

    /**
     * Initializes the KPI Cards.
     */
    function renderKPIs() {
        const kpis = service.getFleetOverviewKPIs();
        
        const healthEl = document.getElementById('pa-kpi-health-index');
        const rulBadge = document.getElementById('pa-kpi-rul-badge');
        const highRiskEl = document.getElementById('pa-kpi-high-risk-count');
        const backlogRatioEl = document.getElementById('pa-kpi-backlog-ratio');
        const backlogGapEl = document.getElementById('pa-kpi-backlog-gap');
        const costAvoidanceEl = document.getElementById('pa-kpi-cost-avoidance');

        if (healthEl) healthEl.textContent = `${kpis.fleetHealthIndex}%`;
        if (rulBadge) rulBadge.textContent = `Avg RUL: ${kpis.avgRulMonths} mo (${kpis.avgRulDays}d)`;
        if (highRiskEl) highRiskEl.textContent = kpis.highRiskCount;
        if (backlogRatioEl) backlogRatioEl.textContent = `${kpis.scheduledMaintenanceCount} / ${kpis.predictedMaintenanceNeeded}`;
        if (backlogGapEl) backlogGapEl.textContent = `${kpis.maintenanceBacklogGap} Unaddressed Gap`;
        if (costAvoidanceEl) costAvoidanceEl.textContent = formatPHP(kpis.totalCostAvoidance);
    }

    /**
     * Renders Predictive Visualization 1: Asset Lifespan Degradation Curve.
     */
    function renderDegradationChart(equipmentId) {
        if (!Chart) return;
        const canvas = document.getElementById('pa-degradation-canvas');
        if (!canvas) return;

        const data = service.getDegradationCurveData(equipmentId);

        if (degradationChartInstance) {
            degradationChartInstance.destroy();
            degradationChartInstance = null;
        }

        const ctx = canvas.getContext('2d');
        degradationChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    // 1. 95% Confidence Interval Upper
                    {
                        label: '95% CI Upper',
                        data: data.ci95Upper,
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        fill: '+1', // Fill down to 95% lower
                        pointRadius: 0,
                        tension: 0.35
                    },
                    // 2. 95% Confidence Interval Lower
                    {
                        label: '95% CI Lower',
                        data: data.ci95Lower,
                        borderColor: 'transparent',
                        backgroundColor: 'transparent',
                        fill: false,
                        pointRadius: 0,
                        tension: 0.35
                    },
                    // 3. 80% Confidence Interval Upper
                    {
                        label: '80% CI Upper',
                        data: data.ci80Upper,
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(245, 158, 11, 0.22)',
                        fill: '+1', // Fill down to 80% lower
                        pointRadius: 0,
                        tension: 0.35
                    },
                    // 4. 80% Confidence Interval Lower
                    {
                        label: '80% CI Lower',
                        data: data.ci80Lower,
                        borderColor: 'transparent',
                        backgroundColor: 'transparent',
                        fill: false,
                        pointRadius: 0,
                        tension: 0.35
                    },
                    // 5. Critical Failure Threshold (20%)
                    {
                        label: 'Critical Threshold (20%)',
                        data: data.failureThreshold,
                        borderColor: 'rgba(148, 163, 184, 0.6)',
                        borderWidth: 1.5,
                        borderDash: [6, 6],
                        fill: false,
                        pointRadius: 0,
                        tension: 0
                    },
                    // 6. Historical Degradation (Recorded)
                    {
                        label: 'Historical Health Index',
                        data: data.historical,
                        borderColor: '#38bdf8',
                        backgroundColor: '#38bdf8',
                        borderWidth: 2.5,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.25
                    },
                    // 7. Predicted Mean RUL Curve
                    {
                        label: 'Predicted Mean RUL',
                        data: data.predictedMean,
                        borderColor: '#ef4444',
                        backgroundColor: '#ef4444',
                        borderWidth: 2.5,
                        borderDash: [4, 4],
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.25
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false // We use our sleek custom CI legend
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 10,
                        boxPadding: 4,
                        callbacks: {
                            label: function(context) {
                                if (context.raw === null || context.raw === undefined) return null;
                                if (context.dataset.label.includes('CI')) return null; // keep tooltip clean
                                return `${context.dataset.label}: ${context.raw}% Health`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                            callback: val => `${val}%`
                        }
                    }
                }
            }
        });
    }

    /**
     * Renders Predictive Visualization 2: Risk Distribution Breakdown Chart.
     */
    function renderRiskChart() {
        if (!Chart) return;
        const canvas = document.getElementById('pa-risk-canvas');
        if (!canvas) return;

        const riskData = service.getRiskDistribution();

        if (riskChartInstance) {
            riskChartInstance.destroy();
            riskChartInstance = null;
        }

        const ctx = canvas.getContext('2d');
        riskChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Critical (<= 30d)', 'Watchlist (31-90d)', 'Normal (> 90d)'],
                datasets: [{
                    data: [
                        riskData.counts.Critical,
                        riskData.counts.Watchlist,
                        riskData.counts.Normal
                    ],
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#10b981'
                    ],
                    borderColor: '#0f172a',
                    borderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#cbd5e1',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                            padding: 14,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                                return ` ${ctx.label}: ${ctx.raw} units (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Renders Time-to-Failure Timeline (Gantt-style horizon buckets).
     */
    function renderTimeline() {
        const container = document.getElementById('pa-timeline-container');
        if (!container) return;

        const timeline = service.getTimeToFailureTimeline();

        const bucketKeys = [
            { key: 'immediate', class: 'pa-bucket-immediate', title: '1 - 30 Days (Imminent Failure)', icon: 'fa-triangle-exclamation' },
            { key: 'watchlist', class: 'pa-bucket-watchlist', title: '31 - 90 Days (Watchlist Horizon)', icon: 'fa-clock' },
            { key: 'midterm', class: 'pa-bucket-midterm', title: '91 - 180 Days (Overhaul Window)', icon: 'fa-wrench' },
            { key: 'healthy', class: 'pa-bucket-healthy', title: '180+ Days (Standard Maintenance)', icon: 'fa-check-circle' }
        ];

        let html = '';

        bucketKeys.forEach(b => {
            const bucket = timeline[b.key];
            const items = bucket.items || [];

            html += `
            <div class="pa-timeline-bucket ${b.class}">
                <div class="pa-timeline-bucket-header">
                    <span><i class="fas ${b.icon}"></i> ${b.title}</span>
                    <span>${items.length} Units</span>
                </div>
            `;

            if (items.length === 0) {
                html += `<div style="font-size: 11px; color: #64748b; padding: 10px 0;">No equipment in this horizon.</div>`;
            } else {
                items.slice(0, 4).forEach(item => {
                    const pctDays = Math.min(100, Math.round((item.daysRemaining / 365) * 100));
                    html += `
                    <div class="pa-timeline-item" onclick="PredictiveAnalyticsModule.openFeatureImportanceDrawer('${item.id}')" title="Click to view ML feature importance">
                        <div class="pa-timeline-item-title">
                            <span>${item.name.length > 28 ? item.name.substring(0, 26) + '...' : item.name}</span>
                            <span class="pa-eq-id">${item.id}</span>
                        </div>
                        <div class="pa-timeline-item-meta">
                            <span>Target: ${item.failureDate}</span>
                            <span><strong>${item.daysRemaining} days left</strong></span>
                        </div>
                        <div class="pa-timeline-bar-wrap">
                            <div class="pa-timeline-bar" style="width: ${Math.max(6, pctDays)}%;"></div>
                        </div>
                    </div>
                    `;
                });

                if (items.length > 4) {
                    html += `<div style="font-size: 11px; color: #94a3b8; text-align: center; padding-top: 4px;">+ ${items.length - 4} more units</div>`;
                }
            }

            html += `</div>`;
        });

        container.innerHTML = html;
    }

    /**
     * Renders Equipment Deep-Dive Table.
     */
    function renderEquipmentTable() {
        const tbody = document.getElementById('pa-table-body');
        if (!tbody) return;

        const items = service.getEquipmentList({
            search: searchQuery,
            riskTier: activeRiskFilter,
            category: activeCategoryFilter
        });

        if (items.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 32px; color: #94a3b8;">
                    <i class="fas fa-search" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No equipment matched the current filters.
                </td>
            </tr>
            `;
            return;
        }

        let rowsHtml = '';
        items.forEach(item => {
            const wear = item.currentWearLevel || 0;
            const wearClass = wear >= 75 ? 'pa-wear-fill-high' : wear >= 50 ? 'pa-wear-fill-med' : 'pa-wear-fill-low';
            const riskBadgeClass = item.riskTier === 'Critical' ? 'pa-badge-critical' : item.riskTier === 'Watchlist' ? 'pa-badge-watchlist' : 'pa-badge-normal';
            const riskIcon = item.riskTier === 'Critical' ? 'fa-triangle-exclamation' : item.riskTier === 'Watchlist' ? 'fa-clock' : 'fa-check-circle';

            rowsHtml += `
            <tr>
                <td><span class="pa-eq-id">${item.id}</span></td>
                <td>
                    <div style="font-weight: 600; color: #f8fafc;">${item.name}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${item.propertyNo} &bull; ${item.location}</div>
                </td>
                <td><span style="font-size: 12px; color: #cbd5e1;">${item.category}</span></td>
                <td>
                    <div style="font-size: 11px; color: #cbd5e1;"><strong>${item.operatingHours.toLocaleString()}</strong> hrs</div>
                    <div style="font-size: 11px; color: #94a3b8;">${item.cycleCount.toLocaleString()} cycles</div>
                </td>
                <td>
                    <div class="pa-wear-wrap">
                        <div class="pa-wear-bar-track">
                            <div class="pa-wear-bar-fill ${wearClass}" style="width: ${wear}%;"></div>
                        </div>
                        <span class="pa-wear-text">${wear}%</span>
                    </div>
                </td>
                <td>
                    <div style="font-size: 12px; font-weight: 600; color: #f8fafc;">${item.predictedFailureDate}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${item.predictedFailureDays} days left</div>
                </td>
                <td>
                    <span class="pa-badge ${riskBadgeClass}">
                        <i class="fas ${riskIcon}"></i> ${item.riskTier}
                    </span>
                </td>
                <td>
                    <span style="font-size: 12px; color: #cbd5e1; max-width: 220px; display: inline-block;">
                        ${item.recommendedAction}
                    </span>
                </td>
                <td>
                    <button type="button" class="pa-btn-explain" onclick="PredictiveAnalyticsModule.openFeatureImportanceDrawer('${item.id}')">
                        <i class="fas fa-network-wired"></i> Explain Drivers
                    </button>
                </td>
            </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;
    }

    /**
     * Populates the Asset Selector for the Degradation Curve.
     */
    function populateAssetSelector() {
        const select = document.getElementById('pa-asset-selector');
        if (!select) return;

        const items = service.getAllEquipment();
        let options = '';
        items.forEach(item => {
            const isSelected = item.id === activeEquipmentId ? 'selected' : '';
            options += `<option value="${item.id}" ${isSelected}>${item.id} - ${item.name}</option>`;
        });
        select.innerHTML = options;

        select.addEventListener('change', function () {
            activeEquipmentId = this.value;
            renderDegradationChart(activeEquipmentId);
        });
    }

    /**
     * Opens the Feature Importance (Explainable AI / XAI) Quick Drawer.
     */
    function openFeatureImportanceDrawer(equipmentId) {
        const drawer = document.getElementById('pa-drawer');
        const backdrop = document.getElementById('pa-drawer-backdrop');
        const body = document.getElementById('pa-drawer-body');
        const titleEl = document.getElementById('pa-drawer-title');
        const subtitleEl = document.getElementById('pa-drawer-subtitle');

        if (!drawer || !backdrop || !body) return;

        const item = service.getEquipmentDetails(equipmentId);
        if (!item) return;

        if (titleEl) titleEl.textContent = `${item.id}: ${item.name}`;
        if (subtitleEl) subtitleEl.textContent = `${item.category} &bull; Property No: ${item.propertyNo}`;

        // Build XAI drawer content
        let shapHtml = '';
        (item.featureImportance || []).forEach(feat => {
            shapHtml += `
            <div class="pa-shap-item">
                <div class="pa-shap-item-top">
                    <span class="pa-shap-item-name">${feat.feature}</span>
                    <span class="pa-shap-item-val">${feat.importance}% Impact</span>
                </div>
                <div class="pa-shap-bar-track">
                    <div class="pa-shap-bar-fill" style="width: ${feat.importance}%;"></div>
                </div>
                <div style="font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
                    <span>Telemetry: <strong>${feat.value}</strong></span>
                    <span>Nominal: ${feat.baseline}</span>
                </div>
            </div>
            `;
        });

        body.innerHTML = `
        <!-- Telemetry Gauges -->
        <div>
            <h5 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Live Sensor Readings</h5>
            <div class="pa-drawer-telemetry-grid">
                <div class="pa-telemetry-mini-card">
                    <div class="pa-telemetry-mini-label"><i class="fas fa-wave-square" style="color: #38bdf8;"></i> Vibration RMS</div>
                    <div class="pa-telemetry-mini-val" style="color: ${item.telemetry.vibrationStatus === 'Anomaly' ? '#ef4444' : '#10b981'};">
                        ${item.telemetry.vibrationRms} mm/s
                    </div>
                </div>
                <div class="pa-telemetry-mini-card">
                    <div class="pa-telemetry-mini-label"><i class="fas fa-temperature-high" style="color: #f59e0b;"></i> Operating Temp</div>
                    <div class="pa-telemetry-mini-val" style="color: ${item.telemetry.tempStatus === 'High' ? '#ef4444' : '#f59e0b'};">
                        ${item.telemetry.operatingTemp} °C
                    </div>
                </div>
                <div class="pa-telemetry-mini-card">
                    <div class="pa-telemetry-mini-label"><i class="fas fa-hourglass-half" style="color: #cbd5e1;"></i> Runtime Hours</div>
                    <div class="pa-telemetry-mini-val">${item.operatingHours.toLocaleString()} hrs</div>
                </div>
                <div class="pa-telemetry-mini-card">
                    <div class="pa-telemetry-mini-label"><i class="fas fa-oil-can" style="color: #10b981;"></i> Lubricant Quality</div>
                    <div class="pa-telemetry-mini-val">${item.telemetry.lubricantQualityIndex} / 100</div>
                </div>
            </div>
        </div>

        <!-- SHAP Feature Importance Section -->
        <div class="pa-shap-section">
            <div class="pa-shap-header">
                <span class="pa-shap-title"><i class="fas fa-brain" style="color: #38bdf8;"></i> ML Feature Importance (SHAP)</span>
                <span class="pa-shap-badge">Why Lifespan is Shortened</span>
            </div>
            <div class="pa-shap-list">
                ${shapHtml}
            </div>
        </div>

        <!-- Prescriptive Advisory Box -->
        <div class="pa-advisory-box">
            <div class="pa-advisory-box-title"><i class="fas fa-wrench"></i> Recommended Prescriptive Action</div>
            <p class="pa-advisory-box-text">${item.recommendedAction}</p>
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(56, 189, 248, 0.2); font-size: 11px; display: flex; justify-content: space-between;">
                <span>Maintenance Window: <strong>${item.maintenanceWindow}</strong></span>
                <span>Cost Avoidance: <strong style="color: #38bdf8;">${formatPHP(item.costAvoidance)}</strong></span>
            </div>
        </div>
        `;

        drawer.classList.add('active');
        backdrop.classList.add('active');
    }

    /**
     * Closes the Feature Importance Drawer.
     */
    function closeFeatureImportanceDrawer() {
        const drawer = document.getElementById('pa-drawer');
        const backdrop = document.getElementById('pa-drawer-backdrop');
        if (drawer) drawer.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
    }

    /**
     * Binds event listeners for toolbar filters and buttons.
     */
    function bindEventListeners() {
        // Search Input
        const searchInput = document.getElementById('pa-table-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                searchQuery = this.value;
                renderEquipmentTable();
            });
        }

        // Risk Filter Pills
        const pills = document.querySelectorAll('#pa-risk-filter-pills .pa-filter-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', function () {
                pills.forEach(p => p.classList.remove('active'));
                this.classList.add('active');
                activeRiskFilter = this.getAttribute('data-risk') || 'ALL';
                renderEquipmentTable();
            });
        });

        // Drawer Close
        const closeBtn = document.getElementById('pa-drawer-close-btn');
        const backdrop = document.getElementById('pa-drawer-backdrop');
        if (closeBtn) closeBtn.addEventListener('click', closeFeatureImportanceDrawer);
        if (backdrop) backdrop.addEventListener('click', closeFeatureImportanceDrawer);

        // Telemetry Refresh Sync Button
        const refreshBtn = document.getElementById('pa-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
                setTimeout(() => {
                    if (window.inventoryData && window.inventoryData.length > 0) {
                        service.syncWithMasterlist(window.inventoryData);
                    }
                    renderKPIs();
                    renderDegradationChart(activeEquipmentId);
                    renderRiskChart();
                    renderTimeline();
                    renderEquipmentTable();
                    populateAssetSelector();
                    this.innerHTML = '<i class="fas fa-check"></i> Synced!';
                    setTimeout(() => {
                        this.innerHTML = '<i class="fas fa-arrows-rotate"></i> Sync Telemetry';
                    }, 1500);
                }, 600);
            });
        }

        // Prognostics Report Button
        const reportBtn = document.getElementById('pa-export-report-btn');
        if (reportBtn) {
            reportBtn.addEventListener('click', function () {
                window.print();
            });
        }
    }

    const moduleApi = {
        /**
         * Mounts the Predictive Analytics Dashboard into the specified target element or container ID.
         */
        mount: function (containerOrId) {
            let container = null;
            if (typeof containerOrId === 'string') {
                container = document.getElementById(containerOrId);
            } else if (containerOrId && containerOrId.nodeType) {
                container = containerOrId;
            }

            if (!container) {
                console.error("PredictiveAnalyticsModule.mount: Target container not found.", containerOrId);
                return;
            }

            mountContainer = container;
            container.innerHTML = buildDashboardTemplate();

            // Sync with global inventory data if already loaded in environment
            if (window.inventoryData && window.inventoryData.length > 0) {
                service.syncWithMasterlist(window.inventoryData);
            }

            // Render all modules
            renderKPIs();
            populateAssetSelector();
            renderDegradationChart(activeEquipmentId);
            renderRiskChart();
            renderTimeline();
            renderEquipmentTable();
            bindEventListeners();
        },

        /**
         * Refreshes all charts and data without re-mounting DOM.
         */
        refresh: function () {
            if (window.inventoryData && window.inventoryData.length > 0) {
                service.syncWithMasterlist(window.inventoryData);
            }
            renderKPIs();
            renderDegradationChart(activeEquipmentId);
            renderRiskChart();
            renderTimeline();
            renderEquipmentTable();
        },

        openFeatureImportanceDrawer: openFeatureImportanceDrawer,
        closeFeatureImportanceDrawer: closeFeatureImportanceDrawer
    };

    return moduleApi;
}));
