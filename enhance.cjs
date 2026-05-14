const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The main layout background to include bg-dot-pattern
code = code.replace(
  'className="flex bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-800 dark:text-zinc-200 overflow-x-hidden font-sans"',
  'className="flex bg-zinc-50 dark:bg-zinc-950 bg-dot-pattern min-h-screen text-zinc-800 dark:text-zinc-200 overflow-x-hidden font-sans"'
);

// We had some elements using text-zinc-600 dark:text-zinc-400, let's make them text-zinc-900 dark:text-zinc-50 for high contrast
code = code.replace(/text-zinc-600 dark:text-zinc-400/g, 'text-zinc-900 dark:text-zinc-100');
code = code.replace(/text-zinc-600/g, 'text-zinc-900');

// Replace bg-zinc-600 with high contrast bg-zinc-900 / dark:bg-zinc-100
code = code.replace(/bg-zinc-600/g, 'bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900');
code = code.replace(/text-white rounded-2xl/g, 'rounded-2xl'); // strip overlapping text-white since we use text-zinc-50
// And hover states
code = code.replace(/hover:bg-zinc-700/g, 'hover:bg-zinc-800 dark:hover:bg-zinc-200');

code = code.replace(/bg-zinc-500/g, 'bg-zinc-900 dark:bg-zinc-100');
code = code.replace(/border-zinc-600/g, 'border-zinc-900 dark:border-zinc-100');

// Make the big percentage text use Space Grotesk
code = code.replace(/text-6xl font-black/g, 'text-6xl font-black font-display tracking-tight');
code = code.replace(/text-4xl font-bold/g, 'text-4xl font-black font-display tracking-tight');
code = code.replace(/text-3xl font-bold/g, 'text-3xl font-black font-display tracking-tight');

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated.');
