const express = require("express");
const serverless = require("serverless-http");
const puppeteer = require("puppeteer-core");
const chromium = require("chrome-aws-lambda");


const app = express();
const PORT = process.env.PORT || 3000;

// Allow cross-origin requests (so Spring Boot can call this API)
const cors = require("cors");
app.use(cors());

app.get("/scrape", async (req, res) => {
    try {
        // Check if accountNo is provided
        let accountNo = req.query.accountNo;
        if (!accountNo) {
            return res.status(400).json({ success: false, error: "Missing accountNo parameter" });
        }

        const browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath,
            headless: chromium.headless
        });
        const page = await browser.newPage();
        const url = `https://nccprodcp.quantumtechnologiesltd.com/cportal/#/guest/secure/dorecharge?accountNo=${accountNo}`;

        await page.goto(url, { waitUntil: "networkidle2" });

        // Extract table data
        const data = await page.evaluate(() => {
            const rawData = document.querySelector("tbody")?.innerText || "";
            var lines = rawData.split("\n").map(line => line.split("\t"));
            const getValue = (row, col) => (lines[row] && lines[row][col]) ? lines[row][col].trim() : "N/A";
            return {
                name: getValue(0, 1),
                accountNo: getValue(0, 3),
                lastRechargeDate: getValue(1, 1),
                lastRechargeAmount: getValue(1, 3).replace(/₹/g, ""),
                currentStatus: getValue(2, 1),
                availableBalance: getValue(2, 3).replace("\"}","").replace(/₹/g, "")
            };
            
        });

        await browser.close();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;
module.exports.handler = serverless(app);

