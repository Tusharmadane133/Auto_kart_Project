/**
 * SEO Monitoring and Logging System
 * Tracks SEO performance, errors, and metrics
 */

const fs = require('fs');
const path = require('path');

class SEOMonitor {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.seoLogFile = path.join(this.logDir, 'seo-performance.log');
    this.errorLogFile = path.join(this.logDir, 'seo-errors.log');
    this.crawlLogFile = path.join(this.logDir, 'crawl-stats.log');
    
    // Ensure log directory exists
    this.ensureLogDirectory();
    
    // Initialize metrics
    this.metrics = {
      sitemapGenerations: 0,
      sitemapErrors: 0,
      structuredDataValidations: 0,
      structuredDataErrors: 0,
      pageViews: 0,
      crawlRequests: 0,
      imageSitemapGenerations: 0,
      imageSitemapErrors: 0,
      lastSitemapGeneration: null,
      lastImageSitemapGeneration: null,
      startTime: new Date()
    };
    
    this.loadMetrics();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  loadMetrics() {
    const metricsFile = path.join(this.logDir, 'seo-metrics.json');
    try {
      if (fs.existsSync(metricsFile)) {
        const data = fs.readFileSync(metricsFile, 'utf8');
        const loadedMetrics = JSON.parse(data);
        this.metrics = { 
          ...this.metrics, 
          ...loadedMetrics,
          startTime: loadedMetrics.startTime ? new Date(loadedMetrics.startTime) : this.metrics.startTime
        };
      }
    } catch (error) {
      console.error('Error loading SEO metrics:', error);
    }
  }

  saveMetrics() {
    const metricsFile = path.join(this.logDir, 'seo-metrics.json');
    try {
      fs.writeFileSync(metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('Error saving SEO metrics:', error);
    }
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${message}\n`;
    
    try {
      fs.appendFileSync(this.seoLogFile, logEntry);
    } catch (error) {
      console.error('Error writing to SEO log:', error);
    }
    
    // Also log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 SEO ${type}: ${message}`);
    }
  }

  logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorEntry = `[${timestamp}] [ERROR] ${context ? context + ': ' : ''}${error.message || error}\n`;
    
    try {
      fs.appendFileSync(this.errorLogFile, errorEntry);
    } catch (writeError) {
      console.error('Error writing to error log:', writeError);
    }
    
    console.error(`🚨 SEO Error: ${context ? context + ': ' : ''}${error.message || error}`);
  }

  logCrawl(userAgent, url, statusCode = 200) {
    const timestamp = new Date().toISOString();
    const crawlEntry = `[${timestamp}] [${userAgent}] ${url} - ${statusCode}\n`;
    
    try {
      fs.appendFileSync(this.crawlLogFile, crawlEntry);
    } catch (error) {
      console.error('Error writing to crawl log:', error);
    }
    
    this.metrics.crawlRequests++;
    this.saveMetrics();
  }

  trackSitemapGeneration(type = 'web', success = true, error = null) {
    const timestamp = new Date();
    
    if (type === 'web') {
      this.metrics.sitemapGenerations++;
      this.metrics.lastSitemapGeneration = timestamp;
      if (!success) this.metrics.sitemapErrors++;
    } else if (type === 'image') {
      this.metrics.imageSitemapGenerations++;
      this.metrics.lastImageSitemapGeneration = timestamp;
      if (!success) this.metrics.imageSitemapErrors++;
    }
    
    if (success) {
      this.log(`${type} sitemap generated successfully`, 'SUCCESS');
    } else {
      this.logError(error || 'Unknown error', `${type} sitemap generation`);
    }
    
    this.saveMetrics();
  }

  trackStructuredDataValidation(page, valid = true, error = null) {
    this.metrics.structuredDataValidations++;
    
    if (valid) {
      this.log(`Structured data validated for ${page}`, 'SUCCESS');
    } else {
      this.metrics.structuredDataErrors++;
      this.logError(error || 'Validation failed', `Structured data for ${page}`);
    }
    
    this.saveMetrics();
  }

  trackPageView(url, userAgent, referer = null) {
    this.metrics.pageViews++;
    
    const logData = {
      timestamp: new Date().toISOString(),
      url,
      userAgent,
      referer
    };
    
    // Detect search engine crawlers
    const searchEngines = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider'];
    const isCrawler = searchEngines.some(bot => userAgent.toLowerCase().includes(bot));
    
    if (isCrawler) {
      this.logCrawl(userAgent, url);
      this.log(`Search engine crawl detected: ${userAgent} on ${url}`, 'CRAWL');
    }
    
    this.saveMetrics();
  }

  getMetrics() {
    const uptime = Date.now() - new Date(this.metrics.startTime).getTime();
    const daysRunning = Math.floor(uptime / (1000 * 60 * 60 * 24));
    
    return {
      ...this.metrics,
      uptime: `${daysRunning} days`,
      averageSitemapGenerationsPerDay: daysRunning > 0 ? 
        Math.round((this.metrics.sitemapGenerations + this.metrics.imageSitemapGenerations) / daysRunning * 100) / 100 : 0,
      errorRate: this.metrics.sitemapGenerations > 0 ? 
        Math.round((this.metrics.sitemapErrors / this.metrics.sitemapGenerations) * 100 * 100) / 100 : 0
    };
  }

  getHealthStatus() {
    const metrics = this.getMetrics();
    const health = {
      status: 'HEALTHY',
      issues: [],
      recommendations: []
    };

    // Check for errors
    if (metrics.sitemapErrors > 0) {
      health.status = 'WARNING';
      health.issues.push(`${metrics.sitemapErrors} sitemap generation errors`);
      health.recommendations.push('Check sitemap generation logs');
    }

    if (metrics.structuredDataErrors > 0) {
      health.status = 'WARNING';
      health.issues.push(`${metrics.structuredDataErrors} structured data errors`);
      health.recommendations.push('Validate structured data on affected pages');
    }

    // Check for recent activity
    const now = new Date();
    const lastSitemap = metrics.lastSitemapGeneration ? new Date(metrics.lastSitemapGeneration) : null;
    const lastImageSitemap = metrics.lastImageSitemapGeneration ? new Date(metrics.lastImageSitemapGeneration) : null;
    
    if (lastSitemap && (now - lastSitemap) > 24 * 60 * 60 * 1000) {
      health.status = 'WARNING';
      health.issues.push('Sitemap not generated in last 24 hours');
      health.recommendations.push('Check sitemap generation schedule');
    }

    if (metrics.pageViews === 0) {
      health.status = 'WARNING';
      health.issues.push('No page views tracked');
      health.recommendations.push('Ensure SEO monitoring middleware is active');
    }

    return health;
  }

  generateReport() {
    const metrics = this.getMetrics();
    const health = this.getHealthStatus();
    
    return {
      timestamp: new Date().toISOString(),
      metrics,
      health,
      summary: {
        totalSitemaps: metrics.sitemapGenerations + metrics.imageSitemapGenerations,
        totalErrors: metrics.sitemapErrors + metrics.imageSitemapErrors + metrics.structuredDataErrors,
        totalCrawls: metrics.crawlRequests,
        uptime: metrics.uptime,
        status: health.status
      }
    };
  }

  // Clean old logs (keep last 30 days)
  cleanOldLogs() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    try {
      [this.seoLogFile, this.errorLogFile, this.crawlLogFile].forEach(logFile => {
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          const lines = content.split('\n');
          const recentLines = lines.filter(line => {
            if (!line) return false;
            const match = line.match(/\[([^\]]+)\]/);
            if (match) {
              const timestamp = new Date(match[1]);
              return timestamp > thirtyDaysAgo;
            }
            return true; // Keep lines without timestamps
          });
          
          fs.writeFileSync(logFile, recentLines.join('\n'));
        }
      });
      
      this.log('Old log files cleaned (30+ days)', 'MAINTENANCE');
    } catch (error) {
      this.logError(error, 'Log cleanup');
    }
  }
}

// Singleton instance
const seoMonitor = new SEOMonitor();

module.exports = seoMonitor;
