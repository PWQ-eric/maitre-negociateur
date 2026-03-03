// ═══════════════════════════════════════════════════════
// NETLIFY FUNCTION — claude-proxy.js
// Proxy sécurisé pour l'API Anthropic
// La clé API est stockée en variable d'environnement Netlify
// Jamais exposée au navigateur du joueur
// ═══════════════════════════════════════════════════════

exports.handler = async function(event, context) {

  // CORS — autoriser les requêtes depuis le site
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Répondre aux preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Seulement accepter POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    };
  }

  // Récupérer la clé API depuis les variables d'environnement Netlify
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Clé API non configurée sur le serveur.' })
    };
  }

  // Parser le body de la requête
  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch(e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Body invalide' })
    };
  }

  // Appel à l'API Anthropic
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: requestBody.model || 'claude-sonnet-4-20250514',
        max_tokens: requestBody.max_tokens || 1500,
        system: requestBody.system || '',
        messages: requestBody.messages || []
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.error?.message || 'Erreur API Anthropic' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur serveur : ' + err.message })
    };
  }
};
