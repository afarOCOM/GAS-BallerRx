const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(
  /.app-card \{\n    @apply (.*?);\n  \}/g,
  '.app-card {\n    @apply $1 hover:scale-[1.01] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.2)];\n  }'
);

code = code.replace(
  /.btn-primary \{\n    @apply (.*?);\n  \}/g,
  '.btn-primary {\n    @apply $1 hover:scale-105 active:scale-95 duration-200 hover:shadow-xl;\n  }'
);

code = code.replace(
  /.btn-ghost \{\n    @apply (.*?);\n  \}/g,
  '.btn-ghost {\n    @apply $1 hover:scale-[1.02] active:scale-95 duration-200;\n  }'
);

code = code.replace(
  /.btn-ghost-active \{\n    @apply (.*?);\n  \}/g,
  '.btn-ghost-active {\n    @apply $1 hover:scale-[1.02] active:scale-95 duration-200 transition-all;\n  }'
);

fs.writeFileSync('src/index.css', code);
console.log('index.css updated');
