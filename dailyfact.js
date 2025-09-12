import 'dotenv/config'; // carrega automaticamente as variáveis do .env
import { google } from 'googleapis';
import {GoogleGenAI,Type,} from '@google/genai';
import { JSDOM }  from "jsdom";


let args = process.argv.slice(2);

let dValue = null;
let mValue = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === "-d") {
        dValue = Number(args[i + 1]);
        i++; // pula o próximo porque já pegamos o valor
    } else if (args[i] === "-m") {
        mValue = args[i + 1];
        i++;
    }
}

let data = new Date();
let month = data.toLocaleString("pt" , { month: 'long'});
let day = data.getDate();

if (dValue) day = dValue;
if (mValue) month = mValue;



const apiKey = process.env.GOOGLE_SEARCH_API;
const cx = process.env.GOOGLE_CX_ID;
let google_search_string = `"em ${day} de ${month}" (tecnologia OR ciência OR inovação OR software OR hardware OR internet OR cibersegurança) site:tecmundo.com.br OR site:canaltech.com.br OR site:olhardigital.com.br OR site:showmetech.com.br OR site:theverge.com OR site:wired.com OR site:engadget.com OR site:techradar.com OR site:arstechnica.com`


let facts = [];




let loadingInterval;

function loadingAnimation(message, action) {
    const spinnerFrames = ['|', '/', '-', '\\'];
    let i = 0;

    if (action === 'start') {
        process.stdout.write(message + ' ');

        loadingInterval = setInterval(() => {
            process.stdout.write('\b' + spinnerFrames[i]);
            i = (i + 1) % spinnerFrames.length;
        }, 100); // Update every 100ms
    } else if (action === 'stop') {
        if (loadingInterval) {
            clearInterval(loadingInterval);
            loadingInterval = null;
            process.stdout.write('\b'); // Erase spinner
            console.log(message + ' Done!');
        }
    } else {
        console.log('Invalid action. Use "start" or "stop".');
    }
}





//Fatos da wiki

let wiki_url = `https://pt.wikipedia.org/wiki/${day}_de_${month}`;
loadingAnimation('Pegando fatos da wiki', 'start');
let wiki_document = await fetch(wiki_url).then(res => res.text());


let dom = new JSDOM(wiki_document);
let document = dom.window.document;

let ul = document.querySelector("ul:not([class]):not([id])");

let lis = Array.from(ul.children); 

lis.forEach(li => {
    if (li.tagName === "LI") {
        facts.push({
            title: null,
            link: null,
            snippet: li.textContent
        });
    }
});
loadingAnimation('', 'stop');

let customsearch = google.customsearch('v1');


loadingAnimation('Pegando fatos do google', 'start');
try {
const res = await customsearch.cse.list({
    auth: apiKey,
    cx: cx,
    q: google_search_string,
    num: 10
});

const items = res.data.items;
if (items) {
    items.forEach((item, index) => {
        let fact = {
            title: item.title,
            snippet: item.snippet,
            link: item.link
        }
        facts.push(fact)
    });
} 
} catch (err) {
}

loadingAnimation('', 'stop');
facts.forEach((fact, index) => {
  fact.index = index; 
});



async function gemini(system_instructions , promptString , responseSchema){

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const config = {
    thinkingConfig: {
      thinkingBudget: 0,
    },
    responseMimeType: 'application/json',
    responseSchema: responseSchema,
    systemInstruction: [
        {
          text: `${system_instructions}`,
        }
    ],
  };

  const model = 'gemini-2.5-flash';
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: promptString,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });

    let fullText = "";

    for await (const chunk of response) {
    fullText += chunk.text;
    }

    return fullText;
}



let select_best_fact_system_instructions = `**Sua tarefa é selecionar o index (0-baseado) do único item que representa um acontecimento curioso sobre Tecnologia, Cultura Geek, Cultura Nerd, ou Programação, especificamente para o dia ${day} de ${month}.**

**REGRAS DE SELEÇÃO OBRIGATÓRIAS (Processamento Sequencial):**

1.  **DESQUALIFICAÇÃO IMEDIATA (IGNORAR ESTES ITENS):**
    *   **AUTOMATICAMENTE DESCARTAR** qualquer item que descreva, primariamente, eventos de:
        *   **HISTÓRIA GERAL:** Guerras, batalhas, política, realeza, tratados, fundação de nações, exploração geográfica *não tecnológica*.
        *   **ESPORTES:** Competições, recordes, inauguração de instalações esportivas, **automobilismo (corridas, autódromos)**, eventos atléticos.
        *   **CULTURA GERAL:** Arte tradicional, literatura não-geek/fantasia/sci-fi, gastronomia, moda, eventos sociais ou cerimônias.
        *   **DESASTRES NATURAIS.**
        *   **INFRAESTRUTURA GERAL:** Construção de pontes, edifícios não tecnológicos, ou sistemas de transporte público *se não houver uma inovação tecnológica disruptiva evidente como foco central*.
    *   **NÃO CONSIDERE estes itens para seleção final. Eles SÃO INVÁLIDOS.**

2.  **FOCO TEMÁTICO RESTRITO (SÓ APÓS DESQUALIFICAÇÃO):**
    *   Dos itens *não desqualificados* no passo 1, selecione apenas aqueles cujo foco principal e intrínseco se alinhe *EXCLUSIVAMENTE* a:
        *   **Tecnologia:** hardware, software, internet, **IA (Inteligência Artificial)**, robótica, ciência da computação, cibersegurança, telecomunicações, eletrônica, exploração espacial (foco tecnológico).
        *   **Cultura Geek:** filmes, séries, quadrinhos, **JOGOS ELETRÔNICOS (videogames)**, RPGs, animes, mangás, e-sports, universos de ficção/fantasia.
        *   **Cultura Nerd (MUITO RESTRITA):** Avanços científicos *fundamentais diretamente aplicáveis ou relacionados à tecnologia*, história da computação, criptografia, ou hobbies intelectuais que são *inherentemente computacionais ou científicos-tecnológicos*. **Não é sobre conhecimento geral ou áreas acadêmicas amplas.**
        *   **Programação:** linguagens, algoritmos, desenvolvimento de software, bugs, exploits, arquitetura de sistemas.

3.  **CONEXÃO COM A DATA (${day} de ${month}):**
    *   Dos itens que passaram nos passos 1 e 2, escolha os que têm uma **conexão clara e direta com o dia ${day} de ${month}**. (O ano é irrelevante, dia e mês são CRUCIAIS).

4.  **RELEVÂNCIA E CURIOSIDADE (DESEMPATE FINAL):**
    *   Entre os itens restantes, selecione o que tem a **MAIOR SIGNIFICÂNCIA, IMPACTO DURADOURO ou PECULIARIDADE** dentro dos temas definidos. Priorize marcos transformadores (ex: fundação da OpenAI, lançamentos de tecnologias disruptivas) sobre fatos menores.

**FORMATO DE SAÍDA OBRIGATÓRIO:**

**Retorne SOMENTE o número inteiro do index (0-baseado) do item escolhido.**
*   **EXEMPLO DE SAÍDA VÁLIDA: 12**
*   **NENHUM TEXTO, NENHUMA EXPLICAÇÃO, NENHUMA FORMATAÇÃO EXTRA.**
*   **VOCÊ DEVE SEMPRE RETORNAR UM index VÁLIDO.** Se a lista for fraca, selecione o item que melhor atende aos critérios, seguindo a ordem de prioridade 1 > 2 > 3 > 4.

`
let index_responseSchema = {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.NUMBER,
        },
      },
    }

loadingAnimation('Separando melhor fato', 'start');
let geminiResponse = await gemini(select_best_fact_system_instructions , JSON.stringify(facts) , index_responseSchema)

let obj = JSON.parse(geminiResponse.replace("undefined" , "")); 


let best_fact = facts[obj.index]
loadingAnimation('', 'stop');

let format_fact_system_instructions = `ATENÇÃO MÁXIMA: Seu papel é atuar como um redator especializado em fatos curiosos de tecnologia, cultura geek, nerd e programação. Sua tarefa é gerar uma breve e envolvente 'curiosidade' formatada para o dia ${day} de ${month}, utilizando as informações do item JSON que será fornecido.

INSTRUÇÕES PARA GERAÇÃO DO TEXTO (Processamento CRÍTICO):

    INPUT: Você receberá APENAS UM item no formato JSON, que já foi previamente selecionado como o mais adequado.

    EXTRAÇÃO E REESCRITA:

        Extraia o ano do acontecimento do snippet (geralmente no início do texto ou em uma tag de ano, como <a href="/wiki/YYYY").

        Extraia a essência do acontecimento principal do snippet e, se necessário, do title.

        Reescreva o conteúdo de forma clara, concisa e envolvente.

        INCLUA O ANO EXTRAÍDO NO INÍCIO DO TEXTO DA CURIOSIDADE (logo após a data no prefixo Curiosidade para o dia ${day} de ${month}: ).

        O foco deve ser no aspecto curioso, inovador, ou impactante do acontecimento para os temas de tecnologia, cultura geek, nerd ou programação.

        Evite a repetição literal do texto do snippet. Para o exemplo da OpenAI, foque em "fundação" e "impacto na IA/ChatGPT".

        Certifique-se de que a curiosidade seja compreensível para um público geral, evitando jargões excessivos ou complexidade desnecessária.

    CONCISÃO: O texto do acontecimento curioso (a parte que vai após "Curiosidade para o dia ${day} de ${month}: ") DEVE TER ENTRE 20 E 50 PALAVRAS.

FORMATO DE SAÍDA OBRIGATÓRIO (SOMENTE O TEXTO FINAL):

Sua resposta DEVE SER UNICAMENTE uma string de texto seguindo o formato EXATO abaixo:

Curiosidade para o dia ${day} de ${month}: [ANO], [Texto do acontecimento curiosamente reescrito].

    NÃO inclua nenhuma formatação markdown (negrito, itálico, links), aspas extras, ou qualquer outro texto ou caractere além do formato especificado.

    O texto final deve ser uma única linha.

    EXEMPLO DE SAÍDA VÁLIDA (para o exemplo da OpenAI):
    Curiosidade para o dia ${day} de ${month}: 2015, Foi fundada a OpenAI, a empresa que se tornaria uma força motriz na inteligência artificial, desenvolvendo modelos como o ChatGPT e transformando o cenário tecnológico global.

    EXEMPLO DE SAÍDA VÁLIDA (para o Mars Global Surveyor, usando seu exemplo):
    Curiosidade para o dia ${day} de ${month}: 1997, A sonda espacial Mars Global Surveyor da NASA alcançou Marte, iniciando uma década de exploração detalhada que revelou paisagens marcianas impressionantes e ajudou a desvendar a história do Planeta Vermelho.`

 
let string_responseSchema = {
      type: Type.OBJECT,
      properties: {
        response: {
          type: Type.STRING,
        },
      },
    }

loadingAnimation('Formatando resposta', 'start');
let finalGeminiResponse = await gemini(format_fact_system_instructions , JSON.stringify(best_fact) , string_responseSchema)


finalGeminiResponse = JSON.parse(finalGeminiResponse.replace("undefined" , "")); 
finalGeminiResponse = finalGeminiResponse.response;

let fonte = best_fact.link;


loadingAnimation('', 'stop');

console.clear();

console.log("\n\x1b[1;34m===== Curiosidade do Dia =====\x1b[0m"); // título azul e em negrito
console.log(`\x1b[1m${finalGeminiResponse}\x1b[0m`); // snippet em negrito

if(fonte){
    console.log(`\x1b[36mFonte:\x1b[0m ${fonte}`); // 'Fonte:' ciano
}
if(!fonte){
    console.log(`\x1b[36mFonte:\x1b[0m https://www.wikipedia.org/`); // 'Fonte:' ciano
}

console.log("\x1b[1;34m============================\x1b[0m\n"); // linha azul