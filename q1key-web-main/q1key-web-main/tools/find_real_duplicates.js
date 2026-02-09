
const fs = require('fs');

function checkDuplicateKeys(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const stack = [{}];
    const duplicates = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.endsWith('{')) {
            stack.push({});
        } else if (trimmed === '}' || trimmed === '},') {
            stack.pop();
        } else {
            const match = line.match(/"([^"]+)":/);
            if (match) {
                const key = match[1];
                const currentObj = stack[stack.length - 1];
                if (currentObj[key]) {
                    duplicates.push({ key, line: index + 1, prevLine: currentObj[key] });
                }
                currentObj[key] = index + 1;
            }
        }
    });

    return duplicates;
}

const arDups = checkDuplicateKeys('c:/Users/MARWAN/Desktop/q1key/q1key-web-main/q1key-web-main/i18n/ar.json');
const enDups = checkDuplicateKeys('c:/Users/MARWAN/Desktop/q1key/q1key-web-main/q1key-web-main/i18n/en.json');

console.log('Real Duplicates AR:', arDups);
console.log('Real Duplicates EN:', enDups);
