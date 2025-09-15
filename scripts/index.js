(function() {
    // Get the JSON from the <script> tag
    const dailyFactTag = document.getElementById('daily-fact');
    const dailyFacts = JSON.parse(dailyFactTag.textContent);

    const now = new Date();
    const clientDate = now.toISOString().split('T')[0];

    dailyFacts.forEach(fact => {
        const factDate = new Date(fact.data).toISOString().split('T')[0];

        if (clientDate === factDate) {
            // Create a <p> element with the fact text
            const p = document.createElement('p');
            p.textContent = fact.text;
            document.body.appendChild(p);
        }
        else{
            const p = document.createElement('p');
            p.textContent = "Nenhuma curiosidade para hoje...";
            document.body.appendChild(p);
        }
    });
})();