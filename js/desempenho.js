// js/desempenho.js
//
// Renderiza pages/desempenho.html: visão detalhada do desempenho, só a
// partir de storage.js (sem chamadas à API — funciona offline).

import { obterResumoDesempenho, obterEvolucaoDiaria } from './storage.js';
import { formatarPorcentagem, formatarDataBR } from './utils.js';

const elResumoTotal = document.getElementById('resumo-total');
const elResumoAcertos = document.getElementById('resumo-acertos');
const elResumoTaxa = document.getElementById('resumo-taxa');
const elTabelaDisciplinas = document.getElementById('tabela-disciplinas');
const elGraficoQuestoesPorDia = document.getElementById('grafico-questoes-por-dia');
const elEstadoSemDados = document.getElementById('estado-sem-dados');
const elConteudo = document.getElementById('desempenho-conteudo');

function limpar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function renderizarResumo(resumo) {
  elResumoTotal.textContent = resumo.total;
  elResumoAcertos.textContent = resumo.acertos;
  elResumoTaxa.textContent = formatarPorcentagem(resumo.taxaAcerto);
}

function renderizarTabelaDisciplinas(porDisciplina) {
  limpar(elTabelaDisciplinas);
  const disciplinas = Object.values(porDisciplina).sort((a, b) => b.total - a.total);

  disciplinas.forEach((d) => {
    const taxa = d.total ? (d.acertos / d.total) * 100 : 0;
    const linha = document.createElement('tr');

    const celNome = document.createElement('td');
    celNome.textContent = d.label;

    const celTotal = document.createElement('td');
    celTotal.textContent = d.total;

    const celAcertos = document.createElement('td');
    celAcertos.textContent = d.acertos;

    const celTaxa = document.createElement('td');
    celTaxa.textContent = formatarPorcentagem(taxa);
    celTaxa.className = taxa >= 70 ? 'texto-acerto' : taxa >= 50 ? '' : 'texto-erro';

    linha.append(celNome, celTotal, celAcertos, celTaxa);
    elTabelaDisciplinas.appendChild(linha);
  });
}

// Gráfico de barras simples (questões respondidas por dia, últimos 14 dias).
function renderizarGraficoQuestoesPorDia(evolucao) {
  limpar(elGraficoQuestoesPorDia);

  const maiorTotal = Math.max(1, ...evolucao.map((d) => d.total));

  evolucao.forEach((d) => {
    const coluna = document.createElement('div');
    coluna.className = 'coluna-barra';
    coluna.title = `${formatarDataBR(d.dia)}: ${d.total} questão(ões)`;

    const barra = document.createElement('div');
    barra.className = 'coluna-barra-preenchimento';
    barra.style.height = `${(d.total / maiorTotal) * 100}%`;

    coluna.appendChild(barra);
    elGraficoQuestoesPorDia.appendChild(coluna);
  });
}

function renderizarPagina() {
  const resumo = obterResumoDesempenho();

  if (!resumo.total) {
    elEstadoSemDados.hidden = false;
    elConteudo.hidden = true;
    return;
  }

  elEstadoSemDados.hidden = true;
  elConteudo.hidden = false;

  renderizarResumo(resumo);
  renderizarTabelaDisciplinas(resumo.porDisciplina);
  renderizarGraficoQuestoesPorDia(obterEvolucaoDiaria(14));
}

renderizarPagina();
