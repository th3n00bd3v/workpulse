/**
 * --- UI Helpers ---
 */
const updateDateDisplay = () => {
    const options = { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', options);
};

const tToM = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const formatTime = (total) => {
    if (total < 0) return "0m";
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/**
 * --- Export Logic ---
 */
const handleExport = () => {
    const inT = document.getElementById('in-time').value;
    const outT = document.getElementById('out-time').value;
    const net = document.getElementById('net-duration').textContent;
    const breaks = document.querySelectorAll('.break-row');
    const today = new Date().toLocaleDateString();

    let csv = "Date,Category,Start,End,Duration\r\n";
    const grossDisplay = document.getElementById('work-duration').querySelector('span:last-child').textContent;
    csv += `${today},Shift,${inT},${outT},${grossDisplay}\r\n`;

    breaks.forEach((row, i) => {
        const s = row.querySelector('.break-start').value;
        const e = row.querySelector('.break-end').value;
        const d = row.querySelector('.break-duration-display').textContent;
        if (s && e) csv += `${today},Break ${i+1},${s},${e},${d}\r\n`;
    });

    csv += `\r\n,,,NET TOTAL,${net}\r\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `WorkLog_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * --- Core Engine ---
 */
const calculate = () => {
    const inT = document.getElementById('in-time').value;
    const outT = document.getElementById('out-time').value;
    const bRows = document.querySelectorAll('.break-row');
    const rBtn = document.getElementById('reset-btn');
    const eBtn = document.getElementById('export-btn');
    const banner = document.getElementById('net-duration-section');
    const errorMsg = document.getElementById('error-message');
    const netCard = document.getElementById('net-card');
    const netLabel = document.getElementById('net-label');

    // Persistence
    const state = { inT, outT, breaks: Array.from(bRows).map(r => ({
        s: r.querySelector('.break-start').value,
        e: r.querySelector('.break-end').value
    }))};
    localStorage.setItem('pro_tracker_v3', JSON.stringify(state));

    // Button State
    let hasData = !!(inT || outT);
    if (!hasData) {
        for (let r of bRows) {
            if (r.querySelector('.break-start').value || r.querySelector('.break-end').value) {
                hasData = true; break;
            }
        }
    }
    rBtn.disabled = !hasData;
    eBtn.disabled = !hasData;

    const startM = tToM(inT);
    const endM = tToM(outT);
    
    if (!inT || !outT) {
        document.getElementById('work-duration').querySelector('span:last-child').textContent = '0h 0m';
        banner.classList.add('hidden');
        return;
    }

    const gross = endM - startM;
    banner.classList.remove('hidden');
    errorMsg.textContent = "";

    // ERROR: Inverse Work Time
    if (gross <= 0) {
        setUIError("⛔ Out-time must be later than In-time");
        return;
    }

    document.getElementById('work-duration').querySelector('span:last-child').textContent = formatTime(gross);

    let totalB = 0;
    let intervals = [];
    let hasError = false;

    bRows.forEach((r, idx) => {
        const s = r.querySelector('.break-start').value;
        const e = r.querySelector('.break-end').value;
        const disp = r.querySelector('.break-duration-display');
        r.classList.remove('ring-2', 'ring-red-400', 'bg-red-50');
        disp.classList.remove('text-red-500');
        disp.classList.add('text-blue-600');

        if (!s && !e) {
            disp.textContent = '-';
            return;
        }

        if (!s || !e) {
            hasError = true;
            disp.textContent = '...';
            return;
        }

        const bS = tToM(s);
        const bE = tToM(e);
        const bD = bE - bS;

        // ERROR: Break Bounds or Negative duration
        if (bD <= 0 || bS < startM || bE > endM) {
            r.classList.add('ring-2', 'ring-red-400', 'bg-red-50');
            disp.textContent = 'ERR';
            disp.classList.replace('text-blue-600', 'text-red-500');
            hasError = true;
            errorMsg.textContent = "Breaks must be within work hours";
        } else {
            // ERROR: Overlap Check
            let overlap = false;
            for (let i of intervals) {
                if (bS < i.end && i.start < bE) {
                    overlap = true; break;
                }
            }

            if (overlap) {
                r.classList.add('ring-2', 'ring-red-400', 'bg-red-50');
                disp.textContent = 'LAP';
                disp.classList.replace('text-blue-600', 'text-red-500');
                hasError = true;
                errorMsg.textContent = "Break intervals cannot overlap";
            } else {
                disp.textContent = formatTime(bD);
                totalB += bD;
                intervals.push({ start: bS, end: bE });
            }
        }
    });

    document.getElementById('total-break-duration').textContent = `Total breaks: ${formatTime(totalB)}`;
    
    if (hasError) {
        setUIError(errorMsg.textContent || "Check break entries");
    } else {
        const net = gross - totalB;
        setUISuccess(formatTime(net));
    }
};

const setUIError = (msg) => {
    const netCard = document.getElementById('net-card');
    const netLabel = document.getElementById('net-label');
    const netDuration = document.getElementById('net-duration');
    const errorMsg = document.getElementById('error-message');

    netCard.classList.replace('bg-emerald-500', 'bg-slate-200');
    netCard.classList.replace('border-emerald-700', 'border-slate-400');
    netCard.classList.remove('shadow-emerald-200');
    netLabel.classList.replace('text-emerald-100', 'text-slate-500');
    netDuration.classList.replace('text-white', 'text-slate-600');
    netDuration.textContent = "---";
    errorMsg.textContent = msg;
};

const setUISuccess = (val) => {
    const netCard = document.getElementById('net-card');
    const netLabel = document.getElementById('net-label');
    const netDuration = document.getElementById('net-duration');
    
    netCard.classList.add('bg-emerald-500');
    netCard.classList.add('border-emerald-700');
    netCard.classList.add('shadow-emerald-200');
    netCard.classList.remove('bg-slate-200', 'border-slate-400');
    netLabel.classList.replace('text-slate-500', 'text-emerald-100');
    netDuration.classList.replace('text-slate-600', 'text-white');
    netDuration.textContent = val;
};

/**
 * --- Row Management ---
 */
const updateDeleteButtons = () => {
    const rows = document.querySelectorAll('.break-row');
    rows.forEach(row => {
        const btn = row.querySelector('.del-btn');
        rows.length <= 1 ? btn.classList.add('invisible') : btn.classList.remove('invisible');
    });
};

const addBreak = (defS = '', defE = '') => {
    const container = document.getElementById('breaks-container');
    const div = document.createElement('div');
    div.className = 'break-row glass-card border border-slate-200 rounded-2xl p-4 flex items-center gap-3 transition-all';
    
    div.innerHTML = `
        <input type="time" class="break-start bg-transparent font-bold text-sm outline-none w-24" value="${defS}">
        <div class="h-4 w-[1px] bg-slate-200"></div>
        <input type="time" class="break-end bg-transparent font-bold text-sm outline-none w-24" value="${defE}">
        <span class="break-duration-display flex-grow text-right text-[10px] font-black text-blue-600 uppercase tracking-tighter">-</span>
        <button class="del-btn p-2 text-slate-300 hover:text-red-500 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
    `;
    
    container.appendChild(div);
    div.querySelectorAll('input').forEach(i => i.addEventListener('change', calculate));
    div.querySelector('.del-btn').addEventListener('click', () => { 
        div.remove(); 
        updateDeleteButtons(); 
        calculate(); 
    });
    
    updateDeleteButtons();
    calculate();
};

/**
 * --- Initialization ---
 */
document.addEventListener('DOMContentLoaded', () => {
    updateDateDisplay();
    const saved = JSON.parse(localStorage.getItem('pro_tracker_v3') || 'null');
    
    if (saved) {
        document.getElementById('in-time').value = saved.inT || '';
        document.getElementById('out-time').value = saved.outT || '';
        if (saved.breaks && saved.breaks.length > 0) {
            saved.breaks.forEach(b => addBreak(b.s, b.e));
        } else {
            addBreak();
        }
    } else {
        addBreak();
    }

    document.getElementById('in-time').addEventListener('change', calculate);
    document.getElementById('out-time').addEventListener('change', calculate);
    document.getElementById('add-break-btn').addEventListener('click', () => addBreak());
    document.getElementById('export-btn').addEventListener('click', handleExport);
    document.getElementById('reset-btn').addEventListener('click', () => {
        if(confirm("Wipe all data for today?")) { 
            localStorage.removeItem('pro_tracker_v3'); 
            location.reload(); 
        }
    });
});
