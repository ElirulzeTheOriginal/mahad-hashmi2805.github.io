/*
daily-links.js

Simple helper to rotate link targets daily.

Usage:
- Provide a mapping object via `window.DAILY_LINKS = { groupName: [url1, url2, ...] }`
  before this script runs, or call `registerDailyLinks(mapping)` at runtime.
- Add `data-daily-group="groupName"` to any <a> element (or other element) whose
  `href` you want replaced daily. If the element is not an <a>, the URL will be
  stored in `data-daily-selected` attribute instead.

Behavior:
- Uses days since epoch (UTC) to pick an index: `days % links.length` so it
  changes once per UTC day and cycles through the provided links.
*/
(function () {
    'use strict';

    function daysSinceEpochUTC() {
        return Math.floor(Date.now() / 86400000);
    }

    function updateOnce() {
        var mapping = window.DAILY_LINKS || {};
        var days = daysSinceEpochUTC();

        // Apply group-specific updates for elements marked with data-daily-group
        Object.keys(mapping).forEach(function (group) {
            var links = mapping[group];
            if (!Array.isArray(links) || links.length === 0) return;

            var idx = days % links.length;
            var url = links[idx];

            var selector = '[data-daily-group="' + group + '"]';
            document.querySelectorAll(selector).forEach(function (el) {
                if (el.tagName.toLowerCase() === 'a') {
                    el.href = url;
                } else if (el.hasAttribute('href')) {
                    el.setAttribute('href', url);
                } else {
                    el.dataset.dailySelected = url;
                }

                if (el.dataset.dailyText === 'true') {
                    el.textContent = url;
                }
            });
        });

        // If requested, replace every anchor's href with the chosen URL
        if (window.DAILY_REPLACE_ALL) {
            var defaultGroup = window.DAILY_DEFAULT_GROUP || Object.keys(mapping)[0];
            if (defaultGroup && mapping[defaultGroup] && mapping[defaultGroup].length) {
                var links = mapping[defaultGroup];
                var url = links[days % links.length];

                // Select all anchors on the page and set their href
                // Skip internal or relative links so site navigation keeps working.
                function shouldReplaceAnchor(a) {
                    var raw = a.getAttribute('href');
                    if (!raw) return false;

                    var lower = raw.trim().toLowerCase();

                    // Skip anchors, javascript:, mailto:, tel:, data:
                    if (lower === '' || lower.startsWith('#') || lower.startsWith('javascript:') || lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('data:')) return false;

                    // Root-relative links are internal unless explicitly allowed via flag and target blank
                    if (lower.startsWith('/')) {
                        if (a.target === '_blank' && window.DAILY_REPLACE_INTERNAL_BLANK) return true;
                        return false;
                    }

                    // If it's an absolute http(s) URL
                    if (/^https?:\/\//.test(lower)) {
                        try {
                            var u = new URL(raw, window.location.href);
                            if (u.hostname === window.location.hostname) {
                                // internal absolute link — allow only if target blank and flag enabled
                                if (a.target === '_blank' && window.DAILY_REPLACE_INTERNAL_BLANK) return true;
                                return false;
                            }
                            return true; // external
                        } catch (e) {
                            return false;
                        }
                    }

                    // Relative paths (e.g. "page.html") are internal — allow only if target blank and flag enabled
                    if (a.target === '_blank' && window.DAILY_REPLACE_INTERNAL_BLANK) return true;
                    return false;
                }

                document.querySelectorAll('a').forEach(function (a) {
                    if (!shouldReplaceAnchor(a)) return;
                    try { a.href = url; } catch (e) { /* ignore */ }
                });
            }
        }
    }

    window.registerDailyLinks = function (mapping) {
        if (!mapping || typeof mapping !== 'object') return;
        window.DAILY_LINKS = Object.assign({}, window.DAILY_LINKS || {}, mapping);
        updateOnce();
    };

    window.updateDailyLinks = updateOnce;

    // auto-run if mapping already present
    if (window.DAILY_LINKS) updateOnce();

})();
