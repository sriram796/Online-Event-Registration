const { Builder, By, until } = require("selenium-webdriver");

(async function runTests() {

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    const driver = await new Builder()
        .forBrowser("chrome")
        .build();

    try {
        // Open home page
        await driver.get(baseUrl);

        await driver.wait(
            until.titleContains("CampusEvents"),
            10000
        );

        console.log("Home page loaded successfully.");

        // Open registration page
        await driver.get(`${baseUrl}/register.html`);

        const email = `test${Date.now()}@example.com`;

        await driver.findElement(By.name("name"))
            .sendKeys("Selenium Student");

        await driver.findElement(By.name("email"))
            .sendKeys(email);

        await driver.findElement(By.name("password"))
            .sendKeys("password123");

        await driver.findElement(
            By.css("#register-form button[type='submit']")
        ).click();

        await driver.wait(
            until.urlContains("dashboard.html"),
            10000
        );

        console.log("Student registration successful.");

        // Open events
        await driver.get(`${baseUrl}/events.html`);

        await driver.wait(
            until.elementLocated(By.css(".event-card")),
            10000
        );

        console.log("Event listing loaded successfully.");

    } finally {
        await driver.quit();
    }

})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});