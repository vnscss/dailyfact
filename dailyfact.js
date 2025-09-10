let data = new Date();
let month = data.toLocaleString("pt" , { month: 'long'});
let day = data.getDate();

let fatcs = [];


//Fatos da wiki

let wiki_url = `https://pt.wikipedia.org/wiki/${day}_de_${month}`;
let wiki_document = await fetch(wiki_url).then(res => res.text());

wiki_document = wiki_document.match(/<ul(?![^>]*(class|id))>([\s\S]*?)<\/ul>/);

let wiki_facts = wiki_document[0].split("<li>").slice(1).map(fact => {

    let single_fact = fact.replace("</li>", "").replace('</ul>' , "")
    fatcs.push(single_fact)

});

