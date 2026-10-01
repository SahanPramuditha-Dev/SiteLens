# Technology identification logos

75 local logos support the technology catalog. SVG marks come from Iconify's SVG Logos collection (Gil Barbara) and Simple Icons. Their collection licenses are CC0-1.0; individual brand marks remain their owners' trademarks. `SOURCES.json` records each asset's source and license. Microsoft IIS/Clarity, Cloudflare Turnstile and Adobe Fonts use their parent brand marks where a dedicated product mark is unavailable.

Crisp, LiteSpeed and Tawk.to PNG marks come from the vendors' public websites and are retained unmodified for identification. These vendor assets are not represented as CC0. LiteSpeed's published branding guidance requests vendor approval for promotional use; this application's logos identify detected technologies and imply no partnership or endorsement. Vendor images are not rewritten by the generator.

Run `node scripts/generate-technology-logos.mjs` after installing the pinned development dependencies to regenerate local SVGs, lookup metadata and report data images. Generation reads already stored vendor PNGs. Building and inspecting sites does not fetch brand assets. The dashboard loads packaged assets, and HTML/PDF reports embed only the logos of included technologies.

Sources: https://github.com/gilbarbara/logos · https://github.com/simple-icons/simple-icons · https://www.litespeedtech.com/media-kit/branding
