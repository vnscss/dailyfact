import 'dotenv/config'; // carrega automaticamente as variáveis do .env
import { google } from 'googleapis';
import {GoogleGenAI,Type,} from '@google/genai';
import { JSDOM }  from "jsdom";
import * as fs from "fs";

console.clear();

let args = process.argv.slice(2);

let dValue = null;
let mValue = null;
let modeValue = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === "-d") {
        dValue = Number(args[i + 1]);
        i++; // pula o próximo porque já pegamos o valor
    } else if (args[i] === "-m") {
        mValue = args[i + 1];
        i++;
    }else if (args[i] === "-mode") {
        modeValue = Number(args[i + 1]);
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

let filePath 
let index_responseSchema 

if(modeValue === 2){
  filePath = "./prompts/select_3_best_fact_system_instructions.txt"
  index_responseSchema = {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.ARRAY,
          items: {
            type: Type.INTEGER,
            },
          },
        },
      }
}
else{
  filePath = "./prompts/select_best_fact_system_instructions.txt";

  index_responseSchema = {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.NUMBER,
        },
      },
    }
}

let content = fs.readFileSync(filePath, "utf8");
content = content
  .replace(/\$\{day\}/g, day)
  .replace(/\$\{month\}/g, month);

let select_best_fact_system_instructions = content


loadingAnimation('Separando melhor fato', 'start');
let geminiResponse = await gemini(select_best_fact_system_instructions , JSON.stringify(facts) , index_responseSchema)

let obj = JSON.parse(geminiResponse.replace("undefined" , "")); 

let best_fact 
let string_responseSchema 
if(modeValue === 2){

  let best_facts = []
  obj.index.map( index => {
    best_facts.push(facts[index])
  })
  
  best_fact = best_facts

  filePath = "./prompts/format_3_facts_system_instructions.txt";

  string_responseSchema =  {
  type: Type.OBJECT,
  properties: {
    response: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          index: { type: Type.INTEGER }
        }
      }
    }
  }
}




}
else{
  best_fact = facts[obj.index]

  filePath = "./prompts/format_fact_system_instructions.txt";

  string_responseSchema =  {
      type: Type.OBJECT,
      properties: {
        response: {
          type: Type.STRING,
        },
      },
    }
}

loadingAnimation('', 'stop');


content = fs.readFileSync(filePath, "utf8");
content = content
  .replace(/\$\{day\}/g, day)
  .replace(/\$\{month\}/g, month);

let format_fact_system_instructions = content

loadingAnimation('Formatando resposta', 'start');
let finalGeminiResponse = await gemini(format_fact_system_instructions , JSON.stringify(best_fact) , string_responseSchema)


finalGeminiResponse = JSON.parse(finalGeminiResponse.replace("undefined" , "")); 

loadingAnimation('', 'stop');

if(modeValue === 2){

  finalGeminiResponse = finalGeminiResponse.response;


  console.clear();

  finalGeminiResponse.map( fact =>{
    let text = fact.text
    let index = fact.index

    console.log("\n\x1b[1;34m===== Curiosidade do Dia =====\x1b[0m"); // título azul e em negrito
    console.log(`\x1b[1m${text}\x1b[0m`); // snippet em negrito

    let fonte = null

    if(best_fact[index]?.link){
      fonte = best_fact[index].link
    }

    if(fonte){
        console.log(`\x1b[36mFonte:\x1b[0m ${fonte}`); // 'Fonte:' ciano
    }
    if(!fonte){
        console.log(`\x1b[36mFonte:\x1b[0m https://www.wikipedia.org/`); // 'Fonte:' ciano
    }

    console.log("\x1b[1;34m============================\x1b[0m\n"); // linha azul


  })
}
else{

  finalGeminiResponse = finalGeminiResponse.response;
  let fonte = best_fact.link;

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


}