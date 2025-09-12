import 'dotenv/config'; // carrega automaticamente as variáveis do .env
import { google } from 'googleapis';

let data = new Date();
let month = data.toLocaleString("pt" , { month: 'long'});
let day = data.getDate();


const apiKey = process.env.GOOGLE_SEARCH_API;
const cx = process.env.GOOGLE_CX_ID;
let google_search_string = `"em ${day} de ${month}" (tecnologia OR ciência OR inovação OR software OR hardware OR internet OR cibersegurança) site:tecmundo.com.br OR site:canaltech.com.br OR site:olhardigital.com.br OR site:showmetech.com.br OR site:theverge.com OR site:wired.com OR site:engadget.com OR site:techradar.com OR site:arstechnica.com`


let fatcs = [];


//Fatos da wiki

let wiki_url = `https://pt.wikipedia.org/wiki/${day}_de_${month}`;
let wiki_document = await fetch(wiki_url).then(res => res.text());

wiki_document = wiki_document.match(/<ul(?![^>]*(class|id))>([\s\S]*?)<\/ul>/);

let wiki_facts = wiki_document[0].split("<li>").slice(1).map(fact => {

    let single_fact = fact.replace("</li>", "").replace('</ul>' , "")
    fatcs.push(single_fact)
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
        fatcs.push(fact)
    });
} else {
    console.log('Nenhum resultado encontrado.');
}

} catch (err) {
console.error('Erro na pesquisa:', err);
}
