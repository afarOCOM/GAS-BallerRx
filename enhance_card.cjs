const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/transition-all  /g, 'transition-all duration-300 hover:scale-[1.01] hover:shadow-lg dark:hover:shadow-zinc-800/50');
code = code.replace(/transition-all group/g, 'transition-all duration-300 hover:scale-[1.01] hover:shadow-lg dark:hover:shadow-zinc-800/50 group');

code = code.replace(/bg-zinc-900 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden app-card border-none/g, 
  'bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-2xl relative overflow-hidden app-card border-none');

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx app-card fixes');
