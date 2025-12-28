import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

// API Routes
app.get('/api/hello', (c) => {
  return c.json({ message: 'Bienvenue à l\'Académie de la Lumière' })
})

// API Inscription - Créer une nouvelle inscription
app.post('/api/inscription', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { prenom, nom, email, tel, objectif } = body;

    // Validation
    if (!prenom || !nom || !email) {
      return c.json({ 
        success: false, 
        error: 'Les champs prénom, nom et email sont requis' 
      }, 400);
    }

    // Vérifier si l'email existe déjà
    const existing = await env.DB.prepare(
      'SELECT id FROM inscriptions WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return c.json({ 
        success: false, 
        error: 'Cet email est déjà inscrit' 
      }, 409);
    }

    // Insérer la nouvelle inscription
    const result = await env.DB.prepare(`
      INSERT INTO inscriptions (prenom, nom, email, tel, objectif)
      VALUES (?, ?, ?, ?, ?)
    `).bind(prenom, nom, email, tel || null, objectif || null).run();

    return c.json({ 
      success: true,
      id: result.meta.last_row_id,
      message: 'Inscription réussie ! Nous vous contacterons bientôt.'
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    return c.json({ 
      success: false, 
      error: 'Une erreur est survenue lors de l\'inscription' 
    }, 500);
  }
})

// API Liste des inscriptions (pour admin)
app.get('/api/inscriptions', async (c) => {
  const { env } = c;
  
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM inscriptions ORDER BY created_at DESC'
    ).all();

    return c.json({ 
      success: true,
      count: results.length,
      inscriptions: results 
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des inscriptions:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la récupération des données' 
    }, 500);
  }
})

// Page Admin - Liste des inscriptions
app.get('/admin', async (c) => {
  const { env } = c;
  
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM inscriptions ORDER BY created_at DESC'
    ).all();

    return c.html(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Admin - Académie de la Lumière</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root{
      --bg:#0a0a0f;
      --text:#f0f0f2;
      --muted:#b8aec9;
      --accent:#b388eb;
      --line: rgba(255,255,255,.08);
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: Inter, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 40px 20px;
    }
    .container{max-width: 1200px; margin: 0 auto;}
    h1{
      font-size: 28px;
      margin: 0 0 8px;
      color: var(--accent);
    }
    .subtitle{
      color: var(--muted);
      margin-bottom: 30px;
    }
    .stats{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }
    .stat-card{
      background: rgba(255,255,255,.02);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 20px;
    }
    .stat-value{
      font-size: 32px;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .stat-label{
      color: var(--muted);
      font-size: 14px;
    }
    table{
      width: 100%;
      border-collapse: collapse;
      background: rgba(255,255,255,.02);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    th, td{
      padding: 14px;
      text-align: left;
      border-bottom: 1px solid var(--line);
    }
    th{
      background: rgba(179,136,235,.1);
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
    }
    tr:last-child td{border-bottom: none}
    tr:hover{background: rgba(255,255,255,.03)}
    .status{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-pending{
      background: rgba(255,193,7,.15);
      color: #ffc107;
    }
    .status-contacted{
      background: rgba(76,175,80,.15);
      color: #4caf50;
    }
    .btn{
      display: inline-block;
      padding: 10px 16px;
      background: var(--accent);
      color: #0a0a0f;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      margin-bottom: 20px;
    }
    .btn:hover{
      opacity: 0.9;
    }
    @media (max-width: 768px){
      table{font-size: 13px}
      th, td{padding: 10px}
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Admin Dashboard</h1>
    <p class="subtitle">Académie de la Lumière - Gestion des inscriptions</p>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Total inscriptions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${results.filter(r => r.status === 'pending').length}</div>
        <div class="stat-label">En attente</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${results.filter(r => r.status === 'contacted').length}</div>
        <div class="stat-label">Contactés</div>
      </div>
    </div>

    <a href="/" class="btn">← Retour à l'accueil</a>
    
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Nom</th>
          <th>Email</th>
          <th>Téléphone</th>
          <th>Objectif</th>
          <th>Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => `
          <tr>
            <td>${r.id}</td>
            <td>${r.prenom} ${r.nom}</td>
            <td>${r.email}</td>
            <td>${r.tel || '-'}</td>
            <td>${r.objectif || '-'}</td>
            <td>${new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
            <td><span class="status status-${r.status}">${r.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`)
  } catch (error) {
    console.error('Erreur admin:', error);
    return c.html('<h1>Erreur lors du chargement des données</h1>')
  }
})

// Main landing page
app.get('/', (c) => {
  return c.html(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Académie de la Lumière</title>
  <meta name="description" content="Académie de la Lumière — pratique sobre, structurée, contenu-first. Inscription gratuite, manifeste, guide, Petek." />

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
    :root{
      --bg:#0a0a0f;
      --text:#f0f0f2;
      --muted:#b8aec9;
      --muted2:#8f88a3;
      --accent:#b388eb;

      --max: 980px;
      --pad: 24px;
      --r: 14px;
      --line: rgba(255,255,255,.08);
    }

    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    a{color:inherit; text-decoration:none}
    a:hover{opacity:.92}
    :focus-visible{outline:2px solid rgba(179,136,235,.55); outline-offset:2px; border-radius:10px}

    .wrap{max-width:var(--max); margin:0 auto; padding: 0 var(--pad);}
    header{
      position: sticky; top:0; z-index:10;
      background: rgba(10,10,15,.92);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line);
    }
    .bar{
      display:flex; align-items:center; justify-content:space-between;
      padding: 16px 0;
      gap: 16px;
    }
    .brand{
      display:flex; align-items:center; gap:12px;
      font-weight:600;
      letter-spacing:.01em;
      white-space:nowrap;
    }
    .mark{
      width:34px;height:34px;
      border-radius: 12px;
      border: 1px solid var(--line);
      display:grid; place-items:center;
      font-weight:600;
      color: var(--accent);
      transition: all 0.3s ease;
    }
    .mark:hover{
      transform: rotate(90deg);
      box-shadow: 0 0 20px rgba(179,136,235,.3);
    }

    nav{
      display:none;
      gap: 18px;
      font-size: 14px;
      color: var(--muted2);
      white-space:nowrap;
    }
    nav a:hover{color: var(--text)}

    .btn{
      display:inline-flex; align-items:center; justify-content:center;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: transparent;
      font-size: 14px;
      font-weight: 500;
      cursor:pointer;
      white-space:nowrap;
      transition: all 0.3s ease;
    }
    .btn:hover{
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,.3);
    }
    .btn-primary{
      background: var(--accent);
      color: #0a0a0f;
      border-color: transparent;
      font-weight:600;
    }
    .btn-primary:hover{
      box-shadow: 0 4px 20px rgba(179,136,235,.4);
    }

    main{padding: 34px 0 70px;}
    section{padding: 52px 0; border-bottom: 1px solid rgba(255,255,255,.06);}
    section:last-child{border-bottom:none}

    .kicker{
      color: var(--muted2);
      letter-spacing:.12em;
      text-transform:uppercase;
      font-size: 12px;
    }
    h1{
      margin: 14px 0 10px;
      font-size: clamp(30px, 4.2vw, 44px);
      line-height: 1.12;
      font-weight: 600;
      letter-spacing: .01em;
      max-width: 20ch;
    }
    h2{
      margin: 0 0 12px;
      font-size: clamp(20px, 2.2vw, 28px);
      line-height: 1.2;
      font-weight: 600;
      letter-spacing: .01em;
    }
    p{
      margin: 0 0 14px;
      color: var(--muted);
      line-height: 1.75;
      font-size: 16px;
      max-width: 72ch;
    }
    p strong{color: var(--text); font-weight:600}
    .lead{font-size: 17px; color: var(--muted); max-width: 74ch}
    .ctaRow{display:flex; gap: 10px; flex-wrap:wrap; margin-top: 18px;}
    .hint{color: var(--muted2); font-size: 13px; line-height:1.55; max-width: 80ch}

    .grid2{display:grid; grid-template-columns: 1fr; gap: 16px;}
    .card{
      border: 1px solid rgba(255,255,255,.08);
      border-radius: var(--r);
      padding: 16px;
      background: rgba(255,255,255,.02);
      transition: all 0.3s ease;
    }
    .card:hover{
      border-color: rgba(179,136,235,.3);
      background: rgba(255,255,255,.04);
    }
    .card h3{
      margin:0 0 8px;
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
    }
    .card p{margin:0; color: var(--muted2); font-size: 14px; line-height:1.65; max-width:none}

    .steps{
      display:grid;
      gap: 10px;
      max-width: 880px;
    }
    .step{
      display:grid;
      grid-template-columns: 28px 1fr;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: var(--r);
      background: rgba(255,255,255,.02);
      transition: all 0.3s ease;
    }
    .step:hover{
      border-color: rgba(179,136,235,.3);
      transform: translateX(5px);
    }
    .num{
      width:28px;height:28px;
      border-radius: 10px;
      display:grid; place-items:center;
      background: rgba(179,136,235,.14);
      color: var(--accent);
      font-weight: 600;
      font-size: 13px;
    }
    .step b{
      display:block;
      font-weight:600;
      color: var(--text);
      margin-bottom: 4px;
    }
    .step span{
      display:block;
      color: var(--muted);
      line-height:1.65;
      font-size: 14px;
      max-width: 78ch;
    }

    .tags{display:flex; flex-wrap:wrap; gap: 10px; margin-top: 10px;}
    .tag{
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 999px;
      padding: 7px 10px;
      font-size: 13px;
      color: var(--muted2);
      background: rgba(255,255,255,.02);
      transition: all 0.3s ease;
    }
    .tag:hover{
      border-color: rgba(179,136,235,.3);
      background: rgba(179,136,235,.1);
      transform: translateY(-2px);
    }
    .tag strong{color: var(--text); font-weight:600}

    /* Form styles */
    input, select, button{
      font-family: inherit;
      font-size: 14px;
    }
    input, select{
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255,255,255,.03);
      color: var(--text);
      transition: all 0.3s ease;
    }
    input:focus, select:focus{
      outline: none;
      border-color: var(--accent);
      background: rgba(255,255,255,.05);
    }
    input::placeholder{
      color: var(--muted2);
    }

    footer{
      padding: 26px 0 10px;
      color: var(--muted2);
      font-size: 13px;
    }
    .footrow{
      display:flex; flex-direction:column; gap: 12px;
      border-top: 1px solid rgba(255,255,255,.06);
      padding-top: 18px;
    }
    .footlinks{display:flex; flex-wrap:wrap; gap: 12px;}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}

    /* Success message */
    .success-message{
      display: none;
      padding: 16px;
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.3);
      border-radius: 12px;
      color: #4caf50;
      margin-top: 16px;
    }
    .success-message.show{
      display: block;
      animation: slideIn 0.5s ease;
    }

    @keyframes slideIn{
      from{
        opacity: 0;
        transform: translateY(-10px);
      }
      to{
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Responsive */
    @media (min-width: 920px){
      nav{display:flex}
      .grid2{grid-template-columns: 1.25fr .75fr; gap: 22px;}
      .footrow{flex-direction:row; align-items:flex-start; justify-content:space-between;}
    }

    /* Light mode */
    @media (prefers-color-scheme: light){
      :root{
        --bg:#f8f9ff;
        --text:#17151f;
        --muted:#4b4460;
        --muted2:#6a6180;
        --accent:#7a42e4;
        --line: rgba(10,10,20,.12);
      }
      header{background: rgba(248,249,255,.92)}
      .card,.step{background: rgba(10,10,20,.03)}
      input, select{
        background: rgba(10,10,20,.03);
      }
    }
  </style>
</head>

<body>
  <header>
    <div class="wrap">
      <div class="bar">
        <div class="brand">
          <div class="mark" aria-hidden="true">✦</div>
          <div>Académie de la Lumière</div>
        </div>

        <nav aria-label="Navigation">
          <a href="#verite">La vérité</a>
          <a href="#approche">Approche</a>
          <a href="#parcours">Parcours</a>
          <a href="#bienfaits">Bienfaits</a>
          <a href="#limites">Limites</a>
        </nav>

        <a class="btn btn-primary" href="#inscription">S'inscrire gratuitement</a>
      </div>
    </div>
  </header>

  <main>
    <!-- HERO -->
    <section id="top" style="border-bottom:none; padding-top: 34px;">
      <div class="wrap">
        <div class="kicker">Direction épurée • contenu-first</div>
        <h1>Une pratique ancienne. Un cadre clair. Un guide humain.</h1>
        <p class="lead">
          Inscription gratuite. Premier rendez‑vous offert. Pas d'effets. Pas de promesses.
          Juste l'essentiel : écrire votre manifeste, être écouté, recevoir une pratique structurée, et avancer.
        </p>
        <div class="ctaRow">
          <a class="btn btn-primary" href="#inscription">S'inscrire gratuitement</a>
          <a class="btn" href="#parcours">Voir le parcours</a>
        </div>
        <p class="hint" style="margin-top:14px;">
          <span class="mono">Jérusalem</span> · Contact · Mentions légales
        </p>
      </div>
    </section>

    <!-- Section 1 — La vérité -->
    <section id="verite">
      <div class="wrap">
        <h2>La vérité</h2>
        <p>
          Le Créateur n'intervient pas directement dans Sa création.
          Il agit à travers Ses messagers — des guides de lumière que la tradition appelle <strong>anges</strong>.
          Chacun de nous est lié à un protecteur. La plupart l'ont oublié.
        </p>
      </div>
    </section>

    <!-- Section 2 — Notre approche -->
    <section id="approche">
      <div class="wrap">
        <h2>Notre approche</h2>
        <div class="grid2">
          <div>
            <p>
              La mystique juive a préservé ce savoir dans les <strong>Sefarim</strong> :
              le <strong>Sefer Raziel</strong> et le <strong>Sefer HaRazin</strong>.
              Ces textes anciens décrivent une manière de rétablir le lien avec votre guide —
              et de mettre en place une pratique régulière orientée vers vos objectifs.
            </p>
            <p>
              L'Académie de la Lumière vous transmet cette pratique avec un cadre simple :
              <strong>écoute</strong>, <strong>structure</strong>, <strong>régularité</strong>.
            </p>
            <p class="hint">
              Note : nous ne proposons pas d'invocation, ni de demandes dirigées contre autrui.
              Nous accompagnons uniquement ce qui élève l'âme et respecte la morale.
            </p>
          </div>
          <div class="card">
            <h3>Ce que c'est</h3>
            <p>Un chemin de guidance intérieure avec un guide humain.</p>
            <div style="height:10px"></div>
            <h3>Ce que ce n'est pas</h3>
            <p>Ni magie instantanée, ni promesse de résultat, ni substitution à un professionnel de santé.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 3 — Le parcours -->
    <section id="parcours">
      <div class="wrap">
        <h2>Le parcours</h2>

        <div class="steps" aria-label="Étapes du parcours">
          <div class="step">
            <div class="num">1</div>
            <div>
              <b>Inscription</b>
              <span>Créez votre compte en quelques secondes. Gratuit, sans engagement.</span>
            </div>
          </div>

          <div class="step">
            <div class="num">2</div>
            <div>
              <b>Votre Manifeste</b>
              <span>Vous écrivez votre manifeste : votre vie, vos aspirations, ce que vous cherchez vraiment. À l'écrit ou à l'oral.</span>
            </div>
          </div>

          <div class="step">
            <div class="num">3</div>
            <div>
              <b>Votre Guide</b>
              <span>Un guide de l'Académie étudie votre manifeste et vous rencontre. Il vous révèle le nom de votre protecteur et la pratique adaptée à votre situation.</span>
            </div>
          </div>

          <div class="step">
            <div class="num">4</div>
            <div>
              <b>Votre Petek</b>
              <span>Vous recevez votre Petek — un sceau spirituel personnalisé en hébreu, consultable dans l'application. Il sert de support à vos récitations quotidiennes.</span>
            </div>
          </div>

          <div class="step">
            <div class="num">5</div>
            <div>
              <b>Votre Pratique</b>
              <span>Chaque jour, quelques minutes de récitation. Votre guide vous accompagne : ajustements, conseils, renouvellement du Petek selon votre évolution.</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 4 — Les bienfaits -->
    <section id="bienfaits">
      <div class="wrap">
        <h2>Les bienfaits recherchés</h2>
        <p>Ce que nos accompagnés recherchent le plus souvent :</p>

        <div class="tags" aria-label="Bienfaits">
          <div class="tag"><strong>Clarté</strong> — décisions importantes</div>
          <div class="tag"><strong>Réussite</strong> — obstacles pro et financiers</div>
          <div class="tag"><strong>Paix intérieure</strong> — rumination, surcharge mentale</div>
          <div class="tag"><strong>Protection</strong> — soutien au quotidien, déplacements</div>
          <div class="tag"><strong>Relations</strong> — harmonie, réparation</div>
          <div class="tag"><strong>Santé</strong> — accompagnement (sans médical)</div>
          <div class="tag"><strong>Direction</strong> — quand on se sent perdu</div>
        </div>

        <p class="hint" style="margin-top:16px;">
          Important : la partie "santé" signifie un soutien spirituel et de stabilité intérieure.
          Cela ne remplace pas un avis médical et ne constitue pas une recommandation de traitement.
        </p>
      </div>
    </section>

    <!-- Section 5 — Les limites -->
    <section id="limites">
      <div class="wrap">
        <h2>Les limites</h2>
        <p>
          Nous accompagnons uniquement ce qui élève l'âme. Ce qui respecte autrui. Ce qui apporte la lumière.
          Ce qui est juste et moral.
        </p>
        <p>
          Pas de demandes contre quelqu'un. Pas de manipulation. Pas de raccourcis sans effort.
          La pratique demande de la régularité. Le changement demande du temps.
          Votre guide est là pour vous soutenir, pas pour faire le travail à votre place.
        </p>
        <p class="hint">
          Si vous cherchez de la magie instantanée, ce n'est pas ici. Si vous cherchez un chemin sincère vers la lumière, bienvenue.
        </p>

        <div class="ctaRow" style="margin-top:18px;">
          <a class="btn btn-primary" href="#inscription">Prêt à commencer ? S'inscrire gratuitement</a>
        </div>
      </div>
    </section>

    <!-- INSCRIPTION -->
    <section id="inscription">
      <div class="wrap grid2">
        <div>
          <h2>Inscription gratuite</h2>
          <p>Créez votre compte. Nous revenons vers vous pour planifier le premier rendez‑vous offert.</p>

          <div id="success-message" class="success-message">
            ✨ Inscription réussie ! Nous vous contacterons bientôt.
          </div>

          <form id="inscription-form" class="card" aria-label="Formulaire d'inscription">
            <div style="display:grid; gap:10px; max-width: 520px;">
              <div style="display:grid; gap:6px;">
                <label for="prenom" style="font-size:12px; color: var(--muted2);">Prénom</label>
                <input id="prenom" name="prenom" required placeholder="Votre prénom" />
              </div>
              <div style="display:grid; gap:6px;">
                <label for="nom" style="font-size:12px; color: var(--muted2);">Nom</label>
                <input id="nom" name="nom" required placeholder="Votre nom" />
              </div>
              <div style="display:grid; gap:6px;">
                <label for="email" style="font-size:12px; color: var(--muted2);">Email</label>
                <input id="email" type="email" name="email" required placeholder="votre@mail.com" />
              </div>
              <div style="display:grid; gap:6px;">
                <label for="tel" style="font-size:12px; color: var(--muted2);">Téléphone (optionnel)</label>
                <input id="tel" name="tel" placeholder="+33 …" />
              </div>
              <div style="display:grid; gap:6px;">
                <label for="objectif" style="font-size:12px; color: var(--muted2);">Objectif principal</label>
                <select id="objectif" name="objectif">
                  <option value="">Choisir…</option>
                  <option>Clarté</option>
                  <option>Réussite</option>
                  <option>Paix intérieure</option>
                  <option>Protection</option>
                  <option>Relations</option>
                  <option>Direction</option>
                </select>
              </div>

              <button class="btn btn-primary" type="submit" style="justify-self:start;">Envoyer</button>
              <div class="hint">Aucun paiement requis • Sans engagement • Premier rendez‑vous offert</div>
            </div>
          </form>
        </div>

        <div class="card">
          <h3>Adresse</h3>
          <p style="margin:0; color: var(--muted2);">
            Western Wall Plaza, Jewish Quarter, Old City,<br>
            Jerusalem, Israel
          </p>
          <div style="height:14px"></div>

          <h3>Application</h3>
          <p style="margin:0; color: var(--muted2);">
            Accès à votre Manifeste, votre Petek, votre pratique, et votre chat avec le guide.
          </p>
          <div style="height:12px"></div>
          <a class="btn" href="#" aria-label="iOS">iOS (à venir)</a>
          <span style="display:inline-block; width:10px;"></span>
          <a class="btn" href="#" aria-label="Android">Android (à venir)</a>
        </div>
      </div>
    </section>

    <footer>
      <div class="wrap">
        <div class="footrow">
          <div>© <span id="y"></span> Académie de la Lumière</div>
          <div class="footlinks">
            <a href="#">Contact</a>
            <a href="#">Mentions légales</a>
            <a href="#">CGV</a>
            <a href="#">Confidentialité</a>
          </div>
        </div>
        <div style="margin-top:10px;" class="hint">
          Soutien spirituel et personnel uniquement. Ne remplace pas un avis médical, psychologique, juridique ou financier.
        </div>
      </div>
    </footer>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    // Set current year
    document.getElementById('y').textContent = new Date().getFullYear();

    // Handle form submission
    document.getElementById('inscription-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = {
        prenom: document.getElementById('prenom').value,
        nom: document.getElementById('nom').value,
        email: document.getElementById('email').value,
        tel: document.getElementById('tel').value,
        objectif: document.getElementById('objectif').value
      };

      try {
        const response = await axios.post('/api/inscription', formData);
        
        if (response.data.success) {
          // Show success message
          document.getElementById('success-message').classList.add('show');
          
          // Reset form
          e.target.reset();
          
          // Hide success message after 5 seconds
          setTimeout(() => {
            document.getElementById('success-message').classList.remove('show');
          }, 5000);
        }
      } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        alert('Une erreur est survenue. Veuillez réessayer.');
      }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  </script>
</body>
</html>`)
})

export default app
