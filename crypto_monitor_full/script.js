/* --------------------------------------------------------------
   Конфиг и подключение
-------------------------------------------------------------- */
const WS_URL = 'ws://127.0.0.1:8000/ws';
let ws;
let data = {symbols:[], prices:{}, rsi:{}, volumes:{}};
const TF = ['1m','3m','5m','15m','30m','1h','4h','12h','1d'];
let sort = {column:'symbol', order:'asc'};

/* --------------------------------------------------------------
   UI‑элементы
-------------------------------------------------------------- */
const statusEl   = document.getElementById('connection-status');
const tbody      = document.getElementById('table-body');
const countEl    = document.getElementById('active-count');
const searchEl   = document.getElementById('search');
const modal      = document.getElementById('chart-modal');
const modalSpan  = modal.querySelector('.close');
const modalHead  = document.getElementById('modal-header');
const modalChart = document.getElementById('modal-chart');
const modalCtx   = modalChart.getContext('2d');

/* --------------------------------------------------------------
   WebSocket
-------------------------------------------------------------- */
function connectWS(){
    ws = new WebSocket(WS_URL);
    ws.onopen = ()=>{
        statusEl.innerHTML = '<div class="pulsing-dot green"></div> Live';
        statusEl.className = 'status-pill live';
    };
    ws.onmessage = e=>{
        const d = JSON.parse(e.data);
        data = d;
        countEl.textContent = data.symbols.length || 0;
        renderTable();
    };
    ws.onclose = ()=>{
        statusEl.innerHTML = '<div class="pulsing-dot red"></div> Reconnecting…';
        statusEl.className = 'status-pill';
        setTimeout(connectWS, 2000);
    };
    ws.onerror = ()=> ws.close();
}
connectWS();

/* --------------------------------------------------------------
   Вспомогательные функции
-------------------------------------------------------------- */
function fmtPrice(p){
    if(p===undefined) return '—';
    if(p<0.0001) return p.toFixed(8);
    if(p<1) return p.toFixed(4);
    if(p<10) return p.toFixed(3);
    return p.toFixed(2);
}
function rsiClass(v){
    if(v===undefined||v===null||isNaN(v)) return {cls:'neutral', txt:'—'};
    const r=parseFloat(v);
    const txt=r.toFixed(1);
    if(r>=80) return {cls:'bg-overbought-extreme',txt};
    if(r>=70) return {cls:'bg-overbought',txt};
    if(r>=60) return {cls:'bg-neutral-high',txt};
    if(r<=20) return {cls:'bg-oversold-extreme',txt};
    if(r<=30) return {cls:'bg-oversold',txt};
    if(r<=40) return {cls:'bg-neutral-low',txt};
    return {cls:'neutral',txt};
}

/* --------------------------------------------------------------
   Рисование мини‑чарта (цена + объём)
   размер: 80×18 – верхняя половина цена, нижняя – объём
-------------------------------------------------------------- */
function drawMini(canvas, pricesArr, volumesArr){
    const w = canvas.width || 80;
    const h = canvas.height || 18;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,w,h);
    if(!pricesArr || pricesArr.length < 2){
        ctx.strokeStyle = '#555';
        ctx.beginPath(); ctx.moveTo(0, h/4); ctx.lineTo(w, h/4); ctx.stroke();
        return;
    }
    // ----- цена (верхняя половина) -----
    const priceMin = Math.min(...pricesArr);
    const priceMax = Math.max(...pricesArr);
    const priceRange = priceMax - priceMin || 1;
    const stepX = w / (pricesArr.length - 1);
    ctx.strokeStyle = '#0ecb81';
    ctx.lineWidth = 1;
    ctx.beginPath();
    pricesArr.forEach((v,i)=>{
        const x = i * stepX;
        const y = (h/2) - (((v-priceMin)/priceRange)*(h/2-1)) - 1;
        i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    // ----- объём (нижняя половина) -----
    const volMax = Math.max(...volumesArr) || 1;
    ctx.fillStyle = 'rgba(14,203,129,0.4)';
    volumesArr.forEach((v,i)=>{
        const x = i * stepX;
        const barH = (v/volMax)*(h/2-2);
        ctx.fillRect(x-1, h/2+1, 2, barH);
    });
}

/* --------------------------------------------------------------
   Рисование полноразмерного графика в модалке
-------------------------------------------------------------- */
function drawFull(canvas, pricesArr, volumesArr, title){
    const w = canvas.width || 800;
    const h = canvas.height || 200;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,w,h);
    if(!pricesArr || pricesArr.length < 2){
        ctx.strokeStyle = '#555';
        ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
        return;
    }
    // ----- цена (верхняя часть) -----
    const priceMin = Math.min(...pricesArr);
    const priceMax = Math.max(...pricesArr);
    const priceRange = priceMax - priceMin || 1;
    const stepX = w / (pricesArr.length - 1);
    ctx.strokeStyle = '#0ecb81';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pricesArr.forEach((v,i)=>{
        const x = i * stepX;
        const y = h - (((v-priceMin)/priceRange)*(h-40)) - 20; // место снизу под объём
        i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    // ----- объём (нижняя часть) -----
    const volMax = Math.max(...volumesArr) || 1;
    ctx.fillStyle = 'rgba(14,203,129,0.3)';
    volumesArr.forEach((v,i)=>{
        const x = i * stepX;
        const barH = (v/volMax)*(h/2-20);
        ctx.fillRect(x-1, h/2+10, 2, barH);
    });
    // ----- заголовок -----
    ctx.fillStyle = 'var(--text)';
    ctx.font = '16px sans-serif';
    ctx.fillText(title, 10, 20);
}

/* --------------------------------------------------------------
   Сортировка таблицы
-------------------------------------------------------------- */
document.querySelectorAll('th.sortable').forEach(th=>{
    th.addEventListener('click',()=>{
        const col = th.getAttribute('data-sort');
        if(sort.column===col){
            sort.order = sort.order==='asc' ? 'desc' : 'asc';
        }else{
            sort.column = col;
            sort.order = 'desc';
        }
        document.querySelectorAll('th.sortable').forEach(x=>{
            x.classList.remove('active-sort');
            x.querySelector('.sort-icon').className = 'fa-solid fa-sort sort-icon';
        });
        th.classList.add('active-sort');
        const ic = th.querySelector('.sort-icon');
        ic.className = sort.order==='desc'
            ? 'fa-solid fa-sort-down sort-icon'
            : 'fa-solid fa-sort-up sort-icon';
        renderTable();
    });
});

/* --------------------------------------------------------------
   Поиск
-------------------------------------------------------------- */
searchEl.addEventListener('input', renderTable);

/* --------------------------------------------------------------
   Тема
-------------------------------------------------------------- */
document.getElementById('theme-toggle').addEventListener('click',()=>{
    document.body.classList.toggle('light-theme');
    const i = document.querySelector('#theme-toggle i');
    i.className = document.body.classList.contains('light-theme')
        ? 'fa-solid fa-sun'
        : 'fa-solid fa-moon';
});

/* --------------------------------------------------------------
   Модалка
-------------------------------------------------------------- */
modalSpan.onclick = ()=>{ modal.style.display = 'none'; };
window.onclick = e=>{ if(e.target===modal) modal.style.display = 'none'; };

/* --------------------------------------------------------------
   Основной рендер таблицы
-------------------------------------------------------------- */
function renderTable(){
    const syms = (data.symbols||[])
        .filter(s=>s.toUpperCase().includes(searchEl.value.toUpperCase()));

    syms.sort((a,b)=>{
        let va, vb;
        if(sort.column==='symbol'){
            return sort.order==='asc' ? a.localeCompare(b) : b.localeCompare(a);
        }
        if(sort.column==='price'){
            va = data.prices[a]||0; vb = data.prices[b]||0;
        }
        if(sort.column.startsWith('rsi_')){
            const tf = sort.column.replace('rsi_','');
            va = data.rsi[a]?.[tf] ?? (sort.order==='desc' ? -1 : 999);
            vb = data.rsi[b]?.[tf] ?? (sort.order==='desc' ? -1 : 999);
        }
        if(va<vb) return sort.order==='asc' ? -1 : 1;
        if(va>vb) return sort.order==='asc' ? 1 : -1;
        return 0;
    });

    if(!syms.length && (data.symbols||[]).length){
        tbody.innerHTML = `<tr><td colspan="10" class="loading-state">Ничего не найдено</td></tr>`;
        return;
    }

    let html = '';
    syms.forEach(sym=>{
        const base = sym.replace('USDT','');
        const price = fmtPrice(data.prices[sym]);
        let cells = '';
        TF.forEach(tf=>{
            const rsi = data.rsi[sym]?.[tf];
            const hm = rsiClass(rsi);
            const canvasId = `sp_${sym}_${tf}`;
            cells += `<td>
                <div class="hm-cell">
                    <div class="hm-value ${hm.cls}">${hm.txt}</div>
                    <canvas class="sparkline" id="${canvasId}" width="80" height="18"></canvas>
                </div>
            </td>`;
        });
        html += `<tr>
            <td class="sticky-col"><span class="symbol">${base}</span><span class="quote">USDT</span></td>
            <td class="price-col">$${price}</td>
            ${cells}
        </tr>`;
    });
    tbody.innerHTML = html;

// После отрисовки ячеек – рисуем все мини‑чарты и вешаем клик
syms.forEach(sym=>{
    const base = sym.replace('USDT','');   // вынесли base сюда
    TF.forEach(tf=>{
        const canvas = document.getElementById(`sp_${sym}_${tf}`);
        if(!canvas) return;

        const pricesArr  = data.closes?.[sym]?.[tf] || [];
        const volumesArr = data.volumes?.[sym]?.[tf] || [];

        drawMini(canvas, pricesArr, volumesArr);

        // Клик → модалка с большим графиком
        canvas.onclick = ()=>{
            const title = `${base}/USDT – ${tf}`;
            modalHead.textContent = title;
            drawFull(
                modalChart,
                pricesArr,
                volumesArr,
                title
            );
            modal.style.display = 'block';
        };
    });
});
}

/* --------------------------------------------------------------
   Инициализация – ждём первого сообщения от WS, где будут
   массивы closes и volumes (добавлены в бэкенд).
-------------------------------------------------------------- */