
const fs = require('fs');

function findDubs(file) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let levels = [new Set()];
    let dups = [];

    lines.forEach((line, i) => {
        // Very simple brace counting
        if (line.includes('{')) {
            levels.push(new Set());
        }

        let match = line.match(/"([^"]+)":/);
        if (match) {
            let key = match[1];
            let current = levels[levels.length - 1];
            if (current && current.has(key)) {
                dups.push({ key, line: i + 1 });
            }
            if (current) current.add(key);
        }

        if (line.includes('}')) {
            levels.pop();
        }
    });
    return dups;
}

console.log('AR:', findDubs('c:/Users/MARWAN/Desktop/q1key/q1key-web-main/q1key-web-main/i18n/ar.json'));
console.log('EN:', findDubs('c:/Users/MARWAN/Desktop/q1key/q1key-web-main/q1key-web-main/i18n/en.json'));
