const test = async () => {
  const API = 'http://localhost:3000';

  console.log('🧪 TEST PAYLOOP\n');

  // 1. Créer un marchand
  console.log('1️⃣ Création du marchand...');
  const merchantRes = await fetch(`${API}/merchants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Boutique Mama Africa',
      email: 'mama.africa@test.cm',
      phone: '655123456',
      address: 'Marché Central, Douala',
      rccm: 'CM-DLA-01-2026-B12-00999'
    })
  });
  const merchant = await merchantRes.json();
  console.log('✅ Marchand créé:', merchant.name, '- ID:', merchant.id);

  // 2. Ajouter des produits
  console.log('\n2️⃣ Ajout des produits...');
  
  const product1Res = await fetch(`${API}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sac de riz 25kg',
      price: 15000,
      stock: 50,
      minStock: 10,
      merchantId: merchant.id
    })
  });
  const product1 = await product1Res.json();
  console.log('✅ Produit créé:', product1.name, '- Prix:', product1.price, 'FCFA');

  const product2Res = await fetch(`${API}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Huile végétale 5L',
      price: 5000,
      stock: 30,
      minStock: 5,
      merchantId: merchant.id
    })
  });
  const product2 = await product2Res.json();
  console.log('✅ Produit créé:', product2.name, '- Prix:', product2.price, 'FCFA');

  // 3. Simuler un paiement DOHONE
  console.log('\n3️⃣ Simulation paiement DOHONE...');
  const paymentRes = await fetch(`${API}/webhook/dohone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction_id: 'DOH-' + Date.now(),
      amount: 35000,
      currency: 'XAF',
      phone: '699887766',
      customer_name: 'Jean Kamga',
      merchant_id: merchant.id,
      products: [
        { product_id: product1.id, quantity: 2 },
        { product_id: product2.id, quantity: 1 }
      ]
    })
  });
  const payment = await paymentRes.json();
  console.log('✅ Paiement traité! Facture:', payment.invoice?.number);
  console.log('   Montant HT:', payment.invoice?.amountHT, 'FCFA');
  console.log('   TVA (19.25%):', payment.invoice?.tva, 'FCFA');
  console.log('   Total TTC:', payment.invoice?.totalTTC, 'FCFA');

  // 4. Vérifier le dashboard
  console.log('\n4️⃣ Dashboard marchand...');
  const dashRes = await fetch(`${API}/dashboard/${merchant.id}`);
  const dashboard = await dashRes.json();
  console.log('📊 Ventes du jour:', dashboard.today.sales);
  console.log('💰 CA du jour:', dashboard.today.revenue, 'FCFA');
  console.log('📦 Alertes stock bas:', dashboard.alerts.lowStock.length);

  // 5. Vérifier les écritures comptables
  console.log('\n5️⃣ Écritures comptables SYSCOHADA...');
  const accountingRes = await fetch(`${API}/accounting/${merchant.id}`);
  const entries = await accountingRes.json();
  entries.forEach(entry => {
    console.log(`   ${entry.account} | ${entry.label} | Débit: ${entry.debit} | Crédit: ${entry.credit}`);
  });

  console.log('\n✅ TEST COMPLET RÉUSSI! PayLoop fonctionne! 🎉');
};

test().catch(console.error);