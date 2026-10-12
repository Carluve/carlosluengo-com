class AwDataTable extends HTMLElement {
  private page = 1;
  private query = '';
  private group = 'all';
  private segment = 'all';
  private pageSize = 10;

  connectedCallback() {
    this.pageSize = Number(this.dataset.pageSize || 10) || 10;
    const initial = new URLSearchParams(window.location.search).get('q')?.trim() || '';
    this.query = initial;
    this.syncInputs();
    this.addEventListener('input', this.onInput);
    this.addEventListener('change', this.onChange);
    this.addEventListener('click', this.onClick);
    this.apply();
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.onInput);
    this.removeEventListener('change', this.onChange);
    this.removeEventListener('click', this.onClick);
  }

  setQuery(value: string) {
    const next = value.trim();
    if (next === this.query) {
      this.syncInputs();
      return;
    }
    this.query = next;
    this.page = 1;
    this.syncInputs();
    this.apply();
  }

  setSegment(id: string) {
    if (id === 'cover') {
      this.segment = 'cover';
      this.group = 'all';
    } else if (id === 'review') {
      this.segment = 'all';
      this.group = 'revision';
    } else if (id === 'all') {
      this.segment = 'all';
      this.group = 'all';
    } else {
      this.segment = 'all';
      this.group = id;
    }
    this.page = 1;
    this.apply();
  }

  private onInput = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.hasAttribute('data-query')) return;
    this.setQuery(target.value);
  };

  private onChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.hasAttribute('data-year-option')) {
      this.page = 1;
      this.apply();
      return;
    }
    if (target.dataset.column) {
      this.classList.toggle(`is-col-hidden-${target.dataset.column}`, !target.checked);
    }
  };

  private onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const groupButton = target.closest<HTMLButtonElement>('[data-group]');
    if (groupButton?.dataset.group) {
      this.group = groupButton.dataset.group;
      this.segment = 'all';
      this.page = 1;
      this.apply();
      return;
    }

    const pageButton = target.closest<HTMLButtonElement>('[data-page]');
    if (pageButton?.dataset.page) {
      this.page += pageButton.dataset.page === 'next' ? 1 : -1;
      if (this.page < 1) this.page = 1;
      this.apply();
      return;
    }

    const copyButton = target.closest<HTMLButtonElement>('[data-copy]');
    if (copyButton) {
      event.preventDefault();
      const href = new URL(copyButton.dataset.copy || '/', window.location.origin).href;
      const previous = copyButton.textContent || 'Copiar enlace';
      navigator.clipboard
        .writeText(href)
        .then(() => {
          copyButton.textContent = 'Enlace copiado';
          window.setTimeout(() => {
            copyButton.textContent = previous;
          }, 1600);
        })
        .catch(() => {
          copyButton.textContent = 'No se pudo copiar';
        });
    }
  };

  private rows() {
    return [...this.querySelectorAll<HTMLTableRowElement>('tr[data-row]')];
  }

  private selectedYears() {
    const boxes = [...this.querySelectorAll<HTMLInputElement>('[data-year-option]')];
    if (boxes.length === 0) return null;
    return new Set(boxes.filter((box) => box.checked).map((box) => box.value));
  }

  private matches(row: HTMLTableRowElement, years: Set<string> | null, ignoreGroup = false) {
    if (!ignoreGroup && this.group !== 'all' && row.dataset.group !== this.group) return false;
    if (this.segment === 'cover' && row.dataset.cover !== '1') return false;
    if (years && !years.has(row.dataset.year || '')) return false;
    if (this.query && !(row.dataset.search || '').toLowerCase().includes(this.query.toLowerCase())) return false;
    return true;
  }

  private syncInputs() {
    this.querySelectorAll<HTMLInputElement>('[data-query]').forEach((input) => {
      if (input.value !== this.query) input.value = this.query;
    });
    const shell = document.querySelector<HTMLInputElement>('#shell-q');
    if (shell && shell.value !== this.query) shell.value = this.query;
  }

  private apply() {
    const years = this.selectedYears();
    const matched = this.rows().filter((row) => this.matches(row, years));
    const pages = Math.max(1, Math.ceil(matched.length / this.pageSize));
    if (this.page > pages) this.page = pages;
    const start = (this.page - 1) * this.pageSize;
    const visible = new Set(matched.slice(start, start + this.pageSize));

    for (const row of this.rows()) row.hidden = !visible.has(row);

    const yearsOnPage = new Set([...visible].map((row) => row.dataset.year));
    this.querySelectorAll<HTMLTableRowElement>('tr[data-year-header]').forEach((header) => {
      const year = header.dataset.yearHeader || '';
      const count = matched.filter((row) => row.dataset.year === year).length;
      header.hidden = count === 0 || !yearsOnPage.has(year);
      const badge = header.querySelector('[data-year-count]');
      if (badge) badge.textContent = String(count);
    });

    const empty = this.querySelector<HTMLElement>('[data-empty]');
    if (empty) empty.hidden = matched.length !== 0;

    const from = matched.length === 0 ? 0 : start + 1;
    const to = Math.min(start + this.pageSize, matched.length);
    const range = this.querySelector('[data-range]');
    if (range) range.textContent = `Mostrando ${from}–${to} de ${matched.length}`;

    const total = this.querySelector('[data-total]');
    if (total) total.textContent = String(matched.length);

    const previous = this.querySelector<HTMLButtonElement>('[data-page="prev"]');
    const next = this.querySelector<HTMLButtonElement>('[data-page="next"]');
    if (previous) previous.disabled = this.page <= 1 || matched.length === 0;
    if (next) next.disabled = to >= matched.length;

    const pool = this.rows().filter((row) => this.matches(row, years, true));
    this.querySelectorAll<HTMLElement>('[data-group-count]').forEach((badge) => {
      const id = badge.dataset.groupCount || 'all';
      const count = id === 'all' ? pool.length : pool.filter((row) => row.dataset.group === id).length;
      badge.textContent = String(count);
    });

    this.querySelectorAll<HTMLButtonElement>('[data-group]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.group === this.group));
    });

    document.querySelectorAll<HTMLButtonElement>('[data-shell-segment]').forEach((button) => {
      const id = button.dataset.shellSegment;
      const pressed =
        (id === 'all' && this.group === 'all' && this.segment === 'all') ||
        (id === 'cover' && this.segment === 'cover') ||
        (id === 'review' && this.group === 'revision');
      button.setAttribute('aria-pressed', String(pressed));
    });

    this.querySelectorAll<HTMLImageElement>('img[data-thumb]').forEach((image) => {
      if (image.dataset.bound === '1') return;
      image.dataset.bound = '1';
      image.addEventListener('error', () => image.remove());
    });
  }
}

class AwAppShell extends HTMLElement {
  private menuButton?: HTMLButtonElement | null;

  connectedCallback() {
    this.menuButton = this.querySelector<HTMLButtonElement>('[data-menu]');
    this.menuButton?.addEventListener('click', this.onMenu);
    this.addEventListener('click', this.onClose);
    this.querySelector('[data-collapse]')?.addEventListener('click', this.onCollapse);
    this.querySelector('[data-shell-filter]')?.addEventListener('click', this.onFilter);
    this.querySelector('#shell-search')?.addEventListener('submit', this.onSearchSubmit);
    this.querySelector('#shell-q')?.addEventListener('input', this.onSearchInput);
    this.addEventListener('click', this.onSegment);
    this.syncCollapseLabel();
  }

  disconnectedCallback() {
    this.menuButton?.removeEventListener('click', this.onMenu);
    this.removeEventListener('click', this.onClose);
    this.querySelector('[data-collapse]')?.removeEventListener('click', this.onCollapse);
    this.querySelector('[data-shell-filter]')?.removeEventListener('click', this.onFilter);
    this.querySelector('#shell-search')?.removeEventListener('submit', this.onSearchSubmit);
    this.querySelector('#shell-q')?.removeEventListener('input', this.onSearchInput);
    this.removeEventListener('click', this.onSegment);
    document.body.style.overflow = '';
  }

  private table() {
    return this.querySelector('aw-data-table') as AwDataTable | null;
  }

  private onClose = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('[data-close]')) return;
    this.closeDrawer();
  };

  private onMenu = () => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    if (this.classList.contains('is-open')) this.closeDrawer();
    else this.openDrawer();
  };

  private openDrawer = () => {
    this.classList.add('is-open');
    this.menuButton?.setAttribute('aria-expanded', 'true');
    const backdrop = this.querySelector<HTMLElement>('[data-close]');
    if (backdrop) backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    this.querySelector<HTMLElement>('.dash-drawer-close')?.focus();
  };

  private closeDrawer = () => {
    this.classList.remove('is-open');
    this.menuButton?.setAttribute('aria-expanded', 'false');
    const backdrop = this.querySelector<HTMLElement>('[data-close]');
    if (backdrop) backdrop.hidden = true;
    document.body.style.overflow = '';
    this.menuButton?.focus();
  };

  private onCollapse = () => {
    document.documentElement.classList.toggle('dash-collapsed');
    const collapsed = document.documentElement.classList.contains('dash-collapsed');
    try {
      localStorage.setItem('dash-collapsed', collapsed ? '1' : '0');
    } catch {
      /* Storage can be blocked; the class still applies for this view. */
    }
    this.syncCollapseLabel();
  };

  private syncCollapseLabel() {
    const button = this.querySelector<HTMLButtonElement>('[data-collapse]');
    if (!button) return;
    const collapsed = document.documentElement.classList.contains('dash-collapsed');
    button.setAttribute('aria-pressed', String(collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expandir la barra lateral' : 'Contraer la barra lateral');
  }

  private onFilter = () => {
    const details = this.querySelector<HTMLDetailsElement>('[data-year-filter]');
    if (!details) return;
    details.open = true;
    details.querySelector('summary')?.focus();
  };

  private onSearchSubmit = (event: Event) => {
    if (!this.table()) return;
    event.preventDefault();
  };

  private onSearchInput = (event: Event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    this.table()?.setQuery(input.value);
  };

  private onSegment = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-shell-segment]');
    if (!button?.dataset.shellSegment) return;
    this.table()?.setSegment(button.dataset.shellSegment);
  };

  handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' && event.key !== 'Escape') return;
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    const open = this.classList.contains('is-open') && mobile;
    if (!open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDrawer();
      return;
    }

    const sidebar = this.querySelector('#navegacion');
    if (!sidebar) return;
    const focusable = [...sidebar.querySelectorAll<HTMLElement>('a, button, input, summary')].filter(
      (node) => !node.hasAttribute('disabled')
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

}

function activeShell() {
  const shell = document.querySelector('aw-app-shell');
  return shell instanceof AwAppShell ? shell : null;
}

document.addEventListener('keydown', (event) => activeShell()?.handleKeydown(event));
window.addEventListener('resize', () => {
  const shell = activeShell();
  if (window.matchMedia('(min-width: 1024px)').matches && shell?.classList.contains('is-open')) {
    shell.classList.remove('is-open');
    shell.querySelector('[data-menu]')?.setAttribute('aria-expanded', 'false');
    const backdrop = shell.querySelector<HTMLElement>('[data-close]');
    if (backdrop) backdrop.hidden = true;
    document.body.style.overflow = '';
  }
});

if (!customElements.get('aw-data-table')) customElements.define('aw-data-table', AwDataTable);
if (!customElements.get('aw-app-shell')) customElements.define('aw-app-shell', AwAppShell);

document.addEventListener('astro:page-load', () => {
  document.querySelectorAll('img[data-thumb]').forEach((node) => {
    if (!(node instanceof HTMLImageElement) || node.dataset.bound === '1') return;
    node.dataset.bound = '1';
    node.addEventListener('error', () => node.remove());
  });
});
