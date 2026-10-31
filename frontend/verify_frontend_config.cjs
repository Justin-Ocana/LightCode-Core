#!/usr/bin/env node
/**
 * Script para verificar la configuración del frontend
 */

const fs = require('fs');
const path = require('path');

function verifyFrontendConfig() {
  console.log('🔍 VERIFICANDO CONFIGURACIÓN DEL FRONTEND...');
  console.log('=' * 50);
  
  const issues = [];
  
  // 1. Verificar .env
  console.log('1. Verificando .env...');
  const envPath = '.env';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('lightcode-core-v1.onrender.com')) {
      console.log('   ✅ .env apunta a Render correctamente');
    } else if (envContent.includes('localhost:8000')) {
      console.log('   ❌ .env apunta a localhost (desarrollo)');
      issues.push('.env configurado para desarrollo');
    } else {
      console.log('   ⚠️  .env no contiene URL del backend');
      issues.push('.env sin URL del backend');
    }
  } else {
    console.log('   ❌ .env no encontrado');
    issues.push('.env faltante');
  }
  
  // 2. Verificar vercel.json
  console.log('2. Verificando vercel.json...');
  const vercelPath = 'vercel.json';
  if (fs.existsSync(vercelPath)) {
    const vercelContent = fs.readFileSync(vercelPath, 'utf8');
    
    if (vercelContent.includes('lightcode-core-v1.onrender.com')) {
      console.log('   ✅ vercel.json apunta a Render correctamente');
    } else if (vercelContent.includes('lightcode-backend.onrender.com')) {
      console.log('   ❌ vercel.json usa URL antigua de Render');
      issues.push('vercel.json con URL incorrecta');
    } else {
      console.log('   ⚠️  vercel.json no contiene rewrites a Render');
      issues.push('vercel.json sin rewrites');
    }
  } else {
    console.log('   ❌ vercel.json no encontrado');
    issues.push('vercel.json faltante');
  }
  
  // 3. Verificar manifest.json
  console.log('3. Verificando manifest.json...');
  const manifestPath = 'public/manifest.json';
  if (fs.existsSync(manifestPath)) {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    
    if (manifestContent.includes('"/loader.svg"')) {
      console.log('   ✅ manifest.json referencia loader.svg correctamente');
    } else if (manifestContent.includes('/src/assets/loader.svg')) {
      console.log('   ❌ manifest.json usa referencia incorrecta');
      issues.push('manifest.json con referencia incorrecta');
    } else {
      console.log('   ⚠️  manifest.json no contiene referencia a loader.svg');
    }
  } else {
    console.log('   ❌ manifest.json no encontrado');
    issues.push('manifest.json faltante');
  }
  
  // 4. Verificar loader.svg
  console.log('4. Verificando loader.svg...');
  if (fs.existsSync('public/loader.svg')) {
    console.log('   ✅ loader.svg existe en public/');
  } else {
    console.log('   ❌ loader.svg no encontrado en public/');
    issues.push('loader.svg faltante en public/');
  }
  
  // Resumen
  console.log('\n' + '=' * 50);
  if (issues.length > 0) {
    console.log('❌ PROBLEMAS ENCONTRADOS:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('\n🔧 Corrige estos problemas y vuelve a desplegar');
    return false;
  } else {
    console.log('✅ CONFIGURACIÓN DEL FRONTEND CORRECTA');
    console.log('\n🚀 Puedes proceder con el despliegue en Vercel');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. git add .');
    console.log('   2. git commit -m "Fix: Configuración frontend para producción"');
    console.log('   3. git push origin main');
    console.log('   4. Vercel desplegará automáticamente');
    return true;
  }
}

if (require.main === module) {
  const success = verifyFrontendConfig();
  process.exit(success ? 0 : 1);
}

module.exports = { verifyFrontendConfig };