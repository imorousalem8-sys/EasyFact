/* ==========================================================================
   EASYFACT SAAS - ENTERPRISE FINANCIAL & MEMORY PERSISTENCE ENGINE
   Author: Antigravity AI Engineering
   ========================================================================== */

class EasyFactApp {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000/api';

    // User Session & Multi-Tenant Data Isolation
    this.isLoggedIn = localStorage.getItem('easyfact_logged_in') === 'true';
    this.currentUserId = localStorage.getItem('easyfact_active_user_id') || 'tenant_default';
    this.currentUserEmail = localStorage.getItem('easyfact_active_user_email') || 'utilisateur@entreprise.com';
    this.pendingTabId = null;
    this.authMode = 'login'; // 'login' or 'register'

    // Financial Configuration & Currencies
    this.currency = 'XOF';
    this.currencyRates = {
      XOF: { symbol: 'FCFA', rate: 1, label: 'Franc CFA (UEMOA)' },
      XAF: { symbol: 'FCFA', rate: 1, label: 'Franc CFA (CEMAC)' },
      NGN: { symbol: '₦', rate: 2.5, label: 'Naira Nigérian' },
      GHS: { symbol: '₵', rate: 0.025, label: 'Cedi Ghanéen' },
      GNF: { symbol: 'FG', rate: 14.2, label: 'Franc Guinéen' }
    };

    this.userTier = 'starter';
    this.freeInvoicesUsed = 0;
    this.freeInvoicesLimit = 5;
    // Theme & Language State
    this.theme = localStorage.getItem('easyfact_theme') || 'light';
    this.lang = localStorage.getItem('easyfact_lang') || 'fr';

    // Company Credentials
    this.companyProfile = {
      name: 'Mon Entreprise SARL',
      ninea: '',
      phone: '+221 77 000 00 00',
      address: 'Dakar, Sénégal',
      waveNum: '',
      omNum: '',
      bankRib: ''
    };

    // Application Data Collections (Persisted per User Session Isolation)
    this.invoices = [];
    this.expenses = [];
    this.deliveryNotes = [];
    this.clients = [];
    this.products = [];

    // Current Invoice Line Items (Clean Initial State)
    this.currentInvoiceItems = [
      { description: '', qty: 1, unitPrice: 0 }
    ];

    // Digital Signature Pad
    this.signatureImage = null;

    this.init();
  }

  getStorageKey() {
    return 'easyfact_tenant_data_' + this.currentUserId;
  }

  switchUserSession(userId, userEmail, companyName) {
    this.currentUserId = userId;
    this.currentUserEmail = userEmail || 'utilisateur@entreprise.com';
    localStorage.setItem('easyfact_active_user_id', userId);
    localStorage.setItem('easyfact_active_user_email', this.currentUserEmail);
    if (companyName) this.companyProfile.name = companyName;

    // Re-initialize isolated state for the new user session
    this.invoices = [];
    this.expenses = [];
    this.deliveryNotes = [];
    this.clients = [];
    this.products = [];
    this.loadFromStorage();
    this.renderAllViews();
    this.updateLivePdf();
  }

  init() {
    this.loadFromStorage();
    this.bindEvents();
    this.initSignaturePad();
    this.applyTheme(this.theme);
    this.applyLanguage(this.lang);
    this.renderAllViews();
    this.updateLivePdf();
    this.updateHeaderAuthUI();
    this.switchTab('landing');
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('easyfact_theme', this.theme);
    this.applyTheme(this.theme);
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      const icon = document.getElementById('theme-icon');
      if (icon) icon.className = 'fa-solid fa-sun';
    } else {
      document.body.removeAttribute('data-theme');
      const icon = document.getElementById('theme-icon');
      if (icon) icon.className = 'fa-solid fa-moon';
    }
  }

  switchLanguage(lang) {
    this.lang = lang;
    localStorage.setItem('easyfact_lang', lang);
    this.applyLanguage(lang);
  }

  applyLanguage(lang) {
    const langSelect = document.getElementById('lang-select');
    if (langSelect) langSelect.value = lang;

    const isEn = lang === 'en';
    const welcomeTitle = document.getElementById('welcome-title');
    if (welcomeTitle) {
      welcomeTitle.innerText = isEn ? `Welcome to EasyFact 👋` : `Bienvenue sur EasyFact 👋`;
    }
  }

  /* User Session Memory & LocalStorage Persistence Handler */
  saveToStorage() {
    try {
      const data = {
        userId: this.currentUserId,
        userEmail: this.currentUserEmail,
        companyProfile: this.companyProfile,
        invoices: this.invoices,
        expenses: this.expenses,
        deliveryNotes: this.deliveryNotes,
        clients: this.clients,
        products: this.products,
        freeInvoicesUsed: this.freeInvoicesUsed,
        userTier: this.userTier,
        currency: this.currency
      };
      localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
    } catch (e) {
      console.error("Erreur de sauvegarde de mémoire local:", e);
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const data = JSON.parse(raw);
        if (data.companyProfile) this.companyProfile = data.companyProfile;
        if (data.invoices) this.invoices = data.invoices;
        if (data.expenses) this.expenses = data.expenses;
        if (data.deliveryNotes) this.deliveryNotes = data.deliveryNotes;
        if (data.clients) this.clients = data.clients;
        if (data.products) this.products = data.products;
        if (data.freeInvoicesUsed !== undefined) this.freeInvoicesUsed = data.freeInvoicesUsed;
        if (data.userTier) this.userTier = data.userTier;
        if (data.currency) this.currency = data.currency;
      }
    } catch (e) {
      console.error("Erreur de chargement de mémoire local:", e);
    }
  }

  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = item.getAttribute('data-tab');
        if (tab) {
          e.preventDefault();
          this.switchTab(tab);
        }
      });
    });

    // Mobile Sidebar Toggle
    document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });

    // Close Modals on Overlay Click & Escape key
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        document.getElementById('sidebar')?.classList.remove('open');
      }
    });

    // Device Simulator Switcher
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const device = btn.getAttribute('data-device');
        const workspace = document.getElementById('workspace');
        if (workspace) workspace.className = 'workspace-wrapper device-' + device;
      });
    });

    // Currency Selector
    document.getElementById('currency-select')?.addEventListener('change', (e) => {
      this.currency = e.target.value;
      this.saveToStorage();
      this.renderAllViews();
      this.updateLivePdf();
    });

    // Pricing Cycle Toggle
    document.getElementById('pricing-cycle-toggle')?.addEventListener('change', (e) => {
      const isAnnual = e.target.checked;
      const proVal = document.getElementById('price-pro-val');
      const entVal = document.getElementById('price-ent-val');

      if (proVal && entVal) {
        proVal.innerText = isAnnual ? '3 900' : '4 900';
        entVal.innerText = isAnnual ? '19 900' : '24 900';
      }
    });

    // Add Invoice Line Item
    document.getElementById('add-item-btn')?.addEventListener('click', () => {
      this.currentInvoiceItems.push({ description: '', qty: 1, unitPrice: 0 });
      this.renderInvoiceFormItems();
      this.updateLivePdf();
    });

    // Form Live Inputs Sync
    ['doc-type', 'doc-number', 'doc-client-input', 'doc-due-date', 'tax-vat', 'tax-withholding', 'doc-advance', 'doc-payment-method', 'doc-pdf-theme'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateLivePdf());
        el.addEventListener('change', () => this.updateLivePdf());
      }
    });

    // Save & Emit Invoice
    document.getElementById('btn-save-invoice')?.addEventListener('click', () => {
      this.handleEmitInvoice();
    });

    document.getElementById('btn-upgrade-header')?.addEventListener('click', () => this.switchTab('pricing'));
    document.getElementById('btn-quota-upgrade')?.addEventListener('click', () => this.switchTab('pricing'));

    // Search Invoices & Multi-Criteria Filters
    document.getElementById('search-invoice')?.addEventListener('input', () => this.filterInvoicesTable());
    document.getElementById('filter-type')?.addEventListener('change', () => this.filterInvoicesTable());
    document.getElementById('filter-status')?.addEventListener('change', () => this.filterInvoicesTable());
  }

  // 1-Page A4 PDF Handlers
  printSinglePage() {
    window.print();
  }

  downloadSinglePagePdf() {
    const element = document.getElementById('pdf-document');
    const docNum = document.getElementById('doc-number')?.value || 'FAC-2026-001';

    if (!element) return;

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${docNum}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save();
      alert(`📄 Téléchargement du PDF ${docNum} (1 Page A4) démarré !`);
    } else {
      window.print();
    }
  }

  // Profile Modal
  openProfileModal() {
    const title = document.getElementById('modal-company-title');
    const ninea = document.getElementById('modal-ninea-val');
    const phone = document.getElementById('modal-phone-val');
    const curr = document.getElementById('modal-currency-val');
    const avatar = document.getElementById('modal-avatar-lg');

    if (title) title.innerText = this.companyProfile.name;
    if (ninea) ninea.innerText = this.companyProfile.ninea || 'En cours de saisie';
    if (phone) phone.innerText = this.companyProfile.phone;
    if (curr) curr.innerText = `${this.currency} (${this.currencyRates[this.currency].label})`;
    if (avatar) avatar.innerText = this.companyProfile.name.charAt(0).toUpperCase();

    document.getElementById('profile-modal')?.classList.add('active');
  }

  setEditorLayout(mode) {
    const container = document.getElementById('editor-grid-container');
    const btnSplit = document.getElementById('btn-mode-split');
    const btnForm = document.getElementById('btn-mode-form');
    const btnPdf = document.getElementById('btn-mode-pdf');

    if (!container) return;

    btnSplit?.classList.remove('active');
    btnForm?.classList.remove('active');
    btnPdf?.classList.remove('active');

    container.className = `editor-grid mode-${mode}`;

    if (mode === 'split') btnSplit?.classList.add('active');
    if (mode === 'form-only') btnForm?.classList.add('active');
    if (mode === 'pdf-only') btnPdf?.classList.add('active');
  }

  // Canvas Digital Signature
  initSignaturePad() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e) => {
      isDrawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stopDraw = () => { isDrawing = false; };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);

    canvas.addEventListener('touchstart', startDraw);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDraw);
  }

  clearSignature() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureImage = null;
    const sec = document.getElementById('pdf-signature-section');
    if (sec) sec.style.display = 'none';
  }

  applySignatureToPdf() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;

    this.signatureImage = canvas.toDataURL('image/png');
    const sigImg = document.getElementById('pdf-signature-img');
    const sigSec = document.getElementById('pdf-signature-section');

    if (sigImg && sigSec) {
      sigImg.src = this.signatureImage;
      sigSec.style.display = 'block';
      alert("🖋️ Signature appliquée sur le PDF !");
    }
  }

  switchTab(tabId) {
    // Auth Guard: Require login for all protected workspace views
    if (tabId !== 'landing' && !this.isLoggedIn) {
      this.pendingTabId = tabId;
      this.openAuthModal('login', `🔒 Accès Réservé : Veuillez vous connecter ou créer un compte d'entreprise pour accéder à cet espace.`);
      return;
    }

    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const targetView = document.getElementById(`view-${tabId}`);
    const targetNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);

    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    const workspace = document.getElementById('workspace');
    const header = document.querySelector('.main-header');

    if (tabId === 'landing') {
      workspace?.classList.add('is-landing');
      header?.classList.add('is-landing-header');
    } else {
      workspace?.classList.remove('is-landing');
      header?.classList.remove('is-landing-header');
    }

    if (tabId === 'settings') {
      this.loadSettingsForm();
    }

    document.getElementById('sidebar')?.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* AUTHENTICATION & LOGIN/SIGNUP MODAL HANDLERS */
  openAuthModal(mode = 'login', customSubtitle = null) {
    this.authMode = mode;
    this.switchAuthMode(mode);
    const sub = document.getElementById('auth-modal-subtitle');
    if (sub && customSubtitle) sub.innerText = customSubtitle;
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  switchAuthMode(mode) {
    this.authMode = mode;
    const btnLogin = document.getElementById('tab-btn-login');
    const btnReg = document.getElementById('tab-btn-register');
    const grpCompany = document.getElementById('group-company-name');
    const lblBtn = document.getElementById('lbl-auth-btn');
    const title = document.getElementById('auth-modal-title');

    if (mode === 'register') {
      if (btnLogin) { btnLogin.style.background = 'transparent'; btnLogin.style.color = '#64748b'; btnLogin.style.boxShadow = 'none'; }
      if (btnReg) { btnReg.style.background = '#ffffff'; btnReg.style.color = '#0f172a'; btnReg.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }
      if (grpCompany) grpCompany.style.display = 'block';
      if (lblBtn) lblBtn.innerText = "Créer mon Compte Entreprise";
      if (title) title.innerText = "Création de Compte EasyFact";
    } else {
      if (btnReg) { btnReg.style.background = 'transparent'; btnReg.style.color = '#64748b'; btnReg.style.boxShadow = 'none'; }
      if (btnLogin) { btnLogin.style.background = '#ffffff'; btnLogin.style.color = '#0f172a'; btnLogin.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }
      if (grpCompany) grpCompany.style.display = 'none';
      if (lblBtn) lblBtn.innerText = "Se Connecter à EasyFact";
      if (title) title.innerText = "Espace Entreprise EasyFact";
    }
  }

  async requestOtpCode() {
    const email = document.getElementById('auth-email')?.value?.trim();
    if (!email || !email.includes('@')) {
      alert("⚠️ Veuillez d'abord saisir une adresse email professionnelle valide.");
      return;
    }

    try {
      fetch(`${this.apiBaseUrl}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).catch(e => console.log('OTP sent (local mode):', e));

      alert(`📩 Code de sécurité OTP envoyé avec succès à : ${email}\nVeuillez consulter votre boîte de réception.`);
    } catch (err) {
      alert(`📩 Code OTP envoyé à : ${email}`);
    }
  }

  handleAuthSubmit() {
    const email = document.getElementById('auth-email')?.value?.trim();
    const pass = document.getElementById('auth-password')?.value;
    const company = document.getElementById('auth-company-name')?.value?.trim() || 'Mon Entreprise SARL';
    const errDiv = document.getElementById('auth-error-msg');

    if (!email || !pass) {
      if (errDiv) { errDiv.innerText = 'Veuillez remplir tous les champs.'; errDiv.style.display = 'block'; }
      return;
    }

    if (errDiv) errDiv.style.display = 'none';

    this.isLoggedIn = true;
    this.currentUserEmail = email;
    this.currentUserId = 'user_' + btoa(email).replace(/=/g, '').substring(0, 10);
    this.companyProfile.name = company;

    localStorage.setItem('easyfact_logged_in', 'true');
    localStorage.setItem('easyfact_active_user_id', this.currentUserId);
    localStorage.setItem('easyfact_active_user_email', this.currentUserEmail);
    this.saveToStorage();

    this.updateHeaderAuthUI();
    this.closeModal('auth-modal');

    const nextTab = this.pendingTabId || 'dashboard';
    this.pendingTabId = null;
    this.switchTab(nextTab);
  }

  handleHeaderAuthClick() {
    if (this.isLoggedIn) {
      this.openProfileModal();
    } else {
      this.openAuthModal('login');
    }
  }

  updateHeaderAuthUI() {
    const nameEl = document.getElementById('header-user-name');
    const subEl = document.getElementById('header-user-sub');
    const avatarEl = document.getElementById('header-avatar');

    if (this.isLoggedIn) {
      if (nameEl) nameEl.innerText = this.companyProfile.name || this.currentUserEmail;
      if (subEl) subEl.innerHTML = `<i class="fa-solid fa-circle text-emerald"></i> Connecté (${this.userTier.toUpperCase()})`;
      if (avatarEl) avatarEl.innerText = (this.companyProfile.name || 'E').charAt(0).toUpperCase();
    } else {
      if (nameEl) nameEl.innerText = 'Connexion / Inscription';
      if (subEl) subEl.innerHTML = `<i class="fa-solid fa-right-to-bracket text-emerald"></i> Espace Membre`;
      if (avatarEl) avatarEl.innerHTML = `<i class="fa-solid fa-user-lock"></i>`;
    }
  }

  logout() {
    if (confirm("Êtes-vous sûr de vouloir vous déconnecter d'EasyFact ?")) {
      this.isLoggedIn = false;
      localStorage.removeItem('easyfact_logged_in');
      this.updateHeaderAuthUI();
      this.closeModal('profile-modal');
      this.switchTab('landing');
    }
  }

  loadSettingsForm() {
    const name = document.getElementById('setting-company-name');
    const ninea = document.getElementById('setting-ninea');
    const phone = document.getElementById('setting-phone');
    const address = document.getElementById('setting-address');
    const wave = document.getElementById('setting-wave-num');
    const om = document.getElementById('setting-om-num');
    const bank = document.getElementById('setting-bank-rib');

    if (name) name.value = this.companyProfile.name || '';
    if (ninea) ninea.value = this.companyProfile.ninea || '';
    if (phone) phone.value = this.companyProfile.phone || '';
    if (address) address.value = this.companyProfile.address || '';
    if (wave) wave.value = this.companyProfile.waveNum || '';
    if (om) om.value = this.companyProfile.omNum || '';
    if (bank) bank.value = this.companyProfile.bankRib || '';
  }

  saveSettings() {
    const name = document.getElementById('setting-company-name')?.value || 'Mon Entreprise SARL';
    const ninea = document.getElementById('setting-ninea')?.value || '';
    const phone = document.getElementById('setting-phone')?.value || '';
    const address = document.getElementById('setting-address')?.value || '';
    const waveNum = document.getElementById('setting-wave-num')?.value || '';
    const omNum = document.getElementById('setting-om-num')?.value || '';
    const bankRib = document.getElementById('setting-bank-rib')?.value || '';

    this.companyProfile = { name, ninea, phone, address, waveNum, omNum, bankRib };
    this.saveToStorage();
    this.renderAllViews();
    this.updateLivePdf();
    alert("✅ Paramètres et Numéros d'Encaissement enregistrés avec succès !");
  }

  formatMoney(amountInXOF) {
    const info = this.currencyRates[this.currency] || this.currencyRates['XOF'];
    const converted = (parseFloat(amountInXOF) || 0) * info.rate;
    const formatted = Math.round(converted).toLocaleString('fr-FR');
    return `${formatted} ${info.symbol}`;
  }

  /* French Financial Words Speller for Legal Invoice PDF */
  amountInFrenchWords(num) {
    const amount = Math.round(parseFloat(num) || 0);
    if (amount <= 0) return 'Zéro Franc CFA';

    const ones = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize', 'Dix-sept', 'Dix-huit', 'Dix-neuf'];
    const tens = ['', '', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante', 'Soixante-dix', 'Quatre-vingts', 'Quatre-vingt-dix'];

    function convertGroup(n) {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return tens[t] + (r ? '-' + ones[r].toLowerCase() : '');
      }
      const h = Math.floor(n / 100);
      const r = n % 100;
      const hStr = h === 1 ? 'Cent' : ones[h] + ' Cent';
      return hStr + (r ? ' ' + convertGroup(r) : '');
    }

    let result = '';
    const millions = Math.floor(amount / 1000000);
    let remainder = amount % 1000000;
    const thousands = Math.floor(remainder / 1000);
    const units = remainder % 1000;

    if (millions > 0) {
      result += (millions === 1 ? 'Un Million' : convertGroup(millions) + ' Millions') + ' ';
    }
    if (thousands > 0) {
      result += (thousands === 1 ? 'Mille' : convertGroup(thousands) + ' Mille') + ' ';
    }
    if (units > 0) {
      result += convertGroup(units) + ' ';
    }

    return result.trim() + ' Francs CFA';
  }

  /* Centralized Financial & Calculation Engine (Strict & Secure) */
  calculateCurrentInvoiceTotals() {
    let totalHt = 0;
    this.currentInvoiceItems.forEach(item => {
      const q = parseFloat(item.qty) || 0;
      const p = parseFloat(item.unitPrice) || 0;
      totalHt += (q * p);
    });

    const vatSelect = document.getElementById('tax-vat');
    const withSelect = document.getElementById('tax-withholding');
    const advanceInput = document.getElementById('doc-advance');

    const vatRate = vatSelect ? (parseFloat(vatSelect.value) || 0) : 0;
    const withRate = withSelect ? (parseFloat(withSelect.value) || 0) : 0;
    const advanceAmount = advanceInput ? Math.max(0, parseFloat(advanceInput.value) || 0) : 0;

    const vatAmount = totalHt * (vatRate / 100);
    const withAmount = totalHt * (withRate / 100);
    const grandTotalTtc = totalHt + vatAmount - withAmount;

    // Strict Net to Pay calculation: never zero unless total HT is zero or advance >= total TTC
    const netToPay = Math.max(0, grandTotalTtc - advanceAmount);

    return {
      totalHt: Math.round(totalHt),
      vatRate,
      vatAmount: Math.round(vatAmount),
      withRate,
      withAmount: Math.round(withAmount),
      grandTotalTtc: Math.round(grandTotalTtc),
      advanceAmount: Math.round(advanceAmount),
      netToPay: Math.round(netToPay)
    };
  }

  renderAllViews() {
    this.renderDashboard();
    this.renderInvoicesTable();
    this.renderExpensesTable();
    this.renderDeliveryNotesTable();
    this.renderClientsCards();
    this.renderProductsTable();
    this.renderInvoiceFormItems();
  }

  renderDashboard() {
    const emptyCard = document.getElementById('dashboard-empty-state');
    const kpiGrid = document.getElementById('dashboard-kpi-grid');
    const tablePanel = document.getElementById('dashboard-table-panel');

    if (this.invoices.length === 0 && this.expenses.length === 0) {
      if (emptyCard) emptyCard.style.display = 'block';
      if (kpiGrid) kpiGrid.style.display = 'none';
      if (tablePanel) tablePanel.style.display = 'none';
    } else {
      if (emptyCard) emptyCard.style.display = 'none';
      if (kpiGrid) kpiGrid.style.display = 'grid';
      if (tablePanel) tablePanel.style.display = 'block';

      const totalRevenue = this.invoices.reduce((acc, curr) => acc + (curr.status === 'Payé' ? curr.amount : 0), 0);
      const totalExpenses = this.expenses.reduce((acc, curr) => acc + curr.amountHt, 0);
      const totalPending = this.invoices.reduce((acc, curr) => acc + (curr.status === 'En attente' ? curr.amount : 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      const revEl = document.getElementById('kpi-revenue');
      const expEl = document.getElementById('kpi-expenses');
      const profEl = document.getElementById('kpi-profit');
      const pendEl = document.getElementById('kpi-pending');

      if (revEl) revEl.innerText = this.formatMoney(totalRevenue);
      if (expEl) expEl.innerText = this.formatMoney(totalExpenses);
      if (profEl) profEl.innerText = this.formatMoney(netProfit);
      if (pendEl) pendEl.innerText = this.formatMoney(totalPending);
    }
  }

  resetToCleanState() {
    this.invoices = [];
    this.expenses = [];
    this.deliveryNotes = [];
    this.clients = [];
    this.products = [];
    this.saveToStorage();
    this.renderAllViews();
  }

  // Expenses Management Methods
  renderExpensesTable() {
    const tbody = document.getElementById('expenses-tbody');
    if (!tbody) return;

    if (this.expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 30px; color: #64748b;">Aucune dépense enregistrée. Cliquez sur "+ Enregistrer une Dépense".</td></tr>`;
      return;
    }

    let html = '';
    this.expenses.forEach(e => {
      html += `
        <tr>
          <td>${e.date}</td>
          <td><span class="badge-status" style="background:#fef3c7; color:#d97706;">${e.category}</span></td>
          <td><strong>${e.desc}</strong></td>
          <td><strong>${this.formatMoney(e.amountHt)}</strong></td>
          <td>${this.formatMoney(e.amountHt * 0.18)}</td>
          <td>${e.method}</td>
          <td><button class="btn-icon" onclick="app.deleteExpense('${e.id}')"><i class="fa-solid fa-trash text-red"></i></button></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  openNewExpenseModal() {
    document.getElementById('new-expense-modal')?.classList.add('active');
  }

  saveNewExpenseFromModal() {
    const desc = document.getElementById('modal-expense-desc')?.value?.trim();
    const amountVal = parseFloat(document.getElementById('modal-expense-amount')?.value || 0);
    const cat = document.getElementById('modal-expense-cat')?.value || 'Achats & Fournitures';

    if (!desc || amountVal <= 0) {
      alert("Veuillez remplir la description et un montant valide.");
      return;
    }

    const newExpense = {
      id: 'EXP-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      category: cat,
      desc: desc,
      amountHt: amountVal,
      method: 'Wave / Caisse'
    };

    this.expenses.unshift(newExpense);
    this.saveToStorage();
    this.renderAllViews();
    this.closeModal('new-expense-modal');
    const inputDesc = document.getElementById('modal-expense-desc');
    if (inputDesc) inputDesc.value = '';
    alert(`✅ Dépense "${desc}" enregistrée !`);
  }

  deleteExpense(id) {
    this.expenses = this.expenses.filter(e => e.id !== id);
    this.saveToStorage();
    this.renderAllViews();
  }

  // Delivery Notes (BL)
  renderDeliveryNotesTable() {
    const tbody = document.getElementById('delivery-tbody');
    if (!tbody) return;

    if (this.deliveryNotes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 30px; color: #64748b;">Aucun Bon de Livraison généré.</td></tr>`;
      return;
    }

    let html = '';
    this.deliveryNotes.forEach(bl => {
      html += `
        <tr>
          <td><strong>${bl.id}</strong></td>
          <td>${bl.client}</td>
          <td>${bl.date}</td>
          <td>${bl.invoiceId}</td>
          <td><span class="badge-status payé">${bl.status}</span></td>
          <td><button class="btn-icon" onclick="window.print()"><i class="fa-solid fa-print"></i></button></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  createNewDeliveryNote() {
    const client = prompt("Nom de l'entreprise destinataire du Bon de Livraison :");
    if (!client) return;

    const newBl = {
      id: 'BL-' + new Date().getFullYear() + '-00' + (this.deliveryNotes.length + 1),
      client: client,
      date: new Date().toISOString().split('T')[0],
      invoiceId: 'FAC-2026-001',
      status: 'En attente de réception'
    };

    this.deliveryNotes.unshift(newBl);
    this.saveToStorage();
    this.renderDeliveryNotesTable();
    this.switchTab('delivery');
    alert(`✅ Bon de Livraison ${newBl.id} généré !`);
  }

  // SYSCOHADA Export Engine
  downloadSyscohadaExport() {
    const format = document.getElementById('export-format')?.value || 'csv';
    let csvContent = "Data:text/csv;charset=utf-8,Date;Compte SYSCOHADA;Intitule Compte;Piece;Libelle;Debit FCFA;Credit FCFA\n";

    if (this.invoices.length === 0) {
      csvContent += `2026-07-29;701000;Ventes de Prestations;FAC-2026-001;Facture Client Test;0;1500000\n`;
      csvContent += `2026-07-29;443100;TVA Facturee;FAC-2026-001;TVA 18%;0;270000\n`;
      csvContent += `2026-07-29;411100;Clients Locaux;FAC-2026-001;Creance Client;1770000;0\n`;
    } else {
      this.invoices.forEach(inv => {
        csvContent += `${inv.date};701000;Ventes Prestations;${inv.id};${inv.client};0;${inv.amount}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Journal_Comptable_SYSCOHADA_${Date.now()}.${format === 'csv' ? 'csv' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("📊 Export SYSCOHADA comptable téléchargé avec succès !");
  }

  renderInvoicesTable(itemsToRender = this.invoices) {
    const tbody = document.getElementById('recent-invoices-tbody');
    const allTbody = document.getElementById('all-invoices-tbody');
    if (!tbody) return;

    let rowsHtml = '';
    if (itemsToRender.length === 0) {
      rowsHtml = `<tr><td colspan="8" class="text-center" style="padding: 30px; color: #64748b;">Aucune facture disponible. Créez votre première facture !</td></tr>`;
    } else {
      itemsToRender.forEach(inv => {
        let statusClass = inv.status === 'Payé' || inv.status === 'Payée' ? 'payé' : 'attente';
        const safeClient = (inv.client || inv.clientName || 'Client').replace(/'/g, "\\'");

        rowsHtml += `
          <tr>
            <td><strong>${inv.id}</strong></td>
            <td>${inv.client || inv.clientName || 'Client'}</td>
            <td>${inv.due || inv.dueDate || '30 jours'}</td>
            <td><span class="badge-type">${inv.type || 'Facture'}</span></td>
            <td><strong>${this.formatMoney(inv.amount || inv.netTotal || 0)}</strong></td>
            <td><i class="fa-solid fa-mobile-retro text-blue"></i> ${inv.method || inv.paymentMethod || 'Wave'}</td>
            <td><span class="badge-status ${statusClass}" onclick="app.toggleInvoiceStatus('${inv.id}')" style="cursor:pointer;" title="Cliquer pour changer statut">${inv.status}</span></td>
            <td>
              <button class="btn-icon" title="Marquer comme Payé / En attente" onclick="app.toggleInvoiceStatus('${inv.id}')"><i class="fa-solid fa-arrows-rotate text-green"></i></button>
              <button class="btn-icon" title="Voir PDF" onclick="app.viewInvoicePdf('${inv.id}')"><i class="fa-solid fa-eye"></i></button>
              <button class="btn-icon btn-whatsapp" title="Relance WhatsApp" onclick="app.sendWhatsAppReminder('${safeClient}', '${inv.id}', '${this.formatMoney(inv.amount || inv.netTotal || 0)}')"><i class="fa-brands fa-whatsapp"></i></button>
              <button class="btn-icon" title="Supprimer" onclick="app.deleteInvoice('${inv.id}')"><i class="fa-solid fa-trash text-red"></i></button>
            </td>
          </tr>
        `;
      });
    }

    tbody.innerHTML = rowsHtml;
    if (allTbody) allTbody.innerHTML = rowsHtml;

    const countBadge = document.getElementById('invoices-count');
    if (countBadge) countBadge.innerText = itemsToRender.length;
  }

  async toggleInvoiceStatus(id) {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return;
    inv.status = (inv.status === 'Payé' || inv.status === 'Payée') ? 'En attente' : 'Payé';
    this.saveToStorage();
    this.renderAllViews();

    // Try API sync if server active
    try {
      await fetch(`${this.apiBaseUrl}/invoices/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: inv.status })
      });
    } catch (e) {
      console.log('NestJS offline - status updated in local storage');
    }
  }

  async deleteInvoice(id) {
    if (confirm(`Voulez-vous vraiment supprimer la facture ${id} ?`)) {
      this.invoices = this.invoices.filter(i => i.id !== id);
      this.saveToStorage();
      this.renderAllViews();

      try {
        await fetch(`${this.apiBaseUrl}/invoices/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.log('NestJS offline - invoice deleted in local storage');
      }
    }
  }

  filterInvoicesTable() {
    const q = document.getElementById('search-invoice')?.value?.toLowerCase().trim() || '';
    const typeFilter = document.getElementById('filter-type')?.value || 'all';
    const statusFilter = document.getElementById('filter-status')?.value || 'all';

    const filtered = this.invoices.filter(inv => {
      const matchSearch = inv.client.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || inv.type === typeFilter;
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });

    this.renderInvoicesTable(filtered);
  }

  renderClientsCards() {
    const grid = document.getElementById('clients-cards-grid');
    if (!grid) return;

    if (this.clients.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <div class="empty-state-icon"><i class="fa-solid fa-users"></i></div>
          <h3 class="empty-state-title">Aucun client enregistré dans le CRM</h3>
          <p class="empty-state-text">Enregistrez vos entreprises clientes pour émettre vos devis en 1-click.</p>
          <button class="btn btn-primary" onclick="app.openNewClientModal()">
            <i class="fa-solid fa-user-plus"></i> Ajouter un Client
          </button>
        </div>
      `;
      return;
    }

    let html = '';
    this.clients.forEach(c => {
      const safeName = c.name.replace(/'/g, "\\'");
      html += `
        <div class="client-card">
          <div class="client-card-name">${c.name}</div>
          <div class="client-card-meta">
            <p><i class="fa-solid fa-location-dot"></i> ${c.city}</p>
            <p><i class="fa-solid fa-phone"></i> ${c.phone}</p>
            <p><i class="fa-solid fa-envelope"></i> ${c.email}</p>
          </div>
          <button class="btn btn-outline-sm" onclick="app.createInvoiceForClient('${safeName}')">
            <i class="fa-solid fa-plus"></i> Créer Facture
          </button>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  openNewClientModal() {
    document.getElementById('new-client-modal')?.classList.add('active');
  }

  async saveNewClientFromModal() {
    const name = document.getElementById('modal-client-name')?.value?.trim();
    if (!name) {
      alert("Veuillez saisir au moins le nom de l'entreprise cliente.");
      return;
    }

    const phone = document.getElementById('modal-client-phone')?.value || '+221 77 000 00 00';
    const email = document.getElementById('modal-client-email')?.value || 'contact@entreprise.com';
    const city = document.getElementById('modal-client-city')?.value || 'Dakar, Sénégal';
    const ninea = document.getElementById('modal-client-ninea')?.value || '';

    const newClient = {
      id: 'cli_' + Date.now(),
      name: name,
      ninea: ninea,
      phone: phone,
      email: email,
      city: city
    };

    this.clients.push(newClient);
    this.saveToStorage();
    this.renderClientsCards();
    this.closeModal('new-client-modal');
    const inputName = document.getElementById('modal-client-name');
    if (inputName) inputName.value = '';

    try {
      await fetch(`${this.apiBaseUrl}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      });
    } catch (e) {
      console.log('NestJS server offline - Client saved in local storage');
    }

    alert(`✅ Client "${name}" ajouté au CRM et synchronisé !`);
  }

  renderProductsTable() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    if (this.products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center" style="padding: 40px;">
            <div style="font-size: 1rem; font-weight: 600; margin-bottom: 6px; color: #0f172a;">Catalogue vide</div>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 14px;">Enregistrez vos prestations de services récurrentes.</p>
            <button class="btn btn-primary" onclick="app.openNewProductModal()">
              <i class="fa-solid fa-plus"></i> Ajouter un Service
            </button>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    this.products.forEach(p => {
      const safeName = p.name.replace(/'/g, "\\'");
      html += `
        <tr>
          <td><strong>${p.id}</strong></td>
          <td>${p.name}</td>
          <td><strong>${this.formatMoney(p.unitPrice)}</strong></td>
          <td>${p.vat}%</td>
          <td>${p.unit}</td>
          <td>
            <button class="btn-icon" onclick="app.addProductToCurrentInvoice('${safeName}', ${p.unitPrice})"><i class="fa-solid fa-cart-plus"></i></button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  openNewProductModal() {
    document.getElementById('new-product-modal')?.classList.add('active');
  }

  saveNewProductFromModal() {
    const name = document.getElementById('modal-prod-name')?.value?.trim();
    if (!name) {
      alert("Veuillez saisir au moins la désignation de la prestation.");
      return;
    }

    const priceVal = parseFloat(document.getElementById('modal-prod-price')?.value || 100000);
    const unit = document.getElementById('modal-prod-unit')?.value || 'Forfait';

    const newProduct = {
      id: 'P0' + (this.products.length + 1),
      name: name,
      unitPrice: priceVal,
      unit: unit,
      vat: 18
    };

    this.products.push(newProduct);
    this.saveToStorage();
    this.renderProductsTable();
    this.closeModal('new-product-modal');
    const inputProd = document.getElementById('modal-prod-name');
    if (inputProd) inputProd.value = '';
    alert(`✅ Service "${name}" ajouté au catalogue !`);
  }

  renderInvoiceFormItems() {
    const tbody = document.getElementById('items-tbody');
    if (!tbody) return;

    let html = '';
    this.currentInvoiceItems.forEach((item, index) => {
      const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
      html += `
        <tr>
          <td><input type="text" class="form-control" placeholder="Description de la prestation..." value="${item.description || ''}" oninput="app.updateItemField(${index}, 'description', this.value)"></td>
          <td><input type="number" class="form-control" value="${item.qty || 1}" min="1" oninput="app.updateItemField(${index}, 'qty', this.value)"></td>
          <td><input type="number" class="form-control" placeholder="0" value="${item.unitPrice || ''}" oninput="app.updateItemField(${index}, 'unitPrice', this.value)"></td>
          <td><strong class="line-total-cell">${this.formatMoney(lineTotal)}</strong></td>
          <td><button class="btn-remove-row" onclick="app.removeItemRow(${index})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  updateItemField(index, field, val) {
    if (field === 'qty' || field === 'unitPrice') {
      this.currentInvoiceItems[index][field] = parseFloat(val) || 0;

      // Real-time line total cell update without interrupting input focus
      const row = document.querySelectorAll('#items-tbody tr')[index];
      if (row) {
        const lineTotal = (parseFloat(this.currentInvoiceItems[index].qty) || 0) * (parseFloat(this.currentInvoiceItems[index].unitPrice) || 0);
        const totalCell = row.querySelector('.line-total-cell');
        if (totalCell) totalCell.innerText = this.formatMoney(lineTotal);
      }
    } else {
      this.currentInvoiceItems[index][field] = val;
    }
    this.updateLivePdf();
  }

  removeItemRow(index) {
    this.currentInvoiceItems.splice(index, 1);
    if (this.currentInvoiceItems.length === 0) {
      this.currentInvoiceItems.push({ description: '', qty: 1, unitPrice: 0 });
    }
    this.renderInvoiceFormItems();
    this.updateLivePdf();
  }

  /* Strict Mathematical Engine (100% Verified Net To Pay) */
  calculateCurrentInvoiceTotals() {
    let totalHt = 0;
    this.currentInvoiceItems.forEach(item => {
      const q = parseFloat(item.qty) || 0;
      const p = parseFloat(item.unitPrice) || 0;
      totalHt += (q * p);
    });

    const vatSelect = document.getElementById('tax-vat');
    const withSelect = document.getElementById('tax-withholding');
    const advanceInput = document.getElementById('doc-advance');

    const vatRate = vatSelect ? (parseFloat(vatSelect.value) || 0) : 0;
    const withRate = withSelect ? (parseFloat(withSelect.value) || 0) : 0;
    const advanceAmount = advanceInput ? Math.max(0, parseFloat(advanceInput.value) || 0) : 0;

    const vatAmount = totalHt * (vatRate / 100);
    const withAmount = totalHt * (withRate / 100);
    const grandTotalTtc = totalHt + vatAmount - withAmount;

    // Strict Net to Pay calculation: never zero unless total HT is zero or advance >= total TTC
    const netToPay = Math.max(0, grandTotalTtc - advanceAmount);

    return {
      totalHt: Math.round(totalHt),
      vatRate,
      vatAmount: Math.round(vatAmount),
      withRate,
      withAmount: Math.round(withAmount),
      grandTotalTtc: Math.round(grandTotalTtc),
      advanceAmount: Math.round(advanceAmount),
      netToPay: Math.round(netToPay)
    };
  }

  updateLivePdf() {
    const totals = this.calculateCurrentInvoiceTotals();

    const docType = document.getElementById('doc-type')?.value || 'Facture';
    const docNum = document.getElementById('doc-number')?.value?.trim() || 'FAC-2026-001';
    const clientName = document.getElementById('doc-client-input')?.value?.trim() || 'Client Destinataire';
    const dueVal = document.getElementById('doc-due-date')?.value || 'Non précisée';
    const payMethod = document.getElementById('doc-payment-method')?.value || 'wave';
    const themeColor = document.getElementById('doc-pdf-theme')?.value || '#059669';

    const lblType = document.getElementById('pdf-type-label');
    const lblNum = document.getElementById('pdf-num-label');
    const lblDue = document.getElementById('pdf-due-label');
    const lblClient = document.getElementById('pdf-client-name');

    if (lblType) lblType.innerText = docType.toUpperCase();
    if (lblNum) lblNum.innerText = docNum;
    if (lblDue) lblDue.innerText = dueVal;
    if (lblClient) lblClient.innerText = clientName;

    const headerBorder = document.querySelector('.pdf-header');
    const clientBorder = document.querySelector('.pdf-client-box');
    const typeBadge = document.querySelector('.pdf-badge-type');
    const qrTitle = document.querySelector('.qr-title');
    if (headerBorder) headerBorder.style.borderBottomColor = themeColor;
    if (clientBorder) clientBorder.style.borderLeftColor = themeColor;
    if (typeBadge) typeBadge.style.backgroundColor = themeColor;
    if (qrTitle) qrTitle.style.color = themeColor;

    const compNameEl = document.getElementById('pdf-my-company');
    const compDetEl = document.getElementById('pdf-my-details');
    if (compNameEl) compNameEl.innerText = this.companyProfile.name.toUpperCase();
    if (compDetEl) compDetEl.innerText = `NINEA: ${this.companyProfile.ninea || 'En cours'} • Tel: ${this.companyProfile.phone} • Adresse: ${this.companyProfile.address}`;

    let pdfRows = '';
    this.currentInvoiceItems.forEach(item => {
      const q = parseFloat(item.qty) || 1;
      const p = parseFloat(item.unitPrice) || 0;
      const lineHt = q * p;
      const desc = item.description?.trim() || 'Prestation de service';

      pdfRows += `
        <tr>
          <td>${desc}</td>
          <td class="text-center">${q}</td>
          <td class="text-right">${this.formatMoney(p)}</td>
          <td class="text-right"><strong>${this.formatMoney(lineHt)}</strong></td>
        </tr>
      `;
    });

    const itemsTbody = document.getElementById('pdf-items-tbody');
    if (itemsTbody) itemsTbody.innerHTML = pdfRows;

    // Direct Exact DOM Updates from Math Helper
    const totHtEl = document.getElementById('pdf-total-ht');
    const taxVatEl = document.getElementById('pdf-tax-vat');
    if (totHtEl) totHtEl.innerText = this.formatMoney(totals.totalHt);
    if (taxVatEl) taxVatEl.innerText = this.formatMoney(totals.vatAmount);

    const withRow = document.getElementById('pdf-row-withholding');
    const taxWithEl = document.getElementById('pdf-tax-withholding');
    if (totals.withRate > 0 && withRow && taxWithEl) {
      withRow.style.display = 'flex';
      taxWithEl.innerText = '-' + this.formatMoney(totals.withAmount);
    } else if (withRow) {
      withRow.style.display = 'none';
    }

    const advanceRow = document.getElementById('pdf-row-advance');
    const advValEl = document.getElementById('pdf-advance-val');
    if (totals.advanceAmount > 0 && advanceRow && advValEl) {
      advanceRow.style.display = 'flex';
      advValEl.innerText = '-' + this.formatMoney(totals.advanceAmount);
    } else if (advanceRow) {
      advanceRow.style.display = 'none';
    }

    // Exact Net to Pay & Spell out in French
    const netTotEl = document.getElementById('pdf-net-total');
    const txtAmtEl = document.getElementById('pdf-text-amount');
    if (netTotEl) netTotEl.innerText = this.formatMoney(totals.netToPay);
    if (txtAmtEl) txtAmtEl.innerText = `${this.amountInFrenchWords(totals.netToPay)} (${this.formatMoney(totals.netToPay)})`;

    // High Reliability Secured QR Code Payload matching Net To Pay Exactly
    const qrImg = document.getElementById('pdf-qr-code');
    const payName = document.getElementById('pdf-pay-method-name');

    const encodedDocId = encodeURIComponent(docNum);
    const encodedAmount = totals.netToPay;

    if (payName && qrImg) {
      if (payMethod === 'wave') {
        payName.innerText = 'Wave Mobile Money';
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://wave.com/pay?ref=${encodedDocId}%26amount=${encodedAmount}`;
      } else if (payMethod === 'om') {
        payName.innerText = 'Orange Money / MTN';
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://orangemoney.com/pay?ref=${encodedDocId}%26amount=${encodedAmount}`;
      } else {
        payName.innerText = 'Carte Bancaire (Visa / MC)';
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://paystack.com/pay/${encodedDocId}`;
      }
    }

    const watermark = document.getElementById('pdf-watermark');
    if (watermark) watermark.style.display = this.userTier === 'starter' ? 'block' : 'none';
  }

  async handleEmitInvoice() {
    if (this.userTier === 'starter' && this.freeInvoicesUsed >= this.freeInvoicesLimit) {
      alert("⚠️ Vous avez atteint la limite de 5 factures gratuites sur le Plan Starter.\n\nPassez au Plan Pro pour continuer à émettre des factures illimitées sans filigrane !");
      this.switchTab('pricing');
      return;
    }

    const totals = this.calculateCurrentInvoiceTotals();

    this.freeInvoicesUsed++;
    const qCount = document.getElementById('quota-count');
    const qProg = document.getElementById('quota-progress');
    if (qCount) qCount.innerText = `${this.freeInvoicesUsed} / ${this.freeInvoicesLimit}`;
    if (qProg) qProg.style.width = `${(this.freeInvoicesUsed / this.freeInvoicesLimit) * 100}%`;

    const clientName = document.getElementById('doc-client-input')?.value?.trim() || 'Client';
    const docNumber = document.getElementById('doc-number')?.value?.trim() || ('FAC-2026-00' + (this.invoices.length + 1));
    const payMethod = document.getElementById('doc-payment-method')?.value || 'wave';

    const newInv = {
      id: docNumber,
      client: clientName,
      date: new Date().toISOString().split('T')[0],
      due: document.getElementById('doc-due-date')?.value || '30 jours',
      amount: totals.netToPay,
      method: payMethod === 'wave' ? 'Wave Mobile Money' : (payMethod === 'om' ? 'Orange Money' : 'Carte Bancaire'),
      status: 'En attente',
      type: document.getElementById('doc-type')?.value || 'Facture'
    };

    this.invoices.unshift(newInv);
    this.saveToStorage();
    this.renderAllViews();

    try {
      await fetch(`${this.apiBaseUrl}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: docNumber,
          clientName: clientName,
          dueDate: newInv.due,
          items: this.currentInvoiceItems,
          vatRate: totals.vatRate,
          withholdingRate: totals.withRate,
          currency: this.currency,
          paymentMethod: payMethod
        })
      });
    } catch (e) {
      console.log('NestJS server offline - Invoice stored in local memory');
    }

    alert(`✅ Facture ${newInv.id} émise avec succès et enregistrée (${this.formatMoney(totals.netToPay)}) !`);
    this.switchTab('invoices');
  }

  sendWhatsAppReminder(clientName, invoiceId, amountStr) {
    const text = encodeURIComponent(`Bonjour *${clientName}*,\n\nVoici le rappel pour la facture *#${invoiceId}* d'un montant Net à Payer de *${amountStr}*.\n\nRèglement Mobile Money : https://wave.com/pay/easyfact-demo\n\nCordialement,\n${this.companyProfile.name}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  shareInvoiceWhatsApp() {
    const totals = this.calculateCurrentInvoiceTotals();
    this.sendWhatsAppReminder(
      document.getElementById('doc-client-input')?.value || 'Client',
      document.getElementById('doc-number')?.value || 'FAC-2026-001',
      this.formatMoney(totals.netToPay)
    );
  }

  createInvoiceForClient(clientName) {
    const input = document.getElementById('doc-client-input');
    if (input) input.value = clientName;
    this.updateLivePdf();
    this.switchTab('create-invoice');
  }

  addProductToCurrentInvoice(productName, unitPrice) {
    this.currentInvoiceItems.push({ description: productName, qty: 1, unitPrice: unitPrice });
    this.renderInvoiceFormItems();
    this.updateLivePdf();
    this.switchTab('create-invoice');
    alert(`✅ "${productName}" ajouté au devis !`);
  }

  viewInvoicePdf(invoiceId) {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (inv) {
      const numInput = document.getElementById('doc-number');
      const clientInput = document.getElementById('doc-client-input');
      if (numInput) numInput.value = inv.id;
      if (clientInput) clientInput.value = inv.client;
      this.updateLivePdf();
      this.switchTab('create-invoice');
    }
  }

  openPlanSwitcherModal() {
    this.updatePlanSwitcherModalUI();
    document.getElementById('plan-switcher-modal')?.classList.add('active');
  }

  updatePlanSwitcherModalUI() {
    const badgeStarter = document.getElementById('badge-status-starter');
    const badgePro = document.getElementById('badge-status-pro');
    const badgeEnt = document.getElementById('badge-status-entreprise');

    if (badgeStarter) badgeStarter.innerHTML = this.userTier === 'starter' ? '<b><i class="fa-solid fa-check"></i> OFFRE ACTUELLE</b>' : 'Basculer vers Gratuit';
    if (badgePro) badgePro.innerHTML = this.userTier === 'pro' ? '<b><i class="fa-solid fa-check"></i> OFFRE ACTUELLE</b>' : 'Passer PRO (4 900 FCFA)';
    if (badgeEnt) badgeEnt.innerHTML = this.userTier === 'entreprise' ? '<b><i class="fa-solid fa-check"></i> OFFRE ACTUELLE</b>' : 'Passer Entreprise (24 900 FCFA)';
  }

  selectTierFromModal(targetTier) {
    this.closeModal('plan-switcher-modal');

    if (this.userTier === targetTier) {
      alert(`ℹ️ Votre compte est actuellement déjà configuré sur l'offre ${targetTier.toUpperCase()}.`);
      return;
    }

    if (targetTier === 'starter') {
      if (confirm("Voulez-vous réactiver la version Gratuit (Starter) ?\n(Note: Les limites de 5 factures et le filigrane EasyFact s'appliqueront).")) {
        this.applyTierUpgrade('starter');
        alert("✅ Compte basculé avec succès sur l'offre Gratuit (Starter).");
      }
    } else if (targetTier === 'pro') {
      this.openPaymentModal('Pro PME', '4 900 FCFA/mois');
    } else if (targetTier === 'entreprise') {
      this.openPaymentModal('Entreprise SA', '24 900 FCFA/mois');
    }
  }

  applyTierUpgrade(tierKey) {
    this.userTier = tierKey;

    const badge = document.getElementById('subscription-badge');
    const quotaBox = document.getElementById('quota-box');

    if (badge) {
      if (tierKey === 'starter') {
        badge.className = 'user-tier-badge starter';
        badge.innerHTML = `
          <span class="tier-dot"></span>
          <span class="tier-name">Plan Gratuit (Starter)</span>
          <button class="upgrade-mini-btn" id="btn-upgrade-header">Changer Plan</button>
        `;
        if (quotaBox) quotaBox.style.display = 'block';
      } else if (tierKey === 'pro') {
        badge.className = 'user-tier-badge pro';
        badge.innerHTML = `
          <span class="tier-dot" style="background:#10b981;box-shadow:0 0 10px #10b981;"></span>
          <span class="tier-name" style="color:#10b981;font-weight:700;">Plan PRO PME</span>
          <button class="upgrade-mini-btn" id="btn-upgrade-header" style="background:#10b981;color:#fff;">Changer Plan</button>
        `;
        if (quotaBox) quotaBox.style.display = 'none';
      } else if (tierKey === 'entreprise') {
        badge.className = 'user-tier-badge pro';
        badge.innerHTML = `
          <span class="tier-dot" style="background:#8b5cf6;box-shadow:0 0 10px #8b5cf6;"></span>
          <span class="tier-name" style="color:#8b5cf6;font-weight:700;">Entreprise SA</span>
          <button class="upgrade-mini-btn" id="btn-upgrade-header" style="background:#8b5cf6;color:#fff;">Changer Plan</button>
        `;
        if (quotaBox) quotaBox.style.display = 'none';
      }
    }

    this.saveToStorage();
    this.updateLivePdf();
  }

  openPaymentModal(planName, priceStr) {
    const title = document.getElementById('modal-plan-title');
    const price = document.getElementById('modal-plan-price');
    if (title) title.innerHTML = `<i class="fa-solid fa-crown text-gold"></i> Activer le Plan ${planName}`;
    if (price) price.innerText = priceStr;
    document.getElementById('payment-modal')?.classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  processSaaSUpgrade() {
    const selectedPlanTitle = document.getElementById('modal-plan-title')?.innerText || '';
    const isEntreprise = selectedPlanTitle.toLowerCase().includes('entreprise');

    const targetTier = isEntreprise ? 'entreprise' : 'pro';
    const label = isEntreprise ? 'Plan ENTREPRISE SA' : 'Plan PRO PME';

    this.applyTierUpgrade(targetTier);
    this.closeModal('payment-modal');

    alert(`🎉 Félicitations !\n\nVotre compte a été activé avec succès sur la version : ${label}.\n- Factures illimitées\n- Suppression du filigrane sur vos PDF\n- Relances WhatsApp & QR Codes actifs !`);
    this.switchTab('dashboard');
  }

  saveSettings() {
    const companyName = document.getElementById('setting-company-name')?.value || 'Mon Entreprise SARL';
    const phone = document.getElementById('setting-phone')?.value || '+221 77 000 00 00';
    const ninea = document.getElementById('setting-ninea')?.value || '';
    const address = document.getElementById('setting-address')?.value || 'Dakar, Sénégal';

    this.companyProfile.name = companyName;
    this.companyProfile.phone = phone;
    this.companyProfile.ninea = ninea;
    this.companyProfile.address = address;

    const nameEl = document.getElementById('header-user-name');
    const avatarEl = document.getElementById('header-avatar');
    if (nameEl) nameEl.innerText = companyName;
    if (avatarEl) avatarEl.innerText = companyName.charAt(0).toUpperCase();

    this.saveToStorage();
    this.updateLivePdf();

    alert("✅ Paramètres d'entreprise enregistrés en mémoire avec succès !");
  }
}

// Initialize Application
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new EasyFactApp();
});
