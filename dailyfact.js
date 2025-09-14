import * as dotenv from "dotenv";
import { google } from 'googleapis';
import {GoogleGenAI,Type,} from '@google/genai';
import { JSDOM }  from "jsdom";
import * as fs from "fs";
import { fileURLToPath } from 'url';
import { dirname , join } from 'path';

console.clear()

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

let data = new Date();
let month = data.toLocaleString("pt" , { month: 'long'});
let day = data.getDate();

const apiKey = process.env.GOOGLE_SEARCH_API;
const cx = process.env.GOOGLE_CX_ID;
let google_search_string = `"em ${day} de ${month}" (tecnologia OR ciência OR inovação OR software OR hardware OR internet OR cibersegurança) site:tecmundo.com.br OR site:canaltech.com.br OR site:olhardigital.com.br OR site:showmetech.com.br OR site:theverge.com OR site:wired.com OR site:engadget.com OR site:techradar.com OR site:arstechnica.com`

let facts = [];
let best_facts = [];

let outdev = null;


const main = async () => {

    let args = process.argv.slice(2);

    let dValue = null;
    let mValue = null;
    let modeValue = null;
    let dev = null

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
        }else if (args[i] === "-dev") {
            dev = 1;
            outdev = 1;
            i++;
        }
    }


    if (dValue) day = dValue;
    if (mValue) month = mValue;

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
                link: wiki_url,
                snippet: li.textContent
            });
        }
    });
    loadingAnimation('', 'stop');
    
    
    loadingAnimation('Pegando fatos do google', 'start');
    
    //Fatos da do google
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
    
    loadingAnimation('', 'stop');

    facts.forEach((fact, index) => {
      fact.index = index; 
    });

    let selectBest_promptPath
    let format_prompPath


    let index_responseSchema = {
      type: Type.OBJECT,
      properties: {
        response: {
          type: Type.ARRAY,
          items: {
            type: Type.INTEGER,
            },
          },
        },
      }

    let string_responseSchema = {
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

    switch (modeValue) {
      case 2:
        selectBest_promptPath = `${__dirname}/prompts/select_3_best_fact_system_instructions.txt`;
        format_prompPath = `${__dirname}/prompts/format_3_facts_system_instructions.txt`;
        break;

      case 3:
        console.log(facts)
        selectBest_promptPath = `${__dirname}/prompts/select_3_best_fact_system_instructions.txt`;
        format_prompPath = `${__dirname}/prompts/format_3_facts_system_instructions.txt`;
        break;

      case null:
        selectBest_promptPath = `${__dirname}/prompts/select_best_fact_system_instructions.txt`;
        format_prompPath = `${__dirname}/prompts/format_fact_system_instructions.txt`;
        break;

    }


    let system_instructions = readPrompt(selectBest_promptPath);
    let prompt = JSON.stringify(facts)

    loadingAnimation('Pegando o melhor fato', 'start');
    let geminiResponse = await gemini(system_instructions , prompt , index_responseSchema);
    loadingAnimation('', 'stop');

    let best_index = formatAsJson(geminiResponse)

    best_index.response.map(index => {
      best_facts.push(facts[index]);
    });

    system_instructions = readPrompt(format_prompPath);
    prompt = JSON.stringify(best_facts)

    let fromated_response

    loadingAnimation('Formatando resposta', 'start');
    geminiResponse = await gemini(system_instructions , prompt , string_responseSchema);
    loadingAnimation('', 'stop');
    
    fromated_response = formatAsJson(geminiResponse);
    fromated_response = fromated_response.response;

    console.clear()



    switch (dev) {
      case 1:
        let facts_JSON = []

        fromated_response.map(obj => {
          
          let text = obj.text
          let fonte = facts?.[obj.index].link;

          let fato = {
            text: text,
            fonte: fonte
          }

          facts_JSON.push(fato)
          
        });

        console.log(facts_JSON)

        break;
    
      default:
        fromated_response.map(fact => {
          drawFact(fact);
        });
        break;
    }


}


let loadingInterval;

function loadingAnimation(message, action) {

    if(outdev){
      return
    }

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

function readPrompt(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  content = content
    .replace(/\$\{day\}/g, day)
    .replace(/\$\{month\}/g, month);

  return content;
}

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

function formatAsJson(string){
  let response 

  response = string.replace("undefined" , "")
  .replace("```" , "").replace('json' , '')

  response = JSON.parse(response)

  return response
}

function drawFact(obj){

  let text = obj.text
  let fonte = facts?.[obj.index].link;

  console.log("\n\x1b[1;34m===== Curiosidade do Dia =====\x1b[0m"); // título azul e em negrito
  console.log(`\x1b[1m${text}\x1b[0m`); // snippet em negrito

  if(fonte){
      console.log(`\x1b[36mFonte:\x1b[0m ${fonte}`); // 'Fonte:' ciano
  }

  console.log("\x1b[1;34m============================\x1b[0m\n"); // linha azul

}



await main();
