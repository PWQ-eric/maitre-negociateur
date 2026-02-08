Voici le code complet pour generate-choices.js :
javascriptexports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        
        if (!apiKey) {
            throw new Error('Clé API manquante');
        }

        const { situation, dialogue, techniques, playerName, opponentName, opponentPersonality } = JSON.parse(event.body);

        const techniquesText = techniques.join(', ');

        const prompt = `Tu es un expert en négociation. Pour cette situation, crée 5 choix de réponse possibles présentés comme des DIALOGUES ou ACTIONS que le joueur peut prendre. CONTEXTE : Joueur : ${playerName}, Interlocuteur : ${opponentName} (${opponentPersonality || 'professionnel'}), Dernier dialogue : "${dialogue || ''}". SITUATION ACTUELLE : ${situation}. TECHNIQUES À INTÉGRER : ${techniquesText}. IMPORTANT - Distribution des choix : TOUS les 5 choix doivent avoir une technique associée. Distribution de qualité obligatoire : 1-2 "bad", 1-2 "medium", 2-3 "excellent". Les meilleurs choix (excellent) doivent utiliser les techniques sélectionnées : ${techniquesText}. Crée 5 options de réponse/action sous forme de DIALOGUES DIRECTS ou ACTIONS narratives. Réponds UNIQUEMENT en JSON (sans texte avant/après, guillemets simples) : {"choices": [{"text": "Votre réplique ou action (dialogue direct, 2-3 phrases naturelles)", "preview": "Conséquence probable de ce choix (1 phrase)", "technique": "ID technique parmi batna/zopa/ancrage/miroir/silence/ecoute-active/harvard/concessions/empathie-tactique/preparation", "quality": "excellent/medium/bad", "feedback": "Explication experte (2-3 phrases)", "emotion": "emoji représentant l'émotion"}]}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 3000,
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Claude erreur: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.content.find(c => c.type === 'text')?.text || '';
        
        let jsonText = content.trim();
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        const firstBrace = jsonText.indexOf('{');
        if (firstBrace > 0) {
            jsonText = jsonText.substring(firstBrace);
        }
        
        const lastBrace = jsonText.lastIndexOf('}');
        if (lastBrace !== -1 && lastBrace < jsonText.length - 1) {
            jsonText = jsonText.substring(0, lastBrace + 1);
        }

        const parsed = JSON.parse(jsonText);
        
        if (!parsed.choices || parsed.choices.length !== 5) {
            throw new Error('Format de choix invalide - 5 choix requis');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, choices: parsed.choices })
        };

    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
