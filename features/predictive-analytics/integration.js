/**
 * =========================================================================
 * PREDICTIVE ANALYTICS NON-DESTRUCTIVE INTEGRATION HOOK
 * Module: features/predictive-analytics/integration.js
 * 
 * Objective:
 * Seamlessly integrates the Predictive Lifespan module into existing dashboard
 * views and sidebar navigation without overwriting or tampering with existing code.
 * =========================================================================
 */

(function () {
    'use strict';

    function initPredictiveIntegration() {
        // 1. Inject Stylesheet if not already loaded
        if (!document.getElementById('pa-injected-styles')) {
            const link = document.createElement('link');
            link.id = 'pa-injected-styles';
            link.rel = 'stylesheet';
            link.href = '../features/predictive-analytics/predictiveAnalytics.css?v=20261021_1';
            document.head.appendChild(link);
        }

        // 2. Inject Sidebar Button into Admin Navigation
        const analyticsBtn = document.getElementById('sidebar-analytics-btn');
        if (analyticsBtn && !document.getElementById('sidebar-predictive-btn')) {
            const predBtn = document.createElement('button');
            predBtn.id = 'sidebar-predictive-btn';
            predBtn.className = 'sidebar-link-btn';
            predBtn.title = 'Predictive Lifespan & Telemetry';
            predBtn.innerHTML = '<i class="fas fa-brain"></i> <span class="sidebar-text">Predictive Lifespan</span>';
            predBtn.onclick = function () {
                window.switchAdminView('predictive');
                if (typeof window.closeSidebarNavMenu === 'function') {
                    window.closeSidebarNavMenu();
                }
            };
            // Insert right after the Analytics button
            analyticsBtn.parentNode.insertBefore(predBtn, analyticsBtn.nextSibling);
        }

        // 3. Inject View Container into Main Content
        const mainContent = document.querySelector('main.main-content');
        if (mainContent && !document.getElementById('predictive-view')) {
            const predView = document.createElement('div');
            predView.id = 'predictive-view';
            predView.className = 'predictive-view hidden';
            predView.style.width = '100%';
            predView.style.height = '100%';
            predView.style.overflowY = 'auto';
            mainContent.appendChild(predView);
        }

        // 4. Non-Destructive Wrapper around switchAdminView
        if (typeof window.switchAdminView === 'function' && !window.switchAdminView._paWrapped) {
            const originalSwitch = window.switchAdminView;
            const wrappedSwitch = function (viewName) {
                const predView = document.getElementById('predictive-view');
                const predBtn = document.getElementById('sidebar-predictive-btn');
                const isPredictive = (viewName === 'predictive');

                if (predBtn) {
                    predBtn.classList.toggle('active', isPredictive);
                }

                if (isPredictive) {
                    // Hide other views
                    const homeView = document.getElementById('home-view');
                    const masterlistView = document.getElementById('masterlist-view');
                    const analyticsView = document.getElementById('analytics-view');
                    if (homeView) homeView.classList.add('hidden');
                    if (masterlistView) masterlistView.classList.add('hidden');
                    if (analyticsView) analyticsView.classList.add('hidden');

                    // Unset active on sibling buttons
                    const homeBtn = document.getElementById('sidebar-home-btn');
                    const masterlistBtn = document.getElementById('sidebar-masterlist-btn');
                    const analyticsBtnEl = document.getElementById('sidebar-analytics-btn');
                    if (homeBtn) homeBtn.classList.remove('active');
                    if (masterlistBtn) masterlistBtn.classList.remove('active');
                    if (analyticsBtnEl) analyticsBtnEl.classList.remove('active');

                    // Show predictive view
                    if (predView) {
                        predView.classList.remove('hidden');
                        if (window.PredictiveAnalyticsModule) {
                            if (!predView.hasChildNodes() || predView.children.length === 0) {
                                window.PredictiveAnalyticsModule.mount('predictive-view');
                            } else {
                                window.PredictiveAnalyticsModule.refresh();
                            }
                        }
                    }
                } else {
                    if (predView) {
                        predView.classList.add('hidden');
                    }
                    originalSwitch.apply(this, arguments);
                }
            };
            wrappedSwitch._paWrapped = true;
            window.switchAdminView = wrappedSwitch;
        }

        // 5. Add a Quick-Switch Banner in Analytics View (Exploration Pill)
        const analyticsView = document.getElementById('analytics-view');
        if (analyticsView && !document.getElementById('pa-analytics-switch-pill')) {
            const banner = document.createElement('div');
            banner.id = 'pa-analytics-switch-pill';
            banner.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                background: linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(16, 185, 129, 0.08));
                border: 1px solid rgba(56, 189, 248, 0.3);
                border-radius: 12px;
                padding: 12px 18px;
                margin-bottom: 20px;
                font-family: 'Plus Jakarta Sans', sans-serif;
            `;
            banner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 34px; height: 34px; border-radius: 8px; background: rgba(56, 189, 248, 0.2); display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 16px;">
                        <i class="fas fa-brain"></i>
                    </div>
                    <div>
                        <div style="font-size: 13px; font-weight: 700; color: #f8fafc;">Predictive Lifespan & Telemetry Module Available</div>
                        <div style="font-size: 11px; color: #94a3b8;">Forecast remaining useful life (RUL) curves with 80%–95% confidence intervals and XAI feature importance drivers.</div>
                    </div>
                </div>
                <button type="button" class="pa-btn pa-btn-primary" style="font-size: 12px; padding: 6px 14px;" onclick="window.switchAdminView('predictive');">
                    Launch Lifespan Module <i class="fas fa-arrow-right"></i>
                </button>
            `;
            analyticsView.insertBefore(banner, analyticsView.firstChild);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPredictiveIntegration);
    } else {
        initPredictiveIntegration();
    }
})();
