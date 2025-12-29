import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { sign, verify } from 'hono/jwt'
import * as bcrypt from 'bcryptjs'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

// =============================================
// HELPERS - JWT & Auth
// =============================================

const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production-12345'; // TODO: Move to environment variable

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  exp: number;
}

/**
 * Générer un token JWT
 */
async function generateToken(userId: number, email: string, role: string): Promise<string> {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 jours
  };
  
  return await sign(payload, JWT_SECRET);
}

/**
 * Vérifier un token JWT
 */
async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, JWT_SECRET) as JWTPayload;
    
    // Vérifier l'expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware d'authentification
 */
async function authMiddleware(c: any, requiredRole?: string) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Token manquant' }, 401);
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyToken(token);
  
  if (!payload) {
    return c.json({ success: false, error: 'Token invalide ou expiré' }, 401);
  }
  
  // Vérifier le rôle si spécifié
  if (requiredRole) {
    if (requiredRole === 'admin' && payload.role !== 'super_admin') {
      return c.json({ success: false, error: 'Accès refusé - Admin requis' }, 403);
    }
    if (requiredRole === 'guide' && payload.role !== 'guide' && payload.role !== 'super_admin') {
      return c.json({ success: false, error: 'Accès refusé - Guide requis' }, 403);
    }
  }
  
  // Ajouter les infos utilisateur au contexte
  c.set('user', payload);
  
  return null; // Continuer
}

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

// Fonction d'envoi d'email via Resend
async function sendEmail(
  env: any,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const FROM_EMAIL = env.FROM_EMAIL || 'Académie de la Lumière <onboarding@resend.dev>';

    if (!RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY non configurée');
      return false;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: subject,
        html: html
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Erreur Resend:', error);
      return false;
    }

    const result = await response.json();
    console.log('✅ Email envoyé:', result.id);
    return true;

  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return false;
  }
}

// =============================================
// API ROUTES

// =============================================

// =============================================
// BLACKLIST MANAGEMENT API
// =============================================

// POST /api/admin/blacklist/add - Ajouter à la blacklist
app.post('/api/admin/blacklist/add', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { email, tel, raison, admin_id } = body;

    if ((!email && !tel) || !raison || !admin_id) {
      return c.json({ 
        success: false, 
        error: 'Email ou téléphone, raison et admin_id requis' 
      }, 400);
    }

    // Vérifier si déjà dans la blacklist
    const existing = await env.DB.prepare(`
      SELECT id FROM blacklist 
      WHERE (email = ? OR tel = ?)
    `).bind(email || '', tel || '').first();

    if (existing) {
      return c.json({ 
        success: false, 
        error: 'Cette entrée existe déjà dans la blacklist' 
      }, 400);
    }

    // Ajouter à la blacklist
    const result = await env.DB.prepare(`
      INSERT INTO blacklist (email, tel, raison, blacklisted_by)
      VALUES (?, ?, ?, ?)
    `).bind(email || null, tel || null, raison, admin_id).run();

    console.log(`✅ Ajouté à la blacklist: ${email || tel} par admin ${admin_id}`);

    return c.json({ 
      success: true, 
      message: 'Ajouté à la blacklist avec succès',
      blacklist_id: result.meta.last_row_id
    });

  } catch (error) {
    console.error('Erreur add blacklist:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// DELETE /api/admin/blacklist/remove/:id - Retirer de la blacklist
app.delete('/api/admin/blacklist/remove/:id', async (c) => {
  const { env } = c;
  
  try {
    const id = parseInt(c.req.param('id'));

    if (!id) {
      return c.json({ 
        success: false, 
        error: 'ID requis' 
      }, 400);
    }

    // Supprimer de la blacklist
    await env.DB.prepare(`
      DELETE FROM blacklist WHERE id = ?
    `).bind(id).run();

    console.log(`✅ Retiré de la blacklist: ID ${id}`);

    return c.json({ 
      success: true, 
      message: 'Retiré de la blacklist avec succès'
    });

  } catch (error) {
    console.error('Erreur remove blacklist:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// GET /api/admin/blacklist/list - Liste complète de la blacklist
app.get('/api/admin/blacklist/list', async (c) => {
  const { env } = c;
  
  try {
    const blacklist = await env.DB.prepare(`
      SELECT 
        b.id,
        b.email,
        b.tel,
        b.raison,
        b.created_at,
        u.email as admin_email
      FROM blacklist b
      LEFT JOIN users u ON b.blacklisted_by = u.id
      ORDER BY b.created_at DESC
    `).all();

    return c.json({ 
      success: true, 
      blacklist: blacklist.results || []
    });

  } catch (error) {
    console.error('Erreur list blacklist:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// MESSAGING API
// =============================================

// POST /api/messages/send - Envoyer un message
app.post('/api/messages/send', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { sender_id, recipient_id, inscription_id, content } = body;

    if (!sender_id || !recipient_id || !content) {
      return c.json({ 
        success: false, 
        error: 'sender_id, recipient_id et content requis' 
      }, 400);
    }

    // Vérifier que les utilisateurs existent
    const sender = await env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).bind(sender_id).first();

    const recipient = await env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).bind(recipient_id).first();

    if (!sender || !recipient) {
      return c.json({ 
        success: false, 
        error: 'Utilisateur introuvable' 
      }, 404);
    }

    // Insérer le message
    const result = await env.DB.prepare(`
      INSERT INTO messages (sender_id, recipient_id, inscription_id, content)
      VALUES (?, ?, ?, ?)
    `).bind(sender_id, recipient_id, inscription_id, content).run();

    return c.json({ 
      success: true, 
      message_id: result.meta.last_row_id,
      message: 'Message envoyé'
    });

  } catch (error) {
    console.error('Erreur send message:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// GET /api/messages/conversation/:user1_id/:user2_id - Récupérer une conversation
app.get('/api/messages/conversation/:user1_id/:user2_id', async (c) => {
  const { env } = c;
  
  try {
    const user1_id = parseInt(c.req.param('user1_id'));
    const user2_id = parseInt(c.req.param('user2_id'));

    if (!user1_id || !user2_id) {
      return c.json({ 
        success: false, 
        error: 'IDs utilisateurs requis' 
      }, 400);
    }

    // Récupérer tous les messages entre ces 2 utilisateurs
    const messages = await env.DB.prepare(`
      SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.content,
        m.is_read,
        m.created_at,
        u1.email as sender_email,
        u2.email as recipient_email
      FROM messages m
      JOIN users u1 ON m.sender_id = u1.id
      JOIN users u2 ON m.recipient_id = u2.id
      WHERE (m.sender_id = ? AND m.recipient_id = ?)
         OR (m.sender_id = ? AND m.recipient_id = ?)
      ORDER BY m.created_at ASC
    `).bind(user1_id, user2_id, user2_id, user1_id).all();

    return c.json({ 
      success: true, 
      messages: messages.results || []
    });

  } catch (error) {
    console.error('Erreur get conversation:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// GET /api/messages/unread/:user_id - Nombre de messages non lus
app.get('/api/messages/unread/:user_id', async (c) => {
  const { env } = c;
  
  try {
    const user_id = parseInt(c.req.param('user_id'));

    if (!user_id) {
      return c.json({ 
        success: false, 
        error: 'user_id requis' 
      }, 400);
    }

    const result = await env.DB.prepare(`
      SELECT COUNT(*) as unread_count
      FROM messages
      WHERE recipient_id = ? AND is_read = 0
    `).bind(user_id).first();

    return c.json({ 
      success: true, 
      unread_count: result.unread_count || 0
    });

  } catch (error) {
    console.error('Erreur get unread:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// POST /api/messages/mark-read - Marquer messages comme lus
app.post('/api/messages/mark-read', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { user_id, sender_id } = body;

    if (!user_id || !sender_id) {
      return c.json({ 
        success: false, 
        error: 'user_id et sender_id requis' 
      }, 400);
    }

    // Marquer tous les messages de sender_id vers user_id comme lus
    await env.DB.prepare(`
      UPDATE messages 
      SET is_read = 1, read_at = datetime('now')
      WHERE recipient_id = ? AND sender_id = ? AND is_read = 0
    `).bind(user_id, sender_id).run();

    return c.json({ 
      success: true, 
      message: 'Messages marqués comme lus'
    });

  } catch (error) {
    console.error('Erreur mark read:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// GET /api/messages/conversations/:user_id - Liste des conversations d'un utilisateur
app.get('/api/messages/conversations/:user_id', async (c) => {
  const { env } = c;
  
  try {
    const user_id = parseInt(c.req.param('user_id'));

    if (!user_id) {
      return c.json({ 
        success: false, 
        error: 'user_id requis' 
      }, 400);
    }

    // Récupérer toutes les conversations avec infos utilisateurs
    const conversations = await env.DB.prepare(`
      SELECT DISTINCT
        CASE 
          WHEN m.sender_id = ? THEN m.recipient_id 
          ELSE m.sender_id 
        END AS other_user_id,
        u.email AS other_user_email,
        i.prenom,
        i.nom,
        m.inscription_id,
        (SELECT content FROM messages m2 
         WHERE (m2.sender_id = ? AND m2.recipient_id = other_user_id)
            OR (m2.sender_id = other_user_id AND m2.recipient_id = ?)
         ORDER BY m2.created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages m2 
         WHERE (m2.sender_id = ? AND m2.recipient_id = other_user_id)
            OR (m2.sender_id = other_user_id AND m2.recipient_id = ?)
         ORDER BY m2.created_at DESC LIMIT 1) AS last_message_at,
        (SELECT COUNT(*) FROM messages m2 
         WHERE m2.recipient_id = ? AND m2.sender_id = other_user_id AND m2.is_read = 0) AS unread_count
      FROM messages m
      JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
      LEFT JOIN inscriptions i ON m.inscription_id = i.id
      WHERE m.sender_id = ? OR m.recipient_id = ?
      ORDER BY last_message_at DESC
    `).bind(
      user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id
    ).all();

    return c.json({ 
      success: true, 
      conversations: conversations.results || []
    });

  } catch (error) {
    console.error('Erreur get conversations:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// SSE endpoint pour notifications temps réel
app.get('/api/messages/stream/:user_id', async (c) => {
  const user_id = parseInt(c.req.param('user_id'));
  
  if (!user_id) {
    return c.text('user_id requis', 400);
  }

  // Configuration SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Fonction pour envoyer un événement
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Envoyer un ping initial
      sendEvent({ type: 'connected', user_id });

      // Polling toutes les 5 secondes pour vérifier nouveaux messages
      const intervalId = setInterval(async () => {
        try {
          const { env } = c;
          const result = await env.DB.prepare(`
            SELECT COUNT(*) as unread_count
            FROM messages
            WHERE recipient_id = ? AND is_read = 0
          `).bind(user_id).first();

          sendEvent({ 
            type: 'unread_update', 
            unread_count: result.unread_count || 0 
          });

        } catch (error) {
          console.error('SSE error:', error);
        }
      }, 5000);

      // Nettoyage quand la connexion se ferme
      setTimeout(() => {
        clearInterval(intervalId);
        controller.close();
      }, 300000); // 5 minutes max
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});

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

// =============================================
// AUTH ROUTES
// =============================================

// POST /api/auth/login - Connexion utilisateur
app.post('/api/auth/login', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { email, password } = body;
    
    // Validation
    if (!email || !password) {
      return c.json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      }, 400);
    }
    
    // Récupérer l'utilisateur
    const user = await env.DB.prepare(`
      SELECT u.id, u.email, u.password_hash, u.role, u.status,
             p.prenom, p.nom
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.email = ?
    `).bind(email).first();
    
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      }, 401);
    }
    
    // Vérifier le mot de passe
    const isValidPassword = bcrypt.compareSync(password, user.password_hash as string);
    
    if (!isValidPassword) {
      return c.json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      }, 401);
    }
    
    // Vérifier le statut du compte
    if (user.status === 'suspended' || user.status === 'inactive') {
      return c.json({ 
        success: false, 
        error: 'Votre compte est suspendu. Contactez l\'administrateur.' 
      }, 403);
    }
    
    // Générer le token JWT
    const token = await generateToken(
      user.id as number, 
      user.email as string, 
      user.role as string
    );
    
    // Mettre à jour last_login
    await env.DB.prepare(`
      UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(user.id).run();
    
    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        prenom: user.prenom,
        nom: user.nom
      }
    });
    
  } catch (error) {
    console.error('Erreur login:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur lors de la connexion' 
    }, 500);
  }
});

// GET /api/auth/me - Récupérer les infos de l'utilisateur connecté
app.get('/api/auth/me', async (c) => {
  const { env } = c;
  
  // Vérifier l'authentification
  const authError = await authMiddleware(c);
  if (authError) return authError;
  
  const userPayload = c.get('user') as JWTPayload;
  
  try {
    // Récupérer les infos complètes
    const user = await env.DB.prepare(`
      SELECT u.id, u.email, u.role, u.status, u.created_at, u.last_login,
             p.prenom, p.nom, p.tel, p.formule, p.payment_status, p.guide_id
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).bind(userPayload.userId).first();
    
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'Utilisateur non trouvé' 
      }, 404);
    }
    
    return c.json({
      success: true,
      user
    });
    
  } catch (error) {
    console.error('Erreur récupération user:', error);
    return c.json({ 
      success: false, 
      error: 'Erreur serveur' 
    }, 500);
  }
});

// POST /api/auth/logout - Déconnexion (côté client, invalider le token)
app.post('/api/auth/logout', (c) => {
  // Côté client: supprimer le token du localStorage
  // Côté serveur: rien à faire (JWT stateless)
  return c.json({ 
    success: true, 
    message: 'Déconnexion réussie' 
  });
});

// =============================================
// INSCRIPTION ROUTES
// =============================================

// API Inscription Step 1 - Vérification et création inscription simple
app.post('/api/inscription-step1', async (c) => {
  const { env } = c;
  try {
    const { prenom, nom, email, tel } = await c.req.json();

    // Validation
    if (!prenom || !nom || !email || !tel) {
      return c.json({ 
        success: false, 
        error: 'Tous les champs sont requis' 
      }, 400);
    }

    // Vérification blacklist
    const blacklistCheck = await env.DB.prepare(`
      SELECT id, raison FROM blacklist 
      WHERE email = ? OR tel = ?
    `).bind(email, tel).first();

    if (blacklistCheck) {
      console.log(`Inscription bloquée: ${email} - Raison: ${blacklistCheck.raison}`);
      return c.json({ 
        success: false, 
        error: 'Cette inscription ne peut pas être effectuée.' 
      }, 403);
    }

    // Vérification email existant
    const existing = await env.DB.prepare(`
      SELECT id FROM inscriptions WHERE email = ?
    `).bind(email).first();

    if (existing) {
      return c.json({ 
        success: false, 
        error: 'Cet email est déjà inscrit' 
      }, 409);
    }

    // Création inscription
    const result = await env.DB.prepare(`
      INSERT INTO inscriptions (prenom, nom, email, tel, status)
      VALUES (?, ?, ?, ?, 'pending_appointment')
    `).bind(prenom, nom, email, tel).run();

    return c.json({
      success: true,
      inscription_id: result.meta.last_row_id,
      message: 'Inscription enregistrée ! Passons au questionnaire...'
    });

  } catch (error) {
    console.error('Erreur inscription step1:', error);
    return c.json({ 
      success: false, 
      error: 'Une erreur est survenue lors de l\'inscription' 
    }, 500);
  }
});

// API Questionnaire - Enregistrer les thèmes et réponses dans manifestes
app.post('/api/questionnaire', async (c) => {
  const { env } = c;
  try {
    const { inscription_id, themes, responses } = await c.req.json();

    // Validation
    if (!inscription_id || !themes || !responses) {
      return c.json({ 
        success: false, 
        error: 'Données incomplètes' 
      }, 400);
    }

    // Vérifier que l'inscription existe
    const inscription = await env.DB.prepare(`
      SELECT id, status FROM inscriptions WHERE id = ?
    `).bind(inscription_id).first();

    if (!inscription) {
      return c.json({ 
        success: false, 
        error: 'Inscription introuvable' 
      }, 404);
    }

    if (inscription.status !== 'pending_appointment') {
      return c.json({ 
        success: false, 
        error: 'Ce questionnaire a déjà été complété' 
      }, 400);
    }

    // Construire le contenu du manifeste
    const themeLabels = {
      paix: 'Paix intérieure',
      amour: 'Amour & Relations',
      reussite: 'Réussite & Abondance',
      sante: 'Santé & Vitalité',
      protection: 'Protection & Sécurité',
      sagesse: 'Sagesse & Clarté'
    };

    const manifesteText = themes.map(theme => {
      return '**' + themeLabels[theme] + '**\n' + responses[theme];
    }).join('\n\n');

    // Préparer JSON des réponses
    const responsesJson = JSON.stringify(responses);

    // Insérer dans manifestes
    await env.DB.prepare(`
      INSERT INTO manifestes (inscription_id, theme, reponses, content, status)
      VALUES (?, ?, ?, ?, 'submitted')
    `).bind(
      inscription_id,
      themes.join(', '),
      responsesJson,
      manifesteText
    ).run();

    return c.json({
      success: true,
      message: 'Questionnaire enregistré avec succès'
    });

  } catch (error) {
    console.error('Erreur questionnaire API:', error);
    return c.json({ 
      success: false, 
      error: 'Une erreur est survenue lors de l\'enregistrement' 
    }, 500);
  }
});

// API RDV - Confirmer le rendez-vous et envoyer email
app.post('/api/rdv', async (c) => {
  const { env } = c;
  try {
    const { inscription_id, date, slot, remarques } = await c.req.json();

    // Validation
    if (!inscription_id || !date || !slot) {
      return c.json({ 
        success: false, 
        error: 'Données incomplètes' 
      }, 400);
    }

    // Vérifier inscription
    const inscription = await env.DB.prepare(`
      SELECT i.id, i.prenom, i.nom, i.email, i.status,
             m.theme, m.content
      FROM inscriptions i
      LEFT JOIN manifestes m ON i.id = m.inscription_id
      WHERE i.id = ?
    `).bind(inscription_id).first();

    if (!inscription) {
      return c.json({ 
        success: false, 
        error: 'Inscription introuvable' 
      }, 404);
    }

    if (inscription.status !== 'pending_appointment') {
      return c.json({ 
        success: false, 
        error: 'Le rendez-vous a déjà été confirmé' 
      }, 400);
    }

    // Créer le rendez-vous
    const slotLabels = {
      'matin': 'Matin (9h-12h)',
      'apres-midi': 'Après-midi (14h-17h)',
      'soir': 'Soir (18h-20h)'
    };

    await env.DB.prepare(`
      INSERT INTO rendez_vous (client_id, date_rdv, status, notes)
      VALUES (?, ?, 'scheduled', ?)
    `).bind(
      inscription_id,
      date + ' ' + slot,
      remarques || 'Pas de remarques'
    ).run();

    // Update status inscription
    await env.DB.prepare(`
      UPDATE inscriptions 
      SET status = 'contacted'
      WHERE id = ?
    `).bind(inscription_id).run();

    // Préparer email de confirmation
    const dateFormatted = new Date(date).toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    const emailBody = 'Bonjour ' + inscription.prenom + ',\n\n' +
      'Votre demande de rendez-vous a été enregistrée avec succès ! ✨\n\n' +
      'DÉTAILS DE VOTRE RENDEZ-VOUS\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📅 Date souhaitée : ' + dateFormatted + '\n' +
      '⏰ Créneau : ' + slotLabels[slot] + '\n' +
      '📧 Email : ' + inscription.email + '\n\n' +
      'VOS THÈMES SPIRITUELS\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      inscription.theme + '\n\n' +
      'PROCHAINES ÉTAPES\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      'Votre guide sera à votre disposition pour discuter des projets qui vous préoccupent et vous orienter vers le bon chemin.\n\n' +
      'Ce premier entretien de 45 minutes nous permettra de :\n' +
      '• Comprendre vos besoins spirituels\n' +
      '• Discuter de votre manifeste personnel\n' +
      '• Recommander le parcours le plus adapté pour vous\n\n' +
      'IMPORTANT : Ce premier entretien est totalement gratuit et sans engagement.\n\n' +
      'Nous avons hâte de vous accompagner dans votre parcours spirituel ! 🙏\n\n' +
      'L\'équipe de l\'Académie de la Lumière\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      'Western Wall Plaza, Jewish Quarter\n' +
      'Old City, Jerusalem, Israel';


    // Envoyer l'email via Resend
    try {
      const FROM_EMAIL = env.FROM_EMAIL || 'Académie de la Lumière <onboarding@resend.dev>';
      
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [inscription.email],
          subject: '✨ Confirmation de votre rendez-vous - Académie de la Lumière',
          text: emailBody
        })
      });

      const resendData = await resendResponse.json();
      
      if (!resendResponse.ok) {
        console.error('Erreur envoi email Resend:', resendData);
      } else {
        console.log('✅ Email de confirmation envoyé:', resendData);
      }
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email:', emailError);
      // On continue même si l'email échoue
    }

    return c.json({
      success: true,
      message: 'Rendez-vous confirmé ! Vous allez recevoir un email de confirmation.'
    });

  } catch (error) {
    console.error('Erreur RDV API:', error);
    return c.json({ 
      success: false, 
      error: 'Une erreur est survenue lors de la confirmation' 
    }, 500);
  }
});

// =============================================
// ADMIN API
// =============================================

// API Admin: Marquer comme contacté
app.post('/api/admin/mark-contacted', async (c) => {
  const { env } = c;
  try {
    const { inscription_id } = await c.req.json();

    if (!inscription_id) {
      return c.json({ success: false, error: 'ID inscription requis' }, 400);
    }

    // Update status
    await env.DB.prepare(`
      UPDATE inscriptions 
      SET status = 'contacted'
      WHERE id = ?
    `).bind(inscription_id).run();

    return c.json({ success: true, message: 'Status mis à jour' });

  } catch (error) {
    console.error('Erreur mark-contacted:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// API Admin: Supprimer une inscription
app.post('/api/admin/delete-inscription', async (c) => {
  const { env } = c;
  try {
    const { inscription_id } = await c.req.json();

    if (!inscription_id) {
      return c.json({ success: false, error: 'ID inscription requis' }, 400);
    }

    // Supprimer les données liées
    await env.DB.prepare('DELETE FROM manifestes WHERE inscription_id = ?').bind(inscription_id).run();
    await env.DB.prepare('DELETE FROM rendez_vous WHERE client_id = ?').bind(inscription_id).run();
    await env.DB.prepare('DELETE FROM messages WHERE inscription_id = ?').bind(inscription_id).run();
    await env.DB.prepare('DELETE FROM user_peteks WHERE inscription_id = ?').bind(inscription_id).run();
    await env.DB.prepare('DELETE FROM user_psalms WHERE inscription_id = ?').bind(inscription_id).run();
    await env.DB.prepare('DELETE FROM user_angels WHERE inscription_id = ?').bind(inscription_id).run();
    
    // Supprimer l'inscription
    await env.DB.prepare('DELETE FROM inscriptions WHERE id = ?').bind(inscription_id).run();

    console.log(`✅ Inscription #${inscription_id} supprimée`);
    return c.json({ success: true, message: 'Inscription supprimée avec succès' });

  } catch (error) {
    console.error('Erreur delete-inscription:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// API Admin: Enregistrer le paiement (formule + montant)
app.post('/api/admin/record-payment', async (c) => {
  const { env } = c;
  try {
    const { inscription_id, formule, amount, payment_link } = await c.req.json();

    if (!inscription_id || !formule || !amount) {
      return c.json({ success: false, error: 'Données incomplètes' }, 400);
    }

    // Vérifier que l'inscription existe
    const inscription = await env.DB.prepare(`
      SELECT id FROM inscriptions WHERE id = ?
    `).bind(inscription_id).first();

    if (!inscription) {
      return c.json({ success: false, error: 'Inscription introuvable' }, 404);
    }

    // Stocker les infos de paiement dans inscriptions (colonnes à ajouter si nécessaire)
    // Pour l'instant, on stocke juste la formule dans le champ objectif temporairement
    await env.DB.prepare(`
      UPDATE inscriptions 
      SET status = 'payment_pending',
          objectif = ?
      WHERE id = ?
    `).bind(`${formule}|${amount}|${payment_link || ''}`, inscription_id).run();

    // Récupérer les infos complètes de l'inscription
    const inscriptionFull = await env.DB.prepare(`
      SELECT prenom, nom, email FROM inscriptions WHERE id = ?
    `).bind(inscription_id).first();

    // Préparer l'email de demande de paiement
    const formuleLabels = {
      'essentiel': 'Petek Essentiel - 175€',
      'psaumes': 'Petek & Psaumes - 495€',
      'integral': 'Parcours Intégral - 1500€'
    };

    const emailBody = `Bonjour ${inscriptionFull.prenom},\n\n` +
      `Suite à notre entretien, nous avons le plaisir de vous proposer le parcours suivant :\n\n` +
      `VOTRE PARCOURS SPIRITUEL\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 Formule : ${formuleLabels[formule] || formule}\n` +
      `💰 Montant : ${amount}€\n\n` +
      (payment_link ? 
        `PAIEMENT EN LIGNE (STRIPE)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔗 Lien de paiement sécurisé :\n${payment_link}\n\n` +
        `Cliquez sur le lien ci-dessus pour procéder au paiement sécurisé par carte bancaire.\n\n` 
        : 
        `PAIEMENT PAR VIREMENT BANCAIRE\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Titulaire : Académie de la Lumière\n` +
        `IBAN : FR76 XXXX XXXX XXXX XXXX XXXX XXX\n` +
        `BIC : XXXXXXXX\n` +
        `Banque : Crédit Agricole\n` +
        `Référence : Inscription #${inscription_id}\n\n` +
        `⚠️ Important : Indiquez bien la référence dans votre virement.\n\n`
      ) +
      `PROCHAINES ÉTAPES\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `1. Effectuez le paiement via le lien ci-dessus ou par virement\n` +
      `2. Une fois le paiement reçu, nous validerons votre compte\n` +
      `3. Vous recevrez un email avec vos identifiants d'accès à votre espace personnel\n` +
      `4. Votre parcours spirituel de 21 jours commencera immédiatement\n\n` +
      `Nous sommes impatients de vous accompagner dans cette aventure spirituelle ! 🙏\n\n` +
      `L'équipe de l'Académie de la Lumière\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Western Wall Plaza, Jewish Quarter\n` +
      `Old City, Jerusalem, Israel`;

    // Envoyer l'email via Resend
    try {
      const FROM_EMAIL = env.FROM_EMAIL || 'Académie de la Lumière <onboarding@resend.dev>';
      
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [inscriptionFull.email],
          subject: '💳 Votre parcours spirituel vous attend - Académie de la Lumière',
          text: emailBody
        })
      });

      const resendData = await resendResponse.json();
      
      if (!resendResponse.ok) {
        console.error('Erreur envoi email Resend:', resendData);
      } else {
        console.log('✅ Email de demande de paiement envoyé:', resendData);
      }
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email:', emailError);
      // On continue même si l'email échoue
    }

    // Log payment link
    console.log(`💳 Paiement enregistré pour inscription #${inscription_id}: ${formule} - ${amount}€`);
    if (payment_link) {
      console.log(`   Lien: ${payment_link}`);
    }

    return c.json({ 
      success: true, 
      message: 'Paiement enregistré. Email envoyé au client.' 
    });

  } catch (error) {
    console.error('❌ Erreur record-payment:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// API Admin: Valider paiement et créer compte
app.post('/api/admin/validate-payment', async (c) => {
  const { env } = c;
  try {
    const { inscription_id } = await c.req.json();

    if (!inscription_id) {
      return c.json({ success: false, error: 'ID inscription requis' }, 400);
    }

    // Récupérer inscription + manifeste
    const inscription = await env.DB.prepare(`
      SELECT i.*, m.theme, m.content
      FROM inscriptions i
      LEFT JOIN manifestes m ON i.id = m.inscription_id
      WHERE i.id = ?
    `).bind(inscription_id).first();

    if (!inscription) {
      return c.json({ success: false, error: 'Inscription introuvable' }, 404);
    }

    // Extraire formule depuis objectif (format: "formule|montant|lien")
    const paymentInfo = (inscription.objectif || '').split('|');
    const formule = paymentInfo[0] || 'essentiel';
    const amount = parseFloat(paymentInfo[1]) || 175;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(inscription.email).first();

    let userId;
    let tempPassword = '';

    if (existingUser) {
      // L'utilisateur existe déjà, on le réutilise
      userId = existingUser.id;
      console.log(`⚠️ Utilisateur existant réutilisé: ${inscription.email} (ID: ${userId})`);
    } else {
      // Générer mot de passe temporaire
      tempPassword = 'Welcome' + Math.random().toString(36).slice(-6) + '!';
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Créer user
      const userResult = await env.DB.prepare(`
        INSERT INTO users (email, password_hash, role, status)
        VALUES (?, ?, 'client', 'active')
      `).bind(inscription.email, passwordHash).run();

      userId = userResult.meta.last_row_id;
      console.log(`✅ Nouvel utilisateur créé: ${inscription.email} (ID: ${userId})`);
    }

    // Créer ou mettre à jour user_profile
    const existingProfile = await env.DB.prepare(`
      SELECT user_id FROM user_profiles WHERE user_id = ?
    `).bind(userId).first();

    if (existingProfile) {
      // Mettre à jour le profil existant
      await env.DB.prepare(`
        UPDATE user_profiles 
        SET formule = ?, formule_prix = ?, payment_status = 'paid', payment_date = datetime('now')
        WHERE user_id = ?
      `).bind(formule, amount, userId).run();
      console.log(`✅ Profil mis à jour pour user_id: ${userId}`);
    } else {
      // Créer un nouveau profil
      await env.DB.prepare(`
        INSERT INTO user_profiles (user_id, prenom, nom, tel, formule, formule_prix, payment_status, payment_date)
        VALUES (?, ?, ?, ?, ?, ?, 'paid', datetime('now'))
      `).bind(userId, inscription.prenom, inscription.nom, inscription.tel, formule, amount).run();
      console.log(`✅ Nouveau profil créé pour user_id: ${userId}`);
    }

    // Update user_id dans inscription
    await env.DB.prepare(`
      UPDATE inscriptions SET user_id = ?, status = 'completed' WHERE id = ?
    `).bind(userId, inscription_id).run();

    // Attribution automatique Petek/Psaumes/Anges
    console.log(`Compte créé pour ${inscription.email} - Mot de passe temporaire: ${tempPassword}`);
    console.log(`Attribution du parcours pour formule: ${formule}`);

    // Analyser le manifeste pour extraire les thèmes
    const manifesteText = inscription.content || inscription.theme || 'paix';
    const keywords = analyzeManifeste(manifesteText);
    console.log(`Thèmes détectés: ${keywords.join(', ')}`);

    // 1. Attribuer Petek
    let petek = null;
    try {
      petek = await assignPetekToUser(env.DB, inscription_id, keywords);
      console.log(`✅ Petek attribué: ${petek.code} - ${petek.theme}`);
    } catch (error) {
      console.warn(`⚠️ Impossible d'attribuer Petek:`, error);
      // Créer un Petek par défaut temporaire
      petek = {
        code: 'TEMP001',
        theme: 'En attente d\'attribution',
        description: 'Votre Petek personnalisé sera attribué prochainement par votre guide.'
      };
    }

    // 2. Attribuer Psaumes selon la formule
    let psalmsCount = 1; // Par défaut
    if (formule === 'psaumes') {
      psalmsCount = 3; // 3-5 Psaumes
    } else if (formule === 'integral') {
      psalmsCount = 5; // Psaumes illimités (commencer avec 5)
    }

    let psalms = [];
    try {
      psalms = await assignPsalmsToUser(env.DB, inscription_id, keywords);
      console.log(`✅ ${psalms.length} Psaume(s) attribué(s)`);
    } catch (error) {
      console.warn(`⚠️ Impossible d'attribuer Psaumes:`, error);
      psalms = [];
    }

    // 3. Attribuer Anges (2 anges protecteurs)
    let angels = [];
    try {
      angels = await assignAngelsToUser(env.DB, inscription_id, keywords);
      console.log(`✅ ${angels.length} Ange(s) attribué(s)`);
    } catch (error) {
      console.warn(`⚠️ Impossible d'attribuer Anges:`, error);
      angels = [];
    }

    // 4. Envoyer email avec identifiants
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
          .credentials p { margin: 10px 0; }
          .credentials strong { color: #667eea; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          .attribution { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .attribution-item { margin: 8px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Bienvenue à l'Académie de la Lumière ✨</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${inscription.prenom},</h2>
            
            <p>Votre paiement a été validé avec succès ! 🎉</p>
            
            <p>Votre compte a été créé et votre parcours spirituel personnalisé est maintenant disponible.</p>
            
            <div class="credentials">
              <h3>🔐 Vos identifiants de connexion</h3>
              <p><strong>Email :</strong> ${inscription.email}</p>
              <p><strong>Mot de passe temporaire :</strong> ${tempPassword}</p>
              <p style="color: #e67e22; font-size: 14px;">⚠️ Veuillez changer ce mot de passe lors de votre première connexion.</p>
            </div>

            <div class="attribution">
              <h3>🎁 Votre parcours spirituel personnalisé</h3>
              <div class="attribution-item">📿 <strong>Petek :</strong> ${petek ? `${petek.code} - ${petek.theme}` : 'En attente d\'attribution par votre guide'}</div>
              <div class="attribution-item">📖 <strong>Psaumes :</strong> ${psalms.length > 0 ? `${psalms.length} Psaume(s) attribué(s)` : 'En attente d\'attribution'}</div>
              <div class="attribution-item">👼 <strong>Anges protecteurs :</strong> ${angels.length > 0 ? `${angels.length} Ange(s) attribué(s)` : 'En attente d\'attribution'}</div>
              <div class="attribution-item">💎 <strong>Formule :</strong> ${formule === 'essentiel' ? 'Petek Essentiel' : formule === 'psaumes' ? 'Petek & Psaumes' : 'Parcours Intégral'}</div>
            </div>

            <center>
              <a href="https://meorly.pages.dev/login" class="button">
                Se connecter maintenant
              </a>
            </center>

            <h3>📅 Prochaines étapes</h3>
            <ol>
              <li>Connectez-vous avec vos identifiants</li>
              <li>Changez votre mot de passe temporaire</li>
              <li>Découvrez votre Petek personnalisé</li>
              <li>Explorez vos Psaumes et Anges protecteurs</li>
              <li>Commencez votre parcours spirituel</li>
            </ol>

            <p>Votre parcours spirituel de 21 jours commence maintenant. 25 minutes par jour pendant 21 jours vous permettront de suivre votre rituel quotidien. Un guide sera à votre disposition via le chat pour répondre à vos questions.</p>

            <div class="footer">
              <p>© ${new Date().getFullYear()} Académie de la Lumière</p>
              <p>Cet email a été envoyé automatiquement suite à la validation de votre paiement.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailSent = await sendEmail(
      env,
      inscription.email,
      '✨ Bienvenue à l\'Académie de la Lumière - Vos identifiants',
      emailHtml
    );

    if (emailSent) {
      console.log(`✅ Email envoyé à ${inscription.email}`);
    } else {
      console.warn(`⚠️ Échec envoi email à ${inscription.email}, mais compte créé`);
    }

    return c.json({ 
      success: true, 
      message: 'Paiement validé ! Compte créé et parcours attribué avec succès.',
      user_id: userId,
      temp_password: tempPassword || 'Utilisateur existant',
      email_sent: emailSent,
      attribution: {
        petek: petek ? petek.code : 'En attente',
        psalms_count: psalms.length,
        angels_count: angels.length
      }
    });

  } catch (error) {
    console.error('Erreur validate-payment:', error);
    return c.json({ success: false, error: 'Erreur serveur' }, 500);
  }
});

// API Inscription - Créer une demande de rendez-vous
app.post('/api/inscription', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { prenom, nom, email, tel, theme, theme_autre, situation, objectifs, rdv_date_souhaitee, rdv_heure_souhaitee, rdv_notes } = body;

    // Validation
    if (!prenom || !nom || !email || !tel || !theme || !situation || !objectifs || !rdv_date_souhaitee || !rdv_heure_souhaitee) {
      return c.json({ 
        success: false, 
        error: 'Tous les champs obligatoires (*) doivent être remplis' 
      }, 400);
    }

    // Vérifier si l'email existe déjà dans inscriptions
    const existingInscription = await env.DB.prepare(
      'SELECT id FROM inscriptions WHERE email = ?'
    ).bind(email).first();

    if (existingInscription) {
      return c.json({ 
        success: false, 
        error: 'Cet email est déjà enregistré. Un guide vous contactera bientôt.' 
      }, 409);
    }

    // 1. Créer l'inscription avec status pending_appointment
    const inscriptionResult = await env.DB.prepare(`
      INSERT INTO inscriptions (prenom, nom, email, tel, objectif, status)
      VALUES (?, ?, ?, ?, ?, 'pending_appointment')
    `).bind(prenom, nom, email, tel, theme).run();

    const inscription_id = inscriptionResult.meta.last_row_id;

    // 2. Créer le manifeste
    await env.DB.prepare(`
      INSERT INTO manifestes (
        inscription_id, theme, theme_autre, content, reponses, status
      )
      VALUES (?, ?, ?, ?, ?, 'submitted')
    `).bind(
      inscription_id, 
      theme, 
      theme_autre || null,
      situation,
      JSON.stringify([
        { question: 'Situation actuelle', reponse: situation },
        { question: 'Objectifs', reponse: objectifs },
        { question: 'RDV souhaité', reponse: `${rdv_date_souhaitee} - ${rdv_heure_souhaitee}${rdv_notes ? ' - ' + rdv_notes : ''}` }
      ])
    ).run();

    return c.json({ 
      success: true,
      inscription_id,
      message: 'Demande enregistrée avec succès ! Nous vous contacterons pour confirmer votre rendez-vous gratuit.'
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    return c.json({ 
      success: false, 
      error: 'Une erreur est survenue lors de l\'enregistrement de votre demande' 
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
    // Récupérer toutes les inscriptions avec leurs données associées
    const inscriptions = await env.DB.prepare(`
      SELECT 
        i.id,
        i.prenom,
        i.nom,
        i.email,
        i.tel,
        i.status,
        i.created_at,
        m.theme,
        r.date_rdv,
        r.notes as rdv_notes
      FROM inscriptions i
      LEFT JOIN manifestes m ON i.id = m.inscription_id
      LEFT JOIN rendez_vous r ON i.id = r.client_id
      ORDER BY i.created_at DESC
    `).all();

    const results = inscriptions.results || [];

    // Compter par status
    const stats = {
      total: results.length,
      pending_appointment: results.filter(r => r.status === 'pending_appointment').length,
      contacted: results.filter(r => r.status === 'contacted').length,
      payment_pending: results.filter(r => r.status === 'payment_pending').length,
      completed: results.filter(r => r.status === 'completed').length
    };

    return c.html(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Super Admin - Académie de la Lumière</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      color: #f0f0f2;
      padding: 20px;
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #b388eb;
      margin-bottom: 8px;
    }
    .subtitle { color: #b8aec9; font-size: 14px; }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      background: #b388eb;
      color: #0a0a0f;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: opacity 0.3s;
    }
    .btn:hover { opacity: 0.9; }
    .btn-small {
      padding: 6px 12px;
      font-size: 12px;
    }
    .btn-success {
      background: #4caf50;
      color: white;
    }
    .btn-warning {
      background: #ff9800;
      color: white;
    }
    .btn-danger {
      background: #f44336;
      color: white;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 12px;
      padding: 20px;
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: #b388eb;
      margin-bottom: 4px;
    }
    .stat-label {
      color: #b8aec9;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .filters {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .filter-group label {
      font-size: 12px;
      color: #b8aec9;
      font-weight: 600;
    }
    select, input[type="text"] {
      padding: 8px 12px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 6px;
      color: #f0f0f2;
      font-size: 14px;
      font-family: inherit;
    }
    select:focus, input:focus {
      outline: none;
      border-color: #b388eb;
    }
    .table-container {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 12px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 14px;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    th {
      background: rgba(179,136,235,.15);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #b388eb;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: rgba(255,255,255,.03); }
    .status {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status-pending_appointment {
      background: rgba(255,193,7,.15);
      color: #ffc107;
    }
    .status-contacted {
      background: rgba(33,150,243,.15);
      color: #2196f3;
    }
    .status-payment_pending {
      background: rgba(255,152,0,.15);
      color: #ff9800;
    }
    .status-completed {
      background: rgba(76,175,80,.15);
      color: #4caf50;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal.active { display: flex; }
    .modal-content {
      background: #1a1a2e;
      border-radius: 16px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .modal-title {
      font-size: 24px;
      font-weight: 700;
      color: #b388eb;
    }
    .modal-close {
      background: none;
      border: none;
      color: #b8aec9;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #b8aec9;
      margin-bottom: 8px;
    }
    .form-group input,
    .form-group select {
      width: 100%;
    }
    .alert {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .alert-success {
      background: rgba(76,175,80,.15);
      color: #4caf50;
      border: 1px solid rgba(76,175,80,.3);
    }
    .alert-error {
      background: rgba(244,67,54,.15);
      color: #f44336;
      border: 1px solid rgba(244,67,54,.3);
    }
    @media (max-width: 768px) {
      table { font-size: 13px; }
      th, td { padding: 10px; }
      .stat-value { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>🛡️ Super Admin Dashboard</h1>
        <p class="subtitle">Gestion des inscriptions et validation des paiements</p>
      </div>
      <div>
        <a href="/admin/messages" class="btn" style="background: #667eea; margin-right: 10px;">💬 Messagerie</a>
        <a href="/admin/blacklist" class="btn" style="background: #e74c3c; margin-right: 10px;">🚫 Blacklist</a>
        <a href="/" class="btn">← Accueil</a>
        <a href="/login" class="btn" style="background: #4caf50;">Déconnexion</a>
      </div>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.pending_appointment}</div>
        <div class="stat-label">En attente RDV</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.contacted}</div>
        <div class="stat-label">Contactés</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.payment_pending}</div>
        <div class="stat-label">Paiement en attente</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.completed}</div>
        <div class="stat-label">Terminés</div>
      </div>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>Filtrer par status</label>
        <select id="filter-status">
          <option value="">Tous</option>
          <option value="pending_appointment">En attente RDV</option>
          <option value="contacted">Contactés</option>
          <option value="payment_pending">Paiement en attente</option>
          <option value="completed">Terminés</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Rechercher</label>
        <input type="text" id="filter-search" placeholder="Nom, email...">
      </div>
    </div>

    <div class="table-container">
      <table id="inscriptions-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Client</th>
            <th>Thèmes</th>
            <th>RDV</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr data-status="${r.status}" data-search="${r.prenom} ${r.nom} ${r.email}">
              <td>#${r.id}</td>
              <td>
                <strong>${r.prenom} ${r.nom}</strong><br>
                <span style="font-size: 12px; color: #b8aec9;">${r.email}</span><br>
                <span style="font-size: 12px; color: #b8aec9;">${r.tel || '-'}</span>
              </td>
              <td style="font-size: 13px; color: #b8aec9;">${r.theme || '-'}</td>
              <td style="font-size: 13px;">
                ${r.date_rdv ? `
                  <strong>${r.date_rdv}</strong><br>
                  <span style="font-size: 11px; color: #b8aec9;">${r.rdv_notes || ''}</span>
                ` : '-'}
              </td>
              <td><span class="status status-${r.status}">${r.status}</span></td>
              <td>
                <div class="actions">
                  ${r.status === 'pending_appointment' ? `
                    ${r.theme && r.date_rdv ? `
                      <button class="btn btn-small btn-success" onclick="markContacted(${r.id})">
                        ✅ Contacter
                      </button>
                    ` : `
                      <span style="font-size: 11px; color: #ff9800;">
                        ⏳ ${!r.theme ? 'Questionnaire manquant' : ''} ${!r.date_rdv ? 'RDV manquant' : ''}
                      </span>
                    `}
                  ` : ''}
                  ${r.status === 'contacted' ? `
                    <button class="btn btn-small btn-warning" onclick="openPaymentModal(${r.id}, '${r.prenom}', '${r.nom}')">
                      💳 Saisir paiement
                    </button>
                  ` : ''}
                  ${r.status === 'payment_pending' ? `
                    <button class="btn btn-small btn-success" onclick="validatePayment(${r.id})">
                      ✅ Valider paiement
                    </button>
                  ` : ''}
                  ${r.status === 'completed' ? `
                    <a href="/mon-parcours/${r.id}" class="btn btn-small" target="_blank">
                      👁️ Voir parcours
                    </a>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal Saisie Paiement -->
  <div id="payment-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">💳 Saisir le paiement</h2>
        <button class="modal-close" onclick="closePaymentModal()">×</button>
      </div>
      <div id="modal-alert"></div>
      <form id="payment-form">
        <input type="hidden" id="payment-inscription-id">
        <div class="form-group">
          <label>Client</label>
          <input type="text" id="payment-client-name" disabled>
        </div>
        <div class="form-group">
          <label>Formule choisie</label>
          <select id="payment-formule" required>
            <option value="">-- Sélectionner --</option>
            <option value="essentiel">Petek Essentiel - 175€</option>
            <option value="psaumes">Petek & Psaumes - 495€</option>
            <option value="integral">Parcours Intégral - 1500€</option>
          </select>
        </div>
        <div class="form-group">
          <label>Montant payé (€)</label>
          <input type="number" id="payment-amount" required min="0" step="1">
        </div>
        
        <!-- Section RIB/IBAN -->
        <div style="background: rgba(76,175,80,.1); border: 1px solid rgba(76,175,80,.3); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <label style="margin: 0; font-size: 14px; font-weight: 700; color: #4caf50;">🏦 Vos coordonnées bancaires</label>
            <button type="button" class="btn btn-small btn-success" onclick="copyRIB()">
              📋 Copier
            </button>
          </div>
          <textarea id="rib-info" style="width: 100%; min-height: 120px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.15); border-radius: 6px; padding: 12px; color: #f0f0f2; font-family: 'Courier New', monospace; font-size: 13px; resize: vertical;" placeholder="Titulaire: Académie de la Lumière&#10;IBAN: FR76 XXXX XXXX XXXX XXXX XXXX XXX&#10;BIC: XXXXXXXXX&#10;Banque: Votre Banque&#10;&#10;Référence: Inscription #ID"></textarea>
          <p style="font-size: 11px; color: #b8aec9; margin-top: 8px;">💡 Modifiez ce RIB à tout moment. Cliquez sur "Copier" pour l'envoyer au client par email.</p>
        </div>

        <div class="form-group">
          <label>Lien de paiement (optionnel)</label>
          <input type="url" id="payment-link" placeholder="https://viva.com/... ou autre">
        </div>
        <button type="submit" class="btn" style="width: 100%;">
          Enregistrer le paiement
        </button>
      </form>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    // === FONCTIONS GLOBALES ===
    
    function filterTable() {
      const statusFilter = document.getElementById('filter-status').value;
      const searchFilter = document.getElementById('filter-search').value.toLowerCase();
      const rows = document.querySelectorAll('#inscriptions-table tbody tr');

      rows.forEach(row => {
        const status = row.getAttribute('data-status');
        const searchText = row.getAttribute('data-search').toLowerCase();

        const statusMatch = !statusFilter || status === statusFilter;
        const searchMatch = !searchFilter || searchText.includes(searchFilter);

        row.style.display = (statusMatch && searchMatch) ? '' : 'none';
      });
    }

    // Marquer comme contacté
    async function markContacted(id) {
      if (!confirm("Marquer cette inscription comme contactée ?")) return;

      try {
        const response = await axios.post('/api/admin/mark-contacted', { inscription_id: id });
        if (response.data.success) {
          alert("✅ Status mis à jour !");
          location.reload();
        }
      } catch (error) {
        alert("❌ " + (error.response?.data?.error || "Erreur"));
      }
    }

    // Modal paiement
    function openPaymentModal(id, prenom, nom) {
      document.getElementById('payment-inscription-id').value = id;
      document.getElementById('payment-client-name').value = prenom + ' ' + nom;
      document.getElementById('payment-modal').classList.add('active');
    }

    function closePaymentModal() {
      document.getElementById('payment-modal').classList.remove('active');
      document.getElementById('payment-form').reset();
      document.getElementById('modal-alert').innerHTML = '';
    }

    // Valider paiement et créer compte
    async function validatePayment(id) {
      if (!confirm("Confirmer que le paiement a été reçu ? Cela va créer le compte utilisateur et attribuer le parcours.")) return;

      try {
        const response = await axios.post('/api/admin/validate-payment', { inscription_id: id });
        if (response.data.success) {
          alert("✅ Paiement validé ! Compte créé et parcours attribué.");
          location.reload();
        }
      } catch (error) {
        alert("❌ " + (error.response?.data?.error || "Erreur"));
      }
    }

    // Copier RIB dans le presse-papier
    function copyRIB() {
      const ribText = document.getElementById('rib-info').value;
      
      if (!ribText.trim()) {
        alert("⚠️ Veuillez d'abord remplir vos coordonnées bancaires");
        return;
      }

      navigator.clipboard.writeText(ribText).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = "✅ Copié !";
        btn.style.background = "#4caf50";
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = "";
        }, 2000);
      }).catch(err => {
        alert("Erreur lors de la copie. Veuillez copier manuellement.");
      });
    }

    // === INITIALISATION AU CHARGEMENT ===
    
    document.addEventListener('DOMContentLoaded', () => {
      // Charger RIB depuis localStorage
      const savedRIB = localStorage.getItem('admin_rib_info');
      if (savedRIB) {
        document.getElementById('rib-info').value = savedRIB;
      }

      // Sauvegarder RIB automatiquement lors de la modification
      const ribInput = document.getElementById('rib-info');
      if (ribInput) {
        ribInput.addEventListener('blur', () => {
          localStorage.setItem('admin_rib_info', ribInput.value);
        });
      }

      // Filtres
      document.getElementById('filter-status').addEventListener('change', filterTable);
      document.getElementById('filter-search').addEventListener('input', filterTable);

      // Soumettre paiement
      document.getElementById('payment-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
          inscription_id: parseInt(document.getElementById('payment-inscription-id').value),
          formule: document.getElementById('payment-formule').value,
          amount: parseFloat(document.getElementById('payment-amount').value),
          payment_link: document.getElementById('payment-link').value
        };

        try {
          const response = await axios.post('/api/admin/record-payment', formData);
          if (response.data.success) {
            document.getElementById('modal-alert').innerHTML = 
              "<div class=\"alert alert-success\">✅ Paiement enregistré ! Le client peut maintenant payer.</div>";
            setTimeout(() => {
              closePaymentModal();
              location.reload();
            }, 2000);
          }
        } catch (error) {
          document.getElementById('modal-alert').innerHTML = 
            "<div class=\"alert alert-error\">❌ " + (error.response?.data?.error || "Erreur") + "</div>";
        }
      });

      // Auto-complétion montant selon formule
      document.getElementById('payment-formule').addEventListener('change', (e) => {
        const amounts = {
          'essentiel': 175,
          'psaumes': 495,
          'integral': 1500
        };
        document.getElementById('payment-amount').value = amounts[e.target.value] || '';
      });
    }); // Fin DOMContentLoaded
  </script>
</body>
</html>`);

  } catch (error) {
    console.error('Erreur admin:', error);
    return c.html('<h1>Erreur lors du chargement du dashboard</h1>');
  }
})
// =============================================
// INSCRIPTION PAGE
// =============================================

// Route: Page d'inscription simplifiée

// Page Admin Messagerie
app.get('/admin/messages', async (c) => {
  const { env } = c;
  
  try {
    // ID admin (supposé être 1)
    const adminId = 1;
    
    // Récupérer toutes les conversations
    const conversations = await env.DB.prepare(`
      SELECT DISTINCT
        i.id as inscription_id,
        i.prenom,
        i.nom,
        i.email,
        u.id as user_id,
        (SELECT COUNT(*) FROM messages m2 
         WHERE m2.recipient_id = ? AND m2.sender_id = u.id AND m2.is_read = 0) AS unread_count,
        (SELECT content FROM messages m2 
         WHERE (m2.sender_id = ? AND m2.recipient_id = u.id)
            OR (m2.sender_id = u.id AND m2.recipient_id = ?)
         ORDER BY m2.created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages m2 
         WHERE (m2.sender_id = ? AND m2.recipient_id = u.id)
            OR (m2.sender_id = u.id AND m2.recipient_id = ?)
         ORDER BY m2.created_at DESC LIMIT 1) AS last_message_at
      FROM inscriptions i
      JOIN users u ON i.user_id = u.id
      WHERE i.user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM messages m
          WHERE (m.sender_id = u.id AND m.recipient_id = ?)
             OR (m.sender_id = ? AND m.recipient_id = u.id)
        )
      ORDER BY last_message_at DESC
    `).bind(adminId, adminId, adminId, adminId, adminId, adminId, adminId).all();

    const convos = conversations.results || [];

    return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Messagerie Admin - Académie de la Lumière</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, sans-serif;
      background: #0a0a0f;
      color: #f0f0f2;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    
    /* Sidebar conversations */
    .sidebar {
      width: 320px;
      background: #16213e;
      border-right: 1px solid rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .sidebar-header h2 {
      font-size: 18px;
      margin-bottom: 4px;
    }
    .sidebar-header p {
      font-size: 13px;
      opacity: 0.8;
    }
    .conversations-list {
      flex: 1;
      overflow-y: auto;
    }
    .conversation-item {
      padding: 15px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      cursor: pointer;
      transition: background 0.2s;
    }
    .conversation-item:hover {
      background: rgba(255,255,255,0.02);
    }
    .conversation-item.active {
      background: rgba(102,126,234,0.15);
      border-left: 3px solid #667eea;
    }
    .conversation-name {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .conversation-email {
      font-size: 12px;
      color: #8f88a3;
      margin-bottom: 6px;
    }
    .conversation-preview {
      font-size: 13px;
      color: #b8aec9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .unread-badge {
      background: #e74c3c;
      color: white;
      border-radius: 10px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: bold;
    }
    
    /* Chat area */
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #0a0a0f;
    }
    .chat-header {
      padding: 20px;
      background: #16213e;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .chat-header-info h3 {
      font-size: 16px;
      margin-bottom: 4px;
    }
    .chat-header-info p {
      font-size: 13px;
      color: #8f88a3;
    }
    .chat-messages {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }
    .message {
      margin-bottom: 15px;
      display: flex;
      gap: 12px;
    }
    .message.me {
      flex-direction: row-reverse;
    }
    .message-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .message-content {
      max-width: 60%;
    }
    .message-bubble {
      padding: 12px 16px;
      border-radius: 16px;
      background: rgba(255,255,255,0.08);
      font-size: 14px;
      line-height: 1.5;
    }
    .message.me .message-bubble {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .message-time {
      font-size: 11px;
      color: #8f88a3;
      margin-top: 4px;
      padding: 0 4px;
    }
    .chat-input-area {
      padding: 20px;
      background: #16213e;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .chat-input-form {
      display: flex;
      gap: 12px;
    }
    .chat-input {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 24px;
      background: #0a0a0f;
      color: white;
      font-size: 14px;
      outline: none;
    }
    .chat-input:focus {
      border-color: #667eea;
    }
    .send-button {
      padding: 12px 24px;
      border: none;
      border-radius: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .send-button:hover {
      transform: scale(1.05);
    }
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #8f88a3;
    }
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .btn-back {
      display: inline-block;
      padding: 8px 16px;
      background: rgba(255,255,255,0.1);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>💬 Messagerie</h2>
      <p>${convos.length} conversation(s)</p>
    </div>
    <div class="conversations-list" id="conversations-list">
      ${convos.length > 0 ? convos.map((convo, index) => `
        <div class="conversation-item ${index === 0 ? 'active' : ''}" 
             onclick="selectConversation(${convo.user_id}, '${convo.prenom} ${convo.nom}', '${convo.email}', ${convo.inscription_id})">
          <div class="conversation-name">
            <span>${convo.prenom} ${convo.nom}</span>
            ${convo.unread_count > 0 ? `<span class="unread-badge">${convo.unread_count}</span>` : ''}
          </div>
          <div class="conversation-email">${convo.email}</div>
          <div class="conversation-preview">${convo.last_message || 'Pas de messages'}</div>
        </div>
      `).join('') : '<div style="padding: 20px; text-align: center; color: #8f88a3;">Aucune conversation</div>'}
    </div>
    <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
      <a href="/admin" class="btn-back">← Retour au dashboard</a>
    </div>
  </div>

  <!-- Chat Area -->
  <div class="chat-area">
    ${convos.length > 0 ? `
      <div class="chat-header">
        <div class="chat-header-info">
          <h3 id="chat-user-name">${convos[0].prenom} ${convos[0].nom}</h3>
          <p id="chat-user-email">${convos[0].email}</p>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages">
        <!-- Messages chargés dynamiquement -->
      </div>
      <div class="chat-input-area">
        <form class="chat-input-form" id="chat-form">
          <input type="text" class="chat-input" id="message-input" placeholder="Tapez votre message..." required>
          <input type="hidden" id="current-user-id" value="${convos[0].user_id}">
          <input type="hidden" id="current-inscription-id" value="${convos[0].inscription_id}">
          <button type="submit" class="send-button">Envoyer →</button>
        </form>
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <p>Aucune conversation disponible</p>
        <p style="font-size: 13px; margin-top: 8px;">Les conversations apparaîtront ici quand les clients vous enverront des messages.</p>
      </div>
    `}
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    const adminId = 1;
    let currentUserId = ${convos.length > 0 ? convos[0].user_id : 'null'};
    let currentInscriptionId = ${convos.length > 0 ? convos[0].inscription_id : 'null'};

    // Charger les messages au démarrage
    if (currentUserId) {
      loadMessages(currentUserId);
      // Refresh toutes les 5 secondes
      setInterval(() => loadMessages(currentUserId), 5000);
    }

    // Sélectionner une conversation
    function selectConversation(userId, name, email, inscriptionId) {
      currentUserId = userId;
      currentInscriptionId = inscriptionId;
      
      document.getElementById('chat-user-name').textContent = name;
      document.getElementById('chat-user-email').textContent = email;
      document.getElementById('current-user-id').value = userId;
      document.getElementById('current-inscription-id').value = inscriptionId;
      
      // Mise à jour UI active
      document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
      });
      event.currentTarget.classList.add('active');
      
      loadMessages(userId);
    }

    // Charger les messages
    async function loadMessages(userId) {
      try {
        const response = await axios.get(\`/api/messages/conversation/\${adminId}/\${userId}\`);
        
        if (response.data.success) {
          const messagesDiv = document.getElementById('chat-messages');
          messagesDiv.innerHTML = '';
          
          response.data.messages.forEach(msg => {
            addMessageToUI(msg.sender_id === adminId, msg.content, msg.created_at);
          });
          
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
          
          // Marquer comme lus
          await axios.post('/api/messages/mark-read', {
            user_id: adminId,
            sender_id: userId
          });
        }
      } catch (error) {
        console.error('Erreur chargement:', error);
      }
    }

    // Ajouter un message à l'UI
    function addMessageToUI(isMe, content, timestamp) {
      const messagesDiv = document.getElementById('chat-messages');
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message' + (isMe ? ' me' : '');
      
      const time = new Date(timestamp).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      messageDiv.innerHTML = \`
        <div class="message-avatar">\${isMe ? '👤' : '🧑'}</div>
        <div class="message-content">
          <div class="message-bubble">\${content}</div>
          <div class="message-time">\${time}</div>
        </div>
      \`;
      
      messagesDiv.appendChild(messageDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Envoyer un message
    document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const input = document.getElementById('message-input');
      const content = input.value.trim();
      
      if (!content || !currentUserId) return;
      
      try {
        const response = await axios.post('/api/messages/send', {
          sender_id: adminId,
          recipient_id: currentUserId,
          inscription_id: currentInscriptionId,
          content: content
        });
        
        if (response.data.success) {
          addMessageToUI(true, content, new Date().toISOString());
          input.value = '';
        }
      } catch (error) {
        console.error('Erreur envoi:', error);
        alert('Erreur lors de l\\'envoi');
      }
    });
  </script>
</body>
</html>`);

  } catch (error) {
    console.error('Erreur admin messages:', error);
    return c.text('Erreur serveur', 500);
  }
});

// Page Admin Blacklist
app.get('/admin/blacklist', async (c) => {
  const { env } = c;
  
  try {
    // Récupérer toute la blacklist
    const blacklist = await env.DB.prepare(`
      SELECT 
        b.id,
        b.email,
        b.tel,
        b.raison,
        b.created_at,
        u.email as admin_email
      FROM blacklist b
      LEFT JOIN users u ON b.blacklisted_by = u.id
      ORDER BY b.created_at DESC
    `).all();

    const entries = blacklist.results || [];

    return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gestion Blacklist - Académie de la Lumière</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, sans-serif;
      background: #0a0a0f;
      color: #f0f0f2;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .header h1 {
      font-size: 28px;
      color: #b388eb;
    }
    .header .subtitle {
      color: #8f88a3;
      font-size: 14px;
      margin-top: 4px;
    }
    
    .btn {
      display: inline-block;
      padding: 10px 20px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      border: none;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .btn:hover { transform: scale(1.05); }
    .btn-danger {
      background: #e74c3c;
      padding: 6px 12px;
      font-size: 13px;
    }
    .btn-success {
      background: #27ae60;
    }
    
    .add-section {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 30px;
    }
    .add-section h2 {
      font-size: 18px;
      margin-bottom: 20px;
      color: #b388eb;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      margin-bottom: 6px;
      color: #b8aec9;
      font-size: 14px;
    }
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 10px 14px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      color: white;
      font-size: 14px;
    }
    .form-group textarea {
      min-height: 80px;
      resize: vertical;
    }
    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: 600;
      color: #b388eb;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 14px;
      color: #8f88a3;
    }
    
    .blacklist-table {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      overflow: hidden;
    }
    .blacklist-table h2 {
      padding: 20px;
      background: rgba(255,255,255,0.03);
      font-size: 18px;
      color: #b388eb;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: rgba(255,255,255,0.03);
      padding: 12px 16px;
      text-align: left;
      font-size: 13px;
      color: #b8aec9;
      font-weight: 600;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    td {
      padding: 14px 16px;
      font-size: 14px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    tr:hover {
      background: rgba(255,255,255,0.02);
    }
    .empty-state {
      padding: 60px 20px;
      text-align: center;
      color: #8f88a3;
    }
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    
    .message {
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      display: none;
    }
    .message.success {
      background: rgba(39, 174, 96, 0.2);
      border: 1px solid #27ae60;
      color: #2ecc71;
    }
    .message.error {
      background: rgba(231, 76, 60, 0.2);
      border: 1px solid #e74c3c;
      color: #e74c3c;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>🚫 Gestion de la Blacklist</h1>
        <p class="subtitle">Bloquer et débloquer des emails/téléphones</p>
      </div>
      <div>
        <a href="/admin" class="btn">← Retour Dashboard</a>
      </div>
    </div>

    <div id="message" class="message"></div>

    <!-- Stats -->
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${entries.length}</div>
        <div class="stat-label">Total blacklistés</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${entries.filter(e => e.email).length}</div>
        <div class="stat-label">Emails bloqués</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${entries.filter(e => e.tel).length}</div>
        <div class="stat-label">Téléphones bloqués</div>
      </div>
    </div>

    <!-- Formulaire d'ajout -->
    <div class="add-section">
      <h2>➕ Ajouter à la blacklist</h2>
      <form id="add-form">
        <div class="form-row">
          <div class="form-group">
            <label>Email à bloquer</label>
            <input type="email" name="email" id="email" placeholder="exemple@email.com">
          </div>
          <div class="form-group">
            <label>Téléphone à bloquer</label>
            <input type="tel" name="tel" id="tel" placeholder="+33612345678">
          </div>
        </div>
        <div class="form-group">
          <label>Raison du blocage *</label>
          <textarea name="raison" id="raison" required placeholder="Ex: Spam répété, comportement inapproprié, tentative de fraude..."></textarea>
        </div>
        <p style="font-size: 13px; color: #8f88a3; margin-bottom: 12px;">
          ⚠️ Au moins un email OU un téléphone doit être renseigné
        </p>
        <button type="submit" class="btn btn-success">Ajouter à la blacklist</button>
      </form>
    </div>

    <!-- Liste blacklist -->
    <div class="blacklist-table">
      <h2>📋 Liste des entrées blacklistées</h2>
      ${entries.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Raison</th>
              <th>Ajouté par</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="blacklist-tbody">
            ${entries.map(entry => {
              const date = new Date(entry.created_at).toLocaleDateString('fr-FR');
              return `
                <tr data-id="${entry.id}">
                  <td><strong>#${entry.id}</strong></td>
                  <td>${entry.email || '<span style="color: #8f88a3;">—</span>'}</td>
                  <td>${entry.tel || '<span style="color: #8f88a3;">—</span>'}</td>
                  <td style="max-width: 300px;">${entry.raison}</td>
                  <td>${entry.admin_email || '<span style="color: #8f88a3;">Inconnu</span>'}</td>
                  <td>${date}</td>
                  <td>
                    <button onclick="removeFromBlacklist(${entry.id})" class="btn btn-danger">
                      🗑️ Retirer
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <p>Aucune entrée dans la blacklist</p>
          <p style="font-size: 13px; margin-top: 8px;">Utilisez le formulaire ci-dessus pour ajouter des emails ou téléphones à bloquer.</p>
        </div>
      `}
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    const adminId = 1; // TODO: récupérer du session

    // Afficher message
    function showMessage(text, type) {
      const messageDiv = document.getElementById('message');
      messageDiv.textContent = text;
      messageDiv.className = 'message ' + type;
      messageDiv.style.display = 'block';
      
      setTimeout(() => {
        messageDiv.style.display = 'none';
      }, 5000);
    }

    // Ajouter à la blacklist
    document.getElementById('add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      const tel = document.getElementById('tel').value.trim();
      const raison = document.getElementById('raison').value.trim();
      
      if (!email && !tel) {
        showMessage('Veuillez renseigner au moins un email ou un téléphone', 'error');
        return;
      }
      
      if (!raison) {
        showMessage('La raison est obligatoire', 'error');
        return;
      }
      
      try {
        const response = await axios.post('/api/admin/blacklist/add', {
          email: email || null,
          tel: tel || null,
          raison: raison,
          admin_id: adminId
        });
        
        if (response.data.success) {
          showMessage('✅ Ajouté à la blacklist avec succès !', 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          showMessage('❌ ' + response.data.error, 'error');
        }
      } catch (error) {
        console.error('Erreur:', error);
        showMessage('❌ Erreur lors de l\'ajout', 'error');
      }
    });

    // Retirer de la blacklist
    async function removeFromBlacklist(id) {
      if (!confirm('Êtes-vous sûr de vouloir retirer cette entrée de la blacklist ?')) {
        return;
      }
      
      try {
        const response = await axios.delete(\`/api/admin/blacklist/remove/\${id}\`);
        
        if (response.data.success) {
          showMessage('✅ Retiré de la blacklist avec succès !', 'success');
          // Retirer la ligne du tableau
          document.querySelector(\`tr[data-id="\${id}"]\`).remove();
          
          // Recharger après 1 seconde pour update les stats
          setTimeout(() => location.reload(), 1000);
        } else {
          showMessage('❌ ' + response.data.error, 'error');
        }
      } catch (error) {
        console.error('Erreur:', error);
        showMessage('❌ Erreur lors de la suppression', 'error');
      }
    }
  </script>
</body>
</html>`);

  } catch (error) {
    console.error('Erreur admin blacklist:', error);
    return c.text('Erreur serveur', 500);
  }
});


app.get('/inscription', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inscription - Académie de la Lumière</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 12px;
      text-align: center;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 40px;
      font-size: 16px;
    }
    .form-group {
      margin-bottom: 24px;
    }
    label {
      display: block;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #4a90e2;
    }
    .required { color: #e74c3c; }
    .btn {
      width: 100%;
      padding: 16px;
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.3s;
    }
    .btn:hover { background: #357abd; }
    .btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .message {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: none;
    }
    .message.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .message.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .back-link {
      text-align: center;
      margin-top: 24px;
    }
    .back-link a {
      color: #4a90e2;
      text-decoration: none;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✨ Inscription gratuite</h1>
    <p class="subtitle">Commencez votre parcours spirituel personnalisé</p>

    <div id="message" class="message"></div>

    <form id="inscription-form">
      <div class="form-group">
        <label>Prénom <span class="required">*</span></label>
        <input type="text" name="prenom" required placeholder="Votre prénom">
      </div>

      <div class="form-group">
        <label>Nom <span class="required">*</span></label>
        <input type="text" name="nom" required placeholder="Votre nom">
      </div>

      <div class="form-group">
        <label>Email <span class="required">*</span></label>
        <input type="email" name="email" required placeholder="votre@email.com">
      </div>

      <div class="form-group">
        <label>Téléphone <span class="required">*</span></label>
        <input type="tel" name="tel" required placeholder="+33 6 12 34 56 78">
      </div>

      <button type="submit" class="btn" id="submit-btn">Continuer →</button>
    </form>

    <div class="back-link">
      <a href="/">← Retour à l'accueil</a>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    const form = document.getElementById('inscription-form');
    const message = document.getElementById('message');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = {
        prenom: formData.get('prenom'),
        nom: formData.get('nom'),
        email: formData.get('email'),
        tel: formData.get('tel')
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Vérification...';

      try {
        const response = await axios.post('/api/inscription-step1', data);
        
        if (response.data.success) {
          message.className = 'message success';
          message.style.display = 'block';
          message.textContent = '✅ ' + response.data.message;
          
          // Redirection vers questionnaire
          setTimeout(() => {
            window.location.href = '/questionnaire/' + response.data.inscription_id;
          }, 1500);
        }
      } catch (error) {
        message.className = 'message error';
        message.style.display = 'block';
        
        if (error.response?.status === 403) {
          message.textContent = '❌ Cette inscription ne peut pas être effectuée.';
        } else if (error.response?.status === 409) {
          message.textContent = '❌ Cet email est déjà inscrit.';
        } else {
          message.textContent = '❌ ' + (error.response?.data?.error || 'Erreur lors de l\\'inscription');
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continuer →';
      }
    });
  </script>
</body>
</html>`)
})

// =============================================
// QUESTIONNAIRE PAGE
// =============================================

// Route: Questionnaire avec choix de thèmes et questions dynamiques
app.get('/questionnaire/:id', async (c) => {
  const { env } = c;
  const inscriptionId = c.req.param('id');

  try {
    // Récupérer l'inscription
    const inscription = await env.DB.prepare(`
      SELECT id, prenom, nom, email, status 
      FROM inscriptions 
      WHERE id = ?
    `).bind(inscriptionId).first();

    if (!inscription) {
      return c.html('<h1>Inscription introuvable</h1>');
    }

    if (inscription.status !== 'pending_appointment') {
      return c.html('<h1>Ce questionnaire a déjà été complété</h1>');
    }

    return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Questionnaire - Académie de la Lumière</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 800px;
      margin: 0 auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 12px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 40px;
      font-size: 16px;
    }
    .step {
      margin-bottom: 40px;
      padding: 24px;
      background: #f8f9fa;
      border-radius: 12px;
      border-left: 4px solid #4a90e2;
    }
    .step.hidden { display: none; }
    .step-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    .step-description {
      color: #666;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .themes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }
    .theme-option {
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      background: white;
    }
    .theme-option:hover {
      border-color: #4a90e2;
      background: #f0f8ff;
    }
    .theme-option.selected {
      border-color: #4a90e2;
      background: #e3f2fd;
    }
    .theme-option input[type="checkbox"] {
      margin-right: 12px;
      width: 20px;
      height: 20px;
      cursor: pointer;
    }
    .theme-option label {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .theme-icon {
      font-size: 24px;
      margin-right: 12px;
    }
    .question-group {
      margin-bottom: 24px;
    }
    .question-label {
      display: block;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
      font-size: 16px;
    }
    textarea {
      width: 100%;
      padding: 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      resize: vertical;
      min-height: 100px;
      transition: border-color 0.3s;
    }
    textarea:focus {
      outline: none;
      border-color: #4a90e2;
    }
    .btn {
      padding: 16px 32px;
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.3s;
    }
    .btn:hover { background: #357abd; }
    .btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: #6c757d;
    }
    .btn-secondary:hover { background: #5a6268; }
    .message {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: none;
    }
    .message.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .button-group {
      display: flex;
      gap: 16px;
      margin-top: 32px;
    }
    .counter {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 Votre Questionnaire Spirituel</h1>
    <p class="subtitle">Bonjour <strong>${inscription.prenom}</strong>, répondez à quelques questions pour personnaliser votre parcours</p>

    <div id="message" class="message"></div>

    <form id="questionnaire-form">
      <!-- Étape 1 : Choix des thèmes -->
      <div class="step" id="step1">
        <div class="step-title">Étape 1 : Choisissez vos thèmes spirituels</div>
        <p class="step-description">Sélectionnez 1 ou 2 thèmes qui correspondent à vos besoins actuels</p>
        
        <div class="themes-grid">
          <div class="theme-option" data-theme="paix">
            <label>
              <input type="checkbox" name="themes" value="paix">
              <span class="theme-icon">🕊️</span>
              <span>Paix intérieure</span>
            </label>
          </div>
          
          <div class="theme-option" data-theme="amour">
            <label>
              <input type="checkbox" name="themes" value="amour">
              <span class="theme-icon">💝</span>
              <span>Amour & Relations</span>
            </label>
          </div>
          
          <div class="theme-option" data-theme="reussite">
            <label>
              <input type="checkbox" name="themes" value="reussite">
              <span class="theme-icon">🌟</span>
              <span>Réussite & Abondance</span>
            </label>
          </div>
          
          <div class="theme-option" data-theme="sante">
            <label>
              <input type="checkbox" name="themes" value="sante">
              <span class="theme-icon">💚</span>
              <span>Santé & Vitalité</span>
            </label>
          </div>
          
          <div class="theme-option" data-theme="protection">
            <label>
              <input type="checkbox" name="themes" value="protection">
              <span class="theme-icon">🛡️</span>
              <span>Protection & Sécurité</span>
            </label>
          </div>
          
          <div class="theme-option" data-theme="sagesse">
            <label>
              <input type="checkbox" name="themes" value="sagesse">
              <span class="theme-icon">🔮</span>
              <span>Sagesse & Clarté</span>
            </label>
          </div>
        </div>
        
        <p class="counter" id="theme-counter">0 thème(s) sélectionné(s) (maximum 2)</p>
        
        <div class="button-group">
          <button type="button" class="btn" id="next-step" disabled>Continuer →</button>
        </div>
      </div>

      <!-- Étape 2 : Questions dynamiques -->
      <div class="step hidden" id="step2">
        <div class="step-title">Étape 2 : Parlez-nous de vous</div>
        <p class="step-description">Ces réponses nous aideront à personnaliser votre parcours spirituel</p>
        
        <div id="questions-container"></div>
        
        <div class="button-group">
          <button type="button" class="btn btn-secondary" id="prev-step">← Retour</button>
          <button type="submit" class="btn" id="submit-btn">Valider mon questionnaire</button>
        </div>
      </div>
    </form>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    const inscriptionId = ${inscriptionId};
    const form = document.getElementById('questionnaire-form');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const message = document.getElementById('message');
    const themeCounter = document.getElementById('theme-counter');
    const questionsContainer = document.getElementById('questions-container');
    const nextBtn = document.getElementById('next-step');
    const prevBtn = document.getElementById('prev-step');
    const submitBtn = document.getElementById('submit-btn');

    // Questions par thème
    const themeQuestions = {
      paix: {
        icon: "🕊️",
        title: "Paix intérieure",
        question: "Qu'est-ce qui perturbe votre paix intérieure actuellement ? Décrivez votre situation."
      },
      amour: {
        icon: "💝",
        title: "Amour & Relations",
        question: "Quelle relation souhaitez-vous améliorer ? (couple, famille, amitié...)"
      },
      reussite: {
        icon: "🌟",
        title: "Réussite & Abondance",
        question: "Quel projet ou objectif est important pour vous en ce moment ?"
      },
      sante: {
        icon: "💚",
        title: "Santé & Vitalité",
        question: "Comment vous sentez-vous physiquement et émotionnellement ? Quels défis rencontrez-vous ?"
      },
      protection: {
        icon: "🛡️",
        title: "Protection & Sécurité",
        question: "De quoi souhaitez-vous être protégé(e) ? Qu'est-ce qui vous inquiète ?"
      },
      sagesse: {
        icon: "🔮",
        title: "Sagesse & Clarté",
        question: "Quelle décision ou choix vous préoccupe actuellement ?"
      }
    };

    // Gestion des checkboxes
    const checkboxes = document.querySelectorAll('input[name="themes"]');
    const themeOptions = document.querySelectorAll('.theme-option');

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const selected = document.querySelectorAll('input[name="themes"]:checked');
        
        // Limite à 2 thèmes
        if (selected.length > 2) {
          checkbox.checked = false;
          return;
        }

        // Update visual
        const parent = checkbox.closest('.theme-option');
        if (checkbox.checked) {
          parent.classList.add('selected');
        } else {
          parent.classList.remove('selected');
        }

        // Update counter
        themeCounter.textContent = selected.length + " thème(s) sélectionné(s) (maximum 2)";
        
        // Enable/disable button
        nextBtn.disabled = selected.length === 0;
      });
    });

    // Passer à l'étape 2
    nextBtn.addEventListener('click', () => {
      const selectedThemes = Array.from(document.querySelectorAll('input[name="themes"]:checked'))
        .map(cb => cb.value);

      // Générer les questions dynamiques
      questionsContainer.innerHTML = selectedThemes.map(theme => {
        const q = themeQuestions[theme];
        return '<div class="question-group">' +
          '<label class="question-label">' +
            '<span class="theme-icon">' + q.icon + '</span>' +
            q.title + ' : ' + q.question +
          '</label>' +
          '<textarea name="question_' + theme + '" required placeholder="Partagez votre expérience..."></textarea>' +
        '</div>';
      }).join('');

      step1.classList.add('hidden');
      step2.classList.remove('hidden');
    });

    // Retour à l'étape 1
    prevBtn.addEventListener('click', () => {
      step2.classList.add('hidden');
      step1.classList.remove('hidden');
    });

    // Soumettre le questionnaire
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const selectedThemes = Array.from(document.querySelectorAll('input[name="themes"]:checked'))
        .map(cb => cb.value);

      const responses = {};
      selectedThemes.forEach(theme => {
        const textarea = document.querySelector('textarea[name="question_' + theme + '"]');
        responses[theme] = textarea.value;
      });

      submitBtn.disabled = true;
      submitBtn.textContent = "Enregistrement...";

      try {
        const response = await axios.post('/api/questionnaire', {
          inscription_id: inscriptionId,
          themes: selectedThemes,
          responses: responses
        });

        if (response.data.success) {
          // Redirection vers page RDV
          window.location.href = '/rdv/' + inscriptionId;
        }
      } catch (error) {
        message.className = "message error";
        message.style.display = "block";
        message.textContent = "❌ " + (error.response?.data?.error || "Erreur lors de l'enregistrement");
        
        submitBtn.disabled = false;
        submitBtn.textContent = "Valider mon questionnaire";
      }
    });
  </script>
</body>
</html>`);

  } catch (error) {
    console.error('Erreur questionnaire:', error);
    return c.html('<h1>Erreur lors du chargement du questionnaire</h1>');
  }
});

// =============================================
// RDV PAGE
// =============================================

// Route: Prise de rendez-vous
app.get('/rdv/:id', async (c) => {
  const { env } = c;
  const inscriptionId = c.req.param('id');

  try {
    // Récupérer inscription + manifeste
    const inscription = await env.DB.prepare(`
      SELECT i.id, i.prenom, i.nom, i.email, i.status,
             m.theme
      FROM inscriptions i
      LEFT JOIN manifestes m ON i.id = m.inscription_id
      WHERE i.id = ?
    `).bind(inscriptionId).first();

    if (!inscription) {
      return c.html('<h1>Inscription introuvable</h1>');
    }

    if (inscription.status !== 'pending_appointment') {
      return c.html('<h1>Vous avez déjà confirmé votre rendez-vous</h1>');
    }

    // Générer les dates disponibles (3 prochains jours ouvrés)
    const today = new Date();
    const availableDates = [];
    let daysAdded = 0;
    let currentDate = new Date(today);
    
    while (daysAdded < 5) {
      currentDate.setDate(currentDate.getDate() + 1);
      const dayOfWeek = currentDate.getDay();
      
      // Exclure samedi (6) et dimanche (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        availableDates.push({
          date: currentDate.toISOString().split('T')[0],
          label: currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        });
        daysAdded++;
      }
    }

    return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prise de Rendez-vous - Académie de la Lumière</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 700px;
      margin: 0 auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 12px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 32px;
      font-size: 16px;
    }
    .info-box {
      background: #f0f8ff;
      border-left: 4px solid #4a90e2;
      padding: 20px;
      margin-bottom: 32px;
      border-radius: 8px;
    }
    .info-box h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    .info-box p {
      color: #555;
      line-height: 1.6;
    }
    .form-group {
      margin-bottom: 28px;
    }
    label {
      display: block;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      font-size: 16px;
    }
    .required { color: #e74c3c; }
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .radio-option {
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      background: white;
      display: flex;
      align-items: center;
    }
    .radio-option:hover {
      border-color: #4a90e2;
      background: #f0f8ff;
    }
    .radio-option input[type="radio"] {
      margin-right: 12px;
      width: 20px;
      height: 20px;
      cursor: pointer;
    }
    .radio-option.selected {
      border-color: #4a90e2;
      background: #e3f2fd;
    }
    .slot-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
    .slot-option {
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 14px;
      font-weight: 500;
    }
    .slot-option:hover {
      border-color: #4a90e2;
      background: #f0f8ff;
    }
    .slot-option input[type="radio"] {
      display: none;
    }
    .slot-option.selected {
      border-color: #4a90e2;
      background: #4a90e2;
      color: white;
    }
    textarea {
      width: 100%;
      padding: 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      resize: vertical;
      min-height: 100px;
    }
    textarea:focus {
      outline: none;
      border-color: #4a90e2;
    }
    .btn {
      width: 100%;
      padding: 16px;
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.3s;
    }
    .btn:hover { background: #357abd; }
    .btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .message {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: none;
    }
    .message.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .hint {
      font-size: 13px;
      color: #666;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📅 Confirmez votre rendez-vous gratuit</h1>
    <p class="subtitle">Bonjour <strong>${inscription.prenom}</strong>, choisissez le créneau qui vous convient le mieux</p>

    <div class="info-box">
      <h3>Vos thèmes spirituels sélectionnés</h3>
      <p>${inscription.theme || 'Aucun thème'}</p>
    </div>

    <div id="message" class="message"></div>

    <form id="rdv-form">
      <div class="form-group">
        <label>Choisissez une date <span class="required">*</span></label>
        <div class="radio-group" id="dates-container">
          ${availableDates.map((d, i) => `
            <div class="radio-option" data-date="${d.date}">
              <input type="radio" name="date" value="${d.date}" id="date${i}" ${i === 0 ? 'checked' : ''} required>
              <label for="date${i}" style="cursor:pointer;margin:0;font-weight:normal;">${d.label}</label>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label>Choisissez un créneau horaire <span class="required">*</span></label>
        <div class="slot-grid">
          <div class="slot-option selected" data-slot="matin">
            <input type="radio" name="slot" value="matin" id="slot-matin" checked required>
            <label for="slot-matin" style="cursor:pointer;margin:0;">🌅 Matin<br><span style="font-size:12px;">9h-12h</span></label>
          </div>
          <div class="slot-option" data-slot="apres-midi">
            <input type="radio" name="slot" value="apres-midi" id="slot-apres-midi" required>
            <label for="slot-apres-midi" style="cursor:pointer;margin:0;">☀️ Après-midi<br><span style="font-size:12px;">14h-17h</span></label>
          </div>
          <div class="slot-option" data-slot="soir">
            <input type="radio" name="slot" value="soir" id="slot-soir" required>
            <label for="slot-soir" style="cursor:pointer;margin:0;">🌙 Soir<br><span style="font-size:12px;">18h-20h</span></label>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>Remarques ou préférences (optionnel)</label>
        <textarea name="remarques" placeholder="Avez-vous des préférences d'horaire précises ou des informations à partager ?"></textarea>
        <p class="hint">Nous ferons de notre mieux pour respecter vos préférences</p>
      </div>

      <button type="submit" class="btn" id="submit-btn">Confirmer mon rendez-vous gratuit</button>
    </form>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    const inscriptionId = ${inscriptionId};
    const form = document.getElementById('rdv-form');
    const message = document.getElementById('message');
    const submitBtn = document.getElementById('submit-btn');

    // Gestion des radio options pour dates
    const dateOptions = document.querySelectorAll('.radio-option');
    dateOptions.forEach(option => {
      option.addEventListener('click', () => {
        const radio = option.querySelector('input[type="radio"]');
        radio.checked = true;
        
        dateOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
      });
    });

    // Gestion des slots horaires
    const slotOptions = document.querySelectorAll('.slot-option');
    slotOptions.forEach(option => {
      option.addEventListener('click', () => {
        const radio = option.querySelector('input[type="radio"]');
        radio.checked = true;
        
        slotOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
      });
    });

    // Soumettre le RDV
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const data = {
        inscription_id: inscriptionId,
        date: formData.get('date'),
        slot: formData.get('slot'),
        remarques: formData.get('remarques')
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Confirmation en cours...';

      try {
        const response = await axios.post('/api/rdv', data);

        if (response.data.success) {
          // Redirection vers page de confirmation
          window.location.href = '/confirmation/' + inscriptionId;
        }
      } catch (error) {
        message.className = 'message error';
        message.style.display = 'block';
        message.textContent = '❌ ' + (error.response?.data?.error || 'Erreur lors de la confirmation');
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirmer mon rendez-vous gratuit';
      }
    });
  </script>
</body>
</html>`);

  } catch (error) {
    console.error('Erreur RDV page:', error);
    return c.html('<h1>Erreur lors du chargement de la page</h1>');
  }
});

// =============================================
// CONFIRMATION PAGE
// =============================================

// Route: Page de confirmation après RDV
app.get('/confirmation/:id', async (c) => {
  const { env } = c;
  const inscriptionId = c.req.param('id');

  try {
    const inscription = await env.DB.prepare(`
      SELECT i.prenom, i.nom, i.email,
             r.date_rdv, r.notes
      FROM inscriptions i
      LEFT JOIN rendez_vous r ON i.id = r.client_id
      WHERE i.id = ?
      ORDER BY r.created_at DESC
      LIMIT 1
    `).bind(inscriptionId).first();

    if (!inscription) {
      return c.html('<h1>Inscription introuvable</h1>');
    }

    return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation - Académie de la Lumière</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .success-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 16px;
    }
    .message {
      color: #555;
      font-size: 18px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .info-box {
      background: #f0f8ff;
      border-left: 4px solid #4a90e2;
      padding: 24px;
      margin-bottom: 32px;
      border-radius: 8px;
      text-align: left;
    }
    .info-box h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 16px;
    }
    .info-box p {
      color: #555;
      line-height: 1.8;
      margin-bottom: 12px;
    }
    .info-box strong {
      color: #1a1a2e;
    }
    .btn {
      display: inline-block;
      padding: 16px 32px;
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.3s;
    }
    .btn:hover { background: #357abd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Rendez-vous confirmé !</h1>
    <p class="message">
      Merci <strong>${inscription.prenom}</strong> ! Votre demande de rendez-vous a été enregistrée avec succès.
    </p>

    <div class="info-box">
      <h3>📧 Email de confirmation envoyé</h3>
      <p>
        Un email de confirmation a été envoyé à <strong>${inscription.email}</strong>
      </p>
      <p>
        <strong>Prochaines étapes :</strong><br>
        • Un de nos guides va vous contacter dans les 24-48h<br>
        • Vous recevrez la confirmation de l'horaire exact<br>
        • Le premier entretien dure 45 minutes et est totalement gratuit
      </p>
    </div>

    <a href="/" class="btn">Retour à l'accueil</a>
  </div>
</body>
</html>`);

  } catch (error) {
    console.error('Erreur confirmation page:', error);
    return c.html('<h1>Erreur lors du chargement de la confirmation</h1>');
  }
});

// =============================================
// AUTH PAGES
// =============================================

// Route: Page de connexion
app.get('/login', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connexion - Académie de la Lumière</title>
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
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { max-width: 450px; width: 100%; }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 40px;
      margin-bottom: 10px;
    }
    .header h1 {
      font-size: 28px;
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
    
    input {
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
    input:focus {
      outline: none;
      border-color: var(--accent);
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
    
    .error-message {
      display: none;
      padding: 12px;
      background: rgba(244,67,54,.1);
      border: 1px solid #f44336;
      border-radius: 8px;
      color: #f44336;
      margin-top: 15px;
      font-size: 14px;
    }
    .error-message.show { display: block; }
    
    .back-link {
      text-align: center;
      margin-top: 20px;
    }
    .back-link a {
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
    }
    .back-link a:hover {
      color: var(--accent);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">✦</div>
      <h1>Connexion</h1>
      <div class="subtitle">Académie de la Lumière</div>
    </div>

    <div class="form-box">
      <form id="login-form">
        <div>
          <label for="email">Email</label>
          <input type="email" id="email" required placeholder="votre@email.com" autocomplete="email">
        </div>

        <div>
          <label for="password">Mot de passe</label>
          <input type="password" id="password" required placeholder="••••••••" autocomplete="current-password">
        </div>

        <button type="submit" class="btn" id="submit-btn">
          Se connecter
        </button>

        <div id="error-message" class="error-message"></div>
      </form>
    </div>

    <div class="back-link">
      <a href="/">← Retour à l'accueil</a>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('submit-btn');
      const errorMsg = document.getElementById('error-message');
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Connexion...';
      errorMsg.classList.remove('show');
      
      const formData = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      };

      try {
        const response = await axios.post('/api/auth/login', formData);
        
        if (response.data.success) {
          // Stocker le token
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          
          // Rediriger selon le rôle
          const role = response.data.user.role;
          if (role === 'super_admin') {
            window.location.href = '/admin/dashboard';
          } else if (role === 'guide') {
            window.location.href = '/guide/dashboard';
          } else {
            window.location.href = '/client/dashboard';
          }
        }
      } catch (error) {
        console.error('Erreur:', error);
        errorMsg.textContent = error.response?.data?.error || 'Erreur lors de la connexion';
        errorMsg.classList.add('show');
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Se connecter';
      }
    });
  </script>
</body>
</html>`)
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

  <!-- Chat Widget Flottant -->
  <div id="chat-widget" style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
    <!-- Bouton chat -->
    <button id="chat-button" onclick="toggleChat()" style="
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.2s;
      position: relative;
    ">
      💬
      <span id="unread-badge" style="
        position: absolute;
        top: -5px;
        right: -5px;
        background: #e74c3c;
        color: white;
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 11px;
        font-weight: bold;
        display: none;
      ">0</span>
    </button>

    <!-- Fenêtre de chat -->
    <div id="chat-window" style="
      display: none;
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 350px;
      max-height: 500px;
      background: #1a1a2e;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.1);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    ">
      <!-- En-tête -->
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 15px;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div>
          <div style="font-weight: 600;">💬 Chat avec votre guide</div>
          <div style="font-size: 12px; opacity: 0.8;">En ligne</div>
        </div>
        <button onclick="toggleChat()" style="
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
        ">×</button>
      </div>

      <!-- Messages -->
      <div id="chat-messages" style="
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        background: #16213e;
        max-height: 350px;
      ">
        <div style="text-align: center; color: #8f88a3; font-size: 13px; margin-bottom: 15px;">
          Début de la conversation
        </div>
      </div>

      <!-- Zone de saisie -->
      <div style="padding: 15px; background: #1a1a2e; border-top: 1px solid rgba(255,255,255,0.1);">
        <form id="chat-form" style="display: flex; gap: 8px;">
          <input 
            type="text" 
            id="chat-input" 
            placeholder="Votre message..."
            style="
              flex: 1;
              padding: 10px;
              border: 1px solid rgba(255,255,255,0.2);
              border-radius: 8px;
              background: #0f1422;
              color: white;
              font-size: 14px;
            "
            required
          />
          <button type="submit" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
          ">➤</button>
        </form>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    const inscriptionId = ${inscription_id};
    const userId = ${inscription.user_id || 'null'};
    let chatOpen = false;
    let eventSource = null;

    function toggleChat() {
      chatOpen = !chatOpen;
      const chatWindow = document.getElementById('chat-window');
      chatWindow.style.display = chatOpen ? 'flex' : 'none';
      
      if (chatOpen) {
        loadMessages();
        connectSSE();
      } else {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      }
    }

    // Charger l'historique des messages
    async function loadMessages() {
      if (!userId) return;
      
      try {
        // Récupérer le guide assigné (on suppose qu'il y a un guide par défaut ID=1)
        const guideId = 1; // TODO: récupérer le vrai guide_id depuis inscription
        
        const response = await axios.get(\`/api/messages/conversation/\${userId}/\${guideId}\`);
        
        if (response.data.success) {
          const messagesDiv = document.getElementById('chat-messages');
          messagesDiv.innerHTML = '<div style="text-align: center; color: #8f88a3; font-size: 13px; margin-bottom: 15px;">Début de la conversation</div>';
          
          response.data.messages.forEach(msg => {
            addMessageToUI(msg.content, msg.sender_id === userId, msg.created_at);
          });
          
          // Scroll to bottom
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
          
          // Marquer messages comme lus
          if (response.data.messages.length > 0) {
            await axios.post('/api/messages/mark-read', {
              user_id: userId,
              sender_id: guideId
            });
            updateUnreadBadge(0);
          }
        }
      } catch (error) {
        console.error('Erreur chargement messages:', error);
      }
    }

    // Ajouter un message à l'UI
    function addMessageToUI(content, isMe, timestamp) {
      const messagesDiv = document.getElementById('chat-messages');
      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = \`
        margin-bottom: 12px;
        display: flex;
        justify-content: \${isMe ? 'flex-end' : 'flex-start'};
      \`;
      
      const bubble = document.createElement('div');
      bubble.style.cssText = \`
        max-width: 70%;
        padding: 10px 14px;
        border-radius: 12px;
        background: \${isMe ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.08)'};
        color: white;
        font-size: 14px;
        word-wrap: break-word;
      \`;
      bubble.textContent = content;
      
      messageDiv.appendChild(bubble);
      messagesDiv.appendChild(messageDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Envoyer un message
    document.getElementById('chat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!userId) {
        alert('Vous devez être connecté pour envoyer des messages');
        return;
      }
      
      const input = document.getElementById('chat-input');
      const content = input.value.trim();
      
      if (!content) return;
      
      try {
        const guideId = 1; // TODO: récupérer le vrai guide_id
        
        const response = await axios.post('/api/messages/send', {
          sender_id: userId,
          recipient_id: guideId,
          inscription_id: inscriptionId,
          content: content
        });
        
        if (response.data.success) {
          addMessageToUI(content, true, new Date().toISOString());
          input.value = '';
        } else {
          alert('Erreur lors de l\\'envoi: ' + response.data.error);
        }
      } catch (error) {
        console.error('Erreur envoi message:', error);
        alert('Erreur lors de l\\'envoi du message');
      }
    });

    // Connexion SSE pour notifications temps réel
    function connectSSE() {
      if (!userId || eventSource) return;
      
      eventSource = new EventSource(\`/api/messages/stream/\${userId}\`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'unread_update') {
          if (!chatOpen && data.unread_count > 0) {
            updateUnreadBadge(data.unread_count);
            // Recharger messages si le chat est ouvert
            if (chatOpen) {
              loadMessages();
            }
          }
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        eventSource = null;
        // Retry après 5 secondes
        setTimeout(connectSSE, 5000);
      };
    }

    // Mettre à jour le badge de messages non lus
    function updateUnreadBadge(count) {
      const badge = document.getElementById('unread-badge');
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }

    // Charger le nombre de messages non lus au chargement
    if (userId) {
      axios.get(\`/api/messages/unread/\${userId}\`)
        .then(response => {
          if (response.data.success) {
            updateUnreadBadge(response.data.unread_count);
          }
        })
        .catch(console.error);
      
      // Connecter SSE
      connectSSE();
    }
  </script>
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
          <a href="#approche">Approche</a>
          <a href="#parcours">Parcours</a>
          <a href="#tarifs">Tarifs</a>
          <a href="#bienfaits">Bienfaits</a>
          <a href="#limites">Limites</a>
          <a href="/login">Connexion</a>
        </nav>

        <a class="btn btn-primary" href="/inscription">S'inscrire gratuitement</a>
      </div>
    </div>
  </header>

  <main>
    <!-- HERO -->
    <section id="top" style="border-bottom:none; padding-top: 34px;">
      <div class="wrap">
        <div class="kicker">Un guide pour vous</div>
        <h1>Une pratique ancienne. Un cadre clair. Un guide pour vous.</h1>
        <p class="lead">
          Inscription gratuite. Premier rendez‑vous offert. Pas d'effets. Pas de promesses.
          Juste l'essentiel : écrire votre manifeste, être écouté, recevoir une pratique structurée, et avancer.
        </p>
        <div class="ctaRow">
          <a class="btn btn-primary" href="/inscription">S'inscrire gratuitement</a>
          <a class="btn" href="#parcours">Voir le parcours</a>
        </div>
        <!-- Navigation retirée -->
      </div>
    </section>

    <!-- Section La vérité retirée -->

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
          <a class="btn btn-primary" href="/inscription">Prêt à commencer ? S'inscrire gratuitement</a>
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
            <a href="/inscription" class="btn" style="width: 100%; margin-top: auto;">Commencer</a>
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
              <li>✓ Peteks personnalisés</li>
              <li>✓ Psaumes adaptés à votre parcours</li>
              <li>✓ Attribution d'un Ange gardien</li>
              <li>✓ Accès complet à la plateforme</li>
              <li>✓ Suivi personnalisé</li>
            </ul>
            <a href="/inscription" class="btn btn-primary" style="width: 100%; margin-top: auto;">Choisir cette formule</a>
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
            <a href="/inscription" class="btn" style="width: 100%; margin-top: auto;">S'engager 6 mois</a>
          </div>

        </div>

        <p class="hint" style="text-align: center; margin-top: 30px;">
          Premier entretien gratuit pour tous. Vous ne payez qu'après validation mutuelle.
        </p>
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
</body>
</html>`)
})

export default app
