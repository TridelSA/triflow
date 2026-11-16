"""Fabrique les icônes PNG de TriFlow à partir de logo.svg (navigateur Chromium de Playwright).
Usage : python3 outils/logo.py   (à relancer après une modification de logo.svg)"""
import asyncio, os
from playwright.async_api import async_playwright
ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIES = [('icon-512.png', 512, 0), ('icon-192.png', 192, 0), ('apple-touch-icon.png', 180, 0), ('icon-maskable-512.png', 512, 0.12)]
async def main():
    svg = open(os.path.join(ICI, 'logo.svg'), encoding='utf-8').read()
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": "/opt/pw-browsers/chromium"} if os.path.isfile("/opt/pw-browsers/chromium") else {}))
        for nom, taille, marge in SORTIES:
            pg = await b.new_page(viewport={'width': taille, 'height': taille})
            fond = '#0B6238' if marge else 'transparent'
            pad = int(taille * marge)
            await pg.set_content(f'<html><body style="margin:0;background:{fond}"><div style="padding:{pad}px;width:{taille-2*pad}px;height:{taille-2*pad}px">{svg.replace("width=\"512\" height=\"512\"", "width=\"100%\" height=\"100%\"")}</div></body></html>')
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=os.path.join(ICI, nom), omit_background=not marge)
            await pg.close()
        await b.close()
asyncio.run(main())
