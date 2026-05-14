const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// target common button patterns that don't have active:scale-95 yet
code = code.replace(/transition-all"/g, 'transition-all hover:scale-105 active:scale-95"');
code = code.replace(/transition-colors"/g, 'transition-all duration-200 hover:scale-105 active:scale-95"');

// Deduplicate if we accidentally doubled up 
code = code.replace(/hover:scale-105 hover:scale-105/g, 'hover:scale-105');
code = code.replace(/active:scale-95 active:scale-95/g, 'active:scale-95');

// Make sure that app-card doesn't scale 105, it should be scale-[1.01] built in css,
// so let's remove hover:scale-105 from app-cards if we accidentally added it
code = code.replace(/(className="app-card[^"]*)hover:scale-105/g, '$1');
code = code.replace(/(className="app-card[^"]*)active:scale-95/g, '$1');

// Actually let's just make sure app-card doesn't scale weirdly.
code = code.replace(/className="app-card[^"]*"/g, match => {
  return match.replace(/hover:scale-105/g, '').replace(/active:scale-95/g, '');
});

// A lot of cards had hover:border-zinc-300, we can also give them hover:scale-[1.01] if they don't have .app-card
// We'll trust the global replace for now, but `transition-all` might be on other things too, like divs.
// It's mostly buttons though.

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx animations updated');
