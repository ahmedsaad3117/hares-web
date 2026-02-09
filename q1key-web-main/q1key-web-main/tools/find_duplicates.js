
const fs = require('fs');

function findDuplicateKeys(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const keys = {};
    const duplicates = [];

    lines.forEach((line, index) => {
        const match = line.match(/"([^"]+)":/);
        if (match) {
            const key = match[1];
            if (keys[key]) {
                keys[key].push(index + 1);
            } else {
                keys[key] = [index + 1];
            }
        }
    });

    for (const key in keys) {
        if (keys[key].length > 1) {
            duplicates.push({ key, lines: keys[key] });
        }
    }

    return duplicates;
}

const arDuplicates = findDuplicateKeys('c:/Users/MARWAN/Desktop/q1key/q1key-web-main/q1key-web-main/i18n/ar.json');
const enDuplicates = findDuplicateKeys('c:/Users/MARWAN/Desktop/q1key/q1key-web-main/q1key-web-main/i18n/en.json');

console.log('Arabic Duplicates:', JSON.stringify(arDuplicates, null, 2));
console.log('English Duplicates:', JSON.stringify(enDuplicates, null, 2));
