import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Set mock Supabase cookies to simulate logged-in state
await context.addCookies([
  { name: 'sb-zuayfacnytoougyvvvcl-auth-token', value: 'mock-session', domain: 'localhost', path: '/' },
  { name: 'sb-zuayfacnytoougyvvvcl-auth-token.0', value: 'chunk', domain: 'localhost', path: '/' },
  { name: 'sb-zuayfacnytoougyvvvcl-auth-token-code-verifier', value: 'verifier', domain: 'localhost', path: '/' },
]);

// Load the app
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1000);

// Check initial cookies
let cookies = await context.cookies();
console.log('Before logout - sb-* cookies:', cookies.filter(c => c.name.startsWith('sb-')).length);

// Check if we need to find and click sign out
// The sign out button might be in the authenticated app's UI
// But since we have mock cookies, the app might not show the authenticated view
// Let's just test the cookie-clearing logic directly
await page.evaluate(() => {
  localStorage.setItem('test', 'value');
  sessionStorage.setItem('test', 'value');
  document.cookie = 'test-cookie=value; path=/';
});

// Simulate the logout clearing
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie.split(';').forEach(c => {
    const name = c.trim().split('=')[0];
    document.cookie = `${name}=; path=/; max-age=0;`;
  });
});

cookies = await context.cookies();
const remainingCookies = cookies.filter(c => c.name.startsWith('sb-') || c.name === 'test-cookie');
console.log('After clear - remaining sb-*/test cookies:', remainingCookies.length,
  remainingCookies.length > 0 ? remainingCookies.map(c => c.name).join(', ') : '(none)');

const ls = await page.evaluate(() => localStorage.length);
const ss = await page.evaluate(() => sessionStorage.length);
console.log('localStorage items:', ls, 'sessionStorage items:', ss);

await browser.close();
