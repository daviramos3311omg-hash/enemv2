// js/utils.js
//
// Funções puras e helpers de DOM reutilizados por várias páginas.
// Nada aqui acessa API nem localStorage diretamente.

export function formatarPorcentagem(valor) {
  return `${Math.round(valor)}%`;
}

export function escolherAleatorio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

// Data local no formato YYYY-MM-DD. Evita o deslocamento de fuso horário que
// `new Date().toISOString()` sozinho causaria para quem não está em UTC.
export function dataLocalISO(data = new Date()) {
  const deslocamentoMin = data.getTimezoneOffset();
  const local = new Date(data.getTime() - deslocamentoMin * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function limparElemento(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function criarImagem(url, alt) {
  const img = document.createElement('img');
  img.src = url;
  img.alt = alt;
  img.loading = 'lazy';
  return img;
}

export function mostrarStatusEm(elStatus, mensagem, tipo) {
  if (!elStatus) return;
  elStatus.textContent = mensagem;
  elStatus.className = tipo ? `status status--${tipo}` : 'status';
  elStatus.hidden = !mensagem;
}

// Preenche contexto (texto-base), imagens e enunciado de uma questão nos
// elementos de DOM informados. Reaproveitado por questoes.js e simulados.js
// para não duplicar essa lógica.
export function renderizarCorpoQuestao(q, { elContexto, elImagens, elEnunciado }) {
  if (q.context) {
    renderizarMarkdownSimples(elContexto, q.context);
    elContexto.hidden = false;
  } else {
    limparElemento(elContexto);
    elContexto.hidden = true;
  }

  limparElemento(elImagens);
  if (q.files && q.files.length) {
    q.files.forEach((url) => elImagens.appendChild(criarImagem(url, `Imagem da ${q.title}`)));
    elImagens.hidden = false;
  } else {
    elImagens.hidden = true;
  }

  if (q.alternativesIntroduction) {
    elEnunciado.textContent = q.alternativesIntroduction;
    elEnunciado.hidden = false;
  } else {
    limparElemento(elEnunciado);
    elEnunciado.hidden = true;
  }
}

// Renderiza um Markdown bem simples (parágrafos, **negrito**, *itálico* e
// quebras de linha) como elementos de DOM reais — nunca via innerHTML, então
// é seguro mesmo que o texto vindo da API tenha algo inesperado. Cobre o
// que aparece nos textos-base do ENEM; não tenta suportar Markdown completo
// (listas, links, tabelas etc. ficam como texto puro, sem formatação).
export function renderizarMarkdownSimples(elemento, texto) {
  limparElemento(elemento);
  if (!texto) return;

  texto.split(/\n{2,}/).forEach((paragrafo) => {
    const p = document.createElement('p');
    renderizarLinhaComQuebras(p, paragrafo);
    elemento.appendChild(p);
  });
}

function renderizarLinhaComQuebras(container, texto) {
  const linhas = texto.split('\n');
  linhas.forEach((linha, i) => {
    renderizarInlineComEnfase(container, linha);
    if (i < linhas.length - 1) {
      container.appendChild(document.createElement('br'));
    }
  });
}

// Suporta **negrito** e *itálico* simples (não aninhados). Constrói nós de
// texto/elemento diretamente com createTextNode/createElement.
function renderizarInlineComEnfase(container, texto) {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let ultimoIndex = 0;
  let match;
  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimoIndex) {
      container.appendChild(document.createTextNode(texto.slice(ultimoIndex, match.index)));
    }
    const trecho = match[0];
    if (trecho.startsWith('**')) {
      const forte = document.createElement('strong');
      forte.textContent = trecho.slice(2, -2);
      container.appendChild(forte);
    } else {
      const enfase = document.createElement('em');
      enfase.textContent = trecho.slice(1, -1);
      container.appendChild(enfase);
    }
    ultimoIndex = regex.lastIndex;
  }
  if (ultimoIndex < texto.length) {
    container.appendChild(document.createTextNode(texto.slice(ultimoIndex)));
  }
}

/**
 * Monta a lista de alternativas (radios) de uma questão dentro de elLista.
 * aoSelecionar(letra) é chamado quando o usuário escolhe uma alternativa.
 * valorSelecionado marca uma alternativa já escolhida anteriormente (usado
 * pelos simulados, ao re-renderizar uma questão já respondida).
 */
export function renderizarAlternativas(elLista, alternativas, { nomeGrupo, aoSelecionar, valorSelecionado }) {
  limparElemento(elLista);

  alternativas.forEach((alt) => {
    const label = document.createElement('label');
    label.className = 'alternativa';
    label.dataset.letra = alt.letter;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = nomeGrupo;
    input.value = alt.letter;
    if (valorSelecionado && valorSelecionado === alt.letter) input.checked = true;
    input.addEventListener('change', () => aoSelecionar(alt.letter));

    const letra = document.createElement('span');
    letra.className = 'alternativa-letra';
    letra.textContent = alt.letter;

    const conteudo = document.createElement('span');
    conteudo.className = 'alternativa-conteudo';
    if (alt.text) {
      const textoSpan = document.createElement('span');
      textoSpan.textContent = alt.text;
      conteudo.appendChild(textoSpan);
    }
    if (alt.file) {
      conteudo.appendChild(criarImagem(alt.file, `Alternativa ${alt.letter}`));
    }

    label.append(input, letra, conteudo);
    elLista.appendChild(label);
  });
}

// Formata milissegundos como HH:MM:SS (usado pelo cronômetro do simulado).
export function formatarDuracao(ms) {
  const segundosTotais = Math.floor(ms / 1000);
  const horas = Math.floor(segundosTotais / 3600);
  const minutos = Math.floor((segundosTotais % 3600) / 60);
  const segundos = segundosTotais % 60;
  const dois = (n) => String(n).padStart(2, '0');
  return `${dois(horas)}:${dois(minutos)}:${dois(segundos)}`;
}

/**
 * Anima um número subindo de 0 até valorFinal dentro do elemento (usado nos
 * cards de estatística do dashboard). Respeita prefers-reduced-motion —
 * nesse caso, só mostra o valor final direto, sem animar.
 */
export function animarContador(elemento, valorFinal, { duracaoMs = 700, formatar = (v) => String(Math.round(v)) } = {}) {
  const prefereReduzido =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefereReduzido) {
    elemento.textContent = formatar(valorFinal);
    return;
  }

  const inicioEm = performance.now();
  function passo(agora) {
    const progresso = Math.min(1, (agora - inicioEm) / duracaoMs);
    elemento.textContent = formatar(valorFinal * progresso);
    if (progresso < 1) requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}
