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
app.get('/', (req, res) => {
  res.redirect('/dashboard.html');
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 PayLoop server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
