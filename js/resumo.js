// js/resumo.js
//
// Renderiza pages/resumo.html: checklist de assuntos do ENEM por
// disciplina, mais uma seção de prioridade. Conteúdo estático vem de
// resumo-dados.js; o estado marcado/desmarcado de cada item é salvo via
// storage.js (localStorage), sem depender da API.
//
// A página é montada UMA VEZ (montarPagina). Cada clique num checkbox só
// atualiza os textos de progresso — não reconstrói o DOM, para não fechar
// os <details> que o usuário já tinha aberto.

import { CATEGORIAS, PRIORIDADE } from './resumo-dados.js';
import { obterResumoMarcados, definirResumoItem } from './storage.js';
import { formatarPorcentagem } from './utils.js';

const elGeralTexto = document.getElementById('resumo-geral-texto');
const elGeralBarra = document.getElementById('resumo-geral-barra');
const elPrioridade = document.getElementById('resumo-prioridade');
const elCategorias = document.getElementById('resumo-categorias');

function idsDaCategoria(categoria) {
  return categoria.topicos.map((_, i) => `${categoria.id}:${i}`);
}

function idsDoNivel(nivel) {
  return nivel.topicos.map((_, i) => `prioridade-${nivel.id}:${i}`);
}

function contarProgresso(ids, marcados) {
  const total = ids.length;
  const feitos = ids.filter((id) => marcados[id]).length;
  return { total, feitos };
}

function criarLinhaChecklist(id, texto, marcados) {
  const label = document.createElement('label');
  label.className = 'resumo-item';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(marcados[id]);
  input.addEventListener('change', () => {
    definirResumoItem(id, input.checked);
    atualizarTodosProgressos();
  });

  const span = document.createElement('span');
  span.textContent = texto;

  label.append(input, span);
  return label;
}

function montarPrioridade(marcados) {
  PRIORIDADE.forEach((nivel) => {
    const bloco = document.createElement('div');
    bloco.className = 'resumo-bloco';
    bloco.dataset.nivelId = nivel.id;

    const cabecalho = document.createElement('div');
    cabecalho.className = 'resumo-bloco-cabecalho';

    const titulo = document.createElement('h3');
    titulo.textContent = nivel.nome;

    const progresso = document.createElement('span');
    progresso.className = 'resumo-progresso-texto';

    cabecalho.append(titulo, progresso);

    const lista = document.createElement('div');
    lista.className = 'resumo-lista';
    nivel.topicos.forEach((topico, i) => {
      const id = `prioridade-${nivel.id}:${i}`;
      lista.appendChild(criarLinhaChecklist(id, topico, marcados));
    });

    bloco.append(cabecalho, lista);
    elPrioridade.appendChild(bloco);
  });
}

function montarCategorias(marcados) {
  CATEGORIAS.forEach((categoria) => {
    const details = document.createElement('details');
    details.className = 'resumo-disciplina';
    details.dataset.categoriaId = categoria.id;

    const summary = document.createElement('summary');

    const nome = document.createElement('span');
    nome.textContent = `${categoria.emoji} ${categoria.nome}`;

    const progresso = document.createElement('span');
    progresso.className = 'resumo-progresso-texto';

    summary.append(nome, progresso);
    details.appendChild(summary);

    const lista = document.createElement('div');
    lista.className = 'resumo-lista';
    categoria.topicos.forEach((topico, i) => {
      const id = `${categoria.id}:${i}`;
      lista.appendChild(criarLinhaChecklist(id, topico, marcados));
    });
    details.appendChild(lista);

    elCategorias.appendChild(details);
  });
}

function atualizarTodosProgressos() {
  const marcados = obterResumoMarcados();

  const todosIds = CATEGORIAS.flatMap(idsDaCategoria);
  const geral = contarProgresso(todosIds, marcados);
  const pctGeral = geral.total ? (geral.feitos / geral.total) * 100 : 0;
  elGeralTexto.textContent = `Progresso geral: ${geral.feitos}/${geral.total} (${formatarPorcentagem(pctGeral)})`;
  elGeralBarra.style.width = `${pctGeral}%`;

  PRIORIDADE.forEach((nivel) => {
    const prog = contarProgresso(idsDoNivel(nivel), marcados);
    const bloco = elPrioridade.querySelector(`[data-nivel-id="${nivel.id}"]`);
    bloco.querySelector('.resumo-progresso-texto').textContent = `${prog.feitos}/${prog.total}`;
  });

  CATEGORIAS.forEach((categoria) => {
    const prog = contarProgresso(idsDaCategoria(categoria), marcados);
    const details = elCategorias.querySelector(`[data-categoria-id="${categoria.id}"]`);
    details.querySelector('.resumo-progresso-texto').textContent = `${prog.feitos}/${prog.total}`;
  });
}

function montarPagina() {
  const marcados = obterResumoMarcados();
  montarPrioridade(marcados);
  montarCategorias(marcados);
  atualizarTodosProgressos();
}

montarPagina();
