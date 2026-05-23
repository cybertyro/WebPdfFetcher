// ==UserScript==
// @name         CRCC真实PDF一键下载
// @namespace    https://www.example.com
// @version      3.0
// @description  优先提取URL参数中的PDF链接，过滤无效项，一键下载
// @author       You
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        #realpdf-btn {
            position: fixed; bottom: 30px; right: 30px; z-index: 99999;
            background: #1e88e5; color: white; border: none; border-radius: 50px;
            padding: 12px 24px; font-size: 16px; font-weight: bold; cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: 0.2s;
            display: flex; align-items: center; gap: 8px;
        }
        #realpdf-btn:hover { background: #1565c0; transform: scale(1.05); }
        #realpdf-panel {
            position: fixed; bottom: 90px; right: 30px; z-index: 99998;
            background: white; border: 1px solid #ccc; border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25); max-height: 400px;
            overflow-y: auto; min-width: 300px; display: none; padding: 8px;
            font-size: 14px; color: #333;
        }
        #realpdf-panel .item {
            padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;
            display: flex; justify-content: space-between; align-items: center;
        }
        #realpdf-panel .item:hover { background: #f0f4ff; }
        #realpdf-panel .item .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #realpdf-panel .item .hint { font-size: 12px; margin-left: 10px; }
        #realpdf-panel .item.recommend { background: #e8f5e9; }
        #realpdf-panel .item.recommend .hint { color: #2e7d32; font-weight: bold; }
        #realpdf-panel .close-btn {
            text-align: right; padding: 4px 8px; cursor: pointer; font-size: 18px; color: #999;
        }
        #realpdf-panel .info { padding: 10px; color: #555; font-size: 13px; border-bottom: 1px solid #eee; }
    `);

    const btn = document.createElement('button');
    btn.id = 'realpdf-btn';
    btn.innerHTML = '📥 下载PDF';
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'realpdf-panel';
    panel.innerHTML = '<div class="close-btn">✕</div><div class="content"></div>';
    document.body.appendChild(panel);
    const contentDiv = panel.querySelector('.content');
    panel.querySelector('.close-btn').addEventListener('click', () => panel.style.display = 'none');

    // 更严格的PDF链接提取，重点聚焦URL参数
    function findBestPDFs() {
        const candidates = [];
        const seen = new Set();

        // 辅助函数：添加候选，标记优先级
        const addCandidate = (url, source, priority = 0) => {
            try {
                const abs = new URL(url, location.href).href;
                // 过滤掉明显不是文件的地址
                if (abs.startsWith('blob:') || abs.includes('/view/pdf') || abs.endsWith('.html') || abs.includes('pdfjs')) {
                    return;
                }
                if (!seen.has(abs)) {
                    seen.add(abs);
                    let name = abs.split('/').pop().split('?')[0];
                    if (!name.endsWith('.pdf')) name += '.pdf';
                    candidates.push({ url: abs, name: name, source: source, priority: priority });
                }
            } catch(e) {}
        };

        // 1. 最高优先级：网址中 url/file 参数的值 (比如你提供的那个网站)
        const searchParams = new URLSearchParams(location.search);
        const fileUrl = searchParams.get('url') || searchParams.get('file');
        if (fileUrl) {
            addCandidate(fileUrl, 'URL参数 (最可能)', 100);
        }

        // 2. 检查 PDF.js 全局变量
        if (typeof PDFViewerApplication !== 'undefined' && PDFViewerApplication.url) {
            addCandidate(PDFViewerApplication.url, 'PDF.js查看器', 90);
        }

        // 3. 检查当前页面是否本身是PDF
        if (/\.pdf($|\?|#)/i.test(location.href) && !location.href.includes('/view/pdf')) {
            addCandidate(location.href, '当前页面', 80);
        }

        // 4. 内嵌标签
        document.querySelectorAll('embed, object, iframe').forEach(el => {
            const src = el.src || el.data;
            if (src && /\.pdf($|\?|#)/i.test(src)) {
                addCandidate(src, '内嵌标签', 50);
            }
        });

        // 5. 页面里所有 .pdf 的 A 链接 (优先级较低)
        document.querySelectorAll('a[href]').forEach(a => {
            if (/\.pdf($|\?|#)/i.test(a.href)) {
                addCandidate(a.href, '页面链接', 30);
            }
        });

        // 按优先级从高到低排序
        candidates.sort((a, b) => b.priority - a.priority);

        // 去重：如果某个链接已经作为高优先级添加，去除低优先级的重复项
        const final = [];
        const urlsAdded = new Set();
        candidates.forEach(c => {
            if (!urlsAdded.has(c.url)) {
                urlsAdded.add(c.url);
                final.push(c);
            }
        });

        return final;
    }

    // 强制下载
    function forceDownload(item) {
        const url = item.url;
        const name = item.name.endsWith('.pdf') ? item.name : item.name + '.pdf';

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'blob',
            headers: { 'Referer': location.href },
            onload: function(resp) {
                if (resp.status === 200) {
                    const blob = resp.response;
                    // 过滤掉太小的假文件 (小于5KB的基本是错误页面)
                    if (blob.size < 5000) {
                        alert(`❌ 文件异常 (${(blob.size/1024).toFixed(1)}KB)，疑似非PDF。\n尝试用其他候选链接。`);
                        return;
                    }
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                } else {
                    alert(`下载失败，状态码: ${resp.status}`);
                }
            },
            onerror: () => alert('网络错误，下载失败。')
        });
    }

    // 显示列表
    function showPanel(list) {
        let html = '';
        if (list.length === 0) {
            html = '<div class="info">❌ 未找到任何有效PDF候选链接。</div>';
        } else {
            html += `<div class="info">找到 ${list.length} 个候选，优先选择⭐推荐项：</div>`;
            list.forEach((item, idx) => {
                const isRecommend = item.source.includes('最可能') || item.priority >= 90;
                html += `<div class="item${isRecommend ? ' recommend' : ''}" data-url="${item.url.replace(/"/g, '&quot;')}" data-name="${item.name.replace(/"/g, '&quot;')}">
                    <span class="name" title="${item.url}">${isRecommend ? '⭐' : ''} ${item.name}</span>
                    <span class="hint">${item.source}</span>
                </div>`;
            });
            html += '<div class="info" style="font-size:12px;color:#888;">💡 如果⭐推荐下载失败，再尝试其他项。</div>';
        }
        contentDiv.innerHTML = html;
        panel.style.display = 'block';

        // 绑定下载
        contentDiv.querySelectorAll('.item').forEach(el => {
            el.addEventListener('click', () => {
                forceDownload({url: el.dataset.url, name: el.dataset.name});
            });
        });
    }

    btn.addEventListener('click', () => {
        const candidates = findBestPDFs();
        // 如果只有一个候选，直接下载，不弹窗
        if (candidates.length === 1) {
            forceDownload(candidates[0]);
        } else {
            showPanel(candidates);
        }
    });

})();
