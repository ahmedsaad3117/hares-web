
const fs = require('fs');

function check(file) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    const stack = [{}];
    let count = 0;

    // Simple parser that tracks keys in each object
    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // Check for key
        const keyMatch = line.match(/"([^"]+)":/);
        if (keyMatch) {
            const key = keyMatch[1];
            const currentScope = stack[stack.length - 1];
            if (currentScope[key]) {
                console.log(`DUPLICATE KEY in ${file} at line ${i + 1}: "${key}" (previously at line ${currentScope[key]})`);
                count++;
            }
            currentScope[key] = i + 1;
        }

        // Must handle the case where a key and its value are on the same line but start an object
        if (line.includes('{')) {
            // Push a new scope for each {
            // Number of { might be more than one? Usually one per line in this file.
            const braces = (line.match(/\{/g) || []).length;
            for (let b = 0; b < braces; b++) stack.push({});
        }
        if (line.includes('}')) {
            const braces = (line.match(/\}/g) || []).length;
            for (let b = 0; b < braces; b++) stack.pop();
        }
    });
    return count;
}

check('c:/Users/MARWAN/Desktop/q1key/q1key-web-main/q1key-web-main/i18n/ar.json');
check('c:/Users/MARWAN/Desktop/q1key/q1key-web-main/q1key-web-main/i18n/en.json');
