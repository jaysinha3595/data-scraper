const express = require("express");
const serverless = require("serverless-http");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();
app.use(require("cors")()); // Enable CORS

app.get("/scrape", async (req, res) => {
    let browser;
    try {
        const accountNo = req.query.accountNo;
        if (!accountNo) {
            return res.status(400).json({ success: false, error: "Missing accountNo parameter" });
        }

        // Launch Puppeteer with Vercel-compatible Chromium
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreDefaultArgs: ["--disable-extensions"]
        });

        const page = await browser.newPage();
        const url = `https://nccprodcp.quantumtechnologiesltd.com/cportal/#/guest/secure/dorecharge?accountNo=${accountNo}`;
        await page.goto(url, { waitUntil: "networkidle2" });

        // Extract table data
        const data = await page.evaluate(() => {
            const rawData = document.querySelector("tbody")?.innerText || "";
            if (!rawData) return null; // Return null if no data found
            
            const lines = rawData.split("\n").map(line => line.split("\t"));
            const getValue = (row, col) => (lines[row] && lines[row][col]) ? lines[row][col].trim() : "N/A";

            return {
                name: getValue(0, 1),
                accountNo: getValue(0, 3),
                lastRechargeDate: getValue(1, 1),
                lastRechargeAmount: getValue(1, 3).replace(/₹|,/g, ""),
                currentStatus: getValue(2, 1),
                availableBalance: getValue(2, 3).replace(/₹|,/g, "")
            };
        });

        await browser.close();

        if (!data) {
            return res.status(404).json({ success: false, error: "No data found on page" });
        }

        return res.json({ success: true, data });

    } catch (error) {
        if (browser) await browser.close();
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;
module.exports.handler = serverless(app);
