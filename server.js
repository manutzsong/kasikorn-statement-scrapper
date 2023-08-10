import puppeteer from "puppeteer";
import PusherServer from "pusher";
import express from "express";

const app = express();

const timer = (ms) => new Promise((res) => setTimeout(res, ms));

const PUSHER_ID = "";
const NEXT_PUBLIC_PUSHER_KEY = "";
const PUSHER_SECRET = "";
const NEXT_PUBLIC_PUSHER_CLUSTER = "ap1";

const pusherServerClient = new PusherServer({
  appId: PUSHER_ID,
  key: NEXT_PUBLIC_PUSHER_KEY,
  secret: PUSHER_SECRET,
  cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

let isBrowserClose = true;

const init = async () => {
  isBrowserClose = false;
  console.log("init...");
  try {
    const browser = await puppeteer.launch({
      // headless: false,
      headless: "new",
      executablePath: "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-gpu"],
    });
    console.log("finish launch browser");
    // const allPages = await browser.pages();
    // for (const p of allPages) {
    //   p.close();
    // }

    const page = await browser.newPage();
    console.log("new page");

    await page.goto("https://online.kasikornbankgroup.com/kbiz/");
    console.log("go to page");
    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 });
    // Type into search box
    await page.waitForSelector("#userName");
    console.log("done wait for input");
    await page.type("#userName", "witchy.witchuda");
    await page.type("#txtpassword", "*GDaF#pZ7HNeC9i");
    await page.click("#loginBtn");
    console.log("press login");

    // Wait and click on first result
    const accountInfoSelector = "div.account-management-summary";
    await page.waitForSelector(accountInfoSelector);
    console.log("wait for summary ");

    await timer(1000);
    await page.waitForSelector(
      "body > app-root > menu-main > div:nth-child(1) > main > div > div.column-main.column-fix-width > app-account-business > div > app-account-summary > div > div.row.account-management-summary.matchHeight-ipad-group > div:nth-child(2) > app-account-summary-card > div > div.bottom > a"
    );
    await page.click(
      "body > app-root > menu-main > div:nth-child(1) > main > div > div.column-main.column-fix-width > app-account-business > div > app-account-summary > div > div.row.account-management-summary.matchHeight-ipad-group > div:nth-child(2) > app-account-summary-card > div > div.bottom > a"
    );
    const findMoreTransactionsSelector =
      "a.btn.btn-small.hv-icon.searchBtn.btn-dark-blue";
    await page.waitForSelector(findMoreTransactionsSelector);
    /* 1st time click*/

    await page.click(findMoreTransactionsSelector);
    const responseGetTransactions = await page.waitForResponse(
      (response) =>
        response.url() ===
          "https://kbiz.kasikornbankgroup.com/services/api/accountsummary/getRecentTransactionList" &&
        response.status() === 200
    );
    const firstResponseJSON = await responseGetTransactions.json();
    await pusherServerClient.trigger(
      "kasikorn-transaction",
      "all-transactions",
      {
        message: firstResponseJSON,
      }
    );

    let totalList = firstResponseJSON.data.totalList;

    while (true) {
      const procInfo = await browser.process();
      isBrowserClose = procInfo.signalCode ? false : true; // null if browser is still running

      await page.click(findMoreTransactionsSelector);
      const responseGetTransactions = await page.waitForResponse(
        (response) =>
          response.url() ===
            "https://kbiz.kasikornbankgroup.com/services/api/accountsummary/getRecentTransactionList" &&
          response.status() === 200
      );
      const responseJSON = await responseGetTransactions.json();
      await pusherServerClient.trigger(
        "kasikorn-transaction",
        "all-transactions",
        {
          message: responseJSON,
        }
      );
      if (responseJSON.data.totalList !== totalList) {
        totalList = responseJSON.data.totalList;
        await pusherServerClient.trigger(
          "kasikorn-transaction",
          "new-transaction",
          {
            message: responseJSON.data.recentTransactionList[0],
          }
        );
      }
      console.log("running");
      await timer(5000);
    }
  } catch (e) {
    console.log(e);
  }
};

app.get("/isRunning", async (req, res) => {
  res.send({ running: isBrowserClose === false ? true:false });
});

setInterval(() => {
  if (isBrowserClose) {
    init();
  }
}, 10000);

app.listen(3001, () => {
  console.log("Listening on port 3001");
});
