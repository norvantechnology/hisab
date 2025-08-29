import puppeteer from 'puppeteer';

class BrowserPool {
  constructor() {
    this.browsers = [];
    this.maxBrowsers = 3; // Limit concurrent browsers
    this.browserPromise = null;
  }

  async getBrowser() {
    // If we have available browsers, return one
    if (this.browsers.length > 0) {
      return this.browsers.pop();
    }

    // If no browser creation is in progress, start one
    if (!this.browserPromise) {
      this.browserPromise = this.createBrowser();
    }

    const browser = await this.browserPromise;
    this.browserPromise = null;
    return browser;
  }

  async createBrowser() {
    return await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-default-apps',
        '--disable-sync'
      ]
    });
  }

  async returnBrowser(browser) {
    try {
      // Check if browser is still connected
      if (browser && browser.connected) {
        // Close all pages except one to keep browser light
        const pages = await browser.pages();
        for (let i = 1; i < pages.length; i++) {
          await pages[i].close();
        }

        // Only keep browser if we haven't reached max limit
        if (this.browsers.length < this.maxBrowsers) {
          this.browsers.push(browser);
          return;
        }
      }
      
      // Close browser if we can't reuse it
      if (browser) {
        await browser.close();
      }
    } catch (error) {
      console.error('Error returning browser to pool:', error);
      try {
        if (browser) {
          await browser.close();
        }
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }

  async closeAll() {
    const browsers = [...this.browsers];
    this.browsers = [];
    
    await Promise.all(
      browsers.map(async (browser) => {
        try {
          await browser.close();
        } catch (error) {
          console.error('Error closing browser:', error);
        }
      })
    );
  }
}

// Global browser pool instance
const browserPool = new BrowserPool();

// Cleanup on process exit
process.on('exit', () => {
  browserPool.closeAll();
});

process.on('SIGINT', () => {
  browserPool.closeAll();
  process.exit();
});

process.on('SIGTERM', () => {
  browserPool.closeAll();
  process.exit();
});

export default browserPool; 