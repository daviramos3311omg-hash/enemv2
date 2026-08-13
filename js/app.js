// js/app.js
//
// Executado em todas as páginas: marca o link ativo na navegação principal
// e controla a alternância de tema claro/escuro (persistida em storage.js).
// Não faz nada relacionado à API.

import { obterConfig, definirConfig } from './storage.js';

document.querySelectorAll('.nav-link').forEach((link) => {
  const destino = new URL(link.getAttribute('href'), window.location.href).pathname;
  const atual = window.location.pathname;
  if (destino === atual || destino.endsWith(atual)) {
    link.classList.add('nav-link--ativo');
    link.setAttribute('aria-current', 'page');
  }
});

// --- tema claro/escuro -------------------------------------------------

const elBtnTema = document.getElementById('btn-tema');

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  if (elBtnTema) {
    elBtnTema.textContent = tema === 'escuro' ? '☀️' : '🌙';
    elBtnTema.setAttribute('aria-label', tema === 'escuro' ? 'Ativar tema claro' : 'Ativar tema escuro');
  }
}

aplicarTema(obterConfig().tema);

elBtnTema?.addEventListener('click', () => {
  const temaAtual = obterConfig().tema;
  const novoTema = temaAtual === 'escuro' ? 'claro' : 'escuro';
  definirConfig({ tema: novoTema });
  aplicarTema(novoTema);
});

// --- tela de abertura (splash) -------------------------------------------
// Só existe no index.html; nas outras páginas elSplash é null e nada acontece.

const elSplash = document.getElementById('splash');
elSplash?.addEventListener('animationend', () => {
  elSplash.remove();
});
