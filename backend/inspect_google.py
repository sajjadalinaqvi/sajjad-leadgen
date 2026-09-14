import asyncio
import urllib.parse
from playwright.async_api import async_playwright

async def inspect_google(query):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        print("Google Page Title:", await page.title())
        content = await page.content()
        print("HTML length:", len(content))
        if "captcha" in content.lower():
            print("Google returned CAPTCHA!")
        else:
            print("First 500 chars of body:", content[:500])
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_google('Pakistani doctors London'))
