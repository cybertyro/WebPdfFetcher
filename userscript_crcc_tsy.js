// ==UserScript==
// @name         TSY网页所有PDF直链采集工具栏
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  只扫描页面DOM/变量/XHR响应，捕获所有可能PDF直链并展示下载按钮
// @match        *://192.10.51.59:7000/web/public/FoxitKeyViewer.html*
// @grant        none
// ==/UserScript==

(function(){
    'use strict';
    let pdfUrls = new Set();
    function showBar() {
        let old = document.getElementById("pdf-capture-bar");
        if (old) old.remove();
        let bar = document.createElement('div');
        bar.id = "pdf-capture-bar";
        bar.style = 'position:fixed;top:18px;left:18px;z-index:65535;background:#fff;border-radius:6px;width:345px;box-shadow:0 2px 8px #333;padding:16px 10px;font-size:13px;';
        bar.innerHTML = `
          <b style="font-size:15px;color:#1976d2;">PDF直链采集栏</b>
          <div id="pdf-capture-list" style="margin-top:8px;color:#222;">
          ${[...pdfUrls].map((url,i)=>`<div style="margin:7px 0;"><a href="${url}" target="_blank" style="color:#1976d2;font-weight:bold;">[${i+1}] 下载PDF</a><br><span style="font-size:10px;color:#888;word-break:break-all;">${url}</span></div>`).join('') || '（暂无捕获）'}
          </div>
          <button id="pdf-bar-refresh" style="margin-top:10px;padding:5px 10px;font-size:12px;">再扫描页面</button>
          <button id="pdf-bar-close" style="float:right;">关闭</button>
        `;
        document.body.appendChild(bar);
        document.getElementById('pdf-bar-refresh').onclick = manualScan;
        document.getElementById('pdf-bar-close').onclick = ()=>bar.remove();
    }
    function addPDF(url) {
        pdfUrls.add(url);
        showBar();
    }
    // DOM查找所有 src/data
    function scanDOM() {
        let pdfNodes = [
            ...document.querySelectorAll('iframe[src],embed[src],object[data]')
        ];
        pdfNodes.forEach(n=>{
            let src = n.src || n.data;
            if(src && (src.endsWith('.pdf') || /\/TempdownFiles\/view\//.test(src)))
                addPDF(src);
        });
    }
    // 扫描全局变量
    function scanWindowProps() {
        for(let k in window) {
            try {
                let v=window[k];
                if(typeof v === 'string' && (
                    v.endsWith('.pdf') || v.includes('/TempdownFiles/view/'))
                ) addPDF(v);
            }catch{}
        }
    }
    // 监听 XHR 获得 API 响应中的下载直链
    (function(){
      let _open = XMLHttpRequest.prototype.open;
      let _send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function() {
        this._url = arguments[1];
        return _open.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            if(typeof this.responseText === "string") {
                let found = this.responseText.match(/\/TempdownFiles\/view\/[A-Za-z0-9_\-\.]+/);
                if(found){
                    let url = location.origin + found[0];
                    addPDF(url);
                }
            }
        },false);
        return _send.apply(this, arguments);
      };
    })();

    // 终极扫描函数
    function manualScan() {
        scanDOM();
        scanWindowProps();
    }

    // 首次/定时扫描
    setTimeout(manualScan, 800);
    setInterval(scanDOM, 3000);
    window.addEventListener('DOMContentLoaded', ()=>setTimeout(manualScan, 600));
    window.addEventListener('load', ()=>setTimeout(manualScan, 1400));

    // 工具栏
    showBar();

})();
