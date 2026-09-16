/* ============================================================
   App shell: routing, nav, bootstrap
   ============================================================ */

const App = {
  view: 'table',

  init() {
    Store.load();
    TableView.mount();
    TimelineView.mount();

    $$('#nav .nav-item').forEach(btn => btn.addEventListener('click', () => this.show(btn.dataset.view)));
    $('#btnNew').addEventListener('click', () => openPaperModal(null));
    $('#btnNew2').addEventListener('click', () => openPaperModal(null));
    $('#btnExport').addEventListener('click', exportJSON);
    $('#btnImport').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importJSONText(reader.result);
      reader.onerror = () => toast('Could not read that file.', true);
      reader.readAsText(file);
      e.target.value = '';
    });

    document.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === '1') this.show('table');
      else if (e.key === '2') this.show('board');
      else if (e.key === '3') this.show('timeline');
      else if (e.key.toLowerCase() === 'n') openPaperModal(null);
    });

    this.renderAll();
    this.show('table');
  },

  show(view) {
    this.view = view;
    $$('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    ['table', 'board', 'timeline'].forEach(v => { $('#view-' + v).hidden = v !== view; });
    if (view === 'table') TableView.render();
    else if (view === 'board') BoardView.render();
    else if (view === 'timeline') TimelineView.render();
  },

  renderAll() {
    const n = Store.papers.length;
    $('#railCount').textContent = n + ' paper' + (n === 1 ? '' : 's') + ' tracked';
    if (this.view === 'table') TableView.render();
    else if (this.view === 'board') BoardView.render();
    else if (this.view === 'timeline') TimelineView.render();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
