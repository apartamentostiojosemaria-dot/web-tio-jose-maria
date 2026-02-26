const icsText = `BEGIN:VCALENDAR
PRODID:-//Bookiply//iCal4j 1.0//EN
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTAMP:20260226T111748Z
DTSTART;VALUE=DATE:20260731
DTEND;VALUE=DATE:20260802
SUMMARY:Encarnacion Ariza Martin
UID:40f36ecd1186689aa08170ff70ffa65ffcf0734c@bookiply.com
END:VEVENT
END:VCALENDAR`;

const events = icsText.split('BEGIN:VEVENT');
events.shift();

const allBlockedDates = [];
events.forEach(event => {
    const startMatch = event.match(/^DTSTART(?:;[^:]*)?:(\d{8})/m);
    const endMatch = event.match(/^DTEND(?:;[^:]*)?:(\d{8})/m);
    console.log('Match Start:', startMatch ? startMatch[1] : 'null');
    console.log('Match End:', endMatch ? endMatch[1] : 'null');

    if (startMatch && endMatch) {
        const startStr = startMatch[1];
        const endStr = endMatch[1];
        allBlockedDates.push({
            start_date: `${startStr.slice(0, 4)}-${startStr.slice(4, 6)}-${startStr.slice(6, 8)}`,
            end_date: `${endStr.slice(0, 4)}-${endStr.slice(4, 6)}-${endStr.slice(6, 8)}`
        });
    }
});

console.log('Results:', JSON.stringify(allBlockedDates, null, 2));
