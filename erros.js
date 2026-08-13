// js/erros.js
//
// Renderiza pages/erros.html: lista o caderno de erros (guardado em
// storage.js), com quantas vezes cada questão foi errada, e permite
// revisá-las (abre questoes.html em modo de revisão) ou removê-las.

import { obterCadernoDeErros, removerDoCadernoDeErros } from './storage.js';
import { formatarDataBR } from './utils.js';

const elLista = document.getElementById('lista-erros');
const elEstadoVazio = document.getElementById('estado-vazio');

function limpar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function criarCartaoErro(item) {
  const cartao = document.createElement('li');
  cartao.className = 'cartao-item';

  const info = document.createElement('div');
  info.className = 'cartao-item-info';

  const titulo = document.createElement('strong');
  titulo.textContent = item.titulo || `Questão ${item.index}`;

  const meta = document.createElement('span');
  meta.className = 'texto-suave';
  meta.textContent = `ENEM ${item.ano} · ${item.disciplinaLabel || 'Disciplina não informada'} · errada ${item.vezes}x · última vez em ${formatarDataBR(
    item.ultimoErroEm.slice(0, 10),
  )}`;

  info.append(titulo, meta);

  const acoes = document.createElement('div');
  acoes.className = 'cartao-item-acoes';

  const btnRevisar = document.createElement('a');
  btnRevisar.className = 'botao botao--primario botao--pequeno';
  const paramsBase = `ano=${encodeURIComponent(item.ano)}&index=${encodeURIComponent(item.index)}`;
  const paramLanguage = item.language ? `&language=${encodeURIComponent(item.language)}` : '';
  btnRevisar.href = `questoes.html?${paramsBase}${paramLanguage}`;
  btnRevisar.textContent = 'Revisar';

  const btnRemover = document.createElement('button');
  btnRemover.type = 'button';
  btnRemover.className = 'botao botao--secundario botao--pequeno';
  btnRemover.textContent = 'Remover';
  btnRemover.addEventListener('click', () => {
    removerDoCadernoDeErros(item.ano, item.index);
    renderizarLista();
  });

  acoes.append(btnRevisar, btnRemover);
  cartao.append(info, acoes);
  return cartao;
}

function renderizarLista() {
  // Mais erradas primeiro, depois mais recentes.
  const caderno = [...obterCadernoDeErros()].sort((a, b) => {
    if (b.vezes !== a.vezes) return b.vezes - a.vezes;
    return new Date(b.ultimoErroEm) - new Date(a.ultimoErroEm);
  });
  limpar(elLista);

  if (!caderno.length) {
    elEstadoVazio.hidden = false;
    elLista.hidden = true;
    return;
  }

  elEstadoVazio.hidden = true;
  elLista.hidden = false;
  caderno.forEach((item) => elLista.appendChild(criarCartaoErro(item)));
}

renderizarLista();
