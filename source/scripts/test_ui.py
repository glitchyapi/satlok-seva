"""End-to-end UI smoke test for the Satlok Seva web bundle.
Runs the exact code shipped inside the APK, in a real Chromium engine.
"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8080/index.html"
SHOTS = "/home/user/seva-app/test-shots"
os.makedirs(SHOTS, exist_ok=True)

async def main():
    errors, console_errors, failed_req = [], [], []
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path="/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args=["--no-sandbox","--disable-dev-shm-usage"])
        ctx = await b.new_context(viewport={"width":390,"height":844},
                                  device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: console_errors.append(m.text) if m.type=="error" else None)
        pg.on("requestfailed", lambda r: failed_req.append(r.url+" "+str(r.failure)))

        await pg.goto(URL, wait_until="networkidle")
        await pg.wait_for_timeout(2200)   # splash

        async def shot(name):
            await pg.screenshot(path=f"{SHOTS}/{name}.png")

        # ── onboarding ──
        assert await pg.is_visible("#onboarding"), "onboarding should show on first run"
        await shot("01-onboarding")
        await pg.fill("#obName", "राम कुमार")
        await pg.click("#obNext"); await pg.wait_for_timeout(450)
        await pg.click("#obNext"); await pg.wait_for_timeout(450)
        await shot("02-onboarding-3")
        await pg.click("#obNext"); await pg.wait_for_timeout(900)
        assert await pg.is_visible("#app"), "app shell should be visible"
        await shot("03-home-empty")

        # ── log sevas via quick add ──
        for tid, qty in [("jaap",5), ("satsang",1), ("paath",10)]:
            await pg.click(f'[data-quick="{tid}"]')
            await pg.wait_for_timeout(450)
            await pg.fill("#aQty", str(qty))
            await pg.fill("#aPlace", "सतलोक आश्रम")
            await pg.fill("#aNote", "सत साहिब जी 🙏")
            await pg.click("#btnSaveSeva")
            await pg.wait_for_timeout(700)
        await shot("04-home-with-seva")

        pct = await pg.text_content("#ringPct")
        total = await pg.text_content("#stTotal")
        print(f"  home: ring={pct} total={total}")
        assert total == "3", f"expected 3 sevas, got {total}"

        # ── seva screen + ranges ──
        await pg.click('.tab[data-goto="seva"]'); await pg.wait_for_timeout(550)
        await shot("05-seva-today")
        for r in ["week","month","all"]:
            await pg.click(f'#sevaSeg button[data-range="{r}"]'); await pg.wait_for_timeout(300)
        await pg.click('#sevaSeg button[data-range="today"]'); await pg.wait_for_timeout(300)

        # search
        await pg.click("#btnSearch"); await pg.wait_for_timeout(250)
        await pg.fill("#searchInput", "जप"); await pg.wait_for_timeout(400)
        n = await pg.locator("#sevaList .seva-item").count()
        print(f"  search 'जप' → {n} item(s)")
        assert n == 1, f"search should match 1, got {n}"
        await pg.fill("#searchInput", ""); await pg.click("#btnSearch"); await pg.wait_for_timeout(300)

        # detail + edit
        await pg.click("#sevaList .seva-item"); await pg.wait_for_timeout(550)
        await shot("06-seva-detail")
        await pg.click(".sheet.on [data-close]"); await pg.wait_for_timeout(450)

        # ── bhandara event ──
        await pg.click('.tab[data-goto="bhandara"]'); await pg.wait_for_timeout(550)
        await shot("07-bhandara-empty")
        await pg.click("#btnNewBhan"); await pg.wait_for_timeout(500)
        await pg.fill("#eTitle", "विशाल भंडारा — बड़वाला")
        await pg.fill("#eDate", "2026-09-15")
        await pg.fill("#eTime", "11:00")
        await pg.fill("#eVenue", "सतलोक आश्रम, बड़वाला, हिसार")
        await pg.fill("#eOrg", "समस्त सतभक्त संगत")
        await pg.fill("#ePhone", "+91 98765 43210")
        await pg.click("#btnSaveBhan"); await pg.wait_for_timeout(800)
        await shot("08-bhandara-event")

        # ── banner generator ──
        await pg.click('#bhanSeg button[data-tab="banner"]'); await pg.wait_for_timeout(700)
        await pg.fill("#bTitle", "विशाल भंडारा")
        await pg.fill("#bSub", "संत रामपाल जी महाराज की कृपा से")
        await pg.fill("#bDate", "2026-09-15")
        await pg.fill("#bVenue", "सतलोक आश्रम, बड़वाला")
        await pg.fill("#bOrg", "समस्त सतभक्त संगत")
        await pg.fill("#bPhone", "+91 98765 43210")
        await pg.wait_for_timeout(700)
        await shot("09-banner-saffron")
        # banner must actually have pixels
        info = await pg.evaluate("""() => {
          const c=document.getElementById('bannerCanvas');
          const g=c.getContext('2d'); const d=g.getImageData(0,0,c.width,c.height).data;
          let nonBlank=0; for(let i=0;i<d.length;i+=4000) if(d[i+3]>0) nonBlank++;
          return {w:c.width,h:c.height,nonBlank};
        }""")
        print(f"  banner: {info}")
        assert info["w"]==1080 and info["nonBlank"]>100, "banner canvas not rendered"
        await pg.locator("#bannerCanvas").screenshot(path=f"{SHOTS}/09b-banner-full.png")

        for tpl in ["royal","emerald","night","cream"]:
            await pg.click(f'[data-tpl="{tpl}"]'); await pg.wait_for_timeout(400)
        await pg.locator("#bannerCanvas").screenshot(path=f"{SHOTS}/10-banner-cream.png")
        await pg.click('[data-tpl="saffron"]'); await pg.wait_for_timeout(300)
        await pg.select_option("#bRatio","9:16"); await pg.wait_for_timeout(500)
        await pg.locator("#bannerCanvas").screenshot(path=f"{SHOTS}/11-banner-status.png")
        await pg.select_option("#bRatio","4:5"); await pg.wait_for_timeout(400)

        # ── stats ─
        await pg.click('.tab[data-goto="stats"]'); await pg.wait_for_timeout(700)
        await shot("12-stats")
        bars = await pg.locator("#bars7 .bar").count()
        legend = await pg.locator("#legend .lg-row").count()
        print(f"  stats: {bars} bars, {legend} legend rows")
        assert bars==7 and legend==3

        # ── settings ─
        await pg.evaluate("window.go('settings')"); await pg.wait_for_timeout(700)
        await shot("13-settings")
        sm = await pg.evaluate("() => ({raw:Store.stats.raw, stored:Store.stats.stored, mode:Store.mode})")
        print(f"  storage: {sm}")
        assert sm["stored"] < sm["raw"], "compression should shrink data"

        # ── language switch → English ──
        await pg.click("#rowLang"); await pg.wait_for_timeout(500)
        await pg.click('[data-pick="en"]'); await pg.wait_for_timeout(800)
        await shot("14-settings-english")
        title = await pg.text_content("#scr-settings .tb-title")
        print(f"  after lang switch, settings title = {title}")
        assert title == "Settings", f"i18n failed: {title}"
        await pg.evaluate("window.go('home')"); await pg.wait_for_timeout(600)
        await shot("15-home-english")

        # ── dark mode ──
        await pg.evaluate("window.go('settings')"); await pg.wait_for_timeout(500)
        await pg.click("#rowTheme"); await pg.wait_for_timeout(450)
        await pg.click('[data-pick="dark"]'); await pg.wait_for_timeout(700)
        await pg.evaluate("window.go('home')"); await pg.wait_for_timeout(700)
        await shot("16-home-dark")
        theme = await pg.get_attribute("html","data-theme")
        assert theme=="dark", "dark theme not applied"

        # ── persistence across reload ──
        await pg.reload(wait_until="networkidle"); await pg.wait_for_timeout(2300)
        st = await pg.evaluate("() => ({n:Store.data.sevas.length, b:Store.data.bhandaras.length, lang:Store.data.settings.lang, theme:Store.data.settings.theme, name:Store.data.settings.name})")
        print(f"  after reload: {st}")
        assert st["n"]==3 and st["b"]==1 and st["lang"]=="en" and st["theme"]=="dark", "persistence failed"
        await shot("17-reloaded")

        # ── Punjabi ──
        await pg.evaluate("window.go('settings')"); await pg.wait_for_timeout(450)
        await pg.click("#rowLang"); await pg.wait_for_timeout(450)
        await pg.click('[data-pick="pa"]'); await pg.wait_for_timeout(800)
        await pg.evaluate("window.go('home')"); await pg.wait_for_timeout(600)
        await shot("18-home-punjabi-dark")

        await b.close()

    print("\n── results ──")
    print("page errors:", len(errors))
    for e in errors: print("  ✖", e)
    print("console errors:", len(console_errors))
    for e in console_errors[:10]: print("  ⚠", e)
    print("failed requests:", len(failed_req))
    for e in failed_req[:10]: print("  ⚠", e)
    if errors: sys.exit(1)
    print("\n✅ ALL UI TESTS PASSED")

asyncio.run(main())
