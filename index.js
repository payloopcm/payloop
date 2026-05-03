const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
const TVA_RATE = 0.1925; // 19.25% TVA Cameroun

// ============================================
// PAGE D'ACCUEIL
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 PayLoop API is running!',
    version: '1.0.0',
    endpoints: {
      webhook: 'POST /webhook/dohone',
      merchants: 'GET /merchants',
      invoices: 'GET /invoices/:merchantId',
      products: 'GET /products/:merchantId'
    }
  });
});

// ============================================
// WEBHOOK DOHONE - Réception des paiements
// ============================================
app.post('/webhook/dohone', async (req, res) => {
  try {
    console.log('📥 Webhook DOHONE reçu:', req.body);
    
    const { 
      transaction_id,
      amount,
      currency,
      phone,
      customer_name,
      merchant_id,
      products // [{product_id, quantity}]
    } = req.body;

    // 1. Vérifier que le marchand existe
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchant_id }
    });

    if (!merchant) {
      return res.status(404).json({ error: 'Marchand non trouvé' });
    }

    // 2. Enregistrer le paiement
    const payment = await prisma.payment.create({
      data: {
        dohoneRef: transaction_id,
        amount: parseFloat(amount),
        currency: currency || 'XAF',
        payerPhone: phone,
        payerName: customer_name,
        merchantId: merchant_id
      }
    });

    // 3. Calculer les montants
    const amountHT = parseFloat(amount) / (1 + TVA_RATE);
    const tvaAmount = parseFloat(amount) - amountHT;

    // 4. Générer le numéro de facture
    const invoiceCount = await prisma.invoice.count({
      where: { merchantId: merchant_id }
    });
    const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

    // 5. Créer la facture
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        amount: amountHT,
        tva: tvaAmount,
        totalAmount: parseFloat(amount),
        merchantId: merchant_id,
        paymentId: payment.id
      }
    });

    // 6. Ajouter les lignes de facture et mettre à jour le stock
    if (products && products.length > 0) {
      for (const item of products) {
        const product = await prisma.product.findUnique({
          where: { id: item.product_id }
        });

        if (product) {
          // Créer la ligne de facture
          await prisma.invoiceItem.create({
            data: {
              quantity: item.quantity,
              unitPrice: product.price,
              totalPrice: product.price * item.quantity,
              productId: product.id,
              invoiceId: invoice.id
            }
          });

          // Mettre à jour le stock
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: product.stock - item.quantity }
          });

          // Alerte stock bas
          if (product.stock - item.quantity < product.minStock) {
            console.log(`⚠️ ALERTE STOCK BAS: ${product.name} - Reste: ${product.stock - item.quantity}`);
          }
        }
      }
    }

    // 7. Créer les écritures comptables SYSCOHADA
    const today = new Date();
    
    // Écriture 1: Débit Caisse (571) 
    await prisma.accountingEntry.create({
      data: {
        date: today,
        journal: 'CA',
        account: '571',
        label: `Encaissement ${invoiceNumber}`,
        debit: parseFloat(amount),
        credit: 0,
        merchantId: merchant_id
      }
    });

    // Écriture 2: Crédit Ventes (701)
    await prisma.accountingEntry.create({
      data: {
        date: today,
        journal: 'VE',
        account: '701',
        label: `Vente ${invoiceNumber}`,
        debit: 0,
        credit: amountHT,
        merchantId: merchant_id
      }
    });

    // Écriture 3: Crédit TVA collectée (4431)
    await prisma.accountingEntry.create({
      data: {
        date: today,
        journal: 'VE',
        account: '4431',
        label: `TVA sur ${invoiceNumber}`,
        debit: 0,
        credit: tvaAmount,
        merchantId: merchant_id
      }
    });

    console.log(`✅ Facture ${invoiceNumber} créée avec succès!`);

    res.json({
      success: true,
      invoice: {
        number: invoiceNumber,
        amountHT: amountHT.toFixed(2),
        tva: tvaAmount.toFixed(2),
        totalTTC: amount
      }
    });

  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    res.status(500).json({ error: 'Erreur interne', details: error.message });
  }
});

// ============================================
// API MARCHANDS
// ============================================

// Créer un marchand
app.post('/merchants', async (req, res) => {
  try {
    const { name, email, phone, address, nui, rccm } = req.body;
    
    const merchant = await prisma.merchant.create({
      data: { name, email, phone, address, nui, rccm }
    });
    
    res.json(merchant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liste des marchands
app.get('/merchants', async (req, res) => {
  const merchants = await prisma.merchant.findMany();
  res.json(merchants);
});

// ============================================
// API PRODUITS
// ============================================

// Ajouter un produit
app.post('/products', async (req, res) => {
  try {
    const { name, price, stock, minStock, merchantId } = req.body;
    
    const product = await prisma.product.create({
      data: { name, price, stock, minStock, merchantId }
    });
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liste des produits d'un marchand
app.get('/products/:merchantId', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { merchantId: req.params.merchantId }
  });
  res.json(products);
});

// ============================================
// API FACTURES
// ============================================

// Liste des factures d'un marchand
app.get('/invoices/:merchantId', async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { merchantId: req.params.merchantId },
    include: { items: true, payment: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(invoices);
});

// ============================================
// API COMPTABILITÉ
// ============================================

// Écritures comptables d'un marchand
app.get('/accounting/:merchantId', async (req, res) => {
  const entries = await prisma.accountingEntry.findMany({
    where: { merchantId: req.params.merchantId },
    orderBy: { date: 'desc' }
  });
  res.json(entries);
});

// ============================================
// API DASHBOARD
// ============================================

app.get('/dashboard/:merchantId', async (req, res) => {
  const merchantId = req.params.merchantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Ventes du jour
  const todayInvoices = await prisma.invoice.findMany({
    where: {
      merchantId,
      createdAt: { gte: today }
    }
  });

  const todayTotal = todayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  // Produits en stock bas
  const lowStockProducts = await prisma.product.findMany({
    where: {
      merchantId,
      stock: { lte: prisma.product.fields.minStock }
    }
  });

  // Total factures
  const totalInvoices = await prisma.invoice.count({
    where: { merchantId }
  });

  // CA total
  const allInvoices = await prisma.invoice.findMany({
    where: { merchantId }
  });
  const totalRevenue = allInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  res.json({
    today: {
      sales: todayInvoices.length,
      revenue: todayTotal
    },
    total: {
      invoices: totalInvoices,
      revenue: totalRevenue
    },
    alerts: {
      lowStock: lowStockProducts
    }
  });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 PayLoop API running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});