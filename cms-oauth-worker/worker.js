/**
 * Proxy OAuth GitHub pour Decap CMS, à déployer sur Cloudflare Workers.
 *
 * Rôle : Decap CMS (servi en statique sur GitHub Pages) ne peut pas faire
 * l'échange OAuth "code -> token" tout seul car ça nécessite le Client
 * Secret de l'app GitHub, qui ne doit jamais être exposé côté navigateur.
 * Ce Worker fait cet échange côté serveur, avec le secret stocké de façon
 * sécurisée dans les variables d'environnement Cloudflare.
 *
 * Déploiement : coller ce fichier tel quel dans l'éditeur Cloudflare Workers
 * (dashboard.cloudflare.com > Workers & Pages > Create > créer un Worker),
 * puis définir 2 secrets dans Settings > Variables :
 *   - GITHUB_CLIENT_ID
 *   - GITHUB_CLIENT_SECRET
 * (valeurs récupérées lors de la création de l'OAuth App GitHub)
 */

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const SCOPE = "repo,user";

function randomState() {
  return crypto.randomUUID();
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/callback`;

  const authUrl = new URL(GITHUB_AUTH_URL);
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("state", randomState());

  return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return new Response(`Erreur OAuth GitHub : ${tokenData.error_description || tokenData.error}`, {
      status: 400,
    });
  }

  const content = JSON.stringify({
    token: tokenData.access_token,
    provider: "github",
  });

  // Decap CMS attend cette poignée de main postMessage précise depuis la
  // popup d'authentification vers la fenêtre parente (l'admin CMS).
  const script = `
    <!DOCTYPE html><html><body>
    <script>
      (function() {
        function receiveMessage(message) {
          window.opener.postMessage(
            'authorization:github:success:${content.replace(/'/g, "\\'")}',
            message.origin
          );
          window.removeEventListener("message", receiveMessage, false);
        }
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:github", "*");
      })();
    </script>
    </body></html>
  `;

  return new Response(script, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") return handleAuth(request, env);
    if (url.pathname === "/callback") return handleCallback(request, env);

    return new Response(
      "Proxy OAuth Decap CMS — endpoints disponibles : /auth et /callback",
      { status: 200 }
    );
  },
};
