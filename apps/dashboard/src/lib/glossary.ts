export const GLOSSARY: Record<string, string> = {
  'XSS': "Cross-Site Scripting (XSS) allows hackers to run malicious scripts on your website, potentially stealing user data or hijacking accounts.",
  'DOM XSS': "DOM XSS happens when a hacker manipulates the code on a webpage to run malicious scripts in the user's browser.",
  'CORS': "Cross-Origin Resource Sharing (CORS) is a security feature that controls which other websites are allowed to request data from your server.",
  'CSP': "Content Security Policy (CSP) is a strict list of rules you give the browser, telling it exactly which scripts and images are safe to load.",
  'HSTS': "HTTP Strict Transport Security (HSTS) forces web browsers to strictly use secure HTTPS connections, preventing hackers from downgrading users to insecure HTTP.",
  'COOP': "Cross-Origin-Opener-Policy prevents malicious websites from opening your site in a pop-up and trying to steal information.",
  'COEP': "Cross-Origin-Embedder-Policy prevents other sites from embedding your site's content unless you explicitly allow it.",
  'SRI': "Subresource Integrity (SRI) acts like a wax seal on a letter. It ensures the script you load from a third-party hasn't been tampered with.",
  'Trusted Types': "Trusted Types is a modern browser feature that locks down the ways developers can insert code into a webpage, completely stopping most DOM XSS attacks.",
  'Source Map': "Source Maps are translation files that help developers debug code. If left public, they expose your original, unminified source code to the world.",
};