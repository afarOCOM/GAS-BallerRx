const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/prose prose-slate(?!\s*dark:prose-invert)/g, "prose prose-slate dark:prose-invert");
fs.writeFileSync('src/App.tsx', content);
