// Keep the previous prototype and its existing save keys intact for comparison.
if(new URLSearchParams(location.search).get('edition')==='legacy')void Promise.all([import('./ui/style.css'),import('./journey/main')]);
else void import('./evolution/main');
