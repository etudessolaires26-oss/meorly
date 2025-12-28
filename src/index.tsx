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

// =============================================
// HELPERS - Attribution Logique
// =============================================

/**
 * Analyse un texte et extrait les mots-clés pertinents pour l'attribution Petek
 */
function analyzeManifeste(text: string): string[] {
  const keywords: string[] = [];
  const textLower = text.toLowerCase();
  
  // Mapping des thèmes vers les mots-clés
  const keywordMap: Record<string, string[]> = {
    'paix': ['paix', 'calme', 'anxiété', 'stress', 'angoisse', 'panique', 'sommeil', 'inquiétude'],
    'amour': ['amour', 'relation', 'couple', 'mariage', 'séparation', 'famille', 'conflit', 'harmonie'],
    'reussite': ['réussite', 'travail', 'argent', 'financier', 'carrière', 'projet', 'objectif', 'abondance'],
    'sante': ['santé', 'maladie', 'fatigue', 'énergie', 'corps', 'bien-être', 'équilibre', 'douleur'],
    'protection': ['protection', 'danger', 'peur', 'sécurité', 'voyage', 'menace', 'stabilité'],
    'sagesse': ['sagesse', 'décision', 'clarté', 'orientation', 'choix', 'direction', 'sens', 'vérité']
  };
  
  // Détecter les mots-clés présents
  for (const [theme, words] of Object.entries(keywordMap)) {
    for (const word of words) {
      if (textLower.includes(word)) {
        if (!keywords.includes(theme)) {
          keywords.push(theme);
        }
      }
    }
  }
  
  // Si aucun mot-clé détecté, retourner 'paix' par défaut
  if (keywords.length === 0) {
    keywords.push('paix');
  }
  
  return keywords;
}

/**
 * Attribue un Petek basé sur le manifeste et les mots-clés
 */
async function assignPetekToUser(db: D1Database, inscription_id: number, keywords: string[]): Promise<any> {
  // Chercher un Petek correspondant aux mots-clés
  let petek = null;
  
  for (const keyword of keywords) {
    const result = await db.prepare(`
      SELECT * FROM petek_templates 
      WHERE theme LIKE ? 
      AND is_active = 1 
      ORDER BY RANDOM() 
      LIMIT 1
    `).bind(`%${keyword}%`).first();
    
    if (result) {
      petek = result;
      break;
    }
  }
  
  // Si aucun Petek trouvé, prendre un Petek par défaut
  if (!petek) {
    petek = await db.prepare(`
      SELECT * FROM petek_templates 
      WHERE is_active = 1 
      ORDER BY RANDOM() 
      LIMIT 1
    `).first();
  }
  
  if (!petek) {
    throw new Error('Aucun Petek disponible');
  }
  
  // Créer une attribution Petek pour l'utilisateur
  const attribution = await db.prepare(`
    INSERT INTO user_peteks (inscription_id, petek_template_id, status)
    VALUES (?, ?, 'active')
  `).bind(inscription_id, petek.id).run();
  
  return {
    ...petek,
    attribution_id: attribution.meta.last_row_id
  };
}

/**
 * Attribue des Psaumes basés sur le manifeste
 */
async function assignPsalmsToUser(db: D1Database, inscription_id: number, keywords: string[]): Promise<any[]> {
  const psalms: any[] = [];
  
  // Chercher des psaumes correspondants
  for (const keyword of keywords.slice(0, 3)) { // Limiter à 3 psaumes
    const result = await db.prepare(`
      SELECT * FROM psalms 
      WHERE tags LIKE ? 
      AND is_active = 1 
      ORDER BY RANDOM() 
      LIMIT 1
    `).bind(`%${keyword}%`).first();
    
    if (result && !psalms.find(p => p.id === result.id)) {
      psalms.push(result);
      
      // Créer une attribution
      await db.prepare(`
        INSERT INTO user_psalms (inscription_id, psalm_id, status)
        VALUES (?, ?, 'active')
      `).bind(inscription_id, result.id).run();
    }
  }
  
  // Si aucun psaume trouvé, en attribuer un par défaut
  if (psalms.length === 0) {
    const defaultPsalm = await db.prepare(`
      SELECT * FROM psalms 
      WHERE is_active = 1 
      ORDER BY RANDOM() 
      LIMIT 1
    `).first();
    
    if (defaultPsalm) {
      psalms.push(defaultPsalm);
      await db.prepare(`
        INSERT INTO user_psalms (inscription_id, psalm_id, status)
        VALUES (?, ?, 'active')
      `).bind(inscription_id, defaultPsalm.id).run();
    }
  }
  
  return psalms;
}

/**
 * Attribue des Anges basés sur le manifeste
 */
async function assignAngelsToUser(db: D1Database, inscription_id: number, keywords: string[]): Promise<any[]> {
  const angels: any[] = [];
  const assignedAngelIds: number[] = [];
  
  // Chercher des anges correspondants via les règles
  for (const keyword of keywords.slice(0, 2)) { // Limiter à 2 anges
    const rule = await db.prepare(`
      SELECT ar.*, a.id as angel_id, a.slug, a.name_fr, a.name_he, a.description_fr, a.tradition_source
      FROM angel_rules ar
      JOIN angels a ON ar.angel_id = a.id
      WHERE ar.condition_tags LIKE ?
      ORDER BY ar.priority ASC, RANDOM()
      LIMIT 1
    `).bind(`%${keyword}%`).first();
    
    if (rule && !assignedAngelIds.includes(rule.angel_id as number)) {
      angels.push(rule);
      assignedAngelIds.push(rule.angel_id as number);
      
      // Créer une attribution
      await db.prepare(`
        INSERT INTO user_angels (inscription_id, angel_id, rank_assigned)
        VALUES (?, ?, ?)
      `).bind(inscription_id, rule.angel_id, angels.length).run();
    }
  }
  
  // Si aucun ange trouvé, attribuer Metatron par défaut
  if (angels.length === 0) {
    const metatron = await db.prepare(`
      SELECT a.*, ar.condition_tags as rule_tags
      FROM angels a
      LEFT JOIN angel_rules ar ON a.id = ar.angel_id
      WHERE a.slug = 'metatron'
      LIMIT 1
    `).first();
    
    if (metatron) {
      angels.push(metatron);
      await db.prepare(`
        INSERT INTO user_angels (inscription_id, angel_id, rank_assigned)
        VALUES (?, ?, 1)
      `).bind(inscription_id, metatron.id).run();
    }
  }
  
  return angels;
}

// =============================================
// API ROUTES
// =============================================

// POST /api/manifeste - Soumettre un manifeste
app.post('/api/manifeste', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { inscription_id, theme, theme_autre, content, reponses } = body;

    if (!inscription_id || !theme) {
      return c.json({ 
        success: false, 
        error: 'inscription_id et theme sont requis' 
      }, 400);
    }

    // Insérer le manifeste
    const result = await env.DB.prepare(`
      INSERT INTO manifestes (inscription_id, theme, theme_autre, content, reponses, status)
      VALUES (?, ?, ?, ?, ?, 'submitted')
    `).bind(
      inscription_id,
      theme,
      theme_autre || null,
      content || null,
      reponses ? JSON.stringify(reponses) : null
    ).run();

    return c.json({ 
      success: true,
      manifeste_id: result.meta.last_row_id,
      message: 'Manifeste soumis avec succès'
    });

  } catch (error) {
    console.error('Erreur manifeste:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la soumission du manifeste' 
    }, 500);
  }
});

// POST /api/analyze-manifeste - Analyser un manifeste et attribuer Petek/Psaume/Ange
app.post('/api/analyze-manifeste', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { manifeste_id } = body;

    console.log('[1] Début analyse manifeste:', manifeste_id);

    if (!manifeste_id) {
      return c.json({ 
        success: false, 
        error: 'manifeste_id requis' 
      }, 400);
    }

    // Récupérer le manifeste
    console.log('[2] Récupération manifeste...');
    const manifeste = await env.DB.prepare(`
      SELECT m.*, i.prenom, i.nom 
      FROM manifestes m
      JOIN inscriptions i ON m.inscription_id = i.id
      WHERE m.id = ?
    `).bind(manifeste_id).first();

    if (!manifeste) {
      console.log('[2] Manifeste non trouvé');
      return c.json({ 
        success: false, 
        error: 'Manifeste non trouvé' 
      }, 404);
    }

    console.log('[2] Manifeste trouvé:', {
      id: manifeste.id,
      inscription_id: manifeste.inscription_id,
      theme: manifeste.theme
    });

    // Construire le texte complet
    console.log('[3] Construction texte complet...');
    let fullText = `Thème: ${manifeste.theme}\n`;
    if (manifeste.theme_autre && manifeste.theme_autre !== 'null') {
      fullText += `Thème personnalisé: ${manifeste.theme_autre}\n`;
    }
    if (manifeste.content) {
      fullText += `Contenu: ${manifeste.content}\n`;
    }
    if (manifeste.reponses && manifeste.reponses !== 'null') {
      try {
        const reponses = JSON.parse(manifeste.reponses as string);
        for (const r of reponses) {
          if (r.question && r.reponse) {
            fullText += `Q: ${r.question}\nR: ${r.reponse}\n`;
          }
        }
      } catch (parseError) {
        console.error('[3] Erreur parsing reponses:', parseError);
      }
    }

    console.log('[3] Texte complet construit:', fullText.substring(0, 100) + '...');

    // Analyser et extraire les mots-clés
    console.log('[4] Analyse mots-clés...');
    const keywords = analyzeManifeste(fullText);
    console.log('[4] Keywords détectés:', keywords);

    // Attribuer Petek, Psaumes et Anges
    console.log('[5] Attribution Petek...');
    const petek = await assignPetekToUser(env.DB, Number(manifeste.inscription_id), keywords);
    console.log('[5] Petek attribué:', petek?.code);

    console.log('[6] Attribution Psaumes...');
    const psalms = await assignPsalmsToUser(env.DB, Number(manifeste.inscription_id), keywords);
    console.log('[6] Psaumes attribués:', psalms.length);

    console.log('[7] Attribution Anges...');
    const angels = await assignAngelsToUser(env.DB, Number(manifeste.inscription_id), keywords);
    console.log('[7] Anges attribués:', angels.length);

    // Mettre à jour le statut du manifeste
    console.log('[8] Mise à jour statut manifeste...');
    await env.DB.prepare(`
      UPDATE manifestes 
      SET status = 'analyzed', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(manifeste_id).run();

    console.log('[9] Analyse terminée avec succès');

    return c.json({ 
      success: true,
      keywords,
      petek,
      psalms,
      angels,
      message: 'Manifeste analysé et attributions créées avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur analyse manifeste:', error);
    console.error('Stack:', (error as Error).stack);
    return c.json({ 
      success: false, 
      error: `Erreur lors de l'analyse: ${(error as Error).message}` 
    }, 500);
  }
});

// GET /api/user/:inscription_id/petek - Récupérer le Petek de l'utilisateur
app.get('/api/user/:inscription_id/petek', async (c) => {
  const { env } = c;
  const inscription_id = c.req.param('inscription_id');
  
  try {
    const result = await env.DB.prepare(`
      SELECT 
        up.*,
        pt.code, pt.theme, pt.theme_label,
        pt.intent_fr, pt.intent_he, pt.intent_translit,
        pt.reading_fr, pt.reading_he, pt.reading_translit,
        pt.practice, pt.guide_comment_fr,
        pt.duration_recommended, pt.cycle_days
      FROM user_peteks up
      JOIN petek_templates pt ON up.petek_template_id = pt.id
      WHERE up.inscription_id = ? AND up.status = 'active'
      ORDER BY up.assigned_at DESC
      LIMIT 1
    `).bind(inscription_id).first();

    if (!result) {
      return c.json({ 
        success: false, 
        error: 'Aucun Petek actif trouvé pour cet utilisateur' 
      }, 404);
    }

    // Parser le JSONB practice si présent
    const petek = {
      ...result,
      practice: result.practice ? JSON.parse(result.practice as string) : {}
    };

    return c.json({ 
      success: true,
      petek
    });

  } catch (error) {
    console.error('Erreur récupération Petek:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la récupération du Petek' 
    }, 500);
  }
});

// GET /api/user/:inscription_id/psalms - Récupérer les Psaumes de l'utilisateur
app.get('/api/user/:inscription_id/psalms', async (c) => {
  const { env } = c;
  const inscription_id = c.req.param('inscription_id');
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        up.*,
        p.number, p.title_fr, p.title_he,
        p.text_fr, p.text_he, p.text_translit,
        p.theme, p.tags, p.duration_min, p.level, p.guide_comment
      FROM user_psalms up
      JOIN psalms p ON up.psalm_id = p.id
      WHERE up.inscription_id = ? AND up.status = 'active'
      ORDER BY up.assigned_at DESC
    `).bind(inscription_id).all();

    return c.json({ 
      success: true,
      count: results.length,
      psalms: results
    });

  } catch (error) {
    console.error('Erreur récupération Psaumes:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la récupération des Psaumes' 
    }, 500);
  }
});

// GET /api/user/:inscription_id/angels - Récupérer les Anges de l'utilisateur
app.get('/api/user/:inscription_id/angels', async (c) => {
  const { env } = c;
  const inscription_id = c.req.param('inscription_id');
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        ua.*,
        a.slug, a.name_fr, a.name_he, a.rank_order,
        a.description_fr, a.tradition_source, a.level, a.tags
      FROM user_angels ua
      JOIN angels a ON ua.angel_id = a.id
      WHERE ua.inscription_id = ?
      ORDER BY ua.rank_assigned ASC
    `).bind(inscription_id).all();

    return c.json({ 
      success: true,
      count: results.length,
      angels: results
    });

  } catch (error) {
    console.error('Erreur récupération Anges:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la récupération des Anges' 
    }, 500);
  }
});

// GET /api/peteks - Liste tous les Peteks disponibles (pour admin)
app.get('/api/peteks', async (c) => {
  const { env } = c;
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM petek_templates 
      WHERE is_active = 1
      ORDER BY theme, code
    `).all();

    return c.json({ 
      success: true,
      count: results.length,
      peteks: results
    });

  } catch (error) {
    console.error('Erreur liste Peteks:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la récupération des Peteks' 
    }, 500);
  }
});

// GET /api/psalms - Liste tous les Psaumes disponibles (pour admin)
app.get('/api/psalms', async (c) => {
  const { env } = c;
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM psalms 
      WHERE is_active = 1
      ORDER BY number
    `).all();

    return c.json({ 
      success: true,
      count: results.length,
      psalms: results
    });

  } catch (error) {
    console.error('Erreur liste Psaumes:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la récupération des Psaumes' 
    }, 500);
  }
});

// GET /api/angels - Liste tous les Anges disponibles (pour admin)
app.get('/api/angels', async (c) => {
  const { env } = c;
  
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM angels 
      ORDER BY rank_order
    `).all();

    return c.json({ 
      success: true,
      count: results.length,
      angels: results
    });

  } catch (error) {
    console.error('Erreur liste Anges:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la récupération des Anges' 
    }, 500);
  }
});

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
          <th>Actions</th>
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
            <td><a href="/mon-parcours/${r.id}" class="btn" style="font-size: 12px; padding: 6px 12px;">Voir parcours</a></td>
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

// Route: Mon Manifeste (formulaire de soumission du manifeste)
app.get('/mon-manifeste/:inscription_id', async (c) => {
  const { env } = c;
  const inscription_id = c.req.param('inscription_id');
  
  try {
    // Vérifier que l'utilisateur existe
    const inscription = await env.DB.prepare(`
      SELECT * FROM inscriptions WHERE id = ?
    `).bind(inscription_id).first();

    if (!inscription) {
      return c.text('Utilisateur non trouvé', 404);
    }

    // Vérifier si un manifeste existe déjà
    const existingManifeste = await env.DB.prepare(`
      SELECT * FROM manifestes WHERE inscription_id = ? LIMIT 1
    `).bind(inscription_id).first();

    return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mon Manifeste - ${inscription.prenom} ${inscription.nom}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --text: #f0f0f2;
      --muted: #b8aec9;
      --accent: #b388eb;
      --line: rgba(255,255,255,.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container { max-width: 700px; margin: 0 auto; }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 1px solid var(--line);
    }
    .header h1 {
      font-size: 32px;
      margin-bottom: 8px;
      color: var(--accent);
    }
    .header .subtitle {
      color: var(--muted);
      font-size: 14px;
    }

    .form-box {
      background: rgba(255,255,255,.02);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 30px;
    }
    
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      font-size: 14px;
    }
    
    input, select, textarea {
      width: 100%;
      padding: 12px;
      background: rgba(255,255,255,.05);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      margin-bottom: 20px;
    }
    
    textarea {
      min-height: 150px;
      resize: vertical;
    }
    
    .btn {
      width: 100%;
      padding: 14px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .success-message {
      display: none;
      padding: 15px;
      background: rgba(76,175,80,.1);
      border: 1px solid #4caf50;
      border-radius: 8px;
      color: #4caf50;
      margin-top: 20px;
      text-align: center;
    }
    .success-message.show { display: block; }
    
    .error-message {
      display: none;
      padding: 15px;
      background: rgba(244,67,54,.1);
      border: 1px solid #f44336;
      border-radius: 8px;
      color: #f44336;
      margin-top: 20px;
      text-align: center;
    }
    .error-message.show { display: block; }
    
    .info-box {
      background: rgba(179,136,235,.1);
      border: 1px solid rgba(179,136,235,.3);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 30px;
      font-size: 14px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Votre Manifeste Spirituel</h1>
      <div class="subtitle">Bienvenue ${inscription.prenom} ${inscription.nom}</div>
    </div>

    ${existingManifeste ? `
      <div class="info-box">
        <strong>✓ Votre manifeste a déjà été soumis</strong><br>
        <span style="font-size: 13px; margin-top: 8px; display: block;">
          Votre pratique spirituelle a été analysée et personnalisée. 
          <a href="/mon-parcours/${inscription_id}" 
             style="color: var(--accent); text-decoration: underline; font-weight: 500;">
            Accédez à votre parcours spirituel →
          </a>
        </span>
      </div>
    ` : ''}

    <div class="info-box">
      <strong>📝 Pourquoi un manifeste ?</strong><br>
      Votre manifeste nous permet de comprendre votre situation et vos aspirations spirituelles. 
      En fonction de vos réponses, nous vous attribuerons un <strong>Petek personnalisé</strong>, 
      des <strong>Psaumes adaptés</strong> et des <strong>Anges protecteurs</strong> pour vous guider.
    </div>

    <div class="form-box">
      <form id="manifeste-form">
        <div>
          <label for="theme">Thème principal *</label>
          <select id="theme" required>
            <option value="">-- Choisissez un thème --</option>
            <option value="paix">Paix intérieure</option>
            <option value="amour">Amour & Relations</option>
            <option value="reussite">Réussite & Abondance</option>
            <option value="sante">Santé & Vitalité</option>
            <option value="protection">Protection & Sécurité</option>
            <option value="sagesse">Sagesse & Clarté</option>
            <option value="autre">Autre</option>
          </select>
        </div>

        <div id="theme-autre-box" style="display: none;">
          <label for="theme_autre">Précisez votre thème</label>
          <input type="text" id="theme_autre" placeholder="Ex: Guérison émotionnelle, pardon...">
        </div>

        <div>
          <label for="content">Décrivez votre situation *</label>
          <textarea 
            id="content" 
            required
            placeholder="Parlez-nous de votre situation actuelle, vos défis, vos aspirations spirituelles..."></textarea>
        </div>

        <div>
          <label for="question1">Votre situation actuelle</label>
          <textarea 
            id="question1" 
            placeholder="Comment décririez-vous votre état émotionnel et spirituel actuel ?"
            style="min-height: 100px;"></textarea>
        </div>

        <div>
          <label for="question2">Vos aspirations</label>
          <textarea 
            id="question2" 
            placeholder="Que souhaitez-vous atteindre ou transformer dans votre vie ?"
            style="min-height: 100px;"></textarea>
        </div>

        <button type="submit" class="btn" id="submit-btn">
          Soumettre mon manifeste
        </button>

        <div id="success-message" class="success-message"></div>
        <div id="error-message" class="error-message"></div>
      </form>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    const inscriptionId = ${inscription_id};
    
    // Show/hide theme_autre field
    document.getElementById('theme').addEventListener('change', (e) => {
      const themeAutreBox = document.getElementById('theme-autre-box');
      if (e.target.value === 'autre') {
        themeAutreBox.style.display = 'block';
      } else {
        themeAutreBox.style.display = 'none';
      }
    });

    // Handle form submission
    document.getElementById('manifeste-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('submit-btn');
      const successMsg = document.getElementById('success-message');
      const errorMsg = document.getElementById('error-message');
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';
      
      const formData = {
        inscription_id: inscriptionId,
        theme: document.getElementById('theme').value,
        theme_autre: document.getElementById('theme_autre').value || null,
        content: document.getElementById('content').value,
        reponses: []
      };
      
      // Ajouter les questions/réponses si remplies
      const q1 = document.getElementById('question1').value;
      const q2 = document.getElementById('question2').value;
      
      if (q1) {
        formData.reponses.push({
          question: 'Votre situation actuelle',
          reponse: q1
        });
      }
      
      if (q2) {
        formData.reponses.push({
          question: 'Vos aspirations',
          reponse: q2
        });
      }

      try {
        // Soumettre le manifeste
        const manifesteResponse = await axios.post('/api/manifeste', formData);
        
        if (manifesteResponse.data.success) {
          const manifesteId = manifesteResponse.data.manifeste_id;
          
          // Analyser le manifeste
          submitBtn.textContent = 'Analyse en cours...';
          const analyseResponse = await axios.post('/api/analyze-manifeste', { 
            manifeste_id: manifesteId 
          });
          
          if (analyseResponse.data.success) {
            successMsg.innerHTML = \`
              <strong>✓ Manifeste soumis et analysé avec succès !</strong><br>
              <span style="font-size: 13px; margin-top: 8px; display: block;">
                Votre parcours spirituel a été personnalisé. Redirection en cours...
              </span>
            \`;
            successMsg.classList.add('show');
            
            // Redirect to parcours after 2 seconds
            setTimeout(() => {
              window.location.href = '/mon-parcours/' + inscriptionId;
            }, 2000);
          } else {
            throw new Error('Erreur lors de l\'analyse');
          }
        }
      } catch (error) {
        console.error('Erreur:', error);
        errorMsg.textContent = 'Une erreur est survenue. Veuillez réessayer.';
        errorMsg.classList.add('show');
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Soumettre mon manifeste';
      }
    });
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('Erreur récupération manifeste:', error);
    return c.text('Erreur serveur', 500);
  }
})

// Route: Mon Parcours Spirituel (affichage du Petek, Psaumes, Anges et Rituel)
app.get('/mon-parcours/:inscription_id', async (c) => {
  const { env } = c;
  const inscription_id = c.req.param('inscription_id');
  
  try {
    // Récupérer toutes les données utilisateur
    const inscription = await env.DB.prepare(`
      SELECT * FROM inscriptions WHERE id = ?
    `).bind(inscription_id).first();

    if (!inscription) {
      return c.text('Utilisateur non trouvé', 404);
    }

    // Récupérer le Petek
    const petekResult = await env.DB.prepare(`
      SELECT 
        up.*,
        pt.code, pt.theme, pt.theme_label,
        pt.intent_fr, pt.reading_fr,
        pt.practice, pt.guide_comment_fr,
        pt.duration_recommended, pt.cycle_days
      FROM user_peteks up
      JOIN petek_templates pt ON up.petek_template_id = pt.id
      WHERE up.inscription_id = ? AND up.status = 'active'
      ORDER BY up.assigned_at DESC
      LIMIT 1
    `).bind(inscription_id).first();

    // Récupérer les Psaumes
    const psalmsResult = await env.DB.prepare(`
      SELECT 
        p.number, p.title_fr, p.full_text_fr, p.theme, p.duration_min, p.guide_comment
      FROM user_psalms up
      JOIN psalms p ON up.psalm_id = p.id
      WHERE up.inscription_id = ? AND up.status = 'active'
      ORDER BY up.assigned_at DESC
      LIMIT 3
    `).bind(inscription_id).all();

    // Récupérer les Anges
    const angelsResult = await env.DB.prepare(`
      SELECT 
        a.slug, a.name_fr, a.name_he, a.description_fr,
        ua.rank_assigned
      FROM user_angels ua
      JOIN angels a ON ua.angel_id = a.id
      WHERE ua.inscription_id = ?
      ORDER BY ua.rank_assigned ASC
    `).bind(inscription_id).all();

    const petek = petekResult || null;
    const psalms = psalmsResult.results || [];
    const angels = angelsResult.results || [];

    return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mon Parcours Spirituel - ${inscription.prenom} ${inscription.nom}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --text: #f0f0f2;
      --muted: #b8aec9;
      --muted2: #8f88a3;
      --accent: #b388eb;
      --line: rgba(255,255,255,.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container { max-width: 900px; margin: 0 auto; }
    
    .header {
      text-align: center;
      margin-bottom: 50px;
      padding-bottom: 30px;
      border-bottom: 1px solid var(--line);
    }
    .header h1 {
      font-size: 32px;
      margin-bottom: 8px;
      color: var(--accent);
    }
    .header .subtitle {
      color: var(--muted2);
      font-size: 14px;
    }

    .section {
      background: rgba(255,255,255,.02);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 22px;
      color: var(--accent);
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-title .icon {
      font-size: 24px;
    }

    .petek-card {
      background: rgba(179,136,235,.1);
      border: 2px solid rgba(179,136,235,.3);
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
    }
    .petek-code {
      font-size: 14px;
      color: var(--muted2);
      margin-bottom: 10px;
    }
    .petek-intent {
      font-size: 18px;
      line-height: 1.6;
      margin-bottom: 15px;
      color: var(--text);
    }
    .petek-reading {
      font-style: italic;
      color: var(--muted);
      padding: 15px;
      background: rgba(0,0,0,.2);
      border-radius: 8px;
      border-left: 3px solid var(--accent);
    }
    .petek-meta {
      display: flex;
      gap: 20px;
      margin-top: 15px;
      font-size: 14px;
      color: var(--muted2);
    }

    .psalm-item {
      border-left: 3px solid var(--accent);
      padding-left: 20px;
      margin-bottom: 25px;
    }
    .psalm-number {
      font-size: 14px;
      color: var(--accent);
      font-weight: 600;
    }
    .psalm-title {
      font-size: 16px;
      font-weight: 600;
      margin: 5px 0 10px;
    }
    .psalm-text {
      color: var(--muted);
      font-size: 15px;
      line-height: 1.8;
      max-height: 200px;
      overflow-y: auto;
    }

    .angel-item {
      display: flex;
      gap: 15px;
      padding: 20px;
      background: rgba(255,255,255,.03);
      border-radius: 10px;
      margin-bottom: 15px;
    }
    .angel-rank {
      font-size: 24px;
      font-weight: 600;
      color: var(--accent);
      min-width: 30px;
    }
    .angel-info h3 {
      font-size: 18px;
      margin-bottom: 5px;
    }
    .angel-info .angel-hebrew {
      font-size: 14px;
      color: var(--muted2);
      margin-bottom: 10px;
    }
    .angel-info .angel-desc {
      color: var(--muted);
      font-size: 15px;
    }

    .ritual-box {
      background: linear-gradient(135deg, rgba(179,136,235,.15), rgba(179,136,235,.05));
      border: 2px solid rgba(179,136,235,.3);
      border-radius: 12px;
      padding: 30px;
    }
    .ritual-step {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--line);
    }
    .ritual-step:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    .ritual-number {
      min-width: 35px;
      height: 35px;
      background: var(--accent);
      color: #0a0a0f;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
      flex-shrink: 0;
    }
    .ritual-content h4 {
      font-size: 16px;
      margin-bottom: 8px;
    }
    .ritual-content p {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
    }
    .ritual-time {
      display: inline-block;
      padding: 4px 10px;
      background: rgba(179,136,235,.2);
      border-radius: 20px;
      font-size: 12px;
      color: var(--accent);
      margin-top: 8px;
    }

    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: var(--accent);
      color: #0a0a0f;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(179,136,235,.4);
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8f9ff;
        --text: #17151f;
        --muted: #4b4460;
        --muted2: #6a6180;
        --accent: #7a42e4;
        --line: rgba(10,10,20,.12);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✦ Mon Parcours Spirituel</h1>
      <p class="subtitle">${inscription.prenom} ${inscription.nom} • Objectif: ${inscription.objectif || 'Non défini'}</p>
    </div>

    ${petek ? `
    <div class="section">
      <div class="section-title">
        <span class="icon">📜</span>
        <span>Votre Petek Personnel</span>
      </div>
      <div class="petek-card">
        <div class="petek-code">${petek.code} • ${petek.theme_label}</div>
        <div class="petek-intent">${petek.intent_fr}</div>
        <div class="petek-reading">"${petek.reading_fr}"</div>
        <div class="petek-meta">
          <span>⏱ Durée: ${petek.duration_recommended} min/jour</span>
          <span>🔄 Cycle: ${petek.cycle_days} jours</span>
        </div>
      </div>
      ${petek.guide_comment_fr ? `<p style="color: var(--muted); margin-top: 15px;"><strong>Note du guide:</strong> ${petek.guide_comment_fr}</p>` : ''}
    </div>
    ` : '<div class="section"><p style="color: var(--muted);">Aucun Petek attribué pour le moment.</p></div>'}

    ${psalms.length > 0 ? `
    <div class="section">
      <div class="section-title">
        <span class="icon">📖</span>
        <span>Vos Psaumes (Louis Segond 1910)</span>
      </div>
      ${psalms.map(psalm => `
        <div class="psalm-item">
          <div class="psalm-number">Psaume ${psalm.number}</div>
          <div class="psalm-title">${psalm.title_fr}</div>
          <div class="psalm-text">${psalm.full_text_fr || 'Texte complet à venir...'}</div>
          ${psalm.guide_comment ? `<p style="color: var(--muted2); font-size: 13px; margin-top: 10px;"><em>${psalm.guide_comment}</em></p>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${angels.length > 0 ? `
    <div class="section">
      <div class="section-title">
        <span class="icon">👼</span>
        <span>Vos Anges Protecteurs</span>
      </div>
      ${angels.map(angel => `
        <div class="angel-item">
          <div class="angel-rank">${angel.rank_assigned === 1 ? '👑' : '⭐'}</div>
          <div class="angel-info">
            <h3>${angel.name_fr}</h3>
            <div class="angel-hebrew">${angel.name_he}</div>
            <div class="angel-desc">${angel.description_fr}</div>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">
        <span class="icon">🕯</span>
        <span>Votre Rituel Quotidien Personnalisé</span>
      </div>
      <div class="ritual-box">
        <div class="ritual-step">
          <div class="ritual-number">1</div>
          <div class="ritual-content">
            <h4>Préparation (Matin)</h4>
            <p>Installez-vous dans un endroit calme. Prenez 3 respirations profondes pour vous recentrer.</p>
            <span class="ritual-time">⏱ 2 minutes</span>
          </div>
        </div>

        ${petek ? `
        <div class="ritual-step">
          <div class="ritual-number">2</div>
          <div class="ritual-content">
            <h4>Lecture de votre Petek</h4>
            <p>Lisez votre Petek (${petek.code}) en vous concentrant sur l'intention : <em>"${petek.reading_fr}"</em></p>
            <span class="ritual-time">⏱ ${petek.duration_recommended} minutes</span>
          </div>
        </div>
        ` : ''}

        ${psalms.length > 0 ? `
        <div class="ritual-step">
          <div class="ritual-number">3</div>
          <div class="ritual-content">
            <h4>Récitation du Psaume ${psalms[0].number}</h4>
            <p>Récitez le Psaume ${psalms[0].number} "${psalms[0].title_fr}" à voix haute ou mentalement. Laissez les mots résonner en vous.</p>
            <span class="ritual-time">⏱ ${psalms[0].duration_min || 5} minutes</span>
          </div>
        </div>
        ` : ''}

        ${angels.length > 0 ? `
        <div class="ritual-step">
          <div class="ritual-number">4</div>
          <div class="ritual-content">
            <h4>Invocation de ${angels[0].name_fr}</h4>
            <p>Invoquez ${angels[0].name_fr} (${angels[0].name_he}) pour ${angels[0].description_fr.toLowerCase()}. Formulez votre demande avec clarté et respect.</p>
            <span class="ritual-time">⏱ 3 minutes</span>
          </div>
        </div>
        ` : ''}

        <div class="ritual-step">
          <div class="ritual-number">5</div>
          <div class="ritual-content">
            <h4>Clôture et Gratitude</h4>
            <p>Terminez par un moment de silence et de gratitude. Notez dans un carnet vos ressentis ou insights.</p>
            <span class="ritual-time">⏱ 2 minutes</span>
          </div>
        </div>

        <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid var(--line);">
          <p style="color: var(--muted); font-size: 14px;">
            <strong>⏰ Durée totale:</strong> ${(petek?.duration_recommended || 5) + (psalms[0]?.duration_min || 5) + 10} minutes par jour<br>
            <strong>📅 Fréquence:</strong> Quotidienne pendant ${petek?.cycle_days || 21} jours<br>
            <strong>💡 Conseil:</strong> Pratiquez de préférence le matin au réveil ou le soir avant de dormir.
          </p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-top: 40px;">
      <a href="/" class="btn">← Retour à l'accueil</a>
    </div>
  </div>
</body>
</html>`);

  } catch (error) {
    console.error('Erreur mon-parcours:', error);
    return c.html('<h1>Erreur lors du chargement de votre parcours</h1><p>Veuillez réessayer plus tard.</p>');
  }
});

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

    /* Pricing Cards */
    .pricing-card {
      border: 1px solid rgba(255,255,255,.08);
      border-radius: var(--r);
      padding: 24px;
      background: rgba(255,255,255,.02);
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .pricing-card:hover {
      border-color: rgba(179,136,235,.3);
      background: rgba(255,255,255,.04);
      transform: translateY(-5px);
    }
    .pricing-featured {
      border-color: rgba(179,136,235,.4);
      background: rgba(179,136,235,.08);
    }
    .pricing-badge {
      position: absolute;
      top: -12px;
      right: 20px;
      background: var(--accent);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .pricing-header {
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      padding-bottom: 20px;
    }
    .pricing-header h3 {
      margin: 0 0 12px 0;
      font-size: 22px;
      font-weight: 600;
      color: var(--text);
    }
    .pricing-price {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .price-amount {
      font-size: 36px;
      font-weight: 700;
      color: var(--accent);
      line-height: 1;
    }
    .price-period {
      font-size: 13px;
      color: var(--muted2);
    }
    .pricing-features {
      list-style: none;
      padding: 0;
      margin: 0 0 24px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .pricing-features li {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.6;
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
          <a href="#tarifs">Tarifs</a>
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

    <!-- TARIFS -->
    <section id="tarifs">
      <div class="wrap">
        <div class="kicker">Transparence totale</div>
        <h2>Nos formules</h2>
        <p class="lead">
          Trois parcours adaptés à votre besoin. Un seul engagement : vous accompagner avec clarté.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 40px;">
          
          <!-- Formule Essentiel -->
          <div class="pricing-card">
            <div class="pricing-header">
              <h3>Petek Essentiel</h3>
              <div class="pricing-price">
                <span class="price-amount">175€</span>
                <span class="price-period">paiement unique</span>
              </div>
            </div>
            <ul class="pricing-features">
              <li>✓ 1 entretien initial (45 min)</li>
              <li>✓ Analyse personnalisée de votre besoin</li>
              <li>✓ 1 Petek sur mesure</li>
              <li>✓ Accès illimité à l'application</li>
              <li>✓ Support par message</li>
            </ul>
            <a href="#inscription" class="btn" style="width: 100%; margin-top: auto;">Commencer</a>
          </div>

          <!-- Formule Psaumes -->
          <div class="pricing-card pricing-featured">
            <div class="pricing-badge">Recommandé</div>
            <div class="pricing-header">
              <h3>Petek & Psaumes</h3>
              <div class="pricing-price">
                <span class="price-amount">495€</span>
                <span class="price-period">paiement unique</span>
              </div>
            </div>
            <ul class="pricing-features">
              <li>✓ 3 entretiens (45 min chacun sur 4-6 semaines)</li>
              <li>✓ 2 Peteks personnalisés</li>
              <li>✓ 3-5 Psaumes adaptés à votre parcours</li>
              <li>✓ Attribution d'un Ange gardien</li>
              <li>✓ Accès complet à la plateforme</li>
              <li>✓ Suivi personnalisé</li>
            </ul>
            <a href="#inscription" class="btn btn-primary" style="width: 100%; margin-top: auto;">Choisir cette formule</a>
          </div>

          <!-- Formule Intégral -->
          <div class="pricing-card">
            <div class="pricing-header">
              <h3>Parcours Intégral</h3>
              <div class="pricing-price">
                <span class="price-amount">1 500€</span>
                <span class="price-period">sur 6 mois (ou 3×500€)</span>
              </div>
            </div>
            <ul class="pricing-features">
              <li>✓ Accès illimité au guide pendant 6 mois</li>
              <li>✓ 2+ entretiens par mois</li>
              <li>✓ Peteks illimités selon votre évolution</li>
              <li>✓ Psaumes évolutifs personnalisés</li>
              <li>✓ Manifeste de vie complet</li>
              <li>✓ Support prioritaire par message</li>
              <li>✓ Ajustements continus</li>
            </ul>
            <a href="#inscription" class="btn" style="width: 100%; margin-top: auto;">S'engager 6 mois</a>
          </div>

        </div>

        <p class="hint" style="text-align: center; margin-top: 30px;">
          Premier entretien gratuit pour tous. Vous ne payez qu'après validation mutuelle.
        </p>
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
          const inscriptionId = response.data.id;
          
          // Show success message with link to manifeste
          const successMsg = document.getElementById('success-message');
          successMsg.innerHTML = 
            '<strong>✓ Inscription réussie !</strong><br>' +
            '<span style="font-size: 14px; margin-top: 8px; display: block;">' +
            'Passez maintenant à l\'étape suivante : ' +
            '<a href="/mon-manifeste/' + inscriptionId + '" ' +
            'style="color: #b388eb; text-decoration: underline; font-weight: 500;">' +
            'rédiger votre manifeste spirituel →' +
            '</a>' +
            '</span>';
          successMsg.classList.add('show');
          
          // Reset form
          e.target.reset();
          
          // Auto redirect after 3 seconds
          setTimeout(() => {
            window.location.href = '/mon-manifeste/' + inscriptionId;
          }, 3000);
        }
      } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        
        if (error.response?.status === 409) {
          alert('Cet email est déjà inscrit. Veuillez utiliser un autre email.');
        } else {
          alert('Une erreur est survenue. Veuillez réessayer.');
        }
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
