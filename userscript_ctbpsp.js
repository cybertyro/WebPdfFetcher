// ==UserScript==
// @name         中国招标服务网自动提取页面内嵌PDF（劫持Blob法）
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  拦截网页通过Blob加载的PDF，并提供一键下载
// @author       You
// @match        https://ctbpsp.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 存储捕获到的PDF Blob
    let capturedPDFBlob = null;

    // 劫持 URL.createObjectURL
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
        const url = originalCreateObjectURL.call(this, blob);
        // 检查是否为PDF类型
        if (blob && blob.type === 'application/pdf') {
            capturedPDFBlob = blob;
            console.log('✅ 已捕获到PDF Blob，可点击按钮下载');
        }
        return url;
    };

    // 等页面加载完后添加按钮
    window.addEventListener('DOMContentLoaded', () => {
        GM_addStyle(`
            #save-pdf-btn {
                position: fixed;
                bottom: 30px;
                right: 30px;
                z-index: 99999;
                background: #1e88e5;
                color: white;
                border: none;
                border-radius: 50px;
                padding: 12px 22px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                transition: transform 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            #save-pdf-btn:hover {
                transform: scale(1.08);
                background: #1565c0;
            }
        `);

        const btn = document.createElement('button');
        btn.id = 'save-pdf-btn';
        btn.innerHTML = '📥 保存看到的PDF';
        btn.title = '请先确保页面上的PDF已加载完毕';
        document.body.appendChild(btn);

        btn.addEventListener('click', () => {
            if (capturedPDFBlob) {
                const url = URL.createObjectURL(capturedPDFBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'document.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else {
                // 如果还未捕获，尝试从 PDF.js 全局对象中获取
                if (typeof PDFViewerApplication !== 'undefined' && PDFViewerApplication.pdfDocument) {
                    PDFViewerApplication.pdfDocument.getData().then(data => {
                        const blob = new Blob([data], {type: 'application/pdf'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'document.pdf';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    });
                } else {
                    alert('❌ 未捕获到PDF数据。\n请先完整浏览一遍PDF（用鼠标滚动到底），然后再点击按钮。');
                }
            }
        });
    });

})();
