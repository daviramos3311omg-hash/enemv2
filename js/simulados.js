// js/simulados.js
//
// Orquestra pages/simulados.html: configuração (quantidade/área/ano),
// carregamento das questões, aplicação do simulado com cronômetro
// obrigatório e tela de resultado.
//
// Este arquivo nunca chama fetch() nem localStorage diretamente: toda
// comunicação passa por api.js e storage.js.
//
// Estratégia de busca de questões — importante entender por quê:
//   - SEM filtro de área: usamos GET /exams/{year}/questions com
//     limit/offset, que já devolve as questões completas em lote. É rápido
//     (1-2 requisições, respeitando o limite de taxa da API).
//   - COM filtro de área: a API não filtra por disciplina em lote, então
//     buscamos a lista resumida da prova (GET /exams/{year}) para descobrir
//     quais índices são da área escolhida, e então buscamos cada questão
//     individualmente (GET /exams/{year}/questions/{index}), com um
//     intervalo entre chamadas para respeitar o limite de 1 requisição/s da
//     API. Por isso, simulados com filtro de área ficam limitados a 10
//     questões — do contrário a espera ficaria longa demais.

import { listarProvas, listarProva, listarQuestoes, listarQuestao, ApiError } from './api.js';
import { registrarTentativa, registrarErro, registrarSimulado } from './storage.js';
import {
  escolherAleatorio,
  mostrarStatusEm,
  renderizarCorpoQuestao,
  renderizarAlternativas,
  formatarDuracao,
  formatarPorcentagem,
} from './utils.js';

const INTERVALO_ENTRE_REQUISICOES_MS = 1100; // respeita o limite de 1 req/s da API

// --- referências de DOM ---------------------------------------------------

const elStatus = document.getElementById('status');

const elSecaoConfig = document.getElementById('secao-config');
const elFiltroArea = document.getElementById('filtro-area');
const elFiltroAno = document.getElementById('filtro-ano');
const elQuantidadeOpcoes = document.querySelectorAll('input[name="quantidade"]');
const elAvisoAreaLimitada = document.getElementById('aviso-area-limitada');
const elBtnIniciar = document.getElementById('btn-iniciar');

const elSecaoAndamento = document.getElementById('secao-andamento');
const elProgresso = document.getElementById('progresso-texto');
const elProgressoBarra = document.getElementById('progresso-barra');
const elCronometro = document.getElementById('cronometro');
const elMetaAno = document.getElementById('meta-ano');
const elMetaDisciplina = document.getElementById('meta-disciplina');
const elContexto = document.getElementById('questao-contexto');
const elImagens = document.getElementById('questao-imagens');
const elEnunciado = document.getElementById('questao-enunciado');
const elAlternativas = document.getElementById('alternativas');
const elBtnAvancar = document.getElementById('btn-avancar');

const elSecaoResultado = document.getElementById('secao-resultado');
const elResultadoAcertos = document.getElementById('resultado-acertos');
const elResultadoErros = document.getElementById('resultado-erros');
const elResultadoPercentual = document.getElementById('resultado-percentual');
const elResultadoTempo = document.getElementById('resultado-tempo');
const elResultadoPorArea = document.getElementById('resultado-por-area');
const elBtnNovoSimulado = document.getElementById('btn-novo-simulado');

// --- estado em memória -----------------------------------------------------

let examesCache = null;
const provasDetalhesCache = new Map();

let questoes = []; // array de questões completas (da API)
let respostas = []; // paralelo a `questoes`: { letra: 'A' } ou null
let indiceAtual = 0;
let inicioEm = null;
let intervaloCronometro = null;

// --- utilidades -----------------------------------------------------------

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mostrarStatus(mensagem, tipo) {
  mostrarStatusEm(elStatus, mensagem, tipo);
}

function mostrarSecao(secao) {
  elSecaoConfig.hidden = secao !== 'config';
  elSecaoAndamento.hidden = secao !== 'andamento';
  elSecaoResultado.hidden = secao !== 'resultado';
}

async function garantirExamesCarregados() {
  if (!examesCache) {
    examesCache = await listarProvas();
    if (!examesCache.length) {
      throw new ApiError('Nenhuma prova disponível na API no momento.', {});
    }
  }
  return examesCache;
}

async function obterDetalhesProva(ano) {
  if (!provasDetalhesCache.has(ano)) {
    const detalhes = await listarProva(ano);
    provasDetalhesCache.set(ano, detalhes);
  }
  return provasDetalhesCache.get(ano);
}

function labelDisciplina(valor, disciplinasDaProva) {
  if (!valor) return 'Não informada';
  const encontrada = (disciplinasDaProva || []).find((d) => d.value === valor);
  return encontrada ? encontrada.label : valor;
}

// As disciplinas de uma prova vêm do próprio /exams (já carregado em
// examesCache) — usamos essa fonte em vez de depender de provasDetalhesCache,
// que só é populado quando há filtro de área ativo.
function disciplinasDoAno(ano) {
  const exame = examesCache?.find((e) => String(e.year) === String(ano));
  return exame?.disciplines || [];
}

// --- configuração ------------------------------------------------------

function preencherSelect(elSelect, opcoes) {
  opcoes.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    elSelect.appendChild(option);
  });
}

function quantidadeSelecionada() {
  const opcao = Array.from(elQuantidadeOpcoes).find((input) => input.checked);
  return opcao ? Number(opcao.value) : 10;
}

function atualizarLimiteQuantidade() {
  const areaAtiva = Boolean(elFiltroArea.value);
  elAvisoAreaLimitada.hidden = !areaAtiva;

  elQuantidadeOpcoes.forEach((input) => {
    const valor = Number(input.value);
    const bloquear = areaAtiva && valor > 10;
    input.disabled = bloquear;
    if (bloquear && input.checked) {
      input.checked = false;
      const opcaoDez = Array.from(elQuantidadeOpcoes).find((o) => o.value === '10');
      if (opcaoDez) opcaoDez.checked = true;
    }
  });
}

async function inicializarConfiguracao() {
  try {
    const exames = await garantirExamesCarregados();

    const anosOrdenados = [...exames].sort((a, b) => b.year - a.year);
    preencherSelect(
      elFiltroAno,
      anosOrdenados.map((exame) => ({ value: String(exame.year), label: String(exame.year) })),
    );

    const disciplinasBase = anosOrdenados[0]?.disciplines || [];
    preencherSelect(
      elFiltroArea,
      disciplinasBase.map((d) => ({ value: d.value, label: d.label })),
    );

    elFiltroArea.disabled = false;
    elFiltroAno.disabled = false;
    elBtnIniciar.disabled = false;
  } catch (erro) {
    mostrarStatus(
      erro instanceof ApiError ? erro.message : 'Ocorreu um erro inesperado. Tente novamente.',
      'erro',
    );
  }
}

// --- montagem do simulado --------------------------------------------------

async function montarSimuladoSemFiltroArea(ano, quantidade) {
  const anoEscolhido = ano || String(escolherAleatorio(await garantirExamesCarregados()).year);

  // Primeira chamada só para descobrir o total de questões da prova.
  const primeira = await listarQuestoes(anoEscolhido, { limit: 1, offset: 0 });
  const total = primeira.metadata.total;

  const quantidadeFinal = Math.min(quantidade, total);
  const offsetMaximo = Math.max(0, total - quantidadeFinal);
  const offset = Math.floor(Math.random() * (offsetMaximo + 1));

  const lote = await listarQuestoes(anoEscolhido, { limit: quantidadeFinal, offset });
  return lote.questions;
}

async function montarSimuladoComFiltroArea(area, ano, quantidade) {
  const exames = await garantirExamesCarregados();
  const anosCandidatos = ano
    ? [ano]
    : [...exames.map((e) => String(e.year))].sort(() => Math.random() - 0.5);

  const pool = []; // { ano, index, language }
  const MAX_ANOS_A_TENTAR = 8;

  for (let i = 0; i < Math.min(MAX_ANOS_A_TENTAR, anosCandidatos.length) && pool.length < quantidade * 2; i++) {
    const anoAtual = anosCandidatos[i];
    const detalhes = await obterDetalhesProva(anoAtual);
    (detalhes.questions || [])
      .filter((q) => q.discipline === area)
      .forEach((q) => pool.push({ ano: anoAtual, index: q.index, language: q.language }));
  }

  if (!pool.length) {
    throw new ApiError('Não encontramos questões para essa combinação de filtros.', {});
  }

  const poolEmbaralhado = [...pool].sort(() => Math.random() - 0.5);
  const selecionadas = poolEmbaralhado.slice(0, quantidade);

  const questoesCompletas = [];
  for (let i = 0; i < selecionadas.length; i++) {
    mostrarStatus(`Carregando questão ${i + 1} de ${selecionadas.length}...`, 'loading');
    const item = selecionadas[i];
    const questaoCompleta = await listarQuestao(item.ano, item.index, {
      language: item.language || undefined,
    });
    questoesCompletas.push(questaoCompleta);
    if (i < selecionadas.length - 1) {
      await aguardar(INTERVALO_ENTRE_REQUISICOES_MS);
    }
  }
  return questoesCompletas;
}

async function iniciarSimulado() {
  const area = elFiltroArea.value;
  const ano = elFiltroAno.value;
  const quantidade = quantidadeSelecionada();

  elBtnIniciar.disabled = true;
  mostrarStatus('Preparando simulado...', 'loading');

  try {
    questoes = area
      ? await montarSimuladoComFiltroArea(area, ano, quantidade)
      : await montarSimuladoSemFiltroArea(ano, quantidade);

    if (!questoes.length) {
      throw new ApiError('Não encontramos questões para essa combinação de filtros.', {});
    }

    if (questoes.length < quantidade) {
      mostrarStatus(
        `Só encontramos ${questoes.length} questão(ões) para esse filtro — o simulado terá ${questoes.length} questão(ões).`,
        null,
      );
    } else {
      mostrarStatus('', null);
    }

    respostas = questoes.map(() => null);
    indiceAtual = 0;
    inicioEm = Date.now();
    iniciarCronometro();
    mostrarSecao('andamento');
    renderizarQuestaoAtual();
  } catch (erro) {
    mostrarStatus(
      erro instanceof ApiError ? erro.message : 'Ocorreu um erro inesperado. Tente novamente.',
      'erro',
    );
  } finally {
    elBtnIniciar.disabled = false;
  }
}

// --- cronômetro --------------------------------------------------------

function iniciarCronometro() {
  atualizarCronometro();
  intervaloCronometro = setInterval(atualizarCronometro, 1000);
}

function pararCronometro() {
  if (intervaloCronometro) {
    clearInterval(intervaloCronometro);
    intervaloCronometro = null;
  }
}

function atualizarCronometro() {
  elCronometro.textContent = formatarDuracao(Date.now() - inicioEm);
}

// --- questão em andamento ------------------------------------------------

function renderizarQuestaoAtual() {
  const q = questoes[indiceAtual];
  const disciplinasDaProva = disciplinasDoAno(q.year);

  elProgresso.textContent = `Questão ${indiceAtual + 1} de ${questoes.length}`;
  elProgressoBarra.style.width = `${((indiceAtual + 1) / questoes.length) * 100}%`;

  elMetaAno.textContent = q.year ?? '—';
  elMetaDisciplina.textContent = labelDisciplina(q.discipline, disciplinasDaProva);

  renderizarCorpoQuestao(q, { elContexto, elImagens, elEnunciado });

  renderizarAlternativas(elAlternativas, q.alternatives || [], {
    nomeGrupo: 'alternativa-simulado',
    valorSelecionado: respostas[indiceAtual]?.letra || null,
    aoSelecionar: (letra) => {
      respostas[indiceAtual] = { letra };
    },
  });

  const ultima = indiceAtual === questoes.length - 1;
  elBtnAvancar.textContent = ultima ? 'Finalizar simulado' : 'Próxima questão';
}

function avancar() {
  if (indiceAtual < questoes.length - 1) {
    indiceAtual += 1;
    renderizarQuestaoAtual();
  } else {
    finalizarSimulado();
  }
}

// --- resultado -----------------------------------------------------------

function finalizarSimulado() {
  pararCronometro();
  const tempoMs = Date.now() - inicioEm;

  let acertos = 0;
  const porArea = {};

  questoes.forEach((q, i) => {
    const resposta = respostas[i];
    const letraEscolhida = resposta ? resposta.letra : null;
    const correta = letraEscolhida === q.correctAlternative;
    if (correta) acertos += 1;

    const disciplinasDaProva = disciplinasDoAno(q.year);
    const disciplinaLabel = labelDisciplina(q.discipline, disciplinasDaProva);
    const chave = q.discipline || 'nao-informada';
    if (!porArea[chave]) porArea[chave] = { label: disciplinaLabel, total: 0, acertos: 0 };
    porArea[chave].total += 1;
    if (correta) porArea[chave].acertos += 1;

    // O simulado também alimenta o histórico geral, o dashboard, o streak
    // e o caderno de erros — assim como uma questão respondida fora dele.
    const referencia = {
      ano: q.year,
      index: q.index,
      disciplina: q.discipline,
      disciplinaLabel,
      titulo: q.title,
      language: q.language || null,
    };
    registrarTentativa(referencia, { respostaEscolhida: letraEscolhida, correta });
    if (!correta) registrarErro(referencia);
  });

  const erros = questoes.length - acertos;
  const percentual = questoes.length ? (acertos / questoes.length) * 100 : 0;

  registrarSimulado({
    quantidade: questoes.length,
    acertos,
    erros,
    percentual,
    tempoMs,
    porArea,
  });

  renderizarResultado({ acertos, erros, percentual, tempoMs, porArea });
  mostrarSecao('resultado');
}

function renderizarResultado({ acertos, erros, percentual, tempoMs, porArea }) {
  elResultadoAcertos.textContent = `${acertos}/${questoes.length}`;
  elResultadoErros.textContent = erros;
  elResultadoPercentual.textContent = formatarPorcentagem(percentual);
  elResultadoTempo.textContent = formatarDuracao(tempoMs);

  elResultadoPorArea.textContent = '';
  Object.values(porArea)
    .sort((a, b) => b.total - a.total)
    .forEach((d) => {
      const taxa = d.total ? (d.acertos / d.total) * 100 : 0;

      const linha = document.createElement('div');
      linha.className = 'barra-disciplina';

      const cabecalho = document.createElement('div');
      cabecalho.className = 'barra-disciplina-cabecalho';
      const nome = document.createElement('span');
      nome.textContent = d.label;
      const valor = document.createElement('span');
      valor.textContent = `${d.acertos}/${d.total} (${formatarPorcentagem(taxa)})`;
      cabecalho.append(nome, valor);

      const trilha = document.createElement('div');
      trilha.className = 'barra-trilha';
      const preenchimento = document.createElement('div');
      preenchimento.className = 'barra-preenchimento';
      preenchimento.style.width = `${taxa}%`;
      trilha.appendChild(preenchimento);

      linha.append(cabecalho, trilha);
      elResultadoPorArea.appendChild(linha);
    });
}

function novoSimulado() {
  questoes = [];
  respostas = [];
  indiceAtual = 0;
  inicioEm = null;
  mostrarStatus('', null);
  mostrarSecao('config');
}

// --- ligação dos eventos ---------------------------------------------------

elFiltroArea.addEventListener('change', atualizarLimiteQuantidade);
elBtnIniciar.addEventListener('click', iniciarSimulado);
elBtnAvancar.addEventListener('click', avancar);
elBtnNovoSimulado.addEventListener('click', novoSimulado);

// --- inicialização ---------------------------------------------------------

mostrarSecao('config');
inicializarConfiguracao();
