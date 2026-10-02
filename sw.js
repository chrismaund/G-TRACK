// G-TRACK Background Service Worker for Native Desktop OS Notifications
const CACHE_NAME = 'gtrack-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push event from server/push provider
self.addEventListener('push', (event) => {
    let data = {
        title: 'G-TRACK Notification',
        body: 'You have a new update in G-TRACK.',
        url: '/dashboard/admin.html'
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body || data.message || '',
        icon: '/dashboard/logo.png',
        badge: '/dashboard/logo.png',
        tag: data.tag || data.id || `gtrack-${Date.now()}`,
        renotify: true,
        data: {
            url: data.url || '/dashboard/admin.html'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'G-TRACK Notification', options)
    );
});

// Handle notification clicks: focus open tab or launch new window
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) 
        ? event.notification.data.url 
        : '/dashboard/admin.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
