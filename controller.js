const App = {
    key: 'workpulse_blue_glass_session',
    MAX_BREAKS: 20,
    init() { this.cacheDOM(); this.bindEvents(); this.load(); this.startClock(); },
    cacheDOM() {
        this.dom = {
            in: document.getElementById('in-time'),
            out: document.getElementById('out-time'),
            container: document.getElementById('breaks-container'),
            gross: document.getElementById('gross-output'),
            net: document.getElementById('net-output'),
            netCard: document.getElementById('net-card-container'),
            err: document.getElementById('error-output'),
            reset: document.getElementById('reset-btn'),
            export: document.getElementById('export-btn'),
            addBtn: document.getElementById('add-break-btn'),
            totalB: document.getElementById('total-break-display'),
            dateDisplay: document.getElementById('current-date')
        };
    },
    bindEvents() {
        this.dom.in.onchange = this.dom.out.onchange = () => this.update();
        this.dom.addBtn.onclick = () => this.addRow();
        this.dom.reset.onclick = () => this.reset();
        this.dom.export.onclick = () => this.handleExport();
    },
    addRow(s = '', e = '') {
        const rowCount = document.querySelectorAll('.break-row').length;
        if (rowCount >= this.MAX_BREAKS) return;
        const row = document.createElement('div');
        row.className = 'break-row p-3 grid grid-cols-[1fr_1fr] sm:grid-cols-[1fr_1fr_1fr_44px] items-center gap-2 sm:gap-3 animate-up';
        row.innerHTML = `
            <input type="text" inputmode="numeric" placeholder="--:--" class="b-start m-field" value="${s}">
            <input type="text" inputmode="numeric" placeholder="--:--" class="b-end m-field" value="${e}">
            <span class="b-dur m-dur">-</span>
            <button class="del-btn m-icon-btn m-icon-btn--error justify-self-center" aria-label="Remove break">
                <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-width="3"/></svg>
            </button>`;
        row.querySelectorAll('input').forEach(i => i.onchange = () => this.update());
        row.querySelector('.del-btn').onclick = () => {
            if (document.querySelectorAll('.break-row').length > 1) { row.remove(); this.update(); }
        };
        this.dom.container.appendChild(row);
        this.update();
    },
    update() {
        const rows = [...document.querySelectorAll('.break-row')];
        const isValidInput = (value) => value.trim() === '' || TimeLogic.isValidTime(value);
        let invalidTime = !isValidInput(this.dom.in.value) || !isValidInput(this.dom.out.value);
        const sMin = TimeLogic.toMin(this.dom.in.value);
        const eMin = TimeLogic.toMin(this.dom.out.value);
        const gross = TimeLogic.duration(this.dom.in.value, this.dom.out.value);
        const shiftInverted = (this.dom.in.value && this.dom.out.value && gross <= 0);

        this.dom.gross.textContent = shiftInverted ? "0h 0m" : (gross > 0 ? TimeLogic.fmt(gross) : "0h 0m");
        rows.forEach(r => r.querySelector('.del-btn').style.visibility = (rows.length === 1) ? 'hidden' : 'visible');

        let totalB = 0, overlap = false, outOfBounds = false, breakErr = false, intervals = [];
        const overnightShift = !!(this.dom.in.value && this.dom.out.value && eMin <= sMin);
        const shiftUpperBound = overnightShift ? sMin + gross : eMin;
        const normalizeToShift = (minutes) => {
            if (!overnightShift) return minutes;
            return minutes < sMin ? minutes + 1440 : minutes;
        };

        const breakData = rows.map(r => {
            const s = r.querySelector('.b-start').value, e = r.querySelector('.b-end').value;
            if (!isValidInput(s) || !isValidInput(e)) invalidTime = true;
            const start = TimeLogic.toMin(s), end = TimeLogic.toMin(e);
            let durStr = '-';
            if (start && end) {
                const dur = TimeLogic.duration(s, e);
                if (dur <= 0) { durStr = "ERR"; breakErr = true; }
                else {
                    durStr = TimeLogic.fmt(dur);
                    totalB += dur;
                    const normStart = normalizeToShift(start);
                    const normEnd = normalizeToShift(end);
                    const safeEnd = (normEnd <= normStart) ? normEnd + 1440 : normEnd;
                    if (intervals.some(i => normStart < i.e && i.s < safeEnd)) overlap = true;
                    if (normStart < sMin || safeEnd > shiftUpperBound) outOfBounds = true;
                    intervals.push({ s: normStart, e: safeEnd });
                }
            }
            r.querySelector('.b-dur').textContent = durStr;
            return { s, e, dur: durStr };
        });

        this.dom.totalB.textContent = TimeLogic.fmt(totalB);
        const hasShift = (this.dom.in.value && this.dom.out.value);

        if (invalidTime) this.dom.err.textContent = "Enter times as HH:MM";
        else if (shiftInverted) this.dom.err.textContent = "Check shift times";
        else if (breakErr) this.dom.err.textContent = "Check break times";
        else if (outOfBounds) this.dom.err.textContent = "Break outside shift";
        else if (overlap) this.dom.err.textContent = "Overlapping breaks";
        else this.dom.err.textContent = "";

        if (!invalidTime && !shiftInverted && !breakErr && !outOfBounds && !overlap && hasShift && gross > 0) {
            this.dom.netCard.classList.remove('opacity-20', 'grayscale');
            this.dom.net.textContent = TimeLogic.fmt(gross - totalB);
        } else {
            this.dom.netCard.classList.add('opacity-20', 'grayscale');
            this.dom.net.textContent = "--";
        }

        const canExport = !!(hasShift && !invalidTime && !shiftInverted && !breakErr && !outOfBounds && !overlap);
        this.dom.export.disabled = !canExport;
        this.dom.export.className = "m-icon-btn m-icon-btn--filled";
        this.dom.reset.disabled = !(this.dom.in.value || this.dom.out.value || rows.length > 1);
        localStorage.setItem(this.key, JSON.stringify({ in: this.dom.in.value, out: this.dom.out.value, breaks: breakData }));
    },
    handleExport() {
        if (this.dom.export.disabled) return;
        const rows = [...document.querySelectorAll('.break-row')];
        const breaks = rows.map(r => ({ s: r.querySelector('.b-start').value, e: r.querySelector('.b-end').value, dur: r.querySelector('.b-dur').textContent })).filter(b => b.s && b.e);
        const csv = TimeLogic.generateCSV({ in: this.dom.in.value, out: this.dom.out.value }, breaks, this.dom.gross.textContent, this.dom.net.textContent);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `WorkPulse_Export_${TimeLogic.getTimestamp()}.csv`; a.click();
    },
    startClock() {
        setInterval(() => {
            const now = new Date();
            this.dom.dateDisplay.innerHTML = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <span class="m-accent ml-1 font-black">${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>`;
        }, 1000);
    },
    load() {
        const data = JSON.parse(localStorage.getItem(this.key));
        this.dom.container.innerHTML = '';
        if (data) {
            this.dom.in.value = data.in || ''; this.dom.out.value = data.out || '';
            if (data.breaks?.length) data.breaks.forEach(b => this.addRow(b.s, b.e)); else this.addRow();
        } else this.addRow();
    },
    reset() { if (confirm("Clear session?")) { localStorage.removeItem(this.key); location.reload(); } }
};
document.addEventListener('DOMContentLoaded', () => App.init());
