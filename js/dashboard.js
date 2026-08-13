// js/dashboard.js
//
// Renderiza o dashboard (index.html) a partir dos dados agregados em
// storage.js. Não faz nenhuma chamada à API — o dashboard funciona
// totalmente offline, usando só o que já foi respondido no navegador.

import {
  obterResumoDesempenho,
  obterStreak,
  obterMetas,
  definirMetas,
  obterHistorico,
  obterEvolucaoDiaria,
  obterRecomendacoes,
} from './storage.js';
import { formatarPorcentagem, formatarDataBR, animarContador } from './utils.js';

const elResolvidas = document.getElementById('stat-resolvidas');
const elTaxaAcerto = document.getElementById('stat-taxa-acerto');
const elStreak = document.getElementById('stat-streak');
const elIconeChama = document.getElementById('icone-chama');
const elMetaTextoDiaria = document.getElementById('meta-texto-diaria');
const elMetaBarraDiaria = document.getElementById('meta-barra-diaria');
const elMetaTextoSemanal = document.getElementById('meta-texto-semanal');
const elMetaBarraSemanal = document.getElementById('meta-barra-semanal');
const elBtnEditarMetas = document.getElementById('btn-editar-metas');
const elFormMetas = document.getElementById('form-metas');
const elInputMetaDiaria = document.getElementById('input-meta-diaria');
const elInputMetaSemanal = document.getElementById('input-meta-semanal');
const elDesempenhoPorDisciplina = document.getElementById('desempenho-por-disciplina');
const elRecomendacoes = document.getElementById('recomendacoes');
const elAtividadeRecente = document.getElementById('atividade-recente');
const elGraficoEvolucao = document.getElementById('grafico-evolucao');
const elEstadoSemDados = document.getElementById('estado-sem-dados');
const elDashboardConteudo = document.getElementById('dashboard-conteudo');

function limpar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function renderizarCardsPrincipais(resumo, streak, metas) {
  animarContador(elResolvidas, resumo.total);
  if (resumo.total) {
    animarContador(elTaxaAcerto, resumo.taxaAcerto, { formatar: formatarPorcentagem });
  } else {
    elTaxaAcerto.textContent = '—';
  }
  elStreak.textContent = streak.atual > 0 ? `🔥 ${streak.atual} dia${streak.atual > 1 ? 's' : ''}` : '—';
  elIconeChama?.classList.toggle('stat-icone-chama--ativa', streak.atual > 0);

  const progressoDiario = metas.diaria ? Math.min(100, (resumo.resolvidasHoje / metas.diaria) * 100) : 0;
  elMetaTextoDiaria.textContent = `Meta diária: ${resumo.resolvidasHoje}/${metas.diaria}`;
  elMetaBarraDiaria.style.width = `${progressoDiario}%`;

  const progressoSemanal = metas.semanal
    ? Math.min(100, (resumo.resolvidasNaSemana / metas.semanal) * 100)
    : 0;
  elMetaTextoSemanal.textContent = `Meta semanal: ${resumo.resolvidasNaSemana}/${metas.semanal}`;
  elMetaBarraSemanal.style.width = `${progressoSemanal}%`;
}

function renderizarDesempenhoPorDisciplina(porDisciplina) {
  limpar(elDesempenhoPorDisciplina);
  const disciplinas = Object.values(porDisciplina).sort((a, b) => b.total - a.total);

  if (!disciplinas.length) {
    const vazio = document.createElement('p');
    vazio.className = 'texto-suave';
    vazio.textContent = 'Responda algumas questões para ver seu desempenho por área.';
    elDesempenhoPorDisciplina.appendChild(vazio);
    return;
  }

  disciplinas.forEach((d) => {
    const taxa = d.total ? (d.acertos / d.total) * 100 : 0;

    const linha = document.createElement('div');
    linha.className = 'barra-disciplina';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'barra-disciplina-cabecalho';
    const nome = document.createElement('span');
    nome.textContent = d.label;
    const valor = document.createElement('span');
    valor.textContent = formatarPorcentagem(taxa);
    cabecalho.append(nome, valor);

    const trilha = document.createElement('div');
    trilha.className = 'barra-trilha';
    const preenchimento = document.createElement('div');
    preenchimento.className = 'barra-preenchimento';
    preenchimento.style.width = `${taxa}%`;
    trilha.appendChild(preenchimento);

    linha.append(cabecalho, trilha);
    elDesempenhoPorDisciplina.appendChild(linha);
  });
}

function renderizarRecomendacoes(recomendacoes) {
  limpar(elRecomendacoes);

  if (!recomendacoes.length) {
    elRecomendacoes.hidden = true;
    return;
  }

  elRecomendacoes.hidden = false;
  recomendacoes.forEach((rec) => {
    const cartao = document.createElement('div');
    cartao.className = `recomendacao recomendacao--${rec.tipo}`;

    const texto = document.createElement('p');
    texto.textContent = rec.texto;
    cartao.appendChild(texto);

    if (rec.tipo === 'ponto-fraco' && rec.valor) {
      const link = document.createElement('a');
      link.className = 'link-ver-mais';
      link.href = `pages/questoes.html?area=${encodeURIComponent(rec.valor)}`;
      link.textContent = `Praticar ${rec.disciplina} →`;
      cartao.appendChild(link);
    }

    elRecomendacoes.appendChild(cartao);
  });
}

function renderizarAtividadeRecente(historico) {
  limpar(elAtividadeRecente);
  const recentes = [...historico].reverse().slice(0, 8);

  if (!recentes.length) {
    const vazio = document.createElement('p');
    vazio.className = 'texto-suave';
    vazio.textContent = 'Nenhuma questão respondida ainda.';
    elAtividadeRecente.appendChild(vazio);
    return;
  }

  const lista = document.createElement('ul');
  lista.className = 'lista-atividade';
  recentes.forEach((item) => {
    const li = document.createElement('li');
    li.className = item.correta ? 'item-atividade item-atividade--acerto' : 'item-atividade item-atividade--erro';

    const icone = document.createElement('span');
    icone.textContent = item.correta ? '✅' : '❌';

    const texto = document.createElement('span');
    texto.textContent = `ENEM ${item.ano} · ${item.disciplinaLabel || 'Disciplina não informada'}`;

    const data = document.createElement('span');
    data.className = 'item-atividade-data';
    data.textContent = formatarDataBR(item.data.slice(0, 10));

    li.append(icone, texto, data);
    lista.appendChild(li);
  });
  elAtividadeRecente.appendChild(lista);
}

// Gráfico simples de evolução da taxa de acerto (SVG gerado à mão — sem
// biblioteca de gráficos, já que os dados são poucos e simples).
function renderizarGraficoEvolucao(evolucao) {
  limpar(elGraficoEvolucao);

  const comDados = evolucao.filter((d) => d.taxaAcerto !== null);
  if (comDados.length < 2) {
    const vazio = document.createElement('p');
    vazio.className = 'texto-suave';
    vazio.textContent = 'Continue respondendo questões em dias diferentes para ver sua evolução aqui.';
    elGraficoEvolucao.appendChild(vazio);
    return;
  }

  const largura = 100; // usamos viewBox percentual, escala com o CSS
  const altura = 32;
  const passoX = largura / (evolucao.length - 1);

  const pontos = evolucao.map((d, i) => {
    const x = i * passoX;
    const y = d.taxaAcerto === null ? null : altura - (d.taxaAcerto / 100) * altura;
    return { x, y, temDado: d.taxaAcerto !== null, dia: d.dia };
  });

  const pontosValidos = pontos.filter((p) => p.temDado);
  const linha = pontosValidos.map((p) => `${p.x},${p.y}`).join(' ');

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'grafico-evolucao-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `Evolução da taxa de acerto nos últimos ${evolucao.length} dias`,
  );

  const polyline = document.createElementNS(svgNS, 'polyline');
  polyline.setAttribute('points', linha);
  polyline.setAttribute('class', 'grafico-evolucao-linha');
  svg.appendChild(polyline);

  pontosValidos.forEach((p) => {
    const circulo = document.createElementNS(svgNS, 'circle');
    circulo.setAttribute('cx', p.x);
    circulo.setAttribute('cy', p.y);
    circulo.setAttribute('r', 1.4);
    circulo.setAttribute('class', 'grafico-evolucao-ponto');
    svg.appendChild(circulo);
  });

  elGraficoEvolucao.appendChild(svg);

  const legenda = document.createElement('div');
  legenda.className = 'grafico-evolucao-legenda';
  const primeiro = document.createElement('span');
  primeiro.textContent = formatarDataBR(evolucao[0].dia);
  const ultimo = document.createElement('span');
  ultimo.textContent = formatarDataBR(evolucao[evolucao.length - 1].dia);
  legenda.append(primeiro, ultimo);
  elGraficoEvolucao.appendChild(legenda);
}

function renderizarDashboard() {
  const resumo = obterResumoDesempenho();
  const streak = obterStreak();
  const metas = obterMetas();
  const historico = obterHistorico();
  const evolucao = obterEvolucaoDiaria(14);

  if (!resumo.total) {
    elEstadoSemDados.hidden = false;
    elDashboardConteudo.hidden = true;
    return;
  }

  elEstadoSemDados.hidden = true;
  elDashboardConteudo.hidden = false;

  renderizarCardsPrincipais(resumo, streak, metas);
  renderizarDesempenhoPorDisciplina(resumo.porDisciplina);
  renderizarRecomendacoes(obterRecomendacoes());
  renderizarAtividadeRecente(historico);
  renderizarGraficoEvolucao(evolucao);
}

// --- edição de metas -----------------------------------------------------

elBtnEditarMetas.addEventListener('click', () => {
  const abrindo = elFormMetas.hidden;
  if (abrindo) {
    const metas = obterMetas();
    elInputMetaDiaria.value = metas.diaria;
    elInputMetaSemanal.value = metas.semanal;
  }
  elFormMetas.hidden = !abrindo;
  elBtnEditarMetas.textContent = abrindo ? 'Cancelar' : 'Editar metas';
});

elFormMetas.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const diaria = Number(elInputMetaDiaria.value);
  const semanal = Number(elInputMetaSemanal.value);
  if (!diaria || !semanal) return;

  definirMetas({ diaria, semanal });
  elFormMetas.hidden = true;
  elBtnEditarMetas.textContent = 'Editar metas';
  renderizarDashboard();
});

renderizarDashboard();
