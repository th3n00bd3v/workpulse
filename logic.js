const TimeLogic = {
    parseTime: (str) => {
        if (str == null || String(str).trim() === '') return { valid: false, minutes: 0 };
        const match = String(str).trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return { valid: false, minutes: 0 };
        const h = Number(match[1]);
        const m = Number(match[2]);
        if (h > 23 || m > 59) return { valid: false, minutes: 0 };
        return { valid: true, minutes: h * 60 + m };
    },
    isValidTime: (str) => TimeLogic.parseTime(str).valid,
    toMin: (t) => {
        return TimeLogic.parseTime(t).minutes;
    },
    duration: (start, end) => {
        if (!start || !end) return 0;
        const s = TimeLogic.parseTime(start);
        const e = TimeLogic.parseTime(end);
        if (!s.valid || !e.valid) return 0;
        if (s.minutes === e.minutes) return 1440;
        if (e.minutes > s.minutes) return e.minutes - s.minutes;
        return (1440 - s.minutes) + e.minutes;
    },
    fmt: (min) => {
        if (min < 0 || isNaN(min)) return "0m";
        const h = Math.floor(min / 60), m = min % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    },
    getTimestamp: () => {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
    },
    generateCSV: (shift, breaks, grossStr, netStr) => {
        let csv = `Category,In,Out,Duration\n`;
        csv += `Shift,${shift.in || '-'},${shift.out || '-'},${grossStr}\n`;
        breaks.forEach((b, i) => {
            if (b.s && b.e) csv += `Break ${i+1},${b.s},${b.e},${b.dur}\n`;
        });
        csv += `\n,,NET TOTAL,${netStr}`;
        return csv;
    }
};
