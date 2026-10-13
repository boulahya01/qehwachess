(() => {
  const select = document.querySelector('#language');
  const theme = document.querySelector('#theme');
  const labels = {
    en: {
      privacy: 'Privacy',
      terms: 'Terms',
      brand: 'Brand',
      contact: 'Contact',
      skip: 'Skip to content',
      appearance: 'Switch appearance',
      language: 'Language',
    },
    fr: {
      privacy: 'Confidentialité',
      terms: 'Conditions',
      brand: 'Identité',
      contact: 'Contact',
      skip: 'Aller au contenu',
      appearance: 'Changer d’apparence',
      language: 'Langue',
    },
    ar: {
      privacy: 'الخصوصية',
      terms: 'الشروط',
      brand: 'الهوية',
      contact: 'تواصل معنا',
      skip: 'انتقل إلى المحتوى',
      appearance: 'تغيير المظهر',
      language: 'اللغة',
    },
  };
  function language(value) {
    document.documentElement.lang = value;
    document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr';
    document
      .querySelectorAll('[data-language]')
      .forEach((el) => (el.hidden = el.dataset.language !== value));
    select.value = value;
    const text = labels[value];
    document.querySelector('.skip').textContent = text.skip;
    theme.setAttribute('aria-label', text.appearance);
    select.setAttribute('aria-label', text.language + ' / Language');
    document.querySelectorAll('footer a').forEach((link) => {
      const page = link.getAttribute('href').split('/').filter(Boolean)[0];
      link.textContent = text[page] || text.contact;
    });
    const page = location.pathname.split('/').filter(Boolean)[0];
    document.title = (text[page] || 'Qehwa Chess') + ' · Qehwa Chess';
    try {
      localStorage.setItem('qehwa-language', value);
    } catch {}
  }
  let lang = 'en',
    mode = 'light';
  try {
    lang = localStorage.getItem('qehwa-language') || 'en';
    mode = localStorage.getItem('qehwa-theme') || mode;
  } catch {}
  language(['en', 'fr', 'ar'].includes(lang) ? lang : 'en');
  document.documentElement.dataset.theme = mode;
  select.addEventListener('change', () => language(select.value));
  theme.addEventListener('click', () => {
    const next =
      document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('qehwa-theme', next);
    } catch {}
  });
})();
