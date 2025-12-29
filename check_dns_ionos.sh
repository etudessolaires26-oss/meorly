#!/bin/bash
echo "🔍 Vérification DNS pour meorly.com..."
echo ""

echo "1️⃣ SPF @ (Root):"
curl -s "https://dns.google/resolve?name=meorly.com&type=TXT" | grep -o '"v=spf1[^"]*"' || echo "❌ Pas encore visible"
echo ""

echo "2️⃣ DKIM (resend._domainkey):"
curl -s "https://dns.google/resolve?name=resend._domainkey.meorly.com&type=TXT" | grep -o '"p=MIG[^"]*"' || echo "❌ Pas encore visible"
echo ""

echo "3️⃣ DMARC (_dmarc):"
curl -s "https://dns.google/resolve?name=_dmarc.meorly.com&type=TXT" | grep -o '"v=DMARC1[^"]*"' || echo "❌ Pas encore visible"
echo ""

echo "4️⃣ SPF send (TXT):"
curl -s "https://dns.google/resolve?name=send.meorly.com&type=TXT" | grep -o '"v=spf1[^"]*"' || echo "❌ Pas encore visible"
echo ""

echo "5️⃣ MX send:"
curl -s "https://dns.google/resolve?name=send.meorly.com&type=MX" | grep -o 'feedback-smtp' || echo "❌ Pas encore visible"
echo ""

echo "✅ Si tous les records sont visibles, les DNS sont propagés !"
echo "⏳ Sinon, attendez 10-20 minutes et relancez ce script."
