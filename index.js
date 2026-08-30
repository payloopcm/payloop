const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================
// PAGE D'ACCUEIL
// ============================================
// La page publique (public/index.html) est servie automatiquement sur "/"
// par express.static ci-dessus. Le tableau de bord reste accessible sur
// /dashboard.html (lien "Se connecter" / "Essayer gratuitement" de la page d'accueil).

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 PayLoop server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
