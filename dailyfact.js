import 'dotenv/config'; // carrega automaticamente as variáveis do .env
import { google } from 'googleapis';
import {GoogleGenAI,Type,} from '@google/genai';

let data = new Date();
let month = data.toLocaleString("pt" , { month: 'long'});
let day = data.getDate();


const apiKey = process.env.GOOGLE_SEARCH_API;
const cx = process.env.GOOGLE_CX_ID;
let google_search_string = `"em ${day} de ${month}" (tecnologia OR ciência OR inovação OR software OR hardware OR internet OR cibersegurança) site:tecmundo.com.br OR site:canaltech.com.br OR site:olhardigital.com.br OR site:showmetech.com.br OR site:theverge.com OR site:wired.com OR site:engadget.com OR site:techradar.com OR site:arstechnica.com`


let facts = [];


//Fatos da wiki

let wiki_url = `https://pt.wikipedia.org/wiki/${day}_de_${month}`;
let wiki_document = await fetch(wiki_url).then(res => res.text());

wiki_document = wiki_document.match(/<ul(?![^>]*(class|id))>([\s\S]*?)<\/ul>/);

wiki_document[0].split("<li>").slice(1).map(fact => {
    let snippet = fact.replace("</li>", "").replace('</ul>' , "")

    let single_fact = {
        title: null,
        snippet: snippet,
        link: null,
    }

    facts.push(single_fact)
});



let customsearch = google.customsearch('v1');

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


facts.forEach((fact, index) => {
  fact.index = index; 
});

let system_instructions = `**Sua tarefa é selecionar o index (0-baseado) do único item que representa um acontecimento curioso sobre Tecnologia, Cultura Geek, Cultura Nerd, ou Programação, especificamente para o dia ${day} de ${month}.**

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



  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const config = {
    thinkingConfig: {
      thinkingBudget: 0,
    },
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.NUMBER,
        },
      },
    },
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
          text: JSON.stringify(facts),
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





let obj = JSON.parse(fullText.replace("undefined" , "")); 
console.log(obj.index)
console.log(facts[obj.index])

