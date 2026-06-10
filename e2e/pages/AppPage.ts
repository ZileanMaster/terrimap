/**
 * e2e/pages/AppPage.ts - Page Object Model cho TerriMap app
 *
 * Selectors map 1-to-1 với data-testid và id attributes trong components.
 * Tabs: role tab buttons có id="role-tab-{role}" (không phải role="tab").
 * Logo: ⬡ và "TerriMap" trong spans riêng biệt -> dùng logo's data-testid.
 */

import { type Page, type Locator } from '@playwright/test'

export class AppPage {
  readonly page: Page

  // TopBar - logo
  readonly logoHex: Locator      // span chứa ⬡
  readonly logoText: Locator     // span chứa "TerriMap"

  // TopBar - role tabs (id="role-tab-{role}")
  readonly tabAdmin:       Locator
  readonly tabCoordinator: Locator
  readonly tabSales:       Locator

  // TopBar - controls
  readonly themeLight:  Locator   // id="theme-btn-light"
  readonly themeDark:   Locator   // id="theme-btn-dark"
  readonly localeToggle: Locator  // data-testid="locale-toggle"

  // Map wrapper
  readonly mapContainer: Locator  // data-testid="territory-map"

  // Algorithm panel (data-testid)
  readonly algoGreedy:    Locator  // data-testid="algo-greedy"
  readonly algoLocalSearch: Locator  // data-testid="algo-local-search"
  readonly algoSA:        Locator  // data-testid="algo-sa"
  readonly runButton:     Locator  // data-testid="run-algorithm"
  readonly progressBar:   Locator  // data-testid="progress-bar"
  readonly resultMetrics: Locator  // data-testid="result-metrics"

  // Sidebar
  readonly sidebar:          Locator  // data-testid="sidebar"
  readonly teamOverview:     Locator  // data-testid="team-overview"
  readonly orderForecast:    Locator  // data-testid="order-forecast"
  readonly createSnapshotBtn: Locator // id="btn-create-snapshot"

  constructor(page: Page) {
    this.page = page

    this.logoHex  = page.locator('[data-testid="logo"] span').first()
    this.logoText = page.locator('[data-testid="logo"] span').last()

    this.tabAdmin       = page.locator('#role-tab-admin')
    this.tabCoordinator = page.locator('#role-tab-coordinator')
    this.tabSales       = page.locator('#role-tab-sales')

    this.themeLight   = page.locator('#theme-btn-light')
    this.themeDark    = page.locator('#theme-btn-dark')
    this.localeToggle = page.getByTestId('locale-toggle')

    this.mapContainer = page.getByTestId('territory-map')

    this.algoGreedy    = page.getByTestId('algo-greedy')
    this.algoLocalSearch = page.getByTestId('algo-local-search')
    this.algoSA        = page.getByTestId('algo-sa')
    this.runButton     = page.getByTestId('run-algorithm')
    this.progressBar   = page.getByTestId('progress-bar')
    this.resultMetrics = page.getByTestId('result-metrics')

    this.sidebar           = page.getByTestId('sidebar')
    this.teamOverview      = page.getByTestId('team-overview')
    this.orderForecast     = page.getByTestId('order-forecast')
    this.createSnapshotBtn = page.locator('#btn-create-snapshot')
  }

  async goto() {
    await this.page.goto('/')
    await this.page.waitForLoadState('domcontentloaded')
    // Đợi root render
    await this.page.locator('#root').waitFor({ state: 'attached' })
  }

  async switchRole(role: 'admin' | 'coordinator' | 'sales') {
    const tabs = {
      admin:       this.tabAdmin,
      coordinator: this.tabCoordinator,
      sales:       this.tabSales,
    }
    await tabs[role].click()
    await this.page.waitForTimeout(400) // animation settle
  }

  async runAlgorithm(algo: 'greedy' | 'local-search' | 'sa' = 'greedy') {
    const algoMap = {
      greedy: this.algoGreedy,
      'local-search': this.algoLocalSearch,
      sa:     this.algoSA,
    }
    await algoMap[algo].click()
    await this.runButton.click()
  }

  async waitForResult(timeoutMs = 15000) {
    await this.resultMetrics.waitFor({ state: 'visible', timeout: timeoutMs })
  }
}
